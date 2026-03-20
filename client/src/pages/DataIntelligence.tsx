/**
 * Data Intelligence Hub
 * Comprehensive dashboard for multi-source data ingestion, bulk scraping,
 * RSS feeds, competitor intelligence, data quality, and AI-generated insights.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Database, Globe, FileText, TrendingUp, Brain,
  Play, Plus, RefreshCw, Search, Zap, BarChart3,
  Clock, CheckCircle2, AlertCircle, Loader2, Trash2,
  Rss, Layers, Shield, Target, Eye, Sparkles,
  ArrowUpRight, ChevronRight, Activity, Gauge,
  BookOpen, Building2, Package, Newspaper,
} from "lucide-react";

export default function DataIntelligence() {
  const [activeTab, setActiveTab] = useState("overview");
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSource, setNewSource] = useState({
    name: "", sourceType: "web_scrape" as string, url: "", priority: 5,
  });
  const [scrapeUrl, setScrapeUrl] = useState("");

  // Bulk scrape state
  const [bulkUrls, setBulkUrls] = useState("");
  const [bulkName, setBulkName] = useState("");
  const [bulkPrompt, setBulkPrompt] = useState("");

  // RSS feed state
  const [rssUrl, setRssUrl] = useState("");
  const [rssName, setRssName] = useState("");

  // Sitemap state
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [sitemapName, setSitemapName] = useState("");
  const [sitemapMax, setSitemapMax] = useState(50);

  // Competitor state
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [competitorName, setCompetitorName] = useState("");

  // Product catalog state
  const [productUrl, setProductUrl] = useState("");
  const [productCategory, setProductCategory] = useState("");

  // ─── Base Queries ─────────────────────────────────────────────────
  const stats = trpc.dataIngestion.getDashboardStats.useQuery();
  const sources = trpc.dataIngestion.listSources.useQuery();
  const jobs = trpc.dataIngestion.listJobs.useQuery({});
  const records = trpc.dataIngestion.listRecords.useQuery({});
  const scrapeResults = trpc.dataIngestion.listScrapeResults.useQuery({});

  // ─── Enhanced Queries ─────────────────────────────────────────────
  const enhancedStats = trpc.dataIngestionEnhanced.getEnhancedStats.useQuery();
  const insights = trpc.dataIngestionEnhanced.listInsights.useQuery({});
  const batches = trpc.dataIngestionEnhanced.listBatches.useQuery({});
  const qualityScores = trpc.dataIngestionEnhanced.listQualityScores.useQuery({});

  // ─── Base Mutations ───────────────────────────────────────────────
  const createSource = trpc.dataIngestion.createSource.useMutation({
    onSuccess: () => {
      toast.success("Data source created");
      sources.refetch();
      setShowAddSource(false);
      setNewSource({ name: "", sourceType: "web_scrape", url: "", priority: 5 });
    },
  });
  const runIngestion = trpc.dataIngestion.runIngestion.useMutation({
    onSuccess: (data) => {
      toast.success(`Ingestion complete — ${data.recordsProcessed} records processed`);
      jobs.refetch(); records.refetch(); stats.refetch(); enhancedStats.refetch();
    },
    onError: (err) => toast.error(`Ingestion failed: ${err.message}`),
  });
  const deleteSource = trpc.dataIngestion.deleteSource.useMutation({
    onSuccess: () => { toast.success("Source deactivated"); sources.refetch(); },
  });
  const scrape = trpc.dataIngestion.scrapeUrl.useMutation({
    onSuccess: (data) => {
      toast.success(`Scrape complete — ${data.content.length} chars extracted`);
      scrapeResults.refetch(); setScrapeUrl("");
    },
    onError: (err) => toast.error(`Scrape failed: ${err.message}`),
  });
  const fetchMarket = trpc.dataIngestion.fetchMarketData.useMutation({
    onSuccess: (data) => toast.success(`Market data updated — ${data.ratesFetched} rates fetched`),
  });

  // ─── Enhanced Mutations ───────────────────────────────────────────
  const bulkScrape = trpc.dataIngestionEnhanced.bulkScrape.useMutation({
    onSuccess: (data) => {
      toast.success(`Bulk scrape complete — ${data.success}/${data.total} URLs succeeded`);
      batches.refetch(); records.refetch(); stats.refetch(); enhancedStats.refetch();
      setBulkUrls(""); setBulkName(""); setBulkPrompt("");
    },
    onError: (err) => toast.error(`Bulk scrape failed: ${err.message}`),
  });
  const crawlSitemap = trpc.dataIngestionEnhanced.crawlSitemap.useMutation({
    onSuccess: (data) => {
      toast.success(`Sitemap crawl complete — ${data.success}/${data.total} pages scraped`);
      batches.refetch(); records.refetch(); enhancedStats.refetch();
      setSitemapUrl(""); setSitemapName("");
    },
    onError: (err) => toast.error(`Sitemap crawl failed: ${err.message}`),
  });
  const ingestRSS = trpc.dataIngestionEnhanced.ingestRSSFeed.useMutation({
    onSuccess: (data) => {
      toast.success(`RSS feed ingested — ${data.success} articles captured`);
      batches.refetch(); records.refetch(); enhancedStats.refetch();
      setRssUrl(""); setRssName("");
    },
    onError: (err) => toast.error(`RSS ingestion failed: ${err.message}`),
  });
  const analyzeCompetitor = trpc.dataIngestionEnhanced.analyzeCompetitor.useMutation({
    onSuccess: (data) => {
      toast.success(`Competitor analysis complete for ${data.competitorName}`);
      records.refetch(); enhancedStats.refetch();
      setCompetitorUrl(""); setCompetitorName("");
    },
    onError: (err) => toast.error(`Competitor analysis failed: ${err.message}`),
  });
  const parseProduct = trpc.dataIngestionEnhanced.parseProductCatalog.useMutation({
    onSuccess: (data) => {
      toast.success(`Product catalog parsed — ${data.products.length} products found`);
      records.refetch(); enhancedStats.refetch();
      setProductUrl(""); setProductCategory("");
    },
    onError: (err) => toast.error(`Product parsing failed: ${err.message}`),
  });
  const generateInsights = trpc.dataIngestionEnhanced.generateInsights.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.length} new insights generated`);
      insights.refetch(); enhancedStats.refetch();
    },
  });
  const acknowledgeInsight = trpc.dataIngestionEnhanced.acknowledgeInsight.useMutation({
    onSuccess: () => { insights.refetch(); enhancedStats.refetch(); },
  });
  const scoreQuality = trpc.dataIngestionEnhanced.scoreDataQuality.useMutation({
    onSuccess: (data) => {
      toast.success(`Quality score: ${data.overall.toFixed(0)}%`);
      qualityScores.refetch();
    },
  });

  const sourceTypeIcons: Record<string, React.ReactNode> = {
    web_scrape: <Globe className="h-4 w-4" />,
    document_upload: <FileText className="h-4 w-4" />,
    api_feed: <Zap className="h-4 w-4" />,
    market_data: <TrendingUp className="h-4 w-4" />,
    regulatory: <Shield className="h-4 w-4" />,
    product_catalog: <Package className="h-4 w-4" />,
    news_feed: <Newspaper className="h-4 w-4" />,
    competitor: <Target className="h-4 w-4" />,
    custom: <Brain className="h-4 w-4" />,
  };

  const severityColors: Record<string, string> = {
    low: "bg-blue-500/10 text-blue-600",
    medium: "bg-amber-500/10 text-amber-600",
    high: "bg-orange-500/10 text-orange-600",
    critical: "bg-red-500/10 text-red-600",
  };

  const insightTypeIcons: Record<string, React.ReactNode> = {
    trend: <TrendingUp className="h-4 w-4" />,
    anomaly: <AlertCircle className="h-4 w-4" />,
    opportunity: <Sparkles className="h-4 w-4" />,
    risk: <Shield className="h-4 w-4" />,
    recommendation: <Brain className="h-4 w-4" />,
    competitive_intel: <Target className="h-4 w-4" />,
    market_shift: <Activity className="h-4 w-4" />,
    regulatory_change: <BookOpen className="h-4 w-4" />,
  };

  const parsedBulkUrls = useMemo(() => {
    return bulkUrls.split("\n").map(u => u.trim()).filter(u => u.length > 0 && u.startsWith("http"));
  }, [bulkUrls]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Data Intelligence Hub</h1>
          <p className="text-muted-foreground">Ingest, scrape, and analyze multi-source data to power AI insights and continuous improvement</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => generateInsights.mutate()} disabled={generateInsights.isPending}>
            <Sparkles className="h-4 w-4 mr-2" />
            {generateInsights.isPending ? "Analyzing..." : "Generate Insights"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => fetchMarket.mutate()} disabled={fetchMarket.isPending}>
            <TrendingUp className="h-4 w-4 mr-2" />
            {fetchMarket.isPending ? "Fetching..." : "Market Data"}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10"><Database className="h-4 w-4 text-blue-500" /></div>
              <div>
                <p className="text-xl font-bold">{stats.data?.totalSources || 0}</p>
                <p className="text-xs text-muted-foreground">Sources</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10"><CheckCircle2 className="h-4 w-4 text-green-500" /></div>
              <div>
                <p className="text-xl font-bold">{stats.data?.activeSources || 0}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10"><BarChart3 className="h-4 w-4 text-purple-500" /></div>
              <div>
                <p className="text-xl font-bold">{stats.data?.totalRecords || 0}</p>
                <p className="text-xs text-muted-foreground">Records</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10"><Layers className="h-4 w-4 text-amber-500" /></div>
              <div>
                <p className="text-xl font-bold">{enhancedStats.data?.totalBatches || 0}</p>
                <p className="text-xs text-muted-foreground">Batches</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-pink-500/10"><Sparkles className="h-4 w-4 text-pink-500" /></div>
              <div>
                <p className="text-xl font-bold">{enhancedStats.data?.totalInsights || 0}</p>
                <p className="text-xs text-muted-foreground">Insights</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10"><Gauge className="h-4 w-4 text-emerald-500" /></div>
              <div>
                <p className="text-xl font-bold">{enhancedStats.data?.avgQualityScore ? `${Number(enhancedStats.data.avgQualityScore).toFixed(0)}%` : "—"}</p>
                <p className="text-xs text-muted-foreground">Quality</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Record Type Breakdown */}
      {enhancedStats.data?.recordsByType && enhancedStats.data.recordsByType.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-sm font-medium text-muted-foreground">Records by type:</span>
              {enhancedStats.data.recordsByType.map((rt: any) => (
                <Badge key={rt.type} variant="outline" className="gap-1.5">
                  {sourceTypeIcons[rt.type] || <Database className="h-3 w-3" />}
                  {rt.type.replace("_", " ")} <span className="font-bold">{rt.count}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="text-xs">Sources</TabsTrigger>
          <TabsTrigger value="bulk" className="text-xs">Bulk Ingest</TabsTrigger>
          <TabsTrigger value="scraper" className="text-xs">Scraper</TabsTrigger>
          <TabsTrigger value="feeds" className="text-xs">RSS Feeds</TabsTrigger>
          <TabsTrigger value="competitor" className="text-xs">Competitor Intel</TabsTrigger>
          <TabsTrigger value="products" className="text-xs">Products</TabsTrigger>
          <TabsTrigger value="insights" className="text-xs">AI Insights</TabsTrigger>
          <TabsTrigger value="quality" className="text-xs">Data Quality</TabsTrigger>
          <TabsTrigger value="jobs" className="text-xs">Jobs</TabsTrigger>
          <TabsTrigger value="records" className="text-xs">Records</TabsTrigger>
        </TabsList>

        {/* ─── Sources Tab ─────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Data Sources</h3>
            <Dialog open={showAddSource} onOpenChange={setShowAddSource}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Source</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Data Source</DialogTitle>
                  <DialogDescription>Configure a new data ingestion source</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <Input placeholder="Source name" value={newSource.name} onChange={e => setNewSource(p => ({ ...p, name: e.target.value }))} />
                  <Select value={newSource.sourceType} onValueChange={v => setNewSource(p => ({ ...p, sourceType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="web_scrape">Web Scrape</SelectItem>
                      <SelectItem value="document_upload">Document Upload</SelectItem>
                      <SelectItem value="api_feed">API Feed</SelectItem>
                      <SelectItem value="market_data">Market Data</SelectItem>
                      <SelectItem value="regulatory">Regulatory</SelectItem>
                      <SelectItem value="product_catalog">Product Catalog</SelectItem>
                      <SelectItem value="news_feed">News Feed</SelectItem>
                      <SelectItem value="competitor">Competitor</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="URL (optional)" value={newSource.url} onChange={e => setNewSource(p => ({ ...p, url: e.target.value }))} />
                  <Button className="w-full" onClick={() => createSource.mutate(newSource as any)} disabled={!newSource.name || createSource.isPending}>
                    {createSource.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Create Source
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {sources.data?.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No data sources configured yet</p>
              <p className="text-sm mt-1">Add your first source to start ingesting data</p>
            </CardContent></Card>
          ) : (
            <div className="grid gap-3">
              {sources.data?.map((src: any) => (
                <Card key={src.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-muted">{sourceTypeIcons[src.sourceType] || <Database className="h-4 w-4" />}</div>
                        <div>
                          <p className="font-medium">{src.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-xs">{src.sourceType.replace(/_/g, " ")}</Badge>
                            {src.url && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{src.url}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{src.totalRecordsIngested || 0} records</span>
                        <Button size="sm" variant="outline" onClick={() => scoreQuality.mutate({ dataSourceId: src.id })} disabled={scoreQuality.isPending} title="Score data quality">
                          <Gauge className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => runIngestion.mutate({ dataSourceId: src.id })} disabled={runIngestion.isPending}>
                          {runIngestion.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteSource.mutate({ id: src.id })}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Bulk Ingest Tab ─────────────────────────────────────── */}
        <TabsContent value="bulk" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Multi-URL Scrape */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Globe className="h-5 w-5" /> Bulk URL Scrape</CardTitle>
                <CardDescription>Scrape multiple URLs at once — paste one URL per line</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input placeholder="Batch name" value={bulkName} onChange={e => setBulkName(e.target.value)} />
                <Textarea
                  placeholder={"https://example.com/page1\nhttps://example.com/page2\nhttps://example.com/page3"}
                  value={bulkUrls}
                  onChange={e => setBulkUrls(e.target.value)}
                  rows={6}
                />
                <Input placeholder="Custom extraction prompt (optional)" value={bulkPrompt} onChange={e => setBulkPrompt(e.target.value)} />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{parsedBulkUrls.length} valid URLs detected</span>
                  <Button
                    onClick={() => bulkScrape.mutate({ urls: parsedBulkUrls, batchName: bulkName, extractionPrompt: bulkPrompt || undefined })}
                    disabled={parsedBulkUrls.length === 0 || !bulkName || bulkScrape.isPending}
                  >
                    {bulkScrape.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Layers className="h-4 w-4 mr-2" />}
                    {bulkScrape.isPending ? "Scraping..." : `Scrape ${parsedBulkUrls.length} URLs`}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Sitemap Crawler */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Search className="h-5 w-5" /> Sitemap Crawler</CardTitle>
                <CardDescription>Discover and scrape all pages from a website's sitemap</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input placeholder="Batch name" value={sitemapName} onChange={e => setSitemapName(e.target.value)} />
                <Input placeholder="https://example.com/sitemap.xml" value={sitemapUrl} onChange={e => setSitemapUrl(e.target.value)} />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Max pages:</span>
                  <Input type="number" min={1} max={200} value={sitemapMax} onChange={e => setSitemapMax(Number(e.target.value))} className="w-24" />
                </div>
                <Button
                  className="w-full"
                  onClick={() => crawlSitemap.mutate({ sitemapUrl, batchName: sitemapName, maxUrls: sitemapMax })}
                  disabled={!sitemapUrl || !sitemapName || crawlSitemap.isPending}
                >
                  {crawlSitemap.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                  {crawlSitemap.isPending ? "Crawling..." : "Crawl Sitemap"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Recent Batches */}
          <h3 className="text-lg font-semibold">Recent Bulk Import Batches</h3>
          {batches.data?.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">
              <Layers className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>No bulk imports yet</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {batches.data?.map((batch: any) => (
                <Card key={batch.id}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant={batch.status === "completed" ? "default" : batch.status === "failed" ? "destructive" : "secondary"}>
                          {batch.status}
                        </Badge>
                        <div>
                          <p className="font-medium text-sm">{batch.batchName}</p>
                          <p className="text-xs text-muted-foreground">{batch.importType.replace(/_/g, " ")}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {batch.status === "processing" && (
                          <Progress value={batch.totalItems ? (batch.processedItems / batch.totalItems) * 100 : 0} className="w-24 h-2" />
                        )}
                        <span className="text-xs text-muted-foreground">
                          {batch.successItems || 0}/{batch.totalItems || 0} success
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {batch.createdAt ? new Date(Number(batch.createdAt)).toLocaleString() : "—"}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Web Scraper Tab ─────────────────────────────────────── */}
        <TabsContent value="scraper" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Single URL Scraper</CardTitle>
              <CardDescription>Scrape and extract structured financial data from any URL using AI</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input placeholder="https://example.com/page" value={scrapeUrl} onChange={e => setScrapeUrl(e.target.value)} className="flex-1" />
                <Button onClick={() => scrape.mutate({ url: scrapeUrl })} disabled={!scrapeUrl || scrape.isPending}>
                  {scrape.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Globe className="h-4 w-4 mr-2" />}
                  Scrape
                </Button>
              </div>
            </CardContent>
          </Card>

          <h3 className="text-lg font-semibold">Recent Scrape Results</h3>
          {scrapeResults.data?.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">
              <Globe className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>No scrape results yet</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {scrapeResults.data?.map((result: any) => (
                <Card key={result.id}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{result.pageTitle || "Untitled"}</p>
                        <p className="text-xs text-muted-foreground truncate">{result.url}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={result.scrapeStatus === "success" ? "default" : "destructive"}>{result.scrapeStatus}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(Number(result.scrapedAt)).toLocaleString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── RSS Feeds Tab ──────────────────────────────────────── */}
        <TabsContent value="feeds" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Rss className="h-5 w-5" /> RSS / Atom Feed Ingestion</CardTitle>
              <CardDescription>Ingest articles from RSS or Atom feeds — financial news, regulatory updates, industry publications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Feed name (e.g., SEC Filings RSS)" value={rssName} onChange={e => setRssName(e.target.value)} />
              <Input placeholder="https://feeds.example.com/rss.xml" value={rssUrl} onChange={e => setRssUrl(e.target.value)} />
              <Button
                className="w-full"
                onClick={() => ingestRSS.mutate({ feedUrl: rssUrl, feedName: rssName })}
                disabled={!rssUrl || !rssName || ingestRSS.isPending}
              >
                {ingestRSS.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Rss className="h-4 w-4 mr-2" />}
                {ingestRSS.isPending ? "Ingesting feed..." : "Ingest Feed"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-6">
              <h4 className="font-medium mb-3">Suggested Financial Feeds</h4>
              <div className="grid md:grid-cols-2 gap-2">
                {[
                  { name: "SEC EDGAR RSS", url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=10-K&dateb=&owner=include&count=40&search_text=&action=getcompany&output=atom" },
                  { name: "Federal Reserve News", url: "https://www.federalreserve.gov/feeds/press_all.xml" },
                  { name: "Treasury Direct", url: "https://www.treasurydirect.gov/xml/auctionresults.xml" },
                  { name: "FINRA Regulatory", url: "https://www.finra.org/rss/rules-guidance" },
                ].map((feed) => (
                  <Button
                    key={feed.name}
                    variant="outline"
                    size="sm"
                    className="justify-start text-xs"
                    onClick={() => { setRssName(feed.name); setRssUrl(feed.url); }}
                  >
                    <Rss className="h-3 w-3 mr-2 shrink-0" />
                    {feed.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Competitor Intel Tab ────────────────────────────────── */}
        <TabsContent value="competitor" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Target className="h-5 w-5" /> Competitor Intelligence</CardTitle>
              <CardDescription>Analyze competitor websites to extract products, pricing, strengths, weaknesses, and market positioning</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Competitor name" value={competitorName} onChange={e => setCompetitorName(e.target.value)} />
              <Input placeholder="https://competitor.com" value={competitorUrl} onChange={e => setCompetitorUrl(e.target.value)} />
              <Button
                className="w-full"
                onClick={() => analyzeCompetitor.mutate({ competitorUrl, competitorName })}
                disabled={!competitorUrl || !competitorName || analyzeCompetitor.isPending}
              >
                {analyzeCompetitor.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Target className="h-4 w-4 mr-2" />}
                {analyzeCompetitor.isPending ? "Analyzing competitor..." : "Analyze Competitor"}
              </Button>
            </CardContent>
          </Card>

          {/* Show competitor records */}
          <h3 className="text-lg font-semibold">Competitor Intelligence Records</h3>
          {records.data?.records?.filter((r: any) => r.recordType === "competitor_intel").length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">
              <Target className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>No competitor intelligence gathered yet</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {records.data?.records?.filter((r: any) => r.recordType === "competitor_intel").map((rec: any) => (
                <Card key={rec.id}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{rec.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{rec.contentSummary?.slice(0, 150)}</p>
                      </div>
                      <Badge variant="outline">competitor</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Products Tab ────────────────────────────────────────── */}
        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Package className="h-5 w-5" /> Product Catalog Parser</CardTitle>
              <CardDescription>Extract financial products, insurance offerings, and investment vehicles from catalog pages</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="https://carrier.com/products" value={productUrl} onChange={e => setProductUrl(e.target.value)} />
              <Select value={productCategory} onValueChange={setProductCategory}>
                <SelectTrigger><SelectValue placeholder="Product category (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="insurance">Insurance</SelectItem>
                  <SelectItem value="investment">Investment</SelectItem>
                  <SelectItem value="banking">Banking</SelectItem>
                  <SelectItem value="annuity">Annuity</SelectItem>
                  <SelectItem value="retirement">Retirement</SelectItem>
                  <SelectItem value="estate">Estate Planning</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
              <Button
                className="w-full"
                onClick={() => parseProduct.mutate({ url: productUrl, productCategory: productCategory || undefined })}
                disabled={!productUrl || parseProduct.isPending}
              >
                {parseProduct.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Package className="h-4 w-4 mr-2" />}
                {parseProduct.isPending ? "Parsing catalog..." : "Parse Product Catalog"}
              </Button>
            </CardContent>
          </Card>

          {/* Show product records */}
          <h3 className="text-lg font-semibold">Product Records</h3>
          {records.data?.records?.filter((r: any) => r.recordType === "product").length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>No products cataloged yet</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {records.data?.records?.filter((r: any) => r.recordType === "product").map((rec: any) => (
                <Card key={rec.id}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{rec.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{rec.contentSummary?.slice(0, 150)}</p>
                      </div>
                      <Badge variant="outline">product</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── AI Insights Tab ─────────────────────────────────────── */}
        <TabsContent value="insights" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">AI-Generated Insights</h3>
              <p className="text-sm text-muted-foreground">
                {enhancedStats.data?.unacknowledgedInsights || 0} unacknowledged insights
              </p>
            </div>
            <Button onClick={() => generateInsights.mutate()} disabled={generateInsights.isPending}>
              {generateInsights.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {generateInsights.isPending ? "Generating..." : "Generate New Insights"}
            </Button>
          </div>

          {insights.data?.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No insights generated yet</p>
              <p className="text-sm mt-1">Ingest some data first, then generate insights</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {insights.data?.map((insight: any) => (
                <Card key={insight.id} className={`${insight.acknowledged ? "opacity-60" : ""} hover:border-primary/30 transition-colors`}>
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg shrink-0 ${severityColors[insight.severity] || "bg-muted"}`}>
                        {insightTypeIcons[insight.insightType] || <Brain className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm">{insight.title}</p>
                          <Badge variant="outline" className="text-xs">{insight.insightType.replace(/_/g, " ")}</Badge>
                          <Badge className={`text-xs ${severityColors[insight.severity]}`}>{insight.severity}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{insight.description}</p>
                      </div>
                      {!insight.acknowledged && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => acknowledgeInsight.mutate({ insightId: insight.id })}
                          title="Acknowledge"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Data Quality Tab ────────────────────────────────────── */}
        <TabsContent value="quality" className="space-y-4">
          <h3 className="text-lg font-semibold">Data Quality Scores</h3>
          <p className="text-sm text-muted-foreground">
            Click the gauge icon on any data source to generate a quality score
          </p>

          {qualityScores.data?.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <Gauge className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No quality scores yet</p>
              <p className="text-sm mt-1">Score a data source from the Sources tab</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {qualityScores.data?.map((score: any) => (
                <Card key={score.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-sm">Source #{score.dataSourceId}</span>
                      <Badge variant={Number(score.overallScore) >= 70 ? "default" : "destructive"}>
                        {Number(score.overallScore).toFixed(0)}% overall
                      </Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { label: "Completeness", value: score.completeness },
                        { label: "Accuracy", value: score.accuracy },
                        { label: "Freshness", value: score.freshness },
                        { label: "Consistency", value: score.consistency },
                      ].map((dim) => (
                        <div key={dim.label} className="text-center">
                          <p className="text-xs text-muted-foreground">{dim.label}</p>
                          <p className="text-lg font-bold">{Number(dim.value).toFixed(0)}%</p>
                          <Progress value={Number(dim.value)} className="h-1.5 mt-1" />
                        </div>
                      ))}
                    </div>
                    {score.issuesFound && (score.issuesFound as string[]).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Issues:</p>
                        {(score.issuesFound as string[]).map((issue: string, i: number) => (
                          <p key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                            <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" /> {issue}
                          </p>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Jobs Tab ────────────────────────────────────────────── */}
        <TabsContent value="jobs" className="space-y-4">
          <h3 className="text-lg font-semibold">Ingestion Jobs</h3>
          {jobs.data?.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No ingestion jobs yet</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {jobs.data?.map((job: any) => (
                <Card key={job.id}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant={job.status === "completed" ? "default" : job.status === "failed" ? "destructive" : "secondary"}>
                          {job.status}
                        </Badge>
                        <span className="text-sm">Source #{job.dataSourceId}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{job.recordsProcessed || 0} processed</span>
                        <span>{job.recordsCreated || 0} created</span>
                        {job.durationMs && <span>{(job.durationMs / 1000).toFixed(1)}s</span>}
                        <span>{job.startedAt ? new Date(Number(job.startedAt)).toLocaleString() : "—"}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Records Tab ─────────────────────────────────────────── */}
        <TabsContent value="records" className="space-y-4">
          <h3 className="text-lg font-semibold">Ingested Records ({records.data?.total || 0})</h3>
          {records.data?.records?.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No records ingested yet</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {records.data?.records?.map((rec: any) => (
                <Card key={rec.id}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm">{rec.title || rec.entityId || `Record #${rec.id}`}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{rec.contentSummary?.slice(0, 120) || "No summary"}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline">{rec.recordType?.replace(/_/g, " ")}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {rec.confidenceScore ? `${(Number(rec.confidenceScore) * 100).toFixed(0)}%` : "—"}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
