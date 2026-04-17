/**
 * CommandCenter.tsx — Unified Command Center Hub
 *
 * True multi-platform command center: CRM, campaigns, ATS, LinkedIn,
 * segmentation, and marketing asset library in one surface.
 * Phase 5 of Pass 106.
 */
import { useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SEOHead } from "@/components/SEOHead";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Users, Mail, Target, Zap, Image, Database, RefreshCw,
  Plus, Search, Filter, MoreHorizontal, ExternalLink,
  BarChart3, TrendingUp, Clock, CheckCircle2, AlertTriangle,
  Briefcase, UserPlus, Linkedin, Tag, Layers, Send,
  FileText, Download, Copy, Eye, Edit, Trash2, Play, Pause,
  ArrowRight, ChevronRight, Activity, Shield, Star,
  Calendar, Phone, MapPin, Globe, Building2, Loader2, Sparkles,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────
type CommandTab = "overview" | "crm" | "campaigns" | "ats" | "linkedin" | "segments" | "assets";

interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  stage: "lead" | "prospect" | "client" | "inactive";
  tags: string[];
  lastContact?: string;
  value?: number;
  source?: string;
}

interface Candidate {
  id: string;
  name: string;
  email: string;
  role: string;
  stage: "applied" | "screening" | "interview" | "offer" | "hired" | "rejected";
  appliedDate: string;
  experience: string;
  score: number;
  notes?: string;
}

interface Segment {
  id: string;
  name: string;
  description: string;
  rules: SegmentRule[];
  count: number;
  createdAt: string;
  isActive: boolean;
}

interface SegmentRule {
  field: string;
  operator: "equals" | "contains" | "gt" | "lt" | "between" | "in";
  value: string;
}

// ─── Sample Data ───────────────────────────────────────────────────
const SAMPLE_CONTACTS: Contact[] = [
  { id: "c1", name: "Sarah Johnson", email: "sarah@example.com", phone: "(555) 123-4567", company: "Tech Corp", stage: "client", tags: ["HNW", "Retirement"], lastContact: "2026-04-15", value: 2500000, source: "Referral" },
  { id: "c2", name: "Michael Chen", email: "mchen@example.com", phone: "(555) 234-5678", company: "Chen Enterprises", stage: "prospect", tags: ["Business Owner", "Estate"], lastContact: "2026-04-10", value: 5000000, source: "LinkedIn" },
  { id: "c3", name: "Emily Rodriguez", email: "erodriguez@example.com", company: "Rodriguez Law", stage: "lead", tags: ["Attorney", "COI"], lastContact: "2026-04-08", source: "Seminar" },
  { id: "c4", name: "David Kim", email: "dkim@example.com", phone: "(555) 345-6789", stage: "client", tags: ["IUL", "DI"], lastContact: "2026-04-14", value: 750000, source: "Cold Call" },
  { id: "c5", name: "Lisa Thompson", email: "lthompson@example.com", company: "Thompson Dental", stage: "prospect", tags: ["Business Owner", "Group Benefits"], lastContact: "2026-04-12", value: 1200000, source: "Referral" },
  { id: "c6", name: "James Wilson", email: "jwilson@example.com", stage: "inactive", tags: ["Former Client"], lastContact: "2025-12-01", source: "Database" },
  { id: "c7", name: "Amanda Foster", email: "afoster@example.com", phone: "(555) 456-7890", company: "Foster Consulting", stage: "client", tags: ["HNW", "Trust", "Premium Finance"], lastContact: "2026-04-16", value: 8000000, source: "COI Referral" },
  { id: "c8", name: "Robert Martinez", email: "rmartinez@example.com", stage: "lead", tags: ["Young Professional"], lastContact: "2026-04-11", source: "Social Media" },
];

