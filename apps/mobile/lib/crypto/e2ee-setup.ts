/**
 * E2EE setup helpers for household creation and access (device enrollment + join).
 * Orchestrates key material, seals for post-approval envelope upload, and caches
 * the unsealed household key per epoch.
 */
import { Platform } from "react-native";
import { generateDeviceKeys, generateHouseholdKey } from "./keys";
import { sealToDevice, sealedToBase64, openSealedHK, base64ToSealed } from "./seal";
import { saveDeviceKeys, getDeviceKeys, getDeviceFingerprint } from "./device-storage";
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

export interface DeviceKeyMaterial {
  deviceId: string | null; // null until the first AccessRequest is approved
  publicKey: string;
  privateKey: Uint8Array;
  fingerprint: string;
}

/**
 * Ensure the device has a keypair + fingerprint. Safe to call repeatedly;
 * returns the existing keys if already present.
 *
 * Unlike the old flow, this does NOT register the device with the server —
 * registration happens implicitly when an AccessRequest is approved and the
 * server creates the Device row.
 */
export async function ensureDeviceKeyMaterial(): Promise<DeviceKeyMaterial> {
  const existing = await getDeviceKeys();
  const fingerprint = await getDeviceFingerprint();
  if (existing) {
    return {
      deviceId: existing.deviceId || null,
      publicKey: existing.publicKey,
      privateKey: existing.privateKey,
      fingerprint,
    };
  }

  const { publicKey, privateKey } = await generateDeviceKeys();
  // deviceId is empty until an approval produces a Device row on the server.
  await saveDeviceKeys("", publicKey, privateKey);
  return { deviceId: null, publicKey, privateKey, fingerprint };
}

/**
 * Create a new household with E2EE.
 * The creator is implicitly OWNER and holds epoch 1 immediately.
 *
 * Server creates the Device row + envelope + household in one transaction
 * from the body, so no pre-registration round-trip is needed.
 */
export async function createHouseholdWithE2EE(name: string): Promise<{
  household: { id: string; inviteCode: string };
}> {
  const material = await ensureDeviceKeyMaterial();
  const householdKey = await generateHouseholdKey();
  const sealed = await sealToDevice(householdKey, material.publicKey);
  const sealedHKBase64 = await sealedToBase64(sealed);

  const res = await apiPost<{
    household: { id: string; inviteCode: string };
    deviceId: string;
  }>("/api/households", {
    name,
    publicKey: material.publicKey,
    fingerprint: material.fingerprint,
    deviceName: getDeviceName(),
    sealedHK: sealedHKBase64,
  });

  if (res.deviceId !== material.deviceId) {
    await saveDeviceKeys(res.deviceId, material.publicKey, material.privateKey);
  }
  cacheHouseholdKey(res.household.id, 1, householdKey);
  return { household: res.household };
}

export type AccessRequestCreateResult = {
  id: string;
  verificationCode: string;
  expiresAt: string;
};

/**
 * Request enrollment of this device into an existing household the user
 * already belongs to. The user reads the returned verificationCode on this
 * device and types it into one of their other already-approved devices.
 */
export async function requestDeviceEnrollment(
  householdId: string,
): Promise<AccessRequestCreateResult> {
  const device = await ensureDeviceKeyMaterial();
  return apiPost<AccessRequestCreateResult>("/api/access/requests", {
    kind: "DEVICE_ENROLLMENT",
    householdId,
    requesterDevicePublicKey: device.publicKey,
    requesterDeviceFingerprint: device.fingerprint,
    requesterDeviceName: getDeviceName(),
  });
}

/**
 * Request to join a household using an invitation code. The requester reads
 * the verification code from their device and sends it (out-of-band) to an
 * OWNER, who types it into their app to approve.
 */
export async function requestHouseholdJoin(
  invitationCode: string,
): Promise<AccessRequestCreateResult> {
  const device = await ensureDeviceKeyMaterial();
  return apiPost<AccessRequestCreateResult>("/api/access/requests", {
    kind: "HOUSEHOLD_JOIN",
    invitationCode,
    requesterDevicePublicKey: device.publicKey,
    requesterDeviceFingerprint: device.fingerprint,
    requesterDeviceName: getDeviceName(),
  });
}

/**
 * After approval (SSE event or manual poll), fetch the sealed envelope at the
 * current epoch, unseal it, and cache it. Returns false if no envelope exists
 * yet (approval hasn't landed for this device at this epoch).
 */
export async function fetchAndCacheHouseholdKey(householdId: string): Promise<boolean> {
  const device = await getDeviceKeys();
  if (!device) return false;

  try {
    const state = await api<{ currentEpoch: number }>(`/api/households/${householdId}/key-state`);
    const res = await api<{
      envelopes: { deviceId: string; sealedHK: string; keyEpoch: number }[];
    }>(
      `/api/households/${householdId}/envelopes/${state.currentEpoch}`,
    );
    const ownEnvelope = res.envelopes.find(
      (envelope) => envelope.deviceId === device.deviceId,
    );
    if (!ownEnvelope) return false;
    const sealed = await base64ToSealed(ownEnvelope.sealedHK);
    const hk = await openSealedHK(sealed, device.publicKey, device.privateKey);
    cacheHouseholdKey(householdId, state.currentEpoch, hk);
    return true;
  } catch {
    return false;
  }
}

/**
 * Seal the household key we hold to a peer device's public key — used by
 * `useKeyDistribution` when heal-forward reseals to devices missing the
 * current epoch's envelope.
 */
export async function sealHKToDevice(
  householdKey: Uint8Array,
  targetDevicePublicKey: string,
): Promise<string> {
  const sealed = await sealToDevice(householdKey, targetDevicePublicKey);
  return sealedToBase64(sealed);
}

/**
 * Legacy alias — kept for callers that only care that device key material is
 * ready. Does not register with the server; device rows are now created on
 * AccessRequest approval.
 */
export const ensureDeviceRegistered = ensureDeviceKeyMaterial;

/**
 * Legacy direct-distribute helper — kept during the transition so the old
 * pending-devices approve flow in settings.tsx still compiles. Task 40b
 * replaces that flow with the new AccessRequest approval modal; this helper
 * is expected to disappear once that lands.
 */
export async function distributeKeyToDevice(
  householdId: string,
  householdKey: Uint8Array,
  targetDevicePublicKey: string,
  targetDeviceId: string,
): Promise<void> {
  const sealedHK = await sealHKToDevice(householdKey, targetDevicePublicKey);
  const state = await api<{ currentEpoch: number }>(`/api/households/${householdId}/key-state`);
  await apiPost(`/api/households/${householdId}/envelopes`, {
    deviceId: targetDeviceId,
    sealedHK,
    keyEpoch: state.currentEpoch,
  });
}
