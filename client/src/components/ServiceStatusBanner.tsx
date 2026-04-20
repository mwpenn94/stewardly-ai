/**
 * ServiceStatusBanner — Shows a non-intrusive banner when services are degraded or down.
 * Placed at the top of the app layout. Only visible when there's an issue.
 */
import { useState, useEffect } from "react";
import { useServiceStatus, type ServiceInfo } from "@/contexts/ServiceStatusContext";
import { AlertTriangle, XCircle, RefreshCw, ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

function formatTimeSince(timestamp: number): string {
  if (!timestamp) return "unknown";
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
}

function ServiceRow({ svc }: { svc: ServiceInfo }) {
  const stateColors = {
    degraded: "text-amber-400",
    down: "text-red-400",
    connected: "text-emerald-400",
    unknown: "text-muted-foreground",
  };
  const Icon = svc.state === "down" ? XCircle : AlertTriangle;
  return (
    <div className="flex items-center gap-2 text-xs py-0.5">
      <Icon className={`w-3.5 h-3.5 ${stateColors[svc.state]}`} />
      <span className="font-medium">{svc.name}</span>
      <span className="text-muted-foreground">—</span>
      <span className="text-muted-foreground">
        {svc.message || (svc.state === "degraded" ? `Using cached data${svc.cachedSince ? ` from ${formatTimeSince(svc.cachedSince)}` : ""}` : "Service unavailable")}
      </span>
    </div>
  );
}

export default function ServiceStatusBanner() {
  const { services, isAnyDegraded, isAnyDown, refreshHealth } = useServiceStatus();
  const { isAuthenticated } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Auto-dismiss for non-authenticated users after 8 seconds
  // They don't need to see infrastructure status
  // Use empty deps so the timer only fires once on mount
  useEffect(() => {
    if (!isAuthenticated) {
      const timer = setTimeout(() => setDismissed(true), 8_000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only show when there's an issue
  if ((!isAnyDegraded && !isAnyDown) || dismissed) return null;

  const affectedServices = services.filter(s => s.state === "degraded" || s.state === "down");
  const downCount = services.filter(s => s.state === "down").length;
  const degradedCount = services.filter(s => s.state === "degraded").length;

  const bgColor = downCount > 0 ? "bg-red-500/10 border-red-500/20" : "bg-amber-500/10 border-amber-500/20";
  const textColor = downCount > 0 ? "text-red-400" : "text-amber-400";
  const Icon = downCount > 0 ? XCircle : AlertTriangle;

  return (
    <div className={`border-b ${bgColor} px-4 py-2`}>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${textColor} shrink-0`} />
          <span className={`text-xs font-medium ${textColor}`}>
            {downCount > 0 && `${downCount} service${downCount > 1 ? "s" : ""} unavailable`}
            {downCount > 0 && degradedCount > 0 && ", "}
            {degradedCount > 0 && `${degradedCount} service${degradedCount > 1 ? "s" : ""} degraded`}
          </span>
          <span className="text-xs text-muted-foreground">— Some features may be limited</span>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" onClick={refreshHealth}>
              <RefreshCw className="w-3 h-3" /> Retry
            </Button>
            <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </Button>
            <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => setDismissed(true)}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
        {expanded && (
          <div className="mt-2 pl-6 space-y-0.5 pb-1">
            {affectedServices.map(svc => <ServiceRow key={svc.id} svc={svc} />)}
          </div>
        )}
      </div>
    </div>
  );
}
