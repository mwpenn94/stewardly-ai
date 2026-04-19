import { fmt, fmtSm, pct } from './format';
/* ═══════════════════════════════════════════════════════════════
   PanelsG — AUM Override Cascade, AUM Pipeline, Affiliate Pipeline,
             Activity Metrics, Production Forecasting
   ═══════════════════════════════════════════════════════════════ */
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KPI, RefTip } from './shared';
import { SectionHeader, PInput } from './shared-ui';
import {
  solveOverrideFormula, DEFAULT_OVERRIDE_RATE, DEFAULT_TIERS,
  DEFAULT_FEE_BREAKPOINTS, getBlendedFeeRate,
  DEFAULT_AUM_PIPELINE, DEFAULT_AFFILIATE_RECRUITING_PIPELINE,
  DEFAULT_AFFILIATE_PRODUCTION_PIPELINE,
  calcAUMOverride, calcTeamAUMOverrides, calcAUMPipeline,
  calcAffiliatePipeline, calcActivityMetrics, calcProductionForecast,
  buildRampSchedule, calcWhatIfScenario,
  type AUMTeamMember, type HierarchyTier, type AUMPipelineStage,
  type AffiliatePipelineStage, type ActivityMetrics,
} from './aumEngine';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Area, AreaChart, Cell,
} from 'recharts';

/* ═══ SMALL HELPERS ═══ */
/* PInput → imported from shared-ui */

/* SectionHeader → imported from shared-ui */

/* ═══════════════════════════════════════════════════════════════
   PANEL: AUM OVERRIDE CASCADE
   The core p² + p − 1/3 = 0 → 26.375% implementation
   ═══════════════════════════════════════════════════════════════ */
