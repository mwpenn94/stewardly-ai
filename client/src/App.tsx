import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { SectionErrorBoundary } from "./components/SectionErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import ConsentBanner from "./components/ConsentBanner";
import OfflineBanner from "./components/OfflineBanner";
import { GuestBanner } from "./components/GuestBanner";
import { ContextualHelp } from "./components/ContextualHelp";
import { KeyboardShortcuts } from "./components/KeyboardShortcuts";
import { CommandPalette } from "./components/CommandPalette";
import { VoiceOnboardingCoach } from "./components/VoiceOnboardingCoach";
import { useGuestSession } from "./hooks/useGuestSession";
import GlobalFooter from "./components/GlobalFooter";
import { NotificationProvider } from "./contexts/NotificationContext";
import { usePageTracking } from "./hooks/useExponentialTracking";
import PageSuspenseFallback from "./components/PageSuspenseFallback";
import { lazy, Suspense } from "react";

import { AudioCompanionProvider } from "./components/AudioCompanion";
import { PILProvider } from "./components/PlatformIntelligence";

// ── Eagerly loaded (critical path — instant navigation) ──────────────
import Landing from "./pages/Landing";
import SignIn from "./pages/SignIn";
import Chat from "./pages/Chat";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Welcome from "./pages/Welcome";

