/**
 * Reference Hub — standalone page for product references, benchmarks,
 * methodology disclosures, S&P 500 history, guardrails, and historical backtest.
 *
 * Now wired to live backend data via wealthEngine tRPC queries (migrated from calculatorEngine in CBL28).
 */

import { useState, useMemo } from "react";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BookOpen, Shield, TrendingUp, Scale, BarChart3, AlertTriangle,
  ChevronDown, ChevronUp, Loader2, Play, ArrowUpDown,
} from "lucide-react";
import ProductReferencePanel from "@/components/ProductReferencePanel";
import StressTestPanel from "@/components/StressTestPanel";
import { sendFeedback } from "@/lib/feedbackSpecs";

/* ── helpers ──────────────────────────────────────────────────── */

const fmt = (n: number) => {
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

type SortKey = "year" | "return";
type SortDir = "asc" | "desc";

/* ── component ────────────────────────────────────────────────── */

export default function ReferenceHub() {
  const { data: references } = trpc.wealthEngine.productReferences.useQuery(undefined, { retry: false, staleTime: 5 * 60_000 });
  const { data: benchmarks } = trpc.wealthEngine.industryBenchmarks.useQuery(undefined, { retry: false, staleTime: 5 * 60_000 });
  const { data: methodology } = trpc.wealthEngine.methodology.useQuery(undefined, { retry: false, staleTime: 5 * 60_000 });
  const { data: sp500Raw } = trpc.wealthEngine.sp500History.useQuery(undefined, { retry: false, staleTime: 5 * 60_000 });
  const { data: guardrails } = trpc.wealthEngine.checkGuardrails.useQuery(
    { params: { returnRate: 0.07, savingsRate: 0.15 } },
    { retry: false, staleTime: 5 * 60_000 },
  );

  const [showGuardrails, setShowGuardrails] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showBacktest, setShowBacktest] = useState(false);

  // S&P 500 history table state
  const [sortKey, setSortKey] = useState<SortKey>("year");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [decadeFilter, setDecadeFilter] = useState<string>("all");

  // Backtest inputs
  const [btBalance, setBtBalance] = useState(100000);
  const [btContrib, setBtContrib] = useState(12000);
  const [btHorizon, setBtHorizon] = useState(30);

  const backtest = trpc.wealthEngine.historicalBacktest.useMutation({
    onSuccess: () => sendFeedback("calculator.result"),
  });
  const stressDotcom = trpc.wealthEngine.stressTest.useMutation({ onError: (e) => toast.error(e.message) });
  const stressGFC = trpc.wealthEngine.stressTest.useMutation({ onError: (e) => toast.error(e.message) });
  const stressCovid = trpc.wealthEngine.stressTest.useMutation({ onError: (e) => toast.error(e.message) });

  const runBacktest = () => {
    const input = { startBalance: btBalance, annualContribution: btContrib };
    backtest.mutate({ ...input, annualCost: 0, horizon: btHorizon });
    stressDotcom.mutate({ ...input, scenarioKey: "dotcom" });
    stressGFC.mutate({ ...input, scenarioKey: "gfc" });
    stressCovid.mutate({ ...input, scenarioKey: "covid" });
  };

  // S&P 500 data processing
  const sp500Data = useMemo(() => {
    if (!sp500Raw) return [];
    return sp500Raw as { year: number; return: number }[];
  }, [sp500Raw]);

  const decades = useMemo(() => {
    const ds = new Set<string>();
    sp500Data.forEach((d) => ds.add(`${Math.floor(d.year / 10) * 10}s`));
    return ["all", ...Array.from(ds).sort()];
  }, [sp500Data]);

  const filteredData = useMemo(() => {
    let data = [...sp500Data];
    if (decadeFilter !== "all") {
      const decadeStart = parseInt(decadeFilter);
      data = data.filter((d) => d.year >= decadeStart && d.year < decadeStart + 10);
    }
    data.sort((a, b) => {
      const cmp = sortKey === "year" ? a.year - b.year : a.return - b.return;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return data;
  }, [sp500Data, decadeFilter, sortKey, sortDir]);

  const decadeAverages = useMemo(() => {
    const buckets: Record<string, number[]> = {};
    sp500Data.forEach((d) => {
      const decade = `${Math.floor(d.year / 10) * 10}s`;
      (buckets[decade] ??= []).push(d.return);
    });
    return Object.entries(buckets)
      .map(([decade, returns]) => ({
        decade,
        avg: returns.reduce((a, b) => a + b, 0) / returns.length,
        best: Math.max(...returns),
        worst: Math.min(...returns),
        positive: returns.filter((r) => r > 0).length,
        total: returns.length,
      }))
      .sort((a, b) => a.decade.localeCompare(b.decade));
  }, [sp500Data]);

  const overallStats = useMemo(() => {
    if (sp500Data.length === 0) return null;
    const returns = sp500Data.map((d) => d.return);
    const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
    const best = sp500Data.reduce((a, b) => (a.return > b.return ? a : b));
    const worst = sp500Data.reduce((a, b) => (a.return < b.return ? a : b));
    const positive = returns.filter((r) => r > 0).length;
    return { avg, best, worst, positive, total: returns.length };
  }, [sp500Data]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "year" ? "desc" : "desc"); }
  };

  return (
    <AppShell title="Reference Hub">
      <div className="max-w-5xl mx-auto space-y-6 p-4">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-accent" />
            Reference Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Product references, industry benchmarks, methodology disclosures,
            98 years of S&P 500 data, and stress testing — all sourced and cited.
          </p>
        </div>

        {/* ProductReferencePanel — the main content */}
        <ProductReferencePanel
          references={references?.map((r: any) => ({ key: r.key, src: r.src, url: r.url, benchmark: r.benchmark }))}
          benchmarks={benchmarks as any}
          methodology={methodology as any}
          title="Product References & Methodology"
        />

        {/* Guardrails section */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-accent" />
                <CardTitle className="text-base">Guardrails & Assumptions</CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowGuardrails(!showGuardrails)} className="h-8" aria-label="Toggle guardrails">
                {showGuardrails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
            <CardDescription>Constraints the engines enforce to keep projections realistic.</CardDescription>
          </CardHeader>
          {showGuardrails && (
            <CardContent className="space-y-3">
              <GuardrailRow
                label="Maximum Investment Return"
                value="12% annually"
                note="Prevents unrealistic return assumptions. Historical S&P 500 CAGR is ~10.5%."
              />
              <GuardrailRow
                label="Minimum Savings Rate"
                value="2%"
                note="Below this threshold, projections are not meaningful for retirement planning."
              />
              <GuardrailRow
                label="Tax Rate Range"
                value="10% – 45%"
                note="Covers the full US federal bracket range. State taxes are additive."
              />
              <GuardrailRow
                label="Monte Carlo Trials"
                value="1,000 – 10,000"
                note="Default 1,000. Higher trial counts increase accuracy but take longer."
              />
              <GuardrailRow
                label="Projection Horizon"
                value="1 – 50 years"
                note="Beyond 30 years, compound uncertainty makes point estimates unreliable."
              />
              <GuardrailRow
                label="Inflation Assumption"
                value="2.5% default"
                note="Configurable per strategy. Used for real-dollar projections."
              />
              <GuardrailRow
                label="BIE GDC Brackets"
                value="5 tiers"
                note="Commission rates scale with GDC. Bracket boundaries are product-specific."
              />
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Important:</strong> All projections are hypothetical illustrations,
                  not guarantees. Past performance does not predict future results. Consult a qualified financial
                  advisor before making investment decisions.
                </p>
              </div>
            </CardContent>
          )}
        </Card>

        {/* S&P 500 Historical Data — live from backend */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-accent" />
                <CardTitle className="text-base">S&P 500 Annual Returns (1928–2025)</CardTitle>
                <Badge variant="outline" className="text-[10px]">{sp500Data.length} years</Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)} className="h-8" aria-label="Toggle history">
                {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
            <CardDescription>Complete annual return data used by the engines for backtesting and stress scenarios.</CardDescription>
          </CardHeader>
          {showHistory && sp500Data.length > 0 && (
            <CardContent className="space-y-4">
              {/* Overall stats */}
              {overallStats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
                  <StatChip label="Average Return" value={pct(overallStats.avg)} />
                  <StatChip label="Best Year" value={`${overallStats.best.year}: ${pct(overallStats.best.return)}`} positive />
                  <StatChip label="Worst Year" value={`${overallStats.worst.year}: ${pct(overallStats.worst.return)}`} negative />
                  <StatChip label="Positive Years" value={`${overallStats.positive}/${overallStats.total}`} />
                  <StatChip label="Win Rate" value={pct(overallStats.positive / overallStats.total)} positive />
                </div>
              )}

              {/* Decade averages */}
              <div>
                <h3 className="text-sm font-medium mb-2">Decade Averages</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
                  {decadeAverages.map((d) => (
                    <button
                      key={d.decade}
                      className={`p-2 rounded-md border text-left transition-all hover:border-accent/50 ${decadeFilter === d.decade.replace("s", "") + "s" ? "border-accent bg-accent/5" : "bg-secondary/50"}`}
                      onClick={() => setDecadeFilter(decadeFilter === d.decade ? "all" : d.decade)}
                    >
                      <p className="text-[10px] text-muted-foreground font-medium">{d.decade}</p>
                      <p className={`text-xs font-semibold tabular-nums ${d.avg >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {pct(d.avg)}
                      </p>
                      <p className="text-[9px] text-muted-foreground">
                        {d.positive}/{d.total} positive
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter + sort controls */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px]">
                  {filteredData.length} entries
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => toggleSort("year")}
                >
                  <ArrowUpDown className="h-3 w-3" /> Year {sortKey === "year" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => toggleSort("return")}
                >
                  <ArrowUpDown className="h-3 w-3" /> Return {sortKey === "return" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </Button>
                {decadeFilter !== "all" && (
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setDecadeFilter("all")}>
                    Clear filter
                  </Button>
                )}
              </div>

              {/* Data table */}
              <div className="max-h-80 overflow-y-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-background border-b">
                    <tr>
                      <th className="text-left p-2 text-muted-foreground font-medium">Year</th>
                      <th className="text-right p-2 text-muted-foreground font-medium">Return</th>
                      <th className="text-right p-2 text-muted-foreground font-medium w-24">Visual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((d) => (
                      <tr key={d.year} className="border-b border-border/20 hover:bg-secondary/30">
                        <td className="p-2 tabular-nums font-medium">{d.year}</td>
                        <td className={`p-2 text-right tabular-nums font-semibold ${d.return >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {d.return >= 0 ? "+" : ""}{(d.return * 100).toFixed(1)}%
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-1 justify-end">
                            <div
                              className={`h-3 rounded-sm ${d.return >= 0 ? "bg-emerald-400/70" : "bg-red-400/70"}`}
                              style={{ width: `${Math.min(100, Math.abs(d.return) * 200)}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-[10px] text-muted-foreground">
                Source: NYU Stern Damodaran, S&P Global. Returns include dividends. Data used by the historical backtest and Monte Carlo engines.
              </p>
            </CardContent>
          )}
        </Card>

        {/* Historical Backtest Calculator */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-accent" />
                <CardTitle className="text-base">Historical Backtest Calculator</CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowBacktest(!showBacktest)} className="h-8" aria-label="Toggle backtest">
                {showBacktest ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
            <CardDescription>
              Test your plan against every starting year since 1928. Shows survival rate, worst case, and stress scenarios.
            </CardDescription>
          </CardHeader>
          {showBacktest && (
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Starting Balance</Label>
                  <Input
                    type="number"
                    value={btBalance}
                    onChange={(e) => setBtBalance(Number(e.target.value) || 0)}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Annual Contribution</Label>
                  <Input
                    type="number"
                    value={btContrib}
                    onChange={(e) => setBtContrib(Number(e.target.value) || 0)}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Horizon (years)</Label>
                  <Input
                    type="number"
                    value={btHorizon}
                    onChange={(e) => setBtHorizon(Math.max(1, Math.min(50, Number(e.target.value) || 30)))}
                    className="text-sm"
                    min={1}
                    max={50}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={runBacktest} disabled={backtest.isPending} className="gap-1.5 w-full">
                    {backtest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    Run Backtest
                  </Button>
                </div>
              </div>

              {(backtest.data || stressDotcom.data || stressGFC.data || stressCovid.data) && (
                <StressTestPanel
                  stressResults={{
                    dotcom: stressDotcom.data ?? null,
                    gfc: stressGFC.data ?? null,
                    covid: stressCovid.data ?? null,
                  }}
                  backtestSummary={backtest.data ?? null}
                  startBalance={btBalance}
                  title="Backtest & Stress Test Results"
                />
              )}
            </CardContent>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

/* ── helper components ────────────────────────────────────────── */

function GuardrailRow({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex items-start gap-3 p-2 rounded border">
      <Scale className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          <Badge variant="outline" className="text-[10px]">{value}</Badge>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">{note}</p>
      </div>
    </div>
  );
}

function StatChip({ label, value, positive, negative }: { label: string; value: string; positive?: boolean; negative?: boolean }) {
  return (
    <div className="p-2 rounded-md bg-secondary/50">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-xs font-semibold tabular-nums mt-0.5 ${positive ? "text-emerald-400" : negative ? "text-red-400" : ""}`}>
        {value}
      </p>
    </div>
  );
}
