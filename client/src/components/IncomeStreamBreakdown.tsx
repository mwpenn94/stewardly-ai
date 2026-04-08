/**
 * IncomeStreamBreakdown — Stacked bar / donut visualization for BIE income streams.
 * Shows 13 income streams with color coding, percentages, and year-over-year growth.
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface StreamResult {
  income: number;
  label: string;
  [key: string]: any;
}

interface YearResult {
  year: number;
  streams: Record<string, StreamResult>;
  totalIncome: number;
  totalCost: number;
  netIncome: number;
  teamSize: number;
  aum: number;
}

interface Props {
  results: YearResult[];
  title?: string;
  showYearSelector?: boolean;
}

const STREAM_COLORS: Record<string, string> = {
  personal: "#C9A84C",
  expanded: "#D4B96A",
  override: "#16A34A",
  overrideG2: "#22C55E",
  aum: "#3B82F6",
  affA: "#8B5CF6",
  affB: "#A78BFA",
  affC: "#C4B5FD",
  affD: "#DDD6FE",
  channels: "#F59E0B",
  partner: "#EC4899",
  renewal: "#06B6D4",
  bonus: "#EF4444",
};

function fmt(n: number): string {
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export default function IncomeStreamBreakdown({ results, title = "Income Stream Breakdown", showYearSelector = true }: Props) {
  const [selectedYear, setSelectedYear] = useState(1);

  const yearData = useMemo(() => {
    return results.find((r) => r.year === selectedYear) || results[0];
  }, [results, selectedYear]);

  const streams = useMemo(() => {
    if (!yearData) return [];
    return Object.entries(yearData.streams)
      .filter(([, s]) => s.income > 0)
      .sort(([, a], [, b]) => b.income - a.income)
      .map(([key, s]) => ({
        key,
        label: s.label,
        income: s.income,
        color: STREAM_COLORS[key] || "#94A3B8",
        pct: yearData.totalIncome > 0 ? (s.income / yearData.totalIncome) * 100 : 0,
      }));
  }, [yearData]);

  // Stacked bar data for mini chart
  const stackedBars = useMemo(() => {
    const maxYear = Math.min(results.length, 30);
    const sampled = results.filter((_, i) => i < 5 || i % Math.max(1, Math.floor(maxYear / 15)) === 0);
    const maxIncome = Math.max(...sampled.map((r) => r.totalIncome), 1);
    return sampled.map((r) => {
      const segments = Object.entries(r.streams)
        .filter(([, s]) => s.income > 0)
        .map(([key, s]) => ({
          key,
          pct: r.totalIncome > 0 ? (s.income / r.totalIncome) * 100 : 0,
          color: STREAM_COLORS[key] || "#94A3B8",
        }));
      return { year: r.year, totalIncome: r.totalIncome, heightPct: (r.totalIncome / maxIncome) * 100, segments };
    });
  }, [results]);

  if (!yearData) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-8 text-center text-muted-foreground">No data available.</CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          {showYearSelector && results.length > 1 && (
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-[100px] h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {results.map((r) => (
                  <SelectItem key={r.year} value={String(r.year)}>Year {r.year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-secondary/50 rounded-lg p-2.5">
            <p className="text-[10px] text-muted-foreground uppercase">Total Income</p>
            <p className="text-lg font-semibold text-emerald-400 tabular-nums">{fmt(yearData.totalIncome)}</p>
          </div>
          <div className="bg-secondary/50 rounded-lg p-2.5">
            <p className="text-[10px] text-muted-foreground uppercase">Net Income</p>
            <p className="text-lg font-semibold tabular-nums">{fmt(yearData.netIncome)}</p>
          </div>
          <div className="bg-secondary/50 rounded-lg p-2.5">
            <p className="text-[10px] text-muted-foreground uppercase">Team Size</p>
            <p className="text-lg font-semibold tabular-nums">{yearData.teamSize}</p>
          </div>
          <div className="bg-secondary/50 rounded-lg p-2.5">
            <p className="text-[10px] text-muted-foreground uppercase">AUM</p>
            <p className="text-lg font-semibold tabular-nums">{fmt(yearData.aum)}</p>
          </div>
        </div>

        {/* Donut-style breakdown */}
        <div className="space-y-2">
          {streams.map((s) => (
            <div key={s.key} className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs truncate">{s.label}</span>
                  <span className="text-xs font-mono tabular-nums">{fmt(s.income)}</span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${s.pct}%`, backgroundColor: s.color }}
                  />
                </div>
              </div>
              <Badge variant="outline" className="text-[9px] px-1.5 tabular-nums w-[48px] justify-center">
                {s.pct.toFixed(1)}%
              </Badge>
            </div>
          ))}
        </div>

        {/* Mini stacked bar chart */}
        {stackedBars.length > 1 && (
          <div className="pt-2 border-t border-border/30">
            <p className="text-[10px] text-muted-foreground mb-2">Income Growth Over Time</p>
            <div className="flex items-end gap-[3px] h-20">
              {stackedBars.map((bar) => (
                <div
                  key={bar.year}
                  className="flex-1 flex flex-col-reverse rounded-t-sm overflow-hidden cursor-pointer transition-opacity hover:opacity-80"
                  style={{ height: `${bar.heightPct}%` }}
                  onClick={() => setSelectedYear(bar.year)}
                  title={`Year ${bar.year}: ${fmt(bar.totalIncome)}`}
                >
                  {bar.segments.map((seg) => (
                    <div
                      key={seg.key}
                      style={{ height: `${seg.pct}%`, backgroundColor: seg.color }}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-muted-foreground">Yr 1</span>
              <span className="text-[9px] text-muted-foreground">Yr {stackedBars[stackedBars.length - 1]?.year}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
