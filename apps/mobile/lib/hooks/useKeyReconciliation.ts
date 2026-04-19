import { useEffect } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Periodic + on-foreground reconciliation for the access/key caches.
 *
 * SSE drives near-instant updates, but on mobile a backgrounded app may miss
 * a stream window (OS socket teardown, battery-saver). On app-foreground and
 * every 30 minutes, re-query /key-state and /access/requests so the UI can
 * catch up independent of the stream.
 */
export function useKeyReconciliation(householdId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!householdId) return;
    const invalidate = () => {
      qc.invalidateQueries({ queryKey: ["key-state", householdId] });
      qc.invalidateQueries({ queryKey: ["access-requests"] });
    };
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") invalidate();
    });
    const interval = setInterval(invalidate, 30 * 60 * 1000);
    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [householdId, qc]);
}
