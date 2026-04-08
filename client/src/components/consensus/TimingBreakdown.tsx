/**
 * TimingBreakdown — Round C3.
 *
 * Bar chart of per-model latencies + the synthesis bar at the end.
 * Color codes the fastest model green and the slowest red. Pure SVG
 * so it works in PDF export and the existing wealth-engine token
 * scheme stays consistent.
 */

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface TimingEntry {
  modelId: string;
  durationMs: number;
}

export interface TimingBreakdownProps {
  /** Per-model durations from the consensus run */
  perModel: TimingEntry[];
  /** Synthesis merge call duration */
  synthesisMs?: number;
  /** Total wall-clock for the whole run (may be > sum because of overlap) */
  totalMs?: number;
  /** Optional model display-name resolver */
  getDisplayName?: (id: string) => string;
}

const FAST_COLOR = "#16A34A"; // emerald
const SLOW_COLOR = "#DC2626"; // red
const SYNTHESIS_COLOR = "#7C3AED"; // violet
const NEUTRAL_COLOR = "#64748B"; // slate

export function TimingBreakdown({
  perModel,
  synthesisMs,
  totalMs,
  getDisplayName,
}: TimingBreakdownProps) {
  const { rows, scaleMax, fastestId, slowestId, average, spread } =
    useMemo(() => {
      const allDurations = [
        ...perModel.map((p) => p.durationMs),
        ...(synthesisMs !== undefined ? [synthesisMs] : []),
      ];
      const max = Math.max(1, ...allDurations);
      const fastest = perModel.reduce(
        (best, cur) => (best && best.durationMs <= cur.durationMs ? best : cur),
        perModel[0],
      );
      const slowest = perModel.reduce(
        (worst, cur) => (worst && worst.durationMs >= cur.durationMs ? worst : cur),
        perModel[0],
      );
      const sum = perModel.reduce((s, p) => s + p.durationMs, 0);
      const avg = perModel.length > 0 ? sum / perModel.length : 0;
      const spreadMs = perModel.length > 0
        ? slowest.durationMs - fastest.durationMs
        : 0;
      const built: Array<{
        label: string;
        durationMs: number;
        color: string;
      }> = perModel.map((p) => {
        let color: string = NEUTRAL_COLOR;
        if (perModel.length >= 2) {
          if (p.modelId === fastest?.modelId) color = FAST_COLOR;
          else if (p.modelId === slowest?.modelId) color = SLOW_COLOR;
        }
        return {
          label: getDisplayName?.(p.modelId) ?? p.modelId,
          durationMs: p.durationMs,
          color,
        };
      });
      if (synthesisMs !== undefined) {
        built.push({
          label: "Synthesis",
          durationMs: synthesisMs,
          color: SYNTHESIS_COLOR,
        });
      }
      return {
        rows: built,
        scaleMax: max,
        fastestId: fastest?.modelId ?? null,
        slowestId: slowest?.modelId ?? null,
        average: avg,
        spread: spreadMs,
      };
    }, [perModel, synthesisMs, getDisplayName]);

  const labelWidth = 140;
  const trackWidth = 280;
  const rowHeight = 22;
  const totalHeight = rows.length * rowHeight + 12;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Timing Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <svg
          viewBox={`0 0 ${labelWidth + trackWidth + 80} ${totalHeight}`}
          width="100%"
          role="img"
          aria-label="Timing breakdown chart"
        >
          {rows.map((row, i) => {
            const w = Math.max(2, (row.durationMs / scaleMax) * trackWidth);
            const y = i * rowHeight + 8;
            return (
              <g key={`${row.label}-${i}`}>
                <text
                  x={labelWidth - 8}
                  y={y + 11}
                  fontSize={11}
                  textAnchor="end"
                  fill="#475569"
                >
                  {row.label}
                </text>
                <rect
                  x={labelWidth}
                  y={y}
                  width={trackWidth}
                  height={rowHeight - 6}
                  fill="#e2e8f0"
                  rx={3}
                />
                <rect
                  x={labelWidth}
                  y={y}
                  width={w}
                  height={rowHeight - 6}
                  fill={row.color}
                  rx={3}
                />
                <text
                  x={labelWidth + w + 6}
                  y={y + 11}
                  fontSize={10}
                  fill="#475569"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {row.durationMs}ms
                </text>
              </g>
            );
          })}
        </svg>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-muted-foreground">
          <Stat label="Average" value={`${Math.round(average)}ms`} />
          <Stat label="Spread" value={`${Math.round(spread)}ms`} />
          {synthesisMs !== undefined && (
            <Stat label="Synthesis" value={`${synthesisMs}ms`} />
          )}
          {totalMs !== undefined && (
            <Stat label="Total wall clock" value={`${totalMs}ms`} />
          )}
        </div>

        {fastestId && slowestId && fastestId !== slowestId && (
          <div className="text-[11px] text-muted-foreground">
            <span style={{ color: FAST_COLOR }}>●</span>{" "}
            fastest <span className="font-medium">{getDisplayName?.(fastestId) ?? fastestId}</span>{" "}
            ·{" "}
            <span style={{ color: SLOW_COLOR }}>●</span>{" "}
            slowest <span className="font-medium">{getDisplayName?.(slowestId) ?? slowestId}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="uppercase tracking-wide text-[10px]">{label}</span>
      <span className="font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}
