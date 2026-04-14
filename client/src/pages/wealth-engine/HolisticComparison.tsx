/**
 * HolisticComparison — side-by-side HE projection comparing two
 * strategies (defaulting to "Do Nothing" vs "WealthBridge Plan")
 * built from the user's saved financial profile.
 *
 * The Holistic Engine is the most powerful submodule of the wealth
 * engine and is the easiest illustration of advisor value: a
 * 30-year liquid-wealth gap is rarely subtle. Until pass 3 it was
 * only reachable through the heavyweight StrategyComparison page,
 * which forces users to enter a profile from scratch.
 *
 * This page reads the shared FinancialProfile via useFinancialProfile
 * and runs both strategies in parallel through wealthEngine.runPreset.
 * Users can swap either side to any of the 8 HE presets.
 */

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  ArrowRight,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Loader2,
  RefreshCw,
  Scale,
} from "lucide-react";
import { useLocation } from "wouter";
import { useFinancialProfile } from "@/hooks/useFinancialProfile";
import { FinancialProfileBanner } from "@/components/financial-profile/FinancialProfileBanner";
import { useRunTimeline } from "@/hooks/useRunTimeline";
import { announcePolite } from "@/lib/a11y";
import { formatCurrency } from "@/lib/wealth-engine/animations";
import { SEOHead } from "@/components/SEOHead";
import {
  HE_PRESET_REGISTRY,
  comparisonConfidence,
  computeComparisonDelta,
  findPreset,
  formatDeltaHeadline,
  profileToHolisticInput,
  type HePresetKey,
} from "./holisticComparisonHelpers";

// Re-export helpers for downstream consumers
export {
  HE_PRESET_REGISTRY,
  computeComparisonDelta,
  formatDeltaHeadline,
  profileToHolisticInput,
};
export type { HePresetKey };

interface HEProjectionRow {
  year?: number;
  age?: number;
  liquidWealth?: number;
  totalLiquidWealth?: number;
  savings?: number;
  netWorth?: number;
}

function pickLiquidValue(row: HEProjectionRow | undefined): number {
  if (!row) return 0;
  if (row.liquidWealth !== undefined) return row.liquidWealth;
  if (row.totalLiquidWealth !== undefined) return row.totalLiquidWealth;
  return 0;
}

function normalizeProjection(
  payload: unknown,
): Array<{ year?: number; liquidWealth?: number }> {
  if (!payload) return [];
  // The wealthEngine.runPreset response is { data: <projection>, ... }
  // and the projection itself is `simulate()` from the HE module which
  // returns an array of HolisticSnapshot rows.
  const arr =
    Array.isArray(payload)
      ? payload
      : Array.isArray((payload as { data?: unknown }).data)
        ? ((payload as { data: HEProjectionRow[] }).data)
        : [];
  return arr.map((row: HEProjectionRow) => ({
    year: row.year,
    liquidWealth: pickLiquidValue(row),
  }));
}

