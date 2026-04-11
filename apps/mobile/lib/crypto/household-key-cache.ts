/**
 * Household key cache with persistent storage.
 * Keys are cached in-memory for fast access and persisted to
 * IndexedDB (web) or SecureStore (native) to survive restarts.
 */
import { Platform } from "react-native";

const STORAGE_PREFIX = "wohnly_hk_";

// ── In-memory cache (fast path) ──

const cache = new Map<string, Uint8Array>();

// ── Persistence helpers ──

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

// IndexedDB for web
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

async function persistKey(householdId: string, key: Uint8Array): Promise<void> {
  const b64 = uint8ArrayToBase64(key);
  const storageKey = `${STORAGE_PREFIX}${householdId}`;

  if (Platform.OS === "web") {
    try {
      const db = await openIDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(b64, storageKey);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn("[household-key-cache] Failed to persist key to IndexedDB:", err);
    }
    return;
  }

  try {
    const SecureStore = await import("expo-secure-store");
    await SecureStore.setItemAsync(storageKey, b64, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch (err) {
    console.warn("[household-key-cache] Failed to persist key to SecureStore:", err);
  }
}

async function loadPersistedKey(householdId: string): Promise<Uint8Array | null> {
  const storageKey = `${STORAGE_PREFIX}${householdId}`;

  if (Platform.OS === "web") {
    try {
      const db = await openIDB();
      const result = await new Promise<string | null>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readonly");
        const req = tx.objectStore(IDB_STORE).get(storageKey);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
      return result ? base64ToUint8Array(result) : null;
    } catch {
      return null;
    }
  }

  try {
    const SecureStore = await import("expo-secure-store");
    const b64 = await SecureStore.getItemAsync(storageKey);
    return b64 ? base64ToUint8Array(b64) : null;
  } catch {
    return null;
  }
}

async function deletePersistedKey(householdId: string): Promise<void> {
  const storageKey = `${STORAGE_PREFIX}${householdId}`;

  if (Platform.OS === "web") {
    try {
      const db = await openIDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).delete(storageKey);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {}
    return;
  }

  try {
    const SecureStore = await import("expo-secure-store");
    await SecureStore.deleteItemAsync(storageKey);
  } catch {}
}

// ── Public API ──

export function cacheHouseholdKey(householdId: string, key: Uint8Array): void {
  cache.set(householdId, key);
  // Persist in background — don't block the caller
  persistKey(householdId, key).catch(() => {});
}

export function getCachedHouseholdKey(householdId: string): Uint8Array | null {
  return cache.get(householdId) ?? null;
}

/**
 * Try to load the household key from persistent storage into the in-memory cache.
 * Returns the key if found, null otherwise.
 */
export async function loadHouseholdKeyFromStorage(householdId: string): Promise<Uint8Array | null> {
  // Check in-memory first
  const cached = cache.get(householdId);
  if (cached) return cached;

  // Try persistent storage
  const persisted = await loadPersistedKey(householdId);
  if (persisted) {
    cache.set(householdId, persisted);
    return persisted;
  }
  return null;
}

export function clearHouseholdKeys(): void {
  // Clear all persisted keys we know about
  for (const householdId of cache.keys()) {
    deletePersistedKey(householdId).catch(() => {});
  }
  cache.clear();
}

export function hasHouseholdKey(householdId: string): boolean {
  return cache.has(householdId);
}
