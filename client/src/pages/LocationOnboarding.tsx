/**
 * LocationOnboarding.tsx — Guided Location Onboarding Wizard
 *
 * Multi-step wizard for admins to:
 * 1. Discover GHL sub-accounts
 * 2. Configure sync settings per location
 * 3. Assign team members
 * 4. Run first reconciliation
 * 5. Review completion summary
 */
import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Globe, Search, Settings, Users, Play, CheckCircle2,
  ArrowRight, ArrowLeft, Loader2, AlertCircle, MapPin,
  RefreshCw, Zap, Clock, Shield, ChevronRight,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { useSyncEvents, type SyncEvent } from "@/hooks/useSyncEvents";

// ─── Types ───────────────────────────────────────────────────────────────

interface LocationItem {
  id: number;
  name: string;
  ghl_location_id?: string;
  ghlLocationId?: string;
  is_active?: boolean;
  isActive?: boolean;
  sync_direction?: string;
  syncDirection?: string;
  sync_frequency?: string;
  syncFrequency?: string;
  memberCount?: number;
  completedSyncs?: number;
  isConfigured?: boolean;
  hasMembers?: boolean;
  hasSynced?: boolean;
}

interface SyncConfig {
  syncDirection: "bidirectional" | "pull_only" | "push_only" | "disabled";
  syncFrequency: "realtime" | "hourly" | "daily" | "manual";
  conflictPolicy: "ghl_wins" | "stewardly_wins" | "newest_wins" | "manual";
  rateLimitPerMinute: number;
}

interface MemberAssignment {
  userId: number;
  role: "viewer" | "editor" | "admin";
  name?: string;
  email?: string;
}

// ─── Step Components ─────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Discover", icon: Search, description: "Find GHL sub-accounts" },
  { id: 2, label: "Configure", icon: Settings, description: "Set sync preferences" },
  { id: 3, label: "Team", icon: Users, description: "Assign members" },
  { id: 4, label: "Sync", icon: Play, description: "Run first sync" },
  { id: 5, label: "Complete", icon: CheckCircle2, description: "Review summary" },
];

// ─── Main Component ──────────────────────────────────────────────────────

