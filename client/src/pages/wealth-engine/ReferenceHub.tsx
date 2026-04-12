/**
 * Reference Hub — standalone page for product references, industry
 * benchmarks, methodology disclosures, historical returns, and stress
 * scenarios. Previously only accessible via EngineDashboard tabs.
 */

import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft, BookOpen, TrendingUp, ShieldCheck, BarChart3, AlertTriangle,
  ExternalLink, Info, FileText,
} from "lucide-react";
import { useLocation } from "wouter";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

export default function ReferenceHub() {
  const [, navigate] = useLocation();

  const { data: references } = trpc.calculatorEngine.productReferences.useQuery();
  const { data: benchmarks } = trpc.calculatorEngine.industryBenchmarks.useQuery();
  const { data: methodology } = trpc.calculatorEngine.methodology.useQuery();
  const { data: scenarios } = trpc.calculatorEngine.stressScenarios.useQuery();
  const { data: sp500 } = trpc.calculatorEngine.sp500History.useQuery();

  return (
    <AppShell title="Reference Hub">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="hidden lg:flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/calculators")} aria-label="Back to calculators">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-lg font-heading font-semibold">Reference Hub</h1>
            <p className="text-xs text-muted-foreground">Product references, industry benchmarks, methodology, and historical data</p>
          </div>
        </div>

        <Tabs defaultValue="products" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="products" className="gap-1.5 text-xs">
              <BookOpen className="w-3.5 h-3.5" /> Products
            </TabsTrigger>
            <TabsTrigger value="benchmarks" className="gap-1.5 text-xs">
              <BarChart3 className="w-3.5 h-3.5" /> Benchmarks
            </TabsTrigger>
            <TabsTrigger value="methodology" className="gap-1.5 text-xs">
              <FileText className="w-3.5 h-3.5" /> Methodology
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5 text-xs">
              <TrendingUp className="w-3.5 h-3.5" /> S&P 500 History
            </TabsTrigger>
            <TabsTrigger value="stress" className="gap-1.5 text-xs">
              <AlertTriangle className="w-3.5 h-3.5" /> Stress Scenarios
            </TabsTrigger>
          </TabsList>

          {/* ── Product References ─────────────────────────────────── */}
          <TabsContent value="products" className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {references ? (
                Object.entries(references).map(([type, ref]: [string, any]) => (
                  <Card key={type} className="card-lift">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium capitalize flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] font-mono">{type.toUpperCase()}</Badge>
                          {formatProductName(type)}
                        </CardTitle>
                        {ref.url && (
                          <a
                            href={ref.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent hover:underline"
                            aria-label={`Source for ${type}`}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-0">
                      <p className="text-xs text-muted-foreground">{ref.src}</p>
                      {ref.benchmark && (
                        <div className="flex items-start gap-1.5 text-xs bg-accent/5 rounded-md p-2 border border-accent/10">
                          <Info className="w-3 h-3 text-accent mt-0.5 shrink-0" />
                          <span>{ref.benchmark}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <p className="text-xs text-muted-foreground col-span-2 text-center py-8">Loading references...</p>
              )}
            </div>
          </TabsContent>

          {/* ── Industry Benchmarks ────────────────────────────────── */}
          <TabsContent value="benchmarks" className="space-y-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-accent" />
                  Industry Benchmarks
                </CardTitle>
                <CardDescription className="text-xs">
                  National statistics and industry averages used in all calculations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {benchmarks ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(benchmarks).map(([key, bm]: [string, any]) => (
                      <div key={key} className="p-3 rounded-lg border border-border/50 bg-card/60 space-y-1.5">
                        <p className="text-xs font-medium">{formatBenchmarkLabel(key)}</p>
                        <div className="text-lg font-heading font-semibold text-accent">
                          {formatBenchmarkValue(key, bm)}
                        </div>
                        <p className="text-[10px] text-muted-foreground">{bm.source}</p>
                        {bm.url && (
                          <a
                            href={bm.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-accent hover:underline flex items-center gap-0.5"
                          >
                            Source <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-8">Loading benchmarks...</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Methodology ────────────────────────────────────────── */}
          <TabsContent value="methodology" className="space-y-3">
            {methodology ? (
              <div className="space-y-3">
                {Object.entries(methodology).map(([key, text]: [string, any]) => (
                  <Card key={key}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-accent" />
                        {formatMethodologyLabel(key)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-8">Loading methodology...</p>
            )}
          </TabsContent>

          {/* ── S&P 500 Historical Returns ────────────────────────── */}
          <TabsContent value="history" className="space-y-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-accent" />
                  S&P 500 Annual Returns (1928–2025)
                </CardTitle>
                <CardDescription className="text-xs">
                  Historical annual returns used in backtesting simulations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sp500 ? (
                  <>
                    {/* Mini bar chart */}
                    <div className="flex items-end gap-[1px] h-24 mb-4">
                      {sp500.map((d: any) => {
                        const r = d.return as number;
                        const height = Math.max(2, Math.abs(r) * 200);
                        return (
                          <div
                            key={d.year}
                            className={`flex-1 min-w-[1px] rounded-t-sm ${r >= 0 ? "bg-emerald-400/70" : "bg-red-400/70"}`}
                            style={{ height: `${Math.min(height, 100)}%` }}
                            title={`${d.year}: ${(r * 100).toFixed(1)}%`}
                          />
                        );
                      })}
                    </div>

                    {/* Summary stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                      <StatPill label="Years" value={sp500.length.toString()} />
                      <StatPill label="Avg Return" value={pct(sp500.reduce((s: number, d: any) => s + d.return, 0) / sp500.length)} />
                      <StatPill label="Best Year" value={pct(Math.max(...sp500.map((d: any) => d.return)))} accent />
                      <StatPill label="Worst Year" value={pct(Math.min(...sp500.map((d: any) => d.return)))} negative />
                    </div>

                    {/* Scrollable table */}
                    <ScrollArea className="h-[300px]">
                      <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-1 text-[10px]">
                        {sp500.map((d: any) => {
                          const r = d.return as number;
                          return (
                            <div
                              key={d.year}
                              className={`p-1.5 rounded text-center ${r >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}
                            >
                              <div className="font-mono font-medium">{d.year}</div>
                              <div className="font-mono">{(r * 100).toFixed(1)}%</div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-8">Loading historical data...</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Stress Scenarios ───────────────────────────────────── */}
          <TabsContent value="stress" className="space-y-3">
            {scenarios ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {scenarios.map((s: any) => (
                  <Card key={s.key} className="card-lift">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        {s.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-xs text-muted-foreground">{s.description}</p>
                      <div className="flex items-end gap-1 h-12">
                        {s.returns.map((r: number, i: number) => (
                          <div
                            key={i}
                            className={`flex-1 rounded-t-sm ${r >= 0 ? "bg-emerald-400/70" : "bg-red-400/70"}`}
                            style={{ height: `${Math.max(4, Math.abs(r) * 200)}%` }}
                            title={`${s.years[i]}: ${(r * 100).toFixed(1)}%`}
                          />
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {s.years.map((y: number, i: number) => (
                          <Badge
                            key={y}
                            variant={s.returns[i] < 0 ? "destructive" : "outline"}
                            className="text-[10px] font-mono"
                          >
                            {y}: {(s.returns[i] * 100).toFixed(1)}%
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-8">Loading scenarios...</p>
            )}
          </TabsContent>
        </Tabs>

        {/* Disclaimer */}
        <p className="text-[10px] text-muted-foreground/50 text-center max-w-2xl mx-auto">
          All data sourced from cited industry publications and government agencies. Benchmarks are national averages
          and may not reflect individual circumstances. References are for educational purposes only. Not investment,
          tax, or legal advice. Consult qualified professionals before making financial decisions.
        </p>
      </div>
    </AppShell>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────

function StatPill({ label, value, accent, negative }: { label: string; value: string; accent?: boolean; negative?: boolean }) {
  return (
    <div className="p-2 rounded-lg border border-border/50 bg-card/60 text-center">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`text-sm font-mono font-semibold ${accent ? "text-emerald-400" : negative ? "text-red-400" : "text-accent"}`}>
        {value}
      </div>
    </div>
  );
}

function formatProductName(type: string): string {
  const names: Record<string, string> = {
    term: "Term Life Insurance",
    iul: "Indexed Universal Life",
    wl: "Whole Life Insurance",
    di: "Disability Income",
    ltc: "Long-Term Care",
    fia: "Fixed Indexed Annuity",
    aum: "Assets Under Management",
    "401k": "401(k) Retirement Plan",
    roth: "Roth IRA",
    "529": "529 Education Savings",
    estate: "Estate Planning",
    premfin: "Premium Finance",
    splitdollar: "Split-Dollar Arrangement",
    deferredcomp: "Deferred Compensation",
  };
  return names[type] || type;
}

function formatBenchmarkLabel(key: string): string {
  const labels: Record<string, string> = {
    savingsRate: "National Savings Rate",
    investorBehaviorGap: "Investor Behavior Gap",
    lifeInsuranceGap: "Life Insurance Coverage Gap",
    retirementReadiness: "Retirement Readiness",
    estatePlanningGap: "Estate Planning Gap",
    advisorAlpha: "Advisor Alpha (Added Value)",
    avgAdvisoryFee: "Average Advisory Fee",
    avgWealthGrowth: "Average Wealth Growth",
  };
  return labels[key] || key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

function formatBenchmarkValue(key: string, bm: any): string {
  if (bm.national != null) return pct(bm.national);
  if (bm.gap != null) return pct(bm.gap);
  if (bm.pct != null) return pct(bm.pct);
  if (bm.value != null) return key.includes("Fee") ? pct(bm.value) : `${(bm.value * 100).toFixed(1)}%`;
  if (bm.sp500 != null) return `${pct(bm.sp500)} (S&P)`;
  return "—";
}

function formatMethodologyLabel(key: string): string {
  const labels: Record<string, string> = {
    uwe: "Unified Wealth Engine (UWE)",
    bie: "Business Income Engine (BIE)",
    he: "Holistic Engine (HE)",
    mc: "Monte Carlo Simulation",
    pf: "Premium Finance Modeling",
    disclaimer: "Important Disclaimer",
  };
  return labels[key] || key.toUpperCase();
}
