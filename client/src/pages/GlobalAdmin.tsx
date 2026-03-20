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
  AlertTriangle, Save, Sparkles, BarChart3, FileCheck, DollarSign,
  Plus, Trash2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function GlobalAdmin() {
  const { user, loading } = useAuth();
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

  // Feature flags from backend
  const flagsQuery = trpc.featureFlags.list.useQuery(undefined, { enabled: !!user });
  const toggleFlag = trpc.featureFlags.toggle.useMutation({
    onSuccess: () => { utils.featureFlags.list.invalidate(); toast.success("Flag updated"); },
    onError: (e) => toast.error(e.message),
  });
  const createFlag = trpc.featureFlags.create.useMutation({
    onSuccess: () => { utils.featureFlags.list.invalidate(); toast.success("Flag created"); setNewFlagOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteFlag = trpc.featureFlags.delete.useMutation({
    onSuccess: () => { utils.featureFlags.list.invalidate(); toast.success("Flag deleted"); },
    onError: (e) => toast.error(e.message),
  });
  const [newFlagOpen, setNewFlagOpen] = useState(false);
  const [newFlagKey, setNewFlagKey] = useState("");
  const [newFlagLabel, setNewFlagLabel] = useState("");
  const [newFlagDesc, setNewFlagDesc] = useState("");

  // Compliance stats
  const complianceQuery = trpc.compliance.getDashboardStats.useQuery(undefined, { enabled: !!user });

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
          <Button variant="ghost" size="icon-sm" onClick={() => navigate("/chat")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Globe className="w-4 h-4 text-accent" />
          <span className="font-semibold text-sm">Global Admin</span>
          <Button variant="outline" size="sm" className="ml-auto gap-1.5 text-xs" onClick={() => navigate("/admin/bcp")}>
            <Shield className="w-3.5 h-3.5" /> BCP
          </Button>
          <Badge variant="secondary" className="text-[10px]">Platform Level</Badge>
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
            <TabsTrigger value="compliance" className="gap-1.5 text-xs">
              <FileCheck className="w-3.5 h-3.5" /> Compliance
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Feature Flags</CardTitle>
                    <CardDescription className="text-xs">Enable or disable features across the platform (persisted to database)</CardDescription>
                  </div>
                  <Dialog open={newFlagOpen} onOpenChange={setNewFlagOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1"><Plus className="w-3 h-3" /> Add Flag</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Create Feature Flag</DialogTitle></DialogHeader>
                      <div className="space-y-3 pt-2">
                        <div><Label className="text-xs">Flag Key</Label><Input value={newFlagKey} onChange={(e) => setNewFlagKey(e.target.value)} placeholder="e.g., new_feature" className="mt-1" /></div>
                        <div><Label className="text-xs">Label</Label><Input value={newFlagLabel} onChange={(e) => setNewFlagLabel(e.target.value)} placeholder="e.g., New Feature" className="mt-1" /></div>
                        <div><Label className="text-xs">Description</Label><Input value={newFlagDesc} onChange={(e) => setNewFlagDesc(e.target.value)} placeholder="What does this flag control?" className="mt-1" /></div>
                        <Button size="sm" onClick={() => createFlag.mutate({ flagKey: newFlagKey, label: newFlagLabel, description: newFlagDesc })} disabled={createFlag.isPending || !newFlagKey || !newFlagLabel}>
                          {createFlag.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />} Create
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {flagsQuery.isLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-accent" /></div>
                ) : (
                  <div className="space-y-3">
                    {(flagsQuery.data || []).map((flag: any) => (
                      <div key={flag.id} className="flex items-center justify-between p-4 rounded-lg border border-border bg-secondary/20">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{flag.label}</p>
                            <Badge variant="outline" className="text-[9px]">{flag.flagKey}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{flag.description || "No description"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={flag.enabled}
                            onCheckedChange={(checked) => toggleFlag.mutate({ id: flag.id, enabled: checked })}
                          />
                          <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive"
                            onClick={() => { if (confirm(`Delete flag "${flag.label}"?`)) deleteFlag.mutate({ id: flag.id }); }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {(flagsQuery.data || []).length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Settings2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No feature flags configured yet</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── COMPLIANCE TAB ─── */}
          <TabsContent value="compliance">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Compliance Dashboard</CardTitle>
                <CardDescription className="text-xs">Platform-wide compliance monitoring and review status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: "Total Reviews", value: complianceQuery.data?.totalReviews || 0, color: "text-blue-400", icon: <FileCheck className="w-4 h-4" /> },
                    { label: "Clean", value: complianceQuery.data?.cleanReviews || 0, color: "text-emerald-400", icon: <Shield className="w-4 h-4" /> },
                    { label: "Flagged", value: complianceQuery.data?.flaggedReviews || 0, color: "text-amber-400", icon: <AlertTriangle className="w-4 h-4" /> },
                    { label: "Compliance Rate", value: `${complianceQuery.data?.complianceRate || 0}%`, color: "text-accent", icon: <TrendingUp className="w-4 h-4" /> },
                  ].map((m, i) => (
                    <div key={i} className="p-4 rounded-lg border border-border bg-secondary/20 text-center">
                      <div className={`mx-auto mb-1.5 ${m.color}`}>{m.icon}</div>
                      <p className="text-xl font-bold">{m.value}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{m.label}</p>
                    </div>
                  ))}
                </div>
                <div className="p-4 rounded-lg bg-secondary/20 border border-border">
                  <h4 className="text-sm font-medium mb-2">Compliance Rules Active</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {["FINRA 2210", "SEC Rule 206", "Reg BI", "Form CRS", "Anti-Money Laundering", "KYC Verification", "Suitability Standards"].map((rule) => (
                      <Badge key={rule} variant="outline" className="text-[10px]">{rule}</Badge>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-4">
                  Detailed compliance reports with per-advisor breakdowns and remediation tracking will be available in a future update.
                </p>
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
