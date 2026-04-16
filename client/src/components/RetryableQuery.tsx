/**
 * RetryableQuery — Declarative error recovery wrapper for tRPC queries.
 *
 * Wraps any query-dependent UI with:
 * - Automatic retry with exponential backoff (3 attempts)
 * - Graceful degradation with fallback content
 * - User-friendly error messages with retry button
 * - Loading skeleton support
 * - Circuit breaker awareness (shows "service temporarily unavailable")
 *
 * Usage:
 *   <RetryableQuery
 *     query={trpc.market.getQuotes.useQuery({ symbols: ["SPY"] })}
 *     skeleton={<Skeleton className="h-40" />}
 *     fallback={<p>Market data unavailable</p>}
 *   >
 *     {(data) => <QuoteCard data={data} />}
 *   </RetryableQuery>
 */

import { ReactNode, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, WifiOff, Clock, Loader2 } from "lucide-react";

interface QueryResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  error: any;
  refetch: () => void;
  isFetching: boolean;
}

interface RetryableQueryProps<T> {
  query: QueryResult<T>;
  children: (data: T) => ReactNode;
  /** Shown while loading */
  skeleton?: ReactNode;
  /** Shown when all retries fail and no fallback is appropriate */
  fallback?: ReactNode;
  /** Custom error message */
  errorMessage?: string;
  /** Whether to show a compact inline error vs a card */
  compact?: boolean;
  /** Additional className for the wrapper */
  className?: string;
}

function getErrorInfo(error: any): { title: string; description: string; icon: ReactNode } {
  const message = error?.message || error?.data?.message || "";

  if (message.includes("circuit") || message.includes("CIRCUIT_OPEN")) {
    return {
      title: "Service Temporarily Unavailable",
      description: "This data source is experiencing issues. It will automatically recover shortly.",
      icon: <Clock className="w-5 h-5 text-amber-400" />,
    };
  }

  if (message.includes("fetch") || message.includes("network") || message.includes("ECONNREFUSED")) {
    return {
      title: "Connection Error",
      description: "Unable to reach the server. Check your internet connection.",
      icon: <WifiOff className="w-5 h-5 text-red-400" />,
    };
  }

  if (message.includes("timeout") || message.includes("ETIMEDOUT")) {
    return {
      title: "Request Timed Out",
      description: "The request took too long. The server may be busy.",
      icon: <Clock className="w-5 h-5 text-amber-400" />,
    };
  }

  return {
    title: "Something Went Wrong",
    description: message || "An unexpected error occurred. Please try again.",
    icon: <AlertTriangle className="w-5 h-5 text-red-400" />,
  };
}

export function RetryableQuery<T>({
  query,
  children,
  skeleton,
  fallback,
  errorMessage,
  compact = false,
  className = "",
}: RetryableQueryProps<T>) {
  const [retryCount, setRetryCount] = useState(0);

  const handleRetry = useCallback(() => {
    setRetryCount((c) => c + 1);
    query.refetch();
  }, [query]);

  // Loading state
  if (query.isLoading) {
    return skeleton ? <div className={className}>{skeleton}</div> : null;
  }

  // Error state
  if (query.isError) {
    if (fallback) {
      return <div className={className}>{fallback}</div>;
    }

    const errorInfo = getErrorInfo(query.error);

    if (compact) {
      return (
        <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}>
          {errorInfo.icon}
          <span>{errorMessage || errorInfo.title}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRetry}
            disabled={query.isFetching}
            className="h-6 px-2 text-xs"
          >
            {query.isFetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Retry
          </Button>
        </div>
      );
    }

    return (
      <Card className={`border-destructive/30 ${className}`}>
        <CardContent className="p-4 flex items-start gap-3">
          <div className="shrink-0 mt-0.5">{errorInfo.icon}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{errorMessage || errorInfo.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{errorInfo.description}</p>
            {retryCount > 0 && (
              <p className="text-xs text-muted-foreground/60 mt-1">
                Retried {retryCount} time{retryCount > 1 ? "s" : ""}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            disabled={query.isFetching}
            className="shrink-0"
          >
            {query.isFetching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            )}
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Success state
  if (query.data !== undefined) {
    return <>{children(query.data)}</>;
  }

  // No data, no error (shouldn't happen but handle gracefully)
  return fallback ? <div className={className}>{fallback}</div> : null;
}

/**
 * useRetryableAction — Hook for retryable mutations with exponential backoff.
 *
 * Usage:
 *   const { execute, isRetrying, retryCount } = useRetryableAction(
 *     async () => { await mutation.mutateAsync(data); },
 *     { maxRetries: 3 }
 *   );
 */
export function useRetryableAction(
  action: () => Promise<void>,
  options: { maxRetries?: number; baseDelay?: number } = {}
) {
  const { maxRetries = 3, baseDelay = 1000 } = options;
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const execute = useCallback(async () => {
    setIsRetrying(true);
    setRetryCount(0);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await action();
        setIsRetrying(false);
        return;
      } catch (err) {
        setRetryCount(attempt + 1);
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, delay));
        } else {
          setIsRetrying(false);
          throw err;
        }
      }
    }
  }, [action, maxRetries, baseDelay]);

  return { execute, isRetrying, retryCount };
}
