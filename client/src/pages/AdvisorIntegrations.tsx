/**
 * Advisor Integrations Settings — personal integration connections for advisors
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { navigateToChat } from "@/lib/navigateToChat";
import { Plug, Link2, Unlink, RefreshCw, CheckCircle, XCircle, Clock, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";

export default function AdvisorIntegrations() {
  const [tab, setTab] = useState("my-connections");

  const providers = trpc.integrations.listProviders.useQuery(undefined, { staleTime: 5 * 60_000 });
  const connections = trpc.integrations.listConnections.useQuery(undefined, { staleTime: 60_000 });

  const providerList = (providers.data as any)?.providers || providers.data || [];
  const availableProviders = (Array.isArray(providerList) ? providerList : []).filter((p: any) => p.status === "active");
  const myConnections = connections.data || [];

  const statusBadge = (status: string) => {
    switch (status) {
      case "connected": return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" /> Connected</Badge>;
      case "error": return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Error</Badge>;
      case "syncing": return <Badge className="bg-blue-100 text-blue-800"><RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Syncing</Badge>;
      default: return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> {status}</Badge>;
    }
  };

  return (
    <AppShell title="My Integrations">
      <SEOHead title="My Integrations" description="Manage your connected integrations" />
    <div className="space-y-6">
      <div className="mb-2"><Link href="/chat"><Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1"><ArrowLeft className="h-4 w-4" /> Back to Chat</Button></Link></div>
      <div>
        <h1 className="text-2xl font-bold">My Integrations</h1>
        <p className="text-muted-foreground">Connect your accounts to enable real-time data sync and automation</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="my-connections"><Link2 className="h-4 w-4 mr-1" /> My Connections</TabsTrigger>
          <TabsTrigger value="available"><Plug className="h-4 w-4 mr-1" /> Available</TabsTrigger>
        </TabsList>

        <TabsContent value="my-connections" className="space-y-4">
          {myConnections.length > 0 ? myConnections.map((conn: any) => (
            <Card key={conn.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Plug className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{conn.provider?.name || `Provider ${conn.providerId}`}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span>{conn.recordsSynced || 0} records synced</span>
                      <span>Last sync: {conn.lastSyncAt ? new Date(conn.lastSyncAt as string).toLocaleString() : "Never"}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {statusBadge(conn.status)}
                  <Button variant="outline" size="sm" onClick={() => toast.info("Re-syncing data...")}>
                    <RefreshCw className="h-3 w-3 mr-1" /> Sync
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => navigateToChat(`Help me disconnect the ${conn.provider?.name || 'integration'} connection. What data will be affected and what steps are needed?`)}>
                    <Unlink className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )) : (
            <div className="text-center py-16 text-muted-foreground">
              <Plug className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-medium mb-2">No connections yet</h3>
              <p className="text-sm mb-4">Connect your accounts to enable real-time data sync</p>
              <Button onClick={() => setTab("available")}>Browse Available Integrations</Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="available" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableProviders.map(provider => (
              <Card key={provider.id} className="hover:border-primary/50 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{provider.name}</CardTitle>
                    <Badge variant="outline">{provider.category}</Badge>
                  </div>
                  <CardDescription>{provider.description || "Connect to sync data automatically"}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Auth: {provider.authType}</span>
                    <Button size="sm" onClick={() => navigateToChat(`Help me connect ${provider.name} (${provider.category}) to my account. Walk me through the setup process and what permissions are needed.`)}>
                      <Link2 className="h-3 w-3 mr-1" /> Connect
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
    </AppShell>
  );
}
