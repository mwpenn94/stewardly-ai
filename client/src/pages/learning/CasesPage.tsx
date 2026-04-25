/**
 * CasesPage.tsx — Browse all case studies by discipline
 *
 * Pass 64c. Lists every imported case study with discipline badges,
 * difficulty indicators, and direct launch into CaseStudySimulator.
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Scale, Search, ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "#22C55E", intermediate: "#EAB308", advanced: "#EF4444",
};

export default function CasesPage() {
  const { isAuthenticated } = useAuth();
  const casesQ = trpc.learning.content.listCases.useQuery({}, { enabled: !!isAuthenticated });
  const [search, setSearch] = useState("");
  const [selectedDiscipline, setSelectedDiscipline] = useState("all");

  const cases = casesQ.data ?? [];

  const disciplines = useMemo(() => {
    const set = new Set<string>();
    cases.forEach((c: any) => { if (c.disciplineName) set.add(c.disciplineName); });
    return Array.from(set).sort();
  }, [cases]);

  const filtered = useMemo(() => {
    let list = cases;
    if (selectedDiscipline !== "all") list = list.filter((c: any) => c.disciplineName === selectedDiscipline);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c: any) => (c.title ?? "").toLowerCase().includes(q) || (c.scenario ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [cases, selectedDiscipline, search]);

  if (!isAuthenticated) {
    return (
      <LearningShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-sm"><CardContent className="p-6 text-center space-y-3">
            <Scale className="h-8 w-8 mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Sign in to browse case studies.</p>
            <a href={getLoginUrl()}><Button size="sm">Sign In</Button></a>
          </CardContent></Card>
        </div>
      </LearningShell>
    );
  }

  return (
    <LearningShell>
      <SEOHead title="Case Studies" description="Browse financial case studies" />
      <div className="min-h-screen">
        <div className="px-4 sm:px-6 lg:px-10 py-4 border-b border-border">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/learning">
              <motion.div whileHover={{ x: -2 }} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </motion.div>
            </Link>
            <Scale className="w-5 h-5 text-primary" />
            <div>
              <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Case Studies</h1>
              <p className="text-xs text-muted-foreground font-mono">{filtered.length} of {cases.length} cases</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search cases..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={selectedDiscipline} onValueChange={setSelectedDiscipline}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Disciplines" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Disciplines</SelectItem>
                {disciplines.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="px-4 sm:px-6 lg:px-10 py-6">
          {casesQ.isLoading ? (
            <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
          ) : (
            <div className="space-y-3">
              {filtered.map((c: any, i: number) => {
                const diff = (c.difficulty ?? "intermediate").toLowerCase();
                const diffColor = DIFFICULTY_COLORS[diff] ?? "#6B7280";
                return (
                  <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
                    <Link href={`/learning/case/${c.id}`}>
                      <Card className="cursor-pointer hover:border-primary/30 transition-all">
                        <CardContent className="p-4 flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold mb-1">{c.title}</h3>
                            <p className="text-xs text-muted-foreground line-clamp-2">{c.scenario}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-[10px]">{c.disciplineName ?? "General"}</Badge>
                              <span className="text-[10px] font-mono" style={{ color: diffColor }}>{diff}</span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
          {!casesQ.isLoading && filtered.length === 0 && (
            <div className="text-center py-20">
              <Scale className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No case studies match your search.</p>
            </div>
          )}
        </div>
      </div>
    </LearningShell>
  );
}
