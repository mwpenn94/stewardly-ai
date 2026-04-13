/**
 * BusinessIncome — BIE (Business Income Engine) configurator.
 * Interactive practice income modeling with role selection, income
 * streams, team size, and multi-year projections wired to the real
 * calculatorEngine.bieSimulate endpoint (v7 parity).
 */
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, TrendingUp, Loader2, Users, DollarSign, Target, Calculator, ChevronRight, Layers } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import AppShell from "@/components/AppShell";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { persistCalculation } from "@/lib/calculatorContext";
import { DiscussInChatButton } from "@/components/wealth-engine/DiscussInChatButton";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default function BusinessIncome() {
  const [, navigate] = useLocation();

  // Strategy config
  const [role, setRole] = useState("new");
  const [years, setYears] = useState(10);
  const [personalGDC, setPersonalGDC] = useState<number | null>(null);
  const [teamSize, setTeamSize] = useState(0);
  const [teamAvgFYC, setTeamAvgFYC] = useState(65000);
  const [existingAUM, setExistingAUM] = useState(0);
  const [newAUMAnnual, setNewAUMAnnual] = useState(0);

  // Back-plan
  const [targetIncome, setTargetIncome] = useState(200000);

  // Queries (reference data — cache 5min)
  const rolesQ = trpc.calculatorEngine.bieRoles.useQuery(undefined, { staleTime: 5 * 60_000 });
  const presetsQ = trpc.calculatorEngine.biePresets.useQuery(undefined, { staleTime: 5 * 60_000 });
  const bracketsQ = trpc.calculatorEngine.bieBrackets.useQuery(undefined, { staleTime: 5 * 60_000 });
  const channelsQ = trpc.calculatorEngine.bieChannels.useQuery(undefined, { staleTime: 5 * 60_000 });
  const productsQ = trpc.calculatorEngine.productReferences.useQuery(undefined, { staleTime: 5 * 60_000 });

  // Expandable sections
  const [showChannels, setShowChannels] = useState(false);
  const [showProducts, setShowProducts] = useState(false);

  // Mutations
  const simMutation = trpc.calculatorEngine.bieSimulate.useMutation({ onError: (e) => toast.error(e.message) });
  const backPlanMutation = trpc.calculatorEngine.bieBackPlan.useMutation({ onError: (e) => toast.error(e.message) });

  function runSimulation() {
    const team = teamSize > 0
      ? Array.from({ length: teamSize }, (_, i) => ({
          name: `Agent ${i + 1}`,
          role: "new" as const,
          fyc: teamAvgFYC,
        }))
      : [];

    simMutation.mutate({
      strategy: {
        name: "Custom Strategy",
        role: role as any,
        streams: { personal: true, overrides: teamSize > 0, aum: existingAUM > 0 || newAUMAnnual > 0 },
        team,
        personalGDC,
        existingAUM: existingAUM || undefined,
        newAUMAnnual: newAUMAnnual || undefined,
      },
      years,
    });
  }

  function runBackPlan() {
    backPlanMutation.mutate({ targetIncome, role: role as any });
  }

  const results = simMutation.data;

  // ── Persist to calculator context bridge so Chat knows BIE results ──
  useEffect(() => {
    if (!results || !Array.isArray(results) || results.length === 0) return;
    const year1Income = (results[0] as any)?.totalIncome ?? 0;
    const finalYearIncome = (results[results.length - 1] as any)?.totalIncome ?? 0;
    const cumulative = results.reduce((s: number, r: any) => s + (r.totalIncome ?? 0), 0);
    persistCalculation({
      id: `bie-${role}-${years}yr`,
      type: "bie",
      title: `BIE Simulation — ${role} role, ${years}-year projection`,
      summary: `Year 1 income: ${fmt(year1Income)}, Year ${years} income: ${fmt(finalYearIncome)}, Cumulative: ${fmt(cumulative)}. Team size: ${teamSize}, AUM: ${fmt(existingAUM)}.`,
      inputs: { role, years, personalGDC, teamSize, teamAvgFYC, existingAUM, newAUMAnnual },
      outputs: { year1Income, finalYearIncome, cumulative, yearCount: results.length },
      timestamp: Date.now(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  return (
    <AppShell title="Business Income">
      <SEOHead title="Business Income Engine" description="Practice income modeling with role-based projections and team economics" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/calculators")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-heading">Business Income Engine</h1>
            <p className="text-sm text-muted-foreground">Model practice income by role, streams, and team (BIE v7)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Config panel */}
          <div className="space-y-4">
            <Card className="bg-card/60 border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-accent" /> Role & Streams
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Role</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-1.5 mt-1">
                    {(rolesQ.data ?? []).slice(0, 9).map((r: any) => (
                      <button key={r.key} onClick={() => setRole(r.key)}
                        className={`text-[10px] py-1.5 rounded border transition-all ${role === r.key ? "bg-accent/10 border-accent/30 text-accent" : "bg-card/40 border-border/50 text-muted-foreground"}`}>
                        {r.name?.split(" ")[0] || r.key}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Personal GDC Override</Label>
                  <Input type="number" value={personalGDC ?? ""} placeholder="Auto from role"
                    onChange={e => setPersonalGDC(e.target.value ? Number(e.target.value) : null)} className="h-8 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs text-muted-foreground">Team Size</Label>
                    <Input type="number" value={teamSize} onChange={e => setTeamSize(Number(e.target.value))} min={0} max={50} className="h-8 text-sm" /></div>
                  <div><Label className="text-xs text-muted-foreground">Avg FYC/Agent</Label>
                    <Input type="number" value={teamAvgFYC} onChange={e => setTeamAvgFYC(Number(e.target.value))} className="h-8 text-sm" /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs text-muted-foreground">Existing AUM</Label>
                    <Input type="number" value={existingAUM} onChange={e => setExistingAUM(Number(e.target.value))} className="h-8 text-sm" /></div>
                  <div><Label className="text-xs text-muted-foreground">New AUM/yr</Label>
                    <Input type="number" value={newAUMAnnual} onChange={e => setNewAUMAnnual(Number(e.target.value))} className="h-8 text-sm" /></div>
                </div>
                <div><Label className="text-xs text-muted-foreground">Projection Years</Label>
                  <Input type="number" value={years} onChange={e => setYears(Number(e.target.value))} min={1} max={30} className="h-8 text-sm" /></div>
                <Button className="w-full h-9 text-sm" onClick={runSimulation} disabled={simMutation.isPending}>
                  {simMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <TrendingUp className="w-4 h-4 mr-1" />}
                  Run Projection
                </Button>
                {results && <DiscussInChatButton prompt="Based on my business income projection, what strategies could help me grow faster?" />}
              </CardContent>
            </Card>

            {/* Back-plan */}
            <Card className="bg-card/60 border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="w-4 h-4 text-accent" /> Back-Plan
                </CardTitle>
                <CardDescription className="text-xs">Target income → required GDC</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div><Label className="text-xs text-muted-foreground">Target Annual Income</Label>
                  <Input type="number" value={targetIncome} onChange={e => setTargetIncome(Number(e.target.value))} className="h-8 text-sm" /></div>
                <Button variant="outline" className="w-full h-9 text-sm" onClick={runBackPlan} disabled={backPlanMutation.isPending}>
                  {backPlanMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Calculator className="w-4 h-4 mr-1" />}
                  Calculate Required GDC
                </Button>
                {backPlanMutation.data && (() => {
                  const bp = backPlanMutation.data as any;
                  const funnel = bp.funnel;
                  return (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
                        <p className="text-xs text-muted-foreground">Required GDC for {fmt(targetIncome)}/yr as {role}:</p>
                        <p className="text-lg font-bold text-accent font-mono">{fmt(bp.neededGDC ?? bp.requiredGDC ?? 0)}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px]">{bp.bracketLabel ?? "—"}</Badge>
                          <span className="text-[10px] text-muted-foreground">{((bp.bracketRate ?? 0) * 100).toFixed(0)}% payout</span>
                        </div>
                      </div>
                      {funnel && (
                        <div className="space-y-2">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Sales Funnel</p>
                          <div className="space-y-1">
                            {[
                              { label: "Approaches", value: funnel.approaches, color: "bg-chart-1/20 border-chart-1/30" },
                              { label: "Appointments Set", value: funnel.set, color: "bg-chart-2/20 border-chart-2/30" },
                              { label: "Meetings Held", value: funnel.held, color: "bg-chart-3/20 border-chart-3/30" },
                              { label: "Applications", value: funnel.apps, color: "bg-chart-4/20 border-chart-4/30" },
                              { label: "Placed Cases", value: funnel.placed, color: "bg-accent/20 border-accent/30" },
                            ].map((step, i) => (
                              <div key={step.label} className="flex items-center gap-2">
                                <div className={`flex-1 flex items-center justify-between px-2 py-1 rounded border ${step.color}`}
                                  style={{ marginLeft: `${i * 8}px` }}>
                                  <span className="text-[10px]">{step.label}</span>
                                  <span className="text-xs font-mono font-semibold">{step.value?.toLocaleString()}</span>
                                </div>
                                {i < 4 && <ChevronRight className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />}
                              </div>
                            ))}
                          </div>
                          <div className="grid grid-cols-3 gap-1.5 mt-2">
                            <div className="p-2 rounded bg-card/60 border border-border/30 text-center">
                              <p className="text-[9px] text-muted-foreground uppercase">Daily</p>
                              <p className="text-sm font-mono font-semibold">{funnel.daily?.approaches ?? "—"}</p>
                              <p className="text-[9px] text-muted-foreground">approaches</p>
                            </div>
                            <div className="p-2 rounded bg-card/60 border border-border/30 text-center">
                              <p className="text-[9px] text-muted-foreground uppercase">Weekly</p>
                              <p className="text-sm font-mono font-semibold">{funnel.weekly?.approaches ?? "—"}</p>
                              <p className="text-[9px] text-muted-foreground">approaches</p>
                            </div>
                            <div className="p-2 rounded bg-card/60 border border-border/30 text-center">
                              <p className="text-[9px] text-muted-foreground uppercase">Monthly</p>
                              <p className="text-sm font-mono font-semibold">{funnel.monthly?.approaches ?? "—"}</p>
                              <p className="text-[9px] text-muted-foreground">approaches</p>
                            </div>
                          </div>
                          {funnel.monthly && (
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              <span>{fmt(funnel.monthly.gdc ?? 0)}/mo GDC target</span>
                              <span>·</span>
                              <span>{funnel.monthly.apps ?? 0} apps/mo</span>
                              <span>·</span>
                              <span>{fmt(funnel.avgCase ?? 3000)} avg case</span>
                            </div>
                          )}
                        </div>
                      )}
                      {bp.teamNeeded != null && (
                        <div className="p-2 rounded bg-secondary/30 border border-border/30">
                          <p className="text-[10px] text-muted-foreground">Override stream (30% of target):</p>
                          <p className="text-xs"><strong>{bp.teamNeeded}</strong> team members needed at {fmt(bp.overrideTarget ?? 0)} override target</p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Presets */}
            {presetsQ.data && (
              <Card className="bg-card/60 border-border/50">
                <CardHeader className="pb-3"><CardTitle className="text-sm">Quick Presets</CardTitle></CardHeader>
                <CardContent className="space-y-1.5">
                  {presetsQ.data.map((p: any) => (
                    <button key={p.key} onClick={() => {
                      setRole(p.strategy.role || "new");
                      if (p.strategy.team?.length) setTeamSize(p.strategy.team.length);
                    }}
                      className="w-full text-left p-2 rounded border border-border/50 bg-card/30 hover:bg-secondary/40 transition-colors text-xs">
                      <span className="font-medium">{p.key}</span>
                      <span className="text-muted-foreground ml-2">({p.strategy.role})</span>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* GDC Bracket Table */}
            {bracketsQ.data && bracketsQ.data.length > 0 && (
              <Card className="bg-card/60 border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4 text-accent" /> GDC Brackets
                  </CardTitle>
                  <CardDescription className="text-xs">Commission payout rates by production level</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {bracketsQ.data.map((b: any, i: number) => {
                      const isActive = results && Array.isArray(results) && results.length > 0 &&
                        (results[0] as any)?.personalGDC >= (b.min ?? 0) &&
                        (b.max == null || (results[0] as any)?.personalGDC <= b.max);
                      return (
                        <div key={i} className={`flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors ${isActive ? "bg-accent/12 border border-accent/30" : "bg-card/30"}`}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium w-28 truncate">{b.label ?? `Bracket ${i + 1}`}</span>
                            <span className="text-muted-foreground text-[10px]">
                              {fmt(b.min ?? 0)}{b.max ? ` – ${fmt(b.max)}` : "+"}
                            </span>
                          </div>
                          <Badge variant={isActive ? "default" : "outline"} className="text-[10px] font-mono">
                            {((b.rate ?? 0) * 100).toFixed(0)}%
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Results */}
          <div className="lg:col-span-2 space-y-4">
            {results && Array.isArray(results) && results.length > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Card className="bg-card/60 border-border/50"><CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Year 1 Income</p>
                    <p className="text-lg font-semibold tabular-nums text-accent">{fmt((results[0] as any)?.totalIncome ?? 0)}</p>
                  </CardContent></Card>
                  <Card className="bg-card/60 border-border/50"><CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Year {years} Income</p>
                    <p className="text-lg font-semibold tabular-nums">{fmt((results[results.length - 1] as any)?.totalIncome ?? 0)}</p>
                  </CardContent></Card>
                  <Card className="bg-card/60 border-border/50"><CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Cumulative</p>
                    <p className="text-lg font-semibold tabular-nums">{fmt(results.reduce((s: number, r: any) => s + (r.totalIncome ?? 0), 0))}</p>
                  </CardContent></Card>
                  <Card className="bg-card/60 border-border/50"><CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Growth</p>
                    <p className="text-lg font-semibold tabular-nums text-emerald-400">
                      {results.length >= 2 && (results[0] as any)?.totalIncome > 0
                        ? `${(((results[results.length - 1] as any)?.totalIncome / (results[0] as any)?.totalIncome - 1) * 100).toFixed(0)}%`
                        : "—"}
                    </p>
                  </CardContent></Card>
                </div>

                <Card className="bg-card/60 border-border/50">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Year-by-Year Income Projection</CardTitle></CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px] w-full">
                      <div className="overflow-x-auto">
                      <Table className="min-w-[400px]">
                        <TableHeader>
                          <TableRow className="border-border">
                            <TableHead className="text-[10px]">Year</TableHead>
                            <TableHead className="text-[10px] text-right">Personal</TableHead>
                            <TableHead className="text-[10px] text-right">Overrides</TableHead>
                            <TableHead className="text-[10px] text-right">AUM</TableHead>
                            <TableHead className="text-[10px] text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {results.map((r: any, i: number) => (
                            <TableRow key={i} className="border-border/30">
                              <TableCell className="text-xs py-1.5">{i + 1}</TableCell>
                              <TableCell className="text-xs text-right py-1.5 font-mono">{fmt(r.personalIncome ?? 0)}</TableCell>
                              <TableCell className="text-xs text-right py-1.5 font-mono text-muted-foreground">{fmt(r.overrideIncome ?? 0)}</TableCell>
                              <TableCell className="text-xs text-right py-1.5 font-mono text-muted-foreground">{fmt(r.aumIncome ?? 0)}</TableCell>
                              <TableCell className="text-xs text-right py-1.5 font-mono text-accent">{fmt(r.totalIncome ?? 0)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
                <DollarSign className="w-8 h-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">Configure your role and click Run Projection</p>
                <p className="text-[10px] text-muted-foreground/50 mt-1">See personal income, overrides, AUM fees, and team economics</p>
              </div>
            )}
          </div>
        </div>

        {/* Marketing Channels Reference */}
        <Card className="bg-card/60 border-border/50">
          <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowChannels(v => !v)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="w-4 h-4 text-accent" /> Marketing Channels (CPL & ROI)
              </CardTitle>
              <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${showChannels ? "rotate-90" : ""}`} />
            </div>
            <CardDescription className="text-xs">10 channels with cost-per-lead, conversion rate, revenue per client, LTV, and growth rate</CardDescription>
          </CardHeader>
          {showChannels && channelsQ.data && (
            <CardContent>
              <div className="overflow-x-auto">
                <Table className="min-w-[600px]">
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-[10px]">Channel</TableHead>
                      <TableHead className="text-[10px] text-right">CPL</TableHead>
                      <TableHead className="text-[10px] text-right">Conv %</TableHead>
                      <TableHead className="text-[10px] text-right">Rev/Client</TableHead>
                      <TableHead className="text-[10px] text-right">LTV</TableHead>
                      <TableHead className="text-[10px] text-right">ROI</TableHead>
                      <TableHead className="text-[10px] text-right">Growth</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {channelsQ.data.map((ch: any) => {
                      const roi = ch.cpl > 0 ? ((ch.revPerClient * ch.cv - ch.cpl) / ch.cpl * 100) : 0;
                      return (
                        <TableRow key={ch.key} className="border-border/30">
                          <TableCell className="text-xs py-1.5 font-medium">{ch.name}</TableCell>
                          <TableCell className="text-xs text-right py-1.5 font-mono">${ch.cpl}</TableCell>
                          <TableCell className="text-xs text-right py-1.5 font-mono">{(ch.cv * 100).toFixed(0)}%</TableCell>
                          <TableCell className="text-xs text-right py-1.5 font-mono">{fmt(ch.revPerClient)}</TableCell>
                          <TableCell className="text-xs text-right py-1.5 font-mono text-muted-foreground">{fmt(ch.ltv)}</TableCell>
                          <TableCell className={`text-xs text-right py-1.5 font-mono ${roi > 500 ? "text-emerald-400" : roi > 100 ? "text-accent" : "text-amber-400"}`}>
                            {roi.toFixed(0)}%
                          </TableCell>
                          <TableCell className="text-xs text-right py-1.5 font-mono text-muted-foreground">{(ch.growthRate * 100).toFixed(0)}%/yr</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <p className="text-[10px] text-muted-foreground mt-3">
                ROI = (Revenue per client × conversion rate − CPL) / CPL. LTV based on 10-year client retention models. Attribution represents measurable attribution %.
              </p>
            </CardContent>
          )}
        </Card>

        {/* Product Library Reference */}
        <Card className="bg-card/60 border-border/50">
          <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowProducts(v => !v)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-accent" /> Product Reference Library
              </CardTitle>
              <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${showProducts ? "rotate-90" : ""}`} />
            </div>
            <CardDescription className="text-xs">14 product types with sources, benchmarks, and industry data</CardDescription>
          </CardHeader>
          {showProducts && productsQ.data && (
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {productsQ.data.map((p: any) => (
                  <div key={p.key} className="p-3 rounded-lg border border-border/40 bg-card/30 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium uppercase tracking-wide">{p.key}</span>
                      {p.url && (
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent hover:underline">
                          Source
                        </a>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{p.benchmark}</p>
                    <p className="text-[9px] text-muted-foreground/60 leading-relaxed">{p.src}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>

        <p className="text-[10px] text-muted-foreground text-center">
          Income projections are illustrative based on industry averages and the WealthBridge v7 BIE model. Actual results will vary.
        </p>
      </div>
    </AppShell>
  );
}
