/**
 * DataPipelines — Integration status dashboard with pipeline management.
 * Adapted from stewardly-command-center for the WealthBridge platform.
 * Shows data integration pipelines, their status, and allows pause/resume/retry.
 */
import { useState, useMemo } from "react";
import { Database, Plus, RefreshCw, Play, Pause, Settings, ArrowRight, AlertTriangle, CheckCircle2, Clock, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SEOHead } from "@/components/SEOHead";
import AppShell from "@/components/AppShell";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DataPipeline {
  id: string;
  name: string;
  source: string;
  destination: string;
  status: "active" | "paused" | "error" | "configuring";
  schedule: string;
  lastRun: string;
  recordsProcessed: number;
  description: string;
}

const INITIAL_PIPELINES: DataPipeline[] = [
  {
    id: "pl-1",
    name: "CRM Contact Sync",
    source: "Redtail CRM",
    destination: "WealthBridge DB",
    status: "active",
    schedule: "Every 15 min",
    lastRun: new Date(Date.now() - 300000).toISOString(),
    recordsProcessed: 2847,
    description: "Bidirectional sync of contacts, activities, and opportunities between Redtail CRM and WealthBridge.",
  },
  {
    id: "pl-2",
    name: "Market Data Feed",
    source: "FRED API",
    destination: "Analytics Engine",
    status: "active",
    schedule: "Daily at 6:00 AM",
    lastRun: new Date(Date.now() - 3600000 * 6).toISOString(),
    recordsProcessed: 15420,
    description: "Federal Reserve economic data including interest rates, GDP, CPI, and employment figures.",
  },
  {
    id: "pl-3",
    name: "Plaid Account Sync",
    source: "Plaid API",
    destination: "Client Accounts",
    status: "active",
    schedule: "Every 4 hours",
    lastRun: new Date(Date.now() - 3600000 * 2).toISOString(),
    recordsProcessed: 892,
    description: "Syncs linked bank accounts, balances, and transaction history via Plaid.",
  },
  {
    id: "pl-4",
    name: "SnapTrade Portfolio Sync",
    source: "SnapTrade API",
    destination: "Investment Portfolios",
    status: "paused",
    schedule: "Every 30 min",
    lastRun: new Date(Date.now() - 86400000).toISOString(),
    recordsProcessed: 456,
    description: "Syncs brokerage account positions, trades, and performance data via SnapTrade.",
  },
  {
    id: "pl-5",
    name: "Email Campaign Analytics",
    source: "Email Service",
    destination: "Campaign Dashboard",
    status: "active",
    schedule: "Hourly",
    lastRun: new Date(Date.now() - 1800000).toISOString(),
    recordsProcessed: 3210,
    description: "Aggregates open rates, click rates, bounces, and unsubscribes from email campaigns.",
  },
  {
    id: "pl-6",
    name: "SEC EDGAR Filings",
    source: "EDGAR API",
    destination: "Compliance DB",
    status: "configuring",
    schedule: "Daily at 8:00 PM",
    lastRun: "",
    recordsProcessed: 0,
    description: "Pulls SEC filings, 13F reports, and regulatory disclosures for compliance monitoring.",
  },
  {
    id: "pl-7",
    name: "GHL Webhook Receiver",
    source: "GoHighLevel",
    destination: "Lead Pipeline",
    status: "error",
    schedule: "Real-time (webhook)",
    lastRun: new Date(Date.now() - 7200000).toISOString(),
    recordsProcessed: 128,
    description: "Receives webhook events from GoHighLevel for new leads, form submissions, and appointment bookings.",
  },
  {
    id: "pl-8",
    name: "Census Bureau Data",
    source: "Census API",
    destination: "Market Analysis",
    status: "active",
    schedule: "Weekly (Monday)",
    lastRun: new Date(Date.now() - 86400000 * 3).toISOString(),
    recordsProcessed: 8750,
    description: "Demographic and economic data from the US Census Bureau for market analysis and segmentation.",
  },
  {
    id: "pl-9",
    name: "GLEIF LEI Lookup",
    source: "GLEIF API",
    destination: "Entity Registry",
    status: "active",
    schedule: "Daily at 7:00 AM",
    lastRun: new Date(Date.now() - 3600000 * 8).toISOString(),
    recordsProcessed: 1240,
    description: "Global Legal Entity Identifier Foundation — LEI lookups for entity verification, counterparty risk, and KYC compliance.",
  },
  {
    id: "pl-10",
    name: "OpenFIGI Instrument Mapping",
    source: "OpenFIGI API",
    destination: "Securities DB",
    status: "active",
    schedule: "Daily at 6:30 AM",
    lastRun: new Date(Date.now() - 3600000 * 10).toISOString(),
    recordsProcessed: 3560,
    description: "Maps tickers, CUSIPs, and ISINs to Financial Instrument Global Identifiers for cross-platform security matching.",
  },
  {
    id: "pl-11",
    name: "NAIC Insurance Data",
    source: "NAIC CIS",
    destination: "Carrier Intelligence",
    status: "active",
    schedule: "Weekly (Wednesday)",
    lastRun: new Date(Date.now() - 86400000 * 2).toISOString(),
    recordsProcessed: 890,
    description: "National Association of Insurance Commissioners — complaint ratios, financial strength data, and carrier comparisons.",
  },
  {
    id: "pl-12",
    name: "FFIEC Banking Data",
    source: "FFIEC API",
    destination: "Banking Analytics",
    status: "active",
    schedule: "Monthly (1st)",
    lastRun: new Date(Date.now() - 86400000 * 15).toISOString(),
    recordsProcessed: 4200,
    description: "Federal Financial Institutions Examination Council — HMDA data, CRA ratings, and banking institution demographics.",
  },
  {
    id: "pl-13",
    name: "BLS Employment Data",
    source: "BLS API",
    destination: "Economic Indicators",
    status: "active",
    schedule: "Monthly (first Friday)",
    lastRun: new Date(Date.now() - 86400000 * 10).toISOString(),
    recordsProcessed: 2100,
    description: "Bureau of Labor Statistics — employment, unemployment, CPI, PPI, and wage data for economic analysis.",
  },
  {
    id: "pl-14",
    name: "BEA GDP & Income",
    source: "BEA API",
    destination: "Economic Indicators",
    status: "active",
    schedule: "Quarterly",
    lastRun: new Date(Date.now() - 86400000 * 30).toISOString(),
    recordsProcessed: 560,
    description: "Bureau of Economic Analysis — GDP, personal income, consumer spending, and regional economic data.",
  },
  {
    id: "pl-15",
    name: "Dripify CSV Import",
    source: "Dripify",
    destination: "Lead Pipeline",
    status: "active",
    schedule: "On upload",
    lastRun: new Date(Date.now() - 86400000 * 2).toISOString(),
    recordsProcessed: 342,
    description: "Imports LinkedIn outreach results from Dripify CSV exports — contacts, connection status, and campaign engagement data.",
  },
  {
    id: "pl-16",
    name: "LinkedIn Sales Navigator",
    source: "LinkedIn Sales Nav",
    destination: "Lead Pipeline",
    status: "active",
    schedule: "On upload",
    lastRun: new Date(Date.now() - 86400000 * 5).toISOString(),
    recordsProcessed: 215,
    description: "Parses Sales Navigator CSV exports — lead lists, account data, and InMail engagement for prospecting pipeline.",
  },
  {
    id: "pl-17",
    name: "Workable ATS Sync",
    source: "Workable",
    destination: "Recruiting Pipeline",
    status: "configuring",
    schedule: "Every 2 hours",
    lastRun: "",
    recordsProcessed: 0,
    description: "Syncs candidate applications, interview stages, and hiring pipeline data from Workable ATS.",
  },
  {
    id: "pl-18",
    name: "GoHighLevel Contact Sync",
    source: "GoHighLevel CRM",
    destination: "CRM Contacts",
    status: "active",
    schedule: "Every 15 min",
    lastRun: new Date(Date.now() - 600000).toISOString(),
    recordsProcessed: 1580,
    description: "Bidirectional sync of contacts, tags, opportunities, and custom fields between GoHighLevel CRM and WealthBridge.",
  },
];

