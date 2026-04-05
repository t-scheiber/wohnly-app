import { useState, useEffect } from "react";
import { getDeviceKeys } from "@/lib/crypto/device-storage";
import { useMyDevices } from "@/lib/api/queries";
import type { Device } from "@wohnly/shared";

export function useCurrentDevice() {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const { data, refetch, isLoading } = useMyDevices();

  useEffect(() => {
    getDeviceKeys().then((keys) => {
      if (keys) setDeviceId(keys.deviceId);
    });
  }, []);

  const currentDevice = data?.devices?.find((d) => d.id === deviceId) ?? null;

  return {
    device: currentDevice,
    refetch,
    isLoading: isLoading || (deviceId === null && data === undefined),
  };
}
