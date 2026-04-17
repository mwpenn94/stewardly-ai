/**
 * FailoverBoundary — Graceful degradation wrapper for wealth engine panels.
 *
 * Pass 101. Wraps any panel/section with three visual states:
 *   1. Connected — green indicator, full functionality
 *   2. Degraded — amber indicator, partial functionality with stale data warning
 *   3. Unavailable — red indicator, fallback UI with retry
 *
 * Automatically detects connection state from tRPC query results and
 * provides manual override for offline-capable panels.
 *
 * Usage:
 *   <FailoverBoundary
 *     name="Market Data"
 *     status="connected"
 *     lastUpdated={Date.now()}
 *   >
 *     <MarketDataPanel />
 *   </FailoverBoundary>
 */
import { ReactNode, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Wifi, WifiOff, AlertTriangle, RefreshCw, Clock, Shield, ChevronDown, ChevronUp,
} from "lucide-react";

export type FailoverStatus = "connected" | "degraded" | "unavailable";

interface FailoverBoundaryProps {
  children: ReactNode;
  /** Display name for the service/panel */
  name: string;
  /** Current connection status */
  status: FailoverStatus;
  /** Unix timestamp of last successful data fetch */
  lastUpdated?: number;
  /** Callback to retry connection */
  onRetry?: () => void;
  /** Whether retry is in progress */
  retrying?: boolean;
  /** Optional fallback content when unavailable */
  fallback?: ReactNode;
  /** Whether to show the status indicator (default: true) */
  showIndicator?: boolean;
  /** Whether the panel can work offline with cached data */
  offlineCapable?: boolean;
  /** Optional stale data threshold in ms (default: 5 minutes) */
  staleThreshold?: number;
}

const STATUS_CONFIG: Record<FailoverStatus, {
  icon: typeof Wifi;
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
  description: string;
}> = {
  connected: {
    icon: Wifi,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    label: "Connected",
    description: "Live data — all features available",
  },
  degraded: {
    icon: AlertTriangle,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    label: "Degraded",
    description: "Using cached data — some features may be limited",
  },
  unavailable: {
    icon: WifiOff,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    label: "Unavailable",
    description: "Service temporarily unavailable",
  },
};

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function FailoverBoundary({
  children,
  name,
  status,
  lastUpdated,
  onRetry,
  retrying = false,
  fallback,
  showIndicator = true,
  offlineCapable = false,
  staleThreshold = 300_000, // 5 minutes
}: FailoverBoundaryProps) {
  const [expanded, setExpanded] = useState(false);
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const isStale = lastUpdated ? (Date.now() - lastUpdated > staleThreshold) : false;

  const handleRetry = useCallback(() => {
    if (onRetry && !retrying) onRetry();
  }, [onRetry, retrying]);

  // Unavailable state with fallback
  if (status === "unavailable" && !offlineCapable) {
    return (
      <div className="space-y-2">
        {showIndicator && (
          <StatusIndicator
            name={name}
            config={config}
            Icon={Icon}
            lastUpdated={lastUpdated}
            onRetry={handleRetry}
            retrying={retrying}
            expanded={expanded}
            setExpanded={setExpanded}
          />
        )}
        {fallback || (
          <Card className={`${config.borderColor} border`}>
            <CardContent className="p-8 text-center">
              <WifiOff className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">{name} is temporarily unavailable</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {offlineCapable
                  ? "Showing cached data. Some features may be limited."
                  : "Please try again in a few moments."}
              </p>
              {onRetry && (
                <Button variant="outline" size="sm" onClick={handleRetry} disabled={retrying} className="mt-4 gap-1.5">
                  <RefreshCw className={`w-3.5 h-3.5 ${retrying ? "animate-spin" : ""}`} />
                  {retrying ? "Retrying..." : "Retry Connection"}
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {showIndicator && (
        <StatusIndicator
          name={name}
          config={config}
          Icon={Icon}
          lastUpdated={lastUpdated}
          isStale={isStale}
          onRetry={handleRetry}
          retrying={retrying}
          expanded={expanded}
          setExpanded={setExpanded}
        />
      )}
      {/* Stale data warning banner */}
      {status === "degraded" && isStale && lastUpdated && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>Data last updated {formatTimeAgo(lastUpdated)}. Results may not reflect current conditions.</span>
        </div>
      )}
      {children}
    </div>
  );
}

/** Compact status indicator bar */
function StatusIndicator({
  name,
  config,
  Icon,
  lastUpdated,
  isStale,
  onRetry,
  retrying,
  expanded,
  setExpanded,
}: {
  name: string;
  config: (typeof STATUS_CONFIG)[FailoverStatus];
  Icon: typeof Wifi;
  lastUpdated?: number;
  isStale?: boolean;
  onRetry?: () => void;
  retrying?: boolean;
  expanded: boolean;
  setExpanded: (v: boolean) => void;
}) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${config.bgColor} border ${config.borderColor}`}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 cursor-help">
            <Icon className={`w-3.5 h-3.5 ${config.color}`} />
            <Badge variant="outline" className={`text-[10px] ${config.color} border-current/30 px-1.5 py-0`}>
              {config.label}
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">{config.description}</p>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground mt-1">
              Last updated: {formatTimeAgo(lastUpdated)}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
      <span className="text-xs text-muted-foreground flex-1">{name}</span>
      {lastUpdated && (
        <span className={`text-[10px] ${isStale ? "text-amber-400" : "text-muted-foreground/60"}`}>
          {formatTimeAgo(lastUpdated)}
        </span>
      )}
      {onRetry && (
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onRetry} disabled={retrying}>
          <RefreshCw className={`w-3 h-3 ${retrying ? "animate-spin" : ""}`} />
        </Button>
      )}
    </div>
  );
}

/**
 * useFailoverStatus — Hook to derive failover status from tRPC query state.
 *
 * Usage:
 *   const query = trpc.market.getQuotes.useQuery(...);
 *   const failover = useFailoverStatus(query);
 *   <FailoverBoundary status={failover.status} lastUpdated={failover.lastUpdated} ...>
 */
export function useFailoverStatus(query: {
  data: any;
  isLoading: boolean;
  isError: boolean;
  dataUpdatedAt: number;
  failureCount: number;
}): { status: FailoverStatus; lastUpdated: number } {
  if (query.isError && !query.data) {
    return { status: "unavailable", lastUpdated: query.dataUpdatedAt };
  }
  if (query.isError && query.data) {
    return { status: "degraded", lastUpdated: query.dataUpdatedAt };
  }
  if (query.failureCount > 0 && query.data) {
    return { status: "degraded", lastUpdated: query.dataUpdatedAt };
  }
  return { status: "connected", lastUpdated: query.dataUpdatedAt || Date.now() };
}

export default FailoverBoundary;
