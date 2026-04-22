/* ═══════════════════════════════════════════════════════════════
   ClientWealthHub — Unified Client Wealth Planning Hub
   Mirrors Practice Management's MyPlanPanel pattern:
   - Target-driven: set retirement income goal → cascade to all domains
   - Domain allocation sliders with drag-to-rebalance
   - Back-solve: given a goal, what inputs are needed?
   - Sensitivity analysis: what-if on key variables
   - Time-phased projections with Recharts visualization
   - On-track score with domain breakdown
   ═══════════════════════════════════════════════════════════════ */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useWealthEngine } from '@/contexts/WealthEngineContext';
import { CascadeAuditTrail } from './CascadeAuditTrail';
import { CascadeSankey } from './CascadeSankey';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { useAuth } from '@/_core/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Target, TrendingUp, Shield, DollarSign, PiggyBank, GraduationCap,
  Building2, Landmark, ArrowRight, RefreshCw, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle2, Info, Save, Download, BookOpen,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, LineChart, Line, CartesianGrid, Area, AreaChart,
} from 'recharts';
import { fmt, fmtSm, pct } from './format';
import { KPI, RefTip, ComplexityToggle, type ComplexityLevel, type PanelProps } from './shared';
import { SectionHeader, ScoreRing, AllocationSlider } from './shared-ui';
import {
  calcUnifiedClientPlan, calcClientSensitivity, calcClientTimePhasedProjections,
  type UnifiedClientPlan, type ClientSensitivityResult, type ClientTimeProjection,
} from './engine';

/* ═══ DOMAIN CONFIG ═══ */
const DOMAIN_CONFIG = [
  { key: 'protection', label: 'Protection', icon: Shield, color: '#ef4444', desc: 'Insurance premiums & coverage' },
  { key: 'growth', label: 'Growth', icon: TrendingUp, color: '#f59e0b', desc: 'Investment accumulation' },
  { key: 'retirement', label: 'Retirement', icon: PiggyBank, color: '#3b82f6', desc: 'Retirement savings' },
  { key: 'tax', label: 'Tax Optimization', icon: Landmark, color: '#10b981', desc: 'Tax strategy effort' },
  { key: 'estate', label: 'Estate Planning', icon: Building2, color: '#8b5cf6', desc: 'Wealth transfer planning' },
  { key: 'education', label: 'Education', icon: GraduationCap, color: '#ec4899', desc: '529 & education funding' },
] as const;

/* ═══ SMALL HELPERS (shared-ui imports above) ═══ */

/* DomainSlider → AllocationSlider from shared-ui */
const DomainSlider = AllocationSlider;

/* ScoreRing → imported from shared-ui (with default labels: On Track / Needs Attention / At Risk / Critical) */

/* ═══ MAIN COMPONENT ═══ */
/* Domain → panel navigation map */
const DOMAIN_PANEL_MAP: Record<string, string> = {
  protection: 'protect',
  growth: 'grow',
  retirement: 'retire',
  tax: 'tax',
  estate: 'estate',
  education: 'edu',
};

