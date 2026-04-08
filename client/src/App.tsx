import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import ConsentBanner from "./components/ConsentBanner";
import OfflineBanner from "./components/OfflineBanner";
import { GuestBanner } from "./components/GuestBanner";
import { ContextualHelp } from "./components/ContextualHelp";
import { KeyboardShortcuts } from "./components/KeyboardShortcuts";
import { CommandPalette } from "./components/CommandPalette";
import { useGuestSession } from "./hooks/useGuestSession";
import GlobalFooter from "./components/GlobalFooter";
import { NotificationProvider } from "./contexts/NotificationContext";
import { usePageTracking } from "./hooks/useExponentialTracking";
import PageSuspenseFallback from "./components/PageSuspenseFallback";
import { lazy, Suspense } from "react";

// ── Eagerly loaded (critical path — instant navigation) ──────────────
import Landing from "./pages/Landing";
import SignIn from "./pages/SignIn";
import Chat from "./pages/Chat";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Welcome from "./pages/Welcome";

// ── Lazy loaded (code-split — loaded on demand) ──────────────────────
const Calculators = lazy(() => import("./pages/Calculators"));
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
const AnalyticsHub = lazy(() => import("./pages/AnalyticsHub"));
const ModelResults = lazy(() => import("./pages/ModelResults"));
const Help = lazy(() => import("./pages/Help"));
const ProfessionalDirectory = lazy(() => import("./pages/ProfessionalDirectory"));
const IntelligenceFeed = lazy(() => import("./pages/IntelligenceFeed"));
const Meetings = lazy(() => import("./pages/Meetings"));
const Insights = lazy(() => import("./pages/Insights"));
const FinancialPlanning = lazy(() => import("./pages/FinancialPlanning"));
const BehavioralCoach = lazy(() => import("./pages/BehavioralCoach"));
const Compliance = lazy(() => import("./pages/Compliance"));
const Marketplace = lazy(() => import("./pages/Marketplace"));
const Workflows = lazy(() => import("./pages/Workflows"));
const StudyBuddy = lazy(() => import("./pages/StudyBuddy"));
const EducationCenter = lazy(() => import("./pages/EducationCenter"));
const StudentLoans = lazy(() => import("./pages/StudentLoans"));
const EquityComp = lazy(() => import("./pages/EquityComp"));
const DigitalAssets = lazy(() => import("./pages/DigitalAssets"));
const CoiNetwork = lazy(() => import("./pages/CoiNetwork"));
const DataIntelligence = lazy(() => import("./pages/DataIntelligence"));
const AgenticHub = lazy(() => import("./pages/AgenticHub"));
const AgentManager = lazy(() => import("./pages/AgentManager"));
const EmailCampaigns = lazy(() => import("./pages/EmailCampaigns"));
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
const AdminDataFreshness = lazy(() => import("./pages/AdminDataFreshness"));
const AdminLeadSources = lazy(() => import("./pages/AdminLeadSources"));
const AdminRateManagement = lazy(() => import("./pages/AdminRateManagement"));
const AdminPlatformReports = lazy(() => import("./pages/AdminPlatformReports"));
const ClientDashboard = lazy(() => import("./pages/ClientDashboard"));

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
        <Route path="/community" component={Community} />
        <Route path="/unsubscribe" component={Unsubscribe} />
        <Route path="/admin/system-health" component={AdminSystemHealth} />
        <Route path="/admin/data-freshness" component={AdminDataFreshness} />
        <Route path="/admin/lead-sources" component={AdminLeadSources} />
        <Route path="/admin/rate-management" component={AdminRateManagement} />
        <Route path="/admin/platform-reports" component={AdminPlatformReports} />
        <Route path="/client-dashboard" component={ClientDashboard} />

        {/* Consolidated Hub Pages */}
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
            <Toaster />
            <KeyboardShortcuts />
            <CommandPalette />
            <AppContent />
          </NotificationProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
