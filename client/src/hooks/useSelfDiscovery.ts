/**
 * useSelfDiscovery — Frontend hook for the Continuous Self-Discovery Loop
 *
 * Detects user inactivity after an AI response and triggers the self-discovery
 * engine to generate a personalized follow-up exploration query. Manages the
 * full lifecycle: idle detection → trigger → display → engagement/dismissal.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

export interface DiscoveryState {
  /** Whether a discovery suggestion is currently visible */
  isVisible: boolean;
  /** The generated follow-up query */
  query: string;
  /** Direction of the discovery (deeper/broader/applied) */
  direction: string;
  /** Brief reasoning for why this was suggested */
  reasoning: string;
  /** Related platform feature keys */
  relatedFeatures: string[];
  /** Database ID for tracking engagement */
  discoveryId: number | null;
  /** Whether the discovery is currently being generated */
  isLoading: boolean;
}

const INITIAL_STATE: DiscoveryState = {
  isVisible: false,
  query: "",
  direction: "",
  reasoning: "",
  relatedFeatures: [],
  discoveryId: null,
  isLoading: false,
};

interface UseSelfDiscoveryOptions {
  /** Current conversation ID */
  conversationId: number | null;
  /** Whether the chat is currently streaming a response */
  isStreaming: boolean;
  /** The last user message text */
  lastUserQuery: string;
  /** The last AI response text */
  lastAiResponse: string;
  /** The last AI message ID (for trigger tracking) */
  lastAiMessageId?: number;
  /** Callback when user clicks the discovery query to send it */
  onSendQuery: (query: string) => void;
}

export function useSelfDiscovery({
  conversationId,
  isStreaming,
  lastUserQuery,
  lastAiResponse,
  lastAiMessageId,
  onSendQuery,
}: UseSelfDiscoveryOptions) {
  const { user } = useAuth();
  const [state, setState] = useState<DiscoveryState>(INITIAL_STATE);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTriggeredForRef = useRef<string>("");
  const activityRef = useRef<number>(Date.now());

  // Fetch settings (only for authenticated users)
  const settingsQuery = trpc.selfDiscovery.getSettings.useQuery(undefined, {
    enabled: !!user && user.authTier !== "anonymous",
    staleTime: 60000,
  });

  const triggerMutation = trpc.selfDiscovery.trigger.useMutation();
  const engageMutation = trpc.selfDiscovery.engage.useMutation();

  const settings = settingsQuery.data;
  const isEnabled = settings?.enabled ?? false;
  const idleThreshold = settings?.idleThresholdMs ?? 120000;

  // Track user activity (resets idle timer)
  const recordActivity = useCallback(() => {
    activityRef.current = Date.now();
  }, []);

  // Listen for user activity events
  useEffect(() => {
    const events = ["keydown", "mousedown", "touchstart", "scroll"];
    events.forEach(e => window.addEventListener(e, recordActivity, { passive: true }));
    return () => {
      events.forEach(e => window.removeEventListener(e, recordActivity));
    };
  }, [recordActivity]);

  // Clear idle timer on unmount
  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  // Main idle detection loop: after AI finishes streaming, start watching for inactivity
  useEffect(() => {
    // Guard: only trigger for authenticated users with feature enabled
    if (!user || user.authTier === "anonymous") return;
    if (!isEnabled) return;
    if (!conversationId) return;
    if (isStreaming) return;
    if (!lastUserQuery || !lastAiResponse) return;

    // Prevent double-triggering for the same response
    const triggerKey = `${conversationId}-${lastAiMessageId || lastAiResponse.substring(0, 50)}`;
    if (lastTriggeredForRef.current === triggerKey) return;

    // Clear any existing timer
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

    // Start idle detection
    const checkIdle = () => {
      const timeSinceActivity = Date.now() - activityRef.current;
      if (timeSinceActivity >= idleThreshold) {
        // User has been idle long enough — trigger discovery
        lastTriggeredForRef.current = triggerKey;
        triggerDiscovery();
      } else {
        // Check again after remaining idle time
        const remaining = idleThreshold - timeSinceActivity;
        idleTimerRef.current = setTimeout(checkIdle, Math.min(remaining + 500, 10000));
      }
    };

    // Start checking after a short delay (let the response settle)
    idleTimerRef.current = setTimeout(checkIdle, Math.min(idleThreshold, 10000));

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [user, isEnabled, conversationId, isStreaming, lastUserQuery, lastAiResponse, lastAiMessageId, idleThreshold]);

  // Trigger the self-discovery generation
  const triggerDiscovery = useCallback(async () => {
    if (!conversationId || !lastUserQuery || !lastAiResponse) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const result = await triggerMutation.mutateAsync({
        conversationId,
        lastUserQuery,
        lastAiResponse,
        triggerMessageId: lastAiMessageId,
      });

      if (result.triggered) {
        setState({
          isVisible: true,
          query: result.query,
          direction: result.direction,
          reasoning: result.reasoning,
          relatedFeatures: result.relatedFeatures,
          discoveryId: result.id,
          isLoading: false,
        });
      } else {
        setState(INITIAL_STATE);
      }
    } catch (err) {
      console.error("[SelfDiscovery] Trigger failed:", err);
      setState(INITIAL_STATE);
    }
  }, [conversationId, lastUserQuery, lastAiResponse, lastAiMessageId, triggerMutation]);

  // User clicks the discovery query → send it as their next message
  const acceptDiscovery = useCallback(() => {
    if (state.discoveryId) {
      engageMutation.mutate({ discoveryId: state.discoveryId, engaged: true });
    }
    const query = state.query;
    setState(INITIAL_STATE);
    onSendQuery(query);
  }, [state, engageMutation, onSendQuery]);

  // User dismisses the discovery suggestion
  const dismissDiscovery = useCallback(() => {
    if (state.discoveryId) {
      engageMutation.mutate({ discoveryId: state.discoveryId, engaged: false });
    }
    setState(INITIAL_STATE);
  }, [state, engageMutation]);

  // Reset state (e.g., when conversation changes)
  const reset = useCallback(() => {
    setState(INITIAL_STATE);
    lastTriggeredForRef.current = "";
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
  }, []);

  return {
    ...state,
    acceptDiscovery,
    dismissDiscovery,
    reset,
    settings,
    isEnabled,
  };
}
