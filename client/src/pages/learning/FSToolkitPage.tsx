/**
 * FSToolkitPage.tsx — Financial Statement Toolkit
 *
 * Pass 64c. Interactive checklist of FS applications imported from
 * EMBA modules. Users can track completion of each FS analysis skill.
 */
import { useState, useMemo } from "react";
import { Link } from "wouter";
import LearningShell from "@/components/LearningShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, FileSpreadsheet, CheckCircle2, Circle,
} from "lucide-react";
import { motion } from "framer-motion";

export default function FSToolkitPage() {
  const { isAuthenticated } = useAuth();
  const fsQ = trpc.learning.content.listFsApplications.useQuery({}, { enabled: !!isAuthenticated });
  const [completed, setCompleted] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem("wb-fs-toolkit-completed");
      return saved ? new Set(JSON.parse(saved)) : new Set<number>();
    } catch { return new Set<number>(); }
  });

  const toggle = (id: number) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem("wb-fs-toolkit-completed", JSON.stringify([...next]));
      return next;
    });
  };

  const apps = fsQ.data ?? [];
  const pct = apps.length > 0 ? Math.round((completed.size / apps.length) * 100) : 0;

  // Group by discipline
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    apps.forEach((a: any) => {
      const disc = a.disciplineName ?? "General";
      if (!map[disc]) map[disc] = [];
      map[disc].push(a);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [apps]);

  if (!isAuthenticated) {
    return (
      <LearningShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-sm"><CardContent className="p-6 text-center space-y-3">
            <FileSpreadsheet className="h-8 w-8 mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Sign in to access the FS Toolkit.</p>
            <a href={getLoginUrl()}><Button size="sm">Sign In</Button></a>
          </CardContent></Card>
        </div>
      </LearningShell>
    );
  }

  return (
    <LearningShell>
      <SEOHead title="FS Toolkit" description="Financial Statement applications toolkit" />
      <div className="min-h-screen">
        <div className="px-4 sm:px-6 lg:px-10 py-4 border-b border-border">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/learning">
              <motion.div whileHover={{ x: -2 }} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </motion.div>
            </Link>
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            <div>
              <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>FS Toolkit</h1>
              <p className="text-xs text-muted-foreground font-mono">{apps.length} applications</p>
            </div>
          </div>
          {apps.length > 0 && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>{completed.size}/{apps.length} completed</span>
                <span>{pct}%</span>
              </div>
              <Progress value={pct} className="h-1.5" />
            </div>
          )}
        </div>

        <div className="px-4 sm:px-6 lg:px-10 py-6 space-y-6">
          {fsQ.isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
          ) : grouped.length === 0 ? (
            <div className="text-center py-20">
              <FileSpreadsheet className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No FS applications available yet.</p>
            </div>
          ) : (
            grouped.map(([disc, items], gi) => (
              <motion.div key={disc} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: gi * 0.05 }}>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{disc}</Badge>
                      <span className="text-xs text-muted-foreground font-mono">
                        {items.filter((a: any) => completed.has(a.id)).length}/{items.length}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {items.map((a: any) => (
                      <button
                        key={a.id}
                        onClick={() => toggle(a.id)}
                        className="flex items-start gap-3 w-full text-left group p-2 rounded-lg hover:bg-accent/10 transition-colors"
                      >
                        {completed.has(a.id) ? (
                          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-green-500" />
                        ) : (
                          <Circle className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                        )}
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm font-medium ${completed.has(a.id) ? "line-through text-muted-foreground" : ""}`}>
                            {a.title}
                          </span>
                          {a.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.description}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </LearningShell>
  );
}
