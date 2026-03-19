import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Chat from "./pages/Chat";
import Landing from "./pages/Landing";
import SignIn from "./pages/SignIn";
import FirmLanding from "./pages/FirmLanding";
import Calculators from "./pages/Calculators";
import Documents from "./pages/Documents";
import Suitability from "./pages/Suitability";
import ManagerDashboard from "./pages/ManagerDashboard";
import Settings from "./pages/Settings";
import Products from "./pages/Products";
import MarketData from "./pages/MarketData";
import Terms from "./pages/Terms";

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path={"/"} component={Landing} />
      <Route path={"/signin"} component={SignIn} />
      <Route path={"/firm/:slug"} component={FirmLanding} />
      <Route path={"/terms"} component={Terms} />
      
      {/* All other routes - immediate access, no gate */}
      <Route path={"/chat"} component={Chat} />
      <Route path={"/chat/:id"} component={Chat} />
      <Route path={"/calculators"} component={Calculators} />
      <Route path={"/documents"} component={Documents} />
      <Route path={"/suitability"} component={Suitability} />
      <Route path={"/manager"} component={ManagerDashboard} />
      <Route path={"/settings"} component={Settings} />
      <Route path={"/products"} component={Products} />
      <Route path={"/market"} component={MarketData} />
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
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
