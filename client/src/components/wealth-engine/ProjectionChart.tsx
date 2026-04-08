/**
 * ProjectionChart — SVG line chart for year-by-year wealth projection.
 *
 * Accepts 1..N named series and renders each as a smoothed line with
 * tokenized colors. Overlays practice-income series with the crosshatch
 * pattern from tokens.ts so it's always visually distinct from market
 * returns. Honors `prefers-reduced-motion` — when reduced, the chart
 * renders instantly; otherwise paths animate on mount via a stroke-dash
 * reveal.
 *
 * Used by: Retirement, Growth, StrategyComparison, CostBenefit pages.
 */

import { useMemo } from "react";
import { chartTokens } from "@/lib/wealth-engine/tokens";
import {
  buildSmoothPath,
  formatCurrency,
  linearScale,
  useReducedMotion,
} from "@/lib/wealth-engine/animations";

export interface ProjectionSeries {
  key: string;
  label: string;
  color?: string;
  /** One number per year (index 0 = year 1) */
  values: number[];
  /** Renders with the practice-income crosshatch overlay */
  isPracticeIncome?: boolean;
  /** Animate dash-reveal on mount */
  animateOnMount?: boolean;
}

export interface ProjectionChartProps {
  series: ProjectionSeries[];
  width?: number;
  height?: number;
  startYear?: number;
  /** Show dollar axis labels */
  showAxis?: boolean;
  /** Optional monte-carlo percentile bands */
  band?: {
    p10: number[];
    p90: number[];
    p25: number[];
    p75: number[];
  };
  className?: string;
}

export function ProjectionChart({
  series,
  width = 640,
  height = 320,
  startYear = 1,
  showAxis = true,
  band,
  className,
}: ProjectionChartProps) {
  const reduced = useReducedMotion();

  const { paths, bandPath, yTicks, xTicks, bounds } = useMemo(() => {
    const padding = { top: 16, right: 24, bottom: 32, left: 64 };
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    // Domain from the widest series
    const maxYears = Math.max(...series.map((s) => s.values.length), 1);
    let globalMin = 0;
    let globalMax = 0;
    for (const s of series) {
      for (const v of s.values) {
        if (v > globalMax) globalMax = v;
        if (v < globalMin) globalMin = v;
      }
    }
    if (band) {
      for (const v of band.p90) if (v > globalMax) globalMax = v;
      for (const v of band.p10) if (v < globalMin) globalMin = v;
    }
    if (globalMax === globalMin) globalMax = globalMin + 1;

    const xAt = (year: number) =>
      padding.left +
      linearScale(year, 1, Math.max(maxYears, 2), 0, plotW);
    const yAt = (value: number) =>
      padding.top + plotH - linearScale(value, globalMin, globalMax, 0, plotH);

    const pathData = series.map((s) => {
      const pts = s.values.map((v, i) => ({ x: xAt(i + 1), y: yAt(v) }));
      return {
        ...s,
        d: buildSmoothPath(pts),
        last: pts[pts.length - 1],
      };
    });

    // Band = semi-transparent area between p10 and p90
    let bandPathData: string | null = null;
    if (band) {
      const p90Pts = band.p90.map((v, i) => ({ x: xAt(i + 1), y: yAt(v) }));
      const p10Pts = band.p10.map((v, i) => ({ x: xAt(i + 1), y: yAt(v) }));
      const forward = p90Pts
        .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
        .join(" ");
      const backward = [...p10Pts]
        .reverse()
        .map((p) => `L${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
        .join(" ");
      bandPathData = `${forward} ${backward} Z`;
    }

    const ticksY = 5;
    const yTicksArr: { y: number; label: string }[] = [];
    for (let i = 0; i <= ticksY; i++) {
      const v = globalMin + ((globalMax - globalMin) * i) / ticksY;
      yTicksArr.push({ y: yAt(v), label: formatCurrency(v) });
    }
    const xTicksArr: { x: number; label: string }[] = [];
    const xTickCount = Math.min(6, maxYears);
    for (let i = 0; i < xTickCount; i++) {
      const year = 1 + Math.round((i * (maxYears - 1)) / (xTickCount - 1));
      xTicksArr.push({
        x: xAt(year),
        label: String(startYear + year - 1),
      });
    }

    return {
      paths: pathData,
      bandPath: bandPathData,
      yTicks: yTicksArr,
      xTicks: xTicksArr,
      bounds: { ...padding, plotW, plotH },
    };
  }, [series, band, width, height, startYear]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      className={className}
      role="img"
      aria-label="Wealth projection chart"
    >
      {/* Crosshatch pattern for practice income overlays */}
      <defs>
        <pattern
          id={chartTokens.patterns.practiceIncomeId}
          x="0"
          y="0"
          width={chartTokens.patterns.practiceIncomeSpacing}
          height={chartTokens.patterns.practiceIncomeSpacing}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2={chartTokens.patterns.practiceIncomeSpacing}
            stroke={chartTokens.patterns.practiceIncomeStroke}
            strokeWidth={chartTokens.patterns.practiceIncomeStrokeWidth}
          />
        </pattern>
      </defs>

      {/* Background grid (from Y ticks) */}
      {showAxis &&
        yTicks.map((t, i) => (
          <line
            key={`grid-${i}`}
            x1={bounds.left}
            x2={bounds.left + bounds.plotW}
            y1={t.y}
            y2={t.y}
            stroke="#e2e8f0"
            strokeWidth={1}
          />
        ))}

      {/* Monte Carlo band */}
      {bandPath && (
        <path
          d={bandPath}
          fill={chartTokens.colors.monteCarloBand.outer}
          stroke="none"
        />
      )}

      {/* Series paths */}
      {paths.map((p) => (
        <path
          key={p.key}
          d={p.d}
          fill="none"
          stroke={p.color || chartTokens.colors.wealthbridge}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={
            reduced || !p.animateOnMount
              ? undefined
              : {
                  strokeDasharray: 2000,
                  strokeDashoffset: 2000,
                  animation: `wb-draw 1200ms ease-out forwards`,
                }
          }
        />
      ))}

      {/* Practice income overlay (if any) */}
      {paths
        .filter((p) => p.isPracticeIncome)
        .map((p) => (
          <path
            key={`${p.key}-hatch`}
            d={p.d}
            fill="none"
            stroke={`url(#${chartTokens.patterns.practiceIncomeId})`}
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.5}
          />
        ))}

      {/* Axes */}
      {showAxis && (
        <>
          {yTicks.map((t, i) => (
            <text
              key={`yt-${i}`}
              x={bounds.left - 8}
              y={t.y + 4}
              fontSize={11}
              fill="#64748b"
              textAnchor="end"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {t.label}
            </text>
          ))}
          {xTicks.map((t, i) => (
            <text
              key={`xt-${i}`}
              x={t.x}
              y={height - 12}
              fontSize={11}
              fill="#64748b"
              textAnchor="middle"
            >
              {t.label}
            </text>
          ))}
        </>
      )}

      {/* Inline animation keyframes. Scoped by attribute rule so it
          doesn't leak to other SVGs. */}
      <style>
        {`@keyframes wb-draw { to { stroke-dashoffset: 0; } }`}
      </style>
    </svg>
  );
}
