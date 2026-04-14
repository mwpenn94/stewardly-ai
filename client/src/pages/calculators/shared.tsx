/* Calculator shared types, small components, and panel props */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { sc } from './engine';
import type { Recommendation, CFResult, PRResult, GRResult, RTResult, TXResult, ESResult, EDResult, HorizonData } from './engine';

/* ═══ SMALL REUSABLE COMPONENTS ═══ */
export function FormInput({ id, label, value, onChange, type = 'number', prefix, suffix, min, max, step }: {
  id: string; label: string; value: number | string; onChange: (v: string) => void;
  type?: string; prefix?: string; suffix?: string; min?: number; max?: number; step?: number;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="relative">
        {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60">{prefix}</span>}
        <Input id={id} type={type} value={value} onChange={e => onChange(e.target.value)}
          className={`h-8 text-sm ${prefix ? 'pl-6' : ''} ${suffix ? 'pr-8' : ''}`}
          min={min} max={max} step={step} />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60">{suffix}</span>}
      </div>
    </div>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const s = sc(score);
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${s.color}`}>
      {s.icon} {s.label}
    </span>
  );
}

export function ResultBadge({ label, value, variant }: { label: string; value: string; variant?: string }) {
  const colorMap: Record<string, string> = {
    grn: 'bg-green-500/10 text-green-400 border-green-500/30',
    red: 'bg-red-500/10 text-red-400 border-red-500/30',
    gld: 'bg-primary/10 text-primary border-primary/30',
    blu: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    '': 'bg-background text-foreground/80 border-border',
  };
  const cls = colorMap[variant || ''] || colorMap[''];
  return (
    <div className={`flex flex-col items-center rounded-lg border px-3 py-2 ${cls}`}>
      <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">{label}</span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  );
}

export function KPI({ label, value, variant, sub }: { label: string; value: string; variant?: string; sub?: string }) {
  const colorMap: Record<string, string> = {
    grn: 'bg-green-500/10 text-green-400 border-green-500/30',
    red: 'bg-red-500/10 text-red-400 border-red-500/30',
    gld: 'bg-primary/10 text-primary border-primary/30',
    blu: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    '': 'bg-secondary text-foreground/80 border-border',
  };
  const cls = colorMap[variant || ''] || colorMap[''];
  return (
    <div className={`flex flex-col items-center rounded-lg border px-3 py-2 ${cls}`}>
      <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">{label}</span>
      <span className="text-sm font-bold">{value}</span>
      {sub && <span className="text-[9px] opacity-60 mt-0.5">{sub}</span>}
    </div>
  );
}

export function ScoreGauge({ pct: pctVal, total, max }: { pct: number; total: number; max: number }) {
  const r = 40, stk = 10, circ = Math.PI * 2 * r;
  const dash = circ * pctVal / 100;
  const color = pctVal >= 80 ? '#16A34A' : pctVal >= 60 ? '#CA8A04' : '#DC2626';
  return (
    <div className="flex items-center gap-3">
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={r} fill="none" stroke="oklch(0.22 0.02 255)" strokeWidth={stk} />
        <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth={stk}
          strokeDasharray={`${dash.toFixed(1)} ${(circ - dash).toFixed(1)}`}
          strokeDashoffset="0" transform="rotate(-90 55 55)" strokeLinecap="round"
          style={{ transition: 'stroke-dasharray .5s' }} />
        <text x="55" y="52" textAnchor="middle" fontSize="22" fontWeight="700" fill={color}>{pctVal}%</text>
        <text x="55" y="67" textAnchor="middle" fontSize="8" fill="oklch(0.68 0.014 80)">{total}/{max} points</text>
      </svg>
      <div className="text-sm text-muted-foreground leading-relaxed">
        <b className="text-foreground">{pctVal >= 80 ? 'Strong' : 'Opportunities exist'}</b><br />
        {pctVal >= 80 ? 'All domains well-positioned' : 'Some domains below target'}
      </div>
    </div>
  );
}

/* ═══ INLINE CITATION TOOLTIP ═══ */
/** RefTip — small info icon that shows a citation tooltip on hover.
 *  `refId` maps to a REFERENCE_CATEGORIES id for deep-link, `text` is the tooltip content. */
export function RefTip({ text, refId }: { text: string; refId?: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="inline-flex items-center align-middle ml-0.5 text-muted-foreground/50 hover:text-primary transition-colors" aria-label="Source info">
            <Info className="w-3 h-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
          <p>{text}</p>
          {refId && <p className="mt-1 text-primary/80 text-[10px]">See References → {refId}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ═══ PILLAR SCORE TOOLTIP ═══ */
const PILLAR_EXPLANATIONS: Record<string, string> = {
  'Plan': 'Measures cash flow health, emergency fund adequacy, and debt management. Score 3 = savings rate ≥ 20%, adequate emergency fund.',
  'Protect': 'Evaluates life insurance coverage vs DIME need, disability income, and key-person/buy-sell coverage for business owners.',
  'Grow': 'Assesses retirement savings rate, investment growth trajectory, tax optimization, estate planning, and education funding.',
};

export function PillarTooltip({ pillar }: { pillar: string }) {
  const explanation = PILLAR_EXPLANATIONS[pillar];
  if (!explanation) return null;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="inline-flex items-center align-middle ml-1 text-muted-foreground/40 hover:text-primary transition-colors" aria-label={`${pillar} pillar explanation`}>
            <Info className="w-3 h-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
          <p className="font-semibold mb-1">{pillar} Pillar</p>
          <p>{explanation}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ═══ SHARED PANEL PROPS TYPE ═══ */
export interface PanelProps {
  // Client Profile
  clientName: string; setClientName: (v: string) => void;
  age: number; setAge: (v: number) => void;
  spouseAge: number; setSpouseAge: (v: number) => void;
  dep: number; setDep: (v: number) => void;
  income: number; setIncome: (v: number) => void;
  spouseIncome: number; setSpouseIncome: (v: number) => void;
  nw: number; setNw: (v: number) => void;
  savings: number; setSavings: (v: number) => void;
  retirement401k: number; setRetirement401k: (v: number) => void;
  mortgage: number; setMortgage: (v: number) => void;
  debt: number; setDebt: (v: number) => void;
  existIns: number; setExistIns: (v: number) => void;
  filing: string; setFiling: (v: string) => void;
  stateRate: number; setStateRate: (v: number) => void;
  riskTolerance: string; setRiskTolerance: (v: string) => void;
  isBiz: boolean; setIsBiz: (v: boolean) => void;
  // Business
  bizEntityType: string; setBizEntityType: (v: string) => void;
  bizRevenue: number; setBizRevenue: (v: number) => void;
  bizExpenses: number; setBizExpenses: (v: number) => void;
  bizEmployees: number; setBizEmployees: (v: number) => void;
  bizSeasonality: string; setBizSeasonality: (v: string) => void;
  bizRevenueStreams: number; setBizRevenueStreams: (v: number) => void;
  bizProductMix: string; setBizProductMix: (v: string) => void;
  bizGrowthRate: number; setBizGrowthRate: (v: number) => void;
  bizDebtService: number; setBizDebtService: (v: number) => void;
  bizKeyPerson: boolean; setBizKeyPerson: (v: boolean) => void;
  bizSuccessionPlan: string; setBizSuccessionPlan: (v: string) => void;
  bizBuySell: boolean; setBizBuySell: (v: boolean) => void;
  // Cash Flow
  housing: number; setHousing: (v: number) => void;
  transport: number; setTransport: (v: number) => void;
  food: number; setFood: (v: number) => void;
  insurancePmt: number; setInsurancePmt: (v: number) => void;
  debtPmt: number; setDebtPmt: (v: number) => void;
  otherExp: number; setOtherExp: (v: number) => void;
  emMonths: number; setEmMonths: (v: number) => void;
  // Protection
  replaceYrs: number; setReplaceYrs: (v: number) => void;
  payoffRate: number; setPayoffRate: (v: number) => void;
  eduPerChild: number; setEduPerChild: (v: number) => void;
  finalExp: number; setFinalExp: (v: number) => void;
  ssBenefit: number; setSsBenefit: (v: number) => void;
  diPct: number; setDiPct: (v: number) => void;
  // Growth
  retireAge: number; setRetireAge: (v: number) => void;
  monthlySav: number; setMonthlySav: (v: number) => void;
  infRate: number; setInfRate: (v: number) => void;
  taxReturn: number; setTaxReturn: (v: number) => void;
  iulReturn: number; setIulReturn: (v: number) => void;
  fiaReturn: number; setFiaReturn: (v: number) => void;
  // Retirement
  ss62: number; setSs62: (v: number) => void;
  ss67: number; setSs67: (v: number) => void;
  ss70: number; setSs70: (v: number) => void;
  pension: number; setPension: (v: number) => void;
  withdrawalRate: number; setWithdrawalRate: (v: number) => void;
  // Tax
  hsaContrib: number; setHsaContrib: (v: number) => void;
  charitableGiving: number; setCharitableGiving: (v: number) => void;
  // Estate
  grossEstate: number; setGrossEstate: (v: number) => void;
  exemption: number; setExemption: (v: number) => void;
  estateGrowth: number; setEstateGrowth: (v: number) => void;
  giftingAnnual: number; setGiftingAnnual: (v: number) => void;
  willStatus: string; setWillStatus: (v: string) => void;
  // Education
  numChildren: number; setNumChildren: (v: number) => void;
  avgChildAge: number; setAvgChildAge: (v: number) => void;
  targetCost: number; setTargetCost: (v: number) => void;
  eduReturn: number; setEduReturn: (v: number) => void;
  current529: number; setCurrent529: (v: number) => void;
  monthly529: number; setMonthly529: (v: number) => void;
  // Action Plan
  pace: 'standard' | 'aggressive' | 'gradual'; setPace: (v: 'standard' | 'aggressive' | 'gradual') => void;
  // Computed results
  totalIncome: number;
  scores: Record<string, number>;
  scorecard: { domains: { name: string; score: number; maxScore: number }[]; pillars: { name: string; domains: string[]; score: number; maxScore: number }[]; overall: number; maxScore: number; pctScore: number };
  recommendations: Recommendation[];
  totalAnnualPremium: number;
  cfResult: CFResult;
  prResult: PRResult;
  grResult: GRResult;
  rtResult: RTResult;
  txResult: TXResult;
  esResult: ESResult;
  edResult: EDResult;
  horizonData: HorizonData[];
  // Practice Income Cross-Link
  practiceIncome: {
    annualGDC: number;
    annualAUM: number;
    annualOverride: number;
    annualExpanded: number;
    annualChannelRev: number;
    grandTotal: number;
    streamCount: number;
    items: { name: string; value: number; source: string }[];
    pnlNetIncome: number;
    pnlEbitda: number;
    pnlRevenue: number;
    monthlyGDC: number;
    monthlyNet: number;
  };
}

export type { Recommendation, CFResult, PRResult, GRResult, RTResult, TXResult, ESResult, EDResult, HorizonData };
