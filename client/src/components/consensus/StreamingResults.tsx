/**
 * StreamingResults — Round C3.
 *
 * Per-model card stack that shows the live state of a multi-model
 * consensus run. Each model gets a card with:
 *   - status: pending / running / complete / error
 *   - response time (ms)
 *   - token count
 *   - expand-to-view truncated content
 *   - copy button
 *
 * Driven by the `events` array returned by `wealthEngine.consensusStream`
 * (we don't yet have an SSE endpoint — when one lands, this same
 * component will consume the live stream identically because the
 * event shape is shared).
 */

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Hash,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";

export type StreamEvent =
  | { type: "model_start"; modelId: string; ts: number }
  | {
      type: "model_complete";
      modelId: string;
      ts: number;
      durationMs: number;
      content: string;
      tokenCount: number;
    }
  | { type: "model_error"; modelId: string; ts: number; error: string }
  | { type: "synthesis_start"; ts: number; modelsCompleted: number }
  | {
      type: "synthesis_complete";
      ts: number;
      durationMs: number;
      content: string;
      agreementScore: number;
      keyAgreements: string[];
      notableDifferences: string[];
    }
  | {
      type: "done";
      ts: number;
      totalDurationMs: number;
      modelQueryTimeMs: number;
      synthesisTimeMs: number;
      modelsUsed: string[];
    }
  | { type: "error"; ts: number; error: string };

interface ModelCardState {
  modelId: string;
  status: "pending" | "running" | "complete" | "error";
  durationMs?: number;
  content?: string;
  tokenCount?: number;
  error?: string;
}

export interface StreamingResultsProps {
  /** Models the run was started with — used to seed the card grid */
  modelsRequested: string[];
  /** Event log (full or partial) */
  events: StreamEvent[];
  /** Optional model display-name resolver */
  getDisplayName?: (id: string) => string;
}

export function StreamingResults({
  modelsRequested,
  events,
  getDisplayName,
}: StreamingResultsProps) {
  const cards = useMemo<ModelCardState[]>(() => {
    const map = new Map<string, ModelCardState>();
    for (const id of modelsRequested) {
      map.set(id, { modelId: id, status: "pending" });
    }
    for (const e of events) {
      if (e.type === "model_start") {
        map.set(e.modelId, { modelId: e.modelId, status: "running" });
      } else if (e.type === "model_complete") {
        map.set(e.modelId, {
          modelId: e.modelId,
          status: "complete",
          durationMs: e.durationMs,
          content: e.content,
          tokenCount: e.tokenCount,
        });
      } else if (e.type === "model_error") {
        map.set(e.modelId, {
          modelId: e.modelId,
          status: "error",
          error: e.error,
        });
      }
    }
    return Array.from(map.values());
  }, [modelsRequested, events]);

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {cards.map((card) => (
        <ModelCard
          key={card.modelId}
          state={card}
          displayName={getDisplayName?.(card.modelId) ?? card.modelId}
        />
      ))}
    </div>
  );
}

function ModelCard({
  state,
  displayName,
}: {
  state: ModelCardState;
  displayName: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!state.content) return;
    try {
      await navigator.clipboard.writeText(state.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <Card>
      <CardContent className="pt-4 pb-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <StatusIcon status={state.status} />
            <span className="font-medium text-sm truncate" title={displayName}>
              {displayName}
            </span>
          </div>
          {state.status === "complete" && state.content && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={copy}
              aria-label="Copy response"
            >
              {copied ? (
                <Check className="h-3 w-3 text-emerald-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground tabular-nums">
          {state.durationMs !== undefined && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {state.durationMs}ms
            </span>
          )}
          {state.tokenCount !== undefined && (
            <span className="flex items-center gap-1">
              <Hash className="h-3 w-3" />
              {state.tokenCount} tok
            </span>
          )}
          {state.status === "pending" && <span>queued</span>}
          {state.status === "running" && <span>thinking…</span>}
        </div>

        {state.status === "error" && (
          <p className="text-xs text-red-600 break-words">{state.error}</p>
        )}

        {state.status === "complete" && state.content && (
          <>
            <button
              type="button"
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              {expanded ? "Hide response" : "View response"}
            </button>
            {expanded && (
              <pre className="text-xs whitespace-pre-wrap break-words bg-muted/40 p-2 rounded-md max-h-72 overflow-auto">
                {state.content}
              </pre>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StatusIcon({ status }: { status: ModelCardState["status"] }) {
  switch (status) {
    case "pending":
      return <Badge variant="outline" className="text-[10px] h-4">queued</Badge>;
    case "running":
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />;
    case "complete":
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
    case "error":
      return <AlertTriangle className="h-3.5 w-3.5 text-red-500" />;
  }
}
