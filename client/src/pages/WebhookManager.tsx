/**
 * WebhookManager — Webhook endpoint management and delivery logs.
 */
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Webhook, Plus, CheckCircle2, XCircle, Clock, RotateCcw, Loader2, Trash2, ToggleLeft, ToggleRight, RefreshCw } from "lucide-react";
import { ExportDataButton } from "@/components/ExportDataButton";
import { useLocation } from "wouter";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { QueryErrorBanner } from "@/components/QueryErrorBanner";
import { trpc } from "@/lib/trpc";

export default function WebhookManager({ embedded = false }: { embedded?: boolean } = {}) {
  const Shell = embedded ? (({ children }: any) => <>{children}</>) as any : AppShell;

  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  // Real data from webhookIngestion router
  const webhooksQ = trpc.webhooks.list.useQuery();
  const eventLogQ = trpc.webhooks.eventLog.useQuery({ limit: 20 });
  const statsQ = trpc.webhooks.stats.useQuery();
  const { data: webhooks, isLoading: loadingHooks } = webhooksQ;
  const { data: eventLog, isLoading: loadingLog } = eventLogQ;
  const { data: stats } = statsQ;

  const toggleMut = trpc.webhooks.toggle.useMutation({
    onSuccess: () => { utils.webhooks.list.invalidate(); toast.success("Webhook toggled"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.webhooks.delete.useMutation({
    onSuccess: () => { utils.webhooks.list.invalidate(); toast.success("Webhook deleted"); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Shell title="Webhooks">
    <div className="container max-w-4xl py-8 space-y-6">
      <SEOHead title="Webhooks" description="Manage webhook endpoints and delivery logs" />

      <QueryErrorBanner query={webhooksQ} label="webhooks" />
      <QueryErrorBanner query={eventLogQ} label="event log" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/integrations")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Integrations
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Webhook className="h-6 w-6 text-primary" /> Webhook Manager</h1>
            <p className="text-sm text-muted-foreground">Manage endpoints and monitor delivery health</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportDataButton
            data={(eventLog ?? []) as any[]}
            filename="webhook-deliveries"
            columns={["eventType", "statusCode", "status", "createdAt"]}
          />
          <Button size="sm" onClick={() => toast.info("Webhook registration form coming soon")}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Endpoint
          </Button>
        </div>
      </div>

      {/* Stats summary */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Endpoints", value: stats.total ?? webhooks?.length ?? 0 },
            { label: "Active", value: stats.active ?? 0 },
            { label: "Events (24h)", value: stats.eventsLast24h ?? 0 },
            { label: "Success Rate", value: `${stats.successRate ?? 100}%` },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Endpoints</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loadingHooks ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : !webhooks?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Webhook className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No webhook endpoints configured</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {webhooks.map((wh: any) => (
                <div key={wh.id} className="p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono truncate max-w-xs">{wh.url}</span>
                      {wh.active !== false ? (
                        <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">Paused</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" aria-label="Toggle" className="h-7 w-7" onClick={() => toggleMut.mutate({ id: wh.id })}>
                        {wh.active !== false ? <ToggleRight className="h-4 w-4 text-emerald-400" /> : <ToggleLeft className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Delete" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("Delete this webhook?")) deleteMut.mutate({ id: wh.id }); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {wh.events && (
                    <div className="flex flex-wrap gap-1.5">
                      {(Array.isArray(wh.events) ? wh.events : []).slice(0, 4).map((e: string) => (
                        <Badge key={e} variant="secondary" className="text-[10px] font-mono">{e}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Recent Deliveries</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => utils.webhooks.eventLog.invalidate()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loadingLog ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : !eventLog?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No delivery events yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {eventLog.map((d: any, i: number) => (
                <div key={d.id ?? i} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    {d.status === "success" || d.statusCode === 200 || d.statusCode === 201 ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-400" />
                    )}
                    <div>
                      <p className="text-sm font-mono">{d.eventType ?? d.event ?? "event"}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.createdAt ? new Date(d.createdAt).toLocaleString() : d.time ?? ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {d.statusCode && (
                      <Badge variant="outline" className={`text-[10px] font-mono ${d.statusCode < 300 ? "text-emerald-400" : "text-red-400"}`}>
                        {d.statusCode}
                      </Badge>
                    )}
                    {d.status === "failed" && (
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => toast.info("Retry coming soon")}>
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </Shell>
  );
}
