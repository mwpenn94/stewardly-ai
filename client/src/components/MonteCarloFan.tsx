/**
 * MonteCarloFan — Fan chart showing percentile bands from Monte Carlo simulation.
 * Renders 10th-90th percentile bands with median line.
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PercentileData {
  year: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

interface Props {
  data: PercentileData[];
  title?: string;
  height?: number;
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export default function MonteCarloFan({ data, title = "Monte Carlo Simulation", height = 240 }: Props) {
  const [hoveredYear, setHoveredYear] = useState<number | null>(null);

  const { bands, medianLine, yTicks, xTicks, padL, padT, chartW, chartH } = useMemo(() => {
    const padL = 72, padR = 20, padT = 20, padB = 40;
    const chartW = 800 - padL - padR;
    const chartH = height - padT - padB;

    if (!data.length) return { bands: [], medianLine: "", yTicks: [], xTicks: [], padL, padT, chartW, chartH };

    const allVals = data.flatMap((d) => [d.p10, d.p90]);
    const minY = Math.min(0, ...allVals);
    const maxY = Math.max(...allVals) * 1.1 || 100;
    const minX = data[0].year;
    const maxX = data[data.length - 1].year;
    const rangeX = maxX - minX || 1;

    const toX = (yr: number) => padL + ((yr - minX) / rangeX) * chartW;
    const toY = (val: number) => padT + chartH - ((val - minY) / (maxY - minY)) * chartH;

    // Bands (10-90, 25-75)
    const outerTop = data.map((d) => `${toX(d.year)},${toY(d.p90)}`).join(" ");
    const outerBot = [...data].reverse().map((d) => `${toX(d.year)},${toY(d.p10)}`).join(" ");
    const innerTop = data.map((d) => `${toX(d.year)},${toY(d.p75)}`).join(" ");
    const innerBot = [...data].reverse().map((d) => `${toX(d.year)},${toY(d.p25)}`).join(" ");

    const bands = [
      { points: `${outerTop} ${outerBot}`, opacity: 0.08, label: "10th-90th" },
      { points: `${innerTop} ${innerBot}`, opacity: 0.15, label: "25th-75th" },
    ];

    const medianLine = data.map((d, i) => `${i === 0 ? "M" : "L"} ${toX(d.year)} ${toY(d.p50)}`).join(" ");

    // Y ticks
    const yTickCount = 5;
    const yStep = (maxY - minY) / yTickCount;
    const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => ({
      value: minY + yStep * i,
      y: toY(minY + yStep * i),
    }));

    // X ticks
    const xStep = Math.max(1, Math.floor(data.length / 8));
    const xTicks = data.filter((_, i) => i % xStep === 0 || i === data.length - 1).map((d) => ({
      year: d.year,
      x: toX(d.year),
    }));

    return { bands, medianLine, yTicks, xTicks, padL, padT, chartW, chartH };
  }, [data, height]);

  const hoveredData = hoveredYear !== null ? data.find((d) => d.year === hoveredYear) : null;

  if (!data.length) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-8 text-center text-muted-foreground">
          Run Monte Carlo simulation to see probability distribution.
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
            <CardDescription className="text-xs">1,000 trials with randomized market returns</CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-[9px] bg-emerald-500/10 border-emerald-500/30">90th %ile</Badge>
            <Badge variant="outline" className="text-[9px]">Median</Badge>
            <Badge variant="outline" className="text-[9px] bg-red-500/10 border-red-500/30">10th %ile</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <svg
          viewBox={`0 0 800 ${height}`}
          className="w-full"
          onMouseLeave={() => setHoveredYear(null)}
        >
          {/* Grid */}
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={padL} y1={t.y} x2={padL + chartW} y2={t.y} stroke="currentColor" strokeOpacity={0.08} />
              <text x={padL - 8} y={t.y + 4} textAnchor="end" className="fill-muted-foreground" fontSize={10}>
                {fmt(t.value)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t.year} x={t.x} y={height - 8} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>
              Yr {t.year}
            </text>
          ))}

          {/* Fan bands */}
          {bands.map((b, i) => (
            <polygon key={i} points={b.points} fill="#C9A84C" fillOpacity={b.opacity} />
          ))}

          {/* Median line */}
          <path d={medianLine} fill="none" stroke="#C9A84C" strokeWidth={2.5} strokeLinejoin="round" />

          {/* Hover zones */}
          {data.map((d) => {
            const x = padL + ((d.year - data[0].year) / (data[data.length - 1].year - data[0].year || 1)) * chartW;
            return (
              <rect
                key={d.year}
                x={x - 8}
                y={padT}
                width={16}
                height={chartH}
                fill="transparent"
                onMouseEnter={() => setHoveredYear(d.year)}
              />
            );
          })}
        </svg>

        {/* Hover tooltip */}
        {hoveredData && (
          <div className="flex gap-4 justify-center mt-2 text-xs">
            <span className="font-medium text-foreground">Year {hoveredData.year}</span>
            <span className="text-emerald-400">90th: {fmt(hoveredData.p90)}</span>
            <span className="text-blue-400">75th: {fmt(hoveredData.p75)}</span>
            <span className="text-foreground font-semibold">Median: {fmt(hoveredData.p50)}</span>
            <span className="text-amber-400">25th: {fmt(hoveredData.p25)}</span>
            <span className="text-red-400">10th: {fmt(hoveredData.p10)}</span>
          </div>
        )}

        {/* Final year summary */}
        {data.length > 0 && (
          <div className="grid grid-cols-5 gap-2 mt-3 pt-3 border-t border-border/30">
            {[
              { label: "90th Percentile", value: data[data.length - 1].p90, color: "text-emerald-400" },
              { label: "75th Percentile", value: data[data.length - 1].p75, color: "text-blue-400" },
              { label: "Median (50th)", value: data[data.length - 1].p50, color: "text-foreground" },
              { label: "25th Percentile", value: data[data.length - 1].p25, color: "text-amber-400" },
              { label: "10th Percentile", value: data[data.length - 1].p10, color: "text-red-400" },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <p className="text-[10px] text-muted-foreground">{item.label}</p>
                <p className={`text-sm font-semibold tabular-nums ${item.color}`}>{fmt(item.value)}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
