import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { getLoginUrl } from "@/const";
import { setSessionToken, clearSessionToken } from "@/lib/sessionToken";
import { useTokenRefresh } from "@/hooks/useTokenRefresh";
import { toast } from "sonner";

/**
 * AuthContext — single source of truth for authentication state.
 *
 * Manages the full lifecycle:
 *   1. Initial auth.me query (uses Authorization header from localStorage)
 *   2. Guest session auto-provisioning (if no user)
 *   3. Silent token refresh before expiry (user-togglable, enabled by default)
 *   4. Exposes stable `loading` / `user` / `isAuthenticated` that accounts
 *      for the guest provisioning window so pages never flash "Please sign in"
 *      while a guest session is being created.
 *
 * Token handling:
 *   The Manus reverse proxy strips Set-Cookie headers from ALL server responses.
 *   To work around this, session tokens are stored in localStorage and sent
 *   via the Authorization: Bearer header on every tRPC request. The server
 *   accepts both cookies and Authorization headers.
 */

const AUTO_REFRESH_KEY = "stewardly_auto_refresh_enabled";

interface AuthState {
  user: any | null;
  loading: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
  error: any | null;
  logout: () => Promise<void>;
  refresh: () => void;
  /** Whether silent token refresh is enabled (user-togglable) */
  autoRefreshEnabled: boolean;
  /** Toggle silent token refresh on/off */
  setAutoRefreshEnabled: (enabled: boolean) => void;
}

const AuthContext = createContext<AuthState | null>(null);