const statusConfig: Record<DataPipeline["status"], { label: string; color: string; icon: any }> = {
  active: { label: "Active", color: "bg-green-500/10 text-green-400 border-green-500/20", icon: CheckCircle2 },
  paused: { label: "Paused", color: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: Pause },
  error: { label: "Error", color: "bg-red-500/10 text-red-400 border-red-500/20", icon: AlertTriangle },
  configuring: { label: "Configuring", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Settings },
};

const statusActions: Record<DataPipeline["status"], { icon: any; label: string }> = {
  active: { icon: Pause, label: "Pause" },
  paused: { icon: Play, label: "Resume" },
  error: { icon: RefreshCw, label: "Retry" },
  configuring: { icon: Settings, label: "Configure" },
};

export default function DataPipelines({ embedded = false }: { embedded?: boolean } = {}) {
  const Shell = embedded ? (({ children }: any) => <>{children}</>) as any : AppShell;

  const [pipelines, setPipelines] = useState<DataPipeline[]>(INITIAL_PIPELINES);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DataPipeline | null>(null);
  const [formData, setFormData] = useState({ name: "", source: "", destination: "", schedule: "", description: "" });

  const filtered = useMemo(() => {
    return pipelines.filter((p) => {
      const matchesSearch = search === "" || p.name.toLowerCase().includes(search.toLowerCase()) || p.source.toLowerCase().includes(search.toLowerCase()) || p.destination.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [pipelines, search, statusFilter]);

  const stats = useMemo(() => ({
    total: pipelines.length,
    active: pipelines.filter((p) => p.status === "active").length,
    totalRecords: pipelines.reduce((sum, p) => sum + p.recordsProcessed, 0),
    errors: pipelines.filter((p) => p.status === "error").length,
  }), [pipelines]);

  const togglePipeline = (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "paused" : "active";
    setPipelines((prev) => prev.map((p) => p.id === id ? { ...p, status: newStatus as DataPipeline["status"] } : p));
    toast.info(`Pipeline ${newStatus === "active" ? "resumed" : "paused"}`);
  };

  const handleCreate = () => {
    const newPipeline: DataPipeline = {
      id: `pl-${Date.now()}`,
      name: formData.name,
      source: formData.source,
      destination: formData.destination,
      status: "configuring",
      schedule: formData.schedule,
      lastRun: "",
      recordsProcessed: 0,
      description: formData.description,
    };
    setPipelines((prev) => [...prev, newPipeline]);
    setFormOpen(false);
    setFormData({ name: "", source: "", destination: "", schedule: "", description: "" });
    toast.success(`Pipeline "${formData.name}" created`);
  };

  const handleUpdate = () => {
    if (!editing) return;
    setPipelines((prev) => prev.map((p) => p.id === editing.id ? { ...p, ...formData } : p));
    setEditing(null);
    setFormData({ name: "", source: "", destination: "", schedule: "", description: "" });
    toast.success(`Pipeline "${formData.name}" updated`);
  };

  const openEdit = (pipeline: DataPipeline) => {
    setEditing(pipeline);
    setFormData({ name: pipeline.name, source: pipeline.source, destination: pipeline.destination, schedule: pipeline.schedule, description: pipeline.description });
  };

  const timeAgo = (iso: string) => {
    if (!iso) return "Never";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <Shell>
      <SEOHead title="Data Pipelines" description="Integration status and data pipeline management" />
      <div className="container max-w-6xl py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Data Pipelines</h1>
            <p className="text-sm text-muted-foreground mt-1">Integrations, ingestion, and sync status</p>
          </div>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> New Pipeline
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="text-center">
            <CardContent className="py-4">
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Pipelines</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="py-4">
              <p className="text-2xl font-bold text-green-400">{stats.active}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="py-4">
              <p className="text-2xl font-bold text-foreground">{stats.totalRecords.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Records (Last Run)</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="py-4">
              <p className="text-2xl font-bold text-red-400">{stats.errors}</p>
              <p className="text-xs text-muted-foreground">Errors</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search pipelines..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {["all", "active", "paused", "error", "configuring"].map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(status)}
                className="capitalize whitespace-nowrap"
              >
                {status === "all" ? "All" : status}
              </Button>
            ))}
          </div>
        </div>

        {/* Pipeline Cards */}
        <div className="space-y-3">
          {filtered.map((pipeline) => {
            const statusCfg = statusConfig[pipeline.status];
            const action = statusActions[pipeline.status];
            const ActionIcon = action.icon;
            const StatusIcon = statusCfg.icon;

            return (
              <Card
                key={pipeline.id}
                className="hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => openEdit(pipeline)}
              >
                <CardContent className="py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                        <Database className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium text-foreground">{pipeline.name}</h3>
                          <Badge variant="outline" className={cn("text-[10px]", statusCfg.color)}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusCfg.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <span className="truncate">{pipeline.source}</span>
                          <ArrowRight className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{pipeline.destination}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 sm:gap-6">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium text-foreground">{pipeline.recordsProcessed.toLocaleString()} records</p>
                        <p className="text-xs text-muted-foreground">{pipeline.schedule}</p>
                      </div>
                      <div className="text-xs text-muted-foreground sm:text-right">
                        <p>Last run</p>
                        <p>{timeAgo(pipeline.lastRun)}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={(e) => { e.stopPropagation(); togglePipeline(pipeline.id, pipeline.status); }}
                        aria-label={`${action.label} ${pipeline.name}`}
                      >
                        <ActionIcon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{action.label}</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Database className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">{search || statusFilter !== "all" ? "No pipelines match your filters" : "No pipelines configured yet"}</p>
              <Button className="mt-4" onClick={() => setFormOpen(true)}>Create Your First Pipeline</Button>
            </CardContent>
          </Card>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={formOpen || !!editing} onOpenChange={(open) => { if (!open) { setFormOpen(false); setEditing(null); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Pipeline" : "New Pipeline"}</DialogTitle>
              <DialogDescription>Configure the data integration pipeline settings.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="dp-name">Pipeline Name</Label>
                <Input id="dp-name" value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. CRM Contact Sync" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="dp-source">Source</Label>
                  <Input id="dp-source" value={formData.source} onChange={(e) => setFormData((p) => ({ ...p, source: e.target.value }))} placeholder="e.g. Redtail CRM" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dp-dest">Destination</Label>
                  <Input id="dp-dest" value={formData.destination} onChange={(e) => setFormData((p) => ({ ...p, destination: e.target.value }))} placeholder="e.g. WealthBridge DB" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dp-schedule">Schedule</Label>
                <Input id="dp-schedule" value={formData.schedule} onChange={(e) => setFormData((p) => ({ ...p, schedule: e.target.value }))} placeholder="e.g. Every 15 min, Daily at 6:00 AM" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dp-desc">Description</Label>
                <Textarea id="dp-desc" value={formData.description} onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))} placeholder="What this pipeline does..." rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setFormOpen(false); setEditing(null); }}>Cancel</Button>
              <Button onClick={editing ? handleUpdate : handleCreate} disabled={!formData.name || !formData.source}>
                {editing ? "Update" : "Create"} Pipeline
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Shell>
  );
}
