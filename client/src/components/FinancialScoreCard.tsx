/**
 * FinancialScoreCard — Displays a financial metric with trend indicator.
 * Used in dashboards for KPIs like AUM, revenue, client count, etc.
 */
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FinancialScoreCardProps {
  title: string;
  value: string | number;
  previousValue?: number;
  format?: "currency" | "percent" | "number" | "raw";
  icon?: LucideIcon;
  trend?: "up" | "down" | "flat";
  trendValue?: string;
  className?: string;
}

function formatValue(value: string | number, format: string): string {
  if (typeof value === "string") return value;
  switch (format) {
    case "currency":
      return value >= 1_000_000
        ? `$${(value / 1_000_000).toFixed(1)}M`
        : value >= 1_000
          ? `$${(value / 1_000).toFixed(1)}K`
          : `$${value.toLocaleString()}`;
    case "percent":
      return `${value.toFixed(1)}%`;
    case "number":
      return value.toLocaleString();
    default:
      return String(value);
  }
}

export function FinancialScoreCard({
  title, value, format = "raw", icon: Icon, trend, trendValue, className,
}: FinancialScoreCardProps) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-muted-foreground";

  return (
    <Card className={cn("hover:border-accent/30 hover:shadow-[0_0_12px_-4px_oklch(0.76_0.14_80_/_0.08)] transition-all", className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold tabular-nums">{formatValue(value, format)}</p>
          </div>
          {Icon && (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10">
              <Icon className="h-4.5 w-4.5 text-accent" />
            </div>
          )}
        </div>
        {trend && (
          <div className={cn("flex items-center gap-1 mt-2 text-xs", trendColor)}>
            <TrendIcon className="h-3.5 w-3.5" />
            <span className="font-medium">{trendValue ?? trend}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
