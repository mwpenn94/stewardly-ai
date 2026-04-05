/**
 * WebhookManager — Webhook endpoint management and delivery logs.
 */
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Webhook, Plus, CheckCircle2, XCircle, Clock, RotateCcw } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const WEBHOOKS = [
  { id: "wh_1", url: "https://crm.example.com/webhooks/stewardly", events: ["client.created", "client.updated"], status: "active", successRate: 99.2, lastDelivery: "5 min ago" },
  { id: "wh_2", url: "https://slack.com/api/webhooks/T0123/B456", events: ["lead.captured", "meeting.scheduled"], status: "active", successRate: 100, lastDelivery: "2 hours ago" },
  { id: "wh_3", url: "https://old-system.example.com/hook", events: ["report.generated"], status: "failing", successRate: 45.0, lastDelivery: "1 day ago" },
];

const RECENT_DELIVERIES = [
  { id: "del_1", event: "client.updated", webhook: "CRM Sync", status: "success", code: 200, duration: "120ms", time: "5 min ago" },
  { id: "del_2", event: "lead.captured", webhook: "Slack Notify", status: "success", code: 200, duration: "85ms", time: "2 hours ago" },
  { id: "del_3", event: "report.generated", webhook: "Old System", status: "failed", code: 500, duration: "2400ms", time: "1 day ago" },
  { id: "del_4", event: "client.created", webhook: "CRM Sync", status: "success", code: 201, duration: "145ms", time: "1 day ago" },
  { id: "del_5", event: "report.generated", webhook: "Old System", status: "failed", code: 503, duration: "5000ms", time: "2 days ago" },
];

export default function WebhookManager() {
  const [, navigate] = useLocation();

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <SEOHead title="Webhooks" description="Manage webhook endpoints and delivery logs" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Webhook className="h-6 w-6" /> Webhooks</h1>
            <p className="text-sm text-muted-foreground">Manage webhook endpoints and monitor deliveries</p>
          </div>
        </div>
        <Button size="sm" onClick={() => toast.info("Webhook creation coming soon")}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Endpoint
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Endpoints</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {WEBHOOKS.map(wh => (
              <div key={wh.id} className="p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono truncate max-w-xs">{wh.url}</span>
                    {wh.status === "active" ? (
                      <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-red-400 border-red-500/30">Failing</Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{wh.successRate}% success</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {wh.events.map(e => (
                    <Badge key={e} variant="secondary" className="text-[10px] font-mono">{e}</Badge>
                  ))}
                  <span className="text-xs text-muted-foreground ml-2 flex items-center gap-1"><Clock className="h-3 w-3" /> {wh.lastDelivery}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Recent Deliveries</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {RECENT_DELIVERIES.map(d => (
              <div key={d.id} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  {d.status === "success" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400" />
                  )}
                  <div>
                    <p className="text-sm font-mono">{d.event}</p>
                    <p className="text-xs text-muted-foreground">{d.webhook} • {d.time}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={`text-[10px] font-mono ${d.code < 300 ? "text-emerald-400" : "text-red-400"}`}>
                    {d.code}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{d.duration}</span>
                  {d.status === "failed" && (
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => toast.info("Retry coming soon")}>
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
