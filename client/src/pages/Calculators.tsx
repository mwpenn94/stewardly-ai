/* WealthBridge Unified Wealth Engine v7 — Orchestrator */
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/_core/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import {
  User, DollarSign, Shield, TrendingUp, Clock, Building2, GraduationCap,
  Scale, BarChart3, GitCompare, FileText, ListChecks, BookOpen,
  Calculator, CheckCircle2, Save, FolderOpen, Download, Trash2, Upload,
  Target, Layers, Package, Filter, Users, Megaphone, LayoutDashboard, Receipt,
  Flag, CalendarDays, PanelLeftClose, PanelLeftOpen, Menu,
  Briefcase, Gem, Handshake, CalendarRange, RotateCcw, X, Info
} from 'lucide-react';

import {
  RATES, fmt, fmtSm, pct, getBracketRate,
  computeScorecard, buildRecommendations, buildHorizonData,
  calcCashFlow, calcProtection, calcGrowth, calcRetirement, calcTax, calcEstate, calcEducation,
  calcIncomeStreams,
} from './calculators/engine';
import type { IncomeStream } from './calculators/engine';

/* ─── Lazy-loaded panel groups ─── */
import { ProfilePanel, CashFlowPanel, ProtectionPanel, GrowthPanel } from './calculators/PanelsA';
import { RetirementPanel, TaxPanel, EstatePanel, EducationPanel } from './calculators/PanelsB';
import { CostBenefitPanel, StrategyComparePanel, SummaryPanel, ActionPlanPanel, ReferencesPanel } from './calculators/PanelsC';
import { AdvancedStrategiesPanel, BusinessClientPanel, TimelinePanel, PartnerPanel } from './calculators/PanelsE';
import { IncomeStreamsPanel } from './calculators/PanelsF';
import { CalcNarrator } from './calculators/CalcNarrator';
import { MyPlanPanel, GDCBracketsPanel, ProductsPanel, SalesFunnelPanel, RecruitingPanel, ChannelsPanel, DashboardPanel, PnLPanel, GoalTrackerPanel, MonthlyProductionPanel, type PracticeProps } from './calculators/PanelsD';
import {
  ROLE_DEFAULTS, calcWeightedGDC, calcProductionFunnel, calcTeamOverride,
  calcChannelMetrics, calcPnL, calcRollUp, calcDashboard, calcAllTracksSummary,
  PRODUCTS as BIE_PRODUCTS, getBracket,
  type RoleId, type TeamMember, type RecruitTrack,
} from './calculators/practiceEngine';

/* ═══ PANEL TYPE DEFINITIONS ═══ */
type PanelId = 'profile' | 'cash' | 'protect' | 'grow' | 'retire' | 'tax' | 'estate' | 'edu' |
  'advanced' | 'bizclient' | 'costben' | 'compare' | 'summary' | 'timeline' | 'impl_timeline' | 'refs' |
  'myplan' | 'gdcbrackets' | 'products' | 'salesfunnel' | 'recruiting' | 'channels' | 'dashboard' | 'pnl' |
  'goaltracker' | 'monthlyproduction' | 'partner' | 'income';

