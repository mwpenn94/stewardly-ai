/**
 * InlineBenchmark — Displays cited industry benchmarks inline with source tooltips.
 *
 * Pass 133: Created to surface the rich benchmark data from industryBenchmarks.ts
 * directly in hub overviews so users see authoritative context alongside their data.
 *
 * Usage:
 *   <InlineBenchmark
 *     label="National Savings Rate"
 *     value="6.2%"
 *     source="BEA Personal Saving Rate 2025"
 *     url="https://fred.stlouisfed.org/series/PSAVERT"
 *     comparison={{ userValue: 0.15, benchmarkValue: 0.062, higherIsBetter: true }}
 *   />
 */
import { useState } from "react";
import { ExternalLink, Info, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ComparisonData {
  userValue: number;
  benchmarkValue: number;
  higherIsBetter: boolean;
}

interface InlineBenchmarkProps {
  label: string;
  value: string;
  source: string;
  url?: string;
  comparison?: ComparisonData;
  className?: string;
}

export function InlineBenchmark({
  label,
  value,
  source,
  url,
  comparison,
  className = "",
}: InlineBenchmarkProps) {
  const [showSource, setShowSource] = useState(false);

  // Compute comparison status
  let compStatus: "above" | "at" | "below" | null = null;
  let compLabel = "";
  if (comparison) {
    const ratio = comparison.benchmarkValue > 0
      ? comparison.userValue / comparison.benchmarkValue
      : 0;
    if (ratio >= 1.1) {
      compStatus = comparison.higherIsBetter ? "above" : "below";
      compLabel = `${((ratio - 1) * 100).toFixed(0)}% above benchmark`;
    } else if (ratio <= 0.9) {
      compStatus = comparison.higherIsBetter ? "below" : "above";
      compLabel = `${((1 - ratio) * 100).toFixed(0)}% below benchmark`;
    } else {
      compStatus = "at";
      compLabel = "At benchmark";
    }
  }

  const statusColors = {
    above: "text-emerald-500",
    at: "text-blue-400",
    below: "text-amber-500",
  };

  const StatusIcon = compStatus === "above" ? TrendingUp
    : compStatus === "below" ? TrendingDown
    : Minus;

  return (
    <div className={`group relative inline-flex items-center gap-1.5 ${className}`}>
      <div className="flex items-center gap-1.5 rounded-md bg-background/60 border border-border/30 px-2 py-1 text-xs">
        <span className="text-muted-foreground">{label}:</span>
        <span className="font-semibold text-foreground">{value}</span>
        {compStatus && (
          <span className={`flex items-center gap-0.5 ${statusColors[compStatus]}`}>
            <StatusIcon className="w-3 h-3" />
            <span className="text-[9px]">{compLabel}</span>
          </span>
        )}
        <button
          type="button"
          onClick={() => setShowSource(!showSource)}
          className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          aria-label={`Source: ${source}`}
        >
          <Info className="w-3 h-3" />
        </button>
      </div>

      {/* Source tooltip */}
      {showSource && (
        <div className="absolute left-0 top-full mt-1 z-50 w-64 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg p-2.5 text-[11px]">
          <p className="font-medium mb-1">Source</p>
          <p className="text-muted-foreground leading-relaxed">{source}</p>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-primary hover:underline"
            >
              View source <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * BenchmarkBar — Compact horizontal bar comparing user value to benchmark.
 * Used in dashboard cards for at-a-glance comparison.
 */
interface BenchmarkBarProps {
  label: string;
  userValue: number;
  benchmarkValue: number;
  format?: "percent" | "currency" | "number";
  source: string;
  higherIsBetter?: boolean;
  className?: string;
}

export function BenchmarkBar({
  label,
  userValue,
  benchmarkValue,
  format = "percent",
  source,
  higherIsBetter = true,
  className = "",
}: BenchmarkBarProps) {
  const maxVal = Math.max(userValue, benchmarkValue) * 1.2 || 1;
  const userPct = (userValue / maxVal) * 100;
  const benchPct = (benchmarkValue / maxVal) * 100;

  const formatVal = (v: number) => {
    if (format === "percent") return `${(v * 100).toFixed(1)}%`;
    if (format === "currency") {
      if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
      if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
      return `$${Math.round(v).toLocaleString()}`;
    }
    return v.toLocaleString();
  };

  const isGood = higherIsBetter ? userValue >= benchmarkValue : userValue <= benchmarkValue;

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">{label}</span>
        <InlineBenchmark
          label="Benchmark"
          value={formatVal(benchmarkValue)}
          source={source}
          comparison={{ userValue, benchmarkValue, higherIsBetter }}
        />
      </div>
      <div className="relative h-2 rounded-full bg-border/30">
        {/* Benchmark marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-muted-foreground/40 z-10"
          style={{ left: `${Math.min(benchPct, 100)}%` }}
        />
        {/* User bar */}
        <div
          className={`h-full rounded-full transition-all ${isGood ? "bg-emerald-500/70" : "bg-amber-500/70"}`}
          style={{ width: `${Math.min(userPct, 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground">
        <span>You: {formatVal(userValue)}</span>
        <span>Benchmark: {formatVal(benchmarkValue)}</span>
      </div>
    </div>
  );
}

/**
 * BenchmarkGrid — Grid of benchmark cards for hub overviews.
 */
interface BenchmarkItem {
  label: string;
  value: string;
  source: string;
  url?: string;
  icon?: React.ElementType;
  status?: "positive" | "neutral" | "warning";
}

interface BenchmarkGridProps {
  title: string;
  items: BenchmarkItem[];
  className?: string;
}

export function BenchmarkGrid({ title, items, className = "" }: BenchmarkGridProps) {
  const [expanded, setExpanded] = useState(false);
  const visibleItems = expanded ? items : items.slice(0, 4);

  return (
    <div className={`rounded-lg border border-border/30 bg-card/30 p-3 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Info className="w-3 h-3" />
          {title}
        </h4>
        {items.length > 4 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-primary hover:underline"
          >
            {expanded ? "Show less" : `+${items.length - 4} more`}
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {visibleItems.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="rounded-md bg-background/50 p-2 text-center group relative"
            >
              {Icon && <Icon className="w-3.5 h-3.5 mx-auto mb-1 text-muted-foreground/60" />}
              <p className="text-[10px] text-muted-foreground leading-tight">{item.label}</p>
              <p className={`text-sm font-bold mt-0.5 ${
                item.status === "positive" ? "text-emerald-400" :
                item.status === "warning" ? "text-amber-400" :
                "text-foreground"
              }`}>
                {item.value}
              </p>
              <p className="text-[8px] text-muted-foreground/50 mt-0.5 line-clamp-1">{item.source}</p>
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-end justify-center pb-1 transition-opacity"
                >
                  <span className="text-[8px] text-primary flex items-center gap-0.5">
                    Source <ExternalLink className="w-2.5 h-2.5" />
                  </span>
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
