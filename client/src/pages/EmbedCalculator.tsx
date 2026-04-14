/* WealthBridge Embeddable Calculator — Standalone widget without app shell */
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  User, DollarSign, Shield, TrendingUp, Clock, Building2, GraduationCap,
  Scale, BarChart3, GitCompare, FileText, ListChecks, BookOpen,
  Calculator, Download
} from 'lucide-react';

import {
  RATES, fmt, fmtSm, pct, getBracketRate,
  computeScorecard, buildRecommendations, buildHorizonData,
  calcCashFlow, calcProtection, calcGrowth, calcRetirement, calcTax, calcEstate, calcEducation,
} from './calculators/engine';

import { ProfilePanel, CashFlowPanel, ProtectionPanel, GrowthPanel } from './calculators/PanelsA';
import { RetirementPanel, TaxPanel, EstatePanel, EducationPanel } from './calculators/PanelsB';
import { CostBenefitPanel, StrategyComparePanel, SummaryPanel, ActionPlanPanel, ReferencesPanel } from './calculators/PanelsC';

type PanelId = 'profile' | 'cash' | 'protect' | 'grow' | 'retire' | 'tax' | 'estate' | 'edu' |
  'costben' | 'compare' | 'summary' | 'timeline' | 'refs';

const NAV_SECTIONS: { group: string; items: { id: PanelId; label: string; icon: React.ReactNode }[] }[] = [
  { group: 'Profile', items: [
    { id: 'profile', label: 'Client Profile', icon: <User className="w-4 h-4" /> },
  ]},
  { group: 'Planning', items: [
    { id: 'cash', label: 'Cash Flow', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'protect', label: 'Protection', icon: <Shield className="w-4 h-4" /> },
    { id: 'grow', label: 'Growth', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'retire', label: 'Retirement', icon: <Clock className="w-4 h-4" /> },
    { id: 'tax', label: 'Tax', icon: <Building2 className="w-4 h-4" /> },
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

export default function EmbedCalculator() {
  const [activePanel, setActivePanel] = useState<PanelId>('profile');

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

  /* ─── BUSINESS INPUTS ─── */
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

  /* ─── DOMAIN INPUTS ─── */
  const [housing, setHousing] = useState(2500);
  const [transport, setTransport] = useState(800);
  const [food, setFood] = useState(600);
  const [insurancePmt, setInsurancePmt] = useState(300);
  const [debtPmt, setDebtPmt] = useState(500);
  const [otherExp, setOtherExp] = useState(400);
  const [emMonths, setEmMonths] = useState(6);
  const [replaceYrs, setReplaceYrs] = useState(10);
  const [payoffRate, setPayoffRate] = useState(0);
  const [eduPerChild, setEduPerChild] = useState(50000);
  const [finalExp, setFinalExp] = useState(25000);
  const [ssBenefit, setSsBenefit] = useState(2500);
  const [diPct, setDiPct] = useState(0.6);
  const [retireAge, setRetireAge] = useState(65);
  const [monthlySav, setMonthlySav] = useState(1500);
  const [infRate, setInfRate] = useState(0.03);
  const [taxReturn, setTaxReturn] = useState(0.07);
  const [iulReturn, setIulReturn] = useState(0.065);
  const [fiaReturn, setFiaReturn] = useState(0.055);
  const [ss62, setSs62] = useState(1800);
  const [ss67, setSs67] = useState(2800);
  const [ss70, setSs70] = useState(3500);
  const [pension, setPension] = useState(0);
  const [withdrawalRate, setWithdrawalRate] = useState(0.04);
  const [hsaContrib, setHsaContrib] = useState(0);
  const [charitableGiving, setCharitableGiving] = useState(0);
  const [grossEstate, setGrossEstate] = useState(2000000);
  const [exemption, setExemption] = useState(13610000);
  const [estateGrowth, setEstateGrowth] = useState(0.05);
  const [giftingAnnual, setGiftingAnnual] = useState(0);
  const [willStatus, setWillStatus] = useState('none');
  const [numChildren, setNumChildren] = useState(2);
  const [avgChildAge, setAvgChildAge] = useState(8);
  const [targetCost, setTargetCost] = useState(120000);
  const [eduReturn, setEduReturn] = useState(0.06);
  const [current529, setCurrent529] = useState(30000);
  const [monthly529, setMonthly529] = useState(300);
  const [pace, setPace] = useState<'standard'|'aggressive'|'gradual'>('standard');

  /* ─── COMPUTED RESULTS ─── */
  const totalIncome = income + spouseIncome;
  const grossMonthly = Math.round(totalIncome / 12);
  const fedRate = getBracketRate(totalIncome, filing === 'mfj' ? RATES.bracketsMFJ : RATES.bracketsSingle);
  const combinedRate = fedRate + stateRate;

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
    if (isBiz) {
      const bizProfit = bizRevenue - bizExpenses;
      const bizMargin = bizRevenue > 0 ? bizProfit / bizRevenue : 0;
      if (bizSeasonality === 'heavy' && bizMargin < 0.15) s.cash = Math.max(0, s.cash - 1);
      if (bizRevenueStreams >= 3) s.cash = Math.min(3, s.cash + 1);
      if (bizDebtService > bizRevenue * 0.3) s.cash = Math.max(0, s.cash - 1);
      if (bizKeyPerson && !bizBuySell) s.protect = Math.max(0, s.protect - 1);
      if (bizBuySell) s.protect = Math.min(3, s.protect + 1);
      if (bizGrowthRate >= 0.15 && bizRevenue > 0) s.growth = Math.min(3, s.growth + 1);
      if (['s-corp', 'c-corp'].includes(bizEntityType)) s.tax = Math.min(3, s.tax + 1);
      if (bizEntityType === 'sole-prop' && bizRevenue > 200000) s.tax = Math.max(0, s.tax - 1);
      if (bizSuccessionPlan === 'none') s.estate = Math.max(0, s.estate - 1);
      if (bizSuccessionPlan === 'documented' && bizBuySell) s.estate = Math.min(3, s.estate + 1);
    }
    return s;
  }, [totalIncome, grossMonthly, housing, transport, food, insurancePmt, debtPmt, otherExp,
    dep, income, mortgage, debt, existIns, monthlySav, retirement401k, hsaContrib,
    willStatus, current529, targetCost, isBiz, bizRevenue, bizExpenses, bizSeasonality,
    bizRevenueStreams, bizDebtService, bizKeyPerson, bizBuySell, bizGrowthRate, bizEntityType, bizSuccessionPlan]);

  const scorecard = useMemo(() => computeScorecard(scores), [scores]);
  const cfResult = useMemo(() => calcCashFlow(grossMonthly, combinedRate, housing, transport, food, insurancePmt, debtPmt, otherExp, emMonths, savings), [grossMonthly, combinedRate, housing, transport, food, insurancePmt, debtPmt, otherExp, emMonths, savings]);
  const prResult = useMemo(() => calcProtection(totalIncome, dep, mortgage, debt, existIns, age, replaceYrs, payoffRate, eduPerChild, finalExp, ssBenefit, diPct), [totalIncome, dep, mortgage, debt, existIns, age, replaceYrs, payoffRate, eduPerChild, finalExp, ssBenefit, diPct]);
  const grResult = useMemo(() => calcGrowth(age, retireAge, monthlySav, savings, infRate, taxReturn, iulReturn, fiaReturn), [age, retireAge, monthlySav, savings, infRate, taxReturn, iulReturn, fiaReturn]);
  const rtResult = useMemo(() => calcRetirement(age, retireAge, ss62, ss67, ss70, pension, withdrawalRate, savings, monthlySav), [age, retireAge, ss62, ss67, ss70, pension, withdrawalRate, savings, monthlySav]);
  const txResult = useMemo(() => calcTax(totalIncome, stateRate, isBiz, filing, retirement401k, hsaContrib, charitableGiving), [totalIncome, stateRate, isBiz, filing, retirement401k, hsaContrib, charitableGiving]);
  const esResult = useMemo(() => calcEstate(grossEstate, exemption, estateGrowth, giftingAnnual, willStatus), [grossEstate, exemption, estateGrowth, giftingAnnual, willStatus]);
  const edResult = useMemo(() => calcEducation(numChildren, avgChildAge, targetCost, infRate, eduReturn, current529, monthly529), [numChildren, avgChildAge, targetCost, infRate, eduReturn, current529, monthly529]);
  const recommendations = useMemo(() => buildRecommendations(age, totalIncome, dep, nw, existIns, mortgage, debt, isBiz, scores), [age, totalIncome, dep, nw, existIns, mortgage, debt, isBiz, scores]);
  const totalAnnualPremium = useMemo(() => recommendations.reduce((s, r) => s + r.premium, 0), [recommendations]);
  const horizonData = useMemo(() => buildHorizonData(recommendations, age, totalIncome, [5, 10, 15, 20, 30]), [recommendations, age, totalIncome]);

  const pp = {
    clientName, setClientName, age, setAge, spouseAge, setSpouseAge, dep, setDep,
    income, setIncome, spouseIncome, setSpouseIncome, nw, setNw, savings, setSavings,
    retirement401k, setRetirement401k, mortgage, setMortgage, debt, setDebt,
    existIns, setExistIns, filing, setFiling, stateRate, setStateRate,
    riskTolerance, setRiskTolerance, isBiz, setIsBiz,
    bizEntityType, setBizEntityType, bizRevenue, setBizRevenue, bizExpenses, setBizExpenses,
    bizEmployees, setBizEmployees, bizSeasonality, setBizSeasonality,
    bizRevenueStreams, setBizRevenueStreams, bizProductMix, setBizProductMix,
    bizGrowthRate, setBizGrowthRate, bizDebtService, setBizDebtService,
    bizKeyPerson, setBizKeyPerson, bizSuccessionPlan, setBizSuccessionPlan, bizBuySell, setBizBuySell,
    housing, setHousing, transport, setTransport, food, setFood,
    insurancePmt, setInsurancePmt, debtPmt, setDebtPmt, otherExp, setOtherExp, emMonths, setEmMonths,
    replaceYrs, setReplaceYrs, payoffRate, setPayoffRate, eduPerChild, setEduPerChild,
    finalExp, setFinalExp, ssBenefit, setSsBenefit, diPct, setDiPct,
    retireAge, setRetireAge, monthlySav, setMonthlySav, infRate, setInfRate,
    taxReturn, setTaxReturn, iulReturn, setIulReturn, fiaReturn, setFiaReturn,
    ss62, setSs62, ss67, setSs67, ss70, setSs70, pension, setPension,
    withdrawalRate, setWithdrawalRate,
    hsaContrib, setHsaContrib, charitableGiving, setCharitableGiving,
    grossEstate, setGrossEstate, exemption, setExemption, estateGrowth, setEstateGrowth,
    giftingAnnual, setGiftingAnnual, willStatus, setWillStatus,
    numChildren, setNumChildren, avgChildAge, setAvgChildAge, targetCost, setTargetCost,
    eduReturn, setEduReturn, current529, setCurrent529, monthly529, setMonthly529,
    pace, setPace,
    totalIncome, scores, scorecard, recommendations, totalAnnualPremium,
    cfResult, prResult, grResult, rtResult, txResult, esResult, edResult, horizonData,
    practiceIncome: {
      annualGDC: 0, annualAUM: 0, annualOverride: 0, annualExpanded: 0,
      annualChannelRev: 0, grandTotal: 0, streamCount: 0, items: [],
      pnlNetIncome: 0, pnlEbitda: 0, pnlRevenue: 0, monthlyGDC: 0, monthlyNet: 0,
    },
  };

  const handleExportPdf = () => {
    window.print();
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden print:block">
      {/* ─── SIDEBAR ─── */}
      <aside className="w-52 border-r border-border bg-card flex flex-col print:hidden">
        <div className="p-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            <div>
              <h1 className="text-sm font-bold text-foreground leading-tight">Wealth Engine</h1>
              <p className="text-[10px] text-muted-foreground">Financial Planning Calculator</p>
            </div>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <nav className="p-2 space-y-3">
            {NAV_SECTIONS.map(section => (
              <div key={section.group}>
                <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-2 mb-1">{section.group}</p>
                {section.items.map(item => (
                  <button key={item.id} onClick={() => setActivePanel(item.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      activePanel === item.id
                        ? 'bg-primary/10 text-primary border border-primary/30'
                        : 'text-muted-foreground hover:bg-background hover:text-foreground border border-transparent'
                    }`}>
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </ScrollArea>
        <div className="p-3 border-t border-border/50 bg-background">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Health Score</span>
            <span className={`font-bold ${scorecard.pctScore >= 80 ? 'text-green-400' : scorecard.pctScore >= 60 ? 'text-primary' : 'text-red-400'}`}>
              {scorecard.pctScore}%
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full transition-all ${scorecard.pctScore >= 80 ? 'bg-green-500' : scorecard.pctScore >= 60 ? 'bg-primary' : 'bg-red-500'}`}
              style={{ width: `${scorecard.pctScore}%` }} />
          </div>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ─── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6">
          {/* Toolbar — minimal for embed */}
          <div className="flex items-center justify-between mb-4 bg-card rounded-lg border border-border px-4 py-2 print:hidden">
            <span className="text-sm text-muted-foreground">Standalone Calculator</span>
            <Button variant="outline" size="sm" onClick={handleExportPdf} className="text-xs gap-1.5">
              <Download className="w-3.5 h-3.5" /> Print / PDF
            </Button>
          </div>

          {activePanel === 'profile' && <ProfilePanel {...pp} />}
          {activePanel === 'cash' && <CashFlowPanel {...pp} />}
          {activePanel === 'protect' && <ProtectionPanel {...pp} />}
          {activePanel === 'grow' && <GrowthPanel {...pp} />}
          {activePanel === 'retire' && <RetirementPanel {...pp} />}
          {activePanel === 'tax' && <TaxPanel {...pp} />}
          {activePanel === 'estate' && <EstatePanel {...pp} />}
          {activePanel === 'edu' && <EducationPanel {...pp} />}
          {activePanel === 'costben' && <CostBenefitPanel {...pp} horizonData={horizonData} />}
          {activePanel === 'compare' && <StrategyComparePanel {...pp} />}
          {activePanel === 'summary' && <SummaryPanel {...pp} />}
          {activePanel === 'timeline' && <ActionPlanPanel {...pp} />}
          {activePanel === 'refs' && <ReferencesPanel />}
        </div>
      </main>
    </div>
  );
}
