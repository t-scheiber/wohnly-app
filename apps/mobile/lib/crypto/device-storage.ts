/**
 * Device key storage using expo-secure-store.
 * Replaces haushoit's IndexedDB-based storage.
 *
 * The device private key is stored securely and NEVER leaves the device.
 */
import * as SecureStore from "expo-secure-store";

const DEVICE_ID_KEY = "wohnly_device_id";
const DEVICE_PUBLIC_KEY = "wohnly_device_public_key";
const DEVICE_PRIVATE_KEY = "wohnly_device_private_key";

interface DeviceKeyStore {
  deviceId: string;
  publicKey: string; // base64
  privateKey: Uint8Array;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Save device keys to SecureStore.
 */
export async function saveDeviceKeys(
  deviceId: string,
  publicKey: string,
  privateKey: Uint8Array
): Promise<void> {
  await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  await SecureStore.setItemAsync(DEVICE_PUBLIC_KEY, publicKey, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  await SecureStore.setItemAsync(DEVICE_PRIVATE_KEY, uint8ArrayToBase64(privateKey), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

/**
 * Retrieve device keys from SecureStore.
 */
export async function getDeviceKeys(): Promise<DeviceKeyStore | null> {
  const deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  const publicKey = await SecureStore.getItemAsync(DEVICE_PUBLIC_KEY);
  const privateKeyB64 = await SecureStore.getItemAsync(DEVICE_PRIVATE_KEY);

  if (!deviceId || !publicKey || !privateKeyB64) return null;

  return {
    deviceId,
    publicKey,
    privateKey: base64ToUint8Array(privateKeyB64),
  };
}

/**
 * Check if device keys exist.
 */
export async function hasDeviceKeys(): Promise<boolean> {
  const deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  return deviceId !== null;
}

/**
 * Clear device keys (for logout/reset).
 */
export async function clearDeviceKeys(): Promise<void> {
  await SecureStore.deleteItemAsync(DEVICE_ID_KEY);
  await SecureStore.deleteItemAsync(DEVICE_PUBLIC_KEY);
  await SecureStore.deleteItemAsync(DEVICE_PRIVATE_KEY);
}
