/**
 * Auto-distributes household encryption keys to new member devices.
 * Runs in the background when the dashboard loads.
 *
 * Flow:
 * 1. Check if we have the household key cached
 * 2. Fetch all devices in the household
 * 3. Check which devices don't have an envelope yet
 * 4. Seal the key to those devices and upload
 */
import { useEffect } from "react";
import { Platform } from "react-native";
import { getCachedHouseholdKey } from "@/lib/crypto/household-key-cache";
import { getDeviceKeys } from "@/lib/crypto/device-storage";
import { distributeKeyToDevice, fetchAndCacheHouseholdKey } from "@/lib/crypto/e2ee-setup";
import { api } from "@/lib/api/client";
import { useHousehold } from "@/lib/hooks/useHousehold";

export function useKeyDistribution() {
  const { data: household } = useHousehold();

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!household?.hasHousehold || !household?.householdId) return;

    const householdId = household.householdId;

    (async () => {
      try {
        // First, ensure we have the household key
        let hk = getCachedHouseholdKey(householdId);
        if (!hk) {
          await fetchAndCacheHouseholdKey(householdId);
          hk = getCachedHouseholdKey(householdId);
        }
        if (!hk) return; // We don't have the key — nothing to distribute

        // Fetch all devices in the household that need keys
        const deviceKeys = await getDeviceKeys();
        if (!deviceKeys) return;

        // Get all members' devices
        const res = await api<{ devices: { id: string; publicKey: string; userId: string }[] }>(
          `/api/devices/list`
        );

        // For each device, check if it has an envelope
        for (const device of res.devices) {
          if (device.id === deviceKeys.deviceId) continue; // Skip our own device

          try {
            const envRes = await api<{ envelope: { sealedHK: string } | null }>(
              `/api/households/${householdId}/envelopes?deviceId=${device.id}`
            );
            if (!envRes.envelope) {
              // This device doesn't have the key yet — distribute
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
