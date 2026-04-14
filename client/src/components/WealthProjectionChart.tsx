/**
 * WealthProjectionChart — Multi-strategy line chart for holistic engine results.
 * Renders year-by-year projections with up to 6 strategies overlaid.
 * Uses pure SVG for zero-dependency rendering.
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DataPoint {
  year: number;
  [key: string]: number;
}

interface Series {
  name: string;
  color: string;
  data: DataPoint[];
  dataKey: string;
}

interface Props {
  series: Series[];
  title?: string;
  subtitle?: string;
  yLabel?: string;
  formatY?: (v: number) => string;
  height?: number;
  showLegend?: boolean;
  milestoneYears?: number[];
}

const METRIC_OPTIONS = [
  { value: "totalValue", label: "Total Value" },
  { value: "totalLiquidWealth", label: "Liquid Wealth" },
  { value: "netValue", label: "Net Value" },
  { value: "totalProtection", label: "Protection" },
  { value: "totalTaxSavings", label: "Tax Savings" },
  { value: "bizIncome", label: "Business Income" },
  { value: "totalGrossIncome", label: "Gross Income" },
  { value: "savingsBalance", label: "Savings Balance" },
  { value: "productCashValue", label: "Product Cash Value" },
  { value: "productDeathBenefit", label: "Death Benefit" },
];

function fmt(n: number): string {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export default function WealthProjectionChart({
  series,
  title = "Wealth Projection",
  subtitle,
  yLabel,
  formatY = fmt,
  height = 260,
  showLegend = true,
  milestoneYears,
}: Props) {
  const [hoveredYear, setHoveredYear] = useState<number | null>(null);

  const { points, yTicks, xTicks, maxY, minY, chartW, chartH, padL, padB, padT, padR } = useMemo(() => {
    const padL = 72, padR = 20, padT = 20, padB = 40;
    const chartW = 800 - padL - padR;
    const chartH = height - padT - padB;

    // Collect all values
    let allVals: number[] = [];
    let allYears: number[] = [];
    for (const s of series) {
      for (const d of s.data) {
        allVals.push(d[s.dataKey] || 0);
        allYears.push(d.year);
      }
    }
    if (allVals.length === 0) allVals = [0, 100];
    if (allYears.length === 0) allYears = [1];

    const minY = Math.min(0, ...allVals);
    const maxY = Math.max(...allVals) * 1.1 || 100;
    const minX = Math.min(...allYears);
    const maxX = Math.max(...allYears);
    const rangeX = maxX - minX || 1;

    // Y ticks
    const yTickCount = 5;
    const yStep = (maxY - minY) / yTickCount;
    const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => minY + yStep * i);

    // X ticks (smart sampling)
    const uniqueYears = Array.from(new Set(allYears)).sort((a, b) => a - b);
    const xStep = Math.max(1, Math.floor(uniqueYears.length / 8));
    const xTicks = uniqueYears.filter((_, i) => i % xStep === 0 || i === uniqueYears.length - 1);

    // Convert to SVG coordinates
    const points = series.map((s) => ({
      ...s,
      coords: s.data.map((d) => ({
        x: padL + ((d.year - minX) / rangeX) * chartW,
        y: padT + chartH - ((d[s.dataKey] || 0) - minY) / (maxY - minY) * chartH,
        year: d.year,
        value: d[s.dataKey] || 0,
      })),
    }));

    return { points, yTicks, xTicks: xTicks.map((y) => ({ year: y, x: padL + ((y - minX) / rangeX) * chartW })), maxY, minY, chartW, chartH, padL, padB, padT, padR };
  }, [series, height]);

  if (series.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-12 text-center text-muted-foreground">
          No data to display. Run a simulation first.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          {showLegend && (
            <div className="flex gap-3 flex-wrap">
              {series.map((s) => (
                <div key={s.name} className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-[10px] text-muted-foreground">{s.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <svg
          viewBox={`0 0 800 ${height}`}
          className="w-full"
          onMouseLeave={() => setHoveredYear(null)}
        >
          {/* Grid lines */}
          {yTicks.map((tick, i) => {
            const y = padT + chartH - ((tick - minY) / (maxY - minY)) * chartH;
            return (
              <g key={i}>
                <line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke="currentColor" strokeOpacity={0.08} />
                <text x={padL - 8} y={y + 4} textAnchor="end" className="fill-muted-foreground" fontSize={10}>
                  {formatY(tick)}
                </text>
              </g>
            );
          })}

          {/* X axis labels */}
          {xTicks.map((tick) => (
            <text key={tick.year} x={tick.x} y={height - 8} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>
              Yr {tick.year}
            </text>
          ))}

          {/* Milestone markers */}
          {milestoneYears?.map((yr) => {
            const tick = xTicks.find((t) => t.year === yr);
            if (!tick) return null;
            return (
              <line key={yr} x1={tick.x} y1={padT} x2={tick.x} y2={padT + chartH} stroke="currentColor" strokeOpacity={0.15} strokeDasharray="4 4" />
            );
          })}

          {/* Lines */}
          {points.map((s) => {
            if (s.coords.length < 2) return null;
            const pathD = s.coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
            // Area fill
            const areaD = pathD + ` L ${s.coords[s.coords.length - 1].x} ${padT + chartH} L ${s.coords[0].x} ${padT + chartH} Z`;
            return (
              <g key={s.name}>
                <path d={areaD} fill={s.color} fillOpacity={0.06} />
                <path d={pathD} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
              </g>
            );
          })}

          {/* Hover interaction zones */}
          {points[0]?.coords.map((c) => (
            <rect
              key={c.year}
              x={c.x - 8}
              y={padT}
              width={16}
              height={chartH}
              fill="transparent"
              onMouseEnter={() => setHoveredYear(c.year)}
            />
          ))}

          {/* Hover tooltip line + dots */}
          {hoveredYear !== null && points.map((s) => {
            const pt = s.coords.find((c) => c.year === hoveredYear);
            if (!pt) return null;
            return (
              <g key={s.name + "-hover"}>
                <line x1={pt.x} y1={padT} x2={pt.x} y2={padT + chartH} stroke="currentColor" strokeOpacity={0.2} />
                <circle cx={pt.x} cy={pt.y} r={4} fill={s.color} stroke="white" strokeWidth={1.5} />
              </g>
            );
          })}
        </svg>

        {/* Hover tooltip */}
        {hoveredYear !== null && (
          <div className="flex gap-4 justify-center mt-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Year {hoveredYear}</span>
            {points.map((s) => {
              const pt = s.coords.find((c) => c.year === hoveredYear);
              return pt ? (
                <span key={s.name} style={{ color: s.color }}>
                  {s.name}: {formatY(pt.value)}
                </span>
              ) : null;
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { METRIC_OPTIONS };
export type { Series, DataPoint };
