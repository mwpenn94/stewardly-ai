/**
 * AI-Adaptive Onboarding Widget
 * 
 * Powered by the Exponential Engine's 5-layer hierarchy.
 * Shows personalized onboarding actions based on the user's role,
 * active layer, and features they've already explored.
 * 
 * Guest-aware: shows client-layer checklist for guests using
 * localStorage session data. Persisted only for authenticated users.
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import {
  CheckCircle2, Circle, ChevronDown, ChevronUp, X,
  Sparkles, Rocket, ArrowRight, Layers, LogIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const LAYER_COLORS: Record<string, string> = {
  platform: "text-violet-400",
  organization: "text-blue-400",
  manager: "text-emerald-400",
  professional: "text-amber-400",
  client: "text-accent",
};

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

export default function AIOnboardingWidget() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const isGuest = !user || user.authTier === "anonymous";

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

  // Check localStorage for dismissal
  useEffect(() => {
    const dismissed = localStorage.getItem("ai_onboarding_dismissed");
    if (dismissed === "true") setIsDismissed(true);
  }, []);

  // Don't render if dismissed or no data
  if (isDismissed) return null;
  if (!checklist.data || checklist.data.length === 0) return null;

  const items = checklist.data;
  const completedCount = items.filter(i => i.completed).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // If all items are completed, show congratulations
  if (completedCount === totalCount && totalCount > 0) {
    return (
      <div className="mx-3 mb-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
        <div className="flex items-center gap-2 text-emerald-400">
          <Sparkles className="w-4 h-4" />
          <span className="text-sm font-medium">All set! You've explored all recommended features.</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 text-xs text-muted-foreground"
          onClick={() => {
            localStorage.setItem("ai_onboarding_dismissed", "true");
            setIsDismissed(true);
          }}
        >
          Dismiss
        </Button>
      </div>
    );
  }

  const visibleItems = showAll ? items : items.filter(i => !i.completed).slice(0, 5);

  const handleDismiss = () => {
    if (isGuest) {
      // Guest: just dismiss locally
      localStorage.setItem("ai_onboarding_dismissed", "true");
      setIsDismissed(true);
    } else {
      // Authenticated: persist dismissal
      dismissMutation.mutate();
    }
  };

  return (
    <div className="mx-3 mb-3 rounded-xl bg-card/80 border border-border/50 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 p-3 hover:bg-secondary/30 transition-colors"
      >
        <Rocket className="w-4 h-4 text-accent shrink-0" />
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {isGuest ? "Get Started" : "AI Getting Started"}
            </span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {completedCount}/{totalCount}
            </Badge>
            {isGuest && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 text-amber-400 border-amber-500/30">
                Guest
              </Badge>
            )}
          </div>
          {/* Mini progress bar */}
          <div className="h-1 bg-secondary/50 rounded-full mt-1.5 overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span
            role="button"
            tabIndex={0}
            className="inline-flex items-center justify-center w-6 h-6 rounded-md hover:bg-secondary/50 transition-colors cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handleDismiss();
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleDismiss(); } }}
          >
            <X className="w-3 h-3" />
          </span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </button>

      {/* Checklist Items */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-1">
          {visibleItems.map((item) => {
            const layerColor = LAYER_COLORS[item.layer] || "text-muted-foreground";
            const isSignInItem = item.href === "/signin" || item.title.includes("Create an account");

            return (
              <button
                key={item.id}
                onClick={() => {
                  if (isSignInItem) {
                    window.location.href = getLoginUrl();
                  } else {
                    navigate(item.href);
                  }
                }}
                disabled={item.completed}
                className={`w-full flex items-start gap-2.5 p-2 rounded-lg text-left transition-all group ${
                  item.completed
                    ? "opacity-50"
                    : "hover:bg-secondary/30 cursor-pointer"
                }`}
              >
                {item.completed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                ) : isSignInItem ? (
                  <LogIn className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0 group-hover:text-accent transition-colors" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium ${item.completed ? "line-through text-muted-foreground" : isSignInItem ? "text-accent" : "group-hover:text-accent transition-colors"}`}>
                    {item.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0 mt-0.5">
                  <span className={`text-[9px] ${layerColor}`}>
                    <Layers className="w-2.5 h-2.5 inline mr-0.5" />
                    {item.layer}
                  </span>
                  {!item.completed && (
                    <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
              </button>
            );
          })}

          {/* Show more/less toggle */}
          {items.length > 5 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="w-full text-center text-[10px] text-muted-foreground hover:text-accent transition-colors py-1"
            >
              {showAll ? "Show less" : `Show all ${items.length} items`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
