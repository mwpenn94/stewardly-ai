/**
 * AdminRateManagement — Rate profiles grid + AI recommendations (pass 72).
 *
 * Before pass 72 this page was a stub with no tRPC calls — every
 * button fired a toast. Pass 67 correctly flagged it as "reachable
 * but not usable" and the earlier draft added a "design preview"
 * banner. On pass 72 re-audit I discovered the backend ALREADY
 * exists: `server/routers/adminIntelligence.ts` exposes
 * `getRateProfiles`, `getRecommendations`, `generateRecommendation`,
 * `applyRecommendation`, and `dismissRecommendation` as admin-gated
 * procedures reading real rows from the `rate_profiles` and
 * `rate_recommendations` tables.
 *
 * So this pass ditches the banner and fully wires the page. Admins
 * now see live rate profiles with their daily budget / current RPM
 * / success rate / last-throttled telemetry, can generate and review
 * AI rate recommendations, and can apply or dismiss them — all
 * mutations round-trip through adminProcedure and the UI refreshes
 * automatically.
 */
import { useState } from "react";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  TrendingUp,
  Loader2,
  XCircle,
  RefreshCw,
  Sparkles,
  Clock,
  CheckCircle2,
  Ban,
} from "lucide-react";

function formatPct(d: unknown): string {
  if (d == null) return "—";
  const n = typeof d === "string" ? parseFloat(d) : Number(d);
  if (Number.isNaN(n)) return "—";
  return `${n.toFixed(1)}%`;
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "never";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "never";
  return date.toLocaleString();
}

