/**
 * OnboardingNotifications — surfaces AI Getting Started checklist items
 * as in-app notification entries within the NotificationBell panel.
 *
 * Instead of occupying sidebar space, onboarding tasks now appear as
 * actionable "onboarding" type notifications. Completed items are marked
 * as read. The user can dismiss all onboarding notifications at once.
 *
 * This component is a data-only hook + renderer; it injects synthetic
 * notification entries into the notification system without requiring
 * WebSocket or server-side notification infrastructure.
 */
import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import type { Notification } from "@/hooks/useWebSocket";

/** Read guest session events from localStorage */
function getGuestSessionEvents(): { featureKey: string; eventType: string; count: number; durationMs: number; lastUsed: number }[] {
  try {
    const raw = localStorage.getItem("stewardly_guest_events");
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Hook that converts onboarding checklist items into Notification objects.
 * Consumers merge these into the main notification list.
 */
export function useOnboardingNotifications(): {
  notifications: Notification[];
  unreadCount: number;
  dismiss: () => void;
  isDismissed: boolean;
} {
  const { user } = useAuth();
  const isGuest = !user || user.authTier === "anonymous";

  const [isDismissed, setIsDismissed] = useState(() => {
    try { return localStorage.getItem("ai_onboarding_dismissed") === "true"; } catch { return false; }
  });

  // Stabilize guest events
  const [guestEvents] = useState(() => getGuestSessionEvents());

  const checklist = trpc.exponentialEngine.getOnboardingChecklist.useQuery(
    isGuest ? { sessionEvents: guestEvents } : undefined,
    {
      enabled: !isDismissed,
      staleTime: 60_000,
    },
  );

  const dismissMutation = trpc.exponentialEngine.dismissOnboarding.useMutation({
    onSuccess: () => {
      localStorage.setItem("ai_onboarding_dismissed", "true");
      setIsDismissed(true);
    },
  });

  // Check localStorage for dismissal on mount
  useEffect(() => {
    const dismissed = localStorage.getItem("ai_onboarding_dismissed");
    if (dismissed === "true") setIsDismissed(true);
  }, []);

  const dismiss = () => {
    if (isGuest) {
      localStorage.setItem("ai_onboarding_dismissed", "true");
      setIsDismissed(true);
    } else {
      dismissMutation.mutate();
    }
  };

  const notifications = useMemo<Notification[]>(() => {
    if (isDismissed || !checklist.data || checklist.data.length === 0) return [];

    // All completed → don't show anything
    const items = checklist.data;
    const allDone = items.every(i => i.completed);
    if (allDone) return [];

    return items
      .filter(i => !i.completed)
      .map((item, idx) => ({
        id: `onboarding-${item.id}`,
        type: "system" as const,
        priority: idx === 0 ? ("medium" as const) : ("low" as const),
        title: `Getting Started: ${item.title}`,
        body: item.description,
        metadata: {
          onboardingItem: true,
          href: item.href,
          layer: item.layer,
          itemId: item.id,
        },
        createdAt: Date.now() - (items.length - idx) * 60_000, // stagger timestamps
        readAt: null,
      }));
  }, [isDismissed, checklist.data]);

  const unreadCount = notifications.filter(n => !n.readAt).length;

  return { notifications, unreadCount, dismiss, isDismissed };
}
