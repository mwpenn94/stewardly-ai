/**
 * Session Token Manager
 *
 * Stores the session JWT in localStorage and provides it for Authorization headers.
 * This bypasses the reverse proxy's Set-Cookie stripping by sending the token
 * as a Bearer token in the Authorization header instead of relying on cookies.
 *
 * Safari / Mobile hardening:
 *   - Falls back to sessionStorage if localStorage is unavailable (Safari Private Browsing)
 *   - Checks token expiry before returning (avoids sending expired tokens)
 *   - Listens for cross-tab storage events to sync token changes
 */

const SESSION_TOKEN_KEY = "stewardly_session_token";

/** Detect whether localStorage is available (Safari Private Browsing blocks it) */
let _storageAvailable: "local" | "session" | "none" | null = null;
function getStorage(): Storage | null {
  if (_storageAvailable === "local") return localStorage;
  if (_storageAvailable === "session") return sessionStorage;
  if (_storageAvailable === "none") return null;

  // First call — probe
  try {
    const test = "__storage_test__";
    localStorage.setItem(test, "1");
    localStorage.removeItem(test);
    _storageAvailable = "local";
    return localStorage;
  } catch {
    try {
      const test = "__storage_test__";
      sessionStorage.setItem(test, "1");
      sessionStorage.removeItem(test);
      _storageAvailable = "session";
      return sessionStorage;
    } catch {
      _storageAvailable = "none";
      return null;
    }
  }
}

/** In-memory fallback when no storage is available */
let _memoryToken: string | null = null;

/**
 * Decode a JWT payload without verifying the signature.
 * Returns null if the token is malformed.
 */
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

/**
 * Check if a JWT token is expired (with 60s buffer for clock skew).
 */
function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return false; // no exp = never expires
  const nowSec = Math.floor(Date.now() / 1000);
  return payload.exp - 60 < nowSec; // 60s buffer
}

export function getSessionToken(): string | null {
  const storage = getStorage();
  const token = storage?.getItem(SESSION_TOKEN_KEY) ?? _memoryToken;
  if (!token) return null;
  // Don't return expired tokens
  if (isTokenExpired(token)) {
    clearSessionToken();
    return null;
  }
  return token;
}

/**
 * Get the token's expiry time in milliseconds since epoch.
 * Returns null if no token or no exp claim.
 */
export function getTokenExpiry(): number | null {
  const storage = getStorage();
  const token = storage?.getItem(SESSION_TOKEN_KEY) ?? _memoryToken;
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return null;
  return payload.exp * 1000;
}

export function setSessionToken(token: string): void {
  _memoryToken = token;
  const storage = getStorage();
  try {
    storage?.setItem(SESSION_TOKEN_KEY, token);
  } catch {
    console.warn("[SessionToken] Failed to save token to storage");
  }
}

export function clearSessionToken(): void {
  _memoryToken = null;
  const storage = getStorage();
  try {
    storage?.removeItem(SESSION_TOKEN_KEY);
  } catch {
    // ignore
  }
}

/**
 * Wrapper around fetch() that automatically adds the Authorization header.
 * Use this for all non-tRPC API calls (e.g., /api/chat/stream, /api/tts).
 * The tRPC client already adds the header via main.tsx's httpBatchLink config.
 */
export function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const token = getSessionToken();
  const headers = new Headers(init?.headers);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, {
    ...init,
    headers,
    credentials: "include", // still send cookies as fallback
  });
}

/**
 * Listen for cross-tab storage changes.
 * When another tab logs in or out, this tab's auth state should update.
 */
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === SESSION_TOKEN_KEY) {
      // Token changed in another tab — update memory cache
      _memoryToken = event.newValue;
    }
  });
}
