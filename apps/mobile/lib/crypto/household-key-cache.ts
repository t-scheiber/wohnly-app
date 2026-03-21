/**
 * In-memory cache for decrypted household keys.
 * Keys are cleared on app restart for security.
 * Same pattern as haushoit/lib/crypto/household-key-cache.ts.
 */

const cache = new Map<string, Uint8Array>();

export function cacheHouseholdKey(householdId: string, key: Uint8Array): void {
  cache.set(householdId, key);
}

export function getCachedHouseholdKey(householdId: string): Uint8Array | null {
  return cache.get(householdId) ?? null;
}

export function clearHouseholdKeys(): void {
  cache.clear();
}

export function hasHouseholdKey(householdId: string): boolean {
  return cache.has(householdId);
}
