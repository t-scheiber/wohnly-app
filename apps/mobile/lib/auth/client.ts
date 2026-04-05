import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import {
  isTauri,
  getTauriCookieHeader,
  COOKIE_STORAGE_KEY,
} from "./tauri";

const apiUrl = Constants.expoConfig?.extra?.apiUrl ?? "http://localhost:3001";

/**
 * Custom Better Auth fetch plugin for Tauri desktop.
 *
 * The expo client plugin is inactive on web (Platform.OS === "web"),
 * so Tauri needs its own cookie management. This plugin:
 * - Injects the stored session cookie into every request
 * - Captures set-cookie headers from responses and stores them
 * - Uses credentials: "omit" since we manage cookies manually
 */
const tauriPlugin = isTauri()
  ? {
      id: "tauri",
      fetchPlugins: [
        {
          id: "tauri-cookie",
          name: "Tauri Cookie",
          async init(url: string, options: RequestInit | undefined) {
            const cookie = getTauriCookieHeader();
            options = options || {};
            options.credentials = "omit";
            options.headers = {
              ...options.headers,
              ...(cookie ? { cookie } : {}),
            };
            return { url, options };
          },
          hooks: {
            async onSuccess(context: {
              response: Response;
              data: unknown;
            }) {
              const setCookie = context.response.headers.get("set-cookie");
              if (!setCookie) return;

              // Parse and store new cookies (same logic as expo client)
              const existing = localStorage.getItem(COOKIE_STORAGE_KEY);
              const cookies: Record<
                string,
                { value: string; expires: string | null }
              > = existing ? safeJsonParse(existing) : {};

              // Simple set-cookie parsing for session updates
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
    }
  : null;

function safeJsonParse(
  str: string
): Record<string, { value: string; expires: string | null }> {
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}

export const authClient = createAuthClient({
  baseURL: apiUrl,
  plugins: [
    expoClient({
      scheme: "wohnly",
      storagePrefix: "wohnly",
      storage: SecureStore,
    }),
    ...(tauriPlugin ? [tauriPlugin] : []),
  ],
});

export const { useSession, signIn, signOut } = authClient;
