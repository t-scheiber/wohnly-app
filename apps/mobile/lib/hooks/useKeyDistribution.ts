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
import { getDeviceKeys } from "@/lib/crypto/device-storage";
import { distributeKeyToDevice, fetchAndCacheHouseholdKey } from "@/lib/crypto/e2ee-setup";
import { setActiveHouseholdId } from "@/lib/crypto/active-household";
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
        // First, try in-memory cache, then persistent storage, then fetch from server
        let hk = getCachedHouseholdKey(householdId);
        if (!hk) {
          hk = await loadHouseholdKeyFromStorage(householdId);
        }
        if (!hk) {
          await fetchAndCacheHouseholdKey(householdId);
          hk = getCachedHouseholdKey(householdId);
        }
        if (!hk) {
          console.log("[useKeyDistribution] No household key available — waiting for key distribution");
          return;
        }

        const deviceKeys = await getDeviceKeys();
        if (!deviceKeys) return;

        // Get all approved devices in the household
        const res = await api<{ devices: { id: string; publicKey: string; userId: string }[] }>(
          `/api/devices/household`
        );

        // For each device, check if it has an envelope
        for (const device of res.devices) {
          if (device.id === deviceKeys.deviceId) continue; // Skip our own device

          try {
            const envRes = await api<{ envelope: { sealedHK: string } | null }>(
              `/api/households/${householdId}/envelopes?deviceId=${device.id}`
            );
            if (!envRes.envelope) {
              await distributeKeyToDevice(householdId, hk, device.publicKey, device.id);
            }
          } catch {
            // Skip failed devices
          }
        }
      } catch {
        // Silent fail — key distribution is best-effort
      }
    })();
  }, [household?.hasHousehold, household?.householdId]);
}
