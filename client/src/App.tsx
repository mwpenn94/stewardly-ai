import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import { ScrollToTop } from "./components/ScrollToTop";
import ServiceStatusBanner from "./components/ServiceStatusBanner";
import { OnboardingTour, useOnboardingTour } from "./components/OnboardingTour";
import { AuthProvider } from "./contexts/AuthContext";
// GlobalFooter removed permanently per user request (redundant nav)
import { NotificationProvider } from "./contexts/NotificationContext";
import { usePageTracking } from "./hooks/useExponentialTracking";
import PageSuspenseFallback from "./components/PageSuspenseFallback";
import { lazy, Suspense, useEffect } from "react";

import { AudioCompanionProvider } from "./components/AudioCompanion";
import { PILProvider } from "./components/PlatformIntelligence";
import { LiveAnnouncer } from "./lib/multisensory/LiveAnnouncer";
// VisualAnnouncer, IntentRouter removed (dead code cleanup Pass 147)
import { GlobalVoiceFAB } from "./components/GlobalVoiceFAB";
import { useGlobalShortcuts } from "./lib/multisensory/useGlobalShortcuts";

// ── Lazy loaded (critical path — still code-split for bundle size) ────
const Landing = lazy(() => import("./pages/Landing"));
const SignIn = lazy(() => import("./pages/SignIn"));
const Chat = lazy(() => import("./pages/Chat"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Welcome = lazy(() => import("./pages/Welcome"));
const NotFound = lazy(() => import("./pages/NotFound"));

// ── Lazy loaded (code-split — loaded on demand) ──────────────────────
const Calculators = lazy(() => import("./pages/Calculators"));
const EmbedCalculator = lazy(() => import("./pages/EmbedCalculator"));
// Wealth-engine hub (Phase 4 — single hub with internal sidebar navigation)
// Legacy shallow hub — replaced by Calculators (Unified Wealth Engine) at /wealth-engine
// const WealthEngineHub = lazy(() => import("./pages/wealth-engine/WealthEngineHub"));
const PortfolioRiskMetrics = lazy(() => import("./pages/wealth-engine/PortfolioRiskMetrics"));
// Code Chat (Round B5 admin UI)
const CodeChatPage = lazy(() => import("./pages/CodeChat"));
const UnifiedAI = lazy(() => import("./pages/UnifiedAI"));
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
const SyncDashboard = lazy(() => import("./pages/SyncDashboard"));
const LocationAnalytics = lazy(() => import("./pages/LocationAnalytics"));
const PermissionManagement = lazy(() => import("./pages/PermissionManagement"));
const LocationOnboarding = lazy(() => import("./pages/LocationOnboarding"));
const LocationHealth = lazy(() => import("./pages/LocationHealth"));
const WebhookVsPolling = lazy(() => import("./pages/WebhookVsPolling"));
const AlertThresholds = lazy(() => import("./pages/AlertThresholds"));
const SuitabilityPanel = lazy(() => import("./pages/SuitabilityPanel"));
const ProficiencyDashboard = lazy(() => import("./pages/ProficiencyDashboard"));
const ProductIntelligence = lazy(() => import("./pages/ProductIntelligence"));
const AdminIntelligenceDashboard = lazy(() => import("./pages/AdminIntelligenceDashboard"));
const AIUsageDashboard = lazy(() => import("./pages/AIUsageDashboard"));
const DataEngineDashboard = lazy(() => import("./pages/DataEngineDashboard"));
const ClientActivityTimeline = lazy(() => import("./pages/ClientActivityTimeline"));
const PlatformGuide = lazy(() => import("./pages/PlatformGuide"));
const PassiveActions = lazy(() => import("./pages/PassiveActions"));
const MarketData = lazy(() => import("./pages/MarketData"));
const OperationsHub = lazy(() => import("./pages/OperationsHub"));
// IntelligenceHub is now loaded via IntelligenceHubV2 (which imports it as IntelligenceOverview)
const AdvisoryHub = lazy(() => import("./pages/AdvisoryHub"));
const RelationshipsHub = lazy(() => import("./pages/RelationshipsHub"));
const Help = lazy(() => import("./pages/Help"));
const Workflows = lazy(() => import("./pages/Workflows"));
const AgentManager = lazy(() => import("./pages/AgentManager"));
const AgentPage = lazy(() => import("./pages/AgentPage"));
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
const GHLWebhookSetup = lazy(() => import("./pages/GHLWebhookSetup"));
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
const AdminFeaturePermissions = lazy(() => import("./pages/AdminFeaturePermissions"));
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
const StudyBuddy = lazy(() => import("./pages/learning/StudyBuddy"));
// Pass 36 — EMBA parity pages
const HandsFreeStudy = lazy(() => import("./pages/learning/HandsFreeStudy"));
const AIQuizPage = lazy(() => import("./pages/learning/AIQuizPage"));
const FormulaLab = lazy(() => import("./pages/learning/FormulaLab"));
const StudyAnalytics = lazy(() => import("./pages/learning/StudyAnalytics"));
const ProgressExport = lazy(() => import("./pages/learning/ProgressExport"));
const Bookmarks = lazy(() => import("./pages/learning/Bookmarks"));
const Playlists = lazy(() => import("./pages/learning/Playlists"));
const StudyGroups = lazy(() => import("./pages/learning/StudyGroups"));
const DiscoveryHistory = lazy(() => import("./pages/learning/DiscoveryHistory"));
const PeerGroups = lazy(() => import("./pages/learning/PeerGroups"));
// Pass 64d — new learning pages
const FormulasPage = lazy(() => import("./pages/learning/FormulasPage"));
const CasesPage = lazy(() => import("./pages/learning/CasesPage"));
const FSToolkitPage = lazy(() => import("./pages/learning/FSToolkitPage"));
const ConnectionsPage = lazy(() => import("./pages/learning/ConnectionsPage"));
const TracksIndex = lazy(() => import("./pages/learning/TracksIndex"));
const StudySession = lazy(() => import("./pages/learning/StudySession"));
const SharedPlaylist = lazy(() => import("./pages/learning/SharedPlaylist"));
const GlobalLeaderboard = lazy(() => import("./pages/learning/GlobalLeaderboard"));
const AudioPreferences = lazy(() => import("./pages/settings/AudioPreferences"));
// Comparables — competitive gap dashboard (hybrid build loop, pass 1)
const ComparablesPage = lazy(() => import("./pages/Comparables"));
// Rebalancing — portfolio drift preview (hybrid build loop, pass 3)
const RebalancingPage = lazy(() => import("./pages/Rebalancing"));
// Email Campaign (Pass 56 — full CRUD page)
const EmailCampaign = lazy(() => import("./pages/EmailCampaign"));
const MarketingAssets = lazy(() => import("./pages/MarketingAssets"));
const DataPipelines = lazy(() => import("./pages/DataPipelines"));
const OutreachAutomation = lazy(() => import("./pages/OutreachAutomation"));
const ApiDocumentation = lazy(() => import("./pages/ApiDocumentation"));
const AdminAuditTrail = lazy(() => import("./pages/AdminAuditTrail"));
const CommandCenter = lazy(() => import("./pages/CommandCenter"));
const BusinessExit = lazy(() => import("./pages/BusinessExit"));
const AnnualReview = lazy(() => import("./pages/AnnualReview"));
const ComplianceCopilot = lazy(() => import("./pages/ComplianceCopilot"));
const TaxProjector = lazy(() => import("./pages/TaxProjector"));
const PremiumFinanceRates = lazy(() => import("./pages/PremiumFinanceRates"));
const ManusNextDashboard = lazy(() => import("./pages/ManusNextDashboard"));
const WorkflowAutomation = lazy(() => import("./pages/WorkflowAutomation"));
const EnrichmentAdmin = lazy(() => import("./pages/EnrichmentAdmin"));
const PortalAnalytics = lazy(() => import("./pages/PortalAnalytics"));
const SovereignStudy = lazy(() => import("./pages/SovereignStudy"));
const SharedPlanView = lazy(() => import("./pages/SharedPlanView"));
const ClientSegmentation = lazy(() => import("./pages/ClientSegmentation"));
// Hub pages with internal sidebars (Phase 3 — sidebar simplification)
const PeopleHub = lazy(() => import("./pages/PeopleHub"));
const IntelligenceHubV2 = lazy(() => import("./pages/IntelligenceHubV2"));
const AdminHubV2 = lazy(() => import("./pages/AdminHubV2"));

function Router() {
  return (
    <Suspense fallback={<PageSuspenseFallback />}>
      <ScrollToTop />
      <Switch>
        {/* Public routes */}
        <Route path={"/"} component={Landing} />
        <Route path={"/signin"} component={SignIn} />
        <Route path={"/org/:slug"} component={OrgLanding} />
        <Route path={"/welcome"} component={Welcome} />
        <Route path={"terms"} component={Terms} />
        <Route path={"/privacy"} component={Privacy} />
        <Route path="/plan/:token">{() => <SharedPlanView />}</Route>

        {/* Core app routes */}
        <Route path="/chat/:id?">{() => <SectionErrorBoundary sectionName="Chat"><Chat /></SectionErrorBoundary>}</Route>
        <Route path="/calculators/:panel">{() => <SectionErrorBoundary sectionName="Calculators"><Calculators /></SectionErrorBoundary>}</Route>
        <Route path={"/calculators"}>{() => <SectionErrorBoundary sectionName="Calculators"><Calculators /></SectionErrorBoundary>}</Route>
        <Route path="/my-plan">{() => { window.location.replace('/wealth-engine?panel=myplan'); return null; }}</Route>
        {/* ── Wealth Engine — Unified Wealth Engine (comprehensive calculator + advisory + data hub) ─── */}
        <Route path="/portfolio-risk">{() => <SectionErrorBoundary sectionName="Portfolio Risk"><PortfolioRiskMetrics /></SectionErrorBoundary>}</Route>
        <Route path="/wealth-engine/:panel">{() => <SectionErrorBoundary sectionName="Wealth Engine"><Calculators /></SectionErrorBoundary>}</Route>
        <Route path="/wealth-engine">{() => <SectionErrorBoundary sectionName="Wealth Engine"><Calculators /></SectionErrorBoundary>}</Route>
        {/* Unified AI Surface (Chat + Code + Agent) */}
        <Route path={"/ai"} component={UnifiedAI} />
        {/* Code Chat (admin foundation — also accessible standalone) */}
        <Route path={"/code-chat"} component={CodeChatPage} />
        {/* Consensus (Round C — multi-model consensus stream) */}
        <Route path={"/consensus"} component={ConsensusPage} />
        {/* Engine Dashboard (parallel main-branch UWE/BIE/HE visualization) */}
        <Route path={"/engine-dashboard"} component={EngineDashboard} />
        <Route path={"/products"}>{() => <SectionErrorBoundary sectionName="Products"><Products /></SectionErrorBoundary>}</Route>
        <Route path={"/manager"} component={ManagerDashboard} />
        <Route path={"/org-branding"} component={OrgBrandingEditor} />
        <Route path="/admin">{() => <SectionErrorBoundary sectionName="Admin"><AdminHubV2 /></SectionErrorBoundary>}</Route>
        <Route path="/admin/:tab">{() => <SectionErrorBoundary sectionName="Admin"><AdminHubV2 /></SectionErrorBoundary>}</Route>
        <Route path="/admin-legacy" component={GlobalAdmin} />
        {/* meetings, insights, planning, coach, compliance, marketplace → redirected to hubs */}
        <Route path={"/portal"} component={Portal} />
        <Route path={"/organizations"} component={Organizations} />
        {/* Non-redirected feature pages (still standalone) */}
        <Route path={"/insurance-applications"} component={InsuranceApplications} />
        <Route path={"/advisory-execution"} component={AdvisoryExecution} />
        <Route path={"/carrier-connector"} component={CarrierConnector} />
        <Route path={"/improvement"}>{() => <Redirect to="/admin/improvement" />}</Route>
        <Route path={"/admin/improvement-engine"} component={ImprovementEngine} />
        <Route path={"/integrations"} component={Integrations} />
        <Route path={"/admin/bcp"} component={BCP} />
        <Route path={"/admin/fairness"} component={FairnessTestDashboard} />
        <Route path={"/admin/knowledge"} component={KnowledgeAdmin} />
        <Route path={"/admin/integrations"} component={AdminIntegrations} />
        <Route path={"/my-integrations"} component={AdvisorIntegrations} />
        <Route path={"/integration-health"} component={IntegrationHealth} />
        <Route path={"/sync-dashboard"} component={SyncDashboard} />
        <Route path={"/location-analytics"} component={LocationAnalytics} />
        <Route path={"/permissions"} component={PermissionManagement} />
        <Route path={"/location-onboarding"} component={LocationOnboarding} />
        <Route path={"/location-health"} component={LocationHealth} />
        <Route path={"/webhook-vs-polling"} component={WebhookVsPolling} />
        <Route path={"/alert-thresholds"} component={AlertThresholds} />
        <Route path={"/dynamic-integrations"} component={DynamicIntegrations} />
        <Route path={"/suitability-panel"} component={SuitabilityPanel} />
        <Route path={"/proficiency"} component={ProficiencyDashboard} />
        <Route path={"/product-intelligence"} component={ProductIntelligence} />
        <Route path={"/admin/intelligence"} component={AdminIntelligenceDashboard} />
        <Route path={"/ai-usage"} component={AIUsageDashboard} />
        <Route path={"/data-engine"} component={DataEngineDashboard} />
        <Route path={"/activity-timeline"} component={ClientActivityTimeline} />
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
        <Route path="/embed/calculator" component={EmbedCalculator} />
        <Route path="/advisor/:id" component={AdvisorProfile} />
        <Route path="/admin/team" component={TeamManagement} />
        <Route path="/admin/billing" component={BillingPage} />
        <Route path="/admin/api-keys" component={APIKeys} />
        <Route path="/admin/webhooks" component={WebhookManager} />
        <Route path="/admin/webhooks/ghl-setup" component={GHLWebhookSetup} />
        <Route path="/client-onboarding" component={ClientOnboarding} />
        <Route path="/protection-score" component={FinancialProtectionScore} />
        <Route path="/financial-planning" component={FinancialPlanning} />
        {/* /financial-protection-score removed — canonical route is /protection-score */}
        <Route path="/community" component={Community} />
        <Route path="/unsubscribe" component={Unsubscribe} />
        <Route path="/admin/system-health" component={AdminSystemHealth} />
        <Route path="/admin/improvement" component={ImprovementDashboard} />
        <Route path="/admin/data-freshness" component={AdminDataFreshness} />
        <Route path="/admin/lead-sources" component={AdminLeadSources} />
        <Route path="/admin/rate-management" component={AdminRateManagement} />
        <Route path="/admin/platform-reports" component={AdminPlatformReports} />
        <Route path="/admin/feature-permissions" component={AdminFeaturePermissions} />
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
        <Route path="/learning/study-buddy" component={StudyBuddy} />
        {/* Pass 36 — EMBA parity routes */}
        <Route path="/learning/hands-free" component={HandsFreeStudy} />
        <Route path="/learning/ai-quiz" component={AIQuizPage} />
        <Route path="/learning/formula-lab" component={FormulaLab} />
        <Route path="/learning/analytics" component={StudyAnalytics} />
        <Route path="/learning/export" component={ProgressExport} />
        <Route path="/learning/bookmarks" component={Bookmarks} />
        <Route path="/learning/playlists" component={Playlists} />
        <Route path="/learning/groups" component={StudyGroups} />
        <Route path="/learning/discovery" component={DiscoveryHistory} />
        <Route path="/learning/peer-groups" component={PeerGroups} />
        {/* Pass 64d — new learning browse/study pages */}
        <Route path="/learning/formulas" component={FormulasPage} />
        <Route path="/learning/cases" component={CasesPage} />
        <Route path="/learning/fs-toolkit" component={FSToolkitPage} />
        <Route path="/learning/connections-browse" component={ConnectionsPage} />
        <Route path="/learning/tracks" component={TracksIndex} />
        <Route path="/learning/session/:trackSlug" component={StudySession} />
        <Route path="/learning/shared/:shareToken" component={SharedPlaylist} />
        <Route path="/learning/leaderboard" component={GlobalLeaderboard} />

        {/* Consolidated Hub Pages */}
        {/* Comparables — competitive gap dashboard (hybrid build loop pass 1) */}
        <Route path={"/comparables"} component={ComparablesPage} />
        {/* Rebalancing — portfolio drift preview (hybrid build loop pass 3) */}
        <Route path={"/rebalancing"} component={RebalancingPage} />

        <Route path={"/operations"}>{() => <SectionErrorBoundary sectionName="Operations"><OperationsHub /></SectionErrorBoundary>}</Route>
        <Route path={"/agents"} component={AgentManager} />
        <Route path={"/agent"} component={AgentPage} />
        <Route path={"/intelligence-hub"}>{() => <SectionErrorBoundary sectionName="Intelligence Hub"><IntelligenceHubV2 /></SectionErrorBoundary>}</Route>
        <Route path="/intelligence-hub/:tab">{() => <SectionErrorBoundary sectionName="Intelligence Hub"><IntelligenceHubV2 /></SectionErrorBoundary>}</Route>
        <Route path={"/advisory"} component={AdvisoryHub} />
        <Route path={"/relationships"} component={RelationshipsHub} />
        <Route path="/people">{() => <SectionErrorBoundary sectionName="People"><PeopleHub /></SectionErrorBoundary>}</Route>
        <Route path="/people/:tab">{() => <SectionErrorBoundary sectionName="People"><PeopleHub /></SectionErrorBoundary>}</Route>

        {/* Unified Settings hub */}
        <Route path={"/settings"}>
          <Redirect to="/settings/profile" />
        </Route>
        <Route path={"/settings/:tab"}>{() => <SectionErrorBoundary sectionName="Settings"><SettingsHub /></SectionErrorBoundary>}</Route>

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
        <Route path={"/email-campaigns"} component={EmailCampaign} />
        <Route path={"/marketing-assets"} component={MarketingAssets} />
        <Route path={"/data-pipelines"} component={DataPipelines} />
        <Route path={"/outreach-automation"} component={OutreachAutomation} />
        <Route path={"/api-docs"} component={ApiDocumentation} />
        <Route path={"/admin/audit-trail"} component={AdminAuditTrail} />
        <Route path={"/command-center"} component={CommandCenter} />
        <Route path={"/business-exit"} component={BusinessExit} />
        <Route path={"/annual-review"} component={AnnualReview} />
        <Route path={"/compliance-copilot"} component={ComplianceCopilot} />
        <Route path={"/tax-projector"} component={TaxProjector} />
        <Route path={"/premium-finance-rates"} component={PremiumFinanceRates} />
        <Route path={"/manus-next"} component={ManusNextDashboard} />
        <Route path={"/workflow-automation"} component={WorkflowAutomation} />
        <Route path={"/enrichment-admin"} component={EnrichmentAdmin} />
        <Route path={"/portal-analytics"} component={PortalAnalytics} />
        <Route path={"/sovereign-study"} component={SovereignStudy} />
        <Route path={"/client-segmentation"} component={ClientSegmentation} />
        <Route path={"/professionals"}><Redirect to="/relationships" /></Route>

        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function AppContent() {
  // Auth lifecycle (including guest provisioning) is handled by AuthProvider
  // Track page visits for the Exponential Engine (adaptive AI personalization)
  usePageTracking();
  // Global keyboard shortcut handler — must live INSIDE PILProvider so the
  // IntentRouter can handle dispatched intents with pil context available.
  useGlobalShortcuts();
  const { isOpen: tourOpen, completeTour, startTour } = useOnboardingTour();

  // Pass 120: Allow tour to be triggered from notification bell via ?startTour=true
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("startTour") === "true") {
      startTour();
      // Clean up the URL
      params.delete("startTour");
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, [startTour]);

  // Pass 121: Allow voice coach to be triggered from notification bell via ?showVoiceCoach=true
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("showVoiceCoach") === "true") {
      window.dispatchEvent(new CustomEvent("pil:show-voice-coach"));
      params.delete("showVoiceCoach");
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  return (
    <>
      {/* Pass 1: Live regions + intent router + global voice button.
          These provide the multisensory/a11y backbone: every navigation is
          announced to screen readers, every keyboard shortcut and slash
          command routes through the same intent bus, and hands-free voice
          mode is reachable from the mic button.
          Pass 4 (Delight): VisualAnnouncer mirrors LiveAnnouncer with a
          subtle centered toast so sighted users see the same feedback
          screen-reader users hear. */}
      {/* v8.2 Pass 2 (G38): Global skip-to-content link — works on ALL pages
          including Chat, Landing, Portal, and other non-AppShell pages.
          AppShell pages get a second one (harmless — first one wins). */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-3 focus:py-2 focus:rounded-md focus:bg-accent focus:text-accent-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:text-sm"
      >
        Skip to main content
      </a>
      <LiveAnnouncer />
      <OfflineBanner />
      <GuestBanner />
      <ServiceStatusBanner />
      <Router />
      <ConsentBanner />
      {/* GlobalFooter removed permanently — user requested no footer nav */}
      <GlobalVoiceFAB />
      <ContextualHelp />
      <OnboardingTour isOpen={tourOpen} onComplete={completeTour} />
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <AuthProvider>
            <NotificationProvider>
              <AudioCompanionProvider>
                <PILProvider>
                  <Toaster />
                  <KeyboardShortcuts />
                  <CommandPalette />
                  <AppContent />
                </PILProvider>
              </AudioCompanionProvider>
            </NotificationProvider>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
