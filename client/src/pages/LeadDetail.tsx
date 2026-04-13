/**
 * LeadDetail — Detailed view for a single lead.
 * Now wired to `leadPipeline.getLead(id)` tRPC query (G72 closure).
 * Falls back to an empty state when lead is not found or DB unavailable.
 */
import { SEOHead } from "@/components/SEOHead";
import { PropensityGauge } from "@/components/PropensityGauge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Mail, Phone, Calendar, MapPin,
  DollarSign, FileText, MessageSquare, Loader2,
  Building2, Linkedin, User,
} from "lucide-react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  enriched: "Enriched",
  scored: "Scored",
  qualified: "Qualified",
  assigned: "Assigned",
  contacted: "Contacted",
  meeting: "Meeting",
  proposal: "Proposal",
  converted: "Converted",
  disqualified: "Disqualified",
  dormant: "Dormant",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-muted text-muted-foreground",
  enriched: "bg-chart-3/15 text-chart-3",
  scored: "bg-accent/15 text-accent",
  qualified: "bg-emerald-500/15 text-emerald-400",
  assigned: "bg-purple-500/15 text-purple-400",
  contacted: "bg-chart-3/15 text-chart-3",
  meeting: "bg-accent/15 text-accent",
  proposal: "bg-accent/15 text-accent",
  converted: "bg-emerald-500/15 text-emerald-400",
  disqualified: "bg-destructive/15 text-destructive",
  dormant: "bg-muted text-muted-foreground",
};

const TIER_COLORS: Record<string, string> = {
  hot: "bg-destructive/15 text-destructive",
  warm: "bg-accent/15 text-accent",
  cool: "bg-chart-3/15 text-chart-3",
  cold: "bg-muted text-muted-foreground",
};

