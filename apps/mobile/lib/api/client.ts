import Constants from "expo-constants";
import { Platform } from "react-native";
import { authClient } from "../auth/client";
import { isTauri, getTauriSessionToken } from "../auth/tauri";

const API_BASE = Constants.expoConfig?.extra?.apiUrl ?? "https://api.wohnly.app";

/** Regular web (not Tauri, not native) uses browser cookies */
const isRegularWeb = Platform.OS === "web" && !isTauri();

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
 * - Regular web: uses browser cookies via credentials: "include"
 * - Tauri desktop: sends the session token through Better Auth's bearer bridge
 * - Native (iOS/Android): sends cookies from expo client plugin
 */
export async function api<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  let headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options?.headers as Record<string, string>,
  };
  let credentials: RequestCredentials;

  if (isRegularWeb) {
    // Regular web: let the browser handle cookies natively
    credentials = "include";
  } else if (isTauri()) {
    // Tauri: browser forbids Cookie, so use Better Auth's bearer plugin.
    const token = getTauriSessionToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    credentials = "omit";
  } else {
    // Native: expo client plugin manages cookies manually
    const cookies = authClient.getCookie();
    if (cookies) headers["Cookie"] = cookies;
    credentials = "omit";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials,
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
