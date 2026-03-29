import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  ArcElement, Title, Tooltip, Legend, Filler
} from "chart.js";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import {
  Database, TrendingUp, AlertTriangle, BarChart3, Activity,
  CheckCircle2, Clock, Zap, Target
} from "lucide-react";

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  ArcElement, Title, Tooltip, Legend, Filler
);

const CHART_COLORS = {
  primary: "rgba(56, 189, 248, 0.8)",
  primaryBg: "rgba(56, 189, 248, 0.15)",
  success: "rgba(52, 211, 153, 0.8)",
  successBg: "rgba(52, 211, 153, 0.15)",
  warning: "rgba(251, 191, 36, 0.8)",
  warningBg: "rgba(251, 191, 36, 0.15)",
  danger: "rgba(248, 113, 113, 0.8)",
  dangerBg: "rgba(248, 113, 113, 0.15)",
  purple: "rgba(167, 139, 250, 0.8)",
  purpleBg: "rgba(167, 139, 250, 0.15)",
  orange: "rgba(251, 146, 60, 0.8)",
  orangeBg: "rgba(251, 146, 60, 0.15)",
  teal: "rgba(45, 212, 191, 0.8)",
  tealBg: "rgba(45, 212, 191, 0.15)",
  pink: "rgba(244, 114, 182, 0.8)",
  pinkBg: "rgba(244, 114, 182, 0.15)",
};

const SEVERITY_COLORS: Record<string, string> = {
  low: CHART_COLORS.success,
  medium: CHART_COLORS.warning,
  high: CHART_COLORS.orange,
  critical: CHART_COLORS.danger,
};

