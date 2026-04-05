/**
 * PropensityGauge — Visual gauge showing lead propensity score (0-100).
 * Uses a semicircular arc with color gradient from red to green.
 */
import { cn } from "@/lib/utils";

interface PropensityGaugeProps {
  score: number; // 0–100
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

function getColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-lime-400";
  if (score >= 40) return "text-amber-400";
  if (score >= 20) return "text-orange-400";
  return "text-red-400";
}

function getStroke(score: number): string {
  if (score >= 80) return "#34d399";
  if (score >= 60) return "#a3e635";
  if (score >= 40) return "#fbbf24";
  if (score >= 20) return "#fb923c";
  return "#f87171";
}

const sizes = { sm: 80, md: 120, lg: 160 } as const;

export function PropensityGauge({ score, label, size = "md", className }: PropensityGaugeProps) {
  const dim = sizes[size];
  const clamped = Math.max(0, Math.min(100, score));
  const radius = dim * 0.38;
  const circumference = Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const fontSize = size === "sm" ? "text-lg" : size === "md" ? "text-2xl" : "text-3xl";
  const labelSize = size === "sm" ? "text-[9px]" : "text-xs";

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <svg width={dim} height={dim * 0.6} viewBox={`0 0 ${dim} ${dim * 0.6}`}>
        {/* Background arc */}
        <path
          d={`M ${dim * 0.1} ${dim * 0.55} A ${radius} ${radius} 0 0 1 ${dim * 0.9} ${dim * 0.55}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={dim * 0.06}
          className="text-muted/30"
          strokeLinecap="round"
        />
        {/* Score arc */}
        <path
          d={`M ${dim * 0.1} ${dim * 0.55} A ${radius} ${radius} 0 0 1 ${dim * 0.9} ${dim * 0.55}`}
          fill="none"
          stroke={getStroke(clamped)}
          strokeWidth={dim * 0.06}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="flex flex-col items-center -mt-2">
        <span className={cn("font-bold tabular-nums", fontSize, getColor(clamped))}>{clamped}</span>
        {label && <span className={cn("text-muted-foreground mt-0.5", labelSize)}>{label}</span>}
      </div>
    </div>
  );
}
