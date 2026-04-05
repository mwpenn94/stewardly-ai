/**
 * CRMSync — CRM integration dashboard showing sync status, field mappings,
 * conflict resolution, and sync history for Wealthbox/Redtail.
 */
import { useState } from "react";
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle, Clock, Database, ArrowLeftRight, Settings2, History } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const SYNC_HISTORY = [
  { id: 1, time: "2026-04-05 09:30", direction: "pull", records: 45, errors: 0, duration: "12s" },
  { id: 2, time: "2026-04-05 08:00", direction: "push", records: 12, errors: 1, duration: "8s" },
  { id: 3, time: "2026-04-04 18:00", direction: "pull", records: 38, errors: 0, duration: "10s" },
  { id: 4, time: "2026-04-04 12:00", direction: "full", records: 230, errors: 3, duration: "45s" },
];

export default function CRMSync() {
  const [, navigate] = useLocation();
  const [autoSync, setAutoSync] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => { setSyncing(false); toast.success("Sync completed — 45 records updated"); }, 3000);
  };

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <SEOHead title="CRM Sync" description="Manage CRM integration and data synchronization" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/integrations")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">CRM Sync</h1>
            <p className="text-sm text-muted-foreground">Wealthbox & Redtail integration management</p>
          </div>
        </div>
        <Button onClick={handleSync} disabled={syncing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync Now"}
        </Button>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium">Wealthbox</span>
            </div>
            <p className="text-xs text-muted-foreground">Connected • Last sync 30m ago</p>
            <p className="text-lg font-bold mt-1">1,247 contacts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-medium">Redtail</span>
            </div>
            <p className="text-xs text-muted-foreground">Credentials expiring in 5 days</p>
            <p className="text-lg font-bold mt-1">892 contacts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Database className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-medium">Stewardly</span>
            </div>
            <p className="text-xs text-muted-foreground">Primary data store</p>
            <p className="text-lg font-bold mt-1">2,139 total</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings"><Settings2 className="h-3.5 w-3.5 mr-1" /> Settings</TabsTrigger>
          <TabsTrigger value="mappings"><ArrowLeftRight className="h-3.5 w-3.5 mr-1" /> Field Mappings</TabsTrigger>
          <TabsTrigger value="history"><History className="h-3.5 w-3.5 mr-1" /> History</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Auto-sync</p>
                  <p className="text-xs text-muted-foreground">Automatically sync every 30 minutes</p>
                </div>
                <Switch checked={autoSync} onCheckedChange={setAutoSync} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Conflict Resolution</p>
                  <p className="text-xs text-muted-foreground">When records conflict between CRM and Stewardly</p>
                </div>
                <Badge variant="outline">CRM Wins</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Sync Direction</p>
                  <p className="text-xs text-muted-foreground">Bidirectional sync keeps both systems updated</p>
                </div>
                <Badge variant="outline">Bidirectional</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mappings" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <div className="space-y-2">
                {[
                  ["First Name", "first_name", "first_name"],
                  ["Last Name", "last_name", "last_name"],
                  ["Email", "email_address", "email"],
                  ["Phone", "phone_number", "phone"],
                  ["AUM", "custom_aum", "assets_under_management"],
                  ["Risk Profile", "custom_risk", "risk_tolerance"],
                ].map(([label, stewardly, crm]) => (
                  <div key={label} className="flex items-center gap-3 text-sm py-2 border-b border-border/50 last:border-0">
                    <span className="w-32 text-muted-foreground">{label}</span>
                    <Badge variant="outline" className="text-xs font-mono">{stewardly}</Badge>
                    <ArrowLeftRight className="h-3 w-3 text-muted-foreground" />
                    <Badge variant="outline" className="text-xs font-mono">{crm}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <div className="space-y-3">
                {SYNC_HISTORY.map(h => (
                  <div key={h.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm">{h.records} records • {h.direction}</p>
                        <p className="text-xs text-muted-foreground">{h.time} • {h.duration}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {h.errors > 0 ? (
                        <Badge variant="outline" className="text-xs text-amber-400 border-amber-500/30">{h.errors} errors</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-500/30">Clean</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
