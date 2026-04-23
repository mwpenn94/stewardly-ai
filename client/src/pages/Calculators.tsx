/* WealthBridge Unified Wealth Engine v7 — Orchestrator */
import { authFetch } from "@/lib/sessionToken";
import { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { WealthEngineProvider, type WealthEngineData, type AdvancedStrategiesCascade, type PracticeManagementCascade, GENERAL_DEFAULTS, EMPTY_ADVANCED_CASCADE, EMPTY_CASCADE_BRIDGE, EMPTY_PRACTICE_CASCADE, computeHolisticBridge } from '@/contexts/WealthEngineContext';
import { useCascadeToast } from '@/hooks/useCascadeToast';

/* Thin bridge so the hook runs inside the component tree */
function CascadeToastBridge({ data }: { data: WealthEngineData }) {
  useCascadeToast(data);
  return null;
}
import AppShell from '@/components/AppShell';
import { useAuth } from '@/_core/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { trpc } from '@/lib/trpc';
import {
  User, DollarSign, Shield, TrendingUp, Clock, Building2, GraduationCap,
  Scale, BarChart3, GitCompare, FileText, ListChecks, BookOpen,
  Calculator, CheckCircle2, Save, FolderOpen, Download, Trash2, Upload,
  Target, Layers, Package, Filter, Users, Megaphone, LayoutDashboard, Receipt,
  Flag, PanelLeftClose, PanelLeftOpen,
  Briefcase, Gem, Handshake, RotateCcw, X, Info,
  Landmark, Percent, Dices, FileCheck, Wallet, Gavel, CreditCard, Gift, Share2,
  Database, Zap, Sparkles, ShieldCheck,
  ClipboardList, FileBarChart, UsersRound, Search, Star,
  Banknote, Crown, SlidersHorizontal,
  Home, Columns2, GripVertical, HelpCircle, Keyboard, Undo2, Redo2, MoreHorizontal
} from 'lucide-react';

import {
  RATES, getBracketRate,
  computeScorecard, buildRecommendations, buildHorizonData,
  calcCashFlow, calcProtection, calcGrowth, calcRetirement, calcTax, calcEstate, calcEducation,
  calcIncomeStreams,
} from './calculators/engine';
import { fmt, fmtSm, pct } from './calculators/format';
import type { IncomeStream } from './calculators/engine';

/* ─── Lazy-loaded panel groups ─── */
import { ProfilePanel, CashFlowPanel, ProtectionPanel, GrowthPanel } from './calculators/PanelsA';
import { RetirementPanel, TaxPanel, EstatePanel, EducationPanel } from './calculators/PanelsB';
import { CostBenefitPanel, StrategyComparePanel, SummaryPanel, ActionPlanPanel, ReferencesPanel } from './calculators/PanelsC';
import { AdvancedStrategiesPanel, BusinessClientPanel, TimelinePanel, PartnerPanel } from './calculators/PanelsE';
import { IncomeStreamsPanel } from './calculators/PanelsF';
// CalcNarrator removed from global rendering — available as contextual helper
import { MyPlanPanel, GDCBracketsPanel, ProductsPanel, SalesFunnelPanel, RecruitingPanel, ChannelsPanel, DashboardPanel, PnLPanel, GoalTrackerPanel, MonthlyProductionPanel, type PracticeProps } from './calculators/PanelsD';
import { AUMOverrideCascadePanel, AUMPipelinePanel, AffiliatePipelinePanel } from './calculators/PanelsG';
import { ProductionOptPanel, ChannelDiversPanel, MarketingROIPanel, RecruitingFunnelPanel, PnLBusinessEconomicsPanel, GDCOverrideOptPanel } from './calculators/PanelsH';
import { BalanceSheetPanel, DebtManagementPanel, TrustEngineeringPanel, GovernanceIPSPanel, MonteCarloPanel, StockCompPanel } from './calculators/PanelsI';
import { PremiumFinancingPanel, ILITTrustPanel, ExecCompPanel, CharitablePlanningPanel, DueDiligencePanel } from './calculators/PanelsJ';
import { ClientWealthHub } from './calculators/ClientWealthHub';
import { AdvancedStrategiesHub } from './calculators/AdvancedStrategiesHub';
import {
  ROLE_DEFAULTS, calcWeightedGDC, calcProductionFunnel, calcTeamOverride,
  calcChannelMetrics, calcPnL, calcRollUp, calcDashboard, calcAllTracksSummary,
  PRODUCTS as BIE_PRODUCTS, getBracket,
  type RoleId, type TeamMember, type RecruitTrack,
} from './calculators/practiceEngine';
import { SEOHead } from "@/components/SEOHead";
import { ShareButton } from "@/components/sharing/ShareKit";
import { usePanelOrder } from '@/hooks/usePanelOrder';
import { usePanelAnalytics } from '@/hooks/usePanelAnalytics';
import { useUndoHistory } from '@/hooks/useUndoHistory';
import { SessionReplayTimeline } from '@/components/SessionReplayTimeline';
import type { TimelineEntry } from '@/components/SessionReplayTimeline';
import { CompareDiffOverlay, type MetricSnapshot } from '@/components/CompareDiffOverlay';
import { WealthEngineOnboarding, type OnboardingResult } from './calculators/WealthEngineOnboarding';
import { ComplianceChecklist } from './calculators/ComplianceChecklist';
import { PersonaReportGenerator } from './calculators/PersonaReportGenerator';
import { MultiClientComparison } from './calculators/MultiClientComparison';
import { CascadeFlowDiagram } from './calculators/CascadeFlowDiagram';
// BenchmarkGrid and DisclosureSection moved to individual panel components
/* ─── Lazy-loaded new advisory & data panels ─── */
const WePlanningHierarchy = lazy(() => import('./wealth-engine/PlanningHierarchyPanel'));
const WeAdvancedWorkflows = lazy(() => import('./wealth-engine/AdvancedWorkflowsPanel'));
const WeStrategyArchetypes = lazy(() => import('./wealth-engine/StrategyArchetypesPanel'));
const WeUnifiedClientPlan = lazy(() => import('./wealth-engine/UnifiedClientPlanPanel'));
const WeFirmComparison = lazy(() => import('./wealth-engine/FirmComparisonPanel'));
const WeCascadeAlerts = lazy(() => import('./wealth-engine/CascadeAlertsPanel'));
const WeFinancialDataHub = lazy(() => import('./wealth-engine/FinancialDataHub'));
const ScenarioComparisonLazy = lazy(() => import('./calculators/ScenarioComparison'));
const PFRWizardLazy = lazy(() => import('./calculators/PFRWizard'));

/* ═══ PANEL TYPE DEFINITIONS ═══ */
type PanelId = 'profile' | 'cash' | 'protect' | 'grow' | 'retire' | 'tax' | 'estate' | 'edu' |
  'advanced' | 'bizclient' | 'costben' | 'compare' | 'summary' | 'timeline' | 'impl_timeline' | 'refs' |
  'myplan' | 'gdcbrackets' | 'products' | 'salesfunnel' | 'recruiting' | 'channels' | 'dashboard' | 'pnl' |
  'goaltracker' | 'monthlyproduction' | 'partner' | 'income' |
  'aumoverride' | 'aumpipeline' | 'affiliatepipeline' |
  'prodopt' | 'chandivers' | 'mktgroi' | 'recruitfunnel' | 'pnlbizecon' | 'gdcoverride' | /* legacy IDs kept for deep-link compat */
  'balancesheet' | 'debtmgmt' | 'trusteng' | 'governance' | 'montecarlo' | 'stockcomp' |
  'premfin' | 'ilitrust' | 'execcomp' | 'charitable' | 'duediligence' |
  'planning-hierarchy' | 'advanced-workflows' | 'strategy-archetypes' | 'unified-client-plan' | 'firm-comparison' | 'cascade-alerts' | 'financial-data-hub' | 'client-wealth-hub' | 'advanced-strategies-hub' | 'scenario-comparison' | 'pfr-wizard' |
  'compliance-checklist' | 'generate-report' | 'multi-compare' | 'cascade-flow';

const NAV_SECTIONS: { group: string; items: { id: PanelId; label: string; icon: React.ReactNode }[] }[] = [
  /* ─── Practice Management: split into 3 sub-groups for G8 compliance (Pass 153) ─── */
  { group: 'PM · Business Operations', items: [
    { id: 'myplan' as PanelId, label: '🏠 My Plan', icon: <Home className="w-4 h-4" /> },
    { id: 'dashboard' as PanelId, label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'pnl' as PanelId, label: 'P&L & Business Economics', icon: <Receipt className="w-4 h-4" /> },
    { id: 'aumoverride' as PanelId, label: 'AUM Management', icon: <Layers className="w-4 h-4" /> },
  ]},
  { group: 'PM · Revenue & Growth', items: [
    { id: 'salesfunnel' as PanelId, label: 'Sales Funnel', icon: <Filter className="w-4 h-4" /> },
    { id: 'recruiting' as PanelId, label: 'Recruiting & Funnel', icon: <Users className="w-4 h-4" /> },
    { id: 'channels' as PanelId, label: 'Channels', icon: <Megaphone className="w-4 h-4" /> },
    { id: 'affiliatepipeline' as PanelId, label: 'Affiliate Pipeline', icon: <Handshake className="w-4 h-4" /> },
    { id: 'prodopt' as PanelId, label: 'Growth Optimization', icon: <Target className="w-4 h-4" /> },
  ]},
  { group: 'PM · Products & Goals', items: [
    { id: 'products' as PanelId, label: 'Products', icon: <Package className="w-4 h-4" /> },
    { id: 'gdcbrackets' as PanelId, label: 'GDC & Overrides', icon: <Percent className="w-4 h-4" /> },
    { id: 'goaltracker' as PanelId, label: 'Goals & Tracking', icon: <Flag className="w-4 h-4" /> },
  ]},
  /* ─── Holistic Planning: merged Client Planning + Advanced + Advisory ─── */
  { group: '① Foundation', items: [
    { id: 'pfr-wizard' as PanelId, label: '📋 PFR Wizard', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'client-wealth-hub' as PanelId, label: '⭐ Client Wealth Hub', icon: <Target className="w-4 h-4" /> },
    { id: 'profile', label: 'Client Profile', icon: <User className="w-4 h-4" /> },
    { id: 'cash', label: 'Cash Flow', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'balancesheet' as PanelId, label: 'Balance Sheet', icon: <Wallet className="w-4 h-4" /> },
    { id: 'debtmgmt' as PanelId, label: 'Debt Management', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'income', label: 'Income Streams', icon: <Banknote className="w-4 h-4" /> },
  ]},
  { group: '② Plan', items: [
    { id: 'retire', label: 'Retirement', icon: <Clock className="w-4 h-4" /> },
    { id: 'tax', label: 'Tax Planning', icon: <Building2 className="w-4 h-4" /> },
    { id: 'estate', label: 'Estate', icon: <Scale className="w-4 h-4" /> },
    { id: 'edu', label: 'Education', icon: <GraduationCap className="w-4 h-4" /> },
    { id: 'trusteng' as PanelId, label: 'Trust & Estate Structures', icon: <Gavel className="w-4 h-4" /> },
    { id: 'governance' as PanelId, label: 'Governance / IPS', icon: <FileCheck className="w-4 h-4" /> },
    { id: 'planning-hierarchy' as PanelId, label: 'Unified Plan View', icon: <Layers className="w-4 h-4" /> },
  ]},
  { group: '③ Protect & Advance', items: [
    { id: 'advanced-strategies-hub' as PanelId, label: '⭐ Advanced Strategies Hub', icon: <Gem className="w-4 h-4" /> },
    { id: 'protect', label: 'Protection Needs', icon: <Shield className="w-4 h-4" /> },
    { id: 'bizclient', label: 'Business Client', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'premfin' as PanelId, label: 'Premium Financing', icon: <Landmark className="w-4 h-4" /> },
    /* ilitrust merged into trusteng as tab — Pass 152 */
    { id: 'execcomp' as PanelId, label: 'Executive Comp', icon: <Crown className="w-4 h-4" /> },
    { id: 'charitable' as PanelId, label: 'Charitable Planning', icon: <Gift className="w-4 h-4" /> },
    { id: 'advanced', label: 'Strategy Inputs', icon: <SlidersHorizontal className="w-4 h-4" /> },
    { id: 'advanced-workflows' as PanelId, label: 'Workflow Automation', icon: <ShieldCheck className="w-4 h-4" /> },
  ]},
  { group: '④ Grow', items: [
    { id: 'grow', label: 'Growth & Accumulation', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'montecarlo' as PanelId, label: 'Monte Carlo', icon: <Dices className="w-4 h-4" /> },
    { id: 'stockcomp' as PanelId, label: 'Stock-Based Comp', icon: <Percent className="w-4 h-4" /> },
    { id: 'strategy-archetypes' as PanelId, label: 'Strategy Archetypes', icon: <Target className="w-4 h-4" /> },
  ]},
  { group: '⑤ Analyze & Act', items: [
    { id: 'costben', label: 'Strategy Analysis', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'summary', label: 'Scorecard Summary', icon: <FileText className="w-4 h-4" /> },
    { id: 'timeline', label: 'Action Plan & Timeline', icon: <ListChecks className="w-4 h-4" /> },
    { id: 'cascade-alerts' as PanelId, label: 'Cascade Intelligence', icon: <Zap className="w-4 h-4" /> },
    { id: 'firm-comparison' as PanelId, label: 'Firm Comparison', icon: <Building2 className="w-4 h-4" /> },
    { id: 'scenario-comparison' as PanelId, label: 'Scenarios', icon: <GitCompare className="w-4 h-4" /> },
    { id: 'partner', label: 'Partner Earnings', icon: <Handshake className="w-4 h-4" /> },
  ]},
  /* Data group merged into References — Pass 153 */
  { group: 'Tools & Reports', items: [
    { id: 'compliance-checklist' as PanelId, label: 'Compliance Checklist', icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'generate-report' as PanelId, label: 'Generate Report', icon: <FileBarChart className="w-4 h-4" /> },
    { id: 'multi-compare' as PanelId, label: 'Multi-Client Compare', icon: <UsersRound className="w-4 h-4" /> },
    /* cascade-flow merged into cascade-alerts as tab — Pass 152 */
  ]},
  { group: 'Data & References', items: [
    { id: 'financial-data-hub' as PanelId, label: 'Financial Data Hub', icon: <Database className="w-4 h-4" /> },
    { id: 'refs', label: 'References', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'duediligence' as PanelId, label: 'Due Diligence', icon: <FileCheck className="w-4 h-4" /> },
  ]},
];

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
/* Wrapper for ScenarioComparison that passes weData + input helpers */
function ScenarioComparisonPanel({ weData, gatherInputs, restoreInputs }: {
  weData: any; gatherInputs: () => Record<string, any>; restoreInputs: (d: Record<string, any>) => void;
}) {
  return <ScenarioComparisonLazy currentWeData={weData} currentInputs={gatherInputs()} onRestoreScenario={restoreInputs} />;
}

function PFRWizardPanel({ onNavigateToPanel, weData }: { onNavigateToPanel: (panelId: string) => void; weData?: any }) {
  return <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading PFR Wizard...</div>}><PFRWizardLazy onNavigateToPanel={onNavigateToPanel} weData={weData} /></Suspense>;
}

