/**
 * Module-level state for the active household ID + its current key epoch.
 *
 * Set from the signed-in app shell when household data loads.
 * Read from queryFn to get the encryption key without hooks. Mutations use
 * `resolveActiveEncryptionKey()` so cold-start hydration can complete first.
 */
import {
  getCachedHouseholdKey,
  loadHouseholdKeyFromStorage,
} from "./household-key-cache";
import { fetchAndCacheHouseholdKey } from "./e2ee-setup";
import { api } from "@/lib/api/client";

let _householdId: string | null = null;
let _currentEpoch: number = 1;
let _currentEpochReady = false;

export function setActiveHouseholdId(id: string | null) {
  if (id !== _householdId) _currentEpochReady = false;
  _householdId = id;
}

export function getActiveHouseholdId(): string | null {
  return _householdId;
}

/**
 * Track the household's current key epoch. Updated when `/api/households/:id/key-state`
 * resolves. Defaults to 1 so creators who haven't rotated can write without a round-trip.
 */
export function setActiveKeyEpoch(epoch: number): void {
  if (Number.isInteger(epoch) && epoch >= 1) {
    _currentEpoch = epoch;
    _currentEpochReady = true;
  }
}

export function getActiveKeyEpoch(): number {
  return _currentEpoch;
}

/**
 * Get the encryption key at a specific epoch (or the active epoch if omitted).
 * Returns null if no key is cached — callers must handle gracefully.
 */
export function getEncryptionKey(epoch: number = _currentEpoch): Uint8Array | null {
  if (!_householdId) return null;
  return getCachedHouseholdKey(_householdId, epoch);
}

/**
 * Get the encryption key or throw. Use in mutations that MUST encrypt before sending.
 */
export function requireEncryptionKey(epoch: number = _currentEpoch): Uint8Array {
  const hk = getEncryptionKey(epoch);
  if (!hk) {
    throw new EncryptionKeyMissingError();
  }
  return hk;
}

/**
 * Resolve the key for an encrypted write, including after a cold app start.
 *
 * The synchronous cache is intentionally only a fast path. On restart, the
 * key normally still exists in SecureStore/IndexedDB but has not been loaded
 * into memory yet. If storage does not contain it, try the device's current
 * server envelope before reporting that approval/distribution is incomplete.
 */
export async function resolveEncryptionKey(
  epoch: number = _currentEpoch,
): Promise<Uint8Array> {
  if (!_householdId) throw new EncryptionKeyMissingError();

  const cached = getCachedHouseholdKey(_householdId, epoch);
  if (cached) return cached;

  const persisted = await loadHouseholdKeyFromStorage(_householdId, epoch);
  if (persisted) return persisted;

  // fetchAndCacheHouseholdKey resolves the current epoch. Avoid using it for a
  // historical write epoch, which could return a different key after rotation.
  if (epoch === _currentEpoch) {
    await fetchAndCacheHouseholdKey(_householdId);
    const fetched = getCachedHouseholdKey(_householdId, epoch);
    if (fetched) return fetched;
  }

  throw new EncryptionKeyMissingError();
}

/**
 * Resolve the active household's current epoch and key as one atomic write
 * context. This prevents a restored deep link from briefly writing with the
 * default epoch before the app-level key-state query has completed.
 */
export async function resolveActiveEncryptionKey(): Promise<{
  key: Uint8Array;
  epoch: number;
}> {
  if (!_householdId) {
    const membership = await api<{ members: { householdId: string }[] }>(
      "/api/members/list",
    );
    setActiveHouseholdId(membership.members[0]?.householdId ?? null);
  }
  if (!_householdId) throw new EncryptionKeyMissingError();

  if (!_currentEpochReady) {
    const state = await api<{ currentEpoch: number }>(
      `/api/households/${_householdId}/key-state`,
    );
    setActiveKeyEpoch(state.currentEpoch);
  }

  const epoch = _currentEpoch;
  const key = await resolveEncryptionKey(epoch);
  return { key, epoch };
}

export class EncryptionKeyMissingError extends Error {
  constructor() {
    super("Encryption keys are still syncing. Please wait a moment and try again.");
    this.name = "EncryptionKeyMissingError";
  }
}