export default function LocationOnboarding() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [syncConfig, setSyncConfig] = useState<SyncConfig>({
    syncDirection: "bidirectional",
    syncFrequency: "daily",
    conflictPolicy: "newest_wins",
    rateLimitPerMinute: 30,
  });
  const [memberAssignments, setMemberAssignments] = useState<MemberAssignment[]>([]);
  const [reconcileResult, setReconcileResult] = useState<any>(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const [liveProgress, setLiveProgress] = useState<{
    processed: number; total: number; matched: number; created: number; errors: number; pct: number;
  } | null>(null);

  // SSE for real-time reconciliation streaming
  const { events: sseEvents, connected: sseConnected } = useSyncEvents({
    autoConnect: currentStep === 4 && isReconciling,
    eventTypes: ["reconcile_progress", "reconcile_complete", "sync_error"],
  });

  // Update live progress from SSE events
  useEffect(() => {
    if (sseEvents.length === 0) return;
    const latest = sseEvents[0]; // newest first
    if (latest.type === "reconcile_progress" && latest.data) {
      setLiveProgress({
        processed: latest.data.processed ?? 0,
        total: latest.data.total ?? 0,
        matched: latest.data.matched ?? 0,
        created: latest.data.created ?? 0,
        errors: latest.data.errors ?? 0,
        pct: latest.data.pct ?? 0,
      });
    }
    if (latest.type === "reconcile_complete" && latest.data) {
      setLiveProgress(null);
    }
  }, [sseEvents]);

  // ─── Queries ─────────────────────────────────────────────────────────
  const discoverQ = trpc.integrations.onboardingDiscoverLocations.useQuery(undefined, {
    enabled: currentStep === 1,
  });
  const usersQ = trpc.integrations.listUsers.useQuery(undefined, {
    enabled: currentStep === 3,
  });
  const statusQ = trpc.integrations.getOnboardingStatus.useQuery(undefined, {
    enabled: currentStep === 5,
  });

  // ─── Mutations ───────────────────────────────────────────────────────
  const configureMut = trpc.integrations.onboardingConfigureLocation.useMutation({
    onSuccess: () => {
      toast.success("Sync configuration saved");
      setCurrentStep(3);
    },
    onError: (err) => toast.error(err.message),
  });

  const assignMut = trpc.integrations.onboardingAssignMembers.useMutation({
    onSuccess: (data) => {
      toast.success(`Assigned ${data.assigned} members`);
      setCurrentStep(4);
    },
    onError: (err) => toast.error(err.message),
  });

  const reconcileMut = trpc.integrations.onboardingRunReconciliation.useMutation({
    onSuccess: (data) => {
      setIsReconciling(false);
      if (data.success) {
        setReconcileResult(data.stats);
        toast.success("Reconciliation completed successfully");
        setCurrentStep(5);
      } else {
        toast.error(data.error || "Reconciliation failed");
      }
    },
    onError: (err) => {
      setIsReconciling(false);
      toast.error(err.message);
    },
  });

  // ─── Derived ─────────────────────────────────────────────────────────
  const allLocations = useMemo(() => {
    if (!discoverQ.data) return [];
    return discoverQ.data.existing || [];
  }, [discoverQ.data]);

  const selectedLocation = useMemo(() => {
    return allLocations.find((l: any) => l.id === selectedLocationId);
  }, [allLocations, selectedLocationId]);

  // ─── Handlers ────────────────────────────────────────────────────────
  const handleSelectLocation = (locId: number) => {
    setSelectedLocationId(locId);
  };

  const handleConfigureSave = () => {
    if (!selectedLocationId) return;
    configureMut.mutate({
      locationDbId: selectedLocationId,
      ...syncConfig,
    });
  };

  const handleAssignSave = () => {
    if (!selectedLocationId) return;
    if (memberAssignments.length === 0) {
      // Skip assignment step
      setCurrentStep(4);
      return;
    }
    assignMut.mutate({
      locationDbId: selectedLocationId,
      assignments: memberAssignments,
    });
  };

  const handleRunReconciliation = () => {
    if (!selectedLocationId) return;
    setIsReconciling(true);
    reconcileMut.mutate({ locationDbId: selectedLocationId });
  };

  const toggleMemberAssignment = (userId: number, name?: string, email?: string) => {
    setMemberAssignments((prev) => {
      const existing = prev.find((a) => a.userId === userId);
      if (existing) {
        return prev.filter((a) => a.userId !== userId);
      }
      return [...prev, { userId, role: "editor" as const, name, email }];
    });
  };

  const updateMemberRole = (userId: number, role: "viewer" | "editor" | "admin") => {
    setMemberAssignments((prev) =>
      prev.map((a) => (a.userId === userId ? { ...a, role } : a))
    );
  };

  // ─── Step Progress Bar ───────────────────────────────────────────────
  const StepProgress = () => (
    <div className="flex items-center justify-between mb-8">
      {STEPS.map((step, idx) => {
        const isActive = step.id === currentStep;
        const isComplete = step.id < currentStep;
        const Icon = step.icon;
        return (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  isComplete
                    ? "bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500/30"
                    : isActive
                    ? "bg-blue-500/20 text-blue-400 ring-2 ring-blue-500/40"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isComplete ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>
              <span
                className={`text-xs mt-1.5 font-medium ${
                  isActive ? "text-blue-400" : isComplete ? "text-emerald-400" : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 mt-[-1rem] ${
                  isComplete ? "bg-emerald-500/40" : "bg-muted"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  // ─── Step 1: Discover ────────────────────────────────────────────────
  const Step1Discover = () => (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-blue-400" />
          Discover GHL Sub-Accounts
        </CardTitle>
        <CardDescription>
          Select a location to onboard. Existing locations from your GoHighLevel account are shown below.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {discoverQ.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Discovering locations...</span>
          </div>
        ) : allLocations.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
            <p className="text-muted-foreground">No locations found. Ensure your GHL API key is configured.</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => discoverQ.refetch()}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry Discovery
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {allLocations.map((loc: any) => (
              <div
                key={loc.id}
                onClick={() => handleSelectLocation(loc.id)}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  selectedLocationId === loc.id
                    ? "border-blue-500/50 bg-blue-500/5 ring-1 ring-blue-500/20"
                    : "border-border/50 hover:border-border hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin className={`w-5 h-5 ${selectedLocationId === loc.id ? "text-blue-400" : "text-muted-foreground"}`} />
                    <div>
                      <p className="font-medium">{loc.name || "Unnamed Location"}</p>
                      <p className="text-xs text-muted-foreground">{loc.ghl_location_id || loc.ghlLocationId}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {loc.is_active || loc.isActive ? (
                      <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-xs">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-xs">Inactive</Badge>
                    )}
                    {selectedLocationId === loc.id && (
                      <ChevronRight className="w-4 h-4 text-blue-400" />
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => discoverQ.refetch()}
                disabled={discoverQ.isFetching}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${discoverQ.isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                onClick={() => setCurrentStep(2)}
                disabled={!selectedLocationId}
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // ─── Step 2: Configure ───────────────────────────────────────────────
  const Step2Configure = () => (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-400" />
          Configure Sync Settings
        </CardTitle>
        <CardDescription>
          Set how data flows between Stewardly and GHL for{" "}
          <span className="font-medium text-foreground">{selectedLocation?.name || "this location"}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sync Direction */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            Sync Direction
          </label>
          <Select
            value={syncConfig.syncDirection}
            onValueChange={(v: any) => setSyncConfig((c) => ({ ...c, syncDirection: v }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bidirectional">Bidirectional (recommended)</SelectItem>
              <SelectItem value="pull_only">Pull Only (GHL → Stewardly)</SelectItem>
              <SelectItem value="push_only">Push Only (Stewardly → GHL)</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Bidirectional keeps both systems in sync. Pull-only imports from GHL without pushing changes back.
          </p>
        </div>

        {/* Sync Frequency */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            Sync Frequency
          </label>
          <Select
            value={syncConfig.syncFrequency}
            onValueChange={(v: any) => setSyncConfig((c) => ({ ...c, syncFrequency: v }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="realtime">Real-time (via webhooks)</SelectItem>
              <SelectItem value="hourly">Hourly</SelectItem>
              <SelectItem value="daily">Daily (recommended)</SelectItem>
              <SelectItem value="manual">Manual only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Conflict Policy */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-400" />
            Conflict Resolution
          </label>
          <Select
            value={syncConfig.conflictPolicy}
            onValueChange={(v: any) => setSyncConfig((c) => ({ ...c, conflictPolicy: v }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest_wins">Newest Wins (recommended)</SelectItem>
              <SelectItem value="ghl_wins">GHL Always Wins</SelectItem>
              <SelectItem value="stewardly_wins">Stewardly Always Wins</SelectItem>
              <SelectItem value="manual">Manual Review</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Rate Limit */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Rate Limit (requests/minute)</label>
          <Select
            value={String(syncConfig.rateLimitPerMinute)}
            onValueChange={(v) => setSyncConfig((c) => ({ ...c, rateLimitPerMinute: Number(v) }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10/min (conservative)</SelectItem>
              <SelectItem value="30">30/min (recommended)</SelectItem>
              <SelectItem value="60">60/min (aggressive)</SelectItem>
              <SelectItem value="100">100/min (maximum)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={() => setCurrentStep(1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button onClick={handleConfigureSave} disabled={configureMut.isPending}>
            {configureMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save & Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // ─── Step 3: Team Assignment ─────────────────────────────────────────
  const Step3Team = () => {
    const users = usersQ.data || [];
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Assign Team Members
          </CardTitle>
          <CardDescription>
            Select team members who should have access to{" "}
            <span className="font-medium text-foreground">{selectedLocation?.name || "this location"}</span>.
            You can skip this step and assign members later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usersQ.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading users...</span>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No users found. You can assign members later from the Permissions page.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {users.map((user: any) => {
                const isSelected = memberAssignments.some((a) => a.userId === user.id);
                const assignment = memberAssignments.find((a) => a.userId === user.id);
                return (
                  <div
                    key={user.id}
                    className={`p-3 rounded-lg border transition-all ${
                      isSelected
                        ? "border-blue-500/30 bg-blue-500/5"
                        : "border-border/50 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleMemberAssignment(user.id, user.name, user.email)}
                        />
                        <div>
                          <p className="text-sm font-medium">{user.name || "Unnamed"}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {user.role}
                        </Badge>
                      </div>
                      {isSelected && (
                        <Select
                          value={assignment?.role || "editor"}
                          onValueChange={(v: any) => updateMemberRole(user.id, v)}
                        >
                          <SelectTrigger className="w-28 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">Viewer</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-border/50 mt-4">
            <div className="text-sm text-muted-foreground">
              {memberAssignments.length} member{memberAssignments.length !== 1 ? "s" : ""} selected
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setCurrentStep(2)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCurrentStep(4)}>
                Skip
              </Button>
              <Button onClick={handleAssignSave} disabled={assignMut.isPending}>
                {assignMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {memberAssignments.length > 0 ? "Assign & Continue" : "Continue"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ─── Step 4: Run Reconciliation ──────────────────────────────────────
  const Step4Sync = () => (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="w-5 h-5 text-blue-400" />
          Run First Sync
          {isReconciling && sseConnected && (
            <Badge variant="outline" className="text-[10px] gap-1 text-emerald-400 border-emerald-400/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Run the initial reconciliation to sync contacts between GHL and Stewardly for{" "}
          <span className="font-medium text-foreground">{selectedLocation?.name || "this location"}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8">
          {isReconciling ? (
            <>
              <Loader2 className="w-12 h-12 animate-spin text-blue-400 mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">Syncing contacts...</p>
              {liveProgress ? (
                <div className="max-w-md mx-auto space-y-4">
                  {/* Progress bar */}
                  <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${Math.min(liveProgress.pct, 100)}%` }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {liveProgress.pct}% — {liveProgress.processed.toLocaleString()} contacts processed
                  </p>
                  {/* Live stats grid */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="p-2 rounded-lg bg-muted/50">
                      <p className="text-xl font-bold tabular-nums">{liveProgress.processed.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">Processed</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50">
                      <p className="text-xl font-bold tabular-nums text-emerald-400">{liveProgress.matched.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">Matched</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50">
                      <p className="text-xl font-bold tabular-nums text-blue-400">{liveProgress.created.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">Created</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50">
                      <p className="text-xl font-bold tabular-nums text-red-400">{liveProgress.errors}</p>
                      <p className="text-[10px] text-muted-foreground">Errors</p>
                    </div>
                  </div>
                  {/* SSE event feed */}
                  {sseEvents.length > 0 && (
                    <div className="mt-3 max-h-32 overflow-y-auto rounded-lg bg-muted/20 border border-border/30 p-2 text-left">
                      {sseEvents.slice(0, 8).map((evt, i) => (
                        <div key={i} className="text-[11px] font-mono text-muted-foreground py-0.5 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                          <span className="truncate">
                            {evt.type === "reconcile_progress"
                              ? `Page processed — ${evt.data?.processed ?? 0} contacts (${evt.data?.matched ?? 0} matched, ${evt.data?.created ?? 0} new)`
                              : evt.type === "reconcile_complete"
                              ? `Reconciliation complete in ${((evt.data?.durationMs ?? 0) / 1000).toFixed(1)}s`
                              : evt.type === "sync_error"
                              ? `Error: ${evt.data?.error ?? "unknown"}`
                              : evt.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Connecting to live stream... This may take a few minutes.
                </p>
              )}
            </>
          ) : reconcileResult ? (
            <>
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
              <p className="text-lg font-medium mb-4">Sync Complete</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-lg mx-auto">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold">{reconcileResult.ghlTotal ?? 0}</p>
                  <p className="text-xs text-muted-foreground">GHL Contacts</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold">{reconcileResult.matched ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Matched</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold">{reconcileResult.createdInStewardly ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Imported</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold">{reconcileResult.errors ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Errors</p>
                </div>
              </div>
              {reconcileResult.duration_ms && (
                <p className="text-xs text-muted-foreground mt-3">
                  Completed in {(reconcileResult.duration_ms / 1000).toFixed(1)}s
                </p>
              )}
            </>
          ) : (
            <>
              <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">Ready to Sync</p>
              <p className="text-sm text-muted-foreground mb-6">
                Click the button below to start the initial contact reconciliation.
                You'll see real-time progress as contacts are synced.
                You can also skip this step and run it later from the Sync Dashboard.
              </p>
              <Button size="lg" onClick={handleRunReconciliation}>
                <Play className="w-5 h-5 mr-2" />
                Start Reconciliation
              </Button>
            </>
          )}
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={() => setCurrentStep(3)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex gap-2">
            {!reconcileResult && !isReconciling && (
              <Button variant="outline" onClick={() => setCurrentStep(5)}>
                Skip
              </Button>
            )}
            {reconcileResult && (
              <Button onClick={() => setCurrentStep(5)}>
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // ─── Step 5: Completion Summary ──────────────────────────────────────
  const Step5Complete = () => {
    const status = statusQ.data;
    const loc = status?.locations?.find((l: any) => l.id === selectedLocationId);
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            Onboarding Complete
          </CardTitle>
          <CardDescription>
            <span className="font-medium text-foreground">{selectedLocation?.name || "Location"}</span>{" "}
            has been successfully onboarded.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <Settings className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium">Sync Config</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Direction: <span className="text-foreground">{syncConfig.syncDirection}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Frequency: <span className="text-foreground">{syncConfig.syncFrequency}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Conflicts: <span className="text-foreground">{syncConfig.conflictPolicy}</span>
                </p>
              </div>

              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-medium">Team</span>
                </div>
                <p className="text-2xl font-bold">{memberAssignments.length}</p>
                <p className="text-xs text-muted-foreground">Members assigned</p>
              </div>

              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <RefreshCw className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-medium">Sync Status</span>
                </div>
                {reconcileResult ? (
                  <>
                    <p className="text-2xl font-bold text-emerald-400">{reconcileResult.matched ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Contacts synced</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-amber-400">Pending</p>
                    <p className="text-xs text-muted-foreground">Run from Sync Dashboard</p>
                  </>
                )}
              </div>
            </div>

            {/* Next Steps */}
            <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
              <h4 className="text-sm font-medium mb-3 text-blue-400">Recommended Next Steps</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 mt-0.5 text-blue-400 shrink-0" />
                  <span>Register the GHL webhook to enable real-time sync events</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 mt-0.5 text-blue-400 shrink-0" />
                  <span>Visit the <strong>Sync Dashboard</strong> to monitor ongoing sync activity</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 mt-0.5 text-blue-400 shrink-0" />
                  <span>Use <strong>Location Analytics</strong> to compare performance across locations</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 mt-0.5 text-blue-400 shrink-0" />
                  <span>Onboard additional locations by running this wizard again</span>
                </li>
              </ul>
            </div>

            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setCurrentStep(1);
                  setSelectedLocationId(null);
                  setReconcileResult(null);
                  setMemberAssignments([]);
                }}
              >
                Onboard Another Location
              </Button>
              <Button onClick={() => window.location.href = "/sync-dashboard"}>
                Go to Sync Dashboard
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <AppShell>
      <SEOHead title="Location Onboarding" description="Guided setup for GHL location sync" />
      <div className="container max-w-3xl py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Location Onboarding</h1>
          <p className="text-muted-foreground mt-1">
            Set up a new GHL location with sync configuration, team assignments, and initial reconciliation.
          </p>
        </div>

        <StepProgress />

        {currentStep === 1 && <Step1Discover />}
        {currentStep === 2 && <Step2Configure />}
        {currentStep === 3 && <Step3Team />}
        {currentStep === 4 && <Step4Sync />}
        {currentStep === 5 && <Step5Complete />}
      </div>
    </AppShell>
  );
}
