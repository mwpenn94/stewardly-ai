/**
 * useExponentialTracking
 * 
 * Frontend hook that automatically tracks user platform interactions
 * for the Exponential Engine. Tracks:
 * - Page visits (with time spent)
 * - Feature usage (button clicks, form submissions)
 * - Navigation patterns
 * 
 * All tracking is non-blocking and fails silently.
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
};

// Generate a session ID for this browser tab
const SESSION_ID = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * Hook to automatically track page visits.
 * Place this in a top-level layout component.
 */
export function usePageTracking() {
  const [location] = useLocation();
  const { user } = useAuth();
  const trackMutation = trpc.exponentialEngine.trackEvent.useMutation();
  const lastTrackedRef = useRef<string>("");
  const pageEntryRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!user) return;

    // Track time spent on previous page
    const prevFeature = lastTrackedRef.current;
    if (prevFeature) {
      const durationMs = Date.now() - pageEntryRef.current;
      if (durationMs > 2000) {
        // Only track if they spent more than 2 seconds
        trackMutation.mutate({
          eventType: "page_duration",
          featureKey: prevFeature,
          metadata: { duration_ms: durationMs },
          sessionId: SESSION_ID,
        });
      }
    }

    // Track new page visit
    const featureKey = resolveFeatureKey(location);
    if (featureKey) {
      lastTrackedRef.current = featureKey;
      pageEntryRef.current = Date.now();
      trackMutation.mutate({
        eventType: "page_visit",
        featureKey,
        metadata: { path: location },
        sessionId: SESSION_ID,
      });
    }
  }, [location, user]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Hook to track specific feature interactions.
 * Returns a trackFeature function to call on user actions.
 */
export function useFeatureTracking() {
  const { user } = useAuth();
  const trackMutation = trpc.exponentialEngine.trackEvent.useMutation();

  const trackFeature = useCallback(
    (featureKey: string, eventType: string = "feature_use", metadata?: Record<string, unknown>) => {
      if (!user) return;
      trackMutation.mutate({
        eventType,
        featureKey,
        metadata: metadata || {},
        sessionId: SESSION_ID,
      });
    },
    [user, trackMutation]
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
