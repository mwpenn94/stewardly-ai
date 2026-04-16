/**
 * AdminAuditTrail.tsx — Full-featured audit trail viewer for admins
 *
 * Pass 59. Provides comprehensive view of all permission changes,
 * sharing events, and system actions with filtering, search, and export.
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  History, Search, Download, Filter, Clock, ChevronDown, ChevronRight,
  Shield, Share2, Lock, Unlock, UserCheck, UserX, RefreshCw,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";

const ACTION_CONFIG: Record<string, { label: string; color: string; icon: typeof Shield; bg: string }> = {
  grant_permission: { label: "Permission Granted", color: "text-emerald-400", icon: Unlock, bg: "bg-emerald-500/10" },
  update_permission: { label: "Permission Updated", color: "text-amber-400", icon: RefreshCw, bg: "bg-amber-500/10" },
  revoke_permission: { label: "Permission Revoked", color: "text-red-400", icon: Lock, bg: "bg-red-500/10" },
  share_content: { label: "Content Shared", color: "text-blue-400", icon: Share2, bg: "bg-blue-500/10" },
  revoke_share: { label: "Share Revoked", color: "text-red-400", icon: UserX, bg: "bg-red-500/10" },
  login: { label: "User Login", color: "text-cyan-400", icon: UserCheck, bg: "bg-cyan-500/10" },
  role_change: { label: "Role Changed", color: "text-purple-400", icon: Shield, bg: "bg-purple-500/10" },
};

export default function AdminAuditTrail() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);

  const { data: auditLog, isLoading, refetch } = trpc.sharing.getAuditLog.useQuery({ limit: 200 });

  const filtered = useMemo(() => {
    if (!auditLog) return [];
    return (auditLog as any[]).filter((entry: any) => {
      if (filterAction !== "all" && entry.actionType !== filterAction) return false;
      if (search) {
        const q = search.toLowerCase();
        const searchable = [
          entry.featureId,
          entry.reason,
          entry.actionType,
          `actor ${entry.actorId}`,
          entry.targetUserId ? `user ${entry.targetUserId}` : "",
        ].join(" ").toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });
  }, [auditLog, search, filterAction]);

  const actionTypes = useMemo(() => {
    if (!auditLog) return [];
    const types = new Set((auditLog as any[]).map((e: any) => e.actionType));
    return Array.from(types).sort();
  }, [auditLog]);

  const stats = useMemo(() => {
    if (!auditLog) return { total: 0, grants: 0, revokes: 0, shares: 0 };
    const entries = auditLog as any[];
    return {
      total: entries.length,
      grants: entries.filter((e: any) => e.actionType === "grant_permission").length,
      revokes: entries.filter((e: any) => e.actionType === "revoke_permission" || e.actionType === "revoke_share").length,
      shares: entries.filter((e: any) => e.actionType === "share_content").length,
    };
  }, [auditLog]);

  const handleExport = () => {
    if (!filtered.length) {
      toast({ title: "Nothing to export", variant: "destructive" });
      return;
    }
    const headers = ["Timestamp", "Action", "Feature", "Actor", "Target", "Previous", "New", "Reason"];
    const rows = filtered.map((e: any) => [
      e.createdAt ? new Date(e.createdAt).toISOString() : "",
      e.actionType,
      e.featureId ?? "",
      e.actorId ?? "",
      e.targetUserId ?? "",
      e.previousValue ?? "",
      e.newValue ?? "",
      e.reason ?? "",
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map((c: string) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: `${filtered.length} entries exported to CSV` });
  };

  return (
    <AppShell title="Audit Trail">
      <SEOHead title="Audit Trail" description="Full audit trail of permission and sharing changes" />
      <div className="min-h-screen">
        <header className="border-b border-border px-4 py-3 flex items-center gap-3 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 50%, oklch(0.65 0.15 300 / 0.15) 0%, transparent 70%)' }} />
          <History className="w-5 h-5 text-accent relative" />
          <h1 className="text-lg font-semibold relative">Audit Trail</h1>
          <div className="ml-auto flex items-center gap-2 relative">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
            </Button>
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <History className="h-5 w-5 mx-auto mb-1 text-accent" />
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground">Total Events</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Unlock className="h-5 w-5 mx-auto mb-1 text-emerald-400" />
                <div className="text-2xl font-bold">{stats.grants}</div>
                <p className="text-xs text-muted-foreground">Grants</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Lock className="h-5 w-5 mx-auto mb-1 text-red-400" />
                <div className="text-2xl font-bold">{stats.revokes}</div>
                <p className="text-xs text-muted-foreground">Revocations</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Share2 className="h-5 w-5 mx-auto mb-1 text-blue-400" />
                <div className="text-2xl font-bold">{stats.shares}</div>
                <p className="text-xs text-muted-foreground">Shares</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by feature, actor, reason..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
            >
              <option value="all">All Actions</option>
              {actionTypes.map(t => (
                <option key={t} value={t}>{ACTION_CONFIG[t]?.label ?? t}</option>
              ))}
            </select>
          </div>

          {/* Event List */}
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : !filtered.length ? (
            <div className="text-center py-16 text-muted-foreground">
              <History className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium">No audit entries found</p>
              <p className="text-xs mt-1">Permission and sharing changes will appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((entry: any, i: number) => {
                const config = ACTION_CONFIG[entry.actionType] ?? {
                  label: entry.actionType,
                  color: "text-muted-foreground",
                  icon: History,
                  bg: "bg-muted/20",
                };
                const Icon = config.icon;
                const isExpanded = expandedEntry === (entry.id ?? i);

                return (
                  <Card key={entry.id ?? i} className="transition-all hover:border-accent/30">
                    <CardContent className="p-0">
                      <button type="button"
                        className="w-full text-left p-4 flex items-center gap-3"
                        onClick={() => setExpandedEntry(isExpanded ? null : (entry.id ?? i))}
                      >
                        <div className={`p-2 rounded-lg ${config.bg} shrink-0`}>
                          <Icon className={`h-4 w-4 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
                            {entry.featureId && (
                              <Badge variant="outline" className="text-xs font-mono">{entry.featureId}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                            <span>Actor #{entry.actorId}</span>
                            {entry.targetUserId && <span>→ User #{entry.targetUserId}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "—"}
                          </span>
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-2">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">Action Type</p>
                              <p className="font-mono text-xs">{entry.actionType}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Feature</p>
                              <p className="font-mono text-xs">{entry.featureId ?? "—"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Actor ID</p>
                              <p className="font-mono text-xs">{entry.actorId}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Target User</p>
                              <p className="font-mono text-xs">{entry.targetUserId ?? "—"}</p>
                            </div>
                          </div>
                          {(entry.previousValue || entry.newValue) && (
                            <div className="mt-2 p-3 rounded-lg bg-muted/30 border border-border/50">
                              <p className="text-xs font-semibold text-muted-foreground mb-1">Value Change</p>
                              <div className="flex items-center gap-2 text-xs font-mono">
                                {entry.previousValue && (
                                  <span className="line-through text-red-400/70">{entry.previousValue}</span>
                                )}
                                {entry.previousValue && entry.newValue && <span className="text-muted-foreground">→</span>}
                                {entry.newValue && (
                                  <span className="text-emerald-400">{entry.newValue}</span>
                                )}
                              </div>
                            </div>
                          )}
                          {entry.reason && (
                            <div className="mt-2">
                              <p className="text-xs text-muted-foreground">Reason</p>
                              <p className="text-sm italic">{entry.reason}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Showing {filtered.length} of {stats.total} audit events. Export to CSV for full analysis.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