export function AuthProvider({ children }: { children: ReactNode }) {
  const utils = trpc.useUtils();

  // Auto-refresh preference (persisted in localStorage, enabled by default)
  const [autoRefreshEnabled, setAutoRefreshEnabledState] = useState(() => {
    try {
      const stored = localStorage.getItem(AUTO_REFRESH_KEY);
      return stored !== "false"; // default to true
    } catch {
      return true;
    }
  });

  const setAutoRefreshEnabled = useCallback((enabled: boolean) => {
    setAutoRefreshEnabledState(enabled);
    try {
      localStorage.setItem(AUTO_REFRESH_KEY, String(enabled));
    } catch {
      // ignore
    }
  }, []);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: 2,
    retryDelay: 300,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      clearSessionToken();
      utils.auth.me.setData(undefined, null);
    },
  });

  // Guest provisioning state
  const isProvisioning = useRef(false);
  const hasAttempted = useRef(false);
  const [guestProvisioningDone, setGuestProvisioningDone] = useState(false);

  // Safety timeout: if guest provisioning takes too long, mark it as done
  // so the app renders in degraded anonymous mode instead of infinite spinner
  const GUEST_PROVISION_TIMEOUT_MS = 8_000;

  const provisionGuest = useCallback(async () => {
    if (isProvisioning.current || hasAttempted.current) return;
    isProvisioning.current = true;
    hasAttempted.current = true;

    // Set up a safety timeout — if provisioning hangs, unblock the UI
    const timeoutId = setTimeout(() => {
      if (!guestProvisioningDone) {
        console.warn("[AuthProvider] Guest provisioning timed out — entering anonymous mode");
        isProvisioning.current = false;
        setGuestProvisioningDone(true);
        // Set anonymous mode so Chat renders without auth
        try { localStorage.setItem("anonymousMode", "true"); } catch {}
      }
    }, GUEST_PROVISION_TIMEOUT_MS);

    try {
      // Create the guest session (server creates user + returns token)
      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => controller.abort(), GUEST_PROVISION_TIMEOUT_MS - 1000);

      const res = await fetch("/api/auth/guest-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: controller.signal,
      });
      clearTimeout(fetchTimeout);

      if (!res.ok) {
        console.warn("[AuthProvider] Guest session creation failed:", res.status);
        // Fall through to finally — still set anonymousMode
        try { localStorage.setItem("anonymousMode", "true"); } catch {}
        return;
      }

      const data = await res.json();

      if (data.token) {
        // Store token in localStorage — this is the primary auth mechanism
        // since the proxy strips Set-Cookie headers
        setSessionToken(data.token);
        // Clear anonymous mode since we have a real guest session
        try { localStorage.removeItem("anonymousMode"); } catch {}
      }

      // Refresh auth.me — now the tRPC link will send the token via Authorization header
      await utils.auth.me.invalidate();
    } catch (err: any) {
      if (err?.name === "AbortError") {
        console.warn("[AuthProvider] Guest session fetch aborted (timeout)");
      } else {
        console.warn("[AuthProvider] Failed to provision guest:", err);
      }
      // Ensure anonymous mode is set so the app still renders
      try { localStorage.setItem("anonymousMode", "true"); } catch {}
    } finally {
      clearTimeout(timeoutId);
      isProvisioning.current = false;
      setGuestProvisioningDone(true);
    }
  }, [utils, guestProvisioningDone]);

  // Track whether user just completed OAuth (for welcome-back toast)
  const justCompletedOAuth = useRef(false);

  // Legacy safety net: Check for OAuth token in URL fragment.
  // Current OAuth callbacks store tokens directly in localStorage via inline JS,
  // so this code path is rarely triggered. Kept as a fallback for edge cases.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('token=')) {
      const params = new URLSearchParams(hash.slice(1));
      const token = params.get('token');
      if (token) {
        setSessionToken(token);
        // Clean the URL
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        // Mark as already attempted so guest provisioning doesn't run
        hasAttempted.current = true;
        setGuestProvisioningDone(true);
        justCompletedOAuth.current = true;
        // Refresh auth.me with the new token
        utils.auth.me.invalidate();
      }
    }
  }, [utils]);

  useEffect(() => {
    if (meQuery.isLoading) return;
    if (meQuery.data) {
      // User exists (real or guest) — mark provisioning as done
      hasAttempted.current = true;
      setGuestProvisioningDone(true);

      // Show welcome-back toast after OAuth sign-in
      if (justCompletedOAuth.current && meQuery.data.authTier !== "anonymous") {
        justCompletedOAuth.current = false;
        const name = meQuery.data.name || "";
        const firstName = name.split(" ")[0] || "";
        toast.success(
          firstName ? `Welcome back, ${firstName}!` : "Welcome back!",
          { description: "You're now signed in." }
        );
      }
      return;
    }

    // No user — provision a guest session
    provisionGuest();
  }, [meQuery.isLoading, meQuery.data, provisionGuest]);

  const isGuest = meQuery.data?.authTier === "anonymous";

  // Silent token refresh — only for authenticated non-guest users
  useTokenRefresh({
    enabled: autoRefreshEnabled && !isGuest,
    isGuest,
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      clearSessionToken();
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  // Persist user info to localStorage for cross-tab awareness
  useEffect(() => {
    try {
      localStorage.setItem(
        "manus-runtime-user-info",
        JSON.stringify(meQuery.data ?? null)
      );
    } catch {
      // Safari Private Browsing may block localStorage
    }
  }, [meQuery.data]);

  const state = useMemo<AuthState>(() => {
    const isInitialLoading = meQuery.isLoading || logoutMutation.isPending;
    const isStillProvisioning = !isInitialLoading && !meQuery.data && !guestProvisioningDone;

    return {
      user: meQuery.data ?? null,
      loading: isInitialLoading || isStillProvisioning,
      isAuthenticated: Boolean(meQuery.data),
      isGuest,
      error: meQuery.error ?? logoutMutation.error ?? null,
      logout,
      refresh: () => meQuery.refetch(),
      autoRefreshEnabled,
      setAutoRefreshEnabled,
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
    guestProvisioningDone,
    isGuest,
    logout,
    autoRefreshEnabled,
    setAutoRefreshEnabled,
  ]);

  return (
    <AuthContext.Provider value={state}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth — reads from the centralized AuthContext.
 *
 * The `loading` flag accounts for guest provisioning, so pages that check
 * `if (loading) return <Spinner />` will NOT flash "Please sign in" while
 * the guest session is being created.
 *
 * Options:
 *   - redirectOnUnauthenticated: if true, redirects to login when no user
 *   - redirectPath: custom login URL (defaults to getLoginUrl())
 */
export function useAuth(options?: {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
}) {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (ctx.loading) return;
    if (ctx.user) return;
    if (typeof window === "undefined") return;

    const target = redirectPath || getLoginUrl();
    if (window.location.pathname === target) return;
    window.location.href = target;
  }, [redirectOnUnauthenticated, redirectPath, ctx.loading, ctx.user]);

  return ctx;
}
