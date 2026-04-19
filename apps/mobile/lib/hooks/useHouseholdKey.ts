import { useState, useEffect, useCallback } from "react";
import { getCachedHouseholdKey, cacheHouseholdKey, loadHouseholdKeyFromStorage } from "../crypto/household-key-cache";
import { getDeviceKeys } from "../crypto/device-storage";
import { openSealedHK, base64ToSealed } from "../crypto/seal";
import { api } from "../api/client";

/**
 * Hook to load the decrypted household key at a given epoch.
 * Checks cache first, then fetches the sealed envelope for that epoch and unseals it.
 * Epoch defaults to the household's current epoch fetched from /key-state.
 */
export function useHouseholdKey(householdId: string | null, epoch?: number) {
  const [key, setKey] = useState<Uint8Array | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadKey = useCallback(async () => {
    if (!householdId) {
      setLoading(false);
      return;
    }

    let targetEpoch = epoch;
    if (!targetEpoch) {
      try {
        const state = await api<{ currentEpoch: number }>(`/api/households/${householdId}/key-state`);
        targetEpoch = state.currentEpoch;
      } catch {
        targetEpoch = 1;
      }
    }

    // Check in-memory cache first, then persistent storage
    const cached =
      getCachedHouseholdKey(householdId, targetEpoch) ??
      (await loadHouseholdKeyFromStorage(householdId, targetEpoch));
    if (cached) {
      setKey(cached);
      setLoading(false);
      return;
    }

    try {
      const deviceKeys = await getDeviceKeys();
      if (!deviceKeys) {
        setError("No device keys found");
        setLoading(false);
        return;
      }

      const { envelopes } = await api<{
        envelopes: { sealedHK: string; keyEpoch: number }[];
      }>(`/api/households/${householdId}/envelopes/${targetEpoch}`);

      if (!envelopes || envelopes.length === 0) {
        setError("No key envelope found for this device");
        setLoading(false);
        return;
      }

      const sealed = await base64ToSealed(envelopes[0].sealedHK);
      const hk = await openSealedHK(sealed, deviceKeys.publicKey, deviceKeys.privateKey);

      cacheHouseholdKey(householdId, targetEpoch, hk);
      setKey(hk);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load household key");
    } finally {
      setLoading(false);
    }
  }, [householdId, epoch]);

  useEffect(() => {
    loadKey();
  }, [loadKey]);

  return { key, loading, error, reload: loadKey };
}
