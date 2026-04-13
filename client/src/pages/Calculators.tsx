import { useState, useMemo } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import {
  User, DollarSign, Shield, TrendingUp, Clock, Building2, GraduationCap,
  Scale, BarChart3, GitCompare, FileText, ListChecks, BookOpen,
  Calculator, CheckCircle2, XCircle, Zap, Save, FolderOpen, Download, Trash2
} from 'lucide-react';

import {
  RATES, STRATEGIES, CALC_METHODS, DUE_DILIGENCE,
  fmt, fmtSm, pct, sc, getBracketRate,
  computeScorecard, buildRecommendations, buildActionPlan, buildHorizonData,
  calcCashFlow, calcProtection, calcGrowth, calcRetirement, calcTax, calcEstate, calcEducation,
  type Recommendation, type CFResult, type PRResult, type GRResult, type RTResult, type TXResult, type ESResult, type EDResult, type HorizonData,
} from './calculators/engine';

/* ═══ PANEL TYPE DEFINITIONS ═══ */
type PanelId = 'profile' | 'cash' | 'protect' | 'grow' | 'retire' | 'tax' | 'estate' | 'edu' |
  'costben' | 'compare' | 'summary' | 'timeline' | 'refs';

const NAV_SECTIONS: { group: string; items: { id: PanelId; label: string; icon: React.ReactNode }[] }[] = [
  { group: 'Your Profile', items: [
    { id: 'profile', label: 'Client Profile', icon: <User className="w-4 h-4" /> },
  ]},
  { group: 'Planning Domains', items: [
    { id: 'cash', label: 'Cash Flow', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'protect', label: 'Protection', icon: <Shield className="w-4 h-4" /> },
    { id: 'grow', label: 'Growth', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'retire', label: 'Retirement', icon: <Clock className="w-4 h-4" /> },
    { id: 'tax', label: 'Tax Planning', icon: <Building2 className="w-4 h-4" /> },
    { id: 'estate', label: 'Estate', icon: <Scale className="w-4 h-4" /> },
    { id: 'edu', label: 'Education', icon: <GraduationCap className="w-4 h-4" /> },
  ]},
  { group: 'Analysis', items: [
    { id: 'costben', label: 'Cost-Benefit', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'compare', label: 'Strategy Compare', icon: <GitCompare className="w-4 h-4" /> },
    { id: 'summary', label: 'Summary', icon: <FileText className="w-4 h-4" /> },
    { id: 'timeline', label: 'Action Plan', icon: <ListChecks className="w-4 h-4" /> },
  ]},
  { group: 'Resources', items: [
    { id: 'refs', label: 'References', icon: <BookOpen className="w-4 h-4" /> },
  ]},
];

