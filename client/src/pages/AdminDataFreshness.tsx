/**
 * AdminDataFreshness — live data-source freshness dashboard (pass 67).
 *
 * Before pass 67 this page rendered a hardcoded 14-entry PROVIDERS
 * array with fake "last refresh" timestamps and toast-only action
 * buttons. Admins opening `/admin/data-freshness` (a nav entry)
 * saw static numbers that never reflected reality.
 *
 * Pass 67 wires it to the real `dataIngestion.listSources` query
 * which returns `data_sources` rows from the DB. The freshness
 * traffic-light is derived from `lastRunAt` against a stale
 * threshold per source type. The Refresh button fires
 * `dataIngestion.runIngestion` for the selected source. The Pause
 * toggle flips `dataSource.isActive` via `updateSource`. All three
 * mutations invalidate the query so the UI reflects the server's
 * view immediately.
 */
import { useMemo } from "react";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Database,
  RefreshCw,
  Loader2,
  XCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

// Freshness windows per source type (24-hour buckets). If a source has
// run more recently than the `fresh` window, it's green; between
// `fresh` and `stale`, amber; older, red. `null` means "never ran" →
// treated as error.
const FRESH_HOURS: Record<string, { fresh: number; stale: number }> = {
  market_data: { fresh: 24, stale: 72 },
  api_feed: { fresh: 48, stale: 168 },
  regulatory: { fresh: 168, stale: 720 }, // 1w / 30d
  product_catalog: { fresh: 168, stale: 720 },
  news_feed: { fresh: 24, stale: 168 },
  web_scrape: { fresh: 168, stale: 720 },
  document_upload: { fresh: 720, stale: 2160 }, // 30d / 90d
  competitor: { fresh: 168, stale: 720 },
  custom: { fresh: 168, stale: 720 },
};

type SourceStatus = "fresh" | "stale" | "error";

function statusFor(lastRunAt: number | null, sourceType: string): SourceStatus {
  if (lastRunAt == null) return "error";
  const cfg = FRESH_HOURS[sourceType] ?? { fresh: 168, stale: 720 };
  const hoursAgo = (Date.now() - lastRunAt) / (1000 * 60 * 60);
  if (hoursAgo <= cfg.fresh) return "fresh";
  if (hoursAgo <= cfg.stale) return "stale";
  return "error";
}

const statusIcon = (s: SourceStatus) => {
  switch (s) {
    case "fresh":
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    case "stale":
      return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    case "error":
      return <XCircle className="w-4 h-4 text-red-500" />;
  }
};

function formatLastRun(lastRunAt: number | null): string {
  if (lastRunAt == null) return "never";
  const ms = Date.now() - lastRunAt;
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AdminDataFreshness() {
  const { user, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();

  const sourcesQ = trpc.dataIngestion.listSources.useQuery(undefined, {
    refetchInterval: 30_000,
    retry: false,
  });
  const runMut = trpc.dataIngestion.runIngestion.useMutation({
    onSuccess: () => {
      toast.success("Ingestion started");
      utils.dataIngestion.listSources.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.dataIngestion.updateSource.useMutation({
    onSuccess: () => {
      utils.dataIngestion.listSources.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const sources = sourcesQ.data ?? [];

  const { freshCount, staleCount, errorCount } = useMemo(() => {
    let fresh = 0;
    let stale = 0;
    let error = 0;
    for (const s of sources) {
      const st = statusFor(s.lastRunAt ?? null, s.sourceType);
      if (st === "fresh") fresh += 1;
      else if (st === "stale") stale += 1;
      else error += 1;
    }
    return { freshCount: fresh, staleCount: stale, errorCount: error };
  }, [sources]);

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

  return (
    <AppShell>
      <div className="container max-w-6xl py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Database className="w-6 h-6" /> Data Freshness
            </h1>
            <p className="text-muted-foreground">
              Monitor the freshness of all connected data feeds — auto-refreshes every 30 seconds.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => sourcesQ.refetch()}
            disabled={sourcesQ.isFetching}
          >
            {sourcesQ.isFetching ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold font-mono tabular-nums text-emerald-500">
                {sourcesQ.isLoading ? "—" : freshCount}
              </p>
              <p className="text-xs text-muted-foreground">Fresh</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold font-mono tabular-nums text-amber-500">
                {sourcesQ.isLoading ? "—" : staleCount}
              </p>
              <p className="text-xs text-muted-foreground">Stale</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold font-mono tabular-nums text-red-500">
                {sourcesQ.isLoading ? "—" : errorCount}
              </p>
              <p className="text-xs text-muted-foreground">Errors / Never Run</p>
            </CardContent>
          </Card>
        </div>

        {sourcesQ.isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading data sources…
          </div>
        ) : sources.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm space-y-2">
              <p>No data sources configured yet.</p>
              <p className="text-xs">
                Data sources are created through the Data Intelligence page
                or imported through the ingestion pipeline.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sources.map((provider) => {
              const st = statusFor(provider.lastRunAt ?? null, provider.sourceType);
              return (
                <Card
                  key={provider.id}
                  className={provider.isActive === false ? "opacity-60" : ""}
                >
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {statusIcon(st)}
                          <p className="font-medium text-sm truncate">
                            {provider.name}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="truncate">
                            {provider.url ?? provider.sourceType}
                          </span>
                          {provider.scheduleCron && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {provider.scheduleCron}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs flex-wrap">
                          <Badge variant="outline" className="text-[10px]">
                            {provider.sourceType}
                          </Badge>
                          <span className="text-muted-foreground">
                            Last: {formatLastRun(provider.lastRunAt ?? null)}
                          </span>
                          {provider.totalRecordsIngested != null && provider.totalRecordsIngested > 0 && (
                            <span className="text-muted-foreground">
                              · {provider.totalRecordsIngested.toLocaleString()} records
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => runMut.mutate({ dataSourceId: provider.id })}
                          disabled={runMut.isPending || provider.isActive === false}
                          title="Run ingestion now"
                        >
                          {runMut.isPending && runMut.variables?.dataSourceId === provider.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3 h-3" />
                          )}
                        </Button>
                        <Switch
                          checked={provider.isActive !== false}
                          onCheckedChange={(checked) => {
                            updateMut.mutate({ id: provider.id, isActive: checked });
                            toast.info(
                              checked ? `${provider.name} resumed` : `${provider.name} paused`,
                            );
                          }}
                          disabled={updateMut.isPending}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
