/**
 * ServiceDegradedFallback — Inline component that shows degraded-mode UI
 * when a specific service is down or degraded.
 * 
 * Usage:
 *   <ServiceDegradedFallback serviceId="llm" fallbackMessage="AI features are temporarily unavailable">
 *     <ChatInterface />
 *   </ServiceDegradedFallback>
 * 
 * When the service is connected, children render normally.
 * When degraded, children render with a subtle indicator.
 * When down, the fallback UI replaces children entirely.
 */
import { type ReactNode } from "react";
import { useServiceState } from "@/contexts/ServiceStatusContext";
import { AlertTriangle, WifiOff, RefreshCw, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ServiceDegradedFallbackProps {
  serviceId: string;
  children: ReactNode;
  fallbackMessage?: string;
  degradedMessage?: string;
  showWhenDegraded?: boolean; // if true, show degraded indicator above children
}

function formatTimeSince(timestamp: number): string {
  if (!timestamp) return "";
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} minutes ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)} hours ago`;
  return `${Math.round(diff / 86_400_000)} days ago`;
}

export default function ServiceDegradedFallback({
  serviceId,
  children,
  fallbackMessage = "This feature is temporarily unavailable.",
  degradedMessage = "Some data may be outdated.",
  showWhenDegraded = true,
}: ServiceDegradedFallbackProps) {
  const { state, isDegraded, isDown, message, cachedSince } = useServiceState(serviceId);

  // Connected or unknown — render children normally
  if (state === "connected" || state === "unknown") {
    return <>{children}</>;
  }

  // Down — show fallback UI
  if (isDown) {
    return (
      <Card className="border-red-500/20 bg-red-500/5">
        <CardContent className="py-8 text-center">
          <WifiOff className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h3 className="text-sm font-semibold mb-1">Service Unavailable</h3>
          <p className="text-xs text-muted-foreground mb-4 max-w-sm mx-auto">
            {message || fallbackMessage}
          </p>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.location.reload()}>
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Degraded — show indicator above children
  if (isDegraded && showWhenDegraded) {
    return (
      <>
        <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-amber-300 font-medium">Limited Functionality</span>
          <span className="text-muted-foreground">
            {message || degradedMessage}
            {cachedSince ? (
              <span className="inline-flex items-center gap-1 ml-1">
                <Clock className="w-3 h-3" /> Last updated {formatTimeSince(cachedSince)}
              </span>
            ) : null}
          </span>
        </div>
        {children}
      </>
    );
  }

  return <>{children}</>;
}
