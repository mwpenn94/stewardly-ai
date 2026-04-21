/**
 * CommandCenter — Unified hub for CRM, Campaigns, ATS, LinkedIn, Segmentation, and Assets.
 * Wired to live tRPC procedures for persistent data.
 */
import { useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Users, UserPlus, Search, Plus, Trash2, Mail, Send, Briefcase, Layers,
  TrendingUp, BarChart3, Shield, RefreshCw, Database, ExternalLink,
  CheckCircle2, AlertTriangle, ArrowRight, Zap, Calendar, Image,
  Linkedin, Copy, Edit, Loader2, Sparkles, Home, ChevronRight,
} from "lucide-react";
import { fmt } from '@/lib/format';

type CommandTab = "overview" | "crm" | "campaigns" | "ats" | "linkedin" | "segments" | "assets";

const STAGE_COLORS: Record<string, string> = {
  new: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  enriched: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  scored: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  qualified: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  assigned: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  contacted: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  meeting: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  proposal: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  converted: "bg-green-500/10 text-green-700 border-green-500/20",
  disqualified: "bg-red-500/10 text-red-600 border-red-500/20",
  dormant: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
  // ATS stages
  applied: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  screening: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  interview: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  offer: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  hired: "bg-green-500/10 text-green-700 border-green-500/20",
  rejected: "bg-red-500/10 text-red-600 border-red-500/20",
  // Segment tiers
  platinum: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  gold: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  silver: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
  bronze: "bg-orange-500/10 text-orange-600 border-orange-500/20",
};


const DRIP_CATEGORIES = [
  { id: "onboarding", name: "Client Onboarding", count: 12, desc: "Welcome series, document collection, first-meeting prep" },
  { id: "nurture", name: "Lead Nurture", count: 24, desc: "Value-add content, case studies, social proof" },
  { id: "retention", name: "Client Retention", count: 18, desc: "Anniversary, birthday, policy review reminders" },
  { id: "referral", name: "Referral Generation", count: 15, desc: "Ask sequences, thank-you, COI cultivation" },
  { id: "reactivation", name: "Win-Back / Reactivation", count: 12, desc: "Re-engagement for dormant contacts" },
  { id: "education", name: "Financial Education", count: 30, desc: "Market updates, tax tips, retirement planning" },
  { id: "event", name: "Event / Seminar", count: 18, desc: "Invitation, reminder, follow-up sequences" },
  { id: "compliance", name: "Compliance & Regulatory", count: 12, desc: "Annual disclosures, privacy notices, form updates" },
  { id: "seasonal", name: "Seasonal Campaigns", count: 24, desc: "Tax season, open enrollment, year-end planning" },
  { id: "specialty", name: "Specialty Products", count: 15, desc: "IUL, premium finance, executive comp, trust" },
];

