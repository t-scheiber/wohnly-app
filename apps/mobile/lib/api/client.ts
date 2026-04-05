import Constants from "expo-constants";
import { authClient } from "../auth/client";
import { isTauri, getTauriSessionToken } from "../auth/tauri";

const API_BASE = Constants.expoConfig?.extra?.apiUrl ?? "http://localhost:3001";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Authenticated API client for all Wohnly API calls.
 * On native: sends cookies from Better Auth's expo client plugin.
 * On Tauri: sends session token via x-session-token header
 *           (browser forbids setting Cookie header in fetch).
 */
export async function api<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const cookies = authClient.getCookie();
  const tauriToken = isTauri() ? getTauriSessionToken() : "";

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
      ...(tauriToken
        ? { "x-session-token": tauriToken }
        : cookies
          ? { Cookie: cookies }
          : {}),
    },
    credentials: "omit", // We send cookies manually
  });

  if (res.status === 401) {
    throw new ApiError(401, "Session expired");
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new ApiError(res.status, error.error || "Request failed", error.code);
  }

  return res.json();
}

/**
 * Shorthand for POST requests with JSON body
 */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return api<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Shorthand for PATCH requests with JSON body
 */
export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return api<T>(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/**
 * Shorthand for DELETE requests
 */
export async function apiDelete<T>(path: string): Promise<T> {
  return api<T>(path, { method: "DELETE" });
}
