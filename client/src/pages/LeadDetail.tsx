/**
 * LeadDetail — Detailed view for a single lead with activity timeline,
 * AI insights, contact info, and action buttons.
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
import { ArrowLeft, Mail, Phone, Calendar, MapPin, DollarSign, FileText, MessageSquare, Clock } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";

const DEMO_LEAD = {
  id: 1, name: "Sarah Johnson", email: "sarah.johnson@example.com", phone: "555-0187",
  address: "123 Wealth Ave, San Francisco, CA 94105", dob: "1985-03-15",
  ssn_last4: "4829", source: "Referral", stage: "qualified", score: 87,
  aum: 1250000, accountType: "Individual", riskTolerance: "Moderate",
  notes: "Interested in retirement planning and estate strategy. Referred by James Wilson.",
  activities: [
    { date: "2026-04-03", type: "call", desc: "Initial discovery call — 30 min" },
    { date: "2026-04-01", type: "email", desc: "Sent financial planning brochure" },
    { date: "2026-03-28", type: "meeting", desc: "Coffee meeting at downtown office" },
    { date: "2026-03-25", type: "note", desc: "Referral received from James Wilson" },
  ],
};

export default function LeadDetail() {
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();

  return (
    <AppShell title="Lead Detail">
    <div className="container max-w-5xl py-8 space-y-6">
      <SEOHead title={`Lead: ${DEMO_LEAD.name}`} description="Lead detail view" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/leads")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Pipeline
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{DEMO_LEAD.name}</h1>
              <VerificationBadge status="verified" label="KYC" />
            </div>
            <p className="text-sm text-muted-foreground">{DEMO_LEAD.source} • {DEMO_LEAD.stage}</p>
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
                  <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {DEMO_LEAD.email}</div>
                  <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {DEMO_LEAD.phone}</div>
                  <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {DEMO_LEAD.address}</div>
                  <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /> DOB: {DEMO_LEAD.dob}</div>
                  <PiiMaskedField value={DEMO_LEAD.ssn_last4} label="SSN" copyable allowReveal />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Financial Profile</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div><p className="text-xs text-muted-foreground">AUM</p><p className="font-semibold">${(DEMO_LEAD.aum / 1000000).toFixed(2)}M</p></div>
                  <div><p className="text-xs text-muted-foreground">Account Type</p><p className="font-semibold">{DEMO_LEAD.accountType}</p></div>
                  <div><p className="text-xs text-muted-foreground">Risk Tolerance</p><p className="font-semibold">{DEMO_LEAD.riskTolerance}</p></div>
                  <div><p className="text-xs text-muted-foreground">Source</p><p className="font-semibold">{DEMO_LEAD.source}</p></div>
                </CardContent>
              </Card>

              <CalculatorInsight
                title="Retirement Gap Analysis"
                summary="Based on current AUM and age, Sarah may have a $340K retirement gap by age 65 under moderate growth assumptions."
                detail="Recommend increasing monthly contributions by $1,200 or shifting 15% allocation to growth equities. A Roth conversion ladder could also improve tax efficiency in retirement."
                severity="warning"
                actionLabel="Run Full Analysis"
                onAction={() => navigate("/chat")}
              />

              {DEMO_LEAD.notes && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
                  <CardContent><p className="text-sm text-muted-foreground">{DEMO_LEAD.notes}</p></CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-4">
                    {DEMO_LEAD.activities.map((a, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center">
                            {a.type === "call" ? <Phone className="h-3.5 w-3.5" /> :
                             a.type === "email" ? <Mail className="h-3.5 w-3.5" /> :
                             a.type === "meeting" ? <Calendar className="h-3.5 w-3.5" /> :
                             <FileText className="h-3.5 w-3.5" />}
                          </div>
                          {i < DEMO_LEAD.activities.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                        </div>
                        <div className="pb-4">
                          <p className="text-sm font-medium">{a.desc}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {a.date}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
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
              <PropensityGauge score={DEMO_LEAD.score} label="Propensity Score" size="lg" />
              <Badge variant="outline" className="mt-2 capitalize">{DEMO_LEAD.stage}</Badge>
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
