import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  AlertTriangle, Bell, BellOff, CheckCircle2, Clock, Gauge,
  Loader2, MapPin, RefreshCw, Save, Settings2, Shield, Trash2,
  XCircle, Zap, Timer, Activity, BarChart3, TrendingUp,
} from "lucide-react";

// ─── Metric Definitions ──────────────────────────────────────────────
const METRIC_DEFS: Record<string, {
  label: string;
  unit: string;
  icon: typeof Clock;
  description: string;
  defaultWarning: number;
  defaultCritical: number;
}> = {
  sync_lag_minutes: {
    label: "Sync Lag",
    unit: "min",
    icon: Clock,
    description: "Minutes since last successful sync",
    defaultWarning: 120,
    defaultCritical: 480,
  },
  error_rate_pct: {
    label: "Error Rate",
    unit: "%",
    icon: AlertTriangle,
    description: "Percentage of failed sync events in last 24h",
    defaultWarning: 10,
    defaultCritical: 25,
  },
  data_freshness_hours: {
    label: "Data Freshness",
    unit: "h",
    icon: Timer,
    description: "Hours since last data update",
    defaultWarning: 2,
    defaultCritical: 6,
  },
  poll_failures: {
    label: "Poll Failures",
    unit: "",
    icon: Zap,
    description: "Number of failed poll events in last 24h",
    defaultWarning: 5,
    defaultCritical: 15,
  },
};

const METRIC_NAMES = Object.keys(METRIC_DEFS) as Array<keyof typeof METRIC_DEFS>;

