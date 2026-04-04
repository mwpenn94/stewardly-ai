/**
 * Changelog Notification Bell
 * 
 * Shows a megaphone icon with unread badge in the sidebar.
 * Clicking opens a dropdown feed of platform updates.
 * Uses createPortal with fixed positioning (matching NotificationBell pattern)
 * to escape sidebar overflow. Tooltip is suppressed while panel is open.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Megaphone, Check, CheckCheck, Sparkles, Wrench, Bug, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const CHANGE_TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  new_feature: { icon: <Sparkles className="w-3.5 h-3.5" />, color: "text-violet-400", label: "New" },
  improvement: { icon: <Wrench className="w-3.5 h-3.5" />, color: "text-sky-400", label: "Improved" },
  fix: { icon: <Bug className="w-3.5 h-3.5" />, color: "text-amber-400", label: "Fixed" },
  removal: { icon: <Trash2 className="w-3.5 h-3.5" />, color: "text-red-400", label: "Removed" },
};

interface ChangelogBellProps {
  collapsed?: boolean;
}

export default function ChangelogBell({ collapsed = false }: ChangelogBellProps) {
  const { user } = useAuth();
  const isGuest = !user || user.authTier === "anonymous";
  const [isOpen, setIsOpen] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const utils = trpc.useUtils();

  // ── Position calculation (matches NotificationBell pattern exactly) ──
  const calculatePosition = useCallback(() => {
    if (!bellRef.current) return;
    const rect = bellRef.current.getBoundingClientRect();
    const panelWidth = 320;
    const panelMaxHeight = 480;
    const margin = 8;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Horizontal: align left edge with bell, keep on screen
    let left = rect.left;
    if (left + panelWidth > window.innerWidth - 16) {
      left = window.innerWidth - panelWidth - 16;
    }
    if (left < 16) left = 16;

    // Vertical: prefer opening upward since bell is at bottom of sidebar
    if (spaceAbove > spaceBelow && spaceAbove > 200) {
      setPanelStyle({
        position: "fixed",
        bottom: window.innerHeight - rect.top + margin,
        left,
        width: panelWidth,
        maxHeight: Math.min(panelMaxHeight, spaceAbove - 16),
        zIndex: 9999,
      });
    } else {
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

  // Recalculate position on scroll/resize while open
  useEffect(() => {
    if (!isOpen) return;
    const recalc = () => calculatePosition();
    window.addEventListener("resize", recalc);
    window.addEventListener("scroll", recalc, true);
    return () => {
      window.removeEventListener("resize", recalc);
      window.removeEventListener("scroll", recalc, true);
    };
  }, [isOpen, calculatePosition]);

  // Guest: track which changelog IDs have been "read" in localStorage
  const [guestReadIds, setGuestReadIds] = useState<Set<number>>(() => {
    try {
      const raw = localStorage.getItem("stewardly_guest_changelog_read");
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });

  const markGuestRead = (id: number) => {
    setGuestReadIds(prev => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem("stewardly_guest_changelog_read", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const markAllGuestRead = () => {
    if (feedQuery.data?.entries) {
      const allIds = feedQuery.data.entries.map(e => e.id);
      setGuestReadIds(new Set(allIds));
      localStorage.setItem("stewardly_guest_changelog_read", JSON.stringify(allIds));
    }
  };

  const unreadQuery = trpc.exponentialEngine.getUnreadChangelogCount.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  const feedQuery = trpc.exponentialEngine.getChangelogFeed.useQuery(undefined, {
    enabled: isOpen,
  });

  const markReadMutation = trpc.exponentialEngine.markChangelogRead.useMutation({
    onSuccess: () => {
      utils.exponentialEngine.getUnreadChangelogCount.invalidate();
      utils.exponentialEngine.getChangelogFeed.invalidate();
    },
  });

  const markAllReadMutation = trpc.exponentialEngine.markAllChangelogRead.useMutation({
    onSuccess: () => {
      utils.exponentialEngine.getUnreadChangelogCount.invalidate();
      utils.exponentialEngine.getChangelogFeed.invalidate();
    },
  });

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        panelRef.current && !panelRef.current.contains(target) &&
        bellRef.current && !bellRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen) {
      calculatePosition();
    }
    setIsOpen(!isOpen);
  };

  const entriesRaw = feedQuery.data?.entries || [];
  const serverUnread = unreadQuery.data?.unreadCount || 0;
  const guestUnreadCount = isGuest && entriesRaw.length > 0
    ? entriesRaw.filter(e => !guestReadIds.has(e.id)).length
    : 0;
  const unreadCount = isGuest ? guestUnreadCount : serverUnread;
  const entries = isGuest
    ? entriesRaw.map(e => ({ ...e, isRead: guestReadIds.has(e.id) }))
    : entriesRaw;

  // ── Panel content ──────────────────────────────────────────────
  const panel = isOpen ? (
    <div
      ref={panelRef}
      style={panelStyle}
      className="bg-popover text-popover-foreground border border-border rounded-xl shadow-2xl shadow-black/30 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-accent" />
          <span className="text-sm font-semibold">What's New</span>
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => isGuest ? markAllGuestRead() : markAllReadMutation.mutate()}
                  disabled={!isGuest && markAllReadMutation.isPending}
                >
                  <CheckCheck className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mark all as read</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsOpen(false)}>
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Entries */}
      <ScrollArea className="flex-1 min-h-0">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Megaphone className="w-8 h-8 mb-3 opacity-30" />
            <p className="text-sm">No updates yet</p>
            <p className="text-xs mt-1 opacity-60">Platform updates will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {entries.map((entry) => {
              const typeConfig = CHANGE_TYPE_CONFIG[entry.changeType] || CHANGE_TYPE_CONFIG.improvement;
              return (
                <div
                  key={entry.id}
                  className={`px-4 py-3 transition-colors ${
                    !entry.isRead ? "bg-primary/[0.03]" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 ${typeConfig.color}`}>
                      {typeConfig.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-xs font-medium ${!entry.isRead ? "text-foreground" : "text-muted-foreground"}`}>
                          {entry.title}
                        </span>
                        {!entry.isRead && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {entry.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant="outline" className={`text-[9px] px-1 py-0 ${typeConfig.color} border-current/20`}>
                          {typeConfig.label}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground/60">
                          v{entry.version}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">
                          {new Date(entry.announcedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    {!entry.isRead && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className="mt-1 p-1 rounded hover:bg-muted shrink-0"
                            onClick={() => isGuest ? markGuestRead(entry.id) : markReadMutation.mutate({ changelogId: entry.id, via: "changelog_page" })}
                          >
                            <Check className="w-3 h-3 text-muted-foreground" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Mark as read</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      {entries.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-border shrink-0">
          <span className="text-[10px] text-muted-foreground">
            {entries.length} update{entries.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  ) : null;

  // ── Bell button ────────────────────────────────────────────────
  const bellButton = (
    <button
      ref={bellRef}
      onClick={handleToggle}
      className={`relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
        isOpen ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
      }`}
      aria-label={`What's New${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
    >
      <Megaphone className="w-4 h-4" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-[16px] rounded-full bg-accent text-[9px] font-bold text-accent-foreground px-0.5 leading-none">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );

  return (
    <>
      {/* When panel is open, suppress the tooltip so it doesn't render behind the panel */}
      {isOpen ? (
        bellButton
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            {bellButton}
          </TooltipTrigger>
          <TooltipContent side="right">
            What's New {unreadCount > 0 ? `(${unreadCount} unread)` : ""}
          </TooltipContent>
        </Tooltip>
      )}

      {/* Portal: backdrop overlay + dropdown panel */}
      {panel && createPortal(
        <>
          {/* Transparent backdrop blocks sidebar tooltips and hover interactions */}
          <div
            className="fixed inset-0"
            style={{ zIndex: 9998 }}
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          {panel}
        </>,
        document.body
      )}
    </>
  );
}
