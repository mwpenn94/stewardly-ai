/**
 * Sync Dashboard — Multi-Location CRM Sync Monitoring & Management
 *
 * Features:
 * - Location selector with global roll-up view
 * - Per-location sync configuration (direction, frequency, conflict policy)
 * - Real-time aggregation stats scoped by location
 * - Reconciliation controls (single location or all)
 * - Webhook activity feed with live event stream
 * - Run history with location filtering
 * - Conflict audit trail
 * - Location management (add, edit, deactivate)
 */
import { useState, useMemo } from "react";
import { useSyncEvents, type SyncEvent } from "@/hooks/useSyncEvents";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import {
  RefreshCw, Activity, Link2, Unlink, AlertTriangle, CheckCircle2,
  Clock, ArrowLeftRight, Database, TrendingUp, Loader2, Play,
  History, ChevronDown, ChevronUp, Zap, Shield, BarChart3,
  MapPin, Plus, Settings2, Globe, Radio, Pencil, Webhook,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1000);
  return `${mins}m ${secs}s`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function timeAgo(ts: string | number | null): string {
  if (!ts) return "Never";
  const d = typeof ts === "number" ? ts : new Date(ts).getTime();
  const diff = Date.now() - d;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

const SYNC_DIRECTIONS: Record<string, { label: string; icon: typeof ArrowLeftRight }> = {
  bidirectional: { label: "Bidirectional", icon: ArrowLeftRight },
  pull_only: { label: "Pull Only (GHL → Stewardly)", icon: ArrowLeftRight },
  push_only: { label: "Push Only (Stewardly → GHL)", icon: ArrowLeftRight },
  disabled: { label: "Disabled", icon: ArrowLeftRight },
};

const SYNC_FREQUENCIES: Record<string, string> = {
  hourly: "Every Hour",
  every_6h: "Every 6 Hours",
  daily: "Daily",
  weekly: "Weekly",
  manual: "Manual Only",
};

const CONFLICT_POLICIES: Record<string, string> = {
  ghl_wins: "GHL Always Wins",
  stewardly_wins: "Stewardly Always Wins",
  newest_wins: "Newest Timestamp Wins",
  manual_review: "Flag for Manual Review",
};

// ─── Stat Card ────────────────────────────────────────────────────────────

function StatCard({ title, value, subtitle, icon: Icon, color = "text-primary" }: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: typeof Activity;
  color?: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold mt-1">{typeof value === "number" ? formatNumber(value) : value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className={`p-2.5 rounded-lg bg-secondary/50 ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Run History Row ──────────────────────────────────────────────────────

function RunHistoryRow({ run, locations }: { run: any; locations: any[] }) {
  const [expanded, setExpanded] = useState(false);
  const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
    completed: { label: "Completed", color: "text-emerald-400", icon: CheckCircle2 },
    running: { label: "Running", color: "text-blue-400", icon: Loader2 },
    failed: { label: "Failed", color: "text-destructive", icon: AlertTriangle },
    interrupted: { label: "Interrupted", color: "text-yellow-400", icon: Clock },
  };
  const cfg = statusConfig[run.status] || statusConfig.completed;
  const StatusIcon = cfg.icon;
  const locName = locations.find((l: any) => l.id === run.location_id)?.name;

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-secondary/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <StatusIcon className={`h-4 w-4 ${cfg.color} ${run.status === "running" ? "animate-spin" : ""}`} />
          <div>
            <span className="text-sm font-medium">
              {run.run_type === "scheduled" ? "Scheduled" : run.run_type === "resume" ? "Resumed" : "Manual"} Run
            </span>
            {locName && <Badge variant="outline" className="ml-2 text-[10px] py-0">{locName}</Badge>}
            <span className="text-xs text-muted-foreground ml-2">
              {run.started_at ? new Date(Number(run.started_at)).toLocaleString() : "—"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{formatNumber(run.ghl_total || 0)} GHL</span>
            <span>{formatNumber(run.matched || 0)} matched</span>
            <span>{formatDuration(run.duration_ms || 0)}</span>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>
      {expanded && (
        <div className="px-3 pb-3 border-t border-border/30">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
            <div><span className="text-muted-foreground">GHL Processed:</span> <span className="font-medium">{formatNumber(run.ghl_total || 0)}</span></div>
            <div><span className="text-muted-foreground">Stewardly Total:</span> <span className="font-medium">{formatNumber(run.stewardly_total || 0)}</span></div>
            <div><span className="text-muted-foreground">Matched:</span> <span className="font-medium">{formatNumber(run.matched || 0)}</span></div>
            <div><span className="text-muted-foreground">Created (Stewardly):</span> <span className="font-medium">{formatNumber(run.created_in_stewardly || 0)}</span></div>
            <div><span className="text-muted-foreground">Created (GHL):</span> <span className="font-medium">{formatNumber(run.created_in_ghl || 0)}</span></div>
            <div><span className="text-muted-foreground">Updated (Stewardly):</span> <span className="font-medium">{formatNumber(run.updated_in_stewardly || 0)}</span></div>
            <div><span className="text-muted-foreground">Updated (GHL):</span> <span className="font-medium">{formatNumber(run.updated_in_ghl || 0)}</span></div>
            <div><span className="text-muted-foreground">Conflicts:</span> <span className="font-medium">{run.conflicts_resolved || 0}</span></div>
            <div><span className="text-muted-foreground">Orphans Fixed:</span> <span className="font-medium">{run.orphans_fixed || 0}</span></div>
            <div><span className="text-muted-foreground">Errors:</span> <span className={`font-medium ${(run.errors || 0) > 0 ? "text-destructive" : ""}`}>{run.errors || 0}</span></div>
            <div><span className="text-muted-foreground">Duration:</span> <span className="font-medium">{formatDuration(run.duration_ms || 0)}</span></div>
            <div><span className="text-muted-foreground">Complete:</span> <span className="font-medium">{run.complete ? "Yes" : "Partial"}</span></div>
          </div>
          {run.triggered_by && (
            <div className="mt-2 text-xs text-muted-foreground">Triggered by: {run.triggered_by}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Webhook Event Row ────────────────────────────────────────────────────

function WebhookEventRow({ event }: { event: any }) {
  const statusColors: Record<string, string> = {
    processed: "text-emerald-400",
    pending: "text-yellow-400",
    failed: "text-destructive",
  };
  const eventTypeLabels: Record<string, string> = {
    "ContactCreate": "Contact Created",
    "ContactUpdate": "Contact Updated",
    "ContactDelete": "Contact Deleted",
    "OpportunityCreate": "Opportunity Created",
    "OpportunityStatusUpdate": "Opportunity Updated",
    "contact.create": "Contact Created",
    "contact.update": "Contact Updated",
    "contact.delete": "Contact Deleted",
  };

  return (
    <div className="flex items-center justify-between py-2 px-3 border-b border-border/30 last:border-0 hover:bg-secondary/20 transition-colors">
      <div className="flex items-center gap-3">
        <Radio className={`h-3.5 w-3.5 ${statusColors[event.processing_status] || "text-muted-foreground"}`} />
        <div>
          <span className="text-sm font-medium">
            {eventTypeLabels[event.event_type] || event.event_type}
          </span>
          {event.contact_first_name && (
            <span className="text-xs text-muted-foreground ml-2">
              {(event.contact_first_name || "").replace(/"/g, "")} {(event.contact_last_name || "").replace(/"/g, "")}
              {event.contact_email && <span className="ml-1">({(event.contact_email || "").replace(/"/g, "")})</span>}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant="outline" className={`text-[10px] py-0 ${statusColors[event.processing_status] || ""}`}>
          {event.processing_status}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {event.received_at ? timeAgo(event.received_at) : "—"}
        </span>
      </div>
    </div>
  );
}

// ─── Add Location Dialog ──────────────────────────────────────────────────

function AddLocationDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    locationId: "",
    name: "",
    region: "",
    syncDirection: "bidirectional" as const,
    syncFrequency: "daily" as const,
    conflictPolicy: "newest_wins" as const,
    maxContactsPerRun: 0,
    rateLimitMs: 50,
  });

  const createMutation = trpc.integrations.createLocation.useMutation({
    onSuccess: () => {
      toast.success("Location added successfully");
      setOpen(false);
      setForm({ locationId: "", name: "", region: "", syncDirection: "bidirectional", syncFrequency: "daily", conflictPolicy: "newest_wins", maxContactsPerRun: 0, rateLimitMs: 50 });
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add Location
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add GHL Location</DialogTitle>
          <DialogDescription>
            Connect a new GoHighLevel sub-account for bidirectional sync.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">GHL Location ID</Label>
              <Input
                value={form.locationId}
                onChange={(e) => setForm(f => ({ ...f, locationId: e.target.value }))}
                placeholder="e.g. yUVrjyvzf0txCiJXuYGn"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Display Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Florida Office"
                className="text-sm"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Region (optional)</Label>
            <Input
              value={form.region}
              onChange={(e) => setForm(f => ({ ...f, region: e.target.value }))}
              placeholder="e.g. Southeast US"
              className="text-sm"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Sync Direction</Label>
              <Select value={form.syncDirection} onValueChange={(v: any) => setForm(f => ({ ...f, syncDirection: v }))}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SYNC_DIRECTIONS).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Frequency</Label>
              <Select value={form.syncFrequency} onValueChange={(v: any) => setForm(f => ({ ...f, syncFrequency: v }))}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SYNC_FREQUENCIES).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Conflict Policy</Label>
              <Select value={form.conflictPolicy} onValueChange={(v: any) => setForm(f => ({ ...f, conflictPolicy: v }))}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CONFLICT_POLICIES).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Max Contacts/Run (0 = unlimited)</Label>
              <Input
                type="number"
                min="0"
                value={form.maxContactsPerRun}
                onChange={(e) => setForm(f => ({ ...f, maxContactsPerRun: parseInt(e.target.value) || 0 }))}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Rate Limit (ms between API calls)</Label>
              <Input
                type="number"
                min="0"
                value={form.rateLimitMs}
                onChange={(e) => setForm(f => ({ ...f, rateLimitMs: parseInt(e.target.value) || 50 }))}
                className="text-sm"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={() => createMutation.mutate(form)}
            disabled={!form.locationId || !form.name || createMutation.isPending}
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Add Location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Location Dialog ─────────────────────────────────────────────────

function EditLocationDialog({ location, onSuccess }: { location: any; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: location.name || "",
    region: location.region || "",
    syncDirection: location.sync_direction || "bidirectional",
    syncFrequency: location.sync_frequency || "daily",
    conflictPolicy: location.conflict_policy || "newest_wins",
    maxContactsPerRun: location.max_contacts_per_run ?? 0,
    rateLimitMs: location.rate_limit_ms ?? 50,
  });

  const updateMutation = trpc.integrations.updateLocation.useMutation({
    onSuccess: () => {
      toast.success("Location updated");
      setOpen(false);
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Location: {location.name}</DialogTitle>
          <DialogDescription>
            Update sync configuration for this GHL sub-account.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Display Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Region</Label>
              <Input
                value={form.region}
                onChange={(e) => setForm(f => ({ ...f, region: e.target.value }))}
                className="text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Sync Direction</Label>
              <Select value={form.syncDirection} onValueChange={(v: any) => setForm(f => ({ ...f, syncDirection: v }))}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SYNC_DIRECTIONS).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Frequency</Label>
              <Select value={form.syncFrequency} onValueChange={(v: any) => setForm(f => ({ ...f, syncFrequency: v }))}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SYNC_FREQUENCIES).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Conflict Policy</Label>
              <Select value={form.conflictPolicy} onValueChange={(v: any) => setForm(f => ({ ...f, conflictPolicy: v }))}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CONFLICT_POLICIES).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Max Contacts/Run (0 = unlimited)</Label>
              <Input
                type="number"
                min="0"
                value={form.maxContactsPerRun}
                onChange={(e) => setForm(f => ({ ...f, maxContactsPerRun: parseInt(e.target.value) || 0 }))}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Rate Limit (ms)</Label>
              <Input
                type="number"
                min="0"
                value={form.rateLimitMs}
                onChange={(e) => setForm(f => ({ ...f, rateLimitMs: parseInt(e.target.value) || 50 }))}
                className="text-sm"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={() => updateMutation.mutate({
              id: location.id,
              name: form.name,
              region: form.region,
              syncDirection: form.syncDirection as any,
              syncFrequency: form.syncFrequency as any,
              conflictPolicy: form.conflictPolicy as any,
              maxContactsPerRun: form.maxContactsPerRun,
              rateLimitMs: form.rateLimitMs,
            })}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────

export default function SyncDashboard() {
  // @ts-expect-error — property access on loosely typed object
  const { user, isLoading: authLoading } = useAuth();
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null); // null = all locations
  const [maxContacts, setMaxContacts] = useState("0");
  const [pushOrphans, setPushOrphans] = useState(true);
  const [isReconciling, setIsReconciling] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // ─── SSE Live Stream ──────────────────────────────────────────────────
  const { events: sseEvents, connected: sseConnected, latestByType } = useSyncEvents({
    maxEvents: 50,
    autoConnect: true,
  });

  // ─── Queries ──────────────────────────────────────────────────────────
  const locationsQuery = trpc.integrations.listLocations.useQuery();
  const locations = locationsQuery.data || [];

  const aggQueryInput = useMemo(() => (
    selectedLocationId != null ? { locationDbId: selectedLocationId } : undefined
  ), [selectedLocationId]);

  const aggQuery = trpc.integrations.getSyncAggregation.useQuery(aggQueryInput, {
    refetchInterval: isReconciling ? 5000 : 30000,
  });

  const historyQueryInput = useMemo(() => (
    selectedLocationId != null ? { locationDbId: selectedLocationId } : undefined
  ), [selectedLocationId]);

  const historyQuery = trpc.integrations.getSyncRunHistory.useQuery(historyQueryInput, {
    refetchInterval: isReconciling ? 5000 : 30000,
  });

  const webhookFeedInput = useMemo(() => (
    selectedLocationId != null ? { locationDbId: selectedLocationId } : undefined
  ), [selectedLocationId]);

  const webhookFeedQuery = trpc.integrations.getWebhookActivityFeed.useQuery(webhookFeedInput, {
    refetchInterval: 15000,
  });

  const reconcileMutation = trpc.integrations.reconcileGHL.useMutation({
    onSuccess: (data: any) => {
      setIsReconciling(false);
      aggQuery.refetch();
      historyQuery.refetch();
      toast.success(
        `Reconciliation ${data.complete ? "complete" : "partial"}: ${formatNumber(data.ghlTotal)} GHL contacts, ${formatNumber(data.matched)} matched, ${data.errors} errors`,
        { duration: 8000 }
      );
    },
    onError: (err) => {
      setIsReconciling(false);
      toast.error(`Reconciliation failed: ${err.message}`);
    },
  });

  const deactivateMutation = trpc.integrations.deactivateLocation.useMutation({
    onSuccess: () => {
      toast.success("Location deactivated");
      locationsQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const agg = aggQuery.data;
  const history = historyQuery.data || [];
  const webhookEvents = webhookFeedQuery.data || [];

  const lastRun = useMemo(() => {
    if (!agg?.lastReconcileStats) return null;
    return agg.lastReconcileStats;
  }, [agg?.lastReconcileStats]);

  const selectedLocation = locations.find((l: any) => l.id === selectedLocationId);

  const handleReconcile = () => {
    setIsReconciling(true);
    const max = parseInt(maxContacts) || 0;
    const params: any = { maxGHLContacts: max, pushOrphans };
    if (selectedLocationId != null) params.locationDbId = selectedLocationId;
    reconcileMutation.mutate(params);
    const scope = selectedLocation ? selectedLocation.name : "all locations";
    toast.info(
      max > 0
        ? `Starting reconciliation for ${scope} (max ${formatNumber(max)} contacts)...`
        : `Starting full reconciliation for ${scope} (unlimited)...`,
      { duration: 3000 }
    );
  };

  if (authLoading) {
    return (
      <AppShell>
        <div className="container max-w-7xl py-8 space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <SEOHead title="Sync Dashboard" description="Multi-location CRM synchronization monitoring and management" />
      <div className="container max-w-7xl py-6 space-y-6">
        {/* Header with Location Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold tracking-tight">Sync Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Multi-location CRM synchronization monitoring and management
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Location Selector */}
            <Select
              value={selectedLocationId != null ? String(selectedLocationId) : "all"}
              onValueChange={(v) => setSelectedLocationId(v === "all" ? null : Number(v))}
            >
              <SelectTrigger className="w-[220px] text-sm">
                <div className="flex items-center gap-2">
                  {selectedLocationId == null ? <Globe className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
                  <SelectValue placeholder="All Locations" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5" />
                    All Locations ({locations.filter((l: any) => l.is_active).length})
                  </div>
                </SelectItem>
                {locations.filter((l: any) => l.is_active).map((loc: any) => (
                  <SelectItem key={loc.id} value={String(loc.id)}>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" />
                      {loc.name}
                      {loc.region && <span className="text-muted-foreground text-xs">({loc.region})</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Badge variant="outline" className="gap-1.5 whitespace-nowrap">
              <Activity className="h-3 w-3" />
              {agg?.lastReconcileAt ? `Last sync: ${timeAgo(agg.lastReconcileAt)}` : "No syncs yet"}
            </Badge>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 max-w-lg">
            <TabsTrigger value="overview" className="gap-1.5 text-xs">
              <BarChart3 className="h-3.5 w-3.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-1.5 text-xs">
              <Webhook className="h-3.5 w-3.5" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="locations" className="gap-1.5 text-xs">
              <MapPin className="h-3.5 w-3.5" />
              Locations
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5 text-xs">
              <History className="h-3.5 w-3.5" />
              History
            </TabsTrigger>
          </TabsList>

          {/* ═══ OVERVIEW TAB ═══ */}
          <TabsContent value="overview" className="space-y-6 mt-4">
            {/* Aggregation Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                title="Stewardly Leads"
                value={agg?.stewardlyTotal ?? 0}
                subtitle={selectedLocation ? selectedLocation.name : "All locations"}
                icon={Database}
                color="text-primary"
              />
              <StatCard
                title="GHL Linked"
                value={agg?.ghlLinked ?? 0}
                subtitle={`${agg?.linkRate ?? 0}% link rate`}
                icon={Link2}
                color="text-emerald-400"
              />
              <StatCard
                title="Unlinked"
                value={agg?.ghlUnlinked ?? 0}
                subtitle="Missing CRM connection"
                icon={Unlink}
                color={agg?.ghlUnlinked ? "text-yellow-400" : "text-muted-foreground"}
              />
              <StatCard
                title="Link Rate"
                value={`${agg?.linkRate ?? 0}%`}
                subtitle={agg?.linkRate === 100 ? "Full consistency" : "Needs reconciliation"}
                icon={agg?.linkRate === 100 ? Shield : TrendingUp}
                color={agg?.linkRate === 100 ? "text-emerald-400" : "text-primary"}
              />
            </div>

            {/* Last Run Summary */}
            {lastRun && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      Last Reconciliation Summary
                    </CardTitle>
                    <Badge variant={lastRun.complete ? "default" : "secondary"}>
                      {lastRun.complete ? "Complete" : "Partial"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">GHL Processed</p>
                      <p className="font-semibold">{formatNumber(lastRun.ghlTotal)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Matched</p>
                      <p className="font-semibold text-emerald-400">{formatNumber(lastRun.matched)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Created (Local)</p>
                      <p className="font-semibold">{formatNumber(lastRun.createdInStewardly)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Created (GHL)</p>
                      <p className="font-semibold">{formatNumber(lastRun.createdInGHL)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Conflicts</p>
                      <p className={`font-semibold ${lastRun.conflictsResolved > 0 ? "text-yellow-400" : ""}`}>
                        {lastRun.conflictsResolved}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Duration</p>
                      <p className="font-semibold">{formatDuration(lastRun.duration_ms)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Controls + Distribution */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Reconciliation Controls */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    Run Reconciliation
                  </CardTitle>
                  <CardDescription>
                    {selectedLocation
                      ? `Sync ${selectedLocation.name} with GoHighLevel`
                      : "Sync all active locations with GoHighLevel"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="maxContacts" className="text-sm">
                      Max GHL Contacts (0 = unlimited)
                    </Label>
                    <Input
                      id="maxContacts"
                      type="number"
                      min="0"
                      step="1000"
                      value={maxContacts}
                      onChange={(e) => setMaxContacts(e.target.value)}
                      placeholder="0 for unlimited"
                      className="max-w-xs"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <Switch id="pushOrphans" checked={pushOrphans} onCheckedChange={setPushOrphans} />
                    <Label htmlFor="pushOrphans" className="text-sm">Push local orphans to GHL</Label>
                  </div>

                  <Button
                    onClick={handleReconcile}
                    disabled={isReconciling || reconcileMutation.isPending}
                    className="w-full"
                    size="lg"
                  >
                    {isReconciling ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" />Reconciling...</>
                    ) : (
                      <><Play className="h-4 w-4 mr-2" />Start Reconciliation</>
                    )}
                  </Button>

                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="flex items-center gap-1.5">
                      <ArrowLeftRight className="h-3 w-3" />
                      3-layer dedup: CRM ID → Email → Phone
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Shield className="h-3 w-3" />
                      Conflict resolution: {selectedLocation
                        ? CONFLICT_POLICIES[selectedLocation.conflict_policy] || "Newest wins"
                        : "Per-location policy"}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <RefreshCw className="h-3 w-3" />
                      Auto-reconciliation: {selectedLocation
                        ? SYNC_FREQUENCIES[selectedLocation.sync_frequency] || "Daily"
                        : "Per-location schedule"}
                    </p>
                  </div>
                </CardContent>
               </Card>

              {/* Real-Time Reconciliation Progress */}
              {isReconciling && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      Reconciliation In Progress
                    </CardTitle>
                    <CardDescription>
                      {(() => {
                        const progress = latestByType("reconcile_progress");
                        if (!progress) return "Initializing...";
                        const d = progress.data as any;
                        return `${d.locationName || selectedLocation?.name || "All locations"} \u2014 ${d.pct || 0}% complete`;
                      })()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {(() => {
                      const progress = latestByType("reconcile_progress");
                      if (!progress) {
                        return (
                          <div className="space-y-3">
                            <Progress value={0} className="h-2" />
                            <p className="text-xs text-muted-foreground text-center">Connecting to GHL API...</p>
                          </div>
                        );
                      }
                      const d = progress.data as any;
                      const pct = d.pct || 0;
                      return (
                        <>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Progress</span>
                              <span className="font-mono font-medium">{(d.processed || 0).toLocaleString()} / {(d.total || 0).toLocaleString()}</span>
                            </div>
                            <Progress value={pct} className="h-2.5" />
                          </div>
                          <div className="grid grid-cols-4 gap-3">
                            <div className="rounded-lg bg-background/80 p-3 text-center">
                              <p className="text-lg font-bold text-emerald-500">{formatNumber(d.matched || 0)}</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Matched</p>
                            </div>
                            <div className="rounded-lg bg-background/80 p-3 text-center">
                              <p className="text-lg font-bold text-blue-500">{formatNumber(d.created || 0)}</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Created</p>
                            </div>
                            <div className="rounded-lg bg-background/80 p-3 text-center">
                              <p className="text-lg font-bold text-amber-500">{formatNumber(d.processed || 0)}</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Processed</p>
                            </div>
                            <div className="rounded-lg bg-background/80 p-3 text-center">
                              <p className="text-lg font-bold text-red-500">{formatNumber(d.errors || 0)}</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Errors</p>
                            </div>
                          </div>
                          {sseEvents.filter(e => e.type === "reconcile_progress" || e.type === "reconcile_complete" || e.type === "sync_error").length > 0 && (
                            <div className="max-h-[120px] overflow-y-auto space-y-1 rounded-md bg-background/50 p-2">
                              {sseEvents
                                .filter(e => e.type === "reconcile_progress" || e.type === "reconcile_complete" || e.type === "sync_error")
                                .slice(0, 10)
                                .map((evt, i) => (
                                  <div key={`prog-${evt.timestamp}-${i}`} className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                    <span className="font-mono w-14 shrink-0">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                                    <Badge variant={evt.type === "sync_error" ? "destructive" : "outline"} className="text-[9px] h-4">
                                      {evt.type === "reconcile_progress" ? "progress" : evt.type === "reconcile_complete" ? "done" : "error"}
                                    </Badge>
                                    <span className="truncate">
                                      {evt.type === "reconcile_progress"
                                        ? `${(evt.data as any).pct}% \u2014 ${(evt.data as any).processed} processed`
                                        : evt.type === "reconcile_complete"
                                        ? `Completed in ${formatDuration((evt.data as any).durationMs)}`
                                        : (evt.data as any).error}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}

              {/* Distribution Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Lead Distribution
                  </CardTitle>
                  <CardDescription>Breakdown by status and source</CardDescription>
                </CardHeader>
                <CardContent>
                  {aggQuery.isLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-6" />)}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">By Status</p>
                        <div className="space-y-1.5">
                          {Object.entries(agg?.byStatus || {}).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([status, count]) => (
                            <div key={status} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <div className={`h-2 w-2 rounded-full ${
                                  status === "converted" ? "bg-emerald-400" :
                                  status === "new" ? "bg-blue-400" :
                                  status === "contacted" ? "bg-yellow-400" :
                                  status === "qualified" ? "bg-primary" :
                                  status === "disqualified" ? "bg-destructive" :
                                  "bg-muted-foreground"
                                }`} />
                                <span className="capitalize">{status}</span>
                              </div>
                              <span className="font-medium tabular-nums">{formatNumber(count as number)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Top Sources</p>
                        <div className="space-y-1.5">
                          {Object.entries(agg?.bySource || {}).slice(0, 8).map(([source, count]) => (
                            <div key={source} className="flex items-center justify-between text-sm">
                              <span className="truncate max-w-[180px]">{source}</span>
                              <span className="font-medium tabular-nums">{formatNumber(count as number)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Conflict Log */}
            {agg?.recentConflicts && agg.recentConflicts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-400" />
                    Recent Conflicts ({agg.recentConflicts.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/50 text-xs text-muted-foreground">
                          <th className="text-left py-2 pr-4">Field</th>
                          <th className="text-left py-2 pr-4">Stewardly</th>
                          <th className="text-left py-2 pr-4">GHL</th>
                          <th className="text-left py-2 pr-4">Resolution</th>
                          <th className="text-left py-2">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agg.recentConflicts.slice(0, 20).map((c: any, i: number) => (
                          <tr key={i} className="border-b border-border/30">
                            <td className="py-2 pr-4 font-medium">{c.field}</td>
                            <td className="py-2 pr-4 text-muted-foreground">{c.stewardlyValue || "—"}</td>
                            <td className="py-2 pr-4 text-muted-foreground">{c.ghlValue || "—"}</td>
                            <td className="py-2 pr-4">
                              <Badge variant="outline" className="text-xs">
                                {c.resolution === "stewardly_wins" ? "Stewardly" : c.resolution === "ghl_wins" ? "GHL" : "Merged"}
                              </Badge>
                            </td>
                            <td className="py-2 text-xs text-muted-foreground max-w-xs truncate">{c.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ═══ ACTIVITY TAB (Webhook Feed) ═══ */}
          <TabsContent value="activity" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Webhook className="h-4 w-4 text-primary" />
                    Webhook Activity Feed
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={sseConnected ? "outline" : "destructive"} className="text-xs gap-1">
                      <Radio className={`h-3 w-3 ${sseConnected ? "text-emerald-400 animate-pulse" : "text-red-400"}`} />
                      {sseConnected ? "Live" : "Disconnected"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => webhookFeedQuery.refetch()}
                      disabled={webhookFeedQuery.isFetching}
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${webhookFeedQuery.isFetching ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  Real-time inbound webhook events from GoHighLevel
                  {selectedLocation && ` — filtered to ${selectedLocation.name}`}
                  {sseEvents.length > 0 && ` • ${sseEvents.length} live event${sseEvents.length !== 1 ? "s" : ""}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {webhookFeedQuery.isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10" />)}
                  </div>
                ) : webhookEvents.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Webhook className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No webhook events received yet</p>
                    <p className="text-xs mt-1">Events will appear here once the GHL webhook is registered</p>
                    <div className="mt-4 p-3 rounded-lg bg-secondary/30 border border-border/50 max-w-md mx-auto text-left">
                      <p className="text-xs font-medium mb-1">Register webhook in GHL:</p>
                      <code className="text-xs font-mono text-muted-foreground block">/api/webhooks/ghl</code>
                      <p className="text-xs text-muted-foreground mt-1">
                        Events: ContactCreate, ContactUpdate, ContactDelete, OpportunityCreate
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="max-h-[600px] overflow-y-auto rounded-lg border border-border/50">
                    {webhookEvents.map((event: any) => (
                      <WebhookEventRow key={event.id} event={event} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Webhook Config Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-primary" />
                  Webhook Configuration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
                    <div>
                      <p className="text-sm font-medium">Webhook Endpoint</p>
                      <code className="text-xs text-muted-foreground font-mono mt-0.5 block">/api/webhooks/ghl</code>
                    </div>
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                      Ready
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Supported events: ContactCreate, ContactUpdate, ContactDelete, OpportunityCreate, OpportunityStatusUpdate</p>
                    <p>Signature verification: Ed25519 (primary) → RSA (legacy) → HMAC (fallback)</p>
                    <p>Location auto-detection: Extracts locationId from webhook payload</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ LOCATIONS TAB ═══ */}
          <TabsContent value="locations" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">GHL Locations</h2>
                <p className="text-sm text-muted-foreground">
                  Manage connected GoHighLevel sub-accounts and their sync configuration
                </p>
              </div>
              <AddLocationDialog onSuccess={() => locationsQuery.refetch()} />
            </div>

            {locationsQuery.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
              </div>
            ) : locations.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground">No locations configured</p>
                  <p className="text-xs text-muted-foreground mt-1">Add your first GHL sub-account to start syncing</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {locations.map((loc: any) => (
                  <Card key={loc.id} className={!loc.is_active ? "opacity-50" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${loc.is_active ? "bg-emerald-400/10 text-emerald-400" : "bg-secondary text-muted-foreground"}`}>
                            <MapPin className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-sm">{loc.name}</h3>
                              {loc.region && <Badge variant="outline" className="text-[10px] py-0">{loc.region}</Badge>}
                              <Badge variant={loc.is_active ? "default" : "secondary"} className="text-[10px] py-0">
                                {loc.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 font-mono">{loc.location_id}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <ArrowLeftRight className="h-3 w-3" />
                                {SYNC_DIRECTIONS[loc.sync_direction]?.label || loc.sync_direction}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {SYNC_FREQUENCIES[loc.sync_frequency] || loc.sync_frequency}
                              </span>
                              <span className="flex items-center gap-1">
                                <Shield className="h-3 w-3" />
                                {CONFLICT_POLICIES[loc.conflict_policy] || loc.conflict_policy}
                              </span>
                            </div>
                            {loc.last_sync_at && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Last sync: {timeAgo(loc.last_sync_at)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <EditLocationDialog location={loc} onSuccess={() => locationsQuery.refetch()} />
                          {loc.is_active && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm(`Deactivate ${loc.name}? This will stop syncing for this location.`)) {
                                  deactivateMutation.mutate({ id: loc.id });
                                }
                              }}
                            >
                              Deactivate
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          {/* ═══ ACTIVITY TAB ═══ */}
          <TabsContent value="activity" className="space-y-4 mt-4">
            {/* Live SSE Event Stream */}
            {sseEvents.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-400" />
                      Live Event Stream
                    </CardTitle>
                    <Badge variant="outline" className="text-xs gap-1">
                      <Radio className={`h-3 w-3 ${sseConnected ? "text-emerald-400 animate-pulse" : "text-red-400"}`} />
                      {sseEvents.length} event{sseEvents.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                  <CardDescription>Real-time events streaming via SSE</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[300px] overflow-y-auto space-y-1">
                    {sseEvents.map((evt, i) => (
                      <div key={`${evt.timestamp}-${i}`} className="flex items-center gap-3 px-3 py-2 rounded-md bg-secondary/20 hover:bg-secondary/40 transition-colors text-xs">
                        <span className="text-muted-foreground w-16 shrink-0 font-mono">
                          {new Date(evt.timestamp).toLocaleTimeString()}
                        </span>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {evt.type.replace(/_/g, " ")}
                        </Badge>
                        {evt.locationName && (
                          <span className="text-muted-foreground shrink-0">
                            <MapPin className="h-3 w-3 inline mr-0.5" />
                            {evt.locationName}
                          </span>
                        )}
                        <span className="truncate text-foreground/80">
                          {evt.data.contactName || evt.data.eventType || evt.data.action || evt.data.error || JSON.stringify(evt.data).slice(0, 80)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" />
                    Run History
                    {selectedLocation && <Badge variant="outline" className="text-xs ml-2">{selectedLocation.name}</Badge>}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => historyQuery.refetch()}
                    disabled={historyQuery.isFetching}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${historyQuery.isFetching ? "animate-spin" : ""}`} />
                  </Button>
                </div>
                <CardDescription>
                  {selectedLocation
                    ? `Reconciliation runs for ${selectedLocation.name}`
                    : "All reconciliation runs across all locations"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {historyQuery.isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-14" />)}
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No reconciliation runs yet</p>
                    <p className="text-xs mt-1">Run your first reconciliation to see history here</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history.map((run: any) => (
                      <RunHistoryRow key={run.id} run={run} locations={locations} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
