/**
 * ClientSegmentation — AI-powered client tier classification.
 * Wired to trpc.clientSegmentation.classify (mutation) and trpc.clientSegmentation.listSegments (query).
 * Allows advisors to classify clients into Platinum/Gold/Silver/Bronze tiers based on
 * value, growth, engagement, and relationship metrics.
 */
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Users, TrendingUp, BarChart3, Layers, Sparkles, Crown,
  Star, Medal, Shield, ArrowRight, Loader2, RefreshCw,
  DollarSign, UserCheck, Activity, Heart,
} from "lucide-react";
import { fmt } from "@/lib/format";

/* ─── Tier colors & icons ───────────────────────────────────── */
const TIER_CONFIG: Record<string, { color: string; bg: string; border: string; icon: typeof Crown; label: string }> = {
  platinum: { color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/30", icon: Crown, label: "Platinum" },
  gold: { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", icon: Star, label: "Gold" },
  silver: { color: "text-slate-300", bg: "bg-slate-500/10", border: "border-slate-500/30", icon: Medal, label: "Silver" },
  bronze: { color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30", icon: Shield, label: "Bronze" },
};

/* ─── Score bar component ───────────────────────────────────── */
function ScoreBar({ label, value, icon: Icon, color }: { label: string; value: number; icon: typeof TrendingUp; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="h-3 w-3" />
          {label}
        </span>
        <span className={cn("font-semibold", color)}>{value}/100</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700", color.replace("text-", "bg-"))}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}

/* ─── Default form values ───────────────────────────────────── */
const DEFAULT_FORM = {
  clientId: "",
  aum: "",
  annualRevenue: "",
  referralsGenerated: "",
  netNewAssets12m: "",
  aumGrowthRate: "",
  productPenetration: "",
  meetingsAttended12m: "",
  responseTimeAvgHours: "",
  portalLoginFrequency: "",
  tenureYears: "",
  satisfactionScore: "",
  advocacyScore: "",
};

export default function ClientSegmentation() {
  const [tab, setTab] = useState("classify");
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [lastResult, setLastResult] = useState<any>(null);

  /* ─── tRPC hooks ─────────────────────────────────────────── */
  const segmentsQ = trpc.clientSegmentation.listSegments.useQuery(undefined, { retry: false });
  const classifyMut = trpc.clientSegmentation.classify.useMutation({
    onSuccess: (data) => {
      setLastResult(data);
      toast.success(`Client classified as ${data.tier.toUpperCase()}`);
      segmentsQ.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleClassify = useCallback(() => {
    const clientId = parseInt(form.clientId);
    if (!clientId || isNaN(clientId)) { toast.error("Client ID is required"); return; }
    classifyMut.mutate({
      clientId,
      aum: parseFloat(form.aum) || 0,
      annualRevenue: parseFloat(form.annualRevenue) || 0,
      referralsGenerated: parseInt(form.referralsGenerated) || 0,
      netNewAssets12m: parseFloat(form.netNewAssets12m) || 0,
      aumGrowthRate: parseFloat(form.aumGrowthRate) || 0,
      productPenetration: parseFloat(form.productPenetration) || 0,
      meetingsAttended12m: parseInt(form.meetingsAttended12m) || 0,
      responseTimeAvgHours: parseFloat(form.responseTimeAvgHours) || 24,
      portalLoginFrequency: parseFloat(form.portalLoginFrequency) || 0,
      tenureYears: parseFloat(form.tenureYears) || 0,
      satisfactionScore: parseFloat(form.satisfactionScore) || 50,
      advocacyScore: parseFloat(form.advocacyScore) || 50,
    });
  }, [form, classifyMut]);

  const updateField = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  /* ─── Segment summary stats ──────────────────────────────── */
  const segments = segmentsQ.data ?? [];
  const tierCounts = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  segments.forEach((s: any) => { if (s.tier && tierCounts[s.tier as keyof typeof tierCounts] !== undefined) tierCounts[s.tier as keyof typeof tierCounts]++; });

  return (
    <AppShell>
      <SEOHead title="Client Segmentation" description="AI-powered client tier classification with value, growth, engagement, and relationship scoring" />
      <div className="container max-w-6xl py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Layers className="h-6 w-6 text-violet-400" />
              Client Segmentation
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Classify clients into service tiers using AI-powered scoring across value, growth, engagement, and relationship dimensions.
            </p>
          </div>
          <Button onClick={() => setShowDialog(true)} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Classify Client
          </Button>
        </div>

        {/* Tier summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(["platinum", "gold", "silver", "bronze"] as const).map(tier => {
            const cfg = TIER_CONFIG[tier];
            const Icon = cfg.icon;
            return (
              <Card key={tier} className={cn("border", cfg.border, cfg.bg)}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", cfg.bg)}>
                    <Icon className={cn("h-5 w-5", cfg.color)} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{cfg.label}</p>
                    <p className={cn("text-xl font-bold", cfg.color)}>{tierCounts[tier]}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="classify">Classify</TabsTrigger>
            <TabsTrigger value="segments">All Segments ({segments.length})</TabsTrigger>
          </TabsList>

          {/* Classify tab — last result */}
          <TabsContent value="classify" className="space-y-4">
            {lastResult ? (
              <Card className={cn("border", TIER_CONFIG[lastResult.tier]?.border)}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {(() => { const Icon = TIER_CONFIG[lastResult.tier]?.icon ?? Shield; return <Icon className={cn("h-5 w-5", TIER_CONFIG[lastResult.tier]?.color)} />; })()}
                    Classification Result: {TIER_CONFIG[lastResult.tier]?.label ?? lastResult.tier}
                  </CardTitle>
                  <CardDescription>Total Score: {lastResult.totalScore}/100</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <ScoreBar label="Value" value={lastResult.valueScore} icon={DollarSign} color="text-emerald-400" />
                    <ScoreBar label="Growth" value={lastResult.growthScore} icon={TrendingUp} color="text-blue-400" />
                    <ScoreBar label="Engagement" value={lastResult.engagementScore} icon={Activity} color="text-amber-400" />
                    <ScoreBar label="Relationship" value={lastResult.relationshipScore} icon={Heart} color="text-rose-400" />
                  </div>
                  {lastResult.serviceModel && (
                    <div className="mt-4 p-4 rounded-lg bg-muted/50 space-y-2">
                      <h4 className="text-sm font-semibold flex items-center gap-1.5">
                        <UserCheck className="h-4 w-4" /> Recommended Service Model
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-muted-foreground">Meeting Frequency:</span> {lastResult.serviceModel.meetingFrequency}</div>
                        <div><span className="text-muted-foreground">Review Type:</span> {lastResult.serviceModel.reviewType}</div>
                        <div><span className="text-muted-foreground">Communication:</span> {lastResult.serviceModel.communicationCadence}</div>
                        <div className="flex items-center gap-2">
                          {lastResult.serviceModel.proactiveOutreach && <Badge variant="secondary" className="text-[10px]">Proactive Outreach</Badge>}
                          {lastResult.serviceModel.dedicatedTeam && <Badge variant="secondary" className="text-[10px]">Dedicated Team</Badge>}
                          {lastResult.serviceModel.prioritySupport && <Badge variant="secondary" className="text-[10px]">Priority Support</Badge>}
                          {lastResult.serviceModel.customReporting && <Badge variant="secondary" className="text-[10px]">Custom Reporting</Badge>}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center space-y-3">
                  <Layers className="h-10 w-10 mx-auto text-muted-foreground/50" />
                  <h3 className="font-semibold">No Classification Yet</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Click "Classify Client" to analyze a client's value, growth, engagement, and relationship metrics and assign them to a service tier.
                  </p>
                  <Button variant="outline" onClick={() => setShowDialog(true)} className="gap-2">
                    <Sparkles className="h-4 w-4" /> Get Started
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Segments list tab */}
          <TabsContent value="segments" className="space-y-3">
            {segmentsQ.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : segments.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center space-y-3">
                  <Users className="h-10 w-10 mx-auto text-muted-foreground/50" />
                  <h3 className="font-semibold">No Segments Yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Classify clients to see their segments here. Segments are created automatically when you run the classification engine.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {segments.map((seg: any) => {
                  const cfg = TIER_CONFIG[seg.tier] ?? TIER_CONFIG.silver;
                  const Icon = cfg.icon;
                  return (
                    <Card key={seg.id} className={cn("border", cfg.border)}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn("p-2 rounded-lg", cfg.bg)}>
                            <Icon className={cn("h-4 w-4", cfg.color)} />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Client #{seg.clientId}</p>
                            <p className="text-xs text-muted-foreground">
                              Score: {seg.totalScore} · V:{seg.valueScore} G:{seg.growthScore} E:{seg.engagementScore} R:{seg.relationshipScore}
                            </p>
                          </div>
                        </div>
                        <Badge className={cn(cfg.bg, cfg.color, "border", cfg.border)}>
                          {cfg.label}
                        </Badge>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
            {segments.length > 0 && (
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => segmentsQ.refetch()} className="gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Classify Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-400" />
                Classify Client
              </DialogTitle>
              <DialogDescription>
                Enter client metrics to determine their service tier. The engine scores value (35%), growth (25%), engagement (20%), and relationship (20%).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Client ID */}
              <div className="space-y-1.5">
                <Label htmlFor="cs-clientId">Client ID *</Label>
                <Input id="cs-clientId" type="number" placeholder="e.g. 1001" value={form.clientId} onChange={e => updateField("clientId", e.target.value)} />
              </div>

              {/* Value Metrics */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="h-3 w-3" /> Value Metrics
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">AUM ($)</Label>
                    <Input type="number" placeholder="500000" value={form.aum} onChange={e => updateField("aum", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Annual Revenue ($)</Label>
                    <Input type="number" placeholder="25000" value={form.annualRevenue} onChange={e => updateField("annualRevenue", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Referrals</Label>
                    <Input type="number" placeholder="3" value={form.referralsGenerated} onChange={e => updateField("referralsGenerated", e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Growth Metrics */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="h-3 w-3" /> Growth Metrics
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Net New Assets 12m ($)</Label>
                    <Input type="number" placeholder="100000" value={form.netNewAssets12m} onChange={e => updateField("netNewAssets12m", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">AUM Growth Rate</Label>
                    <Input type="number" step="0.01" placeholder="0.15" value={form.aumGrowthRate} onChange={e => updateField("aumGrowthRate", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Product Penetration (0-100)</Label>
                    <Input type="number" placeholder="60" value={form.productPenetration} onChange={e => updateField("productPenetration", e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Engagement Metrics */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="h-3 w-3" /> Engagement Metrics
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Meetings (12m)</Label>
                    <Input type="number" placeholder="4" value={form.meetingsAttended12m} onChange={e => updateField("meetingsAttended12m", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Avg Response (hrs)</Label>
                    <Input type="number" placeholder="8" value={form.responseTimeAvgHours} onChange={e => updateField("responseTimeAvgHours", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Portal Logins/mo</Label>
                    <Input type="number" placeholder="6" value={form.portalLoginFrequency} onChange={e => updateField("portalLoginFrequency", e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Relationship Metrics */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Heart className="h-3 w-3" /> Relationship Metrics
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Tenure (years)</Label>
                    <Input type="number" placeholder="5" value={form.tenureYears} onChange={e => updateField("tenureYears", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Satisfaction (0-100)</Label>
                    <Input type="number" placeholder="85" value={form.satisfactionScore} onChange={e => updateField("satisfactionScore", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Advocacy (0-100)</Label>
                    <Input type="number" placeholder="75" value={form.advocacyScore} onChange={e => updateField("advocacyScore", e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button onClick={() => { handleClassify(); setShowDialog(false); }} disabled={classifyMut.isPending} className="gap-2">
                {classifyMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Classify
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
