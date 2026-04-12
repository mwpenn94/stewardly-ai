/**
 * AdminSystemHealth — live scheduler dashboard (pass 67).
 *
 * Before pass 67 this page rendered a hardcoded 34-entry CRON_JOBS
 * array and displayed static "0 Warnings / 0 Errors" counters with a
 * Refresh button that just showed a toast. No server data was ever
 * fetched. An admin opening `/admin/system-health` could not verify
 * whether any cron job had actually run, when, or with what outcome
 * — despite CLAUDE.md claiming "37 cron jobs fully monitored".
 *
 * Pass 67 wires this page to the real `integrations.getSchedulerStatus`
 * query (already exported by `server/routers/integrations.ts`), which
 * returns per-job `{ lastRun, lastError, runCount, errorCount,
 * isRunning, nextRun }` from `server/services/scheduler.ts`. The
 * summary counters now reflect actual state, every job card shows
 * its last run + last error + run/error counts, and the Refresh
 * button invalidates the query so admins see fresh data immediately.
 *
 * Also adds a per-job "Run now" button that calls the existing
 * `integrations.triggerSchedulerJob` admin mutation — so admins can
 * manually kick off a job for debugging or urgent runs without
 * editing the scheduler source.
 */
import { useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Loader2,
  XCircle,
  Zap,
  Play,
} from "lucide-react";

// Deployment categories — the scheduler doesn't carry a category field,
// so we map job names to categories client-side. Unknown names get
// bucketed into "Other" rather than being dropped.
const CATEGORY_BY_NAME: Record<string, string> = {
  "provider-health-check": "Monitoring",
  "smsit-contact-sync": "Integration",
  "refresh-sofr-rates": "Data",
  "daily-market-close": "Data",
  "daily-crm-sync": "Integration",
  "data-freshness-check": "Monitoring",
  "pii-retention-sweep": "Compliance",
  "import-stale-cleanup": "Maintenance",
  "reverify-credentials": "Verification",
  "coi-alerts": "Notification",
  "rescore-leads": "AI",
  "weekly-scrape-batch": "Data",
  "score-data-value": "AI",
  "rate-optimization": "Data",
  "weekly-performance-report": "Reporting",
  "cfp-refresh": "Verification",
  "regulatory-scan": "Compliance",
  "bulk-refresh": "Data",
  "retrain-propensity": "AI",
  "carrier-ratings": "Data",
  "product-rates": "Data",
  "monthly-report-snapshot": "Reporting",
  "bias-audit": "Compliance",
  "iul-crediting-update": "Data",
  "quarterly-planning-review": "Reporting",
  "parameter-check": "Data",
  "ssa-cola": "Data",
  "medicare-premium": "Data",
  "trend-ingestion": "Data",
  "census-refresh": "Data",
  "market-history-update": "Data",
  "report-generation": "Reporting",
  "calculator-import": "Data",
  "coa-dashboard-import": "Data",
  improvement_engine: "AI",
  health_checks: "Monitoring",
  stale_cleanup: "Maintenance",
  role_elevation_revoke: "Compliance",
};

function categoryFor(name: string): string {
  return CATEGORY_BY_NAME[name] ?? "Other";
}

