/**
 * StudySession.tsx — Sequential flashcard study session
 *
 * Pass 64d. Provides a focused study mode where users go through
 * flashcards one at a time with flip animation, progress bar,
 * and self-rating (easy/medium/hard) for spaced repetition.
 */
import { useState, useCallback, useEffect } from "react";
import { useRoute, Link } from "wouter";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, RotateCcw, ChevronLeft, ChevronRight,
  ThumbsUp, Minus, ThumbsDown, BookOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Rating = "easy" | "medium" | "hard";

export default function StudySession() {
  const { isAuthenticated } = useAuth();
  const [, params] = useRoute("/learning/session/:trackSlug");
  const trackSlug = params?.trackSlug ?? "";

  const trackQ = trpc.learning.content.listTracks.useQuery(undefined, { enabled: !!isAuthenticated });
  const track = (trackQ.data ?? []).find((t: any) => t.slug === trackSlug);

  const flashcardsQ = trpc.learning.content.listFlashcardsForTrack.useQuery(
    { trackId: track?.id ?? 0 },
    { enabled: !!isAuthenticated && !!track?.id },
  );

  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState<Record<number, Rating>>({});
  const [sessionComplete, setSessionComplete] = useState(false);

  const cards = flashcardsQ.data ?? [];
  const total = cards.length;
  const current = cards[currentIdx];
  const pct = total > 0 ? Math.round(((currentIdx + (ratings[currentIdx] ? 1 : 0)) / total) * 100) : 0;

  const flip = useCallback(() => setFlipped((f) => !f), []);

  const rate = useCallback((r: Rating) => {
    setRatings((prev) => ({ ...prev, [currentIdx]: r }));
    setFlipped(false);
    if (currentIdx < total - 1) {
      setTimeout(() => setCurrentIdx((i) => i + 1), 200);
    } else {
      setSessionComplete(true);
    }
  }, [currentIdx, total]);

  const goBack = useCallback(() => {
    if (currentIdx > 0) {
      setFlipped(false);
      setCurrentIdx((i) => i - 1);
    }
  }, [currentIdx]);

  const restart = useCallback(() => {
    setCurrentIdx(0);
    setFlipped(false);
    setRatings({});
    setSessionComplete(false);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); }
      if (e.key === "1") rate("easy");
      if (e.key === "2") rate("medium");
      if (e.key === "3") rate("hard");
      if (e.key === "ArrowLeft") goBack();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [flip, rate, goBack]);

  if (!isAuthenticated) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-sm"><CardContent className="p-6 text-center space-y-3">
            <BookOpen className="h-8 w-8 mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Sign in to start a study session.</p>
            <a href={getLoginUrl()}><Button size="sm">Sign In</Button></a>
          </CardContent></Card>
        </div>
      </AppShell>
    );
  }

  const easyCount = Object.values(ratings).filter((r) => r === "easy").length;
  const medCount = Object.values(ratings).filter((r) => r === "medium").length;
  const hardCount = Object.values(ratings).filter((r) => r === "hard").length;

  return (
    <AppShell>
      <SEOHead title={`Study: ${track?.name ?? trackSlug}`} description="Flashcard study session" />
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 border-b border-border flex items-center gap-3">
          <Link href={track ? `/learning/tracks/${track.slug}` : "/learning"}>
            <motion.div whileHover={{ x: -2 }} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            </motion.div>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold truncate">{track?.name ?? "Study Session"}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Progress value={pct} className="h-1 flex-1" />
              <span className="text-[10px] font-mono text-muted-foreground">{currentIdx + 1}/{total}</span>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
          {flashcardsQ.isLoading || trackQ.isLoading ? (
            <Skeleton className="w-full max-w-lg h-64 rounded-2xl" />
          ) : total === 0 ? (
            <div className="text-center">
              <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No flashcards available for this track.</p>
              <Link href="/learning"><Button variant="outline" size="sm" className="mt-3">Back to Learning</Button></Link>
            </div>
          ) : sessionComplete ? (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-sm">
              <div className="text-5xl mb-4">🎉</div>
              <h2 className="text-xl font-bold mb-2">Session Complete!</h2>
              <p className="text-sm text-muted-foreground mb-4">You reviewed all {total} cards.</p>
              <div className="flex justify-center gap-4 mb-6">
                <div className="text-center">
                  <div className="text-lg font-bold text-green-500">{easyCount}</div>
                  <div className="text-[10px] text-muted-foreground">Easy</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-yellow-500">{medCount}</div>
                  <div className="text-[10px] text-muted-foreground">Medium</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-red-500">{hardCount}</div>
                  <div className="text-[10px] text-muted-foreground">Hard</div>
                </div>
              </div>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" size="sm" onClick={restart}><RotateCcw className="w-3.5 h-3.5 mr-1" /> Study Again</Button>
                <Link href={track ? `/learning/tracks/${track.slug}` : "/learning"}>
                  <Button size="sm">Done</Button>
                </Link>
              </div>
            </motion.div>
          ) : (
            <div className="w-full max-w-lg">
              {/* Flashcard */}
              <div className="perspective-1000 cursor-pointer mb-6" onClick={flip} role="button" tabIndex={0} aria-label={flipped ? "Show question" : "Show answer"}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${currentIdx}-${flipped}`}
                    initial={{ rotateY: 90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    exit={{ rotateY: -90, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <Card className={`min-h-[240px] flex items-center justify-center ${flipped ? "border-primary/30" : ""}`}>
                      <CardContent className="p-8 text-center">
                        <Badge variant="outline" className="text-[9px] mb-4">{flipped ? "ANSWER" : "QUESTION"}</Badge>
                        <p className="text-base leading-relaxed">{flipped ? (current?.back ?? current?.answer ?? "") : (current?.front ?? current?.question ?? "")}</p>
                        {!flipped && (
                          <p className="text-[10px] text-muted-foreground mt-4 font-mono">tap or press Space to flip</p>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={goBack} disabled={currentIdx === 0}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                {flipped && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => rate("easy")} className="text-green-500 hover:text-green-400 hover:border-green-500/30">
                      <ThumbsUp className="w-3.5 h-3.5 mr-1" /> Easy <span className="text-[9px] ml-1 opacity-50">1</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => rate("medium")} className="text-yellow-500 hover:text-yellow-400 hover:border-yellow-500/30">
                      <Minus className="w-3.5 h-3.5 mr-1" /> OK <span className="text-[9px] ml-1 opacity-50">2</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => rate("hard")} className="text-red-500 hover:text-red-400 hover:border-red-500/30">
                      <ThumbsDown className="w-3.5 h-3.5 mr-1" /> Hard <span className="text-[9px] ml-1 opacity-50">3</span>
                    </Button>
                  </motion.div>
                )}

                <Button variant="ghost" size="sm" onClick={() => { setFlipped(false); setCurrentIdx((i) => Math.min(i + 1, total - 1)); }} disabled={currentIdx >= total - 1}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
