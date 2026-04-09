import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Bell, BellRing, Check, CheckCheck, X, Zap, Brain, Shield, TrendingUp, Radio, Settings2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Notification } from "@/hooks/useWebSocket";

// ─── Props ──────────────────────────────────────────────────────────────────

interface NotificationBellProps {
  notifications: Notification[];
  unreadCount: number;
  connected: boolean;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClear: () => void;
  /** Optional: navigate callback for actionable notifications (e.g. onboarding items) */
  onNavigate?: (href: string) => void;
}

// ─── Type Config ────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  coaching: { icon: <Brain className="w-3.5 h-3.5" />, color: "text-violet-400", label: "Coaching" },
  propagation: { icon: <Radio className="w-3.5 h-3.5" />, color: "text-blue-400", label: "Intelligence" },
  alert: { icon: <Shield className="w-3.5 h-3.5" />, color: "text-red-400", label: "Alert" },
  model_complete: { icon: <TrendingUp className="w-3.5 h-3.5" />, color: "text-emerald-400", label: "Model" },
  enrichment: { icon: <Zap className="w-3.5 h-3.5" />, color: "text-amber-400", label: "Enrichment" },
  system: { icon: <Settings2 className="w-3.5 h-3.5" />, color: "text-gray-400", label: "System" },
  onboarding: { icon: <Rocket className="w-3.5 h-3.5" />, color: "text-accent", label: "Getting Started" },
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/20 border-red-500/40 text-red-300",
  high: "bg-amber-500/15 border-amber-500/30 text-amber-300",
  medium: "bg-blue-500/10 border-blue-500/20 text-blue-300",
  low: "bg-gray-500/10 border-gray-500/20 text-gray-400",
};

