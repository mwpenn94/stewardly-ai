/**
 * StressTestPanel — Visualize stress scenarios and historical backtesting.
 * Shows scenario paths, drawdowns, recovery times, and survival rates.
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, BarChart3 } from "lucide-react";

interface StressResult {
  scenario: { name: string; description: string; years: number[]; returns: number[] };
  path: number[];
  finalBalance: number;
  maxDrawdown: number;
  recoveryYears: number;
}

interface BacktestSummary {
  survivalRate: number;
  survived: number;
  total: number;
  worst: { year: number; final: number; min: number };
  best: { year: number; final: number };
  medianFinal: number;
}

interface Props {
  stressResults?: Record<string, StressResult | null>;
  backtestSummary?: BacktestSummary | null;
  startBalance: number;
  title?: string;
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

const SCENARIO_COLORS: Record<string, string> = {
  dotcom: "#EF4444",
  gfc: "#F59E0B",
  covid: "#8B5CF6",
};

export default function StressTestPanel({ stressResults, backtestSummary, startBalance, title = "Stress Testing & Historical Analysis" }: Props) {
  const [activeScenario, setActiveScenario] = useState<string | null>(null);

  const scenarios = useMemo(() => {
    if (!stressResults) return [];
    return Object.entries(stressResults)
      .filter(([, r]) => r !== null)
      .map(([key, r]) => ({ key, ...r! }));
  }, [stressResults]);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        <CardDescription className="text-xs">How would your portfolio perform in historical market crashes?</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Scenario Cards */}
        {scenarios.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {scenarios.map((s) => (
              <div
                key={s.key}
                className={`bg-secondary/50 rounded-lg p-3 cursor-pointer transition-all border ${activeScenario === s.key ? "border-accent" : "border-transparent"}`}
                onClick={() => setActiveScenario(activeScenario === s.key ? null : s.key)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: SCENARIO_COLORS[s.key] }}>
                    {s.scenario.name}
                  </span>
                  <Badge variant="outline" className="text-[9px]">
                    {s.scenario.years[0]}-{s.scenario.years[s.scenario.years.length - 1]}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <p className="text-muted-foreground">Max Drawdown</p>
                    <p className="font-semibold text-red-400 tabular-nums">{pct(s.maxDrawdown)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Recovery</p>
                    <p className="font-semibold tabular-nums">{s.recoveryYears} yrs</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Start</p>
                    <p className="font-semibold tabular-nums">{fmt(s.path[0])}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">End</p>
                    <p className={`font-semibold tabular-nums ${s.finalBalance >= s.path[0] ? "text-emerald-400" : "text-red-400"}`}>
                      {fmt(s.finalBalance)}
                    </p>
                  </div>
                </div>

                {/* Mini path chart */}
                <div className="flex items-end gap-[2px] h-10 mt-2">
                  {s.path.map((val, i) => {
                    const max = Math.max(...s.path);
                    const h = max > 0 ? (val / max) * 100 : 0;
                    return (
                      <div
                        key={i}
                        className="flex-1 rounded-t-sm transition-all"
                        style={{
                          height: `${Math.max(2, h)}%`,
                          backgroundColor: val < s.path[0] ? SCENARIO_COLORS[s.key] : "#22C55E",
                          opacity: 0.7,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Active scenario detail */}
        {activeScenario && stressResults?.[activeScenario] && (
          <div className="bg-secondary/30 rounded-lg p-3 text-xs">
            <p className="text-muted-foreground mb-1">{stressResults[activeScenario]!.scenario.description}</p>
            <div className="flex gap-4 mt-2">
              {stressResults[activeScenario]!.scenario.returns.map((ret, i) => (
                <div key={i} className="text-center">
                  <p className="text-[10px] text-muted-foreground">{stressResults[activeScenario]!.scenario.years[i]}</p>
                  <p className={`font-mono tabular-nums ${ret >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {ret >= 0 ? "+" : ""}{(ret * 100).toFixed(1)}%
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Historical Backtest Summary */}
        {backtestSummary && (
          <div className="border-t border-border/30 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium">Historical Backtest (1928-2025)</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-secondary/50 rounded-lg p-2.5">
                <p className="text-[10px] text-muted-foreground uppercase">Survival Rate</p>
                <p className={`text-lg font-semibold tabular-nums ${backtestSummary.survivalRate >= 0.9 ? "text-emerald-400" : backtestSummary.survivalRate >= 0.7 ? "text-amber-400" : "text-red-400"}`}>
                  {pct(backtestSummary.survivalRate)}
                </p>
                <p className="text-[9px] text-muted-foreground">{backtestSummary.survived}/{backtestSummary.total} periods</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-2.5">
                <p className="text-[10px] text-muted-foreground uppercase">Median Final</p>
                <p className="text-lg font-semibold tabular-nums text-foreground">{fmt(backtestSummary.medianFinal)}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-2.5">
                <p className="text-[10px] text-muted-foreground uppercase">Best Case</p>
                <p className="text-lg font-semibold tabular-nums text-emerald-400">{fmt(backtestSummary.best.final)}</p>
                <p className="text-[9px] text-muted-foreground">Started {backtestSummary.best.year}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-2.5">
                <p className="text-[10px] text-muted-foreground uppercase">Worst Case</p>
                <p className="text-lg font-semibold tabular-nums text-red-400">{fmt(backtestSummary.worst.final)}</p>
                <p className="text-[9px] text-muted-foreground">Started {backtestSummary.worst.year}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-2.5">
                <p className="text-[10px] text-muted-foreground uppercase">Worst Min</p>
                <p className="text-lg font-semibold tabular-nums text-red-400">{fmt(backtestSummary.worst.min)}</p>
                <p className="text-[9px] text-muted-foreground">Lowest balance</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
