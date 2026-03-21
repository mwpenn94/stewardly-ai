/**
 * SelfDiscoveryBubble — Appears in the chat when the AI generates a follow-up
 * exploration query after user inactivity. Animated, dismissible, and clickable.
 */

import { useState } from "react";
import {
  Sparkles,
  ArrowRight,
  X,
  ChevronDown,
  ChevronUp,
  Compass,
  Telescope,
  Wrench,
} from "lucide-react";

interface SelfDiscoveryBubbleProps {
  query: string;
  direction: string;
  reasoning: string;
  relatedFeatures: string[];
  isLoading: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}

const directionConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  deeper: {
    icon: <Telescope className="w-3.5 h-3.5" />,
    label: "Go Deeper",
    color: "text-blue-400",
  },
  broader: {
    icon: <Compass className="w-3.5 h-3.5" />,
    label: "Explore Broader",
    color: "text-emerald-400",
  },
  applied: {
    icon: <Wrench className="w-3.5 h-3.5" />,
    label: "Apply It",
    color: "text-amber-400",
  },
};

export function SelfDiscoveryBubble({
  query,
  direction,
  reasoning,
  relatedFeatures,
  isLoading,
  onAccept,
  onDismiss,
}: SelfDiscoveryBubbleProps) {
  const [showDetails, setShowDetails] = useState(false);
  const config = directionConfig[direction] || directionConfig.deeper;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 mx-4 mb-3 rounded-xl bg-primary/[0.04] border border-primary/10 animate-pulse">
        <Sparkles className="w-4 h-4 text-primary/50 animate-spin" />
        <span className="text-xs text-muted-foreground">
          Generating a follow-up exploration for you...
        </span>
      </div>
    );
  }

  return (
    <div className="mx-4 mb-3 animate-in slide-in-from-bottom-2 fade-in duration-500">
      <div className="rounded-xl border border-primary/15 bg-gradient-to-r from-primary/[0.04] to-primary/[0.02] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-1">
          <Sparkles className="w-3.5 h-3.5 text-primary/60" />
          <span className="text-[10px] font-medium text-primary/60 uppercase tracking-wider">
            Self-Discovery
          </span>
          <span className={`flex items-center gap-1 text-[10px] ${config.color}`}>
            {config.icon}
            {config.label}
          </span>
          <div className="flex-1" />
          <button
            onClick={onDismiss}
            className="p-1 rounded-md hover:bg-muted/50 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            aria-label="Dismiss suggestion"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Query — clickable */}
        <button
          onClick={onAccept}
          className="w-full text-left group px-4 py-2.5 flex items-center gap-3 hover:bg-primary/[0.03] transition-colors"
        >
          <p className="text-sm text-foreground/90 flex-1 leading-relaxed">
            {query}
          </p>
          <ArrowRight className="w-4 h-4 text-primary/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
        </button>

        {/* Expandable details */}
        {(reasoning || relatedFeatures.length > 0) && (
          <div className="px-4 pb-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              {showDetails ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
              {showDetails ? "Hide" : "Why this?"}
            </button>
            {showDetails && (
              <div className="mt-1.5 space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                {reasoning && (
                  <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                    {reasoning}
                  </p>
                )}
                {relatedFeatures.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-muted-foreground/40">Related:</span>
                    {relatedFeatures.map((f) => (
                      <span
                        key={f}
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground/60"
                      >
                        {f.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
