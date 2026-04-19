/**
 * SSE client hook. Opens an EventSource to /api/stream (authenticated) and
 * fans out access/key events into React Query cache invalidations.
 *
 * Web + Tauri have a native EventSource. React Native does not — if no global
 * is available we fall back silently and rely on the short refetchInterval on
 * the relevant queries. Adding react-native-sse is left as a follow-up.
 */
import { useEffect } from "react";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { isTauri, getTauriSessionToken } from "@/lib/auth/tauri";

const API_BASE = Constants.expoConfig?.extra?.apiUrl ?? "https://api.wohnly.app";

type EventSourceCtor = new (url: string, init?: { withCredentials?: boolean }) => EventSource;

function getEventSourceCtor(): EventSourceCtor | null {
  if (typeof EventSource !== "undefined") return EventSource as unknown as EventSourceCtor;
  return null;
}

const EVENT_TYPES = [
  "access.request.created",
  "access.request.approved",
  "access.request.rejected",
  "access.request.expired",
  "access.request.envelope_delivered",
  "household.key.rotation.requested",
  "household.key.rotated",
  "household.member.removed",
  "household.device.removed",
] as const;

export function useServerEvents(enabled: boolean): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const Ctor = getEventSourceCtor();
    if (!Ctor) {
      // React Native native path — polling fallback is handled by query refetchInterval.
      return;
    }

    // Regular web uses cookie-auth; Tauri appends the session token as a query param
    // because browsers forbid Cookie/x-session-token on EventSource.
    let url = `${API_BASE}/api/stream`;
    const withCreds = Platform.OS === "web" && !isTauri();
    if (isTauri()) {
      const token = getTauriSessionToken();
      if (token) url += `?token=${encodeURIComponent(token)}`;
    }

    const es = new Ctor(url, withCreds ? { withCredentials: true } : undefined);

    const handlers: { type: string; listener: (e: MessageEvent) => void }[] = [];
    for (const type of EVENT_TYPES) {
      const listener = () => {
        switch (type) {
          case "access.request.created":
          case "access.request.approved":
          case "access.request.rejected":
          case "access.request.expired":
            qc.invalidateQueries({ queryKey: ["access-requests"] });
            break;
          case "access.request.envelope_delivered":
          case "household.key.rotation.requested":
          case "household.key.rotated":
            qc.invalidateQueries({ queryKey: ["key-state"] });
            qc.invalidateQueries({ queryKey: ["access-requests"] });
            break;
          case "household.member.removed":
          case "household.device.removed":
            qc.invalidateQueries({ queryKey: ["members"] });
            qc.invalidateQueries({ queryKey: ["devices"] });
            qc.invalidateQueries({ queryKey: ["key-state"] });
            break;
        }
      };
      es.addEventListener(type, listener as EventListener);
      handlers.push({ type, listener });
    }

    es.onerror = () => {
      // Browser auto-reconnects; log at debug level only.
    };

    return () => {
      for (const { type, listener } of handlers) {
        es.removeEventListener(type, listener as EventListener);
      }
      es.close();
    };
  }, [enabled, qc]);
}
