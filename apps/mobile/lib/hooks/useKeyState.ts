import { useEffect, useState } from "react";
import { useKeyState as useKeyStateServer, usePendingRequests } from "@/lib/api/queries";
import { getCachedHouseholdKey, loadHouseholdKeyFromStorage } from "@/lib/crypto/household-key-cache";

async function getHouseholdKey(householdId: string, epoch: number) {
  return getCachedHouseholdKey(householdId, epoch) ?? loadHouseholdKeyFromStorage(householdId, epoch);
}

/**
 * Derived key state for the current device: is the key ready, is an approval
 * outstanding, is distribution stalled, or has something broken?
 *
 * Tier timing matches the spec (Surface A):
 *  - Tier 1 (<30s): transient; show subtle indicator
 *  - Tier 2 (30s–2m): show "still waiting" hint
 *  - Tier 3 (>2m): show recoverable help link
 */
export type KeyState =
  | { kind: "ready"; epoch: number }
  | { kind: "awaiting_approval"; requestId: string }
  | { kind: "awaiting_distribution"; tier: 1 | 2 | 3; sinceMs: number }
  | { kind: "broken"; reason: string };

const TIER_2_MS = 30_000;
const TIER_3_MS = 2 * 60_000;

export function useKeyState(householdId: string | undefined): KeyState {
  const server = useKeyStateServer(householdId);
  const outgoing = usePendingRequests("outgoing");
  const [stalledSince, setStalledSince] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  // Track when we first noticed the current device is missing the current epoch
  useEffect(() => {
    if (!server.data) return;
    const missing = !server.data.myEpochs.includes(server.data.currentEpoch);
    if (missing && stalledSince === null) setStalledSince(Date.now());
    if (!missing && stalledSince !== null) setStalledSince(null);
  }, [server.data, stalledSince]);

  // Drive tier transitions — re-render every 10s while stalled
  useEffect(() => {
    if (stalledSince === null) return;
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, [stalledSince]);

  // Check the local cache for the current epoch — a server ack doesn't
  // guarantee we've unsealed and persisted it.
  const [localHasKey, setLocalHasKey] = useState<boolean | null>(null);
  useEffect(() => {
    if (!householdId || !server.data) return;
    let cancelled = false;
    getHouseholdKey(householdId, server.data.currentEpoch).then((k) => {
      if (!cancelled) setLocalHasKey(!!k);
    });
    return () => { cancelled = true; };
  }, [householdId, server.data?.currentEpoch]);

  const pending = outgoing.data?.requests.find((r) => r.status === "PENDING");
  if (pending) {
    return { kind: "awaiting_approval", requestId: pending.id };
  }

  if (!server.data) {
    return { kind: "awaiting_distribution", tier: 1, sinceMs: 0 };
  }

  const missing = !server.data.myEpochs.includes(server.data.currentEpoch) || localHasKey === false;
  if (missing) {
    const since = stalledSince ? Date.now() - stalledSince : 0;
    const tier: 1 | 2 | 3 = since >= TIER_3_MS ? 3 : since >= TIER_2_MS ? 2 : 1;
    // tick is referenced so the linter doesn't drop the interval dependency.
    void tick;
    return { kind: "awaiting_distribution", tier, sinceMs: since };
  }

  return { kind: "ready", epoch: server.data.currentEpoch };
}
