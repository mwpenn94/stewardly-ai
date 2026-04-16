/**
 * DataFreshnessIndicator — shows when data was last refreshed, with
 * color-coded staleness indicators and optional refresh button.
 *
 * Pass 68 — C4 Data Visualization + C8 Performance improvement.
 */
import { Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DataFreshnessIndicatorProps {
  /** Timestamp of last data refresh (ISO string or Date) */
  lastUpdated?: string | Date | null;
  /** Whether a refresh is currently in progress */
  isRefreshing?: boolean;
  /** Callback to trigger a manual refresh */
  onRefresh?: () => void;
  /** Staleness threshold in minutes (default: 60) */
  staleAfterMinutes?: number;
  /** Label prefix (default: "Last updated") */
  label?: string;
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDay}d ago`;
}

function getStaleness(
  date: Date,
  staleAfterMinutes: number,
): "fresh" | "aging" | "stale" {
  const now = new Date();
  const diffMin = (now.getTime() - date.getTime()) / 60000;
  if (diffMin < staleAfterMinutes * 0.5) return "fresh";
  if (diffMin < staleAfterMinutes) return "aging";
  return "stale";
}

const stalenessColors = {
  fresh: "text-emerald-500",
  aging: "text-amber-500",
  stale: "text-red-500",
};

export function DataFreshnessIndicator({
  lastUpdated,
  isRefreshing,
  onRefresh,
  staleAfterMinutes = 60,
  label = "Last updated",
}: DataFreshnessIndicatorProps) {
  if (!lastUpdated) return null;

  const date =
    lastUpdated instanceof Date ? lastUpdated : new Date(lastUpdated);
  const staleness = getStaleness(date, staleAfterMinutes);
  const timeAgo = getTimeAgo(date);

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`flex items-center gap-1 ${stalenessColors[staleness]}`}>
            <Clock className="h-3 w-3" />
            {label}: {timeAgo}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{date.toLocaleString()}</p>
          <p className="text-xs opacity-70">
            {staleness === "stale"
              ? "Data may be outdated"
              : staleness === "aging"
                ? "Data is aging"
                : "Data is fresh"}
          </p>
        </TooltipContent>
      </Tooltip>
      {onRefresh && (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label="Refresh data"
        >
          <RefreshCw
            className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`}
          />
        </Button>
      )}
    </div>
  );
}

export default DataFreshnessIndicator;
