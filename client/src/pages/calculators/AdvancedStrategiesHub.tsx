/* ═══════════════════════════════════════════════════════════════
   AdvancedStrategiesHub — Unified Advanced Strategies Planning Hub
   Mirrors ClientWealthHub / MyPlanPanel pattern:
   - Target-driven: set total strategy benefit goal → cascade to all strategies
   - Strategy allocation sliders with drag-to-rebalance
   - Cross-strategy cascade: ILIT → estate, PF → tax, Charitable → income
   - Back-solve: given a benefit target, what strategy mix achieves it
   - Sensitivity analysis: what-if on rates, values, income
   - Time-phased projections with Recharts visualization
   - Cascade bridge: shows how advanced strategies feed into client planning
   ═══════════════════════════════════════════════════════════════ */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { useAuth } from '@/_core/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Target, Shield, DollarSign, Landmark, Building2, Briefcase,
  Gift, ArrowRight, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle2, Info, TrendingUp, Gem, Save, BookOpen,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, CartesianGrid, Area, AreaChart,
} from 'recharts';
import { fmt, fmtSm, pct } from './format';
import { KPI, RefTip, FormInput, ComplexityToggle, type ComplexityLevel, type PanelProps } from './shared';
import { SectionHeader, ScoreRing, AllocationSlider } from './shared-ui';
import type { AdvancedProps } from './PanelsE';
import {
  calcAdvanced, calcBizClient,
  calcUnifiedAdvancedPlan, calcAdvancedSensitivity, calcAdvancedTimePhasedProjections,
  type UnifiedAdvancedPlan, type AdvancedSensitivityResult, type AdvancedTimeProjection,
} from './engine';
import { useWealthEngine, type AdvancedStrategiesCascade } from '@/contexts/WealthEngineContext';
import { CascadeAuditTrail } from './CascadeAuditTrail';
import { CascadeSankey } from './CascadeSankey';

/* ═══ STRATEGY CONFIG ═══ */
const STRATEGY_CONFIG = [
  { key: 'premiumFinance', label: 'Premium Finance', icon: Landmark, color: '#3b82f6', desc: 'Leveraged life insurance funding' },
  { key: 'ilit', label: 'ILIT', icon: Shield, color: '#8b5cf6', desc: 'Irrevocable Life Insurance Trust' },
  { key: 'execComp', label: 'Executive Comp', icon: Briefcase, color: '#f59e0b', desc: '§162 bonus, SERP, split-dollar' },
  { key: 'charitable', label: 'Charitable', icon: Gift, color: '#10b981', desc: 'CRT, DAF, life insurance replacement' },
  { key: 'business', label: 'Business', icon: Building2, color: '#ef4444', desc: 'Key person, buy-sell, group benefits' },
] as const;

/* ═══ SMALL HELPERS (shared-ui imports above) ═══ */

/* StrategySlider → AllocationSlider from shared-ui */
const StrategySlider = AllocationSlider;

/* ScoreRing → imported from shared-ui (with custom labels: Optimized / Good / Partial / Minimal) */
const AdvancedScoreRing = (props: { score: number; size?: number }) => (
  <ScoreRing {...props} size={props.size ?? 100} labels={{ high: 'Optimized', mid: 'Good', low: 'Partial', critical: 'Minimal' }} />
);

/* ═══ COMBINED PROPS ═══ */
export interface AdvancedStrategiesHubProps extends AdvancedProps {
  // Business client props
  bcBizValue: number; setBcBizValue: (v: number) => void;
  bcKeyPersonSalary: number; setBcKeyPersonSalary: (v: number) => void;
  bcKeyPersonMult: number; setBcKeyPersonMult: (v: number) => void;
  bcOwners: number; setBcOwners: (v: number) => void;
  bcEmployees: number; setBcEmployees: (v: number) => void;
  // Client context
  age: number;
  income: number;
  grossEstate: number;
  // Navigation
  onNavigateToPanel?: (panelId: string) => void;
  // Live cascade callback — pushes computed data back to Calculators.tsx → WealthEngineContext
  onCascadeUpdate?: (cascade: AdvancedStrategiesCascade) => void;
}

