import { useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { api } from "../api/client";
import { isTauri } from "../auth/tauri";

function cmp(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x - y;
  }
  return 0;
}

export function useMinVersion() {
  const q = useQuery({
    queryKey: ["min-version"],
    queryFn: () =>
      api<{ minVersion: string; currentVersion: string }>("/api/app/min-version"),
    refetchInterval: 30 * 60 * 1000,
    refetchOnReconnect: true,
    staleTime: 10 * 60 * 1000,
    // Don't block UI on first load — render children until the server answers.
    retry: 1,
  });
  const currentAppVersion = Constants.expoConfig?.version ?? "0.0.0";
  // Desktop updates are delivered by the Mac App Store/direct updater. The
  // Expo version embedded in the shared web bundle is not the desktop bundle
  // version and must never force a Store build to an external web URL.
  const blocked =
    !isTauri() && !!q.data && cmp(currentAppVersion, q.data.minVersion) < 0;
  return {
    blocked,
    currentAppVersion,
    minVersion: q.data?.minVersion,
    serverLatest: q.data?.currentVersion,
  };
}
