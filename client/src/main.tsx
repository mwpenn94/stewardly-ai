import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { getSessionToken } from "./lib/sessionToken";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import { toast } from "sonner";
import App from "./App";
import { DisclosureProvider } from "@/contexts/DisclosureContext";
import { ServiceStatusProvider } from "@/contexts/ServiceStatusContext";
import { initErrorTracking } from "@/lib/errorTracking";
import { initPerformanceMonitor } from "@/lib/performanceMonitor";
import "./index.css";

// Initialize global error tracking & performance monitoring
initErrorTracking();
initPerformanceMonitor();

/**
 * Handle stale-deployment chunk loading errors.
 * When a new deployment changes chunk hashes, users with cached index.html
 * will request old chunk filenames that no longer exist. The server's SPA
 * fallback serves index.html (text/html) instead, causing:
 *   "'text/html' is not a valid JavaScript MIME type"
 * This listener detects that and auto-reloads once to pick up the new index.html.
 */
window.addEventListener("vite:preloadError", (event) => {
  // Prevent the default error from propagating
  event.preventDefault();
  // Only auto-reload once per session to avoid infinite loops
  const reloadKey = "stewardly-chunk-reload";
  if (!sessionStorage.getItem(reloadKey)) {
    sessionStorage.setItem(reloadKey, "1");
    window.location.reload();
  }
});

// Also catch dynamic import() failures that bypass the Vite preload event
window.addEventListener("unhandledrejection", (event) => {
  const msg = String(event.reason?.message || event.reason || "");
  if (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("is not a valid JavaScript MIME type") ||
    msg.includes("Importing a module script failed")
  ) {
    event.preventDefault();
    const reloadKey = "stewardly-chunk-reload";
    if (!sessionStorage.getItem(reloadKey)) {
      sessionStorage.setItem(reloadKey, "1");
      window.location.reload();
    }
  }
});

/** Detect transient "server restarting" errors where the HTML fallback is returned instead of JSON */
const isTransientServerRestart = (error: unknown): boolean => {
  if (error instanceof TRPCClientError) {
    const msg = error.message;
    // Server restart returns HTML page instead of JSON
    if (msg.includes("is not valid JSON") || msg.includes("Unexpected token '<'") || msg.includes("Unexpected token '\u003c'")) return true;
    // Network failures during restart
    if (msg.includes("Failed to fetch") || msg.includes("Load failed") || msg.includes("NetworkError")) return true;
  }
  return false;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Always retry transient server-restart errors (up to 5 times with longer delays)
        if (isTransientServerRestart(error)) return failureCount < 5;
        // Don't retry auth errors
        if (error instanceof TRPCClientError && error.message === UNAUTHED_ERR_MSG) return false;
        // Default: retry up to 3 times
        return failureCount < 3;
      },
      retryDelay: (attemptIndex, error) => {
        // Longer delays for server-restart errors (give server time to come back)
        if (isTransientServerRestart(error)) return Math.min(2000 * 2 ** attemptIndex, 20000);
        return Math.min(1000 * 2 ** attemptIndex, 15000);
      },
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },

});

/**
 * Handle UNAUTHORIZED errors gracefully — NO automatic redirect to login.
 *
 * The old approach (`window.location.href = getLoginUrl()`) caused an auth
 * redirect loop: any 401 from a protectedProcedure would force a full-page
 * OAuth redirect, which would provision a guest session, which would expire,
 * which would trigger another redirect, etc.
 *
 * New approach:
 *   1. Invalidate auth.me so the AuthProvider re-checks the session
 *   2. Show a toast telling the user their session expired
 *   3. The AuthProvider will re-provision a guest session if needed
 *   4. The user can click "Sign in" manually if they want a real account
 *
 * This prevents the redirect loop entirely.
 */
let _lastAuthToastTime = 0;
const AUTH_TOAST_COOLDOWN_MS = 10_000; // Don't spam auth toasts

const handleUnauthorizedGracefully = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (error.message !== UNAUTHED_ERR_MSG) return;

  // Invalidate auth.me so AuthProvider re-checks and re-provisions if needed
  queryClient.invalidateQueries({ queryKey: [["auth", "me"]] });

  // Show a toast (with cooldown to prevent spam)
  const now = Date.now();
  if (now - _lastAuthToastTime > AUTH_TOAST_COOLDOWN_MS) {
    _lastAuthToastTime = now;
    toast.info("Session refreshing...", {
      description: "Your session is being refreshed. Please try again in a moment.",
      duration: 4000,
    });
  }
};

/** Deduplicate toasts — track recently shown error keys to avoid spamming */
const _recentErrorToasts = new Set<string>();
function showRetryExhaustedToast(error: unknown, queryKey: unknown) {
  // Skip auth errors — those are handled by handleUnauthorizedGracefully
  if (error instanceof TRPCClientError && error.message === UNAUTHED_ERR_MSG) return;

  const key = String(Array.isArray(queryKey) ? queryKey.join(".") : queryKey);
  if (_recentErrorToasts.has(key)) return;
  _recentErrorToasts.add(key);
  setTimeout(() => _recentErrorToasts.delete(key), 30_000); // allow re-show after 30s

  const message = error instanceof Error ? error.message : "Something went wrong";
  // Truncate long error messages
  const shortMsg = message.length > 120 ? message.slice(0, 117) + "..." : message;

  toast.error("Something didn't work — let's try again", {
    description: shortMsg,
    action: {
      label: "Retry",
      onClick: () => {
        queryClient.invalidateQueries({ queryKey: queryKey as any });
      },
    },
    duration: 8000,
  });
}

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;

    // Handle auth errors gracefully — NO redirect
    handleUnauthorizedGracefully(error);

    // Suppress transient server-restart errors from user-facing toasts — they auto-retry
    if (isTransientServerRestart(error)) {
      // Only log at debug level; the retry mechanism will handle recovery
      console.debug("[API] Transient error (server restarting), retrying...", error.message);
      return;
    }

    // Show toast only when retries are exhausted (fetchFailureCount >= retry count)
    const retryCount = event.query.options.retry;
    const maxRetries = typeof retryCount === "number" ? retryCount : 3;
    if (event.query.state.fetchFailureCount >= maxRetries) {
      showRetryExhaustedToast(error, event.query.queryKey);
    }

    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;

    // Handle auth errors gracefully — NO redirect
    handleUnauthorizedGracefully(error);

    // Show toast for mutation failures (mutations don't auto-retry by default)
    if (error instanceof TRPCClientError && error.message !== UNAUTHED_ERR_MSG) {
      const message = error.message.length > 120 ? error.message.slice(0, 117) + "..." : error.message;
      // Only show if the mutation doesn't have its own onError handler that already toasts
      // We check by looking at the mutation options — if onError exists, skip global toast
      if (!event.mutation.options.onError) {
        toast.error("That didn't go through", {
          description: message,
          duration: 6000,
        });
      }
    }

    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        const token = getSessionToken();
        const headers = new Headers((init as RequestInit)?.headers);
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        return globalThis.fetch(input, {
          ...(init ?? {}),
          headers,
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <DisclosureProvider>
        <ServiceStatusProvider>
          <App />
        </ServiceStatusProvider>
      </DisclosureProvider>
    </QueryClientProvider>
  </trpc.Provider>
);
