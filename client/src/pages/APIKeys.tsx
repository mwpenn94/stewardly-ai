/**
 * APIKeys — API key management preview.
 *
 * PLACEHOLDER — pass 67 honesty pass.
 *
 * No api-keys tRPC router or `api_keys` DB table exists yet. The
 * three keys shown below are hardcoded mock data. Create / Copy /
 * Revoke buttons fire toasts only; they do not generate real keys
 * or mutate any backend state. The page is not in the sidebar
 * navigation (only reachable via direct URL) so normal users won't
 * stumble into it.
 */
import { SEOHead } from "@/components/SEOHead";
import { PiiMaskedField } from "@/components/PiiMaskedField";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Key, Plus, Copy, Trash2, Clock, Activity } from "lucide-react";
import HonestPlaceholder from "@/components/HonestPlaceholder";
import { useLocation } from "wouter";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";

const API_KEYS = [
  { id: "key_1", name: "Production CRM Sync", prefix: "sk_live_...a4f2", created: "2026-01-15", lastUsed: "2 min ago", requests: 12450, status: "active" },
  { id: "key_2", name: "Staging Environment", prefix: "sk_test_...b7e1", created: "2026-02-20", lastUsed: "3 days ago", requests: 890, status: "active" },
  { id: "key_3", name: "Old Integration", prefix: "sk_live_...c9d3", created: "2025-08-10", lastUsed: "45 days ago", requests: 5200, status: "revoked" },
];

export default function APIKeys() {
  const [, navigate] = useLocation();

  return (
    <AppShell title="API Keys">
    <div className="container max-w-4xl py-8 space-y-6">
      <SEOHead title="API Keys" description="Manage API keys for third-party integrations" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Key className="h-6 w-6" /> API Keys</h1>
            <p className="text-sm text-muted-foreground">Manage API keys for integrations and automation</p>
          </div>
        </div>
        <Button size="sm" onClick={() => toast.info("API key creation is not yet wired — see REMAINING_ITEMS.md")}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Create Key
        </Button>
      </div>

      <HonestPlaceholder
        willDo="Issue, rotate, and revoke API keys for programmatic access to the platform."
        needed="Add an `api_keys` table + `apiKeys` tRPC router with create / list / revoke procedures and a server-side hash-then-verify flow. The keys below are mock data."
        workingAlternative={{ href: "/integrations", label: "Integrations (connect external services with OAuth)" }}
      />

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {API_KEYS.map(key => (
              <div key={key.id} className="p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{key.name}</span>
                    {key.status === "active" ? (
                      <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-red-400 border-red-500/30">Revoked</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { navigator.clipboard.writeText(key.prefix); toast.success("Key prefix copied"); }}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    {key.status === "active" && (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-300" disabled title="Key revocation requires API management integration">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <PiiMaskedField label="Key" value={key.prefix} />
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Created {key.created}</span>
                  <span className="flex items-center gap-1"><Activity className="h-3 w-3" /> Last used {key.lastUsed}</span>
                  <span>{key.requests.toLocaleString()} requests</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">API Documentation</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <p className="text-muted-foreground">Use your API key to authenticate requests to the Stewardly API.</p>
          <div className="bg-muted/30 rounded-lg p-3 font-mono text-xs">
            <p className="text-muted-foreground"># Example request</p>
            <p>curl -H "Authorization: Bearer sk_live_..." \</p>
            <p className="pl-4">https://api.stewardly.com/v1/clients</p>
          </div>
          <Button variant="link" size="sm" className="p-0 h-auto" disabled title="API documentation requires deployment configuration">
            View full API documentation →
          </Button>
        </CardContent>
      </Card>
    </div>
    </AppShell>
  );
}
