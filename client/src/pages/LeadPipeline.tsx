/**
 * LeadPipeline — Kanban + list view backed by `leadPipeline.getPipeline`
 * (pass 72).
 *
 * Before pass 72 this page rendered a `DEMO_LEADS` array of 7
 * hardcoded fake names and the "Re-score" / "Add Lead" buttons
 * fired toasts. The `leadPipeline` tRPC router has existed the
 * whole time (`getPipeline`, `updateStatus`, `assign`, etc.) but
 * this page simply never called it.
 *
 * Pass 72 wires:
 *   - `trpc.leadPipeline.getPipeline.useQuery` → real rows from
 *     the `lead_pipeline` table (first + last name, score, stage,
 *     source, advisor assignment, etc.)
 *   - `trpc.leadPipeline.updateStatus.useMutation` → used by the
 *     per-lead "Mark contacted" action from the kanban quick
 *     actions menu (future work can add drag-and-drop that fires
 *     the same mutation on drop).
 *   - The "Re-score" button is now hidden until a lead-scoring
 *     mutation is built; the "Add Lead" button navigates to
 *     `/import` (the real data ingestion flow).
 */
import { useMemo, useState } from "react";
import { SEOHead } from "@/components/SEOHead";
import { LeadCard } from "@/components/LeadCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Search, Plus, LayoutGrid, List, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";

// The `lead_pipeline.status` column's enum is the authoritative set.
// We collapse it into a narrower Kanban column layout so the board
// stays readable (11 columns is too many to scan at a glance). Each
// Kanban column can contain multiple schema statuses.
const KANBAN_COLUMNS: Array<{ id: string; label: string; statuses: string[] }> = [
  { id: "new", label: "New", statuses: ["new", "enriched"] },
  { id: "scored", label: "Scored", statuses: ["scored"] },
  { id: "qualified", label: "Qualified", statuses: ["qualified", "assigned"] },
  { id: "contacted", label: "Contacted", statuses: ["contacted", "meeting"] },
  { id: "proposal", label: "Proposal", statuses: ["proposal"] },
  { id: "won", label: "Won", statuses: ["converted"] },
  { id: "lost", label: "Lost", statuses: ["disqualified", "dormant"] },
];

function columnFor(status: string | null | undefined): string {
  if (!status) return "new";
  for (const col of KANBAN_COLUMNS) if (col.statuses.includes(status)) return col.id;
  return "new";
}

function formatName(l: any): string {
  return [l.firstName, l.lastName].filter(Boolean).join(" ") || "Unnamed lead";
}

function sourceLabel(l: any): string {
  // `targetSegment` is closest to an inbound-source label in the schema;
  // if it's null, fall back to "Unknown".
  return l.targetSegment ?? "Unknown";
}

function scoreFor(l: any): number {
  // propensityScore is a decimal 0–1; convert to 0–100 for the gauge.
  if (l.propensityScore == null) return 0;
  const n = typeof l.propensityScore === "string" ? parseFloat(l.propensityScore) : Number(l.propensityScore);
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

export default function LeadPipeline() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [sourceFilter, setSourceFilter] = useState("all");

  const pipelineQ = trpc.leadPipeline.getPipeline.useQuery(
    { limit: 200 },
    { retry: false, refetchInterval: 60_000 },
  );
  const updateStatusMut = trpc.leadPipeline.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Lead updated");
      utils.leadPipeline.getPipeline.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const leads = pipelineQ.data ?? [];

  const sourceOptions = useMemo(() => {
    const s = new Set<string>();
    for (const l of leads) {
      const label = sourceLabel(l);
      if (label) s.add(label);
    }
    return Array.from(s).sort();
  }, [leads]);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      const name = formatName(l).toLowerCase();
      if (search && !name.includes(search.toLowerCase())) return false;
      if (sourceFilter !== "all" && sourceLabel(l) !== sourceFilter) return false;
      return true;
    });
  }, [leads, search, sourceFilter]);

  const byColumn = useMemo(() => {
    const map: Record<string, typeof filtered> = {};
    for (const col of KANBAN_COLUMNS) map[col.id] = [];
    for (const l of filtered) {
      const col = columnFor(l.status);
      (map[col] ??= []).push(l);
    }
    return map;
  }, [filtered]);

  return (
    <AppShell title="Lead Pipeline">
    <div className="relative container py-8 space-y-6">
      {/* Warm gold radial glow */}
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 50%, oklch(0.76 0.14 80 / 0.15) 0%, transparent 70%)' }} />
      <SEOHead title="Lead Pipeline" description="Manage and track your leads through the sales pipeline" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/chat")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Lead Pipeline</h1>
            <p className="text-sm text-muted-foreground">
              {pipelineQ.isLoading
                ? "Loading…"
                : `${filtered.length} leads across ${KANBAN_COLUMNS.length} stages`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => navigate("/import")}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Import Leads
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search leads..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-48 h-9">
            <SelectValue placeholder="Segment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Segments</SelectItem>
            {sourceOptions.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex border rounded-md">
          <Button
            variant={view === "kanban" ? "secondary" : "ghost"}
            size="sm"
            className="h-9 rounded-r-none"
            onClick={() => setView("kanban")}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={view === "list" ? "secondary" : "ghost"}
            size="sm"
            className="h-9 rounded-l-none"
            onClick={() => setView("list")}
          >
            <List className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {pipelineQ.isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading lead pipeline…
        </div>
      ) : leads.length === 0 ? (
        <div className="border rounded-lg py-16 text-center text-sm text-muted-foreground space-y-2">
          <p>No leads in the pipeline yet.</p>
          <p className="text-xs">
            Use <b>Import Leads</b> above to upload a CSV, or let the capture widgets
            collect leads from calculator embeds.
          </p>
        </div>
      ) : view === "kanban" ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {KANBAN_COLUMNS.filter((c) => c.id !== "lost").map((col) => (
            <div key={col.id} className="min-w-[280px] flex-shrink-0 space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-sm font-medium capitalize">{col.label}</span>
                <Badge variant="outline" className="text-xs">
                  {byColumn[col.id]?.length ?? 0}
                </Badge>
              </div>
              <div className="space-y-2 min-h-[200px] bg-muted/20 rounded-lg p-2">
                {(byColumn[col.id] ?? []).map((lead: any) => (
                  <LeadCard
                    key={lead.id}
                    id={lead.id}
                    name={formatName(lead)}
                    // email / phone are hashed in the DB for PII compliance,
                    // so we don't pass them through — LeadDetail page handles
                    // decryption when the advisor has view permission.
                    source={sourceLabel(lead)}
                    stage={lead.status ?? "new"}
                    score={scoreFor(lead)}
                    verified={!!lead.enrichmentData}
                    onClick={() => navigate(`/leads/${lead.id}`)}
                    onQuickAction={(action) => {
                      if (action === "Mark contacted") {
                        updateStatusMut.mutate({ leadId: lead.id, status: "contacted" });
                      } else {
                        toast.info(`${action} action for ${formatName(lead)}`);
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((lead: any) => (
            <LeadCard
              key={lead.id}
              id={lead.id}
              name={formatName(lead)}
              source={sourceLabel(lead)}
              stage={lead.status ?? "new"}
              score={scoreFor(lead)}
              verified={!!lead.enrichmentData}
              onClick={() => navigate(`/leads/${lead.id}`)}
              onQuickAction={(action) => {
                if (action === "Mark contacted") {
                  updateStatusMut.mutate({ leadId: lead.id, status: "contacted" });
                } else {
                  toast.info(`${action} action for ${formatName(lead)}`);
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
    </AppShell>
  );
}
