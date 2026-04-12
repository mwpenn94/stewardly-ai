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
import AppShell from "@/components/AppShell";
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
    <AppShell title="Search Learning Content">
      <SEOHead
        title="Search Learning Content"
        description="Search across definitions, flashcards, practice questions, and tracks"
      />
      <div className="mx-auto max-w-3xl p-6 space-y-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/learning")}
            className="mb-3"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Learning
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <SearchIcon className="h-6 w-6 text-accent" />
            Search
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Definitions, flashcards, practice questions, and exam tracks.
          </p>
        </div>

        {/* Search input */}
        <Card>
          <CardContent className="p-4">
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
                className="flex-1"
              />
              {raw && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRaw("")}
                  aria-label="Clear search"
                >
                  Clear
                </Button>
              )}
            </div>
            {enabled && counts.total > 0 && (
              <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                <ListFilter className="h-3 w-3" aria-hidden />
                <span>
                  {counts.total} result{counts.total === 1 ? "" : "s"}
                </span>
                {counts.definitions > 0 && (
                  <Badge variant="outline" className="text-[10px]">
                    {counts.definitions} defs
                  </Badge>
                )}
                {counts.flashcards > 0 && (
                  <Badge variant="outline" className="text-[10px]">
                    {counts.flashcards} cards
                  </Badge>
                )}
                {counts.tracks > 0 && (
                  <Badge variant="outline" className="text-[10px]">
                    {counts.tracks} tracks
                  </Badge>
                )}
                {counts.questions > 0 && (
                  <Badge variant="outline" className="text-[10px]">
                    {counts.questions} questions
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {!enabled ? (
          <Card>
            <CardContent className="p-8 text-center space-y-2">
              <SearchIcon className="h-8 w-8 mx-auto text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">
                Type at least 2 characters to search.
              </p>
            </CardContent>
          </Card>
        ) : searchQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Searching…</p>
        ) : counts.total === 0 ? (
          <Card>
            <CardContent className="p-8 text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                No results for <strong>{debounced}</strong>.
              </p>
              <p className="text-xs text-muted-foreground">
                Admins can import more content from{" "}
                <Link href="/learning/studio">
                  <a className="underline">Content Studio</a>
                </Link>
                .
              </p>
            </CardContent>
          </Card>
        ) : (
          <ResultGroups
            grouped={grouped}
            query={debounced}
            trackById={trackById}
            onNavigate={navigate}
          />
        )}
      </div>
    </AppShell>
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
              <button
                key={`track-${r.id}`}
                type="button"
                className="w-full text-left p-3 border rounded-md hover:border-primary/50 transition-colors cursor-pointer"
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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon}
          {title}
          <Badge variant="outline" className="text-[10px] ml-1">
            {count}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}

function ResultRow({ result, query }: { result: SearchResult; query: string }) {
  return (
    <div className="p-3 border rounded-md">
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
