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
 * Returns null if no key is cached.
 */
export function getEncryptionKey(): Uint8Array | null {
  if (!_householdId) return null;
  return getCachedHouseholdKey(_householdId);
}

/**
 * Get the encryption key or throw.
 * Use this in mutations that MUST encrypt data before sending.
 */
export function requireEncryptionKey(): Uint8Array {
  const hk = getEncryptionKey();
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
