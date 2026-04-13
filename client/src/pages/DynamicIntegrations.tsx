/**
 * Dynamic Integrations — create and run user/AI-defined data pipelines
 * for any source (JSON, CSV, RSS, HTML, paste), even when the upstream
 * has no API docs. Three tabs:
 *   1. Draft — describe what you want, we probe + draft a blueprint with AI.
 *   2. Blueprints — list of everything you own: edit, run, archive.
 *   3. Runs — recent execution history with records written + warnings.
 */
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import AppShell from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SEOHead } from "@/components/SEOHead";
import {
  ArrowLeft,
  Sparkles,
  Globe,
  PlayCircle,
  PauseCircle,
  Archive,
  Eye,
  Loader2,
  Plus,
  Database,
  AlertTriangle,
  CheckCircle2,
  Plug,
  FileJson,
} from "lucide-react";

type SinkKind =
  | "ingested_records"
  | "learning_definitions"
  | "lead_captures"
  | "user_memories"
  | "proactive_insights"
  | "none";

const SINK_LABELS: Record<SinkKind, string> = {
  ingested_records: "Ingested records (general)",
  learning_definitions: "Learning — terminology",
  lead_captures: "Lead captures (preview)",
  user_memories: "User memories (preview)",
  proactive_insights: "Proactive insights (preview)",
  none: "None (dry-run only)",
};

