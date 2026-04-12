/**
 * WorkspaceHealthPanel — capstone health dashboard (Pass 261).
 *
 * Aggregates every inspector built across passes 244-260 into a
 * single composite score panel so users can see "is the workspace
 * healthy right now?" without visiting 12+ tabs.
 *
 * The score is computed server-side from cached data, so it's free
 * to render and never triggers a tsc/vitest/npm run on its own. Users
 * must visit the relevant panels explicitly to refresh their inputs.
 */

import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Loader2,
} from "lucide-react";

type HealthStatus = "healthy" | "warning" | "critical";

const STATUS_STYLE: Record<HealthStatus, { className: string; Icon: typeof CheckCircle2; label: string }> = {
  healthy: {
    className: "text-emerald-500 border-emerald-500/40 bg-emerald-500/10",
    Icon: CheckCircle2,
    label: "Healthy",
  },
  warning: {
    className: "text-amber-500 border-amber-500/40 bg-amber-500/10",
    Icon: AlertTriangle,
    label: "Warning",
  },
  critical: {
    className: "text-destructive border-destructive/40 bg-destructive/10",
    Icon: XCircle,
    label: "Critical",
  },
};

const CATEGORY_LABEL: Record<string, string> = {
  diagnostics: "Diagnostics",
  tests: "Tests",
  security: "Security",
  freshness: "Freshness",
  structure: "Structure",
  markers: "Markers",
};

const CATEGORY_HINT: Record<string, string> = {
  diagnostics: "Open the Problems tab to refresh TypeScript errors",
  tests: "Open the Tests tab to run vitest",
  security: "Open the NPM tab to refresh npm audit",
  freshness: "Open the NPM tab to refresh npm outdated",
  structure: "Open the Imports or Dead tab for details",
  markers: "Open the TODOs tab for the full inventory",
};

export default function WorkspaceHealthPanel() {
  const healthQuery = trpc.codeChat.workspaceHealth.useQuery(undefined, {
    staleTime: 30_000,
  });
  const utils = trpc.useUtils();

  const report = healthQuery.data?.report;

  const handleRefresh = () => {
    utils.codeChat.workspaceHealth.invalidate();
  };

  if (healthQuery.isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 mx-auto animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          No health data available. Try running the individual inspectors first.
        </CardContent>
      </Card>
    );
  }

  const overallStyle = STATUS_STYLE[report.overallStatus];

  return (
    <div className="space-y-4">
      {/* Big overall score card */}
      <Card className={`border-2 ${overallStyle.className}`}>
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <div className="text-center shrink-0">
              <div className={`text-6xl font-bold font-mono ${overallStyle.className.split(" ")[0]}`}>
                {report.overallScore}
              </div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mt-1">
                workspace score
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <overallStyle.Icon className="h-5 w-5" />
                <span className="text-lg font-semibold capitalize">
                  {overallStyle.label}
                </span>
                <Badge variant="outline" className="ml-2 text-[10px] font-mono">
                  {report.totalIssues} issue{report.totalIssues === 1 ? "" : "s"}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto h-7 w-7 p-0"
                  onClick={handleRefresh}
                  aria-label="Refresh health"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
              {report.topIssues.length > 0 ? (
                <div className="space-y-1">
                  {report.topIssues.map((issue, idx) => {
                    const style = STATUS_STYLE[issue.severity];
                    return (
                      <div
                        key={`${issue.category}-${idx}`}
                        className="flex items-center gap-2 text-xs"
                      >
                        <style.Icon
                          className={`h-3 w-3 shrink-0 ${style.className.split(" ")[0]}`}
                        />
                        <span className="font-medium capitalize">
                          {CATEGORY_LABEL[issue.category] ?? issue.category}
                        </span>
                        <span className="text-muted-foreground truncate">
                          {issue.description}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No actionable issues detected across any inspector.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-category breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {report.breakdown.map((cat) => {
          const style = STATUS_STYLE[cat.status];
          return (
            <Card key={cat.category}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <style.Icon className={`h-3.5 w-3.5 ${style.className.split(" ")[0]}`} />
                  {CATEGORY_LABEL[cat.category] ?? cat.category}
                  <span
                    className={`ml-auto font-mono text-lg ${style.className.split(" ")[0]}`}
                  >
                    {cat.score}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {cat.signals.map((sig, idx) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className="text-[10px] capitalize"
                    >
                      {sig}
                    </Badge>
                  ))}
                </div>
                {cat.impact > 0 && (
                  <div className="text-[10px] text-muted-foreground">
                    {CATEGORY_HINT[cat.category] ?? "Visit the relevant inspector to refresh"}
                    {" · "}
                    pulls overall by {cat.impact} pt{cat.impact === 1 ? "" : "s"}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="py-3 px-4 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <Activity className="h-3 w-3" />
            Health pulls from cached inspector data. Run each panel explicitly
            to refresh inputs — the dashboard never triggers tsc, vitest, or
            npm on its own.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
