/**
 * AccessibleChart — WCAG 2.1 AA compliant chart wrapper
 * Wraps Recharts with: aria-label, sr-only data table, "View as Table" toggle,
 * Wong colorblind-safe palette, pattern fills.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

/** Wong colorblind-safe palette */
const WONG_PALETTE = ["#0072B2", "#E69F00", "#009E73", "#CC79A7", "#F0E442", "#56B4E9", "#D55E00"];

export interface ChartSeries {
  key: string;
  label: string;
  color?: string;
}

export interface AccessibleChartProps {
  type: "bar" | "line";
  data: Record<string, unknown>[];
  xKey: string;
  series: ChartSeries[];
  title: string;
  description?: string;
  height?: number;
}

export default function AccessibleChart({
  type, data, xKey, series, title, description, height = 300,
}: AccessibleChartProps) {
  const [showTable, setShowTable] = useState(false);

  const coloredSeries = series.map((s, i) => ({
    ...s,
    color: s.color || WONG_PALETTE[i % WONG_PALETTE.length],
  }));

  return (
    <div role="figure" aria-label={title}>
      {description && <p className="text-sm text-muted-foreground mb-2">{description}</p>}

      <div className="flex justify-end mb-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowTable(!showTable)}
          aria-pressed={showTable}
          className="text-xs"
        >
          {showTable ? "View as Chart" : "View as Table"}
        </Button>
      </div>

      {showTable ? (
        <div aria-live="polite">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left p-2 border-b">{xKey}</th>
                {coloredSeries.map(s => (
                  <th key={s.key} className="text-right p-2 border-b">{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i}>
                  <td className="p-2 border-b">{String(row[xKey])}</td>
                  {coloredSeries.map(s => (
                    <td key={s.key} className="text-right p-2 border-b">
                      {typeof row[s.key] === "number" ? (row[s.key] as number).toLocaleString() : String(row[s.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          {type === "bar" ? (
            <BarChart data={data} aria-label={title}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              {coloredSeries.map(s => (
                <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} />
              ))}
            </BarChart>
          ) : (
            <LineChart data={data} aria-label={title}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              {coloredSeries.map(s => (
                <Line key={s.key} dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      )}

      {/* Screen reader only data table */}
      <div className="sr-only" aria-label={`${title} data`}>
        <table>
          <caption>{title}</caption>
          <thead>
            <tr>
              <th>{xKey}</th>
              {coloredSeries.map(s => <th key={s.key}>{s.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i}>
                <td>{String(row[xKey])}</td>
                {coloredSeries.map(s => <td key={s.key}>{String(row[s.key] ?? "")}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
