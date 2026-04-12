/**
 * BIE Team Builder — Roll-up / Roll-down / Economics / Channels / Campaigns
 *
 * Surfaces the BIE team-level capabilities that EngineDashboard doesn't expose:
 *   - Team composition editor (add members by role)
 *   - Roll-up: aggregate team income across all roles
 *   - Roll-down: cascade an org target to per-role quotas
 *   - Economics: 5-year P&L with CAC, LTV, margins
 *   - Channel spend allocation + ROI
 *   - Campaign periods with boost %
 *
 * tRPC namespace: calculatorEngine.bie*
 */

import { useState, useMemo, useEffect } from "react";
import AppShell from "@/components/AppShell";
import { persistCalculation } from "@/lib/calculatorContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Users, Plus, Trash2, Target, TrendingUp, DollarSign, BarChart3,
  Loader2, Play, ArrowDown, ArrowUp, Briefcase, Megaphone, Calendar, Crosshair,
} from "lucide-react";
import { sendFeedback } from "@/lib/feedbackSpecs";
import BackPlanFunnel from "@/components/BackPlanFunnel";

/* ── helpers ───────────────────────────────────────────────────── */

const fmt = (n: number) => {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

const ROLES = [
  { key: "new", label: "New Associate" },
  { key: "exp", label: "Experienced Pro" },
  { key: "sa", label: "Senior Associate" },
  { key: "dir", label: "Director" },
  { key: "md", label: "Managing Director" },
  { key: "rvp", label: "RVP" },
  { key: "affA", label: "Affiliate A" },
  { key: "affB", label: "Affiliate B" },
  { key: "affC", label: "Affiliate C" },
  { key: "affD", label: "Affiliate D" },
  { key: "partner", label: "Strategic Partner" },
];

interface TeamMember {
  id: string;
  name: string;
  role: string;
  personalGDC: number;
}

interface Campaign {
  id: string;
  name: string;
  startMonth: number;
  endMonth: number;
  boostPct: number;
}

/* ── component ─────────────────────────────────────────────────── */

export default function TeamBuilder() {
  const [tab, setTab] = useState("compose");

  // Team composition
  const [members, setMembers] = useState<TeamMember[]>([
    { id: "m1", name: "Alice", role: "dir", personalGDC: 250000 },
    { id: "m2", name: "Bob", role: "exp", personalGDC: 120000 },
    { id: "m3", name: "Carol", role: "new", personalGDC: 60000 },
  ]);

  // Roll-down target
  const [orgTarget, setOrgTarget] = useState(1000000);

  // Channel spend
  const [channelSpend, setChannelSpend] = useState<Record<string, number>>({
    digital: 5000,
    referral: 2000,
    seminar: 3000,
  });

  // Campaigns
  const [campaigns, setCampaigns] = useState<Campaign[]>([
    { id: "c1", name: "Q4 Push", startMonth: 10, endMonth: 12, boostPct: 0.15 },
  ]);

  // Growth
  const [personalGrowth, setPersonalGrowth] = useState(0.05);
  const [teamGrowth, setTeamGrowth] = useState(0.08);
  const [years, setYears] = useState(5);

  // Back-plan
  const [targetIncome, setTargetIncome] = useState(200000);
  const [backPlanRole, setBackPlanRole] = useState("dir");

  // Build strategies for API calls
  type BIERole = "new" | "exp" | "sa" | "dir" | "md" | "rvp" | "affA" | "affB" | "affC" | "affD" | "partner";

  const strategies = useMemo(() => members.map((m) => ({
    name: m.name,
    role: m.role as BIERole,
    personalGDC: m.personalGDC,
    personalGrowth,
    teamGrowth,
    streams: { personal: true, expanded: true, override: m.role !== "new" },
    team: [] as { name: string; role: BIERole; fyc: number; f: number }[],
    channelSpend,
    campaigns: campaigns.map((c) => ({
      name: c.name,
      startMonth: c.startMonth,
      endMonth: c.endMonth,
      boostPct: c.boostPct,
    })),
  })), [members, personalGrowth, teamGrowth, channelSpend, campaigns]);

  // tRPC mutations
  const rollUp = trpc.calculatorEngine.bieRollUp.useMutation({
    onSuccess: () => sendFeedback("calculator.result"),
  });
  const rollDown = trpc.calculatorEngine.bieRollDown.useMutation({
    onSuccess: () => sendFeedback("calculator.result"),
  });
  const economics = trpc.calculatorEngine.bieEconomics.useMutation({
    onSuccess: () => sendFeedback("calculator.result"),
  });
  const bieBackPlan = trpc.calculatorEngine.bieBackPlan.useMutation({
    onSuccess: () => sendFeedback("calculator.result"),
  });

  // Queries
  const channelsQ = trpc.calculatorEngine.bieChannels.useQuery(undefined, { retry: false });

  const addMember = () => {
    setMembers((prev) => [
      ...prev,
      { id: `m${Date.now()}`, name: `Member ${prev.length + 1}`, role: "new", personalGDC: 60000 },
    ]);
  };

  const removeMember = (id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const updateMember = (id: string, patch: Partial<TeamMember>) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const addCampaign = () => {
    setCampaigns((prev) => [
      ...prev,
      { id: `c${Date.now()}`, name: `Campaign ${prev.length + 1}`, startMonth: 1, endMonth: 3, boostPct: 0.1 },
    ]);
  };

  const removeCampaign = (id: string) => {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
  };

  const runRollUp = () => {
    if (strategies.length === 0) { toast.error("Add at least one team member"); return; }
    rollUp.mutate({ strategies, year: years });
  };

  const runRollDown = () => {
    if (strategies.length === 0) { toast.error("Add at least one team member"); return; }
    rollDown.mutate({ strategy: strategies[0], year: years });
  };

  const runEconomics = () => {
    if (strategies.length === 0) { toast.error("Add at least one team member"); return; }
    economics.mutate({ strategy: strategies[0], years });
  };

  const runBackPlan = () => {
    bieBackPlan.mutate({ targetIncome, role: backPlanRole as any });
  };

  const isLoading = rollUp.isPending || rollDown.isPending || economics.isPending || bieBackPlan.isPending;

  // ── Persist roll-up results to calculator context bridge ──
  useEffect(() => {
    if (!rollUp.data) return;
    const d = rollUp.data as any;
    persistCalculation({
      id: `bie-team-rollup-${members.length}m`,
      type: "bie",
      title: `BIE Team Roll-Up — ${members.length} members`,
      summary: `Total GDC: $${Math.round(d.totalGDC ?? 0).toLocaleString()}, Total Income: $${Math.round(d.totalIncome ?? 0).toLocaleString()}, Override: $${Math.round(d.totalOverride ?? 0).toLocaleString()}, AUM: $${Math.round(d.totalAUM ?? 0).toLocaleString()}.`,
      inputs: { teamSize: members.length, roles: members.map(m => m.role), years, personalGrowth, teamGrowth },
      outputs: { totalGDC: d.totalGDC, totalIncome: d.totalIncome, totalOverride: d.totalOverride, totalAUM: d.totalAUM },
      timestamp: Date.now(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollUp.data]);

  // ── Persist economics results to calculator context bridge ──
  useEffect(() => {
    if (!economics.data) return;
    const d = economics.data as any;
    persistCalculation({
      id: `bie-economics-${years}yr`,
      type: "bie",
      title: `BIE Economics — ${years}-year P&L`,
      summary: `Revenue Yr1: $${Math.round(d.yr1Income ?? 0).toLocaleString()}, Yr5: $${Math.round(d.yr5Income ?? 0).toLocaleString()}, CAC: $${Math.round(d.cac ?? 0).toLocaleString()}, LTV: $${Math.round(d.ltv ?? 0).toLocaleString()}, LTV:CAC: ${(d.ltvCacRatio ?? 0).toFixed(1)}x.`,
      inputs: { years, personalGrowth, teamGrowth },
      outputs: { yr1Income: d.yr1Income, yr5Income: d.yr5Income, cac: d.cac, ltv: d.ltv, ltvCacRatio: d.ltvCacRatio },
      timestamp: Date.now(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [economics.data]);

  return (
    <AppShell title="BIE Team Builder">
      <div className="max-w-6xl mx-auto space-y-6 p-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-accent" />
              Team Builder
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Build your team, set targets, and see the full income picture with roll-up, roll-down, and economics.
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            {members.length} member{members.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full">
            <TabsTrigger value="compose" className="gap-1 text-xs"><Users className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Compose</span></TabsTrigger>
            <TabsTrigger value="rollup" className="gap-1 text-xs"><ArrowUp className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Roll-</span>Up</TabsTrigger>
            <TabsTrigger value="rolldown" className="gap-1 text-xs"><ArrowDown className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Roll-</span>Down</TabsTrigger>
            <TabsTrigger value="backplan" className="gap-1 text-xs"><Crosshair className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Back-</span>Plan</TabsTrigger>
            <TabsTrigger value="economics" className="gap-1 text-xs"><BarChart3 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Econ</span></TabsTrigger>
            <TabsTrigger value="campaigns" className="gap-1 text-xs"><Megaphone className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Campaigns</span></TabsTrigger>
          </TabsList>

          {/* ── COMPOSE TAB ──────────────────────────────────── */}
          <TabsContent value="compose" className="space-y-4 mt-4">
            {/* Quick-start presets */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Play className="h-3.5 w-3.5" /> Quick Start — Load a Preset Team
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {[
                  { key: "solo", label: "Solo New Associate", members: [{ id: `p${Date.now()}`, name: "You", role: "new", personalGDC: 65000 }] },
                  { key: "exp", label: "Experienced Pro", members: [{ id: `p${Date.now()}`, name: "You", role: "exp", personalGDC: 150000 }] },
                  { key: "dir", label: "Director + 3", members: [
                    { id: `p1${Date.now()}`, name: "Director", role: "dir", personalGDC: 220000 },
                    { id: `p2${Date.now()}`, name: "Sr Assoc", role: "sa", personalGDC: 180000 },
                    { id: `p3${Date.now()}`, name: "Assoc 1", role: "exp", personalGDC: 120000 },
                    { id: `p4${Date.now()}`, name: "New Hire", role: "new", personalGDC: 65000 },
                  ]},
                  { key: "md", label: "MD Team (6)", members: [
                    { id: `p1${Date.now()}`, name: "MD", role: "md", personalGDC: 280000 },
                    { id: `p2${Date.now()}`, name: "Dir 1", role: "dir", personalGDC: 220000 },
                    { id: `p3${Date.now()}`, name: "Dir 2", role: "dir", personalGDC: 200000 },
                    { id: `p4${Date.now()}`, name: "SA 1", role: "sa", personalGDC: 180000 },
                    { id: `p5${Date.now()}`, name: "Exp 1", role: "exp", personalGDC: 120000 },
                    { id: `p6${Date.now()}`, name: "New 1", role: "new", personalGDC: 65000 },
                  ]},
                ].map((preset) => (
                  <Button
                    key={preset.key}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setMembers(preset.members)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="h-4 w-4" /> Team Composition
                </CardTitle>
                <CardDescription>Add team members and assign roles. Each member generates an income projection.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card/50">
                    <Input
                      value={m.name}
                      onChange={(e) => updateMember(m.id, { name: e.target.value })}
                      className="w-36 text-sm"
                      placeholder="Name"
                    />
                    <Select value={m.role} onValueChange={(v) => updateMember(m.id, { role: v })}>
                      <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1.5 flex-1">
                      <Label className="text-[10px] text-muted-foreground whitespace-nowrap">GDC</Label>
                      <Input
                        type="number"
                        value={m.personalGDC}
                        onChange={(e) => updateMember(m.id, { personalGDC: Number(e.target.value) || 0 })}
                        className="w-28 text-sm"
                      />
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {ROLES.find((r) => r.key === m.role)?.label ?? m.role}
                    </Badge>
                    <Button variant="ghost" size="icon" onClick={() => removeMember(m.id)} className="h-8 w-8" aria-label={`Remove ${m.name}`}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addMember} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Add Member
                </Button>
              </CardContent>
            </Card>

            {/* Growth settings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Growth Assumptions
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Personal Growth</Label>
                  <div className="flex items-center gap-2">
                    <Slider value={[personalGrowth * 100]} onValueChange={([v]) => setPersonalGrowth(v / 100)} min={0} max={20} step={0.5} className="flex-1" />
                    <span className="text-xs font-medium w-10 text-right">{pct(personalGrowth)}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Team Growth</Label>
                  <div className="flex items-center gap-2">
                    <Slider value={[teamGrowth * 100]} onValueChange={([v]) => setTeamGrowth(v / 100)} min={0} max={25} step={0.5} className="flex-1" />
                    <span className="text-xs font-medium w-10 text-right">{pct(teamGrowth)}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Projection Years</Label>
                  <div className="flex items-center gap-2">
                    <Slider value={[years]} onValueChange={([v]) => setYears(v)} min={1} max={30} step={1} className="flex-1" />
                    <span className="text-xs font-medium w-10 text-right">{years}yr</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Channel spend */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Channel Spend
                </CardTitle>
                <CardDescription>Monthly spend per marketing channel. Affects CAC and channel revenue in economics.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(channelsQ.data ?? [{ key: "digital", label: "Digital" }, { key: "referral", label: "Referral" }, { key: "seminar", label: "Seminar" }]).map((ch: any) => (
                  <div key={ch.key} className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">{ch.label ?? ch.key}</Label>
                    <Input
                      type="number"
                      value={channelSpend[ch.key] ?? 0}
                      onChange={(e) => setChannelSpend((prev) => ({ ...prev, [ch.key]: Number(e.target.value) || 0 }))}
                      className="text-sm"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── ROLL-UP TAB ──────────────────────────────────── */}
          <TabsContent value="rollup" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-heading font-semibold flex items-center gap-2">
                  <ArrowUp className="h-5 w-5 text-accent" /> Team Roll-Up
                </h2>
                <p className="text-sm text-muted-foreground">Aggregate all team members' income projections into a single org-level view.</p>
              </div>
              <Button onClick={runRollUp} disabled={isLoading} className="gap-1.5">
                {rollUp.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Run Roll-Up
              </Button>
            </div>

            {rollUp.data && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total GDC" value={fmt(rollUp.data.totalGDC ?? 0)} icon={DollarSign} />
                <StatCard label="Total Income" value={fmt(rollUp.data.totalIncome ?? 0)} icon={TrendingUp} />
                <StatCard label="Total Override" value={fmt(rollUp.data.totalOverride ?? 0)} icon={Briefcase} />
                <StatCard label="Team Size" value={String(rollUp.data.teamSize ?? members.length)} icon={Users} />
                <StatCard label="Total AUM" value={fmt(rollUp.data.totalAUM ?? 0)} icon={BarChart3} />
                <StatCard label="Channel Revenue" value={fmt(rollUp.data.totalChannelRev ?? 0)} icon={Megaphone} />
                <StatCard label="Total Cost" value={fmt(rollUp.data.totalCost ?? 0)} icon={Target} />
                <StatCard label="Avg GDC" value={fmt(rollUp.data.avgGDC ?? 0)} icon={DollarSign} />
              </div>
            )}

            {rollUp.data?.byRole && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">By Role</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(rollUp.data.byRole as Record<string, any>).map(([role, data]) => (
                      <div key={role} className="flex items-center justify-between p-2 rounded border">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{role}</Badge>
                          <span className="text-sm">{(data as any).count ?? 1} member(s)</span>
                        </div>
                        <span className="text-sm font-medium">{fmt((data as any).income ?? 0)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {rollUp.data?.byStream && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">By Income Stream</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(rollUp.data.byStream as Record<string, any>).map(([stream, value]) => (
                      <div key={stream} className="flex items-center justify-between p-2 rounded border">
                        <span className="text-sm capitalize">{stream.replace(/([A-Z])/g, " $1").trim()}</span>
                        <span className="text-sm font-medium">{fmt(typeof value === "number" ? value : 0)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── ROLL-DOWN TAB ────────────────────────────────── */}
          <TabsContent value="rolldown" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-heading font-semibold flex items-center gap-2">
                  <ArrowDown className="h-5 w-5 text-accent" /> Org Roll-Down
                </h2>
                <p className="text-sm text-muted-foreground">
                  Set an organization income target and cascade per-role quotas to each team member.
                </p>
              </div>
              <Button onClick={runRollDown} disabled={isLoading} className="gap-1.5">
                {rollDown.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Run Roll-Down
              </Button>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Organization Income Target</Label>
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      value={orgTarget}
                      onChange={(e) => setOrgTarget(Number(e.target.value) || 0)}
                      className="w-48"
                    />
                    <span className="text-sm text-muted-foreground">{fmt(orgTarget)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {rollDown.data && Array.isArray(rollDown.data) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Per-Role Targets</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(rollDown.data as any[]).map((row: any, i: number) => {
                      const targetPct = orgTarget > 0 ? ((row.totalTarget ?? 0) / orgTarget) : 0;
                      return (
                        <div key={i} className="p-3 rounded-lg border space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge className="text-[10px]">{row.roleName ?? row.role}</Badge>
                              <span className="text-sm text-muted-foreground">{row.count ?? 1} member(s)</span>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium">{fmt(row.totalTarget ?? 0)}</div>
                              <div className="text-[10px] text-muted-foreground">
                                {fmt(row.perPersonTarget ?? 0)} / person
                              </div>
                            </div>
                          </div>
                          <Progress value={targetPct * 100} className="h-1.5" />
                          {row.backPlan && (
                            <div className="grid grid-cols-5 gap-2 text-[10px] text-muted-foreground">
                              <div>Approaches: <span className="text-foreground font-medium">{row.backPlan.daily?.approaches ?? "—"}/day</span></div>
                              <div>Sets: <span className="text-foreground font-medium">{row.backPlan.daily?.sets ?? "—"}/day</span></div>
                              <div>Held: <span className="text-foreground font-medium">{row.backPlan.daily?.held ?? "—"}/day</span></div>
                              <div>Apps: <span className="text-foreground font-medium">{row.backPlan.daily?.apps ?? "—"}/day</span></div>
                              <div>Placed: <span className="text-foreground font-medium">{row.backPlan.daily?.placed ?? "—"}/day</span></div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── BACK-PLAN TAB ───────────────────────────────── */}
          <TabsContent value="backplan" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-heading font-semibold flex items-center gap-2">
                  <Crosshair className="h-5 w-5 text-accent" /> Income Back-Plan
                </h2>
                <p className="text-sm text-muted-foreground">
                  Set a target annual income and see exactly what activity is required to achieve it.
                </p>
              </div>
              <Button onClick={runBackPlan} disabled={isLoading} className="gap-1.5">
                {bieBackPlan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Solve Back-Plan
              </Button>
            </div>

            <Card>
              <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Target Annual Income</Label>
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      value={targetIncome}
                      onChange={(e) => setTargetIncome(Number(e.target.value) || 0)}
                      className="w-48"
                      step={10000}
                    />
                    <span className="text-sm text-muted-foreground">{fmt(targetIncome)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Role for Back-Plan</Label>
                  <Select value={backPlanRole} onValueChange={setBackPlanRole}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {bieBackPlan.data && (
              <BackPlanFunnel
                result={bieBackPlan.data as any}
                targetIncome={targetIncome}
                title="Activity Funnel — What It Takes"
              />
            )}
          </TabsContent>

          {/* ── ECONOMICS TAB ────────────────────────────────── */}
          <TabsContent value="economics" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-heading font-semibold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-accent" /> Business Economics
                </h2>
                <p className="text-sm text-muted-foreground">
                  5-year P&L, margins, CAC, LTV, and ROI for the lead team member's strategy.
                </p>
              </div>
              <Button onClick={runEconomics} disabled={isLoading} className="gap-1.5">
                {economics.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Run Economics
              </Button>
            </div>

            {economics.data && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Revenue (Yr 1)" value={fmt((economics.data as any).yr1Income ?? 0)} icon={DollarSign} />
                  <StatCard label="Revenue (Yr 5)" value={fmt((economics.data as any).yr5Income ?? 0)} icon={TrendingUp} />
                  <StatCard label="Gross Margin" value={pct((economics.data as any).grossMarginPct ?? 0)} icon={BarChart3} />
                  <StatCard label="Net Margin" value={pct((economics.data as any).netMarginPct ?? 0)} icon={Target} />
                  <StatCard label="CAC" value={fmt((economics.data as any).cac ?? 0)} icon={DollarSign} />
                  <StatCard label="LTV" value={fmt((economics.data as any).ltv ?? 0)} icon={TrendingUp} />
                  <StatCard label="LTV:CAC" value={`${((economics.data as any).ltvCacRatio ?? 0).toFixed(1)}x`} icon={Briefcase} />
                  <StatCard label="ROI" value={pct((economics.data as any).roi ?? 0)} icon={BarChart3} />
                </div>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">P&L Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex justify-between p-2 rounded border">
                        <span className="text-muted-foreground">Revenue</span>
                        <span className="font-medium">{fmt((economics.data as any).revenue ?? 0)}</span>
                      </div>
                      <div className="flex justify-between p-2 rounded border">
                        <span className="text-muted-foreground">COGS</span>
                        <span className="font-medium">{fmt((economics.data as any).cogs ?? 0)}</span>
                      </div>
                      <div className="flex justify-between p-2 rounded border">
                        <span className="text-muted-foreground">Gross Profit</span>
                        <span className="font-medium">{fmt((economics.data as any).grossProfit ?? 0)}</span>
                      </div>
                      <div className="flex justify-between p-2 rounded border">
                        <span className="text-muted-foreground">Net Profit</span>
                        <span className="font-medium">{fmt((economics.data as any).netProfit ?? 0)}</span>
                      </div>
                      <div className="flex justify-between p-2 rounded border">
                        <span className="text-muted-foreground">Clients Acquired</span>
                        <span className="font-medium">{(economics.data as any).clientsAcquired ?? 0}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ── CAMPAIGNS TAB ────────────────────────────────── */}
          <TabsContent value="campaigns" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Campaign Periods
                </CardTitle>
                <CardDescription>
                  Define campaign windows that boost production during specific months.
                  These feed into the BIE seasonality model.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {campaigns.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card/50">
                    <Input
                      value={c.name}
                      onChange={(e) => setCampaigns((prev) => prev.map((x) => x.id === c.id ? { ...x, name: e.target.value } : x))}
                      className="w-36 text-sm"
                      placeholder="Campaign name"
                    />
                    <div className="flex items-center gap-1.5">
                      <Label className="text-[10px] text-muted-foreground">Start</Label>
                      <Input
                        type="number"
                        value={c.startMonth}
                        onChange={(e) => setCampaigns((prev) => prev.map((x) => x.id === c.id ? { ...x, startMonth: Math.max(1, Math.min(12, Number(e.target.value) || 1)) } : x))}
                        className="w-16 text-sm"
                        min={1}
                        max={12}
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Label className="text-[10px] text-muted-foreground">End</Label>
                      <Input
                        type="number"
                        value={c.endMonth}
                        onChange={(e) => setCampaigns((prev) => prev.map((x) => x.id === c.id ? { ...x, endMonth: Math.max(1, Math.min(12, Number(e.target.value) || 12)) } : x))}
                        className="w-16 text-sm"
                        min={1}
                        max={12}
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Label className="text-[10px] text-muted-foreground">Boost</Label>
                      <Input
                        type="number"
                        value={Math.round(c.boostPct * 100)}
                        onChange={(e) => setCampaigns((prev) => prev.map((x) => x.id === c.id ? { ...x, boostPct: (Number(e.target.value) || 0) / 100 } : x))}
                        className="w-16 text-sm"
                      />
                      <span className="text-[10px] text-muted-foreground">%</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeCampaign(c.id)} className="h-8 w-8" aria-label={`Remove ${c.name}`}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addCampaign} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Add Campaign
                </Button>
              </CardContent>
            </Card>

            {/* Seasonality info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Seasonality Profiles</CardTitle>
                <CardDescription>Campaigns modify the base seasonality profile. The BIE engine supports: flat, Q4-heavy, summer, event-driven, ramp, and custom profiles.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {["flat", "q4Heavy", "summer", "eventDriven", "ramp", "custom"].map((p) => (
                    <Badge key={p} variant="outline" className="justify-center py-1.5 text-xs capitalize">
                      {p.replace(/([A-Z])/g, " $1")}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

/* ── StatCard helper ─────────────────────────────────────────── */

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <Card className="card-lift">
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-3.5 w-3.5 text-accent" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
        </div>
        <div className="text-lg font-heading font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
