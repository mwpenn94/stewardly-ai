import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  BarChart3, Play, Clock, CheckCircle2, AlertCircle,
  Loader2, TrendingUp, Database, FileText, Sparkles,
  Activity, Cpu,
} from "lucide-react";
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";

function ModelCard({ model, onRun }: { model: any; onRun: (slug: string) => void }) {
  const statusColors: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-400",
    draft: "bg-amber-500/15 text-amber-400",
    deprecated: "bg-red-500/15 text-red-400",
  };

  return (
    <Card className="border transition-all hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">{model.name}</h4>
              <span className="text-[10px] text-muted-foreground">{model.slug}</span>
            </div>
          </div>
          <Badge className={`text-[9px] ${statusColors[model.status] || statusColors.draft}`}>
            {model.status}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{model.description}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[9px]">{model.category}</Badge>
            <span className="text-[10px] text-muted-foreground">v{model.version}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => onRun(model.slug)}
            disabled={model.status !== "active"}
          >
            <Play className="w-3 h-3" /> Run
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RunHistoryCard({ run }: { run: any }) {
  const statusIcons: Record<string, typeof CheckCircle2> = {
    completed: CheckCircle2,
    running: Loader2,
    failed: AlertCircle,
    pending: Clock,
  };
  const Icon = statusIcons[run.status] || Clock;

  return (
    <Card className="border">
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <Icon className={`w-4 h-4 shrink-0 ${
            run.status === "completed" ? "text-emerald-400" :
            run.status === "failed" ? "text-red-400" :
            run.status === "running" ? "text-blue-400 animate-spin" :
            "text-muted-foreground"
          }`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{run.modelSlug}</span>
              <Badge variant="outline" className="text-[9px]">{run.triggerType}</Badge>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {run.executionTimeMs ? `${run.executionTimeMs}ms` : "—"} · {new Date(run.startedAt).toLocaleString()}
            </span>
          </div>
          <Badge className={`text-[9px] ${
            run.status === "completed" ? "bg-emerald-500/15 text-emerald-400" :
            run.status === "failed" ? "bg-red-500/15 text-red-400" :
            "bg-blue-500/15 text-blue-400"
          }`}>
            {run.status}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsHub() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState("models");

  const modelsQuery = trpc.modelEngine.list.useQuery(
    undefined,
    { enabled: isAuthenticated },
  );

  const historyQuery = trpc.modelEngine.getRunHistory.useQuery(
    { modelSlug: "", limit: 20 },
    { enabled: isAuthenticated },
  );

  const runModel = trpc.modelEngine.execute.useMutation({
    onSuccess: (data) => {
      historyQuery.refetch();
      toast.success(`Model run started (${data.runId})`);
    },
    onError: (e) => toast.error(e.message),
  });

  if (!isAuthenticated) {
    return (
      <div className="relative flex items-center justify-center min-h-[60vh]">
      {/* Warm gold radial glow */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.10]" style={{ background: 'radial-gradient(ellipse at 30% 50%, oklch(0.76 0.14 80) 0%, transparent 70%)' }} />
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 text-accent" />
            <h2 className="text-lg font-semibold mb-2">Analytics Hub</h2>
            <p className="text-sm text-muted-foreground">
              Sign in to access analytical models, run history, and data exports.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const models = modelsQuery.data ?? [];
  const runs = historyQuery.data ?? [];

  return (
    <div className="container max-w-5xl py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Analytics Hub</h1>
            <p className="text-sm text-muted-foreground">
              Analytical models, execution history, and data intelligence
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="models" className="gap-1.5">
            <Cpu className="w-3.5 h-3.5" />
            Models
            <Badge variant="outline" className="ml-1 h-4 px-1.5 text-[9px]">{models.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <Activity className="w-3.5 h-3.5" />
            Run History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="models">
          <SectionErrorBoundary sectionName="Models" onRetry={() => utils.modelEngine.list.invalidate()}>
          {modelsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : models.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Database className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No analytical models configured yet.</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Models will be seeded when the platform is initialized.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {models.map((model: any) => (
                <ModelCard
                  key={model.id}
                  model={model}
                  onRun={(slug) => runModel.mutate({
                    modelSlug: slug,
                    inputData: {},
                  })}
                />
              ))}
            </div>
          )}
          </SectionErrorBoundary>
        </TabsContent>

        <TabsContent value="history">
          <SectionErrorBoundary sectionName="Run History" onRetry={() => utils.modelEngine.getRunHistory.invalidate()}>
          {historyQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : runs.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Clock className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No model runs yet.</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Run a model from the Models tab to see execution history.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {runs.map((run: any) => (
                <RunHistoryCard key={run.id} run={run} />
              ))}
            </div>
          )}
          </SectionErrorBoundary>
        </TabsContent>
      </Tabs>
    </div>
  );
}
