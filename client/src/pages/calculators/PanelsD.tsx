/* ═══════════════════════════════════════════════════════════════
   PanelsD — Practice Planning Panels (Business Income Engine)
   10 panels: My Plan, GDC Brackets, Products, Sales Funnel,
              Recruiting, Channels, Dashboard, P&L,
              Goal Tracker, Monthly Production
   ═══════════════════════════════════════════════════════════════ */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  PRODUCTS, GDC_BRACKETS, CHANNELS, HIER_NAMES, HIER_SHORT, HIER_ORDER, HIER_UP, HIER_DOWN,
  ROLE_DEFAULTS, RECRUIT_DEFAULTS, RECRUIT_LABELS, RECRUIT_SOURCES,
  SEASON_PROFILES, SEASON_LABELS,
  getBracket, calcWeightedGDC, calcProductionFunnel, calcTeamOverride,
  calcChannelMetrics, calcPnL, calcRollUp, calcDashboard, calcAllTracksSummary,
  calcTrackFunnel, blendSources, buildMonthlyProduction, calcGoalProgress,
  calcUnifiedIncomePlan, calcChannelEconomics, calcSensitivity, calcTimePhasedProjections, AFF_RATES, CHANNEL_BENCHMARKS,
  AUM_OVERRIDE_DEFAULTS, calcProducerAffiliateIncome, PRODUCER_DEFAULTS, isSectionVisible,
  calcClientPracticeOpportunity, buildCascadeChain, calcPlanningHorizon,
  type AffiliateMode, type ComplexityLevel, type ProducerModeInputs,
  type ClientPracticeInputs, type ClientPracticeOpportunity, type CascadeChainData, type PlanningHorizonPoint,
  backSolveChannelTarget, backSolveChannelProjected, autoBalanceSplits, calcChannelBalances, CHANNEL_KEYS,
  dragRebalanceSplit, createAuditEntry, calcScenarioDiff,
  calcUnifiedPnL, calcRollUpChartData, DEFAULT_ENGINE_CONFIG, mergeEngineConfig,
  type UnifiedPnL, type RollUpChartData, type EngineConfig,
  type RoleId, type TeamMember, type RecruitTrack, type IncomeSplits, type EnabledChannels, type ChannelEconomics, type SensitivityResult, type TimePhasedResult, type BackSolveResult, type ChannelBalance,
  type CascadeAuditEntry, type CascadeInputSnapshot, type CascadeDirection, type ScenarioDiffResult,
} from './practiceEngine';
import { fmt, fmtSm, pct } from './format';
import { KPI, RefTip, ComplexityToggle } from './shared';
import { SectionHeader, PInput } from './shared-ui';
import { exportToExcel, exportToPDF, type ExportPlanData } from './exportPlan';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, LineChart, Line, CartesianGrid, Area, AreaChart,
} from 'recharts';

/* ═══ SHARED PRACTICE PROPS ═══ */
export interface PracticeProps {
  role: RoleId; setRole: (v: RoleId) => void;
  targetGDC: number; setTargetGDC: (v: number) => void;
  wbPct: number; setWbPct: (v: number) => void;
  months: number; setMonths: (v: number) => void;
  bracketOverride: string; setBracketOverride: (v: string) => void;
  productMix: Record<string, number>; setProductMix: (v: Record<string, number>) => void;
  funnelRates: { ap: number; sh: number; cl: number; pl: number };
  setFunnelRates: (v: { ap: number; sh: number; cl: number; pl: number }) => void;
  overrideRate: number; setOverrideRate: (v: number) => void;
  bonusRate: number; setBonusRate: (v: number) => void;
  gen2Rate: number; setGen2Rate: (v: number) => void;
  teamMembers: TeamMember[]; setTeamMembers: (v: TeamMember[]) => void;
  recruitTracks: RecruitTrack[]; setRecruitTracks: (v: RecruitTrack[]) => void;
  channelSpend: Record<string, number>; setChannelSpend: (v: Record<string, number>) => void;
  aumExisting: number; setAumExisting: (v: number) => void;
  aumNew: number; setAumNew: (v: number) => void;
  aumTrailPct: number; setAumTrailPct: (v: number) => void;
  aumOverrideRate: number; setAumOverrideRate: (v: number) => void;
  affiliateMode: 'recruiter' | 'producer'; setAffiliateMode: (v: 'recruiter' | 'producer') => void;
  producerInputs: { dealsPerMonth: number; avgCommissionPerDeal: number; splitPct: number; fixedBonusPerDeal: number; monthlyRetainer: number };
  setProducerInputs: (v: { dealsPerMonth: number; avgCommissionPerDeal: number; splitPct: number; fixedBonusPerDeal: number; monthlyRetainer: number }) => void;
  complexity: 'simple' | 'detailed' | 'expert'; setComplexity: (v: 'simple' | 'detailed' | 'expert') => void;
  alsoMyClient: boolean; setAlsoMyClient: (v: boolean) => void;
  /* Client data for cross-cascade (from client profile) */
  clientIncome: number; clientNetWorth: number; clientSavings: number;
  clientRetirement401k: number; clientAge: number; clientDep: number;
  clientMortgage: number; clientDebt: number; clientExistingInsurance: number;
  clientIsBiz: boolean; clientBizRevenue: number; clientBizEmployees: number;
  clientRiskTolerance: string;
  pnlLevel: 'ind' | 'team'; setPnlLevel: (v: 'ind' | 'team') => void;
  pnlProducers: number; setPnlProducers: (v: number) => void;
  pnlAvgGDC: number; setPnlAvgGDC: (v: number) => void;
  pnlPayoutRate: number; setPnlPayoutRate: (v: number) => void;
  pnlOpEx: number; setPnlOpEx: (v: number) => void;
  pnlTaxRate: number; setPnlTaxRate: (v: number) => void;
  pnlEbitGoal: number; setPnlEbitGoal: (v: number) => void;
  pnlNetGoal: number; setPnlNetGoal: (v: number) => void;
  streams: Record<string, boolean>; setStreams: (v: Record<string, boolean>) => void;
  /* Affiliate income inputs */
  affAIncome: number; setAffAIncome: (v: number) => void;
  affBIncome: number; setAffBIncome: (v: number) => void;
  affCIncome: number; setAffCIncome: (v: number) => void;
  affDIncome: number; setAffDIncome: (v: number) => void;
  /* Unified Income Planning */
  targetIncome: number; setTargetIncome: (v: number) => void;
  incomeSplits: { gdc: number; aum: number; affiliate: number; override: number; channel: number };
  setIncomeSplits: (v: { gdc: number; aum: number; affiliate: number; override: number; channel: number }) => void;
  enabledChannels: EnabledChannels; setEnabledChannels: (v: EnabledChannels) => void;
  affCounts: { a: number; b: number; c: number; d: number };
  setAffCounts: (v: { a: number; b: number; c: number; d: number }) => void;
  affAvgProd: { a: number; b: number; c: number; d: number };
  setAffAvgProd: (v: { a: number; b: number; c: number; d: number }) => void;
  teamAvgGDC: number; setTeamAvgGDC: (v: number) => void;
  /* User-editable CAC & COGS overrides per channel */
  cacOverrides: Partial<Record<string, number>>; setCacOverrides: (v: Partial<Record<string, number>>) => void;
  cogsOverrides: Partial<Record<string, number>>; setCogsOverrides: (v: Partial<Record<string, number>>) => void;
  /* Goal Tracker inputs */
  goalIncome: number; setGoalIncome: (v: number) => void;
  goalAUM: number; setGoalAUM: (v: number) => void;
  goalRecruits: number; setGoalRecruits: (v: number) => void;
  goalGDC: number; setGoalGDC: (v: number) => void;
  goalCases: number; setGoalCases: (v: number) => void;
  /* Seasonality inputs */
  seasonProfile: string; setSeasonProfile: (v: string) => void;
  customSeason: number[]; setCustomSeason: (v: number[]) => void;
  seasonGrowthRate: number; setSeasonGrowthRate: (v: number) => void;
  seasonHorizon: number; setSeasonHorizon: (v: number) => void;
  seasonRampMonths: number; setSeasonRampMonths: (v: number) => void;
}

/* ═══ SMALL HELPERS ═══ */
/* PInput → imported from shared-ui */

/* SectionHeader → imported from shared-ui */

