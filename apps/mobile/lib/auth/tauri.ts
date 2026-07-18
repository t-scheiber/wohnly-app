import { Platform } from "react-native";
import Constants from "expo-constants";

export const COOKIE_STORAGE_KEY = "wohnly_cookie";

/** Check if running inside a Tauri desktop webview */
export function isTauri(): boolean {
  return (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in window
  );
}

// Use Tauri's IPC directly via the global __TAURI_INTERNALS__ object.
// The dynamic-import-via-Function() trick doesn't work because Metro
// can't bundle the plugin, so the runtime import() fails silently.
// The IPC invoke is always available and works on both macOS and Windows.

export function tauriInvoke<T = unknown>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return (window as any).__TAURI_INTERNALS__.invoke(cmd, args);
}

/** True when the Tauri webview is running on macOS. */
export function isMacTauri(): boolean {
  return (
    isTauri() &&
    typeof navigator !== "undefined" &&
    /Macintosh|Mac OS X/i.test(navigator.userAgent)
  );
}

interface AppleIDAuthorizationResponse {
  userIdentifier: string | null;
  givenName: string | null;
  familyName: string | null;
  email: string | null;
  authorizationCode: string;
  identityToken: string | null;
  state: string | null;
}

/** Open a URL in the system browser via Tauri shell plugin */
export async function openInBrowser(url: string): Promise<void> {
  if (!isTauri()) return;
  await tauriInvoke("plugin:shell|open", { path: url });
}

/** Listen for deep link events from Tauri */
export function onDeepLink(
  callback: (url: string) => void
): (() => void) | undefined {
  if (!isTauri()) return undefined;

  let unlisten: (() => void) | undefined;

  (async () => {
    const internals = (window as any).__TAURI_INTERNALS__;

    // Register a JS callback via Tauri's transformCallback (returns a numeric ID).
    // Then subscribe to the Rust-side event through the event plugin.
    const handlerId = internals.transformCallback((event: any) => {
      console.log("[onDeepLink] event received:", JSON.stringify(event));
      const urls: string[] = event?.payload?.urls ?? event?.payload ?? [];
      if (urls.length > 0) callback(urls[0]);
    });

    await internals.invoke("plugin:event|listen", {
      event: "deep-link://new-url",
      target: { kind: "Any" },
      handler: handlerId,
    });

    unlisten = () => {
      internals.invoke("plugin:event|unlisten", handlerId).catch(() => {});
    };
  })();

  return () => {
    unlisten?.();
  };
}

/**
 * Start the OAuth flow for Tauri.
 *
 * Apple on macOS uses the native AuthenticationServices sheet and exchanges
 * its identity token directly for a Better Auth session. Other flows request
 * an OAuth URL from the API, then open it in ASWebAuthenticationSession on
 * macOS or the system browser on Windows. Those web flows return through the
 * wohnly:// deep link and store the session cookie locally.
 */
export async function tauriSignIn(provider: "google" | "apple"): Promise<void> {
  const apiUrl =
    Constants.expoConfig?.extra?.apiUrl ?? "https://api.wohnly.app";

  if (provider === "apple" && isMacTauri()) {
    await tauriSignInWithApple(apiUrl);
    return;
  }

  const callbackURL = "wohnly://auth/callback";
  const url = `${apiUrl}/api/auth/sign-in/social`;

  let res!: Response;
  const body = JSON.stringify({ provider, callbackURL });
  const opts: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  };

  // Retry up to 2 times — WebView2 sometimes fails the first request
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      res = await fetch(url, opts);
      break;
    } catch (err) {
      console.error(`[tauriSignIn] attempt ${attempt + 1} failed:`, err);
      if (attempt === 2) {
        throw new Error(
          `Could not reach the server (${apiUrl}). Check your internet connection and try again.`
        );
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[tauriSignIn] server error:", { status: res.status, body });
    throw new Error(`Sign-in failed (${res.status}). Please try again.`);
  }

  const data = await res.json().catch(() => null);
  if (!data?.url) {
    throw new Error(data?.error || "Failed to get authorization URL");
  }

  const proxyUrl = `${apiUrl}/api/auth/expo-authorization-proxy?authorizationURL=${encodeURIComponent(data.url)}`;

  if (isMacTauri()) {
    const callbackUrl = await tauriInvoke<string>("plugin:auth-session|start", {
      authUrl: proxyUrl,
      callbackUrlScheme: "wohnly",
      ephemeral: false,
    });
    if (!handleTauriDeepLink(callbackUrl)) {
      throw new Error("Sign-in completed without a valid session. Please try again.");
    }
    window.location.reload();
    return;
  }

  await openInBrowser(proxyUrl);
}

async function tauriSignInWithApple(apiUrl: string): Promise<void> {
  const rawNonce = createNonce();
  const hashedNonce = await sha256Hex(rawNonce);
  const credential = await tauriInvoke<AppleIDAuthorizationResponse>(
    "plugin:siwa|get_apple_id_credential",
    {
      payload: {
        scope: ["fullName", "email"],
        nonce: hashedNonce,
      },
    },
  );

  if (!credential.identityToken) {
    throw new Error("Apple did not return an identity token. Please try again.");
  }

  const response = await fetch(`${apiUrl}/api/auth/sign-in/social`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "apple",
      idToken: {
        token: credential.identityToken,
        nonce: rawNonce,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Sign in with Apple failed (${response.status}). Please try again.`);
  }

  const result: unknown = await response.json().catch(() => null);
  const sessionToken =
    result &&
    typeof result === "object" &&
    "token" in result &&
    typeof result.token === "string"
      ? result.token
      : null;

  if (!sessionToken) {
    throw new Error("Sign in with Apple completed without a valid session.");
  }

  storeTauriSessionToken(sessionToken);
  window.location.reload();
}

function createNonce(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function storeTauriSessionToken(sessionToken: string): void {
  const existing = localStorage.getItem(COOKIE_STORAGE_KEY);
  const cookies: Record<string, { value: string; expires: string | null }> =
    existing ? safeJsonParse(existing) : {};

  cookies["__Secure-better-auth.session_token"] = {
    value: sessionToken,
    expires: null,
  };
  localStorage.setItem(COOKIE_STORAGE_KEY, JSON.stringify(cookies));
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

/**
 * Get the stored session cookie as a Cookie header string.
 * Returns empty string if no cookie is stored or all are expired.
 */
export function getTauriCookieHeader(): string {
  if (!isTauri()) return "";
  const raw = localStorage.getItem(COOKIE_STORAGE_KEY);
  if (!raw) return "";
  const cookies = safeJsonParse(raw);
  return Object.entries(cookies)
    .filter(([, { expires }]) => !expires || new Date(expires) > new Date())
    .map(([name, { value }]) => `${name}=${value}`)
    .join("; ");
}

/**
 * Get just the session token value (without cookie name).
 * Used for the x-session-token header since browsers forbid
 * setting the Cookie header in fetch().
 */
export function getTauriSessionToken(): string {
  if (!isTauri()) return "";
  const raw = localStorage.getItem(COOKIE_STORAGE_KEY);
  if (!raw) return "";
  const cookies = safeJsonParse(raw);
  // Look for the session token cookie by common Better Auth names
  for (const [name, { value, expires }] of Object.entries(cookies)) {
    if (expires && new Date(expires) < new Date()) continue;
    if (name.includes("session_token")) return value;
  }
  return "";
}

/**
 * Clear the stored Tauri session cookie (for sign-out).
 */
export function clearTauriCookie(): void {
  localStorage.removeItem(COOKIE_STORAGE_KEY);
}
