import { useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { getTokenExpiry, setSessionToken, getSessionToken } from "@/lib/sessionToken";

/**
 * useTokenRefresh — silently refreshes the session token before it expires.
 *
 * Behavior:
 *   - Checks the token's `exp` claim and schedules a refresh 5 minutes before expiry
 *   - Only refreshes for authenticated (non-guest) users
 *   - Stores the new token in localStorage automatically
 *   - User-togglable via the `enabled` parameter (enabled by default)
 *   - Falls back to a 30-minute check interval if the token has no expiry
 *   - Retries once on failure before giving up (user will be prompted to re-login)
 *
 * @param enabled - Whether auto-refresh is active (default: true)
 * @param isGuest - Whether the current user is a guest (skips refresh for guests)
 */
export function useTokenRefresh({
  enabled = true,
  isGuest = false,
}: {
  enabled?: boolean;
  isGuest?: boolean;
} = {}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const scheduleRef = useRef<() => void>(() => {});
  const MAX_RETRIES = 1;

  const refreshMutation = trpc.auth.refreshToken.useMutation({
    onSuccess: (data) => {
      if (data.token) {
        setSessionToken(data.token);
        retryCountRef.current = 0;
        // Schedule next refresh based on new token — use ref to avoid stale closure
        scheduleRef.current();
      }
    },
    onError: (error) => {
      console.warn("[TokenRefresh] Refresh failed:", error.message);
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current++;
        // Retry after 30 seconds
        timerRef.current = setTimeout(() => {
          refreshMutation.mutate();
        }, 30_000);
      }
      // If max retries exceeded, stop trying — user will be prompted to re-login
      // when the token actually expires
    },
  });

  const scheduleRefresh = useCallback(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!enabled || isGuest) return;

    const token = getSessionToken();
    if (!token) return;

    const expiryMs = getTokenExpiry();
    if (!expiryMs) {
      // No expiry claim — check again in 30 minutes
      timerRef.current = setTimeout(() => scheduleRef.current(), 30 * 60 * 1000);
      return;
    }

    const now = Date.now();
    // Refresh 5 minutes before expiry
    const REFRESH_BUFFER_MS = 5 * 60 * 1000;
    const timeUntilRefresh = expiryMs - now - REFRESH_BUFFER_MS;

    if (timeUntilRefresh <= 0) {
      // Token is about to expire or already expired — refresh immediately
      refreshMutation.mutate();
      return;
    }

    // Schedule the refresh
    timerRef.current = setTimeout(() => {
      refreshMutation.mutate();
    }, timeUntilRefresh);
  }, [enabled, isGuest, refreshMutation]);

  // Keep the ref in sync with the latest scheduleRefresh
  useEffect(() => {
    scheduleRef.current = scheduleRefresh;
  }, [scheduleRefresh]);

  useEffect(() => {
    scheduleRefresh();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [scheduleRefresh]);

  // Also refresh when the window regains focus (user returns to tab)
  useEffect(() => {
    if (!enabled || isGuest) return;

    const handleFocus = () => {
      const token = getSessionToken();
      if (!token) return;

      const expiryMs = getTokenExpiry();
      if (!expiryMs) return;

      const now = Date.now();
      const REFRESH_BUFFER_MS = 5 * 60 * 1000;

      // If token is close to expiring, refresh immediately
      if (expiryMs - now < REFRESH_BUFFER_MS) {
        refreshMutation.mutate();
      } else {
        // Re-schedule in case the timer was cleared during sleep
        scheduleRef.current();
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [enabled, isGuest, refreshMutation]);

  return {
    isRefreshing: refreshMutation.isPending,
  };
}