const SAMPLE_CANDIDATES: Candidate[] = [
  { id: "a1", name: "Alex Rivera", email: "arivera@example.com", role: "Financial Advisor", stage: "interview", appliedDate: "2026-04-01", experience: "5 years — Series 7, 66", score: 92, notes: "Strong book of business" },
  { id: "a2", name: "Jordan Lee", email: "jlee@example.com", role: "Associate Advisor", stage: "screening", appliedDate: "2026-04-05", experience: "2 years — Life & Health", score: 78 },
  { id: "a3", name: "Taylor Brooks", email: "tbrooks@example.com", role: "Managing Director", stage: "offer", appliedDate: "2026-03-20", experience: "15 years — CFP, ChFC, CLU", score: 97, notes: "Exceptional leadership track record" },
  { id: "a4", name: "Morgan Davis", email: "mdavis@example.com", role: "Financial Advisor", stage: "applied", appliedDate: "2026-04-14", experience: "3 years — Series 6, 63", score: 71 },
  { id: "a5", name: "Casey Nguyen", email: "cnguyen@example.com", role: "Associate Advisor", stage: "hired", appliedDate: "2026-03-01", experience: "1 year — Intern program", score: 85 },
  { id: "a6", name: "Sam Patel", email: "spatel@example.com", role: "Financial Advisor", stage: "rejected", appliedDate: "2026-03-15", experience: "4 years — P&C only", score: 45 },
];

const SAMPLE_SEGMENTS: Segment[] = [
  { id: "s1", name: "High Net Worth Clients", description: "Clients with AUM > $1M", rules: [{ field: "value", operator: "gt", value: "1000000" }, { field: "stage", operator: "equals", value: "client" }], count: 3, createdAt: "2026-01-15", isActive: true },
  { id: "s2", name: "Business Owners", description: "Prospects and clients who own businesses", rules: [{ field: "tags", operator: "contains", value: "Business Owner" }], count: 2, createdAt: "2026-02-01", isActive: true },
  { id: "s3", name: "Retirement Planning", description: "Contacts interested in retirement", rules: [{ field: "tags", operator: "contains", value: "Retirement" }], count: 1, createdAt: "2026-03-10", isActive: true },
  { id: "s4", name: "Re-engagement", description: "Inactive contacts for win-back campaigns", rules: [{ field: "stage", operator: "equals", value: "inactive" }], count: 1, createdAt: "2026-04-01", isActive: false },
  { id: "s5", name: "COI Network", description: "Centers of influence (attorneys, CPAs)", rules: [{ field: "tags", operator: "contains", value: "COI" }], count: 1, createdAt: "2026-03-20", isActive: true },
];

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

const STAGE_COLORS: Record<string, string> = {
  lead: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  prospect: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  client: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  inactive: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
  applied: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  screening: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  interview: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  offer: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  hired: "bg-green-500/10 text-green-700 border-green-500/20",
  rejected: "bg-red-500/10 text-red-600 border-red-500/20",
};

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

