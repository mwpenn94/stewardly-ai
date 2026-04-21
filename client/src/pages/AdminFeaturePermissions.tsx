import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Shield, Lock, Unlock, Eye, Users, Building2, Search, Filter, ChevronRight, History, Clock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { QueryErrorBanner } from "@/components/QueryErrorBanner";
import { SEOHead } from "@/components/SEOHead";

const LAYER_COLORS: Record<string, string> = {
  person: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  client: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  advisor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  manager: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  steward: "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

const DISCLOSURE_LABELS: Record<number, string> = {
  1: "Essential",
  2: "Standard",
  3: "Advanced",
  4: "Expert",
};

export default function AdminFeaturePermissions({ embedded = false }: { embedded?: boolean } = {}) {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [filterLayer, setFilterLayer] = useState("all");
  const [filterDisclosure, setFilterDisclosure] = useState("all");

  const { data: registry, error: registryError } = trpc.sharing.getFeatureRegistry.useQuery();
  const { data: myPerms, error: permsError } = trpc.sharing.getMyPermissions.useQuery();

  const features = useMemo(() => {
    if (!registry) return [];
    return Object.entries(registry)
      .filter(([key, feat]) => {
        if (search && !feat.label.toLowerCase().includes(search.toLowerCase()) && !key.includes(search.toLowerCase())) return false;
        if (filterLayer !== "all" && feat.category !== filterLayer) return false;
        if (filterDisclosure !== "all" && feat.defaultDisclosure !== Number(filterDisclosure)) return false;
        return true;
      })
      .sort((a, b) => {
        const layerOrder = ["person", "client", "advisor", "manager", "steward"];
        const layerDiff = layerOrder.indexOf(a[1].category) - layerOrder.indexOf(b[1].category);
        if (layerDiff !== 0) return layerDiff;
        return a[1].defaultDisclosure - b[1].defaultDisclosure;
      });
  }, [registry, search, filterLayer, filterDisclosure]);

  const layerStats = useMemo(() => {
    if (!registry) return {};
    const stats: Record<string, { total: number; enabled: number }> = {};
    for (const [key, feat] of Object.entries(registry)) {
      if (!stats[feat.category]) stats[feat.category] = { total: 0, enabled: 0 };
      stats[feat.category].total++;
      const perm = myPerms?.[key];
      if (perm?.enabled ?? feat.defaultEnabled) stats[feat.category].enabled++;
    }
    return stats;
  }, [registry, myPerms]);

  return (
      <>
        <SEOHead title="Feature Permissions" description="Manage feature access and permissions across the platform." />
    <div className="space-y-6">
      <QueryErrorBanner query={{ isError: !!(registryError || permsError), error: registryError || permsError, refetch: undefined }} />
      {/* Back + Header */}
      {!embedded && (
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} className="-ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Admin
        </Button>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Feature Permissions
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage feature access across persona layers, roles, and disclosure levels
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {registry ? Object.keys(registry).length : 0} features registered
        </Badge>
      </div>

      {/* Layer Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {["person", "client", "advisor", "manager", "steward"].map((layer) => (
          <Card key={layer} className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setFilterLayer(filterLayer === layer ? "all" : layer)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Badge className={LAYER_COLORS[layer]}>{layer}</Badge>
                {filterLayer === layer && <ChevronRight className="h-4 w-4 text-primary" />}
              </div>
              <div className="text-2xl font-bold">
                {layerStats[layer]?.enabled ?? 0}/{layerStats[layer]?.total ?? 0}
              </div>
              <p className="text-xs text-muted-foreground">features enabled</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search features..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterLayer} onValueChange={setFilterLayer}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Layer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Layers</SelectItem>
                <SelectItem value="person">Person</SelectItem>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="advisor">Advisor</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="steward">Steward</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterDisclosure} onValueChange={setFilterDisclosure}>
              <SelectTrigger className="w-[160px]">
                <Eye className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Disclosure" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="1">Essential</SelectItem>
                <SelectItem value="2">Standard</SelectItem>
                <SelectItem value="3">Advanced</SelectItem>
                <SelectItem value="4">Expert</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Feature List */}
      <Tabs defaultValue="grid">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">{features.length} features</p>
          <TabsList>
            <TabsTrigger value="grid">Grid</TabsTrigger>
            <TabsTrigger value="table">Table</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="grid">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(([key, feat]) => {
              const perm = myPerms?.[key];
              const isEnabled = perm?.enabled ?? feat.defaultEnabled;
              const source = perm?.source ?? "default";
              const ceiling = perm?.disclosureCeiling ?? feat.defaultDisclosure;

              return (
                <Card key={key} className={`transition-all ${isEnabled ? "" : "opacity-60"}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium flex items-center gap-2">
                          {isEnabled ? <Unlock className="h-4 w-4 text-emerald-400" /> : <Lock className="h-4 w-4 text-red-400" />}
                          {feat.label}
                        </h3>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{key}</p>
                      </div>
                      <Switch checked={isEnabled} disabled />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={LAYER_COLORS[feat.category]}>{feat.category}</Badge>
                      <Badge variant="outline" className="text-xs">
                        {DISCLOSURE_LABELS[ceiling]} (L{ceiling})
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {source === "default" ? "Default" : source === "user" ? "Custom" : source}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="table">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 font-medium">Feature</th>
                      <th className="text-left p-3 font-medium">Layer</th>
                      <th className="text-left p-3 font-medium">Disclosure</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {features.map(([key, feat]) => {
                      const perm = myPerms?.[key];
                      const isEnabled = perm?.enabled ?? feat.defaultEnabled;
                      const source = perm?.source ?? "default";
                      const ceiling = perm?.disclosureCeiling ?? feat.defaultDisclosure;

                      return (
                        <tr key={key} className="border-b border-border/50 hover:bg-muted/50">
                          <td className="p-3">
                            <div className="font-medium">{feat.label}</div>
                            <div className="text-xs text-muted-foreground font-mono">{key}</div>
                          </td>
                          <td className="p-3">
                            <Badge className={LAYER_COLORS[feat.category]}>{feat.category}</Badge>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline">{DISCLOSURE_LABELS[ceiling]} (L{ceiling})</Badge>
                          </td>
                          <td className="p-3">
                            {isEnabled ? (
                              <Badge className="bg-emerald-500/10 text-emerald-400">Enabled</Badge>
                            ) : (
                              <Badge className="bg-red-500/10 text-red-400">Disabled</Badge>
                            )}
                          </td>
                          <td className="p-3 text-muted-foreground capitalize">{source}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Audit Trail */}
      <AuditTrailSection />
    </div>
      </>
  );
}

function AuditTrailSection() {
  const { data: auditLog, isLoading } = trpc.sharing.getAuditLog.useQuery({ limit: 50 });

  const ACTION_LABELS: Record<string, { label: string; color: string }> = {
    grant_permission: { label: "Granted", color: "text-emerald-400" },
    update_permission: { label: "Updated", color: "text-amber-400" },
    revoke_permission: { label: "Revoked", color: "text-red-400" },
    share_content: { label: "Shared", color: "text-blue-400" },
    revoke_share: { label: "Unshared", color: "text-red-400" },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5" />
          Audit Trail
        </CardTitle>
        <CardDescription>Recent permission and sharing changes</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted/50 rounded animate-pulse" />
            ))}
          </div>
        ) : !auditLog?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No audit entries yet</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {(auditLog as any[]).map((entry: any, i: number) => {
              const action = ACTION_LABELS[entry.actionType] ?? { label: entry.actionType, color: "text-muted-foreground" };
              return (
                <div key={entry.id ?? i} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                  <div className="mt-0.5">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-medium ${action.color}`}>{action.label}</span>
                      {entry.featureId && (
                        <Badge variant="outline" className="text-xs font-mono">{entry.featureId}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>Actor #{entry.actorId}</span>
                      {entry.targetUserId && <span>→ User #{entry.targetUserId}</span>}
                      {entry.reason && <span className="italic">• {entry.reason}</span>}
                    </div>
                    {entry.newValue && (
                      <div className="mt-1 text-xs font-mono text-muted-foreground/70 truncate">
                        {entry.previousValue && <span className="line-through mr-2">{entry.previousValue}</span>}
                        {entry.newValue}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
