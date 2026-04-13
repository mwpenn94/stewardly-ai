/**
 * EMBA Learning — Learning Home dashboard (Task 4B + 6D).
 *
 * Primary entry point for the Learning & Licensing section. Shows:
 *   - Mastery snapshot (overall pct, due now, streak)
 *   - License tracker summary (active, expiring)
 *   - Personalized study recommendations
 *   - Quick links to exam tracks, AI Quiz, Content Studio (advisor+)
 *
 * The dashboard is role-aware: users see recommendations, advisors
 * additionally see the Content Studio entry, admins see the
 * regulatory review queue.
 */

import { useEffect, useState, type ReactNode } from "react";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BookOpen, GraduationCap, Shield, Sparkles, TrendingUp, Brain, Award, ClipboardCheck, Scale, Flame, Search, ChevronDown, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import {
  loadStreakFromStorage,
  summarizeStreak,
  type StreakSummary,
} from "./lib/studyStreak";
import {
  loadRecentTracks,
  getRecentTracks,
  type RecentTrack,
} from "./lib/recentTracks";

export default function LearningHome() {
  const meQ = trpc.auth.me.useQuery();
  const summaryQ = trpc.learning.mastery.summary.useQuery();
  const licensesQ = trpc.learning.licenses.list.useQuery();
  const alertsQ = trpc.learning.licenses.alerts.useQuery();
  const recsQ = trpc.learning.recommendations.forMe.useQuery(undefined);
  const tracksQ = trpc.learning.content.listTracks.useQuery(undefined);

  // Pass 7 (build loop) — streak is read from localStorage on mount
  // and refreshed when the page regains focus so a fresh session
  // picks up days marked on another device / tab. Hooks live at
  // component top per React rules.
  const [streak, setStreak] = useState<StreakSummary>({
    current: 0,
    longest: 0,
    lastDay: null,
    status: "none",
  });
  const [recentTracks, setRecentTracks] = useState<RecentTrack[]>([]);
  useEffect(() => {
    const read = () => {
      setStreak(summarizeStreak(loadStreakFromStorage(), new Date()));
      setRecentTracks(getRecentTracks(loadRecentTracks(), 4));
    };
    read();
    const onFocus = () => read();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const role = meQ.data?.role ?? "user";
  const isAdvisorPlus = role === "advisor" || role === "manager" || role === "admin";
  const isAdmin = role === "admin";

  const summary = summaryQ.data;
  const licenses = licensesQ.data ?? [];
  const alerts = alertsQ.data ?? [];
  const recs = recsQ.data ?? [];
  const tracks = tracksQ.data ?? [];

  const hasError = summaryQ.isError || licensesQ.isError || tracksQ.isError;

  const activeLicenses = licenses.filter((l: any) => l.status === "active").length;
  const expiringSoon = alerts.filter((a: any) => a.alertType === "expiration_warning").length;

  return (
    <AppShell title="Learning">
      <SEOHead title="Learning & Licensing" description="Track exam mastery, manage licenses, and access study tools" />
      <div className="mx-auto max-w-6xl p-6 space-y-6">
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
              <GraduationCap className="h-8 w-8 text-accent" />
              Learning &amp; Licensing
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Track your progress across {tracks.length} exam tracks and {licenses.length} licenses.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/learning/search">
              <Button variant="outline" size="sm">
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </Link>
            <Link href="/learning/licenses">
              <Button variant="outline" size="sm">
                <Shield className="h-4 w-4 mr-2" />
                License Tracker
              </Button>
            </Link>
            {isAdvisorPlus && (
              <Link href="/learning/studio">
                <Button size="sm">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Content Studio
                </Button>
              </Link>
            )}
          </div>
        </header>

        {/* Error banner for failed queries */}
        {hasError && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="py-3 flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
              <span className="text-foreground/90">Some data failed to load.</span>
              <Button variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => { summaryQ.refetch(); licensesQ.refetch(); tracksQ.refetch(); }}>
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Snapshot row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Mastery</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{summary?.masteryPct ?? 0}%</div>
              <Progress value={summary?.masteryPct ?? 0} className="mt-2" />
              <div className="text-xs text-muted-foreground mt-2">
                {summary?.mastered ?? 0} mastered / {summary?.total ?? 0} tracked
              </div>
            </CardContent>
          </Card>

          <StreakCard streak={streak} />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Due Now</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{summary?.dueNow ?? 0}</div>
              <div className="text-xs text-muted-foreground mt-2">
                items ready for review across all tracks
              </div>
              <Link href="/learning/review">
                <Button
                  variant={summary?.dueNow ? "default" : "link"}
                  size="sm"
                  className={summary?.dueNow ? "mt-2" : "px-0 mt-1"}
                >
                  {summary?.dueNow ? (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" /> Start review session
                    </>
                  ) : (
                    <>Browse review →</>
                  )}
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Licenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{activeLicenses}</div>
              <div className="text-xs text-muted-foreground mt-2">
                {expiringSoon > 0 ? (
                  <span className="text-amber-600 dark:text-amber-400">{expiringSoon} expiring soon</span>
                ) : (
                  "all healthy"
                )}
              </div>
              <Link href="/learning/licenses">
                <Button variant="link" size="sm" className="px-0 mt-1">
                  View tracker →
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Continue Studying — recently visited tracks */}
        {recentTracks.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-5 w-5" />
                Continue Studying
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {recentTracks.map((rt) => {
                  const age = Math.round((Date.now() - rt.lastVisited) / 60000);
                  const ageStr = age < 60 ? `${age}m ago` : age < 1440 ? `${Math.round(age / 60)}h ago` : `${Math.round(age / 1440)}d ago`;
                  return (
                    <Link key={rt.slug} href={`/learning/tracks/${rt.slug}`}>
                      <Card className="card-lift cursor-pointer min-w-[160px] flex-shrink-0">
                        <CardContent className="p-3">
                          <div className="text-2xl">{rt.emoji}</div>
                          <div className="font-medium text-sm mt-1 line-clamp-1">{rt.name}</div>
                          <div className="text-[10px] text-muted-foreground mt-1">{ageStr}</div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Agent recommendations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Agent Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recs.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                You're all caught up. The agent will surface recommendations here as your mastery,
                calculator usage, and licensure state evolve.
              </div>
            ) : (
              <ul className="space-y-3">
                {recs.map((r, idx) => (
                  <li key={idx} className="flex items-start gap-3 p-3 rounded-md border">
                    <Badge variant="outline">P{r.priority}</Badge>
                    <div className="flex-1">
                      <div className="font-medium">{r.reason}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {r.action}
                        {r.estimatedMinutes ? ` · ${r.estimatedMinutes} min` : ""}
                        {r.trackSlug ? ` · track: ${r.trackSlug}` : ""}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Exam tracks grid */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Exam Tracks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tracksQ.isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {[1,2,3,4].map(i => (
                  <div key={i} className="h-32 rounded-lg bg-card/50 animate-pulse" />
                ))}
              </div>
            ) : tracks.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No tracks seeded yet. {isAdmin && "Run the admin seed from the Learning Studio."}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {tracks.map((t: any) => (
                  <Link key={t.id} href={`/learning/tracks/${t.slug}`}>
                    <Card className="card-lift cursor-pointer h-full">
                      <CardContent className="p-4">
                        <div className="text-2xl">{t.emoji ?? "📘"}</div>
                        <div className="font-semibold mt-2">{t.name}</div>
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {t.subtitle ?? t.description ?? ""}
                        </div>
                        <Badge variant="outline" className="mt-2 text-[10px]">
                          {t.category}
                        </Badge>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Learning tools — links to pass 120 sub-pages */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Learning Tools
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {tracks.length > 0 && (
                <ToolCardWithTrackPicker
                  icon={<ClipboardCheck className="h-6 w-6 text-primary" />}
                  title="Practice Exam"
                  description="Timed, adaptive, or audio mode"
                  tracks={tracks}
                  buildHref={(slug) => `/learning/exam/${slug}`}
                />
              )}
              {tracks.length > 0 && (
                <ToolCardWithTrackPicker
                  icon={<BookOpen className="h-6 w-6 text-primary" />}
                  title="Deep Dive"
                  description="Definitions, formulas, cases"
                  tracks={tracks}
                  buildHref={(slug) => `/learning/discipline/${slug}`}
                />
              )}
              {tracks.length > 0 && (
                <ToolCardWithTrackPicker
                  icon={<Scale className="h-6 w-6 text-primary" />}
                  title="Case Studies"
                  description="Branching scenario decisions"
                  tracks={tracks}
                  buildHref={(slug) => `/learning/case/${slug}`}
                />
              )}
              <Link href="/learning/connections">
                <Card className="card-lift cursor-pointer h-full">
                  <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                    <Brain className="h-6 w-6 text-primary" />
                    <div className="text-sm font-medium">Concept Map</div>
                    <div className="text-[10px] text-muted-foreground">Visual concept graph</div>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/learning/achievements">
                <Card className="card-lift cursor-pointer h-full">
                  <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                    <Award className="h-6 w-6 text-primary" />
                    <div className="text-sm font-medium">Achievements</div>
                    <div className="text-[10px] text-muted-foreground">Streaks, goals, milestones</div>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Admin: regulatory review queue link */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Regulatory Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link href="/learning/studio/review">
                <Button variant="outline" size="sm">
                  Review pending regulatory updates
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

// ─── Pass 7 (build loop) — Study streak card ──────────────────────────────
//
// Reads from the pure `studyStreak` module's localStorage snapshot.
// Tone shifts to amber when the streak is "at risk" (user studied
// yesterday but not yet today) and muted when broken. The CLAUDE.md
// docstring has promised a streak since pass 58 — this is the UI.

function StreakCard({ streak }: { streak: StreakSummary }) {
  const isActive = streak.status === "active";
  const isAtRisk = streak.status === "at-risk";
  const isNone = streak.status === "none";
  const isBroken = streak.status === "broken";

  const tone = isActive
    ? "text-accent"
    : isAtRisk
      ? "text-amber-600 dark:text-amber-400"
      : "text-muted-foreground";

  const label = isNone
    ? "Start a streak"
    : isActive
      ? "day streak"
      : isAtRisk
        ? "day streak — study today to keep it"
        : "day streak — last session";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Flame className={`h-4 w-4 ${tone}`} aria-hidden />
          Streak
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-3xl font-semibold ${tone}`}>{streak.current}</div>
        <div className="text-xs text-muted-foreground mt-2">{label}</div>
        {streak.longest > 0 && (
          <div className="text-[11px] text-muted-foreground mt-1">
            longest {streak.longest}
            {streak.lastDay && isBroken && ` · last ${streak.lastDay}`}
          </div>
        )}
        {isAtRisk && (
          <Link href="/learning/review">
            <Button variant="link" size="sm" className="px-0 mt-1 text-amber-600">
              Save your streak →
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

/** Learning tool card with an inline track picker — replaces the old hardcoded
 *  first-track-only links so users can access exams, deep dives, and case
 *  studies for ANY imported track. Tapping the card opens a track list;
 *  tapping a track navigates to the tool for that track. */
function ToolCardWithTrackPicker({ icon, title, description, tracks, buildHref }: {
  icon: ReactNode;
  title: string;
  description: string;
  tracks: { slug: string; name: string; emoji?: string | null }[];
  buildHref: (slug: string) => string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="card-lift cursor-pointer h-full" onClick={() => setOpen(!open)}>
      <CardContent className="p-4 flex flex-col items-center text-center gap-2">
        {icon}
        <div className="text-sm font-medium">{title}</div>
        <div className="text-[10px] text-muted-foreground">{description}</div>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        {open && (
          <div className="w-full mt-1 space-y-1 text-left" onClick={(e) => e.stopPropagation()}>
            {tracks.map(t => (
              <Link key={t.slug} href={buildHref(t.slug)}>
                <button className="w-full text-left px-2 py-1.5 rounded-md text-xs hover:bg-secondary/60 transition-colors truncate">
                  {t.emoji && <span className="mr-1">{t.emoji}</span>}
                  {t.name}
                </button>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
