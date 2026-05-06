/**
 * EMBA Learning — Content Search page (pass 8, build loop).
 *
 * Before this pass, the 366+ definitions imported from
 * `mwpenn94/emba_modules` were only reachable via a deep drill into
 * a specific track → chapter → subsection. A learner who remembered
 * the term "IRMAA" or "Sharpe ratio" but not which track it lived
 * in had no way to find it.
 *
 * This page exposes the `learning.content.search` tRPC procedure as
 * a real UI. It:
 *
 *   1. Debounces the query 200ms so we don't hammer the API on
 *      every keystroke.
 *   2. Runs the server search, then ranks + groups results
 *      client-side via the pure `searchRank.ts` module.
 *   3. Renders results grouped by content type (Definitions,
 *      Flashcards, Tracks, Questions) with highlighted matches.
 *   4. Clicking a Track result deep-links to its detail page.
 *      Clicking any other result expands inline to show the full
 *      body.
 *
 * Everything else stays static — no client-side state for the
 * actual content since the ranked results are derivable.
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import LearningShell from "@/components/LearningShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search as SearchIcon,
  ArrowLeft,
  BookOpen,
  FileText,
  Sparkles,
  HelpCircle,
  ListFilter,
} from "lucide-react";
import {
  rankSearchResults,
  groupByType,
  highlightMatches,
  countsByType,
  type SearchResult,
  type HighlightSegment,
  type GroupedResults,
} from "./lib/searchRank";

// ─── Page ────────────────────────────────────────────────────────────────

export default function LearningSearch() {
  const [, navigate] = useLocation();
  const [raw, setRaw] = useState("");
  const [debounced, setDebounced] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // 200ms debounce — long enough to avoid thrashing the API,
  // short enough to feel instant to a typing user.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(raw.trim()), 200);
    return () => clearTimeout(id);
  }, [raw]);

  const enabled = debounced.length >= 2;
  const searchQ = trpc.learning.content.search.useQuery(
    { query: debounced, limit: 50 },
    { enabled, refetchOnWindowFocus: false },
  );

  const ranked = useMemo(
    () => rankSearchResults((searchQ.data ?? []) as SearchResult[], debounced),
    [searchQ.data, debounced],
  );
  const grouped = useMemo(() => groupByType(ranked), [ranked]);
  const counts = useMemo(() => countsByType(grouped), [grouped]);

  const tracksQ = trpc.learning.content.listTracks.useQuery(undefined);
  const trackById = useMemo(() => {
    const m = new Map<number, { slug: string; name: string }>();
    for (const t of tracksQ.data ?? []) {
      m.set((t as any).id, {
        slug: (t as any).slug,
        name: (t as any).name,
      });
    }
    return m;
  }, [tracksQ.data]);

  return (
    <LearningShell title="Search Learning Content">
      <SEOHead
        title="Search Learning Content"
        description="Search across definitions, flashcards, practice questions, and tracks"
      />
      <div className="mx-auto max-w-3xl p-6 space-y-5">
        {/* KE-style sticky header */}
        <div className="sticky top-0 z-10 -mx-6 px-6 py-3 backdrop-blur-md bg-background/80 border-b border-border">
          <button
            type="button"
            onClick={() => navigate("/learning")}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Learning
          </button>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
            <SearchIcon className="h-6 w-6 text-primary" />
            Search
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">
            Definitions · Flashcards · Practice Questions · Exam Tracks
          </p>
        </div>

        {/* KE-style search input card */}
        <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm overflow-hidden">
          <div className="p-4">
            <div className="flex items-center gap-2">
              <SearchIcon
                className="h-4 w-4 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                placeholder="Try 'IRMAA', 'Sharpe ratio', 'duration'..."
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                autoFocus
                aria-label="Search learning content"
                className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              {raw && (
                <button
                  type="button"
                  onClick={() => setRaw("")}
                  aria-label="Clear search"
                  className="text-xs text-muted-foreground hover:text-foreground cursor-pointer px-2 py-1 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            {enabled && counts.total > 0 && (
              <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground flex-wrap">
                <ListFilter className="h-3 w-3 shrink-0" aria-hidden />
                <button
                  onClick={() => setActiveFilter(null)}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-colors cursor-pointer ${
                    !activeFilter ? "bg-primary text-primary-foreground" : "bg-muted/50 hover:bg-muted text-muted-foreground"
                  }`}
                >
                  All ({counts.total})
                </button>
                {counts.definitions > 0 && (
                  <button
                    onClick={() => setActiveFilter(activeFilter === "definitions" ? null : "definitions")}
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-colors cursor-pointer ${
                      activeFilter === "definitions" ? "bg-primary text-primary-foreground" : "bg-muted/50 hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    Definitions ({counts.definitions})
                  </button>
                )}
                {counts.flashcards > 0 && (
                  <button
                    onClick={() => setActiveFilter(activeFilter === "flashcards" ? null : "flashcards")}
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-colors cursor-pointer ${
                      activeFilter === "flashcards" ? "bg-primary text-primary-foreground" : "bg-muted/50 hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    Flashcards ({counts.flashcards})
                  </button>
                )}
                {counts.tracks > 0 && (
                  <button
                    onClick={() => setActiveFilter(activeFilter === "tracks" ? null : "tracks")}
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-colors cursor-pointer ${
                      activeFilter === "tracks" ? "bg-primary text-primary-foreground" : "bg-muted/50 hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    Tracks ({counts.tracks})
                  </button>
                )}
                {counts.questions > 0 && (
                  <button
                    onClick={() => setActiveFilter(activeFilter === "questions" ? null : "questions")}
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-colors cursor-pointer ${
                      activeFilter === "questions" ? "bg-primary text-primary-foreground" : "bg-muted/50 hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    Questions ({counts.questions})
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        {!enabled ? (
          <div className="rounded-2xl border border-border bg-card/60 p-10 text-center space-y-3">
            <SearchIcon className="h-10 w-10 mx-auto text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              Type at least 2 characters to search.
            </p>
            <p className="text-[10px] font-mono text-muted-foreground/50">Ctrl+K to focus</p>
          </div>
        ) : searchQ.isLoading ? (
          <div className="flex items-center gap-2 py-8 justify-center">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Searching…</span>
          </div>
        ) : counts.total === 0 ? (
          <div className="rounded-2xl border border-border bg-card/60 p-10 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              No results for <strong className="text-foreground">{debounced}</strong>.
            </p>
            <p className="text-xs text-muted-foreground">
              Admins can import more content from{" "}
              <Link href="/learning/studio" className="text-primary hover:underline">Content Studio</Link>.
            </p>
          </div>
        ) : (
          <ResultGroups
            grouped={activeFilter ? {
              definitions: activeFilter === "definitions" ? grouped.definitions : [],
              flashcards: activeFilter === "flashcards" ? grouped.flashcards : [],
              tracks: activeFilter === "tracks" ? grouped.tracks : [],
              questions: activeFilter === "questions" ? grouped.questions : [],
              other: !activeFilter ? grouped.other : [],
            } : grouped}
            query={debounced}
            trackById={trackById}
            onNavigate={navigate}
          />
        )}
      </div>
    </LearningShell>
  );
}

// ─── Result groups ────────────────────────────────────────────────────────

function ResultGroups({
  grouped,
  query,
  trackById,
  onNavigate,
}: {
  grouped: GroupedResults;
  query: string;
  trackById: Map<number, { slug: string; name: string }>;
  onNavigate: (path: string) => void;
}) {
  return (
    <div className="space-y-4">
      {grouped.definitions.length > 0 && (
        <ResultSection
          icon={<FileText className="h-4 w-4" />}
          title="Definitions"
          count={grouped.definitions.length}
        >
          {grouped.definitions.slice(0, 20).map((r) => (
            <ResultRow key={`def-${r.id}`} result={r} query={query} />
          ))}
        </ResultSection>
      )}
      {grouped.flashcards.length > 0 && (
        <ResultSection
          icon={<Sparkles className="h-4 w-4" />}
          title="Flashcards"
          count={grouped.flashcards.length}
        >
          {grouped.flashcards.slice(0, 20).map((r) => (
            <ResultRow key={`fc-${r.id}`} result={r} query={query} />
          ))}
        </ResultSection>
      )}
      {grouped.tracks.length > 0 && (
        <ResultSection
          icon={<BookOpen className="h-4 w-4" />}
          title="Exam Tracks"
          count={grouped.tracks.length}
        >
          {grouped.tracks.slice(0, 10).map((r) => {
            const meta = trackById.get(r.id);
            return (
              <button type="button"
                key={`track-${r.id}`}
                className="w-full text-left p-3 rounded-xl border border-border/50 hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => {
                  if (meta?.slug) onNavigate(`/learning/tracks/${meta.slug}`);
                }}
                aria-label={`Open ${r.title}`}
              >
                <div className="font-medium text-sm">
                  <HighlightedText text={r.title} query={query} />
                </div>
                {r.snippet && (
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    <HighlightedText text={r.snippet} query={query} />
                  </div>
                )}
              </button>
            );
          })}
        </ResultSection>
      )}
      {grouped.questions.length > 0 && (
        <ResultSection
          icon={<HelpCircle className="h-4 w-4" />}
          title="Practice Questions"
          count={grouped.questions.length}
        >
          {grouped.questions.slice(0, 15).map((r) => (
            <ResultRow key={`q-${r.id}`} result={r} query={query} />
          ))}
        </ResultSection>
      )}
    </div>
  );
}

function ResultSection({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/80 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <div className="text-primary">{icon}</div>
        <span className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>{title}</span>
        <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">{count}</span>
      </div>
      <div className="p-3 space-y-2">{children}</div>
    </div>
  );
}

function ResultRow({ result, query }: { result: SearchResult; query: string }) {
  return (
    <div className="p-3 rounded-xl border border-border/50 hover:border-primary/30 transition-colors">
      <div className="font-medium text-sm">
        <HighlightedText text={result.title} query={query} />
      </div>
      {result.snippet && (
        <div className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-3">
          <HighlightedText text={result.snippet} query={query} />
        </div>
      )}
    </div>
  );
}

// ─── Highlighted text ─────────────────────────────────────────────────────
//
// Renders `<mark>` around matches without touching innerHTML.
// Pure derivation via `highlightMatches` from searchRank.ts.

function HighlightedText({ text, query }: { text: string; query: string }) {
  const segs: HighlightSegment[] = useMemo(
    () => highlightMatches(text, query),
    [text, query],
  );
  return (
    <>
      {segs.map((s, i) =>
        s.matched ? (
          <mark
            key={i}
            className="bg-accent/25 text-foreground rounded px-0.5"
          >
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}
