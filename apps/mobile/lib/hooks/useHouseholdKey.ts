import { useState, useEffect, useCallback } from "react";
import { getCachedHouseholdKey, cacheHouseholdKey } from "../crypto/household-key-cache";
import { getDeviceKeys } from "../crypto/device-storage";
import { openSealedHK, base64ToSealed } from "../crypto/seal";
import { api } from "../api/client";

/**
 * Hook to load the decrypted household key.
 * Checks cache first, then fetches sealed envelope from server and unseals it.
 */
export function useHouseholdKey(householdId: string | null) {
  const [key, setKey] = useState<Uint8Array | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadKey = useCallback(async () => {
    if (!householdId) {
      setLoading(false);
      return;
    }

    // Check cache first
    const cached = getCachedHouseholdKey(householdId);
    if (cached) {
      setKey(cached);
      setLoading(false);
      return;
    }

    try {
      // Get device keys from SecureStore
      const deviceKeys = await getDeviceKeys();
      if (!deviceKeys) {
        setError("No device keys found");
        setLoading(false);
        return;
      }

      // Fetch sealed envelope from server
      const { envelope } = await api<{
        envelope: { sealedHK: string } | null;
      }>(`/api/households/${householdId}/envelopes?deviceId=${deviceKeys.deviceId}`);

      if (!envelope) {
        setError("No key envelope found for this device");
        setLoading(false);
        return;
      }

      // Unseal the household key
      const sealed = await base64ToSealed(envelope.sealedHK);
      const hk = await openSealedHK(sealed, deviceKeys.publicKey, deviceKeys.privateKey);

      // Cache and set
      cacheHouseholdKey(householdId, hk);
      setKey(hk);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load household key");
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    loadKey();
  }, [loadKey]);

  return { key, loading, error, reload: loadKey };
}
