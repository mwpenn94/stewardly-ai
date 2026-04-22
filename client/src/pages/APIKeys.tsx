/**
 * APIKeys — API access management hub.
 *
 * Pass 78: Replaced placeholder with real data from webhookIngestion
 * (inbound API endpoints) and dynamicIntegrations (outbound connections).
 * No dedicated api_keys table needed — the existing webhook endpoints
 * and integration blueprints serve as the API access layer.
 */
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Key, Plus, Webhook, Plug2, Activity,
  ExternalLink, Clock, ArrowRight, Shield,
} from "lucide-react";
import { QueryErrorBanner } from "@/components/QueryErrorBanner";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import AppShell from "@/components/AppShell";

export default function APIKeys({ embedded = false }: { embedded?: boolean } = {}) {
  const Shell = embedded ? (({ children }: any) => <>{children}</>) as any : AppShell;

  const [, navigate] = useLocation();
  const webhooksQ = trpc.webhooks.list.useQuery();
  const webhookStatsQ = trpc.webhooks.stats.useQuery();
  // @ts-expect-error — property access on loosely typed object
  const integrationsQ = trpc.dynamicIntegrations.listBlueprints.useQuery({ status: "active" });

  const webhooks = webhooksQ.data ?? [];
  const stats = webhookStatsQ.data;
  const integrations = integrationsQ.data ?? [];
  const isLoading = webhooksQ.isLoading || integrationsQ.isLoading;

  return (
    <Shell title="API Access">
    <div className="container max-w-4xl py-8 space-y-6">
      <SEOHead title="API Access" description="Manage API endpoints, webhooks, and integrations" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Key className="h-6 w-6" /> API Access</h1>
            <p className="text-sm text-muted-foreground">Manage inbound webhooks and outbound integrations</p>
          </div>
        </div>
      </div>

      {(webhooksQ.error || integrationsQ.error) && (
        <QueryErrorBanner query={{ isError: !!(webhooksQ.error || integrationsQ.error), error: webhooksQ.error || integrationsQ.error, refetch: undefined }} />
      )}

      {/* Summary Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><Webhook className="h-3 w-3" /> Webhooks</div>
            <div className="text-2xl font-bold mt-1">{webhooks.length}</div>
            <div className="text-[10px] text-muted-foreground">{webhooks.filter((w: any) => w.isActive).length} active</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><Plug2 className="h-3 w-3" /> Integrations</div>
            <div className="text-2xl font-bold mt-1">{integrations.length}</div>
            <div className="text-[10px] text-muted-foreground">active blueprints</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><Activity className="h-3 w-3" /> Events (24h)</div>
            <div className="text-2xl font-bold mt-1">{(stats as any)?.totalEventsToday ?? 0}</div>
            <div className="text-[10px] text-muted-foreground">webhook events</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><Shield className="h-3 w-3" /> Success Rate</div>
            <div className="text-2xl font-bold mt-1">{(stats as any)?.successRate ? `${Math.round((stats as any).successRate)}%` : "—"}</div>
            <div className="text-[10px] text-muted-foreground">delivery rate</div>
          </Card>
        </div>
      )}

      {/* Inbound Webhooks */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2"><Webhook className="h-4 w-4" /> Inbound Webhooks</CardTitle>
              <CardDescription className="text-xs">Endpoints that receive data from external systems</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate("/admin/webhooks")}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Manage
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-12" />)}</div>
          ) : webhooks.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              <Webhook className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>No webhooks configured yet</p>
              <Button size="sm" variant="link" onClick={() => navigate("/admin/webhooks")}>
                Create your first webhook <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {webhooks.slice(0, 5).map((wh: any) => (
                <div key={wh.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{wh.name || wh.provider}</span>
                      {wh.isActive ? (
                        <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">Inactive</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {wh.createdAt ? new Date(wh.createdAt).toLocaleDateString() : "—"}</span>
                      <span>{wh.provider}</span>
                    </div>
                  </div>
                </div>
              ))}
              {webhooks.length > 5 && (
                <div className="pt-2 text-center">
                  <Button size="sm" variant="link" onClick={() => navigate("/admin/webhooks")}>
                    View all {webhooks.length} webhooks <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Outbound Integrations */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2"><Plug2 className="h-4 w-4" /> Outbound Integrations</CardTitle>
              <CardDescription className="text-xs">Connections to external APIs and services</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate("/integrations")}>
              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Manage
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-12" />)}</div>
          ) : integrations.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              <Plug2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>No active integrations</p>
              <Button size="sm" variant="link" onClick={() => navigate("/integrations")}>
                Browse integrations <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {integrations.slice(0, 5).map((bp: any) => (
                <div key={bp.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{bp.name}</span>
                      <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">Active</Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {bp.description?.slice(0, 60) || "Integration blueprint"}
                    </div>
                  </div>
                </div>
              ))}
              {integrations.length > 5 && (
                <div className="pt-2 text-center">
                  <Button size="sm" variant="link" onClick={() => navigate("/integrations")}>
                    View all {integrations.length} integrations <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Documentation */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">API Documentation</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <p className="text-muted-foreground">
            Use webhooks for inbound data ingestion and integration blueprints for outbound API calls.
            All endpoints are authenticated and rate-limited.
          </p>
          <div className="bg-muted/30 rounded-lg p-3 font-mono text-xs space-y-1">
            <p className="text-muted-foreground"># Inbound webhook example</p>
            <p>curl -X POST https://your-domain/api/webhooks/ingest \</p>
            <p className="pl-4">-H "X-Webhook-Secret: your_secret" \</p>
            <p className="pl-4">-d '{"{\"event\": \"client.updated\"}"}'</p>
          </div>
          <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => navigate("/api-docs")}>
            View full API documentation →
          </Button>
        </CardContent>
      </Card>
    </div>
    </Shell>
  );
}