export default function DynamicIntegrations() {
  const [tab, setTab] = useState<"draft" | "blueprints" | "runs">("draft");

  // ── Draft form state ───────────────────────────────────────────────
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [draftInlineSample, setDraftInlineSample] = useState("");
  const [draftPreferSink, setDraftPreferSink] = useState<SinkKind>("ingested_records");
  const [draftResult, setDraftResult] = useState<any | null>(null);

  // ── Probe-only state ───────────────────────────────────────────────
  const [probeUrl, setProbeUrl] = useState("");
  const [probeResult, setProbeResult] = useState<any | null>(null);

  const list = trpc.dynamicIntegrations.list.useQuery();
  const blueprints = useMemo(() => list.data ?? [], [list.data]);

  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string | null>(null);
  const selectedBlueprint = useMemo(
    () => blueprints.find((b: any) => b.id === selectedBlueprintId) ?? null,
    [blueprints, selectedBlueprintId],
  );

  const runsQuery = trpc.dynamicIntegrations.listRuns.useQuery(
    { id: selectedBlueprintId ?? "", limit: 20 },
    { enabled: !!selectedBlueprintId },
  );

  // ── Mutations ──────────────────────────────────────────────────────
  const draft = trpc.dynamicIntegrations.draftFromDescription.useMutation({
    onSuccess: (data) => {
      setDraftResult(data);
      toast.success(
        data.llmUsed ? "AI drafted a blueprint from your description" : "Drafted a starting blueprint",
      );
    },
    onError: (err) => toast.error(`Draft failed: ${err.message}`),
  });

  const probe = trpc.dynamicIntegrations.probeUrl.useMutation({
    onSuccess: (data) => {
      setProbeResult(data);
      toast.success(`Probed ${data.format} — ${data.recordCount} records`);
    },
    onError: (err) => toast.error(`Probe failed: ${err.message}`),
  });

  const create = trpc.dynamicIntegrations.create.useMutation({
    onSuccess: () => {
      toast.success("Blueprint saved");
      list.refetch();
      setDraftResult(null);
      setTab("blueprints");
    },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });

  const run = trpc.dynamicIntegrations.run.useMutation({
    onSuccess: (data) => {
      if (data.status === "success") {
        toast.success(`Run complete: ${data.recordsWritten} records written`);
      } else if (data.status === "partial") {
        toast.warning(`Run partial: ${data.recordsWritten} written, ${data.recordsErrored} errored`);
      } else {
        toast.error(`Run failed: ${data.error ?? "unknown"}`);
      }
      list.refetch();
      runsQuery.refetch();
    },
    onError: (err) => toast.error(`Run failed: ${err.message}`),
  });

  const archive = trpc.dynamicIntegrations.archive.useMutation({
    onSuccess: () => {
      toast.success("Blueprint archived");
      list.refetch();
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────
  function handleDraft() {
    if (!draftDescription.trim()) {
      toast.error("Describe what you're trying to ingest first");
      return;
    }
    draft.mutate({
      name: draftName || undefined,
      description: draftDescription,
      url: draftUrl || undefined,
      inlineSample: draftInlineSample || undefined,
      preferSink: draftPreferSink,
    });
  }

  function handleSaveDraft() {
    if (!draftResult?.draft) return;
    create.mutate({
      ...draftResult.draft,
      aiDrafted: !!draftResult.llmUsed,
    });
  }

  function handleRun(id: string, dryRun: boolean) {
    run.mutate({ id, dryRun });
  }

  function handleProbe() {
    if (!probeUrl) return;
    probe.mutate({ url: probeUrl });
  }

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <AppShell title="Dynamic Integrations">
      <SEOHead title="Dynamic Integrations" description="Create and manage data integration blueprints" />
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild aria-label="Back to integrations">
            <Link to="/integrations">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-heading text-foreground flex items-center gap-2">
              <Plug className="h-6 w-6 text-accent" /> Dynamic Integrations
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Wire up any data source — with or without docs. Describe it, let AI draft a blueprint,
              then run it into any sink.
            </p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "draft" | "blueprints" | "runs")}>
          <TabsList>
            <TabsTrigger value="draft">
              <Sparkles className="h-4 w-4 mr-1" /> Draft
            </TabsTrigger>
            <TabsTrigger value="blueprints">
              <Database className="h-4 w-4 mr-1" /> Blueprints
              {blueprints.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {blueprints.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="runs">
              <PlayCircle className="h-4 w-4 mr-1" /> Runs
            </TabsTrigger>
          </TabsList>

          {/* ── DRAFT TAB ──────────────────────────────────────────── */}
          <TabsContent value="draft" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-accent" /> Describe what you want to ingest
                </CardTitle>
                <CardDescription>
                  Give a plain-English description plus a URL or pasted sample. We'll probe the
                  source, infer its schema, and draft transforms automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="di-name">Name (optional)</Label>
                  <Input
                    id="di-name"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder="e.g. SEC EDGAR daily filings"
                  />
                </div>
                <div>
                  <Label htmlFor="di-desc">Description *</Label>
                  <Textarea
                    id="di-desc"
                    value={draftDescription}
                    onChange={(e) => setDraftDescription(e.target.value)}
                    placeholder="I want to pull every newly published article from this RSS feed and land the headlines + URLs as news entities…"
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="di-url">Source URL (optional)</Label>
                  <Input
                    id="di-url"
                    value={draftUrl}
                    onChange={(e) => setDraftUrl(e.target.value)}
                    placeholder="https://example.com/feed.xml"
                  />
                </div>
                <div>
                  <Label htmlFor="di-sample">Or paste an inline sample (optional)</Label>
                  <Textarea
                    id="di-sample"
                    value={draftInlineSample}
                    onChange={(e) => setDraftInlineSample(e.target.value)}
                    placeholder='{"data":[{"id":1,"title":"Hello"}]}'
                    rows={5}
                  />
                </div>
                <div>
                  <Label htmlFor="di-sink">Preferred sink</Label>
                  <Select value={draftPreferSink} onValueChange={(v) => setDraftPreferSink(v as SinkKind)}>
                    <SelectTrigger id="di-sink">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(SINK_LABELS) as SinkKind[]).map((k) => (
                        <SelectItem key={k} value={k}>
                          {SINK_LABELS[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleDraft}
                  disabled={draft.isPending || !draftDescription.trim()}
                  className="w-full md:w-auto"
                >
                  {draft.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Drafting…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" /> Draft with AI
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {draftResult && (
              <Card className="border-accent/50">
                <CardHeader>
                  <CardTitle className="text-lg">Draft preview</CardTitle>
                  <CardDescription>
                    Format: <Badge variant="outline">{draftResult.detectedFormat ?? "unknown"}</Badge>{" "}
                    {draftResult.llmUsed && (
                      <Badge variant="secondary" className="ml-2">
                        <Sparkles className="h-3 w-3 mr-1" /> AI-drafted
                      </Badge>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="font-medium text-sm">Name</div>
                    <div className="text-sm text-muted-foreground">{draftResult.draft?.name ?? "—"}</div>
                  </div>
                  {draftResult.schemaPreview && (
                    <div>
                      <div className="font-medium text-sm mb-1">Inferred fields</div>
                      <div className="border rounded-md p-2 bg-muted/30 max-h-56 overflow-auto text-xs space-y-1">
                        {draftResult.schemaPreview.fields.slice(0, 20).map((f: any) => (
                          <div key={f.path} className="flex items-center gap-2">
                            <span className="font-mono">{f.path}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {f.type}
                            </Badge>
                            {f.nullable && (
                              <span className="text-muted-foreground text-[10px]">nullable</span>
                            )}
                            {f.unique && <span className="text-accent text-[10px]">unique</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {Array.isArray(draftResult.draft?.transformSteps) &&
                    draftResult.draft.transformSteps.length > 0 && (
                      <div>
                        <div className="font-medium text-sm mb-1">Transform steps</div>
                        <div className="border rounded-md p-2 bg-muted/30 max-h-40 overflow-auto text-xs font-mono whitespace-pre-wrap break-words max-w-full">
                          {JSON.stringify(draftResult.draft.transformSteps, null, 2)}
                        </div>
                      </div>
                    )}
                  {draftResult.notes?.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {draftResult.notes.map((n: string, i: number) => (
                        <div key={i}>• {n}</div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button onClick={handleSaveDraft} disabled={create.isPending}>
                      {create.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Save blueprint
                    </Button>
                    <Button variant="outline" onClick={() => setDraftResult(null)}>
                      Discard
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Globe className="h-5 w-5" /> Just probe a URL
                </CardTitle>
                <CardDescription>
                  Quick one-off probe to see the shape of a source before committing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={probeUrl}
                    onChange={(e) => setProbeUrl(e.target.value)}
                    placeholder="https://api.example.com/endpoint.json"
                    aria-label="Probe URL"
                  />
                  <Button onClick={handleProbe} disabled={probe.isPending || !probeUrl}>
                    {probe.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Probe"}
                  </Button>
                </div>
                {probeResult && (
                  <div className="text-xs space-y-1 border rounded-md p-2 bg-muted/30">
                    <div>
                      Status: {probeResult.status} — {probeResult.format}{" "}
                      <Badge variant="outline">{probeResult.recordCount} records</Badge>
                    </div>
                    {probeResult.schemaPreview?.fields?.slice(0, 8).map((f: any) => (
                      <div key={f.path} className="flex items-center gap-2">
                        <span className="font-mono">{f.path}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {f.type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── BLUEPRINTS TAB ────────────────────────────────────── */}
          <TabsContent value="blueprints" className="space-y-4">
            {list.isLoading && (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading blueprints…
              </div>
            )}
            {!list.isLoading && blueprints.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="py-10 text-center text-muted-foreground">
                  <FileJson className="h-10 w-10 mx-auto mb-3 text-accent" />
                  <div className="font-medium">No blueprints yet</div>
                  <div className="text-sm mt-1">
                    Head to the <strong>Draft</strong> tab to build your first one.
                  </div>
                </CardContent>
              </Card>
            )}
            <div className="grid md:grid-cols-2 gap-3">
              {blueprints.map((bp: any) => (
                <Card
                  key={bp.id}
                  className={`card-lift cursor-pointer ${
                    selectedBlueprintId === bp.id ? "ring-2 ring-accent" : ""
                  }`}
                  onClick={() => setSelectedBlueprintId(bp.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base truncate">{bp.name}</CardTitle>
                        <CardDescription className="text-xs truncate mt-1">
                          {bp.description || bp.sourceConfig?.url || "—"}
                        </CardDescription>
                      </div>
                      <Badge
                        variant={
                          bp.status === "active"
                            ? "default"
                            : bp.status === "draft"
                              ? "outline"
                              : bp.status === "error"
                                ? "destructive"
                                : "secondary"
                        }
                      >
                        {bp.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">{bp.sourceKind}</Badge>
                      <Badge variant="outline">→ {bp.sinkConfig?.kind ?? "none"}</Badge>
                      {bp.aiDrafted && (
                        <Badge variant="secondary" className="text-[10px]">
                          <Sparkles className="h-3 w-3 mr-1" /> AI
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      v{bp.currentVersion} · {bp.totalRuns ?? 0} runs ·{" "}
                      {bp.totalRecordsIngested ?? 0} records ingested
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRun(bp.id, true);
                        }}
                        disabled={run.isPending}
                        aria-label="Dry-run blueprint"
                      >
                        <Eye className="h-3 w-3 mr-1" /> Dry-run
                      </Button>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRun(bp.id, false);
                        }}
                        disabled={run.isPending}
                        aria-label="Run blueprint"
                      >
                        <PlayCircle className="h-3 w-3 mr-1" /> Run
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Archive "${bp.name}"?`)) archive.mutate({ id: bp.id });
                        }}
                        aria-label="Archive blueprint"
                      >
                        <Archive className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {selectedBlueprint && (
              <Card className="border-accent/50">
                <CardHeader>
                  <CardTitle className="text-lg">{selectedBlueprint.name}</CardTitle>
                  <CardDescription>{selectedBlueprint.description || "—"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div>
                    <strong>Source:</strong> {JSON.stringify(selectedBlueprint.sourceConfig)}
                  </div>
                  <div>
                    <strong>Sink:</strong> {JSON.stringify(selectedBlueprint.sinkConfig)}
                  </div>
                  <div>
                    <strong>Transform steps ({selectedBlueprint.transformSteps?.length ?? 0}):</strong>
                  </div>
                  <pre className="text-[10px] bg-muted/30 p-2 rounded border max-h-52 overflow-auto overflow-x-auto max-w-full break-words whitespace-pre-wrap">
                    {JSON.stringify(selectedBlueprint.transformSteps ?? [], null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── RUNS TAB ──────────────────────────────────────────── */}
          <TabsContent value="runs" className="space-y-3">
            {!selectedBlueprintId && (
              <Card>
                <CardContent className="py-8 text-sm text-muted-foreground text-center">
                  Pick a blueprint from the <strong>Blueprints</strong> tab to see its runs.
                </CardContent>
              </Card>
            )}
            {selectedBlueprintId && runsQuery.data?.length === 0 && (
              <Card>
                <CardContent className="py-8 text-sm text-muted-foreground text-center">
                  No runs yet for this blueprint. Click Run to start the first one.
                </CardContent>
              </Card>
            )}
            {runsQuery.data?.map((r: any) => (
              <Card key={r.id}>
                <CardContent className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {r.status === "success" ? (
                      <CheckCircle2 className="h-5 w-5 text-chart-2 flex-shrink-0" />
                    ) : r.status === "partial" ? (
                      <AlertTriangle className="h-5 w-5 text-chart-3 flex-shrink-0" />
                    ) : r.status === "running" ? (
                      <Loader2 className="h-5 w-5 animate-spin flex-shrink-0" />
                    ) : (
                      <PauseCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        {r.status} · {r.recordsWritten ?? 0} written · {r.recordsErrored ?? 0} errors
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {new Date(r.startedAt).toLocaleString()} · {r.durationMs ?? 0} ms ·{" "}
                        {r.dryRun ? "dry-run" : "live"}
                      </div>
                      {r.errorLog && (
                        <div className="text-xs text-destructive truncate mt-1">{r.errorLog}</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
