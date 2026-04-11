/**
 * Device key storage.
 * Native (iOS/Android): expo-secure-store
 * Web: IndexedDB
 *
 * The device private key NEVER leaves the device.
 */
import { Platform } from "react-native";

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

// ── IndexedDB helpers (web only) ──

const IDB_NAME = "wohnly-keys";
const IDB_STORE = "device-keys";

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) {
        req.result.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Public API ──

export async function saveDeviceKeys(
  deviceId: string,
  publicKey: string,
  privateKey: Uint8Array
): Promise<void> {
  if (Platform.OS === "web") {
    await idbSet(DEVICE_ID_KEY, deviceId);
    await idbSet(DEVICE_PUBLIC_KEY, publicKey);
    await idbSet(DEVICE_PRIVATE_KEY, uint8ArrayToBase64(privateKey));
    return;
  }

  const SecureStore = await import("expo-secure-store");
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

export async function getDeviceKeys(): Promise<DeviceKeyStore | null> {
  let deviceId: string | null;
  let publicKey: string | null;
  let privateKeyB64: string | null;

  if (Platform.OS === "web") {
    deviceId = await idbGet(DEVICE_ID_KEY);
    publicKey = await idbGet(DEVICE_PUBLIC_KEY);
    privateKeyB64 = await idbGet(DEVICE_PRIVATE_KEY);
  } else {
    const SecureStore = await import("expo-secure-store");
    deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    publicKey = await SecureStore.getItemAsync(DEVICE_PUBLIC_KEY);
    privateKeyB64 = await SecureStore.getItemAsync(DEVICE_PRIVATE_KEY);
  }

  if (!deviceId || !publicKey || !privateKeyB64) return null;

  return {
    deviceId,
    publicKey,
    privateKey: base64ToUint8Array(privateKeyB64),
  };
}

export async function hasDeviceKeys(): Promise<boolean> {
  if (Platform.OS === "web") {
    return (await idbGet(DEVICE_ID_KEY)) !== null;
  }
  const SecureStore = await import("expo-secure-store");
  return (await SecureStore.getItemAsync(DEVICE_ID_KEY)) !== null;
}

export async function clearDeviceKeys(): Promise<void> {
  if (Platform.OS === "web") {
    await idbDelete(DEVICE_ID_KEY);
    await idbDelete(DEVICE_PUBLIC_KEY);
    await idbDelete(DEVICE_PRIVATE_KEY);
    return;
  }
  const SecureStore = await import("expo-secure-store");
  await SecureStore.deleteItemAsync(DEVICE_ID_KEY);
  await SecureStore.deleteItemAsync(DEVICE_PUBLIC_KEY);
  await SecureStore.deleteItemAsync(DEVICE_PRIVATE_KEY);
}
