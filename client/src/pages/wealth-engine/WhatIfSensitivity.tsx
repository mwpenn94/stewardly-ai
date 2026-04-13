/**
 * What-If Sensitivity — 2D sensitivity grid
 *
 * Picks any two input parameters (savings rate, return, tax, years, etc.)
 * and sweeps them across a range, running the holistic engine for each cell.
 * Displays results as a color-coded heat map grid.
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import AppShell from "@/components/AppShell";
import { persistCalculation } from "@/lib/calculatorContext";
import { useFinancialProfile } from "@/hooks/useFinancialProfile";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Grid3x3, Play, Loader2, TrendingUp, Info, AlertTriangle } from "lucide-react";
import { sendFeedback } from "@/lib/feedbackSpecs";
import { checkGuardrail } from "@/components/wealth-engine/GuardrailWarning";
import { SEOHead } from "@/components/SEOHead";

/* ── parameter definitions ──────────────────────────────────── */

interface ParamDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  isPercentage?: boolean;
}

const PARAMS: ParamDef[] = [
  { key: "savingsRate", label: "Savings Rate", min: 0.05, max: 0.40, step: 0.05, format: (v) => `${(v * 100).toFixed(0)}%`, isPercentage: true },
  { key: "investmentReturn", label: "Investment Return", min: 0.02, max: 0.12, step: 0.01, format: (v) => `${(v * 100).toFixed(0)}%`, isPercentage: true },
  { key: "taxRate", label: "Tax Rate", min: 0.10, max: 0.45, step: 0.05, format: (v) => `${(v * 100).toFixed(0)}%`, isPercentage: true },
  { key: "income", label: "Annual Income", min: 50000, max: 500000, step: 50000, format: (v) => `$${(v / 1000).toFixed(0)}K` },
  { key: "years", label: "Projection Years", min: 5, max: 40, step: 5, format: (v) => `${v}yr` },
  { key: "age", label: "Starting Age", min: 25, max: 60, step: 5, format: (v) => `${v}` },
];

const DEFAULT_PROFILE = {
  age: 40,
  income: 120000,
  netWorth: 350000,
  savings: 180000,
  dependents: 2,
  mortgage: 250000,
};

const DEFAULT_STRATEGY = {
  savingsRate: 0.15,
  investmentReturn: 0.07,
  taxRate: 0.25,
};

interface GridCell {
  rowVal: number;
  colVal: number;
  result: number;
}

/* ── helpers ─────────────────────────────────────────────────── */

function genRange(min: number, max: number, step: number, steps: number): number[] {
  const range: number[] = [];
  const actualStep = (max - min) / (steps - 1);
  for (let i = 0; i < steps; i++) {
    const v = min + i * actualStep;
    // Round to avoid floating point
    range.push(Math.round(v * 10000) / 10000);
  }
  return range;
}

function heatColor(value: number, min: number, max: number): string {
  if (max === min) return "oklch(0.76 0.14 80)"; // accent gold
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  // Green (high) → Gold (mid) → Red (low)
  if (pct > 0.5) {
    const t = (pct - 0.5) * 2; // 0 → 1
    return `oklch(${0.65 + t * 0.15} ${0.12 + t * 0.05} ${80 + t * 60})`;
  }
  const t = pct * 2; // 0 → 1
  return `oklch(${0.55 + t * 0.10} ${0.15 - t * 0.03} ${30 + t * 50})`;
}

