/**
 * LeadDetail — Detailed view for a single lead with activity timeline,
 * AI insights, contact info, and action buttons.
 *
 * Pass 77: Wired to real leadPipeline.getPipeline data instead of DEMO_LEAD.
 */
import { SEOHead } from "@/components/SEOHead";
import { PropensityGauge } from "@/components/PropensityGauge";
import { VerificationBadge } from "@/components/VerificationBadge";
import { PiiMaskedField } from "@/components/PiiMaskedField";
import { CalculatorInsight } from "@/components/CalculatorInsight";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Mail, Phone, Calendar, MapPin, DollarSign, FileText, MessageSquare, Clock, Loader2 } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw } from "lucide-react";

export default function LeadDetail() {
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const leadId = Number(params.id);

  // Fetch pipeline data and find the specific lead
  const utils = trpc.useUtils();
  const { data: pipeline, isLoading, error } = trpc.leadPipeline.getPipeline.useQuery();
  const lead = useMemo(() => {
    if (!pipeline) return null;
    return pipeline.find((l: any) => l.id === leadId) ?? null;
  }, [pipeline, leadId]);

  const LIFECYCLE_STAGES = ["new","enriched","scored","qualified","assigned","contacted","meeting","proposal","converted","disqualified","dormant"] as const;
  const updateStatus = trpc.leadPipeline.updateStatus.useMutation({
    onSuccess: () => { utils.leadPipeline.getPipeline.invalidate(); toast.success("Status updated"); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <AppShell title="Lead Detail">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (error || !lead) {
    return (
      <AppShell title="Lead Detail">
        <div className="container max-w-5xl py-8 text-center space-y-4">
          <SEOHead title="Lead Not Found" description="Lead detail view" />
          <p className="text-muted-foreground">{error ? "Failed to load lead data." : "Lead not found."}</p>
          <Button variant="outline" onClick={() => navigate("/leads")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Pipeline
          </Button>
        </div>
      </AppShell>
    );
  }

  const name = lead.name ?? "Unknown";
  const email = lead.email ?? "";
  const phone = lead.phone ?? "";
  const source = lead.source ?? "Direct";
  const stage = lead.status ?? lead.stage ?? "new";
  const score = lead.propensityScore ?? lead.score ?? 0;
  const aum = lead.estimatedAum ?? lead.aum ?? 0;
  const notes = lead.notes ?? "";

  return (
    <AppShell title="Lead Detail">
    <div className="container max-w-5xl py-8 space-y-6">
      <SEOHead title={`Lead: ${name}`} description="Lead detail view" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/leads")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Pipeline
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{name}</h1>
              <VerificationBadge status="verified" label="KYC" />
            </div>
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">{source} &bull;</p>
              <Select value={stage} onValueChange={(v) => updateStatus.mutate({ leadId, status: v })}>
                <SelectTrigger className="h-7 w-auto text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIFECYCLE_STAGES.map(s => <SelectItem key={s} value={s}><span className="capitalize">{s}</span></SelectItem>)}
                </SelectContent>
              </Select>
              {updateStatus.isPending && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.info("Email compose coming soon")}>
            <Mail className="h-3.5 w-3.5 mr-1" /> Email
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.info("Call dialer coming soon")}>
            <Phone className="h-3.5 w-3.5 mr-1" /> Call
          </Button>
          <Button size="sm" onClick={() => toast.info("Schedule meeting coming soon")}>
            <Calendar className="h-3.5 w-3.5 mr-1" /> Schedule
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — Details */}
        <div className="lg:col-span-2 space-y-4">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Contact Information</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {email}</div>}
                  {phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {phone}</div>}
                  {lead.city && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {lead.city}{lead.state ? `, ${lead.state}` : ""}</div>}
                  {lead.dateOfBirth && <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /> DOB: {new Date(lead.dateOfBirth).toLocaleDateString()}</div>}
                  {lead.ssnLast4 && <PiiMaskedField value={lead.ssnLast4} label="SSN" copyable allowReveal />}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Financial Profile</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div><p className="text-xs text-muted-foreground">AUM</p><p className="font-semibold">${aum >= 1000000 ? `${(aum / 1000000).toFixed(2)}M` : `${(aum / 1000).toFixed(0)}K`}</p></div>
                  <div><p className="text-xs text-muted-foreground">Account Type</p><p className="font-semibold">{lead.accountType ?? "Individual"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Risk Tolerance</p><p className="font-semibold">{lead.riskTolerance ?? "Moderate"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Source</p><p className="font-semibold">{source}</p></div>
                </CardContent>
              </Card>

              <CalculatorInsight
                title="Retirement Gap Analysis"
                summary={`Based on current AUM of $${aum >= 1000000 ? `${(aum / 1000000).toFixed(1)}M` : `${(aum / 1000).toFixed(0)}K`}, ${name.split(" ")[0]} may benefit from a comprehensive retirement projection.`}
                detail="Recommend running a full retirement analysis to identify potential gaps and optimize contribution strategy."
                severity="info"
                actionLabel="Run Full Analysis"
                onAction={() => navigate("/chat")}
              />

              {notes && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
                  <CardContent><p className="text-sm text-muted-foreground">{notes}</p></CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Activity timeline will populate as interactions are logged.</p>
                  <p className="text-xs mt-1">Lead created {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : "recently"}</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="mt-4">
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No documents attached yet</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => toast.info("Document upload coming soon")}>
                    Upload Document
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right column — Score & Quick Actions */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 flex flex-col items-center">
              <PropensityGauge score={score} label="Propensity Score" size="lg" />
              <Badge variant="outline" className="mt-2 capitalize">{stage}</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Quick Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start text-sm" onClick={() => toast.info("Coming soon")}>
                <MessageSquare className="h-4 w-4 mr-2" /> Send Follow-up
              </Button>
              <Button variant="outline" className="w-full justify-start text-sm" onClick={() => toast.info("Coming soon")}>
                <DollarSign className="h-4 w-4 mr-2" /> Create Proposal
              </Button>
              <Button variant="outline" className="w-full justify-start text-sm" onClick={() => toast.info("Coming soon")}>
                <FileText className="h-4 w-4 mr-2" /> Generate Report
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </AppShell>
  );
}
