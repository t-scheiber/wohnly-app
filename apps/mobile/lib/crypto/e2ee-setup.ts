/**
 * E2EE setup helpers for household creation and joining.
 * Orchestrates device registration, key generation, sealing, and caching.
 */
import { Platform } from "react-native";
import { generateDeviceKeys, generateHouseholdKey } from "./keys";
import { sealToDevice, sealedToBase64, openSealedHK, base64ToSealed } from "./seal";
import { saveDeviceKeys, getDeviceKeys, hasDeviceKeys } from "./device-storage";
import { cacheHouseholdKey } from "./household-key-cache";
import { apiPost, api } from "@/lib/api/client";

/**
 * Ensure the current device is registered with the server.
 * If already registered, returns stored keys. Otherwise generates new keys and registers.
 */
export async function ensureDeviceRegistered(): Promise<{
  deviceId: string;
  publicKey: string;
  privateKey: Uint8Array;
}> {
  // Web doesn't support SecureStore — skip E2EE
  if (Platform.OS === "web") {
    throw new Error("E2EE not supported on web");
  }

  const existing = await getDeviceKeys();
  if (existing) return existing;

  // Generate new keypair
  const { publicKey, privateKey } = await generateDeviceKeys();

  // Register with server
  const res = await apiPost<{ deviceId: string }>("/api/devices/register", {
    publicKey,
    name: Platform.OS,
  });

  // Save to secure storage
  await saveDeviceKeys(res.deviceId, publicKey, privateKey);

  return { deviceId: res.deviceId, publicKey, privateKey };
}

/**
 * Create a new household with E2EE.
 * 1. Ensure device is registered
 * 2. Generate household key
 * 3. Seal household key to this device
 * 4. Send deviceId + sealedHK with household creation
 * 5. Cache the household key in memory
 */
export async function createHouseholdWithE2EE(name: string): Promise<{
  household: { id: string; inviteCode: string };
}> {
  if (Platform.OS === "web") {
    // Fallback: create without E2EE on web
    return apiPost("/api/households", { name });
  }

  const device = await ensureDeviceRegistered();
  const householdKey = await generateHouseholdKey();
  const sealed = await sealToDevice(householdKey, device.publicKey);
  const sealedHKBase64 = await sealedToBase64(sealed);

  const res = await apiPost<{ household: { id: string; inviteCode: string } }>(
    "/api/households",
    {
      name,
      deviceId: device.deviceId,
      sealedHK: sealedHKBase64,
    }
  );

  // Cache the household key in memory for immediate use
  cacheHouseholdKey(res.household.id, householdKey);

  return res;
}

/**
 * After joining a household, fetch and decrypt the sealed household key.
 * If no envelope exists yet (creator hasn't distributed keys), this is a no-op.
 */
export async function fetchAndCacheHouseholdKey(householdId: string): Promise<void> {
  if (Platform.OS === "web") return;

  const device = await getDeviceKeys();
  if (!device) return; // No device keys — can't decrypt

  try {
    const res = await api<{ envelope: { sealedHK: string } | null }>(
      `/api/households/${householdId}/envelopes?deviceId=${device.deviceId}`
    );

    if (res.envelope?.sealedHK) {
      const sealed = await base64ToSealed(res.envelope.sealedHK);
      const householdKey = await openSealedHK(sealed, device.publicKey, device.privateKey);
      cacheHouseholdKey(householdId, householdKey);
    }
  } catch {
    // Envelope may not exist yet — that's OK, keys will be distributed later
  }
}

/**
 * Distribute the household key to a new device.
 * Called by an existing member who has the household key.
 */
export async function distributeKeyToDevice(
  householdId: string,
  householdKey: Uint8Array,
  targetDevicePublicKey: string,
  targetDeviceId: string
): Promise<void> {
  const sealed = await sealToDevice(householdKey, targetDevicePublicKey);
  const sealedHKBase64 = await sealedToBase64(sealed);

  await apiPost("/api/households/distribute-keys", {
    householdId,
    envelopes: [{ deviceId: targetDeviceId, sealedHK: sealedHKBase64 }],
  });
}
