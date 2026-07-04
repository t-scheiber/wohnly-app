/**
 * System accessibility preference hooks.
 *
 * - useReducedMotion(): true when the user asked the OS to minimize
 *   animations (prefers-reduced-motion on web/desktop, "Reduce Motion"
 *   on iOS, "Remove animations" on Android).
 * - useHighContrast(): true when the user asked for increased contrast
 *   (prefers-contrast / forced-colors on web and Windows desktop,
 *   "Increase Contrast" on iOS, high-text-contrast on Android).
 */
import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (
      Platform.OS !== "web" ||
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (
      Platform.OS !== "web" ||
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }
    const mql = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

function useNativeA11ySetting(
  query: () => Promise<boolean> | undefined,
  changeEvent: "reduceMotionChanged" | "highTextContrastChanged" | "darkerSystemColorsChanged"
): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") return;
    let mounted = true;

    Promise.resolve(query())
      .then((value) => {
        if (mounted && typeof value === "boolean") setEnabled(value);
      })
      .catch(() => {});

    let subscription: { remove: () => void } | undefined;
    try {
      subscription = AccessibilityInfo.addEventListener(
        changeEvent as Parameters<typeof AccessibilityInfo.addEventListener>[0],
        (value: unknown) => {
          if (typeof value === "boolean") setEnabled(value);
        }
      );
    } catch {
      // Event not supported on this platform/version
    }

    return () => {
      mounted = false;
      subscription?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changeEvent]);

  return enabled;
}

/** True when the user prefers reduced motion. */
export function useReducedMotion(): boolean {
  const webReduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const nativeReduced = useNativeA11ySetting(
    () => AccessibilityInfo.isReduceMotionEnabled?.(),
    "reduceMotionChanged"
  );
  return Platform.OS === "web" ? webReduced : nativeReduced;
}

/** True when the user prefers increased contrast. */
export function useHighContrast(): boolean {
  const webMore = useMediaQuery("(prefers-contrast: more)");
  const webForced = useMediaQuery("(forced-colors: active)");
  const androidHigh = useNativeA11ySetting(
    () =>
      Platform.OS === "android"
        ? AccessibilityInfo.isHighTextContrastEnabled?.()
        : undefined,
    "highTextContrastChanged"
  );
  const iosDarker = useNativeA11ySetting(
    () =>
      Platform.OS === "ios"
        ? AccessibilityInfo.isDarkerSystemColorsEnabled?.()
        : undefined,
    "darkerSystemColorsChanged"
  );
  if (Platform.OS === "web") return webMore || webForced;
  return androidHigh || iosDarker;
}
