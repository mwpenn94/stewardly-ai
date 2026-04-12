/**
 * What-If Sensitivity Analysis — 2D parameter sweep heat map.
 *
 * Users pick two parameters (X and Y axes) and a target metric,
 * then the engine sweeps a grid of combinations and renders a
 * color-coded heat map showing how outcomes change. Drill-down
 * on any cell shows the full breakdown.
 */

import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { GuardrailBadge } from "@/components/wealth-engine/GuardrailBadge";
import { Loader2, Grid3X3, Info, ArrowLeft } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";

// ─── PARAMETER DEFINITIONS ───────────────────────────────────────────

const PARAMS = {
  savingsRate:       { label: "Savings Rate",       unit: "%",  defaultRange: [0.05, 0.40] as [number, number], format: (v: number) => `${(v * 100).toFixed(0)}%` },
  investmentReturn:  { label: "Investment Return",  unit: "%",  defaultRange: [0.03, 0.12] as [number, number], format: (v: number) => `${(v * 100).toFixed(1)}%` },
  taxRate:           { label: "Tax Rate",            unit: "%",  defaultRange: [0.15, 0.45] as [number, number], format: (v: number) => `${(v * 100).toFixed(0)}%` },
  age:               { label: "Starting Age",        unit: "yr", defaultRange: [25, 60]     as [number, number], format: (v: number) => `${Math.round(v)}` },
  income:            { label: "Annual Income",       unit: "$",  defaultRange: [50000, 500000] as [number, number], format: (v: number) => `$${(v / 1000).toFixed(0)}K` },
  horizon:           { label: "Time Horizon",        unit: "yr", defaultRange: [5, 40]      as [number, number], format: (v: number) => `${Math.round(v)}yr` },
} as const;

type ParamKey = keyof typeof PARAMS;

const METRICS = {
  totalValue:        { label: "Total Value",       format: (v: number) => fmt(v) },
  netValue:          { label: "Net Value",         format: (v: number) => fmt(v) },
  roi:               { label: "ROI",               format: (v: number) => `${(v * 100).toFixed(1)}%` },
  savingsBalance:    { label: "Savings Balance",   format: (v: number) => fmt(v) },
  productCashValue:  { label: "Product Cash Value", format: (v: number) => fmt(v) },
} as const;

type MetricKey = keyof typeof METRICS;

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

// ─── HEAT MAP COLOR INTERPOLATION ──────────────────────────────────

function heatColor(value: number, min: number, max: number): string {
  if (max === min) return "oklch(0.76 0.14 80)"; // accent gold
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  // Red (low) → Yellow (mid) → Green (high)
  const hue = t * 120; // 0=red, 60=yellow, 120=green
  const lightness = 0.45 + t * 0.1;
  return `oklch(${lightness} 0.18 ${hue})`;
}

// ─── COMPONENT ──────────────────────────────────────────────────────

