/**
 * Changelog Notification Bell
 * 
 * Shows a megaphone icon with unread badge in the sidebar.
 * Clicking opens a dropdown feed of platform updates.
 * Uses createPortal with fixed positioning to escape sidebar overflow.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Megaphone, Check, CheckCheck, Sparkles, Wrench, Bug, Trash2,
  ChevronRight, X,
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
  const utils = trpc.useUtils();

  // ── Position state for portal ──────────────────────────────────
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; openUp: boolean }>({
    top: 0, left: 0, openUp: true,
  });

  const recalcPosition = useCallback(() => {
    if (!bellRef.current) return;
    const rect = bellRef.current.getBoundingClientRect();
    const panelHeight = 480;
    const panelWidth = 320;
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceAbove > spaceBelow;

    let top: number;
    if (openUp) {
      top = rect.top - panelHeight - 8;
      if (top < 8) top = 8;
    } else {
      top = rect.bottom + 8;
    }

    let left = rect.left;
    if (left + panelWidth > window.innerWidth - 8) {
      left = window.innerWidth - panelWidth - 8;
    }
    if (left < 8) left = 8;

    setPanelPos({ top, left, openUp });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    recalcPosition();
    const onResize = () => recalcPosition();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [isOpen, recalcPosition]);

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

  // Queries work for both guests (public endpoints) and authenticated users
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

  // Close on outside click + Escape
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
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const entriesRaw = feedQuery.data?.entries || [];
  // For guests, compute unread count from localStorage tracking
  const serverUnread = unreadQuery.data?.unreadCount || 0;
  const guestUnreadCount = isGuest && entriesRaw.length > 0
    ? entriesRaw.filter(e => !guestReadIds.has(e.id)).length
    : 0;
  const unreadCount = isGuest ? guestUnreadCount : serverUnread;
  const entries = isGuest
    ? entriesRaw.map(e => ({ ...e, isRead: guestReadIds.has(e.id) }))
    : entriesRaw;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={bellRef}
            onClick={() => setIsOpen(!isOpen)}
            className={`relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
              isOpen ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
          >
            <Megaphone className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent text-[9px] font-bold text-accent-foreground flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          What's New {unreadCount > 0 ? `(${unreadCount} unread)` : ""}
        </TooltipContent>
      </Tooltip>

      {/* Dropdown Feed Panel — portaled to document.body */}
      {isOpen && createPortal(
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            top: panelPos.top,
            left: panelPos.left,
            zIndex: 9999,
          }}
          className="w-80 max-h-[480px] bg-popover text-popover-foreground border border-border rounded-xl shadow-xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold">What's New</span>
              {unreadCount > 0 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-accent border-accent/30">
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
                      className="w-7 h-7"
                      onClick={() => isGuest ? markAllGuestRead() : markAllReadMutation.mutate()}
                      disabled={!isGuest && markAllReadMutation.isPending}
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Mark all as read</TooltipContent>
                </Tooltip>
              )}
              <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setIsOpen(false)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Entries */}
          <ScrollArea className="max-h-[380px]">
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
                        !entry.isRead ? "bg-accent/[0.03]" : ""
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
                              <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
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
        </div>,
        document.body
      )}
    </>
  );
}
