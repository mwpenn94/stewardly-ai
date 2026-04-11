/**
 * Rebalancing — portfolio drift preview page.
 *
 * Shipped by Pass 3 of the hybrid build loop — closes the UI side of
 * PARITY-REBAL-0003. The underlying math is the pure drift engine in
 * `server/services/portfolio/rebalancing.ts` shipped in Pass 2.
 *
 * This page is intentionally a manual-entry preview tool: the advisor
 * types (or pastes) a holdings table + target allocation, and the
 * engine returns drift rows + cash-neutral trade proposals. Live
 * ingestion from Plaid / custodian APIs is still PARITY-REBAL-0002.
 *
 * Accessibility:
 *   - Skip-to-main link + focusable main region
 *   - Keyboard navigation for add/remove rows (tab order preserved)
 *   - aria-labels on icon-only remove buttons
 *   - aria-live status region announces drift results on update
 *   - Inputs use semantic <label> elements
 */

import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Scale,
  Plus,
  Trash2,
  PlayCircle,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useState, useMemo, useCallback } from "react";

interface HoldingRow {
  id: string;
  name: string;
  marketValue: string;
  longTermGainLossUSD: string;
  isCash: boolean;
}

interface TargetRow {
  id: string;
  targetPct: string;
}

const DEFAULT_HOLDINGS: HoldingRow[] = [
  { id: "VTI", name: "US Total Market", marketValue: "60000", longTermGainLossUSD: "", isCash: false },
  { id: "VXUS", name: "International", marketValue: "25000", longTermGainLossUSD: "", isCash: false },
  { id: "BND", name: "US Bond", marketValue: "10000", longTermGainLossUSD: "", isCash: false },
  { id: "CASH", name: "Cash", marketValue: "5000", longTermGainLossUSD: "", isCash: true },
];

const DEFAULT_TARGETS: TargetRow[] = [
  { id: "VTI", targetPct: "60" },
  { id: "VXUS", targetPct: "20" },
  { id: "BND", targetPct: "15" },
  { id: "CASH", targetPct: "5" },
];