/* ═══ SMALL REUSABLE COMPONENTS ═══ */
function FormInput({ id, label, value, onChange, type = 'number', prefix, suffix, min, max, step }: {
  id: string; label: string; value: number | string; onChange: (v: string) => void;
  type?: string; prefix?: string; suffix?: string; min?: number; max?: number; step?: number;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-medium text-slate-600">{label}</Label>
      <div className="relative">
        {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">{prefix}</span>}
        <Input id={id} type={type} value={value} onChange={e => onChange(e.target.value)}
          className={`h-8 text-sm ${prefix ? 'pl-6' : ''} ${suffix ? 'pr-8' : ''}`}
          min={min} max={max} step={step} />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">{suffix}</span>}
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const s = sc(score);
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${s.color}`}>
      {s.icon} {s.label}
    </span>
  );
}

function ResultBadge({ label, value, variant }: { label: string; value: string; variant?: string }) {
  const colorMap: Record<string, string> = {
    grn: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    gld: 'bg-amber-50 text-amber-700 border-amber-200',
    blu: 'bg-blue-50 text-blue-700 border-blue-200',
    '': 'bg-slate-50 text-slate-700 border-slate-200',
  };
  const cls = colorMap[variant || ''] || colorMap[''];
  return (
    <div className={`flex flex-col items-center rounded-lg border px-3 py-2 ${cls}`}>
      <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">{label}</span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  );
}

function ScoreGauge({ pct: pctVal, total, max }: { pct: number; total: number; max: number }) {
  const r = 40, stk = 10, circ = Math.PI * 2 * r;
  const dash = circ * pctVal / 100;
  const color = pctVal >= 80 ? '#16A34A' : pctVal >= 60 ? '#CA8A04' : '#DC2626';
  return (
    <div className="flex items-center gap-3">
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={r} fill="none" stroke="#E2E8F0" strokeWidth={stk} />
        <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth={stk}
          strokeDasharray={`${dash.toFixed(1)} ${(circ - dash).toFixed(1)}`}
          strokeDashoffset="0" transform="rotate(-90 55 55)" strokeLinecap="round"
          style={{ transition: 'stroke-dasharray .5s' }} />
        <text x="55" y="52" textAnchor="middle" fontSize="22" fontWeight="700" fill={color}>{pctVal}%</text>
        <text x="55" y="67" textAnchor="middle" fontSize="8" fill="#64748B">{total}/{max} points</text>
      </svg>
      <div className="text-sm text-slate-500 leading-relaxed">
        <b className="text-slate-900">{pctVal >= 80 ? 'Strong' : 'Opportunities exist'}</b><br />
        {pctVal >= 80 ? 'All domains well-positioned' : 'Some domains below target'}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function Calculators() {
  const { user } = useAuth();
  const [activePanel, setActivePanel] = useState<PanelId>('profile');

  /* ─── SESSION MANAGEMENT STATE ─── */
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const sessionsQuery = trpc.calcSession.list.useQuery(undefined, { enabled: !!user });
  const saveMut = trpc.calcSession.save.useMutation({
    onSuccess: (res) => {
      setActiveSessionId(res.id);
      sessionsQuery.refetch();
      setShowSaveDialog(false);
      toast.success('Session saved');
    },
    onError: () => toast.error('Failed to save session'),
  });
  const updateMut = trpc.calcSession.update.useMutation({
    onSuccess: () => { sessionsQuery.refetch(); toast.success('Session updated'); },
    onError: () => toast.error('Failed to update session'),
  });
  const deleteMut = trpc.calcSession.delete.useMutation({
    onSuccess: () => { sessionsQuery.refetch(); toast.success('Session deleted'); },
  });
  const getSessionMut = trpc.calcSession.get.useQuery(
    { id: -1 }, { enabled: false }
  );

  /* ─── CLIENT PROFILE INPUTS ─── */
  const [clientName, setClientName] = useState('');
  const [age, setAge] = useState(40);
  const [spouseAge, setSpouseAge] = useState(38);
  const [dep, setDep] = useState(2);
  const [income, setIncome] = useState(150000);
  const [spouseIncome, setSpouseIncome] = useState(0);
  const [nw, setNw] = useState(500000);
  const [savings, setSavings] = useState(200000);
  const [retirement401k, setRetirement401k] = useState(350000);
  const [mortgage, setMortgage] = useState(300000);
  const [debt, setDebt] = useState(25000);
  const [existIns, setExistIns] = useState(250000);
  const [filing, setFiling] = useState('mfj');
  const [stateRate, setStateRate] = useState(0.05);
  const [riskTolerance, setRiskTolerance] = useState('moderate');
  const [isBiz, setIsBiz] = useState(false);

  /* ─── BUSINESS-SPECIFIC INPUTS ─── */
  const [bizEntityType, setBizEntityType] = useState('llc');
  const [bizRevenue, setBizRevenue] = useState(0);
  const [bizExpenses, setBizExpenses] = useState(0);
  const [bizEmployees, setBizEmployees] = useState(0);
  const [bizSeasonality, setBizSeasonality] = useState('even');
  const [bizRevenueStreams, setBizRevenueStreams] = useState(1);
  const [bizProductMix, setBizProductMix] = useState('services');
  const [bizGrowthRate, setBizGrowthRate] = useState(0.10);
  const [bizDebtService, setBizDebtService] = useState(0);
  const [bizKeyPerson, setBizKeyPerson] = useState(false);
  const [bizSuccessionPlan, setBizSuccessionPlan] = useState('none');
  const [bizBuySell, setBizBuySell] = useState(false);

  /* ─── CASH FLOW INPUTS ─── */
  const [housing, setHousing] = useState(2500);
  const [transport, setTransport] = useState(800);
  const [food, setFood] = useState(600);
  const [insurancePmt, setInsurancePmt] = useState(300);
  const [debtPmt, setDebtPmt] = useState(500);
  const [otherExp, setOtherExp] = useState(400);
  const [emMonths, setEmMonths] = useState(6);

  /* ─── PROTECTION INPUTS ─── */
  const [replaceYrs, setReplaceYrs] = useState(10);
  const [payoffRate, setPayoffRate] = useState(0);
  const [eduPerChild, setEduPerChild] = useState(50000);
  const [finalExp, setFinalExp] = useState(25000);
  const [ssBenefit, setSsBenefit] = useState(2500);
  const [diPct, setDiPct] = useState(0.6);

  /* ─── GROWTH INPUTS ─── */
  const [retireAge, setRetireAge] = useState(65);
  const [monthlySav, setMonthlySav] = useState(1500);
  const [infRate, setInfRate] = useState(0.03);
  const [taxReturn, setTaxReturn] = useState(0.07);
  const [iulReturn, setIulReturn] = useState(0.065);
  const [fiaReturn, setFiaReturn] = useState(0.055);

  /* ─── RETIREMENT INPUTS ─── */
  const [ss62, setSs62] = useState(1800);
  const [ss67, setSs67] = useState(2800);
  const [ss70, setSs70] = useState(3500);
  const [pension, setPension] = useState(0);
  const [withdrawalRate, setWithdrawalRate] = useState(0.04);

  /* ─── TAX INPUTS ─── */
  const [hsaContrib, setHsaContrib] = useState(0);
  const [charitableGiving, setCharitableGiving] = useState(0);

  /* ─── ESTATE INPUTS ─── */
  const [grossEstate, setGrossEstate] = useState(2000000);
  const [exemption, setExemption] = useState(13610000);
  const [estateGrowth, setEstateGrowth] = useState(0.05);
  const [giftingAnnual, setGiftingAnnual] = useState(0);
  const [willStatus, setWillStatus] = useState('none');

  /* ─── EDUCATION INPUTS ─── */
  const [numChildren, setNumChildren] = useState(2);
  const [avgChildAge, setAvgChildAge] = useState(8);
  const [targetCost, setTargetCost] = useState(120000);
  const [eduReturn, setEduReturn] = useState(0.06);
  const [current529, setCurrent529] = useState(30000);
  const [monthly529, setMonthly529] = useState(300);

  /* ─── COST-BENEFIT INPUTS ─── */
  const [cbHorizons] = useState<number[]>([5, 10, 15, 20, 30]);

  /* ─── ACTION PLAN INPUTS ─── */
  const [pace, setPace] = useState<'standard'|'aggressive'|'gradual'>('standard');

  /* ─── SESSION HELPERS ─── */
  const gatherInputs = () => ({
    clientName, age, spouseAge, dep, income, spouseIncome, nw, savings, retirement401k,
    mortgage, debt, existIns, filing, stateRate, riskTolerance, isBiz,
    bizEntityType, bizRevenue, bizExpenses, bizEmployees, bizSeasonality,
    bizRevenueStreams, bizProductMix, bizGrowthRate, bizDebtService, bizKeyPerson, bizSuccessionPlan, bizBuySell,
    housing, transport, food, insurancePmt, debtPmt, otherExp, emMonths,
    replaceYrs, payoffRate, eduPerChild, finalExp, ssBenefit, diPct,
    retireAge, monthlySav, infRate, taxReturn, iulReturn, fiaReturn,
    ss62, ss67, ss70, pension, withdrawalRate,
    hsaContrib, charitableGiving,
    grossEstate, exemption, estateGrowth, giftingAnnual, willStatus,
    numChildren, avgChildAge, targetCost, eduReturn, current529, monthly529,
    pace,
  });

  const restoreInputs = (d: Record<string, any>) => {
    if (d.clientName !== undefined) setClientName(d.clientName);
    if (d.age !== undefined) setAge(d.age);
    if (d.spouseAge !== undefined) setSpouseAge(d.spouseAge);
    if (d.dep !== undefined) setDep(d.dep);
    if (d.income !== undefined) setIncome(d.income);
    if (d.spouseIncome !== undefined) setSpouseIncome(d.spouseIncome);
    if (d.nw !== undefined) setNw(d.nw);
    if (d.savings !== undefined) setSavings(d.savings);
    if (d.retirement401k !== undefined) setRetirement401k(d.retirement401k);
    if (d.mortgage !== undefined) setMortgage(d.mortgage);
    if (d.debt !== undefined) setDebt(d.debt);
    if (d.existIns !== undefined) setExistIns(d.existIns);
    if (d.filing !== undefined) setFiling(d.filing);
    if (d.stateRate !== undefined) setStateRate(d.stateRate);
    if (d.riskTolerance !== undefined) setRiskTolerance(d.riskTolerance);
    if (d.isBiz !== undefined) setIsBiz(d.isBiz);
    if (d.bizEntityType !== undefined) setBizEntityType(d.bizEntityType);
    if (d.bizRevenue !== undefined) setBizRevenue(d.bizRevenue);
    if (d.bizExpenses !== undefined) setBizExpenses(d.bizExpenses);
    if (d.bizEmployees !== undefined) setBizEmployees(d.bizEmployees);
    if (d.bizSeasonality !== undefined) setBizSeasonality(d.bizSeasonality);
    if (d.bizRevenueStreams !== undefined) setBizRevenueStreams(d.bizRevenueStreams);
    if (d.bizProductMix !== undefined) setBizProductMix(d.bizProductMix);
    if (d.bizGrowthRate !== undefined) setBizGrowthRate(d.bizGrowthRate);
    if (d.bizDebtService !== undefined) setBizDebtService(d.bizDebtService);
    if (d.bizKeyPerson !== undefined) setBizKeyPerson(d.bizKeyPerson);
    if (d.bizSuccessionPlan !== undefined) setBizSuccessionPlan(d.bizSuccessionPlan);
    if (d.bizBuySell !== undefined) setBizBuySell(d.bizBuySell);
    if (d.housing !== undefined) setHousing(d.housing);
    if (d.transport !== undefined) setTransport(d.transport);
    if (d.food !== undefined) setFood(d.food);
    if (d.insurancePmt !== undefined) setInsurancePmt(d.insurancePmt);
    if (d.debtPmt !== undefined) setDebtPmt(d.debtPmt);
    if (d.otherExp !== undefined) setOtherExp(d.otherExp);
    if (d.emMonths !== undefined) setEmMonths(d.emMonths);
    if (d.replaceYrs !== undefined) setReplaceYrs(d.replaceYrs);
    if (d.payoffRate !== undefined) setPayoffRate(d.payoffRate);
    if (d.eduPerChild !== undefined) setEduPerChild(d.eduPerChild);
    if (d.finalExp !== undefined) setFinalExp(d.finalExp);
    if (d.ssBenefit !== undefined) setSsBenefit(d.ssBenefit);
    if (d.diPct !== undefined) setDiPct(d.diPct);
    if (d.retireAge !== undefined) setRetireAge(d.retireAge);
    if (d.monthlySav !== undefined) setMonthlySav(d.monthlySav);
    if (d.infRate !== undefined) setInfRate(d.infRate);
    if (d.taxReturn !== undefined) setTaxReturn(d.taxReturn);
    if (d.iulReturn !== undefined) setIulReturn(d.iulReturn);
    if (d.fiaReturn !== undefined) setFiaReturn(d.fiaReturn);
    if (d.ss62 !== undefined) setSs62(d.ss62);
    if (d.ss67 !== undefined) setSs67(d.ss67);
    if (d.ss70 !== undefined) setSs70(d.ss70);
    if (d.pension !== undefined) setPension(d.pension);
    if (d.withdrawalRate !== undefined) setWithdrawalRate(d.withdrawalRate);
    if (d.hsaContrib !== undefined) setHsaContrib(d.hsaContrib);
    if (d.charitableGiving !== undefined) setCharitableGiving(d.charitableGiving);
    if (d.grossEstate !== undefined) setGrossEstate(d.grossEstate);
    if (d.exemption !== undefined) setExemption(d.exemption);
    if (d.estateGrowth !== undefined) setEstateGrowth(d.estateGrowth);
    if (d.giftingAnnual !== undefined) setGiftingAnnual(d.giftingAnnual);
    if (d.willStatus !== undefined) setWillStatus(d.willStatus);
    if (d.numChildren !== undefined) setNumChildren(d.numChildren);
    if (d.avgChildAge !== undefined) setAvgChildAge(d.avgChildAge);
    if (d.targetCost !== undefined) setTargetCost(d.targetCost);
    if (d.eduReturn !== undefined) setEduReturn(d.eduReturn);
    if (d.current529 !== undefined) setCurrent529(d.current529);
    if (d.monthly529 !== undefined) setMonthly529(d.monthly529);
    if (d.pace !== undefined) setPace(d.pace);
  };

  const handleSave = () => {
    if (!user) { toast.error('Please sign in to save sessions'); return; }
    const inputs = gatherInputs();
    if (activeSessionId) {
      updateMut.mutate({ id: activeSessionId, inputsJson: inputs, resultsJson: { scorecard, recommendations } });
    } else {
      setSessionName(clientName || `Session ${new Date().toLocaleDateString()}`);
      setShowSaveDialog(true);
    }
  };

  const handleSaveConfirm = () => {
    saveMut.mutate({
      name: sessionName,
      calculatorType: 'business_v7',
      inputsJson: gatherInputs(),
      resultsJson: { scorecard, recommendations },
    });
  };

  const handleLoad = async (id: number) => {
    try {
      const resp = await fetch(`/api/trpc/calcSession.get?input=${encodeURIComponent(JSON.stringify({ id }))}`, {
        credentials: 'include',
      });
      const json = await resp.json();
      const session = json?.result?.data;
      if (session?.inputsJson) {
        restoreInputs(session.inputsJson as Record<string, any>);
        setActiveSessionId(session.id);
        setShowLoadDialog(false);
        toast.success(`Loaded: ${session.name}`);
      }
    } catch { toast.error('Failed to load session'); }
  };

  const handleExportPdf = () => {
    toast.info('Generating PDF report...');
    // Build a printable summary and trigger browser print
    const printContent = `
      <html><head><title>WealthBridge Report - ${clientName || 'Client'}</title>
      <style>body{font-family:system-ui;padding:40px;color:#1e293b}h1{color:#92400e}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border:1px solid #e2e8f0;padding:8px;text-align:left}th{background:#f8fafc;font-size:12px}h2{margin-top:24px;color:#334155}.badge{display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600}</style>
      </head><body>
      <h1>WealthBridge — Unified Wealth Engine Report</h1>
      <p><strong>Client:</strong> ${clientName || 'N/A'} | <strong>Age:</strong> ${age} | <strong>Income:</strong> $${totalIncome.toLocaleString()} | <strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
      <h2>Financial Health Score: ${scorecard.pctScore}% (${scorecard.overall}/${scorecard.maxScore})</h2>
      <table><tr><th>Domain</th><th>Score</th><th>Status</th></tr>
      ${scorecard.domains.map(d => `<tr><td>${d.name}</td><td>${d.score}/3</td><td>${d.score >= 3 ? 'Strong' : d.score >= 2 ? 'Moderate' : 'Needs Attention'}</td></tr>`).join('')}
      </table>
      <h2>Recommended Products</h2>
      <table><tr><th>Product</th><th>Coverage</th><th>Annual</th><th>Carrier</th><th>Priority</th></tr>
      ${recommendations.map(r => `<tr><td>${r.product}</td><td>${r.coverage}</td><td>${fmt(r.premium)}</td><td>${r.carrier}</td><td>${r.priority}</td></tr>`).join('')}
      <tr style="font-weight:bold;background:#f8fafc"><td>TOTAL</td><td>${recommendations.length} products</td><td>${fmt(totalAnnualPremium)}</td><td colspan="2">${pct(totalIncome > 0 ? totalAnnualPremium / totalIncome : 0)} of income</td></tr>
      </table>
      <h2>Key Metrics</h2>
      <table>
      <tr><td>Monthly Cash Flow Surplus</td><td>${fmt(cfResult.surplus)}/mo</td></tr>
      <tr><td>Protection Gap</td><td>${fmtSm(prResult.gap)}</td></tr>
      <tr><td>Years to Retirement</td><td>${grResult.yrs}</td></tr>
      <tr><td>Optimal SS Claiming Age</td><td>${rtResult.bestAge}</td></tr>
      <tr><td>Effective Tax Rate</td><td>${pct(txResult.effectiveRate)}</td></tr>
      <tr><td>Estate Tax Exposure</td><td>${fmtSm(esResult.estateTax)}</td></tr>
      <tr><td>Education Funding Gap</td><td>${fmtSm(edResult.totalGap)}</td></tr>
      </table>
      <p style="margin-top:32px;font-size:11px;color:#94a3b8">Generated by WealthBridge Unified Wealth Engine v7 — ${new Date().toISOString()}</p>
      </body></html>
    `;
    const w = window.open('', '_blank');
    if (w) { w.document.write(printContent); w.document.close(); w.print(); }
  };

  /* ═══ COMPUTED RESULTS ═══ */
  const totalIncome = income + spouseIncome;
  const grossMonthly = Math.round(totalIncome / 12);
  const taxRate = useMemo(() => getBracketRate(totalIncome, filing === 'mfj' ? RATES.bracketsMFJ : RATES.bracketsSingle) + stateRate, [totalIncome, filing, stateRate]);

  const scores = useMemo(() => {
    const s: Record<string, number> = {};
    const sr = totalIncome > 0 ? (grossMonthly - housing - transport - food - insurancePmt - debtPmt - otherExp) / grossMonthly : 0;
    s.cash = sr >= 0.2 ? 3 : sr >= 0.1 ? 2 : sr > 0 ? 1 : 0;
    const dimeNeed = dep > 0 ? income * 10 + mortgage + debt + dep * 50000 + 25000 : income * 6 + debt;
    s.protect = existIns >= dimeNeed ? 3 : existIns >= dimeNeed * 0.5 ? 2 : existIns > 0 ? 1 : 0;
    s.growth = monthlySav >= grossMonthly * 0.15 ? 3 : monthlySav >= grossMonthly * 0.1 ? 2 : monthlySav > 0 ? 1 : 0;
    s.retire = retirement401k >= totalIncome * 3 ? 3 : retirement401k >= totalIncome ? 2 : retirement401k > 0 ? 1 : 0;
    s.tax = retirement401k >= 23500 && hsaContrib > 0 ? 3 : retirement401k >= 10000 ? 2 : 1;
    s.estate = willStatus === 'trust' ? 3 : willStatus === 'will' ? 2 : 1;
    s.edu = dep === 0 ? 3 : current529 >= targetCost * dep * 0.5 ? 3 : current529 > 0 ? 2 : 1;
    return s;
  }, [totalIncome, grossMonthly, housing, transport, food, insurancePmt, debtPmt, otherExp,
    dep, income, mortgage, debt, existIns, monthlySav, retirement401k, hsaContrib, willStatus, current529, targetCost]);

  const scorecard = useMemo(() => computeScorecard(scores), [scores]);
  const recommendations = useMemo(() => buildRecommendations(age, totalIncome, dep, nw, existIns, mortgage, debt, isBiz, scores), [age, totalIncome, dep, nw, existIns, mortgage, debt, isBiz, scores]);
  const totalAnnualPremium = recommendations.reduce((a, r) => a + r.premium, 0);

  const cfResult = useMemo(() => calcCashFlow(grossMonthly, taxRate, housing, transport, food, insurancePmt, debtPmt, otherExp, emMonths, savings), [grossMonthly, taxRate, housing, transport, food, insurancePmt, debtPmt, otherExp, emMonths, savings]);
  const prResult = useMemo(() => calcProtection(totalIncome, dep, mortgage, debt, existIns, age, replaceYrs, payoffRate, eduPerChild, finalExp, ssBenefit, diPct), [totalIncome, dep, mortgage, debt, existIns, age, replaceYrs, payoffRate, eduPerChild, finalExp, ssBenefit, diPct]);
  const grResult = useMemo(() => calcGrowth(age, retireAge, monthlySav, savings, infRate, taxReturn, iulReturn, fiaReturn), [age, retireAge, monthlySav, savings, infRate, taxReturn, iulReturn, fiaReturn]);
  const rtResult = useMemo(() => calcRetirement(age, retireAge, ss62, ss67, ss70, pension, withdrawalRate, savings, monthlySav), [age, retireAge, ss62, ss67, ss70, pension, withdrawalRate, savings, monthlySav]);
  const txResult = useMemo(() => calcTax(totalIncome, stateRate, isBiz, filing, retirement401k, hsaContrib, charitableGiving), [totalIncome, stateRate, isBiz, filing, retirement401k, hsaContrib, charitableGiving]);
  const esResult = useMemo(() => calcEstate(grossEstate, exemption, estateGrowth, giftingAnnual, willStatus), [grossEstate, exemption, estateGrowth, giftingAnnual, willStatus]);
  const edResult = useMemo(() => calcEducation(numChildren, avgChildAge, targetCost, infRate, eduReturn, current529, monthly529), [numChildren, avgChildAge, targetCost, infRate, eduReturn, current529, monthly529]);
  const horizonData = useMemo(() => buildHorizonData(recommendations, age, totalIncome, cbHorizons), [recommendations, age, totalIncome, cbHorizons]);

  /* ═══ RENDER ═══ */
  return (
    <div className="flex h-[calc(100vh-56px)] bg-slate-50">
      {/* ─── SIDEBAR ─── */}
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-amber-600" />
            <span className="text-sm font-bold text-slate-900">WealthBridge</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Unified Wealth Engine v7</p>
        </div>
        <ScrollArea className="flex-1">
          <nav className="p-2 space-y-3">
            {NAV_SECTIONS.map(section => (
              <div key={section.group}>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1">{section.group}</p>
                {section.items.map(item => (
                  <button key={item.id} onClick={() => setActivePanel(item.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      activePanel === item.id
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                    }`}>
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </ScrollArea>
        <div className="p-3 border-t border-slate-100 bg-slate-50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Health Score</span>
            <span className={`font-bold ${scorecard.pctScore >= 80 ? 'text-green-600' : scorecard.pctScore >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
              {scorecard.pctScore}%
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${scorecard.pctScore >= 80 ? 'bg-green-500' : scorecard.pctScore >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${scorecard.pctScore}%` }} />
          </div>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ─── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6">

          {/* ─── TOOLBAR ─── */}
          <div className="flex items-center justify-between mb-4 bg-white rounded-lg border border-slate-200 px-4 py-2">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              {activeSessionId ? (
                <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Session saved</span>
              ) : (
                <span className="text-slate-400">Unsaved session</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleSave} disabled={saveMut.isPending || updateMut.isPending}
                className="text-xs gap-1.5">
                <Save className="w-3.5 h-3.5" /> {activeSessionId ? 'Update' : 'Save'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => { if (!user) { toast.error('Please sign in to load sessions'); return; } setShowLoadDialog(true); }}
                className="text-xs gap-1.5">
                <FolderOpen className="w-3.5 h-3.5" /> Load
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPdf}
                className="text-xs gap-1.5">
                <Download className="w-3.5 h-3.5" /> Export PDF
              </Button>
            </div>
          </div>

          {/* ═══ PANEL 1: CLIENT PROFILE ═══ */}
          {activePanel === 'profile' && (
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                <User className="w-5 h-5 text-amber-600" /> Client Profile
              </h2>
              <p className="text-sm text-slate-500 mb-4">Enter client information. All fields auto-calculate across every panel.</p>

              <Card className="mb-4">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <FormInput id="name" label="Client Name" value={clientName} onChange={setClientName} type="text" />
                    <FormInput id="age" label="Age" value={age} onChange={v => setAge(+v)} min={18} max={85} />
                    <FormInput id="spouseAge" label="Spouse Age" value={spouseAge} onChange={v => setSpouseAge(+v)} min={0} max={85} />
                    <FormInput id="dep" label="Dependents" value={dep} onChange={v => setDep(+v)} min={0} max={10} />
                    <FormInput id="income" label="Annual Income" value={income} onChange={v => setIncome(+v)} prefix="$" />
                    <FormInput id="spouseIncome" label="Spouse Income" value={spouseIncome} onChange={v => setSpouseIncome(+v)} prefix="$" />
                    <FormInput id="nw" label="Net Worth" value={nw} onChange={v => setNw(+v)} prefix="$" />
                    <FormInput id="savings" label="Liquid Savings" value={savings} onChange={v => setSavings(+v)} prefix="$" />
                    <FormInput id="retirement401k" label="401(k)/IRA Balance" value={retirement401k} onChange={v => setRetirement401k(+v)} prefix="$" />
                    <FormInput id="mortgage" label="Mortgage Balance" value={mortgage} onChange={v => setMortgage(+v)} prefix="$" />
                    <FormInput id="debt" label="Other Debt" value={debt} onChange={v => setDebt(+v)} prefix="$" />
                    <FormInput id="existIns" label="Existing Life Insurance" value={existIns} onChange={v => setExistIns(+v)} prefix="$" />
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-slate-600">Filing Status</Label>
                      <Select value={filing} onValueChange={setFiling}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mfj">Married Filing Jointly</SelectItem>
                          <SelectItem value="single">Single</SelectItem>
                          <SelectItem value="hoh">Head of Household</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <FormInput id="stateRate" label="State Tax Rate" value={(stateRate * 100).toFixed(1)} onChange={v => setStateRate(+v / 100)} suffix="%" />
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-slate-600">Risk Tolerance</Label>
                      <Select value={riskTolerance} onValueChange={setRiskTolerance}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="conservative">Conservative</SelectItem>
                          <SelectItem value="moderate">Moderate</SelectItem>
                          <SelectItem value="aggressive">Aggressive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-xs">
                        <input type="checkbox" checked={isBiz} onChange={e => setIsBiz(e.target.checked)} className="rounded" />
                        Business Owner
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Business-Specific Inputs (conditionally shown) */}
              {isBiz && (
                <Card className="mb-4 border-amber-200 bg-amber-50/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-amber-600" /> Business Profile
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-slate-600">Entity Type</Label>
                        <Select value={bizEntityType} onValueChange={setBizEntityType}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sole">Sole Proprietorship</SelectItem>
                            <SelectItem value="llc">LLC</SelectItem>
                            <SelectItem value="scorp">S-Corp</SelectItem>
                            <SelectItem value="ccorp">C-Corp</SelectItem>
                            <SelectItem value="partnership">Partnership</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <FormInput id="bizRevenue" label="Annual Revenue" value={bizRevenue} onChange={v => setBizRevenue(+v)} prefix="$" />
                      <FormInput id="bizExpenses" label="Annual Expenses" value={bizExpenses} onChange={v => setBizExpenses(+v)} prefix="$" />
                      <FormInput id="bizEmployees" label="Employees" value={bizEmployees} onChange={v => setBizEmployees(+v)} min={0} />
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-slate-600">Seasonality</Label>
                        <Select value={bizSeasonality} onValueChange={setBizSeasonality}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="even">Even Year-Round</SelectItem>
                            <SelectItem value="q1heavy">Q1 Heavy</SelectItem>
                            <SelectItem value="q4heavy">Q4 Heavy</SelectItem>
                            <SelectItem value="summer">Summer Peak</SelectItem>
                            <SelectItem value="cyclical">Cyclical</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <FormInput id="bizStreams" label="Revenue Streams" value={bizRevenueStreams} onChange={v => setBizRevenueStreams(+v)} min={1} max={20} />
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-slate-600">Product Mix</Label>
                        <Select value={bizProductMix} onValueChange={setBizProductMix}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="services">Services Only</SelectItem>
                            <SelectItem value="products">Products Only</SelectItem>
                            <SelectItem value="mixed">Mixed</SelectItem>
                            <SelectItem value="saas">SaaS / Recurring</SelectItem>
                            <SelectItem value="retail">Retail</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <FormInput id="bizGrowth" label="Growth Rate" value={(bizGrowthRate * 100).toFixed(0)} onChange={v => setBizGrowthRate(+v / 100)} suffix="%" />
                      <FormInput id="bizDebt" label="Business Debt Service" value={bizDebtService} onChange={v => setBizDebtService(+v)} prefix="$" suffix="/yr" />
                      <div className="flex items-end">
                        <label className="flex items-center gap-2 text-xs">
                          <input type="checkbox" checked={bizKeyPerson} onChange={e => setBizKeyPerson(e.target.checked)} className="rounded" />
                          Key Person Dependency
                        </label>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-slate-600">Succession Plan</Label>
                        <Select value={bizSuccessionPlan} onValueChange={setBizSuccessionPlan}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="family">Family Transfer</SelectItem>
                            <SelectItem value="partner">Partner Buyout</SelectItem>
                            <SelectItem value="esop">ESOP</SelectItem>
                            <SelectItem value="sale">Third-Party Sale</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end">
                        <label className="flex items-center gap-2 text-xs">
                          <input type="checkbox" checked={bizBuySell} onChange={e => setBizBuySell(e.target.checked)} className="rounded" />
                          Buy-Sell Agreement
                        </label>
                      </div>
                    </div>
                    {/* Business Summary Metrics */}
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                      <KPI label="Net Profit" value={fmt(bizRevenue - bizExpenses)} variant={bizRevenue > bizExpenses ? 'grn' : 'red'} />
                      <KPI label="Profit Margin" value={bizRevenue > 0 ? pct((bizRevenue - bizExpenses) / bizRevenue) : '0%'} variant={bizRevenue > 0 && (bizRevenue - bizExpenses) / bizRevenue >= 0.15 ? 'grn' : 'gld'} />
                      <KPI label="Rev/Employee" value={bizEmployees > 0 ? fmtSm(bizRevenue / bizEmployees) : 'N/A'} variant="blu" />
                      <KPI label="Biz Risk" value={bizKeyPerson && !bizBuySell ? 'High' : bizKeyPerson ? 'Medium' : 'Low'} variant={bizKeyPerson && !bizBuySell ? 'red' : bizKeyPerson ? 'gld' : 'grn'} />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Financial Health Scorecard */}
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Financial Health Scorecard</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-col md:flex-row gap-6">
                    <ScoreGauge pct={scorecard.pctScore} total={scorecard.overall} max={scorecard.maxScore} />
                    <div className="flex-1">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left py-1 text-xs font-semibold text-slate-500">Domain</th>
                            <th className="text-center py-1 text-xs font-semibold text-slate-500">Score</th>
                            <th className="text-left py-1 text-xs font-semibold text-slate-500">Status</th>
                            <th className="text-left py-1 text-xs font-semibold text-slate-500">Key Metric</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scorecard.domains.map(d => {
                            const keyMetrics: Record<string, string> = {
                              'Cash Flow': `Save rate ${pct(cfResult.saveRate)}`,
                              'Protection': `Gap ${fmtSm(prResult.gap)}`,
                              'Growth': `${grResult.yrs}yr to retire`,
                              'Retirement': `SS best at ${rtResult.bestAge}`,
                              'Tax': `Eff rate ${pct(txResult.effectiveRate)}`,
                              'Estate': `Tax ${fmtSm(esResult.estateTax)}`,
                              'Education': `Gap ${fmtSm(edResult.totalGap)}`,
                            };
                            return (
                              <tr key={d.name} className="border-b border-slate-100">
                                <td className="py-1.5 font-medium text-slate-700">{d.name}</td>
                                <td className="text-center">
                                  <span className="inline-flex gap-0.5">
                                    {[1,2,3].map(i => (
                                      <span key={i} className={`w-2 h-2 rounded-full ${i <= d.score ? 'bg-green-500' : 'bg-slate-200'}`} />
                                    ))}
                                  </span>
                                </td>
                                <td><ScoreBadge score={d.score} /></td>
                                <td className="text-xs text-slate-500">{keyMetrics[d.name] || '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {scorecard.pillars.map(p => (
                      <div key={p.name} className="bg-slate-50 rounded-lg p-3 text-center">
                        <div className="text-xs font-semibold text-slate-500 uppercase">{p.name}</div>
                        <div className="mt-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                          <div className={`h-full rounded-full ${p.score / p.maxScore >= 0.8 ? 'bg-green-500' : p.score / p.maxScore >= 0.5 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${(p.score / p.maxScore * 100).toFixed(0)}%` }} />
                        </div>
                        <div className="text-xs mt-1 text-slate-600">{p.score}/{p.maxScore} — {p.domains.join(', ')}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recommended Products */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Recommended Products</CardTitle></CardHeader>
                <CardContent>
                  {recommendations.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">No recommendations — all domains scoring well.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Product</th>
                            <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Coverage</th>
                            <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Annual</th>
                            <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Monthly</th>
                            <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Carrier</th>
                            <th className="text-center py-2 px-2 text-xs font-semibold text-slate-500">Priority</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recommendations.map((r, i) => (
                            <tr key={i} className="border-b border-slate-100">
                              <td className="py-1.5 px-2 font-medium text-slate-700">{r.product}</td>
                              <td className="text-right px-2 text-slate-600">{r.coverage}</td>
                              <td className="text-right px-2 font-medium">{fmt(r.premium)}</td>
                              <td className="text-right px-2 text-slate-600">{fmt(r.monthly)}</td>
                              <td className="px-2 text-slate-500">{r.carrier}</td>
                              <td className="text-center px-2">
                                <Badge variant={r.priority === 'High' ? 'destructive' : r.priority === 'Medium' ? 'default' : 'secondary'}
                                  className="text-[10px]">{r.priority}</Badge>
                              </td>
                            </tr>
                          ))}
                          <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                            <td className="py-2 px-2">TOTAL</td>
                            <td className="text-right px-2">{recommendations.length} products</td>
                            <td className="text-right px-2">{fmt(totalAnnualPremium)}</td>
                            <td className="text-right px-2">{fmt(Math.round(totalAnnualPremium / 12))}</td>
                            <td colSpan={2} className="px-2 text-xs text-slate-500">
                              {pct(totalIncome > 0 ? totalAnnualPremium / totalIncome : 0)} of income
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          )}

          {/* ═══ PANEL 2: CASH FLOW ═══ */}
          {activePanel === 'cash' && (
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-600" /> Monthly Cash Flow
              </h2>
              <p className="text-sm text-slate-500 mb-4">Budget analysis with emergency fund tracking. Sources: BLS Consumer Expenditure Survey 2024.</p>
              <Card className="mb-4">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <FormInput id="housing" label="Housing" value={housing} onChange={v => setHousing(+v)} prefix="$" suffix="/mo" />
                    <FormInput id="transport" label="Transport" value={transport} onChange={v => setTransport(+v)} prefix="$" suffix="/mo" />
                    <FormInput id="food" label="Food" value={food} onChange={v => setFood(+v)} prefix="$" suffix="/mo" />
                    <FormInput id="insurancePmt" label="Insurance" value={insurancePmt} onChange={v => setInsurancePmt(+v)} prefix="$" suffix="/mo" />
                    <FormInput id="debtPmt" label="Debt Payments" value={debtPmt} onChange={v => setDebtPmt(+v)} prefix="$" suffix="/mo" />
                    <FormInput id="otherExp" label="Other" value={otherExp} onChange={v => setOtherExp(+v)} prefix="$" suffix="/mo" />
                    <FormInput id="emMonths" label="Emergency Fund Target (months)" value={emMonths} onChange={v => setEmMonths(+v)} min={3} max={12} />
                  </div>
                </CardContent>
              </Card>
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Budget Breakdown</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Item</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Monthly</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">% Gross</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-100 bg-green-50">
                        <td className="py-1.5 px-2 font-medium text-green-700">Gross Income</td>
                        <td className="text-right px-2 font-bold text-green-700">{fmt(cfResult.gross)}</td>
                        <td className="text-right px-2 text-green-600">100%</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 px-2 text-slate-600">− Taxes ({pct(cfResult.taxRate)})</td>
                        <td className="text-right px-2 text-red-600">−{fmt(cfResult.gross - cfResult.net)}</td>
                        <td className="text-right px-2 text-slate-500">{pct(cfResult.taxRate)}</td>
                      </tr>
                      <tr className="border-b border-slate-200 bg-blue-50">
                        <td className="py-1.5 px-2 font-medium text-blue-700">Net Income</td>
                        <td className="text-right px-2 font-bold text-blue-700">{fmt(cfResult.net)}</td>
                        <td className="text-right px-2 text-blue-600">{pct(1 - cfResult.taxRate)}</td>
                      </tr>
                      {cfResult.expenses.map(e => (
                        <tr key={e.label} className="border-b border-slate-100">
                          <td className="py-1.5 px-2 text-slate-600">− {e.label}</td>
                          <td className="text-right px-2 text-slate-700">{fmt(e.amount)}</td>
                          <td className="text-right px-2 text-slate-500">{cfResult.gross > 0 ? pct(e.amount / cfResult.gross) : '—'}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                        <td className="py-2 px-2">Monthly Surplus</td>
                        <td className={`text-right px-2 ${cfResult.surplus >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(cfResult.surplus)}</td>
                        <td className="text-right px-2 text-slate-600">{cfResult.gross > 0 ? pct(cfResult.surplus / cfResult.gross) : '—'}</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <ResultBadge label="Save Rate" value={pct(cfResult.saveRate)} variant={cfResult.saveRate >= 0.2 ? 'grn' : cfResult.saveRate >= 0.1 ? 'gld' : 'red'} />
                <ResultBadge label="DTI Ratio" value={pct(cfResult.dti)} variant={cfResult.dti <= 0.36 ? 'grn' : cfResult.dti <= 0.43 ? 'gld' : 'red'} />
                <ResultBadge label="Emergency Target" value={fmt(cfResult.emTarget)} variant="blu" />
                <ResultBadge label="Emergency Gap" value={fmt(cfResult.emGap)} variant={cfResult.emGap === 0 ? 'grn' : 'red'} />
              </div>
            </section>
          )}

          {/* ═══ PANEL 3: PROTECTION ═══ */}
          {activePanel === 'protect' && (
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-600" /> Protection Analysis
              </h2>
              <p className="text-sm text-slate-500 mb-4">DIME method life insurance needs + DI + LTC. Sources: LIMRA 2024, SOA mortality tables.</p>
              <Card className="mb-4">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <FormInput id="replaceYrs" label="Income Replace Years" value={replaceYrs} onChange={v => setReplaceYrs(+v)} min={5} max={30} />
                    <FormInput id="payoffRate" label="Payoff Rate" value={(payoffRate * 100).toFixed(0)} onChange={v => setPayoffRate(+v / 100)} suffix="%" />
                    <FormInput id="eduPerChild" label="Education/Child" value={eduPerChild} onChange={v => setEduPerChild(+v)} prefix="$" />
                    <FormInput id="finalExp" label="Final Expenses" value={finalExp} onChange={v => setFinalExp(+v)} prefix="$" />
                    <FormInput id="ssBenefit" label="SS Survivor Benefit" value={ssBenefit} onChange={v => setSsBenefit(+v)} prefix="$" suffix="/mo" />
                    <FormInput id="diPct" label="DI Benefit %" value={(diPct * 100).toFixed(0)} onChange={v => setDiPct(+v / 100)} suffix="%" />
                  </div>
                </CardContent>
              </Card>
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">DIME Analysis</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Component</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prResult.components.map(c => (
                        <tr key={c.label} className="border-b border-slate-100">
                          <td className="py-1.5 px-2 text-slate-600">{c.label}</td>
                          <td className="text-right px-2 font-medium">{fmtSm(c.amount)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-slate-300 bg-amber-50 font-bold">
                        <td className="py-2 px-2 text-amber-800">Total DIME Need</td>
                        <td className="text-right px-2 text-amber-800">{fmtSm(prResult.dimeNeed)}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 px-2 text-green-600">− Existing Coverage</td>
                        <td className="text-right px-2 text-green-600">−{fmtSm(prResult.existingCoverage)}</td>
                      </tr>
                      <tr className="bg-red-50 font-bold">
                        <td className="py-2 px-2 text-red-700">Coverage Gap</td>
                        <td className="text-right px-2 text-red-700">{fmtSm(prResult.gap)}</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Recommended Coverage</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Need</th>
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Product</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Coverage</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Annual</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Monthly</th>
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Carrier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prResult.products.map((p, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="py-1.5 px-2 text-slate-600">{p.need}</td>
                          <td className="px-2 font-medium text-slate-700">{p.product}</td>
                          <td className="text-right px-2">{fmtSm(p.coverage)}</td>
                          <td className="text-right px-2 font-medium">{fmt(p.premium)}</td>
                          <td className="text-right px-2 text-slate-600">{fmt(p.monthly)}</td>
                          <td className="px-2 text-slate-500">{p.carrier}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                        <td colSpan={3} className="py-2 px-2">TOTAL</td>
                        <td className="text-right px-2">{fmt(prResult.totalPremium)}</td>
                        <td className="text-right px-2">{fmt(Math.round(prResult.totalPremium / 12))}</td>
                        <td className="px-2 text-xs text-slate-500">{pct(totalIncome > 0 ? prResult.totalPremium / totalIncome : 0)} of income</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <ResultBadge label="DIME Need" value={fmtSm(prResult.dimeNeed)} variant="gld" />
                <ResultBadge label="Coverage Gap" value={fmtSm(prResult.gap)} variant={prResult.gap === 0 ? 'grn' : 'red'} />
                <ResultBadge label="DI Benefit" value={fmt(prResult.diNeed) + '/yr'} variant="blu" />
                <ResultBadge label="Total Premium" value={fmt(prResult.totalPremium) + '/yr'} variant="gld" />
              </div>
            </section>
          )}

          {/* ═══ PANEL 4: GROWTH ═══ */}
          {activePanel === 'grow' && (
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-600" /> Growth & Accumulation
              </h2>
              <p className="text-sm text-slate-500 mb-4">Multi-vehicle comparison: Taxable vs 401(k) vs Roth vs IUL vs FIA. Sources: Morningstar, Vanguard 2024.</p>
              <Card className="mb-4">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <FormInput id="retireAge" label="Target Retire Age" value={retireAge} onChange={v => setRetireAge(+v)} min={50} max={80} />
                    <FormInput id="monthlySav" label="Monthly Savings" value={monthlySav} onChange={v => setMonthlySav(+v)} prefix="$" />
                    <FormInput id="taxReturn" label="Taxable/401k Return" value={(taxReturn * 100).toFixed(1)} onChange={v => setTaxReturn(+v / 100)} suffix="%" />
                    <FormInput id="iulReturn" label="IUL Net Return" value={(iulReturn * 100).toFixed(1)} onChange={v => setIulReturn(+v / 100)} suffix="%" />
                    <FormInput id="fiaReturn" label="FIA Return" value={(fiaReturn * 100).toFixed(1)} onChange={v => setFiaReturn(+v / 100)} suffix="%" />
                    <FormInput id="infRate" label="Inflation Rate" value={(infRate * 100).toFixed(1)} onChange={v => setInfRate(+v / 100)} suffix="%" />
                  </div>
                </CardContent>
              </Card>
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Vehicle Comparison ({grResult.yrs} years to retirement)</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Vehicle</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Projected Value</th>
                        <th className="text-center py-2 px-2 text-xs font-semibold text-slate-500">Tax-Free?</th>
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grResult.vehicles.map(v => (
                        <tr key={v.name} className="border-b border-slate-100">
                          <td className="py-1.5 px-2 font-medium text-slate-700">{v.name}</td>
                          <td className="text-right px-2 font-bold">{fmtSm(v.value)}</td>
                          <td className="text-center px-2">
                            {v.taxFree ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-slate-300 mx-auto" />}
                          </td>
                          <td className="px-2 text-xs text-slate-500">{v.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Tax-Free Edge Analysis</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">
                    By using Roth + IUL instead of taxable + traditional 401(k), the projected tax-free advantage over {grResult.yrs} years is:
                  </p>
                  <div className="mt-2 text-2xl font-bold text-green-700">{fmtSm(grResult.taxEdge)}</div>
                  <p className="text-xs text-slate-500 mt-1">This represents the additional after-tax wealth from tax-free growth vehicles (IRC §7702, §408A).</p>
                </CardContent>
              </Card>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <ResultBadge label="Years to Retire" value={String(grResult.yrs)} variant="blu" />
                <ResultBadge label="Best Vehicle" value="Roth/IUL" variant="grn" />
                <ResultBadge label="Tax-Free Edge" value={fmtSm(grResult.taxEdge)} variant="grn" />
                <ResultBadge label="Monthly Saving" value={fmt(monthlySav)} variant="gld" />
              </div>
            </section>
          )}

          {/* ═══ PANEL 5: RETIREMENT ═══ */}
          {activePanel === 'retire' && (
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" /> Retirement Readiness
              </h2>
              <p className="text-sm text-slate-500 mb-4">Social Security claiming comparison + portfolio withdrawal analysis. Sources: SSA 2024, Trinity Study, Bengen Rule.</p>
              <Card className="mb-4">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <FormInput id="ss62" label="SS at 62 (monthly)" value={ss62} onChange={v => setSs62(+v)} prefix="$" />
                    <FormInput id="ss67" label="SS at 67 (monthly)" value={ss67} onChange={v => setSs67(+v)} prefix="$" />
                    <FormInput id="ss70" label="SS at 70 (monthly)" value={ss70} onChange={v => setSs70(+v)} prefix="$" />
                    <FormInput id="pension" label="Pension (monthly)" value={pension} onChange={v => setPension(+v)} prefix="$" />
                    <FormInput id="withdrawalRate" label="Withdrawal Rate" value={(withdrawalRate * 100).toFixed(1)} onChange={v => setWithdrawalRate(+v / 100)} suffix="%" />
                  </div>
                </CardContent>
              </Card>
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Social Security Claiming Comparison</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Claim Age</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Monthly</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Annual</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Cum. at 80</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Cum. at 85</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Cum. at 90</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rtResult.ssComparison.map(s => (
                        <tr key={s.age} className={`border-b border-slate-100 ${s.age === rtResult.bestAge ? 'bg-green-50' : ''}`}>
                          <td className="py-1.5 px-2 font-medium text-slate-700">
                            Age {s.age} {s.age === rtResult.bestAge && <Badge className="ml-1 text-[10px]" variant="default">Best</Badge>}
                          </td>
                          <td className="text-right px-2">{fmt(s.monthly)}</td>
                          <td className="text-right px-2">{fmt(s.annual)}</td>
                          <td className="text-right px-2">{fmtSm(s.cumAt80)}</td>
                          <td className="text-right px-2 font-medium">{fmtSm(s.cumAt85)}</td>
                          <td className="text-right px-2">{fmtSm(s.cumAt90)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-xs text-slate-500 mt-2">
                    <strong>Optimal claiming age: {rtResult.bestAge}</strong> — maximizes cumulative benefits to age 85.
                    Delaying from 62 to 70 increases monthly benefit by ~77%.
                  </p>
                </CardContent>
              </Card>
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Portfolio Withdrawal Analysis</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 text-slate-600">Portfolio at Retirement</td>
                        <td className="text-right font-bold">{fmtSm(rtResult.portfolioAtRetire)}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 text-slate-600">Annual Withdrawal ({pct(withdrawalRate)})</td>
                        <td className="text-right font-medium">{fmt(rtResult.withdrawal)}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 text-slate-600">Monthly Retirement Income</td>
                        <td className="text-right font-bold text-green-700">{fmt(rtResult.monthlyIncome)}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 text-slate-600">RMD at 72 (estimated)</td>
                        <td className="text-right">{fmt(rtResult.rmd72)}</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <ResultBadge label="Best SS Age" value={String(rtResult.bestAge)} variant="grn" />
                <ResultBadge label="Portfolio" value={fmtSm(rtResult.portfolioAtRetire)} variant="blu" />
                <ResultBadge label="Monthly Income" value={fmt(rtResult.monthlyIncome)} variant="grn" />
                <ResultBadge label="RMD at 72" value={fmt(rtResult.rmd72)} variant="gld" />
              </div>
            </section>
          )}

          {/* ═══ PANEL 6: TAX PLANNING ═══ */}
          {activePanel === 'tax' && (
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-600" /> Tax Optimization
              </h2>
              <p className="text-sm text-slate-500 mb-4">Marginal bracket analysis + deduction strategies. Sources: IRS 2024, IRC §199A/§408A.</p>
              <Card className="mb-4">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <FormInput id="hsaContrib" label="HSA Contribution" value={hsaContrib} onChange={v => setHsaContrib(+v)} prefix="$" suffix="/yr" />
                    <FormInput id="charitableGiving" label="Charitable Giving" value={charitableGiving} onChange={v => setCharitableGiving(+v)} prefix="$" suffix="/yr" />
                  </div>
                </CardContent>
              </Card>
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Tax Reduction Strategies</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Strategy</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Annual Saving</th>
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txResult.strategies.map((s, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="py-1.5 px-2 font-medium text-slate-700">{s.name}</td>
                          <td className="text-right px-2 font-bold text-green-700">{fmt(s.saving)}</td>
                          <td className="px-2 text-xs text-slate-500">{s.note}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-slate-300 bg-green-50 font-bold">
                        <td className="py-2 px-2 text-green-800">TOTAL POTENTIAL SAVINGS</td>
                        <td className="text-right px-2 text-green-800">{fmt(txResult.totalSaving)}/yr</td>
                        <td className="px-2 text-xs text-green-600">{fmt(Math.round(txResult.totalSaving / 12))}/mo</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Roth Conversion Analysis</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 text-slate-600">Conversion Amount</td>
                        <td className="text-right font-medium">{fmt(txResult.rothConversion.amount)}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 text-slate-600">Tax Cost Now</td>
                        <td className="text-right text-red-600">{fmt(txResult.rothConversion.taxNow)}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 text-slate-600">Tax-Free Future Value (20yr)</td>
                        <td className="text-right text-green-600">{fmtSm(txResult.rothConversion.taxFreeFuture)}</td>
                      </tr>
                      <tr className="bg-green-50 font-bold">
                        <td className="py-2 text-green-800">Net Tax Benefit</td>
                        <td className="text-right text-green-800">{fmtSm(txResult.rothConversion.netBenefit)}</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <ResultBadge label="Effective Rate" value={pct(txResult.effectiveRate)} variant="gld" />
                <ResultBadge label="Marginal Rate" value={pct(txResult.marginalRate)} variant="red" />
                <ResultBadge label="Total Savings" value={fmtSm(txResult.totalSaving)} variant="grn" />
                <ResultBadge label="Roth Benefit" value={fmtSm(txResult.rothConversion.netBenefit)} variant="grn" />
              </div>
            </section>
          )}

          {/* ═══ PANEL 7: ESTATE ═══ */}
          {activePanel === 'estate' && (
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-600" /> Estate Planning
              </h2>
              <p className="text-sm text-slate-500 mb-4">Estate tax analysis + ILIT strategy + document checklist. Sources: IRS 2024 exemption, IRC §2010.</p>
              <Card className="mb-4">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <FormInput id="grossEstate" label="Gross Estate Value" value={grossEstate} onChange={v => setGrossEstate(+v)} prefix="$" />
                    <FormInput id="exemption" label="Federal Exemption" value={exemption} onChange={v => setExemption(+v)} prefix="$" />
                    <FormInput id="estateGrowth" label="Growth Rate" value={(estateGrowth * 100).toFixed(1)} onChange={v => setEstateGrowth(+v / 100)} suffix="%" />
                    <FormInput id="giftingAnnual" label="Annual Gifting" value={giftingAnnual} onChange={v => setGiftingAnnual(+v)} prefix="$" />
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-slate-600">Estate Documents</Label>
                      <Select value={willStatus} onValueChange={setWillStatus}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Will/Trust</SelectItem>
                          <SelectItem value="will">Will Only</SelectItem>
                          <SelectItem value="trust">Revocable Trust</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Estate Tax Analysis</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 text-slate-600">Gross Estate</td>
                        <td className="text-right font-medium">{fmt(esResult.grossEstate)}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 text-slate-600">Federal Exemption (2024)</td>
                        <td className="text-right text-green-600">−{fmt(esResult.exemption)}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 text-slate-600">Taxable Estate</td>
                        <td className="text-right font-medium">{fmt(esResult.taxable)}</td>
                      </tr>
                      <tr className="border-b border-slate-200 bg-red-50">
                        <td className="py-1.5 font-medium text-red-700">Estate Tax (40%)</td>
                        <td className="text-right font-bold text-red-700">{fmt(esResult.estateTax)}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 text-slate-600">Net to Heirs (without planning)</td>
                        <td className="text-right">{fmt(esResult.netToHeirs)}</td>
                      </tr>
                      <tr className="bg-green-50">
                        <td className="py-1.5 font-medium text-green-700">Net to Heirs (with ILIT + gifting)</td>
                        <td className="text-right font-bold text-green-700">{fmt(esResult.withPlanning)}</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Estate Document Checklist</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Document</th>
                        <th className="text-center py-2 px-2 text-xs font-semibold text-slate-500">Status</th>
                        <th className="text-center py-2 px-2 text-xs font-semibold text-slate-500">Priority</th>
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {esResult.documents.map((d, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="py-1.5 px-2 font-medium text-slate-700">{d.name}</td>
                          <td className="text-center px-2">
                            <Badge variant={d.status === 'Complete' ? 'default' : d.status === 'Missing' ? 'destructive' : 'secondary'}
                              className="text-[10px]">{d.status}</Badge>
                          </td>
                          <td className="text-center px-2">
                            <Badge variant={d.priority === 'High' ? 'destructive' : d.priority === 'Medium' ? 'default' : 'secondary'}
                              className="text-[10px]">{d.priority}</Badge>
                          </td>
                          <td className="px-2 text-xs text-slate-500">
                            {d.status === 'Missing' ? 'Schedule with estate attorney' : d.status === 'Complete' ? 'Review annually' : 'Verify status'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <ResultBadge label="Estate Tax" value={fmtSm(esResult.estateTax)} variant={esResult.estateTax === 0 ? 'grn' : 'red'} />
                <ResultBadge label="ILIT Saving" value={fmtSm(esResult.ilitSaving)} variant="grn" />
                <ResultBadge label="Net to Heirs" value={fmtSm(esResult.withPlanning)} variant="grn" />
                <ResultBadge label="Documents" value={`${esResult.documents.filter(d => d.status === 'Complete').length}/${esResult.documents.length}`} variant="gld" />
              </div>
            </section>
          )}

          {/* ═══ PANEL 8: EDUCATION ═══ */}
          {activePanel === 'edu' && (
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-amber-600" /> Education Planning
              </h2>
              <p className="text-sm text-slate-500 mb-4">529 plan projections + funding gap analysis. Sources: College Board 2024, Vanguard 529.</p>
              <Card className="mb-4">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <FormInput id="numChildren" label="Number of Children" value={numChildren} onChange={v => setNumChildren(+v)} min={0} max={8} />
                    <FormInput id="avgChildAge" label="Avg Child Age" value={avgChildAge} onChange={v => setAvgChildAge(+v)} min={0} max={17} />
                    <FormInput id="targetCost" label="Target Cost (4yr)" value={targetCost} onChange={v => setTargetCost(+v)} prefix="$" />
                    <FormInput id="eduReturn" label="529 Return Rate" value={(eduReturn * 100).toFixed(1)} onChange={v => setEduReturn(+v / 100)} suffix="%" />
                    <FormInput id="current529" label="Current 529 Balance" value={current529} onChange={v => setCurrent529(+v)} prefix="$" />
                    <FormInput id="monthly529" label="Monthly 529 Contrib" value={monthly529} onChange={v => setMonthly529(+v)} prefix="$" suffix="/mo" />
                  </div>
                </CardContent>
              </Card>
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">529 Projection ({edResult.yrsToCollege} years to college)</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Metric</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Per Child</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Total ({numChildren} children)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 px-2 text-slate-600">Future Cost (inflation-adjusted)</td>
                        <td className="text-right px-2 font-medium">{fmtSm(edResult.futureCostPerChild)}</td>
                        <td className="text-right px-2 font-bold">{fmtSm(edResult.totalFutureCost)}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 px-2 text-slate-600">Projected 529 Value</td>
                        <td className="text-right px-2 font-medium text-green-700">{fmtSm(edResult.projectedPer529)}</td>
                        <td className="text-right px-2 font-bold text-green-700">{fmtSm(edResult.totalProjected)}</td>
                      </tr>
                      <tr className="border-t-2 border-slate-300 bg-red-50 font-bold">
                        <td className="py-2 px-2 text-red-700">Funding Gap</td>
                        <td className="text-right px-2 text-red-700">{fmtSm(edResult.gapPerChild)}</td>
                        <td className="text-right px-2 text-red-700">{fmtSm(edResult.totalGap)}</td>
                      </tr>
                    </tbody>
                  </table>
                  {edResult.additionalMonthlyNeeded > 0 && (
                    <p className="text-sm text-amber-700 mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <strong>To close the gap:</strong> Increase monthly 529 contribution by {fmt(edResult.additionalMonthlyNeeded)}/mo per child.
                    </p>
                  )}
                </CardContent>
              </Card>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <ResultBadge label="Future Cost" value={fmtSm(edResult.totalFutureCost)} variant="gld" />
                <ResultBadge label="Projected 529" value={fmtSm(edResult.totalProjected)} variant="grn" />
                <ResultBadge label="Gap" value={fmtSm(edResult.totalGap)} variant={edResult.totalGap === 0 ? 'grn' : 'red'} />
                <ResultBadge label="Add'l Needed" value={fmt(edResult.additionalMonthlyNeeded) + '/mo'} variant="gld" />
              </div>
            </section>
          )}

          {/* ═══ PANEL 9: COST-BENEFIT ANALYSIS ═══ */}
          {activePanel === 'costben' && (
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-amber-600" /> Comprehensive Cost vs. Benefit Analysis
              </h2>
              <p className="text-sm text-slate-500 mb-4">Complete financial picture — what your client invests and what they receive across all products.</p>
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Multi-Horizon Analysis</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Horizon</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Total Cost</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Total Benefit</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Net Value</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">ROI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {horizonData.map(h => (
                        <tr key={h.yr} className="border-b border-slate-100">
                          <td className="py-1.5 px-2 font-medium text-slate-700">{h.yr} Years</td>
                          <td className="text-right px-2 text-red-600">{fmtSm(h.cost)}</td>
                          <td className="text-right px-2 text-green-600">{fmtSm(h.benefit)}</td>
                          <td className={`text-right px-2 font-bold ${h.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmtSm(h.net)}</td>
                          <td className="text-right px-2 font-bold text-amber-700">{h.roi}:1</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Visual Comparison</CardTitle></CardHeader>
                <CardContent>
                  {horizonData.length > 0 && (() => {
                    const maxVal = Math.max(...horizonData.map(h => Math.max(h.cost, h.benefit)));
                    return (
                      <div className="space-y-2">
                        {horizonData.map(h => (
                          <div key={h.yr} className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 w-10 text-right">{h.yr}yr</span>
                            <div className="flex-1 flex gap-1">
                              <div className="h-4 rounded bg-red-400" style={{ width: `${maxVal > 0 ? (h.cost / maxVal * 100) : 0}%` }}
                                title={`Cost: ${fmtSm(h.cost)}`} />
                              <div className="h-4 rounded bg-green-400" style={{ width: `${maxVal > 0 ? (h.benefit / maxVal * 100) : 0}%` }}
                                title={`Benefit: ${fmtSm(h.benefit)}`} />
                            </div>
                            <span className="text-xs font-bold text-slate-600 w-12 text-right">{h.roi}:1</span>
                          </div>
                        ))}
                        <div className="flex gap-4 mt-2 text-xs text-slate-500">
                          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400" /> Cost</span>
                          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-400" /> Benefit</span>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
              {horizonData.length > 0 && (() => {
                const h = horizonData[horizonData.length - 1];
                return (
                  <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-xl p-4 mb-4">
                    <h3 className="text-sm font-bold mb-1">Bottom Line</h3>
                    <p className="text-sm leading-relaxed">
                      Over a {h.yr}-year planning horizon, {clientName || 'the client'} invests {fmtSm(h.cost)} in comprehensive financial protection
                      and receives {fmtSm(h.benefit)} in total value — a {h.roi}:1 return on every dollar invested.
                      {h.net > 0 ? ` That's a net gain of ${fmtSm(h.net)}.` : ''}
                      {' '}This includes death benefit protection, cash value accumulation, tax savings, disability income replacement, and legacy value.
                    </p>
                  </div>
                );
              })()}
            </section>
          )}

          {/* ═══ PANEL 10: STRATEGY COMPARISON ═══ */}
          {activePanel === 'compare' && (
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-amber-600" /> Strategy Comparison
              </h2>
              <p className="text-sm text-slate-500 mb-4">Compare preset strategies across all financial dimensions. Sources: Morningstar, Kitces Research 2024.</p>
              <Card className="mb-4">
                <CardContent className="pt-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Dimension</th>
                          {STRATEGIES.map(s => (
                            <th key={s.name} className="text-center py-2 px-2 text-xs font-semibold text-slate-500">{s.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {['Protection', 'Growth', 'Tax Efficiency', 'Liquidity', 'Legacy', 'Complexity'].map(dim => (
                          <tr key={dim} className="border-b border-slate-100">
                            <td className="py-1.5 px-2 font-medium text-slate-700">{dim}</td>
                            {STRATEGIES.map(s => {
                              const val = s.scores[dim] ?? 0;
                              return (
                                <td key={s.name} className="text-center px-2">
                                  <div className="flex items-center justify-center gap-0.5">
                                    {[1,2,3,4,5].map(i => (
                                      <span key={i} className={`w-1.5 h-4 rounded-sm ${i <= val ? 'bg-amber-500' : 'bg-slate-200'}`} />
                                    ))}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                        <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                          <td className="py-2 px-2">Total Score</td>
                          {STRATEGIES.map(s => {
                            const total = Object.values(s.scores).reduce((a, b) => a + b, 0);
                            return <td key={s.name} className="text-center px-2 text-amber-700 font-bold">{total}/30</td>;
                          })}
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="py-1.5 px-2 font-medium text-slate-700">Annual Cost</td>
                          {STRATEGIES.map(s => (
                            <td key={s.name} className="text-center px-2 text-slate-600">{s.annualCost}</td>
                          ))}
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="py-1.5 px-2 font-medium text-slate-700">Best For</td>
                          {STRATEGIES.map(s => (
                            <td key={s.name} className="text-center px-2 text-xs text-slate-500">{s.bestFor}</td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {STRATEGIES.map(s => (
                  <Card key={s.name} className="border-l-4" style={{ borderLeftColor: s.color }}>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">{s.name}</CardTitle></CardHeader>
                    <CardContent>
                      <p className="text-xs text-slate-600 mb-2">{s.description}</p>
                      <div className="text-xs text-slate-500"><strong>Products:</strong> {s.products.join(', ')}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* ═══ PANEL 11: SUMMARY ═══ */}
          {activePanel === 'summary' && (
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-600" /> Executive Summary
              </h2>
              <p className="text-sm text-slate-500 mb-4">Complete financial snapshot for {clientName || 'Client'}.</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <ResultBadge label="Health Score" value={`${scorecard.pctScore}%`} variant={scorecard.pctScore >= 80 ? 'grn' : scorecard.pctScore >= 60 ? 'gld' : 'red'} />
                <ResultBadge label="Save Rate" value={pct(cfResult.saveRate)} variant={cfResult.saveRate >= 0.2 ? 'grn' : 'gld'} />
                <ResultBadge label="Protection Gap" value={fmtSm(prResult.gap)} variant={prResult.gap === 0 ? 'grn' : 'red'} />
                <ResultBadge label="Retire Income" value={fmt(rtResult.monthlyIncome) + '/mo'} variant="grn" />
              </div>
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Financial Summary</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Domain</th>
                        <th className="text-center py-2 px-2 text-xs font-semibold text-slate-500">Score</th>
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Key Finding</th>
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Recommendation</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 px-2 font-medium">Cash Flow</td>
                        <td className="text-center px-2"><ScoreBadge score={scores.cash} /></td>
                        <td className="px-2 text-xs text-slate-600">Save rate {pct(cfResult.saveRate)}, DTI {pct(cfResult.dti)}</td>
                        <td className="px-2 text-xs text-slate-500">{cfResult.saveRate < 0.15 ? 'Increase savings to 15%+' : 'On track'}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 px-2 font-medium">Protection</td>
                        <td className="text-center px-2"><ScoreBadge score={scores.protect} /></td>
                        <td className="px-2 text-xs text-slate-600">DIME gap {fmtSm(prResult.gap)}</td>
                        <td className="px-2 text-xs text-slate-500">{prResult.gap > 0 ? `Add ${fmtSm(prResult.gap)} coverage` : 'Fully covered'}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 px-2 font-medium">Growth</td>
                        <td className="text-center px-2"><ScoreBadge score={scores.growth} /></td>
                        <td className="px-2 text-xs text-slate-600">Tax-free edge {fmtSm(grResult.taxEdge)}</td>
                        <td className="px-2 text-xs text-slate-500">Consider IUL/Roth for tax-free growth</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 px-2 font-medium">Retirement</td>
                        <td className="text-center px-2"><ScoreBadge score={scores.retire} /></td>
                        <td className="px-2 text-xs text-slate-600">Best SS at {rtResult.bestAge}, {fmt(rtResult.monthlyIncome)}/mo</td>
                        <td className="px-2 text-xs text-slate-500">Delay SS to {rtResult.bestAge} for max benefit</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 px-2 font-medium">Tax</td>
                        <td className="text-center px-2"><ScoreBadge score={scores.tax} /></td>
                        <td className="px-2 text-xs text-slate-600">Eff rate {pct(txResult.effectiveRate)}, saving {fmtSm(txResult.totalSaving)}/yr</td>
                        <td className="px-2 text-xs text-slate-500">{txResult.totalSaving > 5000 ? 'Implement tax strategies' : 'Optimized'}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 px-2 font-medium">Estate</td>
                        <td className="text-center px-2"><ScoreBadge score={scores.estate} /></td>
                        <td className="px-2 text-xs text-slate-600">Tax {fmtSm(esResult.estateTax)}, ILIT saves {fmtSm(esResult.ilitSaving)}</td>
                        <td className="px-2 text-xs text-slate-500">{willStatus === 'none' ? 'Create estate documents' : 'Review annually'}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 px-2 font-medium">Education</td>
                        <td className="text-center px-2"><ScoreBadge score={scores.edu} /></td>
                        <td className="px-2 text-xs text-slate-600">529 gap {fmtSm(edResult.totalGap)}</td>
                        <td className="px-2 text-xs text-slate-500">{edResult.totalGap > 0 ? `Increase 529 by ${fmt(edResult.additionalMonthlyNeeded)}/mo` : 'On track'}</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Total Investment Summary</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-red-50 rounded-lg p-3">
                      <div className="text-xs font-bold text-red-500 uppercase">Annual Cost</div>
                      <div className="text-xl font-extrabold text-red-700">{fmt(totalAnnualPremium)}</div>
                      <div className="text-xs text-slate-500">{fmt(Math.round(totalAnnualPremium / 12))}/mo</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3">
                      <div className="text-xs font-bold text-green-500 uppercase">Products</div>
                      <div className="text-xl font-extrabold text-green-700">{recommendations.length}</div>
                      <div className="text-xs text-slate-500">recommended</div>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3">
                      <div className="text-xs font-bold text-amber-500 uppercase">% of Income</div>
                      <div className="text-xl font-extrabold text-amber-700">{pct(totalIncome > 0 ? totalAnnualPremium / totalIncome : 0)}</div>
                      <div className="text-xs text-slate-500">target &lt; 15%</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          )}

          {/* ═══ PANEL 12: ACTION PLAN ═══ */}
          {activePanel === 'timeline' && (
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-amber-600" /> 12-Month Action Plan
              </h2>
              <p className="text-sm text-slate-500 mb-4">Prioritized implementation timeline with pace options.</p>
              <Card className="mb-4">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-700">Implementation Pace:</span>
                    {(['standard', 'aggressive', 'gradual'] as const).map(p => (
                      <Button key={p} size="sm" variant={pace === p ? 'default' : 'outline'}
                        className="h-7 px-3 text-xs capitalize"
                        onClick={() => setPace(p)}>
                        {p === 'standard' ? 'Standard (12mo)' : p === 'aggressive' ? 'Aggressive (6mo)' : 'Gradual (18mo)'}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Implementation Timeline — {pace.charAt(0).toUpperCase() + pace.slice(1)} Pace</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Phase</th>
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Timeline</th>
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Actions</th>
                        <th className="text-center py-2 px-2 text-xs font-semibold text-slate-500">Priority</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buildActionPlan(pace, recommendations, scores, prResult, cfResult, edResult).map((phase, i) => (
                        <tr key={i} className="border-b border-slate-100 align-top">
                          <td className="py-2 px-2 font-medium text-slate-700">{phase.name}</td>
                          <td className="py-2 px-2 text-slate-600 whitespace-nowrap">{phase.timeline}</td>
                          <td className="py-2 px-2">
                            <ul className="space-y-1">
                              {phase.actions.map((a, j) => (
                                <li key={j} className="text-xs text-slate-600 flex items-start gap-1">
                                  <span className="text-amber-500 mt-0.5">•</span> {a}
                                </li>
                              ))}
                            </ul>
                          </td>
                          <td className="text-center py-2 px-2">
                            <Badge variant={phase.priority === 'Critical' ? 'destructive' : phase.priority === 'High' ? 'default' : 'secondary'}
                              className="text-[10px]">{phase.priority}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
              <div className="bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200 rounded-xl p-4">
                <h3 className="text-sm font-bold text-amber-800 mb-2">Immediate Next Steps</h3>
                <ol className="space-y-1 text-xs text-amber-700">
                  <li>1. Schedule follow-up meeting within 7 days to finalize product selection</li>
                  <li>2. Gather medical records for underwriting (if life/DI insurance recommended)</li>
                  <li>3. Review beneficiary designations on all existing accounts</li>
                  <li>4. Set up automatic savings transfers for recommended monthly contributions</li>
                  <li>5. Schedule estate attorney consultation (if estate documents needed)</li>
                </ol>
              </div>
            </section>
          )}

          {/* ═══ PANEL 13: REFERENCES ═══ */}
          {activePanel === 'refs' && (
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-600" /> References & Due Diligence
              </h2>
              <p className="text-sm text-slate-500 mb-4">Calculation methodology, data sources, and compliance checklist.</p>
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Calculation Methods</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Domain</th>
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Method</th>
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CALC_METHODS.map((m, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="py-1.5 px-2 font-medium text-slate-700">{m.domain}</td>
                          <td className="px-2 text-slate-600">{m.method}</td>
                          <td className="px-2 text-xs text-slate-500">{m.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Due Diligence Checklist</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-center py-2 px-2 text-xs font-semibold text-slate-500">#</th>
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Item</th>
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {DUE_DILIGENCE.map((item, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="text-center py-1.5 px-2 text-slate-400">{i + 1}</td>
                          <td className="py-1.5 px-2 text-slate-700">{item.text}</td>
                          <td className="px-2"><Badge variant="secondary" className="text-[10px]">{item.category}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Data Sources</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-1 text-xs text-slate-600">
                    <li>• <strong>Tax Brackets:</strong> IRS Revenue Procedure 2024-40 (2024 brackets, standard deductions)</li>
                    <li>• <strong>Social Security:</strong> SSA 2024 COLA adjustment, PIA bend points, claiming age factors</li>
                    <li>• <strong>Life Insurance:</strong> LIMRA 2024 U.S. Life Insurance Survey, SOA mortality tables</li>
                    <li>• <strong>Investment Returns:</strong> Morningstar 2024 long-term capital market assumptions</li>
                    <li>• <strong>Inflation:</strong> BLS CPI-U 12-month average, Federal Reserve 2% target</li>
                    <li>• <strong>Estate Tax:</strong> IRC §2010 unified credit, 2024 exemption $13.61M</li>
                    <li>• <strong>Education Costs:</strong> College Board Trends in College Pricing 2024</li>
                    <li>• <strong>Disability Statistics:</strong> Council for Disability Awareness 2024</li>
                    <li>• <strong>LTC Costs:</strong> Genworth Cost of Care Survey 2024</li>
                    <li>• <strong>Withdrawal Rates:</strong> Trinity Study (Cooley, Hubbard, Walz), Bengen 4% Rule</li>
                  </ul>
                </CardContent>
              </Card>
              <div className="bg-slate-100 border border-slate-200 rounded-lg p-4 text-xs text-slate-500">
                <p className="font-bold text-slate-600 mb-1">Important Disclosures</p>
                <p>
                  This analysis is for educational and illustrative purposes only. It does not constitute financial, tax, legal, or investment advice.
                  All projections are hypothetical and based on assumptions that may not reflect actual market conditions.
                  Past performance does not guarantee future results. Consult with qualified professionals before making financial decisions.
                  Insurance products are subject to underwriting approval. Premium estimates are illustrative and may vary by carrier, health class, and state.
                  Tax information is based on current law and may change. Individual results will vary.
                </p>
              </div>
            </section>
          )}

        </div>
      </main>

      {/* ─── SAVE DIALOG ─── */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Calculator Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-sm">Session Name</Label>
              <Input value={sessionName} onChange={e => setSessionName(e.target.value)} placeholder="e.g. John Smith - Initial Review" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveConfirm} disabled={!sessionName.trim() || saveMut.isPending}>
              {saveMut.isPending ? 'Saving...' : 'Save Session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── LOAD DIALOG ─── */}
      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Load Saved Session</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-2 py-2">
            {sessionsQuery.data && sessionsQuery.data.length > 0 ? (
              sessionsQuery.data.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between border border-slate-200 rounded-lg p-3 hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{s.name}</p>
                    <p className="text-xs text-slate-500">{new Date(s.updatedAt).toLocaleDateString()} &middot; {s.calculatorType}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleLoad(s.id)} className="text-xs">
                      <FolderOpen className="w-3 h-3 mr-1" /> Load
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm('Delete this session?')) deleteMut.mutate({ id: s.id }); }}
                      className="text-xs text-red-500 hover:text-red-700">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 text-center py-8">No saved sessions yet. Save your first session to see it here.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
