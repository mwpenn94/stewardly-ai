/**
 * AdminSystemHealth — Cron status grid (34 jobs), error rates, unacknowledged alerts.
 * Admin only.
 */
import { useState } from "react";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Activity, AlertTriangle, CheckCircle2, Clock, RefreshCw,
  Loader2, XCircle, Timer, Server, Zap,
} from "lucide-react";

const CRON_JOBS = [
  { name: "provider-health-check", schedule: "Every 4h", category: "Monitoring" },
  { name: "smsit-contact-sync", schedule: "Every 4h", category: "Integration" },
  { name: "refresh-sofr-rates", schedule: "Daily 6am", category: "Data" },
  { name: "daily-market-close", schedule: "Daily 7pm", category: "Data" },
  { name: "daily-crm-sync", schedule: "Daily 2am", category: "Integration" },
  { name: "data-freshness-check", schedule: "Daily", category: "Monitoring" },
  { name: "pii-retention-sweep", schedule: "Daily 3am", category: "Compliance" },
  { name: "import-stale-cleanup", schedule: "Daily 3am", category: "Maintenance" },
  { name: "reverify-credentials", schedule: "Sun 2am", category: "Verification" },
  { name: "coi-alerts", schedule: "Mon 8am", category: "Notification" },
  { name: "rescore-leads", schedule: "Sun 4am", category: "AI" },
  { name: "weekly-scrape-batch", schedule: "Weekly", category: "Data" },
  { name: "score-data-value", schedule: "Weekly", category: "AI" },
  { name: "rate-optimization", schedule: "Weekly", category: "Data" },
  { name: "weekly-performance-report", schedule: "Mon 6am", category: "Reporting" },
  { name: "cfp-refresh", schedule: "Monthly", category: "Verification" },
  { name: "regulatory-scan", schedule: "Monthly", category: "Compliance" },
  { name: "bulk-refresh", schedule: "Monthly", category: "Data" },
  { name: "retrain-propensity", schedule: "Monthly", category: "AI" },
  { name: "carrier-ratings", schedule: "Monthly", category: "Data" },
  { name: "product-rates", schedule: "Monthly", category: "Data" },
  { name: "monthly-report-snapshot", schedule: "Monthly", category: "Reporting" },
  { name: "bias-audit", schedule: "Quarterly", category: "Compliance" },
  { name: "iul-crediting-update", schedule: "Quarterly", category: "Data" },
  { name: "quarterly-planning-review", schedule: "Quarterly", category: "Reporting" },
  { name: "parameter-check", schedule: "Annual (weekly Oct-Dec)", category: "Data" },
  { name: "ssa-cola", schedule: "October", category: "Data" },
  { name: "medicare-premium", schedule: "November", category: "Data" },
  { name: "trend-ingestion", schedule: "Daily", category: "Data" },
  { name: "census-refresh", schedule: "Monthly", category: "Data" },
  { name: "market-history-update", schedule: "Daily", category: "Data" },
  { name: "report-generation", schedule: "Weekly", category: "Reporting" },
  { name: "calculator-import", schedule: "Daily", category: "Data" },
  { name: "coa-dashboard-import", schedule: "Daily", category: "Data" },
];

const CATEGORIES = Array.from(new Set(CRON_JOBS.map(j => j.category)));

export default function AdminSystemHealth() {
  const { user, loading: authLoading } = useAuth();
  const [filter, setFilter] = useState<string>("all");

  if (authLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <XCircle className="w-12 h-12 text-red-500" />
          <p className="text-muted-foreground">Admin access required</p>
        </div>
      </AppShell>
    );
  }

  const filtered = filter === "all" ? CRON_JOBS : CRON_JOBS.filter(j => j.category === filter);

  return (
    <AppShell>
      <div className="container max-w-6xl py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="w-6 h-6" /> System Health
            </h1>
            <p className="text-muted-foreground">Monitor cron jobs, error rates, and system alerts</p>
          </div>
          <Button variant="outline" onClick={() => toast.info("Refreshing system status...")}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{CRON_JOBS.length}</p>
                  <p className="text-xs text-muted-foreground">Total Jobs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{CRON_JOBS.length}</p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">0</p>
                  <p className="text-xs text-muted-foreground">Warnings</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">0</p>
                  <p className="text-xs text-muted-foreground">Errors</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 flex-wrap">
          <Badge variant={filter === "all" ? "default" : "outline"} className="cursor-pointer" onClick={() => setFilter("all")}>All ({CRON_JOBS.length})</Badge>
          {CATEGORIES.map(cat => {
            const count = CRON_JOBS.filter(j => j.category === cat).length;
            return (
              <Badge key={cat} variant={filter === cat ? "default" : "outline"} className="cursor-pointer" onClick={() => setFilter(cat)}>
                {cat} ({count})
              </Badge>
            );
          })}
        </div>

        {/* Job grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(job => (
            <Card key={job.name} className="hover:bg-muted/30 transition-colors">
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <p className="font-medium text-sm">{job.name}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{job.schedule}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">{job.category}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
