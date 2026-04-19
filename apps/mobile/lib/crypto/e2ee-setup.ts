/**
 * E2EE setup helpers for household creation and joining.
 * Orchestrates device registration, key generation, sealing, and caching.
 * Works on all platforms (iOS, Android, Web).
 */
import { Platform } from "react-native";
import { generateDeviceKeys, generateHouseholdKey } from "./keys";
import { sealToDevice, sealedToBase64, openSealedHK, base64ToSealed } from "./seal";
import { saveDeviceKeys, getDeviceKeys, hasDeviceKeys, getDeviceFingerprint } from "./device-storage";
import { cacheHouseholdKey } from "./household-key-cache";
import { apiPost, api } from "@/lib/api/client";
import { isTauri } from "@/lib/auth/tauri";

function getDeviceName(): string {
  if (Platform.OS === "web" && typeof navigator !== "undefined") {
    const ua = navigator.userAgent;
    if (isTauri()) {
      if (ua.includes("Windows")) return "Windows Desktop";
      if (ua.includes("Macintosh")) return "macOS Desktop";
      return "Desktop";
    }
    if (ua.includes("Macintosh")) return "macOS Web";
    if (ua.includes("Windows")) return "Windows Web";
    if (ua.includes("Linux")) return "Linux Web";
    return "Web Browser";
  }
  if (Platform.OS === "ios") return "iPhone";
  if (Platform.OS === "android") return "Android";
  return Platform.OS;
}

/**
 * Ensure the current device is registered with the server.
 * If already registered, validates with the server (handles account deletion/recreation).
 * Otherwise generates new keys and registers.
 */
export async function ensureDeviceRegistered(): Promise<{
  deviceId: string;
  publicKey: string;
  privateKey: Uint8Array;
}> {
  const existing = await getDeviceKeys();
  const fingerprint = await getDeviceFingerprint();

  if (existing) {
    // Validate cached keys with server — the register endpoint deduplicates
    // by publicKey (and fingerprint). If the account was deleted and recreated,
    // the server will assign a new deviceId which we update in the cache.
    const res = await apiPost<{ deviceId: string; status: string }>("/api/devices/register", {
      publicKey: existing.publicKey,
      name: getDeviceName(),
      fingerprint,
    });

    if (res.deviceId !== existing.deviceId) {
      await saveDeviceKeys(res.deviceId, existing.publicKey, existing.privateKey);
      return { deviceId: res.deviceId, publicKey: existing.publicKey, privateKey: existing.privateKey };
    }

    return existing;
  }

  // Generate new keypair
  const { publicKey, privateKey } = await generateDeviceKeys();

  // Register with server (deduplicates by fingerprint, then publicKey)
  const res = await apiPost<{ deviceId: string; status: string }>("/api/devices/register", {
    publicKey,
    name: getDeviceName(),
    fingerprint,
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

  // Cache the household key in memory for immediate use (new households start at epoch 1)
  cacheHouseholdKey(res.household.id, 1, householdKey);

  return res;
}

/**
 * After joining a household, fetch and decrypt the sealed household key for the
 * current epoch. If no envelope exists yet (device not yet approved at this epoch),
 * returns false so the caller can surface "awaiting distribution" UI.
 */
export async function fetchAndCacheHouseholdKey(householdId: string): Promise<boolean> {
  const device = await getDeviceKeys();
  if (!device) return false;

  try {
    const state = await api<{ currentEpoch: number }>(`/api/households/${householdId}/key-state`);
    const res = await api<{ envelopes: { sealedHK: string; keyEpoch: number }[] }>(
      `/api/households/${householdId}/envelopes/${state.currentEpoch}`,
    );

    if (res.envelopes.length === 0) return false;
    const sealed = await base64ToSealed(res.envelopes[0].sealedHK);
    const householdKey = await openSealedHK(sealed, device.publicKey, device.privateKey);
    cacheHouseholdKey(householdId, state.currentEpoch, householdKey);
    return true;
  } catch {
    // Envelope may not exist yet — key distribution event will trigger a retry
    return false;
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
