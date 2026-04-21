/**
 * AdminAuditTrail.tsx — CRM Compliance Audit Dashboard
 *
 * Pass 32. Full-featured audit trail wired to getCrmAuditLog / getCrmAuditSummary.
 * Features: summary stat cards, category/action/location/date filters, timeline
 * view with before/after state diffs, expandable detail panels, CSV export.
 */
import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  History, Search, Filter, Clock, ChevronDown, ChevronRight,
  Shield, Lock, Unlock, UserCheck, UserX, RefreshCw, MapPin,
  Settings, Zap, AlertTriangle, Activity, CalendarIcon, X,
  ArrowRight, Download, BarChart3, Users, Globe,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { ExportDataButton } from "@/components/ExportDataButton";

// ─── Action / Category Config ─────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: typeof Shield; bg: string }> = {
  permission:      { label: "Permissions",    color: "text-amber-400",   icon: Shield,       bg: "bg-amber-500/10" },
  sync:            { label: "Sync",           color: "text-blue-400",    icon: RefreshCw,    bg: "bg-blue-500/10" },
  location_config: { label: "Location Config",color: "text-purple-400",  icon: Settings,     bg: "bg-purple-500/10" },
  provisioning:    { label: "Provisioning",   color: "text-emerald-400", icon: Globe,        bg: "bg-emerald-500/10" },
  system:          { label: "System",         color: "text-slate-400",   icon: Zap,          bg: "bg-slate-500/10" },
};

