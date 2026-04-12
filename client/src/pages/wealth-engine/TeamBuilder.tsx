/**
 * TeamBuilder — BIE team composition editor with roll-up aggregation,
 * roll-down target distribution, and business economics viewer.
 *
 * Users build a team by selecting roles + counts, run roll-up to see
 * aggregate income, run roll-down to cascade org targets to per-person
 * quotas, and view 5-year economics (CAC, LTV, margins, ROI).
 */

import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Users, ArrowUpFromLine, ArrowDownToLine, DollarSign,
  Loader2, Plus, X, TrendingUp, BarChart3, Target, Briefcase,
} from "lucide-react";
import { useState, useCallback } from "react";
import { useLocation } from "wouter";

// ─── CONSTANTS ──────────────────────────────────────────────────────

const ROLES = [
  { key: "new", name: "New Associate", short: "NA", level: 1, baseGDC: 65000 },
  { key: "exp", name: "Experienced Pro", short: "EP", level: 2, baseGDC: 150000 },
  { key: "sa", name: "Senior Associate", short: "SA", level: 3, baseGDC: 180000 },
  { key: "dir", name: "Director", short: "DIR", level: 4, baseGDC: 220000 },
  { key: "md", name: "Managing Director", short: "MD", level: 5, baseGDC: 280000 },
  { key: "rvp", name: "Regional VP", short: "RVP", level: 6, baseGDC: 350000 },
  { key: "affB", name: "Affiliate B (Referral)", short: "AF-B", level: 1, baseGDC: 50000 },
  { key: "affC", name: "Affiliate C (Co-Broker)", short: "AF-C", level: 1, baseGDC: 80000 },
  { key: "partner", name: "Strategic Partner", short: "PTR", level: 0, baseGDC: 0 },
] as const;

const PRESETS = [
  { key: "newAssociate", label: "New Associate (solo)", desc: "Personal production only" },
  { key: "experiencedPro", label: "Experienced Pro", desc: "Multi-stream + small team" },
  { key: "director", label: "Director", desc: "3 direct reports + overrides" },
  { key: "md", label: "Managing Director", desc: "Full org with all streams" },
  { key: "rvp", label: "Regional VP", desc: "3 MDs + full region" },
  { key: "affiliateB", label: "Affiliate B", desc: "Referral track only" },
  { key: "strategicPartner", label: "Strategic Partner", desc: "Partner + affiliate income" },
] as const;

