import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen, Plus, Search, FileText, AlertTriangle, TrendingUp, BarChart3,
  RefreshCw, Trash2, Edit, Eye, Clock, CheckCircle, XCircle, Zap, Brain, ArrowLeft
} from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

export default function KnowledgeAdmin() {
  const { user } = useAuth();
  const [tab, setTab] = useState("articles");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newArticle, setNewArticle] = useState({ title: "", content: "", category: "general", contentType: "guide" as const });

  // Knowledge base queries
  const articlesQ = trpc.knowledgeBase.search.useQuery({ query: searchQuery || "", limit: 50 });
  const gapsQ = trpc.knowledgeBase.listGaps.useQuery({});
  // Stats derived from articles list
  const allArticlesQ = trpc.knowledgeBase.list.useQuery({});

  // AI tool calling stats
  const toolsQ = trpc.aiPlatform.tools.discover.useQuery({});
  const modesQ = trpc.aiPlatform.modes.list.useQuery({});

  // Mutations
  const createArticle = trpc.knowledgeBase.create.useMutation({
    onSuccess: () => { articlesQ.refetch(); setShowCreate(false); toast.success("Article created"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteArticle = trpc.knowledgeBase.delete.useMutation({
    onSuccess: () => { articlesQ.refetch(); toast.success("Article deleted"); },
  });
  const resolveGap = trpc.knowledgeBase.detectGaps.useMutation({
    onSuccess: () => { gapsQ.refetch(); toast.success("Gaps re-scanned"); },
  });

  const isAdmin = user?.role === "admin" || user?.role === "manager";

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl py-8">
        <div className="mb-2"><Link href="/chat"><Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1"><ArrowLeft className="h-4 w-4" /> Back to Chat</Button></Link></div>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-primary" />
              Knowledge Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage knowledge base, AI tools, and capability modes
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-2" /> New Article
            </Button>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold font-mono tabular-nums">{allArticlesQ.data?.length ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">Articles</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <div>
                  <p className="text-2xl font-bold font-mono tabular-nums">{gapsQ.data?.length ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">Knowledge Gaps</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold font-mono tabular-nums">{toolsQ.data?.length ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">AI Tools</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Brain className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold font-mono tabular-nums">{modesQ.data?.length ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">Capability Modes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="articles">Articles</TabsTrigger>
            <TabsTrigger value="gaps">Knowledge Gaps</TabsTrigger>
            <TabsTrigger value="tools">AI Tools</TabsTrigger>
            <TabsTrigger value="modes">Capability Modes</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Articles Tab */}
          <TabsContent value="articles">
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search knowledge base..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-3">
              {articlesQ.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
              ) : articlesQ.data?.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No articles found. Create your first knowledge article.</p>
                  </CardContent>
                </Card>
              ) : (
                articlesQ.data?.map((article: any) => (
                  <Card key={article.id} className="hover:border-primary/30 transition-colors">
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold truncate">{article.title}</h3>
                            <Badge variant="outline" className="text-xs">{article.category}</Badge>
                            <Badge variant="secondary" className="text-xs">{article.contentType}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">{article.content}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> v{article.version}</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(article.updatedAt).toLocaleDateString()}
                            </span>
                            {article.freshnessScore != null && (
                              <span className="flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" />
                                Freshness: {Math.round(article.freshnessScore * 100)}%
                              </span>
                            )}
                          </div>
                        </div>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 text-destructive"
                            onClick={() => deleteArticle.mutate({ id: article.id })}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Knowledge Gaps Tab */}
          <TabsContent value="gaps">
            <div className="space-y-3">
              {gapsQ.isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
              ) : gapsQ.data?.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500 opacity-50" />
                    <p>No knowledge gaps detected. Great coverage!</p>
                  </CardContent>
                </Card>
              ) : (
                gapsQ.data?.map((gap: any) => (
                  <Card key={gap.id} className="border-amber-500/30">
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            <h3 className="font-semibold">{gap.topic}</h3>
                            <Badge variant={gap.priority === "high" ? "destructive" : "outline"} className="text-xs">
                              {gap.priority}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{gap.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Detected: {new Date(gap.detectedAt).toLocaleDateString()} · Frequency: {gap.frequency}
                          </p>
                        </div>
                        {isAdmin && gap.status === "open" && (
                          <Badge variant="outline" className="text-xs">Open</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* AI Tools Tab */}
          <TabsContent value="tools">
            <div className="grid gap-4 md:grid-cols-2">
              {toolsQ.isLoading ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
              ) : (
                toolsQ.data?.map((tool: any) => (
                  <Card key={tool.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Zap className="w-4 h-4 text-purple-500" />
                          {tool.displayName}
                        </CardTitle>
                        <Badge variant={tool.active ? "default" : "secondary"}>
                          {tool.active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-2">{tool.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Category: {tool.category}</span>
                        <span>Calls: {tool.totalCalls ?? 0}</span>
                        {tool.successRate != null && (
                          <span>Success: {Math.round(tool.successRate * 100)}%</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Capability Modes Tab */}
          <TabsContent value="modes">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {modesQ.isLoading ? (
                Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)
              ) : (
                modesQ.data?.map((mode: any) => (
                  <Card key={mode.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Brain className="w-4 h-4 text-green-500" />
                          {mode.displayName}
                        </CardTitle>
                        <Badge variant={mode.active ? "default" : "secondary"}>
                          {mode.active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3">{mode.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {mode.capabilities?.map((cap: string) => (
                          <Badge key={cap} variant="outline" className="text-xs">{cap}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Analytics Tab — Knowledge Base Health Score */}
          <TabsContent value="analytics">
            {(() => {
              const articles = allArticlesQ.data ?? [];
              const gaps = gapsQ.data ?? [];
              const tools = toolsQ.data ?? [];
              const modes = modesQ.data ?? [];
              const totalArticles = articles.length;
              const activeArticles = articles.filter((a: any) => a.active).length;
              const avgFreshness = totalArticles ? articles.reduce((s: number, a: any) => s + (a.freshnessScore ?? 0), 0) / totalArticles : 0;
              const openGaps = gaps.filter((g: any) => g.status === "open").length;
              const avgToolSuccess = tools.length ? tools.reduce((s: number, t: any) => s + (t.successRate ?? 0), 0) / tools.length : 0;
              const activeModes = modes.filter((m: any) => m.active).length;

              // Composite Health Score (0-100)
              const coverageScore = Math.min(totalArticles / 20, 1) * 25; // 25pts for 20+ articles
              const freshnessScorePt = avgFreshness * 25; // 25pts for freshness
              const gapPenalty = Math.min(openGaps * 5, 20); // -5pts per gap, max -20
              const toolScore = avgToolSuccess * 15; // 15pts for tool success
              const modeScore = (activeModes / Math.max(modes.length, 1)) * 15; // 15pts for active modes
              const healthScore = Math.round(Math.max(0, Math.min(100, coverageScore + freshnessScorePt - gapPenalty + toolScore + modeScore)));
              const healthColor = healthScore >= 80 ? "text-green-500" : healthScore >= 60 ? "text-amber-500" : "text-red-500";
              const healthLabel = healthScore >= 80 ? "Excellent" : healthScore >= 60 ? "Good" : healthScore >= 40 ? "Needs Attention" : "Critical";

              // Category coverage
              const categories = ["general", "financial", "insurance", "compliance", "tax", "estate", "education"];
              const coveredCategories = new Set(articles.map((a: any) => a.category));
              const categoryPct = Math.round((coveredCategories.size / categories.length) * 100);

              // Stale articles (freshness < 0.5)
              const staleArticles = articles.filter((a: any) => (a.freshnessScore ?? 1) < 0.5).length;

              return (
                <div className="space-y-6">
                  {/* Health Score Hero */}
                  <Card className="border-accent/20">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-6">
                        <div className="relative w-28 h-28 shrink-0">
                          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                            <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/20" />
                            <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className={healthColor}
                              strokeDasharray={`${healthScore * 2.64} ${264 - healthScore * 2.64}`}
                              strokeLinecap="round" />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className={`text-2xl font-bold font-mono tabular-nums ${healthColor}`}>{healthScore}</span>
                            <span className="text-[9px] text-muted-foreground">/ 100</span>
                          </div>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold">Knowledge Base Health</h3>
                          <p className={`text-sm font-medium ${healthColor}`}>{healthLabel}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Composite score based on article coverage, freshness, knowledge gaps, tool reliability, and capability mode activation.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Score Breakdown */}
                  <div className="grid gap-4 md:grid-cols-5">
                    {[
                      { label: "Coverage", value: `${Math.round(coverageScore)}/25`, sub: `${totalArticles} articles`, color: coverageScore > 18 ? "text-green-500" : "text-amber-500" },
                      { label: "Freshness", value: `${Math.round(freshnessScorePt)}/25`, sub: `${Math.round(avgFreshness * 100)}% avg`, color: avgFreshness > 0.7 ? "text-green-500" : "text-amber-500" },
                      { label: "Gap Penalty", value: `-${Math.round(gapPenalty)}/20`, sub: `${openGaps} open gaps`, color: openGaps === 0 ? "text-green-500" : "text-red-500" },
                      { label: "Tool Health", value: `${Math.round(toolScore)}/15`, sub: `${Math.round(avgToolSuccess * 100)}% success`, color: avgToolSuccess > 0.8 ? "text-green-500" : "text-amber-500" },
                      { label: "Modes", value: `${Math.round(modeScore)}/15`, sub: `${activeModes}/${modes.length} active`, color: modeScore > 10 ? "text-green-500" : "text-amber-500" },
                    ].map(item => (
                      <Card key={item.label}>
                        <CardContent className="pt-4 pb-3 text-center">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
                          <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                          <p className="text-[10px] text-muted-foreground">{item.sub}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Category Coverage */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <BarChart3 className="w-4 h-4" /> Category Coverage
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {categories.map(cat => {
                            const count = articles.filter((a: any) => a.category === cat).length;
                            const pct = totalArticles ? Math.round((count / totalArticles) * 100) : 0;
                            return (
                              <div key={cat} className="flex items-center gap-3">
                                <span className="text-xs w-20 capitalize text-muted-foreground">{cat}</span>
                                <div className="flex-1 h-2 rounded-full bg-muted/30 overflow-hidden">
                                  <div className={`h-full rounded-full ${count > 0 ? "bg-accent" : "bg-muted/10"}`} style={{ width: `${Math.max(pct, 2)}%` }} />
                                </div>
                                <span className="text-xs font-mono w-8 text-right">{count}</span>
                              </div>
                            );
                          })}
                          <p className="text-[10px] text-muted-foreground mt-2">{categoryPct}% of categories covered ({coveredCategories.size}/{categories.length})</p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Alerts & Recommendations */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" /> Recommendations
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {staleArticles > 0 && (
                            <div className="flex items-start gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/20">
                              <Clock className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                              <p className="text-xs"><strong>{staleArticles}</strong> article{staleArticles > 1 ? "s" : ""} with low freshness — consider updating</p>
                            </div>
                          )}
                          {openGaps > 0 && (
                            <div className="flex items-start gap-2 p-2 rounded bg-red-500/10 border border-red-500/20">
                              <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                              <p className="text-xs"><strong>{openGaps}</strong> open knowledge gap{openGaps > 1 ? "s" : ""} — create articles to fill</p>
                            </div>
                          )}
                          {categories.filter(c => !coveredCategories.has(c)).length > 0 && (
                            <div className="flex items-start gap-2 p-2 rounded bg-blue-500/10 border border-blue-500/20">
                              <Eye className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                              <p className="text-xs">Missing categories: {categories.filter(c => !coveredCategories.has(c)).join(", ")}</p>
                            </div>
                          )}
                          {healthScore >= 80 && openGaps === 0 && staleArticles === 0 && (
                            <div className="flex items-start gap-2 p-2 rounded bg-green-500/10 border border-green-500/20">
                              <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                              <p className="text-xs">Knowledge base is in excellent health. Keep it up!</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Capability Modes */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Brain className="w-4 h-4" /> Capability Modes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {modes.map((mode: any) => (
                          <div key={mode.id} className="text-center p-3 rounded-lg bg-muted/50">
                            <p className="font-semibold text-sm">{mode.displayName}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {mode.capabilities?.length ?? 0} capabilities
                            </p>
                            <Badge variant={mode.active ? "default" : "secondary"} className="mt-2 text-xs">
                              {mode.active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })()}
          </TabsContent>
        </Tabs>

        {/* Create Article Dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Knowledge Article</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Article title"
                value={newArticle.title}
                onChange={(e) => setNewArticle(prev => ({ ...prev, title: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-4">
                <Select value={newArticle.category} onValueChange={(v) => setNewArticle(prev => ({ ...prev, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="financial">Financial</SelectItem>
                    <SelectItem value="insurance">Insurance</SelectItem>
                    <SelectItem value="compliance">Compliance</SelectItem>
                    <SelectItem value="tax">Tax</SelectItem>
                    <SelectItem value="estate">Estate</SelectItem>
                    <SelectItem value="education">Education</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={newArticle.contentType} onValueChange={(v) => setNewArticle(prev => ({ ...prev, contentType: v as any }))}>
                  <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="guide">Guide</SelectItem>
                    <SelectItem value="faq">FAQ</SelectItem>
                    <SelectItem value="regulation">Regulation</SelectItem>
                    <SelectItem value="product_info">Product Info</SelectItem>
                    <SelectItem value="best_practice">Best Practice</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                placeholder="Article content (Markdown supported)"
                value={newArticle.content}
                onChange={(e) => setNewArticle(prev => ({ ...prev, content: e.target.value }))}
                rows={12}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button
                onClick={() => createArticle.mutate(newArticle)}
                disabled={!newArticle.title || !newArticle.content || createArticle.isPending}
              >
                {createArticle.isPending ? "Creating..." : "Create Article"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
