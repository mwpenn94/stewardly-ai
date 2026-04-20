/**
 * ApiDocumentation.tsx — Interactive API reference for developers & integrators
 *
 * Pass 59. Shows all available tRPC procedures grouped by router,
 * with example payloads, auth requirements, and try-it-out panels.
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search, Code2, Lock, Globe, ChevronDown, ChevronRight,
  Copy, Check, BookOpen, Zap, Shield, Database,
} from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";

interface ApiEndpoint {
  name: string;
  router: string;
  type: "query" | "mutation";
  auth: "public" | "protected" | "admin";
  description: string;
  inputSchema?: string;
  outputExample?: string;
  tags: string[];
}

const API_ENDPOINTS: ApiEndpoint[] = [
  // Auth
  { name: "auth.me", router: "auth", type: "query", auth: "public", description: "Get current authenticated user info", tags: ["auth", "user"] },
  { name: "auth.logout", router: "auth", type: "mutation", auth: "protected", description: "Log out the current user and clear session", tags: ["auth"] },
  // Market
  { name: "market.getQuote", router: "market", type: "query", auth: "protected", description: "Get real-time quote for a single stock symbol", inputSchema: '{ symbol: string }', outputExample: '{ symbol: "AAPL", price: 189.50, change: 2.30, changePercent: 1.23 }', tags: ["market", "stocks"] },
  { name: "market.getQuotes", router: "market", type: "query", auth: "protected", description: "Get quotes for multiple symbols at once", inputSchema: '{ symbols: string[] }', tags: ["market", "stocks", "batch"] },
  { name: "market.searchDataBank", router: "market", type: "query", auth: "protected", description: "Search World Bank DataBank indicators", inputSchema: '{ query: string, country?: string }', tags: ["market", "databank", "world-bank"] },
  // Sharing
  { name: "sharing.shareContent", router: "sharing", type: "mutation", auth: "protected", description: "Share content with a user, org, or role", inputSchema: '{ contentType: string, contentId: string, sharedWithUserId?: number, permissionLevel: "view" | "edit" | "admin" }', tags: ["sharing", "permissions"] },
  { name: "sharing.getShares", router: "sharing", type: "query", auth: "protected", description: "Get all active shares for a piece of content", inputSchema: '{ contentType: string, contentId: string }', tags: ["sharing"] },
  { name: "sharing.revokeShare", router: "sharing", type: "mutation", auth: "protected", description: "Revoke a content share", inputSchema: '{ shareId: number }', tags: ["sharing", "permissions"] },
  { name: "sharing.getMyPermissions", router: "sharing", type: "query", auth: "protected", description: "Get all feature permissions for the current user", tags: ["permissions", "features"] },
  { name: "sharing.getFeatureRegistry", router: "sharing", type: "query", auth: "protected", description: "Get the full feature registry with defaults", tags: ["permissions", "features"] },
  { name: "sharing.getAuditLog", router: "sharing", type: "query", auth: "protected", description: "Get permission and sharing audit trail", inputSchema: '{ actorId?: number, featureId?: string, limit?: number }', tags: ["audit", "permissions"] },
  // Plaid
  { name: "plaid.createLinkToken", router: "plaid", type: "mutation", auth: "protected", description: "Create a Plaid Link token for bank account linking", tags: ["plaid", "banking"] },
  { name: "plaid.exchangePublicToken", router: "plaid", type: "mutation", auth: "protected", description: "Exchange Plaid public token for access token", inputSchema: '{ publicToken: string }', tags: ["plaid", "banking"] },
  { name: "plaid.getAccounts", router: "plaid", type: "query", auth: "protected", description: "Get linked bank accounts", tags: ["plaid", "banking", "accounts"] },
  { name: "plaid.getTransactions", router: "plaid", type: "query", auth: "protected", description: "Get recent transactions from linked accounts", inputSchema: '{ startDate?: string, endDate?: string }', tags: ["plaid", "banking", "transactions"] },
  // Billing
  { name: "billing.getPlans", router: "billing", type: "query", auth: "public", description: "Get available subscription plans and pricing", tags: ["billing", "stripe"] },
  { name: "billing.createCheckout", router: "billing", type: "mutation", auth: "protected", description: "Create a Stripe checkout session", inputSchema: '{ priceId: string }', tags: ["billing", "stripe", "checkout"] },
  { name: "billing.getSubscription", router: "billing", type: "query", auth: "protected", description: "Get current user subscription status", tags: ["billing", "stripe", "subscription"] },
  // Notifications
  { name: "notifications.getAll", router: "notifications", type: "query", auth: "protected", description: "Get all notifications for the current user", inputSchema: '{ limit?: number, unreadOnly?: boolean }', tags: ["notifications"] },
  { name: "notifications.markRead", router: "notifications", type: "mutation", auth: "protected", description: "Mark notifications as read", inputSchema: '{ ids: number[] }', tags: ["notifications"] },
  // Data Pipelines
  { name: "integrations.runPipeline", router: "integrations", type: "mutation", auth: "protected", description: "Manually trigger a data pipeline run", inputSchema: '{ pipelineId: string }', tags: ["integrations", "pipelines"] },
  { name: "integrations.getPipelineHealth", router: "integrations", type: "query", auth: "protected", description: "Get health status of all data pipelines", tags: ["integrations", "pipelines", "health"] },
  // Health Scores
  { name: "healthScores.getScore", router: "healthScores", type: "query", auth: "protected", description: "Get the user's comprehensive financial health score", tags: ["health", "scores", "financial-twin"] },
  // Learning
  { name: "learning.getDueReviews", router: "learning", type: "query", auth: "protected", description: "Get spaced repetition items due for review", tags: ["learning", "srs"] },
  { name: "learning.submitReview", router: "learning", type: "mutation", auth: "protected", description: "Submit a review result for a learning item", inputSchema: '{ itemId: number, quality: number }', tags: ["learning", "srs"] },
  // System
  { name: "system.notifyOwner", router: "system", type: "mutation", auth: "protected", description: "Send a notification to the platform owner", inputSchema: '{ title: string, content: string }', tags: ["system", "notifications"] },
];

const ROUTER_COLORS: Record<string, string> = {
  auth: "bg-blue-500/10 text-blue-400",
  market: "bg-emerald-500/10 text-emerald-400",
  sharing: "bg-purple-500/10 text-purple-400",
  plaid: "bg-cyan-500/10 text-cyan-400",
  billing: "bg-amber-500/10 text-amber-400",
  notifications: "bg-rose-500/10 text-rose-400",
  integrations: "bg-orange-500/10 text-orange-400",
  healthScores: "bg-teal-500/10 text-teal-400",
  learning: "bg-indigo-500/10 text-indigo-400",
  system: "bg-gray-500/10 text-gray-400",
};

export default function ApiDocumentation() {

  const [search, setSearch] = useState("");
  const [filterRouter, setFilterRouter] = useState("all");
  const [filterAuth, setFilterAuth] = useState("all");
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);

  const routers = useMemo(() => {
    const set = new Set(API_ENDPOINTS.map(e => e.router));
    return Array.from(set).sort();
  }, []);

  const filtered = useMemo(() => {
    return API_ENDPOINTS.filter(ep => {
      if (search) {
        const q = search.toLowerCase();
        if (!ep.name.toLowerCase().includes(q) && !ep.description.toLowerCase().includes(q) && !ep.tags.some(t => t.includes(q))) return false;
      }
      if (filterRouter !== "all" && ep.router !== filterRouter) return false;
      if (filterAuth !== "all" && ep.auth !== filterAuth) return false;
      return true;
    });
  }, [search, filterRouter, filterAuth]);

  const grouped = useMemo(() => {
    const groups: Record<string, ApiEndpoint[]> = {};
    for (const ep of filtered) {
      if (!groups[ep.router]) groups[ep.router] = [];
      groups[ep.router].push(ep);
    }
    return groups;
  }, [filtered]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Code copied to clipboard");
  };

  return (
    <AppShell title="API Documentation">
      <SEOHead title="API Documentation" description="Interactive API reference for WealthBridge AI developers" />
      <div className="min-h-screen">
        <header className="border-b border-border px-4 py-3 flex items-center gap-3 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 50%, oklch(0.65 0.15 250 / 0.15) 0%, transparent 70%)' }} />
          <BookOpen className="w-5 h-5 text-accent relative" />
          <h1 className="text-lg font-semibold relative">API Documentation</h1>
          <Badge variant="outline" className="ml-auto relative">{API_ENDPOINTS.length} endpoints</Badge>
        </header>

        <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <Zap className="h-5 w-5 mx-auto mb-1 text-accent" />
                <div className="text-2xl font-bold">{API_ENDPOINTS.length}</div>
                <p className="text-xs text-muted-foreground">Endpoints</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Database className="h-5 w-5 mx-auto mb-1 text-emerald-400" />
                <div className="text-2xl font-bold">{routers.length}</div>
                <p className="text-xs text-muted-foreground">Routers</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Shield className="h-5 w-5 mx-auto mb-1 text-amber-400" />
                <div className="text-2xl font-bold">{API_ENDPOINTS.filter(e => e.auth === "protected").length}</div>
                <p className="text-xs text-muted-foreground">Protected</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Globe className="h-5 w-5 mx-auto mb-1 text-blue-400" />
                <div className="text-2xl font-bold">{API_ENDPOINTS.filter(e => e.auth === "public").length}</div>
                <p className="text-xs text-muted-foreground">Public</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search endpoints, tags..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={filterRouter}
              onChange={(e) => setFilterRouter(e.target.value)}
            >
              <option value="all">All Routers</option>
              {routers.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={filterAuth}
              onChange={(e) => setFilterAuth(e.target.value)}
            >
              <option value="all">All Auth</option>
              <option value="public">Public</option>
              <option value="protected">Protected</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {/* Endpoint List */}
          <div className="space-y-6">
            {Object.entries(grouped).map(([router, endpoints]) => (
              <div key={router}>
                <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
                  <Badge className={ROUTER_COLORS[router] ?? "bg-muted text-muted-foreground"}>{router}</Badge>
                  <span>{endpoints.length} endpoints</span>
                </h2>
                <div className="space-y-2">
                  {endpoints.map((ep) => {
                    const isExpanded = expandedEndpoint === ep.name;
                    return (
                      <Card key={ep.name} className="transition-all hover:border-accent/30">
                        <CardContent className="p-0">
                          <button type="button"
                            className="w-full text-left p-4 flex items-center gap-3"
                            onClick={() => setExpandedEndpoint(isExpanded ? null : ep.name)}
                          >
                            <Badge variant={ep.type === "query" ? "secondary" : "default"} className="text-xs font-mono shrink-0">
                              {ep.type === "query" ? "GET" : "POST"}
                            </Badge>
                            <code className="text-sm font-mono font-medium flex-1 truncate">{ep.name}</code>
                            <div className="flex items-center gap-2 shrink-0">
                              {ep.auth === "protected" ? (
                                <Lock className="h-3.5 w-3.5 text-amber-400" />
                              ) : ep.auth === "admin" ? (
                                <Shield className="h-3.5 w-3.5 text-red-400" />
                              ) : (
                                <Globe className="h-3.5 w-3.5 text-emerald-400" />
                              )}
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-3">
                              <p className="text-sm text-muted-foreground">{ep.description}</p>

                              {ep.inputSchema && (
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground mb-1">Input</p>
                                  <div className="relative">
                                    <pre className="text-xs bg-muted/50 p-3 rounded-lg font-mono overflow-x-auto">{ep.inputSchema}</pre>
                                    <Button
                                      variant="ghost"
                                      size="icon" aria-label="Copy"
                                      className="absolute top-1 right-1 h-6 w-6"
                                      onClick={() => copyToClipboard(ep.inputSchema!)}
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {ep.outputExample && (
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground mb-1">Example Response</p>
                                  <pre className="text-xs bg-muted/50 p-3 rounded-lg font-mono overflow-x-auto">{ep.outputExample}</pre>
                                </div>
                              )}

                              <div>
                                <p className="text-xs font-semibold text-muted-foreground mb-1">Usage</p>
                                <div className="relative">
                                  <pre className="text-xs bg-muted/50 p-3 rounded-lg font-mono overflow-x-auto">
{ep.type === "query"
  ? `const { data } = trpc.${ep.name}.useQuery(${ep.inputSchema ? `${ep.inputSchema}` : ""});`
  : `const mutation = trpc.${ep.name}.useMutation();\nawait mutation.mutateAsync(${ep.inputSchema ? `${ep.inputSchema}` : ""});`}
                                  </pre>
                                  <Button
                                    variant="ghost"
                                    size="icon" aria-label="Copy code"
                                    className="absolute top-1 right-1 h-6 w-6"
                                    onClick={() => copyToClipboard(
                                      ep.type === "query"
                                        ? `const { data } = trpc.${ep.name}.useQuery(${ep.inputSchema ?? ""});`
                                        : `const mutation = trpc.${ep.name}.useMutation();\nawait mutation.mutateAsync(${ep.inputSchema ?? ""});`
                                    )}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-1">
                                {ep.tags.map(tag => (
                                  <Badge key={tag} variant="outline" className="text-xs cursor-pointer" role="button" tabIndex={0} onClick={() => setSearch(tag)} onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (() => setSearch(tag))(); } }}>
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Code2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No endpoints match your search</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            All endpoints use tRPC over HTTP. Protected endpoints require authentication via session cookie.
            Admin endpoints require the admin role.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