export function ClientWealthHub(p: PanelProps & { onNavigateToPanel?: (panelId: string) => void }) {
  // Wealth engine context for cascade audit trail
  const we = useWealthEngine();
  // Local state for the hub
  const [retirementGoal, setRetirementGoal] = useState(() => {
    // Default: 80% of current income
    return Math.round((p.income + p.spouseIncome) * 0.8);
  });
  const [showSensitivity, setShowSensitivity] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showBackSolve, setShowBackSolve] = useState(false);
  const [hubComplexity, setHubComplexity] = useState<ComplexityLevel>(() => {
    try { const saved = localStorage.getItem('we-client-complexity');
    return (saved === 'simple' || saved === 'detailed' || saved === 'expert') ? saved : 'detailed'; } catch { return 'detailed'; }
  });
  const handleComplexityChange = (v: ComplexityLevel) => { setHubComplexity(v); try { localStorage.setItem('we-client-complexity', v); } catch {} };
  const [domainAllocation, setDomainAllocation] = useState({
    protection: 15, growth: 30, retirement: 25, tax: 10, estate: 10, education: 10,
  });
  const [saveLabel, setSaveLabel] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  // Auth for save functionality
  const { user } = useAuth();

  // Load presets from DB (general defaults + user's own)
  const presetsQuery = trpc.hubAllocations.list.useQuery({ hubType: 'client' });
  const saveMutation = trpc.hubAllocations.save.useMutation({
    onSuccess: () => {
      toast.success('Allocation preset saved');
      setShowSaveInput(false);
      setSaveLabel('');
      presetsQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  // Apply a preset
  const applyPreset = useCallback((presetId: string) => {
    const preset = presetsQuery.data?.find(p => p.id.toString() === presetId);
    if (!preset) return;
    const alloc = preset.allocations as Record<string, number>;
    setDomainAllocation(prev => {
      const result = { ...prev };
      Object.keys(result).forEach(k => { if (alloc[k] !== undefined) result[k as keyof typeof result] = alloc[k]; });
      return result;
    });
    if (preset.inputOverrides) {
      const ov = preset.inputOverrides as Record<string, number>;
      if (ov.retireAge) p.setRetireAge?.(ov.retireAge);
      if (ov.monthlyGoal) setRetirementGoal(ov.monthlyGoal * 12);
    }
    toast.success(`Applied preset: ${preset.label}`);
  }, [presetsQuery.data]);

  // Save current allocation as preset
  const handleSave = useCallback(() => {
    if (!saveLabel.trim()) { toast.error('Enter a name for this preset'); return; }
    saveMutation.mutate({
      hubType: 'client',
      label: saveLabel.trim(),
      allocations: domainAllocation,
      // @ts-expect-error — excess property in object literal
      inputOverrides: { retireAge: p.retireAge, monthlyGoal: Math.round(retirementGoal / 12) },
    });
  }, [saveLabel, domainAllocation, p.retireAge, retirementGoal]);

  // Unified plan calculation
  const plan = useMemo(() => calcUnifiedClientPlan(
    p.income + p.spouseIncome, p.age, p.retireAge, retirementGoal,
    p.cfResult, p.prResult, p.grResult, p.rtResult, p.txResult, p.esResult, p.edResult,
    p.monthlySav, p.savings, p.retirement401k, domainAllocation,
  ), [p.income, p.spouseIncome, p.age, p.retireAge, retirementGoal,
    p.cfResult, p.prResult, p.grResult, p.rtResult, p.txResult, p.esResult, p.edResult,
    p.monthlySav, p.savings, p.retirement401k, domainAllocation]);

  // Sensitivity analysis
  const sensitivity = useMemo(() => calcClientSensitivity(
    p.income + p.spouseIncome, p.age, p.retireAge,
    p.monthlySav, p.savings, p.retirement401k,
    p.iulReturn, p.infRate, p.txResult.effectiveRate,
  ), [p.income, p.spouseIncome, p.age, p.retireAge, p.monthlySav, p.savings, p.retirement401k, p.iulReturn, p.infRate, p.txResult.effectiveRate]);

  // Time-phased projections
  const timeline = useMemo(() => calcClientTimePhasedProjections(
    p.age, p.retireAge, p.income + p.spouseIncome,
    p.monthlySav, p.savings, p.retirement401k,
    p.iulReturn, p.infRate, p.prResult.totalPremium,
  ), [p.age, p.retireAge, p.income, p.spouseIncome, p.monthlySav, p.savings, p.retirement401k, p.iulReturn, p.infRate, p.prResult.totalPremium]);

  // Forward cascade: when retirement goal changes, push proportional changes
  const forwardCascade = useCallback((newGoal: number) => {
    setRetirementGoal(newGoal);
    // Calculate required monthly savings using 4% rule
    const wealthTarget = Math.round(newGoal / 0.04);
    const yrs = Math.max(1, p.retireAge - p.age);
    const rm = 0.07 / 12;
    const n = yrs * 12;
    const existingFV = (p.savings + p.retirement401k) * Math.pow(1 + rm, n);
    const remaining = Math.max(0, wealthTarget - existingFV);
    const requiredMonthly = rm > 0 && n > 0
      ? Math.round(remaining / ((Math.pow(1 + rm, n) - 1) / rm))
      : Math.round(remaining / Math.max(1, n));
    p.setMonthlySav(Math.min(requiredMonthly, Math.round((p.income + p.spouseIncome) / 12 * 0.5)));
  }, [p.retireAge, p.age, p.savings, p.retirement401k, p.income, p.spouseIncome]);

  // Drag-to-rebalance domain allocation
  const handleDomainDrag = useCallback((domain: string, newPct: number) => {
    setDomainAllocation(prev => {
      const others = Object.entries(prev).filter(([k]) => k !== domain);
      const remaining = 100 - newPct;
      const othersTotal = others.reduce((s, [, v]) => s + v, 0);
      const scale = othersTotal > 0 ? remaining / othersTotal : 0;
      const result: Record<string, number> = { [domain]: newPct };
      others.forEach(([k, v]) => { result[k] = Math.max(0, Math.round(v * scale)); });
      // Ensure total is 100
      const total = Object.values(result).reduce((s, v) => s + v, 0);
      if (total !== 100) {
        const largest = others.reduce((a, b) => (result[a[0]] > result[b[0]] ? a : b))[0];
        result[largest] += 100 - total;
      }
      return result as typeof prev;
    });
  }, []);

  // Domain score breakdown for pie chart
  const domainScores = useMemo(() => {
    const d = plan.domains;
    return [
      { name: 'Cash Flow', score: d.cashFlow.saveRate >= 0.2 ? 100 : d.cashFlow.saveRate >= 0.1 ? 70 : 40, color: '#22c55e' },
      { name: 'Protection', score: d.protection.gap === 0 ? 100 : Math.max(0, Math.round(d.protection.coverageRatio * 100)), color: '#ef4444' },
      { name: 'Growth', score: plan.totalWealthTarget > 0 ? Math.min(100, Math.round(d.growth.projectedWealth / plan.totalWealthTarget * 100)) : 50, color: '#f59e0b' },
      { name: 'Retirement', score: d.retirement.incomeGap <= 0 ? 100 : Math.max(0, 100 - Math.round(d.retirement.incomeGap / Math.max(1, retirementGoal) * 100)), color: '#3b82f6' },
      { name: 'Tax', score: d.tax.totalSavings > 0 ? Math.min(100, 60 + Math.round(d.tax.totalSavings / Math.max(1, p.income) * 200)) : 30, color: '#10b981' },
      { name: 'Estate', score: d.estate.estateTax === 0 ? 100 : Math.max(0, 100 - Math.round(d.estate.estateTax / Math.max(1, d.estate.netToHeirs + d.estate.estateTax) * 100)), color: '#8b5cf6' },
      { name: 'Education', score: d.education.totalGap === 0 ? 100 : Math.max(0, 100 - Math.round(d.education.totalGap / Math.max(1, d.education.totalGap + 100000) * 100)), color: '#ec4899' },
    ];
  }, [plan, retirementGoal, p.income]);

  return (
    <section aria-label="Unified Client Wealth Hub" role="region">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" /> Unified Wealth Plan
        </h2>
        <div className="flex items-center gap-2">
          <ComplexityToggle value={hubComplexity} onChange={handleComplexityChange} />
          <Badge variant="outline" className="text-[10px]">
            {p.retireAge - p.age} years to retirement
          </Badge>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Set your retirement income goal — all domains cascade automatically. Drag sliders to rebalance priorities.
        <RefTip text="Unified planning uses the 4% safe withdrawal rate (Trinity Study), DIME method for protection, and multi-vehicle growth projections. All domains are interconnected — changing one cascades to all others." refId="planning" />
      </p>

      {/* ─── PRESET SELECTOR ─── */}
      <Card className="mb-4 border-muted">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 flex-wrap">
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
                  <Input
                    className="h-8 w-[150px] text-xs"
                    placeholder="Preset name..."
                    value={saveLabel}
                    onChange={e => setSaveLabel(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSave()}
                  />
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleSave} disabled={saveMutation.isPending}>
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
        </CardContent>
      </Card>

      {/* ─── TARGET INCOME GOAL ─── */}
      <Card className="mb-4 border-primary/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" /> Retirement Income Goal
            <RefTip text="Your target annual income in retirement. The 4% rule (Trinity Study) determines the total wealth needed: Goal ÷ 0.04 = Required Wealth." refId="planning" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="space-y-1">
              <Label className="text-[10px] font-medium text-muted-foreground">Annual Retirement Income Goal</Label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60">$</span>
                <Input type="number" value={retirementGoal} onChange={e => forwardCascade(+e.target.value || 0)}
                  className="h-8 text-sm pl-6 font-bold text-primary" />
              </div>
            </div>
            <KPI label="Wealth Target (4% Rule)" value={fmtSm(plan.totalWealthTarget)} variant="blu" sub={`${fmt(retirementGoal)}/yr ÷ 4%`} />
            <KPI label="Current Projected" value={fmtSm(plan.totalProjectedWealth)} variant={plan.wealthGapToGoal === 0 ? 'grn' : 'gld'} sub={`${pct(plan.totalProjectedWealth / Math.max(1, plan.totalWealthTarget))} of target`} />
            <KPI label="Wealth Gap" value={fmtSm(plan.wealthGapToGoal)} variant={plan.wealthGapToGoal === 0 ? 'grn' : 'red'} sub={plan.wealthGapToGoal === 0 ? 'On track!' : `Need ${fmtSm(plan.wealthGapToGoal)} more`} />
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="text-[10px] text-muted-foreground self-center">Quick targets:</span>
            {[0.6, 0.7, 0.8, 0.9, 1.0].map(mult => (
              <Button key={mult} variant="outline" size="sm" className="h-6 text-[10px] px-2"
                onClick={() => forwardCascade(Math.round((p.income + p.spouseIncome) * mult))}>
                {(mult * 100).toFixed(0)}% of income ({fmtSm(Math.round((p.income + p.spouseIncome) * mult))})
              </Button>
            ))}
          </div>

          {/* Forward cascade indicator */}
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
            <RefreshCw className="w-3 h-3 text-primary" />
            <span>Changing the goal automatically adjusts monthly savings target via forward cascade.</span>
            <ArrowRight className="w-3 h-3" />
            <span className="font-medium text-foreground">Current: {fmt(p.monthlySav)}/mo</span>
          </div>
        </CardContent>
      </Card>

      {/* ─── ON-TRACK SCORE ─── */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            On-Track Score
            <RefTip text="Weighted composite score across 7 domains: Protection (20%), Growth (25%), Cash Flow (15%), Retirement (20%), Tax (8%), Estate (7%), Education (5%). Based on gap analysis vs industry benchmarks." refId="planning" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-6 items-center">
            <div className="relative">
              <ScoreRing score={plan.onTrackScore} />
            </div>
            <div className="flex-1 w-full">
              <div className="space-y-2">
                {domainScores.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="text-[10px] w-20 text-muted-foreground">{d.name}</span>
                    <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${d.score}%`, backgroundColor: d.color }} />
                    </div>
                    <span className="text-[10px] font-semibold w-8 text-right" style={{ color: d.color }}>{d.score}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Alerts for low-scoring domains */}
          {domainScores.filter(d => d.score < 60).length > 0 && (
            <div className="mt-4 space-y-1">
              <SectionHeader>Action Required</SectionHeader>
              {domainScores.filter(d => d.score < 60).map(d => (
                <div key={d.name} className="flex items-center gap-2 text-[11px] bg-red-500/5 border border-red-500/20 rounded-md px-3 py-1.5">
                  <AlertTriangle className="w-3 h-3 text-red-400" />
                  <span className="text-red-400 font-medium">{d.name}</span>
                  <span className="text-muted-foreground">score {d.score}/100 — needs attention</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── DOMAIN ALLOCATION SLIDERS ─── */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            Priority Allocation
            <RefTip text="Drag sliders to rebalance your financial priorities. This affects how your available surplus is allocated across domains. Other domains auto-adjust proportionally." refId="planning" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {DOMAIN_CONFIG.map(d => (
              <DomainSlider
                key={d.key}
                label={d.label}
                value={domainAllocation[d.key as keyof typeof domainAllocation]}
                color={d.color}
                icon={d.icon}
                desc={d.desc}
                amount={fmtSm(Math.round(Math.max(0, plan.domains.cashFlow.monthlyAvailable) * 12 * domainAllocation[d.key as keyof typeof domainAllocation] / 100))}
                onDrag={(v) => handleDomainDrag(d.key, v)}
                onNavigate={p.onNavigateToPanel ? () => p.onNavigateToPanel!(DOMAIN_PANEL_MAP[d.key] || d.key) : undefined}
              />
            ))}
          </div>
          <Separator className="my-3" />
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Available annual surplus for allocation:</span>
            <span className="font-bold text-primary">{fmtSm(Math.max(0, plan.domains.cashFlow.monthlyAvailable * 12))}</span>
          </div>
        </CardContent>
      </Card>

      {/* ─── DOMAIN ROLL-UP TABLE ─── */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Domain Roll-Up</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-2 px-2">
            <table role="table" className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/40 text-foreground/90">
                  <th className="px-2 py-1.5 text-left font-semibold">Domain</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Current</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Target</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Gap</th>
                  <th className="px-2 py-1.5 text-center font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/30">
                  <td className="px-2 py-1.5 font-medium flex items-center gap-1"><DollarSign className="w-3 h-3 text-green-500" /> Cash Flow</td>
                  <td className="px-2 py-1.5 text-right">{pct(plan.domains.cashFlow.saveRate)} save rate</td>
                  <td className="px-2 py-1.5 text-right">≥20%</td>
                  <td className="px-2 py-1.5 text-right">{plan.domains.cashFlow.saveRate >= 0.2 ? '—' : pct(0.2 - plan.domains.cashFlow.saveRate)}</td>
                  <td className="px-2 py-1.5 text-center">{plan.domains.cashFlow.saveRate >= 0.2 ? <CheckCircle2 className="w-3 h-3 text-green-500 mx-auto" /> : <AlertTriangle className="w-3 h-3 text-amber-500 mx-auto" />}</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="px-2 py-1.5 font-medium flex items-center gap-1"><Shield className="w-3 h-3 text-red-500" /> Protection</td>
                  <td className="px-2 py-1.5 text-right">{fmtSm(p.prResult.dimeNeed - p.prResult.gap)} covered</td>
                  <td className="px-2 py-1.5 text-right">{fmtSm(p.prResult.dimeNeed)}</td>
                  <td className="px-2 py-1.5 text-right font-medium text-red-400">{p.prResult.gap > 0 ? fmtSm(p.prResult.gap) : '—'}</td>
                  <td className="px-2 py-1.5 text-center">{p.prResult.gap === 0 ? <CheckCircle2 className="w-3 h-3 text-green-500 mx-auto" /> : <AlertTriangle className="w-3 h-3 text-red-500 mx-auto" />}</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="px-2 py-1.5 font-medium flex items-center gap-1"><TrendingUp className="w-3 h-3 text-amber-500" /> Growth</td>
                  <td className="px-2 py-1.5 text-right">{fmtSm(plan.domains.growth.projectedWealth)}</td>
                  <td className="px-2 py-1.5 text-right">{fmtSm(plan.totalWealthTarget)}</td>
                  <td className="px-2 py-1.5 text-right font-medium text-amber-400">{plan.wealthGapToGoal > 0 ? fmtSm(plan.wealthGapToGoal) : '—'}</td>
                  <td className="px-2 py-1.5 text-center">{plan.wealthGapToGoal === 0 ? <CheckCircle2 className="w-3 h-3 text-green-500 mx-auto" /> : <AlertTriangle className="w-3 h-3 text-amber-500 mx-auto" />}</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="px-2 py-1.5 font-medium flex items-center gap-1"><PiggyBank className="w-3 h-3 text-blue-500" /> Retirement</td>
                  <td className="px-2 py-1.5 text-right">{fmtSm(plan.domains.retirement.totalRetireIncome)}/yr</td>
                  <td className="px-2 py-1.5 text-right">{fmtSm(retirementGoal)}/yr</td>
                  <td className="px-2 py-1.5 text-right font-medium text-blue-400">{plan.domains.retirement.incomeGap > 0 ? fmtSm(plan.domains.retirement.incomeGap) + '/yr' : '—'}</td>
                  <td className="px-2 py-1.5 text-center">{plan.domains.retirement.incomeGap <= 0 ? <CheckCircle2 className="w-3 h-3 text-green-500 mx-auto" /> : <AlertTriangle className="w-3 h-3 text-blue-500 mx-auto" />}</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="px-2 py-1.5 font-medium flex items-center gap-1"><Landmark className="w-3 h-3 text-emerald-500" /> Tax</td>
                  <td className="px-2 py-1.5 text-right">{pct(plan.domains.tax.effectiveRate)} effective</td>
                  <td className="px-2 py-1.5 text-right">{pct(plan.domains.tax.optimizedRate)} optimized</td>
                  <td className="px-2 py-1.5 text-right font-medium text-emerald-400">{fmtSm(plan.domains.tax.totalSavings)} saved</td>
                  <td className="px-2 py-1.5 text-center">{plan.domains.tax.totalSavings > 0 ? <CheckCircle2 className="w-3 h-3 text-green-500 mx-auto" /> : <Info className="w-3 h-3 text-muted-foreground mx-auto" />}</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="px-2 py-1.5 font-medium flex items-center gap-1"><Building2 className="w-3 h-3 text-purple-500" /> Estate</td>
                  <td className="px-2 py-1.5 text-right">{fmtSm(plan.domains.estate.netToHeirs)} to heirs</td>
                  <td className="px-2 py-1.5 text-right">{fmtSm(plan.domains.estate.withPlanning)} w/ planning</td>
                  <td className="px-2 py-1.5 text-right font-medium text-purple-400">{plan.domains.estate.estateTax > 0 ? fmtSm(plan.domains.estate.estateTax) + ' tax' : '—'}</td>
                  <td className="px-2 py-1.5 text-center">{plan.domains.estate.estateTax === 0 ? <CheckCircle2 className="w-3 h-3 text-green-500 mx-auto" /> : <AlertTriangle className="w-3 h-3 text-purple-500 mx-auto" />}</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="px-2 py-1.5 font-medium flex items-center gap-1"><GraduationCap className="w-3 h-3 text-pink-500" /> Education</td>
                  <td className="px-2 py-1.5 text-right">{fmtSm(plan.domains.education.monthlyNeeded * 12)}/yr funding</td>
                  <td className="px-2 py-1.5 text-right">Gap: {fmtSm(plan.domains.education.totalGap)}</td>
                  <td className="px-2 py-1.5 text-right font-medium text-pink-400">{plan.domains.education.totalGap > 0 ? fmtSm(plan.domains.education.totalGap) : '—'}</td>
                  <td className="px-2 py-1.5 text-center">{plan.domains.education.totalGap === 0 ? <CheckCircle2 className="w-3 h-3 text-green-500 mx-auto" /> : <AlertTriangle className="w-3 h-3 text-pink-500 mx-auto" />}</td>
                </tr>
                <tr className="bg-primary/5 font-bold">
                  <td className="px-2 py-2">TOTAL ANNUAL COST</td>
                  <td className="px-2 py-2 text-right text-primary">{fmtSm(plan.totalAnnualCost)}</td>
                  <td className="px-2 py-2 text-right">{pct(plan.costAsPercentOfIncome)} of income</td>
                  <td colSpan={2} className="px-2 py-2 text-right text-muted-foreground text-[10px]">
                    Premiums + Savings + Contributions
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ─── BACK-SOLVE SECTION ─── */}
      {hubComplexity !== 'simple' && <Card className="mb-4">
        <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowBackSolve(!showBackSolve)}>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              Back-Solve: What Do You Need?
              <RefTip text="Given your retirement goal, back-solve calculates the required savings rate, monthly contribution, and investment return needed to reach your target." refId="planning" />
            </span>
            {showBackSolve ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </CardTitle>
        </CardHeader>
        {showBackSolve && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <KPI label="Required Save Rate" value={pct(plan.backSolve.requiredSaveRate)}
                variant={plan.backSolve.requiredSaveRate <= 0.25 ? 'grn' : plan.backSolve.requiredSaveRate <= 0.40 ? 'gld' : 'red'}
                sub={plan.backSolve.requiredSaveRate <= 0.25 ? 'Achievable' : plan.backSolve.requiredSaveRate <= 0.40 ? 'Aggressive' : 'Very aggressive'} />
              <KPI label="Required Monthly" value={fmt(plan.backSolve.requiredMonthly)}
                variant={plan.backSolve.requiredMonthly <= p.monthlySav ? 'grn' : 'gld'}
                sub={`Currently saving ${fmt(p.monthlySav)}/mo`} />
              <KPI label="Assumed Return" value={pct(plan.backSolve.requiredReturn)}
                variant="blu" sub="Blended portfolio return" />
              <KPI label="Years to Goal" value={`${plan.backSolve.yearsToGoal}`}
                variant={plan.backSolve.yearsToGoal <= p.retireAge - p.age ? 'grn' : 'red'}
                sub={`At current rate (retire in ${p.retireAge - p.age}yr)`} />
            </div>

            {/* Gap analysis */}
            {plan.backSolve.requiredMonthly > p.monthlySav && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-md px-3 py-2 text-[11px]">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  <span className="font-medium text-amber-400">Savings Gap Detected</span>
                </div>
                <p className="text-muted-foreground">
                  You need to save <span className="font-bold text-foreground">{fmt(plan.backSolve.requiredMonthly - p.monthlySav)}/mo more</span> to reach your goal.
                  Options: increase savings, extend timeline, reduce goal, or increase investment returns.
                </p>
              </div>
            )}
          </CardContent>
        )}
      </Card>}

      {/* ─── SENSITIVITY ANALYSIS ─── */}
      {hubComplexity === 'expert' &&
      <Card className="mb-4">
        <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowSensitivity(!showSensitivity)}>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              Sensitivity Analysis — What If?
              <RefTip text="Shows how changes in key variables (returns, savings, retirement age, inflation, taxes) impact your projected wealth and retirement income." refId="planning" />
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
                    <th className="px-2 py-1.5 text-right font-semibold">Wealth Impact</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Retire Income Impact</th>
                    <th className="px-2 py-1.5 text-right font-semibold">% Change</th>
                  </tr>
                </thead>
                <tbody>
                  {sensitivity.scenarios.map((s, i) => (
                    <tr key={i} className="border-b border-border/30 hover:bg-card/50">
                      <td className="px-2 py-1.5 font-medium">{s.label}</td>
                      <td className={`px-2 py-1.5 text-right font-semibold ${s.impactOnWealth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {s.impactOnWealth >= 0 ? '+' : ''}{fmtSm(s.impactOnWealth)}
                      </td>
                      <td className={`px-2 py-1.5 text-right ${s.impactOnRetireIncome >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {s.impactOnRetireIncome >= 0 ? '+' : ''}{fmtSm(s.impactOnRetireIncome)}/yr
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
                <BarChart data={sensitivity.scenarios} layout="vertical" margin={{ left: 100, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis type="number" tickFormatter={v => fmtSm(v)} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={95} />
                  <RTooltip formatter={(v: number) => fmtSm(v)} labelStyle={{ fontSize: 11 }} />
                  <Bar dataKey="impactOnWealth" name="Wealth Impact">
                    {sensitivity.scenarios.map((s, i) => (
                      <Cell key={i} fill={s.impactOnWealth >= 0 ? '#22c55e' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        )}
      </Card>}

      {/* ─── TIME-PHASED PROJECTIONS ─── */}
      {hubComplexity !== 'simple' &&
      <Card className="mb-4">
        <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowTimeline(!showTimeline)}>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              Wealth Timeline — Multi-Year Projection
              <RefTip text="Projects your total wealth, savings, retirement accounts, and protection value over time. The vertical line marks your retirement age." refId="planning" />
            </span>
            {showTimeline ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </CardTitle>
        </CardHeader>
        {showTimeline && (
          <CardContent>
            {/* Area chart */}
            <div className="h-64 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeline} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="age" tick={{ fontSize: 10 }} label={{ value: 'Age', position: 'insideBottom', offset: -5, fontSize: 10 }} />
                  <YAxis tickFormatter={v => fmtSm(v)} tick={{ fontSize: 10 }} />
                  <RTooltip formatter={(v: number) => fmt(v)} labelFormatter={l => `Age ${l}`} />
                  <Area type="monotone" dataKey="savings" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} name="Liquid Savings" />
                  <Area type="monotone" dataKey="retirement" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} name="Retirement Accounts" />
                  <Area type="monotone" dataKey="protection" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} name="Protection Value" />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {/* Retirement age marker */}
                  <CartesianGrid vertical={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Key milestones table */}
            <SectionHeader>Key Milestones</SectionHeader>
            <div className="overflow-x-auto -mx-2 px-2">
              <table role="table" className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="px-2 py-1.5 text-left font-semibold">Age</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Total Wealth</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Annual Income</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Cumulative Cost</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Milestone</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.filter((_, i) => i === 0 || (i + 1) % 5 === 0 || timeline[i].age === p.retireAge).map((t, i) => (
                    <tr key={i} className={`border-b border-border/30 ${t.age === p.retireAge ? 'bg-primary/5 font-bold' : ''}`}>
                      <td className="px-2 py-1.5">{t.age}{t.age === p.retireAge ? ' ★' : ''}</td>
                      <td className="px-2 py-1.5 text-right">{fmtSm(t.totalWealth)}</td>
                      <td className="px-2 py-1.5 text-right">{fmtSm(t.annualIncome)}</td>
                      <td className="px-2 py-1.5 text-right text-muted-foreground">{fmtSm(t.cumulativeCost)}</td>
                      <td className="px-2 py-1.5 text-[10px] text-muted-foreground">
                        {t.age === p.retireAge ? '🎯 Retirement' : t.age === p.age ? 'Today' : t.totalWealth >= plan.totalWealthTarget ? '✅ Goal reached' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        )}
      </Card>}

      {/* ─── DOMAIN PIE CHART ─── */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Allocation Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={DOMAIN_CONFIG.map(d => ({
                    name: d.label,
                    value: domainAllocation[d.key as keyof typeof domainAllocation],
                    fill: d.color,
                  }))}
                  cx="50%" cy="50%" innerRadius={40} outerRadius={70}
                  paddingAngle={2} dataKey="value"
                  label={({ name, value }) => `${name} ${value}%`}
                >
                  {DOMAIN_CONFIG.map(d => (
                    <Cell key={d.key} fill={d.color} />
                  ))}
                </Pie>
                <RTooltip formatter={(v: number) => `${v}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ─── CROSS-DOMAIN CASCADE SUMMARY ─── */}
      {hubComplexity !== 'simple' && <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            Cross-Domain Cascade
            <RefTip text="Shows how changes in one domain cascade to others. For example, increasing savings improves growth projections, which improves retirement readiness, which may reduce the need for certain insurance products." refId="planning" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-[11px]">
            {plan.domains.cashFlow.surplus > 0 && (
              <div className="flex items-center gap-2 bg-green-500/5 border border-green-500/20 rounded-md px-3 py-1.5">
                <DollarSign className="w-3 h-3 text-green-400" />
                <span>Cash surplus of <span className="font-bold text-green-400">{fmt(plan.domains.cashFlow.surplus)}/mo</span></span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <span>feeds Growth ({fmtSm(Math.round(plan.domains.cashFlow.surplus * 12 * domainAllocation.growth / 100))}/yr)</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <span>improves Retirement readiness</span>
              </div>
            )}
            {plan.domains.protection.gap > 0 && (
              <div className="flex items-center gap-2 bg-red-500/5 border border-red-500/20 rounded-md px-3 py-1.5">
                <Shield className="w-3 h-3 text-red-400" />
                <span>Protection gap of <span className="font-bold text-red-400">{fmtSm(plan.domains.protection.gap)}</span></span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <span>increases Estate risk</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <span>may reduce net to heirs by {fmtSm(Math.round(plan.domains.protection.gap * 0.3))}</span>
              </div>
            )}
            {plan.domains.tax.totalSavings > 0 && (
              <div className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/20 rounded-md px-3 py-1.5">
                <Landmark className="w-3 h-3 text-emerald-400" />
                <span>Tax savings of <span className="font-bold text-emerald-400">{fmtSm(plan.domains.tax.totalSavings)}/yr</span></span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <span>adds {fmtSm(Math.round(plan.domains.tax.totalSavings / 12))}/mo to Cash Flow</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <span>compounds Growth over {p.retireAge - p.age} years</span>
              </div>
            )}
            {plan.domains.education.totalGap > 0 && p.dep > 0 && (
              <div className="flex items-center gap-2 bg-pink-500/5 border border-pink-500/20 rounded-md px-3 py-1.5">
                <GraduationCap className="w-3 h-3 text-pink-400" />
                <span>Education gap of <span className="font-bold text-pink-400">{fmtSm(plan.domains.education.totalGap)}</span></span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <span>requires {fmt(plan.domains.education.monthlyNeeded)}/mo additional funding</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <span>reduces Growth allocation</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>}

      {/* ─── ADVANCED STRATEGIES CASCADE (live from AdvancedStrategiesHub) ─── */}
      {hubComplexity !== 'simple' && <AdvancedCascadeCard onNavigateToPanel={p.onNavigateToPanel} />}

      {/* ─── CASCADE FLOW DIAGRAM ─── */}
      {hubComplexity === 'expert' && <CascadeSankey compact />}

      {/* ─── CASCADE AUDIT TRAIL ─── */}
      {hubComplexity === 'expert' && we.cascadeAuditEntries.length > 0 && (
        <CascadeAuditTrail entries={we.cascadeAuditEntries} onClear={() => {}} />
      )}
    </section>
  );
}

/* ─── Sub-component: reads live cascade data from WealthEngineContext ─── */
function AdvancedCascadeCard({ onNavigateToPanel }: { onNavigateToPanel?: (id: string) => void }) {
  const we = useWealthEngine();
  const ac = we.advancedCascade;
  const hb = we.holisticBridge;
  const hasData = ac.totalAnnualBenefit > 0 || ac.totalAnnualCost > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Landmark className="w-4 h-4 text-blue-400" />
          Advanced Strategies Cascade
          <RefTip text="Live data from the Advanced Strategies Hub. When you adjust premium finance, ILIT, executive comp, charitable, or business strategies, their benefits cascade here in real-time — showing how advanced planning enhances your client wealth plan." refId="adv-cascade" />
          {hasData && <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-400">LIVE</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="text-center py-4 text-muted-foreground text-xs">
            <p className="mb-2">No advanced strategy data yet.</p>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => onNavigateToPanel?.('advanced-strategies-hub')}>
              Open Advanced Strategies Hub <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Holistic Score */}
            <div className="flex items-center justify-between bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg px-4 py-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-medium">Holistic Wealth Score</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground">Client {hb.clientHubScore}%</span>
                <span className="text-[10px] text-muted-foreground">Advanced {hb.advancedHubScore}%</span>
                <Badge className={`text-xs ${hb.holisticScore >= 70 ? 'bg-green-500/20 text-green-400' : hb.holisticScore >= 40 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                  {hb.holisticScore}%
                </Badge>
              </div>
            </div>

            {/* Cascade benefits */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {ac.protectionEnhancement > 0 && (
                <div className="flex items-center gap-1.5 bg-green-500/5 border border-green-500/20 rounded-md px-2 py-1.5">
                  <Shield className="w-3 h-3 text-green-400 shrink-0" />
                  <span>+{fmtSm(ac.protectionEnhancement)} protection</span>
                </div>
              )}
              {ac.taxSavingsBoost > 0 && (
                <div className="flex items-center gap-1.5 bg-emerald-500/5 border border-emerald-500/20 rounded-md px-2 py-1.5">
                  <DollarSign className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>+{fmtSm(ac.taxSavingsBoost)}/yr tax savings</span>
                </div>
              )}
              {ac.estateTaxReduction > 0 && (
                <div className="flex items-center gap-1.5 bg-blue-500/5 border border-blue-500/20 rounded-md px-2 py-1.5">
                  <Building2 className="w-3 h-3 text-blue-400 shrink-0" />
                  <span>-{fmtSm(ac.estateTaxReduction)} estate tax</span>
                </div>
              )}
              {ac.retirementBoost > 0 && (
                <div className="flex items-center gap-1.5 bg-purple-500/5 border border-purple-500/20 rounded-md px-2 py-1.5">
                  <PiggyBank className="w-3 h-3 text-purple-400 shrink-0" />
                  <span>+{fmtSm(ac.retirementBoost)}/yr income</span>
                </div>
              )}
              {ac.netWorthImpact !== 0 && (
                <div className={`flex items-center gap-1.5 ${ac.netWorthImpact > 0 ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'} border rounded-md px-2 py-1.5 col-span-2`}>
                  <TrendingUp className={`w-3 h-3 ${ac.netWorthImpact > 0 ? 'text-green-400' : 'text-red-400'} shrink-0`} />
                  <span>{ac.netWorthImpact > 0 ? '+' : ''}{fmtSm(ac.netWorthImpact)} net worth impact</span>
                </div>
              )}
            </div>

            {/* Strategy breakdown */}
            <div className="text-[10px] text-muted-foreground space-y-1">
              <div className="flex justify-between"><span>Premium Finance</span><span className="text-foreground">{fmtSm(ac.pfNetBenefit)} net benefit</span></div>
              <div className="flex justify-between"><span>ILIT</span><span className="text-foreground">{fmtSm(ac.ilitEstateTaxSaved)} estate tax saved</span></div>
              <div className="flex justify-between"><span>Executive Comp</span><span className="text-foreground">{fmtSm(ac.execTaxBenefit)} tax benefit</span></div>
              <div className="flex justify-between"><span>Charitable</span><span className="text-foreground">{fmtSm(ac.charitableTaxDeduction)} deduction</span></div>
              <div className="flex justify-between"><span>Business</span><span className="text-foreground">{fmtSm(ac.businessTotalProtection)} protection</span></div>
            </div>

            <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => onNavigateToPanel?.('advanced-strategies-hub')}>
              Edit Advanced Strategies <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
