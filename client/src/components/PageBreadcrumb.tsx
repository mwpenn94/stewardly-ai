/**
 * PageBreadcrumb — Auto-generates breadcrumbs from the current URL path.
 * 
 * Usage:
 *   <PageBreadcrumb />                    // Auto-generates from URL
 *   <PageBreadcrumb items={[...]} />      // Custom breadcrumb items
 * 
 * Improves C1 (Navigation Coherence) by providing context on deep pages.
 */
import React from "react";
import { useLocation, Link } from "wouter";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Home } from "lucide-react";

interface BreadcrumbItemData {
  label: string;
  href?: string;
}

// Human-readable labels for common path segments
const PATH_LABELS: Record<string, string> = {
  "wealth-engine": "Wealth Engine",
  "strategy-comparison": "Strategy Comparison",
  "retirement": "Retirement",
  "practice-to-wealth": "Practice to Wealth",
  "quick-quote": "Quick Quote",
  "tax-optimizer": "Tax Optimizer",
  "estate-planner": "Estate Planner",
  "insurance-analyzer": "Insurance Analyzer",
  "monte-carlo": "Monte Carlo",
  "admin": "Admin",
  "settings": "Settings",
  "learning": "Learning",
  "licenses": "Licenses",
  "studio": "Content Studio",
  "tracks": "Tracks",
  "review": "Review",
  "search": "Search",
  "exam": "Exam Simulator",
  "discipline": "Discipline",
  "case": "Case Study",
  "connections": "Connections",
  "achievements": "Achievements",
  "financial-planning": "Financial Planning",
  "market-data": "Market Data",
  "operations": "Operations",
  "compliance-audit": "Compliance Audit",
  "rebalancing": "Rebalancing",
  "comparables": "Comparables",
  "intelligence": "Intelligence",
  "advisory": "Advisory",
  "relationships": "Relationships",
  "proficiency": "Proficiency",
  "integrations": "Integrations",
  "organizations": "Organizations",
  "workflows": "Workflows",
  "calculators": "Calculators",
  "client-dashboard": "Client Dashboard",
  "my-work": "My Work",
  "financial-twin": "Financial Twin",
  "api-keys": "API Keys",
  "api-docs": "API Documentation",
  "audit-trail": "Audit Trail",
  "feature-permissions": "Feature Permissions",
  "improvement": "Improvement",
  "data-freshness": "Data Freshness",
  "lead-sources": "Lead Sources",
  "rate-management": "Rate Management",
  "platform-reports": "Platform Reports",
  "audio": "Audio Preferences",
};

function formatSegment(segment: string): string {
  if (PATH_LABELS[segment]) return PATH_LABELS[segment];
  // Convert kebab-case and underscore_case to Title Case
  return segment
    .replace(/_/g, " ")
    .split("-")
    .map((part) =>
      part
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    )
    .join(" ");
}

export function PageBreadcrumb({
  items,
  className,
}: {
  items?: BreadcrumbItemData[];
  className?: string;
}) {
  const [location] = useLocation();

  // Auto-generate from URL if no custom items provided
  const breadcrumbs: BreadcrumbItemData[] = items || (() => {
    const segments = location.split("/").filter(Boolean);
    if (segments.length <= 1) return []; // Don't show breadcrumbs on top-level pages
    
    const crumbs: BreadcrumbItemData[] = [];
    let currentPath = "";
    
    for (let i = 0; i < segments.length; i++) {
      currentPath += "/" + segments[i];
      const isLast = i === segments.length - 1;
      
      // Skip UUID-like segments or numeric IDs in breadcrumb labels
      const isId = /^[0-9a-f-]{8,}$/i.test(segments[i]) || /^\d+$/.test(segments[i]);
      
      crumbs.push({
        label: isId ? `#${segments[i].slice(0, 8)}` : formatSegment(segments[i]),
        href: isLast ? undefined : currentPath,
      });
    }
    
    return crumbs;
  })();

  if (breadcrumbs.length === 0) return null;

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/" className="flex items-center gap-1">
              <Home className="h-3.5 w-3.5" />
              <span className="sr-only">Home</span>
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {breadcrumbs.map((crumb, i) => (
          <React.Fragment key={i}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {crumb.href ? (
                <BreadcrumbLink asChild>
                  <Link href={crumb.href}>{crumb.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