interface TeamMember {
  id: string;
  role: string;
  name: string;
  count: number;
}

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function pctFmt(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

// ─── COMPONENT ──────────────────────────────────────────────────────

export default function TeamBuilder() {
  const [, navigate] = useLocation();

  // Team composition
  const [members, setMembers] = useState<TeamMember[]>([
    { id: "1", role: "new", name: "New Associates", count: 3 },
    { id: "2", role: "exp", name: "Experienced Pros", count: 2 },
  ]);

  // Leader role for strategy
  const [leaderRole, setLeaderRole] = useState("dir");
  const [presetKey, setPresetKey] = useState<string>("");

  // Roll-down target
  const [orgTarget, setOrgTarget] = useState(1000000);

  // Economics years
  const [econYears, setEconYears] = useState(5);

  // tRPC mutations
  const rollUp = trpc.wealthEngine.rollUpTeam.useMutation();
  const rollDown = trpc.wealthEngine.rollDownOrg.useMutation();
  const economics = trpc.wealthEngine.calcBizEconomics.useMutation();
  const projectIncome = trpc.wealthEngine.projectBizIncome.useMutation();

  // Add team member
  const addMember = useCallback(() => {
    const role = ROLES.find(r => !members.some(m => m.role === r.key)) || ROLES[0];
    setMembers(prev => [
      ...prev,
      { id: Date.now().toString(), role: role.key, name: role.name, count: 1 },
    ]);
  }, [members]);

  // Remove team member
  const removeMember = useCallback((id: string) => {
    setMembers(prev => prev.filter(m => m.id !== id));
  }, []);

  // Update member
  const updateMember = useCallback((id: string, field: keyof TeamMember, value: string | number) => {
    setMembers(prev =>
      prev.map(m => (m.id === id ? { ...m, [field]: value } : m)),
    );
  }, []);

  // Run roll-up: create individual strategies for each member group, then aggregate
  const handleRollUp = useCallback(() => {
    const strategies = members.map(m => ({
      name: m.name,
      role: m.role,
      streams: { personal: true, expanded: true },
      team: [],
      channelSpend: {},
      seasonality: "flat" as const,
      customSeason: null,
      personalGrowth: null,
      teamGrowth: 0.1,
      aumGrowth: 0.05,
      channelGrowth: 0.1,
      hiringRate: 0,
      retentionRate: 0.85,
      affA: {},
      affB: {},
      affC: {},
      affD: {},
      partnerIncome: 0,
      partnerGrowth: 0,
      existingAUM: 0,
      newAUMAnnual: 0,
      aumFeeRate: 0.01,
      personalGDC: null,
      wbPct: 1,
      bracketOverride: null,
      overrideRate: 0.06,
      overrideBonusRate: 0,
      gen2Rate: 0.02,
      renewalRate: 0.05,
      renewalStartYear: 3,
      bonusPct: 0.05,
      campaigns: [],
      notes: "",
    }));

    // Create N copies for each member count
    const expanded = strategies.flatMap((s, i) =>
      Array.from({ length: members[i].count }, () => s),
    );

    rollUp.mutate({ strategies: expanded });
  }, [members, rollUp]);

  // Run roll-down
  const handleRollDown = useCallback(() => {
    const teamComposition = members
      .filter(m => m.count > 0)
      .map(m => ({ role: m.role as "new" | "exp" | "sa" | "dir" | "md" | "rvp" | "affA" | "affB" | "affC" | "affD" | "partner", count: m.count }));
    if (teamComposition.length === 0) return;
    rollDown.mutate({ orgTarget, teamComposition });
  }, [members, orgTarget, rollDown]);

  // Run economics (use preset or leader role)
  const handleEconomics = useCallback(() => {
    if (presetKey) {
      projectIncome.mutate({ strategy: {}, years: econYears, presetKey: presetKey as any });
    } else {
      economics.mutate({
        strategy: {
          name: "Team Builder",
          role: leaderRole,
          streams: { personal: true, expanded: true, override: true, aum: true },
          team: members.map(m => ({ name: m.name, role: m.role, fyc: 0 })),
          channelSpend: {},
          seasonality: "flat",
          customSeason: null,
          personalGrowth: null,
          teamGrowth: 0.1,
          aumGrowth: 0.05,
          channelGrowth: 0.1,
          hiringRate: 0,
          retentionRate: 0.85,
          affA: {},
          affB: {},
          affC: {},
          affD: {},
          partnerIncome: 0,
          partnerGrowth: 0,
          existingAUM: 0,
          newAUMAnnual: 0,
          aumFeeRate: 0.01,
          personalGDC: null,
          wbPct: 1,
          bracketOverride: null,
          overrideRate: 0.06,
          overrideBonusRate: 0,
          gen2Rate: 0.02,
          renewalRate: 0.05,
          renewalStartYear: 3,
          bonusPct: 0.05,
          campaigns: [],
          notes: "",
        },
        years: econYears,
      });
    }
  }, [leaderRole, members, econYears, presetKey, economics, projectIncome]);

  const totalTeamSize = members.reduce((s, m) => s + m.count, 0);

  return (
    <AppShell title="Team Builder">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="hidden lg:flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/calculators")} aria-label="Back to calculators">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-lg font-heading font-semibold">Team Builder</h1>
            <p className="text-xs text-muted-foreground">
              Build your team composition, then roll up income or roll down org targets
            </p>
          </div>
          <Badge variant="outline" className="ml-auto text-xs">
            <Users className="w-3 h-3 mr-1" /> {totalTeamSize} members
          </Badge>
        </div>

        {/* Team Composition */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-accent" />
                  Team Composition
                </CardTitle>
                <CardDescription className="text-xs">Add roles and set counts to define your org structure</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={addMember} className="gap-1 text-xs">
                <Plus className="w-3 h-3" /> Add Role
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {members.map(m => {
              const roleDef = ROLES.find(r => r.key === m.role);
              return (
                <div key={m.id} className="flex items-center gap-2 p-2 rounded-lg border border-border/50 bg-card/60">
                  <Select value={m.role} onValueChange={v => updateMember(m.id, "role", v)}>
                    <SelectTrigger className="h-8 text-xs w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map(r => (
                        <SelectItem key={r.key} value={r.key}>
                          <span className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[9px] font-mono px-1">{r.short}</Badge>
                            {r.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-1.5">
                    <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Count:</Label>
                    <Input
                      type="number"
                      value={m.count}
                      onChange={e => updateMember(m.id, "count", Math.max(1, parseInt(e.target.value) || 1))}
                      className="h-8 w-16 text-xs text-center"
                      min={1}
                      max={50}
                    />
                  </div>

                  {roleDef && (
                    <Badge variant="secondary" className="text-[10px] hidden sm:inline-flex">
                      Base: {fmt(roleDef.baseGDC)}/yr
                    </Badge>
                  )}

                  <div className="flex-1" />

                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => removeMember(m.id)}
                    disabled={members.length <= 1}
                    aria-label={`Remove ${roleDef?.name || m.role}`}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              );
            })}

            {/* Quick presets */}
            <div className="pt-2 border-t border-border/30">
              <p className="text-[10px] text-muted-foreground mb-2">Quick presets:</p>
              <div className="flex flex-wrap gap-1">
                {PRESETS.map(p => (
                  <Button
                    key={p.key}
                    size="sm"
                    variant={presetKey === p.key ? "default" : "outline"}
                    className="text-[10px] h-6 px-2"
                    onClick={() => setPresetKey(presetKey === p.key ? "" : p.key)}
                    title={p.desc}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Analysis Tabs */}
        <Tabs defaultValue="rollup" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="rollup" className="gap-1.5 text-xs">
              <ArrowUpFromLine className="w-3.5 h-3.5" /> Roll Up
            </TabsTrigger>
            <TabsTrigger value="rolldown" className="gap-1.5 text-xs">
              <ArrowDownToLine className="w-3.5 h-3.5" /> Roll Down
            </TabsTrigger>
            <TabsTrigger value="economics" className="gap-1.5 text-xs">
              <DollarSign className="w-3.5 h-3.5" /> Economics
            </TabsTrigger>
          </TabsList>

          {/* ── ROLL UP ─────────────────────────────────────────── */}
          <TabsContent value="rollup" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ArrowUpFromLine className="w-4 h-4 text-accent" />
                  Roll-Up Aggregation
                </CardTitle>
                <CardDescription className="text-xs">
                  Aggregate income across all team members to see total org production
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleRollUp} disabled={rollUp.isPending} className="gap-2 mb-4">
                  {rollUp.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpFromLine className="w-4 h-4" />}
                  Run Roll-Up
                </Button>

                {rollUp.data && (
                  <div className="space-y-4">
                    {/* Summary stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <StatCard label="Total GDC" value={fmt(rollUp.data.data.totalGDC)} />
                      <StatCard label="Total Income" value={fmt(rollUp.data.data.totalIncome)} accent />
                      <StatCard label="Total Override" value={fmt(rollUp.data.data.totalOverride)} />
                      <StatCard label="Team Size" value={rollUp.data.data.teamSize.toString()} />
                      <StatCard label="Total AUM" value={fmt(rollUp.data.data.totalAUM)} />
                      <StatCard label="Channel Revenue" value={fmt(rollUp.data.data.totalChannelRev)} />
                      <StatCard label="Avg GDC" value={fmt(rollUp.data.data.avgGDC)} />
                      <StatCard label="Avg Income" value={fmt(rollUp.data.data.avgIncome)} />
                    </div>

                    {/* By role breakdown */}
                    {Object.keys(rollUp.data.data.byRole).length > 0 && (
                      <div>
                        <p className="text-xs font-medium mb-2">By Role</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {Object.entries(rollUp.data.data.byRole).map(([role, data]: [string, any]) => {
                            const roleDef = ROLES.find(r => r.key === role);
                            return (
                              <div key={role} className="p-2 rounded-lg border border-border/50 bg-card/60">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <Badge variant="outline" className="text-[9px] font-mono">{roleDef?.short || role}</Badge>
                                  <span className="text-xs font-medium">{roleDef?.name || role}</span>
                                </div>
                                <div className="text-[10px] text-muted-foreground space-y-0.5">
                                  <div>Count: <span className="text-foreground font-medium">{data.count}</span></div>
                                  <div>Income: <span className="text-accent font-medium">{fmt(data.income)}</span></div>
                                  <div>GDC: <span className="text-foreground font-medium">{fmt(data.gdc)}</span></div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* By stream breakdown */}
                    {Object.keys(rollUp.data.data.byStream).length > 0 && (
                      <div>
                        <p className="text-xs font-medium mb-2">By Income Stream</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {Object.entries(rollUp.data.data.byStream)
                            .filter(([, v]) => (v as number) > 0)
                            .sort(([, a], [, b]) => (b as number) - (a as number))
                            .map(([stream, value]) => (
                              <div key={stream} className="p-2 rounded-lg border border-border/50 bg-card/60 text-center">
                                <div className="text-[10px] text-muted-foreground capitalize">{stream.replace(/([A-Z])/g, " $1")}</div>
                                <div className="text-sm font-mono font-semibold text-accent">{fmt(value as number)}</div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    <Badge variant="outline" className="text-[10px]">{rollUp.data.durationMs}ms</Badge>
                  </div>
                )}

                {!rollUp.data && !rollUp.isPending && (
                  <EmptyState icon={<ArrowUpFromLine className="w-8 h-8" />} text="Click Run Roll-Up to aggregate team income" />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── ROLL DOWN ────────────────────────────────────────── */}
          <TabsContent value="rolldown" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ArrowDownToLine className="w-4 h-4 text-accent" />
                  Roll-Down Target Distribution
                </CardTitle>
                <CardDescription className="text-xs">
                  Set an org income target and cascade it down to per-person quotas with activity funnels
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-end gap-4">
                  <div className="space-y-1 flex-1 max-w-xs">
                    <Label className="text-xs font-medium">Org Income Target</Label>
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-accent" />
                      <Input
                        type="number"
                        value={orgTarget}
                        onChange={e => setOrgTarget(Math.max(1, parseInt(e.target.value) || 100000))}
                        className="h-9 text-sm"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">{fmt(orgTarget)}</p>
                  </div>
                  <Button onClick={handleRollDown} disabled={rollDown.isPending || members.length === 0} className="gap-2">
                    {rollDown.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownToLine className="w-4 h-4" />}
                    Run Roll-Down
                  </Button>
                </div>

                {rollDown.data && (
                  <div className="space-y-3">
                    {(rollDown.data.data as any[]).map((rd: any, i: number) => {
                      const roleDef = ROLES.find(r => r.key === rd.role);
                      return (
                        <div key={i} className="p-3 rounded-lg border border-border/50 bg-card/60 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[9px] font-mono">{roleDef?.short || rd.role}</Badge>
                              <span className="text-xs font-medium">{rd.roleName}</span>
                              <Badge variant="secondary" className="text-[10px]">×{rd.count}</Badge>
                            </div>
                            <span className="text-sm font-semibold text-accent">{fmt(rd.totalTarget)}</span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                            <div>
                              <span className="text-muted-foreground">Per Person:</span>{" "}
                              <span className="font-medium">{fmt(rd.perPersonTarget)}</span>
                            </div>
                            {rd.backPlan && (
                              <>
                                <div>
                                  <span className="text-muted-foreground">Needed GDC:</span>{" "}
                                  <span className="font-medium">{fmt(rd.backPlan.neededGDC)}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Bracket:</span>{" "}
                                  <span className="font-medium">{rd.backPlan.bracketLabel} ({pctFmt(rd.backPlan.bracketRate)})</span>
                                </div>
                                {rd.backPlan.funnel && (
                                  <div>
                                    <span className="text-muted-foreground">Daily approaches:</span>{" "}
                                    <span className="font-medium">{rd.backPlan.funnel.daily?.approaches || "—"}</span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          {/* Activity funnel */}
                          {rd.backPlan?.funnel && (
                            <div className="pt-2 border-t border-border/30">
                              <p className="text-[10px] text-muted-foreground mb-1">Activity Funnel (annual)</p>
                              <div className="flex items-center gap-1 text-[9px]">
                                <FunnelStep label="Approaches" value={rd.backPlan.funnel.annual?.approaches} />
                                <span className="text-muted-foreground">→</span>
                                <FunnelStep label="Set" value={rd.backPlan.funnel.set} />
                                <span className="text-muted-foreground">→</span>
                                <FunnelStep label="Held" value={rd.backPlan.funnel.held} />
                                <span className="text-muted-foreground">→</span>
                                <FunnelStep label="Apps" value={rd.backPlan.funnel.annual?.apps} />
                                <span className="text-muted-foreground">→</span>
                                <FunnelStep label="Placed" value={rd.backPlan.funnel.placed} accent />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <Badge variant="outline" className="text-[10px]">{rollDown.data.durationMs}ms</Badge>
                  </div>
                )}

                {!rollDown.data && !rollDown.isPending && (
                  <EmptyState icon={<ArrowDownToLine className="w-8 h-8" />} text="Set a target and click Run Roll-Down to distribute quotas" />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── ECONOMICS ────────────────────────────────────────── */}
          <TabsContent value="economics" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-accent" />
                  Business Economics
                </CardTitle>
                <CardDescription className="text-xs">
                  CAC, LTV, margins, and ROI for the team strategy
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-end gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Leader Role</Label>
                    <Select value={leaderRole} onValueChange={setLeaderRole}>
                      <SelectTrigger className="h-9 text-xs w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.filter(r => r.level >= 3).map(r => (
                          <SelectItem key={r.key} value={r.key}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Years: {econYears}</Label>
                    <Slider value={[econYears]} onValueChange={([v]) => setEconYears(v)} min={1} max={10} step={1} className="w-32" />
                  </div>
                  <Button onClick={handleEconomics} disabled={economics.isPending || projectIncome.isPending} className="gap-2">
                    {(economics.isPending || projectIncome.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
                    Calculate
                  </Button>
                </div>

                {economics.data && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <StatCard label="Revenue" value={fmt(economics.data.data.revenue)} accent />
                      <StatCard label="Gross Profit" value={fmt(economics.data.data.grossProfit)} />
                      <StatCard label="Net Profit" value={fmt(economics.data.data.netProfit)} accent />
                      <StatCard label="ROI" value={pctFmt(economics.data.data.roi)} />
                      <StatCard label="Gross Margin" value={pctFmt(economics.data.data.grossMarginPct)} />
                      <StatCard label="Net Margin" value={pctFmt(economics.data.data.netMarginPct)} />
                      <StatCard label="CAC" value={fmt(economics.data.data.cac)} />
                      <StatCard label="LTV" value={fmt(economics.data.data.ltv)} />
                      <StatCard label="LTV:CAC Ratio" value={`${economics.data.data.ltvCacRatio.toFixed(1)}x`} accent />
                      <StatCard label="Clients Acquired" value={economics.data.data.clientsAcquired.toString()} />
                      <StatCard label="Year 1 Income" value={fmt(economics.data.data.yr1Income)} />
                      <StatCard label={`Year ${econYears} Income`} value={fmt(economics.data.data.yr5Income)} />
                    </div>

                    {/* Income growth indicator */}
                    {economics.data.data.yr1Income > 0 && (
                      <div className="p-3 rounded-lg border border-accent/20 bg-accent/5">
                        <div className="flex items-center gap-2 text-xs">
                          <TrendingUp className="w-4 h-4 text-accent" />
                          <span className="font-medium">
                            {econYears}-Year Growth: {fmt(economics.data.data.yr1Income)} → {fmt(economics.data.data.yr5Income)}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {economics.data.data.yr1Income > 0
                              ? `+${(((economics.data.data.yr5Income / economics.data.data.yr1Income) - 1) * 100).toFixed(0)}%`
                              : "—"}
                          </Badge>
                        </div>
                      </div>
                    )}

                    <Badge variant="outline" className="text-[10px]">{economics.data.durationMs}ms</Badge>
                  </div>
                )}

                {/* Income projection from preset */}
                {projectIncome.data && !economics.data && (
                  <div className="space-y-3">
                    <p className="text-xs font-medium">Income Projection ({presetKey})</p>
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-1">
                        {(projectIncome.data.data as any[]).map((yr: any) => (
                          <div key={yr.year} className="flex items-center gap-2 p-1.5 rounded text-xs border border-border/30">
                            <Badge variant="outline" className="text-[10px] font-mono w-12 justify-center">Y{yr.year}</Badge>
                            <div className="flex-1 grid grid-cols-3 gap-2">
                              <span>Income: <span className="text-accent font-medium">{fmt(yr.totalIncome)}</span></span>
                              <span>Net: <span className="font-medium">{fmt(yr.netIncome)}</span></span>
                              <span>Team: <span className="font-medium">{yr.teamSize}</span></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {!economics.data && !projectIncome.data && !economics.isPending && !projectIncome.isPending && (
                  <EmptyState icon={<DollarSign className="w-8 h-8" />} text="Select a leader role and click Calculate for business economics" />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Disclaimer */}
        <p className="text-[10px] text-muted-foreground/50 text-center max-w-2xl mx-auto">
          All projections are hypothetical illustrations. Team income modeling uses GDC bracket rates and default assumptions.
          Actual results depend on individual production, retention, and market conditions. Not investment, tax, or legal advice.
        </p>
      </div>
    </AppShell>
  );
}

// ─── HELPER COMPONENTS ──────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="p-2 rounded-lg border border-border/50 bg-card/60 text-center">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`text-sm font-mono font-semibold ${accent ? "text-accent" : ""}`}>{value}</div>
    </div>
  );
}

function FunnelStep({ label, value, accent }: { label: string; value?: number; accent?: boolean }) {
  return (
    <div className={`px-1.5 py-0.5 rounded border ${accent ? "border-accent/30 bg-accent/10" : "border-border/50 bg-card/60"} text-center`}>
      <div className="text-muted-foreground">{label}</div>
      <div className={`font-mono font-medium ${accent ? "text-accent" : ""}`}>{value ?? "—"}</div>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground/40">
      {icon}
      <p className="text-xs mt-2">{text}</p>
    </div>
  );
}
