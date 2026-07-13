import { Platform } from "react-native";

const IDB_NAME = "wohnly-keys";
const IDB_STORE = "device-keys";
const STORAGE_PREFIX = "wohnly_personal_key_";
const cache = new Map<string, Uint8Array>();
const touchedSlots = new Set<string>();

function slot(userId: string, epoch: number): string {
  return `${STORAGE_PREFIX}${userId}_${epoch}`;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(IDB_STORE)) {
        request.result.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readPersisted(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      const db = await openIDB();
      return await new Promise((resolve, reject) => {
        const request = db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(key);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return null;
    }
  }
  try {
    const SecureStore = await import("expo-secure-store");
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function writePersisted(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    const db = await openIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return;
  }
  const SecureStore = await import("expo-secure-store");
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function deletePersisted(key: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      const db = await openIDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {}
    return;
  }
  try {
    const SecureStore = await import("expo-secure-store");
    await SecureStore.deleteItemAsync(key);
  } catch {}
}

export function getCachedPersonalKey(userId: string, epoch: number): Uint8Array | null {
  return cache.get(slot(userId, epoch)) ?? null;
}

export function cachePersonalKey(userId: string, epoch: number, key: Uint8Array): void {
  const keySlot = slot(userId, epoch);
  cache.set(keySlot, key);
  touchedSlots.add(keySlot);
  writePersisted(keySlot, toBase64(key)).catch((error) =>
    console.warn("[personal-key-cache] Failed to persist key", error),
  );
}

export async function loadPersonalKeyFromStorage(
  userId: string,
  epoch: number,
): Promise<Uint8Array | null> {
  const keySlot = slot(userId, epoch);
  const cached = cache.get(keySlot);
  if (cached) return cached;
  const persisted = await readPersisted(keySlot);
  if (!persisted) return null;
  const key = fromBase64(persisted);
  cache.set(keySlot, key);
  touchedSlots.add(keySlot);
  return key;
}

export function clearPersonalKeys(): void {
  const slots = new Set([...cache.keys(), ...touchedSlots]);
  cache.clear();
  touchedSlots.clear();
  for (const keySlot of slots) deletePersisted(keySlot).catch(() => {});
}
