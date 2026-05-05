/**
 * SovereignModeIndicator — Shows the active sovereignty tier (S1-S4)
 * in the chat header. Absorbed from manus-next-app sovereign mode pattern.
 *
 * Visual language: frosted glass surface, subtle pulse when routing through
 * external provider, color-coded by tier.
 */
import { Shield, Zap, Server, Brain } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type SovereignTier = "S1" | "S2" | "S3" | "S4";

interface SovereignModeIndicatorProps {
  tier: SovereignTier;
  providerName?: string;
  isRouting?: boolean;
  className?: string;
}

const TIER_CONFIG: Record<SovereignTier, {
  icon: typeof Shield;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  S1: {
    icon: Shield,
    label: "Platform",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
  },
  S2: {
    icon: Zap,
    label: "Managed BYO",
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/20",
  },
  S3: {
    icon: Server,
    label: "Self-Hosted",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
  },
  S4: {
    icon: Brain,
    label: "Air-Gapped",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/20",
  },
};

export function SovereignModeIndicator({
  tier,
  providerName,
  isRouting = false,
  className = "",
}: SovereignModeIndicatorProps) {
  const config = TIER_CONFIG[tier] ?? TIER_CONFIG.S1;
  if (!config) return null;
  const Icon = config.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`
            inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium
            glass-surface border transition-all duration-300
            ${config.bgColor} ${config.borderColor} ${config.color}
            ${isRouting ? "animate-pulse" : ""}
            ${className}
          `}
        >
          <Icon className="w-3 h-3" />
          <span>{tier}</span>
          {providerName && (
            <span className="text-muted-foreground/70 hidden sm:inline">
              · {providerName}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        <p className="font-medium">{config.label} Mode</p>
        {providerName && <p className="text-muted-foreground">via {providerName}</p>}
        {isRouting && <p className="text-primary">Routing request...</p>}
      </TooltipContent>
    </Tooltip>
  );
}
