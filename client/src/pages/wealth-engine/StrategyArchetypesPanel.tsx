/**
 * StrategyArchetypesPanel — Interactive explorer for 10 strategy archetypes,
 * 12 strategy categories, leader personas, cross-archetype comparison,
 * client-to-archetype matching, and archetype-to-tool mapping.
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Loader2, Target, Users, BarChart3, BookOpen, ArrowRight, CheckCircle2, AlertTriangle, Zap, Shield, TrendingUp } from "lucide-react";

const RISK_COLORS: Record<string, string> = {
  low: "text-emerald-400",
  moderate: "text-amber-400",
  high: "text-orange-400",
  very_high: "text-red-400",
};

export default function StrategyArchetypesPanel() {
  const [activeTab, setActiveTab] = useState("archetypes");
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [clientId, setClientId] = useState("");

  const archetypesQ = trpc.planningHierarchy.getAllArchetypes.useQuery();
  const categoriesQ = trpc.planningHierarchy.getAllStrategyCategories.useQuery();
  const detailQ = trpc.planningHierarchy.getArchetypeToolMapping.useQuery(
    { archetypeId: selectedArchetype ?? "" },
    { enabled: !!selectedArchetype }
  );
  const compareQ = trpc.planningHierarchy.compareArchetypes.useQuery(
    { archetypeIds: compareIds },
    { enabled: compareIds.length >= 2 }
  );
  const matchQ = trpc.planningHierarchy.matchClientToArchetypes.useQuery(
    { clientId: parseInt(clientId) || 0 },
    { enabled: !!clientId && parseInt(clientId) > 0 }
  );

  const archetypes = archetypesQ.data ?? [];
  const categories = categoriesQ.data ?? [];

  const toggleCompare = (id: string) => {
    setCompareIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  };

  return (
    <div className="space-y-6 p-4">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" /> Strategy Archetypes & Leader Personas
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Explore 10 financial services strategy archetypes with leader personas, 12 strategy categories,
          cross-archetype comparison, and client-to-archetype matching.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="archetypes" className="gap-1 text-xs"><Users className="w-3 h-3" /> Archetypes</TabsTrigger>
          <TabsTrigger value="categories" className="gap-1 text-xs"><BookOpen className="w-3 h-3" /> Strategy Categories</TabsTrigger>
          <TabsTrigger value="compare" className="gap-1 text-xs"><BarChart3 className="w-3 h-3" /> Compare</TabsTrigger>
          <TabsTrigger value="match" className="gap-1 text-xs"><Target className="w-3 h-3" /> Client Match</TabsTrigger>
          <TabsTrigger value="detail" className="gap-1 text-xs"><Zap className="w-3 h-3" /> Tool Mapping</TabsTrigger>
        </TabsList>

        {/* ── ARCHETYPES TAB ── */}
        <TabsContent value="archetypes" className="space-y-4">
          {archetypesQ.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading archetypes...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {archetypes.map(a => (
                <Card key={a.id} className="bg-card/60 border-accent/10 hover:border-primary/20 transition-colors cursor-pointer"
                  onClick={() => { setSelectedArchetype(a.id); setActiveTab("detail"); }}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{a.name}</CardTitle>
                      <Badge variant="outline" className="text-[9px]">{a.riskLevel}</Badge>
                    </div>
                    <CardDescription className="text-[11px]">{a.leaderPersona}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-xs italic text-muted-foreground">"{a.coreBelief}"</p>
                    <div className="flex flex-wrap gap-1">
                      {a.strengths.slice(0, 3).map(s => (
                        <Badge key={s} variant="secondary" className="text-[9px]">{s}</Badge>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center text-[10px]">
                      <div className="rounded bg-background/50 p-1">
                        <p className="text-muted-foreground">Risk</p>
                        <p className={`font-semibold ${RISK_COLORS[a.riskLevel]}`}>{a.riskLevel}</p>
                      </div>
                      <div className="rounded bg-background/50 p-1">
                        <p className="text-muted-foreground">Horizon</p>
                        <p className="font-semibold">{a.timeHorizon}</p>
                      </div>
                      <div className="rounded bg-background/50 p-1">
                        <p className="text-muted-foreground">Complexity</p>
                        <p className="font-semibold">{a.complexityLevel}/5</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-muted-foreground">Min AUM: ${(a.minimumAUM / 1000).toFixed(0)}K</span>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2"
                          onClick={(e) => { e.stopPropagation(); toggleCompare(a.id); }}>
                          {compareIds.includes(a.id) ? <CheckCircle2 className="w-3 h-3 text-primary" /> : "Compare"}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 gap-1">
                          Details <ArrowRight className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {compareIds.length >= 2 && (
            <Button size="sm" onClick={() => setActiveTab("compare")} className="gap-1">
              <BarChart3 className="w-3.5 h-3.5" /> Compare {compareIds.length} Archetypes
            </Button>
          )}
        </TabsContent>

        {/* ── STRATEGY CATEGORIES TAB ── */}
        <TabsContent value="categories" className="space-y-4">
          {categoriesQ.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading categories...</div>
          ) : (
            categories.map(cat => (
              <Card key={cat.id} className="bg-card/60 border-accent/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{cat.name}</CardTitle>
                  <CardDescription className="text-[11px]">{cat.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {cat.strategies.map(s => (
                      <div key={s.name} className="rounded-lg bg-background/50 p-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-xs font-medium">{s.name}</p>
                            <p className="text-[10px] text-muted-foreground">{s.description}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {s.applicableArchetypes.map(aId => {
                            const arch = archetypes.find(a => a.id === aId);
                            return arch ? (
                              <Badge key={aId} variant="outline" className="text-[8px] cursor-pointer hover:bg-primary/15"
                                onClick={() => { setSelectedArchetype(aId); setActiveTab("detail"); }}>
                                {arch.leaderName}
                              </Badge>
                            ) : null;
                          })}
                        </div>
                        {s.examples.length > 0 && (
                          <div className="mt-1 text-[9px] text-muted-foreground italic">
                            Examples: {s.examples.join(" | ")}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ── COMPARE TAB ── */}
        <TabsContent value="compare" className="space-y-4">
          <div className="flex flex-wrap gap-2 mb-3">
            {archetypes.map(a => (
              <Badge key={a.id}
                variant={compareIds.includes(a.id) ? "default" : "outline"}
                className="cursor-pointer text-[10px]"
                onClick={() => toggleCompare(a.id)}>
                {a.leaderName}
              </Badge>
            ))}
          </div>
          {compareIds.length < 2 ? (
            <p className="text-sm text-muted-foreground">Select at least 2 archetypes to compare.</p>
          ) : compareQ.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Comparing...</div>
          ) : compareQ.data ? (
            <div className="space-y-4">
              {/* Comparison Matrix */}
              <Card className="bg-card/60 border-accent/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Comparison Matrix</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left p-1.5 font-medium">Dimension</th>
                          {compareQ.data.archetypes.map(a => (
                            <th key={a.id} className="text-center p-1.5 font-medium">{a.leaderName}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {compareQ.data.comparisonMatrix.map(row => (
                          <tr key={row.dimension} className="border-b border-border/20">
                            <td className="p-1.5 text-muted-foreground">{row.dimension}</td>
                            {compareQ.data!.archetypes.map(a => (
                              <td key={a.id} className="p-1.5 text-center">{String(row.values[a.id] ?? "—")}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Client Fit Matrix */}
              <Card className="bg-card/60 border-accent/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Client Fit Matrix</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left p-1.5 font-medium">Client Profile</th>
                          {compareQ.data.archetypes.map(a => (
                            <th key={a.id} className="text-center p-1.5 font-medium">{a.leaderName}</th>
                          ))}
                          <th className="text-center p-1.5 font-medium">Best Fit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {compareQ.data.clientFitMatrix.map(row => (
                          <tr key={row.clientProfile} className="border-b border-border/20">
                            <td className="p-1.5 text-muted-foreground max-w-[150px] truncate">{row.clientProfile}</td>
                            {compareQ.data!.archetypes.map(a => (
                              <td key={a.id} className="p-1.5 text-center">
                                <span className={row.scores[a.id] >= 70 ? "text-emerald-400 font-semibold" : row.scores[a.id] >= 50 ? "text-amber-400" : "text-muted-foreground"}>
                                  {row.scores[a.id]}
                                </span>
                              </td>
                            ))}
                            <td className="p-1.5 text-center font-semibold text-primary">{row.bestFit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Impact Projections */}
              <Card className="bg-card/60 border-accent/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Impact Projections (Hypothetical)</CardTitle>
                  <CardDescription className="text-[10px]">Illustrative ranges — not guarantees. Actual results depend on market conditions and implementation.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left p-1.5 font-medium">Metric</th>
                          {compareQ.data.archetypes.map(a => (
                            <th key={a.id} className="text-center p-1.5 font-medium">{a.leaderName}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {compareQ.data.impactProjections.map(row => (
                          <tr key={row.metric} className="border-b border-border/20">
                            <td className="p-1.5 text-muted-foreground">{row.metric}</td>
                            {compareQ.data!.archetypes.map(a => {
                              const p = row.projections[a.id];
                              return (
                                <td key={a.id} className="p-1.5 text-center text-[10px]">
                                  {p ? `${p.low.toFixed(0)}–${p.high.toFixed(0)}` : "—"}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </TabsContent>

        {/* ── CLIENT MATCH TAB ── */}
        <TabsContent value="match" className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Enter Client ID"
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              className="w-40 h-8 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">Match a client's profile to the best-fit strategy archetypes</p>
          </div>
          {matchQ.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Matching...</div>
          ) : matchQ.data ? (
            <div className="space-y-3">
              {matchQ.data.map((m, i) => (
                <Card key={m.archetype.id} className={`bg-card/60 ${i === 0 ? "border-primary/25" : "border-accent/10"}`}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {i === 0 && <Badge className="bg-primary text-primary-foreground text-[9px]">Best Match</Badge>}
                        <span className="text-sm font-medium">{m.archetype.name}</span>
                        <span className="text-[10px] text-muted-foreground">({m.archetype.leaderName})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-16 h-1.5 rounded-full bg-background/50 overflow-hidden">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${m.fitScore}%` }} />
                        </div>
                        <span className="text-xs font-semibold">{m.fitScore}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {m.reasoning.map((r, j) => (
                        <div key={j} className="flex items-start gap-1 text-[10px] text-muted-foreground">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                          <span>{r}</span>
                        </div>
                      ))}
                    </div>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] mt-2 gap-1"
                      onClick={() => { setSelectedArchetype(m.archetype.id); setActiveTab("detail"); }}>
                      View Details <ArrowRight className="w-3 h-3" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : clientId ? (
            <p className="text-sm text-muted-foreground">Enter a valid client ID to see archetype matches.</p>
          ) : null}
        </TabsContent>

        {/* ── TOOL MAPPING TAB ── */}
        <TabsContent value="detail" className="space-y-4">
          <div className="flex flex-wrap gap-2 mb-3">
            {archetypes.map(a => (
              <Badge key={a.id}
                variant={selectedArchetype === a.id ? "default" : "outline"}
                className="cursor-pointer text-[10px]"
                onClick={() => setSelectedArchetype(a.id)}>
                {a.leaderName}
              </Badge>
            ))}
          </div>
          {!selectedArchetype ? (
            <p className="text-sm text-muted-foreground">Select an archetype to view its tool mapping and applicable strategies.</p>
          ) : detailQ.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
          ) : detailQ.data?.archetype ? (
            <div className="space-y-4">
              {/* Archetype Detail Card */}
              <Card className="bg-card/60 border-primary/15">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{detailQ.data.archetype.name}</CardTitle>
                    <Badge variant="outline">{detailQ.data.archetype.riskLevel} risk</Badge>
                  </div>
                  <CardDescription className="text-xs">{detailQ.data.archetype.leaderPersona}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm italic">"{detailQ.data.archetype.coreBelief}"</p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground mb-1">Characteristics</p>
                      {detailQ.data.archetype.characteristics.map(c => (
                        <div key={c} className="flex items-start gap-1 text-[11px]">
                          <CheckCircle2 className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                          <span>{c}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground mb-1">Ideal Client Fit</p>
                      {detailQ.data.archetype.idealClientFit.map(c => (
                        <div key={c} className="flex items-start gap-1 text-[11px]">
                          <Users className="w-3 h-3 text-blue-400 mt-0.5 shrink-0" />
                          <span>{c}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-medium text-emerald-400 mb-1">Strengths</p>
                      {detailQ.data.archetype.strengths.map(s => (
                        <Badge key={s} variant="secondary" className="text-[9px] mr-1 mb-1">{s}</Badge>
                      ))}
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-amber-400 mb-1">Weaknesses</p>
                      {detailQ.data.archetype.weaknesses.map(w => (
                        <Badge key={w} variant="outline" className="text-[9px] mr-1 mb-1 border-amber-400/30">{w}</Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Relevant Calculators */}
              <Card className="bg-card/60 border-accent/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Relevant Calculators & Tools</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {detailQ.data.calculators.map(c => (
                      <Badge key={c.id} variant={c.relevance === "primary" ? "default" : "outline"} className="text-[10px]">
                        {c.id.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                        {c.relevance === "primary" && <Zap className="w-2.5 h-2.5 ml-1" />}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {detailQ.data.advancedPanels.map(p => (
                      <Badge key={p.id} variant={p.relevance === "primary" ? "default" : "outline"} className="text-[10px]">
                        {p.id.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Applicable Strategies */}
              <Card className="bg-card/60 border-accent/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Applicable Strategies ({detailQ.data.strategies.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {detailQ.data.strategies.map(s => (
                      <div key={s.name} className="rounded bg-background/50 p-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[8px]">{s.category}</Badge>
                          <span className="text-xs font-medium">{s.name}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{s.description}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