export default function Sensitivity() {
  const [, navigate] = useLocation();

  // Parameter selection
  const [xParam, setXParam] = useState<ParamKey>("savingsRate");
  const [yParam, setYParam] = useState<ParamKey>("investmentReturn");
  const [metric, setMetric] = useState<MetricKey>("totalValue");

  // Grid size
  const [gridSize, setGridSize] = useState(7);

  // Base profile
  const [age, setAge] = useState(40);
  const [income, setIncome] = useState(150000);
  const [horizon, setHorizon] = useState(30);

  // Selected cell
  const [selectedCell, setSelectedCell] = useState<{ xi: number; yi: number } | null>(null);

  const sweep = trpc.wealthEngine.sensitivitySweep.useMutation();

  const xDef = PARAMS[xParam];
  const yDef = PARAMS[yParam];
  const metricDef = METRICS[metric];

  const handleRun = useCallback(() => {
    if (xParam === yParam) return;
    setSelectedCell(null);
    sweep.mutate({
      xParam,
      yParam,
      xSteps: gridSize,
      ySteps: gridSize,
      xRange: xDef.defaultRange,
      yRange: yDef.defaultRange,
      metric,
      baseProfile: { age, income, savings: 50000, monthlySavings: Math.round(income * 0.15 / 12) },
      horizon,
    });
  }, [xParam, yParam, gridSize, metric, age, income, horizon, xDef, yDef, sweep]);

  const data = sweep.data;

  return (
    <AppShell title="What-If Sensitivity">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="hidden lg:flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/calculators")} aria-label="Back to calculators">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-lg font-heading font-semibold">What-If Sensitivity Analysis</h1>
            <p className="text-xs text-muted-foreground">See how outcomes change when two parameters vary simultaneously</p>
          </div>
        </div>

        {/* Controls */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Grid3X3 className="w-4 h-4 text-accent" />
              Configure Sweep
            </CardTitle>
            <CardDescription className="text-xs">Pick two parameters and a metric to visualize</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* X Parameter */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">X Axis (columns)</Label>
                <Select value={xParam} onValueChange={(v) => setXParam(v as ParamKey)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PARAMS).map(([k, v]) => (
                      <SelectItem key={k} value={k} disabled={k === yParam}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Y Parameter */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Y Axis (rows)</Label>
                <Select value={yParam} onValueChange={(v) => setYParam(v as ParamKey)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PARAMS).map(([k, v]) => (
                      <SelectItem key={k} value={k} disabled={k === xParam}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Metric */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Result Metric</Label>
                <Select value={metric} onValueChange={(v) => setMetric(v as MetricKey)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(METRICS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Grid Size */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Grid Size: {gridSize}×{gridSize}</Label>
                <Slider
                  value={[gridSize]}
                  onValueChange={([v]) => setGridSize(v)}
                  min={3}
                  max={12}
                  step={1}
                  className="mt-2"
                />
              </div>
            </div>

            {/* Base assumptions */}
            <div className="mt-4 pt-4 border-t border-border/50">
              <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Base assumptions (held constant unless swept)
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Age: {age}</Label>
                  <Slider value={[age]} onValueChange={([v]) => setAge(v)} min={20} max={65} step={1} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Income: ${(income / 1000).toFixed(0)}K</Label>
                  <Slider value={[income]} onValueChange={([v]) => setIncome(v)} min={30000} max={1000000} step={10000} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Horizon: {horizon}yr</Label>
                  <Slider value={[horizon]} onValueChange={([v]) => setHorizon(v)} min={5} max={50} step={1} />
                </div>
              </div>
            </div>

            {/* Guardrail validation for rate-based parameters */}
            {(["savingsRate", "investmentReturn", "taxRate"].includes(xParam) ||
              ["savingsRate", "investmentReturn", "taxRate"].includes(yParam)) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {["savingsRate", "investmentReturn", "taxRate"].includes(xParam) && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span>{xDef.label} max:</span>
                    <GuardrailBadge
                      param={xParam === "investmentReturn" ? "returnRate" : xParam}
                      value={xDef.defaultRange[1]}
                      showOk
                    />
                  </div>
                )}
                {["savingsRate", "investmentReturn", "taxRate"].includes(yParam) && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span>{yDef.label} max:</span>
                    <GuardrailBadge
                      param={yParam === "investmentReturn" ? "returnRate" : yParam}
                      value={yDef.defaultRange[1]}
                      showOk
                    />
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 flex items-center gap-3">
              <Button onClick={handleRun} disabled={sweep.isPending || xParam === yParam} className="gap-2">
                {sweep.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Grid3X3 className="w-4 h-4" />}
                Run Sweep
              </Button>
              {xParam === yParam && (
                <p className="text-xs text-destructive">X and Y must be different parameters</p>
              )}
              {data && (
                <Badge variant="outline" className="text-xs">
                  {data.durationMs}ms · {gridSize * gridSize} scenarios
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Heat Map */}
        {data && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                {metricDef.label} by {xDef.label} × {yDef.label}
              </CardTitle>
              <CardDescription className="text-xs">
                Click any cell for details. Colors: <span className="text-red-400">red</span> = low, <span className="text-yellow-400">yellow</span> = mid, <span className="text-emerald-400">green</span> = high
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr>
                      <th className="p-1.5 text-muted-foreground font-medium text-left border border-border/30 bg-muted/30 min-w-[60px]">
                        {yDef.label} ↓ / {xDef.label} →
                      </th>
                      {data.xValues.map((xv: number, xi: number) => (
                        <th key={xi} className="p-1.5 text-center font-medium border border-border/30 bg-muted/30 min-w-[72px]">
                          {xDef.format(xv)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.grid.map((row: number[], yi: number) => (
                      <tr key={yi}>
                        <td className="p-1.5 font-medium text-muted-foreground border border-border/30 bg-muted/30">
                          {yDef.format(data.yValues[yi])}
                        </td>
                        {row.map((val: number, xi: number) => {
                          const isSelected = selectedCell?.xi === xi && selectedCell?.yi === yi;
                          return (
                            <td
                              key={xi}
                              onClick={() => setSelectedCell({ xi, yi })}
                              className={`p-1.5 text-center font-mono cursor-pointer border transition-all hover:ring-2 hover:ring-accent/50 ${
                                isSelected ? "ring-2 ring-accent shadow-lg" : "border-border/20"
                              }`}
                              style={{
                                backgroundColor: heatColor(val, data.minVal, data.maxVal),
                                color: val > (data.minVal + data.maxVal) / 2 ? "#1a1a2e" : "#f0f0f0",
                              }}
                              title={`${xDef.label}: ${xDef.format(data.xValues[xi])} · ${yDef.label}: ${yDef.format(data.yValues[yi])}`}
                            >
                              {metric === "roi"
                                ? `${(val * 100).toFixed(0)}%`
                                : fmt(val)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <span>Range:</span>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: heatColor(data.minVal, data.minVal, data.maxVal) }} />
                  <span>{metric === "roi" ? `${(data.minVal * 100).toFixed(0)}%` : fmt(data.minVal)}</span>
                </div>
                <span>→</span>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: heatColor(data.maxVal, data.minVal, data.maxVal) }} />
                  <span>{metric === "roi" ? `${(data.maxVal * 100).toFixed(0)}%` : fmt(data.maxVal)}</span>
                </div>
                <span className="ml-2">
                  Spread: {metric === "roi"
                    ? `${((data.maxVal - data.minVal) * 100).toFixed(0)}%`
                    : fmt(data.maxVal - data.minVal)}
                </span>
              </div>

              {/* Selected cell detail */}
              {selectedCell && data.grid[selectedCell.yi] && (
                <div className="mt-4 p-3 rounded-lg border border-accent/30 bg-accent/5">
                  <p className="text-xs font-medium mb-1">Selected Scenario</p>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">{xDef.label}:</span>{" "}
                      <span className="font-medium">{xDef.format(data.xValues[selectedCell.xi])}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{yDef.label}:</span>{" "}
                      <span className="font-medium">{yDef.format(data.yValues[selectedCell.yi])}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{metricDef.label}:</span>{" "}
                      <span className="font-semibold text-accent">
                        {metric === "roi"
                          ? `${(data.grid[selectedCell.yi][selectedCell.xi] * 100).toFixed(1)}%`
                          : fmt(data.grid[selectedCell.yi][selectedCell.xi])}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {!data && !sweep.isPending && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Grid3X3 className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Configure parameters above and click "Run Sweep"</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                The heat map shows how your chosen metric changes across all combinations of two varying parameters
              </p>
            </CardContent>
          </Card>
        )}

        {/* Methodology */}
        <p className="text-[10px] text-muted-foreground/50 text-center max-w-2xl mx-auto">
          All projections are hypothetical illustrations for educational purposes. Each cell runs a full holistic simulation
          at the specified parameter combination. Actual results will vary. Not investment, tax, or legal advice.
        </p>
      </div>
    </AppShell>
  );
}
