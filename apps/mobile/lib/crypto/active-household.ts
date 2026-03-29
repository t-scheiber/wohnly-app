/**
 * Module-level state for the active household ID.
 * Set from the dashboard when household data loads.
 * Read from queryFn to get the encryption key without hooks.
 */
import { getCachedHouseholdKey } from "./household-key-cache";

let _householdId: string | null = null;

export function setActiveHouseholdId(id: string | null) {
  _householdId = id;
}

export function getActiveHouseholdId(): string | null {
  return _householdId;
}

/**
 * Get the encryption key for the active household.
 * Returns null on web or if no key is cached.
 */
export function getEncryptionKey(): Uint8Array | null {
  if (!_householdId) return null;
  return getCachedHouseholdKey(_householdId);
}
