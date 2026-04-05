import { Platform } from "react-native";
import Constants from "expo-constants";

const COOKIE_STORAGE_KEY = "wohnly_cookie";

/** Check if running inside a Tauri desktop webview */
export function isTauri(): boolean {
  return (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in window
  );
}

/** Open a URL in the system browser via Tauri shell plugin */
export async function openInBrowser(url: string): Promise<void> {
  if (!isTauri()) return;
  const { open } = await import("@tauri-apps/plugin-shell");
  await open(url);
}

/** Listen for deep link events from Tauri */
export function onDeepLink(
  callback: (url: string) => void
): (() => void) | undefined {
  if (!isTauri()) return undefined;

  let unlisten: (() => void) | undefined;

  (async () => {
    const { listen } = await import("@tauri-apps/api/event");
    unlisten = await listen<string>("deep-link", (event) => {
      callback(event.payload);
    });
  })();

  return () => {
    unlisten?.();
  };
}

/**
 * Start the OAuth flow for Tauri by opening the system browser.
 *
 * Flow:
 * 1. POST to the API to get the OAuth authorization URL
 * 2. Open the expo-authorization-proxy in the system browser
 *    (this sets the state cookie in the browser context)
 * 3. User authenticates with the provider
 * 4. API callback redirects to wohnly://auth/callback?cookie=...
 *    (the expo server plugin appends the session cookie)
 * 5. Tauri deep-link plugin captures the URL
 * 6. handleTauriDeepLink() stores the cookie
 */
export async function tauriSignIn(provider: "google" | "apple"): Promise<void> {
  const apiUrl =
    Constants.expoConfig?.extra?.apiUrl ?? "http://localhost:3001";
  const callbackURL = "wohnly://auth/callback";

  // Step 1: Get the OAuth authorization URL from the API
  const res = await fetch(`${apiUrl}/api/auth/sign-in/social`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, callbackURL }),
  });

  const data = await res.json();
  if (!data.url) {
    throw new Error(data.error || "Failed to get authorization URL");
  }

  // Step 2: Open the expo-authorization-proxy in the system browser.
  // This endpoint sets the state cookie properly in the browser context,
  // then redirects to the OAuth provider.
  const proxyUrl = `${apiUrl}/api/auth/expo-authorization-proxy?authorizationURL=${encodeURIComponent(data.url)}`;
  await openInBrowser(proxyUrl);
}

/**
 * Handle a deep link callback from the OAuth flow.
 * Extracts the session cookie from the URL and stores it
 * in localStorage where the expo client plugin can read it.
 *
 * Returns true if a session cookie was found and stored.
 */
export function handleTauriDeepLink(url: string): boolean {
  try {
    // The URL might have brackets or extra chars from Tauri's event payload
    const cleanUrl = url.replace(/^\["|"\]$/g, "").replace(/^"|"$/g, "");
    const parsed = new URL(cleanUrl);
    const cookieHeader = parsed.searchParams.get("cookie");

    if (!cookieHeader) return false;

    // Parse the Set-Cookie header and store in the same format
    // the expo client plugin uses: { "name": { "value": "...", "expires": "..." } }
    const stored = parseAndStoreCookie(cookieHeader);
    return stored;
  } catch {
    return false;
  }
}

/**
 * Parse a Set-Cookie header string and store it in localStorage
 * in the format expected by Better Auth's expo client plugin.
 */
function parseAndStoreCookie(setCookieHeader: string): boolean {
  const existing = localStorage.getItem(COOKIE_STORAGE_KEY);
  const cookies: Record<string, { value: string; expires: string | null }> =
    existing ? safeJsonParse(existing) : {};

  // Split multiple Set-Cookie values (separated by ", " with a cookie name following)
  // but be careful: expires values also contain commas. Split on the pattern of
  // ", <name>=" where <name> doesn't start with common attribute names.
  const parts = setCookieHeader.split(/,\s*(?=[^\s;=]+=)/);

  for (const part of parts) {
    const trimmed = part.trim();
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;

    const name = trimmed.substring(0, eqIdx).trim();
    // Skip attribute-only fragments
    if (!name || name.toLowerCase() === "expires" || name.toLowerCase() === "path" || name.toLowerCase() === "domain") continue;

    const rest = trimmed.substring(eqIdx + 1);
    // Value is everything up to the first ";"
    const semiIdx = rest.indexOf(";");
    const value = semiIdx === -1 ? rest.trim() : rest.substring(0, semiIdx).trim();

    // Extract max-age or expires for expiry
    let expires: string | null = null;
    const maxAgeMatch = rest.match(/max-age=(\d+)/i);
    const expiresMatch = rest.match(/expires=([^;]+)/i);

    if (maxAgeMatch) {
      const maxAge = parseInt(maxAgeMatch[1], 10);
      if (maxAge <= 0) {
        delete cookies[name];
        continue;
      }
      expires = new Date(Date.now() + maxAge * 1000).toISOString();
    } else if (expiresMatch) {
      const d = new Date(expiresMatch[1].trim());
      if (!isNaN(d.getTime())) {
        if (d.getTime() <= Date.now()) {
          delete cookies[name];
          continue;
        }
        expires = d.toISOString();
      }
    }

    cookies[name] = { value, expires };
  }

  localStorage.setItem(COOKIE_STORAGE_KEY, JSON.stringify(cookies));
  return Object.keys(cookies).length > 0;
}

function safeJsonParse(str: string): Record<string, { value: string; expires: string | null }> {
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}