export default function LeadDetail() {
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const leadId = parseInt(params.id ?? "0", 10);

  const leadQ = trpc.leadPipeline.getLead.useQuery(
    { id: leadId },
    { enabled: leadId > 0, retry: false }
  );
  const updateStatus = trpc.leadPipeline.updateStatus.useMutation({
    onSuccess: () => { toast.success("Status updated"); leadQ.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const lead = leadQ.data;
  const displayName = [lead?.firstName, lead?.lastName].filter(Boolean).join(" ") || `Lead #${leadId}`;
  const propensityPct = lead?.propensityScore ? Math.round(parseFloat(String(lead.propensityScore)) * 100) : 0;
  const enrichment = (lead?.enrichmentData ?? {}) as Record<string, unknown>;

  return (
    <AppShell title="Lead Detail">
    <div className="container max-w-5xl py-6 px-4 sm:py-8 space-y-6">
      <SEOHead title={`Lead: ${displayName}`} description="Lead detail view" />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/leads")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Pipeline
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-heading">{displayName}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              {lead?.status && (
                <Badge className={`text-[10px] ${STATUS_COLORS[lead.status] ?? ""}`}>
                  {STATUS_LABELS[lead.status] ?? lead.status}
                </Badge>
              )}
              {lead?.propensityTier && (
                <Badge className={`text-[10px] ${TIER_COLORS[lead.propensityTier] ?? ""}`}>
                  {lead.propensityTier}
                </Badge>
              )}
              {lead?.targetSegment && (
                <span className="text-xs text-muted-foreground">{lead.targetSegment}</span>
              )}
            </div>
          </div>
        </div>
        {lead && (
          <div className="flex items-center gap-2">
            {lead.emailHash && (
              <Button variant="outline" size="sm" onClick={() => navigate("/chat")}>
                <Mail className="h-3.5 w-3.5 mr-1" /> Email
              </Button>
            )}
            {lead.phoneHash && (
              <Button variant="outline" size="sm" onClick={() => navigate("/chat")}>
                <Phone className="h-3.5 w-3.5 mr-1" /> Call
              </Button>
            )}
            <Button size="sm" onClick={() => navigate("/chat")}>
              <MessageSquare className="h-3.5 w-3.5 mr-1" /> Chat
            </Button>
          </div>
        )}
      </div>

      {/* Loading state */}
      {leadQ.isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading lead...</span>
        </div>
      )}

      {/* Not found state */}
      {!leadQ.isLoading && !lead && (
        <Card>
          <CardContent className="p-8 text-center">
            <User className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground mb-1">
              {leadQ.isError ? "Unable to load lead data" : "Lead not found"}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              {leadQ.isError
                ? "The database may be unavailable. Try refreshing."
                : `No lead with ID ${leadId} exists in the pipeline.`}
            </p>
            <Button variant="outline" size="sm" onClick={() => navigate("/leads")}>
              Back to Pipeline
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Lead data */}
      {lead && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-4">
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="enrichment">Enrichment</TabsTrigger>
                <TabsTrigger value="actions">Actions</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Contact Information</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {lead.firstName && (
                      <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground shrink-0" /> {lead.firstName} {lead.lastName}</div>
                    )}
                    {lead.company && (
                      <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground shrink-0" /> {lead.company}</div>
                    )}
                    {lead.title && (
                      <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-muted-foreground shrink-0" /> {lead.title}</div>
                    )}
                    {(lead.city || lead.state) && (
                      <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground shrink-0" /> {[lead.city, lead.state].filter(Boolean).join(", ")}</div>
                    )}
                    {lead.linkedinUrl && (
                      <div className="flex items-center gap-2">
                        <Linkedin className="h-4 w-4 text-muted-foreground shrink-0" />
                        <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline truncate">
                          LinkedIn Profile
                        </a>
                      </div>
                    )}
                    {lead.emailConsentGranted && (
                      <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground shrink-0" /> Email consent granted</div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Pipeline Info</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Propensity</p>
                      <p className="font-semibold tabular-nums">{propensityPct}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tier</p>
                      <p className="font-semibold capitalize">{lead.propensityTier ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Segment</p>
                      <p className="font-semibold">{lead.targetSegment ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Created</p>
                      <p className="font-semibold">{lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : "—"}</p>
                    </div>
                  </CardContent>
                </Card>

                {(lead.segmentData != null && typeof lead.segmentData === "object" && Object.keys(lead.segmentData as Record<string, unknown>).length > 0) ? (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Segment Data</CardTitle></CardHeader>
                    <CardContent className="text-xs space-y-1">
                      {Object.entries(lead.segmentData as Record<string, unknown>).map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <span className="text-muted-foreground">{k}</span>
                          <span className="font-mono">{String(v)}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ) : null}
              </TabsContent>

              <TabsContent value="enrichment" className="mt-4">
                <Card>
                  <CardContent className="p-4">
                    {Object.keys(enrichment).length > 0 ? (
                      <div className="space-y-2 text-sm">
                        {Object.entries(enrichment).map(([k, v]) => (
                          <div key={k} className="flex justify-between py-1 border-b border-border/30 last:border-0">
                            <span className="text-muted-foreground">{k}</span>
                            <span className="font-mono text-right max-w-[60%] truncate">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">No enrichment data available</p>
                        <p className="text-xs mt-1">Enrichment runs automatically after lead capture</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="actions" className="mt-4 space-y-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Update Status</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(STATUS_LABELS).map(([key, label]) => (
                        <Button
                          key={key}
                          variant={lead.status === key ? "default" : "outline"}
                          size="sm"
                          className="text-xs"
                          disabled={lead.status === key || updateStatus.isPending}
                          onClick={() => updateStatus.mutate({ leadId: lead.id, status: key })}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Compliance</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Email Consent</span>
                      <Badge variant="outline" className={lead.emailConsentGranted ? "text-emerald-400" : "text-muted-foreground"}>
                        {lead.emailConsentGranted ? "Granted" : "Not granted"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Unsubscribed</span>
                      <Badge variant="outline" className={lead.unsubscribed ? "text-destructive" : "text-emerald-400"}>
                        {lead.unsubscribed ? "Yes" : "No"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">PII Deletion Requested</span>
                      <Badge variant="outline" className={lead.piiDeletionRequested ? "text-destructive" : "text-emerald-400"}>
                        {lead.piiDeletionRequested ? "Yes" : "No"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right column — Score & Quick Actions */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 flex flex-col items-center">
                <PropensityGauge score={propensityPct} label="Propensity Score" size="lg" />
                <Badge className={`mt-2 ${STATUS_COLORS[lead.status ?? "new"]}`}>
                  {STATUS_LABELS[lead.status ?? "new"] ?? lead.status}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Quick Actions</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start text-sm" onClick={() => navigate("/chat")}>
                  <MessageSquare className="h-4 w-4 mr-2" /> Start Conversation
                </Button>
                <Button variant="outline" className="w-full justify-start text-sm" onClick={() => navigate("/email-campaigns")}>
                  <Mail className="h-4 w-4 mr-2" /> Email Campaign
                </Button>
                <Button variant="outline" className="w-full justify-start text-sm" onClick={() => navigate("/calculators")}>
                  <DollarSign className="h-4 w-4 mr-2" /> Run Calculator
                </Button>
              </CardContent>
            </Card>

            {lead.assignedAt && (
              <Card>
                <CardContent className="p-4 text-sm">
                  <p className="text-xs text-muted-foreground">Assigned</p>
                  <p className="flex items-center gap-1.5 mt-1">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    {new Date(lead.assignedAt).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
    </AppShell>
  );
}
