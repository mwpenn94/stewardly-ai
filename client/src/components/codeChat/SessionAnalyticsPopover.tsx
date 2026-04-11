/**
 * SessionAnalyticsPopover — cost + efficiency dashboard (Pass 243).
 *
 * Runs the pure reducers from `sessionAnalytics.ts` over the current
 * message log and presents a four-section dashboard:
 *
 *   1. Header totals — messages, turns, span, aggregate cost
 *   2. By-model breakdown — per-model cost + tokens + turns
 *   3. Top expensive turns — 5 most costly prompts with prompt preview
 *   4. Tool usage — counts + total duration + error count per tool
 *   5. Bytes read/write — ratio bar showing read vs write output
 */

import { X, BarChart3, Clock, Cpu, Wrench, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  analyzeSession,
  type SessionAnalytics,
} from "./sessionAnalytics";
import {
  formatTokens,
  formatCost,
} from "./tokenEstimator";
import type { CodeChatMessage } from "@/hooks/useCodeChatStream";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function StatRow({
  label,
  value,
  sublabel,
  className = "",
}: {
  label: string;
  value: React.ReactNode;
  sublabel?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 px-3 py-1.5 text-[11px] ${className}`}
    >
      <span className="text-muted-foreground">{label}</span>
      <div className="text-right">
        <div className="font-mono tabular-nums text-foreground">{value}</div>
        {sublabel && (
          <div className="text-[9px] text-muted-foreground/60">{sublabel}</div>
        )}
      </div>
    </div>
  );
}

interface SessionAnalyticsPopoverProps {
  open: boolean;
  onClose: () => void;
  messages: CodeChatMessage[];
  onJumpToMessage?: (id: string) => void;
}

export default function SessionAnalyticsPopover({
  open,
  onClose,
  messages,
  onJumpToMessage,
}: SessionAnalyticsPopoverProps) {
  if (!open) return null;
  const analytics: SessionAnalytics = analyzeSession(messages);
  const totalCost = analytics.byModel.reduce((acc, m) => acc + m.costUSD, 0);
  const totalTokens = analytics.byModel.reduce((acc, m) => acc + m.totalTokens, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Session analytics"
    >
      <div
        className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col rounded-xl border border-border/60 bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-accent" />
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Session analytics
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close analytics"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border/30">
          {/* Totals */}
          <section className="py-2">
            <StatRow label="Total messages" value={analytics.totalMessages} />
            <StatRow
              label="User turns · assistant turns"
              value={`${analytics.userTurns} · ${analytics.assistantTurns}`}
            />
            <StatRow
              label="Session span"
              value={
                analytics.duration.spanMs > 0
                  ? formatDuration(analytics.duration.spanMs)
                  : "—"
              }
              sublabel={
                analytics.duration.turns > 0
                  ? `${formatDuration(analytics.duration.totalMs)} model time`
                  : undefined
              }
            />
            <StatRow
              label="Aggregate tokens"
              value={formatTokens(totalTokens)}
            />
            <StatRow
              label="Aggregate cost"
              value={formatCost(totalCost)}
              className="text-accent"
            />
          </section>

          {/* By-model */}
          {analytics.byModel.length > 0 && (
            <section className="py-2">
              <div className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                <Cpu className="h-3 w-3" /> By model
              </div>
              {analytics.byModel.map((bucket) => (
                <div
                  key={bucket.model}
                  className="flex items-center justify-between gap-2 px-3 py-1.5 text-[11px]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-foreground truncate">{bucket.model}</span>
                    <Badge
                      variant="outline"
                      className="text-[9px] h-4 px-1.5 border-border/60 text-muted-foreground"
                    >
                      {bucket.turns} turn{bucket.turns === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  <div className="text-right font-mono tabular-nums shrink-0">
                    <div className="text-foreground">{formatCost(bucket.costUSD)}</div>
                    <div className="text-[9px] text-muted-foreground">
                      {formatTokens(bucket.totalTokens)} tok
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Top expensive turns */}
          {analytics.topTurns.length > 0 && (
            <section className="py-2">
              <div className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                <Clock className="h-3 w-3" /> Top expensive turns
              </div>
              {analytics.topTurns.map((turn, idx) => (
                <button
                  key={turn.messageId}
                  type="button"
                  className="w-full flex items-start justify-between gap-2 px-3 py-1.5 text-[11px] text-left hover:bg-secondary/20 transition-colors"
                  onClick={() => {
                    onJumpToMessage?.(turn.messageId);
                    onClose();
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground font-mono tabular-nums w-4">
                        #{idx + 1}
                      </span>
                      <span className="font-mono text-[9px] text-muted-foreground truncate">
                        {turn.model}
                      </span>
                    </div>
                    <div className="text-foreground truncate text-[10px] pl-5">
                      {turn.promptPreview || "(empty prompt)"}
                    </div>
                  </div>
                  <div className="text-right font-mono tabular-nums shrink-0 text-[10px]">
                    <div className="text-foreground">{formatCost(turn.usage.costUSD)}</div>
                    <div className="text-[9px] text-muted-foreground">
                      {formatTokens(turn.usage.totalTokens)}
                    </div>
                  </div>
                </button>
              ))}
            </section>
          )}

          {/* Tool usage */}
          {analytics.tools.length > 0 && (
            <section className="py-2">
              <div className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                <Wrench className="h-3 w-3" /> Tool usage
              </div>
              {analytics.tools.map((tool) => (
                <div
                  key={tool.toolName}
                  className="flex items-center justify-between gap-2 px-3 py-1.5 text-[11px]"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-foreground">{tool.toolName}</span>
                    <Badge
                      variant="outline"
                      className="text-[9px] h-4 px-1.5 border-border/60 text-muted-foreground"
                    >
                      {tool.count}×
                    </Badge>
                    {tool.errorCount > 0 && (
                      <Badge
                        variant="outline"
                        className="text-[9px] h-4 px-1.5 border-destructive/40 text-destructive"
                      >
                        {tool.errorCount} err
                      </Badge>
                    )}
                  </div>
                  <div className="text-right font-mono tabular-nums shrink-0">
                    <div className="text-foreground">
                      {formatDuration(tool.totalDurationMs)}
                    </div>
                    <div className="text-[9px] text-muted-foreground">
                      avg {formatDuration(tool.avgDurationMs)}
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Bytes I/O */}
          {(analytics.bytes.bytesRead > 0 || analytics.bytes.bytesWritten > 0) && (
            <section className="py-2">
              <div className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                <ArrowDownToLine className="h-3 w-3" /> Bytes read / written
              </div>
              <div className="px-3 py-1.5 text-[11px] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <ArrowDownToLine className="h-3 w-3 text-emerald-500" /> read
                  </span>
                  <span className="font-mono tabular-nums text-foreground">
                    {formatBytes(analytics.bytes.bytesRead)} · {analytics.bytes.filesRead} file
                    {analytics.bytes.filesRead === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <ArrowUpFromLine className="h-3 w-3 text-accent" /> written
                  </span>
                  <span className="font-mono tabular-nums text-foreground">
                    {formatBytes(analytics.bytes.bytesWritten)} · {analytics.bytes.filesWritten}{" "}
                    file{analytics.bytes.filesWritten === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-muted overflow-hidden flex">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${(1 - analytics.bytes.writeRatio) * 100}%` }}
                  />
                  <div
                    className="h-full bg-accent"
                    style={{ width: `${analytics.bytes.writeRatio * 100}%` }}
                  />
                </div>
                <div className="text-[9px] text-muted-foreground text-right">
                  {Math.round((1 - analytics.bytes.writeRatio) * 100)}% read · {Math.round(analytics.bytes.writeRatio * 100)}% write
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
