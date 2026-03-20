import { useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";

/**
 * useGuestSession — automatically provisions a guest session when the user
 * is not authenticated. This allows anonymous users to use all features
 * with temporary data that persists during their session.
 * 
 * Call this hook once at the app level (e.g., in App.tsx or a provider).
 * It watches auth.me — when it returns null (no user), it calls
 * POST /api/auth/guest-session to create a guest user + session cookie,
 * then invalidates auth.me so the app re-fetches and gets the guest user.
 */
export function useGuestSession() {
  const utils = trpc.useUtils();
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const isProvisioning = useRef(false);
  const hasAttempted = useRef(false);

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
        // Guest session created — invalidate auth.me so useAuth picks up the guest user
        await utils.auth.me.invalidate();
      }
    } catch (err) {
      console.warn("[GuestSession] Failed to provision guest:", err);
    } finally {
      isProvisioning.current = false;
    }
  }, [utils]);

  useEffect(() => {
    // Only provision if:
    // 1. auth.me has finished loading (not isLoading)
    // 2. No user was found (data is null/undefined)
    // 3. We haven't already attempted provisioning
    if (meQuery.isLoading) return;
    if (meQuery.data) {
      // User exists (either real or guest) — no need to provision
      hasAttempted.current = true;
      return;
    }
    // No user — provision a guest session
    provisionGuest();
  }, [meQuery.isLoading, meQuery.data, provisionGuest]);

  return {
    isGuest: meQuery.data?.authTier === "anonymous",
    isProvisioning: isProvisioning.current,
    user: meQuery.data,
  };
}
