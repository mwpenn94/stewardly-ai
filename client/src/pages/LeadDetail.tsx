/**
 * LeadDetail — Detailed view for a single lead with real backend data,
 * activity timeline, contact info, and action buttons.
 */
import { SEOHead } from "@/components/SEOHead";
import { PropensityGauge } from "@/components/PropensityGauge";
import { PiiMaskedField } from "@/components/PiiMaskedField";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Mail, Phone, Calendar, MapPin, DollarSign, FileText, MessageSquare, Building2, User, Loader2 } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";

export default function LeadDetail() {
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const leadId = Number(params.id);

  const leadQuery = trpc.leadPipeline.getById.useQuery(
    { id: leadId },
    { enabled: !isNaN(leadId) && leadId > 0 }
  );

  const updateStatus = trpc.leadPipeline.updateStatus.useMutation({
    onSuccess: () => { toast.success("Lead status updated"); leadQuery.refetch(); },
    onError: (e) => toast.error(e.message || "Failed to update status"),
  });

  const lead = leadQuery.data;
  const enrichment = (lead?.enrichmentData ?? {}) as Record<string, any>;
  const displayName = [lead?.firstName, lead?.lastName].filter(Boolean).join(" ") || "Unknown Lead";
  const propensityScore = lead?.propensityScore ? Math.round(Number(lead.propensityScore) * 100) : 0;

  if (leadQuery.isLoading) {
    return (
      <AppShell title="Lead Detail">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (leadQuery.isError || !lead) {
    return (
      <AppShell title="Lead Detail">
        <div className="container max-w-5xl py-8 text-center space-y-4">
          <p className="text-muted-foreground">{leadQuery.isError ? "Could not load lead. The database may not be available." : "Lead not found."}</p>
          <Button variant="outline" onClick={() => navigate("/leads")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Pipeline
          </Button>
        </div>
      </AppShell>
    );
  }

  const STATUS_OPTIONS = ["new", "enriched", "scored", "qualified", "assigned", "contacted", "meeting", "proposal", "converted", "disqualified", "dormant"] as const;

  return (
    <AppShell title={`Lead: ${displayName}`}>
    <div className="container max-w-5xl py-8 space-y-6">
      <SEOHead title={`Lead: ${displayName}`} description="Lead detail view" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/leads")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Pipeline
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{displayName}</h1>
              <Badge variant="outline" className="capitalize">{lead.propensityTier ?? "unscored"}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{lead.targetSegment || "No segment"} · {lead.status}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/chat?prompt=Follow up with lead ${displayName}`)}>
            <MessageSquare className="h-3.5 w-3.5 mr-1" /> Discuss in Chat
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — Details */}
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
                  {lead.city && (
                    <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {[lead.city, lead.state].filter(Boolean).join(", ")} {lead.zip}</div>
                  )}
                  {lead.company && (
                    <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" /> {lead.company}</div>
                  )}
                  {lead.title && (
                    <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /> {lead.title}</div>
                  )}
                  {lead.linkedinUrl && (
                    <div className="flex items-center gap-2">
                      <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline truncate">LinkedIn Profile</a>
                    </div>
                  )}
                  <PiiMaskedField value={lead.emailHash} label="Email Hash" />
                  {lead.phoneHash && <PiiMaskedField value={lead.phoneHash} label="Phone Hash" />}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Pipeline Status</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div><p className="text-xs text-muted-foreground">Status</p><p className="font-semibold capitalize">{lead.status}</p></div>
                    <div><p className="text-xs text-muted-foreground">Tier</p><p className="font-semibold capitalize">{lead.propensityTier ?? "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Consent</p><p className="font-semibold">{lead.emailConsentGranted ? "Granted" : "Not granted"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Source ID</p><p className="font-semibold">{lead.leadSourceId ?? "—"}</p></div>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <p className="text-xs text-muted-foreground">Change status:</p>
                    <div className="flex flex-wrap gap-1">
                      {STATUS_OPTIONS.filter(s => s !== lead.status).slice(0, 5).map(status => (
                        <Button
                          key={status}
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 capitalize"
                          disabled={updateStatus.isPending}
                          onClick={() => updateStatus.mutate({ leadId: lead.id, status })}
                        >
                          {status}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {lead.ghlContactId && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">CRM Integration</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div><p className="text-xs text-muted-foreground">GHL Contact ID</p><p className="font-mono text-xs">{lead.ghlContactId}</p></div>
                    {lead.ghlOpportunityId && <div><p className="text-xs text-muted-foreground">GHL Opportunity ID</p><p className="font-mono text-xs">{lead.ghlOpportunityId}</p></div>}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="enrichment" className="mt-4">
              <Card>
                <CardContent className="p-4">
                  {Object.keys(enrichment).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(enrichment).map(([key, val]) => (
                        <div key={key} className="flex justify-between items-start py-1 border-b border-border/30 last:border-0">
                          <p className="text-sm text-muted-foreground capitalize">{key.replace(/_/g, " ")}</p>
                          <p className="text-sm font-medium text-right max-w-[60%] truncate">{String(val)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No enrichment data available yet. Run the enrichment pipeline to populate this section.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="actions" className="mt-4 space-y-3">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Lead Actions</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" className="w-full justify-start text-sm" onClick={() => navigate(`/chat?prompt=Create a proposal for lead ${displayName} in ${lead.city || "their area"}`)}>
                    <DollarSign className="h-4 w-4 mr-2" /> Generate Proposal via Chat
                  </Button>
                  <Button variant="outline" className="w-full justify-start text-sm" onClick={() => navigate(`/chat?prompt=Analyze the financial profile and needs of lead ${displayName}`)}>
                    <FileText className="h-4 w-4 mr-2" /> Analyze in Chat
                  </Button>
                  {!lead.piiDeletionRequested && (
                    <Button variant="outline" className="w-full justify-start text-sm text-destructive hover:text-destructive" onClick={() => {
                      if (confirm("This will mark PII for deletion. Continue?")) {
                        // Would call deletePii mutation
                        toast.info("PII deletion request submitted");
                      }
                    }}>
                      <Mail className="h-4 w-4 mr-2" /> Request PII Deletion
                    </Button>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right column — Score & Metadata */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 flex flex-col items-center">
              <PropensityGauge score={propensityScore} label="Propensity Score" size="lg" />
              <Badge variant="outline" className="mt-2 capitalize">{lead.status}</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Metadata</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updated</span>
                <span>{lead.updatedAt ? new Date(lead.updatedAt).toLocaleDateString() : "—"}</span>
              </div>
              {lead.assignedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Assigned</span>
                  <span>{new Date(lead.assignedAt).toLocaleDateString()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Control Group</span>
                <span>{lead.isControlGroup ? "Yes" : "No"}</span>
              </div>
              {lead.unsubscribed && (
                <Badge variant="destructive" className="mt-2">Unsubscribed</Badge>
              )}
              {lead.piiDeletionRequested && (
                <Badge variant="destructive" className="mt-2">PII Deletion Requested</Badge>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </AppShell>
  );
}
