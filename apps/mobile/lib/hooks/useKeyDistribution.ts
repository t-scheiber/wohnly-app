/**
 * Auto-distributes household encryption keys to new member devices.
 * Runs in the background when the dashboard loads.
 *
 * Flow:
 * 1. Check if we have the household key cached
 * 2. Fetch all approved devices in the household
 * 3. Check which devices don't have an envelope yet
 * 4. Seal the key to those devices and upload
 */
import { useEffect } from "react";
import { getCachedHouseholdKey, loadHouseholdKeyFromStorage } from "@/lib/crypto/household-key-cache";
import { fetchAndCacheHouseholdKey } from "@/lib/crypto/e2ee-setup";
import { setActiveHouseholdId, setActiveKeyEpoch } from "@/lib/crypto/active-household";
import { api } from "@/lib/api/client";
import { useHousehold } from "@/lib/hooks/useHousehold";

export function useKeyDistribution() {
  const { data: household } = useHousehold();

  useEffect(() => {
    // Set active household for encryption key access in queryFn
    if (household?.householdId) {
      setActiveHouseholdId(household.householdId);
    }

    if (!household?.hasHousehold || !household?.householdId) return;

    const householdId = household.householdId;

    (async () => {
      try {
        // Resolve current epoch and fetch the key at that epoch if we don't hold it.
        const state = await api<{ currentEpoch: number }>(`/api/households/${householdId}/key-state`);
        const epoch = state.currentEpoch;
        setActiveKeyEpoch(epoch);

        let hk = getCachedHouseholdKey(householdId, epoch);
        if (!hk) {
          hk = await loadHouseholdKeyFromStorage(householdId, epoch);
        }
        if (!hk) {
          await fetchAndCacheHouseholdKey(householdId);
        }
        // Legacy device fan-out removed — superseded by useKeyDistribution rewrite (Task 33).
      } catch {
        // Silent fail — key distribution is best-effort
      }
    })();
  }, [household?.hasHousehold, household?.householdId]);
}
