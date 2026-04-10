/**
 * BackgroundJobsPanel — Code Chat long-running job inspector.
 *
 * Pass 201. Shows the user's active + historical background jobs
 * (autonomous coding sessions, GitHub push jobs) with live event
 * streaming, cancel, and status badges.
 *
 * Polls every 2s while any job is running; backs off to 10s when
 * idle to stay cheap.
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Square,
  Play,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

export default function BackgroundJobsPanel() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const jobs = trpc.codeChat.listBackgroundJobs.useQuery(undefined, {
    refetchInterval: (query) => {
      const data = query.state.data as any;
      const hasActive = data?.jobs?.some(
        (j: any) => j.status === "running" || j.status === "queued",
      );
      return hasActive ? 2_000 : 10_000;
    },
  });
  const cancel = trpc.codeChat.cancelBackgroundJob.useMutation({
    onSuccess: () => jobs.refetch(),
  });
  const startAutonomous = trpc.codeChat.startAutonomousJob.useMutation({
    onSuccess: () => jobs.refetch(),
  });

  const [description, setDescription] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const list = jobs.data?.jobs ?? [];
  const active = useMemo(
    () => list.filter((j: any) => j.status === "running" || j.status === "queued"),
    [list],
  );
  const history = useMemo(
    () => list.filter((j: any) => j.status !== "running" && j.status !== "queued"),
    [list],
  );

  return (
    <div className="space-y-4 mt-4">
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Play className="h-4 w-4" /> Start autonomous coding session
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase">Goal description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Explore the wealth engine module and outline refactor opportunities"
                rows={3}
                className="text-xs"
              />
            </div>
            <Button
              size="sm"
              disabled={!description.trim() || startAutonomous.isPending}
              onClick={async () => {
                const res = await startAutonomous.mutateAsync({
                  description: description.trim(),
                });
                toast.success(`Job ${res.jobId.slice(0, 8)} queued`);
                setDescription("");
              }}
            >
              {startAutonomous.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-2" />
              ) : (
                <Play className="h-3 w-3 mr-2" />
              )}
              Queue job
            </Button>
            <p className="text-[10px] text-muted-foreground">
              Jobs run in the background with strict budgets (max 4 subtasks,
              30 writes, 10 minute wall clock). Cooperative-cancel is checked
              between steps.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" /> Active ({active.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {active.length === 0 ? (
            <p className="text-xs text-muted-foreground">No active jobs.</p>
          ) : (
            <div className="space-y-2">
              {active.map((job: any) => (
                <JobRow
                  key={job.id}
                  job={job}
                  expanded={expanded === job.id}
                  onToggle={() => setExpanded(expanded === job.id ? null : job.id)}
                  onCancel={() => cancel.mutate({ jobId: job.id })}
                  canCancel
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" /> History ({history.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground">No completed jobs.</p>
          ) : (
            <div className="space-y-2">
              {history.slice(0, 20).map((job: any) => (
                <JobRow
                  key={job.id}
                  job={job}
                  expanded={expanded === job.id}
                  onToggle={() => setExpanded(expanded === job.id ? null : job.id)}
                  canCancel={false}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function JobRow({
  job,
  expanded,
  onToggle,
  onCancel,
  canCancel,
}: {
  job: any;
  expanded: boolean;
  onToggle: () => void;
  onCancel?: () => void;
  canCancel: boolean;
}) {
  const icon =
    job.status === "running" ? (
      <Loader2 className="h-3 w-3 animate-spin text-accent" />
    ) : job.status === "queued" ? (
      <Clock className="h-3 w-3 text-muted-foreground" />
    ) : job.status === "succeeded" ? (
      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
    ) : job.status === "failed" ? (
      <AlertTriangle className="h-3 w-3 text-destructive" />
    ) : (
      <XCircle className="h-3 w-3 text-muted-foreground" />
    );

  const durationMs =
    (job.finishedAt ?? Date.now()) - (job.startedAt ?? job.createdAt);

  return (
    <div className="border border-border/40 rounded">
      <button
        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-secondary/20"
        onClick={onToggle}
      >
        {icon}
        <span className="flex-1 text-left truncate">{job.title}</span>
        <Badge variant="outline" className="text-[9px]">
          {job.kind.replace(/_/g, " ")}
        </Badge>
        <Badge
          variant="outline"
          className={`text-[9px] ${
            job.status === "succeeded"
              ? "border-emerald-500/50 text-emerald-500"
              : job.status === "failed"
                ? "border-destructive text-destructive"
                : ""
          }`}
        >
          {job.status}
        </Badge>
        <span className="tabular-nums text-muted-foreground/60 text-[9px]">
          {(durationMs / 1000).toFixed(1)}s
        </span>
      </button>
      {expanded && (
        <div className="border-t border-border/30 p-2 space-y-2 bg-background/40">
          {canCancel && onCancel && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px]"
              onClick={onCancel}
            >
              <Square className="h-3 w-3 mr-1" /> Cancel
            </Button>
          )}
          <div className="max-h-48 overflow-auto rounded bg-muted/30 p-2 space-y-1 font-mono text-[10px]">
            {(job.events ?? []).slice(-100).map((ev: any, i: number) => (
              <div
                key={i}
                className={
                  ev.level === "error"
                    ? "text-destructive"
                    : ev.level === "warn"
                      ? "text-amber-400"
                      : "text-muted-foreground"
                }
              >
                [{new Date(ev.at).toLocaleTimeString()}] {ev.message}
              </div>
            ))}
          </div>
          {job.error && (
            <p className="text-xs text-destructive font-mono">{job.error}</p>
          )}
          {job.result && (
            <details className="text-[10px] font-mono">
              <summary className="cursor-pointer">Result</summary>
              <pre className="overflow-auto max-h-40 bg-muted/30 p-1.5 rounded mt-1">
                {JSON.stringify(job.result, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
