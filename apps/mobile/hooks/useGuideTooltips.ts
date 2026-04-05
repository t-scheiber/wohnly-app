import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "wohnly_guide_dismissed";

export type TooltipKey =
  | "swipe_delete"
  | "tap_edit"
  | "clear_completed"
  | "select_mode"
  | "invite_share"
  | "finances_balance";

export function useGuideTooltips() {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value) {
          setDismissed(new Set(JSON.parse(value)));
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const shouldShow = useCallback(
    (key: TooltipKey): boolean => {
      if (!loaded) return false;
      return !dismissed.has(key);
    },
    [dismissed, loaded],
  );

  const dismiss = useCallback(
    (key: TooltipKey) => {
      setDismissed((prev) => {
        const next = new Set(prev);
        next.add(key);
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...next])).catch(() => {});
        return next;
      });
    },
    [],
  );

  return { shouldShow, dismiss, loaded };
}
