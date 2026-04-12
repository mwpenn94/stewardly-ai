/**
 * QuickQuoteHub — single entry point for every product-line quick
 * quote in Stewardly. Reads the saved financial profile via
 * useFinancialProfile, ranks the registry by fitness against that
 * profile, and renders:
 *
 *   1. A "Recommended for you" row with the top-4 highest-fit
 *      shipped quotes (driven by recommendQuotes()).
 *   2. A category-tabbed grid of every quote in the registry,
 *      grouped by Wealth / Protection / Income / Tax / Estate /
 *      Business. Coming-soon tiles are rendered with a faded
 *      "Coming soon" badge so users see the full roadmap.
 *
 * The "scope" filter at the top lets advisors / managers / stewards
 * see flows that are gated to their layer (e.g., business income
 * for advisors+).
 *
 * Pass 5 history: ships gap G6 from docs/PARITY.md.
 */

import { useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import {
  Sparkles,
  Scale,
  Briefcase,
  PiggyBank,
  TrendingUp,
  Building2,
  DollarSign,
  Calculator,
  Shield,
  Heart,
  GraduationCap,
  HandCoins,
  Clock,
  Zap,
  ArrowRight,
  Library,
  History,
} from "lucide-react";
import { useFinancialProfile } from "@/hooks/useFinancialProfile";
import { FinancialProfileBanner } from "@/components/financial-profile/FinancialProfileBanner";
import { ProfileLibraryPanel } from "@/components/financial-profile/ProfileLibraryPanel";
import { RunTimelinePanel } from "@/components/financial-profile/RunTimelinePanel";
import { useRunTimeline } from "@/hooks/useRunTimeline";
import {
  QUICK_QUOTE_REGISTRY,
  groupQuotesByCategory,
  recommendQuotes,
  visibleQuotes,
  type QuickQuoteCategory,
  type QuickQuoteEntry,
} from "./quickQuoteRegistry";

const ICON_MAP: Record<string, React.ReactNode> = {
  Sparkles: <Sparkles className="w-4 h-4" />,
  Scale: <Scale className="w-4 h-4" />,
  Briefcase: <Briefcase className="w-4 h-4" />,
  PiggyBank: <PiggyBank className="w-4 h-4" />,
  TrendingUp: <TrendingUp className="w-4 h-4" />,
  Building2: <Building2 className="w-4 h-4" />,
  DollarSign: <DollarSign className="w-4 h-4" />,
  Calculator: <Calculator className="w-4 h-4" />,
  Shield: <Shield className="w-4 h-4" />,
  Heart: <Heart className="w-4 h-4" />,
  GraduationCap: <GraduationCap className="w-4 h-4" />,
  HandCoins: <HandCoins className="w-4 h-4" />,
};

const CATEGORY_META: Record<QuickQuoteCategory, { label: string; icon: React.ReactNode }> = {
  wealth: { label: "Wealth", icon: <Sparkles className="w-3 h-3" /> },
  protection: { label: "Protection", icon: <Shield className="w-3 h-3" /> },
  income: { label: "Income", icon: <PiggyBank className="w-3 h-3" /> },
  tax: { label: "Tax", icon: <DollarSign className="w-3 h-3" /> },
  estate: { label: "Estate", icon: <Briefcase className="w-3 h-3" /> },
  business: { label: "Business", icon: <Building2 className="w-3 h-3" /> },
};

type ScopeKey = "user" | "advisor" | "manager" | "steward";

export default function QuickQuoteHubPage() {
  const [, navigate] = useLocation();
  const { profile, hasProfile, completenessStatus } = useFinancialProfile();
  const [scope, setScope] = useState<ScopeKey>("user");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const { stats: timelineStatsData } = useRunTimeline();

  const visible = useMemo(() => visibleQuotes(scope), [scope]);
  const grouped = useMemo(() => groupQuotesByCategory(visible), [visible]);
  const recommendations = useMemo(
    () => recommendQuotes(profile, scope, 4),
    [profile, scope],
  );

  return (
    <AppShell title="Quick Quote Hub">
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <header className="space-y-1">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-accent" />
                <h1 className="text-2xl font-bold">Quick Quote Hub</h1>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Every product-line quote in one place. Recommendations are
                ranked against your saved profile.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ScopePicker scope={scope} onChange={setScope} />
              <button
                type="button"
                onClick={() => setTimelineOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1 text-xs hover:border-accent/40 hover:text-accent transition-colors"
                aria-label="Open run timeline"
              >
                <History className="w-3 h-3" />
                Timeline
                {timelineStatsData.totalRuns > 0 && (
                  <Badge variant="outline" className="h-3.5 px-1 text-[9px] font-mono">
                    {timelineStatsData.totalRuns}
                  </Badge>
                )}
              </button>
              {scope !== "user" && (
                <button
                  type="button"
                  onClick={() => setLibraryOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1 text-xs hover:border-accent/40 hover:text-accent transition-colors"
                  aria-label="Open profile library"
                >
                  <Library className="w-3 h-3" />
                  Library
                </button>
              )}
            </div>
          </div>
        </header>

        <ProfileLibraryPanel open={libraryOpen} onClose={() => setLibraryOpen(false)} />
        <RunTimelinePanel open={timelineOpen} onClose={() => setTimelineOpen(false)} />

        <FinancialProfileBanner
          onPrefill={() => undefined}
          actionLabel="Refresh recommendations"
          hideWhenEmpty={false}
        />

        {/* Recommended row */}
        {recommendations.length > 0 && (
          <section aria-labelledby="recommended-heading">
            <h2
              id="recommended-heading"
              className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-3 flex items-center gap-2"
            >
              <Sparkles className="w-3 h-3 text-accent" />
              Recommended for you
              {hasProfile && (
                <Badge variant="outline" className="text-[10px] h-4 px-1">
                  {completenessStatus.label}
                </Badge>
              )}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {recommendations.map((q) => (
                <QuoteTile
                  key={q.id}
                  entry={q}
                  highlighted
                  onOpen={() => navigate(q.route)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Category-tabbed grid */}
        <section aria-labelledby="all-quotes-heading">
          <h2
            id="all-quotes-heading"
            className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-3"
          >
            All quick quotes
          </h2>
          <Tabs defaultValue="wealth">
            <TabsList className="flex-wrap h-auto">
              {(Object.keys(CATEGORY_META) as QuickQuoteCategory[]).map((cat) => (
                <TabsTrigger
                  key={cat}
                  value={cat}
                  disabled={grouped[cat].length === 0}
                  className="gap-1.5"
                >
                  {CATEGORY_META[cat].icon}
                  {CATEGORY_META[cat].label}
                  {grouped[cat].length > 0 && (
                    <Badge variant="outline" className="ml-1 h-4 px-1 text-[10px]">
                      {grouped[cat].length}
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
            {(Object.keys(CATEGORY_META) as QuickQuoteCategory[]).map((cat) => (
              <TabsContent key={cat} value={cat} className="mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {grouped[cat].map((q) => (
                    <QuoteTile
                      key={q.id}
                      entry={q}
                      onOpen={() => navigate(q.route)}
                    />
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </section>

        <p className="text-[10px] text-muted-foreground text-center pt-4">
          Quotes are illustrative projections, not advice. Consult a licensed
          financial professional before acting on any output.
        </p>
      </div>
    </AppShell>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

function ScopePicker({
  scope,
  onChange,
}: {
  scope: ScopeKey;
  onChange: (s: ScopeKey) => void;
}) {
  const scopes: ScopeKey[] = ["user", "advisor", "manager", "steward"];
  return (
    <div
      role="radiogroup"
      aria-label="Visibility scope"
      className="inline-flex rounded-md border border-border/60 p-0.5 text-xs"
    >
      {scopes.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={scope === s}
          onClick={() => onChange(s)}
          className={`px-2.5 py-1 rounded capitalize transition-colors ${
            scope === s
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function QuoteTile({
  entry,
  onOpen,
  highlighted,
}: {
  entry: QuickQuoteEntry;
  onOpen: () => void;
  highlighted?: boolean;
}) {
  const icon = ICON_MAP[entry.icon] ?? <Sparkles className="w-4 h-4" />;
  return (
    <Card
      className={`card-lift transition-colors ${
        highlighted
          ? "border-accent/40 bg-accent/5"
          : entry.shipped
            ? "hover:border-accent/30"
            : "opacity-60"
      }`}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-accent flex-shrink-0">{icon}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{entry.title}</p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <Clock className="w-2.5 h-2.5" />
                {entry.estimatedMinutes} min
              </p>
            </div>
          </div>
          {!entry.shipped && (
            <Badge variant="outline" className="text-[9px] h-4 px-1">
              Coming soon
            </Badge>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
          {entry.description}
        </p>
        <button
          type="button"
          onClick={onOpen}
          disabled={!entry.shipped}
          className="w-full text-left text-xs text-accent hover:text-accent/80 transition-colors flex items-center justify-between gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>{entry.shipped ? "Open quote" : "Notify me"}</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </CardContent>
    </Card>
  );
}
