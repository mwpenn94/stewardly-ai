/**
 * useNavBadges — Aggregates unread/pending counts for sidebar badge display.
 *
 * Sources:
 * 1. Notifications (WebSocket-driven unread count)
 * 2. Changelog (unread changelog entries via exponentialEngine.getUnreadChangelogCount)
 * 3. Learning (due review items via learning.mastery.dueReview)
 *
 * Returns a Map<string, BadgeInfo> keyed by sidebar path.
 * The sidebar NavBtn reads from this map to render badge indicators.
 *
 * Badge display rules:
 * - 0 = no badge
 * - 1-9 = numeric badge
 * - 10+ = "9+" badge
 * - Dot-only variant for low-priority items
 */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useNotifications } from "@/contexts/NotificationContext";

export interface BadgeInfo {
  count: number;
  /** "dot" = small indicator, "count" = numeric, "urgent" = red pulsing */
  variant: "dot" | "count" | "urgent";
}

export type NavBadgeMap = Map<string, BadgeInfo>;

export function useNavBadges(): NavBadgeMap {
  // 1. Notification unread count (real-time via WebSocket)
  const { unreadCount: notifUnread } = useNotifications();

  // 2. Changelog unread count (polled every 2 min)
  const { data: changelogData } = trpc.exponentialEngine.getUnreadChangelogCount.useQuery(
    undefined,
    { refetchInterval: 120_000, staleTime: 60_000 }
  );

  // 3. Learning due review count (polled every 2 min)
  const { data: reviewData } = trpc.learning.mastery.dueReview.useQuery(
    { limit: 1 },
    { refetchInterval: 120_000, staleTime: 60_000 }
  );

  return useMemo(() => {
    const map: NavBadgeMap = new Map();

    // Notifications → Chat path (conversations often trigger notifications)
    if (notifUnread > 0) {
      map.set("/chat", {
        count: notifUnread,
        variant: notifUnread >= 5 ? "urgent" : "count",
      });
    }

    // Changelog unread → Help path
    const changelogUnread = changelogData?.unreadCount ?? 0;
    if (changelogUnread > 0) {
      map.set("/help", { count: changelogUnread, variant: "dot" });
    }

    // Learning due reviews → Learning path
    const dueCount = reviewData?.total ?? reviewData?.cards?.length ?? 0;
    if (dueCount > 0) {
      map.set("/learning", { count: dueCount, variant: "count" });
    }

    return map;
  }, [notifUnread, changelogData, reviewData]);
}

/** Format badge count for display: 9+ for 10+, empty for 0 */
export function formatBadgeCount(count: number): string {
  if (count <= 0) return "";
  if (count > 9) return "9+";
  return String(count);
}