function fmtUSD(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPct(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}pp`;
}

export default function RebalancingPage() {
  const [holdings, setHoldings] = useState<HoldingRow[]>(DEFAULT_HOLDINGS);
  const [targets, setTargets] = useState<TargetRow[]>(DEFAULT_TARGETS);
  const [driftThreshold, setDriftThreshold] = useState(5);
  const [cashBufferPct, setCashBufferPct] = useState(0);
  const [taxAware, setTaxAware] = useState(false);
  const [newCashUSD, setNewCashUSD] = useState("");

  // Only include valid rows in the payload.
  const payload = useMemo(() => {
    const cleanHoldings = holdings
      .filter((h) => h.id.trim().length > 0)
      .map((h) => ({
        id: h.id.trim(),
        name: h.name.trim() || h.id.trim(),
        marketValue: Number.parseFloat(h.marketValue) || 0,
        longTermGainLossUSD: h.longTermGainLossUSD
          ? Number.parseFloat(h.longTermGainLossUSD)
          : undefined,
        isCash: h.isCash || undefined,
      }));
    const cleanTargets = targets
      .filter((t) => t.id.trim().length > 0)
      .map((t) => ({
        id: t.id.trim(),
        targetPct: Number.parseFloat(t.targetPct) || 0,
      }));
    return {
      holdings: cleanHoldings,
      targets: cleanTargets,
      options: {
        driftThreshold,
        cashBufferPct,
        taxAware,
      },
    };
  }, [holdings, targets, driftThreshold, cashBufferPct, taxAware]);

  const newCashNum = Number.parseFloat(newCashUSD);
  const hasNewCash = Number.isFinite(newCashNum) && newCashNum > 0;

  const driftQ = trpc.rebalancing.simulate.useQuery(payload, {
    enabled: !hasNewCash && payload.holdings.length > 0 && payload.targets.length > 0,
  });
  const newCashQ = trpc.rebalancing.simulateNewCash.useQuery(
    { ...payload, newCashUSD: hasNewCash ? newCashNum : 0 },
    { enabled: hasNewCash && payload.holdings.length > 0 && payload.targets.length > 0 },
  );

  const result = hasNewCash ? newCashQ.data : driftQ.data;
  const isLoading = hasNewCash ? newCashQ.isLoading : driftQ.isLoading;

  // ── Row editing helpers ────────────────────────────────────────

  const updateHolding = useCallback(
    (idx: number, patch: Partial<HoldingRow>) => {
      setHoldings((prev) =>
        prev.map((h, i) => (i === idx ? { ...h, ...patch } : h)),
      );
    },
    [],
  );
  const removeHolding = useCallback((idx: number) => {
    setHoldings((prev) => prev.filter((_, i) => i !== idx));
  }, []);
  const addHolding = useCallback(() => {
    setHoldings((prev) => [
      ...prev,
      {
        id: "",
        name: "",
        marketValue: "0",
        longTermGainLossUSD: "",
        isCash: false,
      },
    ]);
  }, []);

  const updateTarget = useCallback(
    (idx: number, patch: Partial<TargetRow>) => {
      setTargets((prev) =>
        prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)),
      );
    },
    [],
  );
  const removeTarget = useCallback((idx: number) => {
    setTargets((prev) => prev.filter((_, i) => i !== idx));
  }, []);
  const addTarget = useCallback(() => {
    setTargets((prev) => [...prev, { id: "", targetPct: "0" }]);
  }, []);

  const totalTargetPct = targets.reduce(
    (s, t) => s + (Number.parseFloat(t.targetPct) || 0),
    0,
  );
  const targetsValid = Math.abs(totalTargetPct - 100) <= 0.5;

  // ── Status announcement for screen readers ───────────────────
  const statusText = useMemo(() => {
    if (isLoading) return "Computing drift…";
    if (!result) return "";
    if (result.status === "balanced") return "Portfolio is balanced. No trades required.";
    if (result.status === "mild_drift")
      return `Mild drift detected. ${result.sleevesInDrift} sleeves in drift, ${result.proposals.length} trade proposals.`;
    return `Rebalance needed. ${result.sleevesInDrift} sleeves in drift, ${result.proposals.length} trade proposals.`;
  }, [isLoading, result]);

  return (
    <AppShell>
      <SEOHead
        title="Rebalancing · Stewardly"
        description="Portfolio drift preview with cash-neutral trade proposals and optional tax-aware sell ordering."
      />
      <a
        href="#rebalancing-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-foreground"
      >
        Skip to main content
      </a>
      <main
        id="rebalancing-main"
        tabIndex={-1}
        className="mx-auto max-w-6xl space-y-6 p-6"
      >
        <header>
          <h1 className="flex items-center gap-2 font-heading text-2xl">
            <Scale className="h-6 w-6 text-accent" aria-hidden="true" />
            Rebalancing preview
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Enter holdings and target allocation to see drift, cash-neutral
            trade proposals, and optional tax-aware sell ordering. Pure
            compute — no data is saved.
          </p>
        </header>

        {/* ── Holdings + targets form ─────────────────────────────── */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Holdings</CardTitle>
                <CardDescription>
                  Each row is a position. Mark one as cash (or name it
                  CASH) so the cash buffer rule works.
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={addHolding}
                aria-label="Add holding row"
              >
                <Plus className="mr-1 h-3 w-3" aria-hidden="true" />
                Add
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {holdings.map((h, i) => (
                <div
                  key={i}
                  className="grid grid-cols-12 items-center gap-1.5 rounded border border-border/60 p-2"
                >
                  <div className="col-span-3">
                    <Label htmlFor={`h-id-${i}`} className="sr-only">
                      Holding id
                    </Label>
                    <Input
                      id={`h-id-${i}`}
                      value={h.id}
                      onChange={(e) => updateHolding(i, { id: e.target.value })}
                      placeholder="VTI"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="col-span-4">
                    <Label htmlFor={`h-name-${i}`} className="sr-only">
                      Holding name
                    </Label>
                    <Input
                      id={`h-name-${i}`}
                      value={h.name}
                      onChange={(e) => updateHolding(i, { name: e.target.value })}
                      placeholder="Name"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor={`h-mv-${i}`} className="sr-only">
                      Market value in USD
                    </Label>
                    <Input
                      id={`h-mv-${i}`}
                      value={h.marketValue}
                      onChange={(e) => updateHolding(i, { marketValue: e.target.value })}
                      placeholder="0"
                      inputMode="decimal"
                      className="h-8 text-right text-sm tabular-nums"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor={`h-ltg-${i}`} className="sr-only">
                      Long-term gain loss in USD
                    </Label>
                    <Input
                      id={`h-ltg-${i}`}
                      value={h.longTermGainLossUSD}
                      onChange={(e) => updateHolding(i, { longTermGainLossUSD: e.target.value })}
                      placeholder="LT G/L"
                      inputMode="decimal"
                      className="h-8 text-right text-sm tabular-nums"
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeHolding(i)}
                      aria-label={`Remove holding ${h.id || i + 1}`}
                      className="h-7 w-7"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">
                  Target allocation
                  <Badge
                    variant="outline"
                    className={`ml-2 text-[11px] ${targetsValid ? "border-chart-2/40 text-chart-2" : "border-destructive/40 text-destructive"}`}
                  >
                    {totalTargetPct.toFixed(1)}%
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Must sum to 100%. Sleeves not listed here will be
                  treated as sell-all.
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={addTarget}
                aria-label="Add target row"
              >
                <Plus className="mr-1 h-3 w-3" aria-hidden="true" />
                Add
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {targets.map((t, i) => (
                <div
                  key={i}
                  className="grid grid-cols-12 items-center gap-1.5 rounded border border-border/60 p-2"
                >
                  <div className="col-span-8">
                    <Label htmlFor={`t-id-${i}`} className="sr-only">
                      Target holding id
                    </Label>
                    <Input
                      id={`t-id-${i}`}
                      value={t.id}
                      onChange={(e) => updateTarget(i, { id: e.target.value })}
                      placeholder="VTI"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="col-span-3">
                    <Label htmlFor={`t-pct-${i}`} className="sr-only">
                      Target percentage
                    </Label>
                    <Input
                      id={`t-pct-${i}`}
                      value={t.targetPct}
                      onChange={(e) => updateTarget(i, { targetPct: e.target.value })}
                      placeholder="0"
                      inputMode="decimal"
                      className="h-8 text-right text-sm tabular-nums"
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeTarget(i)}
                      aria-label={`Remove target ${t.id || i + 1}`}
                      className="h-7 w-7"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* ── Options ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PlayCircle
                className="h-4 w-4 text-accent"
                aria-hidden="true"
              />
              Options
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-1">
                <Label htmlFor="drift-threshold" className="text-xs">
                  Drift threshold (pp)
                </Label>
                <Input
                  id="drift-threshold"
                  value={driftThreshold}
                  onChange={(e) =>
                    setDriftThreshold(Number.parseFloat(e.target.value) || 0)
                  }
                  inputMode="decimal"
                  className="h-8 text-sm tabular-nums"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cash-buffer" className="text-xs">
                  Cash buffer (% of cash)
                </Label>
                <Input
                  id="cash-buffer"
                  value={cashBufferPct}
                  onChange={(e) =>
                    setCashBufferPct(Number.parseFloat(e.target.value) || 0)
                  }
                  inputMode="decimal"
                  className="h-8 text-sm tabular-nums"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-cash" className="text-xs">
                  New cash deposit (optional)
                </Label>
                <Input
                  id="new-cash"
                  value={newCashUSD}
                  onChange={(e) => setNewCashUSD(e.target.value)}
                  placeholder="0"
                  inputMode="decimal"
                  className="h-8 text-sm tabular-nums"
                />
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Switch
                  id="tax-aware"
                  checked={taxAware}
                  onCheckedChange={setTaxAware}
                  aria-label="Tax-aware sell ordering"
                />
                <Label htmlFor="tax-aware" className="text-xs">
                  Tax-aware sells
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Results ─────────────────────────────────────────────── */}
        <div
          role="status"
          aria-live="polite"
          className="sr-only"
        >
          {statusText}
        </div>

        {result && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Drift summary</CardTitle>
                <CardDescription>
                  Total ${result.totalValueUSD.toLocaleString()} ·{" "}
                  {result.sleevesInDrift} sleeves in drift · status{" "}
                  <Badge
                    variant="outline"
                    className={
                      result.status === "balanced"
                        ? "border-chart-2/40 text-chart-2"
                        : result.status === "mild_drift"
                          ? "border-chart-3/40 text-chart-3"
                          : "border-destructive/40 text-destructive"
                    }
                  >
                    {result.status.replace("_", " ")}
                  </Badge>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-left uppercase text-[10px] text-muted-foreground">
                      <th className="py-1 pr-2">Holding</th>
                      <th className="py-1 pr-2 text-right">Actual</th>
                      <th className="py-1 pr-2 text-right">Target</th>
                      <th className="py-1 pr-2 text-right">Drift</th>
                      <th className="py-1 text-right">$ Gap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.drift.map((row) => (
                      <tr
                        key={row.holding.id}
                        className={`border-b border-border/50 ${row.inDrift ? "text-destructive" : ""}`}
                      >
                        <td className="py-1 pr-2 font-medium">
                          {row.holding.name}
                        </td>
                        <td className="py-1 pr-2 text-right tabular-nums">
                          {row.actualPct.toFixed(1)}%
                        </td>
                        <td className="py-1 pr-2 text-right tabular-nums text-muted-foreground">
                          {row.targetPct.toFixed(1)}%
                        </td>
                        <td className="py-1 pr-2 text-right tabular-nums">
                          {fmtPct(row.driftPct)}
                        </td>
                        <td className="py-1 text-right tabular-nums">
                          {fmtUSD(row.dollarGap)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.warnings.length > 0 && (
                  <div
                    role="alert"
                    className="mt-3 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive"
                  >
                    <div className="flex items-center gap-1 font-semibold">
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      Warnings
                    </div>
                    <ul className="mt-1 ml-4 list-disc space-y-0.5">
                      {result.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Trade proposals</CardTitle>
                <CardDescription>
                  Cash-neutral — total sell equals total buy.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {result.proposals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No trades required — portfolio within threshold.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {result.proposals.map((p) => (
                      <li
                        key={`${p.side}-${p.holdingId}-${p.rank}`}
                        className="rounded border border-border/60 px-2 py-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            {p.side === "sell" ? (
                              <TrendingDown
                                className="h-3 w-3 text-destructive"
                                aria-hidden="true"
                              />
                            ) : (
                              <TrendingUp
                                className="h-3 w-3 text-chart-2"
                                aria-hidden="true"
                              />
                            )}
                            <span className="font-medium">
                              {p.side.toUpperCase()} {p.holdingName}
                            </span>
                          </div>
                          <span className="tabular-nums">
                            {fmtUSD(p.amountUSD)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {p.reason}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </AppShell>
  );
}