export default function Calculators() {
  const { user } = useAuth();
  // Pass 110: Support ?panel= query param AND /wealth-engine/:panel path param for deep-linking
  const urlTabRef = useRef<string | null>(null);
  const [activePanel, setActivePanel] = useState<PanelId>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      let p = params.get('panel');
      // Also support path-based deep linking: /wealth-engine/retirement or /calculators/retirement
      if (!p) {
        const pathParts = window.location.pathname.split('/');
        // /wealth-engine/retirement → pathParts = ['', 'wealth-engine', 'retirement']
        // /calculators/retirement → pathParts = ['', 'calculators', 'retirement']
        if (pathParts.length >= 3 && (pathParts[1] === 'wealth-engine' || pathParts[1] === 'calculators')) {
          p = pathParts[2];
        }
      }
      urlTabRef.current = params.get('tab');
      // Legacy panel ID redirects (Pass 150/151 consolidation)
      const LEGACY_REDIRECTS: Record<string, PanelId> = { recruitfunnel: 'recruiting', pnlbizecon: 'pnl', gdcoverride: 'gdcbrackets', aumpipeline: 'aumoverride', monthlyproduction: 'goaltracker', chandivers: 'prodopt', mktgroi: 'prodopt', compare: 'costben', impl_timeline: 'timeline', 'unified-client-plan': 'planning-hierarchy', ilitrust: 'trusteng', 'cascade-flow': 'cascade-alerts', cashflow: 'cash', 'cash-flow': 'cash', protection: 'protect', growth: 'grow', retirement: 'retire', education: 'edu', 'balance-sheet': 'balancesheet', 'debt-management': 'debtmgmt', 'income-streams': 'income', 'monte-carlo': 'montecarlo', 'stock-comp': 'stockcomp', 'premium-financing': 'premfin', 'executive-comp': 'execcomp', 'business-client': 'bizclient', scorecard: 'summary', datahub: 'financial-data-hub' };
      if (p && LEGACY_REDIRECTS[p]) p = LEGACY_REDIRECTS[p];
      if (p && NAV_SECTIONS.some(s => s.items.some(i => i.id === p))) return p as PanelId;
    } catch {}
    return 'profile';
  });
  const [calcSidebarOpen, setCalcSidebarOpen] = useState(false);

  /* ─── PANEL FAVORITES (Pass 152) ─── */
  const [favorites, setFavorites] = useState<PanelId[]>(() => {
    try { return JSON.parse(localStorage.getItem('wb-panel-favorites') || '[]'); } catch { return []; }
  });
  const toggleFavorite = useCallback((id: PanelId) => {
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id].slice(0, 12);
      localStorage.setItem('wb-panel-favorites', JSON.stringify(next));
      return next;
    });
  }, []);

  /* ─── PANEL USAGE ANALYTICS (v8 Pass 5) ─── */
  const panelAnalytics = usePanelAnalytics();

  /* ─── GLOBAL SEARCH (Pass 152) ─── */
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const allPanelItems = useMemo(() => NAV_SECTIONS.flatMap(s => s.items.map(i => ({ ...i, group: s.group }))), []);
  const searchResults = useMemo(() => {
    if (!globalSearch.trim()) return [];
    const q = globalSearch.toLowerCase();
    return allPanelItems.filter(i => i.label.toLowerCase().includes(q) || i.group.toLowerCase().includes(q)).slice(0, 10);
  }, [globalSearch, allPanelItems]);

  // Helper to navigate to a panel with optional tab pre-selection
  const navigateToPanel = useCallback((panelId: PanelId, tab?: string) => {
    setActivePanel(panelId);
    if (tab) urlTabRef.current = tab;
    setCalcSidebarOpen(false);
    setGlobalSearch('');
    try { panelAnalytics.recordVisit(panelId); } catch { /* guard HMR TDZ */ }
  }, [panelAnalytics]);

  /* ─── KEYBOARD SHORTCUT CHEAT SHEET (Pass 155) ─── */
  const [showShortcuts, setShowShortcuts] = useState(false);

  /* ─── PANEL COMPARISON SPLIT-VIEW (Pass 154) ─── */
  const [compareMode, setCompareMode] = useState(false);
  const [comparePanel, setComparePanel] = useState<PanelId | null>(null);
  const [showComparePicker, setShowComparePicker] = useState(false);
  const [compareSearch, setCompareSearch] = useState('');
  const compareResults = useMemo(() => {
    if (!compareSearch.trim()) return allPanelItems.filter(i => i.id !== activePanel).slice(0, 12);
    const q = compareSearch.toLowerCase();
    return allPanelItems.filter(i => i.id !== activePanel && (i.label.toLowerCase().includes(q) || i.group.toLowerCase().includes(q))).slice(0, 12);
  }, [compareSearch, allPanelItems, activePanel]);

  /* ─── KEYBOARD SHORTCUTS (Pass 154) ─── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd/Ctrl+K → focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      // Escape → clear search and close compare picker
      if (e.key === 'Escape') {
        if (showShortcuts) { setShowShortcuts(false); return; }
        if (globalSearch) { setGlobalSearch(''); searchInputRef.current?.blur(); }
        if (showComparePicker) setShowComparePicker(false);
        return;
      }
      // ? key → open shortcut cheat sheet (only when not in an input)
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
        return;
      }
      // Number keys 1-9 → navigate to favorites (only when not in an input)
      if (e.key >= '1' && e.key <= '9' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const idx = parseInt(e.key) - 1;
        if (favorites[idx]) {
          e.preventDefault();
          navigateToPanel(favorites[idx]);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [globalSearch, favorites, navigateToPanel, showComparePicker, showShortcuts]);

  /* ─── DRAG-AND-DROP PANEL REORDERING (Pass 155) ─── */
  const { orderedSections, handleDragStart, handleDragEnter, handleDragEnd, resetOrder, hasCustomOrder, dragItem } = usePanelOrder(NAV_SECTIONS);

  /* ─── UNDO/REDO HISTORY (v8 Pass 4) ─── */
  const undoHistory = useUndoHistory<Record<string, any>>({}, { maxDepth: 40, debounceMs: 500, enableKeyboard: true });

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

  /* ─── ONBOARDING (Gap 1 + Gap 5) ─── */
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return localStorage.getItem('wb-onboarding-complete') !== 'true'; } catch { return true; }
  });
  const handleOnboardingComplete = useCallback((result: OnboardingResult) => {
    setShowOnboarding(false);
    setShowWelcome(false);
    try { localStorage.setItem('wb-welcome-dismissed', 'true'); localStorage.setItem('wb-onboarding-complete', 'true'); } catch {}
    // Apply suggested complexity to all hubs
    handlePpComplexityChange(result.suggestedComplexity);
    // Navigate to suggested panel
    if (result.suggestedPanel) {
      setActivePanel(result.suggestedPanel as PanelId);
    }
    toast.success(`Welcome! Set to ${result.suggestedComplexity === 'simple' ? 'Quick' : result.suggestedComplexity === 'detailed' ? 'Standard' : 'Expert'} mode. You can change this anytime.`);
  }, []);
  const handleOnboardingSkip = useCallback(() => {
    setShowOnboarding(false);
    try { localStorage.setItem('wb-onboarding-complete', 'true'); } catch {}
  }, []);

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
  const [ppStreams, setPpStreams] = useState<Record<string, boolean>>({ personal: true, expanded: false, override: false, aum: true, channels: false, affA: true, affB: true, affC: true, affD: true });
  const [ppAffAIncome, setPpAffAIncome] = useState(0);
  const [ppAffBIncome, setPpAffBIncome] = useState(0);
  const [ppAffCIncome, setPpAffCIncome] = useState(0);
  const [ppAffDIncome, setPpAffDIncome] = useState(0);
  /* Unified Income Planning */
  const [ppTargetIncome, setPpTargetIncome] = useState(() => ROLE_DEFAULTS.new.defaultTargetIncome);
  const [ppIncomeSplits, setPpIncomeSplits] = useState(() => ({ ...ROLE_DEFAULTS.new.incomeSplits }));
  const [ppAffCounts, setPpAffCounts] = useState(() => ({ ...ROLE_DEFAULTS.new.defaultAffiliates }));
  const [ppAffAvgProd, setPpAffAvgProd] = useState(() => ({ ...ROLE_DEFAULTS.new.defaultAffProd }));
  const [ppTeamAvgGDC, setPpTeamAvgGDC] = useState(100000);
  const [ppEnabledChannels, setPpEnabledChannels] = useState<{ gdc: boolean; aum: boolean; affiliate: boolean; override: boolean; channel: boolean }>({ gdc: true, aum: true, affiliate: true, override: true, channel: true });
  const [ppAumOverrideRate, setPpAumOverrideRate] = useState(90);
  const [ppAffiliateMode, setPpAffiliateMode] = useState<'recruiter' | 'producer'>('recruiter');
  const [ppProducerInputs, setPpProducerInputs] = useState({ dealsPerMonth: 2, avgCommissionPerDeal: 3000, splitPct: 50, fixedBonusPerDeal: 500, monthlyRetainer: 0 });
  const [ppComplexity, setPpComplexity] = useState<'simple' | 'detailed' | 'expert'>(() => {
    try { const saved = localStorage.getItem('we-practice-complexity');
    return (saved === 'simple' || saved === 'detailed' || saved === 'expert') ? saved : 'detailed'; } catch { return 'detailed'; }
  });
  const handlePpComplexityChange = (v: 'simple' | 'detailed' | 'expert') => { setPpComplexity(v); try { localStorage.setItem('we-practice-complexity', v); } catch {} };
  const [ppAlsoMyClient, setPpAlsoMyClient] = useState(false);
  /* CAC & COGS Overrides */
  const [ppCacOverrides, setPpCacOverrides] = useState<Partial<Record<string, number>>>({});
  const [ppCogsOverrides, setPpCogsOverrides] = useState<Partial<Record<string, number>>>({});
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
    ppTargetIncome, ppIncomeSplits, ppAffCounts, ppAffAvgProd, ppTeamAvgGDC, ppEnabledChannels,
    ppCacOverrides, ppCogsOverrides,
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
    ppTargetIncome, ppIncomeSplits, ppAffCounts, ppAffAvgProd, ppTeamAvgGDC, ppEnabledChannels,
    ppCacOverrides, ppCogsOverrides,
  ]);

  /* Auto-save to localStorage with 2s debounce + sync core profile to DB */
  const profileSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileSyncMut = trpc.financialProfile.set.useMutation();
  useEffect(() => {
    if (isRestoringRef.current) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      try {
        const snapshot = gatherInputsForSave();
        localStorage.setItem('wb-calc-autosave', JSON.stringify(snapshot));
        undoHistory.push(snapshot);
      } catch { /* quota exceeded — ignore */ }
    }, 2000);
    // Sync core profile fields to DB every 5s (debounced, only when logged in)
    if (user && !profileSyncTimer.current) {
      profileSyncTimer.current = setTimeout(() => {
        profileSyncTimer.current = null;
        profileSyncMut.mutate({
          // @ts-expect-error — excess property in object literal
          profile: {
            age, income, netWorth: nw, savings, monthlySavings: monthlySav,
            dependents: dep, mortgage, debts: debt, marginalRate: stateRate,
            equitiesReturn: iulReturn, existingInsurance: existIns,
            isBizOwner: isBiz, retirementAge: retireAge,
            yearsInRetirement: replaceYrs, stateOfResidence: undefined,
            filingStatus: filing as any, lifeInsuranceCoverage: pfFace,
            businessRevenue: bizRevenue, businessEmployees: bizEmployees,
          },
        });
      }, 5000);
    }
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      if (profileSyncTimer.current) { clearTimeout(profileSyncTimer.current); profileSyncTimer.current = null; }
    };
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
    /* Unified Income Planning */
    if (d.ppTargetIncome !== undefined) setPpTargetIncome(d.ppTargetIncome);
    if (d.ppIncomeSplits !== undefined) setPpIncomeSplits(d.ppIncomeSplits);
    if (d.ppAffCounts !== undefined) setPpAffCounts(d.ppAffCounts);
    if (d.ppAffAvgProd !== undefined) setPpAffAvgProd(d.ppAffAvgProd);
    if (d.ppTeamAvgGDC !== undefined) setPpTeamAvgGDC(d.ppTeamAvgGDC);
    if (d.ppEnabledChannels !== undefined) setPpEnabledChannels(d.ppEnabledChannels);
    if (d.ppCacOverrides !== undefined) setPpCacOverrides(d.ppCacOverrides);
    if (d.ppCogsOverrides !== undefined) setPpCogsOverrides(d.ppCogsOverrides);
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

  /* ─── PLAN SHARING ─── */
  const sharePlanMutation = trpc.planSharing.createShare.useMutation();
  const [shareExpiry, setShareExpiry] = useState<7 | 30 | 90 | 365>(30);

  /* ─── ALSO MY CLIENT → PLANNING HIERARCHY BRIDGE ─── */
  const bridgeMut = trpc.planningHierarchy.bridgeContactToClient.useMutation();
  const bulkExportMut = trpc.scenarioExport.bulkExport.useMutation({
    onSuccess: (data) => { window.open(data.url, '_blank', 'noopener,noreferrer'); toast.success(`Exported ${data.sessionCount} scenarios as Excel`); },
    onError: (err) => { toast.error(err.message || 'No saved sessions found'); },
  });
  useEffect(() => {
    if (!ppAlsoMyClient || !user) return;
    // When toggled ON, bridge the client profile into the planning hierarchy.
    // Debounce to avoid rapid fire when toggling.
    const t = setTimeout(() => {
      bridgeMut.mutate({
        contactId: user.id, // The current user's profile as client
        financialProfile: {
          income, spouseIncome, netWorth: nw, savings, retirement401k,
          mortgage, debt, existingInsurance: existIns,
          riskTolerance, filingStatus: filing,
        },
      });
    }, 1000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ppAlsoMyClient]);

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
      const resp = await authFetch(`/api/trpc/calcSession.get?input=${encodeURIComponent(JSON.stringify({ id }))}`, {
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

      <div class="section">
      <h2>Client Profile — Extended Details</h2>
      <table>
      <tr><th colspan="2">Retirement Planning</th></tr>
      <tr><td>Target Retirement Age</td><td>${retireAge}</td></tr>
      <tr><td>Emergency Fund (months)</td><td>${emMonths}</td></tr>
      <tr><td>Income Replacement Years</td><td>${replaceYrs}</td></tr>
      <tr><td>Monthly Savings</td><td>${fmt(monthlySav)}</td></tr>
      <tr><th colspan="2">Insurance & Protection</th></tr>
      <tr><td>Payoff Rate</td><td>${pct(payoffRate / 100)}</td></tr>
      <tr><td>Disability Coverage</td><td>${pct(diPct / 100)}</td></tr>
      <tr><td>Existing Insurance</td><td>${fmt(existIns)}</td></tr>
      <tr><th colspan="2">Education Planning</th></tr>
      <tr><td>Children</td><td>${numChildren}</td></tr>
      <tr><td>529 Balance</td><td>${fmt(current529)}</td></tr>
      <tr><td>Monthly 529 Contribution</td><td>${fmt(monthly529)}</td></tr>
      <tr><th colspan="2">Estate & Legacy</th></tr>
      <tr><td>Will Status</td><td>${willStatus || 'Not specified'}</td></tr>
      <tr><td>Gross Estate</td><td>${fmt(grossEstate)}</td></tr>
      <tr><td>Annual Gifting</td><td>${fmt(giftingAnnual)}</td></tr>
      <tr><td>Charitable Giving</td><td>${fmt(charitableGiving)}</td></tr>
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
    const w = window.open('', '_blank', 'noopener,noreferrer');
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
    aumOverrideRate: ppAumOverrideRate, setAumOverrideRate: setPpAumOverrideRate,
    affiliateMode: ppAffiliateMode, setAffiliateMode: setPpAffiliateMode,
    producerInputs: ppProducerInputs, setProducerInputs: setPpProducerInputs,
    complexity: ppComplexity, setComplexity: handlePpComplexityChange,
    alsoMyClient: ppAlsoMyClient, setAlsoMyClient: setPpAlsoMyClient,
    /* Client data for cross-cascade */
    clientIncome: income, clientNetWorth: nw, clientSavings: savings,
    clientRetirement401k: retirement401k, clientAge: age, clientDep: dep,
    clientMortgage: mortgage, clientDebt: debt, clientExistingInsurance: existIns,
    clientIsBiz: isBiz, clientBizRevenue: bizRevenue, clientBizEmployees: bizEmployees,
    clientRiskTolerance: riskTolerance,
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
    /* Unified Income Planning */
    targetIncome: ppTargetIncome, setTargetIncome: setPpTargetIncome,
    incomeSplits: ppIncomeSplits, setIncomeSplits: setPpIncomeSplits,
    affCounts: ppAffCounts, setAffCounts: setPpAffCounts,
    affAvgProd: ppAffAvgProd, setAffAvgProd: setPpAffAvgProd,
    teamAvgGDC: ppTeamAvgGDC, setTeamAvgGDC: setPpTeamAvgGDC,
    enabledChannels: ppEnabledChannels, setEnabledChannels: setPpEnabledChannels,
    cacOverrides: ppCacOverrides, setCacOverrides: setPpCacOverrides,
    cogsOverrides: ppCogsOverrides, setCogsOverrides: setPpCogsOverrides,
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

  /* ─── Live cascade state: advanced strategies push data here ─── */
  const [advancedCascade, setAdvancedCascade] = useState<AdvancedStrategiesCascade>(EMPTY_ADVANCED_CASCADE);

  /* ─── Optional practice management cascade (opt-in from Practice Mgmt panels) ─── */
  const practiceCascade = useMemo<PracticeManagementCascade>(() => {
    // Auto-populate from practiceIncome when available
    if (practiceIncome.grandTotal > 0) {
      return {
        enabled: true,
        annualRevenue: practiceIncome.pnlRevenue,
        monthlyGDC: practiceIncome.monthlyGDC,
        aumRevenue: practiceIncome.annualAUM,
        overrideRevenue: practiceIncome.annualOverride,
        teamSize: 1, // default single advisor
        revenuePerAdvisor: practiceIncome.pnlRevenue,
        clientsPerAdvisor: 0,
        totalClients: 0,
        avgClientValue: 0,
        retentionRate: 90,
        annualProduction: practiceIncome.grandTotal,
        productionGrowthRate: 5,
        practiceScore: Math.min(100, Math.round(practiceIncome.grandTotal / 5000)),
        practiceToClient: {
          incomeFromPractice: practiceIncome.pnlNetIncome,
          practiceEquity: Math.round(practiceIncome.pnlRevenue * 2.5), // 2.5x revenue multiple
          benefitsCostOffset: 0,
        },
      };
    }
    return EMPTY_PRACTICE_CASCADE;
  }, [practiceIncome]);

  /* ─── Build cascade context for new Advisory/Data panels ─── */
  const clientProfile = useMemo(() => ({
    clientName, age, spouseAge, dep, income, spouseIncome, totalIncome, nw, savings,
    retirement401k, mortgage, debt, existIns, filing, stateRate, riskTolerance,
    isBiz, bizRevenue, bizEmployees, bizEntityType,
  }), [clientName, age, spouseAge, dep, income, spouseIncome, totalIncome, nw, savings,
    retirement401k, mortgage, debt, existIns, filing, stateRate, riskTolerance,
    isBiz, bizRevenue, bizEmployees, bizEntityType]);

  /* ─── Cascade Audit Trail ─── */
  const [cascadeAuditEntries, setCascadeAuditEntries] = useState<import('./calculators/CascadeAuditTrail').CascadeAuditEntry[]>([]);
  const prevBridgeRef = useRef<import('../contexts/WealthEngineContext').HolisticCascadeBridge | null>(null);

  const holisticBridge = useMemo(() => computeHolisticBridge(
    scorecard.pctScore, // clientHubScore
    advancedCascade.totalAnnualBenefit > 0 ? Math.min(100, Math.round(advancedCascade.totalAnnualBenefit / Math.max(1, advancedCascade.totalAnnualCost) * 25)) : 0, // advancedHubScore
    clientProfile,
    // @ts-expect-error — strict mode fix
    prResult,
    txResult,
    rtResult,
    advancedCascade,
    practiceCascade,
  ), [scorecard.pctScore, advancedCascade, clientProfile, prResult, txResult, rtResult, practiceCascade]);

  // Track cascade changes for audit trail
  useEffect(() => {
    if (prevBridgeRef.current && holisticBridge.lastCascadeTimestamp > 0) {
      import('./calculators/CascadeAuditTrail').then(({ buildCascadeAuditEntries }) => {
        const newEntries = buildCascadeAuditEntries(prevBridgeRef.current, holisticBridge, advancedCascade, practiceCascade);
        if (newEntries.length > 0) {
          setCascadeAuditEntries(prev => [...newEntries, ...prev].slice(0, 100)); // Keep last 100
        }
      });
    }
    prevBridgeRef.current = holisticBridge;
  }, [holisticBridge]);

  const weData = useMemo<WealthEngineData>(() => ({
    client: clientProfile,
    scorecard, recommendations, totalAnnualPremium,
    // @ts-expect-error — strict mode fix
    cfResult, prResult, grResult, rtResult, txResult, esResult, edResult,
    // @ts-expect-error — strict mode fix
    horizonData, practiceIncome, scores,
    generalDefaults: GENERAL_DEFAULTS,
    advancedCascade,
    practiceCascade,
    holisticBridge,
    lastUpdated: Date.now(),
    panelVersions: {},
    cascadeAuditEntries,
  }), [clientProfile, cascadeAuditEntries,
    scorecard, recommendations, totalAnnualPremium,
    cfResult, prResult, grResult, rtResult, txResult, esResult, edResult,
    horizonData, practiceIncome, scores,
    advancedCascade, practiceCascade, holisticBridge]);

  /* ═══ RENDER ═══ */
  if (showOnboarding) {
    return (
      <>
        <SEOHead title="Welcome to the Wealth Engine" description="Personalize your financial planning experience." />
        <AppShell title="Wealth Engine">
          <WealthEngineOnboarding onComplete={handleOnboardingComplete} onSkip={handleOnboardingSkip} />
        </AppShell>
      </>
    );
  }

  return (
      <>
        <SEOHead title="Financial Calculators" description="Comprehensive financial planning calculators including retirement, insurance, and investment tools." />
    <AppShell title="Wealth Engine">
    <div className="flex min-h-full bg-background relative">
      {/* ─── MOBILE SIDEBAR OVERLAY ─── */}
      {calcSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setCalcSidebarOpen(false)} role="presentation" aria-hidden="true" />
      )}

      {/* ─── CALCULATOR SIDEBAR ─── */}
      <aside role="complementary" aria-label="Calculator navigation sidebar" className={`
        fixed inset-y-0 left-0 lg:sticky lg:top-0 z-50 lg:z-auto
        w-56 shrink-0 border-r border-border bg-card flex flex-col
        max-h-[100dvh] lg:max-h-screen lg:self-start
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
          <Button variant="ghost" size="icon" className="lg:hidden h-7 w-7" onClick={() => setCalcSidebarOpen(false)} aria-label="Close calculator sidebar">
            <PanelLeftClose className="w-4 h-4" />
          </Button>
        </div>
        {/* ─── GLOBAL SEARCH (Pass 152) ─── */}
        <div className="px-2 pt-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
            <input ref={searchInputRef} type="text" value={globalSearch} onChange={e => setGlobalSearch(e.target.value)}
              placeholder="Search panels... (⌘K)" aria-label="Search all panels — press Cmd+K or Ctrl+K to focus"
              className="w-full pl-7 pr-2 py-1.5 text-xs bg-muted/30 border border-border/30 rounded-md placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground" />
            {globalSearch && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-popover text-popover-foreground border border-border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                {searchResults.length === 0 ? (
                  <p className="p-2 text-xs text-muted-foreground">No panels found</p>
                ) : searchResults.map(r => (
                  <button key={r.id} type="button" onClick={() => navigateToPanel(r.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground transition-colors">
                    {r.icon}<span>{r.label}</span>
                    <span className="ml-auto text-[9px] text-muted-foreground/50">{r.group}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* ─── FAVORITES QUICK-ACCESS BAR (Pass 152) ─── */}
        {favorites.length > 0 && (
          <div className="px-2 pt-2">
            <p className="text-[9px] font-semibold text-amber-500/70 uppercase tracking-wider px-1 mb-1 flex items-center gap-1">
              <Star className="w-2.5 h-2.5" />Favorites
            </p>
            <div className="flex flex-wrap gap-1">
              {favorites.map((fid, idx) => {
                const item = allPanelItems.find(i => i.id === fid);
                if (!item) return null;
                return (
                  <button key={fid} type="button" onClick={() => navigateToPanel(fid)}
                    title={idx < 9 ? `Press ${idx + 1} to navigate` : undefined}
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      activePanel === fid ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-transparent'
                    }`}>
                    {idx < 9 && <span className="text-[8px] text-muted-foreground/40 font-mono">{idx + 1}</span>}
                    {item.icon}{item.label.replace(/^[⭐🏠] /, '')}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
          <nav className="p-2 space-y-3" role="navigation" aria-label="Wealth Engine panels">
            {/* ─── RECENTLY USED (v8 Pass 5) ─── */}
            {panelAnalytics.recentPanels.length > 0 && (
              <div role="group" aria-label="Recently Used">
                <div className="flex items-center justify-between px-2 mb-1">
                  <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Recently Used</p>
                  <span className="text-[9px] text-muted-foreground/40">{panelAnalytics.totalVisits} visits</span>
                </div>
                <div role="list">
                  {panelAnalytics.recentPanels.map(rp => {
                    const item = allPanelItems.find(i => i.id === rp.id);
                    if (!item) return null;
                    return (
                      <div key={`recent-${rp.id}`} className="flex items-center group">
                        <button type="button" role="listitem" onClick={() => navigateToPanel(rp.id as any)}
                          aria-label={`Navigate to ${item.label} panel (visited ${rp.count} times)`}
                          aria-current={activePanel === rp.id ? 'page' : undefined}
                          className={`flex-1 flex items-center gap-2 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                            activePanel === rp.id
                              ? 'bg-primary/10 text-primary border border-primary/30'
                              : 'text-muted-foreground hover:bg-background hover:text-foreground border border-transparent'
                          }`}>
                          {item.icon}
                          <span className="truncate">{item.label}</span>
                          <span className="ml-auto text-[9px] text-muted-foreground/40 tabular-nums">{rp.count}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="h-px bg-border/30 mt-2" />
              </div>
            )}
            {hasCustomOrder && (
              <div className="flex items-center justify-between px-2 py-1 bg-amber-500/10 rounded text-[9px]">
                <span className="text-amber-400/80">Custom order active</span>
                <button type="button" onClick={resetOrder} className="text-amber-400 hover:text-amber-300 underline">Reset</button>
              </div>
            )}
            {orderedSections.map(section => (
              <div key={section.group} role="group" aria-label={section.group}>
                <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-2 mb-1" id={`nav-group-${section.group.toLowerCase().replace(/\s+/g, '-')}`}>{section.group}</p>
                <div role="list" aria-labelledby={`nav-group-${section.group.toLowerCase().replace(/\s+/g, '-')}`}>
                  {section.items.map((item, idx) => (
                    <div key={item.id} className={`flex items-center group ${dragItem.current?.group === section.group && dragItem.current?.index === idx ? 'opacity-40' : ''}`}
                      draggable
                      onDragStart={() => handleDragStart(section.group, idx)}
                      onDragEnter={() => handleDragEnter(section.group, idx)}
                      onDragEnd={handleDragEnd}
                      onDragOver={e => e.preventDefault()}>
                      <span className="w-4 flex items-center justify-center opacity-0 group-hover:opacity-40 cursor-grab active:cursor-grabbing transition-opacity flex-shrink-0">
                        <GripVertical className="w-3 h-3 text-muted-foreground" />
                      </span>
                      <button type="button" role="listitem" onClick={() => navigateToPanel(item.id as PanelId)}
                        aria-label={`Navigate to ${item.label} panel`}
                        aria-current={activePanel === item.id ? 'page' : undefined}
                        tabIndex={0}
                        className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                          activePanel === item.id
                            ? 'bg-primary/10 text-primary border border-primary/30'
                            : 'text-muted-foreground hover:bg-background hover:text-foreground border border-transparent'
                        }`}>
                        {item.icon}
                        {item.label}
                      </button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id as PanelId); }}
                        aria-label={favorites.includes(item.id as PanelId) ? `Remove ${item.label} from favorites` : `Add ${item.label} to favorites`}
                        className={`p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                          favorites.includes(item.id as PanelId) ? 'text-amber-400 opacity-100' : 'text-muted-foreground/30 hover:text-amber-400'
                        }`}>
                        <Star className={`w-3 h-3 ${favorites.includes(item.id as PanelId) ? 'fill-amber-400' : ''}`} />
                      </button>
                    </div>
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
              {sessionsQuery.data?.length || 0}/10 save slots
            </span>
            <button type="button" onClick={handleExportPdf} className="text-[10px] text-muted-foreground/50 hover:text-primary transition-colors" title="Print Report">
              Print
            </button>
          </div>
          <div className="text-center text-[9px] text-muted-foreground/30">v7.6 · Unified Wealth Engine</div>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ─── */}
      <main className="flex-1 min-w-0" role="main" aria-label="Calculator panel content">
        <div className={`mx-auto p-3 sm:p-4 lg:p-6 ${compareMode && comparePanel ? 'max-w-[1600px]' : 'max-w-5xl'}`}>

          {/* ─── TOOLBAR ─── */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4 bg-card rounded-lg border border-border px-3 py-2">
            <div className="flex items-center gap-2">
              {/* Mobile: open calculator sidebar */}
              <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8 shrink-0" onClick={() => setCalcSidebarOpen(true)} aria-label="Open calculator sidebar">
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
              {/* Undo/Redo (v8 Pass 4) */}
              <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => { const prev = undoHistory.undo(); if (prev) { restoreInputs(prev); toast.info('Undo'); } }}
                disabled={!undoHistory.canUndo} className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label="Undo last change">
                <Undo2 className="w-3.5 h-3.5" />
              </Button>
              </TooltipTrigger><TooltipContent>Undo <kbd className="ml-1 font-mono text-[10px] opacity-60">{navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+Z</kbd></TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => { const next = undoHistory.redo(); if (next) { restoreInputs(next); toast.info('Redo'); } }}
                disabled={!undoHistory.canRedo} className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label="Redo last change">
                <Redo2 className="w-3.5 h-3.5" />
              </Button>
              </TooltipTrigger><TooltipContent>Redo <kbd className="ml-1 font-mono text-[10px] opacity-60">{navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+Shift+Z</kbd></TooltipContent></Tooltip>
              {undoHistory.length > 1 && <span className="text-[9px] text-muted-foreground/50 hidden xl:inline">{undoHistory.position + 1}/{undoHistory.length}</span>}
              {/* Split-View Compare Toggle (Pass 154) */}
              <Button variant={compareMode ? 'default' : 'outline'} size="sm"
                onClick={() => { setCompareMode(m => !m); if (!compareMode) setShowComparePicker(true); else { setComparePanel(null); setShowComparePicker(false); } }}
                className={`text-xs gap-1 h-7 hidden lg:flex ${compareMode ? 'bg-primary text-primary-foreground' : ''}`}
                title="Compare two panels side-by-side" aria-label="Compare two panels side-by-side">
                <Columns2 className="w-3 h-3" /> <span className="hidden xl:inline">Compare</span>
              </Button>
              <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => setShowShortcuts(true)}
                className="h-7 w-7 text-muted-foreground hover:text-foreground" aria-label="Keyboard shortcuts">
                <Keyboard className="w-3.5 h-3.5" />
              </Button>
              </TooltipTrigger><TooltipContent>Keyboard shortcuts <kbd className="ml-1 font-mono text-[10px] opacity-60">?</kbd></TooltipContent></Tooltip>
              <Button variant="outline" size="sm" onClick={handleSave} disabled={saveMut.isPending || updateMut.isPending}
               >
                <Save className="w-3 h-3" /> <span className="hidden sm:inline">{activeSessionId ? 'Update' : 'Save'}</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => { if (!user) { toast.error('Please sign in to load sessions'); return; } setShowLoadDialog(true); }}
               >
                <FolderOpen className="w-3 h-3" /> <span className="hidden sm:inline">Load</span>
              </Button>
              {/* ─── MOBILE: Export dropdown (md and below) ─── */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="md:hidden h-7 gap-1" aria-label="Export & import options">
                    <Download className="w-3 h-3" /> <MoreHorizontal className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel className="text-xs">Export</DropdownMenuLabel>
                  <DropdownMenuItem onClick={handleExportPdf}>
                    <Download className="w-3.5 h-3.5 mr-2" /> PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    import('./calculators/exportUnifiedPlan').then(m => m.exportUnifiedPlanPDF(weData));
                    toast.success('Unified plan report opened in new tab — use Print to save as PDF');
                  }}>
                    <Download className="w-3.5 h-3.5 mr-2" /> <span className="text-primary">⭐ Full Plan</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    import('./calculators/exportUnifiedPlan').then(m => m.exportUnifiedPlanExcel(weData));
                    toast.success('Unified plan Excel downloaded');
                  }}>
                    <Download className="w-3.5 h-3.5 mr-2" /> Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportCsv}>
                    <Download className="w-3.5 h-3.5 mr-2" /> CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    const json = JSON.stringify(gatherInputs(), null, 2);
                    const blob = new Blob([json], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = `WealthBridge-${clientName || 'Session'}-${new Date().toISOString().slice(0,10)}.json`;
                    a.click(); URL.revokeObjectURL(url);
                    toast.success('JSON exported!');
                  }}>
                    <Download className="w-3.5 h-3.5 mr-2" /> JSON
                  </DropdownMenuItem>
                  {user && (
                    <DropdownMenuItem onClick={() => bulkExportMut.mutate()} disabled={bulkExportMut.isPending}>
                      <Download className="w-3.5 h-3.5 mr-2" /> {bulkExportMut.isPending ? 'Exporting...' : 'All Scenarios'}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs">Import</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => {
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
                  }}>
                    <Upload className="w-3.5 h-3.5 mr-2" /> Import JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {/* ─── DESKTOP: Individual export buttons (hidden on mobile) ─── */}
              <Button variant="outline" size="sm" onClick={handleExportPdf}
                className="hidden md:flex">
                <Download className="w-3 h-3" /> <span className="hidden lg:inline">PDF</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                import('./calculators/exportUnifiedPlan').then(m => m.exportUnifiedPlanPDF(weData));
                toast.success('Unified plan report opened in new tab — use Print to save as PDF');
              }} className="hidden md:flex text-xs gap-1 h-7 border-primary/30 text-primary" aria-label="Export unified plan as PDF">
                <Download className="w-3 h-3" /> <span className="hidden lg:inline">⭐ Full Plan</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                import('./calculators/exportUnifiedPlan').then(m => m.exportUnifiedPlanExcel(weData));
                toast.success('Unified plan Excel downloaded');
              }} className="hidden md:flex" aria-label="Export unified plan as Excel">
                <Download className="w-3 h-3" /> <span className="hidden lg:inline">Excel</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCsv}
                className="hidden md:flex" aria-label="Export as CSV">
                <Download className="w-3 h-3" /> <span className="hidden lg:inline">CSV</span>
              </Button>
              {user && (
                <Button variant="outline" size="sm" onClick={() => bulkExportMut.mutate()}
                  disabled={bulkExportMut.isPending}
                  className="hidden md:flex text-xs gap-1 h-7 border-emerald-500/30 text-emerald-400 hover:text-emerald-300" aria-label="Export all saved scenarios as Excel workbook">
                  <Download className={`w-3 h-3 ${bulkExportMut.isPending ? 'animate-spin' : ''}`} /> <span className="hidden lg:inline">{bulkExportMut.isPending ? 'Exporting...' : 'All Scenarios'}</span>
                </Button>
              )}
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
              }} className="hidden md:flex" aria-label="Import session from JSON file">
                <Upload className="w-3 h-3" /> <span className="hidden lg:inline">Import</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                const json = JSON.stringify(gatherInputs(), null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `WealthBridge-${clientName || 'Session'}-${new Date().toISOString().slice(0,10)}.json`;
                a.click(); URL.revokeObjectURL(url);
                toast.success('JSON exported!');
              }} className="hidden md:flex" aria-label="Export session as JSON">
                <Download className="w-3 h-3" /> <span className="hidden lg:inline">JSON</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => {
                if (confirm('Reset all inputs to defaults? This cannot be undone.')) {
                  try { localStorage.removeItem('wb-calc-autosave'); } catch {}
                  window.location.reload();
                }
              }} className="text-xs gap-1 h-7 text-red-400 hover:text-red-300" aria-label="Reset all inputs to defaults">
                <RotateCcw className="w-3 h-3" /> <span className="hidden sm:inline">Reset</span>
              </Button>
              <ShareButton contentType="calculator" contentId={String(activeSessionId || 'unsaved')} contentTitle={`WealthBridge Calculator — ${clientName || 'Session'}`} variant="outline" size="sm" />
              {user && (
                <div className="hidden md:flex items-center gap-1">
                  <select
                    value={shareExpiry}
                    onChange={e => setShareExpiry(Number(e.target.value) as 7 | 30 | 90 | 365)}
                    className="h-7 text-[10px] rounded border border-border bg-background px-1.5 text-muted-foreground"
                    aria-label="Share link expiration"
                  >
                    <option value={7}>7 days</option>
                    <option value={30}>30 days</option>
                    <option value={90}>90 days</option>
                    <option value={365}>1 year</option>
                  </select>
                  <Button variant="outline" size="sm" onClick={async () => {
                    try {
                      const result = await sharePlanMutation.mutateAsync({
                        planSnapshot: weData,
                        label: `${clientName || 'Client'} Financial Plan`,
                        expiresInDays: shareExpiry,
                      });
                      const url = `${window.location.origin}/plan/${result.token}`;
                      await navigator.clipboard.writeText(url);
                      toast.success('Share link copied to clipboard!', { description: `Expires in ${shareExpiry} days (${new Date(result.expiresAt).toLocaleDateString()})` });
                    } catch (e: any) { toast.error(e.message || 'Failed to create share link'); }
                  }} className="text-xs gap-1 h-7 border-emerald-500/30 text-emerald-500" disabled={sharePlanMutation.isPending}>
                    <Share2 className="w-3 h-3" /> <span className="hidden sm:inline">{sharePlanMutation.isPending ? 'Sharing...' : 'Share Plan'}</span>
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* ─── SESSION REPLAY TIMELINE (v8 Pass 5) ─── */}
          {undoHistory.length > 1 && (
            <SessionReplayTimeline
              entries={undoHistory.entries.map(e => ({ state: e.state as Record<string, any>, timestamp: e.timestamp, label: e.label }))}
              currentPosition={undoHistory.position}
              onJumpTo={(idx) => { const s = undoHistory.jumpTo(idx); if (s) { restoreInputs(s as Record<string, any>); toast.info(`Jumped to snapshot ${idx + 1}`); } }}
              className="mb-3"
            />
          )}

          {/* ─── WELCOME TIP ─── */}
          {showWelcome && (
            <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-start gap-3">
              <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground mb-1">Welcome to the Unified Wealth Engine</p>
                <p className="text-xs text-muted-foreground">Start by entering your client profile, then explore each planning domain. All calculations update in real-time. Use Save/Load to manage multiple client scenarios, and Export to generate reports.</p>
              </div>
              <button type="button" onClick={() => { setShowWelcome(false); try { localStorage.setItem('wb-welcome-dismissed', 'true'); } catch {} }}
                className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ═══ COMPARE PANEL PICKER (Pass 154) ═══ */}
          {compareMode && showComparePicker && !comparePanel && (
            <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Columns2 className="w-4 h-4 text-primary" /> Select a panel to compare with <span className="font-bold text-primary">{allPanelItems.find(i => i.id === activePanel)?.label || activePanel}</span>
                </p>
                <button type="button" onClick={() => { setCompareMode(false); setShowComparePicker(false); }} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>
              <input type="text" value={compareSearch} onChange={e => setCompareSearch(e.target.value)}
                placeholder="Search panels to compare..." autoFocus
                className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-md placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground mb-2" />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 max-h-48 overflow-y-auto">
                {compareResults.map(r => (
                  <button key={r.id} type="button" onClick={() => { setComparePanel(r.id); setShowComparePicker(false); setCompareSearch(''); }}
                    className="flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-md border border-border hover:bg-accent hover:text-accent-foreground transition-colors text-left">
                    {r.icon}<span className="truncate">{r.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ═══ SPLIT-VIEW WRAPPER (Pass 154) ═══ */}
          {/* ═══ COMPARE DIFF HIGHLIGHTS (Pass 155) ═══ */}
          {compareMode && comparePanel && (() => {
            const leftLabel = allPanelItems.find(i => i.id === activePanel)?.label || activePanel;
            const rightLabel = allPanelItems.find(i => i.id === comparePanel)?.label || comparePanel;
            const metricPaths: { key: string; label: string; format: 'currency' | 'percent' | 'number' }[] = [
              { key: 'totalIncome', label: 'Total Income', format: 'currency' },
              { key: 'netWorth', label: 'Net Worth', format: 'currency' },
              { key: 'grossEstate', label: 'Gross Estate', format: 'currency' },
              { key: 'monthlySurplus', label: 'Monthly Surplus', format: 'currency' },
              { key: 'effectiveTaxRate', label: 'Effective Tax Rate', format: 'percent' },
            ];
            const leftMetrics: MetricSnapshot[] = [];
            const rightMetrics: MetricSnapshot[] = [];
            const weFlat: Record<string, any> = { totalIncome, netWorth: nw, grossEstate, monthlySurplus: monthlySav, effectiveTaxRate: txResult?.effectiveRate || 0 };
            for (const mp of metricPaths) {
              const v = weFlat[mp.key];
              if (typeof v === 'number' && !isNaN(v)) {
                leftMetrics.push({ label: mp.label, value: v, format: mp.format });
                rightMetrics.push({ label: mp.label, value: v, format: mp.format });
              }
            }
            if (leftMetrics.length === 0) return null;
            return <CompareDiffOverlay leftMetrics={leftMetrics} rightMetrics={rightMetrics} leftLabel={leftLabel} rightLabel={rightLabel} />;
          })()}
          <div className={compareMode && comparePanel ? 'grid grid-cols-2 gap-4' : ''}>
          <div className={compareMode && comparePanel ? 'min-w-0 overflow-hidden' : ''}>

          {/* ═══ PANEL RENDERING ═══ */}
          {activePanel === 'client-wealth-hub' && <ClientWealthHub {...pp} onNavigateToPanel={(panelId: string) => setActivePanel(panelId as PanelId)} />}
          {activePanel === 'profile' && <ProfilePanel {...pp} />}
          {activePanel === 'cash' && <CashFlowPanel {...pp} />}
          {activePanel === 'protect' && <ProtectionPanel {...pp} />}
          {activePanel === 'grow' && <GrowthPanel {...pp} />}
          {activePanel === 'retire' && <RetirementPanel {...pp} />}
          {activePanel === 'tax' && <TaxPanel {...pp} />}
          {activePanel === 'estate' && <EstatePanel {...pp} />}
          {activePanel === 'edu' && <EducationPanel {...pp} />}
          {activePanel === 'advanced-strategies-hub' && <AdvancedStrategiesHub
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
            bcBizValue={bcBizValue} setBcBizValue={setBcBizValue}
            bcKeyPersonSalary={bcKeyPersonSalary} setBcKeyPersonSalary={setBcKeyPersonSalary}
            bcKeyPersonMult={bcKeyPersonMult} setBcKeyPersonMult={setBcKeyPersonMult}
            bcOwners={bcOwners} setBcOwners={setBcOwners}
            bcEmployees={bcEmployees} setBcEmployees={setBcEmployees}
            age={age} income={income + spouseIncome} grossEstate={grossEstate}
            onNavigateToPanel={(panelId: string) => setActivePanel(panelId as PanelId)}
            onCascadeUpdate={setAdvancedCascade}
          />}
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
          {activePanel === 'costben' && <StrategyAnalysisMergedPanel pp={pp} horizonData={horizonData} defaultTab={urlTabRef.current || undefined} savedScenarios={
            (sessionsQuery.data || []).map((s: any) => ({
              id: s.id,
              name: s.name,
              inputsJson: typeof s.inputsJson === 'string' ? JSON.parse(s.inputsJson) : (s.inputsJson || {}),
              resultsJson: typeof s.resultsJson === 'string' ? JSON.parse(s.resultsJson) : s.resultsJson,
              updatedAt: s.updatedAt,
            }))
          } />}
          {activePanel === 'summary' && <SummaryPanel {...pp} />}
          {activePanel === 'timeline' && <ActionTimelineMergedPanel pp={pp} defaultTab={urlTabRef.current || undefined} />}
          {activePanel === 'partner' && <PartnerPanel paLow={paLow} setPaLow={setPaLow} paMid={paMid} setPaMid={setPaMid} paHigh={paHigh} setPaHigh={setPaHigh} />}
          {activePanel === 'income' && <IncomeStreamsPanel incomeStreams={incomeStreams} setIncomeStreams={setIncomeStreams} scores={pp.scores} />}
          {activePanel === 'refs' && <ReferencesPanel />}

          {/* ═══ PRACTICE PLANNING PANELS ═══ */}
          {activePanel === 'myplan' && <MyPlanPanel {...practiceProps} />}
          {activePanel === 'gdcbrackets' && <GDCMergedPanel practiceProps={practiceProps} defaultTab={urlTabRef.current || undefined} />}
          {activePanel === 'products' && <ProductsPanel {...practiceProps} />}
          {activePanel === 'salesfunnel' && <SalesFunnelPanel {...practiceProps} />}
          {activePanel === 'recruiting' && <RecruitingMergedPanel practiceProps={practiceProps} defaultTab={urlTabRef.current || undefined} />}
          {activePanel === 'channels' && <ChannelsPanel {...practiceProps} />}
          {activePanel === 'dashboard' && <DashboardPanel {...practiceProps} />}
          {activePanel === 'pnl' && <PnLMergedPanel practiceProps={practiceProps} defaultTab={urlTabRef.current || undefined} />}
          {activePanel === 'goaltracker' && <GoalsTrackingMergedPanel practiceProps={practiceProps} defaultTab={urlTabRef.current || undefined} />}
          {activePanel === 'aumoverride' && <AUMMergedPanel defaultTab={urlTabRef.current || undefined} />}
          {activePanel === 'affiliatepipeline' && <AffiliatePipelinePanel />}
          {activePanel === 'prodopt' && <GrowthOptMergedPanel defaultTab={urlTabRef.current || undefined} />}

          {activePanel === 'balancesheet' && <BalanceSheetPanel nw={nw} savings={savings} retirement401k={retirement401k} mortgage={mortgage} debt={debt} />}
          {activePanel === 'debtmgmt' && <DebtManagementPanel mortgage={mortgage} debt={debt} income={income} />}
          {activePanel === 'trusteng' && <TrustMergedPanel grossEstate={grossEstate} exemption={exemption} defaultTab={urlTabRef.current || undefined} />}
          {activePanel === 'governance' && <GovernanceIPSPanel riskTolerance={riskTolerance} />}
          {activePanel === 'montecarlo' && <MonteCarloPanel savings={savings} retirement401k={retirement401k} monthlySav={monthlySav} retireAge={retireAge} age={age} />}
          {activePanel === 'stockcomp' && <StockCompPanel income={income} />}
          {activePanel === 'premfin' && <PremiumFinancingPanel income={totalIncome} grossEstate={grossEstate} savings={savings} />}
          {/* ilitrust merged into trusteng — Pass 152 */}
          {activePanel === 'execcomp' && <ExecCompPanel income={income} />}
          {activePanel === 'charitable' && <CharitablePlanningPanel income={income} />}
          {activePanel === 'duediligence' && <DueDiligencePanel />}
          {/* ═══ NEW ADVISORY & DATA PANELS (cascade-connected) ═══ */}
          {/* Real-time cascade toast notifications */}
          <CascadeToastBridge data={weData} />
          <WealthEngineProvider value={weData}>
            <Suspense fallback={<div className="flex items-center justify-center py-20"><span className="animate-spin">⏳</span></div>}>
              {activePanel === 'planning-hierarchy' && <UnifiedPlanMergedPanel defaultTab={urlTabRef.current || undefined} />}
              {activePanel === 'advanced-workflows' && <WeAdvancedWorkflows />}
              {activePanel === 'strategy-archetypes' && <WeStrategyArchetypes />}
              {activePanel === 'firm-comparison' && <WeFirmComparison />}
              {activePanel === 'cascade-alerts' && <CascadeIntelligenceMergedPanel weData={weData} onNavigateToPanel={(panelId: string) => setActivePanel(panelId as PanelId)} defaultTab={urlTabRef.current || undefined} />}
              {activePanel === 'financial-data-hub' && <WeFinancialDataHub />}
              {activePanel === 'scenario-comparison' && <ScenarioComparisonPanel weData={weData} gatherInputs={gatherInputs} restoreInputs={restoreInputs} />}
              {activePanel === 'pfr-wizard' && <PFRWizardPanel onNavigateToPanel={(id) => setActivePanel(id as PanelId)} weData={{
                holisticScore: holisticBridge.holisticScore,
                clientHubScore: holisticBridge.clientHubScore,
                advancedHubScore: holisticBridge.advancedHubScore,
                practiceHubScore: holisticBridge.practiceHubScore,
                domainScores: scorecard.domains.map(d => ({ domain: d.name, score: d.score, allocation: Math.round(d.score / d.maxScore * 100), gap: d.maxScore - d.score })),
                recommendations: recommendations.map((r: any) => ({ product: r.product, coverage: r.coverage, premium: r.premium, carrier: r.carrier, priority: r.priority, category: r.category })),
                // @ts-expect-error — property access on loosely typed object
                keyMetrics: { totalIncome, netWorth: nw, totalSavings: savings, retirementGap: rtResult.gap ?? 0, protectionCoverage: prResult.dimeNeed - prResult.gap, taxEfficiency: txResult.effectiveRate ?? 0 },
              }} />}
            </Suspense>
          </WealthEngineProvider>

          {/* ═══ TOOLS & REPORTS PANELS ═══ */}
          {activePanel === 'compliance-checklist' && <ComplianceChecklist clientName={clientName} />}
          {activePanel === 'generate-report' && <PersonaReportGenerator
            clientName={clientName}
            age={age}
            totalIncome={totalIncome}
            scorecard={scorecard}
            recommendations={recommendations}
            weData={weData}
          />}
          {activePanel === 'multi-compare' && <MultiClientComparison />}
          {/* cascade-flow merged into cascade-alerts — Pass 152 */}

          </div>{/* end primary panel column */}

          {/* ═══ COMPARE PANEL (right column, Pass 154) ═══ */}
          {compareMode && comparePanel && (
            <div className="min-w-0 overflow-hidden border-l border-border/30 pl-4">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/30">
                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Columns2 className="w-3.5 h-3.5 text-primary" />
                  Comparing: <span className="text-foreground">{allPanelItems.find(i => i.id === comparePanel)?.label || comparePanel}</span>
                </p>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setShowComparePicker(true)} className="text-[10px] text-primary hover:underline">Change</button>
                  <button type="button" onClick={() => { setCompareMode(false); setComparePanel(null); }} className="text-muted-foreground hover:text-foreground ml-1"><X className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <CompareRenderer panelId={comparePanel} pp={pp} practiceProps={practiceProps} weData={weData}
                urlTab={urlTabRef.current} sessionsData={sessionsQuery.data}
                gatherInputs={gatherInputs} restoreInputs={restoreInputs}
                holisticBridge={holisticBridge} grossEstate={grossEstate} exemption={exemption}
                totalIncome={totalIncome} income={income} savings={savings} retirement401k={retirement401k}
                mortgage={mortgage} debt={debt} nw={nw} monthlySav={monthlySav} retireAge={retireAge} age={age}
                riskTolerance={riskTolerance} clientName={clientName} scorecard={scorecard}
                recommendations={recommendations} horizonData={horizonData}
                setActivePanel={setActivePanel}
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
                bcBizValue={bcBizValue} setBcBizValue={setBcBizValue}
                bcKeyPersonSalary={bcKeyPersonSalary} setBcKeyPersonSalary={setBcKeyPersonSalary}
                bcKeyPersonMult={bcKeyPersonMult} setBcKeyPersonMult={setBcKeyPersonMult}
                bcOwners={bcOwners} setBcOwners={setBcOwners}
                bcEmployees={bcEmployees} setBcEmployees={setBcEmployees}
                incomeStreams={incomeStreams} setIncomeStreams={setIncomeStreams}
                paLow={paLow} setPaLow={setPaLow} paMid={paMid} setPaMid={setPaMid}
                paHigh={paHigh} setPaHigh={setPaHigh}
                advancedCascade={advancedCascade} setAdvancedCascade={setAdvancedCascade}
              />
            </div>
          )}
          </div>{/* end split-view grid */}

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
            <DialogDescription id="save-desc">Save your current calculator inputs as a named session ({sessionsQuery.data?.length || 0}/10 slots used). Sessions are stored securely and can be loaded from any device.</DialogDescription>
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
            <DialogDescription id="load-desc">Select a previously saved session to restore its calculator inputs ({sessionsQuery.data?.length || 0}/10 slots used). Loading a session will replace your current inputs.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto" role="list" aria-label="Saved sessions">
            {sessionsQuery.data?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No saved sessions yet.</p>
            )}
            {sessionsQuery.data?.map((s: any) => (
              <div key={s.id} role="listitem" className="flex items-center justify-between p-2 rounded-lg border border-border hover:bg-card transition-colors">
                <div className="cursor-pointer flex-1" role="button" tabIndex={0} onClick={() => handleLoad(s.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleLoad(s.id); } }}>
                  <p className="text-sm font-medium text-foreground">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{new Date(s.updatedAt).toLocaleDateString()}</p>
                </div>
                <Button variant="ghost" size="sm" aria-label="Delete saved scenario" onClick={() => { if (window.confirm('Delete this saved scenario?')) deleteMut.mutate({ id: s.id }); }}
                  className="text-red-400 hover:text-red-300 h-7 w-7 p-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      {/* ─── KEYBOARD SHORTCUTS CHEAT SHEET (Pass 155) ─── */}
      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent className="max-w-md" aria-describedby="shortcuts-desc">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Keyboard className="w-5 h-5 text-primary" /> Keyboard Shortcuts</DialogTitle>
            <DialogDescription id="shortcuts-desc">Quick reference for all available keyboard shortcuts in the Wealth Engine.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Navigation</p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-foreground">Focus search</span>
                  <kbd className="px-2 py-0.5 text-xs bg-muted rounded border border-border font-mono">⌘K / Ctrl+K</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground">Jump to favorite 1–9</span>
                  <kbd className="px-2 py-0.5 text-xs bg-muted rounded border border-border font-mono">1 – 9</kbd>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Panels</p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-foreground">Toggle compare mode</span>
                  <span className="text-xs text-muted-foreground">Toolbar button</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground">Drag to reorder sidebar</span>
                  <span className="text-xs text-muted-foreground">Grip handle</span>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">General</p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-foreground">Show this cheat sheet</span>
                  <kbd className="px-2 py-0.5 text-xs bg-muted rounded border border-border font-mono">?</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground">Close modal / clear search</span>
                  <kbd className="px-2 py-0.5 text-xs bg-muted rounded border border-border font-mono">Esc</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground">Undo last input change</span>
                  <kbd className="px-2 py-0.5 text-xs bg-muted rounded border border-border font-mono">{navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+Z</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground">Redo input change</span>
                  <kbd className="px-2 py-0.5 text-xs bg-muted rounded border border-border font-mono">{navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+Shift+Z</kbd>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShortcuts(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </AppShell>
      </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Pass 150 — Merged Wrapper Components
   Each consolidates two formerly-separate panels into a single tabbed view.
   ═══════════════════════════════════════════════════════════════════════════ */

function RecruitingMergedPanel({ practiceProps, defaultTab }: { practiceProps: PracticeProps; defaultTab?: string }) {
  const [view, setView] = useState<'roster' | 'funnel'>(defaultTab === 'funnel' ? 'funnel' : 'roster');
  return (
    <div className="space-y-3">
      <div className="flex gap-1 p-0.5 bg-muted/50 rounded-lg w-fit">
        <button type="button" onClick={() => setView('roster')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'roster' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Team Roster & Economics
        </button>
        <button type="button" onClick={() => setView('funnel')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'funnel' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Funnel Analytics & Benchmarks
        </button>
      </div>
      {view === 'roster' ? <RecruitingPanel {...practiceProps} /> : <RecruitingFunnelPanel />}
    </div>
  );
}

function PnLMergedPanel({ practiceProps, defaultTab }: { practiceProps: PracticeProps; defaultTab?: string }) {
  const [view, setView] = useState<'practice' | 'business'>(defaultTab === 'business' ? 'business' : 'practice');
  return (
    <div className="space-y-3">
      <div className="flex gap-1 p-0.5 bg-muted/50 rounded-lg w-fit">
        <button type="button" onClick={() => setView('practice')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'practice' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Practice P&L
        </button>
        <button type="button" onClick={() => setView('business')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'business' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Business Economics
        </button>
      </div>
      {view === 'practice' ? <PnLPanel {...practiceProps} /> : <PnLBusinessEconomicsPanel />}
    </div>
  );
}

function GDCMergedPanel({ practiceProps, defaultTab }: { practiceProps: PracticeProps; defaultTab?: string }) {
  const [view, setView] = useState<'brackets' | 'optimization'>(defaultTab === 'optimization' ? 'optimization' : 'brackets');
  return (
    <div className="space-y-3">
      <div className="flex gap-1 p-0.5 bg-muted/50 rounded-lg w-fit">
        <button type="button" onClick={() => setView('brackets')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'brackets' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          GDC Brackets
        </button>
        <button type="button" onClick={() => setView('optimization')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'optimization' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Override Optimization
        </button>
      </div>
      {view === 'brackets' ? <GDCBracketsPanel {...practiceProps} /> : <GDCOverrideOptPanel />}
    </div>
  );
}


/* ═══ PASS 151 MERGED PANELS ═══ */

function AUMMergedPanel({ defaultTab }: { defaultTab?: string }) {
  const [view, setView] = useState<'override' | 'pipeline'>(defaultTab === 'pipeline' ? 'pipeline' : 'override');
  return (
    <div className="space-y-3">
      <div className="flex gap-1 p-0.5 bg-muted/50 rounded-lg w-fit">
        <button type="button" onClick={() => setView('override')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'override' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          AUM Override
        </button>
        <button type="button" onClick={() => setView('pipeline')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'pipeline' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          AUM Pipeline
        </button>
      </div>
      {view === 'override' ? <AUMOverrideCascadePanel /> : <AUMPipelinePanel />}
    </div>
  );
}

function GoalsTrackingMergedPanel({ practiceProps, defaultTab }: { practiceProps: PracticeProps; defaultTab?: string }) {
  const [view, setView] = useState<'goals' | 'monthly'>(defaultTab === 'monthly' ? 'monthly' : 'goals');
  return (
    <div className="space-y-3">
      <div className="flex gap-1 p-0.5 bg-muted/50 rounded-lg w-fit">
        <button type="button" onClick={() => setView('goals')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'goals' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Goal Tracker
        </button>
        <button type="button" onClick={() => setView('monthly')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'monthly' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Monthly Production
        </button>
      </div>
      {view === 'goals' ? <GoalTrackerPanel {...practiceProps} /> : <MonthlyProductionPanel {...practiceProps} />}
    </div>
  );
}

function GrowthOptMergedPanel({ defaultTab }: { defaultTab?: string }) {
  const [view, setView] = useState<'production' | 'channels' | 'roi'>(defaultTab === 'channels' ? 'channels' : defaultTab === 'roi' ? 'roi' : 'production');
  return (
    <div className="space-y-3">
      <div className="flex gap-1 p-0.5 bg-muted/50 rounded-lg w-fit">
        <button type="button" onClick={() => setView('production')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'production' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Production
        </button>
        <button type="button" onClick={() => setView('channels')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'channels' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Channels
        </button>
        <button type="button" onClick={() => setView('roi')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'roi' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Marketing ROI
        </button>
      </div>
      {view === 'production' && <ProductionOptPanel />}
      {view === 'channels' && <ChannelDiversPanel />}
      {view === 'roi' && <MarketingROIPanel />}
    </div>
  );
}

function StrategyAnalysisMergedPanel({ pp, horizonData, savedScenarios, defaultTab }: { pp: any; horizonData: any; savedScenarios: any; defaultTab?: string }) {
  const [view, setView] = useState<'costbenefit' | 'compare'>(defaultTab === 'compare' ? 'compare' : 'costbenefit');
  return (
    <div className="space-y-3">
      <div className="flex gap-1 p-0.5 bg-muted/50 rounded-lg w-fit">
        <button type="button" onClick={() => setView('costbenefit')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'costbenefit' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Cost-Benefit
        </button>
        <button type="button" onClick={() => setView('compare')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'compare' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Strategy Compare
        </button>
      </div>
      {view === 'costbenefit' ? <CostBenefitPanel {...pp} horizonData={horizonData} /> : <StrategyComparePanel {...pp} savedScenarios={savedScenarios} />}
    </div>
  );
}

function ActionTimelineMergedPanel({ pp, defaultTab }: { pp: any; defaultTab?: string }) {
  const [view, setView] = useState<'actions' | 'timeline'>(defaultTab === 'timeline' ? 'timeline' : 'actions');
  return (
    <div className="space-y-3">
      <div className="flex gap-1 p-0.5 bg-muted/50 rounded-lg w-fit">
        <button type="button" onClick={() => setView('actions')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'actions' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Action Plan
        </button>
        <button type="button" onClick={() => setView('timeline')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'timeline' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Timeline
        </button>
      </div>
      {view === 'actions' ? <ActionPlanPanel {...pp} /> : <TimelinePanel {...pp} />}
    </div>
  );
}

function UnifiedPlanMergedPanel({ defaultTab }: { defaultTab?: string }) {
  const [view, setView] = useState<'hierarchy' | 'plan'>(defaultTab === 'plan' ? 'plan' : 'hierarchy');
  return (
    <div className="space-y-3">
      <div className="flex gap-1 p-0.5 bg-muted/50 rounded-lg w-fit">
        <button type="button" onClick={() => setView('hierarchy')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'hierarchy' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Planning Hierarchy
        </button>
        <button type="button" onClick={() => setView('plan')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'plan' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Unified Client Plan
        </button>
      </div>
      {view === 'hierarchy' ? <WePlanningHierarchy /> : <WeUnifiedClientPlan />}
    </div>
  );
}


/* ═══ PASS 152 MERGED PANELS ═══ */

function TrustMergedPanel({ grossEstate, exemption, defaultTab }: { grossEstate: number; exemption: number; defaultTab?: string }) {
  const [view, setView] = useState<'types' | 'ilit'>(defaultTab === 'ilit' ? 'ilit' : 'types');
  return (
    <div className="space-y-3">
      <div className="flex gap-1 p-0.5 bg-muted/50 rounded-lg w-fit">
        <button type="button" onClick={() => setView('types')}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${view === 'types' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Trust Types
        </button>
        <button type="button" onClick={() => setView('ilit')}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${view === 'ilit' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          ILIT Calculator
        </button>
      </div>
      {view === 'types' ? <TrustEngineeringPanel grossEstate={grossEstate} exemption={exemption} /> : <ILITTrustPanel grossEstate={grossEstate} exemption={exemption} />}
    </div>
  );
}

function CascadeIntelligenceMergedPanel({ weData, onNavigateToPanel, defaultTab }: { weData: any; onNavigateToPanel: (id: string) => void; defaultTab?: string }) {
  const [view, setView] = useState<'alerts' | 'flow'>(defaultTab === 'flow' ? 'flow' : 'alerts');
  return (
    <div className="space-y-3">
      <div className="flex gap-1 p-0.5 bg-muted/50 rounded-lg w-fit">
        <button type="button" onClick={() => setView('alerts')}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${view === 'alerts' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Alerts & Actions
        </button>
        <button type="button" onClick={() => setView('flow')}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${view === 'flow' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Flow Diagram
        </button>
      </div>
      {view === 'alerts' ? <Suspense fallback={<div className="flex items-center justify-center py-20"><span className="animate-spin">⏳</span></div>}><WeCascadeAlerts /></Suspense> : <CascadeFlowDiagram weData={weData} onNavigateToPanel={onNavigateToPanel} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CompareRenderer — Renders any panel by ID for split-view comparison.
   Pass 154 — Panel Comparison Split-View
   ═══════════════════════════════════════════════════════════════ */
function CompareRenderer({ panelId, pp, practiceProps, weData, urlTab, sessionsData,
  gatherInputs, restoreInputs, holisticBridge, grossEstate, exemption,
  totalIncome, income, savings, retirement401k, mortgage, debt, nw, monthlySav, retireAge, age,
  riskTolerance, clientName, scorecard, recommendations, horizonData,
  setActivePanel,
  pfFace, setPfFace, pfPrem, setPfPrem, pfCash, setPfCash, pfLoan, setPfLoan,
  pfCred, setPfCred, pfYrs, setPfYrs,
  ilDB, setIlDB, ilPr, setIlPr, ilCr, setIlCr, ilTx, setIlTx,
  exSal, setExSal, ex162, setEx162, exSERP, setExSERP, exSD, setExSD,
  cvCRT, setCvCRT, cvPO, setCvPO, cvDAF, setCvDAF, cvLI, setCvLI,
  advGoal, setAdvGoal,
  bcBizValue, setBcBizValue, bcKeyPersonSalary, setBcKeyPersonSalary,
  bcKeyPersonMult, setBcKeyPersonMult, bcOwners, setBcOwners, bcEmployees, setBcEmployees,
  incomeStreams, setIncomeStreams,
  paLow, setPaLow, paMid, setPaMid, paHigh, setPaHigh,
  advancedCascade, setAdvancedCascade,
}: any) {
  const savedScenarios = (sessionsData || []).map((s: any) => ({
    id: s.id, name: s.name,
    inputsJson: typeof s.inputsJson === 'string' ? JSON.parse(s.inputsJson) : (s.inputsJson || {}),
    resultsJson: typeof s.resultsJson === 'string' ? JSON.parse(s.resultsJson) : s.resultsJson,
    updatedAt: s.updatedAt,
  }));

  switch (panelId) {
    case 'profile': return <ProfilePanel {...pp} />;
    case 'cash': return <CashFlowPanel {...pp} />;
    case 'protect': return <ProtectionPanel {...pp} />;
    case 'grow': return <GrowthPanel {...pp} />;
    case 'retire': return <RetirementPanel {...pp} />;
    case 'tax': return <TaxPanel {...pp} />;
    case 'estate': return <EstatePanel {...pp} />;
    case 'edu': return <EducationPanel {...pp} />;
    case 'summary': return <SummaryPanel {...pp} />;
    case 'refs': return <ReferencesPanel />;
    case 'partner': return <PartnerPanel paLow={paLow} setPaLow={setPaLow} paMid={paMid} setPaMid={setPaMid} paHigh={paHigh} setPaHigh={setPaHigh} />;
    case 'income': return <IncomeStreamsPanel incomeStreams={incomeStreams} setIncomeStreams={setIncomeStreams} scores={pp.scores} />;
    case 'bizclient': return <BusinessClientPanel bcBizValue={bcBizValue} setBcBizValue={setBcBizValue} bcKeyPersonSalary={bcKeyPersonSalary} setBcKeyPersonSalary={setBcKeyPersonSalary} bcKeyPersonMult={bcKeyPersonMult} setBcKeyPersonMult={setBcKeyPersonMult} bcOwners={bcOwners} setBcOwners={setBcOwners} bcEmployees={bcEmployees} setBcEmployees={setBcEmployees} age={age} />;
    case 'costben': return <StrategyAnalysisMergedPanel pp={pp} horizonData={horizonData} defaultTab={urlTab || undefined} savedScenarios={savedScenarios} />;
    case 'timeline': return <ActionTimelineMergedPanel pp={pp} defaultTab={urlTab || undefined} />;
    case 'balancesheet': return <BalanceSheetPanel nw={nw} savings={savings} retirement401k={retirement401k} mortgage={mortgage} debt={debt} />;
    case 'debtmgmt': return <DebtManagementPanel mortgage={mortgage} debt={debt} income={income} />;
    case 'trusteng': return <TrustMergedPanel grossEstate={grossEstate} exemption={exemption} defaultTab={urlTab || undefined} />;
    case 'governance': return <GovernanceIPSPanel riskTolerance={riskTolerance} />;
    case 'montecarlo': return <MonteCarloPanel savings={savings} retirement401k={retirement401k} monthlySav={monthlySav} retireAge={retireAge} age={age} />;
    case 'stockcomp': return <StockCompPanel income={income} />;
    case 'premfin': return <PremiumFinancingPanel income={totalIncome} grossEstate={grossEstate} savings={savings} />;
    case 'execcomp': return <ExecCompPanel income={income} />;
    case 'charitable': return <CharitablePlanningPanel income={income} />;
    case 'duediligence': return <DueDiligencePanel />;
    // Practice panels
    case 'myplan': return <MyPlanPanel {...practiceProps} />;
    case 'gdcbrackets': return <GDCMergedPanel practiceProps={practiceProps} defaultTab={urlTab || undefined} />;
    case 'products': return <ProductsPanel {...practiceProps} />;
    case 'salesfunnel': return <SalesFunnelPanel {...practiceProps} />;
    case 'recruiting': return <RecruitingMergedPanel practiceProps={practiceProps} defaultTab={urlTab || undefined} />;
    case 'channels': return <ChannelsPanel {...practiceProps} />;
    case 'dashboard': return <DashboardPanel {...practiceProps} />;
    case 'pnl': return <PnLMergedPanel practiceProps={practiceProps} defaultTab={urlTab || undefined} />;
    case 'goaltracker': return <GoalsTrackingMergedPanel practiceProps={practiceProps} defaultTab={urlTab || undefined} />;
    case 'aumoverride': return <AUMMergedPanel defaultTab={urlTab || undefined} />;
    case 'affiliatepipeline': return <AffiliatePipelinePanel />;
    case 'prodopt': return <GrowthOptMergedPanel defaultTab={urlTab || undefined} />;
    // WealthEngine panels (lazy)
    case 'planning-hierarchy': return <Suspense fallback={<div className="py-10 text-center text-xs text-muted-foreground animate-pulse">Loading...</div>}><UnifiedPlanMergedPanel defaultTab={urlTab || undefined} /></Suspense>;
    case 'cascade-alerts': return <Suspense fallback={<div className="py-10 text-center text-xs text-muted-foreground animate-pulse">Loading...</div>}><CascadeIntelligenceMergedPanel weData={weData} onNavigateToPanel={(id: string) => setActivePanel(id)} defaultTab={urlTab || undefined} /></Suspense>;
    case 'financial-data-hub': return <Suspense fallback={<div className="py-10 text-center text-xs text-muted-foreground animate-pulse">Loading...</div>}><WeFinancialDataHub /></Suspense>;
    case 'scenario-comparison': return <Suspense fallback={<div className="py-10 text-center text-xs text-muted-foreground animate-pulse">Loading...</div>}><ScenarioComparisonPanel weData={weData} gatherInputs={gatherInputs} restoreInputs={restoreInputs} /></Suspense>;
    case 'firm-comparison': return <Suspense fallback={<div className="py-10 text-center text-xs text-muted-foreground animate-pulse">Loading...</div>}><WeFirmComparison /></Suspense>;
    case 'advanced-workflows': return <Suspense fallback={<div className="py-10 text-center text-xs text-muted-foreground animate-pulse">Loading...</div>}><WeAdvancedWorkflows /></Suspense>;
    case 'strategy-archetypes': return <Suspense fallback={<div className="py-10 text-center text-xs text-muted-foreground animate-pulse">Loading...</div>}><WeStrategyArchetypes /></Suspense>;
    // Hub & composite panels
    case 'client-wealth-hub': return <ClientWealthHub {...pp} onNavigateToPanel={(id: string) => setActivePanel(id)} />;
    case 'advanced-strategies-hub': return <AdvancedStrategiesHub
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
      bcBizValue={bcBizValue} setBcBizValue={setBcBizValue}
      bcKeyPersonSalary={bcKeyPersonSalary} setBcKeyPersonSalary={setBcKeyPersonSalary}
      bcKeyPersonMult={bcKeyPersonMult} setBcKeyPersonMult={setBcKeyPersonMult}
      bcOwners={bcOwners} setBcOwners={setBcOwners}
      bcEmployees={bcEmployees} setBcEmployees={setBcEmployees}
      age={age} income={totalIncome} grossEstate={grossEstate}
      onNavigateToPanel={(id: string) => setActivePanel(id)}
      onCascadeUpdate={setAdvancedCascade}
    />;
    case 'advanced': return <AdvancedStrategiesPanel
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
    />;
    // @ts-expect-error — strict mode fix
    case 'compliance-checklist': return <ComplianceChecklist clientName={clientName} age={age} totalIncome={totalIncome} scorecard={scorecard} recommendations={recommendations} weData={weData} />;
    case 'multi-compare': return <MultiClientComparison />;
    // pfr-wizard and generate-report are complex wizards; show info message in compare
    case 'pfr-wizard':
    case 'generate-report':
      return <div className="py-10 text-center text-sm text-muted-foreground">This panel works best in full-width view. Select it from the sidebar to use it.</div>;
    default:
      return <div className="py-10 text-center text-sm text-muted-foreground">Panel "{panelId}" is not available in compare view.</div>;
  }
}
