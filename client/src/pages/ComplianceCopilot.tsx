import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Shield, FileSearch, Lock, Loader2, Search, AlertTriangle, CheckCircle, Info , ArrowLeft } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/10 text-red-500 border-red-500/20",
  high: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  low: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  info: "bg-muted text-muted-foreground",
};

const SEVERITY_ICON: Record<string, React.ReactNode> = {
  critical: <AlertTriangle className="h-4 w-4 text-red-500" />,
  high: <AlertTriangle className="h-4 w-4 text-orange-500" />,
  medium: <Info className="h-4 w-4 text-yellow-500" />,
  low: <Info className="h-4 w-4 text-blue-500" />,
  info: <CheckCircle className="h-4 w-4 text-muted-foreground" />,
};

export default function ComplianceCopilot({ embedded = false }: { embedded?: boolean } = {}) {
  const { user } = useAuth();
  const [tab, setTab] = useState("audit");
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");

  const auditQ = trpc.complianceCopilot.auditLog.useQuery({ limit: 100 }, { enabled: !!user });
  const privacyQ = trpc.complianceCopilot.privacyLog.useQuery({ limit: 100 }, { enabled: !!user });

  const filterEntries = (entries: any[] | undefined) => {
    if (!entries) return [];
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter((e: any) =>
      (e.action || e.eventType || "").toLowerCase().includes(q) ||
      (e.details || e.description || "").toLowerCase().includes(q) ||
      (e.category || "").toLowerCase().includes(q)
    );
  };

  const renderLogEntry = (entry: any, i: number) => {
    const severity = entry.severity || entry.level || "info";
    const action = entry.action || entry.eventType || "Event";
    const details = entry.details || entry.description || "";
    const ts = entry.timestamp || entry.createdAt;
    const category = entry.category || entry.type || "";

    return (
      <div key={i} className="border rounded-lg p-4 space-y-2 hover:bg-muted/30 transition-colors">
      <SEOHead title="Compliance Copilot" description="AI-powered compliance monitoring and audit" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {SEVERITY_ICON[severity] || SEVERITY_ICON.info}
            <span className="font-medium text-sm">{action}</span>
            {category && <Badge variant="outline" className="text-xs">{category}</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <Badge className={SEVERITY_COLORS[severity] || SEVERITY_COLORS.info}>{severity}</Badge>
            {ts && <span className="text-xs text-muted-foreground">{new Date(ts).toLocaleString()}</span>}
          </div>
        </div>
        {details && <p className="text-sm text-muted-foreground pl-6">{details}</p>}
        {entry.userId && <p className="text-xs text-muted-foreground pl-6">User: {entry.userId}</p>}
      </div>
    );
  };

  const auditEntries = filterEntries(auditQ.data as any[]);
  const privacyEntries = filterEntries(privacyQ.data as any[]);

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <button type="button" onClick={() => navigate("/operations")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1 mb-2">
        <ArrowLeft className="h-4 w-4" /> Back to Operations
      </button>
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8 text-primary" /> Compliance Copilot
        </h1>
        <p className="text-muted-foreground mt-1">
          Monitor compliance audit trails and privacy logs for your practice.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Audit Events", value: (auditQ.data as any[])?.length ?? 0, icon: FileSearch },
          { label: "Privacy Events", value: (privacyQ.data as any[])?.length ?? 0, icon: Lock },
          { label: "Critical", value: ((auditQ.data as any[]) || []).filter((e: any) => e.severity === "critical").length, icon: AlertTriangle },
          { label: "Compliant", value: ((auditQ.data as any[]) || []).filter((e: any) => e.severity === "info" || e.severity === "low").length, icon: CheckCircle },
        ].map((m) => (
          <Card key={m.label}>
            <CardContent className="pt-4 pb-3 text-center">
              <m.icon className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <div className="text-2xl font-bold">{m.value}</div>
              <div className="text-xs text-muted-foreground">{m.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search audit and privacy logs..." className="pl-10" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="audit" className="gap-1"><FileSearch className="h-4 w-4" /> Audit Log ({auditEntries.length})</TabsTrigger>
          <TabsTrigger value="privacy" className="gap-1"><Lock className="h-4 w-4" /> Privacy Log ({privacyEntries.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Audit Trail</CardTitle>
              <CardDescription>All compliance-related events for your account</CardDescription>
            </CardHeader>
            <CardContent>
              {auditQ.isLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : !auditEntries.length ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>{search ? "No matching audit entries." : "No audit events recorded yet."}</p>
                </div>
              ) : (
                <div className="space-y-2">{auditEntries.map(renderLogEntry)}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Privacy Audit Trail</CardTitle>
              <CardDescription>Data access, PII handling, and consent events</CardDescription>
            </CardHeader>
            <CardContent>
              {privacyQ.isLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : !privacyEntries.length ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Lock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>{search ? "No matching privacy entries." : "No privacy events recorded yet."}</p>
                </div>
              ) : (
                <div className="space-y-2">{privacyEntries.map(renderLogEntry)}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
