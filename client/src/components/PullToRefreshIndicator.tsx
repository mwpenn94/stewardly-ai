/**
 * PullToRefreshIndicator — G40
 *
 * Visual indicator for pull-to-refresh gesture.
 * Shows a spinner/arrow that animates based on pull progress.
 */

import { Loader2, ArrowDown } from "lucide-react";

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  pullProgress: number;
  isRefreshing: boolean;
}

export function PullToRefreshIndicator({
  pullDistance,
  pullProgress,
  isRefreshing,
}: PullToRefreshIndicatorProps) {
  if (pullDistance <= 0 && !isRefreshing) return null;

  return (
    <div
      className="flex items-center justify-center overflow-hidden transition-[height] duration-200"
      style={{ height: isRefreshing ? 48 : pullDistance }}
    >
      <div
        className="flex items-center gap-2 text-muted-foreground text-sm"
        style={{
          opacity: Math.min(pullProgress * 1.5, 1),
          transform: `rotate(${isRefreshing ? 0 : pullProgress * 180}deg)`,
          transition: isRefreshing ? "transform 0.3s" : "none",
        }}
      >
        {isRefreshing ? (
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        ) : (
          <ArrowDown
            className={`w-5 h-5 transition-colors ${
              pullProgress >= 1 ? "text-primary" : "text-muted-foreground"
            }`}
          />
        )}
      </div>
      {isRefreshing && (
        <span className="text-xs text-muted-foreground ml-2">Refreshing...</span>
      )}
    </div>
  );
}
