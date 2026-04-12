/**
 * TaxPlanning — Wired to the real tax.projectYear + tax.projectStateTax
 * backend (Pass 4/10 pure projector). Interactive income/deduction
 * inputs, real bracket breakdown, effective rate, and state tax.
 */
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, DollarSign, TrendingDown, Calculator, FileText, PiggyBank, BarChart3, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import AppShell from "@/components/AppShell";
import { useState } from "react";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default function TaxPlanning() {
  const [, navigate] = useLocation();

  // Input state
  const [filingStatus, setFilingStatus] = useState<"single" | "mfj" | "mfs" | "hoh">("mfj");
  const [income, setIncome] = useState(150000);
  const [capGains, setCapGains] = useState(0);
  const [dividends, setDividends] = useState(5000);
  const [tradDist, setTradDist] = useState(0);
  const [itemized, setItemized] = useState(0);
  const [aboveLine, setAboveLine] = useState(0);
  const [age, setAge] = useState(45);
  const [stateCode, setStateCode] = useState<"CA" | "NY" | "IL" | "TX">("TX");

  const yearCtx = {
    year: 2026,
    filingStatus,
    ordinaryIncomeUSD: income,
    longTermCapGainsUSD: capGains,
    qualifiedDividendsUSD: dividends,
    traditionalDistributionsUSD: tradDist,
    itemizedDeductionUSD: itemized,
    aboveTheLineUSD: aboveLine,
    primaryAge: age,
  };

  const taxResult = trpc.tax.projectYear.useQuery(yearCtx, { retry: false });
  const stateResult = trpc.tax.projectStateTax.useQuery(
    { year: yearCtx, state: stateCode },
    { retry: false },
  );
  const rmdResult = trpc.tax.rmd.useQuery(
    { age, priorYearBalance: tradDist > 0 ? tradDist * 20 : 500000 },
    { retry: false, enabled: age >= 73 },
  );

  const fed = taxResult.data;
  const st = stateResult.data;

  return (
    <AppShell title="Tax Planning">
    <div className="container max-w-5xl py-8 space-y-6">
      <SEOHead title="Tax Planning" description="Tax planning analysis and optimization strategies" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/calculators")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-heading">Tax Planning</h1>
            <p className="text-sm text-muted-foreground">2026 tax projection powered by the real tax engine</p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      {fed && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="bg-card/60 border-border/50">
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Total Tax</p>
              <p className="text-lg font-semibold tabular-nums">{fmt(fed.totalTaxUSD)}</p>
            </CardContent>
          </Card>
          <Card className="bg-card/60 border-border/50">
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Effective Rate</p>
              <p className="text-lg font-semibold tabular-nums text-accent">{(fed.effectiveRate * 100).toFixed(1)}%</p>
            </CardContent>
          </Card>
          <Card className="bg-card/60 border-border/50">
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Marginal Rate</p>
              <p className="text-lg font-semibold tabular-nums">{(fed.marginalRate * 100).toFixed(0)}%</p>
            </CardContent>
          </Card>
          {st && (
            <Card className="bg-card/60 border-border/50">
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Combined ({stateCode})</p>
                <p className="text-lg font-semibold tabular-nums">{(st.combinedEffectiveRate * 100).toFixed(1)}%</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input panel */}
        <Card className="bg-card/60 border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calculator className="w-4 h-4 text-accent" /> Tax Inputs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Filing Status</Label>
              <div className="grid grid-cols-2 gap-1.5 mt-1">
                {(["single", "mfj", "mfs", "hoh"] as const).map(s => (
                  <button key={s} onClick={() => setFilingStatus(s)}
                    className={`text-xs py-1.5 px-2 rounded border transition-all ${filingStatus === s ? "bg-accent/10 border-accent/30 text-accent" : "bg-card/40 border-border/50 text-muted-foreground"}`}>
                    {s === "mfj" ? "Married Joint" : s === "mfs" ? "Married Sep" : s === "hoh" ? "Head of House" : "Single"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">State</Label>
              <div className="grid grid-cols-4 gap-1.5 mt-1">
                {(["CA", "NY", "IL", "TX"] as const).map(s => (
                  <button key={s} onClick={() => setStateCode(s)}
                    className={`text-xs py-1.5 rounded border transition-all ${stateCode === s ? "bg-accent/10 border-accent/30 text-accent" : "bg-card/40 border-border/50 text-muted-foreground"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">W-2 / Ordinary Income</Label>
              <Input type="number" value={income} onChange={e => setIncome(Number(e.target.value))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Long-Term Capital Gains</Label>
              <Input type="number" value={capGains} onChange={e => setCapGains(Number(e.target.value))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Qualified Dividends</Label>
              <Input type="number" value={dividends} onChange={e => setDividends(Number(e.target.value))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Traditional IRA Distributions</Label>
              <Input type="number" value={tradDist} onChange={e => setTradDist(Number(e.target.value))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Itemized Deductions</Label>
              <Input type="number" value={itemized} onChange={e => setItemized(Number(e.target.value))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Above-the-Line Deductions</Label>
              <Input type="number" value={aboveLine} onChange={e => setAboveLine(Number(e.target.value))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Age</Label>
              <Input type="number" value={age} onChange={e => setAge(Number(e.target.value))} className="h-8 text-sm" />
            </div>
          </CardContent>
        </Card>

        {/* Results panel */}
        <div className="lg:col-span-2 space-y-4">
          {taxResult.isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : fed ? (
            <Tabs defaultValue="breakdown">
              <TabsList>
                <TabsTrigger value="breakdown">Bracket Breakdown</TabsTrigger>
                <TabsTrigger value="details">Full Details</TabsTrigger>
                {st && <TabsTrigger value="state">State Tax</TabsTrigger>}
                {rmdResult.data && <TabsTrigger value="rmd">RMD</TabsTrigger>}
              </TabsList>

              <TabsContent value="breakdown" className="mt-4">
                <Card className="bg-card/60 border-border/50">
                  <CardContent className="p-4 space-y-2">
                    {fed.bracketBreakdown?.map((b: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs">{(b.rate * 100).toFixed(0)}%</Badge>
                          <span className="text-muted-foreground text-xs">
                            {fmt(b.lowerBound)} – {fmt(b.upperBound)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-sm">{fmt(b.taxOnBracket)}</span>
                          <span className="text-xs text-muted-foreground ml-2">on {fmt(b.taxableInBracket)}</span>
                        </div>
                      </div>
                    ))}
                    <div className="border-t border-border/50 pt-2 flex justify-between font-medium">
                      <span>Total Federal Tax</span>
                      <span className="font-mono">{fmt(fed.totalTaxUSD)}</span>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="details" className="mt-4">
                <Card className="bg-card/60 border-border/50">
                  <CardContent className="p-4 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">AGI</span><span className="font-mono">{fmt(fed.agiUSD)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Deduction Used</span><span className="font-mono">{fmt(fed.deductionUsedUSD)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Deduction Type</span><Badge variant="outline">{fed.deductionType}</Badge></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Taxable Income</span><span className="font-mono">{fmt(fed.taxableIncomeUSD)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Ordinary Tax</span><span className="font-mono">{fmt(fed.ordinaryTaxUSD)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">LTCG + QD Tax</span><span className="font-mono">{fmt(fed.ltcgTaxUSD)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">NIIT (3.8%)</span><span className="font-mono">{fmt(fed.niitUSD)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">AMT</span><span className="font-mono">{fmt(fed.amtUSD ?? 0)}</span></div>
                    <div className="border-t border-border/50 pt-2 flex justify-between font-medium">
                      <span>Total Federal</span><span className="font-mono">{fmt(fed.totalTaxUSD)}</span>
                    </div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Effective Rate</span><span className="font-mono text-accent">{(fed.effectiveRate * 100).toFixed(2)}%</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Marginal Rate</span><span className="font-mono">{(fed.marginalRate * 100).toFixed(0)}%</span></div>
                  </CardContent>
                </Card>
              </TabsContent>

              {st && (
                <TabsContent value="state" className="mt-4">
                  <Card className="bg-card/60 border-border/50">
                    <CardContent className="p-4 space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">State</span><Badge variant="outline">{stateCode}</Badge></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">State Tax</span><span className="font-mono">{fmt(st.state.stateTaxUSD)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">State Effective Rate</span><span className="font-mono">{(st.state.stateEffectiveRate * 100).toFixed(2)}%</span></div>
                      <div className="border-t border-border/50 pt-2 flex justify-between font-medium">
                        <span>Federal + State</span><span className="font-mono">{fmt(st.federal.totalTaxUSD + st.state.stateTaxUSD)}</span>
                      </div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Combined Effective Rate</span><span className="font-mono text-accent">{(st.combinedEffectiveRate * 100).toFixed(2)}%</span></div>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {rmdResult.data && (
                <TabsContent value="rmd" className="mt-4">
                  <Card className="bg-card/60 border-border/50">
                    <CardContent className="p-4 text-sm">
                      <p className="text-muted-foreground mb-2">Required Minimum Distribution at age {age}:</p>
                      <p className="text-2xl font-bold">{fmt(rmdResult.data.amount)}</p>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            </Tabs>
          ) : taxResult.isError ? (
            <Card className="bg-card/60 border-border/50">
              <CardContent className="p-6 text-center">
                <p className="text-sm text-destructive">Error loading tax projection. Check your inputs.</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        Tax calculations are for illustrative purposes. Consult a licensed tax professional for advice.
      </p>
    </div>
    </AppShell>
  );
}
