/**
 * ConnectionQualityIndicator — Shows streaming/connection status in chat header.
 *
 * Absorbed from manus-next-app useNetworkStatus pattern.
 * Displays: online/offline, streaming active, latency estimate.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Wifi, WifiOff, Activity, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConnectionQualityIndicatorProps {
  isStreaming?: boolean;
  className?: string;
}

type ConnectionState = "online" | "offline" | "reconnecting" | "streaming";

export function ConnectionQualityIndicator({
  isStreaming = false,
  className,
}: ConnectionQualityIndicatorProps) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setWasOffline(false), 5000);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const state: ConnectionState = !isOnline
    ? "offline"
    : wasOffline
    ? "reconnecting"
    : isStreaming
    ? "streaming"
    : "online";

  const config = {
    online: {
      icon: Wifi,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      label: "Connected",
      pulse: false,
    },
    offline: {
      icon: WifiOff,
      color: "text-destructive",
      bg: "bg-destructive/10",
      label: "Offline",
      pulse: false,
    },
    reconnecting: {
      icon: Wifi,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      label: "Reconnected",
      pulse: true,
    },
    streaming: {
      icon: Activity,
      color: "text-primary",
      bg: "bg-primary/10",
      label: "Streaming",
      pulse: true,
    },
  }[state];

  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium transition-all",
        config.bg,
        config.color,
        className
      )}
      title={config.label}
      role="status"
      aria-live="polite"
    >
      <Icon className={cn("w-3 h-3", config.pulse && "animate-pulse")} />
      <span className="hidden sm:inline">{config.label}</span>
      {state === "streaming" && (
        <span className="w-1 h-1 rounded-full bg-current animate-pulse" />
      )}
    </div>
  );
}
