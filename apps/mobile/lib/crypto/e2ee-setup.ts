/**
 * E2EE setup helpers for household creation and joining.
 * Orchestrates device registration, key generation, sealing, and caching.
 * Works on all platforms (iOS, Android, Web).
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
  const existing = await getDeviceKeys();
  if (existing) return existing;

  // Generate new keypair
  const { publicKey, privateKey } = await generateDeviceKeys();

  // Build a descriptive device name
  let deviceName: string = Platform.OS;
  if (Platform.OS === "web" && typeof navigator !== "undefined") {
    const ua = navigator.userAgent;
    if (ua.includes("Macintosh")) deviceName = "macOS Web";
    else if (ua.includes("Windows")) deviceName = "Windows Web";
    else if (ua.includes("Linux")) deviceName = "Linux Web";
    else deviceName = "Web Browser";
  } else if (Platform.OS === "ios") {
    deviceName = "iPhone";
  } else if (Platform.OS === "android") {
    deviceName = "Android";
  }

  // Register with server (deduplicates by publicKey)
  const res = await apiPost<{ deviceId: string; status: string }>("/api/devices/register", {
    publicKey,
    name: deviceName,
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
