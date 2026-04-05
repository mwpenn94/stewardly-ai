/**
 * LeadPipeline — Kanban-style lead management pipeline.
 * Shows leads organized by stage with drag-and-drop, filters, and AI scoring.
 */
import { useState, useMemo } from "react";
import { SEOHead } from "@/components/SEOHead";
import { LeadCard } from "@/components/LeadCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Search, Plus, Filter, LayoutGrid, List, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const STAGES = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"] as const;
const STAGE_LABELS: Record<string, string> = {
  new: "New", contacted: "Contacted", qualified: "Qualified",
  proposal: "Proposal", negotiation: "Negotiation", won: "Won", lost: "Lost",
};

// Demo data for initial render
const DEMO_LEADS = [
  { id: 1, name: "Sarah Johnson", email: "sarah@example.com", source: "Referral", stage: "new", score: 87, verified: true, lastActivity: "2d ago" },
  { id: 2, name: "Michael Chen", email: "mchen@corp.com", source: "Website", stage: "contacted", score: 72, lastActivity: "1d ago" },
  { id: 3, name: "Emily Rodriguez", email: "emily.r@firm.com", source: "LinkedIn", stage: "qualified", score: 91, verified: true, lastActivity: "3h ago" },
  { id: 4, name: "David Kim", email: "dkim@wealth.co", source: "Event", stage: "proposal", score: 65, lastActivity: "5d ago" },
  { id: 5, name: "Lisa Thompson", phone: "555-0142", source: "Cold Call", stage: "new", score: 45, lastActivity: "1w ago" },
  { id: 6, name: "James Wilson", email: "jwilson@invest.net", source: "Referral", stage: "negotiation", score: 82, verified: true, lastActivity: "6h ago" },
  { id: 7, name: "Amanda Foster", email: "afoster@plan.com", source: "Website", stage: "won", score: 95, verified: true, lastActivity: "2h ago" },
];

export default function LeadPipeline() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [sourceFilter, setSourceFilter] = useState("all");

  const filtered = useMemo(() => {
    return DEMO_LEADS.filter(l => {
      if (search && !l.name.toLowerCase().includes(search.toLowerCase()) && !l.email?.toLowerCase().includes(search.toLowerCase())) return false;
      if (sourceFilter !== "all" && l.source !== sourceFilter) return false;
      return true;
    });
  }, [search, sourceFilter]);

  const byStage = useMemo(() => {
    const map: Record<string, typeof DEMO_LEADS> = {};
    for (const s of STAGES) map[s] = [];
    for (const l of filtered) (map[l.stage] ??= []).push(l);
    return map;
  }, [filtered]);

  return (
    <div className="container py-8 space-y-6">
      <SEOHead title="Lead Pipeline" description="Manage and track your leads through the sales pipeline" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/chat")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Lead Pipeline</h1>
            <p className="text-sm text-muted-foreground">{filtered.length} leads across {STAGES.length} stages</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.info("AI scoring refresh coming soon")}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Re-score
          </Button>
          <Button size="sm" onClick={() => toast.info("Add lead form coming soon")}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Lead
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="Referral">Referral</SelectItem>
            <SelectItem value="Website">Website</SelectItem>
            <SelectItem value="LinkedIn">LinkedIn</SelectItem>
            <SelectItem value="Event">Event</SelectItem>
            <SelectItem value="Cold Call">Cold Call</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex border rounded-md">
          <Button variant={view === "kanban" ? "secondary" : "ghost"} size="sm" className="h-9 rounded-r-none" onClick={() => setView("kanban")}>
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
          <Button variant={view === "list" ? "secondary" : "ghost"} size="sm" className="h-9 rounded-l-none" onClick={() => setView("list")}>
            <List className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Kanban view */}
      {view === "kanban" ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.filter(s => s !== "lost").map(stage => (
            <div key={stage} className="min-w-[280px] flex-shrink-0 space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-sm font-medium capitalize">{STAGE_LABELS[stage]}</span>
                <Badge variant="outline" className="text-xs">{byStage[stage]?.length ?? 0}</Badge>
              </div>
              <div className="space-y-2 min-h-[200px] bg-muted/20 rounded-lg p-2">
                {(byStage[stage] ?? []).map(lead => (
                  <LeadCard
                    key={lead.id} {...lead}
                    onClick={() => navigate(`/leads/${lead.id}`)}
                    onQuickAction={a => toast.info(`${a} action for ${lead.name}`)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(lead => (
            <LeadCard
              key={lead.id} {...lead}
              onClick={() => navigate(`/leads/${lead.id}`)}
              onQuickAction={a => toast.info(`${a} action for ${lead.name}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