// ── Lazy loaded (code-split — loaded on demand) ──────────────────────
const Calculators = lazy(() => import("./pages/Calculators"));
// Wealth-engine pages (Phase 4 — UWE/BIE/HE React UI)
const WeStrategyComparison = lazy(() => import("./pages/wealth-engine/StrategyComparison"));
const WeRetirement = lazy(() => import("./pages/wealth-engine/Retirement"));
const WePracticeToWealth = lazy(() => import("./pages/wealth-engine/PracticeToWealth"));
const WeQuickQuote = lazy(() => import("./pages/wealth-engine/QuickQuoteFlow"));
const WeTeamBuilder = lazy(() => import("./pages/wealth-engine/TeamBuilder"));
const WeSensitivity = lazy(() => import("./pages/wealth-engine/Sensitivity"));
const WeWhatIfSensitivity = lazy(() => import("./pages/wealth-engine/WhatIfSensitivity"));
const WeReferenceHub = lazy(() => import("./pages/wealth-engine/ReferenceHub"));
const WeBusinessIncome = lazy(() => import("./pages/wealth-engine/BusinessIncome"));
const WeWealthConfigurator = lazy(() => import("./pages/wealth-engine/WealthConfigurator"));
// Code Chat (Round B5 admin UI)
const CodeChatPage = lazy(() => import("./pages/CodeChat"));
// Consensus (Round C3 — multi-model consensus stream UI)
const ConsensusPage = lazy(() => import("./pages/Consensus"));
// Engine Dashboard (parallel main-branch effort: UWE/BIE/HE visualization at /engine-dashboard)
const EngineDashboard = lazy(() => import("./pages/EngineDashboard"));
const Products = lazy(() => import("./pages/Products"));
const ManagerDashboard = lazy(() => import("./pages/ManagerDashboard"));
const SettingsHub = lazy(() => import("./pages/SettingsHub"));
const OrgBrandingEditor = lazy(() => import("./pages/OrgBrandingEditor"));
const OrgLanding = lazy(() => import("./pages/OrgLanding"));
const GlobalAdmin = lazy(() => import("./pages/GlobalAdmin"));
const Portal = lazy(() => import("./pages/Portal"));
const Organizations = lazy(() => import("./pages/Organizations"));
const InsuranceApplications = lazy(() => import("./pages/PartGPages").then(m => ({ default: m.InsuranceApplications })));
const AdvisoryExecution = lazy(() => import("./pages/PartGPages").then(m => ({ default: m.AdvisoryExecution })));
const CarrierConnector = lazy(() => import("./pages/PartGPages").then(m => ({ default: m.CarrierConnector })));
const ImprovementEngine = lazy(() => import("./pages/ImprovementEngine"));
const Integrations = lazy(() => import("./pages/Integrations"));
const BCP = lazy(() => import("./pages/BCP"));
const FairnessTestDashboard = lazy(() => import("./pages/FairnessTestDashboard"));
const KnowledgeAdmin = lazy(() => import("./pages/KnowledgeAdmin"));
const AdminIntegrations = lazy(() => import("./pages/AdminIntegrations"));
const DynamicIntegrations = lazy(() => import("./pages/DynamicIntegrations"));
const AdvisorIntegrations = lazy(() => import("./pages/AdvisorIntegrations"));
const IntegrationHealth = lazy(() => import("./pages/IntegrationHealth"));
const SuitabilityPanel = lazy(() => import("./pages/SuitabilityPanel"));
const ProficiencyDashboard = lazy(() => import("./pages/ProficiencyDashboard"));
const ProductIntelligence = lazy(() => import("./pages/ProductIntelligence"));
const AdminIntelligenceDashboard = lazy(() => import("./pages/AdminIntelligenceDashboard"));
const PlatformGuide = lazy(() => import("./pages/PlatformGuide"));
const PassiveActions = lazy(() => import("./pages/PassiveActions"));
const MarketData = lazy(() => import("./pages/MarketData"));
const OperationsHub = lazy(() => import("./pages/OperationsHub"));
const IntelligenceHub = lazy(() => import("./pages/IntelligenceHub"));
const AdvisoryHub = lazy(() => import("./pages/AdvisoryHub"));
const RelationshipsHub = lazy(() => import("./pages/RelationshipsHub"));
const Help = lazy(() => import("./pages/Help"));
const Compliance = lazy(() => import("./pages/Compliance"));
const Workflows = lazy(() => import("./pages/Workflows"));
const AgentManager = lazy(() => import("./pages/AgentManager"));
const Changelog = lazy(() => import("./pages/Changelog"));
const ImportData = lazy(() => import("./pages/ImportData"));
const LeadPipeline = lazy(() => import("./pages/LeadPipeline"));
const LeadDetail = lazy(() => import("./pages/LeadDetail"));
const CRMSync = lazy(() => import("./pages/CRMSync"));
const ComplianceAudit = lazy(() => import("./pages/ComplianceAudit"));
const TaxPlanning = lazy(() => import("./pages/TaxPlanning"));
const InsuranceAnalysis = lazy(() => import("./pages/InsuranceAnalysis"));
const EstatePlanning = lazy(() => import("./pages/EstatePlanning"));
const SocialSecurity = lazy(() => import("./pages/SocialSecurity"));
const MedicareAnalysis = lazy(() => import("./pages/MedicareAnalysis"));
const RiskAssessment = lazy(() => import("./pages/RiskAssessment"));
const IncomeProjection = lazy(() => import("./pages/IncomeProjection"));
const PublicCalculators = lazy(() => import("./pages/PublicCalculators"));
const FinancialPlanning = lazy(() => import("./pages/FinancialPlanning"));
const EmbedWidget = lazy(() => import("./pages/EmbedWidget"));
const AdvisorProfile = lazy(() => import("./pages/AdvisorProfile"));
const TeamManagement = lazy(() => import("./pages/TeamManagement"));
const BillingPage = lazy(() => import("./pages/BillingPage"));
const APIKeys = lazy(() => import("./pages/APIKeys"));
const WebhookManager = lazy(() => import("./pages/WebhookManager"));
const ClientOnboarding = lazy(() => import("./pages/ClientOnboarding"));
const FinancialProtectionScore = lazy(() => import("./pages/FinancialProtectionScore"));
const Community = lazy(() => import("./pages/Community"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const AdminSystemHealth = lazy(() => import("./pages/AdminSystemHealth"));
const ImprovementDashboard = lazy(() => import("./pages/ImprovementDashboard"));
const AdminDataFreshness = lazy(() => import("./pages/AdminDataFreshness"));
const AdminLeadSources = lazy(() => import("./pages/AdminLeadSources"));
const AdminRateManagement = lazy(() => import("./pages/AdminRateManagement"));
const AdminPlatformReports = lazy(() => import("./pages/AdminPlatformReports"));
const ClientDashboard = lazy(() => import("./pages/ClientDashboard"));
// EMBA Learning integration (April 2026)
const LearningHome = lazy(() => import("./pages/learning/LearningHome"));
const LicenseTracker = lazy(() => import("./pages/learning/LicenseTracker"));
const ContentStudio = lazy(() => import("./pages/learning/ContentStudio"));
const LearningTrackDetail = lazy(() => import("./pages/learning/LearningTrackDetail"));
const LearningFlashcardStudy = lazy(() => import("./pages/learning/LearningFlashcardStudy"));
const LearningQuizRunner = lazy(() => import("./pages/learning/LearningQuizRunner"));
const LearningDueReview = lazy(() => import("./pages/learning/LearningDueReview"));
const LearningSearch = lazy(() => import("./pages/learning/LearningSearch"));
// Pass 120+ new components
const NewLanding = lazy(() => import("./pages/NewLanding"));
const MyWork = lazy(() => import("./pages/MyWork"));
const MyFinancialTwin = lazy(() => import("./pages/MyFinancialTwin"));
const ExamSimulatorPage = lazy(() => import("./pages/learning/ExamSimulatorPage"));
const DisciplineDeepDive = lazy(() => import("./pages/learning/DisciplineDeepDive"));
const CaseStudySimulator = lazy(() => import("./pages/learning/CaseStudySimulator"));
const AchievementSystem = lazy(() => import("./pages/learning/AchievementSystem"));
const ConnectionMap = lazy(() => import("./pages/learning/ConnectionMap"));
const AudioPreferences = lazy(() => import("./pages/settings/AudioPreferences"));
// Comparables — competitive gap dashboard (hybrid build loop, pass 1)
const ComparablesPage = lazy(() => import("./pages/Comparables"));
// Rebalancing — portfolio drift preview (hybrid build loop, pass 3)
const RebalancingPage = lazy(() => import("./pages/Rebalancing"));

function Router() {
  return (
    <Suspense fallback={<PageSuspenseFallback />}>
      <Switch>
        {/* Public routes */}
        <Route path={"/"} component={Landing} />
        <Route path={"/signin"} component={SignIn} />
        <Route path={"/org/:slug"} component={OrgLanding} />
        <Route path={"/welcome"} component={Welcome} />
        <Route path={"/terms"} component={Terms} />
        <Route path={"/privacy"} component={Privacy} />

        {/* Core app routes */}
        <Route path={"/chat"} component={Chat} />
        <Route path={"/chat/:id"} component={Chat} />
        <Route path={"/calculators"} component={Calculators} />
        {/* ── Wealth Engine (Phase 4) — wrapped in SectionErrorBoundary ─── */}
        <Route path={"/wealth-engine/strategy-comparison"}>{() => <SectionErrorBoundary sectionName="Strategy Comparison"><WeStrategyComparison /></SectionErrorBoundary>}</Route>
        <Route path={"/wealth-engine/retirement"}>{() => <SectionErrorBoundary sectionName="Retirement Calculator"><WeRetirement /></SectionErrorBoundary>}</Route>
        <Route path={"/wealth-engine/practice-to-wealth"}>{() => <SectionErrorBoundary sectionName="Practice to Wealth"><WePracticeToWealth /></SectionErrorBoundary>}</Route>
        <Route path={"/wealth-engine/quick-quote"}>{() => <SectionErrorBoundary sectionName="Quick Quote"><WeQuickQuote /></SectionErrorBoundary>}</Route>
        <Route path={"/wealth-engine/team-builder"}>{() => <SectionErrorBoundary sectionName="Team Builder"><WeTeamBuilder /></SectionErrorBoundary>}</Route>
        <Route path={"/wealth-engine/sensitivity"}>{() => <SectionErrorBoundary sectionName="Sensitivity Analysis"><WeSensitivity /></SectionErrorBoundary>}</Route>
        <Route path={"/wealth-engine/references"}>{() => <SectionErrorBoundary sectionName="Reference Hub"><WeReferenceHub /></SectionErrorBoundary>}</Route>
        <Route path={"/wealth-engine/business-income"}>{() => <SectionErrorBoundary sectionName="Business Income"><WeBusinessIncome /></SectionErrorBoundary>}</Route>
        <Route path={"/wealth-engine/configurator"}>{() => <SectionErrorBoundary sectionName="Wealth Configurator"><WeWealthConfigurator /></SectionErrorBoundary>}</Route>
        <Route path={"/wealth-engine/what-if"}>{() => <SectionErrorBoundary sectionName="What-If Analysis"><WeWhatIfSensitivity /></SectionErrorBoundary>}</Route>
        {/* Code Chat (admin foundation) */}
        <Route path={"/code-chat"} component={CodeChatPage} />
        {/* Consensus (Round C — multi-model consensus stream) */}
        <Route path={"/consensus"} component={ConsensusPage} />
        {/* Engine Dashboard (parallel main-branch UWE/BIE/HE visualization) */}
        <Route path={"/engine-dashboard"} component={EngineDashboard} />
        <Route path={"/products"} component={Products} />
        <Route path={"/manager"} component={ManagerDashboard} />
        <Route path={"/org-branding"} component={OrgBrandingEditor} />
        <Route path={"/admin"} component={GlobalAdmin} />
        {/* meetings, insights, planning, coach, compliance, marketplace → redirected to hubs */}
        <Route path={"/portal"} component={Portal} />
        <Route path={"/organizations"} component={Organizations} />
        {/* Non-redirected feature pages (still standalone) */}
        <Route path={"/insurance-applications"} component={InsuranceApplications} />
        <Route path={"/advisory-execution"} component={AdvisoryExecution} />
        <Route path={"/carrier-connector"} component={CarrierConnector} />
        <Route path={"/improvement"} component={ImprovementEngine} />
        <Route path={"/integrations"} component={Integrations} />
        <Route path={"/admin/bcp"} component={BCP} />
        <Route path={"/admin/fairness"} component={FairnessTestDashboard} />
        <Route path={"/admin/knowledge"} component={KnowledgeAdmin} />
        <Route path={"/admin/integrations"} component={AdminIntegrations} />
        <Route path={"/my-integrations"} component={AdvisorIntegrations} />
        <Route path={"/integration-health"} component={IntegrationHealth} />
        <Route path={"/dynamic-integrations"} component={DynamicIntegrations} />
        <Route path={"/suitability-panel"} component={SuitabilityPanel} />
        <Route path={"/proficiency"} component={ProficiencyDashboard} />
        <Route path={"/product-intelligence"} component={ProductIntelligence} />
        <Route path={"/admin/intelligence"} component={AdminIntelligenceDashboard} />
        <Route path={"/admin/guide"} component={PlatformGuide} />
        <Route path={"/passive-actions"} component={PassiveActions} />
        <Route path={"/market-data"} component={MarketData} />

        {/* New feature pages */}
        <Route path="/import" component={ImportData} />
        <Route path="/leads" component={LeadPipeline} />
        <Route path="/leads/:id" component={LeadDetail} />
        <Route path="/crm-sync" component={CRMSync} />
        <Route path="/compliance-audit" component={ComplianceAudit} />
        <Route path="/tax-planning" component={TaxPlanning} />
        <Route path="/insurance-analysis" component={InsuranceAnalysis} />
        <Route path="/estate" component={EstatePlanning} />
        <Route path="/social-security" component={SocialSecurity} />
        <Route path="/medicare" component={MedicareAnalysis} />
        <Route path="/risk-assessment" component={RiskAssessment} />
        <Route path="/income-projection" component={IncomeProjection} />
        <Route path="/public-calculators" component={PublicCalculators} />
        <Route path="/embed" component={EmbedWidget} />
        <Route path="/advisor/:id" component={AdvisorProfile} />
        <Route path="/admin/team" component={TeamManagement} />
        <Route path="/admin/billing" component={BillingPage} />
        <Route path="/admin/api-keys" component={APIKeys} />
        <Route path="/admin/webhooks" component={WebhookManager} />
        <Route path="/client-onboarding" component={ClientOnboarding} />
        <Route path="/protection-score" component={FinancialProtectionScore} />
        <Route path="/financial-planning" component={FinancialPlanning} />
        <Route path="/financial-protection-score" component={FinancialProtectionScore} />
        <Route path="/community" component={Community} />
        <Route path="/unsubscribe" component={Unsubscribe} />
        <Route path="/admin/system-health" component={AdminSystemHealth} />
        <Route path="/admin/improvement" component={ImprovementDashboard} />
        <Route path="/admin/data-freshness" component={AdminDataFreshness} />
        <Route path="/admin/lead-sources" component={AdminLeadSources} />
        <Route path="/admin/rate-management" component={AdminRateManagement} />
        <Route path="/admin/platform-reports" component={AdminPlatformReports} />
        <Route path="/client-dashboard" component={ClientDashboard} />

        {/* Pass 120+ new persona routes */}
        <Route path="/my-work">{() => <MyWork />}</Route>
        <Route path="/financial-twin">{() => <MyFinancialTwin />}</Route>
        <Route path="/welcome-landing" component={NewLanding} />
        <Route path="/settings/audio">{() => <AudioPreferences />}</Route>

        {/* EMBA Learning & Licensing (April 2026) */}
        <Route path="/learning" component={LearningHome} />
        <Route path="/learning/licenses" component={LicenseTracker} />
        <Route path="/learning/studio" component={ContentStudio} />
        <Route path="/learning/studio/:tab" component={ContentStudio} />
        <Route path="/learning/tracks/:slug" component={LearningTrackDetail} />
        <Route path="/learning/tracks/:slug/study" component={LearningFlashcardStudy} />
        <Route path="/learning/tracks/:slug/quiz" component={LearningQuizRunner} />
        <Route path="/learning/review" component={LearningDueReview} />
        <Route path="/learning/search" component={LearningSearch} />
        {/* Pass 120+ learning extensions */}
        <Route path="/learning/exam/:moduleSlug">{() => <ExamSimulatorPage />}</Route>
        <Route path="/learning/discipline/:slug">{() => <DisciplineDeepDive />}</Route>
        <Route path="/learning/case/:caseId">{() => <CaseStudySimulator />}</Route>
        <Route path="/learning/connections">{() => <ConnectionMap />}</Route>
        <Route path="/learning/achievements">{() => <AchievementSystem />}</Route>

        {/* Consolidated Hub Pages */}
        {/* Comparables — competitive gap dashboard (hybrid build loop pass 1) */}
        <Route path={"/comparables"} component={ComparablesPage} />
        {/* Rebalancing — portfolio drift preview (hybrid build loop pass 3) */}
        <Route path={"/rebalancing"} component={RebalancingPage} />

        <Route path={"/operations"} component={OperationsHub} />
        <Route path={"/agents"} component={AgentManager} />
        <Route path={"/intelligence-hub"} component={IntelligenceHub} />
        <Route path={"/advisory"} component={AdvisoryHub} />
        <Route path={"/relationships"} component={RelationshipsHub} />

        {/* Unified Settings hub */}
        <Route path={"/settings"}>
          <Redirect to="/settings/profile" />
        </Route>
        <Route path={"/settings/:tab"} component={SettingsHub} />

        {/* Legacy redirects — keep old URLs working */}
        <Route path={"/documents"}>
          <Redirect to="/settings/knowledge" />
        </Route>
        <Route path={"/suitability"}>
          <Redirect to="/settings/suitability" />
        </Route>
        <Route path={"/ai-settings"}>
          <Redirect to="/settings/ai-tuning" />
        </Route>
        <Route path={"/help"} component={Help} />
        <Route path={"/changelog"} component={Changelog} />

        {/* C27: Redirects from absorbed Tier 1 pages to hubs */}
        <Route path={"/study"}><Redirect to="/chat" /></Route>
        <Route path={"/education"}><Redirect to="/chat" /></Route>
        <Route path={"/meetings"}><Redirect to="/relationships" /></Route>
        <Route path={"/coach"}><Redirect to="/chat" /></Route>
        <Route path={"/planning"}><Redirect to="/chat" /></Route>
        <Route path={"/insights"}><Redirect to="/chat" /></Route>
        <Route path={"/student-loans"}><Redirect to="/chat" /></Route>
        <Route path={"/equity-comp"}><Redirect to="/chat" /></Route>
        <Route path={"/digital-assets"}><Redirect to="/chat" /></Route>
        <Route path={"/agentic"}><Redirect to="/operations" /></Route>
        <Route path={"/agent-operations"}><Redirect to="/operations" /></Route>
        <Route path={"/licensed-review"}><Redirect to="/operations" /></Route>
        <Route path="/workflows"><Workflows /></Route>
        <Route path={"/compliance"}><Redirect to="/operations" /></Route>
        <Route path={"/data-intelligence"}><Redirect to="/intelligence-hub" /></Route>
        <Route path={"/analytics-hub"}><Redirect to="/intelligence-hub" /></Route>
        <Route path={"/model-results"}><Redirect to="/intelligence-hub" /></Route>
        <Route path={"/intelligence"}><Redirect to="/intelligence-hub" /></Route>
        <Route path={"/insurance-quotes"}><Redirect to="/advisory" /></Route>
        <Route path={"/estate-planning"}><Redirect to="/advisory" /></Route>
        <Route path={"/premium-finance"}><Redirect to="/advisory" /></Route>
        <Route path={"/marketplace"}><Redirect to="/advisory" /></Route>
        <Route path={"/coi-network"}><Redirect to="/relationships" /></Route>
        <Route path={"/email-campaigns"}><Redirect to="/relationships" /></Route>
        <Route path={"/professionals"}><Redirect to="/relationships" /></Route>

        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function AppContent() {
  // Auto-provision guest session for anonymous visitors
  useGuestSession();
  // Track page visits for the Exponential Engine (adaptive AI personalization)
  usePageTracking();
  return (
    <>
      <OfflineBanner />
      <GuestBanner />
      <Router />
      <ConsentBanner />
      <GlobalFooter />
      <ContextualHelp />
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <NotificationProvider>
            <AudioCompanionProvider>
              <PILProvider>
                <Toaster />
                <KeyboardShortcuts />
                <CommandPalette />
                <VoiceOnboardingCoach />
                <AppContent />
              </PILProvider>
            </AudioCompanionProvider>
          </NotificationProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
