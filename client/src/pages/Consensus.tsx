/**
 * Consensus — Round C3.
 *
 * Demo + production page for the multi-model consensus stream. The
 * page is a thin wrapper around the Round C3 trio (StreamingResults +
 * TimingBreakdown + ComparisonView) that lets users run a real
 * `wealthEngine.consensusStream` mutation and see the result rendered
 * with the new UI.
 *
 * This is intentionally a standalone page rather than a refactor of
 * Chat.tsx — Chat.tsx is 2500 lines and the consensus mode there is
 * deeply wired into the conversation persistence path. We expose the
 * new components on /consensus first, then a follow-up round will
 * lift them into Chat.tsx behind the existing `chatMode === "consensus"`
 * branch.
 */

import { useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { StreamingResults, type StreamEvent } from "@/components/consensus/StreamingResults";
import { TimingBreakdown } from "@/components/consensus/TimingBreakdown";
import { ComparisonView } from "@/components/consensus/ComparisonView";
import { Loader2, Play, Sparkles } from "lucide-react";
import { Streamdown } from "streamdown";

const DEFAULT_MODELS = [
  { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
];

export default function ConsensusPage() {
  const [question, setQuestion] = useState(
    "Compare a Roth IRA conversion strategy versus traditional contributions for a 45-year-old in the 24% federal bracket with $200K of pre-tax retirement assets.",
  );
  const [domain, setDomain] = useState("retirement planning");
  const [timeBudgetSec, setTimeBudgetSec] = useState(20);
  const [maxModels, setMaxModels] = useState(3);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>(
    DEFAULT_MODELS.map((m) => m.id),
  );
  const [selectedPresetId, setSelectedPresetId] = useState<number | "none">("none");

  const consensusStream = trpc.wealthEngine.consensusStream.useMutation();
  const presets = trpc.wealthEngine.listWeightPresets.useQuery();

  const onRun = async () => {
    if (!question.trim()) return;
    consensusStream.mutate({
      question,
      domain: domain.trim() || undefined,
      selectedModels: selectedModelIds,
      timeBudgetMs: timeBudgetSec * 1000,
      maxModels,
      presetId:
        selectedPresetId === "none" || typeof selectedPresetId !== "number"
          ? undefined
          : selectedPresetId,
    });
  };

  const result = consensusStream.data;
  const events = (result?.events ?? []) as StreamEvent[];
  const perModelTimings = (result?.perModelResponses ?? [])
    .filter((r) => !r.error)
    .map((r) => ({ modelId: r.modelId, durationMs: r.durationMs }));

  const displayName = useMemo(() => {
    const map = new Map(DEFAULT_MODELS.map((m) => [m.id, m.label]));
    return (id: string) => map.get(id) ?? id;
  }, []);

  const toggleModel = (id: string) => {
    setSelectedModelIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  };

  return (
    <AppShell title="Consensus">
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-violet-500" />
            Multi-Model Consensus
          </h1>
          <p className="text-sm text-muted-foreground">
            Query multiple AI models in parallel, see per-model
            timing + token counts, and review a synthesized unified
            answer with key agreements + notable differences.
          </p>
        </header>

        {/* Inputs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Question</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={4}
              placeholder="Ask any question for the consensus to answer..."
            />

            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Domain (optional)</Label>
                <Input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="e.g. retirement planning"
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Time budget: {timeBudgetSec}s
                </Label>
                <Slider
                  min={5}
                  max={60}
                  step={1}
                  value={[timeBudgetSec]}
                  onValueChange={(v) => setTimeBudgetSec(v[0])}
                />
              </div>
              <div className="space-y-2">
                <Label>Max models: {maxModels}</Label>
                <Slider
                  min={1}
                  max={5}
                  step={1}
                  value={[maxModels]}
                  onValueChange={(v) => setMaxModels(v[0])}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Models</Label>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_MODELS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleModel(m.id)}
                    className={`px-3 py-1 text-xs rounded-full border ${
                      selectedModelIds.includes(m.id)
                        ? "bg-violet-100 dark:bg-violet-900/30 border-violet-400 text-violet-900 dark:text-violet-200"
                        : "bg-muted border-muted-foreground/30"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Round C4 — preset picker */}
            {presets.data && presets.data.presets.length > 0 && (
              <div className="space-y-2">
                <Label>Weight preset</Label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPresetId("none")}
                    className={`px-3 py-1 text-xs rounded-full border ${
                      selectedPresetId === "none"
                        ? "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-400 text-emerald-900 dark:text-emerald-200"
                        : "bg-muted border-muted-foreground/30"
                    }`}
                  >
                    No preset
                  </button>
                  {presets.data.presets.map((p) => (
                    <button
                      key={`${p.id ?? p.name}`}
                      type="button"
                      title={p.description}
                      onClick={() => setSelectedPresetId(p.id ?? "none")}
                      className={`px-3 py-1 text-xs rounded-full border ${
                        selectedPresetId === p.id
                          ? "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-400 text-emerald-900 dark:text-emerald-200"
                          : "bg-muted border-muted-foreground/30"
                      }`}
                    >
                      {p.name}
                      {p.isBuiltIn && (
                        <span className="ml-1 text-[9px] uppercase opacity-70">built-in</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={onRun}
                disabled={
                  consensusStream.isPending ||
                  !question.trim() ||
                  selectedModelIds.length === 0
                }
                size="lg"
              >
                {consensusStream.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Run Consensus
              </Button>
            </div>

            {consensusStream.isError && (
              <p className="text-sm text-red-600">
                {consensusStream.error?.message || "Consensus failed"}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {(consensusStream.isPending || result) && (
          <>
            <StreamingResults
              modelsRequested={selectedModelIds}
              events={events}
              getDisplayName={displayName}
            />

            {result && perModelTimings.length > 0 && (
              <TimingBreakdown
                perModel={perModelTimings}
                synthesisMs={result.synthesisTimeMs}
                totalMs={result.totalDurationMs}
                getDisplayName={displayName}
              />
            )}

            {result && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    Synthesis
                    <Badge variant="outline" className="text-[10px]">
                      agreement {(result.agreementScore * 100).toFixed(0)}%
                    </Badge>
                    {result.confidenceScore > 0 && (
                      <Badge variant="outline" className="text-[10px]">
                        confidence {(result.confidenceScore * 100).toFixed(0)}%
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <Streamdown>{result.unifiedAnswer || result.synthesisContent}</Streamdown>
                  </div>

                  {result.keyAgreements.length > 0 && (
                    <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 mb-2">
                        Key Agreements
                      </div>
                      <ul className="text-sm space-y-1 list-disc list-inside">
                        {result.keyAgreements.map((agreement, i) => (
                          <li key={i}>{agreement}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.notableDifferences.length > 0 && (
                    <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300 mb-2">
                        Notable Differences
                      </div>
                      <ul className="text-sm space-y-1 list-disc list-inside">
                        {result.notableDifferences.map((diff, i) => (
                          <li key={i}>{diff}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground">
                    {result.rationale}
                  </div>
                </CardContent>
              </Card>
            )}

            {result && result.perModelResponses.length > 0 && (
              <ComparisonView
                responses={result.perModelResponses}
                unifiedAnswer={result.unifiedAnswer}
                getDisplayName={displayName}
              />
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
