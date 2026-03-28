import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import { toast } from "sonner";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 15000),
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

/** Deduplicate toasts — track recently shown error keys to avoid spamming */
const _recentErrorToasts = new Set<string>();
function showRetryExhaustedToast(error: unknown, queryKey: unknown) {
  // Skip auth redirect errors — those are handled by redirectToLoginIfUnauthorized
  if (error instanceof TRPCClientError && error.message === UNAUTHED_ERR_MSG) return;

  const key = String(Array.isArray(queryKey) ? queryKey.join(".") : queryKey);
  if (_recentErrorToasts.has(key)) return;
  _recentErrorToasts.add(key);
  setTimeout(() => _recentErrorToasts.delete(key), 30_000); // allow re-show after 30s

  const message = error instanceof Error ? error.message : "Something went wrong";
  // Truncate long error messages
  const shortMsg = message.length > 120 ? message.slice(0, 117) + "..." : message;

  toast.error("Request failed after retries", {
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
    redirectToLoginIfUnauthorized(error);

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
    redirectToLoginIfUnauthorized(error);

    // Show toast for mutation failures (mutations don't auto-retry by default)
    if (error instanceof TRPCClientError && error.message !== UNAUTHED_ERR_MSG) {
      const message = error.message.length > 120 ? error.message.slice(0, 117) + "..." : error.message;
      // Only show if the mutation doesn't have its own onError handler that already toasts
      // We check by looking at the mutation options — if onError exists, skip global toast
      if (!event.mutation.options.onError) {
        toast.error("Action failed", {
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
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
