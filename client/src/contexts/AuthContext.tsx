import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { getLoginUrl } from "@/const";

/**
 * AuthContext — single source of truth for authentication state.
 *
 * Manages the full lifecycle:
 *   1. Initial auth.me query
 *   2. Guest session auto-provisioning (if no user)
 *   3. Exposes stable `loading` / `user` / `isAuthenticated` that accounts
 *      for the guest provisioning window so pages never flash "Please sign in"
 *      while a guest session is being created.
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
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
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
      const res = await fetch("/api/auth/guest-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (res.ok) {
        await utils.auth.me.invalidate();
      }
    } catch (err) {
      console.warn("[AuthProvider] Failed to provision guest:", err);
    } finally {
      isProvisioning.current = false;
      setGuestProvisioningDone(true);
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
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  // The key insight: `loading` is true until BOTH:
  //   1. The initial auth.me query has resolved
  //   2. Guest provisioning has completed (if it was needed)
  // This prevents pages from flashing "Please sign in" during the
  // ~200-400ms window while the guest session is being created.
  const state = useMemo<AuthState>(() => {
    const isInitialLoading = meQuery.isLoading || logoutMutation.isPending;
    const isStillProvisioning = !isInitialLoading && !meQuery.data && !guestProvisioningDone;

    localStorage.setItem(
      "manus-runtime-user-info",
      JSON.stringify(meQuery.data)
    );

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
