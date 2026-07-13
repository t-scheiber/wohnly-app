import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth/client";
import { apiPost } from "@/lib/api/client";
import {
  getPersonalKeyState,
  resolvePersonalEncryptionKey,
} from "@/lib/crypto/personal-key";
import { sealedToBase64, sealToDevice } from "@/lib/crypto/seal";

/**
 * Hydrate the current user's personal key and seal it to any newly approved
 * devices belonging to that same user. Household members never receive it.
 */
export function usePersonalKeyDistribution(): void {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const completedSignature = useRef("");
  const stateQuery = useQuery({
    queryKey: ["personal-key-state", userId],
    enabled: !!userId,
    queryFn: getPersonalKeyState,
    refetchOnReconnect: true,
    refetchInterval: 60_000,
  });

  const state = stateQuery.data;
  const deviceSignature = state?.devices
    .map((device) => `${device.id}:${device.hasEnvelope ? 1 : 0}`)
    .sort()
    .join(",");

  useEffect(() => {
    if (!state || state.devices.length === 0) return;
    const signature = `${state.userId}:${state.currentEpoch}:${state.initialized}:${deviceSignature}`;
    if (signature === completedSignature.current) return;
    completedSignature.current = signature;

    let cancelled = false;
    const distribute = async () => {
      const { key, epoch } = await resolvePersonalEncryptionKey();
      const missing = state.devices.filter((device) => !device.hasEnvelope);
      for (const device of missing) {
        if (cancelled) return;
        const sealedKey = await sealedToBase64(
          await sealToDevice(key, device.publicKey),
        );
        await apiPost("/api/personal-keys/envelopes", {
          deviceId: device.id,
          sealedKey,
          keyEpoch: epoch,
        });
      }
      if (!cancelled) {
        await queryClient.invalidateQueries({
          queryKey: ["personal-key-state"],
        });
        await queryClient.invalidateQueries({
          queryKey: ["personal-shopping"],
        });
        await queryClient.invalidateQueries({
          queryKey: ["personal-todos"],
        });
        await queryClient.invalidateQueries({ queryKey: ["events"] });
      }
    };

    distribute().catch((error) => {
      completedSignature.current = "";
      console.warn("[usePersonalKeyDistribution]", error);
    });
    return () => {
      cancelled = true;
    };
  }, [deviceSignature, queryClient, state]);
}
