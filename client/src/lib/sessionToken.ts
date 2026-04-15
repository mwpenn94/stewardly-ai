/**
 * Session Token Manager
 * 
 * Stores the session JWT in localStorage and provides it for Authorization headers.
 * This bypasses the reverse proxy's Set-Cookie stripping by sending the token
 * as a Bearer token in the Authorization header instead of relying on cookies.
 */

const SESSION_TOKEN_KEY = 'stewardly_session_token';

export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSessionToken(token: string): void {
  try {
    localStorage.setItem(SESSION_TOKEN_KEY, token);
  } catch {
    console.warn('[SessionToken] Failed to save token to localStorage');
  }
}

export function clearSessionToken(): void {
  try {
    localStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    // ignore
  }
}

/**
 * Wrapper around fetch() that automatically adds the Authorization header.
 * Use this for all non-tRPC API calls (e.g., /api/chat/stream, /api/tts).
 * The tRPC client already adds the header via main.tsx's httpBatchLink config.
 */
export function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = getSessionToken();
  const headers = new Headers(init?.headers);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(input, {
    ...init,
    headers,
    credentials: 'include', // still send cookies as fallback
  });
}
