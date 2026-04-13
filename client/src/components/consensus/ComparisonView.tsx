/**
 * ComparisonView — Round C3.
 *
 * Side-by-side panel for comparing the per-model responses with two
 * tabs:
 *   - Split: grid of 2-N columns, one per model
 *   - Unified: stacked with colored left borders, easier to scroll on
 *     mobile and for word-diff overlays
 *
 * The unified-tab "diff highlight" reuses the wordDiff helper from the
 * synthesizer module (Round A7) so adjacent model responses get a
 * red/green LCS overlay. When more than 2 models are present, we diff
 * each pair against the first model.
 */

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Streamdown } from "streamdown";
import { trpc } from "@/lib/trpc";

export interface ComparisonResponse {
  modelId: string;
  content: string;
  durationMs?: number;
  error?: string;
}

export interface ComparisonViewProps {
  /** Per-model responses (from `runConsensus.perModelResponses`) */
  responses: ComparisonResponse[];
  /** Optional unified synthesis text to show alongside the comparison */
  unifiedAnswer?: string;
  /** Optional model display-name resolver */
  getDisplayName?: (id: string) => string;
}

export function ComparisonView({
  responses,
  unifiedAnswer,
  getDisplayName,
}: ComparisonViewProps) {
  const validResponses = useMemo(
    () => responses.filter((r) => r.content && !r.error),
    [responses],
  );

  if (validResponses.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          No valid model responses to compare.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          Model Comparison
          <Badge variant="outline" className="text-[10px]">
            {validResponses.length} models
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="split">
          <TabsList className="mb-3">
            <TabsTrigger value="split">Split</TabsTrigger>
            <TabsTrigger value="unified">Unified</TabsTrigger>
            {unifiedAnswer && (
              <TabsTrigger value="synthesis">Synthesis</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="split">
            <SplitView
              responses={validResponses}
              getDisplayName={getDisplayName}
            />
          </TabsContent>

          <TabsContent value="unified">
            <UnifiedView
              responses={validResponses}
              getDisplayName={getDisplayName}
            />
          </TabsContent>

          {unifiedAnswer && (
            <TabsContent value="synthesis">
              <div className="rounded-md border bg-muted/30 p-3 text-sm prose prose-sm dark:prose-invert max-w-none">
                <Streamdown>{unifiedAnswer}</Streamdown>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function SplitView({
  responses,
  getDisplayName,
}: {
  responses: ComparisonResponse[];
  getDisplayName?: (id: string) => string;
}) {
  // 2 models = 2 columns; 3 = 3 columns; 4+ = 2 columns wrapping
  const cols =
    responses.length === 2
      ? "md:grid-cols-2"
      : responses.length === 3
        ? "md:grid-cols-3"
        : "md:grid-cols-2";
  return (
    <div className={`grid grid-cols-1 ${cols} gap-3`}>
      {responses.map((r) => (
        <div key={r.modelId} className="border rounded-md p-3 bg-muted/20">
          <div className="text-xs font-semibold mb-2 flex items-center justify-between">
            <span>{getDisplayName?.(r.modelId) ?? r.modelId}</span>
            {r.durationMs !== undefined && (
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {r.durationMs}ms
              </span>
            )}
          </div>
          <div className="text-xs prose prose-sm dark:prose-invert max-w-none max-h-96 overflow-auto">
            <Streamdown>{r.content}</Streamdown>
          </div>
        </div>
      ))}
    </div>
  );
}

function UnifiedView({
  responses,
  getDisplayName,
}: {
  responses: ComparisonResponse[];
  getDisplayName?: (id: string) => string;
}) {
  const colors = ["#16A34A", "#2563EB", "#7C3AED", "#DC2626", "#0891B2"];
  const baseline = responses[0];

  return (
    <div className="space-y-3">
      {responses.map((r, i) => (
        <div
          key={r.modelId}
          className="border-l-4 pl-3 py-2 rounded-r-md bg-muted/10"
          style={{ borderLeftColor: colors[i % colors.length] }}
        >
          <div className="text-xs font-semibold mb-1 flex items-center gap-2">
            <span>{getDisplayName?.(r.modelId) ?? r.modelId}</span>
            {r.durationMs !== undefined && (
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {r.durationMs}ms
              </span>
            )}
          </div>
          {i === 0 ? (
            <div className="text-xs prose prose-sm dark:prose-invert max-w-none">
              <Streamdown>{r.content}</Streamdown>
            </div>
          ) : (
            <DiffAgainstBaseline a={baseline.content} b={r.content} />
          )}
        </div>
      ))}
    </div>
  );
}

function DiffAgainstBaseline({ a, b }: { a: string; b: string }) {
  // Use the existing wealthEngine word-diff procedure (Round A7).
  // Stays read-only and runs cheaply on the server's pure module.
  const diff = trpc.codeChat.diffResponses.useQuery(
    { a, b },
    { staleTime: 60_000 },
  );

  if (diff.isLoading || !diff.data) {
    return (
      <div className="text-xs text-muted-foreground">Computing diff…</div>
    );
  }

  return (
    <div className="text-xs leading-relaxed">
      <div className="text-[10px] uppercase text-muted-foreground tracking-wide mb-1">
        similarity {(diff.data.stats.similarity * 100).toFixed(0)}%
      </div>
      <p>
        {diff.data.segments.map((seg, idx) => {
          const cls =
            seg.op === "equal"
              ? ""
              : seg.op === "insert"
                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-200 px-0.5 rounded"
                : "bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-200 px-0.5 rounded line-through";
          return (
            <span key={idx} className={cls}>
              {seg.text}{" "}
            </span>
          );
        })}
      </p>
    </div>
  );
}