function humanizeInterval(ms: number): string {
  if (!ms || ms <= 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `every ${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `every ${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `every ${h}h`;
  const d = Math.round(h / 24);
  return `every ${d}d`;
}

function formatRelative(d: Date | string | null): string {
  if (!d) return "never";
  const date = typeof d === "string" ? new Date(d) : d;
  const deltaMs = Date.now() - date.getTime();
  if (deltaMs < 0) {
    const seconds = Math.abs(Math.round(deltaMs / 1000));
    if (seconds < 60) return `in ${seconds}s`;
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `in ${mins}m`;
    const hrs = Math.round(mins / 60);
    return `in ${hrs}h`;
  }
  const seconds = Math.round(deltaMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export default function AdminSystemHealth() {
  const { user, loading: authLoading } = useAuth();
  const [filter, setFilter] = useState<string>("all");

  const status = trpc.integrations.getSchedulerStatus.useQuery(undefined, {
    refetchInterval: 10_000, // 10s live refresh while the page is open
    retry: false,
  });
  const trigger = trpc.integrations.triggerSchedulerJob.useMutation({
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Job triggered");
        status.refetch();
      } else {
        toast.error(res.error ?? "Job trigger failed");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  // Derive per-category counts + warning/error aggregates from the
  // live jobs list before we render anything — it's cheap, O(n).
  const aggregate = useMemo(() => {
    const jobs = status.data?.jobs ?? [];
    const byCategory = new Map<string, number>();
    let activeCount = 0;
    let warnings = 0;
    let errors = 0;
    for (const job of jobs) {
      const cat = categoryFor(job.name);
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
      if (job.isRunning) activeCount += 1;
      if (job.lastError) errors += 1;
      else if (job.errorCount > 0) warnings += 1;
    }
    return {
      jobs,
      total: jobs.length,
      active: activeCount,
      warnings,
      errors,
      byCategory,
    };
  }, [status.data]);

  const filteredJobs = useMemo(() => {
    if (filter === "all") return aggregate.jobs;
    return aggregate.jobs.filter((j) => categoryFor(j.name) === filter);
  }, [aggregate.jobs, filter]);

  if (authLoading) {
    return (
      <AppShell title="System Health">
      <SEOHead title="System Health" description="Monitor system health, cron jobs, and scheduler status" />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <AppShell title="System Health">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <XCircle className="w-12 h-12 text-red-500" />
          <p className="text-muted-foreground">Admin access required</p>
        </div>
      </AppShell>
    );
  }

  const initialized = status.data?.initialized ?? false;

  return (
    <AppShell title="System Health">
      <div className="container max-w-6xl py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="w-6 h-6" /> System Health
            </h1>
            <p className="text-muted-foreground">
              Live cron job telemetry from{" "}
              <code className="font-mono text-xs">
                integrations.getSchedulerStatus
              </code>{" "}
              — refreshes every 10 seconds.
            </p>
          </div>
          <Button variant="outline" onClick={() => status.refetch()} disabled={status.isFetching}>
            {status.isFetching ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>

        {!initialized && !status.isLoading && (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="py-3 flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>
                Scheduler is not initialized. Jobs may not be running in this
                environment (e.g. NODE_ENV=test or a deploy before
                `initScheduler()` finished).
              </span>
            </CardContent>
          </Card>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
            label="Total Jobs"
            value={aggregate.total}
            loading={status.isLoading}
            tone="emerald"
          />
          <SummaryCard
            icon={<Zap className="w-5 h-5 text-accent" />}
            label="Currently Running"
            value={aggregate.active}
            loading={status.isLoading}
            tone="sky"
          />
          <SummaryCard
            icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
            label="Historical Errors"
            value={aggregate.warnings}
            loading={status.isLoading}
            tone="amber"
          />
          <SummaryCard
            icon={<XCircle className="w-5 h-5 text-red-500" />}
            label="Currently Failing"
            value={aggregate.errors}
            loading={status.isLoading}
            tone="red"
          />
        </div>

        {/* Category filter */}
        {aggregate.total > 0 && (
          <div className="flex gap-2 flex-wrap">
            <Badge
              variant={filter === "all" ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setFilter("all")}
            >
              All ({aggregate.total})
            </Badge>
            {Array.from(aggregate.byCategory.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([cat, count]) => (
                <Badge
                  key={cat}
                  variant={filter === cat ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setFilter(cat)}
                >
                  {cat} ({count})
                </Badge>
              ))}
          </div>
        )}

        {/* Job grid */}
        {status.isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading scheduler status…
          </div>
        ) : aggregate.total === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              No jobs registered in the scheduler for this environment.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredJobs.map((job) => (
              <JobCard
                key={job.name}
                job={job}
                category={categoryFor(job.name)}
                onTrigger={() => trigger.mutate({ jobName: job.name })}
                triggering={trigger.isPending && trigger.variables?.jobName === job.name}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────

function SummaryCard({
  icon,
  label,
  value,
  loading,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  loading: boolean;
  tone: "emerald" | "sky" | "amber" | "red";
}) {
  const bg =
    tone === "emerald"
      ? "bg-emerald-500/10"
      : tone === "sky"
        ? "bg-accent/10"
        : tone === "amber"
          ? "bg-amber-500/10"
          : "bg-red-500/10";
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${bg} flex items-center justify-center`}>
            {icon}
          </div>
          <div>
            <p className="text-2xl font-bold font-mono tabular-nums">
              {loading ? "—" : value}
            </p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function JobCard({
  job,
  category,
  onTrigger,
  triggering,
}: {
  job: {
    name: string;
    intervalMs: number;
    lastRun: Date | string | null;
    lastError: string | null;
    runCount: number;
    errorCount: number;
    isRunning: boolean;
    nextRun: Date | string | null;
  };
  category: string;
  onTrigger: () => void;
  triggering: boolean;
}) {
  const hasFailed = !!job.lastError;
  const hasHistoricalErrors = !hasFailed && job.errorCount > 0;
  const statusIcon = hasFailed ? (
    <XCircle className="w-4 h-4 text-red-500" />
  ) : hasHistoricalErrors ? (
    <AlertTriangle className="w-4 h-4 text-amber-500" />
  ) : (
    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
  );

  return (
    <Card
      className={`hover:bg-muted/30 transition-colors ${
        hasFailed ? "border-red-500/30" : ""
      }`}
    >
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              {statusIcon}
              <p className="font-medium text-sm truncate">{job.name}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{humanizeInterval(job.intervalMs)}</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <div>
                Last run:{" "}
                <span className="font-mono">{formatRelative(job.lastRun)}</span>
              </div>
              <div>
                Next:{" "}
                <span className="font-mono">{formatRelative(job.nextRun)}</span>
              </div>
              <div>
                Runs: <span className="font-mono">{job.runCount}</span>
                {job.errorCount > 0 && (
                  <>
                    {" · "}
                    <span className="font-mono text-amber-600">
                      {job.errorCount} errors
                    </span>
                  </>
                )}
              </div>
              {job.lastError && (
                <div
                  className="text-red-600 dark:text-red-400 line-clamp-2 pt-1"
                  title={job.lastError}
                >
                  {job.lastError}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <Badge variant="outline" className="text-[10px]">
              {category}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px]"
              onClick={onTrigger}
              disabled={triggering || job.isRunning}
              title={job.isRunning ? "Job is already running" : "Run this job now"}
            >
              {triggering ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <>
                  <Play className="w-3 h-3 mr-1" /> Run now
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
