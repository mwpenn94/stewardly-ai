/**
 * StatTile — Animated stat display with counting animation on mount.
 * Shows a number that ticks up, optional trend arrow, optional sparkline.
 * Part of the shared component system (Transformation 4).
 */
import { useEffect, useRef, useState } from "react";
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
  format?: "number" | "percent" | "compact";
  trend?: "up" | "down" | "flat";
  trendLabel?: string;
  icon?: LucideIcon;
  className?: string;
  /** If true, animate the number counting up on mount */
  animate?: boolean;
  /** Smaller variant for inline use */
  compact?: boolean;
}

function formatStat(value: number, format: string): string {
  switch (format) {
    case "percent":
      return `${Math.round(value)}%`;
    case "compact":
      if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
      if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
      return value.toLocaleString();
    default:
      return value.toLocaleString();
  }
}

export function StatTile({
  label,
  value,
  suffix,
  prefix,
  format = "number",
  trend,
  trendLabel,
  icon: Icon,
  className,
  animate = true,
  compact = false,
}: StatTileProps) {
  const [displayValue, setDisplayValue] = useState(animate ? 0 : value);
  const mounted = useRef(false);

  useEffect(() => {
    if (!animate || mounted.current) return;
    mounted.current = true;
    if (value === 0) { setDisplayValue(0); return; }

    const duration = 800; // ms
    const steps = 30;
    const stepDuration = duration / steps;
    let current = 0;
    const increment = value / steps;

    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.round(current));
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [value, animate]);

  // Update display when value changes after initial mount
  useEffect(() => {
    if (mounted.current) setDisplayValue(value);
  }, [value]);

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-muted-foreground";

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {Icon && <Icon className="w-3.5 h-3.5 text-accent/70" />}
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {prefix}{formatStat(displayValue, format)}{suffix}
          </span>
          <span className="text-[10px] text-muted-foreground">{label}</span>
        </div>
        {trend && (
          <TrendIcon className={cn("w-3 h-3", trendColor)} />
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card/50 p-3 transition-all hover:border-accent/30 hover:bg-card/80",
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
            {label}
          </p>
          <p className="text-xl font-bold tabular-nums text-foreground">
            {prefix}{formatStat(displayValue, format)}{suffix}
          </p>
        </div>
        {Icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
            <Icon className="h-4 w-4 text-accent" />
          </div>
        )}
      </div>
      {trend && (
        <div className={cn("flex items-center gap-1 mt-1.5 text-[10px]", trendColor)}>
          <TrendIcon className="h-3 w-3" />
          <span className="font-medium">{trendLabel ?? trend}</span>
        </div>
      )}
    </div>
  );
}
