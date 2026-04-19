/**
 * Module-level state for the active household ID + its current key epoch.
 *
 * Set from the dashboard when household data loads.
 * Read from queryFn to get the encryption key without hooks — mutations
 * resolve the key synchronously via `requireEncryptionKey()`.
 */
import { getCachedHouseholdKey } from "./household-key-cache";

let _householdId: string | null = null;
let _currentEpoch: number = 1;

export function setActiveHouseholdId(id: string | null) {
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
  if (Number.isInteger(epoch) && epoch >= 1) _currentEpoch = epoch;
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

export class EncryptionKeyMissingError extends Error {
  constructor() {
    super("Encryption keys are still syncing. Please wait a moment and try again.");
    this.name = "EncryptionKeyMissingError";
  }
}
