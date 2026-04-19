/**
 * Household key cache with persistent storage, keyed by (householdId, epoch).
 *
 * Keys are held in-memory for synchronous access from encrypt/decrypt paths,
 * and persisted to IndexedDB (web) or SecureStore (native) so they survive
 * restarts. Each epoch is stored under its own storage slot so historical
 * content (written under older epochs) stays decryptable after rotation.
 */
import { Platform } from "react-native";

const STORAGE_PREFIX = "wohnly_hk_";

// ── In-memory cache (fast path) ──

function memKey(householdId: string, epoch: number): string {
  return `${householdId}:${epoch}`;
}

function storageKey(householdId: string, epoch: number): string {
  return `${STORAGE_PREFIX}${householdId}_${epoch}`;
}

const cache = new Map<string, Uint8Array>();

// Remembers which household IDs we've touched so clearHouseholdKeys() can
// enumerate their persisted epochs without guessing a range up front.
const touchedHouseholds = new Set<string>();

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

async function persistKey(householdId: string, epoch: number, key: Uint8Array): Promise<void> {
  const b64 = uint8ArrayToBase64(key);
  const slot = storageKey(householdId, epoch);

  if (Platform.OS === "web") {
    try {
      const db = await openIDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(b64, slot);
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
    await SecureStore.setItemAsync(slot, b64, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch (err) {
    console.warn("[household-key-cache] Failed to persist key to SecureStore:", err);
  }
}

async function loadPersistedKey(householdId: string, epoch: number): Promise<Uint8Array | null> {
  const slot = storageKey(householdId, epoch);

  if (Platform.OS === "web") {
    try {
      const db = await openIDB();
      const result = await new Promise<string | null>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readonly");
        const req = tx.objectStore(IDB_STORE).get(slot);
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
    const b64 = await SecureStore.getItemAsync(slot);
    return b64 ? base64ToUint8Array(b64) : null;
  } catch {
    return null;
  }
}

async function deletePersistedKey(householdId: string, epoch: number): Promise<void> {
  const slot = storageKey(householdId, epoch);

  if (Platform.OS === "web") {
    try {
      const db = await openIDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).delete(slot);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {}
    return;
  }

  try {
    const SecureStore = await import("expo-secure-store");
    await SecureStore.deleteItemAsync(slot);
  } catch {}
}

// ── Public API ──

export function cacheHouseholdKey(householdId: string, epoch: number, key: Uint8Array): void {
  cache.set(memKey(householdId, epoch), key);
  touchedHouseholds.add(householdId);
  // Persist in background — don't block the caller
  persistKey(householdId, epoch, key).catch(() => {});
}

export function getCachedHouseholdKey(householdId: string, epoch: number): Uint8Array | null {
  return cache.get(memKey(householdId, epoch)) ?? null;
}

export function hasHouseholdKey(householdId: string, epoch: number): boolean {
  return cache.has(memKey(householdId, epoch));
}

/**
 * Try to load the household key from persistent storage into the in-memory cache.
 * Returns the key if found, null otherwise.
 */
export async function loadHouseholdKeyFromStorage(
  householdId: string,
  epoch: number,
): Promise<Uint8Array | null> {
  const mk = memKey(householdId, epoch);
  const cached = cache.get(mk);
  if (cached) return cached;

  const persisted = await loadPersistedKey(householdId, epoch);
  if (persisted) {
    cache.set(mk, persisted);
    touchedHouseholds.add(householdId);
    return persisted;
  }
  return null;
}

/**
 * Clear all known household keys from memory and from persistent storage.
 * Used on sign-out and on "Reset household" escape hatch.
 */
export function clearHouseholdKeys(): void {
  const toDelete: Array<{ householdId: string; epoch: number }> = [];
  for (const key of cache.keys()) {
    const [householdId, epochStr] = key.split(":");
    const epoch = Number(epochStr);
    if (householdId && Number.isInteger(epoch)) {
      toDelete.push({ householdId, epoch });
    }
  }
  cache.clear();
  // Best-effort sweep of persisted epochs for every touched household.
  // Epochs rotate monotonically; 1..50 is a safe upper bound for active users.
  for (const householdId of touchedHouseholds) {
    for (let epoch = 1; epoch <= 50; epoch++) {
      deletePersistedKey(householdId, epoch).catch(() => {});
    }
  }
  for (const { householdId, epoch } of toDelete) {
    deletePersistedKey(householdId, epoch).catch(() => {});
  }
  touchedHouseholds.clear();
}
