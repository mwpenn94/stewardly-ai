/**
 * FeatureCard — Consistent card anatomy: [Badge] → [Title] → [Description] → [CTA].
 * Hover lift + icon animation. Part of the shared component system (Transformation 4).
 */
import { type LucideIcon, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeatureCardProps {
  badge?: string;
  badgeColor?: string;
  title: string;
  description: string;
  cta?: string;
  icon?: LucideIcon;
  onClick?: () => void;
  className?: string;
  /** Compact variant for grid layouts */
  compact?: boolean;
}

export function FeatureCard({
  badge,
  badgeColor = "bg-accent/15 text-accent",
  title,
  description,
  cta,
  icon: Icon,
  onClick,
  className,
  compact = false,
}: FeatureCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group text-left w-full rounded-xl border border-border/60 bg-card/50 transition-all card-lift",
        "hover:border-accent/30 hover:bg-card/80",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        compact ? "p-3" : "p-4",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {Icon && (
          <div
            className={cn(
              "flex items-center justify-center rounded-lg bg-accent/10 shrink-0 transition-transform group-hover:scale-110",
              compact ? "h-8 w-8" : "h-9 w-9",
            )}
          >
            <Icon className={cn("text-accent", compact ? "h-4 w-4" : "h-4.5 w-4.5")} />
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-1">
          {badge && (
            <span
              className={cn(
                "inline-block text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded-full",
                badgeColor,
              )}
            >
              {badge}
            </span>
          )}
          <p className={cn("font-medium text-foreground leading-snug", compact ? "text-xs" : "text-sm")}>
            {title}
          </p>
          <p className={cn("text-muted-foreground leading-relaxed", compact ? "text-[10px]" : "text-xs")}>
            {description}
          </p>
          {cta && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-accent mt-1 group-hover:gap-1 transition-all">
              {cta}
              <ChevronRight className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