const SOURCE_TYPE_COLORS: Record<string, string> = {
  document_upload: CHART_COLORS.primary,
  web_scrape: CHART_COLORS.success,
  api_feed: CHART_COLORS.purple,
  market_data: CHART_COLORS.warning,
  regulatory: CHART_COLORS.danger,
  product_catalog: CHART_COLORS.teal,
  news_feed: CHART_COLORS.orange,
  competitor: CHART_COLORS.pink,
  custom: "rgba(148, 163, 184, 0.8)",
};

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: "rgba(148, 163, 184, 0.9)", font: { size: 11 } },
    },
    tooltip: {
      backgroundColor: "rgba(15, 23, 42, 0.95)",
      titleColor: "#e2e8f0",
      bodyColor: "#cbd5e1",
      borderColor: "rgba(56, 189, 248, 0.3)",
      borderWidth: 1,
      cornerRadius: 8,
      padding: 10,
    },
  },
  scales: {
    x: {
      ticks: { color: "rgba(148, 163, 184, 0.7)", font: { size: 10 } },
      grid: { color: "rgba(148, 163, 184, 0.08)" },
    },
    y: {
      ticks: { color: "rgba(148, 163, 184, 0.7)", font: { size: 10 } },
      grid: { color: "rgba(148, 163, 184, 0.08)" },
    },
  },
};

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "bottom" as const,
      labels: { color: "rgba(148, 163, 184, 0.9)", font: { size: 11 }, padding: 12 },
    },
    tooltip: {
      backgroundColor: "rgba(15, 23, 42, 0.95)",
      titleColor: "#e2e8f0",
      bodyColor: "#cbd5e1",
      borderColor: "rgba(56, 189, 248, 0.3)",
      borderWidth: 1,
      cornerRadius: 8,
    },
  },
};

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string | number; color: string;
}) {
  return (
    <Card className="border-border/30 bg-card/50 backdrop-blur-sm">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold font-heading">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsDashboard() {
  const [days, setDays] = useState(30);

  const stats = trpc.analytics.platformStats.useQuery();
  const volume = trpc.analytics.ingestionVolume.useQuery({ days });
  const quality = trpc.analytics.qualityTrends.useQuery({ days });
  const severity = trpc.analytics.insightSeverity.useQuery();
  const categories = trpc.analytics.insightCategories.useQuery();
  const sources = trpc.analytics.sourceBreakdown.useQuery();
  const jobs = trpc.analytics.jobStatus.useQuery();
  const actions = trpc.analytics.actionStatus.useQuery();
  const volumeByType = trpc.analytics.volumeBySourceType.useQuery({ days });

  const volumeChartData = useMemo(() => {
    if (!volume.data?.length) return null;
    return {
      labels: (Array.isArray(volume.data) ? volume.data : []).map((r: any) => r.date),
      datasets: [{
        label: "Records Ingested",
        data: (Array.isArray(volume.data) ? volume.data : []).map((r: any) => Number(r.count)),
        backgroundColor: CHART_COLORS.primaryBg,
        borderColor: CHART_COLORS.primary,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
      }],
    };
  }, [volume.data]);

  const qualityChartData = useMemo(() => {
    if (!quality.data?.length) return null;
    return {
      labels: (Array.isArray(quality.data) ? quality.data : []).map((r: any) => r.date),
      datasets: [{
        label: "Avg Quality Score",
        data: (Array.isArray(quality.data) ? quality.data : []).map((r: any) => Number(r.avgScore || 0)),
        backgroundColor: CHART_COLORS.successBg,
        borderColor: CHART_COLORS.success,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
      }],
    };
  }, [quality.data]);

  const severityChartData = useMemo(() => {
    if (!severity.data?.length) return null;
    const labels = (Array.isArray(severity.data) ? severity.data : []).map(r => (r.severity || "unknown").charAt(0).toUpperCase() + (r.severity || "unknown").slice(1));
    return {
      labels,
      datasets: [{
        data: (Array.isArray(severity.data) ? severity.data : []).map((r: any) => Number(r.count)),
        backgroundColor: (Array.isArray(severity.data) ? severity.data : []).map((r: any) => SEVERITY_COLORS[r.severity || "low"] || CHART_COLORS.primary),
        borderWidth: 0,
      }],
    };
  }, [severity.data]);

  const categoryChartData = useMemo(() => {
    if (!categories.data?.length) return null;
    const colorPool = [CHART_COLORS.primary, CHART_COLORS.success, CHART_COLORS.warning, CHART_COLORS.danger, CHART_COLORS.purple, CHART_COLORS.orange, CHART_COLORS.teal, CHART_COLORS.pink];
    return {
      labels: (Array.isArray(categories.data) ? categories.data : []).map((r: any) => (r.category || "unknown").replace(/_/g, " ")),
      datasets: [{
        data: (Array.isArray(categories.data) ? categories.data : []).map((r: any) => Number(r.count)),
        backgroundColor: (Array.isArray(categories.data) ? categories.data : []).map((_: any, i: number) => colorPool[i % colorPool.length]),
        borderWidth: 0,
      }],
    };
  }, [categories.data]);

  const sourceTypeChartData = useMemo(() => {
    if (!sources.data?.byType?.length) return null;
    return {
      labels: sources.data.byType.map(r => (r.type || "unknown").replace(/_/g, " ")),
      datasets: [{
        label: "Sources",
        data: sources.data.byType.map(r => Number(r.count)),
        backgroundColor: sources.data.byType.map(r => SOURCE_TYPE_COLORS[r.type || "custom"] || CHART_COLORS.primary),
        borderWidth: 0,
        borderRadius: 6,
      }],
    };
  }, [sources.data]);

  const jobStatusChartData = useMemo(() => {
    if (!jobs.data?.length) return null;
    const statusColors: Record<string, string> = {
      pending: CHART_COLORS.warning,
      running: CHART_COLORS.primary,
      completed: CHART_COLORS.success,
      failed: CHART_COLORS.danger,
      cancelled: "rgba(148, 163, 184, 0.5)",
    };
    return {
      labels: (Array.isArray(jobs.data) ? jobs.data : []).map((r: any) => (r.status || "unknown").charAt(0).toUpperCase() + (r.status || "unknown").slice(1)),
      datasets: [{
        data: (Array.isArray(jobs.data) ? jobs.data : []).map((r: any) => Number(r.count)),
        backgroundColor: (Array.isArray(jobs.data) ? jobs.data : []).map((r: any) => statusColors[r.status || "pending"] || CHART_COLORS.primary),
        borderWidth: 0,
      }],
    };
  }, [jobs.data]);

  const actionStatusChartData = useMemo(() => {
    if (!actions.data?.length) return null;
    const statusColors: Record<string, string> = {
      pending: CHART_COLORS.warning,
      in_progress: CHART_COLORS.primary,
      completed: CHART_COLORS.success,
      dismissed: "rgba(148, 163, 184, 0.5)",
    };
    return {
      labels: (Array.isArray(actions.data) ? actions.data : []).map((r: any) => (r.status || "unknown").replace(/_/g, " ")),
      datasets: [{
        data: (Array.isArray(actions.data) ? actions.data : []).map((r: any) => Number(r.count)),
        backgroundColor: (Array.isArray(actions.data) ? actions.data : []).map((r: any) => statusColors[r.status || "pending"] || CHART_COLORS.primary),
        borderWidth: 0,
      }],
    };
  }, [actions.data]);

  const isLoading = stats.isLoading;

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-heading font-semibold">Platform Analytics</h3>
          <p className="text-sm text-muted-foreground">Real-time data ingestion and quality metrics</p>
        </div>
        <Select value={String(days)} onValueChange={v => setDays(Number(v))}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="60">Last 60 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard icon={Database} label="Data Sources" value={stats.data?.totalSources ?? 0} color="bg-sky-500/10 text-sky-400" />
          <StatCard icon={BarChart3} label="Records" value={stats.data?.totalRecords ?? 0} color="bg-emerald-500/10 text-emerald-400" />
          <StatCard icon={Zap} label="Insights" value={stats.data?.totalInsights ?? 0} color="bg-amber-500/10 text-amber-400" />
          <StatCard icon={Activity} label="Jobs Run" value={stats.data?.totalJobs ?? 0} color="bg-violet-500/10 text-violet-400" />
          <StatCard icon={Target} label="Actions" value={stats.data?.totalActions ?? 0} color="bg-orange-500/10 text-orange-400" />
          <StatCard icon={CheckCircle2} label="Avg Quality" value={stats.data?.avgQuality ? `${(Number(stats.data.avgQuality) * 100).toFixed(0)}%` : "N/A"} color="bg-teal-500/10 text-teal-400" />
        </div>
      )}

      {/* Charts Row 1: Volume + Quality */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/30 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-sky-400" />
              Ingestion Volume
            </CardTitle>
            <CardDescription className="text-xs">Records ingested per day</CardDescription>
          </CardHeader>
          <CardContent className="h-[240px]">
            {volume.isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : volumeChartData ? (
              <Line data={volumeChartData} options={chartOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/30 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Data Quality Trends
            </CardTitle>
            <CardDescription className="text-xs">Average quality score per day</CardDescription>
          </CardHeader>
          <CardContent className="h-[240px]">
            {quality.isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : qualityChartData ? (
              <Line data={qualityChartData} options={chartOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Severity + Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/30 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Insight Severity
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[200px]">
            {severity.isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : severityChartData ? (
              <Doughnut data={severityChartData} options={doughnutOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/30 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="w-4 h-4 text-violet-400" />
              Insight Types
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[200px]">
            {categories.isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : categoryChartData ? (
              <Doughnut data={categoryChartData} options={doughnutOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/30 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-400" />
              Job Status
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[200px]">
            {jobs.isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : jobStatusChartData ? (
              <Doughnut data={jobStatusChartData} options={doughnutOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/30 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="w-4 h-4 text-orange-400" />
              Action Status
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[200px]">
            {actions.isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : actionStatusChartData ? (
              <Doughnut data={actionStatusChartData} options={doughnutOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3: Source Breakdown */}
      <Card className="border-border/30 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Database className="w-4 h-4 text-teal-400" />
            Data Sources by Type
          </CardTitle>
          <CardDescription className="text-xs">Distribution of registered data sources</CardDescription>
        </CardHeader>
        <CardContent className="h-[240px]">
          {sources.isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : sourceTypeChartData ? (
            <Bar data={sourceTypeChartData} options={{
              ...chartOptions,
              plugins: { ...chartOptions.plugins, legend: { display: false } },
            }} />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