export default function HolisticComparisonPage() {
  const [, navigate] = useLocation();
  const { profile, completeness, hasProfile } = useFinancialProfile();
  const { recordRun } = useRunTimeline();

  const [presetA, setPresetA] = useState<HePresetKey>("doNothing");
  const [presetB, setPresetB] = useState<HePresetKey>("wealthbridgeClient");
  const [years, setYears] = useState<number>(30);

  const runA = trpc.wealthEngine.runPreset.useMutation({ onError: (e) => toast.error(e.message) });
  const runB = trpc.wealthEngine.runPreset.useMutation({ onError: (e) => toast.error(e.message) });

  const engineProfile = useMemo(() => profileToHolisticInput(profile), [profile]);

  const runComparison = () => {
    runA.mutate({ preset: presetA, profile: engineProfile, years });
    runB.mutate({ preset: presetB, profile: engineProfile, years });
  };

  // Auto-run on first mount if a profile is already saved.
  useEffect(() => {
    if (hasProfile && !runA.data && !runA.isPending) {
      runComparison();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasProfile]);

  const projectionA = useMemo(() => normalizeProjection(runA.data), [runA.data]);
  const projectionB = useMemo(() => normalizeProjection(runB.data), [runB.data]);
  const delta = useMemo(
    () => computeComparisonDelta(projectionA, projectionB),
    [projectionA, projectionB],
  );

  const presetMetaA = findPreset(presetA);
  const presetMetaB = findPreset(presetB);

  const headline = useMemo(() => {
    if (!presetMetaA || !presetMetaB) return "";
    if (delta.years === 0) return "";
    return formatDeltaHeadline(delta, presetMetaA.short, presetMetaB.short);
  }, [delta, presetMetaA, presetMetaB]);

  const confidence = useMemo(
    () => comparisonConfidence(completeness, delta.years),
    [completeness, delta.years],
  );

  // Record the comparison into the timeline once both sides resolve.
  useEffect(() => {
    if (projectionA.length === 0 || projectionB.length === 0) return;
    if (delta.years === 0) return;
    const metaA = findPreset(presetA);
    const metaB = findPreset(presetB);
    recordRun({
      tool: "he.compareAt",
      label: `HE: ${metaA?.short ?? presetA} vs ${metaB?.short ?? presetB}`,
      inputSummary: `${years}y horizon · profile ${Math.round(completeness * 100)}% complete`,
      outputSummary: `Δ ${formatCurrency(delta.delta)} (${Math.round(delta.pctImprovement * 100)}%)`,
      route: "/wealth-engine/holistic-comparison",
      confidence,
      inputs: { presetA, presetB, years },
    });
    // a11y (pass 16): narrate the comparison result for screen
    // readers so users don't have to re-scan the DOM.
    const winner = delta.delta > 0 ? metaB?.short ?? presetB : metaA?.short ?? presetA;
    announcePolite(
      `Comparison complete. ${winner} wins by ${formatCurrency(Math.abs(delta.delta))} (${Math.round(Math.abs(delta.pctImprovement) * 100)} percent).`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectionA.length, projectionB.length, delta.finalA, delta.finalB]);

  const isRunning = runA.isPending || runB.isPending;

  return (
    <AppShell title="Holistic Comparison">
      <SEOHead title="Holistic Comparison" description="Compare holistic wealth strategies" />
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <header className="space-y-1">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-accent" />
            <h1 className="text-2xl font-bold">Holistic Comparison</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Side-by-side liquid-wealth projection across two strategies, run
            from your saved financial profile.
          </p>
        </header>

        <FinancialProfileBanner
          onPrefill={() => runComparison()}
          actionLabel="Re-run comparison"
          hideWhenEmpty={false}
          usesFields={[
            "age",
            "income",
            "savings",
            "monthlySavings",
            "marginalRate",
          ]}
        />

        {!hasProfile && (
          <Card>
            <CardContent className="p-6 text-sm space-y-3">
              <p className="text-muted-foreground">
                You haven't saved a financial profile yet. Run the
                Quick Quote first to build one — your answers populate
                this comparison automatically.
              </p>
              <Button
                size="sm"
                onClick={() => navigate("/wealth-engine/quick-quote")}
              >
                Open Quick Quote <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <PresetPicker
            label="Strategy A (baseline)"
            value={presetA}
            onChange={(v) => setPresetA(v as HePresetKey)}
          />
          <PresetPicker
            label="Strategy B (alternative)"
            value={presetB}
            onChange={(v) => setPresetB(v as HePresetKey)}
          />
          <div className="space-y-2">
            <Label className="text-xs">Horizon: {years} years</Label>
            <Slider
              value={[years]}
              onValueChange={([v]) => setYears(v)}
              min={5}
              max={50}
              step={1}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Confidence:{" "}
            <span
              className={
                confidence >= 0.7
                  ? "text-emerald-500 font-medium"
                  : confidence >= 0.4
                    ? "text-amber-500 font-medium"
                    : "text-destructive font-medium"
              }
            >
              {Math.round(confidence * 100)}%
            </span>
            {confidence < 0.7 && (
              <span className="ml-1">
                · fill in more profile fields for higher confidence
              </span>
            )}
          </div>
          <Button
            onClick={runComparison}
            disabled={isRunning || !hasProfile}
            size="sm"
          >
            {isRunning ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Run comparison
          </Button>
        </div>

        {/* Headline delta */}
        {projectionA.length > 0 && projectionB.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{headline}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ProjectionPanel
                  label={presetMetaA?.label ?? presetA}
                  color={presetMetaA?.color ?? "#94A3B8"}
                  finalValue={delta.finalA}
                  projection={projectionA}
                  peerMax={Math.max(delta.finalA, delta.finalB)}
                />
                <ProjectionPanel
                  label={presetMetaB?.label ?? presetB}
                  color={presetMetaB?.color ?? "#16A34A"}
                  finalValue={delta.finalB}
                  projection={projectionB}
                  peerMax={Math.max(delta.finalA, delta.finalB)}
                />
              </div>
              <div className="mt-4 rounded-lg border p-4 flex flex-wrap items-center gap-3">
                <div className="flex-shrink-0">
                  {delta.delta > 0 ? (
                    <ArrowUp className="w-6 h-6 text-emerald-500" />
                  ) : delta.delta < 0 ? (
                    <ArrowDown className="w-6 h-6 text-destructive" />
                  ) : (
                    <BarChart3 className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">
                    Delta over {delta.years} years
                  </div>
                  <div
                    className={`text-2xl font-bold tabular-nums ${
                      delta.delta > 0
                        ? "text-emerald-500"
                        : delta.delta < 0
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }`}
                  >
                    {delta.delta > 0 ? "+" : ""}
                    {formatCurrency(delta.delta)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">
                    % improvement
                  </div>
                  <div className="text-lg font-mono tabular-nums font-semibold">
                    {(delta.pctImprovement * 100).toFixed(0)}%
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {projectionA.length === 0 && hasProfile && !isRunning && (
          <div className="text-sm text-muted-foreground text-center py-8">
            Click "Run comparison" to project both strategies.
          </div>
        )}

        {(runA.error || runB.error) && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            {runA.error?.message ?? runB.error?.message}
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

function PresetPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: HePresetKey;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {HE_PRESET_REGISTRY.map((p) => (
            <SelectItem key={p.key} value={p.key}>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ background: p.color }}
                  aria-hidden="true"
                />
                <span>{p.label}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ProjectionPanel({
  label,
  color,
  finalValue,
  projection,
  peerMax,
}: {
  label: string;
  color: string;
  finalValue: number;
  projection: Array<{ year?: number; liquidWealth?: number }>;
  peerMax: number;
}) {
  const max = Math.max(peerMax, 1);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span
          className="inline-block w-3 h-3 rounded-full"
          style={{ background: color }}
          aria-hidden="true"
        />
        <span className="text-xs font-medium truncate" title={label}>
          {label}
        </span>
      </div>
      <div className="text-xl font-bold tabular-nums" style={{ color }}>
        {formatCurrency(finalValue)}
      </div>
      <div className="flex items-end gap-[2px] h-20">
        {projection.map((p, i) => {
          const v = p.liquidWealth ?? 0;
          const h = (v / max) * 100;
          return (
            <div
              key={i}
              className="flex-1 rounded-t-sm"
              style={{
                height: `${Math.max(2, h)}%`,
                background: color,
                opacity: 0.7,
              }}
              title={`Year ${p.year ?? i + 1}: ${formatCurrency(v)}`}
            />
          );
        })}
      </div>
    </div>
  );
}
