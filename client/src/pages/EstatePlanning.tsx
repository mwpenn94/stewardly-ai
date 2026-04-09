/**
 * EstatePlanning — Estate planning analysis with document checklist,
 * beneficiary review, and estate tax projections.
 */
import { SEOHead } from "@/components/SEOHead";
import { LeadCaptureGate } from "@/components/LeadCaptureGate";
import { FinancialScoreCard } from "@/components/FinancialScoreCard";
import { CalculatorInsight } from "@/components/CalculatorInsight";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, FileText, Users, DollarSign, CheckCircle2, XCircle, Clock, AlertTriangle, Scale } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const DOCUMENTS = [
  { name: "Last Will & Testament", status: "current", lastUpdated: "2024-06-15", attorney: "Smith & Associates" },
  { name: "Revocable Living Trust", status: "current", lastUpdated: "2024-06-15", attorney: "Smith & Associates" },
  { name: "Durable Power of Attorney", status: "outdated", lastUpdated: "2019-03-20", attorney: "Smith & Associates" },
  { name: "Healthcare Directive", status: "outdated", lastUpdated: "2019-03-20", attorney: "Smith & Associates" },
  { name: "HIPAA Authorization", status: "missing", lastUpdated: null, attorney: null },
  { name: "Beneficiary Designations", status: "review", lastUpdated: "2023-01-10", attorney: null },
  { name: "Letter of Intent", status: "missing", lastUpdated: null, attorney: null },
];

const BENEFICIARIES = [
  { name: "Emily Johnson", relationship: "Spouse", allocation: "60%", accounts: ["IRA", "401(k)", "Life Insurance"] },
  { name: "Alex Johnson", relationship: "Child", allocation: "20%", accounts: ["Trust", "529 Plan"] },
  { name: "Maya Johnson", relationship: "Child", allocation: "20%", accounts: ["Trust", "529 Plan"] },
];

const statusIcon = { current: CheckCircle2, outdated: Clock, missing: XCircle, review: AlertTriangle };
const statusColor = { current: "text-emerald-400", outdated: "text-amber-400", missing: "text-red-400", review: "text-amber-400" };
const statusLabel = { current: "Current", outdated: "Needs Update", missing: "Missing", review: "Review Needed" };

export default function EstatePlanning() {
  const [, navigate] = useLocation();

  const currentCount = DOCUMENTS.filter(d => d.status === "current").length;
  const totalDocs = DOCUMENTS.length;

  return (
    <div className="relative container max-w-5xl py-8 space-y-6">
      {/* Warm gold radial glow */}
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 50%, oklch(0.76 0.14 80 / 0.15) 0%, transparent 70%)' }} />
      <SEOHead title="Estate Planning" description="Estate planning document review and beneficiary analysis" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/advisory")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Scale className="h-6 w-6" /> Estate Planning</h1>
            <p className="text-sm text-muted-foreground">Document review, beneficiary analysis, and estate tax projections</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <FinancialScoreCard title="Estate Readiness" value={`${currentCount}/${totalDocs}`} icon={FileText} trend="down" trendValue="5 items need attention" />
        <FinancialScoreCard title="Net Estate" value="$2.8M" icon={DollarSign} />
        <FinancialScoreCard title="Estate Tax Exposure" value="$0" icon={Scale} trend="flat" trendValue="Below exemption" />
        <FinancialScoreCard title="Beneficiaries" value={3} format="number" icon={Users} />
      </div>

      <Tabs defaultValue="documents">
        <TabsList>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="beneficiaries">Beneficiaries</TabsTrigger>
          <TabsTrigger value="projections">Tax Projections</TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {DOCUMENTS.map(doc => {
                  const Icon = statusIcon[doc.status as keyof typeof statusIcon];
                  return (
                    <div key={doc.name} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <Icon className={`h-4 w-4 ${statusColor[doc.status as keyof typeof statusColor]}`} />
                        <div>
                          <p className="text-sm font-medium">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.lastUpdated ? `Updated ${doc.lastUpdated}` : "Not on file"}
                            {doc.attorney && ` • ${doc.attorney}`}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {statusLabel[doc.status as keyof typeof statusLabel]}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="beneficiaries" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <div className="space-y-4">
                {BENEFICIARIES.map(b => (
                  <div key={b.name} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{b.name}</p>
                      <p className="text-xs text-muted-foreground">{b.relationship} • {b.accounts.join(", ")}</p>
                    </div>
                    <Badge variant="outline" className="font-mono">{b.allocation}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <CalculatorInsight
            title="Beneficiary Designation Review"
            summary="Beneficiary designations on IRA and 401(k) were last reviewed in January 2023. Recommend annual review."
            detail="Ensure beneficiary designations align with the updated trust provisions from June 2024. Contingent beneficiaries should be updated to name the revocable trust rather than individuals directly."
            severity="warning"
          />
        </TabsContent>

        <TabsContent value="projections" className="mt-4 space-y-4">
          <LeadCaptureGate
            title="Unlock Estate Tax Projections"
            description="Enter your email to access detailed estate tax projections, sunset scenario modeling, and personalized planning strategies."
            onCapture={(email) => toast.success(`Projections sent to ${email}`)}
          >
            <Card>
              <CardContent className="p-4">
                <p className="text-sm mb-3">Based on current net estate of $2.8M and 2026 federal exemption of $13.61M:</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><p className="text-xs text-muted-foreground">Federal Exemption</p><p className="font-bold">$13.61M</p></div>
                  <div><p className="text-xs text-muted-foreground">Net Estate</p><p className="font-bold">$2.8M</p></div>
                  <div><p className="text-xs text-muted-foreground">Taxable Estate</p><p className="font-bold text-emerald-400">$0</p></div>
                  <div><p className="text-xs text-muted-foreground">Estate Tax</p><p className="font-bold text-emerald-400">$0</p></div>
                </div>
              </CardContent>
            </Card>
            <CalculatorInsight
              title="Sunset Risk: 2026 Exemption Reduction"
              summary="If TCJA provisions sunset, the exemption drops to ~$7M. At projected estate growth of 6%/year, your estate could exceed the reduced exemption by 2032."
              detail="Consider accelerated gifting strategies, irrevocable life insurance trusts (ILITs), or grantor retained annuity trusts (GRATs) to reduce the taxable estate before a potential sunset."
              severity="info"
              actionLabel="Model Sunset Scenarios"
              onAction={() => navigate("/chat")}
            />
          </LeadCaptureGate>
        </TabsContent>
      </Tabs>
    </div>
  );
}