const NAV_SECTIONS: { group: string; items: { id: PanelId; label: string; icon: React.ReactNode }[] }[] = [
  { group: 'Your Profile', items: [
    { id: 'profile', label: 'Client Profile', icon: <User className="w-4 h-4" /> },
  ]},
  { group: 'Plan', items: [
    { id: 'cash', label: 'Cash Flow', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'retire', label: 'Retirement', icon: <Clock className="w-4 h-4" /> },
    { id: 'tax', label: 'Tax Planning', icon: <Building2 className="w-4 h-4" /> },
    { id: 'estate', label: 'Estate', icon: <Scale className="w-4 h-4" /> },
    { id: 'edu', label: 'Education', icon: <GraduationCap className="w-4 h-4" /> },
  ]},
  { group: 'Protect', items: [
    { id: 'protect', label: 'Protection', icon: <Shield className="w-4 h-4" /> },
    { id: 'bizclient', label: 'Business Client', icon: <Briefcase className="w-4 h-4" /> },
  ]},
  { group: 'Grow', items: [
    { id: 'grow', label: 'Growth', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'advanced', label: 'Advanced', icon: <Gem className="w-4 h-4" /> },
  ]},
  { group: 'Practice Planning', items: [
    { id: 'myplan' as PanelId, label: 'My Plan', icon: <Target className="w-4 h-4" /> },
    { id: 'gdcbrackets' as PanelId, label: 'GDC Brackets', icon: <Layers className="w-4 h-4" /> },
    { id: 'products' as PanelId, label: 'Products', icon: <Package className="w-4 h-4" /> },
    { id: 'salesfunnel' as PanelId, label: 'Sales Funnel', icon: <Filter className="w-4 h-4" /> },
    { id: 'recruiting' as PanelId, label: 'Recruiting', icon: <Users className="w-4 h-4" /> },
    { id: 'channels' as PanelId, label: 'Channels', icon: <Megaphone className="w-4 h-4" /> },
    { id: 'dashboard' as PanelId, label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'pnl' as PanelId, label: 'P&L', icon: <Receipt className="w-4 h-4" /> },
    { id: 'goaltracker' as PanelId, label: 'Goal Tracker', icon: <Flag className="w-4 h-4" /> },
    { id: 'monthlyproduction' as PanelId, label: 'Monthly Production', icon: <CalendarDays className="w-4 h-4" /> },
  ]},
  { group: 'Analysis', items: [
    { id: 'costben', label: 'Cost-Benefit', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'compare', label: 'Strategy Compare', icon: <GitCompare className="w-4 h-4" /> },
    { id: 'summary', label: 'Summary', icon: <FileText className="w-4 h-4" /> },
    { id: 'timeline', label: 'Action Plan', icon: <ListChecks className="w-4 h-4" /> },
    { id: 'impl_timeline', label: 'Timeline', icon: <CalendarRange className="w-4 h-4" /> },
    { id: 'partner', label: 'Partner Earnings', icon: <Handshake className="w-4 h-4" /> },
    { id: 'income', label: 'Income Streams', icon: <DollarSign className="w-4 h-4" /> },
  ]},
  { group: 'Resources', items: [
    { id: 'refs', label: 'References', icon: <BookOpen className="w-4 h-4" /> },
  ]},
];

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function Calculators() {
  const { user } = useAuth();
  const [activePanel, setActivePanel] = useState<PanelId>('profile');
  const [calcSidebarOpen, setCalcSidebarOpen] = useState(false);

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

  /* ─── ADVANCED STRATEGIES INPUTS ─── */
  const [pfFace, setPfFace] = useState(5000000);
  const [pfPrem, setPfPrem] = useState(100000);
  const [pfCash, setPfCash] = useState(25000);
  const [pfLoan, setPfLoan] = useState(5);
  const [pfCred, setPfCred] = useState(6.5);
  const [pfYrs, setPfYrs] = useState(10);
  const [ilDB, setIlDB] = useState(3000000);
  const [ilPr, setIlPr] = useState(30000);
  const [ilCr, setIlCr] = useState(3);
  const [ilTx, setIlTx] = useState(40);
  const [exSal, setExSal] = useState(200000);
  const [ex162, setEx162] = useState(25000);
  const [exSERP, setExSERP] = useState(50000);
  const [exSD, setExSD] = useState(0);
  const [cvCRT, setCvCRT] = useState(500000);
  const [cvPO, setCvPO] = useState(5);
  const [cvDAF, setCvDAF] = useState(50000);
  const [cvLI, setCvLI] = useState(500000);
  const [advGoal, setAdvGoal] = useState(0);

  /* ─── BUSINESS CLIENT INPUTS ─── */
  const [bcBizValue, setBcBizValue] = useState(1000000);
  const [bcKeyPersonSalary, setBcKeyPersonSalary] = useState(150000);
  const [bcKeyPersonMult, setBcKeyPersonMult] = useState(5);
  const [bcOwners, setBcOwners] = useState(2);
  const [bcEmployees, setBcEmployees] = useState(15);

  /* ─── PARTNER / AFFILIATE INPUTS ─── */
  const [paLow, setPaLow] = useState(4);
  const [paMid, setPaMid] = useState(4);
  const [paHigh, setPaHigh] = useState(2);

  /* ─── INCOME STREAMS ─── */
  const [incomeStreams, setIncomeStreams] = useState<IncomeStream[]>([]);

  /* ─── COST-BENEFIT & ACTION PLAN ─── */
  const [cbHorizons] = useState<number[]>([5, 10, 15, 20, 30]);
  const [pace, setPace] = useState<'standard'|'aggressive'|'gradual'>('standard');
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set());

  /* ─── WELCOME TIP ─── */
  const [showWelcome, setShowWelcome] = useState(() => {
    try { return localStorage.getItem('wb-welcome-dismissed') !== 'true'; } catch { return true; }
  });

  /* ─── PRACTICE PLANNING STATE ─── */
  const [ppRole, setPpRole] = useState<RoleId>('new');
  const [ppTargetGDC, setPpTargetGDC] = useState(150000);
  const [ppWbPct, setPpWbPct] = useState(70);
  const [ppMonths, setPpMonths] = useState(10);
  const [ppBracketOverride, setPpBracketOverride] = useState('auto');
  const [ppProductMix, setPpProductMix] = useState<Record<string, number>>(() => ({ ...ROLE_DEFAULTS.new.mix }));
  const [ppFunnelRates, setPpFunnelRates] = useState({ ap: .15, sh: .75, cl: .30, pl: .80 });
  const [ppOverrideRate, setPpOverrideRate] = useState(10);
  const [ppBonusRate, setPpBonusRate] = useState(2);
  const [ppGen2Rate, setPpGen2Rate] = useState(3);
  const [ppTeamMembers, setPpTeamMembers] = useState<TeamMember[]>([]);
  const [ppRecruitTracks, setPpRecruitTracks] = useState<RecruitTrack[]>([]);
  const [ppChannelSpend, setPpChannelSpend] = useState<Record<string, number>>({});
  const [ppAumExisting, setPpAumExisting] = useState(0);
  const [ppAumNew, setPpAumNew] = useState(0);
  const [ppAumTrailPct, setPpAumTrailPct] = useState(1);
  const [ppPnlLevel, setPpPnlLevel] = useState<'ind' | 'team'>('ind');
  const [ppPnlProducers, setPpPnlProducers] = useState(5);
  const [ppPnlAvgGDC, setPpPnlAvgGDC] = useState(100000);
  const [ppPnlPayoutRate, setPpPnlPayoutRate] = useState(65);
  const [ppPnlOpEx, setPpPnlOpEx] = useState(15600);
  const [ppPnlTaxRate, setPpPnlTaxRate] = useState(30);
  const [ppPnlEbitGoal, setPpPnlEbitGoal] = useState(0);
  const [ppPnlNetGoal, setPpPnlNetGoal] = useState(0);
  const [ppStreams, setPpStreams] = useState<Record<string, boolean>>({ personal: true, expanded: false, override: false, aum: false, channels: false });
  const [ppAffAIncome, setPpAffAIncome] = useState(0);
  const [ppAffBIncome, setPpAffBIncome] = useState(0);
  const [ppAffCIncome, setPpAffCIncome] = useState(0);
  const [ppAffDIncome, setPpAffDIncome] = useState(0);
  /* Goal Tracker */
  const [ppGoalIncome, setPpGoalIncome] = useState(150000);
  const [ppGoalAUM, setPpGoalAUM] = useState(5000000);
  const [ppGoalRecruits, setPpGoalRecruits] = useState(4);
  const [ppGoalGDC, setPpGoalGDC] = useState(200000);
  const [ppGoalCases, setPpGoalCases] = useState(60);
  /* Seasonality */
  const [ppSeasonProfile, setPpSeasonProfile] = useState('flat');
  const [ppCustomSeason, setPpCustomSeason] = useState<number[]>([1,1,1,1,1,1,1,1,1,1,1,1]);
  const [ppSeasonGrowthRate, setPpSeasonGrowthRate] = useState(10);
  const [ppSeasonHorizon, setPpSeasonHorizon] = useState(3);
  const [ppSeasonRampMonths, setPpSeasonRampMonths] = useState(0);

  /* ─── LOCAL STORAGE AUTO-SAVE ─── */
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRestoringRef = useRef(false);

  const gatherInputsForSave = useCallback(() => ({
    clientName, age, spouseAge, dep, income, spouseIncome, nw, savings, retirement401k,
    mortgage, debt, existIns, filing, stateRate, riskTolerance, isBiz,
    bizEntityType, bizRevenue, bizExpenses, bizEmployees, bizSeasonality,
    bizRevenueStreams, bizProductMix, bizGrowthRate, bizDebtService, bizKeyPerson, bizSuccessionPlan, bizBuySell,
    housing, transport, food, insurancePmt, debtPmt, otherExp, emMonths,
    replaceYrs, payoffRate, eduPerChild, finalExp, ssBenefit, diPct,
    retireAge, monthlySav, infRate, taxReturn, iulReturn, fiaReturn,
    ss62, ss67, ss70, pension, withdrawalRate, hsaContrib, charitableGiving,
    grossEstate, exemption, estateGrowth, giftingAnnual, willStatus,
    numChildren, avgChildAge, targetCost, eduReturn, current529, monthly529, pace,
    pfFace, pfPrem, pfCash, pfLoan, pfCred, pfYrs,
    ilDB, ilPr, ilCr, ilTx, exSal, ex162, exSERP, exSD,
    cvCRT, cvPO, cvDAF, cvLI, advGoal,
    bcBizValue, bcKeyPersonSalary, bcKeyPersonMult, bcOwners, bcEmployees,
    paLow, paMid, paHigh,
    incomeStreams,
    ppRole, ppTargetGDC, ppWbPct, ppMonths, ppBracketOverride, ppProductMix, ppFunnelRates,
    ppOverrideRate, ppBonusRate, ppGen2Rate, ppTeamMembers, ppRecruitTracks, ppChannelSpend,
    ppAumExisting, ppAumNew, ppAumTrailPct, ppPnlLevel, ppPnlProducers, ppPnlAvgGDC,
    ppPnlPayoutRate, ppPnlOpEx, ppPnlTaxRate, ppPnlEbitGoal, ppPnlNetGoal, ppStreams,
    ppAffAIncome, ppAffBIncome, ppAffCIncome, ppAffDIncome,
    ppGoalIncome, ppGoalAUM, ppGoalRecruits, ppGoalGDC, ppGoalCases,
    ppSeasonProfile, ppCustomSeason, ppSeasonGrowthRate, ppSeasonHorizon, ppSeasonRampMonths,
  }), [
    clientName, age, spouseAge, dep, income, spouseIncome, nw, savings, retirement401k,
    mortgage, debt, existIns, filing, stateRate, riskTolerance, isBiz,
    bizEntityType, bizRevenue, bizExpenses, bizEmployees, bizSeasonality,
    bizRevenueStreams, bizProductMix, bizGrowthRate, bizDebtService, bizKeyPerson, bizSuccessionPlan, bizBuySell,
    housing, transport, food, insurancePmt, debtPmt, otherExp, emMonths,
    replaceYrs, payoffRate, eduPerChild, finalExp, ssBenefit, diPct,
    retireAge, monthlySav, infRate, taxReturn, iulReturn, fiaReturn,
    ss62, ss67, ss70, pension, withdrawalRate, hsaContrib, charitableGiving,
    grossEstate, exemption, estateGrowth, giftingAnnual, willStatus,
    numChildren, avgChildAge, targetCost, eduReturn, current529, monthly529, pace,
    pfFace, pfPrem, pfCash, pfLoan, pfCred, pfYrs,
    ilDB, ilPr, ilCr, ilTx, exSal, ex162, exSERP, exSD,
    cvCRT, cvPO, cvDAF, cvLI, advGoal,
    bcBizValue, bcKeyPersonSalary, bcKeyPersonMult, bcOwners, bcEmployees,
    paLow, paMid, paHigh,
    incomeStreams,
    ppRole, ppTargetGDC, ppWbPct, ppMonths, ppBracketOverride, ppProductMix, ppFunnelRates,
    ppOverrideRate, ppBonusRate, ppGen2Rate, ppTeamMembers, ppRecruitTracks, ppChannelSpend,
    ppAumExisting, ppAumNew, ppAumTrailPct, ppPnlLevel, ppPnlProducers, ppPnlAvgGDC,
    ppPnlPayoutRate, ppPnlOpEx, ppPnlTaxRate, ppPnlEbitGoal, ppPnlNetGoal, ppStreams,
    ppAffAIncome, ppAffBIncome, ppAffCIncome, ppAffDIncome,
    ppGoalIncome, ppGoalAUM, ppGoalRecruits, ppGoalGDC, ppGoalCases,
    ppSeasonProfile, ppCustomSeason, ppSeasonGrowthRate, ppSeasonHorizon, ppSeasonRampMonths,
  ]);

  /* Auto-save to localStorage with 2s debounce */
  useEffect(() => {
    if (isRestoringRef.current) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem('wb-calc-autosave', JSON.stringify(gatherInputsForSave()));
      } catch { /* quota exceeded — ignore */ }
    }, 2000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [gatherInputsForSave]);

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
    /* Advanced Strategies */
    pfFace, pfPrem, pfCash, pfLoan, pfCred, pfYrs,
    ilDB, ilPr, ilCr, ilTx, exSal, ex162, exSERP, exSD,
    cvCRT, cvPO, cvDAF, cvLI, advGoal,
    /* Business Client */
    bcBizValue, bcKeyPersonSalary, bcKeyPersonMult, bcOwners, bcEmployees,
    /* Partner */
    paLow, paMid, paHigh,
    /* Income Streams */
    incomeStreams,
    /* Practice Planning */
    ppRole, ppTargetGDC, ppWbPct, ppMonths, ppBracketOverride, ppProductMix, ppFunnelRates,
    ppOverrideRate, ppBonusRate, ppGen2Rate, ppTeamMembers, ppRecruitTracks, ppChannelSpend,
    ppAumExisting, ppAumNew, ppAumTrailPct, ppPnlLevel, ppPnlProducers, ppPnlAvgGDC,
    ppPnlPayoutRate, ppPnlOpEx, ppPnlTaxRate, ppPnlEbitGoal, ppPnlNetGoal, ppStreams,
    ppAffAIncome, ppAffBIncome, ppAffCIncome, ppAffDIncome,
    ppGoalIncome, ppGoalAUM, ppGoalRecruits, ppGoalGDC, ppGoalCases,
    ppSeasonProfile, ppCustomSeason, ppSeasonGrowthRate, ppSeasonHorizon, ppSeasonRampMonths,
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
    /* Advanced Strategies */
    if (d.pfFace !== undefined) setPfFace(d.pfFace);
    if (d.pfPrem !== undefined) setPfPrem(d.pfPrem);
    if (d.pfCash !== undefined) setPfCash(d.pfCash);
    if (d.pfLoan !== undefined) setPfLoan(d.pfLoan);
    if (d.pfCred !== undefined) setPfCred(d.pfCred);
    if (d.pfYrs !== undefined) setPfYrs(d.pfYrs);
    if (d.ilDB !== undefined) setIlDB(d.ilDB);
    if (d.ilPr !== undefined) setIlPr(d.ilPr);
    if (d.ilCr !== undefined) setIlCr(d.ilCr);
    if (d.ilTx !== undefined) setIlTx(d.ilTx);
    if (d.exSal !== undefined) setExSal(d.exSal);
    if (d.ex162 !== undefined) setEx162(d.ex162);
    if (d.exSERP !== undefined) setExSERP(d.exSERP);
    if (d.exSD !== undefined) setExSD(d.exSD);
    if (d.cvCRT !== undefined) setCvCRT(d.cvCRT);
    if (d.cvPO !== undefined) setCvPO(d.cvPO);
    if (d.cvDAF !== undefined) setCvDAF(d.cvDAF);
    if (d.cvLI !== undefined) setCvLI(d.cvLI);
    if (d.advGoal !== undefined) setAdvGoal(d.advGoal);
    /* Business Client */
    if (d.bcBizValue !== undefined) setBcBizValue(d.bcBizValue);
    if (d.bcKeyPersonSalary !== undefined) setBcKeyPersonSalary(d.bcKeyPersonSalary);
    if (d.bcKeyPersonMult !== undefined) setBcKeyPersonMult(d.bcKeyPersonMult);
    if (d.bcOwners !== undefined) setBcOwners(d.bcOwners);
    if (d.bcEmployees !== undefined) setBcEmployees(d.bcEmployees);
    /* Partner */
    if (d.paLow !== undefined) setPaLow(d.paLow);
    if (d.paMid !== undefined) setPaMid(d.paMid);
    if (d.paHigh !== undefined) setPaHigh(d.paHigh);
    /* Income Streams */
    if (d.incomeStreams !== undefined) setIncomeStreams(d.incomeStreams);
    /* Practice Planning */
    if (d.ppRole !== undefined) setPpRole(d.ppRole);
    if (d.ppTargetGDC !== undefined) setPpTargetGDC(d.ppTargetGDC);
    if (d.ppWbPct !== undefined) setPpWbPct(d.ppWbPct);
    if (d.ppMonths !== undefined) setPpMonths(Math.max(1, d.ppMonths));
    if (d.ppBracketOverride !== undefined) setPpBracketOverride(d.ppBracketOverride);
    if (d.ppProductMix !== undefined) setPpProductMix(d.ppProductMix);
    if (d.ppFunnelRates !== undefined) setPpFunnelRates(d.ppFunnelRates);
    if (d.ppOverrideRate !== undefined) setPpOverrideRate(d.ppOverrideRate);
    if (d.ppBonusRate !== undefined) setPpBonusRate(d.ppBonusRate);
    if (d.ppGen2Rate !== undefined) setPpGen2Rate(d.ppGen2Rate);
    if (d.ppTeamMembers !== undefined) setPpTeamMembers(d.ppTeamMembers);
    if (d.ppRecruitTracks !== undefined) setPpRecruitTracks(d.ppRecruitTracks);
    if (d.ppChannelSpend !== undefined) setPpChannelSpend(d.ppChannelSpend);
    if (d.ppAumExisting !== undefined) setPpAumExisting(d.ppAumExisting);
    if (d.ppAumNew !== undefined) setPpAumNew(d.ppAumNew);
    if (d.ppAumTrailPct !== undefined) setPpAumTrailPct(d.ppAumTrailPct);
    if (d.ppPnlLevel !== undefined) setPpPnlLevel(d.ppPnlLevel);
    if (d.ppPnlProducers !== undefined) setPpPnlProducers(d.ppPnlProducers);
    if (d.ppPnlAvgGDC !== undefined) setPpPnlAvgGDC(d.ppPnlAvgGDC);
    if (d.ppPnlPayoutRate !== undefined) setPpPnlPayoutRate(d.ppPnlPayoutRate);
    if (d.ppPnlOpEx !== undefined) setPpPnlOpEx(d.ppPnlOpEx);
    if (d.ppPnlTaxRate !== undefined) setPpPnlTaxRate(d.ppPnlTaxRate);
    if (d.ppPnlEbitGoal !== undefined) setPpPnlEbitGoal(d.ppPnlEbitGoal);
    if (d.ppPnlNetGoal !== undefined) setPpPnlNetGoal(d.ppPnlNetGoal);
    if (d.ppStreams !== undefined) setPpStreams(d.ppStreams);
    if (d.ppAffAIncome !== undefined) setPpAffAIncome(d.ppAffAIncome);
    if (d.ppAffBIncome !== undefined) setPpAffBIncome(d.ppAffBIncome);
    if (d.ppAffCIncome !== undefined) setPpAffCIncome(d.ppAffCIncome);
    if (d.ppAffDIncome !== undefined) setPpAffDIncome(d.ppAffDIncome);
    /* Goal Tracker */
    if (d.ppGoalIncome !== undefined) setPpGoalIncome(d.ppGoalIncome);
    if (d.ppGoalAUM !== undefined) setPpGoalAUM(d.ppGoalAUM);
    if (d.ppGoalRecruits !== undefined) setPpGoalRecruits(d.ppGoalRecruits);
    if (d.ppGoalGDC !== undefined) setPpGoalGDC(d.ppGoalGDC);
    if (d.ppGoalCases !== undefined) setPpGoalCases(d.ppGoalCases);
    /* Seasonality */
    if (d.ppSeasonProfile !== undefined) setPpSeasonProfile(d.ppSeasonProfile);
    if (d.ppCustomSeason !== undefined) setPpCustomSeason(d.ppCustomSeason);
    if (d.ppSeasonGrowthRate !== undefined) setPpSeasonGrowthRate(d.ppSeasonGrowthRate);
    if (d.ppSeasonHorizon !== undefined) setPpSeasonHorizon(d.ppSeasonHorizon);
    if (d.ppSeasonRampMonths !== undefined) setPpSeasonRampMonths(d.ppSeasonRampMonths);
  };

  /* Auto-restore from localStorage on mount */
  useEffect(() => {
    try {
      const saved = localStorage.getItem('wb-calc-autosave');
      if (saved) {
        isRestoringRef.current = true;
        const d = JSON.parse(saved);
        restoreInputs(d);
        setTimeout(() => { isRestoringRef.current = false; }, 100);
      }
    } catch { /* corrupt data — ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // Compute practice planning data for the report
    const rd = ROLE_DEFAULTS[ppRole] || ROLE_DEFAULTS.new;
    const avgGDC = calcWeightedGDC(ppProductMix, BIE_PRODUCTS);
    const ppBracket = getBracket(ppTargetGDC);
    const ppFunnel = calcProductionFunnel(ppTargetGDC, ppWbPct, ppBracketOverride, avgGDC,
      ppFunnelRates.ap, ppFunnelRates.sh, ppFunnelRates.cl, ppFunnelRates.pl, ppMonths);
    const teamOvr = calcTeamOverride(ppTeamMembers, ppOverrideRate / 100, ppBonusRate / 100, ppGen2Rate / 100);
    const aumIncome = Math.round((ppAumExisting * (ppAumTrailPct / 100)) + (ppAumNew * (ppAumTrailPct / 100) * 0.5));
    const ppRecSummary = calcAllTracksSummary(ppRecruitTracks, ppOverrideRate / 100);
    const ppChMetrics = calcChannelMetrics(ppChannelSpend);
    const overrideInc = ppTeamMembers.length > 0 ? teamOvr.total : ppRecSummary.tOvr;
    const ppPnlResult = calcPnL(ppPnlLevel, ppPnlProducers, ppPnlAvgGDC, ppPnlPayoutRate / 100, ppPnlOpEx, ppPnlTaxRate / 100, ppPnlEbitGoal, ppPnlNetGoal);
    const ppRollUp = calcRollUp({
      role: ppRole, hasPersonal: rd.p === 1, wbTarget: ppFunnel.wbTarget, expTarget: ppFunnel.expTarget,
      overrideIncome: overrideInc, overrideRate: ppOverrideRate / 100, aumIncome,
      affAIncome: ppAffAIncome, affBIncome: ppAffBIncome, affCIncome: ppAffCIncome, affDIncome: ppAffDIncome,
      channelRevAnnual: Math.round(ppChMetrics.tRevMo * 12), streams: ppStreams,
    });

    const printContent = `
      <html><head><title>WealthBridge Report - ${clientName || 'Client'}</title>
      <style>body{font-family:system-ui;padding:40px;color:#1e293b;max-width:900px;margin:0 auto}h1{color:#92400e;border-bottom:2px solid #92400e;padding-bottom:8px}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border:1px solid #e2e8f0;padding:8px;text-align:left}th{background:#f8fafc;font-size:12px}h2{margin-top:24px;color:#334155;border-bottom:1px solid #e2e8f0;padding-bottom:4px}h3{margin-top:16px;color:#475569}.badge{display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600}.section{page-break-inside:avoid}.kpi{display:inline-block;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 16px;margin:4px;text-align:center}.kpi .val{font-size:18px;font-weight:700;color:#334155}.kpi .lbl{font-size:10px;color:#94a3b8}</style>
      </head><body>
      <h1>WealthBridge — Unified Wealth Engine Report</h1>
      <p><strong>Client:</strong> ${clientName || 'N/A'} | <strong>Age:</strong> ${age} | <strong>Income:</strong> $${totalIncome.toLocaleString()} | <strong>Date:</strong> ${new Date().toLocaleDateString()}</p>

      <div class="section">
      <h2>Financial Health Score: ${scorecard.pctScore}% (${scorecard.overall}/${scorecard.maxScore})</h2>
      <table><tr><th>Domain</th><th>Score</th><th>Status</th></tr>
      ${scorecard.domains.map(d => `<tr><td>${d.name}</td><td>${d.score}/3</td><td>${d.score >= 3 ? 'Strong' : d.score >= 2 ? 'Moderate' : 'Needs Attention'}</td></tr>`).join('')}
      </table>
      </div>

      <div class="section">
      <h2>Recommended Products</h2>
      <table><tr><th>Product</th><th>Coverage</th><th>Annual</th><th>Carrier</th><th>Priority</th></tr>
      ${recommendations.map(r => `<tr><td>${r.product}</td><td>${r.coverage}</td><td>${fmt(r.premium)}</td><td>${r.carrier}</td><td>${r.priority}</td></tr>`).join('')}
      <tr style="font-weight:bold;background:#f8fafc"><td>TOTAL</td><td>${recommendations.length} products</td><td>${fmt(totalAnnualPremium)}</td><td colspan="2">${pct(totalIncome > 0 ? totalAnnualPremium / totalIncome : 0)} of income</td></tr>
      </table>
      </div>

      <div class="section">
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
      </div>

      <div style="page-break-before:always"></div>
      <h1>Practice Planning — Business Income Engine</h1>
      <p><strong>Role:</strong> ${ppRole} | <strong>Target GDC:</strong> ${fmt(ppTargetGDC)} | <strong>WB %:</strong> ${pct(ppWbPct / 100)} | <strong>Bracket:</strong> ${ppBracket.l} (${pct(ppBracket.r)})</p>

      <div class="section">
      <h2>Income Roll-Up Dashboard</h2>
      <table><tr><th>Stream</th><th>Annual</th><th>Monthly</th></tr>
      ${ppRollUp.items.map(it => `<tr><td>${it.name}</td><td>${fmt(it.value)}</td><td>${fmt(Math.round(it.value / 12))}</td></tr>`).join('')}
      <tr style="font-weight:bold;background:#f8fafc"><td>TOTAL INCOME (${ppRollUp.streamCount} streams)</td><td>${fmt(ppRollUp.grandTotal)}</td><td>${fmt(Math.round(ppRollUp.grandTotal / 12))}</td></tr>
      </table>
      </div>

      <div class="section">
      <h2>Sales Funnel</h2>
      <table><tr><th>Metric</th><th>Annual</th><th>Monthly</th><th>Weekly</th><th>Daily</th></tr>
      <tr><td>Approaches</td><td>${ppFunnel.approaches}</td><td>${ppFunnel.monthlyApproaches}</td><td>${Math.round(ppFunnel.monthlyApproaches / 4.3)}</td><td>${ppFunnel.dailyApproaches}</td></tr>
      <tr><td>Set (Appointments)</td><td>${ppFunnel.set}</td><td>${Math.round(ppFunnel.set / Math.max(1, ppMonths))}</td><td>—</td><td>—</td></tr>
      <tr><td>Held (Shows)</td><td>${ppFunnel.held}</td><td>${Math.round(ppFunnel.held / Math.max(1, ppMonths))}</td><td>—</td><td>—</td></tr>
      <tr><td>Apps Submitted</td><td>${ppFunnel.apps}</td><td>${ppFunnel.monthlyApps}</td><td>—</td><td>—</td></tr>
      <tr><td>Placed Cases</td><td>${ppFunnel.placed}</td><td>${Math.round(ppFunnel.placed / Math.max(1, ppMonths))}</td><td>—</td><td>—</td></tr>
      </table>
      </div>

      <div class="section">
      <h2>Recruiting Summary</h2>
      <table><tr><th>Metric</th><th>Value</th></tr>
      <tr><td>Total Hires</td><td>${ppRecSummary.tHires}</td></tr>
      <tr><td>Team FYC</td><td>${fmt(ppRecSummary.tFYC)}</td></tr>
      <tr><td>Recruiting EBITDA</td><td>${fmt(ppRecSummary.recEBITDA)}</td></tr>
      <tr><td>Books Transferred</td><td>${fmt(ppRecSummary.tBooks)}</td></tr>
      </table>
      </div>

      <div class="section">
      <h2>P&L Statement (${ppPnlLevel === 'team' ? 'Team' : 'Individual'})</h2>
      <table><tr><th>Line Item</th><th>Amount</th></tr>
      <tr><td>Revenue</td><td>${fmt(ppPnlResult.revenue)}</td></tr>
      <tr><td>COGS (Payout)</td><td>(${fmt(ppPnlResult.cogs)})</td></tr>
      <tr><td>Gross Margin</td><td>${fmt(ppPnlResult.grossMargin)} (${ppPnlResult.gmPct}%)</td></tr>
      <tr><td>Operating Expenses</td><td>(${fmt(ppPnlResult.opEx)})</td></tr>
      <tr style="font-weight:bold"><td>EBITDA</td><td>${fmt(ppPnlResult.ebitda)}</td></tr>
      <tr><td>Tax</td><td>(${fmt(ppPnlResult.tax)})</td></tr>
      <tr style="font-weight:bold;background:#f8fafc"><td>Net Income</td><td>${fmt(ppPnlResult.netIncome)}</td></tr>
      <tr><td>EBITDA Margin</td><td>${ppPnlResult.marginPct}%</td></tr>
      </table>
      </div>

      <div class="section">
      <h2>Channel Marketing ROI</h2>
      <table><tr><th>Channel</th><th>Spend/Mo</th><th>Leads/Mo</th><th>Clients/Mo</th><th>Revenue</th><th>ROI</th></tr>
      ${ppChMetrics.channelResults.filter(c => c.spend > 0).map(c => `<tr><td>${c.name}</td><td>${fmt(c.spend)}</td><td>${c.annLeads}</td><td>${c.annClients}</td><td>${fmt(c.annRev)}</td><td>${c.roi}%</td></tr>`).join('')}
      <tr style="font-weight:bold;background:#f8fafc"><td>TOTAL</td><td>${fmt(ppChMetrics.tSpend * 12)}</td><td>${ppChMetrics.tLeads}</td><td>${ppChMetrics.tClients}</td><td>${fmt(ppChMetrics.annualRev)}</td><td>${ppChMetrics.roiPct}%</td></tr>
      </table>
      </div>

      <p style="margin-top:32px;font-size:11px;color:#94a3b8">Generated by WealthBridge Unified Wealth Engine v7 — ${new Date().toISOString()}</p>
      </body></html>
    `;
    const w = window.open('', '_blank');
    if (w) { w.document.write(printContent); w.document.close(); w.print(); }
  };

  const handleExportCsv = () => {
    toast.info('Generating CSV export...');
    const csvRd = ROLE_DEFAULTS[ppRole] || ROLE_DEFAULTS.new;
    const csvAvgGDC = calcWeightedGDC(ppProductMix, BIE_PRODUCTS);
    const ppFunnel = calcProductionFunnel(ppTargetGDC, ppWbPct, ppBracketOverride, csvAvgGDC,
      ppFunnelRates.ap, ppFunnelRates.sh, ppFunnelRates.cl, ppFunnelRates.pl, ppMonths);
    const csvTeamOvr = calcTeamOverride(ppTeamMembers, ppOverrideRate / 100, ppBonusRate / 100, ppGen2Rate / 100);
    const csvAumIncome = Math.round((ppAumExisting * (ppAumTrailPct / 100)) + (ppAumNew * (ppAumTrailPct / 100) * 0.5));
    const ppRecSummary = calcAllTracksSummary(ppRecruitTracks, ppOverrideRate / 100);
    const ppChMetrics = calcChannelMetrics(ppChannelSpend);
    const csvOverrideInc = ppTeamMembers.length > 0 ? csvTeamOvr.total : ppRecSummary.tOvr;
    const ppPnlResult = calcPnL(ppPnlLevel, ppPnlProducers, ppPnlAvgGDC, ppPnlPayoutRate / 100, ppPnlOpEx, ppPnlTaxRate / 100, ppPnlEbitGoal, ppPnlNetGoal);
    const ppRollUp = calcRollUp({
      role: ppRole, hasPersonal: csvRd.p === 1, wbTarget: ppFunnel.wbTarget, expTarget: ppFunnel.expTarget,
      overrideIncome: csvOverrideInc, overrideRate: ppOverrideRate / 100, aumIncome: csvAumIncome,
      affAIncome: ppAffAIncome, affBIncome: ppAffBIncome, affCIncome: ppAffCIncome, affDIncome: ppAffDIncome,
      channelRevAnnual: Math.round(ppChMetrics.tRevMo * 12), streams: ppStreams,
    });

    const rows: string[][] = [
      ['WealthBridge Unified Wealth Engine Report'],
      ['Client', clientName || 'N/A'],
      ['Date', new Date().toLocaleDateString()],
      [''],
      ['=== FINANCIAL HEALTH ==='],
      ['Score', `${scorecard.pctScore}%`, `${scorecard.overall}/${scorecard.maxScore}`],
      ...scorecard.domains.map(d => [d.name, `${d.score}/3`, d.score >= 3 ? 'Strong' : d.score >= 2 ? 'Moderate' : 'Needs Attention']),
      [''],
      ['=== RECOMMENDED PRODUCTS ==='],
      ['Product', 'Coverage', 'Annual Premium', 'Carrier', 'Priority'],
      ...recommendations.map(r => [r.product, r.coverage, String(r.premium), r.carrier, r.priority]),
      [''],
      ['=== KEY METRICS ==='],
      ['Monthly Cash Flow Surplus', String(cfResult.surplus)],
      ['Protection Gap', String(prResult.gap)],
      ['Years to Retirement', String(grResult.yrs)],
      ['Effective Tax Rate', String(txResult.effectiveRate)],
      ['Estate Tax Exposure', String(esResult.estateTax)],
      ['Education Funding Gap', String(edResult.totalGap)],
      [''],
      ['=== PRACTICE PLANNING ==='],
      ['Role', ppRole],
      ['Target GDC', String(ppTargetGDC)],
      ['WB %', String(ppWbPct)],
      [''],
      ['=== INCOME ROLL-UP ==='],
      ['Stream', 'Annual', 'Monthly'],
      ...ppRollUp.items.map(it => [it.name, String(it.value), String(Math.round(it.value / 12))]),
      ['TOTAL', String(ppRollUp.grandTotal), String(Math.round(ppRollUp.grandTotal / 12))],
      [''],
      ['=== SALES FUNNEL ==='],
      ['Metric', 'Annual', 'Monthly', 'Weekly', 'Daily'],
      ['Approaches', String(ppFunnel.approaches), String(ppFunnel.monthlyApproaches), String(Math.round(ppFunnel.monthlyApproaches / 4.3)), String(ppFunnel.dailyApproaches)],
      ['Set', String(ppFunnel.set), String(Math.round(ppFunnel.set / Math.max(1, ppMonths))), '', ''],
      ['Held', String(ppFunnel.held), String(Math.round(ppFunnel.held / Math.max(1, ppMonths))), '', ''],
      ['Apps', String(ppFunnel.apps), String(ppFunnel.monthlyApps), '', ''],
      ['Placed', String(ppFunnel.placed), String(Math.round(ppFunnel.placed / Math.max(1, ppMonths))), '', ''],
      [''],
      ['=== RECRUITING ==='],
      ['Total Hires', String(ppRecSummary.tHires)],
      ['Team FYC', String(ppRecSummary.tFYC)],
      ['Recruiting EBITDA', String(ppRecSummary.recEBITDA)],
      ['Books Transferred', String(ppRecSummary.tBooks)],
      [''],
      ['=== P&L ==='],
      ['Revenue', String(ppPnlResult.revenue)],
      ['COGS', String(ppPnlResult.cogs)],
      ['OpEx', String(ppPnlResult.opEx)],
      ['EBITDA', String(ppPnlResult.ebitda)],
      ['Tax', String(ppPnlResult.tax)],
      ['Net Income', String(ppPnlResult.netIncome)],
      [''],
      ['=== CHANNELS ==='],
      ['Channel', 'Spend/Mo', 'Leads/Mo', 'Clients/Mo', 'Revenue', 'ROI'],
      ...ppChMetrics.channelResults.filter(c => c.spend > 0).map(c => [c.name, String(c.spend), String(c.annLeads), String(c.annClients), String(c.annRev), c.roi + '%']),
    ];

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `WealthBridge-Report-${clientName || 'Client'}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded!');
  };

  /* ═══ COMPUTED RESULTS ═══ */
  const totalIncome = income + spouseIncome;
  const grossMonthly = Math.round(totalIncome / 12);
  const taxRate = useMemo(() => getBracketRate(totalIncome, filing === 'mfj' ? RATES.bracketsMFJ : RATES.bracketsSingle) + stateRate, [totalIncome, filing, stateRate]);

  const scores = useMemo(() => {
    const s: Record<string, number> = {};
    const sr = totalIncome > 0 ? (grossMonthly - housing - transport - food - insurancePmt - debtPmt - otherExp) / grossMonthly : 0;
    let cashBase = sr >= 0.2 ? 3 : sr >= 0.1 ? 2 : sr > 0 ? 1 : 0;
    // Business: penalize if seasonal with thin margins, reward diversified streams
    if (isBiz) {
      const margin = bizRevenue > 0 ? (bizRevenue - bizExpenses) / bizRevenue : 0;
      if (bizSeasonality !== 'even' && margin < 0.15) cashBase = Math.max(0, cashBase - 1);
      if (bizRevenueStreams >= 3 && margin >= 0.2) cashBase = Math.min(3, cashBase + 1);
      if (bizDebtService > bizRevenue * 0.3) cashBase = Math.max(0, cashBase - 1);
    }
    s.cash = cashBase;
    const dimeNeed = dep > 0 ? income * 10 + mortgage + debt + dep * 50000 + 25000 : income * 6 + debt;
    let protectBase = existIns >= dimeNeed ? 3 : existIns >= dimeNeed * 0.5 ? 2 : existIns > 0 ? 1 : 0;
    // Business: key person risk and buy-sell gap
    if (isBiz) {
      if (bizKeyPerson && !bizBuySell) protectBase = Math.max(0, protectBase - 1);
      if (bizBuySell) protectBase = Math.min(3, protectBase + (protectBase < 3 ? 1 : 0));
    }
    s.protect = protectBase;
    s.growth = monthlySav >= grossMonthly * 0.15 ? 3 : monthlySav >= grossMonthly * 0.1 ? 2 : monthlySav > 0 ? 1 : 0;
    // Business: high growth rate with reinvestment boosts growth score
    if (isBiz && bizGrowthRate >= 0.15 && bizRevenue > 0) s.growth = Math.min(3, s.growth + 1);
    s.retire = retirement401k >= totalIncome * 3 ? 3 : retirement401k >= totalIncome ? 2 : retirement401k > 0 ? 1 : 0;
    let taxBase = retirement401k >= 23500 && hsaContrib > 0 ? 3 : retirement401k >= 10000 ? 2 : 1;
    // Business: entity structure optimization (S-Corp/C-Corp better than sole prop for tax)
    if (isBiz) {
      if (bizEntityType === 'scorp' || bizEntityType === 'ccorp') taxBase = Math.min(3, taxBase + 1);
      if (bizEntityType === 'sole_prop' && bizRevenue > 100000) taxBase = Math.max(0, taxBase - 1);
    }
    s.tax = taxBase;
    let estateBase = willStatus === 'trust' ? 3 : willStatus === 'will' ? 2 : 1;
    // Business: succession plan impact on estate score
    if (isBiz) {
      if (bizSuccessionPlan === 'none') estateBase = Math.max(0, estateBase - 1);
      if (bizSuccessionPlan === 'documented' && bizBuySell) estateBase = Math.min(3, estateBase + 1);
    }
    s.estate = estateBase;
    s.edu = dep === 0 ? 3 : current529 >= targetCost * dep * 0.5 ? 3 : current529 > 0 ? 2 : 1;
    return s;
  }, [totalIncome, grossMonthly, housing, transport, food, insurancePmt, debtPmt, otherExp,
    dep, income, mortgage, debt, existIns, monthlySav, retirement401k, hsaContrib, willStatus, current529, targetCost,
    isBiz, bizRevenue, bizExpenses, bizSeasonality, bizRevenueStreams, bizDebtService,
    bizKeyPerson, bizBuySell, bizGrowthRate, bizEntityType, bizSuccessionPlan]);

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

  /* ─── PRACTICE INCOME CROSS-LINK ─── */
  const practiceIncome = useMemo(() => {
    const rd = ROLE_DEFAULTS[ppRole] || ROLE_DEFAULTS.new;
    const avgGDC = calcWeightedGDC(ppProductMix, BIE_PRODUCTS);
    const funnel = calcProductionFunnel(ppTargetGDC, ppWbPct, ppBracketOverride, avgGDC,
      ppFunnelRates.ap, ppFunnelRates.sh, ppFunnelRates.cl, ppFunnelRates.pl, ppMonths);
    const teamOvr = calcTeamOverride(ppTeamMembers, ppOverrideRate / 100, ppBonusRate / 100, ppGen2Rate / 100);
    const aumIncome = Math.round((ppAumExisting * (ppAumTrailPct / 100)) + (ppAumNew * (ppAumTrailPct / 100) * 0.5));
    const recSummary = calcAllTracksSummary(ppRecruitTracks, ppOverrideRate / 100);
    const chMetrics = calcChannelMetrics(ppChannelSpend);
    const overrideInc = ppTeamMembers.length > 0 ? teamOvr.total : recSummary.tOvr;
    const pnl = calcPnL(ppPnlLevel, ppPnlProducers, ppPnlAvgGDC, ppPnlPayoutRate / 100, ppPnlOpEx, ppPnlTaxRate / 100, ppPnlEbitGoal, ppPnlNetGoal);
    const rollUp = calcRollUp({
      role: ppRole, hasPersonal: rd.p === 1, wbTarget: funnel.wbTarget, expTarget: funnel.expTarget,
      overrideIncome: overrideInc, overrideRate: ppOverrideRate / 100, aumIncome,
      affAIncome: ppAffAIncome, affBIncome: ppAffBIncome, affCIncome: ppAffCIncome, affDIncome: ppAffDIncome,
      channelRevAnnual: Math.round(chMetrics.tRevMo * 12), streams: ppStreams,
    });
    return {
      annualGDC: funnel.wbTarget,
      annualAUM: aumIncome,
      annualOverride: overrideInc,
      annualExpanded: funnel.expTarget,
      annualChannelRev: Math.round(chMetrics.tRevMo * 12),
      grandTotal: rollUp.grandTotal,
      streamCount: rollUp.streamCount,
      items: rollUp.items,
      pnlNetIncome: pnl.netIncome,
      pnlEbitda: pnl.ebitda,
      pnlRevenue: pnl.revenue,
      monthlyGDC: funnel.monthlyGDC,
      monthlyNet: Math.round(pnl.netIncome / 12),
    };
  }, [ppRole, ppTargetGDC, ppWbPct, ppBracketOverride, ppProductMix, ppFunnelRates, ppMonths,
    ppTeamMembers, ppOverrideRate, ppBonusRate, ppGen2Rate,
    ppAumExisting, ppAumNew, ppAumTrailPct, ppRecruitTracks, ppChannelSpend,
    ppPnlLevel, ppPnlProducers, ppPnlAvgGDC, ppPnlPayoutRate, ppPnlOpEx, ppPnlTaxRate,
    ppPnlEbitGoal, ppPnlNetGoal, ppStreams,
    ppAffAIncome, ppAffBIncome, ppAffCIncome, ppAffDIncome]);

  /* ─── SHARED PANEL PROPS ─── */
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
    expandedPhases, setExpandedPhases,
    totalIncome, scores, scorecard, recommendations, totalAnnualPremium,
    cfResult, prResult, grResult, rtResult, txResult, esResult, edResult, horizonData,
    practiceIncome,
  };

  /* ─── PRACTICE PLANNING PROPS ─── */
  const practiceProps: PracticeProps = {
    role: ppRole, setRole: setPpRole,
    targetGDC: ppTargetGDC, setTargetGDC: setPpTargetGDC,
    wbPct: ppWbPct, setWbPct: setPpWbPct,
    months: ppMonths, setMonths: setPpMonths,
    bracketOverride: ppBracketOverride, setBracketOverride: setPpBracketOverride,
    productMix: ppProductMix, setProductMix: setPpProductMix,
    funnelRates: ppFunnelRates, setFunnelRates: setPpFunnelRates,
    overrideRate: ppOverrideRate, setOverrideRate: setPpOverrideRate,
    bonusRate: ppBonusRate, setBonusRate: setPpBonusRate,
    gen2Rate: ppGen2Rate, setGen2Rate: setPpGen2Rate,
    teamMembers: ppTeamMembers, setTeamMembers: setPpTeamMembers,
    recruitTracks: ppRecruitTracks, setRecruitTracks: setPpRecruitTracks,
    channelSpend: ppChannelSpend, setChannelSpend: setPpChannelSpend,
    aumExisting: ppAumExisting, setAumExisting: setPpAumExisting,
    aumNew: ppAumNew, setAumNew: setPpAumNew,
    aumTrailPct: ppAumTrailPct, setAumTrailPct: setPpAumTrailPct,
    pnlLevel: ppPnlLevel, setPnlLevel: setPpPnlLevel,
    pnlProducers: ppPnlProducers, setPnlProducers: setPpPnlProducers,
    pnlAvgGDC: ppPnlAvgGDC, setPnlAvgGDC: setPpPnlAvgGDC,
    pnlPayoutRate: ppPnlPayoutRate, setPnlPayoutRate: setPpPnlPayoutRate,
    pnlOpEx: ppPnlOpEx, setPnlOpEx: setPpPnlOpEx,
    pnlTaxRate: ppPnlTaxRate, setPnlTaxRate: setPpPnlTaxRate,
    pnlEbitGoal: ppPnlEbitGoal, setPnlEbitGoal: setPpPnlEbitGoal,
    pnlNetGoal: ppPnlNetGoal, setPnlNetGoal: setPpPnlNetGoal,
    streams: ppStreams, setStreams: setPpStreams,
    affAIncome: ppAffAIncome, setAffAIncome: setPpAffAIncome,
    affBIncome: ppAffBIncome, setAffBIncome: setPpAffBIncome,
    affCIncome: ppAffCIncome, setAffCIncome: setPpAffCIncome,
    affDIncome: ppAffDIncome, setAffDIncome: setPpAffDIncome,
    /* Goal Tracker */
    goalIncome: ppGoalIncome, setGoalIncome: setPpGoalIncome,
    goalAUM: ppGoalAUM, setGoalAUM: setPpGoalAUM,
    goalRecruits: ppGoalRecruits, setGoalRecruits: setPpGoalRecruits,
    goalGDC: ppGoalGDC, setGoalGDC: setPpGoalGDC,
    goalCases: ppGoalCases, setGoalCases: setPpGoalCases,
    /* Seasonality */
    seasonProfile: ppSeasonProfile, setSeasonProfile: setPpSeasonProfile,
    customSeason: ppCustomSeason, setCustomSeason: setPpCustomSeason,
    seasonGrowthRate: ppSeasonGrowthRate, setSeasonGrowthRate: setPpSeasonGrowthRate,
    seasonHorizon: ppSeasonHorizon, setSeasonHorizon: setPpSeasonHorizon,
    seasonRampMonths: ppSeasonRampMonths, setSeasonRampMonths: setPpSeasonRampMonths,
  };

  /* ═══ RENDER ═══ */
  return (
    <AppShell title="Wealth Engine">
    <div className="flex min-h-full bg-background relative">
      {/* ─── MOBILE SIDEBAR OVERLAY ─── */}
      {calcSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setCalcSidebarOpen(false)} role="presentation" aria-hidden="true" />
      )}

      {/* ─── CALCULATOR SIDEBAR ─── */}
      <aside role="complementary" aria-label="Calculator navigation sidebar" className={`
        fixed lg:sticky lg:top-0 z-50 lg:z-auto
        w-56 shrink-0 border-r border-border bg-card flex flex-col
        h-full lg:h-auto lg:max-h-screen lg:self-start
        transition-transform duration-200 ease-in-out
        ${calcSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-3 border-b border-border/50 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-primary" />
              <span className="text-sm font-bold text-foreground">WealthBridge</span>
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">Unified Wealth Engine v7</p>
          </div>
          <Button variant="ghost" size="icon" className="lg:hidden h-7 w-7" onClick={() => setCalcSidebarOpen(false)}>
            <PanelLeftClose className="w-4 h-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <nav className="p-2 space-y-3" role="navigation" aria-label="Wealth Engine panels">
            {NAV_SECTIONS.map(section => (
              <div key={section.group} role="group" aria-label={section.group}>
                <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-2 mb-1" id={`nav-group-${section.group.toLowerCase().replace(/\s+/g, '-')}`}>{section.group}</p>
                <div role="list" aria-labelledby={`nav-group-${section.group.toLowerCase().replace(/\s+/g, '-')}`}>
                  {section.items.map(item => (
                    <button key={item.id} role="listitem" onClick={() => { setActivePanel(item.id); setCalcSidebarOpen(false); }}
                      aria-label={`Navigate to ${item.label} panel`}
                      aria-current={activePanel === item.id ? 'page' : undefined}
                      tabIndex={0}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                        activePanel === item.id
                          ? 'bg-primary/10 text-primary border border-primary/30'
                          : 'text-muted-foreground hover:bg-background hover:text-foreground border border-transparent'
                      }`}>
                      {item.icon}
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </ScrollArea>
        <div className="p-3 border-t border-border/50 bg-background space-y-2">
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
          <div className="flex items-center justify-between pt-1 border-t border-border/30">
            <span className="text-[10px] text-muted-foreground/50">
              {sessionsQuery.data?.length || 0}/10 slots
            </span>
            <button onClick={handleExportPdf} className="text-[10px] text-muted-foreground/50 hover:text-primary transition-colors" title="Print Report">
              Print
            </button>
          </div>
          <div className="text-center text-[9px] text-muted-foreground/30">v7.6 · Unified Wealth Engine</div>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ─── */}
      <main className="flex-1 min-w-0" role="main" aria-label="Calculator panel content">
        <div className="max-w-5xl mx-auto p-3 sm:p-4 lg:p-6">

          {/* ─── TOOLBAR ─── */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4 bg-card rounded-lg border border-border px-3 py-2">
            <div className="flex items-center gap-2">
              {/* Mobile: open calculator sidebar */}
              <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8 shrink-0" onClick={() => setCalcSidebarOpen(true)}>
                <PanelLeftOpen className="w-4 h-4" />
              </Button>
              <div className="text-sm text-muted-foreground">
                {activeSessionId ? (
                  <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Saved</span>
                ) : (
                  <span className="text-muted-foreground/60">Unsaved</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button variant="outline" size="sm" onClick={handleSave} disabled={saveMut.isPending || updateMut.isPending}
                className="text-xs gap-1 h-7">
                <Save className="w-3 h-3" /> <span className="hidden sm:inline">{activeSessionId ? 'Update' : 'Save'}</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => { if (!user) { toast.error('Please sign in to load sessions'); return; } setShowLoadDialog(true); }}
                className="text-xs gap-1 h-7">
                <FolderOpen className="w-3 h-3" /> <span className="hidden sm:inline">Load</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPdf}
                className="text-xs gap-1 h-7">
                <Download className="w-3 h-3" /> <span className="hidden sm:inline">PDF</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCsv}
                className="text-xs gap-1 h-7" aria-label="Export as CSV">
                <Download className="w-3 h-3" /> <span className="hidden sm:inline">CSV</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                const input = document.createElement('input');
                input.type = 'file'; input.accept = '.json';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    try {
                      const data = JSON.parse(ev.target?.result as string);
                      restoreInputs(data);
                      toast.success('Session imported from JSON');
                    } catch { toast.error('Invalid JSON file'); }
                  };
                  reader.readAsText(file);
                };
                input.click();
              }} className="text-xs gap-1 h-7" aria-label="Import session from JSON file">
                <Upload className="w-3 h-3" /> <span className="hidden sm:inline">Import</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                const json = JSON.stringify(gatherInputs(), null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `WealthBridge-${clientName || 'Session'}-${new Date().toISOString().slice(0,10)}.json`;
                a.click(); URL.revokeObjectURL(url);
                toast.success('JSON exported!');
              }} className="text-xs gap-1 h-7" aria-label="Export session as JSON">
                <Download className="w-3 h-3" /> <span className="hidden sm:inline">JSON</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => {
                if (confirm('Reset all inputs to defaults? This cannot be undone.')) {
                  try { localStorage.removeItem('wb-calc-autosave'); } catch {}
                  window.location.reload();
                }
              }} className="text-xs gap-1 h-7 text-red-400 hover:text-red-300" aria-label="Reset all inputs to defaults">
                <RotateCcw className="w-3 h-3" /> <span className="hidden sm:inline">Reset</span>
              </Button>
            </div>
          </div>

          {/* ─── CALC NARRATOR ─── */}
          <div className="mb-4">
            <CalcNarrator activePanel={activePanel} onNavigate={(id) => setActivePanel(id as PanelId)} />
          </div>

          {/* ─── WELCOME TIP ─── */}
          {showWelcome && (
            <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-start gap-3">
              <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground mb-1">Welcome to the Unified Wealth Engine</p>
                <p className="text-xs text-muted-foreground">Start by entering your client profile, then explore each planning domain. All calculations update in real-time. Use Save/Load to manage multiple client scenarios, and Export to generate reports.</p>
              </div>
              <button onClick={() => { setShowWelcome(false); try { localStorage.setItem('wb-welcome-dismissed', 'true'); } catch {} }}
                className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ═══ PANEL RENDERING ═══ */}
          {activePanel === 'profile' && <ProfilePanel {...pp} />}
          {activePanel === 'cash' && <CashFlowPanel {...pp} />}
          {activePanel === 'protect' && <ProtectionPanel {...pp} />}
          {activePanel === 'grow' && <GrowthPanel {...pp} />}
          {activePanel === 'retire' && <RetirementPanel {...pp} />}
          {activePanel === 'tax' && <TaxPanel {...pp} />}
          {activePanel === 'estate' && <EstatePanel {...pp} />}
          {activePanel === 'edu' && <EducationPanel {...pp} />}
          {activePanel === 'advanced' && <AdvancedStrategiesPanel
            pfFace={pfFace} setPfFace={setPfFace} pfPrem={pfPrem} setPfPrem={setPfPrem}
            pfCash={pfCash} setPfCash={setPfCash} pfLoan={pfLoan} setPfLoan={setPfLoan}
            pfCred={pfCred} setPfCred={setPfCred} pfYrs={pfYrs} setPfYrs={setPfYrs}
            ilDB={ilDB} setIlDB={setIlDB} ilPr={ilPr} setIlPr={setIlPr}
            ilCr={ilCr} setIlCr={setIlCr} ilTx={ilTx} setIlTx={setIlTx}
            exSal={exSal} setExSal={setExSal} ex162={ex162} setEx162={setEx162}
            exSERP={exSERP} setExSERP={setExSERP} exSD={exSD} setExSD={setExSD}
            cvCRT={cvCRT} setCvCRT={setCvCRT} cvPO={cvPO} setCvPO={setCvPO}
            cvDAF={cvDAF} setCvDAF={setCvDAF} cvLI={cvLI} setCvLI={setCvLI}
            advGoal={advGoal} setAdvGoal={setAdvGoal}
          />}
          {activePanel === 'bizclient' && <BusinessClientPanel
            bcBizValue={bcBizValue} setBcBizValue={setBcBizValue}
            bcKeyPersonSalary={bcKeyPersonSalary} setBcKeyPersonSalary={setBcKeyPersonSalary}
            bcKeyPersonMult={bcKeyPersonMult} setBcKeyPersonMult={setBcKeyPersonMult}
            bcOwners={bcOwners} setBcOwners={setBcOwners}
            bcEmployees={bcEmployees} setBcEmployees={setBcEmployees}
            age={age}
          />}
          {activePanel === 'costben' && <CostBenefitPanel {...pp} horizonData={horizonData} />}
          {activePanel === 'compare' && <StrategyComparePanel {...pp} savedScenarios={
            (sessionsQuery.data || []).map((s: any) => ({
              id: s.id,
              name: s.name,
              inputsJson: typeof s.inputsJson === 'string' ? JSON.parse(s.inputsJson) : (s.inputsJson || {}),
              resultsJson: typeof s.resultsJson === 'string' ? JSON.parse(s.resultsJson) : s.resultsJson,
              updatedAt: s.updatedAt,
            }))
          } />}
          {activePanel === 'summary' && <SummaryPanel {...pp} />}
          {activePanel === 'timeline' && <ActionPlanPanel {...pp} />}
          {activePanel === 'impl_timeline' && <TimelinePanel {...pp} />}
          {activePanel === 'partner' && <PartnerPanel paLow={paLow} setPaLow={setPaLow} paMid={paMid} setPaMid={setPaMid} paHigh={paHigh} setPaHigh={setPaHigh} />}
          {activePanel === 'income' && <IncomeStreamsPanel incomeStreams={incomeStreams} setIncomeStreams={setIncomeStreams} scores={pp.scores} />}
          {activePanel === 'refs' && <ReferencesPanel />}

          {/* ═══ PRACTICE PLANNING PANELS ═══ */}
          {activePanel === 'myplan' && <MyPlanPanel {...practiceProps} />}
          {activePanel === 'gdcbrackets' && <GDCBracketsPanel {...practiceProps} />}
          {activePanel === 'products' && <ProductsPanel {...practiceProps} />}
          {activePanel === 'salesfunnel' && <SalesFunnelPanel {...practiceProps} />}
          {activePanel === 'recruiting' && <RecruitingPanel {...practiceProps} />}
          {activePanel === 'channels' && <ChannelsPanel {...practiceProps} />}
          {activePanel === 'dashboard' && <DashboardPanel {...practiceProps} />}
          {activePanel === 'pnl' && <PnLPanel {...practiceProps} />}
          {activePanel === 'goaltracker' && <GoalTrackerPanel {...practiceProps} />}
          {activePanel === 'monthlyproduction' && <MonthlyProductionPanel {...practiceProps} />}

          {/* ═══ FINRA/SIPC COMPLIANCE DISCLAIMER ═══ */}
          <div className="mt-8 rounded-lg border border-border/50 bg-card/50 p-4 text-[10px] text-muted-foreground/60 leading-relaxed space-y-2">
            <p className="font-semibold text-muted-foreground/80 text-xs">Important Disclosures</p>
            <p>This calculator is designed for educational and illustrative purposes only and does not constitute financial, tax, legal, or investment advice. All projections are hypothetical, based on the assumptions and inputs you provide, and are not guarantees of future results. Actual outcomes may vary significantly.</p>
            <p>Securities offered through registered broker-dealers. Investment advisory services offered through registered investment advisers. Insurance products offered through licensed insurance agents. Check the background of your financial professional on FINRA's BrokerCheck. Member FINRA/SIPC.</p>
            <p>National Life Group® products are issued by Life Insurance Company of the Southwest, National Life Insurance Company, and their affiliates. Products and their features may not be available in all states. Guarantees are subject to the claims-paying ability of the issuing company.</p>
            <p>Tax information provided is general in nature and should not be construed as tax advice. Consult a qualified tax professional regarding your specific situation. IRS Circular 230 Disclosure: To ensure compliance with requirements imposed by the IRS, we inform you that any U.S. federal tax advice contained herein is not intended or written to be used, and cannot be used, for the purpose of avoiding penalties under the Internal Revenue Code.</p>
          </div>

        </div>
      </main>

      {/* ─── SAVE DIALOG ─── */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent aria-describedby="save-desc">
          <DialogHeader>
            <DialogTitle>Save Session</DialogTitle>
            <DialogDescription id="save-desc">Save your current calculator inputs as a named session for later retrieval. Sessions are stored securely and can be loaded from any device.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="session-name" className="text-sm text-muted-foreground">Session Name</label>
            <Input id="session-name" value={sessionName} onChange={e => setSessionName(e.target.value)} placeholder="My Financial Plan" aria-label="Session name" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveConfirm} disabled={saveMut.isPending || !sessionName.trim()}>
              {saveMut.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── LOAD DIALOG ─── */}
      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent aria-describedby="load-desc">
          <DialogHeader>
            <DialogTitle>Load Session</DialogTitle>
            <DialogDescription id="load-desc">Select a previously saved session to restore its calculator inputs. Loading a session will replace your current inputs.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto" role="list" aria-label="Saved sessions">
            {sessionsQuery.data?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No saved sessions yet.</p>
            )}
            {sessionsQuery.data?.map((s: any) => (
              <div key={s.id} role="listitem" className="flex items-center justify-between p-2 rounded-lg border border-border hover:bg-card transition-colors">
                <div className="cursor-pointer flex-1" onClick={() => handleLoad(s.id)}>
                  <p className="text-sm font-medium text-foreground">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{new Date(s.updatedAt).toLocaleDateString()}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => deleteMut.mutate({ id: s.id })}
                  className="text-red-400 hover:text-red-300 h-7 w-7 p-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </AppShell>
  );
}
