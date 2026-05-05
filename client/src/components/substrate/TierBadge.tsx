/**
 * TierBadge — Compact inline indicator showing which AI model/tier was used.
 *
 * Displays a colored dot (tier indicator) + model name + tooltip with routing reason.
 * Absorbed from manus-next-app AdaptiveModelBadge with Stewardly adaptations.
 *
 * @substrate-ui: tier-badge
 */
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Zap, Brain, Sparkles, Shield } from "lucide-react";

// ─── Tier Definitions ────────────────────────────────────────────────────────

type RoutingTier = "LOCAL" | "AUTO" | "CLOUD";
type CostTier = "economy" | "standard" | "premium" | "reasoning";

const TIER_CONFIG: Record<CostTier, { color: string; icon: typeof Zap; label: string }> = {
  economy: { color: "bg-green-500", icon: Zap, label: "Fast" },
  standard: { color: "bg-blue-500", icon: Brain, label: "Balanced" },
  premium: { color: "bg-purple-500", icon: Sparkles, label: "Powerful" },
  reasoning: { color: "bg-amber-500", icon: Brain, label: "Reasoning" },
};

const ROUTING_TIER_CONFIG: Record<RoutingTier, { color: string; label: string }> = {
  LOCAL: { color: "text-green-400", label: "Local" },
  AUTO: { color: "text-blue-400", label: "Auto" },
  CLOUD: { color: "text-purple-400", label: "Cloud" },
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface TierBadgeProps {
  /** The model name that was used */
  model?: string;
  /** Cost tier (economy/standard/premium/reasoning) */
  costTier?: CostTier;
  /** Routing tier (LOCAL/AUTO/CLOUD) */
  routingTier?: RoutingTier;
  /** Why this model was selected */
  reason?: string;
  /** Inference latency in ms */
  latencyMs?: number;
  /** Whether this was a BYO provider */
  isBYO?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TierBadge({
  model,
  costTier = "standard",
  routingTier = "CLOUD",
  reason,
  latencyMs,
  isBYO = false,
  className,
}: TierBadgeProps) {
  const tier = TIER_CONFIG[costTier];
  const routing = ROUTING_TIER_CONFIG[routingTier];
  const Icon = tier.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full",
              "bg-muted/50 border border-border/50 text-xs font-medium",
              "cursor-default select-none",
              className
            )}
          >
            {/* Tier dot */}
            <span className={cn("w-1.5 h-1.5 rounded-full", tier.color)} />

            {/* Model name (truncated) */}
            <span className="text-muted-foreground max-w-[100px] truncate">
              {model ?? tier.label}
            </span>

            {/* BYO indicator */}
            {isBYO && (
              <Shield className="w-3 h-3 text-green-400" />
            )}
          </motion.div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[250px]">
          <div className="space-y-1 text-xs">
            <div className="font-medium">{model ?? "AI Model"}</div>
            <div className="text-muted-foreground">
              <span className={routing.color}>{routing.label}</span>
              {" · "}
              {tier.label}
              {isBYO && " · BYO"}
            </div>
            {reason && (
              <div className="text-muted-foreground italic">{reason}</div>
            )}
            {latencyMs !== undefined && (
              <div className="text-muted-foreground">{latencyMs}ms</div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default TierBadge;
