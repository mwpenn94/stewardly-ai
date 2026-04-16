/**
 * QueryErrorBanner — Lightweight inline error banner for tRPC queries.
 *
 * Pass 60 Depth. Drop this into any page that uses useQuery but lacks
 * error handling. Shows a dismissible banner with retry button.
 *
 * Usage:
 *   const q = trpc.feature.useQuery();
 *   return (
 *     <>
 *       <QueryErrorBanner query={q} label="feature data" />
 *       {q.data && <FeatureUI data={q.data} />}
 *     </>
 *   );
 */
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface QueryLike {
  isError: boolean;
  error?: { message?: string } | null;
  refetch?: () => void;
}

interface Props {
  query: QueryLike;
  label?: string;
  className?: string;
}

export function QueryErrorBanner({ query, label = "data", className = "" }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (!query.isError || dismissed) return null;

  const message = query.error?.message || `Failed to load ${label}`;

  return (
    <div
      role="alert"
      className={`flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm ${className}`}
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
      <span className="flex-1 text-destructive">{message}</span>
      {query.refetch && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => query.refetch?.()}
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </Button>
      )}
      <button type="button"
        onClick={() => setDismissed(true)}
        className="text-muted-foreground hover:text-foreground"
        aria-label="Dismiss error"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