export default function AdminRateManagement() {
  const { user, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();
  const [genProvider, setGenProvider] = useState("");

  const profilesQ = trpc.adminIntelligence.getRateProfiles.useQuery(undefined, {
    retry: false,
    refetchInterval: 30_000,
  });
  const recsQ = trpc.adminIntelligence.getRecommendations.useQuery(undefined, {
    retry: false,
    refetchInterval: 30_000,
  });

  const generateMut = trpc.adminIntelligence.generateRecommendation.useMutation({
    onSuccess: () => {
      toast.success("Rate analysis started");
      setGenProvider("");
      utils.adminIntelligence.getRecommendations.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const applyMut = trpc.adminIntelligence.applyRecommendation.useMutation({
    onSuccess: () => {
      toast.success("Recommendation applied");
      utils.adminIntelligence.getRecommendations.invalidate();
      utils.adminIntelligence.getRateProfiles.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const dismissMut = trpc.adminIntelligence.dismissRecommendation.useMutation({
    onSuccess: () => {
      toast.info("Recommendation dismissed");
      utils.adminIntelligence.getRecommendations.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (authLoading) {
    return (
      <AppShell title="Rate Management">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }
  if (!user || user.role !== "admin") {
    return (
      <AppShell title="Rate Management">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <XCircle className="w-12 h-12 text-red-500" />
          <p className="text-muted-foreground">Admin access required</p>
        </div>
      </AppShell>
    );
  }

  const profiles = profilesQ.data ?? [];
  const recs = recsQ.data ?? [];

  return (
    <AppShell title="Rate Management">
      <div className="container max-w-6xl py-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="w-6 h-6" /> Rate Management
            </h1>
            <p className="text-muted-foreground">
              Live rate profiles and AI-powered optimization recommendations.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              profilesQ.refetch();
              recsQ.refetch();
            }}
            disabled={profilesQ.isFetching || recsQ.isFetching}
          >
            {profilesQ.isFetching || recsQ.isFetching ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>

        <Tabs defaultValue="profiles">
          <TabsList>
            <TabsTrigger value="profiles">Rate Profiles ({profiles.length})</TabsTrigger>
            <TabsTrigger value="recommendations">AI Recommendations ({recs.length})</TabsTrigger>
            <TabsTrigger value="generate">Generate</TabsTrigger>
          </TabsList>

          {/* ─── Profiles tab ──────────────────────────────────────── */}
          <TabsContent value="profiles" className="space-y-4 mt-4">
            {profilesQ.isLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Loading rate profiles…
              </div>
            ) : profiles.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center space-y-2 text-sm text-muted-foreground">
                  <TrendingUp className="w-10 h-10 mx-auto opacity-40" />
                  <p>No rate profiles configured yet.</p>
                  <p className="text-xs">
                    Profiles are seeded by the scraping services on first use.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {profiles.map((profile: any) => (
                  <Card key={profile.id} className={profile.enabled === false ? "opacity-60" : ""}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{profile.provider}</p>
                          <p className="text-[11px] text-muted-foreground truncate font-mono">
                            {profile.domain}
                          </p>
                        </div>
                        <Badge variant={profile.enabled !== false ? "default" : "outline"}>
                          {profile.enabled !== false ? "Active" : "Disabled"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">Current RPM</p>
                          <p className="font-mono">{profile.currentRpm}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Max RPM</p>
                          <p className="font-mono">{profile.staticMaximum ?? "—"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Daily Budget</p>
                          <p className="font-mono">
                            {profile.dailyUsed ?? 0} / {profile.dailyBudget ?? "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Success Rate</p>
                          <p className="font-mono">{formatPct(profile.successRate)}</p>
                        </div>
                      </div>
                      {(profile.lastThrottledAt || profile.lastBlockedAt) && (
                        <div className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Last throttled: {formatDate(profile.lastThrottledAt ?? profile.lastBlockedAt)}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ─── Recommendations tab ──────────────────────────────── */}
          <TabsContent value="recommendations" className="space-y-4 mt-4">
            {recsQ.isLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Loading recommendations…
              </div>
            ) : recs.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-sm text-muted-foreground space-y-2">
                  <Sparkles className="w-10 h-10 mx-auto opacity-40" />
                  <p>No pending recommendations.</p>
                  <p className="text-xs">
                    Use the <b>Generate</b> tab to kick off a new rate analysis for a specific provider.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {recs.map((rec: any) => (
                  <Card key={rec.id}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{rec.provider}</p>
                            <Badge variant="outline" className="text-[10px]">
                              {rec.recommendationType}
                            </Badge>
                            {rec.confidence != null && (
                              <Badge variant="secondary" className="text-[10px]">
                                {formatPct(Number(rec.confidence) * 100)} confidence
                              </Badge>
                            )}
                          </div>
                          <pre className="mt-2 text-[11px] bg-muted/40 rounded p-2 overflow-x-auto max-h-40">
                            {JSON.stringify(rec.recommendationJson, null, 2)}
                          </pre>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Created {formatDate(rec.createdAt)}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            onClick={() => applyMut.mutate({ id: rec.id })}
                            disabled={applyMut.isPending}
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Apply
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => dismissMut.mutate({ id: rec.id })}
                            disabled={dismissMut.isPending}
                          >
                            <Ban className="w-3 h-3 mr-1" /> Dismiss
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ─── Generate tab ─────────────────────────────────────── */}
          <TabsContent value="generate" className="space-y-4 mt-4">
            <Card>
              <CardContent className="pt-4 space-y-3">
                <p className="text-sm font-medium">Generate a new rate recommendation</p>
                <p className="text-xs text-muted-foreground">
                  Analyzes live rate telemetry for the selected provider and generates
                  an AI-powered recommendation for your review.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={genProvider}
                    onChange={(e) => setGenProvider(e.target.value)}
                    placeholder="Provider name (e.g. fred, sec, nasba)"
                    className="flex-1"
                  />
                  <Button
                    onClick={() => {
                      if (!genProvider.trim()) {
                        toast.error("Enter a provider name");
                        return;
                      }
                      generateMut.mutate({ provider: genProvider.trim() });
                    }}
                    disabled={generateMut.isPending || !genProvider.trim()}
                  >
                    {generateMut.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    Run Analysis
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