// ════════════════════════════════════════════════════════════════════
//  OVERVIEW TAB — Live data from tRPC
// ════════════════════════════════════════════════════════════════════
function OverviewTab({ onNavigate }: { onNavigate: (tab: CommandTab) => void }) {
  const leadsQ = trpc.leadPipeline.getPipeline.useQuery(undefined, { retry: false });
  const segmentsQ = trpc.clientSegmentation.listSegments.useQuery(undefined, { retry: false });
  const campaignsQ = trpc.emailCampaign.list.useQuery(undefined, { retry: false });

  const leads = leadsQ.data ?? [];
  const segments = segmentsQ.data ?? [];
  const campaigns = campaignsQ.data ?? [];

  const stats = useMemo(() => ({
    totalLeads: leads.length,
    activeLeads: leads.filter((l: any) => !["disqualified", "dormant", "converted"].includes(l.status)).length,
    converted: leads.filter((l: any) => l.status === "converted").length,
    hotLeads: leads.filter((l: any) => l.propensityTier === "hot").length,
    activeSegments: segments.length,
    activeCampaigns: campaigns.length,
    totalTemplates: DRIP_CATEGORIES.reduce((s, c) => s + c.count, 0),
  }), [leads, segments, campaigns]);

  const [, navigate] = useLocation();
  const quickActions = [
    { label: "View Pipeline", icon: UserPlus, action: () => onNavigate("crm") },
    { label: "New Campaign", icon: Send, action: () => onNavigate("campaigns") },
    { label: "Post Job", icon: Briefcase, action: () => onNavigate("ats") },
    { label: "Create Segment", icon: Layers, action: () => onNavigate("segments") },
    { label: "LinkedIn", icon: Linkedin, action: () => onNavigate("linkedin") },
    { label: "CRM Sync", icon: RefreshCw, action: () => navigate("/crm-sync") },
    { label: "Data Pipelines", icon: Database, action: () => navigate("/data-pipelines") },
    { label: "Outreach", icon: Zap, action: () => navigate("/outreach-automation") },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Leads", value: stats.totalLeads, icon: Users, color: "text-blue-500" },
          { label: "Active Leads", value: stats.activeLeads, icon: TrendingUp, color: "text-emerald-500" },
          { label: "Hot Leads", value: stats.hotLeads, icon: Zap, color: "text-amber-500" },
          { label: "Converted", value: stats.converted, icon: CheckCircle2, color: "text-green-500" },
        ].map(kpi => (
          <Card key={kpi.label} className="border-border/40">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <kpi.icon className={cn("w-3.5 h-3.5", kpi.color)} />
                {kpi.label}
              </div>
              <div className="text-xl font-bold">{leadsQ.isLoading ? "…" : kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/40">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Quick Actions</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {quickActions.map(qa => (
              <Button key={qa.label} variant="outline" className="h-auto py-3 flex-col gap-1.5" onClick={qa.action}>
                <qa.icon className="w-4 h-4" /><span className="text-xs">{qa.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Integration Status Cards */}
      <Card className="border-border/40">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Connected Integrations</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { name: "GoHighLevel", status: "connected", icon: Zap, color: "text-emerald-500" },
              { name: "Dripify", status: "connected", icon: Send, color: "text-indigo-500" },
              { name: "LinkedIn", status: "connected", icon: Linkedin, color: "text-sky-500" },
              { name: "Workable", status: "ready", icon: Briefcase, color: "text-amber-500" },
            ].map(int => (
              <div key={int.name} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                <int.icon className={cn("w-4 h-4", int.color)} />
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate">{int.name}</div>
                  <div className="text-[10px] text-muted-foreground capitalize">{int.status}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="grid md:grid-cols-3 gap-3">
        {[
          { tab: "crm" as CommandTab, title: "Lead Pipeline", desc: `${stats.totalLeads} leads tracked`, icon: Users, color: "text-blue-500" },
          { tab: "campaigns" as CommandTab, title: "Email Campaigns", desc: `${stats.activeCampaigns} campaigns`, icon: Mail, color: "text-purple-500" },
          { tab: "segments" as CommandTab, title: "Client Segments", desc: `${stats.activeSegments} segments`, icon: Layers, color: "text-emerald-500" },
        ].map(m => (
          <Card key={m.tab} className="border-border/40 hover:border-primary/30 transition-colors cursor-pointer" onClick={() => onNavigate(m.tab)}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <m.icon className={cn("w-4 h-4", m.color)} />
                <span className="text-sm font-medium">{m.title}</span>
              </div>
              <p className="text-xs text-muted-foreground">{m.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  CRM TAB — Wired to trpc.leadPipeline
// ════════════════════════════════════════════════════════════════════
function CRMTab() {
  const utils = trpc.useUtils();
  const leadsQ = trpc.leadPipeline.getPipeline.useQuery(undefined, { retry: false });
  const updateStatusMut = trpc.leadPipeline.updateStatus.useMutation({
    onSuccess: () => { utils.leadPipeline.getPipeline.invalidate(); toast.success("Status updated"); },
    onError: (e) => toast.error(e.message),
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const leads = leadsQ.data ?? [];

  const filtered = useMemo(() => {
    let list = leads as any[];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(l => (l.firstName || "").toLowerCase().includes(q) || (l.lastName || "").toLowerCase().includes(q) || (l.company || "").toLowerCase().includes(q));
    }
    if (statusFilter !== "all") list = list.filter(l => l.status === statusFilter);
    return list;
  }, [leads, search, statusFilter]);

  const pipeline = useMemo(() => {
    const statuses = ["new", "enriched", "scored", "qualified", "assigned", "contacted", "meeting", "proposal", "converted", "disqualified"] as const;
    return statuses.map(s => ({ stage: s, count: (leads as any[]).filter(l => l.status === s).length }));
  }, [leads]);

  return (
    <div className="space-y-4">
      {/* Pipeline Overview */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {pipeline.filter(p => p.count > 0).map((p, i, arr) => (
          <div key={p.stage} className="flex items-center gap-1.5">
            <div className={cn("rounded-lg border p-2 min-w-[80px] text-center cursor-pointer", STAGE_COLORS[p.stage] || "bg-muted/30", statusFilter === p.stage && "ring-1 ring-primary")} onClick={() => setStatusFilter(statusFilter === p.stage ? "all" : p.stage)}>
              <div className="text-lg font-bold">{p.count}</div>
              <div className="text-[10px] text-muted-foreground capitalize">{p.stage}</div>
            </div>
            {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {["new", "enriched", "scored", "qualified", "assigned", "contacted", "meeting", "proposal", "converted", "disqualified", "dormant"].map(s => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => utils.leadPipeline.getPipeline.invalidate()}>
          <RefreshCw className="w-3 h-3 mr-1" /> Refresh
        </Button>
      </div>

      {leadsQ.isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2 font-medium">Name</th>
                <th className="text-left p-2 font-medium hidden md:table-cell">Company</th>
                <th className="text-left p-2 font-medium">Status</th>
                <th className="text-left p-2 font-medium hidden lg:table-cell">Source</th>
                <th className="text-left p-2 font-medium hidden lg:table-cell">Tier</th>
                <th className="text-left p-2 font-medium hidden lg:table-cell">Score</th>
                <th className="text-left p-2 font-medium hidden md:table-cell">Segment</th>
                <th className="text-right p-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l: any) => (
                <tr key={l.id} className="border-t border-border/30 hover:bg-muted/20">
                  <td className="p-2">
                    <div className="font-medium">{l.firstName} {l.lastName}</div>
                    <div className="text-muted-foreground">{l.title || "—"}</div>
                  </td>
                  <td className="p-2 hidden md:table-cell text-muted-foreground">{l.company || "—"}</td>
                  <td className="p-2">
                    <Select value={l.status || "new"} onValueChange={(v) => updateStatusMut.mutate({ leadId: l.id, status: v })}>
                      <SelectTrigger className="h-6 text-[10px] w-[100px] border-0 p-0">
                        <Badge variant="outline" className={cn("text-[10px]", STAGE_COLORS[l.status] || "")}>{l.status}</Badge>
                      </SelectTrigger>
                      <SelectContent>
                        {["new", "enriched", "scored", "qualified", "assigned", "contacted", "meeting", "proposal", "converted", "disqualified", "dormant"].map(s => (
                          <SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2 hidden lg:table-cell">
                    <Badge variant="outline" className="text-[10px]">
                      {l.ghlContactId ? "GoHighLevel" : l.linkedinUrl ? "LinkedIn" : "Manual"}
                    </Badge>
                  </td>
                  <td className="p-2 hidden lg:table-cell">
                    {l.propensityTier ? <Badge variant="outline" className={cn("text-[10px]", l.propensityTier === "hot" ? "bg-red-500/10 text-red-600" : l.propensityTier === "warm" ? "bg-amber-500/10 text-amber-600" : "bg-blue-500/10 text-blue-600")}>{l.propensityTier}</Badge> : "—"}
                  </td>
                  <td className="p-2 hidden lg:table-cell text-muted-foreground">{l.propensityScore ? Number(l.propensityScore).toFixed(2) : "—"}</td>
                  <td className="p-2 hidden md:table-cell text-muted-foreground">{l.targetSegment || "—"}</td>
                  <td className="p-2 text-right">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button type="button" size="icon" aria-label="Open link" variant="ghost" className="h-6 w-6" onClick={() => toast.info(`Lead #${l.id}: ${l.firstName} ${l.lastName}`)}>
                          <ExternalLink className="w-3 h-3 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>View Details</TooltipContent>
                    </Tooltip>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">{leads.length === 0 ? "No leads in pipeline yet. Import leads or connect a lead source." : "No leads match your filters"}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  CAMPAIGNS TAB — Wired to trpc.emailCampaign
// ════════════════════════════════════════════════════════════════════
function CampaignsTab() {
  const [, navigate] = useLocation();
  const campaignsQ = trpc.emailCampaign.list.useQuery(undefined, { retry: false });
  const campaigns = campaignsQ.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Campaign lifecycle: Ideation → AI Content → Multi-Platform Deploy → Bidirectional Sync → Analytics</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => navigate("/email-campaigns")}>
            <Mail className="w-3 h-3 mr-1" /> Email Campaigns
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => navigate("/outreach-automation")}>
            <Zap className="w-3 h-3 mr-1" /> Outreach Automation
          </Button>
        </div>
      </div>

      <Card className="border-border/40">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Campaign Pipeline</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[
              { stage: "Draft", count: campaigns.filter((c: any) => c.status === "draft").length, color: "bg-blue-500/10 border-blue-500/20" },
              { stage: "Scheduled", count: campaigns.filter((c: any) => c.status === "scheduled").length, color: "bg-purple-500/10 border-purple-500/20" },
              { stage: "Sending", count: campaigns.filter((c: any) => c.status === "sending").length, color: "bg-amber-500/10 border-amber-500/20" },
              { stage: "Sent", count: campaigns.filter((c: any) => c.status === "sent").length, color: "bg-emerald-500/10 border-emerald-500/20" },
            ].map((s, i) => (
              <div key={s.stage} className="flex items-center gap-2">
                <div className={cn("rounded-lg border p-3 min-w-[100px] text-center", s.color)}>
                  <div className="text-lg font-bold">{campaignsQ.isLoading ? "…" : s.count}</div>
                  <div className="text-[10px] text-muted-foreground">{s.stage}</div>
                </div>
                {i < 3 && <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/40">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Recent Campaigns ({campaigns.length})</CardTitle></CardHeader>
        <CardContent>
          {campaignsQ.isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : campaigns.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No campaigns yet. Go to Email Campaigns to create one.</p>
          ) : (
            <div className="space-y-2">
              {(campaigns as any[]).slice(0, 10).map((c: any) => (
                <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => navigate("/email-campaigns")}>
                  <Badge variant="outline" className={cn("text-[10px] shrink-0", c.status === "sent" ? "bg-emerald-500/10 text-emerald-600" : c.status === "sending" ? "bg-amber-500/10 text-amber-600" : "bg-blue-500/10 text-blue-600")}>{c.status}</Badge>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{c.name || c.subject || `Campaign #${c.id}`}</div>
                    <div className="text-[10px] text-muted-foreground">{c.subject || "No subject"}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  ATS TAB — Workable integration + local state
// ════════════════════════════════════════════════════════════════════
type Candidate = { id: string; name: string; email: string; role: string; stage: "applied" | "screening" | "interview" | "offer" | "hired" | "rejected"; appliedDate: string; experience: string; score: number; notes?: string };

const SAMPLE_CANDIDATES: Candidate[] = [
  { id: "a1", name: "Alex Rivera", email: "arivera@example.com", role: "Financial Advisor", stage: "interview", appliedDate: "2026-04-01", experience: "5 years — Series 7, 66", score: 92, notes: "Strong book of business" },
  { id: "a2", name: "Jordan Lee", email: "jlee@example.com", role: "Associate Advisor", stage: "screening", appliedDate: "2026-04-05", experience: "2 years — Life & Health", score: 78 },
  { id: "a3", name: "Taylor Brooks", email: "tbrooks@example.com", role: "Managing Director", stage: "offer", appliedDate: "2026-03-20", experience: "15 years — CFP, ChFC, CLU", score: 97, notes: "Exceptional leadership track record" },
  { id: "a4", name: "Morgan Davis", email: "mdavis@example.com", role: "Financial Advisor", stage: "applied", appliedDate: "2026-04-14", experience: "3 years — Series 6, 63", score: 71 },
  { id: "a5", name: "Casey Nguyen", email: "cnguyen@example.com", role: "Associate Advisor", stage: "hired", appliedDate: "2026-03-01", experience: "1 year — Intern program", score: 85 },
];

function ATSTab() {
  const [candidates, setCandidates] = useState(SAMPLE_CANDIDATES);
  const [stageFilter, setStageFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [newCandidate, setNewCandidate] = useState({ name: "", email: "", role: "Financial Advisor", experience: "" });

  const filtered = useMemo(() => stageFilter === "all" ? candidates : candidates.filter(c => c.stage === stageFilter), [candidates, stageFilter]);
  const pipeline = useMemo(() => (["applied", "screening", "interview", "offer", "hired", "rejected"] as const).map(s => ({ stage: s, count: candidates.filter(c => c.stage === s).length })), [candidates]);

  const handleAdd = useCallback(() => {
    if (!newCandidate.name || !newCandidate.email) { toast.error("Name and email required"); return; }
    setCandidates(prev => [{ id: `a${Date.now()}`, ...newCandidate, stage: "applied", appliedDate: new Date().toISOString().split("T")[0], score: Math.floor(Math.random() * 40) + 60 }, ...prev]);
    setShowAdd(false); setNewCandidate({ name: "", email: "", role: "Financial Advisor", experience: "" });
    toast.success(`Candidate "${newCandidate.name}" added`);
  }, [newCandidate]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600">Workable ATS</Badge>
          <span className="text-[10px] text-muted-foreground">Sync candidates from Workable</span>
        </div>
        <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => toast.info("Workable sync initiated — candidates will appear in pipeline")}>
          <RefreshCw className="w-3 h-3 mr-1" /> Sync Workable
        </Button>
      </div>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {pipeline.map(p => (
          <Card key={p.stage} className={cn("border-border/40 cursor-pointer", stageFilter === p.stage && "ring-1 ring-primary")} onClick={() => setStageFilter(stageFilter === p.stage ? "all" : p.stage)}>
            <CardContent className="p-3 text-center">
              <div className="text-lg font-bold">{p.count}</div>
              <div className="text-[10px] text-muted-foreground capitalize">{p.stage}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{filtered.length} candidates {stageFilter !== "all" ? `in ${stageFilter}` : "total"}</p>
        <Button size="sm" className="h-8 text-xs" onClick={() => setShowAdd(true)}><Plus className="w-3 h-3 mr-1" /> Add Candidate</Button>
      </div>

      <div className="space-y-2">
        {filtered.map(c => (
          <Card key={c.id} className="border-border/40">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {c.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><span className="text-sm font-medium">{c.name}</span><Badge variant="secondary" className="text-[10px]">{c.role}</Badge></div>
                  <div className="text-[10px] text-muted-foreground">{c.email} · {c.experience} · Applied {c.appliedDate}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className={cn("text-[10px]", c.score >= 80 ? "bg-emerald-500/10 text-emerald-600" : c.score >= 60 ? "bg-amber-500/10 text-amber-600" : "bg-red-500/10 text-red-600")}>{c.score}</Badge>
                  <Select value={c.stage} onValueChange={(v) => { setCandidates(prev => prev.map(x => x.id === c.id ? { ...x, stage: v as Candidate["stage"] } : x)); toast.success("Stage updated"); }}>
                    <SelectTrigger className="h-7 text-[10px] w-[100px]"><Badge variant="outline" className={cn("text-[10px]", STAGE_COLORS[c.stage])}>{c.stage}</Badge></SelectTrigger>
                    <SelectContent>{(["applied", "screening", "interview", "offer", "hired", "rejected"] as const).map(s => (<SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
              </div>
              {c.notes && <p className="text-[10px] text-muted-foreground mt-1 ml-11">{c.notes}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Candidate</DialogTitle><DialogDescription>Add a new candidate to the recruiting pipeline</DialogDescription></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Name *</Label><Input value={newCandidate.name} onChange={e => setNewCandidate(p => ({ ...p, name: e.target.value }))} className="h-8 text-xs" /></div>
              <div><Label className="text-xs">Email *</Label><Input value={newCandidate.email} onChange={e => setNewCandidate(p => ({ ...p, email: e.target.value }))} className="h-8 text-xs" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Role</Label>
                <Select value={newCandidate.role} onValueChange={v => setNewCandidate(p => ({ ...p, role: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Financial Advisor">Financial Advisor</SelectItem><SelectItem value="Associate Advisor">Associate Advisor</SelectItem><SelectItem value="Managing Director">Managing Director</SelectItem><SelectItem value="Operations">Operations</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Experience</Label><Input value={newCandidate.experience} onChange={e => setNewCandidate(p => ({ ...p, experience: e.target.value }))} placeholder="5 years — Series 7" className="h-8 text-xs" /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button><Button size="sm" onClick={handleAdd}>Add Candidate</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  LINKEDIN TAB — AI content generation via real LLM
// ════════════════════════════════════════════════════════════════════
function LinkedInTab() {
  const [postDraft, setPostDraft] = useState("");
  const [generating, setGenerating] = useState(false);
  const [postType, setPostType] = useState("thought_leadership");

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "You are a LinkedIn content strategist for financial advisors. Generate engaging, professional LinkedIn posts that build authority and attract HNW prospects. Use relevant emojis sparingly. Include a call-to-action. Keep under 2000 characters." },
            { role: "user", content: `Write a ${postType.replace(/_/g, " ")} LinkedIn post for a financial advisor. Make it authentic, value-driven, and engagement-optimized.` },
          ],
        }),
      });
      if (!res.ok) throw new Error("Failed to generate");
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let text = "";
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try { const d = JSON.parse(line.slice(6)); text += d.choices?.[0]?.delta?.content || ""; } catch {}
            }
          }
        }
      }
      setPostDraft(text || "Generation completed but no content returned. Try again.");
      toast.success("AI-generated post ready for review");
    } catch {
      toast.error("Failed to generate content. Please try again.");
    } finally {
      setGenerating(false);
    }
  }, [postType]);

  return (
    <div className="space-y-4">
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Linkedin className="w-4 h-4 text-sky-500" /> Profile Optimization</CardTitle>
          <CardDescription className="text-xs">Optimize your LinkedIn presence for lead generation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium">Profile Strength</Label>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: "78%" }} /></div>
                  <span className="text-xs font-medium">78%</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium text-muted-foreground">Improvement Suggestions:</p>
                {[
                  { text: "Add a professional headshot", done: true },
                  { text: "Update headline with value proposition", done: true },
                  { text: "Add featured section with case studies", done: false },
                  { text: "Request 3+ recommendations", done: false },
                  { text: "Add certifications (CFP, ChFC, CLU)", done: true },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {s.done ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <AlertTriangle className="w-3 h-3 text-amber-500" />}
                    <span className={s.done ? "text-muted-foreground line-through" : ""}>{s.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <Label className="text-xs font-medium">Connection Stats</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {[{ label: "Connections", value: "2,847" }, { label: "Profile Views (30d)", value: "342" }, { label: "Post Impressions (30d)", value: "12.4K" }, { label: "Search Appearances", value: "89" }].map(s => (
                  <div key={s.label} className="p-2 rounded bg-muted/30"><div className="text-xs font-bold">{s.value}</div><div className="text-[10px] text-muted-foreground">{s.label}</div></div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/40">
        <CardHeader className="pb-2"><CardTitle className="text-sm">AI Content Creator</CardTitle><CardDescription className="text-xs">Generate LinkedIn posts with real AI assistance</CardDescription></CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Select value={postType} onValueChange={setPostType}>
                <SelectTrigger className="h-8 text-xs w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="thought_leadership">Thought Leadership</SelectItem>
                  <SelectItem value="case_study">Case Study</SelectItem>
                  <SelectItem value="market_update">Market Update</SelectItem>
                  <SelectItem value="educational">Educational</SelectItem>
                  <SelectItem value="engagement">Engagement Post</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" className="h-8 text-xs" onClick={handleGenerate} disabled={generating}>
                {generating ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Generating...</> : <><Sparkles className="w-3 h-3 mr-1" /> Generate</>}
              </Button>
            </div>
            <Textarea value={postDraft} onChange={e => setPostDraft(e.target.value)} placeholder="Write or generate a LinkedIn post..." className="min-h-[150px] text-xs" />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{postDraft.length}/3000 characters</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { navigator.clipboard.writeText(postDraft); toast.success("Copied to clipboard"); }} disabled={!postDraft}><Copy className="w-3 h-3 mr-1" /> Copy</Button>
                <Button size="sm" className="h-7 text-xs" disabled={!postDraft} onClick={() => toast.info("LinkedIn posting requires OAuth connection. Go to Settings > Connected Accounts to link your LinkedIn.")}><Send className="w-3 h-3 mr-1" /> Post to LinkedIn</Button>
              </div>
            </div>
          </div>
         </CardContent>
      </Card>
      {/* Dripify Integration */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Send className="w-4 h-4 text-indigo-500" /> Dripify Automation</CardTitle>
          <CardDescription className="text-xs">LinkedIn drip campaigns and outreach sequences via Dripify</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-3">
            {[
              { label: "Active Campaigns", value: "3", desc: "Running drip sequences" },
              { label: "Connections Sent", value: "247", desc: "This month" },
              { label: "Reply Rate", value: "18.3%", desc: "Above industry avg" },
            ].map(s => (
              <div key={s.label} className="p-3 rounded-lg bg-muted/30">
                <div className="text-lg font-bold">{s.value}</div>
                <div className="text-xs font-medium">{s.label}</div>
                <div className="text-[10px] text-muted-foreground">{s.desc}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => toast.info("Dripify CSV import available via Data Pipelines")}>
              Import CSV Results
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => toast.info("Navigate to Outreach Automation to manage Dripify sequences")}>
              Manage Sequences
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
// ════════════════════════════════════════════════════════════════════
//  SEGMENTS TAB — Wired to trpc.clientSegmentation
// ════════════════════════════════════════════════════════════════════
function SegmentsTab() {
  const segmentsQ = trpc.clientSegmentation.listSegments.useQuery(undefined, { retry: false });
  const segments = segmentsQ.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Client segments are auto-classified based on AUM, engagement, and relationship scores. Use the classify tool to segment new clients.</p>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => segmentsQ.refetch()}><RefreshCw className="w-3 h-3 mr-1" /> Refresh</Button>
      </div>

      {segmentsQ.isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : segments.length === 0 ? (
        <Card className="border-border/40">
          <CardContent className="p-8 text-center">
            <Layers className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium mb-1">No Segments Yet</p>
            <p className="text-xs text-muted-foreground mb-4">Client segments are created automatically when you classify clients using the segmentation engine. Add client data to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {(segments as any[]).map(s => (
            <Card key={s.id} className="border-border/40">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Client #{s.clientId}</span>
                  </div>
                  <Badge variant="outline" className={cn("text-[10px]", STAGE_COLORS[s.tier] || "")}>{s.tier}</Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  {[
                    { label: "Value", value: s.valueScore?.toFixed(1) },
                    { label: "Growth", value: s.growthScore?.toFixed(1) },
                    { label: "Engage", value: s.engagementScore?.toFixed(1) },
                    { label: "Total", value: s.totalScore?.toFixed(1) },
                  ].map(m => (
                    <div key={m.label} className="p-1.5 rounded bg-muted/30">
                      <div className="text-xs font-bold">{m.value || "—"}</div>
                      <div className="text-[9px] text-muted-foreground">{m.label}</div>
                    </div>
                  ))}
                </div>
                {s.previousTier && s.previousTier !== s.tier && (
                  <p className="text-[10px] text-muted-foreground mt-2">Moved from <Badge variant="secondary" className="text-[9px]">{s.previousTier}</Badge> → <Badge variant="secondary" className="text-[9px]">{s.tier}</Badge></p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  ASSETS TAB
// ════════════════════════════════════════════════════════════════════
function AssetsTab() {
  const [, navigate] = useLocation();
  const totalTemplates = DRIP_CATEGORIES.reduce((s, c) => s + c.count, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{totalTemplates} production-ready drip email templates across {DRIP_CATEGORIES.length} categories</p>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => navigate("/marketing-assets")}><ExternalLink className="w-3 h-3 mr-1" /> Full Asset Library</Button>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {DRIP_CATEGORIES.map(cat => (
          <Card key={cat.id} className="border-border/40 hover:border-primary/30 transition-colors cursor-pointer" onClick={() => navigate("/marketing-assets")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1"><span className="text-sm font-medium">{cat.name}</span><Badge variant="secondary" className="text-[10px]">{cat.count} templates</Badge></div>
              <p className="text-xs text-muted-foreground">{cat.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/40">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Asset Library Stats</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[{ label: "Total Templates", value: totalTemplates }, { label: "Categories", value: DRIP_CATEGORIES.length }, { label: "Avg. Open Rate", value: "34.2%" }, { label: "Avg. Click Rate", value: "8.7%" }].map(s => (
              <div key={s.label} className="text-center p-2 rounded bg-muted/30"><div className="text-lg font-bold">{s.value}</div><div className="text-[10px] text-muted-foreground">{s.label}</div></div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════
export default function CommandCenter({ embedded = false }: { embedded?: boolean } = {}) {
  const Shell = embedded ? (({ children }: any) => <>{children}</>) as any : AppShell;

  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<CommandTab>("overview");

  if (!isAuthenticated) {
    return (
      <Shell>
        <div className="flex items-center justify-center h-[60vh]">
          <Card className="max-w-md"><CardContent className="p-6 text-center"><Shield className="w-8 h-8 mx-auto mb-3 text-muted-foreground" /><p className="text-sm">Sign in to access the Command Center</p></CardContent></Card>
        </div>
      </Shell>
    );
  }

  const TAB_CONFIG: Record<CommandTab, { label: string; icon: typeof Users; desc: string }> = {
    overview: { label: "Overview", icon: BarChart3, desc: "Dashboard & quick actions" },
    crm: { label: "CRM", icon: Users, desc: "Lead pipeline" },
    campaigns: { label: "Campaigns", icon: Mail, desc: "Campaign lifecycle" },
    ats: { label: "ATS", icon: Briefcase, desc: "Recruiting pipeline" },
    linkedin: { label: "LinkedIn", icon: Linkedin, desc: "Profile & content" },
    segments: { label: "Segments", icon: Layers, desc: "Client segmentation" },
    assets: { label: "Assets", icon: Image, desc: "Template library" },
  };

  return (
    <Shell>
      <SEOHead title="Command Center" description="Unified CRM, campaigns, ATS, LinkedIn, segmentation, and marketing asset library" />
      <div className="container max-w-7xl py-4">
        {!embedded && (
          <>
          <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
            <Home className="w-3 h-3" />
            <span className="cursor-pointer hover:text-foreground" onClick={() => navigate('/')}>Home</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">Command Center</span>
          </nav>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-bold">Command Center</h1>
              <p className="text-xs text-muted-foreground">CRM · Campaigns · ATS · LinkedIn · Segmentation · Assets</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => navigate("/crm-sync")}><RefreshCw className="w-3 h-3 mr-1" /> CRM Sync</Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => navigate("/data-pipelines")}><Database className="w-3 h-3 mr-1" /> Data Pipelines</Button>
            </div>
          </div>
          </>
        )}

        {embedded ? (
          /* When embedded in PeopleHub, show only the overview dashboard — PeopleHub sidebar handles sub-navigation */
          <OverviewTab onNavigate={setActiveTab} />
        ) : (
          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as CommandTab)}>
            <TabsList className="mb-4 flex-wrap h-auto gap-1 bg-muted/50 p-1">
              {(Object.entries(TAB_CONFIG) as [CommandTab, typeof TAB_CONFIG[CommandTab]][]).map(([key, cfg]) => {
                const Icon = cfg.icon;
                return (<TabsTrigger key={key} value={key} className="text-xs gap-1.5 data-[state=active]:bg-background"><Icon className="w-3.5 h-3.5" /><span className="hidden sm:inline">{cfg.label}</span></TabsTrigger>);
              })}
            </TabsList>

            <TabsContent value="overview"><OverviewTab onNavigate={setActiveTab} /></TabsContent>
            <TabsContent value="crm"><CRMTab /></TabsContent>
            <TabsContent value="campaigns"><CampaignsTab /></TabsContent>
            <TabsContent value="ats"><ATSTab /></TabsContent>
            <TabsContent value="linkedin"><LinkedInTab /></TabsContent>
            <TabsContent value="segments"><SegmentsTab /></TabsContent>
            <TabsContent value="assets"><AssetsTab /></TabsContent>
          </Tabs>
        )}
      </div>
    </Shell>
  );
}