export function AUMOverrideCascadePanel() {
  // Hierarchy tiers (user-adjustable)
  const [tiers, setTiers] = useState<HierarchyTier[]>(() => [...DEFAULT_TIERS]);

  // Team members
  const [members, setMembers] = useState<AUMTeamMember[]>(() => [
    { id: '1', name: 'Advisor A', role: 'advisor', aumTotal: 1000000, gdcRetainedPct: 80, feeSchedulePct: 1.0, billingFreq: 'quarterly' },
    { id: '2', name: 'Advisor B', role: 'advisor', aumTotal: 750000, gdcRetainedPct: 75, feeSchedulePct: 1.0, billingFreq: 'quarterly' },
    { id: '3', name: 'Advisor C', role: 'advisor', aumTotal: 500000, gdcRetainedPct: 70, feeSchedulePct: 1.0, billingFreq: 'quarterly' },
  ]);

  // What-if scenario
  const [wiAdvisors, setWiAdvisors] = useState(3);
  const [wiAvgProd, setWiAvgProd] = useState(800000);
  const [wiGdcPct, setWiGdcPct] = useState(75);

  const formulaRoot = useMemo(() => solveOverrideFormula(), []);
  const teamResult = useMemo(() => calcTeamAUMOverrides(members, tiers), [members, tiers]);
  const whatIfResult = useMemo(() => calcWhatIfScenario(
    members,
    { label: 'Scenario', additionalAdvisors: wiAdvisors, avgProductionPerAdvisor: wiAvgProd, gdcRetainedPct: wiGdcPct },
    tiers
  ), [members, tiers, wiAdvisors, wiAvgProd, wiGdcPct]);

  const updateMember = (idx: number, field: keyof AUMTeamMember, value: string | number) => {
    const next = [...members];
    (next[idx] as any)[field] = value;
    setMembers(next);
  };

  const updateTier = (idx: number, rate: number) => {
    const next = [...tiers];
    next[idx] = { ...next[idx], overrideRate: rate / 100, isFormulaDefault: false };
    setTiers(next);
  };

  return (
    <section aria-label="AUM Override Cascade" role="region">
      <h2 className="text-lg font-bold text-foreground mb-1">AUM Override Cascade</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Hierarchy-based override calculation using the formula p² + p − 1/3 = 0 (root ≈ 26.375%).
        All rates are user-adjustable. Formula-derived defaults are highlighted.
      </p>

      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="text-primary">Override Cascade</span>
            <Badge variant="outline" className="text-[10px]">p² + p − 1/3 = 0</Badge>
            <Badge variant="outline" className="text-[10px] text-green-400">Root: {(formulaRoot * 100).toFixed(3)}%</Badge>
            <RefTip text="The quadratic p² + p − 1/3 = 0 yields ≈26.375% as the blended effective override rate for MDs/RVPs. Individual tier rates default to 20% of immediate reports' payable earnings. Any GDC retained below 90% triggers upline override." refId="commission" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Formula Explanation */}
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1"><b className="text-foreground">Formula:</b> p² + p − 1/3 = 0</p>
            <p className="text-xs text-muted-foreground mb-1"><b className="text-foreground">Positive root:</b> p = (-1 + √(1 + 4/3)) / 2 ≈ <span className="text-green-400 font-bold">{(formulaRoot * 100).toFixed(3)}%</span></p>
            <p className="text-[10px] text-muted-foreground">This is the default blended effective override rate for Managing Directors and Regional Vice Presidents. For an individual advisor with X% of GDC retained (anything &lt; 90% triggers override), the upline at the next tier earns a percentage of the advisor's payable earnings.</p>
          </div>

          {/* Hierarchy Tiers (adjustable) */}
          <SectionHeader>Hierarchy Override Tiers (adjustable)</SectionHeader>
          <div className="space-y-2">
            {tiers.map((tier, i) => (
              <div key={tier.id} className="flex items-center gap-3 text-xs">
                <span className="w-40 font-semibold">{tier.label}</span>
                <PInput label="" value={Math.round(tier.overrideRate * 100 * 100) / 100}
                  onChange={v => updateTier(i, +v || 0)} suffix="%" className="w-20" />
                {tier.isFormulaDefault && (
                  <Badge variant="outline" className="text-[9px] text-primary">Formula Default</Badge>
                )}
                {!tier.isFormulaDefault && (
                  <Button variant="ghost" size="sm" className="h-5 text-[9px] text-primary"
                    onClick={() => {
                      const next = [...tiers];
                      next[i] = { ...DEFAULT_TIERS[i], isFormulaDefault: true };
                      setTiers(next);
                    }}>Reset</Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" className="text-[11px] h-7"
              onClick={() => setTiers([...tiers, { id: `custom-${tiers.length}`, label: `Custom Tier ${tiers.length + 1}`, overrideRate: 0.10, isFormulaDefault: false }])}>
              + Add Tier
            </Button>
          </div>

          <Separator />

          {/* Team Members */}
          <SectionHeader>Team Members ({members.length})</SectionHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-muted/40 text-foreground/90">
                  <th className="px-2 py-1.5 text-left font-semibold">Name</th>
                  <th className="px-2 py-1.5 text-right font-semibold">AUM</th>
                  <th className="px-2 py-1.5 text-right font-semibold">GDC Retained %</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Fee %</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Annual Fees</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Payable</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Total Override</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Net to Advisor</th>
                  <th className="px-2 py-1.5 text-center font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {teamResult.memberResults.map((r, i) => (
                  <tr key={r.member.id} className="border-b border-border/30 hover:bg-card/50">
                    <td className="px-2 py-1">
                      <Input value={r.member.name} onChange={e => updateMember(i, 'name', e.target.value)}
                        className="h-6 w-28 text-xs" />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <Input type="number" value={r.member.aumTotal} onChange={e => updateMember(i, 'aumTotal', +e.target.value || 0)}
                        className="h-6 w-28 text-xs text-right" />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <Input type="number" value={r.member.gdcRetainedPct} onChange={e => updateMember(i, 'gdcRetainedPct', +e.target.value || 0)}
                        className="h-6 w-16 text-xs text-right" />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <Input type="number" value={r.member.feeSchedulePct} step="0.05" onChange={e => updateMember(i, 'feeSchedulePct', +e.target.value || 0)}
                        className="h-6 w-16 text-xs text-right" />
                    </td>
                    <td className="px-2 py-1 text-right">{fmt(r.annualFees)}</td>
                    <td className="px-2 py-1 text-right text-green-400">{fmt(r.payableEarnings)}</td>
                    <td className="px-2 py-1 text-right text-amber-400">{fmt(r.totalOverride)}</td>
                    <td className="px-2 py-1 text-right text-green-400 font-semibold">{fmt(r.netToAdvisor)}</td>
                    <td className="px-2 py-1 text-center">
                      <Button variant="ghost" size="sm" className="h-5 text-red-400 text-[10px] px-1"
                        onClick={() => setMembers(members.filter((_, j) => j !== i))}>✕</Button>
                    </td>
                  </tr>
                ))}
                <tr className="bg-primary/5 font-semibold border-t border-primary/20">
                  <td className="px-2 py-1.5">TOTAL ({members.length} advisors)</td>
                  <td className="px-2 py-1.5 text-right">{fmt(teamResult.totalAUM)}</td>
                  <td className="px-2 py-1.5 text-right">—</td>
                  <td className="px-2 py-1.5 text-right">{(teamResult.blendedFeeRate * 100).toFixed(2)}%</td>
                  <td className="px-2 py-1.5 text-right">{fmt(teamResult.totalFees)}</td>
                  <td className="px-2 py-1.5 text-right text-green-400">{fmt(teamResult.totalPayable)}</td>
                  <td className="px-2 py-1.5 text-right text-amber-400">{fmt(teamResult.totalOverride)}</td>
                  <td className="px-2 py-1.5 text-right text-green-400 font-bold">{fmt(teamResult.totalNetToAdvisors)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>

          <Button variant="outline" size="sm" className="text-[11px] h-7"
            onClick={() => setMembers([...members, {
              id: String(Date.now()),
              name: `Advisor ${members.length + 1}`,
              role: 'advisor',
              aumTotal: 500000,
              gdcRetainedPct: 75,
              feeSchedulePct: 1.0,
              billingFreq: 'quarterly',
            }])}>
            + Add Team Member
          </Button>

          {/* KPI Summary */}
          <div className="flex flex-wrap gap-2">
            <KPI label="Total AUM" value={fmtSm(teamResult.totalAUM)} variant="blu" />
            <KPI label="Total Fees" value={fmtSm(teamResult.totalFees)} variant="" />
            <KPI label="Total Payable" value={fmtSm(teamResult.totalPayable)} variant="grn" />
            <KPI label="Total Override" value={fmtSm(teamResult.totalOverride)} variant="gld" />
            <KPI label="Blended Override %" value={(teamResult.blendedOverrideRate * 100).toFixed(1) + '%'} variant="gld" />
            <KPI label="Net to Advisors" value={fmtSm(teamResult.totalNetToAdvisors)} variant="grn" />
          </div>

          {/* Override Cascade Visualization */}
          <SectionHeader>Override Cascade Per Tier</SectionHeader>
          {teamResult.memberResults.length > 0 && (
            <div className="space-y-2">
              {teamResult.memberResults.map(r => (
                <div key={r.member.id} className="bg-muted/20 rounded-lg p-2">
                  <p className="text-xs font-semibold mb-1">{r.member.name} — AUM: {fmt(r.member.aumTotal)} | Payable: {fmt(r.payableEarnings)}</p>
                  <div className="flex gap-1 flex-wrap">
                    {r.overrideByTier.map(({ tier, overrideAmount }) => (
                      <div key={tier.id} className="bg-amber-500/10 border border-amber-500/20 rounded px-2 py-0.5 text-[10px]">
                        <span className="text-muted-foreground">{tier.label}:</span>{' '}
                        <span className="text-amber-400 font-semibold">{fmt(overrideAmount)}</span>{' '}
                        <span className="text-muted-foreground/60">({(tier.overrideRate * 100).toFixed(0)}%)</span>
                      </div>
                    ))}
                    <div className="bg-green-500/10 border border-green-500/20 rounded px-2 py-0.5 text-[10px]">
                      <span className="text-muted-foreground">Net:</span>{' '}
                      <span className="text-green-400 font-semibold">{fmt(r.netToAdvisor)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Separator />

          {/* What-If Modeling */}
          <SectionHeader>What-If Modeling</SectionHeader>
          <p className="text-[10px] text-muted-foreground mb-2">
            "What if I add N advisors at $X production level?" — the cascade recalculates instantly.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
            <PInput label="Additional Advisors" value={wiAdvisors} onChange={v => setWiAdvisors(Math.max(0, +v || 0))} />
            <PInput label="Avg AUM per Advisor" value={wiAvgProd} onChange={v => setWiAvgProd(+v || 0)} prefix="$" />
            <PInput label="GDC Retained %" value={wiGdcPct} onChange={v => setWiGdcPct(+v || 0)} suffix="%" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/40">
                  <th className="px-2 py-1.5 text-left font-semibold">Metric</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Current</th>
                  <th className="px-2 py-1.5 text-right font-semibold">With {wiAdvisors} New</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Delta</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/30">
                  <td className="px-2 py-1 font-semibold">Total AUM</td>
                  <td className="px-2 py-1 text-right">{fmt(whatIfResult.baseResult.totalAUM)}</td>
                  <td className="px-2 py-1 text-right">{fmt(whatIfResult.scenarioResult.totalAUM)}</td>
                  <td className="px-2 py-1 text-right text-green-400">+{fmt(whatIfResult.deltaAUM)}</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="px-2 py-1 font-semibold">Total Fees</td>
                  <td className="px-2 py-1 text-right">{fmt(whatIfResult.baseResult.totalFees)}</td>
                  <td className="px-2 py-1 text-right">{fmt(whatIfResult.scenarioResult.totalFees)}</td>
                  <td className="px-2 py-1 text-right text-green-400">+{fmt(whatIfResult.deltaFees)}</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="px-2 py-1 font-semibold">Total Override (your earnings)</td>
                  <td className="px-2 py-1 text-right">{fmt(whatIfResult.baseResult.totalOverride)}</td>
                  <td className="px-2 py-1 text-right text-green-400 font-bold">{fmt(whatIfResult.scenarioResult.totalOverride)}</td>
                  <td className="px-2 py-1 text-right text-green-400 font-bold">+{fmt(whatIfResult.deltaOverride)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Validation Test Display */}
          <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3 mt-3">
            <p className="text-[10px] font-bold text-green-400 mb-1">Validation Test (per spec):</p>
            <p className="text-[10px] text-muted-foreground">
              Advisor with 80% GDC on $1M AUM @ 1% fee → Annual fees: $10,000 → Payable: $8,000 →
              MD override at 20%: ${(8000 * 0.20).toLocaleString()} →
              Blended effective rate across hierarchy: ~{(DEFAULT_OVERRIDE_RATE * 100).toFixed(1)}%
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              For larger AUM ($1M annual trails): $1M × 80% = $800K payable → MD override ≈ ${(800000 * 0.20).toLocaleString()} = $160K
            </p>
          </div>

        </CardContent>
      </Card>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   AFFILIATE OWN PERSPECTIVE — Independent Planning View
   The affiliate plans their own pipeline, ramp, activity, and income
   from their own vantage point (not the recruiter's view of them).
   ═══════════════════════════════════════════════════════════════ */

const RAMP_MILESTONES = [
  { month: 1, label: 'Licensing & Onboarding', pctOfTarget: 0 },
  { month: 2, label: 'First Appointments', pctOfTarget: 5 },
  { month: 3, label: 'First Placements', pctOfTarget: 15 },
  { month: 6, label: 'Building Momentum', pctOfTarget: 40 },
  { month: 9, label: 'Approaching Stride', pctOfTarget: 70 },
  { month: 12, label: 'Full Production', pctOfTarget: 100 },
  { month: 18, label: 'Growth Phase', pctOfTarget: 130 },
  { month: 24, label: 'Senior Producer', pctOfTarget: 160 },
];

function AffiliateOwnPerspective() {
  // Affiliate's own income target
  const [affTargetIncome, setAffTargetIncome] = useState(75000);
  const [affRampMonths, setAffRampMonths] = useState(12);
  const [affCurrentMonth, setAffCurrentMonth] = useState(1);
  const [affAvgCaseSize, setAffAvgCaseSize] = useState(2500);
  const [affCloseRate, setAffCloseRate] = useState(30);
  const [affApptRate, setAffApptRate] = useState(25);

  // Activity goals
  const [affDailyCalls, setAffDailyCalls] = useState(15);
  const [affWeeklyMeetings, setAffWeeklyMeetings] = useState(8);
  const [affWeeklyProposals, setAffWeeklyProposals] = useState(4);

  // Mentorship needs
  const [affNeedsTraining, setAffNeedsTraining] = useState(true);
  const [affNeedsJointWork, setAffNeedsJointWork] = useState(true);
  const [affNeedsLeads, setAffNeedsLeads] = useState(false);
  const [affNeedsMarketing, setAffNeedsMarketing] = useState(false);

  // Computed metrics
  const rampPct = useMemo(() => {
    // Find where we are in the ramp
    const sorted = [...RAMP_MILESTONES].sort((a, b) => a.month - b.month);
    let pct = 0;
    for (const m of sorted) {
      if (affCurrentMonth >= m.month) pct = m.pctOfTarget;
    }
    return pct;
  }, [affCurrentMonth]);

  const currentTarget = Math.round(affTargetIncome * rampPct / 100);
  const monthlyTarget = Math.round(currentTarget / 12);
  const casesNeeded = affAvgCaseSize > 0 ? Math.ceil(monthlyTarget / affAvgCaseSize) : 0;
  const proposalsNeeded = affCloseRate > 0 ? Math.ceil(casesNeeded / (affCloseRate / 100)) : 0;
  const meetingsNeeded = affApptRate > 0 ? Math.ceil(proposalsNeeded / (affApptRate / 100)) : 0;
  const callsNeeded = meetingsNeeded > 0 ? Math.ceil(meetingsNeeded / 0.25) : 0; // 25% call-to-meeting rate

  // Weekly/daily breakdown
  const weeklyCases = Math.ceil(casesNeeded / 4.3);
  const dailyCallsNeeded = Math.ceil(callsNeeded / 22); // 22 working days

  // Ramp chart data
  const rampData = RAMP_MILESTONES.map(m => ({
    label: `M${m.month}`,
    target: Math.round(affTargetIncome * m.pctOfTarget / 100 / 12),
    milestone: m.label,
    pct: m.pctOfTarget,
  }));

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="text-primary">Affiliate's Own Planning View</span>
          <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-400/30">Independent Perspective</Badge>
          <RefTip text="This view is designed for the affiliate themselves to plan their own production, ramp timeline, and activity goals. Share this with your affiliates to help them build their own business plan." refId="commission" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Section 1: Income Target & Ramp */}
        <SectionHeader>1. My Income Target & Ramp</SectionHeader>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <PInput label="My Target Annual Income" value={affTargetIncome} onChange={v => setAffTargetIncome(+v || 0)} prefix="$" />
          <PInput label="Ramp to Full Production (mo)" value={affRampMonths} onChange={v => setAffRampMonths(+v || 12)} />
          <PInput label="Current Month in Ramp" value={affCurrentMonth} onChange={v => setAffCurrentMonth(Math.max(1, +v || 1))} />
          <PInput label="Avg Case Size ($)" value={affAvgCaseSize} onChange={v => setAffAvgCaseSize(+v || 0)} prefix="$" />
        </div>

        <div className="flex flex-wrap gap-2">
          <KPI label="Ramp %" value={`${rampPct}%`} variant={rampPct >= 100 ? 'grn' : 'gld'} />
          <KPI label="Current Target" value={fmtSm(currentTarget)} variant="gld" />
          <KPI label="Monthly Target" value={fmtSm(monthlyTarget)} variant="blu" />
          <KPI label="Full Target" value={fmtSm(affTargetIncome)} variant="" />
        </div>

        {/* Ramp Timeline Chart */}
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rampData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} />
              <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmtSm(v)} />
              <Area type="monotone" dataKey="target" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <Separator />

        {/* Section 2: Activity Goals (backward from income) */}
        <SectionHeader>2. Activity Goals (Backward from Income)</SectionHeader>
        <p className="text-[10px] text-muted-foreground -mt-1 mb-2">Based on your income target and conversion rates, here's what you need to do each period.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <PInput label="Close Rate %" value={affCloseRate} onChange={v => setAffCloseRate(+v || 0)} suffix="%" />
          <PInput label="Appt Show Rate %" value={affApptRate} onChange={v => setAffApptRate(+v || 0)} suffix="%" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/40">
                <th className="px-2 py-1.5 text-left font-semibold">Metric</th>
                <th className="px-2 py-1.5 text-right font-semibold">Daily</th>
                <th className="px-2 py-1.5 text-right font-semibold">Weekly</th>
                <th className="px-2 py-1.5 text-right font-semibold">Monthly</th>
                <th className="px-2 py-1.5 text-right font-semibold">Your Goal</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/30">
                <td className="px-2 py-1 font-semibold">Calls / Outreach</td>
                <td className="px-2 py-1 text-right">{dailyCallsNeeded}</td>
                <td className="px-2 py-1 text-right">{dailyCallsNeeded * 5}</td>
                <td className="px-2 py-1 text-right">{callsNeeded}</td>
                <td className="px-2 py-1 text-right"><Input type="number" value={affDailyCalls} onChange={e => setAffDailyCalls(+e.target.value || 0)} className="h-6 w-14 text-[10px] text-right inline-block" /></td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="px-2 py-1 font-semibold">Meetings / Appts</td>
                <td className="px-2 py-1 text-right">{Math.ceil(meetingsNeeded / 22)}</td>
                <td className="px-2 py-1 text-right">{Math.ceil(meetingsNeeded / 4.3)}</td>
                <td className="px-2 py-1 text-right">{meetingsNeeded}</td>
                <td className="px-2 py-1 text-right"><Input type="number" value={affWeeklyMeetings} onChange={e => setAffWeeklyMeetings(+e.target.value || 0)} className="h-6 w-14 text-[10px] text-right inline-block" /></td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="px-2 py-1 font-semibold">Proposals</td>
                <td className="px-2 py-1 text-right">—</td>
                <td className="px-2 py-1 text-right">{Math.ceil(proposalsNeeded / 4.3)}</td>
                <td className="px-2 py-1 text-right">{proposalsNeeded}</td>
                <td className="px-2 py-1 text-right"><Input type="number" value={affWeeklyProposals} onChange={e => setAffWeeklyProposals(+e.target.value || 0)} className="h-6 w-14 text-[10px] text-right inline-block" /></td>
              </tr>
              <tr className="bg-primary/5 font-semibold">
                <td className="px-2 py-1.5">Placements Needed</td>
                <td className="px-2 py-1.5 text-right">—</td>
                <td className="px-2 py-1.5 text-right text-green-400">{weeklyCases}</td>
                <td className="px-2 py-1.5 text-right text-green-400">{casesNeeded}</td>
                <td className="px-2 py-1.5 text-right text-green-400">{casesNeeded}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-2">
          <KPI label="Calls vs Need" value={`${affDailyCalls} / ${dailyCallsNeeded}`} variant={affDailyCalls >= dailyCallsNeeded ? 'grn' : 'red'} />
          <KPI label="Meetings vs Need" value={`${affWeeklyMeetings} / ${Math.ceil(meetingsNeeded / 4.3)}`} variant={affWeeklyMeetings >= Math.ceil(meetingsNeeded / 4.3) ? 'grn' : 'red'} />
          <KPI label="Proposals vs Need" value={`${affWeeklyProposals} / ${Math.ceil(proposalsNeeded / 4.3)}`} variant={affWeeklyProposals >= Math.ceil(proposalsNeeded / 4.3) ? 'grn' : 'red'} />
        </div>

        <Separator />

        {/* Section 3: Mentorship & Support Needs */}
        <SectionHeader>3. Support I Need from My Upline</SectionHeader>
        <p className="text-[10px] text-muted-foreground -mt-1 mb-2">Check what support you need. This helps your manager/mentor understand how to help you succeed.</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { key: 'training', label: 'Product & Sales Training', desc: 'Weekly training sessions, product knowledge', checked: affNeedsTraining, set: setAffNeedsTraining },
            { key: 'joint', label: 'Joint Field Work', desc: 'Ride-alongs, joint appointments, case clinics', checked: affNeedsJointWork, set: setAffNeedsJointWork },
            { key: 'leads', label: 'Lead Generation Support', desc: 'Shared leads, referral introductions', checked: affNeedsLeads, set: setAffNeedsLeads },
            { key: 'marketing', label: 'Marketing & Branding', desc: 'Co-branded materials, social media support', checked: affNeedsMarketing, set: setAffNeedsMarketing },
          ].map(item => (
            <div key={item.key} className={`p-2 rounded-md border transition-all cursor-pointer ${item.checked ? 'border-primary/40 bg-primary/5' : 'border-border/30 opacity-60'}`}
              onClick={() => item.set(!item.checked)}>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-sm border ${item.checked ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`}>
                  {item.checked && <span className="text-[8px] text-primary-foreground flex items-center justify-center">✓</span>}
                </div>
                <span className="text-[11px] font-semibold">{item.label}</span>
              </div>
              <p className="text-[9px] text-muted-foreground mt-0.5 ml-5">{item.desc}</p>
            </div>
          ))}
        </div>

        <Separator />

        {/* Section 4: Ramp Milestones */}
        <SectionHeader>4. Ramp Milestones</SectionHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/40">
                <th className="px-2 py-1.5 text-left font-semibold">Month</th>
                <th className="px-2 py-1.5 text-left font-semibold">Milestone</th>
                <th className="px-2 py-1.5 text-right font-semibold">% of Target</th>
                <th className="px-2 py-1.5 text-right font-semibold">Monthly Income</th>
                <th className="px-2 py-1.5 text-center font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {RAMP_MILESTONES.map(m => {
                const monthlyInc = Math.round(affTargetIncome * m.pctOfTarget / 100 / 12);
                const reached = affCurrentMonth >= m.month;
                return (
                  <tr key={m.month} className={`border-b border-border/30 ${reached ? 'bg-green-500/5' : ''}`}>
                    <td className="px-2 py-1 font-semibold">Month {m.month}</td>
                    <td className="px-2 py-1">{m.label}</td>
                    <td className="px-2 py-1 text-right">{m.pctOfTarget}%</td>
                    <td className="px-2 py-1 text-right">{fmtSm(monthlyInc)}</td>
                    <td className="px-2 py-1 text-center">{reached ? <Badge variant="outline" className="text-[9px] text-green-400 border-green-400/30">✓ Reached</Badge> : <Badge variant="outline" className="text-[9px] text-muted-foreground">Upcoming</Badge>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PANEL: AFFILIATE PIPELINE & ACTIVITY
   ═══════════════════════════════════════════════════════════════ */
export function AUMPipelinePanel() {
  const [stages, setStages] = useState<AUMPipelineStage[]>(() => DEFAULT_AUM_PIPELINE.map(s => ({ ...s })));
  const [feeRate, setFeeRate] = useState(1.0);
  const [avgCycleDays, setAvgCycleDays] = useState(90);
  const [currentAUM, setCurrentAUM] = useState(2000000);
  const [monthlyNewAUM, setMonthlyNewAUM] = useState(200000);
  const [horizonMonths, setHorizonMonths] = useState(36);
  const [growthRate, setGrowthRate] = useState(0.5);
  const [attritionRate, setAttritionRate] = useState(0.3);

  // Ramp targets
  const [target12, setTarget12] = useState(5000000);
  const [target24, setTarget24] = useState(12000000);
  const [target36, setTarget36] = useState(25000000);

  const [activeTab, setActiveTab] = useState('pipeline');

  const pipelineResult = useMemo(() => calcAUMPipeline(stages, feeRate, avgCycleDays), [stages, feeRate, avgCycleDays]);
  const forecast = useMemo(() => calcProductionForecast(currentAUM, monthlyNewAUM, feeRate, horizonMonths, growthRate, attritionRate), [currentAUM, monthlyNewAUM, feeRate, horizonMonths, growthRate, attritionRate]);
  const rampSchedule = useMemo(() => buildRampSchedule(target12, target24, target36, currentAUM, feeRate), [target12, target24, target36, currentAUM, feeRate]);

  const updateStage = (idx: number, field: keyof AUMPipelineStage, value: number) => {
    const next = [...stages];
    (next[idx] as any)[field] = value;
    setStages(next);
  };

  return (
    <section aria-label="AUM Pipeline" role="region">
      <h2 className="text-lg font-bold text-foreground mb-1">AUM Pipeline & Forecasting</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Track your AUM pipeline from prospects through management, with production forecasting and ramp schedule modeling.
      </p>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-3">
          <TabsTrigger value="pipeline">Pipeline Funnel</TabsTrigger>
          <TabsTrigger value="forecast">Production Forecast</TabsTrigger>
          <TabsTrigger value="ramp">Ramp Schedule</TabsTrigger>
        </TabsList>

        {/* Pipeline Funnel Tab */}
        <TabsContent value="pipeline">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="text-primary">AUM Pipeline Funnel</span>
                <RefTip text="Pipeline stages: Prospects → Discovery → Proposal → Agreement → Onboarded → Billing → Under Management. Conversion rates based on industry averages from Cerulli Associates 2024." refId="commission" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                <PInput label="Fee Rate (%)" value={feeRate} onChange={v => setFeeRate(+v || 0)} suffix="%" />
                <PInput label="Avg Cycle (days)" value={avgCycleDays} onChange={v => setAvgCycleDays(+v || 0)} />
              </div>

              {/* Funnel Visualization */}
              <div className="space-y-1">
                {stages.map((stage, i) => {
                  const maxCount = stages[0]?.count || 1;
                  const widthPct = Math.max(15, (stage.count / maxCount) * 100);
                  return (
                    <div key={stage.id} className="flex items-center gap-2">
                      <div className="w-36 text-[10px] text-right text-muted-foreground truncate">{stage.label}</div>
                      <div className="flex-1 relative">
                        <div
                          className="h-7 rounded-r bg-gradient-to-r from-primary/30 to-primary/60 flex items-center px-2 transition-all"
                          style={{ width: `${widthPct}%` }}
                        >
                          <span className="text-[10px] font-bold text-foreground">{stage.count}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Input type="number" value={stage.count} onChange={e => updateStage(i, 'count', +e.target.value || 0)}
                          className="h-6 w-14 text-[10px] text-right" />
                        <Input type="number" value={stage.avgAUM} onChange={e => updateStage(i, 'avgAUM', +e.target.value || 0)}
                          className="h-6 w-24 text-[10px] text-right" />
                        {i < stages.length - 1 && (
                          <span className="text-[9px] text-muted-foreground w-10 text-right">
                            {(stage.conversionRate * 100).toFixed(0)}%→
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <Separator />

              <div className="flex flex-wrap gap-2">
                <KPI label="Prospect AUM" value={fmtSm(pipelineResult.totalProspectAUM)} variant="" />
                <KPI label="Projected New AUM" value={fmtSm(pipelineResult.projectedNewAUM)} variant="grn" />
                <KPI label="Projected Fees" value={fmtSm(pipelineResult.projectedAnnualFees)} variant="gld" />
                <KPI label="Overall Conv." value={(pipelineResult.avgConversionRate * 100).toFixed(1) + '%'} variant="" />
                <KPI label="Avg Cycle" value={`${pipelineResult.pipelineVelocityDays} days`} variant="" />
              </div>

              {/* Fee Breakpoints Reference */}
              <SectionHeader>Fee Schedule Breakpoints</SectionHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] border-collapse">
                  <thead>
                    <tr className="bg-muted/40">
                      <th className="px-2 py-1 text-left">AUM Range</th>
                      <th className="px-2 py-1 text-right">Fee %</th>
                      <th className="px-2 py-1 text-right">Annual Fee on $1M</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DEFAULT_FEE_BREAKPOINTS.map(bp => (
                      <tr key={bp.label} className="border-b border-border/20">
                        <td className="px-2 py-0.5">{bp.label}</td>
                        <td className="px-2 py-0.5 text-right">{bp.feePct}%</td>
                        <td className="px-2 py-0.5 text-right">{fmt(Math.round(1000000 * bp.feePct / 100))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Production Forecast Tab */}
        <TabsContent value="forecast">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-primary">Production Forecast</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <PInput label="Current AUM" value={currentAUM} onChange={v => setCurrentAUM(+v || 0)} prefix="$" />
                <PInput label="Monthly New AUM" value={monthlyNewAUM} onChange={v => setMonthlyNewAUM(+v || 0)} prefix="$" />
                <PInput label="Horizon (months)" value={horizonMonths} onChange={v => setHorizonMonths(Math.min(60, +v || 12))} />
                <PInput label="Organic Growth %/mo" value={growthRate} onChange={v => setGrowthRate(+v || 0)} suffix="%" />
                <PInput label="Attrition %/mo" value={attritionRate} onChange={v => setAttritionRate(+v || 0)} suffix="%" />
                <PInput label="Fee Rate %" value={feeRate} onChange={v => setFeeRate(+v || 0)} suffix="%" />
              </div>

              {/* Forecast Chart */}
              <SectionHeader>Cumulative AUM Growth</SectionHeader>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={forecast.filter((_, i) => i % 3 === 0 || i === forecast.length - 1)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} />
                    <YAxis tickFormatter={v => fmtSm(v)} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Area type="monotone" dataKey="cumulativeAUM" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} name="Cumulative AUM" />
                    <Area type="monotone" dataKey="cumulativeFees" stroke="#22c55e" fill="#22c55e" fillOpacity={0.1} name="Cumulative Fees" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Key Milestones */}
              <div className="flex flex-wrap gap-2">
                {forecast.length >= 12 && <KPI label="12-Month AUM" value={fmtSm(forecast[11].cumulativeAUM)} variant="grn" />}
                {forecast.length >= 24 && <KPI label="24-Month AUM" value={fmtSm(forecast[23].cumulativeAUM)} variant="grn" />}
                {forecast.length >= 36 && <KPI label="36-Month AUM" value={fmtSm(forecast[35].cumulativeAUM)} variant="grn" />}
                <KPI label="End Fees/yr" value={fmtSm(forecast[forecast.length - 1]?.projectedFees * 12 || 0)} variant="gld" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ramp Schedule Tab */}
        <TabsContent value="ramp">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-primary">Ramp Schedule Modeling</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-[10px] text-muted-foreground">Set 12/24/36-month AUM targets and visualize the ramp trajectory.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <PInput label="Current AUM" value={currentAUM} onChange={v => setCurrentAUM(+v || 0)} prefix="$" />
                <PInput label="12-Month Target" value={target12} onChange={v => setTarget12(+v || 0)} prefix="$" />
                <PInput label="24-Month Target" value={target24} onChange={v => setTarget24(+v || 0)} prefix="$" />
                <PInput label="36-Month Target" value={target36} onChange={v => setTarget36(+v || 0)} prefix="$" />
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rampSchedule.filter((_, i) => i % 3 === 0 || i === rampSchedule.length - 1)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} />
                    <YAxis tickFormatter={v => fmtSm(v)} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Line type="monotone" dataKey="targetAUM" stroke="#f59e0b" strokeDasharray="5 5" name="Target" dot={false} />
                    <Line type="monotone" dataKey="actualAUM" stroke="#22c55e" name="Projected" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Monthly Fee Income */}
              <SectionHeader>Projected Monthly Fee Income</SectionHeader>
              <div className="flex flex-wrap gap-2">
                {rampSchedule.length >= 12 && <KPI label="Month 12" value={fmtSm(rampSchedule[11].feeIncome) + '/mo'} variant="grn" />}
                {rampSchedule.length >= 24 && <KPI label="Month 24" value={fmtSm(rampSchedule[23].feeIncome) + '/mo'} variant="grn" />}
                {rampSchedule.length >= 36 && <KPI label="Month 36" value={fmtSm(rampSchedule[35].feeIncome) + '/mo'} variant="grn" />}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PANEL: AFFILIATE PIPELINE (Bidirectional)
   Recruiting affiliates + Affiliate own production planning
   ═══════════════════════════════════════════════════════════════ */
export function AffiliatePipelinePanel() {
  const [activeTab, setActiveTab] = useState('recruiting');

  // Recruiting pipeline state
  const [recruitStages, setRecruitStages] = useState<AffiliatePipelineStage[]>(
    () => DEFAULT_AFFILIATE_RECRUITING_PIPELINE.map(s => ({ ...s }))
  );

  // Affiliate production pipeline state
  const [prodStages, setProdStages] = useState<AffiliatePipelineStage[]>(
    () => DEFAULT_AFFILIATE_PRODUCTION_PIPELINE.map(s => ({ ...s }))
  );

  // Activity metrics
  const [activityPeriod, setActivityPeriod] = useState<'weekly' | 'monthly' | 'quarterly'>('monthly');
  const [calls, setCalls] = useState(40);
  const [meetings, setMeetings] = useState(15);
  const [proposals, setProposals] = useState(8);
  const [closes, setCloses] = useState(4);
  const [avgRevPerClose, setAvgRevPerClose] = useState(3500);

  const recruitResult = useMemo(() => calcAffiliatePipeline(recruitStages), [recruitStages]);
  const prodResult = useMemo(() => calcAffiliatePipeline(prodStages), [prodStages]);
  const activityResult = useMemo(() => calcActivityMetrics(
    { calls, meetings, proposals, closes, period: activityPeriod },
    avgRevPerClose
  ), [calls, meetings, proposals, closes, activityPeriod, avgRevPerClose]);

  const updateRecruitStage = (idx: number, field: keyof AffiliatePipelineStage, value: number) => {
    const next = [...recruitStages];
    (next[idx] as any)[field] = value;
    setRecruitStages(next);
  };

  const updateProdStage = (idx: number, field: keyof AffiliatePipelineStage, value: number) => {
    const next = [...prodStages];
    (next[idx] as any)[field] = value;
    setProdStages(next);
  };

  return (
    <section aria-label="Affiliate Pipeline" role="region">
      <h2 className="text-lg font-bold text-foreground mb-1">Affiliate Pipeline & Activity</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Bidirectional affiliate planning: recruit affiliates AND help affiliates plan their own production.
      </p>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-3 flex-wrap">
          <TabsTrigger value="recruiting">Recruiting</TabsTrigger>
          <TabsTrigger value="production">Production</TabsTrigger>
          <TabsTrigger value="perspective">Affiliate Perspective</TabsTrigger>
          <TabsTrigger value="activity">Activity Metrics</TabsTrigger>
        </TabsList>

        {/* Recruiting Tab */}
        <TabsContent value="recruiting">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="text-primary">Affiliate Recruiting Pipeline</span>
                <RefTip text="Track affiliate recruitment from identification through strategic alliance. Revenue estimates based on industry referral fee structures." refId="commission" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-[10px] text-muted-foreground">
                Identified → Outreach → Exploratory → MOU → Active Referrals → Strategic Alliance
              </p>

              {/* Funnel */}
              <div className="space-y-1">
                {recruitStages.map((stage, i) => {
                  const maxCount = recruitStages[0]?.count || 1;
                  const widthPct = Math.max(15, (stage.count / maxCount) * 100);
                  return (
                    <div key={stage.id} className="flex items-center gap-2">
                      <div className="w-32 text-[10px] text-right text-muted-foreground truncate">{stage.label}</div>
                      <div className="flex-1 relative">
                        <div
                          className="h-7 rounded-r bg-gradient-to-r from-amber-500/30 to-amber-500/60 flex items-center px-2 transition-all"
                          style={{ width: `${widthPct}%` }}
                        >
                          <span className="text-[10px] font-bold text-foreground">{stage.count}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Input type="number" value={stage.count} onChange={e => updateRecruitStage(i, 'count', +e.target.value || 0)}
                          className="h-6 w-14 text-[10px] text-right" />
                        <Input type="number" value={stage.avgRevenue} onChange={e => updateRecruitStage(i, 'avgRevenue', +e.target.value || 0)}
                          className="h-6 w-20 text-[10px] text-right" />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2">
                <KPI label="Identified" value={String(recruitResult.totalIdentified)} variant="" />
                <KPI label="Active" value={String(recruitResult.totalActive)} variant="grn" />
                <KPI label="Projected Rev" value={fmtSm(recruitResult.projectedAnnualRevenue)} variant="gld" />
                <KPI label="Conv. Rate" value={(recruitResult.overallConversion * 100).toFixed(1) + '%'} variant="" />
                <KPI label="Rev/Affiliate" value={fmtSm(recruitResult.revenuePerAffiliate)} variant="grn" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Affiliate Production Tab */}
        <TabsContent value="production">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="text-primary">Affiliate Production Planning</span>
                <Badge variant="outline" className="text-[10px]">Affiliate's Own Pipeline</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-[10px] text-muted-foreground">
                Help affiliates plan their own production: Prospect → Intro → Needs Analysis → Proposal → Placement → Ongoing Service
              </p>

              {/* Funnel */}
              <div className="space-y-1">
                {prodStages.map((stage, i) => {
                  const maxCount = prodStages[0]?.count || 1;
                  const widthPct = Math.max(15, (stage.count / maxCount) * 100);
                  return (
                    <div key={stage.id} className="flex items-center gap-2">
                      <div className="w-32 text-[10px] text-right text-muted-foreground truncate">{stage.label}</div>
                      <div className="flex-1 relative">
                        <div
                          className="h-7 rounded-r bg-gradient-to-r from-blue-500/30 to-blue-500/60 flex items-center px-2 transition-all"
                          style={{ width: `${widthPct}%` }}
                        >
                          <span className="text-[10px] font-bold text-foreground">{stage.count}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Input type="number" value={stage.count} onChange={e => updateProdStage(i, 'count', +e.target.value || 0)}
                          className="h-6 w-14 text-[10px] text-right" />
                        <Input type="number" value={stage.avgRevenue} onChange={e => updateProdStage(i, 'avgRevenue', +e.target.value || 0)}
                          className="h-6 w-20 text-[10px] text-right" />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2">
                <KPI label="Prospects" value={String(prodResult.totalIdentified)} variant="" />
                <KPI label="Placed" value={String(prodResult.totalActive)} variant="grn" />
                <KPI label="Projected Rev" value={fmtSm(prodResult.projectedAnnualRevenue)} variant="gld" />
                <KPI label="Conv. Rate" value={(prodResult.overallConversion * 100).toFixed(1) + '%'} variant="" />
                <KPI label="Rev/Case" value={fmtSm(prodResult.revenuePerAffiliate)} variant="grn" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Affiliate Perspective Tab — Independent Planning View */}
        <TabsContent value="perspective">
          <AffiliateOwnPerspective />
        </TabsContent>

        {/* Activity Metrics Tab */}
        <TabsContent value="activity">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-primary">Activity Metrics Dashboard</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="space-y-0.5">
                  <Label className="text-[10px] font-medium text-muted-foreground">Period</Label>
                  <Select value={activityPeriod} onValueChange={v => setActivityPeriod(v as any)}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <PInput label="Avg Rev/Close" value={avgRevPerClose} onChange={v => setAvgRevPerClose(+v || 0)} prefix="$" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <PInput label={`Calls (${activityPeriod})`} value={calls} onChange={v => setCalls(+v || 0)} />
                <PInput label={`Meetings (${activityPeriod})`} value={meetings} onChange={v => setMeetings(+v || 0)} />
                <PInput label={`Proposals (${activityPeriod})`} value={proposals} onChange={v => setProposals(+v || 0)} />
                <PInput label={`Closes (${activityPeriod})`} value={closes} onChange={v => setCloses(+v || 0)} />
              </div>

              <Separator />

              {/* Conversion Funnel */}
              <SectionHeader>Conversion Rates</SectionHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/40">
                      <th className="px-2 py-1.5 text-left font-semibold">Stage</th>
                      <th className="px-2 py-1.5 text-right font-semibold">Rate</th>
                      <th className="px-2 py-1.5 text-left font-semibold">Benchmark</th>
                      <th className="px-2 py-1.5 text-center font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/30">
                      <td className="px-2 py-1 font-semibold">Call → Meeting</td>
                      <td className="px-2 py-1 text-right">{(activityResult.callToMeetingRate * 100).toFixed(1)}%</td>
                      <td className="px-2 py-1 text-muted-foreground">25-40% industry avg</td>
                      <td className="px-2 py-1 text-center">{activityResult.callToMeetingRate >= 0.25 ? '✓' : '⚠'}</td>
                    </tr>
                    <tr className="border-b border-border/30">
                      <td className="px-2 py-1 font-semibold">Meeting → Proposal</td>
                      <td className="px-2 py-1 text-right">{(activityResult.meetingToProposalRate * 100).toFixed(1)}%</td>
                      <td className="px-2 py-1 text-muted-foreground">40-60% industry avg</td>
                      <td className="px-2 py-1 text-center">{activityResult.meetingToProposalRate >= 0.40 ? '✓' : '⚠'}</td>
                    </tr>
                    <tr className="border-b border-border/30">
                      <td className="px-2 py-1 font-semibold">Proposal → Close</td>
                      <td className="px-2 py-1 text-right">{(activityResult.proposalToCloseRate * 100).toFixed(1)}%</td>
                      <td className="px-2 py-1 text-muted-foreground">30-50% industry avg</td>
                      <td className="px-2 py-1 text-center">{activityResult.proposalToCloseRate >= 0.30 ? '✓' : '⚠'}</td>
                    </tr>
                    <tr className="bg-primary/5 font-semibold">
                      <td className="px-2 py-1.5">Overall (Call → Close)</td>
                      <td className="px-2 py-1.5 text-right text-green-400">{(activityResult.overallConversion * 100).toFixed(1)}%</td>
                      <td className="px-2 py-1.5 text-muted-foreground">5-15% top performers</td>
                      <td className="px-2 py-1.5 text-center">{activityResult.overallConversion >= 0.05 ? '✓' : '⚠'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap gap-2">
                <KPI label="Monthly Rev" value={fmtSm(activityResult.projectedMonthlyRevenue)} variant="grn" />
                <KPI label="Annual Rev" value={fmtSm(activityResult.projectedAnnualRevenue)} variant="gld" />
                <KPI label="Overall Conv." value={(activityResult.overallConversion * 100).toFixed(1) + '%'} variant="" />
              </div>

              {/* Activity Chart */}
              <SectionHeader>Activity Funnel</SectionHeader>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: 'Calls', value: calls, fill: '#3b82f6' },
                    { name: 'Meetings', value: meetings, fill: '#f59e0b' },
                    { name: 'Proposals', value: proposals, fill: '#8b5cf6' },
                    { name: 'Closes', value: closes, fill: '#22c55e' },
                  ]}>
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.6)' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {[
                        { name: 'Calls', value: calls, fill: '#3b82f6' },
                        { name: 'Meetings', value: meetings, fill: '#f59e0b' },
                        { name: 'Proposals', value: proposals, fill: '#8b5cf6' },
                        { name: 'Closes', value: closes, fill: '#22c55e' },
                      ].map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}
