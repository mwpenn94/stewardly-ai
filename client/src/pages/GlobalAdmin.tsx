import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useState, useMemo } from "react";
import {
  ArrowLeft, Building2, Users, Globe, Shield, Settings2,
  Loader2, Search, ChevronRight, TrendingUp, Activity,
  AlertTriangle, Save, Sparkles, BarChart3,
} from "lucide-react";

export default function GlobalAdmin() {
  const { user, loading } = useAuth({ redirectOnUnauthenticated: true });
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const utils = trpc.useUtils();

  // Platform stats
  const orgsQuery = trpc.organizations.list.useQuery(undefined, { enabled: !!user });
  const platformSettings = trpc.aiLayers.getPlatformSettings.useQuery(undefined, { enabled: !!user });
  const reviewQueue = trpc.review.pending.useQuery(undefined, { enabled: !!user });
  const feedbackStats = trpc.feedback.stats.useQuery(undefined, { enabled: !!user });

  // Platform AI settings form
  const [basePrompt, setBasePrompt] = useState("");
  const [defaultTone, setDefaultTone] = useState("professional");
  const [defaultFormat, setDefaultFormat] = useState("adaptive");
  const [guardrailsText, setGuardrailsText] = useState("");
  const [prohibitedText, setProhibitedText] = useState("");
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Feature flags (local state — would be persisted in real deployment)
  const [flags, setFlags] = useState({
    anonymousChat: true,
    voiceMode: true,
    documentUpload: true,
    studyMode: true,
    marketData: false,
    advisorMatching: false,
  });

  // Populate platform settings
  if (platformSettings.data && !settingsLoaded) {
    const s = platformSettings.data;
    if (s.baseSystemPrompt) setBasePrompt(s.baseSystemPrompt);
    if (s.defaultTone) setDefaultTone(s.defaultTone);
    if (s.defaultResponseFormat) setDefaultFormat(s.defaultResponseFormat);
    if (s.globalGuardrails && Array.isArray(s.globalGuardrails)) setGuardrailsText((s.globalGuardrails as string[]).join("\n"));
    if (s.prohibitedTopics && Array.isArray(s.prohibitedTopics)) setProhibitedText((s.prohibitedTopics as string[]).join(", "));
    setSettingsLoaded(true);
  }

  const updatePlatform = trpc.aiLayers.updatePlatformSettings.useMutation({
    onSuccess: () => {
      toast.success("Platform settings saved");
      utils.aiLayers.getPlatformSettings.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSavePlatform = () => {
    updatePlatform.mutate({
      baseSystemPrompt: basePrompt || undefined,
      defaultTone: defaultTone || undefined,
      defaultResponseFormat: defaultFormat || undefined,
      globalGuardrails: guardrailsText ? guardrailsText.split("\n").map(s => s.trim()).filter(Boolean) : undefined,
      prohibitedTopics: prohibitedText ? prohibitedText.split(",").map(s => s.trim()).filter(Boolean) : undefined,
    });
  };

  const orgs = orgsQuery.data || [];
  const filteredOrgs = useMemo(() => {
    if (!search) return orgs;
    const q = search.toLowerCase();
    return orgs.filter((o: any) => o.name?.toLowerCase().includes(q) || o.slug?.toLowerCase().includes(q));
  }, [orgs, search]);

  const pendingCount = (reviewQueue.data || []).length;
  const stats = feedbackStats.data || { total: 0, up: 0, down: 0 };
  const totalUsers = orgs.reduce((acc: number, o: any) => acc + (o.memberCount || 0), 0);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/30 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => navigate("/chat")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Globe className="w-4 h-4 text-accent" />
          <span className="font-semibold text-sm">Global Admin</span>
          <Badge variant="secondary" className="text-[10px] ml-auto">Platform Level</Badge>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Platform Overview Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
          <Card className="bg-card border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-muted-foreground">Organizations</span>
              </div>
              <p className="text-2xl font-bold">{orgs.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-muted-foreground">Total Users</span>
              </div>
              <p className="text-2xl font-bold">{totalUsers}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-muted-foreground">Pending Reviews</span>
              </div>
              <p className="text-2xl font-bold">{pendingCount}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-muted-foreground">Satisfaction</span>
              </div>
              <p className="text-2xl font-bold">{stats.total > 0 ? Math.round((stats.up / stats.total) * 100) : 0}%</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4 text-accent" />
                <span className="text-xs text-muted-foreground">Total Feedback</span>
              </div>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="firms" className="space-y-6">
          <TabsList className="bg-secondary">
            <TabsTrigger value="firms" className="gap-1.5 text-xs">
              <Building2 className="w-3.5 h-3.5" /> Firms
            </TabsTrigger>
            <TabsTrigger value="platform-ai" className="gap-1.5 text-xs">
              <Sparkles className="w-3.5 h-3.5" /> Platform AI (Layer 1)
            </TabsTrigger>
            <TabsTrigger value="features" className="gap-1.5 text-xs">
              <Settings2 className="w-3.5 h-3.5" /> Feature Flags
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5 text-xs">
              <BarChart3 className="w-3.5 h-3.5" /> Analytics
            </TabsTrigger>
          </TabsList>

          {/* ─── FIRMS TAB ─── */}
          <TabsContent value="firms">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">All Organizations</CardTitle>
                    <CardDescription className="text-xs">Manage firms across the platform</CardDescription>
                  </div>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search organizations..."
                      className="pl-9 h-8 text-sm"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredOrgs.length > 0 ? (
                  <ScrollArea className="max-h-[500px]">
                    <div className="space-y-2">
                      {filteredOrgs.map((org: any) => (
                        <div
                          key={org.id}
                          className="flex items-center gap-4 p-4 rounded-lg border border-border bg-secondary/20 hover:bg-secondary/40 transition-colors cursor-pointer group"
                          onClick={() => toast.info(`Org management for "${org.name}" — coming soon`)}
                        >
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                            style={{ background: `linear-gradient(135deg, ${org.primaryColor || '#0EA5E9'}, ${org.accentColor || '#14B8A6'})` }}
                          >
                            {(org.name || "O").charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{org.name}</span>
                              {org.slug && <Badge variant="outline" className="text-[10px]">/{org.slug}</Badge>}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-xs text-muted-foreground">{org.memberCount || 0} members</span>
                              <span className="text-xs text-muted-foreground">Role: {org.role || "—"}</span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">{search ? "No organizations match your search" : "No organizations yet"}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── PLATFORM AI (LAYER 1) TAB ─── */}
          <TabsContent value="platform-ai" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Platform Base Prompt (Layer 1)</CardTitle>
                <CardDescription className="text-xs">
                  This prompt is the foundation for all AI interactions across the platform.
                  All lower layers (org, manager, professional, user) inherit and build upon this.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Base System Prompt</Label>
                  <Textarea
                    value={basePrompt}
                    onChange={(e) => setBasePrompt(e.target.value)}
                    placeholder="You are a helpful financial AI assistant..."
                    rows={6}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Default Tone</Label>
                    <Input value={defaultTone} onChange={(e) => setDefaultTone(e.target.value)} placeholder="professional" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Default Response Format</Label>
                    <Input value={defaultFormat} onChange={(e) => setDefaultFormat(e.target.value)} placeholder="adaptive" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Guardrails (one per line)</Label>
                  <Textarea
                    value={guardrailsText}
                    onChange={(e) => setGuardrailsText(e.target.value)}
                    placeholder="Always include financial disclaimers.\nNever provide specific investment advice..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Prohibited Topics (comma-separated)</Label>
                  <Input
                    value={prohibitedText}
                    onChange={(e) => setProhibitedText(e.target.value)}
                    placeholder="crypto trading signals, specific stock picks, tax evasion"
                  />
                </div>
                <Button onClick={handleSavePlatform} disabled={updatePlatform.isPending} size="sm">
                  {updatePlatform.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                  Save Platform Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── FEATURE FLAGS TAB ─── */}
          <TabsContent value="features">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Feature Flags</CardTitle>
                <CardDescription className="text-xs">Enable or disable features across the platform</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { key: "anonymousChat", label: "Anonymous Chat", desc: "Allow users to chat without signing in (5 convo limit)" },
                    { key: "voiceMode", label: "Voice Mode", desc: "Enable voice input/output in chat" },
                    { key: "documentUpload", label: "Document Upload", desc: "Allow users to upload documents to knowledge base" },
                    { key: "studyMode", label: "Study Mode", desc: "Enable study/education focus mode" },
                    { key: "marketData", label: "Market Data", desc: "Show real-time market data (Yahoo Finance)" },
                    { key: "advisorMatching", label: "Advisor Matching", desc: "Enable AI-powered advisor matching marketplace" },
                  ].map((flag) => (
                    <div key={flag.key} className="flex items-center justify-between p-4 rounded-lg border border-border bg-secondary/20">
                      <div>
                        <p className="text-sm font-medium">{flag.label}</p>
                        <p className="text-xs text-muted-foreground">{flag.desc}</p>
                      </div>
                      <Switch
                        checked={flags[flag.key as keyof typeof flags]}
                        onCheckedChange={(checked) => {
                          setFlags(prev => ({ ...prev, [flag.key]: checked }));
                          toast.info(`${flag.label} ${checked ? "enabled" : "disabled"} — feature flags are UI-only for now`);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── ANALYTICS TAB ─── */}
          <TabsContent value="analytics">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Platform Analytics</CardTitle>
                <CardDescription className="text-xs">Usage metrics and engagement data across all organizations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 py-8">
                  {[
                    { label: "Total Organizations", value: orgs.length, icon: <Building2 className="w-5 h-5" />, color: "text-blue-400" },
                    { label: "Total Users", value: totalUsers, icon: <Users className="w-5 h-5" />, color: "text-emerald-400" },
                    { label: "Feedback Collected", value: stats.total, icon: <Activity className="w-5 h-5" />, color: "text-purple-400" },
                    { label: "Positive Feedback", value: stats.up, icon: <TrendingUp className="w-5 h-5" />, color: "text-emerald-400" },
                    { label: "Pending Reviews", value: pendingCount, icon: <AlertTriangle className="w-5 h-5" />, color: "text-amber-400" },
                    { label: "Satisfaction Rate", value: `${stats.total > 0 ? Math.round((stats.up / stats.total) * 100) : 0}%`, icon: <Shield className="w-5 h-5" />, color: "text-accent" },
                  ].map((metric, i) => (
                    <div key={i} className="text-center p-4 rounded-lg border border-border bg-secondary/20">
                      <div className={`mx-auto mb-2 ${metric.color}`}>{metric.icon}</div>
                      <p className="text-2xl font-bold">{metric.value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{metric.label}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-center pt-4 border-t border-border">
                  Detailed analytics with time-series charts, cohort analysis, and export will be available in a future update.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
