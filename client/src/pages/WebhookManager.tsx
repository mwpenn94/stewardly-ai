/**
 * WebhookManager — Webhook endpoint management and delivery logs.
 * Pass 16: Wired "Add Endpoint" to real trpc.webhooks.register mutation.
 */
import { useState } from "react";
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { ArrowLeft, Webhook, Plus, CheckCircle2, XCircle, Clock, RotateCcw, Loader2, Trash2, ToggleLeft, ToggleRight, RefreshCw, Copy } from "lucide-react";
import { ExportDataButton } from "@/components/ExportDataButton";
import { useLocation } from "wouter";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { QueryErrorBanner } from "@/components/QueryErrorBanner";
import { trpc } from "@/lib/trpc";

const RECORD_TYPES = [
  { value: "customer_profile", label: "Customer Profile" },
  { value: "organization", label: "Organization" },
  { value: "product", label: "Product" },
  { value: "market_price", label: "Market Price" },
  { value: "regulatory_update", label: "Regulatory Update" },
  { value: "news_article", label: "News Article" },
  { value: "competitor_intel", label: "Competitor Intel" },
  { value: "document_extract", label: "Document Extract" },
  { value: "entity", label: "Entity" },
  { value: "metric", label: "Metric" },
] as const;

export default function WebhookManager({ embedded = false }: { embedded?: boolean } = {}) {
  const Shell = embedded ? (({ children }: any) => <>{children}</>) as any : AppShell;
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newRecordType, setNewRecordType] = useState<string>("customer_profile");

  // Real data from webhookIngestion router
  const webhooksQ = trpc.webhooks.list.useQuery();
  const eventLogQ = trpc.webhooks.eventLog.useQuery({ limit: 20 });
  const statsQ = trpc.webhooks.stats.useQuery();
  const { data: webhooks, isLoading: loadingHooks } = webhooksQ;
  const { data: eventLog, isLoading: loadingLog } = eventLogQ;
  const { data: stats } = statsQ;

  const registerMut = trpc.webhooks.register.useMutation({
    onSuccess: (result: any) => {
      utils.webhooks.list.invalidate();
      utils.webhooks.stats.invalidate();
      setAddOpen(false);
      setNewName("");
      setNewDescription("");
      const webhookUrl = `${window.location.origin}/api/webhooks/${result.webhookId || result.id}`;
      toast.success(
        <div className="space-y-1">
          <p className="font-medium">Webhook endpoint created</p>
          <p className="text-xs font-mono break-all">{webhookUrl}</p>
          <p className="text-xs text-muted-foreground">Configure this URL in your integration settings</p>
        </div>,
        { duration: 10000 }
      );
    },
    onError: (e) => toast.error("Failed to create webhook: " + e.message),
  });

  const toggleMut = trpc.webhooks.toggle.useMutation({
    onSuccess: () => { utils.webhooks.list.invalidate(); toast.success("Webhook toggled"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.webhooks.delete.useMutation({
    onSuccess: () => { utils.webhooks.list.invalidate(); utils.webhooks.stats.invalidate(); toast.success("Webhook deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const handleRegister = () => {
    if (!newName.trim()) { toast.error("Name is required"); return; }
    registerMut.mutate({
      name: newName.trim(),
      description: newDescription.trim() || undefined,
      defaultRecordType: newRecordType as any,
    });
  };

  const copyUrl = (wh: any) => {
    const url = `${window.location.origin}/api/webhooks/${wh.webhookId || wh.id}`;
    navigator.clipboard.writeText(url).then(() => toast.success("Webhook URL copied"));
  };

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
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Endpoint
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Register Webhook Endpoint</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="wh-name">Name</Label>
                  <Input id="wh-name" placeholder="e.g., GoHighLevel Contacts" value={newName} onChange={e => setNewName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wh-desc">Description (optional)</Label>
                  <Input id="wh-desc" placeholder="e.g., Receives contact updates from GHL" value={newDescription} onChange={e => setNewDescription(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Default Record Type</Label>
                  <Select value={newRecordType} onValueChange={setNewRecordType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RECORD_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">How it works:</p>
                  <p>1. Register the endpoint here to get a unique webhook URL</p>
                  <p>2. Copy the URL and paste it into your integration settings (GoHighLevel, Dripify, Workable, etc.)</p>
                  <p>3. Incoming events will be processed and routed to the lead pipeline automatically</p>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={handleRegister} disabled={registerMut.isPending}>
                  {registerMut.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                  Create Endpoint
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats summary */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Endpoints", value: (stats as any).totalWebhooks ?? webhooks?.length ?? 0 },
            { label: "Active", value: (stats as any).active ?? 0 },
            { label: "Events (24h)", value: (stats as any).eventsLast24h ?? 0 },
            { label: "Success Rate", value: `${(stats as any).successRate ?? 100}%` },
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
              <p className="text-xs mt-1">Click "Add Endpoint" to create your first webhook URL</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {webhooks.map((wh: any) => (
                <div key={wh.id} className="p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{wh.name || wh.url}</span>
                      {wh.active !== false ? (
                        <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">Paused</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" aria-label="Copy URL" className="h-7 w-7" onClick={() => copyUrl(wh)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Toggle" className="h-7 w-7" onClick={() => toggleMut.mutate({ webhookId: String(wh.id), active: wh.active === false })}>
                        {wh.active !== false ? <ToggleRight className="h-4 w-4 text-emerald-400" /> : <ToggleLeft className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Delete" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("Delete this webhook?")) deleteMut.mutate({ webhookId: String(wh.id) }); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs font-mono text-muted-foreground truncate">
                    {window.location.origin}/api/webhooks/{wh.webhookId || wh.id}
                  </p>
                  {wh.events && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
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
              <p className="text-xs mt-1">Events will appear here once your integrations start sending data</p>
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