// ─── Threshold Editor Dialog ─────────────────────────────────────────
function ThresholdEditorDialog({
  open,
  onOpenChange,
  location,
  existingThresholds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: { id: number; locationId: string; name: string } | null;
  existingThresholds: Array<{
    metricName: string;
    warningThreshold: number;
    criticalThreshold: number;
    enabled: boolean;
  }>;
}) {
  const utils = trpc.useUtils();
  const setThreshold = trpc.integrations.setAlertThreshold.useMutation({
    onSuccess: () => {
      utils.integrations.getAlertThresholds.invalidate();
      utils.integrations.evaluateAlertThresholds.invalidate();
    },
  });

  const [values, setValues] = useState<Record<string, {
    warning: string;
    critical: string;
    enabled: boolean;
  }>>(() => {
    const init: Record<string, { warning: string; critical: string; enabled: boolean }> = {};
    for (const name of METRIC_NAMES) {
      const existing = existingThresholds.find(t => t.metricName === name);
      const def = METRIC_DEFS[name];
      init[name] = {
        warning: existing ? String(existing.warningThreshold) : String(def.defaultWarning),
        critical: existing ? String(existing.criticalThreshold) : String(def.defaultCritical),
        enabled: existing ? existing.enabled : true,
      };
    }
    return init;
  });

  // Reset values when location changes
  const locationKey = location?.id;
  useState(() => {
    if (locationKey) {
      const init: Record<string, { warning: string; critical: string; enabled: boolean }> = {};
      for (const name of METRIC_NAMES) {
        const existing = existingThresholds.find(t => t.metricName === name);
        const def = METRIC_DEFS[name];
        init[name] = {
          warning: existing ? String(existing.warningThreshold) : String(def.defaultWarning),
          critical: existing ? String(existing.criticalThreshold) : String(def.defaultCritical),
          enabled: existing ? existing.enabled : true,
        };
      }
      setValues(init);
    }
  });

  const handleSaveAll = async () => {
    if (!location) return;
    let savedCount = 0;
    for (const name of METRIC_NAMES) {
      const v = values[name];
      const warning = parseFloat(v.warning);
      const critical = parseFloat(v.critical);
      if (isNaN(warning) || isNaN(critical)) continue;
      if (warning >= critical) {
        toast.error(`${METRIC_DEFS[name].label}: Warning must be less than critical`);
        return;
      }
      try {
        await setThreshold.mutateAsync({
          locationDbId: location.id,
          locationId: location.locationId,
          metricName: name as any,
          warningThreshold: warning,
          criticalThreshold: critical,
          enabled: v.enabled,
        });
        savedCount++;
      } catch (err: any) {
        toast.error(`Failed to save ${METRIC_DEFS[name].label}: ${err.message}`);
      }
    }
    if (savedCount > 0) {
      toast.success(`Saved ${savedCount} threshold(s) for ${location.name}`);
      onOpenChange(false);
    }
  };

  if (!location) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-blue-500" />
            Alert Thresholds: {location.name}
          </DialogTitle>
          <DialogDescription>
            Configure warning and critical thresholds for each metric. Alerts fire when the metric exceeds the threshold.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {METRIC_NAMES.map((name) => {
            const def = METRIC_DEFS[name];
            const Icon = def.icon;
            const v = values[name];

            return (
              <div key={name} className="space-y-2 p-3 rounded-lg border bg-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{def.label}</span>
                    {def.unit && <span className="text-xs text-muted-foreground">({def.unit})</span>}
                  </div>
                  <Switch
                    checked={v.enabled}
                    onCheckedChange={(enabled) =>
                      setValues(prev => ({ ...prev, [name]: { ...prev[name], enabled } }))
                    }
                  />
                </div>
                <p className="text-xs text-muted-foreground">{def.description}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-amber-600">Warning</Label>
                    <Input
                      type="number"
                      min={0}
                      step={def.unit === "%" ? 1 : 0.5}
                      value={v.warning}
                      onChange={(e) =>
                        setValues(prev => ({ ...prev, [name]: { ...prev[name], warning: e.target.value } }))
                      }
                      disabled={!v.enabled}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-red-600">Critical</Label>
                    <Input
                      type="number"
                      min={0}
                      step={def.unit === "%" ? 1 : 0.5}
                      value={v.critical}
                      onChange={(e) =>
                        setValues(prev => ({ ...prev, [name]: { ...prev[name], critical: e.target.value } }))
                      }
                      disabled={!v.enabled}
                      className="h-8"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSaveAll} disabled={setThreshold.isPending}>
            {setThreshold.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Save All
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Alert Severity Badge ────────────────────────────────────────────
function SeverityBadge({ severity }: { severity: string }) {
  if (severity === "critical") {
    return <Badge variant="destructive" className="gap-1 text-xs"><XCircle className="h-3 w-3" />Critical</Badge>;
  }
  return <Badge variant="secondary" className="gap-1 text-xs"><AlertTriangle className="h-3 w-3" />Warning</Badge>;
}

// ─── Main Component ──────────────────────────────────────────────────
export default function AlertThresholds() {
  const [selectedLocation, setSelectedLocation] = useState<{ id: number; locationId: string; name: string } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const thresholdsQuery = trpc.integrations.getAlertThresholds.useQuery(undefined, { refetchInterval: 60000 });
  const alertsQuery = trpc.integrations.evaluateAlertThresholds.useQuery(undefined, { refetchInterval: 30000 });
  const healthQuery = trpc.integrations.getLocationHealth.useQuery(undefined, { refetchInterval: 30000 });
  const resetThresholds = trpc.integrations.resetAlertThresholds.useMutation({
    onSuccess: () => {
      thresholdsQuery.refetch();
      alertsQuery.refetch();
      toast.success("Thresholds reset to defaults");
    },
    onError: (err) => toast.error(`Reset failed: ${err.message}`),
  });

  const thresholds = thresholdsQuery.data?.thresholds ?? [];
  const activeAlerts = alertsQuery.data?.alerts ?? [];
  const locations = healthQuery.data?.locations ?? [];

  // Group thresholds by location
  const thresholdsByLocation = useMemo(() => {
    const map = new Map<number, typeof thresholds>();
    for (const t of thresholds) {
      if (!map.has(t.locationDbId)) map.set(t.locationDbId, []);
      map.get(t.locationDbId)!.push(t);
    }
    return map;
  }, [thresholds]);

  // Summary stats
  const stats = useMemo(() => ({
    totalLocations: locations.length,
    configuredLocations: new Set(thresholds.map(t => t.locationDbId)).size,
    activeAlerts: activeAlerts.length,
    criticalAlerts: activeAlerts.filter(a => a.severity === "critical").length,
    warningAlerts: activeAlerts.filter(a => a.severity === "warning").length,
    totalThresholds: thresholds.length,
    enabledThresholds: thresholds.filter(t => t.enabled).length,
  }), [locations, thresholds, activeAlerts]);

  const openEditor = (loc: typeof locations[0]) => {
    setSelectedLocation({ id: loc.id, locationId: loc.locationId, name: loc.name });
    setEditorOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-6 w-6 text-amber-500" />
            Location Alert Thresholds
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure per-location warning and critical thresholds for sync lag, error rate, and data freshness
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { thresholdsQuery.refetch(); alertsQuery.refetch(); healthQuery.refetch(); }}
          disabled={thresholdsQuery.isRefetching}
        >
          {thresholdsQuery.isRefetching ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <MapPin className="h-5 w-5 text-blue-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats.totalLocations}</p>
            <p className="text-xs text-muted-foreground">Locations</p>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="p-3 text-center">
            <Settings2 className="h-5 w-5 text-blue-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-blue-600">{stats.configuredLocations}</p>
            <p className="text-xs text-muted-foreground">Configured</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Gauge className="h-5 w-5 text-violet-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats.totalThresholds}</p>
            <p className="text-xs text-muted-foreground">Thresholds</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-emerald-600">{stats.enabledThresholds}</p>
            <p className="text-xs text-muted-foreground">Enabled</p>
          </CardContent>
        </Card>
        <Card className={stats.activeAlerts > 0 ? "border-amber-500/20 bg-amber-500/5" : ""}>
          <CardContent className="p-3 text-center">
            <Bell className="h-5 w-5 text-amber-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-amber-600">{stats.activeAlerts}</p>
            <p className="text-xs text-muted-foreground">Active Alerts</p>
          </CardContent>
        </Card>
        <Card className={stats.warningAlerts > 0 ? "border-amber-500/20 bg-amber-500/5" : ""}>
          <CardContent className="p-3 text-center">
            <AlertTriangle className="h-5 w-5 text-amber-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-amber-600">{stats.warningAlerts}</p>
            <p className="text-xs text-muted-foreground">Warnings</p>
          </CardContent>
        </Card>
        <Card className={stats.criticalAlerts > 0 ? "border-red-500/20 bg-red-500/5" : ""}>
          <CardContent className="p-3 text-center">
            <XCircle className="h-5 w-5 text-red-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-red-600">{stats.criticalAlerts}</p>
            <p className="text-xs text-muted-foreground">Critical</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <Card className="border-red-500/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <CardTitle className="text-base">Active Threshold Alerts ({activeAlerts.length})</CardTitle>
            </div>
            <CardDescription>
              Locations exceeding configured thresholds
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activeAlerts.map((alert, i) => (
                <div key={i} className={`flex items-center gap-3 p-2.5 rounded-md border ${
                  alert.severity === "critical" ? "bg-red-500/5 border-red-500/20" : "bg-amber-500/5 border-amber-500/20"
                }`}>
                  <SeverityBadge severity={alert.severity} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{alert.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Current: <span className="font-mono font-medium">{alert.currentValue}</span>
                      {" · "}Warning: <span className="font-mono">{alert.warningThreshold}</span>
                      {" · "}Critical: <span className="font-mono">{alert.criticalThreshold}</span>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0"
                    onClick={() => {
                      const loc = locations.find(l => l.id === alert.locationDbId);
                      if (loc) openEditor(loc);
                    }}
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Location Threshold Grid */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-base">Per-Location Thresholds</CardTitle>
          </div>
          <CardDescription>
            Click a location to configure its alert thresholds. Unconfigured locations use system defaults.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {healthQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : locations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No active locations found</p>
              <p className="text-xs mt-1">Connect GHL locations to start configuring thresholds</p>
            </div>
          ) : (
            <div className="space-y-2">
              {locations.map((loc) => {
                const locThresholds = thresholdsByLocation.get(loc.id) || [];
                const isConfigured = locThresholds.length > 0;
                const enabledCount = locThresholds.filter(t => t.enabled).length;
                const locAlerts = activeAlerts.filter(a => a.locationDbId === loc.id);
                const hasCritical = locAlerts.some(a => a.severity === "critical");
                const hasWarning = locAlerts.some(a => a.severity === "warning");

                return (
                  <div
                    key={loc.id}
                    className={`flex items-center gap-4 p-3 rounded-lg border transition-colors cursor-pointer hover:bg-accent/50 ${
                      hasCritical ? "border-red-500/30 bg-red-500/5" :
                      hasWarning ? "border-amber-500/30 bg-amber-500/5" :
                      "bg-card"
                    }`}
                    onClick={() => openEditor(loc)}
                  >
                    <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
                      {/* Name */}
                      <div className="md:col-span-2">
                        <p className="font-medium text-sm truncate">{loc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {loc.locationId.slice(0, 8)}...
                          {loc.region ? ` · ${loc.region}` : ""}
                        </p>
                      </div>

                      {/* Configuration Status */}
                      <div>
                        {isConfigured ? (
                          <Badge variant="default" className="gap-1 text-xs">
                            <CheckCircle2 className="h-3 w-3" />
                            {enabledCount}/{locThresholds.length} active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <BellOff className="h-3 w-3" />
                            Not configured
                          </Badge>
                        )}
                      </div>

                      {/* Active Alerts for this location */}
                      <div>
                        {locAlerts.length > 0 ? (
                          <div className="flex gap-1 flex-wrap">
                            {locAlerts.map((a, i) => (
                              <SeverityBadge key={i} severity={a.severity} />
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">No alerts</span>
                        )}
                      </div>

                      {/* Threshold Summary */}
                      <div className="flex gap-1 flex-wrap">
                        {isConfigured ? (
                          locThresholds.map((t) => {
                            const def = METRIC_DEFS[t.metricName];
                            if (!def) return null;
                            return (
                              <Badge
                                key={t.metricName}
                                variant="outline"
                                className={`text-xs ${t.enabled ? "" : "opacity-50 line-through"}`}
                              >
                                {def.label}: {t.warningThreshold}/{t.criticalThreshold}
                              </Badge>
                            );
                          })
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Click to configure</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {isConfigured && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Reset all thresholds for ${loc.name}?`)) {
                              resetThresholds.mutate({ locationDbId: loc.id });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
                      <Settings2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Threshold Editor Dialog */}
      <ThresholdEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        location={selectedLocation}
        existingThresholds={selectedLocation ? (thresholdsByLocation.get(selectedLocation.id) || []) : []}
      />

      {/* Footer */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Shield className="h-3 w-3" />
        <span>Thresholds are evaluated every 30s against live metrics</span>
        <span>&middot;</span>
        <Activity className="h-3 w-3" />
        <span>Unconfigured locations use system defaults (120min warning, 480min critical)</span>
      </div>
    </div>
  );
}
