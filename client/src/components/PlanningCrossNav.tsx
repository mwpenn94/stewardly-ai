/**
 * PlanningCrossNav — A compact navigation bar that appears on all planning
 * pages, showing related calculators and indicating which ones have data
 * from the shared financial profile. Enables "holistic, forward, back,
 * roll-up, roll-down" workflow across the planning suite.
 */
import { useLocation } from "wouter";
import { useFinancialProfile } from "@/hooks/useFinancialProfile";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign, Scale, BarChart3, TrendingUp, Heart, LineChart, Calculator,
} from "lucide-react";

const PLANNING_PAGES = [
  { href: "/calculators", label: "Calculators", icon: Calculator, key: null },
  { href: "/tax-planning", label: "Tax", icon: DollarSign, key: "annualIncome" },
  { href: "/estate", label: "Estate", icon: Scale, key: "netEstate" },
  { href: "/risk-assessment", label: "Risk", icon: BarChart3, key: null },
  { href: "/income-projection", label: "Income", icon: TrendingUp, key: "portfolioBalance" },
  { href: "/insurance-analysis", label: "Insurance", icon: Heart, key: "existingLifeInsurance" },
  { href: "/financial-planning", label: "Planning", icon: LineChart, key: null },
] as const;

export function PlanningCrossNav() {
  const [location, navigate] = useLocation();
  const { profile, hasData, source } = useFinancialProfile("cross-nav");

  return (
    <nav aria-label="Planning tools" className="flex items-center gap-1 flex-wrap">
      {PLANNING_PAGES.map(page => {
        const isActive = location === page.href;
        const Icon = page.icon;
        const hasPageData = page.key ? (profile as any)[page.key] != null : false;

        return (
          <button
            key={page.href}
            onClick={() => navigate(page.href)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors ${
              isActive
                ? "bg-accent/20 text-accent font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
            aria-current={isActive ? "page" : undefined}
            aria-label={`${page.label}${hasPageData ? " (has data)" : ""}`}
          >
            <Icon className="h-3 w-3" />
            <span className="hidden sm:inline">{page.label}</span>
            {hasPageData && !isActive && (
              <span className="h-1.5 w-1.5 rounded-full bg-accent" title="Has profile data" />
            )}
          </button>
        );
      })}
      {hasData && source && (
        <Badge variant="outline" className="text-[9px] ml-1 hidden md:flex">
          Profile from {source}
        </Badge>
      )}
    </nav>
  );
}
