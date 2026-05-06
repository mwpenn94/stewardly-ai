/**
 * FormulasPage.tsx — Browse all formulas by discipline
 *
 * Pass 64c. Searchable, filterable listing of every formula imported
 * from EMBA modules. Expandable cards show variables. Discipline
 * color-coded badges. Audio companion integration for hands-free
 * formula review.
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
  ArrowLeft, FlaskConical, Search, ChevronDown, ChevronUp, Volume2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudioCompanion } from "@/components/AudioCompanion";

const DISCIPLINE_COLORS: Record<string, string> = {
  Accounting: "#4F46E5", Finance: "#059669", Economics: "#D97706",
  Marketing: "#DC2626", Management: "#7C3AED", Strategy: "#0891B2",
  Operations: "#EA580C", Statistics: "#6366F1", Ethics: "#BE185D",
  Leadership: "#0D9488", "Business Law": "#9333EA",
};

export default function FormulasPage() {
  const { isAuthenticated } = useAuth();
  const formulasQ = trpc.learning.content.listFormulas.useQuery(
    {},
    { enabled: !!isAuthenticated },
  );
  const [search, setSearch] = useState("");
  const [selectedDiscipline, setSelectedDiscipline] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { setItems: setAudioItems } = useAudioCompanion?.() ?? {};

  const formulas = formulasQ.data ?? [];

  const disciplines = useMemo(() => {
    const set = new Set<string>();
    formulas.forEach((f: any) => {
      if (f.disciplineName) set.add(f.disciplineName);
    });
    return Array.from(set).sort();
  }, [formulas]);

  const filtered = useMemo(() => {
    let list = formulas;
    if (selectedDiscipline !== "all") {
      list = list.filter((f: any) => f.disciplineName === selectedDiscipline);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (f: any) =>
          (f.name ?? "").toLowerCase().includes(q) ||
          (f.formula ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [formulas, selectedDiscipline, search]);

  if (!isAuthenticated) {
    return (
      <LearningShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-sm">
            <CardContent className="p-6 text-center space-y-3">
              <FlaskConical className="h-8 w-8 mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Sign in to browse formulas.</p>
              <a href={getLoginUrl()}>
                <Button size="sm">Sign In</Button>
              </a>
            </CardContent>
          </Card>
        </div>
      </LearningShell>
    );
  }

  return (
    <LearningShell>
      <SEOHead title="Formulas" description="Browse all financial formulas by discipline" />
      <div className="min-h-screen">
        {/* Header */}
        <div className="px-4 sm:px-6 lg:px-10 py-4 border-b border-border">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/learning">
              <motion.div whileHover={{ x: -2 }} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </motion.div>
            </Link>
            <FlaskConical className="w-5 h-5 text-primary" />
            <div>
              <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Formula Reference</h1>
              <p className="text-xs text-muted-foreground font-mono">{filtered.length} of {formulas.length} formulas</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search formulas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedDiscipline} onValueChange={setSelectedDiscipline}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Disciplines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Disciplines</SelectItem>
                {disciplines.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {setAudioItems && filtered.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setAudioItems(
                    filtered.map((f: any) => ({
                      id: `formula-${f.id}`,
                      text: `${f.name}. The formula is ${f.formula}. ${f.variables ? `Variables: ${JSON.parse(f.variables).join(", ")}.` : ""}`,
                    })),
                  )
                }
                title="Listen to formulas"
              >
                <Volume2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 lg:px-10 py-6">
          {formulasQ.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map((f: any, i: number) => {
                const color = DISCIPLINE_COLORS[f.disciplineName] || "var(--primary)";
                const isExpanded = expandedId === f.id;
                let variables: string[] = [];
                try {
                  variables = f.variables ? JSON.parse(f.variables) : [];
                } catch { /* ignore */ }

                return (
                  <motion.div
                    key={f.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.4) }}
                    className="rounded-xl border border-border bg-card overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : f.id)}
                      className="w-full text-left p-4"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-sm font-semibold pr-2">{f.name}</h3>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                      </div>
                      <p
                        className="text-sm font-mono px-3 py-2 rounded-lg bg-accent"
                        style={{ color }}
                      >
                        {f.formula}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-[10px]" style={{ borderColor: color, color }}>
                          {f.disciplineName ?? "General"}
                        </Badge>
                      </div>
                    </button>
                    <AnimatePresence>
                      {isExpanded && variables.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 border-t border-border/50 pt-3">
                            <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                              Variables
                            </h4>
                            <div className="flex flex-wrap gap-1.5">
                              {variables.map((v: string) => (
                                <span
                                  key={v}
                                  className="text-xs px-2 py-1 rounded-md border border-border bg-accent text-accent-foreground"
                                >
                                  {v}
                                </span>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
          {!formulasQ.isLoading && filtered.length === 0 && (
            <div className="text-center py-20">
              <FlaskConical className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No formulas match your search.</p>
            </div>
          )}
        </div>
      </div>
    </LearningShell>
  );
}
