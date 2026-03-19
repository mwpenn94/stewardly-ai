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

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path={"/"} component={Landing} />
      <Route path={"/signin"} component={SignIn} />
      <Route path={"/org/:slug"} component={OrgLanding} />
      <Route path={"/welcome"} component={Welcome} />
      <Route path={"/terms"} component={Terms} />

      {/* Core app routes */}
      <Route path={"/chat"} component={Chat} />
      <Route path={"/chat/:id"} component={Chat} />
      <Route path={"/calculators"} component={Calculators} />
      <Route path={"/products"} component={Products} />
      <Route path={"/manager"} component={ManagerDashboard} />
      <Route path={"/org-branding"} component={OrgBrandingEditor} />
      <Route path={"/admin"} component={GlobalAdmin} />
      <Route path={"/meetings"} component={Meetings} />
      <Route path={"/insights"} component={Insights} />
      <Route path={"/planning"} component={FinancialPlanning} />
      <Route path={"/coach"} component={BehavioralCoach} />
      <Route path={"/compliance"} component={Compliance} />
      <Route path={"/marketplace"} component={Marketplace} />
      <Route path={"/portal"} component={Portal} />
      <Route path={"/organizations"} component={Organizations} />

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

      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
          <ConsentBanner />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
