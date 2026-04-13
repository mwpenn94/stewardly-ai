/**
 * Comparables — competitive gap dashboard.
 *
 * Shipped by Pass 1 of the hybrid build loop, scope:
 * "best existing and planned comparables overall to stewardly repo
 * as an app per comprehensive guide".
 *
 * Renders the `/comparables` page for any signed-in user. Sections:
 *   1. Headline summary (overall pct, rank, band counts)
 *   2. Priority recommendations (axes Stewardly trails)
 *   3. Full gap matrix (per axis: Stewardly score, best external,
 *      top 3 leaders)
 *   4. Grouped catalog of all comparables by category
 *   5. Selected comparable deep-dive drawer
 *
 * Pure read-only view — no mutations. All data flows from
 * `trpc.comparables.*` which wraps the pure scoring helpers in
 * server/services/comparables/scoring.ts.
 */

import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BarChart3,
  ExternalLink,
  Sparkles,
  TrendingUp,
  Trophy,
  Compass,
  Award,
  Target,
  AlertTriangle,
  Info,
} from "lucide-react";
import { useState, useMemo } from "react";

// Score badge — 0..3 on the rubric, color-coded.
function ScoreBadge({ score }: { score: number }) {
  const tone =
    score === 0
      ? "bg-muted text-muted-foreground"
      : score === 1
        ? "bg-destructive/15 text-destructive"
        : score === 2
          ? "bg-chart-3/15 text-chart-3"
          : "bg-chart-2/15 text-chart-2";
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${tone}`}
      aria-label={`Score ${score} of 3`}
    >
      {score}/3
    </span>
  );
}

function BandBadge({
  band,
}: {
  band: "leading" | "parity" | "trailing" | "missing";
}) {
  const map = {
    leading: {
      label: "Leading",
      cls: "bg-chart-2/15 text-chart-2 border-chart-2/30",
      icon: <Trophy className="h-3 w-3" />,
    },
    parity: {
      label: "Parity",
      cls: "bg-muted text-muted-foreground border-border",
      icon: <Target className="h-3 w-3" />,
    },
    trailing: {
      label: "Trailing",
      cls: "bg-chart-3/15 text-chart-3 border-chart-3/30",
      icon: <AlertTriangle className="h-3 w-3" />,
    },
    missing: {
      label: "Missing",
      cls: "bg-destructive/15 text-destructive border-destructive/30",
      icon: <AlertTriangle className="h-3 w-3" />,
    },
  } as const;
  const m = map[band];
  return (
    <Badge
      variant="outline"
      className={`gap-1 border px-1.5 py-0 text-[11px] ${m.cls}`}
    >
      {m.icon}
      {m.label}
    </Badge>
  );
}

export default function ComparablesPage() {
  const axesQ = trpc.comparables.listAxes.useQuery(undefined, { staleTime: 300_000 });
  const summaryQ = trpc.comparables.summary.useQuery(undefined, { staleTime: 300_000 });
  const matrixQ = trpc.comparables.gapMatrix.useQuery(undefined, { staleTime: 300_000 });
  const rankingQ = trpc.comparables.ranking.useQuery(undefined, { staleTime: 300_000 });
  const prioritiesQ = trpc.comparables.priorities.useQuery({ limit: 8 }, { staleTime: 300_000 });
  const byCategoryQ = trpc.comparables.byCategory.useQuery(undefined, { staleTime: 300_000 });
  const appSummariesQ = trpc.comparables.appSummaries.useQuery(undefined, { staleTime: 300_000 });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedQ = trpc.comparables.getComparable.useQuery(
    { id: selectedId ?? "" },
    { enabled: !!selectedId },
  );

  const summary = summaryQ.data;
  const matrix = matrixQ.data ?? [];
  const ranking = rankingQ.data ?? [];
  const priorities = prioritiesQ.data ?? [];
  const categories = byCategoryQ.data ?? [];
  const appRows = appSummariesQ.data ?? [];

  const matrixSorted = useMemo(
    () => [...matrix].sort((a, b) => b.gap - a.gap),
    [matrix],
  );

  // If nothing loaded yet, show a light placeholder. We don't gate the
  // whole page because each card handles its own loading state.
  const isLoading =
    summaryQ.isLoading && matrixQ.isLoading && byCategoryQ.isLoading;

  const bandPct = summary
    ? {
        leading: Math.round(
          (summary.bands.leading / (axesQ.data?.length || 1)) * 100,
        ),
        parity: Math.round(
          (summary.bands.parity / (axesQ.data?.length || 1)) * 100,
        ),
        trailing: Math.round(
          (summary.bands.trailing / (axesQ.data?.length || 1)) * 100,
        ),
        missing: Math.round(
          (summary.bands.missing / (axesQ.data?.length || 1)) * 100,
        ),
      }
    : null;

  return (
    <AppShell title="Comparables">
      <SEOHead
        title="Comparables · Stewardly"
        description="Competitive gap dashboard — how Stewardly compares to other advisor AI and wealth platforms."
      />
      {/* Pass 8 accessibility audit: skip link + aria-live status region
          for data loading. Pairs with the existing tabIndex={-1} main. */}
      <a
        href="#comparables-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-foreground"
      >
        Skip to main content
      </a>
      <div role="status" aria-live="polite" className="sr-only">
        {isLoading
          ? "Loading competitive catalog."
          : summary
            ? `Comparables loaded. Stewardly is ranked ${summary.stewardlyRank} of ${ranking.length} with ${summary.overallPct}% overall depth.`
            : ""}
      </div>
      <main
        id="comparables-main"
        tabIndex={-1}
        className="mx-auto max-w-6xl space-y-6 p-6"
      >
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 font-heading text-2xl">
              <Compass className="h-6 w-6 text-accent" aria-hidden="true" />
              Comparables
            </h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              How Stewardly compares to the best existing and planned apps in
              the financial advisory space — scored on an 18-feature rubric
              drawn from the comprehensive platform guide.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Info className="h-3 w-3" />
              Rubric 0..3 per axis
            </Badge>
          </div>
        </header>

        {isLoading && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading competitive catalog…
            </CardContent>
          </Card>
        )}

        {/* ── 1. Headline summary ───────────────────────────────────── */}
        {summary && bandPct && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Overall</CardDescription>
                <CardTitle className="flex items-baseline gap-2 text-3xl">
                  {summary.overallPct}%
                  <span className="text-xs font-normal text-muted-foreground">
                    {summary.stewardlyTotal}/{summary.maxTotal}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={summary.overallPct} className="h-2" />
                <p className="mt-2 text-xs text-muted-foreground">
                  Sum of Stewardly scores across all feature axes.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Rank</CardDescription>
                <CardTitle className="text-3xl">
                  #{summary.stewardlyRank}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    of {ranking.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Among Stewardly + {ranking.length - 1} comparables on total
                  feature depth.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Leading / parity</CardDescription>
                <CardTitle className="text-3xl text-chart-2">
                  {summary.bands.leading + summary.bands.parity}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Leading</span>
                  <span className="tabular-nums">
                    {summary.bands.leading}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Parity</span>
                  <span className="tabular-nums">{summary.bands.parity}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Trailing / missing</CardDescription>
                <CardTitle className="text-3xl text-destructive">
                  {summary.bands.trailing + summary.bands.missing}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Trailing</span>
                  <span className="tabular-nums">
                    {summary.bands.trailing}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Missing</span>
                  <span className="tabular-nums">
                    {summary.bands.missing}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── 2. Priority recommendations ──────────────────────────── */}
        {priorities.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles
                  className="h-5 w-5 text-accent"
                  aria-hidden="true"
                />
                Priority build recommendations
              </CardTitle>
              <CardDescription>
                Axes where Stewardly trails the top comparable by the largest
                margin. Ordered by gap.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {priorities.map((p) => (
                <div
                  key={p.axis.id}
                  className="rounded-md border border-border bg-muted/20 p-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{p.axis.label}</h3>
                      <Badge
                        variant="outline"
                        className="border-destructive/30 bg-destructive/10 text-[11px] text-destructive"
                      >
                        Gap +{p.gap}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <ScoreBadge score={p.axis.stewardlyScore} />
                      <span>→</span>
                      <ScoreBadge score={p.axis.stewardlyScore + p.gap} />
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {p.reason}
                  </p>
                  <div
                    className="mt-2 flex flex-wrap gap-1.5"
                    role="group"
                    aria-label={`Comparables that ship ${p.axis.label}`}
                  >
                    {p.exemplars.map((ex) => (
                      <Button
                        key={ex.id}
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => setSelectedId(ex.id)}
                        aria-label={`Open ${ex.name} deep-dive — exemplar for ${p.axis.label}`}
                      >
                        {ex.name}
                      </Button>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Suggested path:{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                      {p.suggestedPath}
                    </code>
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* ── 3. Full gap matrix ─────────────────────────────────────── */}
        {matrixSorted.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3
                  className="h-5 w-5 text-accent"
                  aria-hidden="true"
                />
                Gap matrix
              </CardTitle>
              <CardDescription>
                One row per feature axis. Hover a comparable to see its
                strengths and gaps.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="pb-2 pr-3">Axis</th>
                      <th className="pb-2 pr-3">Band</th>
                      <th className="pb-2 pr-3">Stewardly</th>
                      <th className="pb-2 pr-3">Best external</th>
                      <th className="pb-2 pr-3">Gap</th>
                      <th className="pb-2">Top leaders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrixSorted.map((row) => {
                      const band =
                        row.stewardly === 0 && row.bestExternal >= 2
                          ? "missing"
                          : row.stewardly > row.bestExternal
                            ? "leading"
                            : row.stewardly === row.bestExternal
                              ? "parity"
                              : "trailing";
                      return (
                        <tr
                          key={row.axis.id}
                          className="border-b border-border/60 align-top"
                        >
                          <td className="py-2 pr-3">
                            <div className="font-medium">{row.axis.label}</div>
                            <div className="text-xs text-muted-foreground">
                              {row.axis.description}
                            </div>
                          </td>
                          <td className="py-2 pr-3">
                            <BandBadge band={band} />
                          </td>
                          <td className="py-2 pr-3">
                            <ScoreBadge score={row.stewardly} />
                          </td>
                          <td className="py-2 pr-3">
                            <ScoreBadge score={row.bestExternal} />
                          </td>
                          <td className="py-2 pr-3 tabular-nums">
                            {row.gap > 0 ? (
                              <span className="text-destructive">
                                +{row.gap}
                              </span>
                            ) : row.gap < 0 ? (
                              <span className="text-chart-2">{row.gap}</span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </td>
                          <td className="py-2">
                            <div className="flex flex-wrap gap-1">
                              {row.leaders.map((l) => (
                                <button
                                  key={l.app.id}
                                  type="button"
                                  onClick={() => setSelectedId(l.app.id)}
                                  aria-label={`Open ${l.app.name} deep-dive — scored ${l.score} of 3 on ${row.axis.label}`}
                                  className="rounded border border-border/60 px-1.5 py-0.5 text-[11px] text-muted-foreground hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                >
                                  {l.app.name}
                                  <span className="ml-1 tabular-nums" aria-hidden="true">
                                    {l.score}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── 4. Leaderboard across Stewardly + all comparables ───── */}
        {ranking.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp
                  className="h-5 w-5 text-accent"
                  aria-hidden="true"
                />
                Leaderboard
              </CardTitle>
              <CardDescription>
                Total feature depth — higher is broader feature surface area.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {ranking.slice(0, 12).map((row, idx) => (
                  <div
                    key={row.name + idx}
                    className={`flex items-center gap-3 rounded px-2 py-1 ${
                      row.isStewardly
                        ? "bg-accent/10 text-accent"
                        : ""
                    }`}
                  >
                    <span className="w-6 text-right font-mono text-xs tabular-nums text-muted-foreground">
                      #{idx + 1}
                    </span>
                    <span className="flex-1 text-sm font-medium">
                      {row.name}
                      {row.isStewardly && (
                        <Badge
                          variant="outline"
                          className="ml-2 border-accent/40 bg-accent/10 text-[10px] text-accent"
                        >
                          YOU
                        </Badge>
                      )}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {row.total} pts
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── 5. Catalog grouped by category ───────────────────────── */}
        {categories.length > 0 && (
          <div className="space-y-4">
            <h2 className="flex items-center gap-2 font-heading text-lg">
              <Award className="h-5 w-5 text-accent" aria-hidden="true" />
              Catalog
            </h2>
            {categories.map((group) => (
              <Card key={group.category}>
                <CardHeader>
                  <CardTitle className="text-base">{group.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {group.apps.map((app) => {
                      const total =
                        appRows.find((r) => r.app.id === app.id)?.totalScore ??
                        0;
                      const beats =
                        appRows.find((r) => r.app.id === app.id)
                          ?.beatsStewardlyOn ?? 0;
                      return (
                        <button
                          key={app.id}
                          type="button"
                          onClick={() => setSelectedId(app.id)}
                          aria-label={`Open ${app.name} deep-dive — ${total} total points, beats Stewardly on ${beats} axes, status ${app.status}`}
                          className="group flex flex-col gap-1 rounded-md border border-border bg-card p-3 text-left transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium group-hover:text-accent">
                              {app.name}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] uppercase"
                            >
                              {app.status}
                            </Badge>
                          </div>
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {app.pitch}
                          </p>
                          <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                            <span className="tabular-nums">{total} pts</span>
                            {beats > 0 && (
                              <span className="text-destructive">
                                Beats us on {beats}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* ── Deep-dive drawer ─────────────────────────────────────── */}
      <Dialog
        open={!!selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
      >
        <DialogContent className="max-w-2xl">
          {selectedQ.data ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedQ.data.name}
                  <Badge variant="outline" className="text-[11px] uppercase">
                    {selectedQ.data.status}
                  </Badge>
                  {selectedQ.data.url && (
                    <a
                      href={selectedQ.data.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto inline-flex items-center gap-1 text-xs text-accent"
                    >
                      <ExternalLink className="h-3 w-3" />
                      site
                    </a>
                  )}
                </DialogTitle>
                <DialogDescription>
                  {selectedQ.data.vendor} · since {selectedQ.data.since} ·{" "}
                  {selectedQ.data.pitch}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                    Strengths
                  </h4>
                  <ul className="ml-4 list-disc space-y-0.5">
                    {(selectedQ.data.strengths ?? []).map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
                {(selectedQ.data.gaps ?? []).length > 0 && (
                  <div>
                    <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                      Gaps
                    </h4>
                    <ul className="ml-4 list-disc space-y-0.5">
                      {(selectedQ.data.gaps ?? []).map((g) => (
                        <li key={g}>{g}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                    Feature scores
                  </h4>
                  <div className="grid gap-1">
                    {(selectedQ.data.features ?? []).map((f) => {
                      const axis = axesQ.data?.find((a) => a.id === f.axis);
                      if (!axis) return null;
                      return (
                        <div
                          key={f.axis}
                          className="flex items-center justify-between rounded border border-border/60 px-2 py-1"
                        >
                          <span>{axis.label}</span>
                          <div className="flex items-center gap-2">
                            <ScoreBadge score={f.score} />
                            <span className="text-[11px] text-muted-foreground">
                              Stewardly:{" "}
                            </span>
                            <ScoreBadge score={axis.stewardlyScore} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {selectedQ.data.sourceNotes && (
                  <p className="rounded border border-border/60 bg-muted/20 px-2 py-1 text-[11px] text-muted-foreground">
                    Source: {selectedQ.data.sourceNotes}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              Loading…
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