const ACTION_CONFIG: Record<string, { label: string; color: string; icon: typeof Shield }> = {
  user_assigned:           { label: "User Assigned",         color: "text-emerald-400", icon: UserCheck },
  user_unassigned:         { label: "User Unassigned",       color: "text-red-400",     icon: UserX },
  role_updated:            { label: "Role Updated",          color: "text-amber-400",   icon: Shield },
  bulk_assign:             { label: "Bulk Assign",           color: "text-emerald-400", icon: Users },
  bulk_unassign:           { label: "Bulk Unassign",         color: "text-red-400",     icon: Users },
  reconciliation_started:  { label: "Reconcile Started",     color: "text-blue-400",    icon: RefreshCw },
  reconciliation_completed:{ label: "Reconcile Complete",    color: "text-emerald-400", icon: Activity },
  reconciliation_failed:   { label: "Reconcile Failed",      color: "text-red-400",     icon: AlertTriangle },
  conflict_resolved:       { label: "Conflict Resolved",     color: "text-amber-400",   icon: Zap },
  orphan_pushed:           { label: "Orphan Pushed",         color: "text-purple-400",  icon: ArrowRight },
  contact_synced:          { label: "Contact Synced",        color: "text-blue-400",    icon: RefreshCw },
  location_config_updated: { label: "Config Updated",        color: "text-purple-400",  icon: Settings },
  location_activated:      { label: "Location Activated",    color: "text-emerald-400", icon: MapPin },
  location_deactivated:    { label: "Location Deactivated",  color: "text-red-400",     icon: MapPin },
  location_provisioned:    { label: "Location Provisioned",  color: "text-emerald-400", icon: Globe },
  location_discovered:     { label: "Location Discovered",   color: "text-blue-400",    icon: Globe },
  system_event:            { label: "System Event",          color: "text-slate-400",   icon: Zap },
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function formatDateShort(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function tryParseJSON(val: unknown): Record<string, unknown> | null {
  if (val && typeof val === "object") return val as Record<string, unknown>;
  if (typeof val === "string") {
    try { return JSON.parse(val); } catch { return null; }
  }
  return null;
}

// ─── State Diff Component ─────────────────────────────────────────────────

function StateDiff({ before, after }: { before: unknown; after: unknown }) {
  const beforeObj = tryParseJSON(before);
  const afterObj = tryParseJSON(after);
  if (!beforeObj && !afterObj) return null;

  const allKeys = Array.from(new Set([
    ...Object.keys(beforeObj || {}),
    ...Object.keys(afterObj || {}),
  ]));

  return (
    <div className="mt-2 p-3 rounded-lg bg-muted/30 border border-border/50">
      <p className="text-xs font-semibold text-muted-foreground mb-2">State Changes</p>
      <div className="space-y-1.5">
        {allKeys.map((key) => {
          const bVal = beforeObj?.[key];
          const aVal = afterObj?.[key];
          const changed = JSON.stringify(bVal) !== JSON.stringify(aVal);
          if (!changed) return null;
          return (
            <div key={key} className="flex items-center gap-2 text-xs font-mono">
              <span className="text-muted-foreground min-w-[100px] truncate">{key}:</span>
              {bVal !== undefined && (
                <span className="line-through text-red-400/70 truncate max-w-[140px]">
                  {String(bVal ?? "null")}
                </span>
              )}
              <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
              {aVal !== undefined && (
                <span className="text-emerald-400 truncate max-w-[140px]">
                  {String(aVal ?? "null")}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────

export default function AdminAuditTrail({ embedded = false }: { embedded?: boolean } = {}) {
  const Shell = embedded ? (({ children }: any) => <>{children}</>) as any : AppShell;

  // ─── Filter State ─────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterLocationId, setFilterLocationId] = useState<number | undefined>();
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // ─── Data Queries ─────────────────────────────────────────────────────
  const queryInput = useMemo(() => ({
    category: filterCategory !== "all" ? filterCategory : undefined,
    action: filterAction !== "all" ? filterAction : undefined,
    locationId: filterLocationId,
    startDate: dateRange.from ? dateRange.from.getTime() : undefined,
    endDate: dateRange.to ? (dateRange.to.getTime() + 86400000) : undefined, // end of day
    limit: pageSize,
    offset: page * pageSize,
  }), [filterCategory, filterAction, filterLocationId, dateRange, page]);

  const { data: auditData, isLoading, refetch } = trpc.integrations.getCrmAuditLog.useQuery(queryInput);
  const { data: summary } = trpc.integrations.getCrmAuditSummary.useQuery({
    startDate: dateRange.from ? dateRange.from.getTime() : undefined,
    endDate: dateRange.to ? (dateRange.to.getTime() + 86400000) : undefined,
    locationId: filterLocationId,
  });
  const { data: locations } = trpc.integrations.listLocations.useQuery();

  const entries = auditData?.entries ?? [];
  const totalCount = auditData?.total ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // ─── Client-side text search over loaded entries ──────────────────────
  const filtered = useMemo(() => {
    if (!search) return entries;
    const q = search.toLowerCase();
    return entries.filter((entry: any) => {
      const searchable = [
        entry.actorName, entry.action, entry.category,
        entry.targetLabel, entry.targetType, entry.locationName,
      ].filter(Boolean).join(" ").toLowerCase();
      return searchable.includes(q);
    });
  }, [entries, search]);

  // ─── Export data ──────────────────────────────────────────────────────
  const exportData = useMemo(() => {
    return filtered.map((e: any) => ({
      timestamp: e.createdAt ? new Date(e.createdAt).toISOString() : "",
      category: e.category ?? "",
      action: e.action ?? "",
      actorName: e.actorName ?? "",
      actorRole: e.actorRole ?? "",
      targetType: e.targetType ?? "",
      targetLabel: e.targetLabel ?? "",
      locationName: e.locationName ?? "",
      beforeState: e.beforeState ? JSON.stringify(e.beforeState) : "",
      afterState: e.afterState ? JSON.stringify(e.afterState) : "",
    }));
  }, [filtered]);

  // ─── Unique actions for filter dropdown ───────────────────────────────
  const availableActions = useMemo(() => {
    if (!summary?.byAction) return [];
    return Object.keys(summary.byAction).sort();
  }, [summary]);

  const clearFilters = useCallback(() => {
    setSearch("");
    setFilterCategory("all");
    setFilterAction("all");
    setFilterLocationId(undefined);
    setDateRange({});
    setPage(0);
  }, []);

  const hasActiveFilters = filterCategory !== "all" || filterAction !== "all" || filterLocationId || dateRange.from || search;

  return (
    <Shell title="Audit Trail">
      <SEOHead title="Audit Trail" description="CRM compliance audit trail — permission changes, sync events, and system actions" />
      <div className="min-h-screen">
        {/* ─── Header ──────────────────────────────────────────────────── */}
        <header className="border-b border-border px-4 py-3 flex items-center gap-3 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 50%, oklch(0.65 0.15 300 / 0.15) 0%, transparent 70%)' }} />
          <Shield className="w-5 h-5 text-accent relative" />
          <div className="relative">
            <h1 className="text-lg font-semibold">Compliance Audit Trail</h1>
            <p className="text-xs text-muted-foreground">Permission changes, sync events, and system actions</p>
          </div>
          <div className="ml-auto flex items-center gap-2 relative">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => { refetch(); toast.success("Refreshed"); }}>
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh data</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <ExportDataButton
              data={exportData}
              filename="crm-audit-trail"
              columns={["timestamp", "category", "action", "actorName", "actorRole", "targetType", "targetLabel", "locationName", "beforeState", "afterState"]}
              label="Export"
            />
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
          {/* ─── Summary Stats ──────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Card className="border-border/50">
              <CardContent className="p-4 text-center">
                <History className="h-5 w-5 mx-auto mb-1 text-accent" />
                <div className="text-2xl font-bold">{summary?.totalEvents ?? 0}</div>
                <p className="text-xs text-muted-foreground">Total Events</p>
              </CardContent>
            </Card>
            {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
              const count = summary?.byCategory?.[key] ?? 0;
              const Icon = cfg.icon;
              return (
                <Card
                  key={key}
                  className={`border-border/50 cursor-pointer transition-all hover:border-accent/40 ${filterCategory === key ? "ring-1 ring-accent" : ""}`}
                  onClick={() => { setFilterCategory(filterCategory === key ? "all" : key); setPage(0); }}
                >
                  <CardContent className="p-4 text-center">
                    <Icon className={`h-5 w-5 mx-auto mb-1 ${cfg.color}`} />
                    <div className="text-2xl font-bold">{count}</div>
                    <p className="text-xs text-muted-foreground">{cfg.label}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* ─── Top Actors ─────────────────────────────────────────── */}
          {summary?.topActors && summary.topActors.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-accent" /> Top Actors
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="flex flex-wrap gap-2">
                  {summary.topActors.slice(0, 8).map((actor: any, i: number) => (
                    <Badge key={i} variant="outline" className="text-xs gap-1.5 py-1">
                      <Users className="h-3 w-3" />
                      {actor.actorName || `User #${actor.actorId}`}
                      <span className="text-muted-foreground">({actor.count})</span>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── Filters ───────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by actor, target, action..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Category tabs */}
            <Tabs value={filterCategory} onValueChange={(v) => { setFilterCategory(v); setPage(0); }}>
              <TabsList className="h-9">
                <TabsTrigger value="all" className="text-xs px-2">All</TabsTrigger>
                <TabsTrigger value="permission" className="text-xs px-2">Perms</TabsTrigger>
                <TabsTrigger value="sync" className="text-xs px-2">Sync</TabsTrigger>
                <TabsTrigger value="location_config" className="text-xs px-2">Config</TabsTrigger>
                <TabsTrigger value="provisioning" className="text-xs px-2">Prov</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Action filter */}
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-xs"
              value={filterAction}
              onChange={(e) => { setFilterAction(e.target.value); setPage(0); }}
            >
              <option value="all">All Actions</option>
              {availableActions.map(a => (
                <option key={a} value={a}>{ACTION_CONFIG[a]?.label ?? a}</option>
              ))}
            </select>

            {/* Location filter */}
            {locations && (locations as any[]).length > 0 && (
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-xs"
                value={filterLocationId ?? ""}
                onChange={(e) => { setFilterLocationId(e.target.value ? Number(e.target.value) : undefined); setPage(0); }}
              >
                <option value="">All Locations</option>
                {(locations as any[]).map((loc: any) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            )}

            {/* Date range */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs gap-1.5 shrink-0">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateRange.from
                    ? `${formatDateShort(dateRange.from.getTime())}${dateRange.to ? ` – ${formatDateShort(dateRange.to.getTime())}` : ""}`
                    : "Date Range"
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={dateRange.from ? { from: dateRange.from, to: dateRange.to } : undefined}
                  onSelect={(range: any) => {
                    setDateRange({ from: range?.from, to: range?.to });
                    setPage(0);
                  }}
                  numberOfMonths={1}
                />
              </PopoverContent>
            </Popover>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs gap-1 shrink-0">
                <X className="h-3 w-3" /> Clear
              </Button>
            )}
          </div>

          {/* ─── Timeline ──────────────────────────────────────────── */}
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : !filtered.length ? (
            <div className="text-center py-16 text-muted-foreground">
              <Shield className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium">No audit entries found</p>
              <p className="text-xs mt-1">
                {hasActiveFilters ? "Try adjusting your filters" : "Permission and sync changes will appear here"}
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[calc(100vh-420px)]">
              <div className="relative pl-6">
                {/* Timeline line */}
                <div className="absolute left-[11px] top-0 bottom-0 w-px bg-border" />

                <div className="space-y-1">
                  {filtered.map((entry: any, i: number) => {
                    const actionCfg = ACTION_CONFIG[entry.action] ?? {
                      label: entry.action, color: "text-muted-foreground", icon: History,
                    };
                    const catCfg = CATEGORY_CONFIG[entry.category] ?? CATEGORY_CONFIG.system;
                    const Icon = actionCfg.icon;
                    const isExpanded = expandedEntry === (entry.id ?? i);

                    return (
                      <div key={entry.id ?? i} className="relative">
                        {/* Timeline dot */}
                        <div className={`absolute -left-6 top-4 w-[22px] h-[22px] rounded-full border-2 border-background flex items-center justify-center ${catCfg.bg}`}>
                          <div className={`w-2 h-2 rounded-full ${catCfg.color.replace("text-", "bg-")}`} />
                        </div>

                        <Card className={`transition-all hover:border-accent/30 ${isExpanded ? "border-accent/40" : "border-border/50"}`}>
                          <CardContent className="p-0">
                            <button
                              type="button"
                              className="w-full text-left p-3 sm:p-4 flex items-center gap-3"
                              onClick={() => setExpandedEntry(isExpanded ? null : (entry.id ?? i))}
                            >
                              <div className={`p-2 rounded-lg ${catCfg.bg} shrink-0`}>
                                <Icon className={`h-4 w-4 ${actionCfg.color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-sm font-medium ${actionCfg.color}`}>{actionCfg.label}</span>
                                  <Badge variant="outline" className="text-[10px] font-mono">{entry.category}</Badge>
                                  {entry.locationName && (
                                    <Badge variant="secondary" className="text-[10px] gap-1">
                                      <MapPin className="h-2.5 w-2.5" />{entry.locationName}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                  <span>{entry.actorName || `Actor #${entry.actorId ?? "system"}`}</span>
                                  {entry.targetLabel && (
                                    <>
                                      <ArrowRight className="h-3 w-3" />
                                      <span>{entry.targetLabel}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                  {entry.createdAt ? formatTimestamp(entry.createdAt) : "—"}
                                </span>
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </div>
                            </button>

                            {isExpanded && (
                              <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-3">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                  <div>
                                    <p className="text-muted-foreground mb-0.5">Action</p>
                                    <p className="font-mono">{entry.action}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground mb-0.5">Category</p>
                                    <p className="font-mono">{entry.category}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground mb-0.5">Actor</p>
                                    <p className="font-mono">{entry.actorName ?? "—"} {entry.actorRole ? `(${entry.actorRole})` : ""}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground mb-0.5">Target</p>
                                    <p className="font-mono">{entry.targetType ?? "—"} {entry.targetId ? `#${entry.targetId}` : ""}</p>
                                  </div>
                                </div>

                                {entry.targetLabel && (
                                  <div className="text-xs">
                                    <p className="text-muted-foreground mb-0.5">Target Label</p>
                                    <p>{entry.targetLabel}</p>
                                  </div>
                                )}

                                {entry.locationName && (
                                  <div className="text-xs">
                                    <p className="text-muted-foreground mb-0.5">Location</p>
                                    <p className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3" /> {entry.locationName}
                                      {entry.locationId && <span className="text-muted-foreground">(#{entry.locationId})</span>}
                                    </p>
                                  </div>
                                )}

                                {/* Before / After State Diff */}
                                <StateDiff before={entry.beforeState} after={entry.afterState} />

                                {/* Metadata */}
                                {entry.metadata && Object.keys(tryParseJSON(entry.metadata) || {}).length > 0 && (
                                  <div className="mt-2 p-3 rounded-lg bg-muted/20 border border-border/30">
                                    <p className="text-xs font-semibold text-muted-foreground mb-1">Metadata</p>
                                    <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap break-all">
                                      {JSON.stringify(tryParseJSON(entry.metadata), null, 2)}
                                    </pre>
                                  </div>
                                )}

                                {entry.ipAddress && (
                                  <div className="text-xs text-muted-foreground">
                                    IP: <span className="font-mono">{entry.ipAddress}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              </div>
            </ScrollArea>
          )}

          {/* ─── Pagination ────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalCount)} of {totalCount}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="sm" disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {page + 1} of {totalPages}
                </span>
                <Button
                  variant="outline" size="sm" disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          <Separator />
          <p className="text-xs text-muted-foreground text-center">
            {totalCount} total audit events.{" "}
            {hasActiveFilters && `${filtered.length} shown after filters. `}
            Export to CSV for full compliance analysis.
          </p>
        </div>
      </div>
    </Shell>
  );
}
