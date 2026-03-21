import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Chat from "./pages/Chat";
import Landing from "./pages/Landing";
import SignIn from "./pages/SignIn";
import OrgLanding from "./pages/OrgLanding";
import Welcome from "./pages/Welcome";
import ConsentBanner from "./components/ConsentBanner";
import { GuestBanner } from "./components/GuestBanner";
import { ContextualHelp } from "./components/ContextualHelp";
import { KeyboardShortcuts } from "./components/KeyboardShortcuts";
import { useGuestSession } from "./hooks/useGuestSession";
import Calculators from "./pages/Calculators";
import ManagerDashboard from "./pages/ManagerDashboard";
import Products from "./pages/Products";
import SettingsHub from "./pages/SettingsHub";
import Terms from "./pages/Terms";
import OrgBrandingEditor from "./pages/OrgBrandingEditor";
import GlobalAdmin from "./pages/GlobalAdmin";
import Meetings from "./pages/Meetings";
import Insights from "./pages/Insights";
import FinancialPlanning from "./pages/FinancialPlanning";
import BehavioralCoach from "./pages/BehavioralCoach";
import Compliance from "./pages/Compliance";
import Marketplace from "./pages/Marketplace";
import Portal from "./pages/Portal";
import Organizations from "./pages/Organizations";
import Workflows from "./pages/Workflows";
import StudyBuddy from "./pages/StudyBuddy";
import EducationCenter from "./pages/EducationCenter";
import StudentLoans from "./pages/StudentLoans";
import EquityComp from "./pages/EquityComp";
import DigitalAssets from "./pages/DigitalAssets";
import CoiNetwork from "./pages/CoiNetwork";
import DataIntelligence from "./pages/DataIntelligence";
import AgenticHub from "./pages/AgenticHub";
import { LicensedReview, AgentOperations, InsuranceQuotes, InsuranceApplications, AdvisoryExecution, EstatePlanning, PremiumFinance, CarrierConnector } from "./pages/PartGPages";
import EmailCampaigns from "./pages/EmailCampaigns";
import Help from "./pages/Help";
import Privacy from "./pages/Privacy";
import GlobalFooter from "./components/GlobalFooter";
import ProfessionalDirectory from "./pages/ProfessionalDirectory";
import ImprovementEngine from "./pages/ImprovementEngine";
import Integrations from "./pages/Integrations";
import { GuidedTour } from "./components/GuidedTour";
import IntelligenceFeed from "./pages/IntelligenceFeed";
import AnalyticsHub from "./pages/AnalyticsHub";
import ModelResults from "./pages/ModelResults";
import BCP from "./pages/BCP";
import FairnessTestDashboard from "./pages/FairnessTestDashboard";
import OperationsHub from "./pages/OperationsHub";
import IntelligenceHub from "./pages/IntelligenceHub";
import AdvisoryHub from "./pages/AdvisoryHub";
import RelationshipsHub from "./pages/RelationshipsHub";
import KnowledgeAdmin from "./pages/KnowledgeAdmin";
import AdminIntegrations from "./pages/AdminIntegrations";
import AdvisorIntegrations from "./pages/AdvisorIntegrations";
import SuitabilityPanel from "./pages/SuitabilityPanel";
import { NotificationProvider } from "./contexts/NotificationContext";

function Router() {
  return (
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
      <Route path={"/suitability-panel"} component={SuitabilityPanel} />

      {/* Consolidated Hub Pages */}
      <Route path={"/operations"} component={OperationsHub} />
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
      <Route path={"/workflows"}><Redirect to="/operations" /></Route>
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
  );
}

function AppContent() {
  // Auto-provision guest session for anonymous visitors
  useGuestSession();
  return (
    <>
      <GuestBanner />
      <Router />
      <ConsentBanner />
      <GlobalFooter />
      <ContextualHelp />
      <GuidedTour />
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
            <AppContent />
          </NotificationProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