/* ═══ MAIN COMPONENT ═══ */
export function AdvancedStrategiesHub(p: AdvancedStrategiesHubProps) {
  const we = useWealthEngine();
  // Local state
  const [benefitGoal, setBenefitGoal] = useState(50000);
  const [showSensitivity, setShowSensitivity] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showBackSolve, setShowBackSolve] = useState(false);
  const [showCascade, setShowCascade] = useState(true);
  const [hubComplexity, setHubComplexity] = useState<ComplexityLevel>(() => {
    try { const saved = localStorage.getItem('we-advanced-complexity');
    return (saved === 'simple' || saved === 'detailed' || saved === 'expert') ? saved : 'detailed'; } catch { return 'detailed'; }
  });
  const handleComplexityChange = (v: ComplexityLevel) => { setHubComplexity(v); try { localStorage.setItem('we-advanced-complexity', v); } catch {} };
  const [strategyAllocation, setStrategyAllocation] = useState({
    premiumFinance: 25, ilit: 25, execComp: 20, charitable: 15, business: 15,
  });
  const [saveLabel, setSaveLabel] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const { user } = useAuth();

  // Load presets from DB (general defaults + user's own)
  const presetsQuery = trpc.hubAllocations.list.useQuery({ hubType: 'advanced' });
  const saveMutation = trpc.hubAllocations.save.useMutation({
    onSuccess: () => { toast.success('Strategy preset saved'); setShowSaveInput(false); setSaveLabel(''); presetsQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const applyPreset = useCallback((presetId: string) => {
    const preset = presetsQuery.data?.find(pr => pr.id.toString() === presetId);
    if (!preset) return;
    const alloc = preset.allocations as Record<string, number>;
    setStrategyAllocation(prev => {
      const result = { ...prev };
      Object.keys(result).forEach(k => { if (alloc[k] !== undefined) result[k as keyof typeof result] = alloc[k]; });
      return result;
    });
    if (preset.inputOverrides) {
      const ov = preset.inputOverrides as Record<string, number>;
      if (ov.benefitGoal) setBenefitGoal(ov.benefitGoal);
    }
    toast.success(`Applied preset: ${preset.label}`);
  }, [presetsQuery.data]);
  const handleSavePreset = useCallback(() => {
    if (!saveLabel.trim()) { toast.error('Enter a name'); return; }
    // @ts-expect-error — excess property in object literal
    saveMutation.mutate({ hubType: 'advanced', label: saveLabel.trim(), allocations: strategyAllocation, inputOverrides: { benefitGoal } });
  }, [saveLabel, strategyAllocation, benefitGoal]);

  // Compute underlying results
  const advResult = useMemo(() => calcAdvanced(
    p.pfFace, p.pfPrem, p.pfCash, p.pfLoan, p.pfCred, p.pfYrs,
    p.ilDB, p.ilPr, p.ilCr, p.ilTx,
    p.exSal, p.ex162, p.exSERP, p.exSD,
    p.cvCRT, p.cvPO, p.cvDAF, p.cvLI,
    p.advGoal,
  ), [p.pfFace, p.pfPrem, p.pfCash, p.pfLoan, p.pfCred, p.pfYrs,
    p.ilDB, p.ilPr, p.ilCr, p.ilTx,
    p.exSal, p.ex162, p.exSERP, p.exSD,
    p.cvCRT, p.cvPO, p.cvDAF, p.cvLI, p.advGoal]);

  const bizResult = useMemo(() => calcBizClient(
    p.bcBizValue, p.bcKeyPersonSalary, p.bcKeyPersonMult, p.bcOwners, p.bcEmployees, p.age,
  ), [p.bcBizValue, p.bcKeyPersonSalary, p.bcKeyPersonMult, p.bcOwners, p.bcEmployees, p.age]);

  // Unified plan
  const plan = useMemo(() => calcUnifiedAdvancedPlan(
    advResult, bizResult, benefitGoal, strategyAllocation, p.income, p.age, p.grossEstate,
  ), [advResult, bizResult, benefitGoal, strategyAllocation, p.income, p.age, p.grossEstate]);

  // Sensitivity
  const sensitivity = useMemo(() => calcAdvancedSensitivity(
    advResult, bizResult, p.pfLoan, p.pfCred, p.ilTx, p.bcBizValue, p.income,
  ), [advResult, bizResult, p.pfLoan, p.pfCred, p.ilTx, p.bcBizValue, p.income]);

  // Time projections
  const timeline = useMemo(() => calcAdvancedTimePhasedProjections(
    advResult, bizResult, Math.max(10, p.pfYrs),
  ), [advResult, bizResult, p.pfYrs]);

  /* ─── Live cascade: push computed data back to Calculators.tsx → WealthEngineContext ─── */
  useEffect(() => {
    if (!p.onCascadeUpdate) return;
    const s = plan.strategies;
    const cascade: AdvancedStrategiesCascade = {
      pfNetBenefit: s.premiumFinance.netBenefit,
      pfTaxEfficiency: s.premiumFinance.taxEfficiency,
      ilitEstateTaxSaved: s.ilit.estateTaxSaved,
      ilitNetToHeirs: s.ilit.netToHeirs,
      execTaxBenefit: s.execComp.employerTaxBenefit,
      execRetentionValue: s.execComp.retentionValue,
      charitableTaxDeduction: s.charitable.taxDeduction,
      charitableAnnualIncome: s.charitable.annualIncome,
      businessTotalProtection: s.business.totalProtection,
      businessContinuityScore: s.business.continuityScore,
      totalAnnualBenefit: plan.totalProjectedBenefit,
      totalAnnualCost: plan.totalAnnualCost,
      estateTaxReduction: plan.benefitToClientPlanCascade.estateTaxReduction,
      taxSavingsBoost: plan.benefitToClientPlanCascade.taxSavingsBoost,
      protectionEnhancement: plan.benefitToClientPlanCascade.protectionEnhancement,
      retirementBoost: plan.benefitToClientPlanCascade.retirementBoost,
      netWorthImpact: plan.benefitToClientPlanCascade.netWorthImpact,
    };
    p.onCascadeUpdate(cascade);
  }, [plan, p.onCascadeUpdate]);

  // Drag-to-rebalance handler
  const handleDrag = useCallback((key: string, newVal: number) => {
    setStrategyAllocation(prev => {
      const old = prev[key as keyof typeof prev];
      const delta = newVal - old;
      const others = Object.keys(prev).filter(k => k !== key);
      const othersTotal = others.reduce((s, k) => s + prev[k as keyof typeof prev], 0);
      const updated = { ...prev, [key]: newVal };
      others.forEach(k => {
        const share = othersTotal > 0 ? prev[k as keyof typeof prev] / othersTotal : 1 / others.length;
        updated[k as keyof typeof updated] = Math.max(0, Math.round(prev[k as keyof typeof prev] - delta * share));
      });
      // Normalize to 100
      const total = Object.values(updated).reduce((s, v) => s + v, 0);
      if (total !== 100 && total > 0) {
        const maxKey = Object.entries(updated).reduce((a, b) => b[1] > a[1] ? b : a)[0];
        updated[maxKey as keyof typeof updated] += 100 - total;
      }
      return updated;
    });
  }, []);

  // Panel navigation map
  const strategyPanelMap: Record<string, string> = {
    premiumFinance: 'premfin',
    ilit: 'trusteng',
    execComp: 'execcomp',
    charitable: 'charitable',
    business: 'bizclient',
  };

  return (
    <section aria-label="Advanced Strategies Hub" role="region" className="space-y-4">
      {/* ─── HEADER ─── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Gem className="w-5 h-5 text-primary" />
              Advanced Strategies Hub
              <RefTip text="Unified view of all advanced planning strategies. Premium financing, ILIT, executive compensation, charitable vehicles, and business planning — with cross-strategy cascade showing how each feeds into your client's holistic financial plan. Sources: AALU (2024), Estate Planning Council, IRC §7702, §2042, §162, §170." refId="advanced-hub" />
            </span>
            <ComplexityToggle value={hubComplexity} onChange={handleComplexityChange} />
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Set your total strategy benefit goal, allocate across strategies, and see how advanced planning cascades into client wealth planning.
          </p>
        </CardHeader>
        <CardContent>
          {/* ─── PRESET SELECTOR ─── */}
          <div className="flex items-center gap-2 flex-wrap mb-4 p-2 rounded-md bg-muted/30 border border-muted">
            <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-xs font-medium text-muted-foreground">Presets:</span>
            <Select onValueChange={applyPreset}>
              <SelectTrigger className="h-8 w-[200px] text-xs">
                <SelectValue placeholder="Load a preset..." />
              </SelectTrigger>
              <SelectContent>
                {presetsQuery.data?.map(preset => (
                  <SelectItem key={preset.id} value={preset.id.toString()}>
                    {preset.label} {preset.isDefault ? '(Default)' : ''}
                  </SelectItem>
                ))}
                {(!presetsQuery.data || presetsQuery.data.length === 0) && (
                  <SelectItem value="_none" disabled>No presets available</SelectItem>
                )}
              </SelectContent>
            </Select>
            {user ? (
              showSaveInput ? (
                <div className="flex items-center gap-1">
                  <Input className="h-8 w-[150px] text-xs" placeholder="Preset name..." value={saveLabel}
                    onChange={e => setSaveLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSavePreset()} />
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleSavePreset} disabled={saveMutation.isPending}>
                    <Save className="w-3 h-3 mr-1" /> Save
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowSaveInput(false)}>Cancel</Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowSaveInput(true)}>
                  <Save className="w-3 h-3 mr-1" /> Save Current
                </Button>
              )
            ) : (
              <span className="text-[10px] text-muted-foreground italic">Sign in to save custom presets</span>
            )}
          </div>

          {/* Goal + Score */}
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-4">
            <div className="flex-1">
              <SectionHeader>Annual Strategy Benefit Goal</SectionHeader>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">$</span>
                <FormInput id="advBenefitGoal" label="" value={benefitGoal}
                  onChange={v => setBenefitGoal(Math.max(0, Number(v)))} prefix="$" />
                <Badge variant={plan.goalMet ? 'default' : 'destructive'} className="text-[10px] ml-2">
                  {plan.goalMet ? 'Goal Met' : `Gap: ${fmtSm(plan.backSolve.gapToGoal)}`}
                </Badge>
              </div>
              <p className="text-[9px] text-muted-foreground mt-1">
                Combined annual tax savings + income from all advanced strategies
              </p>
            </div>
            <div className="relative">
              <AdvancedScoreRing score={plan.onTrackScore} />
            </div>
          </div>

          {/* Strategy KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
            <KPI label="Total Benefit" value={fmtSm(plan.totalProjectedBenefit)}
              variant={plan.goalMet ? 'grn' : 'gld'} sub="/yr projected" />
            <KPI label="Annual Cost" value={fmtSm(plan.totalAnnualCost)}
              variant="red" sub="premiums + outlays" />
            <KPI label="PF Net Benefit" value={fmtSm(plan.strategies.premiumFinance.netBenefit)}
              variant={plan.strategies.premiumFinance.netBenefit >= 0 ? 'grn' : 'red'}
              sub={`Leverage: ${plan.strategies.premiumFinance.leverage}`} />
            <KPI label="Estate Tax Saved" value={fmtSm(plan.strategies.ilit.estateTaxSaved)}
              variant="blu" sub="via ILIT" />
            <KPI label="Tax Deductions" value={fmtSm(plan.strategies.charitable.taxDeduction)}
              variant="gld" sub="charitable + exec" />
          </div>
        </CardContent>
      </Card>

      {/* ─── STRATEGY ALLOCATION SLIDERS ─── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            Strategy Allocation — Drag to Rebalance
            <RefTip text="Adjust the relative emphasis across strategies. Dragging one slider automatically rebalances the others. Click 'Go →' to navigate to the detailed panel for each strategy." refId="advanced-hub" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {STRATEGY_CONFIG.map(s => {
              const key = s.key as keyof typeof strategyAllocation;
              const strat = plan.strategies[key];
              let amount = '$0';
              // @ts-expect-error — property access on loosely typed object
              if (key === 'premiumFinance') amount = fmtSm(strat.netBenefit);
              else if (key === 'ilit') amount = fmtSm((strat as typeof plan.strategies.ilit).estateTaxSaved);
              else if (key === 'execComp') amount = fmtSm((strat as typeof plan.strategies.execComp).employerTaxBenefit);
              else if (key === 'charitable') amount = fmtSm((strat as typeof plan.strategies.charitable).taxDeduction);
              else if (key === 'business') amount = fmtSm((strat as typeof plan.strategies.business).totalProtection);

              return (
                <StrategySlider
                  key={s.key}
                  label={s.label}
                  value={strategyAllocation[key]}
                  color={s.color}
                  icon={s.icon}
                  desc={s.desc}
                  amount={amount}
                  onDrag={v => handleDrag(s.key, v)}
                  onNavigate={p.onNavigateToPanel ? () => p.onNavigateToPanel!(strategyPanelMap[s.key]) : undefined}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ─── STRATEGY ROLL-UP TABLE ─── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Strategy Roll-Up</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-2 px-2">
            <table role="table" className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/40 text-foreground/90">
                  <th className="px-2 py-1.5 text-left font-semibold">Strategy</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Key Metric</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Annual Benefit</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Cost/Outlay</th>
                  <th className="px-2 py-1.5 text-center font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/30">
                  <td className="px-2 py-1.5 font-medium flex items-center gap-1"><Landmark className="w-3 h-3 text-blue-500" /> Premium Finance</td>
                  <td className="px-2 py-1.5 text-right">{plan.strategies.premiumFinance.leverage} leverage</td>
                  <td className="px-2 py-1.5 text-right font-medium text-blue-400">{fmtSm(plan.strategies.premiumFinance.taxEfficiency)}</td>
                  <td className="px-2 py-1.5 text-right text-muted-foreground">{fmtSm(plan.strategies.premiumFinance.totalOutlay)}</td>
                  <td className="px-2 py-1.5 text-center">{plan.strategies.premiumFinance.netBenefit >= 0 ? <CheckCircle2 className="w-3 h-3 text-green-500 mx-auto" /> : <AlertTriangle className="w-3 h-3 text-red-500 mx-auto" />}</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="px-2 py-1.5 font-medium flex items-center gap-1"><Shield className="w-3 h-3 text-purple-500" /> ILIT</td>
                  <td className="px-2 py-1.5 text-right">{fmtSm(plan.strategies.ilit.netToHeirs)} to heirs</td>
                  <td className="px-2 py-1.5 text-right font-medium text-purple-400">{fmtSm(Math.round(plan.strategies.ilit.estateTaxSaved * 0.04))}</td>
                  <td className="px-2 py-1.5 text-right text-muted-foreground">{fmtSm(advResult.ilit.premium)}/yr</td>
                  <td className="px-2 py-1.5 text-center">{plan.strategies.ilit.estateTaxSaved > 0 ? <CheckCircle2 className="w-3 h-3 text-green-500 mx-auto" /> : <Info className="w-3 h-3 text-muted-foreground mx-auto" />}</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="px-2 py-1.5 font-medium flex items-center gap-1"><Briefcase className="w-3 h-3 text-amber-500" /> Executive Comp</td>
                  <td className="px-2 py-1.5 text-right">{fmtSm(plan.strategies.execComp.totalComp)} total</td>
                  <td className="px-2 py-1.5 text-right font-medium text-amber-400">{fmtSm(plan.strategies.execComp.employerTaxBenefit)}</td>
                  <td className="px-2 py-1.5 text-right text-muted-foreground">—</td>
                  <td className="px-2 py-1.5 text-center">{plan.strategies.execComp.employerTaxBenefit > 0 ? <CheckCircle2 className="w-3 h-3 text-green-500 mx-auto" /> : <Info className="w-3 h-3 text-muted-foreground mx-auto" />}</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="px-2 py-1.5 font-medium flex items-center gap-1"><Gift className="w-3 h-3 text-emerald-500" /> Charitable</td>
                  <td className="px-2 py-1.5 text-right">{fmtSm(plan.strategies.charitable.annualIncome)}/yr income</td>
                  <td className="px-2 py-1.5 text-right font-medium text-emerald-400">{fmtSm(plan.strategies.charitable.taxDeduction)}</td>
                  <td className="px-2 py-1.5 text-right text-muted-foreground">{fmtSm(plan.strategies.charitable.totalCharitable)} given</td>
                  <td className="px-2 py-1.5 text-center">{plan.strategies.charitable.taxDeduction > 0 ? <CheckCircle2 className="w-3 h-3 text-green-500 mx-auto" /> : <Info className="w-3 h-3 text-muted-foreground mx-auto" />}</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="px-2 py-1.5 font-medium flex items-center gap-1"><Building2 className="w-3 h-3 text-red-500" /> Business</td>
                  <td className="px-2 py-1.5 text-right">{plan.strategies.business.continuityScore}% continuity</td>
                  <td className="px-2 py-1.5 text-right font-medium text-red-400">{fmtSm(plan.strategies.business.totalProtection)}</td>
                  <td className="px-2 py-1.5 text-right text-muted-foreground">{fmtSm(bizResult.totalAnnualCost)}/yr</td>
                  <td className="px-2 py-1.5 text-center">{plan.strategies.business.continuityScore >= 70 ? <CheckCircle2 className="w-3 h-3 text-green-500 mx-auto" /> : <AlertTriangle className="w-3 h-3 text-amber-500 mx-auto" />}</td>
                </tr>
                <tr className="bg-primary/5 font-bold">
                  <td className="px-2 py-2">TOTAL</td>
                  <td className="px-2 py-2 text-right">—</td>
                  <td className="px-2 py-2 text-right text-primary">{fmtSm(plan.totalProjectedBenefit)}/yr</td>
                  <td className="px-2 py-2 text-right">{fmtSm(plan.totalAnnualCost)}/yr</td>
                  <td className="px-2 py-2 text-center">
                    <Badge variant={plan.goalMet ? 'default' : 'destructive'} className="text-[9px]">
                      {plan.goalMet ? 'On Track' : 'Below Goal'}
                    </Badge>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ─── CASCADE TO CLIENT PLANNING ─── */}
      <Card>
        <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowCascade(!showCascade)}>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              Cascade to Client Planning
              <RefTip text="Shows how advanced strategies cascade into the client's holistic financial plan. ILIT reduces estate tax burden, charitable vehicles provide income streams, premium finance enhances tax efficiency, and business planning protects continuity." refId="advanced-hub" />
            </span>
            {showCascade ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </CardTitle>
        </CardHeader>
        {showCascade && (
          <CardContent>
            <div className="space-y-2 text-[11px]">
              {plan.benefitToClientPlanCascade.estateTaxReduction > 0 && (
                <div className="flex items-center gap-2 bg-purple-500/5 border border-purple-500/20 rounded-md px-3 py-1.5">
                  <Shield className="w-3 h-3 text-purple-400" />
                  <span>ILIT saves <span className="font-bold text-purple-400">{fmtSm(plan.benefitToClientPlanCascade.estateTaxReduction)}</span> in estate tax</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  <span>increases net to heirs</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  <span>improves Estate Planning score</span>
                  {p.onNavigateToPanel && (
                    <button onClick={() => p.onNavigateToPanel!('estate')} className="text-[9px] text-primary hover:underline ml-auto">
                      View Estate →
                    </button>
                  )}
                </div>
              )}
              {plan.benefitToClientPlanCascade.taxSavingsBoost > 0 && (
                <div className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/20 rounded-md px-3 py-1.5">
                  <Landmark className="w-3 h-3 text-emerald-400" />
                  <span>Tax savings of <span className="font-bold text-emerald-400">{fmtSm(plan.benefitToClientPlanCascade.taxSavingsBoost)}/yr</span></span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  <span>adds {fmtSm(Math.round(plan.benefitToClientPlanCascade.taxSavingsBoost / 12))}/mo to Cash Flow</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  <span>compounds Growth</span>
                  {p.onNavigateToPanel && (
                    <button onClick={() => p.onNavigateToPanel!('tax')} className="text-[9px] text-primary hover:underline ml-auto">
                      View Tax →
                    </button>
                  )}
                </div>
              )}
              {plan.benefitToClientPlanCascade.protectionEnhancement > 0 && (
                <div className="flex items-center gap-2 bg-red-500/5 border border-red-500/20 rounded-md px-3 py-1.5">
                  <Building2 className="w-3 h-3 text-red-400" />
                  <span>Business protection of <span className="font-bold text-red-400">{fmtSm(plan.benefitToClientPlanCascade.protectionEnhancement)}</span></span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  <span>reduces Protection gap</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  <span>secures business continuity</span>
                  {p.onNavigateToPanel && (
                    <button onClick={() => p.onNavigateToPanel!('protect')} className="text-[9px] text-primary hover:underline ml-auto">
                      View Protection →
                    </button>
                  )}
                </div>
              )}
              {plan.benefitToClientPlanCascade.retirementBoost > 0 && (
                <div className="flex items-center gap-2 bg-blue-500/5 border border-blue-500/20 rounded-md px-3 py-1.5">
                  <DollarSign className="w-3 h-3 text-blue-400" />
                  <span>CRT income stream of <span className="font-bold text-blue-400">{fmtSm(plan.strategies.charitable.annualIncome)}/yr</span></span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  <span>20yr value: {fmtSm(plan.benefitToClientPlanCascade.retirementBoost)}</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  <span>supplements retirement income</span>
                  {p.onNavigateToPanel && (
                    <button onClick={() => p.onNavigateToPanel!('retire')} className="text-[9px] text-primary hover:underline ml-auto">
                      View Retirement →
                    </button>
                  )}
                </div>
              )}
              {/* Net worth impact summary */}
              <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-md px-3 py-2 mt-1">
                <TrendingUp className="w-3 h-3 text-primary" />
                <span className="font-semibold">Net Worth Impact: <span className="text-primary">{fmtSm(plan.benefitToClientPlanCascade.netWorthImpact)}</span></span>
                <span className="text-muted-foreground ml-2">across all advanced strategies</span>
                {p.onNavigateToPanel && (
                  <button onClick={() => p.onNavigateToPanel!('client-wealth-hub')} className="text-[9px] text-primary hover:underline ml-auto">
                    View Unified Wealth Plan →
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ─── BACK-SOLVE SECTION ─── */}
      {hubComplexity !== 'simple' && <Card>
        <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowBackSolve(!showBackSolve)}>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              Back-Solve: Strategy Mix to Hit Goal
              <RefTip text="Given your benefit target, this calculates the required strategy allocation to achieve it. Shows whether the goal is achievable with current inputs or requires adjustment." refId="advanced-hub" />
            </span>
            {showBackSolve ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </CardTitle>
        </CardHeader>
        {showBackSolve && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
              <KPI label="Gap to Goal" value={fmtSm(plan.backSolve.gapToGoal)}
                variant={plan.backSolve.gapToGoal === 0 ? 'grn' : 'red'}
                sub={plan.backSolve.achievable ? 'Achievable' : 'May need larger inputs'} />
              <KPI label="Required PF" value={`${plan.backSolve.requiredPFAllocation}%`}
                variant={plan.backSolve.requiredPFAllocation <= 40 ? 'grn' : 'gld'}
                sub={`Current: ${strategyAllocation.premiumFinance}%`} />
              <KPI label="Required ILIT" value={`${plan.backSolve.requiredILITAllocation}%`}
                variant={plan.backSolve.requiredILITAllocation <= 40 ? 'grn' : 'gld'}
                sub={`Current: ${strategyAllocation.ilit}%`} />
            </div>

            {!plan.backSolve.achievable && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-md px-3 py-2 text-[11px]">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  <span className="font-medium text-amber-400">Goal May Require Larger Inputs</span>
                </div>
                <p className="text-muted-foreground">
                  Current strategy inputs produce <span className="font-bold text-foreground">{fmtSm(plan.totalProjectedBenefit)}/yr</span> vs goal of <span className="font-bold text-foreground">{fmtSm(benefitGoal)}/yr</span>.
                  Consider increasing premium finance face amount, ILIT death benefit, or charitable contributions.
                </p>
              </div>
            )}
          </CardContent>
        )}
      </Card>}

      {/* ─── SENSITIVITY ANALYSIS ─── */}
      {hubComplexity === 'expert' && <Card>
        <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowSensitivity(!showSensitivity)}>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              Sensitivity Analysis — What If?
              <RefTip text="Shows how changes in interest rates, tax rates, business value, and income impact your strategy benefits and costs." refId="advanced-hub" />
            </span>
            {showSensitivity ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </CardTitle>
        </CardHeader>
        {showSensitivity && (
          <CardContent>
            <div className="overflow-x-auto -mx-2 px-2">
              <table role="table" className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/40 text-foreground/90">
                    <th className="px-2 py-1.5 text-left font-semibold">Scenario</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Benefit Impact</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Cost Impact</th>
                    <th className="px-2 py-1.5 text-right font-semibold">% Change</th>
                  </tr>
                </thead>
                <tbody>
                  {sensitivity.scenarios.map((s, i) => (
                    <tr key={i} className="border-b border-border/30 hover:bg-card/50">
                      <td className="px-2 py-1.5 font-medium">{s.label}</td>
                      <td className={`px-2 py-1.5 text-right font-semibold ${s.impactOnBenefit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {s.impactOnBenefit >= 0 ? '+' : ''}{fmtSm(s.impactOnBenefit)}
                      </td>
                      <td className={`px-2 py-1.5 text-right ${s.impactOnCost >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {s.impactOnCost >= 0 ? '+' : ''}{fmtSm(s.impactOnCost)}
                      </td>
                      <td className={`px-2 py-1.5 text-right ${s.impactPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {s.impactPct >= 0 ? '+' : ''}{(s.impactPct * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Sensitivity bar chart */}
            <div className="mt-4 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sensitivity.scenarios} layout="vertical" margin={{ left: 110, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis type="number" tickFormatter={v => fmtSm(v)} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={105} />
                  <RTooltip formatter={(v: number) => fmtSm(v)} labelStyle={{ fontSize: 11 }} />
                  <Bar dataKey="impactOnBenefit" name="Benefit Impact">
                    {sensitivity.scenarios.map((s, i) => (
                      <Cell key={i} fill={s.impactOnBenefit >= 0 ? '#22c55e' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        )}
      </Card>}

      {/* ─── TIME-PHASED PROJECTIONS ─── */}
      {hubComplexity !== 'simple' && <Card>
        <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowTimeline(!showTimeline)}>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              Strategy Timeline — Multi-Year Projection
              <RefTip text="Projects the cumulative benefit of all advanced strategies over time. Shows premium finance cash value vs loan balance, ILIT estate savings, executive retention value, and charitable income accumulation." refId="advanced-hub" />
            </span>
            {showTimeline ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </CardTitle>
        </CardHeader>
        {showTimeline && (
          <CardContent>
            {/* Stacked area chart */}
            <div className="h-64 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeline} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="year" tick={{ fontSize: 10 }} label={{ value: 'Year', position: 'insideBottom', offset: -5, fontSize: 10 }} />
                  <YAxis tickFormatter={v => fmtSm(v)} tick={{ fontSize: 10 }} />
                  <RTooltip formatter={(v: number) => fmt(v)} labelFormatter={l => `Year ${l}`} />
                  <Area type="monotone" dataKey="pfNetBenefit" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} name="PF Net Benefit" />
                  <Area type="monotone" dataKey="ilitEstateSavings" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} name="ILIT Estate Savings" />
                  <Area type="monotone" dataKey="execRetentionValue" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} name="Exec Retention" />
                  <Area type="monotone" dataKey="charitableIncome" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.3} name="Charitable Income" />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Key milestones table */}
            <SectionHeader>Key Milestones</SectionHeader>
            <div className="overflow-x-auto -mx-2 px-2">
              <table role="table" className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="px-2 py-1.5 text-left font-semibold">Year</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Total Benefit</th>
                    <th className="px-2 py-1.5 text-right font-semibold">PF Net</th>
                    <th className="px-2 py-1.5 text-right font-semibold">ILIT Savings</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Cumulative Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.filter((_, i) => i === 0 || (i + 1) % 5 === 0 || i === timeline.length - 1).map((t, i) => (
                    <tr key={i} className={`border-b border-border/30 ${i === timeline.length - 1 ? 'bg-primary/5 font-bold' : ''}`}>
                      <td className="px-2 py-1.5">{t.year}</td>
                      <td className="px-2 py-1.5 text-right text-primary">{fmtSm(t.totalBenefit)}</td>
                      <td className={`px-2 py-1.5 text-right ${t.pfNetBenefit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtSm(t.pfNetBenefit)}</td>
                      <td className="px-2 py-1.5 text-right text-purple-400">{fmtSm(t.ilitEstateSavings)}</td>
                      <td className="px-2 py-1.5 text-right text-muted-foreground">{fmtSm(t.cumulativeCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        )}
      </Card>}

      {/* ─── ALLOCATION PIE CHART ─── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Strategy Allocation Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={STRATEGY_CONFIG.map(s => ({
                    name: s.label,
                    value: strategyAllocation[s.key as keyof typeof strategyAllocation],
                    fill: s.color,
                  }))}
                  cx="50%" cy="50%" innerRadius={35} outerRadius={65}
                  paddingAngle={2} dataKey="value"
                  label={({ name, value }) => `${name} ${value}%`}
                >
                  {STRATEGY_CONFIG.map(s => (
                    <Cell key={s.key} fill={s.color} />
                  ))}
                </Pie>
                <RTooltip formatter={(v: number) => `${v}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ─── CASCADE FLOW DIAGRAM ─── */}
      {hubComplexity === 'expert' && <CascadeSankey compact />}

      {/* ─── CASCADE AUDIT TRAIL ─── */}
      {hubComplexity === 'expert' && we.cascadeAuditEntries.length > 0 && (
        <CascadeAuditTrail entries={we.cascadeAuditEntries} onClear={() => {}} />
      )}
    </section>
  );
}
