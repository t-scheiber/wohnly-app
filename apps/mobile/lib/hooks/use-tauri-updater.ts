import { useEffect, useRef } from "react";
import { Platform } from "react-native";

/**
 * Hook that checks for app updates on Tauri desktop.
 * Shows a native confirm dialog when a new version is available.
 * Does nothing on non-Tauri platforms.
 */
export function useTauriUpdater() {
  const checked = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    if (!("__TAURI_INTERNALS__" in window)) return;
    if (checked.current) return;
    checked.current = true;

    // Delay the check so the app finishes loading first
    const timer = setTimeout(() => checkForUpdate(), 3000);
    return () => clearTimeout(timer);
  }, []);
}

async function checkForUpdate() {
  try {
    const { check } = await (Function(
      'return import("@tauri-apps/plugin-updater")'
    )() as Promise<typeof import("@tauri-apps/plugin-updater")>);

    const update = await check();
    if (!update) return;

    const yes = window.confirm(
      `A new version (v${update.version}) of Wohnly is available.\n\nUpdate now? The app will restart.`
    );
    if (!yes) return;

    await update.downloadAndInstall();

    const { relaunch } = await (Function(
      'return import("@tauri-apps/plugin-process")'
    )() as Promise<typeof import("@tauri-apps/plugin-process")>);
    await relaunch();
  } catch (err) {
    console.error("[updater] check failed:", err);
  }
}