const fmt = (n: number) => {
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

/* ── component ─────────────────────────────────────────────── */

export default function WhatIfSensitivity() {
  const [rowParam, setRowParam] = useState("savingsRate");
  const [colParam, setColParam] = useState("investmentReturn");
  const [gridSize, setGridSize] = useState(5);
  const [grid, setGrid] = useState<GridCell[] | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [failedCells, setFailedCells] = useState(0);

  // Load shared financial profile from cross-page bridge (falls back to defaults)
  const { profile: sharedProfile } = useFinancialProfile("WhatIfSensitivity");
  const liveProfile = useMemo(() => ({
    age: sharedProfile.currentAge ?? DEFAULT_PROFILE.age,
    income: sharedProfile.annualIncome ?? DEFAULT_PROFILE.income,
    netWorth: sharedProfile.netWorth ?? DEFAULT_PROFILE.netWorth,
    savings: sharedProfile.portfolioBalance ?? DEFAULT_PROFILE.savings,
    dependents: sharedProfile.childrenCount ?? DEFAULT_PROFILE.dependents,
    mortgage: sharedProfile.mortgageBalance ?? DEFAULT_PROFILE.mortgage,
  }), [sharedProfile]);

  const heSimulate = trpc.calculatorEngine.heSimulate.useMutation({ onError: (e) => toast.error(e.message) });

  const rowDef = PARAMS.find((p) => p.key === rowParam)!;
  const colDef = PARAMS.find((p) => p.key === colParam)!;

  const runGrid = useCallback(async () => {
    if (rowParam === colParam) {
      toast.error("Pick two different parameters");
      return;
    }

    setRunning(true);
    setGrid(null);
    setRunError(null);
    setFailedCells(0);

    const rows = genRange(rowDef.min, rowDef.max, rowDef.step, gridSize);
    const cols = genRange(colDef.min, colDef.max, colDef.step, gridSize);

    const cells: GridCell[] = [];
    let errorCount = 0;

    try {
      // Run all cells sequentially to avoid hammering the server
      for (const rVal of rows) {
        for (const cVal of cols) {
          const profile = { ...liveProfile };
          const strategy = { ...DEFAULT_STRATEGY };
          let years = 20;

          // Apply row param
          if (rowParam === "income") profile.income = rVal;
          else if (rowParam === "age") profile.age = rVal;
          else if (rowParam === "years") years = rVal;
          else (strategy as any)[rowParam] = rVal;

          // Apply col param
          if (colParam === "income") profile.income = cVal;
          else if (colParam === "age") profile.age = cVal;
          else if (colParam === "years") years = cVal;
          else (strategy as any)[colParam] = cVal;

          try {
            const result = await heSimulate.mutateAsync({
              strategy: {
                name: "Sensitivity",
                companyKey: "wealthbridge" as const,
                profile,
                ...strategy,
                hasBizIncome: false,
                reinvestTaxSavings: true,
              },
              years,
            });

            // Extract final year total wealth
            const data = (result as any)?.data ?? result;
            const yearData = Array.isArray(data) ? data : [];
            const lastYear = yearData[yearData.length - 1];
            const finalValue = lastYear?.totalLiquidWealth ?? lastYear?.totalValue ?? lastYear?.netValue ?? 0;

            cells.push({ rowVal: rVal, colVal: cVal, result: finalValue });
          } catch {
            errorCount++;
            cells.push({ rowVal: rVal, colVal: cVal, result: 0 });
          }
        }
      }

      setGrid(cells);
      setFailedCells(errorCount);
      if (errorCount > 0 && errorCount < cells.length) {
        toast.warning(`${errorCount} of ${cells.length} cells failed — values shown as $0`);
      }
      sendFeedback("calculator.result");
    } catch (err: any) {
      const msg = err.message ?? "unknown error";
      toast.error(`Sensitivity run failed: ${msg}`);
      setRunError(msg);
    } finally {
      setRunning(false);
    }
  }, [rowParam, colParam, gridSize, rowDef, colDef, heSimulate]);

  // ── Persist to calculator context bridge so Chat knows sensitivity results ──
  useEffect(() => {
    if (!grid || grid.length === 0) return;
    const values = grid.map((c) => c.result);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = Math.round(values.reduce((s, v) => s + v, 0) / values.length);
    const fmt = (n: number) => "$" + Math.round(n).toLocaleString();
    persistCalculation({
      id: `whatif-${rowParam}-${colParam}-${gridSize}`,
      type: "custom",
      title: `What-If Sensitivity — ${rowParam} × ${colParam}`,
      summary: `${gridSize}×${gridSize} grid (${grid.length} cells). Range: ${fmt(min)} – ${fmt(max)}, avg ${fmt(avg)}.${failedCells > 0 ? ` ${failedCells} cells failed.` : ""}`,
      inputs: { rowParam, colParam, gridSize, profile: liveProfile },
      outputs: { cellCount: grid.length, minValue: min, maxValue: max, avgValue: avg, failedCells },
      timestamp: Date.now(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid]);

  // Derive grid dimensions
  const rows = grid ? Array.from(new Set(grid.map((c) => c.rowVal))).sort((a, b) => a - b) : [];
  const cols = grid ? Array.from(new Set(grid.map((c) => c.colVal))).sort((a, b) => a - b) : [];
  const allValues = grid ? grid.map((c) => c.result) : [];
  const minVal = allValues.length ? Math.min(...allValues) : 0;
  const maxVal = allValues.length ? Math.max(...allValues) : 0;

  const getCell = (r: number, c: number) => grid?.find((cell) => cell.rowVal === r && cell.colVal === c);

  return (
    <AppShell title="What-If Sensitivity">
      <SEOHead title="What-If Sensitivity" description="Scenario modeling and sensitivity analysis" />
      <div className="max-w-5xl mx-auto space-y-6 p-4">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Grid3x3 className="h-6 w-6 text-accent" />
            What-If Sensitivity Analysis
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sweep two parameters across a range to see how they affect your projected wealth.
            Each cell runs the full holistic engine.
          </p>
          {sharedProfile.annualIncome != null && (
            <p className="text-[10px] text-accent mt-1 flex items-center gap-1">
              <Info className="h-3 w-3" />
              Using your shared financial profile (age {liveProfile.age}, income ${(liveProfile.income / 1000).toFixed(0)}K).
              Edit on any planning page to update.
            </p>
          )}
        </div>

        {/* Controls */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Parameters</CardTitle>
            <CardDescription>Pick two variables to sweep. The grid shows final-year total liquid wealth.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Row Variable</Label>
              <Select value={rowParam} onValueChange={setRowParam}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PARAMS.map((p) => (
                    <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Column Variable</Label>
              <Select value={colParam} onValueChange={setColParam}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PARAMS.map((p) => (
                    <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Grid Size</Label>
              <div className="flex items-center gap-2">
                <Slider value={[gridSize]} onValueChange={([v]) => setGridSize(v)} min={3} max={7} step={1} className="flex-1" />
                <span className="text-xs font-medium w-12 text-right">{gridSize}×{gridSize}</span>
              </div>
            </div>
            <div className="flex items-end">
              <Button onClick={runGrid} disabled={running} className="gap-1.5 w-full">
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {running ? `Running ${gridSize * gridSize} scenarios…` : "Run Sensitivity"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error state */}
        {runError && !grid && (
          <Card className="border-destructive/30">
            <CardContent className="p-6 text-center space-y-2">
              <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
              <p className="text-sm font-medium text-destructive">Sensitivity analysis failed</p>
              <p className="text-xs text-muted-foreground">{runError}</p>
              <p className="text-xs text-muted-foreground">Check your connection and try again, or reduce the grid size.</p>
            </CardContent>
          </Card>
        )}

        {/* Partial failure warning */}
        {grid && failedCells > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {failedCells} of {grid.length} cells failed to compute (shown as $0). This may indicate server load — try reducing grid size.
            </p>
          </div>
        )}

        {/* Grid */}
        {grid && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Results Heat Map
              </CardTitle>
              <CardDescription>
                {rowDef.label} (rows) × {colDef.label} (columns). Range: {fmt(minVal)} – {fmt(maxVal)}.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="p-2 text-left text-[10px] text-muted-foreground border-b">
                      {rowDef.label} ↓ / {colDef.label} →
                    </th>
                    {cols.map((c) => (
                      <th key={c} className="p-2 text-center text-[10px] text-muted-foreground border-b font-medium">
                        {colDef.format(c)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r}>
                      <td className="p-2 text-[10px] text-muted-foreground border-r font-medium whitespace-nowrap">
                        {rowDef.format(r)}
                      </td>
                      {cols.map((c) => {
                        const cell = getCell(r, c);
                        const val = cell?.result ?? 0;
                        return (
                          <td
                            key={c}
                            className="p-2 text-center font-medium tabular-nums border border-border/30"
                            style={{
                              backgroundColor: heatColor(val, minVal, maxVal),
                              color: val > (minVal + maxVal) / 2 ? "oklch(0.20 0.02 80)" : "oklch(0.95 0.02 80)",
                            }}
                            title={`${rowDef.label}: ${rowDef.format(r)}, ${colDef.label}: ${colDef.format(c)} → ${fmt(val)}`}
                          >
                            {fmt(val)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Legend */}
        {grid && (
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-4 h-3 rounded" style={{ backgroundColor: heatColor(minVal, minVal, maxVal) }} />
              <span>Low ({fmt(minVal)})</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-3 rounded" style={{ backgroundColor: heatColor((minVal + maxVal) / 2, minVal, maxVal) }} />
              <span>Mid</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-3 rounded" style={{ backgroundColor: heatColor(maxVal, minVal, maxVal) }} />
              <span>High ({fmt(maxVal)})</span>
            </div>
          </div>
        )}

        {/* Guardrail context note */}
        {grid && (
          <div className="flex items-start gap-2 p-3 rounded-lg border border-border/30 bg-secondary/10">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-[10px] text-muted-foreground space-y-1">
              <p>
                <span className="font-medium">Guardrail context:</span> Return rates above 12% are historically rare for diversified portfolios (S&P 500 avg: 10.3%, Morningstar 2025).
                Savings rates above 50% may not be sustainable. Tax rates vary by state (TX: 0%, CA: up to 13.3%).
              </p>
              <p>
                These projections are hypothetical and for educational purposes only. Past performance does not guarantee future results.
              </p>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
