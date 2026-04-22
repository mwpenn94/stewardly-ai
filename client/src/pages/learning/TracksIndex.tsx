/**
 * TracksIndex.tsx — Browse all exam tracks
 *
 * Pass 64c. Categorized grid of all tracks with chapter counts,
 * flashcard counts, practice question counts, and progress bars.
 */
import { useMemo } from "react";
import { Link } from "wouter";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, BookOpen, GraduationCap,
} from "lucide-react";
import { motion } from "framer-motion";

const CATEGORY_META: Record<string, { label: string; color: string; desc: string }> = {
  securities: { label: "Securities", color: "#4F46E5", desc: "Securities licensing and investment exams" },
  planning: { label: "Financial Planning", color: "#059669", desc: "CFP, ChFC, and planning designations" },
  insurance: { label: "Insurance", color: "#D97706", desc: "Insurance licensing and designations" },
  custom: { label: "Custom", color: "#7C3AED", desc: "Custom and imported study tracks" },
};

export default function TracksIndex() {
  const { isAuthenticated } = useAuth();
  const tracksQ = trpc.learning.content.listTracks.useQuery(undefined, { enabled: !!isAuthenticated });

  const tracks = tracksQ.data ?? [];

  const categorized = useMemo(() => {
    const map: Record<string, any[]> = {};
    tracks.forEach((t: any) => {
      const cat = t.category ?? "custom";
      if (!map[cat]) map[cat] = [];
      map[cat].push(t);
    });
    return Object.entries(map).sort(([a], [b]) => {
      const order = ["securities", "planning", "insurance", "custom"];
      return order.indexOf(a) - order.indexOf(b);
    });
  }, [tracks]);

  if (!isAuthenticated) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-sm"><CardContent className="p-6 text-center space-y-3">
            <GraduationCap className="h-8 w-8 mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Sign in to browse exam tracks.</p>
            <a href={getLoginUrl()}><Button size="sm">Sign In</Button></a>
          </CardContent></Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <SEOHead title="Exam Tracks" description="Browse all exam tracks and study modules" />
      <div className="min-h-screen">
        <div className="px-4 sm:px-6 lg:px-10 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Link href="/learning">
              <motion.div whileHover={{ x: -2 }} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </motion.div>
            </Link>
            <GraduationCap className="w-5 h-5 text-primary" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">Exam Tracks</h1>
              <p className="text-xs text-muted-foreground font-mono">{tracks.length} tracks available</p>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 lg:px-10 py-6 space-y-8">
          {tracksQ.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}
            </div>
          ) : categorized.length === 0 ? (
            <div className="text-center py-20">
              <GraduationCap className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No tracks available yet.</p>
            </div>
          ) : (
            categorized.map(([cat, list], ci) => {
              const meta = CATEGORY_META[cat] ?? CATEGORY_META.custom;
              return (
                <motion.section key={cat} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: ci * 0.08 }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${meta.color}1a`, color: meta.color }}>
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold tracking-tight">{meta.label}</h2>
                      <p className="text-xs text-muted-foreground">{meta.desc}</p>
                    </div>
                    <span className="ml-auto text-xs font-mono text-muted-foreground">{list.length} {list.length === 1 ? "track" : "tracks"}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {list.map((track: any, i: number) => (
                      <motion.div key={track.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.3 }}>
                        <Link href={`/learning/tracks/${track.slug}`}>
                          <Card className="cursor-pointer group relative overflow-hidden hover:border-primary/30 transition-all h-full">
                            <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: meta.color }} />
                            <CardContent className="p-5">
                              <div className="flex items-start justify-between mb-3">
                                <span className="text-2xl" aria-hidden>{track.emoji ?? "📘"}</span>
                                <Badge variant="outline" className="text-[9px]">{track.category}</Badge>
                              </div>
                              <h3 className="text-sm font-semibold mb-1 group-hover:text-primary transition-colors">{track.name}</h3>
                              <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{track.subtitle ?? track.description ?? ""}</p>
                              <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-muted-foreground">
                                <div className="flex flex-col">
                                  <span className="text-foreground font-semibold">{track.chapterCount ?? 0}</span>
                                  <span>chapters</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-foreground font-semibold">{track.flashcardCount ?? 0}</span>
                                  <span>cards</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-foreground font-semibold">{track.questionCount ?? 0}</span>
                                  <span>questions</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                </motion.section>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}