function DataTable({ headers, rows, className = '' }: {
  headers: string[]; rows: (string | number | React.ReactNode)[][]; className?: string;
}) {
  return (
    <div className={`overflow-x-auto -mx-2 px-2 ${className}`}>
      <table role="table" className="w-full text-xs border-collapse min-w-[400px]">
        <thead>
          <tr className="bg-muted/40 text-foreground/90">
            {headers.map((h, i) => (
              <th key={i} className={`px-2 py-1.5 font-semibold whitespace-nowrap ${i > 0 ? 'text-right' : 'text-left'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-border/30 hover:bg-card/50">
              {row.map((cell, ci) => (
                <td key={ci} className={`px-2 py-1 ${ci > 0 ? 'text-right' : ''}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PANEL 1: MY PLAN — Unified Income Planning Hub
   Target Income → Channel Splits → Forward/Back Cascade
   ═══════════════════════════════════════════════════════════════ */

const SPLIT_LABELS: Record<string, string> = {
  gdc: 'GDC Production', aum: 'AUM/Advisory', affiliate: 'Affiliates',
  override: 'Team Override', channel: 'Marketing Channels',
};
const SPLIT_COLORS: Record<string, string> = {
  gdc: '#f59e0b', aum: '#3b82f6', affiliate: '#10b981',
  override: '#8b5cf6', channel: '#ec4899',
};

function SplitSlider({ label, value, onChange, onDrag, color, targetAmount }: {
  label: string; value: number; onChange: (v: number) => void; onDrag?: (v: number) => void; color: string; targetAmount: number;
}) {
  const [dragging, setDragging] = useState(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onDrag) return;
    const bar = e.currentTarget;
    bar.setPointerCapture(e.pointerId);
    setDragging(true);
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, Math.round((e.clientX - rect.left) / rect.width * 100)));
    onDrag(pct);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !onDrag) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, Math.round((e.clientX - rect.left) / rect.width * 100)));
    onDrag(pct);
  };

  const handlePointerUp = () => {
    setDragging(false);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium" style={{ color }}>{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{value}%</span>
          <span className="font-semibold text-foreground">{fmtSm(targetAmount)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div
          className={`flex-1 h-3 bg-muted/30 rounded-full overflow-hidden relative ${onDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          title={onDrag ? 'Drag to rebalance — other channels adjust proportionally' : undefined}
        >
          <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: color }} />
          {onDrag && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-5 rounded-sm border-2 bg-background shadow-md"
              style={{ left: `calc(${value}% - 6px)`, borderColor: color }}
            />
          )}
        </div>
        <Input type="number" value={value} onChange={e => onChange(Math.max(0, Math.min(100, +e.target.value || 0)))}
          className="h-6 w-14 text-[10px] text-right" />
      </div>
    </div>
  );
}

export function MyPlanPanel(p: PracticeProps) {
  const { user } = useAuth();
  const rd = ROLE_DEFAULTS[p.role] || ROLE_DEFAULTS.new;

  /* ─── Practice Preset Save/Load ─── */
  const presetsQuery = trpc.hubAllocations.list.useQuery({ hubType: 'practice' });
  const saveMutation = trpc.hubAllocations.save.useMutation({
    onSuccess: () => { toast.success('Practice preset saved'); setShowPresetSave(false); setPresetLabel(''); presetsQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const [showPresetSave, setShowPresetSave] = useState(false);
  const [presetLabel, setPresetLabel] = useState('');
  const applyPracticePreset = useCallback((presetId: string) => {
    const preset = presetsQuery.data?.find(pr => pr.id.toString() === presetId);
    if (!preset) return;
    const alloc = preset.allocations as Record<string, number>;
    // Apply income splits
    const newSplits = { ...p.incomeSplits };
    if (alloc.gdc !== undefined) newSplits.gdc = alloc.gdc;
    if (alloc.aum !== undefined) newSplits.aum = alloc.aum;
    if (alloc.affiliate !== undefined) newSplits.affiliate = alloc.affiliate;
    if (alloc.override !== undefined) newSplits.override = alloc.override;
    if (alloc.channel !== undefined) newSplits.channel = alloc.channel;
    p.setIncomeSplits(newSplits);
    // Apply input overrides
    if (preset.inputOverrides) {
      const ov = preset.inputOverrides as Record<string, unknown>;
      if (ov.targetIncome && typeof ov.targetIncome === 'number') p.setTargetIncome(ov.targetIncome);
      if (ov.role && typeof ov.role === 'string') p.setRole(ov.role as RoleId);
    }
    toast.success(`Applied preset: ${preset.label}`);
  }, [presetsQuery.data, p.incomeSplits]);
  const handleSavePreset = useCallback(() => {
    if (!presetLabel.trim()) { toast.error('Enter a name'); return; }
    saveMutation.mutate({
      hubType: 'practice',
      label: presetLabel.trim(),
      allocations: p.incomeSplits as unknown as Record<string, number>,
      inputOverrides: { targetIncome: p.targetIncome, role: p.role } as unknown as Record<string, number>,
    });
  }, [presetLabel, p.incomeSplits, p.targetIncome, p.role]);
  const avgGDC = calcWeightedGDC(p.productMix, PRODUCTS);
  const funnel = calcProductionFunnel(p.targetGDC, p.wbPct, p.bracketOverride, avgGDC,
    p.funnelRates.ap, p.funnelRates.sh, p.funnelRates.cl, p.funnelRates.pl, p.months);
  const teamOvr = calcTeamOverride(p.teamMembers, p.overrideRate / 100, p.bonusRate / 100, p.gen2Rate / 100);
  const recSummary = calcAllTracksSummary(p.recruitTracks, p.overrideRate / 100);
  const chMetrics = calcChannelMetrics(p.channelSpend);

  // Unified income plan (with enabledChannels)
  const plan = useMemo(() => calcUnifiedIncomePlan({
    targetIncome: p.targetIncome, splits: p.incomeSplits, role: p.role,
    enabledChannels: p.enabledChannels,
    targetGDC: p.targetGDC, wbPct: p.wbPct, bracketOverride: p.bracketOverride,
    avgGDC, funnelRates: p.funnelRates, months: p.months,
    aumExisting: p.aumExisting, aumNew: p.aumNew, aumTrailPct: p.aumTrailPct,
    aumOverrideRate: p.aumOverrideRate,
    affiliateMode: p.affiliateMode,
    affCounts: p.affCounts, affAvgProd: p.affAvgProd,
    producerInputs: p.producerInputs,
    teamSize: p.teamMembers.length, teamAvgGDC: p.teamAvgGDC, overrideRate: p.overrideRate,
    channelSpend: p.channelSpend,
  }), [p.targetIncome, p.incomeSplits, p.role, p.enabledChannels,
    p.targetGDC, p.wbPct, p.bracketOverride,
    avgGDC, p.funnelRates, p.months, p.aumExisting, p.aumNew, p.aumTrailPct, p.aumOverrideRate,
    p.affiliateMode, p.affCounts, p.affAvgProd, p.producerInputs,
    p.teamMembers.length, p.teamAvgGDC, p.overrideRate, p.channelSpend]);

  // Economics (lifted to component level for export access)
  const economics = useMemo(() => calcChannelEconomics({
    enabledChannels: p.enabledChannels,
    projections: {
      gdc: plan.channels.gdc.projected,
      aum: plan.channels.aum.detail.projectedIncome,
      affiliate: plan.channels.affiliate.totalProjected,
      override: plan.channels.override.detail.projectedIncome,
      channel: plan.channels.channel.detail.projectedAnnualRevenue,
    },
    cacOverrides: p.cacOverrides,
    cogsOverrides: p.cogsOverrides,
  }), [plan, p.enabledChannels, p.cacOverrides, p.cogsOverrides]);

  // Sensitivity (lifted to component level for export access)
  const sensitivity = useMemo(() => calcSensitivity({
    targetIncome: p.targetIncome, splits: p.incomeSplits, role: p.role,
    enabledChannels: p.enabledChannels,
    targetGDC: p.targetGDC, wbPct: p.wbPct, bracketOverride: p.bracketOverride,
    avgGDC, funnelRates: p.funnelRates, months: p.months,
    aumExisting: p.aumExisting, aumNew: p.aumNew, aumTrailPct: p.aumTrailPct,
    aumOverrideRate: p.aumOverrideRate,
    affiliateMode: p.affiliateMode,
    affCounts: p.affCounts, affAvgProd: p.affAvgProd,
    producerInputs: p.producerInputs,
    teamSize: p.teamMembers.length, teamAvgGDC: p.teamAvgGDC, overrideRate: p.overrideRate,
    channelSpend: p.channelSpend,
  }), [p.targetIncome, p.incomeSplits, p.role, p.enabledChannels,
    p.targetGDC, p.wbPct, p.bracketOverride, avgGDC, p.funnelRates, p.months,
    p.aumExisting, p.aumNew, p.aumTrailPct, p.aumOverrideRate,
    p.affiliateMode, p.affCounts, p.affAvgProd, p.producerInputs,
    p.teamMembers.length, p.teamAvgGDC, p.overrideRate, p.channelSpend]);

  // Time-phased projections (lifted to component level for export access)
  const timePhased = useMemo(() => calcTimePhasedProjections({
    targetIncome: p.targetIncome,
    plan,
    role: p.role,
    enabledChannels: p.enabledChannels,
  }), [p.targetIncome, plan, p.role, p.enabledChannels]);

  // (Keyboard shortcuts moved after audit trail declarations — see below)

  // Client-Practice cross-cascade opportunity ("Also My Client")
  const clientOpportunity = useMemo(() => {
    if (!p.alsoMyClient) return null;
    return calcClientPracticeOpportunity({
      clientIncome: p.clientIncome, clientNetWorth: p.clientNetWorth, clientSavings: p.clientSavings,
      clientRetirement401k: p.clientRetirement401k, clientAge: p.clientAge, clientDep: p.clientDep,
      clientMortgage: p.clientMortgage, clientDebt: p.clientDebt, clientExistingInsurance: p.clientExistingInsurance,
      clientIsBiz: p.clientIsBiz, clientBizRevenue: p.clientBizRevenue, clientBizEmployees: p.clientBizEmployees,
      clientRiskTolerance: p.clientRiskTolerance,
    });
  }, [p.alsoMyClient, p.clientIncome, p.clientNetWorth, p.clientSavings, p.clientRetirement401k,
    p.clientAge, p.clientDep, p.clientMortgage, p.clientDebt, p.clientExistingInsurance,
    p.clientIsBiz, p.clientBizRevenue, p.clientBizEmployees, p.clientRiskTolerance]);

  // Cascade chain visualization data
  const cascadeChain = useMemo(() => buildCascadeChain(plan, p.enabledChannels, p.incomeSplits, p.targetIncome),
    [plan, p.enabledChannels, p.incomeSplits, p.targetIncome]);

  // Planning horizon (multi-year projection)
  const planningHorizon = useMemo(() => calcPlanningHorizon(plan, p.targetIncome, p.enabledChannels, 36, p.role),
    [plan, p.targetIncome, p.enabledChannels, p.role]);

  /** Forward cascade helper: when target income changes, push proportional targets to ALL channels */
  const forwardCascade = (newTarget: number) => {
    p.setTargetIncome(newTarget);
    const s = p.incomeSplits;
    const ec = p.enabledChannels;

    // 1. GDC: target GDC from split
    if (ec.gdc && s.gdc > 0) {
      p.setTargetGDC(Math.round(newTarget * s.gdc / 100));
    }

    // 2. AUM: back-solve for required existing AUM book to hit AUM target
    if (ec.aum && s.aum > 0 && p.aumTrailPct > 0) {
      const aumTarget = Math.round(newTarget * s.aum / 100);
      // Required book = target / trail% (existing book generates trail% income)
      const requiredBook = Math.round(aumTarget / (p.aumTrailPct / 100));
      p.setAumExisting(requiredBook);
    }

    // 3. Affiliates: scale counts proportionally to hit affiliate target
    if (ec.affiliate && s.affiliate > 0) {
      const affTarget = Math.round(newTarget * s.affiliate / 100);
      // Current projected from existing counts
      const currentProjected = (['a','b','c','d'] as const).reduce((sum, t) => {
        return sum + Math.round(p.affCounts[t] * p.affAvgProd[t] * (AFF_RATES[t] || 0.1));
      }, 0);
      if (currentProjected > 0) {
        // Scale all counts proportionally
        const scaleFactor = affTarget / currentProjected;
        p.setAffCounts({
          a: Math.max(0, Math.round(p.affCounts.a * scaleFactor)),
          b: Math.max(0, Math.round(p.affCounts.b * scaleFactor)),
          c: Math.max(0, Math.round(p.affCounts.c * scaleFactor)),
          d: Math.max(0, Math.round(p.affCounts.d * scaleFactor)),
        });
      }
    }

    // 4. Override: adjust team avg GDC to hit override target (preserve team size)
    if (ec.override && s.override > 0) {
      const ovrTarget = Math.round(newTarget * s.override / 100);
      const teamSz = Math.max(1, p.teamMembers.length || 1);
      const ovrRate = p.overrideRate > 0 ? p.overrideRate / 100 : 0.08;
      // requiredAvgGDC = ovrTarget / (teamSize × overrideRate)
      const requiredAvgGDC = Math.round(ovrTarget / (teamSz * ovrRate));
      p.setTeamAvgGDC(requiredAvgGDC);
    }

    // 5. Marketing: scale channel spend proportionally to hit marketing target
    if (ec.channel && s.channel > 0) {
      const chTarget = Math.round(newTarget * s.channel / 100);
      const currentMetrics = calcChannelMetrics(p.channelSpend);
      if (currentMetrics.annualRev > 0) {
        const scaleFactor = chTarget / currentMetrics.annualRev;
        const newSpend: Record<string, number> = {};
        for (const [k, v] of Object.entries(p.channelSpend)) {
          newSpend[k] = Math.round(v * scaleFactor);
        }
        p.setChannelSpend(newSpend);
      }
    }
  };

  /** Cascade a single channel's parameters when its split changes */
  const cascadeChannel = (ch: keyof EnabledChannels, newSplitPct: number) => {
    const channelTarget = Math.round(p.targetIncome * newSplitPct / 100);
    switch (ch) {
      case 'gdc':
        p.setTargetGDC(channelTarget);
        break;
      case 'aum':
        if (p.aumTrailPct > 0) {
          p.setAumExisting(Math.round(channelTarget / (p.aumTrailPct / 100)));
        }
        break;
      case 'affiliate': {
        const currentProjected = (['a','b','c','d'] as const).reduce((sum, t) => {
          return sum + Math.round(p.affCounts[t] * p.affAvgProd[t] * (AFF_RATES[t] || 0.1));
        }, 0);
        if (currentProjected > 0) {
          const sf = channelTarget / currentProjected;
          p.setAffCounts({
            a: Math.max(0, Math.round(p.affCounts.a * sf)),
            b: Math.max(0, Math.round(p.affCounts.b * sf)),
            c: Math.max(0, Math.round(p.affCounts.c * sf)),
            d: Math.max(0, Math.round(p.affCounts.d * sf)),
          });
        }
        break;
      }
      case 'override': {
        const teamSz = Math.max(1, p.teamMembers.length || 1);
        const ovrRate = p.overrideRate > 0 ? p.overrideRate / 100 : 0.08;
        p.setTeamAvgGDC(Math.round(channelTarget / (teamSz * ovrRate)));
        break;
      }
      case 'channel': {
        const currentMetrics = calcChannelMetrics(p.channelSpend);
        if (currentMetrics.annualRev > 0) {
          const sf = channelTarget / currentMetrics.annualRev;
          const newSpend: Record<string, number> = {};
          for (const [k, v] of Object.entries(p.channelSpend)) {
            newSpend[k] = Math.round(v * sf);
          }
          p.setChannelSpend(newSpend);
        }
        break;
      }
    }
  };

  /** Roll-up: adopt projected total as new target income and cascade */
  const syncTargetToProjected = () => {
    forwardCascade(plan.totalProjected);
  };

  /** Cross-cascade: user edits a channel's target directly in the roll-up table */
  const handleChannelTargetEdit = useCallback((ch: keyof EnabledChannels, newTarget: number) => {
    const newSplits = backSolveChannelTarget(ch, newTarget, p.targetIncome, p.incomeSplits, p.enabledChannels);
    p.setIncomeSplits(newSplits);
    cascadeChannel(ch, newSplits[ch]);
  }, [p.targetIncome, p.incomeSplits, p.enabledChannels]);

  /** Cross-cascade: user edits a channel's projected directly in the roll-up table */
  const handleChannelProjectedEdit = useCallback((ch: keyof EnabledChannels, newProjected: number) => {
    const result = backSolveChannelProjected(ch, newProjected, p.targetIncome, p.incomeSplits, p.enabledChannels, {
      aumTrailPct: p.aumTrailPct,
      affCounts: p.affCounts,
      affAvgProd: p.affAvgProd,
      teamSize: Math.max(1, p.teamMembers.length || 1),
      overrideRate: p.overrideRate,
      channelAnnualRev: Math.round(chMetrics.tRevMo * 12),
      channelSpend: p.channelSpend,
    });
    p.setIncomeSplits(result.newSplits);
    // Apply channel-specific back-solved values
    if (result.gdcTarget !== undefined) p.setTargetGDC(result.gdcTarget);
    if (result.aumExisting !== undefined) p.setAumExisting(result.aumExisting);
    if (result.affCountScale !== undefined && result.affCountScale !== 1) {
      const sf = result.affCountScale;
      p.setAffCounts({
        a: Math.max(0, Math.round(p.affCounts.a * sf)),
        b: Math.max(0, Math.round(p.affCounts.b * sf)),
        c: Math.max(0, Math.round(p.affCounts.c * sf)),
        d: Math.max(0, Math.round(p.affCounts.d * sf)),
      });
    }
    if (result.teamAvgGDC !== undefined) p.setTeamAvgGDC(result.teamAvgGDC);
    if (result.channelSpendScale !== undefined && result.channelSpendScale !== 1) {
      const sf = result.channelSpendScale;
      const newSpend: Record<string, number> = {};
      for (const [k, v] of Object.entries(p.channelSpend)) {
        newSpend[k] = Math.round(v * sf);
      }
      p.setChannelSpend(newSpend);
    }
  }, [p.targetIncome, p.incomeSplits, p.enabledChannels, p.aumTrailPct, p.affCounts, p.affAvgProd, p.teamMembers.length, p.overrideRate, chMetrics.tRevMo, p.channelSpend]);

  /** Auto-balance: redistribute splits to match actual projected proportions */
  const handleAutoBalance = useCallback(() => {
    const newSplits = autoBalanceSplits(plan, p.enabledChannels, p.incomeSplits, p.targetIncome);
    p.setIncomeSplits(newSplits);
  }, [plan, p.enabledChannels, p.incomeSplits, p.targetIncome]);

  /** Per-channel sync: match target to projected (roll-up per channel) */
  const syncChannelTargetToProjected = useCallback((ch: keyof EnabledChannels) => {
    const projected: Record<keyof EnabledChannels, number> = {
      gdc: plan.channels.gdc.projected,
      aum: plan.channels.aum.detail.projectedIncome,
      affiliate: plan.channels.affiliate.totalProjected,
      override: plan.channels.override.detail.projectedIncome,
      channel: plan.channels.channel.detail.projectedAnnualRevenue,
    };
    handleChannelTargetEdit(ch, projected[ch]);
  }, [plan, handleChannelTargetEdit]);

  /** Per-channel sync: match projected to target (roll-down per channel) */
  const syncChannelProjectedToTarget = useCallback((ch: keyof EnabledChannels) => {
    const targets: Record<keyof EnabledChannels, number> = {
      gdc: plan.channels.gdc.target,
      aum: plan.channels.aum.target,
      affiliate: plan.channels.affiliate.target,
      override: plan.channels.override.target,
      channel: plan.channels.channel.target,
    };
    handleChannelProjectedEdit(ch, targets[ch]);
  }, [plan, handleChannelProjectedEdit]);

  // Channel balances for cross-cascade visibility
  const channelBalances = useMemo(() => calcChannelBalances(plan, p.enabledChannels), [plan, p.enabledChannels]);

  // ─── PASS 96: Cascade Audit Trail ───
  const [auditTrail, setAuditTrail] = useState<CascadeAuditEntry[]>([]);
  const MAX_AUDIT = 50;

  const captureSnapshot = useCallback((): CascadeInputSnapshot => ({
    targetIncome: p.targetIncome,
    incomeSplits: { ...p.incomeSplits },
    enabledChannels: { ...p.enabledChannels },
    targetGDC: p.targetGDC,
    aumExisting: p.aumExisting,
    aumNew: p.aumNew,
    affCounts: { ...p.affCounts },
    teamAvgGDC: p.teamAvgGDC,
    channelSpend: { ...p.channelSpend },
  }), [p.targetIncome, p.incomeSplits, p.enabledChannels, p.targetGDC, p.aumExisting, p.aumNew, p.affCounts, p.teamAvgGDC, p.channelSpend]);

  const addAuditEntry = useCallback((entry: CascadeAuditEntry) => {
    setAuditTrail(prev => [entry, ...prev].slice(0, MAX_AUDIT));
  }, []);

  const undoAuditEntry = useCallback((entry: CascadeAuditEntry) => {
    const snap = entry.prevInputs;
    p.setTargetIncome(snap.targetIncome);
    p.setIncomeSplits(snap.incomeSplits);
    p.setEnabledChannels(snap.enabledChannels);
    p.setTargetGDC(snap.targetGDC);
    p.setAumExisting(snap.aumExisting);
    p.setAumNew(snap.aumNew);
    p.setAffCounts(snap.affCounts);
    p.setTeamAvgGDC(snap.teamAvgGDC);
    p.setChannelSpend(snap.channelSpend);
    // Remove this entry and all entries after it
    setAuditTrail(prev => prev.filter(e => e.id < entry.id));
  }, []);

  // Keyboard shortcuts (moved here — auditTrail, undoAuditEntry, handleAutoBalance now declared)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        if (auditTrail.length > 0) {
          e.preventDefault();
          undoAuditEntry(auditTrail[auditTrail.length - 1]);
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        handleAutoBalance();
      }
      if (e.altKey && e.key === '1') { e.preventDefault(); p.setComplexity('simple'); }
      if (e.altKey && e.key === '2') { e.preventDefault(); p.setComplexity('detailed'); }
      if (e.altKey && e.key === '3') { e.preventDefault(); p.setComplexity('expert'); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [auditTrail, p.enabledChannels, p.incomeSplits, plan, undoAuditEntry, handleAutoBalance]);

  // ─── PASS 96: Drag-to-Rebalance handler ───
  const handleSplitDrag = useCallback((ch: keyof EnabledChannels, newPct: number) => {
    const snapshot = captureSnapshot();
    const oldPct = p.incomeSplits[ch];
    const newSplits = dragRebalanceSplit(ch, newPct, p.incomeSplits, p.enabledChannels);
    p.setIncomeSplits(newSplits);
    cascadeChannel(ch, newSplits[ch]);
    addAuditEntry(createAuditEntry(
      'split-drag',
      `Dragged ${SPLIT_LABELS[ch]} split from ${oldPct}% to ${newSplits[ch]}%`,
      ch,
      [{ field: 'split', from: oldPct, to: newSplits[ch], channel: ch }],
      snapshot.incomeSplits,
      snapshot,
    ));
  }, [p.incomeSplits, p.enabledChannels, captureSnapshot, addAuditEntry]);

  /** Toggle a channel on/off with smart split redistribution */
  const toggleChannel = (ch: keyof typeof p.enabledChannels) => {
    const wasEnabled = p.enabledChannels[ch];
    const nextEnabled = { ...p.enabledChannels, [ch]: !wasEnabled };
    const keys: (keyof typeof p.enabledChannels)[] = ['gdc', 'aum', 'affiliate', 'override', 'channel'];
    const nextSplits = { ...p.incomeSplits };

    if (wasEnabled) {
      /* ── DISABLING a channel: redistribute its % proportionally among remaining enabled ── */
      const freedPct = nextSplits[ch];
      nextSplits[ch] = 0;
      const remainingKeys = keys.filter(k => k !== ch && nextEnabled[k]);
      const remainingSum = remainingKeys.reduce((s, k) => s + nextSplits[k], 0);
      if (remainingKeys.length > 0 && remainingSum > 0) {
        // Proportional redistribution
        let distributed = 0;
        remainingKeys.forEach((k, i) => {
          if (i === remainingKeys.length - 1) {
            nextSplits[k] += (freedPct - distributed); // remainder to last to ensure sum = 100
          } else {
            const share = Math.round(freedPct * (nextSplits[k] / remainingSum));
            nextSplits[k] += share;
            distributed += share;
          }
        });
      } else if (remainingKeys.length > 0) {
        // All remaining are at 0% — split evenly
        const even = Math.floor(freedPct / remainingKeys.length);
        remainingKeys.forEach((k, i) => {
          nextSplits[k] = i === remainingKeys.length - 1 ? freedPct - even * (remainingKeys.length - 1) : even;
        });
      }
    } else {
      /* ── ENABLING a channel: give it its role-default share, reduce others proportionally ── */
      const roleDefault = (ROLE_DEFAULTS[p.role] || ROLE_DEFAULTS.new).incomeSplits[ch];
      // Use role default or 10% if role default is 0
      const newShare = roleDefault > 0 ? roleDefault : 10;
      const enabledKeys = keys.filter(k => k !== ch && nextEnabled[k]);
      const currentSum = enabledKeys.reduce((s, k) => s + nextSplits[k], 0);
      if (currentSum > 0) {
        // Proportionally reduce existing enabled channels to make room
        const scaleFactor = Math.max(0, (currentSum - newShare)) / currentSum;
        let allocated = 0;
        enabledKeys.forEach((k, i) => {
          if (i === enabledKeys.length - 1) {
            nextSplits[k] = Math.max(0, currentSum - newShare - allocated);
          } else {
            const reduced = Math.round(nextSplits[k] * scaleFactor);
            nextSplits[k] = reduced;
            allocated += reduced;
          }
        });
      }
      nextSplits[ch] = newShare;
    }

    p.setEnabledChannels(nextEnabled);
    p.setIncomeSplits(nextSplits);

    // Forward cascade ALL enabled channels after redistribution
    const ti = p.targetIncome;
    if (nextEnabled.gdc && nextSplits.gdc > 0) {
      p.setTargetGDC(Math.round(ti * nextSplits.gdc / 100));
    }
    if (nextEnabled.aum && nextSplits.aum > 0 && p.aumTrailPct > 0) {
      p.setAumExisting(Math.round((ti * nextSplits.aum / 100) / (p.aumTrailPct / 100)));
    }
    if (nextEnabled.affiliate && nextSplits.affiliate > 0) {
      const affTarget = Math.round(ti * nextSplits.affiliate / 100);
      const curAffProj = (['a','b','c','d'] as const).reduce((s, t) =>
        s + Math.round(p.affCounts[t] * p.affAvgProd[t] * (AFF_RATES[t] || 0.1)), 0);
      if (curAffProj > 0) {
        const sf = affTarget / curAffProj;
        p.setAffCounts({
          a: Math.max(0, Math.round(p.affCounts.a * sf)),
          b: Math.max(0, Math.round(p.affCounts.b * sf)),
          c: Math.max(0, Math.round(p.affCounts.c * sf)),
          d: Math.max(0, Math.round(p.affCounts.d * sf)),
        });
      }
    }
    if (nextEnabled.override && nextSplits.override > 0) {
      const ovrTarget = Math.round(ti * nextSplits.override / 100);
      const teamSz = Math.max(1, p.teamMembers.length || 1);
      const ovrRate = p.overrideRate > 0 ? p.overrideRate / 100 : 0.08;
      p.setTeamAvgGDC(Math.round(ovrTarget / (teamSz * ovrRate)));
    }
    if (nextEnabled.channel && nextSplits.channel > 0) {
      const chTarget = Math.round(ti * nextSplits.channel / 100);
      const currentMetrics = calcChannelMetrics(p.channelSpend);
      if (currentMetrics.annualRev > 0) {
        const sf = chTarget / currentMetrics.annualRev;
        const newSpend: Record<string, number> = {};
        for (const [k, v] of Object.entries(p.channelSpend)) {
          newSpend[k] = Math.round(v * sf);
        }
        p.setChannelSpend(newSpend);
      }
    }
  };

  const overrideInc = p.teamMembers.length > 0 ? teamOvr.total : recSummary.tOvr;
  const aumIncome = Math.round((p.aumExisting * (p.aumTrailPct / 100)) + (p.aumNew * (p.aumTrailPct / 100) * 0.5));
  const rollUp = calcRollUp({
    role: p.role, hasPersonal: rd.p === 1,
    wbTarget: funnel.wbTarget, expTarget: funnel.expTarget,
    overrideIncome: overrideInc, overrideRate: p.overrideRate / 100,
    aumIncome,
    affAIncome: p.affAIncome, affBIncome: p.affBIncome,
    affCIncome: p.affCIncome, affDIncome: p.affDIncome,
    channelRevAnnual: Math.round(chMetrics.tRevMo * 12),
    streams: p.streams,
  });

  const splitTotal = p.incomeSplits.gdc + p.incomeSplits.aum + p.incomeSplits.affiliate + p.incomeSplits.override + p.incomeSplits.channel;

  // Pie chart data for income split (only enabled channels)
  const pieData = Object.entries(p.incomeSplits)
    .filter(([k, v]) => v > 0 && p.enabledChannels[k as keyof typeof p.enabledChannels])
    .map(([k, v]) => ({ name: SPLIT_LABELS[k], value: Math.round(p.targetIncome * v / 100), pct: v, fill: SPLIT_COLORS[k] }));

  return (
    <section aria-label="My Plan" role="region">
    <h2 className="text-lg font-bold text-foreground mb-1">My Plan — Unified Income Hub</h2>
    <p className="text-sm text-muted-foreground mb-4">Set your Target Income, then adjust channel splits. All calculations cascade forward through GDC, AUM, Affiliates, Override, and Marketing channels.</p>

    {/* ─── Practice Preset Selector ─── */}
    <Card className="bg-card/60 border-border mb-4">
      <CardContent className="py-3 px-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Load Preset:</Label>
            <Select onValueChange={applyPracticePreset}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder={presetsQuery.isLoading ? 'Loading…' : `${presetsQuery.data?.length ?? 0} presets available`} />
              </SelectTrigger>
              <SelectContent>
                {presetsQuery.data?.map(pr => (
                  <SelectItem key={pr.id} value={pr.id.toString()}>
                    {pr.isDefault ? '⭐ ' : ''}{pr.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {user && (
            showPresetSave ? (
              <div className="flex items-center gap-2">
                <Input className="h-8 text-xs w-40" placeholder="Preset name…" value={presetLabel} onChange={e => setPresetLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSavePreset()} />
                <Button size="sm" className="h-8 text-xs" onClick={handleSavePreset} disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving…' : 'Save'}</Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowPresetSave(false)}>Cancel</Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowPresetSave(true)}>Save Current as Preset</Button>
            )
          )}
        </div>
      </CardContent>
    </Card>

    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex flex-wrap items-center gap-2">
          <span className="text-primary">Income Plan</span>
          <Badge variant="outline" className="text-[10px]">{HIER_NAMES[p.role]}</Badge>
          <Badge variant="outline" className={`text-[10px] ${plan.onTrack ? 'text-green-400 border-green-400/30' : 'text-amber-400 border-amber-400/30'}`}>
            {plan.onTrack ? '✓ On Track' : `Gap: ${fmtSm(plan.totalGap)}`}
          </Badge>
          <RefTip text="Unified income planning: set a target income, allocate across channels, and the engine calculates what's needed in each channel to hit your goal. Defaults based on role-specific industry benchmarks." refId="commission" />
          <div className="ml-auto flex flex-wrap gap-1 shrink-0">
            <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 whitespace-nowrap" onClick={() => {
              const exportData: ExportPlanData = {
                role: p.role, targetIncome: p.targetIncome, incomeSplits: p.incomeSplits,
                enabledChannels: p.enabledChannels, plan, economics, sensitivity,
              };
              exportToPDF(exportData);
            }}>Print PDF</Button>
            <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={async () => {
              try {
                const channels = (['gdc', 'aum', 'affiliate', 'override', 'channel'] as const).map(ch => ({
                  name: ch === 'gdc' ? 'GDC Production' : ch === 'aum' ? 'AUM Advisory' : ch === 'affiliate' ? 'Affiliate' : ch === 'override' ? 'Override' : 'Marketing',
                  enabled: p.enabledChannels[ch],
                  splitPct: p.incomeSplits[ch],
                  target: plan.channels[ch].target,
                  projected: ch === 'gdc' ? plan.channels.gdc.projected : ch === 'aum' ? plan.channels.aum.detail.projectedIncome : ch === 'affiliate' ? plan.channels.affiliate.totalProjected : ch === 'override' ? plan.channels.override.detail.projectedIncome : plan.channels.channel.detail.projectedAnnualRevenue,
                  // @ts-expect-error — property access on loosely typed object
                  gap: plan.channels[ch].gap,
                }));
                const body = {
                  planName: `${HIER_NAMES[p.role]} Income Plan`,
                  role: HIER_NAMES[p.role],
                  generatedAt: new Date().toLocaleDateString(),
                  targetIncome: p.targetIncome,
                  totalProjected: plan.totalProjected,
                  totalGap: plan.totalGap,
                  channels,
                  // @ts-expect-error — property access on loosely typed object
                  funnel: { approaches: funnel.approaches, factFinds: funnel.factFinds, proposals: funnel.proposals, closes: funnel.closes, avgCaseSize: funnel.avgCaseSize },
                };
                const res = await fetch('/api/practice-plan/pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                if (!res.ok) throw new Error('PDF generation failed');
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `practice-plan-${Date.now()}.pdf`; a.click();
                URL.revokeObjectURL(url);
              } catch { alert('PDF generation failed. Please try again.'); }
            }}>Download PDF</Button>
            <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => {
              const exportData: ExportPlanData = {
                role: p.role, targetIncome: p.targetIncome, incomeSplits: p.incomeSplits,
                enabledChannels: p.enabledChannels, plan, economics, sensitivity,
              };
              exportToExcel(exportData);
            }}>Excel</Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* ─── SECTION 1: Role + Target Income ─── */}
        <SectionHeader>1. Role &amp; Target Income</SectionHeader>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="col-span-2">
            <Label className="text-[10px] text-muted-foreground">Role / Segment</Label>
            <Select value={p.role} onValueChange={(v) => {
              const nr = v as RoleId;
              p.setRole(nr);
              const nd = ROLE_DEFAULTS[v] || ROLE_DEFAULTS.new;
              if (nd.mo) p.setMonths(nd.mo);
              if (nd.mix) p.setProductMix(nd.mix);
              p.setFunnelRates({ ap: nd.ap, sh: nd.sh, cl: nd.cl, pl: nd.pl });
              // Update unified income defaults for new role
              p.setTargetIncome(nd.defaultTargetIncome);
              p.setIncomeSplits({ ...nd.incomeSplits });
              p.setAffCounts({ ...nd.defaultAffiliates });
              p.setAffAvgProd({ ...nd.defaultAffProd });
              // Forward cascade ALL channels from new role defaults
              const ti = nd.defaultTargetIncome;
              const ns = nd.incomeSplits;
              p.setTargetGDC(Math.round(ti * ns.gdc / 100));
              p.setAumExisting(nd.defaultAUM);
              // Override: back-solve team avg GDC from override target
              const teamSz = Math.max(1, p.teamMembers.length || 1);
              const ovrRate = p.overrideRate > 0 ? p.overrideRate / 100 : 0.08;
              if (ns.override > 0) {
                p.setTeamAvgGDC(Math.round((ti * ns.override / 100) / (teamSz * ovrRate)));
              }
              // Re-enable all channels for new role
              p.setEnabledChannels({ gdc: true, aum: true, affiliate: true, override: true, channel: true });
            }}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {HIER_ORDER.map(r => (
                  <SelectItem key={r} value={r}>{HIER_NAMES[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label className="text-[10px] text-muted-foreground font-bold text-primary">Target Annual Income ($)</Label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-primary font-bold">$</span>
              <Input type="number" value={p.targetIncome}
                onChange={e => forwardCascade(+e.target.value || 0)}
                className="h-9 text-lg font-bold pl-6 border-primary/30 bg-primary/5" />
            </div>
          </div>
        </div>

        {/* ─── Complexity Level Selector ─── */}
        <ComplexityToggle value={p.complexity} onChange={p.setComplexity} className="w-full justify-center" />
        <p className="text-[9px] text-muted-foreground/60 text-center -mt-1">
          {p.complexity === 'simple' ? 'Core targets and summary KPIs only' : p.complexity === 'detailed' ? 'All channels, splits, and economics' : 'Full cascade, sensitivity, scenarios, and export'}
        </p>
        <details className="text-center">
          <summary className="text-[8px] text-muted-foreground/40 cursor-pointer">Keyboard shortcuts</summary>
          <div className="text-[8px] text-muted-foreground/50 flex flex-wrap gap-2 justify-center mt-0.5">
            <span><kbd className="px-1 py-0.5 bg-muted rounded text-[7px]">Ctrl+Z</kbd> Undo</span>
            <span><kbd className="px-1 py-0.5 bg-muted rounded text-[7px]">Ctrl+B</kbd> Auto-Balance</span>
            <span><kbd className="px-1 py-0.5 bg-muted rounded text-[7px]">Alt+1/2/3</kbd> Complexity</span>
          </div>
        </details>

        {isSectionVisible('target', p.complexity) && <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <PInput label="Active Months" value={p.months} onChange={v => p.setMonths(+v || 10)} />
          <PInput label="WB Platform %" value={p.wbPct} onChange={v => p.setWbPct(+v || 0)} suffix="%" />
          <div className="space-y-0.5">
            <Label className="text-[10px] font-medium text-muted-foreground">Payout Override</Label>
            <Select value={p.bracketOverride} onValueChange={p.setBracketOverride}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (by GDC)</SelectItem>
                {GDC_BRACKETS.map(b => (
                  <SelectItem key={String(b.r)} value={String(Math.round(b.r * 100))}>
                    {Math.round(b.r * 100)}% — {b.l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>}

        {/* Hierarchy Chain */}
        <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
          <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded font-bold">YOU: {HIER_SHORT[p.role]}</span>
          {HIER_UP[p.role].length > 0 && <>
            <span className="text-muted-foreground">→ reports to →</span>
            {HIER_UP[p.role].map((r, i) => (
              <span key={r}>
                <span className="bg-muted px-2 py-0.5 rounded font-semibold">{HIER_SHORT[r]}</span>
                {i < HIER_UP[p.role].length - 1 && <span className="text-muted-foreground mx-0.5">→</span>}
              </span>
            ))}
          </>}
          {HIER_DOWN[p.role].length > 0 && <>
            <span className="text-muted-foreground ml-2">manages →</span>
            {HIER_DOWN[p.role].map(r => (
              <span key={r} className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded font-semibold">{HIER_NAMES[r]}</span>
            ))}
          </>}
        </div>

        {/* Also My Client Toggle */}
        <div className="flex items-center gap-3 bg-gradient-to-r from-primary/5 to-transparent rounded-lg px-3 py-2">
          <button
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              p.alsoMyClient ? 'bg-primary' : 'bg-muted-foreground/30'
            }`}
            onClick={() => p.setAlsoMyClient(!p.alsoMyClient)}
          >
            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
              p.alsoMyClient ? 'translate-x-4' : 'translate-x-0.5'
            }`} />
          </button>
          <div>
            <span className="text-xs font-semibold">Also My Client</span>
            <p className="text-[9px] text-muted-foreground">Cascade client profile data into practice planning to recognize holistic benefits</p>
          </div>
        </div>

        {/* Client-Practice Opportunity Panel */}
        {clientOpportunity && (
          <div className="bg-gradient-to-br from-primary/10 via-background to-primary/5 rounded-lg p-3 border border-primary/20">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-primary flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Client Opportunity Analysis
              </h4>
              <Badge variant="outline" className={`text-[9px] ${
                clientOpportunity.opportunityScore >= 70 ? 'text-green-400 border-green-400/30' :
                clientOpportunity.opportunityScore >= 40 ? 'text-amber-400 border-amber-400/30' :
                'text-red-400 border-red-400/30'
              }`}>
                Score: {clientOpportunity.opportunityScore}/100
              </Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
              <KPI label="AUM Opportunity" value={fmtSm(clientOpportunity.aumOpportunity)} sub="Investable assets" variant="blu" />
              <KPI label="Advisory Fee" value={fmtSm(clientOpportunity.advisoryFeeAnnual)} sub="Annual @ 1%" variant="grn" />
              <KPI label="Insurance GDC" value={fmtSm(clientOpportunity.insuranceGDC)} sub="First-year" variant="gld" />
              <KPI label="Client LTV" value={fmtSm(clientOpportunity.clientLTV)} sub="10-year horizon" variant="grn" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
              <KPI label="Insurance Gap" value={fmtSm(clientOpportunity.insuranceGap)} sub="DIME method" variant="red" />
              <KPI label="Recurring Annual" value={fmtSm(clientOpportunity.recurringAnnual)} sub="AUM + renewals" variant="grn" />
              {clientOpportunity.bizInsuranceGDC > 0 && (
                <KPI label="Biz Insurance" value={fmtSm(clientOpportunity.bizInsuranceGDC)} sub="Key person + group" variant="gld" />
              )}
            </div>
            {clientOpportunity.recommendedChannels.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[9px] text-muted-foreground">Recommended:</span>
                {clientOpportunity.recommendedChannels.map(ch => (
                  <Badge key={ch} variant="outline" className="text-[9px]" style={{ color: SPLIT_COLORS[ch as keyof typeof SPLIT_COLORS] || '#888', borderColor: (SPLIT_COLORS[ch as keyof typeof SPLIT_COLORS] || '#888') + '40' }}>
                    {SPLIT_LABELS[ch as keyof typeof SPLIT_LABELS] || ch}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        <Separator />

        {/* ─── SECTION 2: Income Splits with Enable/Disable ─── */}
        {isSectionVisible('splits-sliders', p.complexity) && <>
        <SectionHeader>2. Income Channels {splitTotal !== 100 && <span className="text-red-400 ml-2">⚠ Splits sum to {splitTotal}% (should be 100%)</span>}</SectionHeader>
        <p className="text-[10px] text-muted-foreground -mt-1 mb-2">Toggle channels on/off to include them in your plan. Adjust the % split to set how much of your target income each channel should contribute.</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            {(['gdc', 'aum', 'affiliate', 'override', 'channel'] as const).map(k => (
              <div key={k} className={`rounded-md transition-all ${p.enabledChannels[k] ? '' : 'opacity-40'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Checkbox checked={p.enabledChannels[k]} onCheckedChange={() => toggleChannel(k)} />
                  <span className="text-[11px] font-semibold" style={{ color: p.enabledChannels[k] ? SPLIT_COLORS[k] : undefined }}>{SPLIT_LABELS[k]}</span>
                  {!p.enabledChannels[k] && <Badge variant="outline" className="text-[9px] text-muted-foreground">Disabled</Badge>}
                </div>
                {p.enabledChannels[k] && (
                  <SplitSlider label={SPLIT_LABELS[k]} value={p.incomeSplits[k]} color={SPLIT_COLORS[k]}
                    targetAmount={Math.round(p.targetIncome * p.incomeSplits[k] / 100)}
                    onDrag={v => handleSplitDrag(k, v)}
                    onChange={v => {
                      const next = { ...p.incomeSplits, [k]: v };
                      p.setIncomeSplits(next);
                      cascadeChannel(k, v);
                    }} />
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" className="text-[10px] h-6" onClick={() => {
              const newSplits = { ...rd.incomeSplits };
              p.setIncomeSplits(newSplits);
              p.setEnabledChannels({ gdc: true, aum: true, affiliate: true, override: true, channel: true });
              // Forward cascade ALL channels from defaults
              const ti = p.targetIncome;
              p.setTargetGDC(Math.round(ti * newSplits.gdc / 100));
              if (p.aumTrailPct > 0) p.setAumExisting(Math.round((ti * newSplits.aum / 100) / (p.aumTrailPct / 100)));
              p.setAffCounts({ ...rd.defaultAffiliates });
              p.setAffAvgProd({ ...rd.defaultAffProd });
              const teamSz = Math.max(1, p.teamMembers.length || 1);
              const ovrRate = p.overrideRate > 0 ? p.overrideRate / 100 : 0.08;
              p.setTeamAvgGDC(Math.round((ti * newSplits.override / 100) / (teamSz * ovrRate)));
            }}>Reset to {HIER_NAMES[p.role]} Defaults</Button>
          </div>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70}
                  label={({ name, pct: pc }) => `${name} ${pc}%`} labelLine={false}>
                  {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmtSm(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        </>}

        <Separator />

        {/* ─── SECTION 3: Channel Details (only show enabled channels) ─── */}
        {isSectionVisible('channel-details', p.complexity) && <>
        {p.enabledChannels.gdc && <>
        <SectionHeader>3a. GDC Production — Target: {fmtSm(plan.channels.gdc.target)}</SectionHeader>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <PInput label="Target GDC ($)" value={p.targetGDC} onChange={v => p.setTargetGDC(+v || 0)} prefix="$" />
          <KPI label="Projected" value={fmtSm(plan.channels.gdc.projected)} variant={plan.channels.gdc.gap === 0 ? 'grn' : 'gld'} />
          <KPI label="Gap" value={plan.channels.gdc.gap > 0 ? fmtSm(plan.channels.gdc.gap) : '✓ Met'} variant={plan.channels.gdc.gap > 0 ? 'red' : 'grn'} />
          <KPI label="Bracket" value={pct(funnel.bracketRate)} variant="gld" />
        </div>
        {rd.p === 1 && (
          <DataTable
            headers={['Step', 'Daily', 'Monthly', 'Annual']}
            rows={[
              ['Approaches', funnel.dailyApproaches, funnel.monthlyApproaches, funnel.approaches],
              ['Held', '—', Math.round(funnel.held / Math.max(1, p.months)), funnel.held],
              [<b key="apps">Apps</b>, '—', funnel.monthlyApps, funnel.apps],
              ['Placed', '—', Math.round(funnel.placed / Math.max(1, p.months)), funnel.placed],
              [<b key="gdc">GDC</b>, '—', <span key="mg" className="text-green-400 font-semibold">{fmt(funnel.monthlyGDC)}</span>, <span key="ag" className="text-green-400 font-semibold">{fmt(funnel.gdcNeeded)}</span>],
            ]}
          />
        )}

        </>}

        {p.enabledChannels.aum && <>
        <SectionHeader>3b. AUM/Advisory — Target: {fmtSm(plan.channels.aum.target)}</SectionHeader>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <PInput label="Existing AUM ($)" value={p.aumExisting} onChange={v => p.setAumExisting(+v || 0)} prefix="$" />
          <PInput label="New AUM/Year ($)" value={p.aumNew} onChange={v => p.setAumNew(+v || 0)} prefix="$" />
          <PInput label="Trail %" value={p.aumTrailPct} onChange={v => p.setAumTrailPct(+v || 0)} suffix="%" />
          <PInput label="Override/Payout %" value={p.aumOverrideRate} onChange={v => p.setAumOverrideRate(Math.max(0, Math.min(100, +v || 0)))} suffix="%" />
        </div>
        <p className="text-[9px] text-muted-foreground/60 -mt-1">Override Rate: % of advisory fee you keep (ESI ~90%, Independent RIA ~100%). Default: {AUM_OVERRIDE_DEFAULTS[p.role]}% for {HIER_NAMES[p.role]}.</p>
        <div className="flex flex-wrap gap-2">
          <KPI label="Projected Income" value={fmtSm(plan.channels.aum.detail.projectedIncome)} variant={plan.channels.aum.detail.gap === 0 ? 'grn' : 'gld'} />
          <KPI label="Required AUM Book" value={fmtSm(plan.channels.aum.detail.requiredBookForTarget)} variant="blu" />
          <KPI label="Gap" value={plan.channels.aum.detail.gap > 0 ? fmtSm(plan.channels.aum.detail.gap) : '✓ Met'} variant={plan.channels.aum.detail.gap > 0 ? 'red' : 'grn'} />
        </div>

        </>}

        {p.enabledChannels.affiliate && <>
        <SectionHeader>3c. Affiliate Income — Target: {fmtSm(plan.channels.affiliate.target)}</SectionHeader>

        {/* Mode Toggle: Recruiter vs Producer */}
        <div className="flex items-center gap-1 bg-muted/20 rounded-md p-0.5 mb-2">
          <button onClick={() => p.setAffiliateMode('recruiter')}
            className={`flex-1 px-2 py-1 rounded text-[10px] font-semibold transition-all ${
              p.affiliateMode === 'recruiter' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-muted-foreground hover:bg-muted/30'
            }`}>
            \ud83d\udc65 Recruiter Mode
          </button>
          <button onClick={() => p.setAffiliateMode('producer')}
            className={`flex-1 px-2 py-1 rounded text-[10px] font-semibold transition-all ${
              p.affiliateMode === 'producer' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-muted-foreground hover:bg-muted/30'
            }`}>
            \ud83d\udcbc Producer Mode
          </button>
        </div>
        <p className="text-[9px] text-muted-foreground/60 -mt-1 mb-2">
          {p.affiliateMode === 'recruiter'
            ? 'You recruit affiliates who bring in revenue. Income = count \u00d7 avg production \u00d7 rate.'
            : 'You ARE the affiliate earning from your own deals. Income = deals \u00d7 commission \u00d7 split + bonuses.'}
        </p>

        {p.affiliateMode === 'recruiter' ? (
          <div className="space-y-2">
            {(['a', 'b', 'c', 'd'] as const).map(t => {
              const d = plan.channels.affiliate.details.find(x => x.type === t);
              if (!d) return null;
              return (
                <div key={t} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                  <div className="col-span-2 sm:col-span-1">
                    <Label className="text-[10px] text-muted-foreground font-semibold">{d.label}</Label>
                  </div>
                  <PInput label="# Affiliates" value={p.affCounts[t]} onChange={v => p.setAffCounts({ ...p.affCounts, [t]: +v || 0 })} />
                  <PInput label="Avg Production" value={p.affAvgProd[t]} onChange={v => p.setAffAvgProd({ ...p.affAvgProd, [t]: +v || 0 })} prefix="$" />
                  <div className="text-[10px] text-muted-foreground">Rate: {pct(d.incomeRate)}</div>
                  <KPI label="Projected" value={fmtSm(d.projectedIncome)} variant={d.projectedIncome > 0 ? 'grn' : ''} />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <PInput label="Deals/Month" value={p.producerInputs.dealsPerMonth}
                onChange={v => p.setProducerInputs({ ...p.producerInputs, dealsPerMonth: +v || 0 })} />
              <PInput label="Avg Commission/Deal" value={p.producerInputs.avgCommissionPerDeal}
                onChange={v => p.setProducerInputs({ ...p.producerInputs, avgCommissionPerDeal: +v || 0 })} prefix="$" />
              <PInput label="Your Split %" value={p.producerInputs.splitPct}
                onChange={v => p.setProducerInputs({ ...p.producerInputs, splitPct: Math.max(0, Math.min(100, +v || 0)) })} suffix="%" />
              <PInput label="Bonus/Deal" value={p.producerInputs.fixedBonusPerDeal}
                onChange={v => p.setProducerInputs({ ...p.producerInputs, fixedBonusPerDeal: +v || 0 })} prefix="$" />
              <PInput label="Monthly Retainer" value={p.producerInputs.monthlyRetainer}
                onChange={v => p.setProducerInputs({ ...p.producerInputs, monthlyRetainer: +v || 0 })} prefix="$" />
            </div>
            {(() => {
              const pr = calcProducerAffiliateIncome(p.producerInputs);
              return (
                <div className="flex flex-wrap gap-2">
                  <KPI label="Commission Income" value={fmtSm(pr.commissionIncome)} variant="grn" />
                  <KPI label="Bonus Income" value={fmtSm(pr.bonusIncome)} variant="gld" />
                  {pr.retainerIncome > 0 && <KPI label="Retainer Income" value={fmtSm(pr.retainerIncome)} variant="blu" />}
                  <KPI label="Monthly Total" value={fmtSm(pr.monthlyIncome)} variant="" />
                </div>
              );
            })()}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-2">
          <KPI label="Total Affiliate" value={fmtSm(plan.channels.affiliate.totalProjected)} variant={plan.channels.affiliate.gap === 0 ? 'grn' : 'gld'} />
          <KPI label="Gap" value={plan.channels.affiliate.gap > 0 ? fmtSm(plan.channels.affiliate.gap) : '✓ Met'} variant={plan.channels.affiliate.gap > 0 ? 'red' : 'grn'} />
        </div>

        </>}

        {p.enabledChannels.override && <>
        <SectionHeader>3d. Team Override — Target: {fmtSm(plan.channels.override.target)}</SectionHeader>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <PInput label="Override Rate %" value={p.overrideRate} onChange={v => p.setOverrideRate(+v || 0)} suffix="%" />
          <PInput label="Team Avg GDC" value={p.teamAvgGDC} onChange={v => p.setTeamAvgGDC(+v || 0)} prefix="$" />
        </div>
        <div className="flex flex-wrap gap-2">
          <KPI label="Team Size" value={String(p.teamMembers.length)} variant="" />
          <KPI label="Projected" value={fmtSm(plan.channels.override.detail.projectedIncome)} variant={plan.channels.override.detail.gap === 0 ? 'grn' : 'gld'} />
          <KPI label="Team Needed" value={String(plan.channels.override.detail.requiredTeamSizeForTarget)} variant="blu" />
          <KPI label="Gap" value={plan.channels.override.detail.gap > 0 ? fmtSm(plan.channels.override.detail.gap) : '✓ Met'} variant={plan.channels.override.detail.gap > 0 ? 'red' : 'grn'} />
        </div>

        {/* Team Members quick add */}
        <div className="space-y-2">
          {p.teamMembers.map((m, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <Input value={m.n} onChange={e => {
                const next = [...p.teamMembers]; next[i] = { ...next[i], n: e.target.value }; p.setTeamMembers(next);
              }} className="h-6 w-28 text-xs" placeholder="Name" />
              <Select value={m.role} onValueChange={v => {
                const next = [...p.teamMembers]; next[i] = { ...next[i], role: v as RoleId }; p.setTeamMembers(next);
              }}>
                <SelectTrigger className="h-6 w-24 text-[11px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{HIER_ORDER.map(r => <SelectItem key={r} value={r}>{HIER_SHORT[r]}</SelectItem>)}</SelectContent>
                  </Select>
                  <PInput label="" value={m.f} onChange={v => {
                    const next = [...p.teamMembers]; next[i] = { ...next[i], f: +v || 0 }; p.setTeamMembers(next);
                  }} prefix="$" className="w-24" />
                  <Button variant="ghost" size="sm" className="h-6 text-red-400 text-[10px] px-1"
                    onClick={() => p.setTeamMembers(p.teamMembers.filter((_, j) => j !== i))}>✕</Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="text-[11px] h-7"
                onClick={() => p.setTeamMembers([...p.teamMembers, { n: `Agent ${p.teamMembers.length + 1}`, f: 65000, role: 'new' }])}>
                + Add Team Member
              </Button>
              {p.teamMembers.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  <KPI label="Team FYC" value={fmtSm(teamOvr.totalFYC)} variant="" />
                  <KPI label="Gen1 Ovr" value={fmtSm(teamOvr.gen1)} variant="grn" />
                  <KPI label="Gen2 Ovr" value={fmtSm(teamOvr.gen2)} variant="gld" />
                  <KPI label="Total Ovr" value={fmtSm(teamOvr.total)} variant="grn" />
                </div>
              )}
            </div>

        </>}

        {p.enabledChannels.channel && <>
        <SectionHeader>3e. Marketing Channels — Target: {fmtSm(plan.channels.channel.target)}</SectionHeader>
        <div className="flex flex-wrap gap-2">
          <KPI label="Current Spend/mo" value={fmtSm(plan.channels.channel.detail.totalMonthlySpend)} variant="" />
          <KPI label="Projected Revenue" value={fmtSm(plan.channels.channel.detail.projectedAnnualRevenue)} variant={plan.channels.channel.detail.gap === 0 ? 'grn' : 'gld'} />
          <KPI label="Required Spend/mo" value={fmtSm(plan.channels.channel.detail.requiredSpendForTarget)} variant="blu" />
          <KPI label="Gap" value={plan.channels.channel.detail.gap > 0 ? fmtSm(plan.channels.channel.detail.gap) : '\u2713 Met'} variant={plan.channels.channel.detail.gap > 0 ? 'red' : 'grn'} />
        </div>
        <p className="text-[10px] text-muted-foreground">Configure individual channel budgets in the Channels panel for detailed ROI analysis.</p>
        </>}
        </>}

        <Separator />

        {/* ─── SECTION 4: Unified Income Roll-Up — Cross-Cascade ─── */}
        {isSectionVisible('roll-up-table', p.complexity) && <>
        <SectionHeader>4. Unified Income Roll-Up
          <RefTip text="Click any Target or Projected value to edit directly. Changes cascade: editing a Target adjusts splits and sub-inputs (roll-down). Editing a Projected back-solves the inputs needed (roll-up). Use per-channel sync buttons for quick alignment." refId="cross-cascade" />
        </SectionHeader>
        <p className="text-[10px] text-muted-foreground -mt-1 mb-2">Click any <b>Target</b> or <b>Projected</b> cell to edit. Changes cross-cascade: targets adjust splits ↓, projected values back-solve inputs ↑. Per-channel sync buttons align target ↔ projected.</p>
        <CrossCascadeTable
          plan={plan}
          p={p}
          channelBalances={channelBalances}
          onTargetEdit={handleChannelTargetEdit}
          onProjectedEdit={handleChannelProjectedEdit}
          onSyncTargetToProjected={syncChannelTargetToProjected}
          onSyncProjectedToTarget={syncChannelProjectedToTarget}
        />

        {/* KPI Summary */}
        <div className="flex flex-wrap gap-2">
          <KPI label="Target" value={fmtSm(p.targetIncome)} variant="gld" />
          <KPI label="Projected" value={fmtSm(plan.totalProjected)} variant="grn" />
          <KPI label="Monthly" value={fmtSm(Math.round(plan.totalProjected / 12))} variant="blu" />
          <KPI label="Gap" value={plan.totalGap > 0 ? fmtSm(plan.totalGap) : '\u2713 Met'} variant={plan.totalGap > 0 ? 'red' : 'grn'} />
          <KPI label="Bracket" value={pct(funnel.bracketRate)} variant="gld" />
          <KPI label="Daily Appr" value={String(funnel.dailyApproaches)} variant="" />
        </div>

        {/* Cross-Cascade Control Panel */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mt-2">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[11px] font-bold text-primary">Cross-Cascade Controls</div>
            <div className="flex gap-1 flex-wrap">
              {plan.totalProjected !== p.targetIncome && plan.totalProjected > 0 && (
                <Button size="sm" variant="outline" className="h-5 text-[9px] px-2 border-primary/30 text-primary hover:bg-primary/10" onClick={syncTargetToProjected}>
                  ↑ Sync Target ← Projected ({fmtSm(plan.totalProjected)})
                </Button>
              )}
              {plan.totalGap > 0 && (
                <Button size="sm" variant="outline" className="h-5 text-[9px] px-2 border-amber-400/30 text-amber-400 hover:bg-amber-400/10" onClick={() => forwardCascade(p.targetIncome)}>
                  ↓ Re-cascade All Channels
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-5 text-[9px] px-2 border-blue-400/30 text-blue-400 hover:bg-blue-400/10" onClick={handleAutoBalance}>
                ⇄ Auto-Balance Splits
              </Button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mb-2">
            <b>↑ Roll-Up:</b> Adopt projected as new target. <b>↓ Roll-Down:</b> Push target to all channels. <b>⇄ Auto-Balance:</b> Realign splits to match actual projected proportions.
          </p>
          <div className="flex flex-wrap gap-2">
            <KPI label="Target" value={fmtSm(p.targetIncome)} variant="gld" />
            <KPI label="Projected" value={fmtSm(plan.totalProjected)} variant={plan.onTrack ? 'grn' : 'red'} />
            <KPI label="Surplus/Gap" value={plan.totalProjected >= p.targetIncome ? '+' + fmtSm(plan.totalProjected - p.targetIncome) : '-' + fmtSm(plan.totalGap)} variant={plan.onTrack ? 'grn' : 'red'} />
            <KPI label="Monthly Projected" value={fmtSm(Math.round(plan.totalProjected / 12))} variant="blu" />
            <KPI label="Implied Annual" value={fmtSm(plan.totalProjected)} variant="blu" />
          </div>
          {/* Per-channel balance indicators */}
          {channelBalances.length > 0 && (
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-1">
              {channelBalances.map(cb => (
                <div key={cb.channel} className={`text-center p-1.5 rounded border ${cb.surplus >= 0 ? 'border-green-400/20 bg-green-400/5' : 'border-red-400/20 bg-red-400/5'}`}>
                  <div className="text-[9px] font-semibold" style={{ color: SPLIT_COLORS[cb.channel] }}>{SPLIT_LABELS[cb.channel]}</div>
                  <div className={`text-[10px] font-bold ${cb.surplus >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {cb.surplus >= 0 ? '+' : ''}{fmtSm(cb.surplus)}
                  </div>
                  <div className="text-[8px] text-muted-foreground">{cb.surplusPct >= 0 ? '+' : ''}{cb.surplusPct}% of target</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── SECTION 4b: Cascade Audit Trail ─── */}
        {auditTrail.length > 0 && (
          <details className="mt-2">
            <summary className="text-[10px] font-semibold text-primary cursor-pointer">Cascade Audit Trail ({auditTrail.length} actions)</summary>
            <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
              {auditTrail.map(entry => {
                const dirIcon = entry.direction === 'roll-down' ? '↓' : entry.direction === 'roll-up' ? '↑' : entry.direction === 'auto-balance' ? '⇄' : entry.direction === 'split-drag' ? '↔' : entry.direction === 'sync' ? '⟳' : '⚡';
                const dirColor = entry.direction === 'roll-down' ? 'text-amber-400' : entry.direction === 'roll-up' ? 'text-green-400' : entry.direction === 'auto-balance' ? 'text-blue-400' : entry.direction === 'split-drag' ? 'text-purple-400' : 'text-primary';
                return (
                  <div key={entry.id} className="flex items-start gap-2 bg-muted/20 rounded p-1.5 text-[10px]">
                    <span className={`font-bold ${dirColor} shrink-0`}>{dirIcon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{entry.trigger}</div>
                      <div className="text-muted-foreground">
                        {entry.changes.slice(0, 3).map((c, i) => (
                          <span key={i}>{c.field}: {typeof c.from === 'number' ? fmtSm(c.from) : c.from} → {typeof c.to === 'number' ? fmtSm(c.to) : c.to}{i < Math.min(2, entry.changes.length - 1) ? ' | ' : ''}</span>
                        ))}
                        {entry.changes.length > 3 && <span> +{entry.changes.length - 3} more</span>}
                      </div>
                      <div className="text-[8px] text-muted-foreground/60">{new Date(entry.timestamp).toLocaleTimeString()}</div>
                    </div>
                    <button
                      className="text-[9px] px-1.5 py-0.5 rounded border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-colors shrink-0"
                      onClick={() => undoAuditEntry(entry)}
                      title="Undo this action and all subsequent actions"
                    >Undo</button>
                  </div>
                );
              })}
            </div>
            {auditTrail.length > 0 && (
              <div className="flex gap-1 mt-1">
                <Button variant="ghost" size="sm" className="text-[9px] h-5 text-muted-foreground" onClick={() => setAuditTrail([])}>Clear Trail</Button>
                <Button variant="ghost" size="sm" className="text-[9px] h-5 text-muted-foreground" onClick={() => {
                  const csv = ['Timestamp,Direction,Trigger,Changes'].concat(
                    auditTrail.map(e => {
                      const changes = e.changes.map(c => `${c.field}: ${c.from} -> ${c.to}`).join('; ');
                      return `"${new Date(e.timestamp).toISOString()}","${e.direction}","${e.trigger}","${changes}"`;
                    })
                  ).join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = `cascade-audit-${new Date().toISOString().slice(0,10)}.csv`;
                  a.click(); URL.revokeObjectURL(url);
                }}>Export CSV</Button>
              </div>
            )}
          </details>
        )}

        </>}

        <Separator />

        {/* ─── SECTION 5: Channel Economics — CAC / ROI / LTV ─── */}
        {isSectionVisible('economics', p.complexity) && <>
        <SectionHeader>5. Channel Economics — CAC / ROI / LTV
          <RefTip text="Industry benchmarks from LIMRA, Cerulli, McKinsey Insurance Practice, Kitces Research (2024). CAC = Customer Acquisition Cost, ROI = Return on Investment, LTV = Lifetime Value. Extended Network LTV includes a 1.3× referral multiplier." refId="economics" />
        </SectionHeader>
        <p className="text-[10px] text-muted-foreground -mt-1 mb-2">Profitability analysis per channel. Override CAC and COGS% below to reflect your actual costs — industry benchmarks shown as defaults.</p>

        {/* User-editable CAC & COGS% overrides */}
        <div className="bg-muted/30 rounded-lg p-3 mb-3 space-y-2">
          <div className="text-[10px] font-bold text-muted-foreground mb-1">Your Cost Overrides <span className="font-normal">(leave blank to use industry benchmark)</span></div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {(['gdc', 'aum', 'affiliate', 'override', 'channel'] as const).filter(k => p.enabledChannels[k]).map(k => (
              <div key={k} className="space-y-1">
                <Label className="text-[9px] font-semibold" style={{ color: SPLIT_COLORS[k] }}>{SPLIT_LABELS[k]}</Label>
                <PInput label={`CAC ($${CHANNEL_BENCHMARKS[k].cac})`} value={p.cacOverrides[k] ?? ''}
                  onChange={v => {
                    const next = { ...p.cacOverrides };
                    if (v === '' || v === '0') { delete next[k]; } else { next[k] = +v; }
                    p.setCacOverrides(next);
                  }} prefix="$" />
                <PInput label={`COGS% (${CHANNEL_BENCHMARKS[k].cogsPct}%)`} value={p.cogsOverrides[k] ?? ''}
                  onChange={v => {
                    const next = { ...p.cogsOverrides };
                    if (v === '' || v === '0') { delete next[k]; } else { next[k] = Math.min(100, +v); }
                    p.setCogsOverrides(next);
                  }} suffix="%" />
              </div>
            ))}
          </div>
          {(Object.keys(p.cacOverrides).length > 0 || Object.keys(p.cogsOverrides).length > 0) && (
            <Button variant="ghost" size="sm" className="text-[10px] h-6 text-muted-foreground" onClick={() => { p.setCacOverrides({}); p.setCogsOverrides({}); }}>Reset to Industry Benchmarks</Button>
          )}
        </div>

        {economics.length === 0 ? <p className="text-[10px] text-muted-foreground italic">Enable at least one channel to see economics.</p> : (
            <>
              <DataTable
                headers={['Channel', 'Revenue', 'CAC', 'COGS', 'Margin', 'ROI', 'LTV', 'LTV:CAC', 'Payback']}
                rows={economics.map(e => [
                  <span key={e.channel} style={{ color: SPLIT_COLORS[e.channel] }} className="font-semibold">{e.label}</span>,
                  fmtSm(e.annualRevenue),
                  <span key={`cac-${e.channel}`} className={p.cacOverrides[e.channel] !== undefined ? 'text-primary font-semibold' : ''}>{fmtSm(e.cac)}{p.cacOverrides[e.channel] !== undefined && ' ✎'}</span>,
                  <span key={`cg-${e.channel}`} className={p.cogsOverrides[e.channel] !== undefined ? 'text-primary' : 'text-muted-foreground'}>{fmtSm(e.cogsDollar)} ({e.cogsPct}%){p.cogsOverrides[e.channel] !== undefined && ' ✎'}</span>,
                  <span key={`mg-${e.channel}`} className={e.grossMarginPct >= 50 ? 'text-green-400' : 'text-amber-400'}>{fmtSm(e.grossMarginDollar)} ({e.grossMarginPct}%)</span>,
                  <span key={`roi-${e.channel}`} className={e.roiPct >= 100 ? 'text-green-400 font-semibold' : e.roiPct >= 0 ? 'text-amber-400' : 'text-red-400'}>{e.roiPct}%</span>,
                  fmtSm(e.clientLTV),
                  <span key={`ltv-${e.channel}`} className={e.ltvCacRatio >= 3 ? 'text-green-400 font-semibold' : e.ltvCacRatio >= 1 ? 'text-amber-400' : 'text-red-400'}>{e.ltvCacRatio}×</span>,
                  <span key={`pb-${e.channel}`} className="text-muted-foreground">{e.paybackMonths < 999 ? e.paybackMonths + ' mo' : '—'}</span>,
                ])}
              />
              <details className="mt-2">
                <summary className="text-[10px] font-semibold text-primary cursor-pointer">Extended Economics & Benchmarks</summary>
                <div className="mt-2 space-y-2">
                  <DataTable
                    headers={['Channel', 'Ext Network LTV', 'Best-in-Class CAC', 'Your CAC', 'Efficiency', 'Source']}
                    rows={economics.map(e => [
                      <span key={e.channel} style={{ color: SPLIT_COLORS[e.channel] }} className="font-semibold">{e.label}</span>,
                      fmtSm(e.extendedNetworkLTV),
                      fmtSm(e.bestInClassCAC),
                      fmtSm(e.cac),
                      <Badge key={`eff-${e.channel}`} variant="outline" className={`text-[9px] ${
                        e.cacEfficiency === 'Above Avg' ? 'text-green-400 border-green-400/30' :
                        e.cacEfficiency === 'Average' ? 'text-amber-400 border-amber-400/30' :
                        'text-red-400 border-red-400/30'
                      }`}>{e.cacEfficiency}</Badge>,
                      <span key={`ref-${e.channel}`} className="text-[9px] text-muted-foreground max-w-[200px] truncate" title={e.ref}>{e.ref.split(';')[0]}</span>,
                    ])}
                  />
                  {/* Roll-up totals */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    <KPI label="Total Revenue" value={fmtSm(economics.reduce((s, e) => s + e.annualRevenue, 0))} variant="grn" />
                    <KPI label="Total COGS" value={fmtSm(economics.reduce((s, e) => s + e.cogsDollar, 0))} variant="red" />
                    <KPI label="Total Margin" value={fmtSm(economics.reduce((s, e) => s + e.grossMarginDollar, 0))} variant="grn" />
                    <KPI label="Avg LTV:CAC" value={(() => { const avg = economics.length > 0 ? economics.reduce((s, e) => s + e.ltvCacRatio, 0) / economics.length : 0; return avg.toFixed(1) + '×'; })()} variant={(() => { const avg = economics.length > 0 ? economics.reduce((s, e) => s + e.ltvCacRatio, 0) / economics.length : 0; return avg >= 3 ? 'grn' : avg >= 1 ? 'gld' : 'red'; })()} />
                    <KPI label="Avg Payback" value={(() => { const valid = economics.filter(e => e.paybackMonths < 999); return valid.length > 0 ? Math.round(valid.reduce((s, e) => s + e.paybackMonths, 0) / valid.length) + ' mo' : '—'; })()} variant="blu" />
                  </div>
                </div>
              </details>
            </>
          )}

        </>}

        <Separator />

        {/* ─── SECTION 6: Scenario Comparison ─── */}
        {isSectionVisible('scenarios', p.complexity) && <>
        <SectionHeader>6. Scenario Comparison</SectionHeader>
        <p className="text-[10px] text-muted-foreground -mt-1 mb-2">Save your current plan as a named scenario, then compare multiple configurations side-by-side to evaluate different strategies.</p>
        <ScenarioManager p={p} plan={plan} funnel={funnel} />

        </>}

        <Separator />

        {/* ─── SECTION 7: What-If Sensitivity Analysis ─── */}
        {isSectionVisible('sensitivity', p.complexity) && <>
        <SectionHeader>7. What-If Sensitivity Analysis</SectionHeader>
        <p className="text-[10px] text-muted-foreground -mt-1 mb-2">Stress-test your plan by seeing how changes in key assumptions impact projected income. Variables sorted by impact magnitude.</p>
        <SensitivityPanel sensitivity={sensitivity} plan={plan} targetIncome={p.targetIncome} />

        </>}

        <Separator />

        {/* ─── SECTION 8: Time-Phased Projections ─── */}
        {isSectionVisible('time-phased', p.complexity) && <>
        <SectionHeader>8. Time-Phased Projections</SectionHeader>
        <p className="text-[10px] text-muted-foreground -mt-1 mb-2">Monthly and quarterly income ramp with seasonal adjustments and milestone tracking. Ramp curve based on your role ({HIER_NAMES[p.role]}).</p>
        <TimePhasedPanel timePhased={timePhased} targetIncome={p.targetIncome} enabledChannels={p.enabledChannels} />
        </>}

        <Separator />

        {/* ─── SECTION 9: Cascade Chain Visualization ─── */}
        {isSectionVisible('sensitivity', p.complexity) && <>
        <SectionHeader>9. Cascade Flow</SectionHeader>
        <p className="text-[10px] text-muted-foreground -mt-1 mb-2">Visual flow showing how target income cascades through splits to channel targets and sub-inputs, with roll-up from projected values.</p>
        <CascadeChainViz chain={cascadeChain} />
        </>}

        <Separator />

        {/* ─── SECTION 10: Interactive Planning Horizon ─── */}
        {isSectionVisible('time-phased', p.complexity) && <>
        <SectionHeader>10. Multi-Year Planning Horizon</SectionHeader>
        <p className="text-[10px] text-muted-foreground -mt-1 mb-2">36-month cumulative income vs target with channel breakdown, milestones, and on-track indicators.</p>
        <PlanningHorizonViz points={planningHorizon} targetIncome={p.targetIncome} />
        </>}

        <Separator />

        {/* ─── SECTION 11: Unified P&L Statement ─── */}
        {isSectionVisible('economics', p.complexity) && <>
        <SectionHeader>11. Practice P&L Statement
          <Badge variant="outline" className="ml-2 text-[9px]">Roll-Up</Badge>
        </SectionHeader>
        <p className="text-[10px] text-muted-foreground -mt-1 mb-2">Combined revenue, COGS, margins, and net income across all channels with GDC bracket analysis.</p>
        <UnifiedPnLSection plan={plan} economics={economics} taxRate={p.pnlTaxRate / 100} opExPct={p.pnlOpEx > 0 ? p.pnlOpEx / plan.totalProjected : 0.15} />
        </>}

        <Separator />

        {/* ─── SECTION 12: Roll-Up Visualization ─── */}
        {isSectionVisible('time-phased', p.complexity) && <>
        <SectionHeader>12. Roll-Up Revenue Chart
          <Badge variant="outline" className="ml-2 text-[9px]">Combined</Badge>
        </SectionHeader>
        <p className="text-[10px] text-muted-foreground -mt-1 mb-2">Stacked channel revenue over time with target line overlay. Toggle monthly/quarterly/annual views.</p>
        <RollUpChartSection points={timePhased.monthly} targetIncome={p.targetIncome} />
        </>}

      </CardContent>
    </Card>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CROSS-CASCADE TABLE — Editable roll-up with bidirectional cascade
   ═══════════════════════════════════════════════════════════════ */

interface CrossCascadeTableProps {
  plan: ReturnType<typeof calcUnifiedIncomePlan>;
  p: PracticeProps;
  channelBalances: ChannelBalance[];
  onTargetEdit: (ch: keyof EnabledChannels, newTarget: number) => void;
  onProjectedEdit: (ch: keyof EnabledChannels, newProjected: number) => void;
  onSyncTargetToProjected: (ch: keyof EnabledChannels) => void;
  onSyncProjectedToTarget: (ch: keyof EnabledChannels) => void;
}

function EditableCell({ value, onCommit, enabled, color }: {
  value: number; onCommit: (v: number) => void; enabled: boolean; color?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (!enabled) return <span className="text-muted-foreground">{fmtSm(value)}</span>;
  if (!editing) {
    return (
      <button
        className="text-right font-mono cursor-pointer hover:bg-primary/10 px-1 py-0.5 rounded transition-colors border border-transparent hover:border-primary/20"
        style={{ color: color || undefined }}
        onClick={() => { setDraft(String(value)); setEditing(true); }}
        title="Click to edit — changes cascade automatically"
      >
        {fmtSm(value)}
      </button>
    );
  }
  return (
    <Input
      type="number"
      autoFocus
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { const v = Math.max(0, Math.round(+draft || 0)); onCommit(v); setEditing(false); }}
      onKeyDown={e => {
        if (e.key === 'Enter') { const v = Math.max(0, Math.round(+draft || 0)); onCommit(v); setEditing(false); }
        if (e.key === 'Escape') setEditing(false);
      }}
      className="h-6 w-24 text-[10px] text-right font-mono"
    />
  );
}

function CrossCascadeTable({ plan, p, channelBalances, onTargetEdit, onProjectedEdit, onSyncTargetToProjected, onSyncProjectedToTarget }: CrossCascadeTableProps) {
  const rows: { key: keyof EnabledChannels; label: string; target: number; projected: number; gap: number }[] = [
    { key: 'gdc', label: 'GDC Production', target: plan.channels.gdc.target, projected: plan.channels.gdc.projected, gap: plan.channels.gdc.gap },
    { key: 'aum', label: 'AUM/Advisory', target: plan.channels.aum.target, projected: plan.channels.aum.detail.projectedIncome, gap: plan.channels.aum.detail.gap },
    { key: 'affiliate', label: 'Affiliates', target: plan.channels.affiliate.target, projected: plan.channels.affiliate.totalProjected, gap: plan.channels.affiliate.gap },
    { key: 'override', label: 'Team Override', target: plan.channels.override.target, projected: plan.channels.override.detail.projectedIncome, gap: plan.channels.override.detail.gap },
    { key: 'channel', label: 'Marketing', target: plan.channels.channel.target, projected: plan.channels.channel.detail.projectedAnnualRevenue, gap: plan.channels.channel.detail.gap },
  ];

  return (
    <div className="overflow-x-auto -mx-2 px-2">
      <table role="table" className="w-full text-xs border-collapse min-w-[500px]">
        <thead>
          <tr className="bg-muted/40 text-foreground/90">
            <th className="px-2 py-1.5 font-semibold text-left">Channel</th>
            <th className="px-2 py-1.5 font-semibold text-center">Split</th>
            <th className="px-2 py-1.5 font-semibold text-right">Target ↓</th>
            <th className="px-2 py-1.5 font-semibold text-right">Projected ↑</th>
            <th className="px-2 py-1.5 font-semibold text-right">Gap</th>
            <th className="px-2 py-1.5 font-semibold text-center">Sync</th>
            <th className="px-2 py-1.5 font-semibold text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const enabled = p.enabledChannels[r.key];
            const balance = channelBalances.find(cb => cb.channel === r.key);
            const surplus = balance?.surplus ?? 0;
            return (
              <tr key={r.key} className="border-b border-border/30 hover:bg-card/50">
                <td className="px-2 py-1">
                  {enabled
                    ? <span className="font-semibold" style={{ color: SPLIT_COLORS[r.key] }}>{r.label}</span>
                    : <span className="text-muted-foreground line-through">{r.label}</span>
                  }
                </td>
                <td className="px-2 py-1 text-center">
                  <span className="text-[10px] font-mono text-muted-foreground">{p.incomeSplits[r.key]}%</span>
                </td>
                <td className="px-2 py-1 text-right">
                  <EditableCell value={r.target} onCommit={v => onTargetEdit(r.key, v)} enabled={enabled} />
                </td>
                <td className="px-2 py-1 text-right">
                  <EditableCell value={r.projected} onCommit={v => onProjectedEdit(r.key, v)} enabled={enabled} color={surplus >= 0 ? '#4ade80' : '#f87171'} />
                </td>
                <td className="px-2 py-1 text-right">
                  {!enabled ? <span className="text-muted-foreground">—</span>
                    : r.gap > 0 ? <span className="text-amber-400">{fmtSm(r.gap)}</span>
                    : <span className="text-green-400">—</span>
                  }
                </td>
                <td className="px-2 py-1 text-center">
                  {enabled && r.target !== r.projected && (
                    <div className="flex gap-0.5 justify-center">
                      <button
                        className="text-[8px] px-1 py-0.5 rounded border border-primary/20 text-primary hover:bg-primary/10 transition-colors"
                        onClick={() => onSyncTargetToProjected(r.key)}
                        title={`Set ${r.label} target = projected (${fmtSm(r.projected)})`}
                      >↑ T←P</button>
                      <button
                        className="text-[8px] px-1 py-0.5 rounded border border-amber-400/20 text-amber-400 hover:bg-amber-400/10 transition-colors"
                        onClick={() => onSyncProjectedToTarget(r.key)}
                        title={`Adjust inputs so ${r.label} projected = target (${fmtSm(r.target)})`}
                      >↓ P←T</button>
                    </div>
                  )}
                  {enabled && r.target === r.projected && (
                    <span className="text-[8px] text-green-400">✓ Aligned</span>
                  )}
                </td>
                <td className="px-2 py-1 text-center">
                  <Badge variant="outline" className={`text-[9px] ${
                    !enabled ? 'text-muted-foreground' :
                    r.gap === 0 ? 'text-green-400 border-green-400/30' :
                    'text-amber-400 border-amber-400/30'
                  }`}>
                    {!enabled ? 'Off' : r.gap === 0 ? '✓' : '⚠'}
                  </Badge>
                </td>
              </tr>
            );
          })}
          {/* TOTAL row */}
          <tr className="border-t-2 border-primary/30 bg-muted/20">
            <td className="px-2 py-1.5"><b className="text-primary">TOTAL</b></td>
            <td className="px-2 py-1.5 text-center"><span className="text-[10px] font-mono text-muted-foreground">100%</span></td>
            <td className="px-2 py-1.5 text-right"><b className="text-primary">{fmtSm(p.targetIncome)}</b></td>
            <td className="px-2 py-1.5 text-right"><b className="text-green-400">{fmtSm(plan.totalProjected)}</b></td>
            <td className="px-2 py-1.5 text-right">
              {plan.totalGap > 0 ? <b className="text-red-400">{fmtSm(plan.totalGap)}</b> : <b className="text-green-400">—</b>}
            </td>
            <td className="px-2 py-1.5"></td>
            <td className="px-2 py-1.5 text-center">
              <Badge variant="outline" className={`text-[9px] ${plan.onTrack ? 'text-green-400 border-green-400/30' : 'text-red-400 border-red-400/30'}`}>
                {plan.onTrack ? '✓ On Track' : '⚠ Gap'}
              </Badge>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCENARIO MANAGER — Save / Load / Compare income plan scenarios
   ═══════════════════════════════════════════════════════════════ */
interface SavedScenario {
  name: string;
  savedAt: number;
  targetIncome: number;
  incomeSplits: IncomeSplits;
  enabledChannels: EnabledChannels;
  role: RoleId;
  targetGDC: number;
  aumExisting: number;
  aumNew: number;
  aumTrailPct: number;
  affCounts: { a: number; b: number; c: number; d: number };
  affAvgProd: { a: number; b: number; c: number; d: number };
  teamAvgGDC: number;
  overrideRate: number;
  cacOverrides: Partial<Record<string, number>>;
  cogsOverrides: Partial<Record<string, number>>;
  /* Snapshot of computed results for comparison */
  totalProjected: number;
  totalGap: number;
  channelProjections: { gdc: number; aum: number; affiliate: number; override: number; channel: number };
}

const SCENARIO_KEY = 'wb-scenarios';

function loadScenarios(): SavedScenario[] {
  try {
    const raw = localStorage.getItem(SCENARIO_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveScenarios(scenarios: SavedScenario[]) {
  try { localStorage.setItem(SCENARIO_KEY, JSON.stringify(scenarios)); } catch { /* quota */ }
}

function ScenarioManager({ p, plan, funnel }: { p: PracticeProps; plan: ReturnType<typeof calcUnifiedIncomePlan>; funnel: ReturnType<typeof calcProductionFunnel> }) {
  const [scenarios, setScenarios] = useState<SavedScenario[]>(() => loadScenarios());
  const [newName, setNewName] = useState('');
  const [showCompare, setShowCompare] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Database persistence via tRPC
  const saveMut = trpc.calculatorEngine.saveScenario.useMutation({
    onSuccess: () => setSyncStatus('saved'),
    onError: () => setSyncStatus('error'),
  });

  const buildScenario = (): SavedScenario => ({
    name: newName.trim() || `Scenario ${scenarios.length + 1}`,
    savedAt: Date.now(),
    targetIncome: p.targetIncome,
    incomeSplits: { ...p.incomeSplits },
    enabledChannels: { ...p.enabledChannels },
    role: p.role,
    targetGDC: p.targetGDC,
    aumExisting: p.aumExisting,
    aumNew: p.aumNew,
    aumTrailPct: p.aumTrailPct,
    affCounts: { ...p.affCounts },
    affAvgProd: { ...p.affAvgProd },
    teamAvgGDC: p.teamAvgGDC,
    overrideRate: p.overrideRate,
    cacOverrides: { ...p.cacOverrides },
    cogsOverrides: { ...p.cogsOverrides },
    totalProjected: plan.totalProjected,
    totalGap: plan.totalGap,
    channelProjections: {
      gdc: plan.channels.gdc.projected,
      aum: plan.channels.aum.detail.projectedIncome,
      affiliate: plan.channels.affiliate.totalProjected,
      override: plan.channels.override.detail.projectedIncome,
      channel: plan.channels.channel.detail.projectedAnnualRevenue,
    },
  });

  const handleSave = () => {
    const scenario = buildScenario();
    const next = [...scenarios, scenario];
    setScenarios(next);
    saveScenarios(next);
    setNewName('');
    // Also persist to database
    setSyncStatus('saving');
    saveMut.mutate({
      name: scenario.name,
      calculatorType: 'practice_plan',
      inputsJson: {
        targetIncome: scenario.targetIncome,
        incomeSplits: scenario.incomeSplits,
        enabledChannels: scenario.enabledChannels,
        role: scenario.role,
        targetGDC: scenario.targetGDC,
        aumExisting: scenario.aumExisting,
        aumNew: scenario.aumNew,
        aumTrailPct: scenario.aumTrailPct,
        affCounts: scenario.affCounts,
        affAvgProd: scenario.affAvgProd,
        teamAvgGDC: scenario.teamAvgGDC,
        overrideRate: scenario.overrideRate,
        cacOverrides: scenario.cacOverrides,
        cogsOverrides: scenario.cogsOverrides,
      },
      resultsJson: {
        totalProjected: scenario.totalProjected,
        totalGap: scenario.totalGap,
        channelProjections: scenario.channelProjections,
      },
    });
  };

  const handleLoad = (s: SavedScenario) => {
    p.setTargetIncome(s.targetIncome);
    p.setIncomeSplits(s.incomeSplits);
    p.setEnabledChannels(s.enabledChannels);
    p.setRole(s.role);
    p.setTargetGDC(s.targetGDC);
    p.setAumExisting(s.aumExisting);
    p.setAumNew(s.aumNew);
    p.setAumTrailPct(s.aumTrailPct);
    p.setAffCounts(s.affCounts);
    p.setAffAvgProd(s.affAvgProd);
    p.setTeamAvgGDC(s.teamAvgGDC);
    p.setOverrideRate(s.overrideRate);
    p.setCacOverrides(s.cacOverrides);
    p.setCogsOverrides(s.cogsOverrides);
  };

  const handleDelete = (idx: number) => {
    const next = scenarios.filter((_, i) => i !== idx);
    setScenarios(next);
    saveScenarios(next);
  };

  return (
    <div className="space-y-3">
      {/* Save current plan */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <PInput label="Scenario Name" value={newName} onChange={setNewName} />
        </div>
        <Button size="sm" className="h-8 text-[11px]" onClick={handleSave}>Save Current Plan</Button>
        {syncStatus !== 'idle' && (
          <span className={`text-[9px] ml-1 ${syncStatus === 'saved' ? 'text-green-400' : syncStatus === 'saving' ? 'text-blue-400' : 'text-amber-400'}`}>
            {syncStatus === 'saving' ? '⟳ Syncing...' : syncStatus === 'saved' ? '✓ Saved to cloud' : '⚠ Local only'}
          </span>
        )}
      </div>

      {/* Saved scenarios list */}
      {scenarios.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-muted-foreground">Saved Scenarios ({scenarios.length})</div>
          {scenarios.map((s, i) => (
            <div key={i} className="flex items-center gap-2 bg-muted/30 rounded-lg p-2">
              <div className="flex-1">
                <div className="text-[11px] font-semibold">{s.name}</div>
                <div className="text-[9px] text-muted-foreground">
                  Target: {fmtSm(s.targetIncome)} | Projected: {fmtSm(s.totalProjected)} | {new Date(s.savedAt).toLocaleDateString()}
                </div>
              </div>
              <Button variant="outline" size="sm" className="h-6 text-[9px] px-2" onClick={() => handleLoad(s)}>Load</Button>
              <Button variant="ghost" size="sm" className="h-6 text-[9px] px-1 text-red-400" onClick={() => handleDelete(i)}>✕</Button>
            </div>
          ))}
        </div>
      )}

      {/* Compare toggle */}
      {scenarios.length >= 2 && (
        <Button variant="outline" size="sm" className="text-[11px]" onClick={() => setShowCompare(!showCompare)}>
          {showCompare ? 'Hide' : 'Show'} Side-by-Side Comparison
        </Button>
      )}

      {/* Comparison table */}
      {showCompare && scenarios.length >= 2 && (
        <div className="overflow-x-auto">
          <DataTable
            headers={['Metric', ...scenarios.map(s => s.name)]}
            rows={[
              ['Target Income', ...scenarios.map(s => fmtSm(s.targetIncome))],
              ['Projected Income', ...scenarios.map(s => (
                <span key={s.name} className={s.totalProjected >= s.targetIncome ? 'text-green-400 font-semibold' : 'text-amber-400'}>{fmtSm(s.totalProjected)}</span>
              ))],
              ['Gap', ...scenarios.map(s => (
                <span key={s.name} className={s.totalGap <= 0 ? 'text-green-400' : 'text-red-400'}>{s.totalGap > 0 ? fmtSm(s.totalGap) : '\u2713 Met'}</span>
              ))],
              ['Role', ...scenarios.map(s => HIER_SHORT[s.role] || s.role)],
              ['GDC Target', ...scenarios.map(s => fmtSm(s.targetGDC))],
              ['GDC Projected', ...scenarios.map(s => fmtSm(s.channelProjections.gdc))],
              ['AUM Projected', ...scenarios.map(s => fmtSm(s.channelProjections.aum))],
              ['Affiliate Projected', ...scenarios.map(s => fmtSm(s.channelProjections.affiliate))],
              ['Override Projected', ...scenarios.map(s => fmtSm(s.channelProjections.override))],
              ['Marketing Projected', ...scenarios.map(s => fmtSm(s.channelProjections.channel))],
              ['GDC Split', ...scenarios.map(s => s.enabledChannels.gdc ? s.incomeSplits.gdc + '%' : 'Off')],
              ['AUM Split', ...scenarios.map(s => s.enabledChannels.aum ? s.incomeSplits.aum + '%' : 'Off')],
              ['Affiliate Split', ...scenarios.map(s => s.enabledChannels.affiliate ? s.incomeSplits.affiliate + '%' : 'Off')],
              ['Override Split', ...scenarios.map(s => s.enabledChannels.override ? s.incomeSplits.override + '%' : 'Off')],
              ['Marketing Split', ...scenarios.map(s => s.enabledChannels.channel ? s.incomeSplits.channel + '%' : 'Off')],
              ['AUM Book', ...scenarios.map(s => fmtSm(s.aumExisting))],
              ['Override Rate', ...scenarios.map(s => s.overrideRate + '%')],
            ]}
          />

          {/* Visual comparison bar chart */}
          <div className="mt-3">
            <div className="text-[10px] font-bold text-muted-foreground mb-2">Projected Income Comparison</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={scenarios.map(s => ({
                name: s.name.length > 15 ? s.name.slice(0, 15) + '\u2026' : s.name,
                target: s.targetIncome,
                projected: s.totalProjected,
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#888' }} />
                <YAxis tick={{ fontSize: 10, fill: '#888' }} tickFormatter={v => fmtSm(v)} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="target" fill="#f59e0b" name="Target" />
                <Bar dataKey="projected" fill="#22c55e" name="Projected" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ─── PASS 96: Scenario Diff with Cross-Cascade Highlighting ─── */}
          <ScenarioDiffPanel scenarios={scenarios} />
        </div>
      )}
    </div>
  );
}

function ScenarioDiffPanel({ scenarios }: { scenarios: SavedScenario[] }) {
  const diff = useMemo(() => calcScenarioDiff(scenarios), [scenarios]);
  const [showAll, setShowAll] = useState(false);

  if (diff.fields.length === 0) return null;

  const displayFields = showAll ? diff.fields : diff.fields.filter(f => f.divergent);

  return (
    <div className="mt-4 bg-muted/20 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-bold text-primary">Cross-Cascade Diff Analysis</div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[9px] text-blue-400 border-blue-400/30">
            {diff.similarityScore}% Similar
          </Badge>
          <Badge variant="outline" className={`text-[9px] ${diff.cascadeDrivenCount > 0 ? 'text-purple-400 border-purple-400/30' : 'text-muted-foreground'}`}>
            {diff.cascadeDrivenCount} cascade-driven
          </Badge>
        </div>
      </div>
      <p className="text-[9px] text-muted-foreground mb-2">
        {diff.divergentCount} of {diff.fields.length} fields diverge. Fields highlighted in <span className="text-amber-400">amber</span> are direct input differences; fields in <span className="text-purple-400">purple</span> diverged due to different cascade paths.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr className="bg-muted/40">
              <th className="px-2 py-1 text-left font-semibold">Field</th>
              <th className="px-2 py-1 text-center font-semibold">Type</th>
              {scenarios.map(s => (
                <th key={s.name} className="px-2 py-1 text-right font-semibold">{s.name.length > 12 ? s.name.slice(0, 12) + '\u2026' : s.name}</th>
              ))}
              <th className="px-2 py-1 text-right font-semibold">Divergence</th>
            </tr>
          </thead>
          <tbody>
            {displayFields.map(f => {
              const typeColor = f.divergenceType === 'cascade' ? 'text-purple-400' : f.divergenceType === 'input' ? 'text-amber-400' : 'text-muted-foreground';
              const rowBg = f.divergenceType === 'cascade' ? 'bg-purple-400/5' : f.divergent ? 'bg-amber-400/5' : '';
              return (
                <tr key={f.field} className={`border-b border-border/20 ${rowBg}`}>
                  <td className="px-2 py-1">
                    <span className={f.divergent ? 'font-semibold' : 'text-muted-foreground'}>{f.label}</span>
                    {f.channel && <span className="ml-1 text-[8px]" style={{ color: SPLIT_COLORS[f.channel] }}>●</span>}
                  </td>
                  <td className={`px-2 py-1 text-center ${typeColor}`}>
                    {f.divergenceType === 'cascade' ? '↓↑ Cascade' : f.divergenceType === 'input' ? '✎ Input' : '✓'}
                  </td>
                  {f.values.map((v, i) => (
                    <td key={i} className="px-2 py-1 text-right font-mono">
                      {typeof v === 'number' ? fmtSm(v) : v}
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right">
                    {f.divergent ? (
                      <div className="flex items-center justify-end gap-1">
                        <div className="w-12 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, f.divergenceMagnitude)}%`, backgroundColor: f.divergenceType === 'cascade' ? '#a78bfa' : '#fbbf24' }} />
                        </div>
                        <span className="text-[8px] text-muted-foreground">{f.divergenceMagnitude}%</span>
                      </div>
                    ) : (
                      <span className="text-green-400 text-[8px]">✓</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <Button variant="ghost" size="sm" className="text-[9px] h-5" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show Divergent Only' : `Show All ${diff.fields.length} Fields`}
        </Button>
        <div className="flex gap-2 text-[8px] text-muted-foreground">
          <span>● <span className="text-amber-400">Input</span> = user changed</span>
          <span>● <span className="text-purple-400">Cascade</span> = auto-propagated</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SENSITIVITY PANEL — What-If Tornado + Stress Test
   ═══════════════════════════════════════════════════════════════ */
function SensitivityPanel({ sensitivity, plan, targetIncome }: { sensitivity: SensitivityResult[]; plan: ReturnType<typeof calcUnifiedIncomePlan>; targetIncome: number }) {
  const [showDetails, setShowDetails] = useState(false);

  // Filter to only variables with non-zero impact
  const active = sensitivity.filter(s => s.impactRange > 0);
  const maxRange = active.length > 0 ? active[0].impactRange : 1;

  const baseProjected = plan.totalProjected;

  // Get pessimistic (-25%) and optimistic (+25%) from the top 3 most impactful variables
  const pessimistic = active.slice(0, 3).reduce((sum, s) => {
    const v = s.variations.find(v => v.pctChange === -25);
    return sum + (v ? v.delta : 0);
  }, baseProjected);
  const optimistic = active.slice(0, 3).reduce((sum, s) => {
    const v = s.variations.find(v => v.pctChange === 25);
    return sum + (v ? v.delta : 0);
  }, baseProjected);

  return (
    <div className="space-y-3">
      {/* Stress Test Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 text-center">
          <div className="text-[9px] text-red-400 uppercase tracking-wider">Pessimistic</div>
          <div className="text-sm font-bold text-red-400">{fmtSm(pessimistic)}</div>
          <div className="text-[9px] text-muted-foreground">{pessimistic < baseProjected ? '' : '+'}{fmtSm(pessimistic - baseProjected)}</div>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 text-center">
          <div className="text-[9px] text-blue-400 uppercase tracking-wider">Base Case</div>
          <div className="text-sm font-bold text-blue-400">{fmtSm(baseProjected)}</div>
          <div className="text-[9px] text-muted-foreground">Current plan</div>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2 text-center">
          <div className="text-[9px] text-green-400 uppercase tracking-wider">Optimistic</div>
          <div className="text-sm font-bold text-green-400">{fmtSm(optimistic)}</div>
          <div className="text-[9px] text-muted-foreground">+{fmtSm(optimistic - baseProjected)}</div>
        </div>
      </div>

      {/* Tornado Chart */}
      {active.length > 0 && (
        <div>
          <div className="text-[10px] font-bold text-muted-foreground mb-2">Impact Tornado (sorted by influence)</div>
          <div className="space-y-1.5">
            {active.slice(0, 6).map(s => {
              const downVar = s.variations.find(v => v.pctChange === -25);
              const upVar = s.variations.find(v => v.pctChange === 25);
              const downDelta = downVar ? downVar.delta : 0;
              const upDelta = upVar ? upVar.delta : 0;
              const barWidthDown = maxRange > 0 ? Math.abs(downDelta) / maxRange * 100 : 0;
              const barWidthUp = maxRange > 0 ? Math.abs(upDelta) / maxRange * 100 : 0;

              return (
                <div key={s.variable.key} className="flex items-center gap-2">
                  <div className="w-32 text-[10px] text-right text-muted-foreground truncate" title={s.variable.label}>
                    {s.variable.label}
                  </div>
                  <div className="flex-1 flex items-center h-5">
                    {/* Negative bar (left) */}
                    <div className="flex-1 flex justify-end">
                      <div className="h-4 rounded-l bg-red-500/60 transition-all" style={{ width: `${Math.min(barWidthDown, 100)}%` }} />
                    </div>
                    {/* Center line */}
                    <div className="w-px h-5 bg-muted-foreground/30" />
                    {/* Positive bar (right) */}
                    <div className="flex-1">
                      <div className="h-4 rounded-r bg-green-500/60 transition-all" style={{ width: `${Math.min(barWidthUp, 100)}%` }} />
                    </div>
                  </div>
                  <div className="w-20 text-[9px] text-muted-foreground">
                    {fmtSm(downDelta)} / +{fmtSm(upDelta)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[8px] text-muted-foreground/50 mt-1 px-32">
            <span>\u2190 -25% worse</span>
            <span>+25% better \u2192</span>
          </div>
        </div>
      )}

      {/* Detailed table */}
      <details open={showDetails} onToggle={(e) => setShowDetails((e.target as HTMLDetailsElement).open)}>
        <summary className="text-[10px] text-primary cursor-pointer hover:underline">Detailed sensitivity table</summary>
        <div className="mt-2">
          <DataTable
            headers={['Variable', 'Base', '-50%', '-25%', '-10%', '+10%', '+25%', '+50%', 'Range']}
            rows={active.map(s => [
              s.variable.label,
              s.variable.unit === '$' ? fmtSm(s.variable.baseValue) : s.variable.baseValue + (s.variable.unit === '%' ? '%' : ''),
              ...s.variations.map(v => {
                const color = v.delta > 0 ? 'text-green-400' : v.delta < 0 ? 'text-red-400' : 'text-muted-foreground';
                return <span className={color}>{v.delta >= 0 ? '+' : ''}{fmtSm(v.delta)}</span>;
              }),
              <span className="font-semibold">{fmtSm(s.impactRange)}</span>,
            ])}
          />
        </div>
      </details>

      <div className="text-[9px] text-muted-foreground/60 italic">
        Sensitivity varies each assumption \u00b110/25/50% while holding others constant. Stress test uses \u00b125% on top 3 most impactful variables combined.
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TIME-PHASED PANEL — Monthly/Quarterly Projections + Milestones
   ═══════════════════════════════════════════════════════════════ */
function TimePhasedPanel({ timePhased, targetIncome, enabledChannels }: { timePhased: TimePhasedResult; targetIncome: number; enabledChannels: EnabledChannels }) {
  const [view, setView] = useState<'monthly' | 'quarterly'>('monthly');
  const { monthly, quarterly, milestones, annualTotal, annualTarget } = timePhased;

  // Chart data for cumulative progress
  const chartData = monthly.map(m => ({
    name: m.label,
    projected: m.cumulativeTotal,
    target: m.cumulativeTarget,
    monthly: m.monthlyTotal,
  }));

  // Channel stacked bar data
  const channelBarData = monthly.map(m => ({
    name: m.label,
    ...(enabledChannels.gdc ? { GDC: m.gdc } : {}),
    ...(enabledChannels.aum ? { AUM: m.aum } : {}),
    ...(enabledChannels.affiliate ? { Affiliate: m.affiliate } : {}),
    ...(enabledChannels.override ? { Override: m.override } : {}),
    ...(enabledChannels.channel ? { Marketing: m.channel } : {}),
    target: Math.round(targetIncome / 12),
  }));

  const channelColors: Record<string, string> = {
    GDC: '#3b82f6', AUM: '#10b981', Affiliate: '#f59e0b', Override: '#a855f7', Marketing: '#ec4899',
  };

  return (
    <div className="space-y-3">
      {/* View toggle */}
      <div className="flex gap-1">
        <Button variant={view === 'monthly' ? 'default' : 'outline'} size="sm" className="text-[10px] h-6" onClick={() => setView('monthly')}>Monthly</Button>
        <Button variant={view === 'quarterly' ? 'default' : 'outline'} size="sm" className="text-[10px] h-6" onClick={() => setView('quarterly')}>Quarterly</Button>
      </div>

      {/* Cumulative Progress Chart */}
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#888' }} />
            <YAxis tick={{ fontSize: 9, fill: '#888' }} tickFormatter={(v: number) => v >= 1000 ? `$${Math.round(v/1000)}k` : `$${v}`} />
            <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 11 }} />
            <Area type="monotone" dataKey="target" stroke="#666" fill="rgba(100,100,100,0.1)" strokeDasharray="5 5" name="Target Pace" />
            <Area type="monotone" dataKey="projected" stroke="#3b82f6" fill="rgba(59,130,246,0.15)" name="Cumulative Projected" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Channel Stacked Bar Chart */}
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={channelBarData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#888' }} />
            <YAxis tick={{ fontSize: 9, fill: '#888' }} tickFormatter={(v: number) => v >= 1000 ? `$${Math.round(v/1000)}k` : `$${v}`} />
            <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 11 }} />
            {Object.entries(channelColors).filter(([k]) => channelBarData[0]?.[k as keyof typeof channelBarData[0]] !== undefined).map(([k, c]) => (
              <Bar key={k} dataKey={k} stackId="channels" fill={c} />
            ))}
            <Line type="monotone" dataKey="target" stroke="#ef4444" strokeDasharray="3 3" dot={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {view === 'monthly' ? (
        <DataTable
          headers={['Month', 'GDC', 'AUM', 'Aff', 'Ovr', 'Mkt', 'Total', 'Cumulative', 'Target', 'Pace']}
          rows={monthly.map(m => [
            <span key={m.label} className="font-semibold">{m.label}</span>,
            enabledChannels.gdc ? fmtSm(m.gdc) : <span className="text-muted-foreground/40">—</span>,
            enabledChannels.aum ? fmtSm(m.aum) : <span className="text-muted-foreground/40">—</span>,
            enabledChannels.affiliate ? fmtSm(m.affiliate) : <span className="text-muted-foreground/40">—</span>,
            enabledChannels.override ? fmtSm(m.override) : <span className="text-muted-foreground/40">—</span>,
            enabledChannels.channel ? fmtSm(m.channel) : <span className="text-muted-foreground/40">—</span>,
            <span key={`t-${m.month}`} className="font-semibold">{fmtSm(m.monthlyTotal)}</span>,
            <span key={`c-${m.month}`} className={m.onPace ? 'text-green-400' : 'text-amber-400'}>{fmtSm(m.cumulativeTotal)}</span>,
            fmtSm(m.cumulativeTarget),
            m.onPace
              ? <Badge key={`p-${m.month}`} variant="outline" className="text-[8px] text-green-400 border-green-400/30">✓ On Pace</Badge>
              : <Badge key={`p-${m.month}`} variant="outline" className="text-[8px] text-amber-400 border-amber-400/30">↓ Behind</Badge>,
          ])}
        />
      ) : (
        <DataTable
          headers={['Quarter', 'Projected', 'Target', 'Gap', 'Status']}
          rows={quarterly.map(q => [
            <span key={q.label} className="font-bold">{q.label}</span>,
            <span key={`p-${q.q}`} className="font-semibold">{fmtSm(q.total)}</span>,
            fmtSm(q.target),
            q.gap > 0 ? <span className="text-red-400">{fmtSm(q.gap)}</span> : <span className="text-green-400">On Track</span>,
            q.total >= q.target
              ? <Badge variant="outline" className="text-[8px] text-green-400 border-green-400/30">✓</Badge>
              : <Badge variant="outline" className="text-[8px] text-amber-400 border-amber-400/30">{Math.round(q.total / q.target * 100)}%</Badge>,
          ])}
        />
      )}

      {/* Milestones */}
      <details>
        <summary className="text-[10px] text-primary cursor-pointer hover:underline font-semibold">Milestone Tracker</summary>
        <div className="mt-2 space-y-1">
          {milestones.map((m, i) => (
            <div key={i} className="flex items-center gap-2 text-[10px]">
              <div className={`w-2 h-2 rounded-full ${m.expectedMonth ? 'bg-green-400' : 'bg-red-400'}`} />
              <span className="font-semibold w-32">{m.label}</span>
              <span className="text-muted-foreground">{fmtSm(m.amount)}</span>
              <span className="text-muted-foreground">→</span>
              <span className={m.expectedMonth ? 'text-green-400' : 'text-red-400'}>
                {m.expectedMonth ? `Month ${m.expectedMonth} (${m.monthLabel})` : 'Not reached in 12 months'}
              </span>
            </div>
          ))}
        </div>
      </details>

      {/* Seasonal & Ramp Factors */}
      <details>
        <summary className="text-[10px] text-primary cursor-pointer hover:underline font-semibold">Seasonal & Ramp Factors</summary>
        <div className="mt-2">
          <DataTable
            headers={['Month', 'Seasonal', 'Ramp', 'Combined']}
            rows={monthly.map(m => [
              m.label,
              <span key={`s-${m.month}`} className={m.seasonalFactor >= 1 ? 'text-green-400' : 'text-amber-400'}>{(m.seasonalFactor * 100).toFixed(0)}%</span>,
              <span key={`r-${m.month}`} className={m.rampFactor >= 0.9 ? 'text-green-400' : m.rampFactor >= 0.5 ? 'text-amber-400' : 'text-red-400'}>{(m.rampFactor * 100).toFixed(0)}%</span>,
              <span key={`c-${m.month}`} className="font-semibold">{(m.seasonalFactor * m.rampFactor * 100).toFixed(0)}%</span>,
            ])}
          />
          <p className="text-[9px] text-muted-foreground/60 italic mt-1">Seasonal factors: LIMRA annual sales surveys. Ramp curve: industry-typical for your role level.</p>
        </div>
      </details>

      {/* Annual Summary KPIs */}
      <div className="flex flex-wrap gap-2">
        <KPI label="Annual Projected" value={fmtSm(annualTotal)} variant={annualTotal >= annualTarget ? 'grn' : 'red'} />
        <KPI label="Annual Target" value={fmtSm(annualTarget)} variant="blu" />
        <KPI label="Annual Gap" value={annualTotal >= annualTarget ? 'On Track' : fmtSm(annualTarget - annualTotal)} variant={annualTotal >= annualTarget ? 'grn' : 'red'} />
        <KPI label="Best Quarter" value={(() => { const best = [...quarterly].sort((a,b) => b.total - a.total)[0]; return best ? `${best.label} (${fmtSm(best.total)})` : '—'; })()} variant="gld" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PANEL 2: GDC BRACKETS
   ═══════════════════════════════════════════════════════════════ */
export function GDCBracketsPanel(p: PracticeProps) {
  const [gdcInput, setGdcInput] = useState(() => p.targetGDC || 150000);
  const [teamSize, setTeamSize] = useState(5);
  const [teamAvgGDC, setTeamAvgGDC] = useState(100000);
  const bracket = getBracket(gdcInput);
  const takeHome = Math.round(gdcInput * bracket.r);
  const override = Math.round(teamSize * teamAvgGDC * (p.overrideRate / 100));
  const nextBracket = GDC_BRACKETS.find(b => b.mn > gdcInput);

  return (
    <section aria-label="GDC Brackets" role="region">
    <h2 className="text-lg font-bold text-foreground mb-1">GDC Brackets</h2>
    <p className="text-sm text-muted-foreground mb-4">View commission brackets and weighted GDC based on your product mix and production level.</p>
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-primary flex items-center gap-1">GDC Brackets<RefTip text="Commission brackets based on National Life Group 2026 schedules. FYC rates: IUL 90-110%, WL 55-80%, Term 80-100%." refId="commission" /></CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <PInput label="Your GDC ($)" value={gdcInput} onChange={v => setGdcInput(+v || 0)} prefix="$" />
          <PInput label="Team Size" value={teamSize} onChange={v => setTeamSize(+v || 0)} />
          <PInput label="Team Avg GDC" value={teamAvgGDC} onChange={v => setTeamAvgGDC(+v || 0)} prefix="$" />
        </div>

        <div className="flex flex-wrap gap-2">
          <KPI label="GDC" value={fmtSm(gdcInput)} variant="blu" />
          <KPI label="Rate" value={pct(bracket.r)} variant="gld" />
          <KPI label="Take-Home" value={fmtSm(takeHome)} variant="grn" />
          <KPI label="Override" value={fmtSm(override)} variant="gld" />
          <KPI label="Total" value={fmtSm(takeHome + override)} variant="grn" />
          <KPI label="Next Bracket" value={nextBracket ? fmtSm(nextBracket.mn - gdcInput) + ' away' : 'Max ★'} variant="" />
        </div>

        <DataTable
          headers={['Range', 'Rate', 'Take-Home', 'Status']}
          rows={GDC_BRACKETS.map(b => {
            const active = gdcInput >= b.mn && gdcInput <= b.mx;
            return [
              <span key={b.l} className={active ? 'font-bold text-primary' : ''}>{b.l}</span>,
              pct(b.r),
              <span key={`th-${b.l}`} className={active ? 'text-green-400 font-semibold' : ''}>{fmt(Math.round(gdcInput * b.r))}</span>,
              active ? <span key="act" className="text-primary font-bold">◀ Current</span> :
                gdcInput < b.mn ? fmt(b.mn - gdcInput) + ' to reach' : '',
            ];
          })}
        />

        {/* Override Rate Inputs */}
        <Separator />
        <SectionHeader>Override Settings</SectionHeader>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <PInput label="Override Rate %" value={p.overrideRate} onChange={v => p.setOverrideRate(+v || 0)} suffix="%" />
          <PInput label="Bonus Rate %" value={p.bonusRate} onChange={v => p.setBonusRate(+v || 0)} suffix="%" />
          <PInput label="Gen2 Rate %" value={p.gen2Rate} onChange={v => p.setGen2Rate(+v || 0)} suffix="%" />
        </div>
      </CardContent>
    </Card>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PANEL 3: PRODUCTS & MIX
   ═══════════════════════════════════════════════════════════════ */
export function ProductsPanel(p: PracticeProps) {
  const [showExpanded, setShowExpanded] = useState(true);

  const totalMixPct = Object.values(p.productMix).reduce((a, b) => a + b, 0);
  const avgGDC = calcWeightedGDC(p.productMix, PRODUCTS);

  return (    <section aria-label="Products and Mix" role="region">
    <h2 className="text-lg font-bold text-foreground mb-1">Products &amp; Mix</h2>
    <p className="text-sm text-muted-foreground mb-4">Set your product allocation percentages. Mix impacts weighted GDC, commission rates, and revenue projections.</p>
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex flex-wrap items-center gap-2">
          <span className="text-primary">Products & Mix</span>
          <RefTip text="Product mix based on NLG 2026 commission schedules. FYC rates: IUL 90-110%, WL 55-80%, Term 80-100%. Target premium allocations per LIMRA industry averages." refId="commission" />
          <label className="flex items-center gap-1.5 text-[11px] cursor-pointer ml-auto font-normal">
            <Checkbox checked={showExpanded} onCheckedChange={c => setShowExpanded(!!c)} />
            Show Expanded/Specialty
          </label>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Product Mix Sliders */}
        <SectionHeader>Your Product Mix</SectionHeader>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PRODUCTS.filter(pr => showExpanded || pr.s === 'core').map(pr => (
            <PInput key={pr.id} label={pr.n} value={p.productMix[pr.id] || 0}
              onChange={v => p.setProductMix({ ...p.productMix, [pr.id]: Math.max(0, +v || 0) })} suffix="%" />
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={totalMixPct === 100 ? 'text-green-400' : 'text-red-400'}>
            Mix Total: {totalMixPct}%
          </span>
          {totalMixPct !== 100 && <span className="text-red-400/70 text-[10px]">(should be 100%)</span>}
          <span className="text-muted-foreground">Weighted Avg GDC/Case: <b className="text-foreground">{fmt(avgGDC)}</b></span>
        </div>

        <Separator />

        {/* Product Comparison Table */}
        <SectionHeader>Product Comparison — Commission Rates</SectionHeader>
        <div className="overflow-x-auto -mx-2 px-2">
          <table role="table" className="w-full text-[11px] border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-muted/40 text-foreground/90">
                <th className="px-2 py-1.5 text-left font-semibold">Product</th>
                <th className="px-2 py-1.5 text-right font-semibold">GDC/Case</th>
                <th className="px-2 py-1.5 text-left font-semibold">WB Carrier</th>
                <th className="px-2 py-1.5 text-center font-semibold">WB Rate</th>
                <th className="px-2 py-1.5 text-center font-semibold">Industry</th>
                <th className="px-2 py-1.5 text-left font-semibold">Best-in-Class</th>
                <th className="px-2 py-1.5 text-center font-semibold">Best Rate</th>
                <th className="px-2 py-1.5 text-center font-semibold">Renewals</th>
              </tr>
            </thead>
            <tbody>
              {PRODUCTS.filter(pr => showExpanded || pr.s === 'core').flatMap((pr, idx, arr) => {
                const isWbBest = pr.wbRate >= pr.bestRate;
                const wbColor = isWbBest ? 'text-green-400' : pr.wbRate >= pr.bestRate * 0.85 ? 'text-yellow-400' : 'text-red-400';
                const prevSuite = idx > 0 ? arr[idx - 1].s : null;
                const nodes: React.JSX.Element[] = [];
                if (prevSuite !== pr.s) {
                  nodes.push(
                    <tr key={`sep-${pr.s}`}>
                      <td colSpan={8} className="bg-blue-500/5 font-bold text-[10px] uppercase tracking-wider px-2 py-1 border-t-2 border-blue-500/30">
                        {pr.s === 'core' ? 'Core Product Suite' : 'Expanded / Specialty'}
                      </td>
                    </tr>
                  );
                }
                nodes.push(
                  <tr key={pr.id} className="border-b border-border/20 hover:bg-card/50">
                    <td className="px-2 py-1 font-semibold whitespace-nowrap" title={pr.src}>{pr.n}</td>
                    <td className="px-2 py-1 text-right">{fmt(pr.gdc)}</td>
                    <td className="px-2 py-1 text-muted-foreground text-[10px]">{pr.wb}</td>
                    <td className={`px-2 py-1 text-center font-bold ${wbColor}`}>{pr.wbRate}%{isWbBest ? ' ★' : ''}</td>
                    <td className="px-2 py-1 text-center text-muted-foreground">{pr.ind}%</td>
                    <td className="px-2 py-1 text-muted-foreground text-[10px]">{pr.best}</td>
                    <td className="px-2 py-1 text-center font-semibold">{pr.bestRate}%</td>
                    <td className="px-2 py-1 text-center text-muted-foreground">{pr.renew}</td>
                  </tr>
                );
                return nodes;
              })}
            </tbody>
          </table>
        </div>

        <div className="text-[10px] text-muted-foreground bg-green-500/5 border border-green-500/20 rounded-md p-2">
          <b>★ = WealthBridge rate is best-in-class</b> ·
          <span className="text-green-400"> ● Green</span> = at or above best ·
          <span className="text-yellow-400"> ● Amber</span> = within 15% ·
          <span className="text-red-400"> ● Red</span> = below 85% of best.
          Source: TBA 2025, Sonant AI 2026, SmartAsset 2025.
        </div>
       </CardContent>
    </Card>
    </section>
  );
}
/* ═══════════════════════════════════════════════════════════════
   PANEL 4: SALES FUNNEL
   ═══════════════════════════════════════════════════════════════ */
export function SalesFunnelPanel(p: PracticeProps) {
  const [sfPolicies, setSfPolicies] = useState(50);
  const [sfPl, setSfPl] = useState(80);
  const [sfCl, setSfCl] = useState(30);
  const [sfSh, setSfSh] = useState(75);
  const [sfAp, setSfAp] = useState(15);
  const [sfMo, setSfMo] = useState(10);

  const apps = sfPl > 0 ? Math.round(sfPolicies / (sfPl / 100)) : 0;
  const held = sfCl > 0 ? Math.round(apps / (sfCl / 100)) : 0;
  const set = sfSh > 0 ? Math.round(held / (sfSh / 100)) : 0;
  const approaches = sfAp > 0 ? Math.round(set / (sfAp / 100)) : 0;
  const daily = sfMo > 0 ? Math.round(approaches / sfMo / 21.5) : 0;
  const perHour = Math.max(1, Math.round(daily / 8));

  return (
    <section aria-label="Sales Funnel" role="region">
    <h2 className="text-lg font-bold text-foreground mb-1">Sales Funnel</h2>
    <p className="text-sm text-muted-foreground mb-4">Model your conversion pipeline from approaches through placed business. Industry benchmarks pre-loaded.</p>
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-primary flex items-center gap-1">Sales Funnel<RefTip text="Conversion rates from LIMRA, Legacy Agent, and EverQuote research. Industry averages: approach-to-set 15-40%, held 65-85%, close 25-70%, place 60-85%." refId="funnel" /></CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <PInput label="Policies Goal" value={sfPolicies} onChange={v => setSfPolicies(+v || 0)} />
          <PInput label="App→Placed %" value={sfPl} onChange={v => setSfPl(+v || 0)} suffix="%" />
          <PInput label="Held→App %" value={sfCl} onChange={v => setSfCl(+v || 0)} suffix="%" />
          <PInput label="Set→Held %" value={sfSh} onChange={v => setSfSh(+v || 0)} suffix="%" />
          <PInput label="Appr→Set %" value={sfAp} onChange={v => setSfAp(+v || 0)} suffix="%" />
          <PInput label="Active Months" value={sfMo} onChange={v => setSfMo(+v || 0)} />
        </div>

        <div className="flex flex-wrap gap-2">
          <KPI label="Policies" value={String(sfPolicies)} variant="grn" />
          <KPI label="Apps" value={String(apps)} variant="" />
          <KPI label="Held" value={String(held)} variant="" />
          <KPI label="Approaches" value={approaches.toLocaleString()} variant="" />
          <KPI label="Daily" value={String(daily)} variant="grn" />
          <KPI label="Per Hour" value={String(perHour)} variant="gld" />
        </div>

        {/* Funnel Visualization */}
        <div className="space-y-1">
          {[
            { label: 'Approaches', count: approaches, color: 'bg-blue-500/30' },
            { label: 'Set', count: set, color: 'bg-blue-500/40' },
            { label: 'Held', count: held, color: 'bg-primary/40' },
            { label: 'Apps', count: apps, color: 'bg-primary/60' },
            { label: 'Placed', count: sfPolicies, color: 'bg-green-500/50' },
          ].map((step) => {
            const maxW = approaches || 1;
            const widthPct = Math.max(5, Math.round(step.count / maxW * 100));
            return (
              <div key={step.label} className="flex items-center gap-2">
                <span className="text-[10px] w-16 text-right text-muted-foreground">{step.label}</span>
                <div className={`${step.color} rounded-sm h-5 flex items-center px-2 transition-all`}
                  style={{ width: `${widthPct}%`, minWidth: '40px' }}>
                  <span className="text-[10px] font-bold text-foreground">{step.count.toLocaleString()}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Activity Breakdown */}
        <Separator />
        <SectionHeader>Activity Breakdown</SectionHeader>
        <DataTable
          headers={['Metric', 'Annual', 'Monthly', 'Weekly', 'Daily']}
          rows={[
            ['Approaches', approaches, sfMo > 0 ? Math.round(approaches / sfMo) : 0, sfMo > 0 ? Math.round(approaches / sfMo / 4.3) : 0, daily],
            ['Appointments Set', set, sfMo > 0 ? Math.round(set / sfMo) : 0, sfMo > 0 ? Math.round(set / sfMo / 4.3) : 0, '—'],
            ['Appointments Held', held, sfMo > 0 ? Math.round(held / sfMo) : 0, sfMo > 0 ? Math.round(held / sfMo / 4.3) : 0, '—'],
            ['Applications', apps, sfMo > 0 ? Math.round(apps / sfMo) : 0, sfMo > 0 ? Math.round(apps / sfMo / 4.3) : 0, '—'],
            [<b key="pl">Policies Placed</b>, <span key="pv" className="text-green-400 font-bold">{sfPolicies}</span>, sfMo > 0 ? Math.round(sfPolicies / sfMo) : 0, sfMo > 0 ? Math.round(sfPolicies / sfMo / 4.3) : 0, '—'],
          ]}
        />
      </CardContent>
    </Card>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PANEL 5: RECRUITING
   ═══════════════════════════════════════════════════════════════ */
export function RecruitingPanel(p: PracticeProps) {
  const addTrack = (type: string) => {
    const d = RECRUIT_DEFAULTS[type] || RECRUIT_DEFAULTS.newAssoc;
    p.setRecruitTracks([...p.recruitTracks, {
      type, n: d.f > 100000 ? 2 : 3, i: d.i, vw: d.v, o: d.o, a: d.a, p: d.p,
      f: d.f, bk: d.bk, ramp: d.ramp, rP: d.rP, startMo: 1,
      src: { inbound: 60, digital: 15, outbound: 10, campus: 10, poach: 5 },
    }]);
  };

  const updateTrack = (idx: number, field: string, value: number) => {
    const next = [...p.recruitTracks];
    (next[idx] as any)[field] = value;
    p.setRecruitTracks(next);
  };

  const removeTrack = (idx: number) => {
    p.setRecruitTracks(p.recruitTracks.filter((_, i) => i !== idx));
  };

  const summary = calcAllTracksSummary(p.recruitTracks, p.overrideRate / 100);

  return (    <section aria-label="Recruiting" role="region">
    <h2 className="text-lg font-bold text-foreground mb-1">Recruiting</h2>
    <p className="text-sm text-muted-foreground mb-4">Build your team roster, track override income, and project recruiting pipeline economics.</p>
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-primary flex items-center gap-1">Recruiting<RefTip text="Override rates: 5-15% first-gen, 2-5% second-gen. Recruiting costs and retention from LIMRA Agent Compensation Study 2024." refId="recruiting" /></CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Track Buttons */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(RECRUIT_LABELS).map(([k, label]) => (
            <Button key={k} variant="outline" size="sm" className="text-[11px] h-7"
              onClick={() => addTrack(k)}>+ {label}</Button>
          ))}
        </div>

        {p.recruitTracks.length === 0 && (
          <div className="text-center py-6 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
            No recruiting tracks yet. Click a button above to add one.
          </div>
        )}

        {/* Track Cards */}
        {p.recruitTracks.map((track, idx) => {
          const funnel = calcTrackFunnel(track);
          const srcBlend = blendSources(track.src);
          const colors: Record<string, string> = { newAssoc: 'border-l-blue-500/50', expPro: 'border-l-purple-500', affiliate: 'border-l-cyan-500', md: 'border-l-primary' };

          return (
            <div key={idx} className={`border border-border rounded-lg p-3 space-y-3 border-l-4 ${colors[track.type] || 'border-l-primary'}`}>
              <div className="flex items-center justify-between">
                <b className="text-sm">{RECRUIT_LABELS[track.type] || track.type}</b>
                <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 h-6 text-[11px]"
                  onClick={() => removeTrack(idx)}>Remove</Button>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                <PInput label="Target Producing" value={track.n} onChange={v => updateTrack(idx, 'n', +v || 0)} />
                <PInput label="Contact→Interest %" value={track.i} onChange={v => updateTrack(idx, 'i', +v || 0)} suffix="%" />
                <PInput label="Interest→Interview %" value={track.vw} onChange={v => updateTrack(idx, 'vw', +v || 0)} suffix="%" />
                <PInput label="Interview→Offer %" value={track.o} onChange={v => updateTrack(idx, 'o', +v || 0)} suffix="%" />
                <PInput label="Offer→Accept %" value={track.a} onChange={v => updateTrack(idx, 'a', +v || 0)} suffix="%" />
                <PInput label="Accept→Producing %" value={track.p} onChange={v => updateTrack(idx, 'p', +v || 0)} suffix="%" />
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                <PInput label="Avg FYC ($)" value={track.f} onChange={v => updateTrack(idx, 'f', +v || 0)} prefix="$" />
                <PInput label="Book ($)" value={track.bk} onChange={v => updateTrack(idx, 'bk', +v || 0)} prefix="$" />
                <PInput label="Ramp Months" value={track.ramp} onChange={v => updateTrack(idx, 'ramp', +v || 0)} />
                <PInput label="Ramp Prod %" value={track.rP} onChange={v => updateTrack(idx, 'rP', +v || 0)} suffix="%" />
                <PInput label="Start Month" value={track.startMo} onChange={v => updateTrack(idx, 'startMo', Math.max(1, Math.min(12, +v || 1)))} />
              </div>

              {/* Source retention badges */}
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded">Yr1 Ret: <b>{Math.round(srcBlend.yr1Ret * 100)}%</b></span>
                <span className="bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded">Yr2 Ret: <b>{Math.round(srcBlend.yr2Ret * 100)}%</b></span>
                <span className="bg-green-500/10 text-green-400 px-2 py-0.5 rounded">Close: <b>{Math.round(srcBlend.closeRate * 100)}%</b></span>
                <span className="bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded">CPA: <b>${srcBlend.cpa}</b></span>
              </div>

              {/* Track Funnel Table */}
              <DataTable
                headers={['Stage', 'Count', 'Step Rate', 'Weekly', 'Monthly']}
                rows={[
                  [<b key="c">Contacted</b>, funnel.cont, '—', Math.round(funnel.cont / 52), Math.round(funnel.cont / 12)],
                  ['Interested', funnel.intr, `${track.i}%`, Math.round(funnel.intr / 52), Math.round(funnel.intr / 12)],
                  ['Interviewed', funnel.intv, `${track.vw}%`, Math.round(funnel.intv / 52), Math.round(funnel.intv / 12)],
                  ['Offered', funnel.off, `${track.o}%`, Math.round(funnel.off / 52), Math.round(funnel.off / 12)],
                  ['Accepted', funnel.acc, `${track.a}%`, Math.round(funnel.acc / 52), Math.round(funnel.acc / 12)],
                  [<b key="p" className="text-green-400">Producing</b>, <span key="pv" className="text-green-400 font-bold">{funnel.prod}</span>, `${track.p}%`, '—', '—'],
                ]}
              />
            </div>
          );
        })}

        {/* Summary */}
        {p.recruitTracks.length > 0 && (
          <>
            <SectionHeader>All Tracks Summary</SectionHeader>
            <div className="flex flex-wrap gap-2">
              <KPI label="Hires" value={String(summary.tHires)} variant="grn" />
              <KPI label="Must Contact" value={String(summary.tContact)} variant="blu" />
              <KPI label="Mo Contacts" value={String(Math.round(summary.tContact / 12))} variant="" />
              <KPI label="Yr1 Override" value={fmtSm(summary.tOvr)} variant="grn" />
              <KPI label="Yr2 Override" value={fmtSm(summary.yr2Ovr)} variant="gld" />
              <KPI label="EBITDA" value={fmtSm(summary.recEBITDA)} variant="grn" />
              <KPI label="ARR" value={fmtSm(summary.recARR)} variant="blu" />
              <KPI label="Books" value={fmtSm(summary.tBooks)} variant="" />
            </div>

            {/* Financial Metrics */}
            <DataTable
              headers={['Metric', 'Year 1 (Ramp)', 'Year 2 (Full)', 'Notes']}
              rows={[
                [<b key="gdc">Team GDC</b>, fmt(summary.tFYC), <span key="y2" className="text-green-400">{fmt(summary.yr2FYC)}</span>, 'Total team production'],
                [<b key="ovr">Override ({p.overrideRate}%)</b>, <span key="o1" className="text-green-400">{fmt(summary.tOvr)}</span>, <span key="o2" className="text-green-400">{fmt(summary.yr2Ovr)}</span>, 'Your override income'],
                [<b key="opex">Recruiting OpEx</b>, <span key="op1" className="text-red-400">{fmt(summary.recOpEx)}</span>, <span key="op2" className="text-red-400">{fmt(Math.round(summary.recOpEx * 0.3))}</span>, '~$2K/hire direct costs'],
                [<b key="ebit">EBITDA</b>, <span key="e1" className={summary.recEBITDA >= 0 ? 'text-green-400' : 'text-red-400'}>{fmt(summary.recEBITDA)}</span>, <span key="e2" className="text-green-400">{fmt(summary.yr2Ovr - Math.round(summary.recOpEx * 0.3))}</span>, 'Override − OpEx'],
                [<b key="arr">ARR</b>, fmt(summary.recARR), <span key="a2" className="text-green-400">{fmt(Math.round(summary.yr2FYC * 0.15 + summary.tBooks * 0.01))}</span>, '~15% renewal + 1% trail on books'],
              ]}
            />

            <div className="text-[10px] text-muted-foreground bg-muted/30 rounded-md p-2 border border-border/30">
              <b>Retention context (LIMRA 2022):</b> Industry avg: 80% Yr1 → 40% Yr2 → 23% Yr3 → 15% Yr4.
              Top agencies retain 40–60% through structured onboarding. Source channel significantly impacts retention.
              <b> 65% of terminators leave in years 1–2</b> (focus early activity and joint field work).
            </div>
          </>
        )}
      </CardContent>
    </Card>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PANEL 6: CHANNELS
   ═══════════════════════════════════════════════════════════════ */
export function ChannelsPanel(p: PracticeProps) {
  const metrics = calcChannelMetrics(p.channelSpend);

  return (    <section aria-label="Channels" role="region">
    <h2 className="text-lg font-bold text-foreground mb-1">Marketing Channels</h2>
    <p className="text-sm text-muted-foreground mb-4">Allocate marketing spend across channels. CPL and ROI benchmarks from industry research.</p>
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-primary flex items-center gap-1">Marketing Channels<RefTip text="CPL benchmarks from FirstPageSage 2025: LinkedIn $75-180, Google $85-120, Facebook $50-90, SEO $45-75, Referrals $15-30." refId="marketing" /></CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Channel Input Table */}
        <div className="overflow-x-auto -mx-2 px-2">
          <table role="table" className="w-full text-[11px] border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-muted/40 text-foreground/90">
                <th className="px-2 py-1.5 text-left">Channel</th>
                <th className="px-2 py-1.5 text-right">$/Mo</th>
                <th className="px-2 py-1.5 text-right">CPL</th>
                <th className="px-2 py-1.5 text-right">Conv%</th>
                <th className="px-2 py-1.5 text-right">Yr1 Rev</th>
                <th className="px-2 py-1.5 text-right">LTV</th>
                <th className="px-2 py-1.5 text-right">Leads/Yr</th>
                <th className="px-2 py-1.5 text-right">Clients/Yr</th>
                <th className="px-2 py-1.5 text-right">Rev/Mo</th>
                <th className="px-2 py-1.5 text-right">ROI</th>
              </tr>
            </thead>
            <tbody>
              {CHANNELS.map(c => {
                const sp = p.channelSpend[c.id] || 0;
                const annSp = sp * 12;
                const annL = annSp > 0 ? Math.round(annSp / c.cpl) : 0;
                const annC = Math.round(annL * c.cv);
                const annRv = annC * c.rev;
                const roi = annSp > 0 ? Math.round((annRv - annSp) / annSp * 100) : 0;
                return (
                  <tr key={c.id} className="border-b border-border/20 hover:bg-card/50">
                    <td className="px-2 py-1 font-semibold whitespace-nowrap">{c.n}</td>
                    <td className="px-2 py-1 text-right">
                      <Input type="number" value={sp || ''} placeholder={String(c.def)}
                        onChange={e => p.setChannelSpend({ ...p.channelSpend, [c.id]: +e.target.value || 0 })}
                        className="h-6 w-16 text-[11px] text-right bg-primary/5 border-primary/20" />
                    </td>
                    <td className="px-2 py-1 text-right text-muted-foreground">${c.cpl}</td>
                    <td className="px-2 py-1 text-right text-muted-foreground">{(c.cv * 100).toFixed(0)}%</td>
                    <td className="px-2 py-1 text-right">{fmtSm(c.rev)}</td>
                    <td className="px-2 py-1 text-right text-muted-foreground">{fmtSm(c.ltv)}</td>
                    <td className="px-2 py-1 text-right">{annL}</td>
                    <td className="px-2 py-1 text-right">{annC}</td>
                    <td className="px-2 py-1 text-right text-green-400">{sp > 0 ? fmt(Math.round(annRv / 12)) : '—'}</td>
                    <td className="px-2 py-1 text-right">{sp > 0 ? `${roi}%` : '—'}</td>
                  </tr>
                );
              })}
              <tr className="bg-primary/5 font-semibold border-t border-primary/20">
                <td className="px-2 py-1.5">TOTAL</td>
                <td className="px-2 py-1.5 text-right">{fmt(metrics.tSpend)}</td>
                <td className="px-2 py-1.5 text-right text-muted-foreground">—</td>
                <td className="px-2 py-1.5 text-right text-muted-foreground">—</td>
                <td className="px-2 py-1.5 text-right text-muted-foreground">—</td>
                <td className="px-2 py-1.5 text-right text-muted-foreground">—</td>
                <td className="px-2 py-1.5 text-right">{metrics.tLeads}</td>
                <td className="px-2 py-1.5 text-right text-green-400">{metrics.tClients}</td>
                <td className="px-2 py-1.5 text-right text-green-400">{fmt(Math.round(metrics.tRevMo))}</td>
                <td className="px-2 py-1.5 text-right">{metrics.roiPct}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* KPI Row */}
        <div className="flex flex-wrap gap-2">
          <KPI label="Spend/mo" value={fmtSm(metrics.tSpend)} variant="" />
          <KPI label="Leads" value={String(metrics.tLeads)} variant="" />
          <KPI label="Clients" value={String(metrics.tClients)} variant="grn" />
          <KPI label="Rev/mo" value={fmtSm(Math.round(metrics.tRevMo))} variant="gld" />
          <KPI label="CAC" value={fmtSm(metrics.cac)} variant="" />
          <KPI label="LTV:CAC" value={`${metrics.ltvCac}:1`} variant={metrics.ltvCac >= 3 ? 'grn' : 'red'} />
          <KPI label="ROI" value={`${metrics.roiPct}%`} variant="grn" />
          <KPI label="ARR" value={fmtSm(metrics.arr)} variant="blu" />
        </div>

        {/* Marketing Metrics Table */}
        {metrics.tSpend > 0 && (
          <DataTable
            headers={['Marketing Metric', 'Value', 'Benchmark', 'Status']}
            rows={[
              [<b key="cac">CAC</b>, fmt(metrics.cac), 'FS avg: $500–$2,000', metrics.cac > 0 && metrics.cac < 1000 ? '✓ Strong' : metrics.cac < 2000 ? '⚠ Moderate' : '✗ High'],
              [<b key="arpc">Avg Rev/Client</b>, <span key="av" className="text-green-400">{fmt(metrics.avgRevClient)}/yr</span>, `${fmt(Math.round(metrics.avgRevClient / 12))}/mo`, ''],
              [<b key="ltv">LTV</b>, <span key="lv" className="text-green-400">{fmt(metrics.ltv)}</span>, 'Avg rev × 5yr × 85% retention', ''],
              [<b key="ltvcac">LTV:CAC</b>, <span key="lc" className={metrics.ltvCac >= 3 ? 'text-green-400' : 'text-red-400'}>{metrics.ltvCac}:1</span>, '3:1+ healthy, 5:1+ excellent', metrics.ltvCac >= 5 ? '✓ Excellent' : metrics.ltvCac >= 3 ? '✓ Healthy' : '✗ Below target'],
              [<b key="roi">Annual ROI</b>, <span key="rv" className={metrics.roiPct > 0 ? 'text-green-400' : 'text-red-400'}>{metrics.roiPct}%</span>, '500%+ target', metrics.roiPct >= 500 ? '✓ Strong' : metrics.roiPct >= 200 ? '⚠ Moderate' : '✗ Low'],
              [<b key="arr">ARR</b>, <span key="ar" className="text-green-400">{fmt(metrics.arr)}</span>, 'Annual rev × 85% retention', ''],
              [<b key="margin">Margin</b>, <span key="mg" className={metrics.margin >= 50 ? 'text-green-400' : 'text-red-400'}>{metrics.margin}%</span>, '60%+ target', metrics.margin >= 60 ? '✓ Strong' : metrics.margin >= 40 ? '⚠ Moderate' : '✗ Low'],
            ]}
          />
        )}
      </CardContent>
    </Card>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PANEL 7: DASHBOARD
   ═══════════════════════════════════════════════════════════════ */
export function DashboardPanel(p: PracticeProps) {
  const rd = ROLE_DEFAULTS[p.role] || ROLE_DEFAULTS.new;
  const avgGDC = calcWeightedGDC(p.productMix, PRODUCTS);
  const funnel = calcProductionFunnel(p.targetGDC, p.wbPct, p.bracketOverride, avgGDC,
    p.funnelRates.ap, p.funnelRates.sh, p.funnelRates.cl, p.funnelRates.pl, p.months);
  const teamOvr = calcTeamOverride(p.teamMembers, p.overrideRate / 100, p.bonusRate / 100, p.gen2Rate / 100);
  const aumIncome = Math.round((p.aumExisting * (p.aumTrailPct / 100)) + (p.aumNew * (p.aumTrailPct / 100) * 0.5));
  const recSummary = calcAllTracksSummary(p.recruitTracks, p.overrideRate / 100);
  const chMetrics = calcChannelMetrics(p.channelSpend);

  const overrideInc = p.teamMembers.length > 0 ? teamOvr.total : recSummary.tOvr;
  const dashboard = calcDashboard({
    monthlyGDC: funnel.monthlyGDC, aumIncome, expIncome: funnel.expTarget / 12,
    overrideIncome: overrideInc, opEx: p.pnlOpEx, taxRate: p.pnlTaxRate / 100,
    recOvr: recSummary.tOvr, recYr2Ovr: recSummary.yr2Ovr, recARR: recSummary.recARR,
    recBooks: recSummary.tBooks, recHires: recSummary.tHires,
    aumTotal: p.aumExisting + p.aumNew,
    mktgSpend: chMetrics.tSpend, mktgRev: chMetrics.tRevMo,

  });

  return (
    <section aria-label="Dashboard" role="region">
    <h2 className="text-lg font-bold text-foreground mb-1">Dashboard</h2>
    <p className="text-sm text-muted-foreground mb-4">Real-time production and financial metrics aggregated from all practice planning inputs.</p>
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-primary">Dashboard</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI Row */}
        <div className="flex flex-wrap gap-2">
          <KPI label="Revenue" value={fmtSm(dashboard.totalRev)} variant="gld" />
          <KPI label="EBITDA" value={fmtSm(dashboard.ebitda)} variant="grn" />
          <KPI label="Net Income" value={fmtSm(dashboard.netInc)} variant="grn" />
          <KPI label="Margin" value={dashboard.marginPct + '%'} variant="" />
          <KPI label="ARR" value={fmtSm(dashboard.arr)} variant="blu" />
          <KPI label="AUM" value={fmtSm(dashboard.aumTotal)} variant="" />
          <KPI label="Team" value={`${dashboard.recHires} hires`} variant="" />
          <KPI label="Yr2 Ovr" value={fmtSm(dashboard.recYr2Ovr)} variant="gld" />
        </div>

        {/* Production KPIs */}
        {p.streams.personal && rd.p === 1 && (
          <>
            <SectionHeader>Production KPIs (Monthly Targets)</SectionHeader>
            <DataTable
              headers={['KPI', 'Monthly Target', 'Weekly', 'Daily']}
              rows={[
                [<b key="ap">Approaches</b>, <span key="ma" className="text-green-400">{funnel.monthlyApproaches}</span>, Math.round(funnel.monthlyApproaches / 4.3), funnel.dailyApproaches],
                ['Appts Held', Math.round(funnel.held / Math.max(1, p.months)), Math.round(funnel.held / Math.max(1, p.months) / 4.3), '—'],
                [<b key="apps">Applications</b>, <span key="mapp" className="text-green-400">{funnel.monthlyApps}</span>, Math.round(funnel.monthlyApps / 4.3), '—'],
                ['Placed', Math.round(funnel.placed / Math.max(1, p.months)), Math.round(funnel.placed / Math.max(1, p.months) / 4.3), '—'],
                [<b key="gdc">GDC</b>, <span key="mg" className="text-green-400">{fmt(funnel.monthlyGDC)}</span>, '—', '—'],
                ['AUM Trail', fmt(Math.round(aumIncome / 12)), '—', '—'],
                ['Override', fmt(Math.round(overrideInc / 12)), '—', '—'],
              ]}
            />
          </>
        )}

        {/* Financial Metrics */}
        <SectionHeader>Financial & Operating Metrics</SectionHeader>
        <DataTable
          headers={['Metric', 'Value', 'Context']}
          rows={[
            [<b key="rev">Total Revenue</b>, <span key="rv" className="text-green-400">{fmt(dashboard.totalRev)}</span>, 'Personal GDC + AUM + Expanded + Override'],
            ['ARR (Recurring)', fmt(dashboard.arr), '~15% ins renewals + AUM trail + recruiting book trail'],
            [<b key="ebit">EBITDA</b>, <span key="ev" className={dashboard.ebitda >= 0 ? 'text-green-400' : 'text-red-400'}>{fmt(dashboard.ebitda)}</span>, `Revenue − OpEx (${fmt(p.pnlOpEx)})`],
            ['Margin %', `${dashboard.marginPct}%`, 'EBITDA ÷ Revenue'],
            [<b key="ni">Net Income</b>, <span key="nv" className={dashboard.netInc >= 0 ? 'text-green-400' : 'text-red-400'}>{fmt(dashboard.netInc)}</span>, `After ${p.pnlTaxRate}% tax`],
          ]}
        />

        {/* AUM Section */}
        {(p.aumExisting > 0 || p.aumNew > 0) && (
          <>
            <SectionHeader>AUM & Advisory</SectionHeader>
            <DataTable
              headers={['Metric', 'Value', 'Context']}
              rows={[
                [<b key="aum">Total AUM</b>, fmt(dashboard.aumTotal), 'Existing + new gathered'],
                ['AUM Trail Income', <span key="at" className="text-green-400">{fmt(aumIncome)}</span>, `Compounds YoY at ${p.aumTrailPct}% trail`],
              ]}
            />
          </>
        )}

        {/* Recruiting Section */}
        {dashboard.recHires > 0 && (
          <>
            <SectionHeader>Recruiting & Team</SectionHeader>
            <DataTable
              headers={['Metric', 'Value', 'Context']}
              rows={[
                ['Team Size', String(dashboard.recHires), 'Across all recruiting tracks'],
                ['Yr1 Override', <span key="o1" className="text-green-400">{fmt(dashboard.recOvr)}</span>, 'Accounts for onboarding ramp'],
                ['Yr2 Override', <span key="o2" className="text-green-400">{fmt(dashboard.recYr2Ovr)}</span>, 'Full production, no ramp'],
                ['Transferred Books', fmt(dashboard.recBooks), 'AUM + policies from experienced hires'],
                ['Recruiting ARR', fmt(dashboard.recARR), 'Renewal on team FYC + trail on books'],
              ]}
            />
          </>
        )}

        {/* Marketing Section */}
        {chMetrics.tSpend > 0 && (
          <>
            <SectionHeader>Marketing Channels</SectionHeader>
            <DataTable
              headers={['Metric', 'Value', 'Context']}
              rows={[
                ['Monthly Spend', fmt(chMetrics.tSpend), `${fmt(chMetrics.tSpend * 12)}/yr across channels`],
                ['Leads / Clients', `${chMetrics.tLeads} / ${chMetrics.tClients}`, 'From channel inputs'],
                ['Channel Rev/Mo', <span key="cr" className="text-green-400">{fmt(Math.round(chMetrics.tRevMo))}</span>, `ROI: ${chMetrics.roiPct}%`],
              ]}
            />
          </>
        )}

        {/* ═══ INTERACTIVE CHARTS ═══ */}
        <SectionHeader>Revenue Breakdown</SectionHeader>
        <DashboardCharts
          dashboard={dashboard}
          funnel={funnel}
          aumIncome={aumIncome}
          overrideInc={overrideInc}
          chMetrics={chMetrics}
          streams={p.streams}
          rd={rd}
          months={p.months}
          recruitTracks={p.recruitTracks}
          recSummary={recSummary}
          overrideRate={p.overrideRate / 100}
        />
      </CardContent>
    </Card>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PANEL 8: P&L (Profit & Loss)
   ═══════════════════════════════════════════════════════════════ */
export function PnLPanel(p: PracticeProps) {
  const pnl = calcPnL(p.pnlLevel, p.pnlProducers, p.pnlAvgGDC, p.pnlPayoutRate / 100, p.pnlOpEx, p.pnlTaxRate / 100, p.pnlEbitGoal, p.pnlNetGoal);

  return (    <section aria-label="Profit and Loss" role="region">
    <h2 className="text-lg font-bold text-foreground mb-1">P&amp;L Statement</h2>
    <p className="text-sm text-muted-foreground mb-4">Individual or team-level profit and loss with EBIT, net income, and back-plan goal tracking.</p>
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex flex-wrap items-center gap-2">
          <span className="text-primary">P&L (Profit & Loss)</span>
          <RefTip text="P&L follows standard financial statement format. OpEx benchmarks from LIMRA Agent Compensation Study 2024. Tax rates per IRS 2025 brackets." refId="commission" />
          <Badge variant="outline" className="text-[10px]">{p.pnlLevel === 'ind' ? 'Individual' : 'Team/Agency'}</Badge>
          {pnl.backPlanned && <Badge variant="outline" className="text-[10px] text-primary">Back-Planned</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="space-y-0.5">
            <Label className="text-[10px] text-muted-foreground">Level</Label>
            <Select value={p.pnlLevel} onValueChange={v => p.setPnlLevel(v as 'ind' | 'team')}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ind">Individual</SelectItem>
                <SelectItem value="team">Team/Agency</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {p.pnlLevel === 'team' && (
            <PInput label="# Producers" value={p.pnlProducers} onChange={v => p.setPnlProducers(+v || 1)} />
          )}
          <PInput label="Avg GDC/Producer" value={p.pnlAvgGDC} onChange={v => p.setPnlAvgGDC(+v || 0)} prefix="$" />
          <PInput label="Payout Rate %" value={p.pnlPayoutRate} onChange={v => p.setPnlPayoutRate(+v || 0)} suffix="%" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <PInput label="OpEx ($)" value={p.pnlOpEx} onChange={v => p.setPnlOpEx(+v || 0)} prefix="$" />
          <PInput label="Tax Rate %" value={p.pnlTaxRate} onChange={v => p.setPnlTaxRate(+v || 0)} suffix="%" />
          <PInput label="EBITDA Goal ($)" value={p.pnlEbitGoal} onChange={v => p.setPnlEbitGoal(+v || 0)} prefix="$" />
          <PInput label="Net Income Goal ($)" value={p.pnlNetGoal} onChange={v => p.setPnlNetGoal(+v || 0)} prefix="$" />
        </div>

        {/* KPI Row */}
        <div className="flex flex-wrap gap-2">
          <KPI label="Revenue" value={fmtSm(pnl.revenue)} variant="gld" />
          <KPI label="GM%" value={`${pnl.gmPct}%`} variant="" />
          <KPI label="EBITDA" value={fmtSm(pnl.ebitda)} variant="grn" />
          <KPI label="Margin%" value={`${pnl.marginPct}%`} variant="" />
          <KPI label="Net" value={fmtSm(pnl.netIncome)} variant="grn" />
        </div>

        {/* P&L Table */}
        <DataTable
          headers={['Line', 'Annual', 'Monthly', '% Rev']}
          rows={[
            [<b key="rev">Revenue</b>, <span key="rv" className="text-green-400">{fmt(pnl.revenue)}</span>, fmt(Math.round(pnl.revenue / 12)), '100%'],
            [<span key="cogs" className="text-red-400">COGS (Payouts)</span>, <span key="cv" className="text-red-400">{fmt(pnl.cogs)}</span>, fmt(Math.round(pnl.cogs / 12)), pnl.revenue > 0 ? pct(pnl.cogs / pnl.revenue) : '—'],
            [<b key="gm">Gross Margin</b>, <span key="gv" className="text-green-400">{fmt(pnl.grossMargin)}</span>, fmt(Math.round(pnl.grossMargin / 12)), `${pnl.gmPct}%`],
            [<span key="opex" className="text-red-400">OpEx</span>, <span key="ov" className="text-red-400">{fmt(pnl.opEx)}</span>, fmt(Math.round(pnl.opEx / 12)), pnl.revenue > 0 ? pct(pnl.opEx / pnl.revenue) : '—'],
            [<b key="ebit">EBIT/EBITDA</b>, <span key="ev" className={pnl.ebitda >= 0 ? 'text-green-400' : 'text-red-400'}>{fmt(pnl.ebitda)}</span>, fmt(Math.round(pnl.ebitda / 12)), `${pnl.marginPct}%`],
            [`Tax (${p.pnlTaxRate}%)`, <span key="tv" className="text-red-400">{fmt(pnl.tax)}</span>, fmt(Math.round(pnl.tax / 12)), pnl.revenue > 0 ? pct(pnl.tax / pnl.revenue) : '—'],
            [<b key="ni">Net Income</b>, <span key="nv" className={pnl.netIncome >= 0 ? 'text-green-400' : 'text-red-400'}>{fmt(pnl.netIncome)}</span>, fmt(Math.round(pnl.netIncome / 12)), pnl.revenue > 0 ? pct(pnl.netIncome / pnl.revenue) : '—'],
          ]}
        />

        {pnl.backPlanned && (
          <div className="text-[10px] text-primary bg-primary/5 border border-primary/20 rounded-md p-2">
            <b>Back-planned:</b> GDC auto-set to {fmt(pnl.avgGDC)} to hit {p.pnlNetGoal > 0 ? `net income ${fmt(p.pnlNetGoal)}` : `EBITDA ${fmt(p.pnlEbitGoal)}`}
          </div>
        )}
      </CardContent>
    </Card>
    </section>
  );
}


/* ═══════════════════════════════════════════════════════════════
   DASHBOARD CHARTS — Interactive Recharts visualizations
   ═══════════════════════════════════════════════════════════════ */
const CHART_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#14b8a6'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-2 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color || entry.fill }}>
          {entry.name}: {fmtSm(entry.value)}
        </p>
      ))}
    </div>
  );
};

function DashboardCharts({ dashboard, funnel, aumIncome, overrideInc, chMetrics, streams, rd, months, recruitTracks, recSummary, overrideRate }: {
  dashboard: ReturnType<typeof calcDashboard>;
  funnel: ReturnType<typeof calcProductionFunnel>;
  aumIncome: number;
  overrideInc: number;
  chMetrics: ReturnType<typeof calcChannelMetrics>;
  streams: Record<string, boolean>;
  rd: { p: number };
  months: number;
  recruitTracks: RecruitTrack[];
  recSummary: ReturnType<typeof calcAllTracksSummary>;
  overrideRate: number;
}) {
  /* Revenue breakdown data for bar chart */
  const revData = [
    streams.personal && rd.p === 1 && funnel.wbTarget > 0 ? { name: 'Personal GDC', value: funnel.wbTarget } : null,
    streams.expanded && funnel.expTarget > 0 ? { name: 'Expanded', value: funnel.expTarget } : null,
    streams.aum && aumIncome > 0 ? { name: 'AUM Trail', value: aumIncome } : null,
    streams.override && overrideInc > 0 ? { name: 'Override', value: overrideInc } : null,
    streams.channels && chMetrics.tRevMo > 0 ? { name: 'Channels', value: Math.round(chMetrics.tRevMo * 12) } : null,
  ].filter(Boolean) as { name: string; value: number }[];

  /* P&L waterfall data */
  const waterfallData = [
    { name: 'Revenue', value: dashboard.totalRev },
    { name: 'OpEx', value: -dashboard.totalRev + dashboard.ebitda },
    { name: 'EBITDA', value: dashboard.ebitda },
    { name: 'Tax', value: -(dashboard.ebitda - dashboard.netInc) },
    { name: 'Net Income', value: dashboard.netInc },
  ];

  /* Funnel data for pie chart (monthly values) */
  const mo = months || 12;
  const funnelPieData = funnel.monthlyApproaches > 0 ? [
    { name: 'Approaches', value: funnel.monthlyApproaches },
    { name: 'Shows', value: Math.round(funnel.held / mo) },
    { name: 'Apps', value: funnel.monthlyApps },
    { name: 'Placed', value: Math.round(funnel.placed / mo) },
  ] : [];

  /* Channel ROI data */
  const channelROI = chMetrics.channelResults
    .filter(r => r.spend > 0)
    .map(r => ({ name: r.name, roi: r.roi, spend: r.spend, rev: r.annRev }))
    .sort((a, b) => b.roi - a.roi)
    .slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Revenue Breakdown Bar Chart */}
      {revData.length > 0 && (
        <div className="bg-background/50 rounded-lg p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Annual Revenue by Stream</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={(v: number) => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v/1e3)}K` : `$${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Revenue" radius={[4, 4, 0, 0]}>
                {revData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* P&L Waterfall */}
      {dashboard.totalRev > 0 && (
        <div className="bg-background/50 rounded-lg p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">P&L Waterfall</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={waterfallData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={(v: number) => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v/1e3)}K` : `$${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Amount" radius={[4, 4, 0, 0]}>
                {waterfallData.map((d, i) => (
                  <Cell key={i} fill={d.value >= 0 ? '#22c55e' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Sales Funnel Pie */}
      {funnelPieData.length > 0 && (
        <div className="bg-background/50 rounded-lg p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Monthly Sales Funnel</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={funnelPieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                outerRadius={80} innerRadius={40} paddingAngle={3} label={({ name, value }: any) => `${name}: ${value}`}>
                {funnelPieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recruiting Pipeline Chart */}
      {recruitTracks.length > 0 && recSummary.details.length > 0 && (
        <div className="bg-background/50 rounded-lg p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Recruiting Pipeline — Override Income by Track</p>
          <ResponsiveContainer width="100%" height={Math.max(200, recSummary.details.length * 50 + 40)}>
            <BarChart
              data={recSummary.details.map(d => ({
                name: RECRUIT_LABELS[d.type] || d.type,
                hires: d.n,
                yr1Ovr: d.trackOvr,
                yr2Ovr: Math.round(d.n * d.f * overrideRate),
                trackFYC: d.trackFYC,
              }))}
              layout="vertical"
              margin={{ top: 5, right: 10, left: 90, bottom: 5 }}
            >
              <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={(v: number) => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v/1e3)}K` : `$${v}`} />
              <YAxis type="category" dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} width={85} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="yr1Ovr" name="Yr1 Override" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              <Bar dataKey="yr2Ovr" name="Yr2 Override" fill="#22c55e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {/* Recruiting funnel summary */}
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="text-center p-1.5 bg-muted/30 rounded">
              <p className="text-[10px] text-muted-foreground">Total Hires</p>
              <p className="text-sm font-bold text-foreground">{recSummary.tHires}</p>
            </div>
            <div className="text-center p-1.5 bg-muted/30 rounded">
              <p className="text-[10px] text-muted-foreground">Team FYC</p>
              <p className="text-sm font-bold text-green-400">{fmtSm(recSummary.tFYC)}</p>
            </div>
            <div className="text-center p-1.5 bg-muted/30 rounded">
              <p className="text-[10px] text-muted-foreground">Rec EBITDA</p>
              <p className={`text-sm font-bold ${recSummary.recEBITDA >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtSm(recSummary.recEBITDA)}</p>
            </div>
            <div className="text-center p-1.5 bg-muted/30 rounded">
              <p className="text-[10px] text-muted-foreground">Books Transferred</p>
              <p className="text-sm font-bold text-foreground">{fmtSm(recSummary.tBooks)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Channel ROI Comparison */}
      {channelROI.length > 0 && (
        <div className="bg-background/50 rounded-lg p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Channel ROI Comparison</p>
          <ResponsiveContainer width="100%" height={Math.max(180, channelROI.length * 32)}>
            <BarChart data={channelROI} layout="vertical" margin={{ top: 5, right: 10, left: 80, bottom: 5 }}>
              <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={(v: number) => `${v}%`} />
              <YAxis type="category" dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} width={75} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(0)}%`, 'ROI']} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }} />
              <Bar dataKey="roi" name="ROI %" radius={[0, 4, 4, 0]}>
                {channelROI.map((d, i) => (
                  <Cell key={i} fill={d.roi >= 300 ? '#22c55e' : d.roi >= 100 ? '#f59e0b' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   GOAL TRACKER PANEL
   ═══════════════════════════════════════════════════════════════ */
export function GoalTrackerPanel(p: PracticeProps) {
  const rd = ROLE_DEFAULTS[p.role] || ROLE_DEFAULTS.new;
  const avgGDC = calcWeightedGDC(p.productMix, PRODUCTS);
  const funnel = calcProductionFunnel(p.targetGDC, p.wbPct, p.bracketOverride, avgGDC,
    p.funnelRates.ap, p.funnelRates.sh, p.funnelRates.cl, p.funnelRates.pl, p.months);
  const teamOvr = calcTeamOverride(p.teamMembers, p.overrideRate / 100, p.bonusRate / 100, p.gen2Rate / 100);
  const aumIncome = Math.round((p.aumExisting * (p.aumTrailPct / 100)) + (p.aumNew * (p.aumTrailPct / 100) * 0.5));
  const recSummary = calcAllTracksSummary(p.recruitTracks, p.overrideRate / 100);
  const chMetrics = calcChannelMetrics(p.channelSpend);
  const overrideInc = p.teamMembers.length > 0 ? teamOvr.total : recSummary.tOvr;
  const rollUp = calcRollUp({
    role: p.role, hasPersonal: rd.p === 1, wbTarget: funnel.wbTarget, expTarget: funnel.expTarget,
    overrideIncome: overrideInc, overrideRate: p.overrideRate / 100, aumIncome,
    affAIncome: p.affAIncome, affBIncome: p.affBIncome, affCIncome: p.affCIncome, affDIncome: p.affDIncome,
    channelRevAnnual: Math.round(chMetrics.tRevMo * 12), streams: p.streams,
  });

  // Compute "current" values from the engine
  const currentIncome = rollUp.grandTotal;
  const currentAUM = p.aumExisting + p.aumNew;
  const currentRecruits = recSummary.tHires;
  const currentGDC = funnel.gdcNeeded;
  const currentCases = funnel.placed;

  const progress = calcGoalProgress({
    incomeGoal: p.goalIncome, currentIncome,
    aumGoal: p.goalAUM, currentAUM,
    recruitGoal: p.goalRecruits, currentRecruits,
    gdcGoal: p.goalGDC, currentGDC,
    casesGoal: p.goalCases, currentCases,
  });

  const getColor = (pct: number) => pct >= 100 ? 'bg-green-500' : pct >= 75 ? 'bg-primary' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
  const getTextColor = (pct: number) => pct >= 100 ? 'text-green-400' : pct >= 75 ? 'text-primary' : pct >= 50 ? 'text-amber-400' : 'text-red-400';

  return (    <section aria-label="Goal Tracker" role="region">
    <h2 className="text-lg font-bold text-foreground mb-1">Goal Tracker</h2>
    <p className="text-sm text-muted-foreground mb-4">Set income, AUM, recruiting, GDC, and case targets. Track progress against your goals.</p>
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-foreground flex items-center justify-between">
          <span>Goal Tracker</span>
          <RefTip text="Goals tracked against your production plan targets. Progress calculated from actual vs planned metrics across all revenue streams." refId="commission" />
          <Badge variant="outline" className={`text-xs ${getTextColor(progress.overallPct)}`}>
            {progress.overallPct}% Overall
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Progress Ring */}
        <div className="flex items-center gap-4 bg-muted/30 rounded-lg p-4">
          <div className="relative w-20 h-20 shrink-0">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
              <circle cx="40" cy="40" r="34" fill="none" stroke={progress.overallPct >= 100 ? '#22c55e' : progress.overallPct >= 75 ? 'hsl(var(--primary))' : progress.overallPct >= 50 ? '#f59e0b' : '#ef4444'}
                strokeWidth="6" strokeLinecap="round"
                strokeDasharray={`${(progress.overallPct / 100) * 213.6} 213.6`} />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${getTextColor(progress.overallPct)}`}>
              {progress.overallPct}%
            </span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              {progress.overallPct >= 100 ? 'All Goals Achieved!' : progress.overallPct >= 75 ? 'Almost There!' : progress.overallPct >= 50 ? 'Making Progress' : 'Getting Started'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {progress.goals.filter(g => g.pct >= 100).length} of {progress.goals.length} goals met
            </p>
          </div>
        </div>

        {/* Goal Setting Inputs */}
        <SectionHeader>Set Your Goals</SectionHeader>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <PInput label="Income Goal" value={p.goalIncome} onChange={v => p.setGoalIncome(+v || 0)} prefix="$" />
          <PInput label="GDC Goal" value={p.goalGDC} onChange={v => p.setGoalGDC(+v || 0)} prefix="$" />
          <PInput label="AUM Goal" value={p.goalAUM} onChange={v => p.setGoalAUM(+v || 0)} prefix="$" />
          <PInput label="Recruit Goal" value={p.goalRecruits} onChange={v => p.setGoalRecruits(+v || 0)} />
          <PInput label="Cases Goal" value={p.goalCases} onChange={v => p.setGoalCases(+v || 0)} />
        </div>

        {/* Individual Goal Progress Bars */}
        {progress.goals.length > 0 && (
          <>
            <SectionHeader>Progress</SectionHeader>
            <div className="space-y-3">
              {progress.goals.map(g => (
                <div key={g.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{g.label}</span>
                    <span className={`font-bold ${getTextColor(g.pct)}`}>
                      {g.pct}% — {g.format === 'dollar' ? fmt(g.current) : g.current} / {g.format === 'dollar' ? fmt(g.goal) : g.goal}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${getColor(g.pct)}`}
                      style={{ width: `${Math.min(100, g.pct)}%` }} />
                  </div>
                  {g.remaining > 0 && (
                    <p className="text-[10px] text-muted-foreground">
                      {g.format === 'dollar' ? fmt(g.remaining) : g.remaining} remaining to goal
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Goal Breakdown Chart */}
        {progress.goals.length > 0 && (
          <>
            <SectionHeader>Goal Completion Chart</SectionHeader>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={progress.goals.map(g => ({ name: g.label.split(' ')[0], pct: g.pct, goal: 100 }))}
                margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false}
                  domain={[0, 120]} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip formatter={(v: number) => [`${v}%`, 'Progress']}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }} />
                <Bar dataKey="pct" name="Progress" radius={[4, 4, 0, 0]}>
                  {progress.goals.map((g, i) => (
                    <Cell key={i} fill={g.pct >= 100 ? '#22c55e' : g.pct >= 75 ? 'hsl(var(--primary))' : g.pct >= 50 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </>
        )}

        {progress.goals.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">Set at least one goal above to track your progress.</p>
            <p className="text-xs mt-1">Goals are computed from your Practice Planning inputs.</p>
          </div>
        )}
      </CardContent>
    </Card>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MONTHLY PRODUCTION PANEL (Seasonality)
   ═══════════════════════════════════════════════════════════════ */
export function MonthlyProductionPanel(p: PracticeProps) {
  const [selectedYear, setSelectedYear] = useState(1);

  const bracket = getBracket(p.targetGDC);
  const payoutRate = p.bracketOverride !== 'auto' ? parseFloat(p.bracketOverride) / 100 : bracket.r;

  const production = useMemo(() => buildMonthlyProduction({
    annualGDC: p.targetGDC,
    seasonProfile: p.seasonProfile,
    customSeason: p.customSeason,
    horizonYears: p.seasonHorizon,
    growthRate: p.seasonGrowthRate / 100,
    bracketRate: payoutRate,
    rampMonths: p.seasonRampMonths,
    rampPct: 0.3,
  }), [p.targetGDC, p.seasonProfile, p.customSeason, p.seasonHorizon, p.seasonGrowthRate, payoutRate, p.seasonRampMonths]);

  const currentYearData = production.years.find(y => y.year === selectedYear) || production.years[0];
  const profileMults = (p.seasonProfile === 'custom' && p.customSeason?.length === 12)
    ? p.customSeason
    : (SEASON_PROFILES[p.seasonProfile] || SEASON_PROFILES.flat);

  return (
    <section aria-label="Monthly Production" role="region">
    <h2 className="text-lg font-bold text-foreground mb-1">Monthly Production</h2>
    <p className="text-sm text-muted-foreground mb-4">Seasonality-adjusted monthly projections with ramp modeling and multi-year horizon.</p>
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-foreground flex items-center justify-between">
          <span>Monthly Production Plan</span>
          <RefTip text="Monthly production targets derived from annual plan. Seasonality adjustments based on industry patterns: Q1 heavy (tax season), Q4 heavy (year-end planning)." refId="commission" />
          <Badge variant="outline" className="text-xs">{production.profileName}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Seasonality Profile Selection */}
        <SectionHeader>Seasonality Profile</SectionHeader>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="space-y-0.5">
            <Label className="text-[10px] font-medium text-muted-foreground">Profile</Label>
            <Select value={p.seasonProfile} onValueChange={v => p.setSeasonProfile(v)}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(SEASON_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <PInput label="Growth Rate" value={p.seasonGrowthRate} onChange={v => p.setSeasonGrowthRate(+v || 0)} suffix="%" />
          <PInput label="Horizon (Years)" value={p.seasonHorizon} onChange={v => p.setSeasonHorizon(Math.max(1, Math.min(10, +v || 1)))} />
          <PInput label="Ramp Months (Yr1)" value={p.seasonRampMonths} onChange={v => p.setSeasonRampMonths(Math.max(0, Math.min(12, +v || 0)))} />
        </div>

        {/* Custom Multipliers */}
        {p.seasonProfile === 'custom' && (
          <>
            <SectionHeader>Custom Monthly Multipliers</SectionHeader>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                <PInput key={m} label={m} value={p.customSeason[i] ?? 1}
                  onChange={v => {
                    const next = [...p.customSeason];
                    next[i] = Math.max(0, parseFloat(v) || 0);
                    p.setCustomSeason(next);
                  }} suffix="×" />
              ))}
            </div>
          </>
        )}

        {/* Seasonality Curve Visualization */}
        <SectionHeader>Seasonality Curve</SectionHeader>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={profileMults.map((m, i) => ({ name: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i], mult: m }))}
            margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false}
              domain={[0, 'auto']} tickFormatter={(v: number) => `${v}×`} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(2)}×`, 'Multiplier']}
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }} />
            <Area type="monotone" dataKey="mult" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>

        {/* Year Selector */}
        {production.years.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            {production.years.map(y => (
              <Button key={y.year} variant={selectedYear === y.year ? 'default' : 'outline'} size="sm"
                className="text-xs h-7" onClick={() => setSelectedYear(y.year)}>
                Year {y.year}
              </Button>
            ))}
          </div>
        )}

        {/* Monthly Production Table */}
        <SectionHeader>Year {selectedYear} — Monthly Breakdown</SectionHeader>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <KPI label="Annual GDC" value={fmt(currentYearData?.annGDC || 0)} />
          <KPI label="Annual Income" value={fmt(currentYearData?.annIncome || 0)} />
          <KPI label="Avg Monthly" value={fmt(Math.round((currentYearData?.annGDC || 0) / 12))} />
        </div>

        <DataTable
          headers={['Month', 'Multiplier', 'GDC', 'Income', 'Cum. GDC']}
          rows={(() => {
            let cumGDC = 0;
            return (currentYearData?.months || []).map(m => {
              cumGDC += m.gdc;
              return [m.name, `${m.mult.toFixed(2)}×`, fmt(m.gdc), fmt(m.income), fmt(cumGDC)];
            });
          })()}
        />

        {/* Monthly GDC Bar Chart */}
        <SectionHeader>Monthly GDC — Year {selectedYear}</SectionHeader>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={currentYearData?.months || []} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false}
              tickFormatter={(v: number) => fmtSm(v)} />
            <Tooltip formatter={(v: number) => [fmt(v), 'GDC']}
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }} />
            <Bar dataKey="gdc" name="GDC" radius={[4, 4, 0, 0]}>
              {(currentYearData?.months || []).map((m, i) => (
                <Cell key={i} fill={m.mult >= 1.2 ? '#22c55e' : m.mult >= 0.9 ? 'hsl(var(--primary))' : m.mult >= 0.7 ? '#f59e0b' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Multi-Year Projection */}
        {production.years.length > 1 && (
          <>
            <SectionHeader>Multi-Year Projection</SectionHeader>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={production.years.map(y => ({ name: `Yr ${y.year}`, gdc: y.annGDC, income: y.annIncome }))}
                margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => fmtSm(v)} />
                <Tooltip formatter={(v: number) => [fmt(v)]}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }} />
                <Line type="monotone" dataKey="gdc" name="GDC" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="income" name="Income" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </LineChart>
            </ResponsiveContainer>

            <DataTable
              headers={['Year', 'Annual GDC', 'Annual Income', 'Growth']}
              rows={production.years.map((y, i) => [
                `Year ${y.year}`,
                fmt(y.annGDC),
                fmt(y.annIncome),
                i === 0 ? '—' : `+${pct((y.annGDC - production.years[i-1].annGDC) / production.years[i-1].annGDC)}`,
              ])}
            />
          </>
        )}
      </CardContent>
    </Card>
    </section>
  );
}


/* ═══════════════════════════════════════════════════════════════
   CASCADE CHAIN VISUALIZATION — Flow diagram of cascade propagation
   ═══════════════════════════════════════════════════════════════ */

function CascadeChainViz({ chain }: { chain: CascadeChainData }) {
  if (chain.nodes.length === 0) return null;

  const rootNodes = chain.nodes.filter(n => n.level === 0 && n.type === 'target');
  const channelNodes = chain.nodes.filter(n => n.level === 1);
  const outputNodes = chain.nodes.filter(n => n.level === 0 && n.type === 'output');

  return (
    <div className="space-y-3">
      {/* Root: Target Income */}
      <div className="flex justify-center">
        {rootNodes.map(n => (
          <div key={n.id} className="bg-amber-500/15 border border-amber-500/30 rounded-lg px-4 py-2 text-center">
            <div className="text-[10px] font-bold text-amber-400">{n.label}</div>
            <div className="text-sm font-extrabold text-amber-300">{fmtSm(n.value)}</div>
          </div>
        ))}
      </div>

      {/* Down arrows */}
      <div className="flex justify-center">
        <div className="flex flex-col items-center">
          <svg width="20" height="24" viewBox="0 0 20 24" className="text-muted-foreground/50">
            <path d="M10 0 L10 18 M4 14 L10 20 L16 14" stroke="currentColor" strokeWidth="2" fill="none" />
          </svg>
          <span className="text-[8px] text-muted-foreground">splits</span>
        </div>
      </div>

      {/* Channel nodes */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {channelNodes.map(n => {
          const edge = chain.edges.find(e => e.to === n.id && e.from === 'target');
          const projectedNode = chain.nodes.find(pn => pn.id === `${n.id.replace('ch_', '')}_projected`);
          return (
            <div key={n.id} className="rounded-lg p-2 text-center border" style={{ borderColor: n.color + '40', backgroundColor: n.color + '10' }}>
              <div className="text-[9px] font-bold" style={{ color: n.color }}>{n.label}</div>
              <div className="text-xs font-extrabold" style={{ color: n.color }}>{fmtSm(n.value)}</div>
              {edge && <div className="text-[8px] text-muted-foreground">{edge.label} split</div>}
              {projectedNode && (
                <div className="mt-1 pt-1 border-t" style={{ borderColor: n.color + '30' }}>
                  <div className="text-[8px] text-muted-foreground">Projected</div>
                  <div className="text-[10px] font-bold" style={{ color: projectedNode.value >= n.value ? '#22c55e' : '#ef4444' }}>
                    {fmtSm(projectedNode.value)}
                    <span className="text-[8px] ml-0.5">
                      {n.value > 0 ? `(${Math.round(projectedNode.value / n.value * 100)}%)` : ''}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Up arrows */}
      <div className="flex justify-center">
        <div className="flex flex-col items-center">
          <span className="text-[8px] text-muted-foreground">roll-up</span>
          <svg width="20" height="24" viewBox="0 0 20 24" className="text-green-500/50">
            <path d="M10 24 L10 6 M4 10 L10 4 L16 10" stroke="currentColor" strokeWidth="2" fill="none" />
          </svg>
        </div>
      </div>

      {/* Total Projected */}
      <div className="flex justify-center">
        {outputNodes.map(n => (
          <div key={n.id} className="bg-green-500/15 border border-green-500/30 rounded-lg px-4 py-2 text-center">
            <div className="text-[10px] font-bold text-green-400">{n.label}</div>
            <div className="text-sm font-extrabold text-green-300">{fmtSm(n.value)}</div>
            {rootNodes[0] && (
              <div className={`text-[9px] font-semibold ${n.value >= rootNodes[0].value ? 'text-green-400' : 'text-red-400'}`}>
                {n.value >= rootNodes[0].value ? '✓ On Target' : `Gap: ${fmtSm(rootNodes[0].value - n.value)}`}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Cascade direction legend */}
      <div className="flex justify-center gap-4 text-[9px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-amber-400 inline-block" /> Roll-down (target → inputs)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-green-400 inline-block" /> Roll-up (projected → total)
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PLANNING HORIZON VISUALIZATION — Multi-year interactive chart
   ═══════════════════════════════════════════════════════════════ */

function PlanningHorizonViz({ points, targetIncome }: { points: PlanningHorizonPoint[]; targetIncome: number }) {
  const [viewMode, setViewMode] = useState<'cumulative' | 'monthly' | 'channel'>('cumulative');
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);

  if (points.length === 0) return null;

  const milestones = points.filter(p => p.milestone !== null);
  const lastPoint = points[points.length - 1];
  const breakeven = points.find(p => p.milestone === 'Breakeven');
  const onTrackPct = Math.round(points.filter(p => p.onTrack).length / points.length * 100);

  // Quarterly aggregation
  const quarters = [];
  for (let q = 0; q < Math.ceil(points.length / 3); q++) {
    const qPoints = points.slice(q * 3, q * 3 + 3);
    quarters.push({
      label: `Q${q + 1}`,
      income: qPoints.reduce((s, p) => s + p.gdc + p.aum + p.affiliate + p.override + p.channel, 0),
      target: Math.round(targetIncome / 4),
      gdc: qPoints.reduce((s, p) => s + p.gdc, 0),
      aum: qPoints.reduce((s, p) => s + p.aum, 0),
      affiliate: qPoints.reduce((s, p) => s + p.affiliate, 0),
      override: qPoints.reduce((s, p) => s + p.override, 0),
      channel: qPoints.reduce((s, p) => s + p.channel, 0),
    });
  }

  const hoveredPoint = hoveredMonth !== null ? points[hoveredMonth - 1] : null;

  return (
    <div className="space-y-3">
      {/* KPI Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <KPI label="3-Year Cumulative" value={fmtSm(lastPoint.cumulativeIncome)} sub={`vs ${fmtSm(lastPoint.cumulativeTarget)} target`} variant={lastPoint.cumulativeIncome >= lastPoint.cumulativeTarget * 0.9 ? 'grn' : 'red'} />
        <KPI label="On-Track Rate" value={`${onTrackPct}%`} sub={`${points.filter(p => p.onTrack).length}/${points.length} months`} variant={onTrackPct >= 80 ? 'grn' : onTrackPct >= 50 ? 'gld' : 'red'} />
        {breakeven && <KPI label="Breakeven" value={`Month ${breakeven.month}`} sub={breakeven.month <= 12 ? 'Year 1' : breakeven.month <= 24 ? 'Year 2' : 'Year 3'} variant="blu" />}
        <KPI label="Year 3 Run Rate" value={fmtSm(Math.round((lastPoint.gdc + lastPoint.aum + lastPoint.affiliate + lastPoint.override + lastPoint.channel) * 12))} sub="Annualized" variant="grn" />
      </div>

      {/* View mode toggle */}
      <div className="flex gap-1 justify-center">
        {(['cumulative', 'monthly', 'channel'] as const).map(mode => (
          <button key={mode} onClick={() => setViewMode(mode)}
            className={`text-[9px] px-2 py-0.5 rounded-full transition-colors ${
              viewMode === mode ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}>
            {mode === 'cumulative' ? '📈 Cumulative' : mode === 'monthly' ? '📊 Monthly' : '🎯 By Channel'}
          </button>
        ))}
      </div>

      {/* Cumulative view: progress bar per year */}
      {viewMode === 'cumulative' && (
        <div className="space-y-2">
          {[0, 1, 2].map(yr => {
            const yrPoints = points.slice(yr * 12, (yr + 1) * 12);
            if (yrPoints.length === 0) return null;
            const yrIncome = yrPoints.reduce((s, p) => s + p.gdc + p.aum + p.affiliate + p.override + p.channel, 0);
            const yrTarget = targetIncome;
            const pct = Math.min(100, Math.round(yrIncome / yrTarget * 100));
            return (
              <div key={yr} className="space-y-0.5">
                <div className="flex justify-between text-[10px]">
                  <span className="font-semibold">Year {yr + 1}</span>
                  <span className={pct >= 90 ? 'text-green-400' : pct >= 60 ? 'text-amber-400' : 'text-red-400'}>
                    {fmtSm(yrIncome)} / {fmtSm(yrTarget)} ({pct}%)
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${
                    pct >= 90 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500'
                  }`} style={{ width: `${pct}%` }} />
                </div>
                {/* Monthly mini-bars */}
                <div className="flex gap-px">
                  {yrPoints.map((pt, i) => {
                    const monthIncome = pt.gdc + pt.aum + pt.affiliate + pt.override + pt.channel;
                    const monthTarget = targetIncome / 12;
                    const mPct = Math.min(100, Math.round(monthIncome / monthTarget * 100));
                    return (
                      <div key={i} className="flex-1 group relative cursor-pointer"
                        onMouseEnter={() => setHoveredMonth(pt.month)}
                        onMouseLeave={() => setHoveredMonth(null)}>
                        <div className="h-6 bg-muted/50 rounded-sm overflow-hidden">
                          <div className={`w-full rounded-sm transition-all ${
                            pt.onTrack ? 'bg-green-500/60' : 'bg-red-500/40'
                          }`} style={{ height: `${mPct}%`, marginTop: `${100 - mPct}%` }} />
                        </div>
                        {pt.milestone && (
                          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
                        )}
                        <div className="text-[7px] text-center text-muted-foreground">{i + 1}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Monthly view: quarterly bars */}
      {viewMode === 'monthly' && (
        <div className="space-y-1">
          {quarters.map((q, i) => {
            const pct = Math.min(100, Math.round(q.income / q.target * 100));
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[9px] w-6 text-right text-muted-foreground">{q.label}</span>
                <div className="flex-1 h-4 bg-muted/30 rounded overflow-hidden relative">
                  <div className={`h-full rounded transition-all ${pct >= 90 ? 'bg-green-500/70' : pct >= 60 ? 'bg-amber-500/70' : 'bg-red-500/50'}`}
                    style={{ width: `${pct}%` }} />
                  <div className="absolute right-1 top-0 h-full flex items-center text-[8px] font-mono text-foreground/70">
                    {fmtSm(q.income)}
                  </div>
                </div>
                <span className={`text-[9px] w-8 text-right font-semibold ${pct >= 90 ? 'text-green-400' : pct >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Channel breakdown view */}
      {viewMode === 'channel' && (
        <div className="space-y-2">
          {quarters.map((q, i) => (
            <div key={i} className="space-y-0.5">
              <div className="flex justify-between text-[9px]">
                <span className="font-semibold">{q.label}</span>
                <span className="text-muted-foreground">{fmtSm(q.income)}</span>
              </div>
              <div className="flex h-3 rounded-full overflow-hidden">
                {q.income > 0 && <>
                  {q.gdc > 0 && <div className="h-full" style={{ width: `${q.gdc / q.income * 100}%`, backgroundColor: '#22c55e' }} />}
                  {q.aum > 0 && <div className="h-full" style={{ width: `${q.aum / q.income * 100}%`, backgroundColor: '#3b82f6' }} />}
                  {q.affiliate > 0 && <div className="h-full" style={{ width: `${q.affiliate / q.income * 100}%`, backgroundColor: '#a855f7' }} />}
                  {q.override > 0 && <div className="h-full" style={{ width: `${q.override / q.income * 100}%`, backgroundColor: '#f97316' }} />}
                  {q.channel > 0 && <div className="h-full" style={{ width: `${q.channel / q.income * 100}%`, backgroundColor: '#06b6d4' }} />}
                </>}
              </div>
            </div>
          ))}
          {/* Legend */}
          <div className="flex flex-wrap gap-2 justify-center text-[8px]">
            {[{ label: 'GDC', color: '#22c55e' }, { label: 'AUM', color: '#3b82f6' }, { label: 'Affiliate', color: '#a855f7' }, { label: 'Override', color: '#f97316' }, { label: 'Marketing', color: '#06b6d4' }].map(l => (
              <span key={l.label} className="flex items-center gap-0.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Hover tooltip */}
      {hoveredPoint && (
        <div className="bg-card border border-border rounded-lg p-2 text-[10px]">
          <div className="font-bold mb-1">Month {hoveredPoint.month} {hoveredPoint.milestone && `— ${hoveredPoint.milestone}`}</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1">
            <span>GDC: {fmtSm(hoveredPoint.gdc)}</span>
            <span>AUM: {fmtSm(hoveredPoint.aum)}</span>
            <span>Affiliate: {fmtSm(hoveredPoint.affiliate)}</span>
            <span>Override: {fmtSm(hoveredPoint.override)}</span>
            <span>Marketing: {fmtSm(hoveredPoint.channel)}</span>
            <span className={hoveredPoint.onTrack ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
              {hoveredPoint.onTrack ? '✓ On Track' : '⚠ Behind'}
            </span>
          </div>
          <div className="mt-1 text-muted-foreground">
            Cumulative: {fmtSm(hoveredPoint.cumulativeIncome)} / {fmtSm(hoveredPoint.cumulativeTarget)}
          </div>
        </div>
      )}

      {/* Milestones timeline */}
      {milestones.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {milestones.map(m => (
            <div key={m.month} className={`flex-shrink-0 px-2 py-1 rounded text-[8px] border ${
              m.onTrack ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-red-500/30 bg-red-500/10 text-red-400'
            }`}>
              <div className="font-bold">{m.milestone}</div>
              <div>M{m.month}: {fmtSm(m.cumulativeIncome)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   UNIFIED P&L SECTION — Roll-up P&L with bracket analysis
   ═══════════════════════════════════════════════════════════════ */
function UnifiedPnLSection({ plan, economics, taxRate, opExPct }: {
  plan: ReturnType<typeof calcUnifiedIncomePlan>;
  economics: ChannelEconomics[];
  taxRate: number;
  opExPct: number;
}) {
  const pnl = useMemo(() => calcUnifiedPnL(plan, economics, taxRate, opExPct), [plan, economics, taxRate, opExPct]);

  const rows: { label: string; value: number; bold?: boolean; indent?: boolean; color?: string; separator?: boolean }[] = [
    { label: 'GDC Production', value: pnl.gdcRevenue, indent: true },
    { label: 'AUM/Advisory', value: pnl.aumRevenue, indent: true },
    { label: 'Affiliate Income', value: pnl.affiliateRevenue, indent: true },
    { label: 'Team Override', value: pnl.overrideRevenue, indent: true },
    { label: 'Marketing Channels', value: pnl.channelRevenue, indent: true },
    { label: 'Total Revenue', value: pnl.totalRevenue, bold: true, color: 'text-blue-400' },
    { label: '', value: 0, separator: true },
    { label: 'Cost of Revenue (COGS)', value: -pnl.totalCOGS, indent: true, color: 'text-red-400' },
    { label: 'Gross Profit', value: pnl.grossProfit, bold: true, color: pnl.grossProfit >= 0 ? 'text-green-400' : 'text-red-400' },
    { label: `Gross Margin`, value: pnl.grossMarginPct, indent: true },
    { label: '', value: 0, separator: true },
    { label: 'Operating Expenses', value: -pnl.opEx, indent: true, color: 'text-red-400' },
    { label: 'EBITDA', value: pnl.ebitda, bold: true, color: pnl.ebitda >= 0 ? 'text-emerald-400' : 'text-red-400' },
    { label: `EBITDA Margin`, value: pnl.ebitdaMarginPct, indent: true },
    { label: '', value: 0, separator: true },
    { label: `Estimated Tax (${Math.round(taxRate * 100)}%)`, value: -pnl.estimatedTax, indent: true, color: 'text-amber-400' },
    { label: 'Net Income', value: pnl.netIncome, bold: true, color: pnl.netIncome >= 0 ? 'text-green-300' : 'text-red-400' },
    { label: `Net Margin`, value: pnl.netMarginPct, indent: true },
  ];

  return (
    <div className="space-y-3">
      {/* P&L Table */}
      <div className="bg-card/50 rounded-lg border border-border/50 overflow-hidden">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="bg-muted/30">
              <th className="text-left px-3 py-1.5 font-medium">Line Item</th>
              <th className="text-right px-3 py-1.5 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => r.separator ? (
              <tr key={i}><td colSpan={2} className="border-t border-border/30 py-0.5" /></tr>
            ) : (
              <tr key={i} className={r.bold ? 'bg-muted/20' : ''}>
                <td className={`px-3 py-1 ${r.indent ? 'pl-6' : ''} ${r.bold ? 'font-bold' : ''} ${r.color || ''}`}>
                  {r.label}
                </td>
                <td className={`text-right px-3 py-1 tabular-nums ${r.bold ? 'font-bold' : ''} ${r.color || ''}`}>
                  {r.label.includes('Margin') ? `${r.value}%` : fmtSm(r.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Channel Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1">
        {pnl.channelBreakdown.map(ch => (
          <div key={ch.channel} className="bg-card/30 rounded p-2 text-center border border-border/30">
            <div className="text-[8px] text-muted-foreground">{ch.channel}</div>
            <div className="text-[11px] font-bold tabular-nums">{fmtSm(ch.revenue)}</div>
            <div className="text-[8px] text-muted-foreground">{ch.marginPct}% margin</div>
            <div className="text-[8px] text-muted-foreground">{ch.pctOfTotal}% of total</div>
          </div>
        ))}
      </div>

      {/* GDC Bracket Analysis */}
      <div className="bg-card/30 rounded-lg border border-border/30 p-3">
        <div className="text-[10px] font-medium mb-1">GDC Bracket Analysis</div>
        <div className="flex items-center gap-4 text-[10px]">
          <div>
            <span className="text-muted-foreground">Current: </span>
            <span className="font-bold text-blue-400">{pnl.currentBracket.l}</span>
            <span className="text-muted-foreground ml-1">({pct(pnl.currentBracket.r)} payout)</span>
          </div>
          {pnl.nextBracket && (
            <>
              <div>
                <span className="text-muted-foreground">Next: </span>
                <span className="font-bold text-emerald-400">{pnl.nextBracket.l}</span>
                <span className="text-muted-foreground ml-1">({pct(pnl.nextBracket.r)} payout)</span>
              </div>
              <div>
                <span className="text-muted-foreground">Gap: </span>
                <span className="font-bold text-amber-400">{fmtSm(pnl.gdcToNextBracket)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Bracket Lift: </span>
                <span className="font-bold text-green-400">+{fmtSm(pnl.bracketLift)}</span>
              </div>
            </>
          )}
        </div>
        {/* Bracket progress bar */}
        {pnl.nextBracket && (
          <div className="mt-2">
            <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, ((pnl.gdcRevenue - pnl.currentBracket.mn) / (pnl.nextBracket.mn - pnl.currentBracket.mn)) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[8px] text-muted-foreground mt-0.5">
              <span>{fmtSm(pnl.currentBracket.mn)}</span>
              <span>{fmtSm(pnl.nextBracket.mn)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ROLL-UP CHART SECTION — Stacked channel revenue over time
   ═══════════════════════════════════════════════════════════════ */
function RollUpChartSection({ points, targetIncome }: {
  // @ts-expect-error — property access on loosely typed object
  points: TimePhasedResult['points'];
  targetIncome: number;
}) {
  const [viewMode, setViewMode] = useState<'monthly' | 'quarterly' | 'annual'>('quarterly');

  const chartData = useMemo(() => calcRollUpChartData(points, targetIncome, viewMode), [points, targetIncome, viewMode]);

  const barData = chartData.labels.map((label, i) => ({
    label,
    GDC: chartData.datasets[0].data[i],
    AUM: chartData.datasets[1].data[i],
    Affiliate: chartData.datasets[2].data[i],
    Override: chartData.datasets[3].data[i],
    Channel: chartData.datasets[4].data[i],
    total: chartData.totals[i],
    target: chartData.targetLine[i],
  }));

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-3">
      {/* View mode toggle */}
      <div className="flex gap-1">
        {(['monthly', 'quarterly', 'annual'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-2 py-0.5 rounded text-[9px] border transition-colors ${
              viewMode === mode
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card/30 border-border/30 text-muted-foreground hover:text-foreground'
            }`}
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>

      {/* Stacked bar chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="label" tick={{ fontSize: 8, fill: '#888' }} />
            <YAxis tick={{ fontSize: 8, fill: '#888' }} tickFormatter={v => `$${Math.round(v / 1000)}K`} />
            <Tooltip
              contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 10 }}
              formatter={(v: number, name: string) => [fmtSm(v), name]}
            />
            <Legend wrapperStyle={{ fontSize: 9 }} />
            <Bar dataKey="GDC" stackId="a" fill={colors[0]} />
            <Bar dataKey="AUM" stackId="a" fill={colors[1]} />
            <Bar dataKey="Affiliate" stackId="a" fill={colors[2]} />
            <Bar dataKey="Override" stackId="a" fill={colors[3]} />
            <Bar dataKey="Channel" stackId="a" fill={colors[4]} />
            <Line type="monotone" dataKey="target" stroke="#ef4444" strokeDasharray="5 5" strokeWidth={2} dot={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-card/30 rounded p-2 text-center border border-border/30">
          <div className="text-[8px] text-muted-foreground">Total Projected</div>
          <div className="text-[11px] font-bold text-blue-400 tabular-nums">{fmtSm(chartData.totals.reduce((s, v) => s + v, 0))}</div>
        </div>
        <div className="bg-card/30 rounded p-2 text-center border border-border/30">
          <div className="text-[8px] text-muted-foreground">Avg {viewMode === 'monthly' ? 'Monthly' : viewMode === 'quarterly' ? 'Quarterly' : 'Annual'}</div>
          <div className="text-[11px] font-bold text-emerald-400 tabular-nums">{fmtSm(Math.round(chartData.totals.reduce((s, v) => s + v, 0) / Math.max(1, chartData.totals.length)))}</div>
        </div>
        <div className="bg-card/30 rounded p-2 text-center border border-border/30">
          <div className="text-[8px] text-muted-foreground">Target</div>
          <div className="text-[11px] font-bold text-amber-400 tabular-nums">{fmtSm(chartData.targetLine.reduce((s, v) => s + v, 0))}</div>
        </div>
        <div className="bg-card/30 rounded p-2 text-center border border-border/30">
          <div className="text-[8px] text-muted-foreground">Variance</div>
          {(() => {
            const totalProj = chartData.totals.reduce((s, v) => s + v, 0);
            const totalTgt = chartData.targetLine.reduce((s, v) => s + v, 0);
            const variance = totalProj - totalTgt;
            return <div className={`text-[11px] font-bold tabular-nums ${variance >= 0 ? 'text-green-400' : 'text-red-400'}`}>{variance >= 0 ? '+' : ''}{fmtSm(variance)}</div>;
          })()}
        </div>
      </div>
    </div>
  );
}
