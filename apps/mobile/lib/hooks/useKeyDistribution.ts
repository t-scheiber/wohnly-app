/**
 * Heal-forward key distribution.
 *
 * When /key-state reports devices in this household missing the current epoch
 * AND we hold that epoch, seal the key to each missing device and upload.
 * The server upload endpoint is idempotent on (householdId, deviceId, keyEpoch)
 * so racing distributors are harmless — first writer wins.
 *
 * Election: no explicit election — the idempotency handles concurrent writers.
 * A small jitter on the first attempt avoids thundering-herd.
 *
 * Retry: single-pass per (missingAtEpoch) snapshot. Rely on React Query
 * invalidations from SSE to retrigger when state changes.
 */
import { useEffect, useRef } from "react";
import {
  useKeyState as useKeyStateServer,
  useUploadEnvelope,
} from "@/lib/api/queries";
import { setActiveHouseholdId, setActiveKeyEpoch } from "@/lib/crypto/active-household";
import {
  getCachedHouseholdKey,
  loadHouseholdKeyFromStorage,
} from "@/lib/crypto/household-key-cache";
import { fetchAndCacheHouseholdKey, sealHKToDevice } from "@/lib/crypto/e2ee-setup";
import { api } from "@/lib/api/client";
import { useHousehold } from "@/lib/hooks/useHousehold";

const INITIAL_JITTER_MS = 800;

export function useKeyDistribution(): void {
  const { data: household } = useHousehold();
  const householdId = household?.householdId ?? null;
  const keyState = useKeyStateServer(householdId ?? undefined);
  const upload = useUploadEnvelope();
  const runSignatureRef = useRef<string>("");

  // Keep active-household module in sync so mutations can resolve the current key.
  useEffect(() => {
    setActiveHouseholdId(householdId);
    if (keyState.data?.currentEpoch) setActiveKeyEpoch(keyState.data.currentEpoch);
  }, [householdId, keyState.data?.currentEpoch]);

  useEffect(() => {
    if (!householdId || !keyState.data) return;
    const { currentEpoch, missingAtEpoch } = keyState.data;

    // Build a stable signature so we only act once per distinct snapshot.
    const sig = `${currentEpoch}:${missingAtEpoch.map((m) => `${m.deviceId}@${m.epoch}`).sort().join(",")}`;
    if (sig === runSignatureRef.current) return;
    runSignatureRef.current = sig;

    if (missingAtEpoch.length === 0) return;

    let cancelled = false;
    const run = async () => {
      // Random jitter so multiple holders don't all try at the same millisecond.
      await new Promise((r) => setTimeout(r, Math.random() * INITIAL_JITTER_MS));
      if (cancelled) return;

      // Resolve the HK at the current epoch. If we don't hold it, we can't heal.
      let hk = getCachedHouseholdKey(householdId, currentEpoch);
      if (!hk) hk = await loadHouseholdKeyFromStorage(householdId, currentEpoch);
      if (!hk) {
        // Try to pull our own envelope first — we might just not have unsealed yet.
        const fetched = await fetchAndCacheHouseholdKey(householdId);
        if (!fetched) return;
        hk = getCachedHouseholdKey(householdId, currentEpoch);
        if (!hk) return;
      }

      for (const missing of missingAtEpoch) {
        if (cancelled) return;
        if (missing.epoch !== currentEpoch) continue; // We only heal the current epoch.
        try {
          const target = await api<{ device: { id: string; publicKey: string } }>(
            `/api/households/${householdId}/devices/${missing.deviceId}/public-key`,
          );
          const sealedHK = await sealHKToDevice(hk, target.device.publicKey);
          await upload.mutateAsync({
            householdId,
            deviceId: missing.deviceId,
            sealedHK,
            keyEpoch: currentEpoch,
          });
        } catch (err) {
          // Log but don't retry — the next /key-state snapshot will trigger us again.
          console.warn("[useKeyDistribution] heal failed for", missing.deviceId, err);
        }
      }
    };

    run().catch((err) => console.warn("[useKeyDistribution]", err));
    return () => {
      cancelled = true;
    };
  }, [householdId, keyState.data?.currentEpoch, JSON.stringify(keyState.data?.missingAtEpoch ?? []), upload]);
}
