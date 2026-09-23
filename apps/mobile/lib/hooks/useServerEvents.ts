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
import { AppState, Platform } from "react-native";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { isTauri } from "@/lib/auth/tauri";

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
    return subscribeServerEvents(qc);
  }, [enabled, qc]);
}

function subscribeServerEvents(qc: QueryClient): () => void {
    const Ctor = getEventSourceCtor();
    let dispose: () => void;
    if (!Ctor || isTauri() || Platform.OS !== "web") {
      const refresh = () => {
        if (AppState.currentState !== "active") return;
        for (const key of ["access-requests", "key-state", "household", "members", "devices"]) {
          void qc.invalidateQueries({ queryKey: [key] });
        }
      };
      const timer = setInterval(refresh, 30_000);
      const subscription = AppState.addEventListener("change", state => { if (state === "active") refresh(); });
      dispose = () => { clearInterval(timer); subscription.remove(); };
    } else {
    const es = new Ctor(`${API_BASE}/api/stream`, { withCredentials: true });

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
            qc.invalidateQueries({ queryKey: ["household"] });
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

    dispose = () => {
      for (const { type, listener } of handlers) {
        es.removeEventListener(type, listener as EventListener);
      }
      es.close();
    };
    }
    return () => dispose();
}
