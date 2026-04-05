/**
 * Platform-aware sodium loader.
 * Uses react-native-libsodium on native (iOS/Android) and
 * libsodium-wrappers (JS/WASM) on web. Both expose the identical API.
 */
import { Platform } from "react-native";

let sodium: typeof import("libsodium-wrappers") | null = null;

export async function getSodium(): Promise<typeof import("libsodium-wrappers")> {
  if (sodium) return sodium;

  if (Platform.OS === "web") {
    const mod = await import("libsodium-wrappers");
    // Handle both ESM default export and CommonJS module
    const lib = (mod as any).default ?? mod;
    await lib.ready;
    sodium = lib;
  } else {
    // react-native-libsodium provides the same API as libsodium-wrappers
    const mod = await import("react-native-libsodium");
    await (mod as any).ready;
    sodium = mod as any;
  }

  return sodium!;
}
