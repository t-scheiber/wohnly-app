import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { Platform } from "react-native";
import {
  getTauriSessionToken,
  COOKIE_STORAGE_KEY,
} from "./tauri";

const apiUrl = Constants.expoConfig?.extra?.apiUrl ?? "http://localhost:3001";

/**
 * Check isTauri at runtime (not module init) because __TAURI_INTERNALS__
 * may not be injected into the window yet when the module first loads.
 */
function isTauriRuntime(): boolean {
  return (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in window
  );
}

function safeJsonParse(
  str: string
): Record<string, { value: string; expires: string | null }> {
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}

/**
 * Custom Better Auth fetch plugin for Tauri desktop.
 *
 * The expo client plugin is inactive on web (Platform.OS === "web"),
 * so Tauri needs its own cookie management. This plugin:
 * - Checks isTauri() at request time (not module init)
 * - Injects the stored session cookie into every request
 * - Captures set-cookie headers from responses and stores them
 */
const tauriPlugin = {
  id: "tauri",
  fetchPlugins: [
    {
      id: "tauri-cookie",
      name: "Tauri Cookie",
      async init(url: string, options: RequestInit | undefined) {
        // Check at request time, not module init time
        if (!isTauriRuntime()) return { url, options };

        const sessionToken = getTauriSessionToken();
        options = options || {};
        options.credentials = "omit";
        options.headers = {
          ...options.headers,
          // Browser forbids setting Cookie header in fetch(),
          // so send via custom header that the API converts to Cookie
          ...(sessionToken ? { "x-session-token": sessionToken } : {}),
        };
        return { url, options };
      },
      hooks: {
        async onSuccess(context: {
          response: Response;
          data: unknown;
        }) {
          if (!isTauriRuntime()) return;

          const setCookie = context.response.headers.get("set-cookie");
          if (!setCookie) return;

          const existing = localStorage.getItem(COOKIE_STORAGE_KEY);
          const cookies: Record<
            string,
            { value: string; expires: string | null }
          > = existing ? safeJsonParse(existing) : {};

          for (const part of setCookie.split(/,\s*(?=[^\s;=]+=)/)) {
            const trimmed = part.trim();
            const eqIdx = trimmed.indexOf("=");
            if (eqIdx === -1) continue;
            const name = trimmed.substring(0, eqIdx).trim();
            if (
              !name ||
              name.toLowerCase() === "expires" ||
              name.toLowerCase() === "path" ||
              name.toLowerCase() === "domain"
            )
              continue;
            const rest = trimmed.substring(eqIdx + 1);
            const semiIdx = rest.indexOf(";");
            const value =
              semiIdx === -1
                ? rest.trim()
                : rest.substring(0, semiIdx).trim();

            let expires: string | null = null;
            const maxAgeMatch = rest.match(/max-age=(\d+)/i);
            if (maxAgeMatch) {
              const maxAge = parseInt(maxAgeMatch[1], 10);
              if (maxAge <= 0) {
                delete cookies[name];
                continue;
              }
              expires = new Date(
                Date.now() + maxAge * 1000
              ).toISOString();
            }
            cookies[name] = { value, expires };
          }

          localStorage.setItem(
            COOKIE_STORAGE_KEY,
            JSON.stringify(cookies)
          );
        },
      },
    },
  ],
};

export const authClient = createAuthClient({
  baseURL: apiUrl,
  plugins: [
    expoClient({
      scheme: "wohnly",
      storagePrefix: "wohnly",
      storage: SecureStore,
    }),
    tauriPlugin,
  ],
});

export const { useSession, signIn, signOut } = authClient;
