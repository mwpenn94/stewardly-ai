import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { getLoginUrl } from "@/const";
import { setSessionToken, clearSessionToken } from "@/lib/sessionToken";

/**
 * AuthContext — single source of truth for authentication state.
 *
 * Manages the full lifecycle:
 *   1. Initial auth.me query (uses Authorization header from localStorage)
 *   2. Guest session auto-provisioning (if no user)
 *   3. Exposes stable `loading` / `user` / `isAuthenticated` that accounts
 *      for the guest provisioning window so pages never flash "Please sign in"
 *      while a guest session is being created.
 *
 * Token handling:
 *   The Manus reverse proxy strips Set-Cookie headers from ALL server responses.
 *   To work around this, session tokens are stored in localStorage and sent
 *   via the Authorization: Bearer header on every tRPC request. The server
 *   accepts both cookies and Authorization headers.
 */

interface AuthState {
  user: any | null;
  loading: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
  error: any | null;
  logout: () => Promise<void>;
  refresh: () => void;
}

const AuthContext = createContext<AuthState | null>(null);


export function AuthProvider({ children }: { children: ReactNode }) {
  const utils = trpc.useUtils();

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

  const provisionGuest = useCallback(async () => {
    if (isProvisioning.current || hasAttempted.current) return;
    isProvisioning.current = true;
    hasAttempted.current = true;

    try {
      // Create the guest session (server creates user + returns token)
      const res = await fetch("/api/auth/guest-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!res.ok) {
        console.warn("[AuthProvider] Guest session creation failed:", res.status);
        return;
      }

      const data = await res.json();

      if (data.token) {
        // Store token in localStorage — this is the primary auth mechanism
        // since the proxy strips Set-Cookie headers
        setSessionToken(data.token);
      }

      // Refresh auth.me — now the tRPC link will send the token via Authorization header
      await utils.auth.me.invalidate();
    } catch (err) {
      console.warn("[AuthProvider] Failed to provision guest:", err);
    } finally {
      isProvisioning.current = false;
      setGuestProvisioningDone(true);
    }
  }, [utils]);

  // Check for OAuth token in URL fragment (set by OAuth callback page)
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
      return;
    }

    // No user — provision a guest session
    provisionGuest();
  }, [meQuery.isLoading, meQuery.data, provisionGuest]);

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
    localStorage.setItem(
      "manus-runtime-user-info",
      JSON.stringify(meQuery.data ?? null)
    );
  }, [meQuery.data]);

  const state = useMemo<AuthState>(() => {
    const isInitialLoading = meQuery.isLoading || logoutMutation.isPending;
    const isStillProvisioning = !isInitialLoading && !meQuery.data && !guestProvisioningDone;

    return {
      user: meQuery.data ?? null,
      loading: isInitialLoading || isStillProvisioning,
      isAuthenticated: Boolean(meQuery.data),
      isGuest: meQuery.data?.authTier === "anonymous",
      error: meQuery.error ?? logoutMutation.error ?? null,
      logout,
      refresh: () => meQuery.refetch(),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
    guestProvisioningDone,
    logout,
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