// ─── Time Formatting ────────────────────────────────────────────────────────

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function NotificationBell({
  notifications,
  unreadCount,
  connected,
  onMarkAsRead,
  onMarkAllAsRead,
  onClear,
  onNavigate,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  // Calculate fixed position for the panel based on bell button location
  const calculatePosition = useCallback(() => {
    if (!bellRef.current) return;
    const rect = bellRef.current.getBoundingClientRect();
    const panelWidth = 360;
    const panelMaxHeight = 480;
    const margin = 8;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Horizontal: try to align left edge with bell, but keep on screen
    let left = rect.left;
    if (left + panelWidth > window.innerWidth - 16) {
      left = window.innerWidth - panelWidth - 16;
    }
    if (left < 16) left = 16;

    // Vertical: prefer opening upward since bell is at bottom of sidebar
    if (spaceAbove > spaceBelow && spaceAbove > 200) {
      // Open upward
      setPanelStyle({
        position: "fixed",
        bottom: window.innerHeight - rect.top + margin,
        left,
        width: panelWidth,
        maxHeight: Math.min(panelMaxHeight, spaceAbove - 16),
        zIndex: 9999,
      });
    } else {
      // Open downward
      setPanelStyle({
        position: "fixed",
        top: rect.bottom + margin,
        left,
        width: panelWidth,
        maxHeight: Math.min(panelMaxHeight, spaceBelow - 16),
        zIndex: 9999,
      });
    }
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        bellRef.current && !bellRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open]);

  // Recalculate position on scroll/resize while open
  useEffect(() => {
    if (!open) return;
    const recalc = () => calculatePosition();
    window.addEventListener("resize", recalc);
    window.addEventListener("scroll", recalc, true);
    return () => {
      window.removeEventListener("resize", recalc);
      window.removeEventListener("scroll", recalc, true);
    };
  }, [open, calculatePosition]);

  const handleToggle = () => {
    if (!open) {
      calculatePosition();
    }
    setOpen(!open);
  };

  const filteredNotifications = filter
    ? notifications.filter((n) => n.type === filter)
    : notifications;

  const typeCountMap = notifications.reduce((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const panel = open ? (
    <div
      ref={panelRef}
      style={panelStyle}
      className="bg-popover text-popover-foreground border border-border rounded-xl shadow-2xl shadow-black/30 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
              {unreadCount} new
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Mark all as read" onClick={onMarkAllAsRead}>
                  <CheckCheck className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mark all as read</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Close notifications" onClick={() => setOpen(false)}>
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Filter Tabs */}
      {notifications.length > 0 && (
        <div className="flex items-center gap-1 px-3 py-2 border-b border-border overflow-x-auto shrink-0">
          <button
            className={`text-[10px] px-2 py-1 rounded-full whitespace-nowrap transition-colors ${
              !filter ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
            onClick={() => setFilter(null)}
          >
            All ({notifications.length})
          </button>
          {Object.entries(typeCountMap).map(([type, count]) => {
            const config = TYPE_CONFIG[type];
            return (
              <button
                key={type}
                className={`text-[10px] px-2 py-1 rounded-full whitespace-nowrap transition-colors flex items-center gap-1 ${
                  filter === type ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                onClick={() => setFilter(filter === type ? null : type)}
              >
                {config?.label || type} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Notification List */}
      <ScrollArea className="flex-1 min-h-0">
        {filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Bell className="w-8 h-8 mb-3 opacity-30" />
            <p className="text-sm">No notifications yet</p>
            <p className="text-xs mt-1 opacity-60">
              {connected ? "You'll see updates here in real time" : "Reconnecting..."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredNotifications.map((notification) => {
              const typeConfig = TYPE_CONFIG[notification.type] || TYPE_CONFIG.system;
              const isUnread = !notification.readAt;
              const priorityClass = PRIORITY_COLORS[notification.priority] || PRIORITY_COLORS.medium;

              return (
                <button
                  key={notification.id}
                  className={`w-full text-left px-4 py-3 transition-colors hover:bg-muted/50 ${
                    isUnread ? "bg-primary/[0.03]" : ""
                  }`}
                  onClick={() => {
                    if (isUnread) onMarkAsRead(notification.id);
                    // Navigate for actionable notifications (onboarding items)
                    const href = (notification.metadata as any)?.href;
                    if (href && onNavigate) {
                      onNavigate(href);
                      setOpen(false);
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Type Icon */}
                    <div className={`mt-0.5 ${typeConfig.color}`}>
                      {typeConfig.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-xs font-medium truncate ${isUnread ? "text-foreground" : "text-muted-foreground"}`}>
                          {notification.title}
                        </span>
                        {isUnread && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {notification.body}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${priorityClass}`}>
                          {notification.priority}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">
                          {timeAgo(notification.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Read indicator */}
                    {isUnread && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="mt-1 p-1 rounded hover:bg-muted">
                            <Check className="w-3 h-3 text-muted-foreground" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>Mark as read</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-border shrink-0">
          <span className="text-[10px] text-muted-foreground">
            {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
          </span>
          <button
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            onClick={onClear}
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  ) : null;

  return (
    <>
      {/* Bell Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            ref={bellRef}
            variant="ghost"
            size="icon"
            className="relative"
            onClick={handleToggle}
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
          >
            {unreadCount > 0 ? (
              <BellRing className="w-4.5 h-4.5 text-amber-400 animate-[ring_0.5s_ease-in-out]" />
            ) : (
              <Bell className="w-4.5 h-4.5 text-muted-foreground" />
            )}
            {/* Badge */}
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none shadow-lg shadow-red-500/30">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
            {/* Connection indicator */}
            <span
              className={`absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${
                connected ? "bg-emerald-400" : "bg-gray-500"
              }`}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Notifications{connected ? "" : " (disconnected)"}</p>
        </TooltipContent>
      </Tooltip>

      {/* Portal: backdrop overlay + dropdown panel */}
      {panel && createPortal(
        <>
          {/* Transparent backdrop blocks sidebar tooltips and hover interactions */}
          <div
            className="fixed inset-0"
            style={{ zIndex: 9998 }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          {panel}
        </>,
        document.body
      )}
    </>
  );
}
