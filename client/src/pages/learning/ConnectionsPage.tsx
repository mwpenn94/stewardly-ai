/**
 * ConnectionsPage.tsx — Browse cross-discipline connections
 *
 * Pass 64c. Filterable listing of concept connections between
 * disciplines. Grouped by source discipline with color-coded badges.
 * Separate from the d3-force ConnectionMap graph visualization.
 */
import { useState, useMemo } from "react";
import { Link } from "wouter";
import LearningShell from "@/components/LearningShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, ArrowRight, Network,
} from "lucide-react";
import { motion } from "framer-motion";

const DISC_COLORS: Record<string, string> = {
  Accounting: "#4F46E5", Finance: "#059669", Economics: "#D97706",
  Marketing: "#DC2626", Management: "#7C3AED", Strategy: "#0891B2",
  Operations: "#EA580C", Statistics: "#6366F1", Ethics: "#BE185D",
  Leadership: "#0D9488", "Business Law": "#9333EA",
};

export default function ConnectionsPage() {
  const { isAuthenticated } = useAuth();
  const connsQ = trpc.learning.content.listConnections.useQuery(undefined, { enabled: !!isAuthenticated });
  const [selectedDiscipline, setSelectedDiscipline] = useState("all");

  const connections = connsQ.data ?? [];

  const disciplines = useMemo(() => {
    const set = new Set<string>();
    connections.forEach((c: any) => {
      if (c.fromDiscipline) set.add(c.fromDiscipline);
      if (c.toDiscipline) set.add(c.toDiscipline);
    });
    return Array.from(set).sort();
  }, [connections]);

  const filtered = useMemo(() => {
    if (selectedDiscipline === "all") return connections;
    return connections.filter(
      (c: any) => c.fromDiscipline === selectedDiscipline || c.toDiscipline === selectedDiscipline,
    );
  }, [connections, selectedDiscipline]);

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    filtered.forEach((c: any) => {
      const key = c.fromDiscipline ?? "Unknown";
      if (!map[key]) map[key] = [];
      map[key].push(c);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  if (!isAuthenticated) {
    return (
      <LearningShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-sm"><CardContent className="p-6 text-center space-y-3">
            <Network className="h-8 w-8 mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Sign in to browse connections.</p>
            <a href={getLoginUrl()}><Button size="sm">Sign In</Button></a>
          </CardContent></Card>
        </div>
      </LearningShell>
    );
  }

  return (
    <LearningShell>
      <SEOHead title="Connections" description="Cross-discipline concept connections" />
      <div className="min-h-screen">
        <div className="px-4 sm:px-6 lg:px-10 py-4 border-b border-border">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/learning">
              <motion.div whileHover={{ x: -2 }} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </motion.div>
            </Link>
            <Network className="w-5 h-5 text-primary" />
            <div>
              <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Connections Map</h1>
              <p className="text-xs text-muted-foreground font-mono">{filtered.length} cross-discipline links</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={selectedDiscipline} onValueChange={setSelectedDiscipline}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Disciplines" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Disciplines</SelectItem>
                {disciplines.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Link href="/learning/connections">
              <Button variant="outline" size="sm">Open Graph View</Button>
            </Link>
          </div>
        </div>

        <div className="px-4 sm:px-6 lg:px-10 py-6 space-y-8">
          {connsQ.isLoading ? (
            <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
          ) : grouped.length === 0 ? (
            <div className="text-center py-20">
              <Network className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No connections found for this filter.</p>
            </div>
          ) : (
            grouped.map(([fromDisc, conns], gi) => (
              <motion.section key={fromDisc} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: gi * 0.05 }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full" style={{ background: DISC_COLORS[fromDisc] || "var(--primary)" }} />
                  <h2 className="text-base font-semibold">{fromDisc}</h2>
                  <span className="text-xs text-muted-foreground font-mono">({conns.length} links)</span>
                </div>
                <div className="space-y-2 pl-5 border-l-2" style={{ borderColor: DISC_COLORS[fromDisc] || "var(--border)" }}>
                  {conns.map((c: any, ci: number) => (
                    <motion.div
                      key={c.id ?? ci}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: gi * 0.05 + ci * 0.02 }}
                      className="p-4 rounded-xl border border-border bg-card"
                    >
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px]" style={{ borderColor: DISC_COLORS[c.fromDiscipline] || "var(--accent)", color: DISC_COLORS[c.fromDiscipline] || "inherit" }}>
                          {c.conceptFrom}
                        </Badge>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <Badge variant="outline" className="text-[10px]" style={{ borderColor: DISC_COLORS[c.toDiscipline] || "var(--accent)", color: DISC_COLORS[c.toDiscipline] || "inherit" }}>
                          {c.conceptTo}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{c.relationship}</p>
                      <div className="mt-2">
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {c.fromDiscipline} → {c.toDiscipline}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            ))
          )}
        </div>
      </div>
    </LearningShell>
  );
}
