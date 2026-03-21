/**
 * useExponentialTracking
 * 
 * Frontend hook that automatically tracks user platform interactions
 * for the Exponential Engine. Tracks:
 * - Page visits (with time spent)
 * - Feature usage (button clicks, form submissions)
 * - Navigation patterns
 * 
 * Guest-aware: For authenticated users, events are sent to the server.
 * For guests, events are stored in localStorage so the proficiency
 * dashboard and onboarding widget can show session-based progress.
 * When a guest signs in, their localStorage events are flushed to the server.
 */

import { useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

// Map route paths to feature keys
const ROUTE_FEATURE_MAP: Record<string, string> = {
  "/chat": "chat",
  "/operations": "operations_hub",
  "/intelligence-hub": "intelligence_hub",
  "/advisory": "advisory_hub",
  "/relationships": "relationships_hub",
  "/integrations": "integrations",
  "/settings": "ai_settings",
  "/documents": "documents",
  "/market-data": "intelligence_hub",
  "/portal": "intelligence_hub",
  "/organizations": "admin_organizations",
  "/proficiency": "proficiency_dashboard",
  "/calculators": "calculators",
  "/products": "products",
  "/improvement": "improvement_engine",
};

// Generate a session ID for this browser tab
const SESSION_ID = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const GUEST_EVENTS_KEY = "stewardly_guest_events";

/** Shape of a guest event stored in localStorage */
interface GuestEvent {
  featureKey: string;
  eventType: string;
  count: number;
  durationMs: number;
  lastUsed: number;
}

/** Read guest events from localStorage */
function readGuestEvents(): GuestEvent[] {
  try {
    const raw = localStorage.getItem(GUEST_EVENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Write guest events to localStorage */
function writeGuestEvents(events: GuestEvent[]) {
  try {
    localStorage.setItem(GUEST_EVENTS_KEY, JSON.stringify(events));
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

/** Track a guest event in localStorage (aggregated by featureKey + eventType) */
function trackGuestEvent(featureKey: string, eventType: string, durationMs = 0) {
  const events = readGuestEvents();
  const existing = events.find(e => e.featureKey === featureKey && e.eventType === eventType);
  if (existing) {
    existing.count += 1;
    existing.durationMs += durationMs;
    existing.lastUsed = Date.now();
  } else {
    events.push({
      featureKey,
      eventType,
      count: 1,
      durationMs,
      lastUsed: Date.now(),
    });
  }
  writeGuestEvents(events);
}

/**
 * Hook to automatically track page visits.
 * Place this in a top-level layout component.
 * Works for both authenticated users (server) and guests (localStorage).
 */
export function usePageTracking() {
  const [location] = useLocation();
  const { user } = useAuth();
  const isGuest = !user || user.authTier === "anonymous";
  const trackMutation = trpc.exponentialEngine.trackEvent.useMutation();
  const batchMutation = trpc.exponentialEngine.trackBatch.useMutation();
  const lastTrackedRef = useRef<string>("");
  const pageEntryRef = useRef<number>(Date.now());
  const flushedRef = useRef(false);

  // Flush guest events to server when user signs in
  useEffect(() => {
    if (!isGuest && !flushedRef.current) {
      flushedRef.current = true;
      const guestEvents = readGuestEvents();
      if (guestEvents.length > 0) {
        // Send accumulated guest events to server
        const batch = guestEvents.map(e => ({
          eventType: e.eventType,
          featureKey: e.featureKey,
          metadata: { guest_count: e.count, guest_duration_ms: e.durationMs, flushed_from_guest: true },
          sessionId: SESSION_ID,
        }));
        batchMutation.mutate({ events: batch });
        // Clear guest events after flush
        localStorage.removeItem(GUEST_EVENTS_KEY);
      }
    }
  }, [isGuest]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Track time spent on previous page
    const prevFeature = lastTrackedRef.current;
    if (prevFeature) {
      const durationMs = Date.now() - pageEntryRef.current;
      if (durationMs > 2000) {
        if (isGuest) {
          trackGuestEvent(prevFeature, "page_duration", durationMs);
        } else {
          trackMutation.mutate({
            eventType: "page_duration",
            featureKey: prevFeature,
            metadata: { duration_ms: durationMs },
            sessionId: SESSION_ID,
          });
        }
      }
    }

    // Track new page visit
    const featureKey = resolveFeatureKey(location);
    if (featureKey) {
      lastTrackedRef.current = featureKey;
      pageEntryRef.current = Date.now();
      if (isGuest) {
        trackGuestEvent(featureKey, "page_visit");
      } else {
        trackMutation.mutate({
          eventType: "page_visit",
          featureKey,
          metadata: { path: location },
          sessionId: SESSION_ID,
        });
      }
    }
  }, [location, isGuest]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Hook to track specific feature interactions.
 * Returns a trackFeature function to call on user actions.
 * Works for both authenticated users and guests.
 */
export function useFeatureTracking() {
  const { user } = useAuth();
  const isGuest = !user || user.authTier === "anonymous";
  const trackMutation = trpc.exponentialEngine.trackEvent.useMutation();

  const trackFeature = useCallback(
    (featureKey: string, eventType: string = "feature_use", metadata?: Record<string, unknown>) => {
      if (isGuest) {
        trackGuestEvent(featureKey, eventType);
      } else {
        trackMutation.mutate({
          eventType,
          featureKey,
          metadata: metadata || {},
          sessionId: SESSION_ID,
        });
      }
    },
    [isGuest, trackMutation]
  );

  return { trackFeature };
}

/**
 * Resolve a URL path to a feature key.
 */
function resolveFeatureKey(path: string): string | null {
  // Exact match
  if (ROUTE_FEATURE_MAP[path]) return ROUTE_FEATURE_MAP[path];

  // Prefix match (e.g., /settings/ai → ai_settings)
  for (const [route, key] of Object.entries(ROUTE_FEATURE_MAP)) {
    if (path.startsWith(route)) return key;
  }

  return null;
}