// ════════════════════════════════════════════════════════════════════
//  OVERVIEW TAB
// ════════════════════════════════════════════════════════════════════
function OverviewTab({ onNavigate }: { onNavigate: (tab: CommandTab) => void }) {
  const stats = useMemo(() => ({
    totalContacts: SAMPLE_CONTACTS.length,
    activeClients: SAMPLE_CONTACTS.filter(c => c.stage === "client").length,
    prospects: SAMPLE_CONTACTS.filter(c => c.stage === "prospect").length,
    leads: SAMPLE_CONTACTS.filter(c => c.stage === "lead").length,
    totalAUM: SAMPLE_CONTACTS.reduce((s, c) => s + (c.value || 0), 0),
    openPositions: SAMPLE_CANDIDATES.filter(c => !["hired", "rejected"].includes(c.stage)).length,
    activeSegments: SAMPLE_SEGMENTS.filter(s => s.isActive).length,
    totalTemplates: DRIP_CATEGORIES.reduce((s, c) => s + c.count, 0),
  }), []);

  const quickActions = [
    { label: "Add Contact", icon: UserPlus, action: () => { onNavigate("crm"); toast.info("Navigate to CRM to add contacts"); } },
    { label: "New Campaign", icon: Send, action: () => { onNavigate("campaigns"); toast.info("Navigate to Campaigns"); } },
    { label: "Post Job", icon: Briefcase, action: () => { onNavigate("ats"); toast.info("Navigate to ATS"); } },
    { label: "Create Segment", icon: Layers, action: () => { onNavigate("segments"); toast.info("Navigate to Segments"); } },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Contacts", value: stats.totalContacts, icon: Users, color: "text-blue-500" },
          { label: "Active Clients", value: stats.activeClients, icon: CheckCircle2, color: "text-emerald-500" },
          { label: "Total AUM", value: fmt(stats.totalAUM), icon: TrendingUp, color: "text-amber-500" },
          { label: "Open Positions", value: stats.openPositions, icon: Briefcase, color: "text-purple-500" },
        ].map(kpi => (
          <Card key={kpi.label} className="border-border/40">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <kpi.icon className={cn("w-3.5 h-3.5", kpi.color)} />
                {kpi.label}
              </div>
              <div className="text-xl font-bold">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card className="border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {quickActions.map(qa => (
              <Button key={qa.label} variant="outline" className="h-auto py-3 flex-col gap-1.5" onClick={qa.action}>
                <qa.icon className="w-4 h-4" />
                <span className="text-xs">{qa.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Module Cards */}
      <div className="grid md:grid-cols-3 gap-3">
        {[
          { tab: "crm" as const, title: "CRM", desc: `${stats.totalContacts} contacts, ${stats.activeClients} active clients`, icon: Users, color: "text-blue-500" },
          { tab: "campaigns" as const, title: "Campaigns", desc: `${stats.totalTemplates} drip templates across 10 categories`, icon: Mail, color: "text-emerald-500" },
          { tab: "ats" as const, title: "Recruiting (ATS)", desc: `${stats.openPositions} open positions in pipeline`, icon: Briefcase, color: "text-purple-500" },
          { tab: "linkedin" as const, title: "LinkedIn", desc: "Profile optimization & content management", icon: Linkedin, color: "text-sky-500" },
          { tab: "segments" as const, title: "Segmentation", desc: `${stats.activeSegments} active segments`, icon: Layers, color: "text-amber-500" },
          { tab: "assets" as const, title: "Asset Library", desc: `${stats.totalTemplates} production-ready templates`, icon: Image, color: "text-rose-500" },
        ].map(mod => (
          <Card key={mod.tab} className="border-border/40 cursor-pointer hover:border-primary/30 transition-colors group" onClick={() => onNavigate(mod.tab)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <mod.icon className={cn("w-4 h-4", mod.color)} />
                  <span className="font-medium text-sm">{mod.title}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <p className="text-xs text-muted-foreground">{mod.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <Card className="border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { text: "Amanda Foster — policy review completed", time: "2 hours ago", icon: CheckCircle2, color: "text-emerald-500" },
              { text: "New lead: Robert Martinez via Social Media", time: "5 hours ago", icon: UserPlus, color: "text-blue-500" },
              { text: "Taylor Brooks — offer extended (Managing Director)", time: "1 day ago", icon: Briefcase, color: "text-purple-500" },
              { text: "Lead Nurture campaign sent to 24 prospects", time: "2 days ago", icon: Send, color: "text-amber-500" },
              { text: "HNW segment updated — 3 contacts match", time: "3 days ago", icon: Layers, color: "text-rose-500" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5 text-xs">
                <item.icon className={cn("w-3.5 h-3.5 shrink-0", item.color)} />
                <span className="flex-1">{item.text}</span>
                <span className="text-muted-foreground shrink-0">{item.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  CRM TAB
// ════════════════════════════════════════════════════════════════════
function CRMTab() {
  const [contacts, setContacts] = useState(SAMPLE_CONTACTS);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", email: "", phone: "", company: "", stage: "lead" as Contact["stage"], tags: "" });

  const filtered = useMemo(() => {
    let list = contacts;
    if (search) list = list.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()));
    if (stageFilter !== "all") list = list.filter(c => c.stage === stageFilter);
    return list;
  }, [contacts, search, stageFilter]);

  const handleAdd = useCallback(() => {
    if (!newContact.name || !newContact.email) { toast.error("Name and email required"); return; }
    const contact: Contact = {
      id: `c${Date.now()}`, name: newContact.name, email: newContact.email,
      phone: newContact.phone || undefined, company: newContact.company || undefined,
      stage: newContact.stage, tags: newContact.tags.split(",").map(t => t.trim()).filter(Boolean),
      lastContact: new Date().toISOString().split("T")[0], source: "Manual",
    };
    setContacts(prev => [contact, ...prev]);
    setShowAdd(false);
    setNewContact({ name: "", email: "", phone: "", company: "", stage: "lead", tags: "" });
    toast.success(`Contact "${contact.name}" added`);
  }, [newContact]);

  const handleDelete = useCallback((id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id));
    toast.success("Contact removed");
  }, []);

  const handleStageChange = useCallback((id: string, stage: Contact["stage"]) => {
    setContacts(prev => prev.map(c => c.id === id ? { ...c, stage } : c));
    toast.success("Stage updated");
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            <SelectItem value="lead">Leads</SelectItem>
            <SelectItem value="prospect">Prospects</SelectItem>
            <SelectItem value="client">Clients</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" className="h-8 text-xs" onClick={() => setShowAdd(true)}><Plus className="w-3 h-3 mr-1" /> Add Contact</Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2 font-medium">Name</th>
              <th className="text-left p-2 font-medium hidden md:table-cell">Company</th>
              <th className="text-left p-2 font-medium">Stage</th>
              <th className="text-left p-2 font-medium hidden lg:table-cell">Tags</th>
              <th className="text-left p-2 font-medium hidden lg:table-cell">Value</th>
              <th className="text-left p-2 font-medium hidden md:table-cell">Last Contact</th>
              <th className="text-right p-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} className="border-t border-border/30 hover:bg-muted/20">
                <td className="p-2">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-muted-foreground">{c.email}</div>
                </td>
                <td className="p-2 hidden md:table-cell text-muted-foreground">{c.company || "—"}</td>
                <td className="p-2">
                  <Select value={c.stage} onValueChange={(v) => handleStageChange(c.id, v as Contact["stage"])}>
                    <SelectTrigger className="h-6 text-[10px] w-[90px] border-0 p-0">
                      <Badge variant="outline" className={cn("text-[10px]", STAGE_COLORS[c.stage])}>{c.stage}</Badge>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="prospect">Prospect</SelectItem>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-2 hidden lg:table-cell">
                  <div className="flex gap-1 flex-wrap">
                    {c.tags.slice(0, 2).map(t => <Badge key={t} variant="secondary" className="text-[9px] py-0">{t}</Badge>)}
                    {c.tags.length > 2 && <Badge variant="secondary" className="text-[9px] py-0">+{c.tags.length - 2}</Badge>}
                  </div>
                </td>
                <td className="p-2 hidden lg:table-cell text-muted-foreground">{c.value ? fmt(c.value) : "—"}</td>
                <td className="p-2 hidden md:table-cell text-muted-foreground">{c.lastContact || "—"}</td>
                <td className="p-2 text-right">
                  <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleDelete(c.id)}>
                    <Trash2 className="w-3 h-3 text-muted-foreground" />
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No contacts match your filters</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Contact Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
            <DialogDescription>Add a new contact to your CRM</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Name *</Label><Input value={newContact.name} onChange={e => setNewContact(p => ({ ...p, name: e.target.value }))} className="h-8 text-xs" /></div>
              <div><Label className="text-xs">Email *</Label><Input value={newContact.email} onChange={e => setNewContact(p => ({ ...p, email: e.target.value }))} className="h-8 text-xs" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Phone</Label><Input value={newContact.phone} onChange={e => setNewContact(p => ({ ...p, phone: e.target.value }))} className="h-8 text-xs" /></div>
              <div><Label className="text-xs">Company</Label><Input value={newContact.company} onChange={e => setNewContact(p => ({ ...p, company: e.target.value }))} className="h-8 text-xs" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Stage</Label>
                <Select value={newContact.stage} onValueChange={v => setNewContact(p => ({ ...p, stage: v as Contact["stage"] }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Tags (comma-separated)</Label><Input value={newContact.tags} onChange={e => setNewContact(p => ({ ...p, tags: e.target.value }))} placeholder="HNW, Retirement" className="h-8 text-xs" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAdd}>Add Contact</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  CAMPAIGNS TAB
// ════════════════════════════════════════════════════════════════════
function CampaignsTab() {
  const [, navigate] = useLocation();
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

      {/* Campaign Lifecycle Pipeline */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Campaign Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[
              { stage: "Ideation", count: 3, color: "bg-blue-500/10 border-blue-500/20" },
              { stage: "AI Content", count: 2, color: "bg-purple-500/10 border-purple-500/20" },
              { stage: "Review", count: 1, color: "bg-amber-500/10 border-amber-500/20" },
              { stage: "Deployed", count: 4, color: "bg-emerald-500/10 border-emerald-500/20" },
              { stage: "Analytics", count: 2, color: "bg-rose-500/10 border-rose-500/20" },
            ].map((s, i) => (
              <div key={s.stage} className="flex items-center gap-2">
                <div className={cn("rounded-lg border p-3 min-w-[120px] text-center", s.color)}>
                  <div className="text-lg font-bold">{s.count}</div>
                  <div className="text-[10px] text-muted-foreground">{s.stage}</div>
                </div>
                {i < 4 && <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Active Campaigns */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Active Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { name: "Q2 Retirement Planning Series", status: "active", sent: 1240, opened: 456, clicked: 89, platform: "Email + LinkedIn" },
              { name: "Tax Season Follow-Up", status: "active", sent: 890, opened: 312, clicked: 67, platform: "Email" },
              { name: "Business Owner Seminar Invite", status: "scheduled", sent: 0, opened: 0, clicked: 0, platform: "Email + SMS" },
              { name: "Client Anniversary Drip", status: "active", sent: 2100, opened: 945, clicked: 234, platform: "Email" },
            ].map(c => (
              <div key={c.name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/20 transition-colors">
                <Badge variant="outline" className={cn("text-[10px] shrink-0", c.status === "active" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600")}>{c.status}</Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{c.name}</div>
                  <div className="text-[10px] text-muted-foreground">{c.platform}</div>
                </div>
                <div className="hidden md:flex gap-4 text-[10px] text-muted-foreground shrink-0">
                  <span>{c.sent.toLocaleString()} sent</span>
                  <span>{c.sent > 0 ? Math.round(c.opened / c.sent * 100) : 0}% open</span>
                  <span>{c.sent > 0 ? Math.round(c.clicked / c.sent * 100) : 0}% click</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  ATS TAB (Applicant Tracking System)
// ════════════════════════════════════════════════════════════════════
function ATSTab() {
  const [candidates, setCandidates] = useState(SAMPLE_CANDIDATES);
  const [stageFilter, setStageFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [newCandidate, setNewCandidate] = useState({ name: "", email: "", role: "Financial Advisor", experience: "" });

  const filtered = useMemo(() => {
    if (stageFilter === "all") return candidates;
    return candidates.filter(c => c.stage === stageFilter);
  }, [candidates, stageFilter]);

  const pipeline = useMemo(() => {
    const stages = ["applied", "screening", "interview", "offer", "hired", "rejected"] as const;
    return stages.map(s => ({ stage: s, count: candidates.filter(c => c.stage === s).length }));
  }, [candidates]);

  const handleAdd = useCallback(() => {
    if (!newCandidate.name || !newCandidate.email) { toast.error("Name and email required"); return; }
    const candidate: Candidate = {
      id: `a${Date.now()}`, name: newCandidate.name, email: newCandidate.email,
      role: newCandidate.role, stage: "applied",
      appliedDate: new Date().toISOString().split("T")[0],
      experience: newCandidate.experience, score: Math.floor(Math.random() * 40) + 60,
    };
    setCandidates(prev => [candidate, ...prev]);
    setShowAdd(false);
    setNewCandidate({ name: "", email: "", role: "Financial Advisor", experience: "" });
    toast.success(`Candidate "${candidate.name}" added`);
  }, [newCandidate]);

  const handleStageChange = useCallback((id: string, stage: Candidate["stage"]) => {
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, stage } : c));
    toast.success("Stage updated");
  }, []);

  return (
    <div className="space-y-4">
      {/* Pipeline Overview */}
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

      {/* Candidate List */}
      <div className="space-y-2">
        {filtered.map(c => (
          <Card key={c.id} className="border-border/40">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {c.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{c.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{c.role}</Badge>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{c.email} · {c.experience} · Applied {c.appliedDate}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant="outline" className={cn("text-[10px]", c.score >= 80 ? "bg-emerald-500/10 text-emerald-600" : c.score >= 60 ? "bg-amber-500/10 text-amber-600" : "bg-red-500/10 text-red-600")}>
                        {c.score}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>Candidate Score</TooltipContent>
                  </Tooltip>
                  <Select value={c.stage} onValueChange={(v) => handleStageChange(c.id, v as Candidate["stage"])}>
                    <SelectTrigger className="h-7 text-[10px] w-[100px]">
                      <Badge variant="outline" className={cn("text-[10px]", STAGE_COLORS[c.stage])}>{c.stage}</Badge>
                    </SelectTrigger>
                    <SelectContent>
                      {(["applied", "screening", "interview", "offer", "hired", "rejected"] as const).map(s => (
                        <SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {c.notes && <p className="text-[10px] text-muted-foreground mt-1 ml-11">{c.notes}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Candidate Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Candidate</DialogTitle>
            <DialogDescription>Add a new candidate to the recruiting pipeline</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Name *</Label><Input value={newCandidate.name} onChange={e => setNewCandidate(p => ({ ...p, name: e.target.value }))} className="h-8 text-xs" /></div>
              <div><Label className="text-xs">Email *</Label><Input value={newCandidate.email} onChange={e => setNewCandidate(p => ({ ...p, email: e.target.value }))} className="h-8 text-xs" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Role</Label>
                <Select value={newCandidate.role} onValueChange={v => setNewCandidate(p => ({ ...p, role: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Financial Advisor">Financial Advisor</SelectItem>
                    <SelectItem value="Associate Advisor">Associate Advisor</SelectItem>
                    <SelectItem value="Managing Director">Managing Director</SelectItem>
                    <SelectItem value="Operations">Operations</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Experience</Label><Input value={newCandidate.experience} onChange={e => setNewCandidate(p => ({ ...p, experience: e.target.value }))} placeholder="5 years — Series 7" className="h-8 text-xs" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAdd}>Add Candidate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  LINKEDIN TAB
// ════════════════════════════════════════════════════════════════════
function LinkedInTab() {
  const [postDraft, setPostDraft] = useState("");
  const [generating, setGenerating] = useState(false);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    // Simulate AI content generation
    await new Promise(r => setTimeout(r, 1500));
    setPostDraft("🏦 Financial planning isn't just about numbers — it's about building a life you love.\n\nAfter 15+ years helping families navigate complex financial decisions, here are 3 truths I've learned:\n\n1️⃣ Your financial plan should evolve as your life does\n2️⃣ Protection planning is the foundation, not an afterthought\n3️⃣ The best time to start is always now\n\nWhat's the one financial decision you're most proud of? Drop it below 👇\n\n#FinancialPlanning #WealthManagement #InsurancePlanning");
    setGenerating(false);
    toast.success("AI-generated post ready for review");
  }, []);

  return (
    <div className="space-y-4">
      {/* Profile Optimization */}
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
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: "78%" }} />
                  </div>
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
              <div>
                <Label className="text-xs font-medium">Connection Stats</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {[
                    { label: "Connections", value: "2,847" },
                    { label: "Profile Views (30d)", value: "342" },
                    { label: "Post Impressions (30d)", value: "12.4K" },
                    { label: "Search Appearances", value: "89" },
                  ].map(s => (
                    <div key={s.label} className="p-2 rounded bg-muted/30">
                      <div className="text-xs font-bold">{s.value}</div>
                      <div className="text-[10px] text-muted-foreground">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content Creation */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">AI Content Creator</CardTitle>
          <CardDescription className="text-xs">Generate LinkedIn posts with AI assistance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Select defaultValue="thought_leadership">
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
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { navigator.clipboard.writeText(postDraft); toast.success("Copied to clipboard"); }} disabled={!postDraft}>
                  <Copy className="w-3 h-3 mr-1" /> Copy
                </Button>
                <Button size="sm" className="h-7 text-xs" disabled={!postDraft} onClick={() => toast.info("LinkedIn posting requires OAuth connection. Go to Settings > Connected Accounts to link your LinkedIn.")}>
                  <Send className="w-3 h-3 mr-1" /> Post to LinkedIn
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scheduled Posts */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Content Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { title: "Market Outlook Q2 2026", date: "Apr 21, 2026 9:00 AM", status: "scheduled" },
              { title: "Client Success Story — Retirement", date: "Apr 23, 2026 11:00 AM", status: "draft" },
              { title: "Tax Planning Tips for Business Owners", date: "Apr 25, 2026 8:30 AM", status: "scheduled" },
            ].map(p => (
              <div key={p.title} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/20">
                <Badge variant="outline" className={cn("text-[10px] shrink-0", p.status === "scheduled" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600")}>{p.status}</Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{p.title}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> {p.date}</div>
                </div>
                <Button type="button" size="icon" variant="ghost" className="h-6 w-6"><Edit className="w-3 h-3" /></Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  SEGMENTS TAB (Dynamic Segmentation Engine)
// ════════════════════════════════════════════════════════════════════
function SegmentsTab() {
  const [segments, setSegments] = useState(SAMPLE_SEGMENTS);
  const [showCreate, setShowCreate] = useState(false);
  const [newSegment, setNewSegment] = useState({ name: "", description: "", field: "tags", operator: "contains" as SegmentRule["operator"], value: "" });

  const handleCreate = useCallback(() => {
    if (!newSegment.name || !newSegment.value) { toast.error("Name and rule value required"); return; }
    const segment: Segment = {
      id: `s${Date.now()}`, name: newSegment.name, description: newSegment.description,
      rules: [{ field: newSegment.field, operator: newSegment.operator, value: newSegment.value }],
      count: Math.floor(Math.random() * 5) + 1,
      createdAt: new Date().toISOString().split("T")[0], isActive: true,
    };
    setSegments(prev => [segment, ...prev]);
    setShowCreate(false);
    setNewSegment({ name: "", description: "", field: "tags", operator: "contains", value: "" });
    toast.success(`Segment "${segment.name}" created`);
  }, [newSegment]);

  const handleToggle = useCallback((id: string) => {
    setSegments(prev => prev.map(s => s.id === id ? { ...s, isActive: !s.isActive } : s));
  }, []);

  const handleDelete = useCallback((id: string) => {
    setSegments(prev => prev.filter(s => s.id !== id));
    toast.success("Segment deleted");
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Dynamic segments auto-update as contacts change. Use segments to target campaigns and outreach.</p>
        <Button size="sm" className="h-8 text-xs" onClick={() => setShowCreate(true)}><Plus className="w-3 h-3 mr-1" /> New Segment</Button>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {segments.map(s => (
          <Card key={s.id} className={cn("border-border/40", !s.isActive && "opacity-60")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">{s.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Switch checked={s.isActive} onCheckedChange={() => handleToggle(s.id)} className="scale-75" />
                  <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleDelete(s.id)}>
                    <Trash2 className="w-3 h-3 text-muted-foreground" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{s.description}</p>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                {s.rules.map((r, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px]">{r.field} {r.operator} "{r.value}"</Badge>
                ))}
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span><Users className="w-3 h-3 inline mr-1" />{s.count} contacts</span>
                <span>Created {s.createdAt}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Segment Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Segment</DialogTitle>
            <DialogDescription>Define rules to dynamically group contacts</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div><Label className="text-xs">Segment Name *</Label><Input value={newSegment.name} onChange={e => setNewSegment(p => ({ ...p, name: e.target.value }))} placeholder="e.g., High Net Worth Retirees" className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Description</Label><Input value={newSegment.description} onChange={e => setNewSegment(p => ({ ...p, description: e.target.value }))} className="h-8 text-xs" /></div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Field</Label>
                <Select value={newSegment.field} onValueChange={v => setNewSegment(p => ({ ...p, field: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tags">Tags</SelectItem>
                    <SelectItem value="stage">Stage</SelectItem>
                    <SelectItem value="value">AUM Value</SelectItem>
                    <SelectItem value="source">Source</SelectItem>
                    <SelectItem value="lastContact">Last Contact</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Operator</Label>
                <Select value={newSegment.operator} onValueChange={v => setNewSegment(p => ({ ...p, operator: v as SegmentRule["operator"] }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equals">Equals</SelectItem>
                    <SelectItem value="contains">Contains</SelectItem>
                    <SelectItem value="gt">Greater Than</SelectItem>
                    <SelectItem value="lt">Less Than</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Value *</Label><Input value={newSegment.value} onChange={e => setNewSegment(p => ({ ...p, value: e.target.value }))} className="h-8 text-xs" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate}>Create Segment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  ASSETS TAB (Marketing Asset Library)
// ════════════════════════════════════════════════════════════════════
function AssetsTab() {
  const [, navigate] = useLocation();
  const totalTemplates = DRIP_CATEGORIES.reduce((s, c) => s + c.count, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{totalTemplates} production-ready drip email templates across {DRIP_CATEGORIES.length} categories</p>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => navigate("/marketing-assets")}>
          <ExternalLink className="w-3 h-3 mr-1" /> Full Asset Library
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {DRIP_CATEGORIES.map(cat => (
          <Card key={cat.id} className="border-border/40 hover:border-primary/30 transition-colors cursor-pointer" onClick={() => navigate("/marketing-assets")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{cat.name}</span>
                <Badge variant="secondary" className="text-[10px]">{cat.count} templates</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{cat.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Stats */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Asset Library Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Templates", value: totalTemplates },
              { label: "Categories", value: DRIP_CATEGORIES.length },
              { label: "Avg. Open Rate", value: "34.2%" },
              { label: "Avg. Click Rate", value: "8.7%" },
            ].map(s => (
              <div key={s.label} className="text-center p-2 rounded bg-muted/30">
                <div className="text-lg font-bold">{s.value}</div>
                <div className="text-[10px] text-muted-foreground">{s.label}</div>
              </div>
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

export default function CommandCenter() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<CommandTab>("overview");

  if (!isAuthenticated) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-[60vh]">
          <Card className="max-w-md">
            <CardContent className="p-6 text-center">
              <Shield className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm">Sign in to access the Command Center</p>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  const TAB_CONFIG: Record<CommandTab, { label: string; icon: typeof Users; desc: string }> = {
    overview: { label: "Overview", icon: BarChart3, desc: "Dashboard & quick actions" },
    crm: { label: "CRM", icon: Users, desc: "Contact management" },
    campaigns: { label: "Campaigns", icon: Mail, desc: "Campaign lifecycle" },
    ats: { label: "ATS", icon: Briefcase, desc: "Recruiting pipeline" },
    linkedin: { label: "LinkedIn", icon: Linkedin, desc: "Profile & content" },
    segments: { label: "Segments", icon: Layers, desc: "Dynamic segmentation" },
    assets: { label: "Assets", icon: Image, desc: "Template library" },
  };

  return (
    <AppShell>
      <SEOHead title="Command Center" description="Unified CRM, campaigns, ATS, LinkedIn, segmentation, and marketing asset library" />
      <div className="container max-w-7xl py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold">Command Center</h1>
            <p className="text-xs text-muted-foreground">CRM · Campaigns · ATS · LinkedIn · Segmentation · Assets</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => navigate("/crm-sync")}>
              <RefreshCw className="w-3 h-3 mr-1" /> CRM Sync
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => navigate("/data-pipelines")}>
              <Database className="w-3 h-3 mr-1" /> Data Pipelines
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as CommandTab)}>
          <TabsList className="mb-4 flex-wrap h-auto gap-1 bg-muted/50 p-1">
            {(Object.entries(TAB_CONFIG) as [CommandTab, typeof TAB_CONFIG[CommandTab]][]).map(([key, cfg]) => {
              const Icon = cfg.icon;
              return (
                <TabsTrigger key={key} value={key} className="text-xs gap-1.5 data-[state=active]:bg-background">
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{cfg.label}</span>
                </TabsTrigger>
              );
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
      </div>
    </AppShell>
  );
}
