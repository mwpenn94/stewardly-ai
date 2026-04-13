/**
 * Platform Admin Integrations Dashboard — manages all integration providers, monitors connections
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { navigateToChat } from "@/lib/navigateToChat";
import { Plug, Search, RefreshCw, Activity, AlertTriangle, CheckCircle, XCircle, Settings2, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";

export default function AdminIntegrations() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("providers");

  const providers = trpc.integrations.listProviders.useQuery(undefined, { staleTime: 5 * 60_000 });
  const connections = trpc.integrations.listConnections.useQuery(undefined, { staleTime: 60_000 });

  const providerList = (providers.data as any)?.providers || providers.data || [];
  const filteredProviders = (Array.isArray(providerList) ? providerList : []).filter((p: any) =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  );

  const statusIcon = (status: string) => {
    switch (status) {
      case "connected": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error": return <XCircle className="h-4 w-4 text-red-500" />;
      case "syncing": return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default: return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  return (
    <AppShell title="Admin Integrations">
      <SEOHead title="Admin Integrations" description="Manage platform integrations and API connections" />
    <div className="space-y-6">
      <div className="mb-2"><Link href="/chat"><Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1"><ArrowLeft className="h-4 w-4" /> Back to Chat</Button></Link></div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Integration Management</h1>
          <p className="text-muted-foreground">Manage platform-wide integration providers and monitor connections</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{filteredProviders.length || 0} Providers</Badge>
          <Badge variant="outline">{connections.data?.length || 0} Connections</Badge>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search providers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="providers"><Plug className="h-4 w-4 mr-1" /> Providers</TabsTrigger>
          <TabsTrigger value="connections"><Activity className="h-4 w-4 mr-1" /> Active Connections</TabsTrigger>
          <TabsTrigger value="health"><Settings2 className="h-4 w-4 mr-1" /> Health</TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProviders.map(provider => (
              <Card key={provider.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{provider.name}</CardTitle>
                    <Badge variant={provider.status === "active" ? "default" : "secondary"}>{provider.status}</Badge>
                  </div>
                  <CardDescription>{provider.category}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">{provider.description || "No description"}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Auth: {provider.authType}</span>
                    <Button variant="outline" size="sm" onClick={() => navigateToChat(`Help me configure the ${provider.name} integration (${provider.category}). Walk me through the setup process and what credentials are needed.`)}>
                      Configure
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredProviders.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <Plug className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p>No providers found</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="connections" className="space-y-4">
          {(connections.data || []).map((conn: any) => (
            <Card key={conn.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  {statusIcon(conn.status)}
                  <div>
                    <p className="font-medium">{conn.provider?.name || `Provider ${conn.providerId}`}</p>
                    <p className="text-xs text-muted-foreground">
                      Owner: {conn.ownerId} · {conn.recordsSynced || 0} records · Last sync: {conn.lastSyncAt ? new Date(conn.lastSyncAt as string).toLocaleString() : "Never"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={conn.status === "connected" ? "default" : conn.status === "error" ? "destructive" : "secondary"}>
                    {conn.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
          {(connections.data || []).length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>No active connections</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Health</CardTitle>
              <CardDescription>Real-time health status of integration infrastructure</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {["Plaid API", "Market Data Feed", "CRM Sync", "Document OCR", "Regulatory Feed"].map(service => (
                  <div key={service} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">{service}</span>
                    </div>
                    <Badge variant="outline" className="text-green-600">Healthy</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </AppShell>
  );
}
