/**
 * NpmInspectorPanel — npm outdated + audit inspector (Pass 260).
 *
 * Unified view over `npm outdated` and `npm audit` so users can see
 * upgrade suggestions and known vulnerabilities in one pane.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  ShieldAlert,
  ArrowUpCircle,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type UpdateSemver = "patch" | "minor" | "major" | "none";
type VulnSeverity = "critical" | "high" | "moderate" | "low" | "info";

const SEVERITY_COLOR: Record<UpdateSemver, string> = {
  major: "text-destructive border-destructive/40",
  minor: "text-amber-500 border-amber-500/40",
  patch: "text-emerald-500 border-emerald-500/40",
  none: "text-muted-foreground border-border/60",
};

const VULN_COLOR: Record<VulnSeverity, string> = {
  critical: "text-destructive border-destructive/40",
  high: "text-destructive border-destructive/40",
  moderate: "text-amber-500 border-amber-500/40",
  low: "text-chart-3 border-chart-3/40",
  info: "text-muted-foreground border-border/60",
};

export default function NpmInspectorPanel() {
  const [search, setSearch] = useState("");
  const [minSeverity, setMinSeverity] = useState<VulnSeverity>("low");
  const [outdatedFilter, setOutdatedFilter] = useState<UpdateSemver | "all">("all");
  const [kind, setKind] = useState<"outdated" | "audit" | "both">("both");
  const [run, setRun] = useState(0);

  const inspectQuery = trpc.codeChat.npmInspect.useQuery(
    {
      kind,
      outdatedFilter: {
        severity: outdatedFilter === "all" ? undefined : outdatedFilter,
        search: search || undefined,
      },
      auditFilter: {
        minSeverity,
        search: search || undefined,
      },
    },
    {
      enabled: run > 0,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  );

  const handleRun = () => setRun((n) => n + 1);

  const outdated = inspectQuery.data?.outdated ?? [];
  const vulns = inspectQuery.data?.vulnerabilities ?? [];
  const auditSummary = inspectQuery.data?.auditSummary;
  const totalOutdated = inspectQuery.data?.totalOutdated ?? 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4 text-accent" />
            NPM Outdated &amp; Audit
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
              className="h-8 px-2 text-xs rounded border border-border bg-background"
              aria-label="Inspection kind"
            >
              <option value="both">outdated + audit</option>
              <option value="outdated">outdated only</option>
              <option value="audit">audit only</option>
            </select>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by package name…"
              className="h-8 text-xs flex-1 min-w-[180px]"
              aria-label="Search packages"
            />
            <Button
              size="sm"
              onClick={handleRun}
              disabled={inspectQuery.isFetching}
            >
              {inspectQuery.isFetching ? (
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1.5" />
              )}
              Run
            </Button>
          </div>
          {(kind === "outdated" || kind === "both") && (
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <span className="text-muted-foreground">Severity:</span>
              {(["all", "major", "minor", "patch"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setOutdatedFilter(s as any)}
                  className={`px-2 py-0.5 rounded-full border transition capitalize ${
                    outdatedFilter === s
                      ? "bg-accent/10 text-accent border-accent/40"
                      : "text-muted-foreground border-border/60"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {(kind === "audit" || kind === "both") && (
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <span className="text-muted-foreground">Min audit severity:</span>
              {(["critical", "high", "moderate", "low", "info"] as VulnSeverity[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setMinSeverity(s)}
                  className={`px-2 py-0.5 rounded-full border transition capitalize ${
                    minSeverity === s
                      ? "bg-accent/10 text-accent border-accent/40"
                      : "text-muted-foreground border-border/60"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {run === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
            Click Run to inspect `npm outdated` and `npm audit`.
          </CardContent>
        </Card>
      ) : inspectQuery.isLoading || inspectQuery.isFetching ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 mx-auto animate-spin" />
            <div className="mt-2">Running npm commands…</div>
          </CardContent>
        </Card>
      ) : (
        <>
          {(kind === "audit" || kind === "both") && auditSummary && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                  Security Audit
                  {auditSummary.total === 0 ? (
                    <Badge
                      variant="outline"
                      className="text-emerald-500 border-emerald-500/40"
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      clean
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-destructive border-destructive/40 font-mono"
                    >
                      {auditSummary.total} issue{auditSummary.total === 1 ? "" : "s"}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 flex-wrap text-[11px] mb-3">
                  {(["critical", "high", "moderate", "low", "info"] as VulnSeverity[]).map((s) => {
                    const count = auditSummary[s];
                    if (!count) return null;
                    return (
                      <Badge
                        key={s}
                        variant="outline"
                        className={`text-[10px] capitalize ${VULN_COLOR[s]}`}
                      >
                        {s}: {count}
                      </Badge>
                    );
                  })}
                </div>
                {vulns.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No vulnerabilities match the current filters.
                  </div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {vulns.map((v) => (
                      <div
                        key={`${v.name}:${v.severity}`}
                        className="py-2 flex items-start gap-3"
                      >
                        <Badge
                          variant="outline"
                          className={`text-[10px] capitalize shrink-0 ${VULN_COLOR[v.severity as VulnSeverity]}`}
                        >
                          {v.severity}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-sm truncate">
                            {v.name}
                          </div>
                          {(v.title || v.range) && (
                            <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                              {v.range}
                              {v.title ? ` · ${v.title}` : ""}
                            </div>
                          )}
                        </div>
                        {v.fixAvailable && (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-emerald-500 border-emerald-500/40"
                          >
                            fix available
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {(kind === "outdated" || kind === "both") && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ArrowUpCircle className="h-3.5 w-3.5 text-accent" />
                  Outdated Packages
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {totalOutdated} total
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {outdated.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    {totalOutdated === 0 ? "All dependencies up to date." : "No packages match the current filters."}
                  </div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {outdated.map((o) => (
                      <div
                        key={`${o.name}:${o.current}`}
                        className="py-2 flex items-start gap-3"
                      >
                        <Badge
                          variant="outline"
                          className={`text-[10px] capitalize shrink-0 ${SEVERITY_COLOR[o.severity as UpdateSemver]}`}
                        >
                          {o.severity}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-sm truncate">
                            {o.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                            <span className="text-destructive">{o.current}</span>
                            {" → "}
                            <span className="text-emerald-500">{o.latest}</span>
                            {" · "}
                            {o.type}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {inspectQuery.error && (
        <Card>
          <CardContent className="p-4 text-sm text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {String(inspectQuery.error.message ?? inspectQuery.error)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
