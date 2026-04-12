/**
 * EstatePlanning — Document checklist + beneficiary review + real estate
 * tax projections via calculatorEngine.uweSimulate with estate product +
 * document parsing via estate.parseDocumentOffline.
 */
import { SEOHead } from "@/components/SEOHead";
import { CalculatorInsight } from "@/components/CalculatorInsight";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, FileText, Users, DollarSign, CheckCircle2, XCircle, Clock, AlertTriangle, Scale, Loader2, Upload } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import AppShell from "@/components/AppShell";
import { useState } from "react";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

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

  // Estate tax projection inputs
  const [netWorth, setNetWorth] = useState(2800000);
  const [growthRate, setGrowthRate] = useState(6);
  const [projYears, setProjYears] = useState(20);

  // Document parser
  const [docText, setDocText] = useState("");
  const parseMutation = trpc.estate.parseDocumentOffline.useMutation();

  // UWE estate simulation
  const estateSimMutation = trpc.calculatorEngine.uweSimulate.useMutation();

  function runEstateProjection() {
    const strategy = {
      company: "wealthbridge" as const,
      companyName: "WealthBridge",
      color: "#16A34A",
      profile: { age: 50, income: 150000, netWorth, savings: 0, monthlySavings: 0 },
      products: [{ type: "estate" as const, netWorth, growthRate: growthRate / 100 }],
      features: { holistic: true, taxFree: false, livingBen: false, advisor: true, estate: true, group: false, fiduciary: true, lowFees: false, insurance: false },
      notes: "",
    };
    estateSimMutation.mutate({ strategy, years: projYears });
  }

  const currentCount = DOCUMENTS.filter(d => d.status === "current").length;
  const totalDocs = DOCUMENTS.length;

  return (
    <AppShell title="Estate Planning">
    <div className="relative container max-w-5xl py-8 space-y-6">
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 50%, oklch(0.76 0.14 80 / 0.15) 0%, transparent 70%)' }} />
      <SEOHead title="Estate Planning" description="Estate planning document review and beneficiary analysis" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/calculators")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-heading flex items-center gap-2"><Scale className="h-6 w-6" /> Estate Planning</h1>
            <p className="text-sm text-muted-foreground">Document review, beneficiary analysis, and estate tax projections</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-card/60 border-border/50"><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Estate Readiness</p>
          <p className="text-lg font-semibold">{currentCount}/{totalDocs}</p>
          <p className="text-[10px] text-muted-foreground">{totalDocs - currentCount} items need attention</p>
        </CardContent></Card>
        <Card className="bg-card/60 border-border/50"><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Net Estate</p>
          <p className="text-lg font-semibold">{fmt(netWorth)}</p>
        </CardContent></Card>
        <Card className="bg-card/60 border-border/50"><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">2026 Exemption</p>
          <p className="text-lg font-semibold text-emerald-400">$13.61M</p>
        </CardContent></Card>
        <Card className="bg-card/60 border-border/50"><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Beneficiaries</p>
          <p className="text-lg font-semibold">{BENEFICIARIES.length}</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="documents">
        <TabsList>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="beneficiaries">Beneficiaries</TabsTrigger>
          <TabsTrigger value="projections">Tax Projections</TabsTrigger>
          <TabsTrigger value="parser">Document Parser</TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="mt-4">
          <Card className="bg-card/60 border-border/50">
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

        <TabsContent value="beneficiaries" className="mt-4 space-y-4">
          <Card className="bg-card/60 border-border/50">
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
            detail="Ensure beneficiary designations align with the updated trust provisions from June 2024."
            severity="warning"
          />
        </TabsContent>

        <TabsContent value="projections" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="bg-card/60 border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Estate Tax Calculator</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Net Worth</Label>
                  <Input type="number" value={netWorth} onChange={e => setNetWorth(Number(e.target.value))} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Annual Growth Rate (%)</Label>
                  <Input type="number" value={growthRate} onChange={e => setGrowthRate(Number(e.target.value))} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Projection Years</Label>
                  <Input type="number" value={projYears} onChange={e => setProjYears(Number(e.target.value))} className="h-8 text-sm" />
                </div>
                <Button className="w-full h-9 text-sm" onClick={runEstateProjection} disabled={estateSimMutation.isPending}>
                  {estateSimMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Scale className="w-4 h-4 mr-1" /> Project Estate Tax</>}
                </Button>
              </CardContent>
            </Card>

            <div className="lg:col-span-2">
              {estateSimMutation.data && Array.isArray(estateSimMutation.data) ? (
                <Card className="bg-card/60 border-border/50">
                  <CardContent className="p-4 space-y-3">
                    <p className="text-xs text-muted-foreground/60 uppercase tracking-wider">Estate Value & Tax Savings by Year</p>
                    <div className="space-y-1">
                      {estateSimMutation.data
                        .filter((_: any, i: number) => i % 5 === 4 || i === 0)
                        .map((s: any) => {
                          const detail = s.productDetails?.[0];
                          const estDetails = detail?.details as Record<string, number> | undefined;
                          return (
                            <div key={s.year} className="flex items-center justify-between text-sm py-1 border-b border-border/30 last:border-0">
                              <span className="text-muted-foreground">Year {s.year} (age {s.age})</span>
                              <div className="flex gap-4 text-right">
                                <div>
                                  <span className="text-xs text-muted-foreground block">Estate Value</span>
                                  <span className="font-mono">{fmt(estDetails?.estateValue ?? 0)}</span>
                                </div>
                                <div>
                                  <span className="text-xs text-muted-foreground block">Tax Saving</span>
                                  <span className="font-mono text-emerald-400">{fmt(detail?.taxSaving ?? 0)}</span>
                                </div>
                                <div>
                                  <span className="text-xs text-muted-foreground block">Estate Tax</span>
                                  <span className="font-mono text-red-400">{fmt(estDetails?.estateTax ?? 0)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                    {(() => {
                      const last = estateSimMutation.data[estateSimMutation.data.length - 1];
                      const lastDetail = last?.productDetails?.[0]?.details as Record<string, number> | undefined;
                      return lastDetail ? (
                        <div className="pt-2 grid grid-cols-3 gap-2 text-sm">
                          <div className="p-2 rounded bg-secondary/50">
                            <p className="text-[10px] text-muted-foreground">Final Estate</p>
                            <p className="font-semibold">{fmt(lastDetail.estateValue)}</p>
                          </div>
                          <div className="p-2 rounded bg-secondary/50">
                            <p className="text-[10px] text-muted-foreground">Taxable Above Exemption</p>
                            <p className="font-semibold">{fmt(lastDetail.taxableEstate)}</p>
                          </div>
                          <div className="p-2 rounded bg-red-500/10">
                            <p className="text-[10px] text-muted-foreground">Estate Tax (40%)</p>
                            <p className="font-semibold text-red-400">{fmt(lastDetail.estateTax)}</p>
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </CardContent>
                </Card>
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
                  <Scale className="w-6 h-6 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">Run an estate tax projection</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">See estate growth and tax exposure over time</p>
                </div>
              )}
            </div>
          </div>

          <CalculatorInsight
            title="Sunset Risk: 2026 Exemption Reduction"
            summary="If TCJA provisions sunset, the exemption drops to ~$7M. At projected growth, your estate could exceed the reduced exemption."
            detail="Consider accelerated gifting strategies, ILITs, or GRATs to reduce the taxable estate before a potential sunset."
            severity="info"
            actionLabel="Model Scenarios in Chat"
            onAction={() => navigate("/chat")}
          />
        </TabsContent>

        <TabsContent value="parser" className="mt-4">
          <Card className="bg-card/60 border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Upload className="w-4 h-4" /> Document Parser
              </CardTitle>
              <p className="text-xs text-muted-foreground">Paste estate document text to extract entities (testators, executors, trustees, beneficiaries, governing state)</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                value={docText}
                onChange={e => setDocText(e.target.value)}
                placeholder="Paste your will, trust, or estate planning document text here..."
                className="w-full h-40 rounded-md border border-border bg-background px-3 py-2 text-sm resize-y"
              />
              <Button
                className="w-full h-9 text-sm"
                onClick={() => parseMutation.mutate({ text: docText })}
                disabled={parseMutation.isPending || !docText.trim()}
              >
                {parseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <FileText className="w-4 h-4 mr-1" />}
                Parse Document
              </Button>
              {parseMutation.data && (
                <div className="space-y-2 text-sm">
                  {(parseMutation.data as any).kind && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Document Type</span><Badge variant="outline">{(parseMutation.data as any).kind}</Badge></div>
                  )}
                  {(parseMutation.data as any).governingState && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Governing State</span><span>{(parseMutation.data as any).governingState}</span></div>
                  )}
                  {(parseMutation.data as any).testators?.length > 0 && (
                    <div><span className="text-muted-foreground text-xs">Testators:</span>
                      {(parseMutation.data as any).testators.map((t: any, i: number) => <Badge key={i} variant="outline" className="ml-1">{t.name || t}</Badge>)}
                    </div>
                  )}
                  {(parseMutation.data as any).executors?.length > 0 && (
                    <div><span className="text-muted-foreground text-xs">Executors:</span>
                      {(parseMutation.data as any).executors.map((t: any, i: number) => <Badge key={i} variant="outline" className="ml-1">{t.name || t}</Badge>)}
                    </div>
                  )}
                  {(parseMutation.data as any).trustees?.length > 0 && (
                    <div><span className="text-muted-foreground text-xs">Trustees:</span>
                      {(parseMutation.data as any).trustees.map((t: any, i: number) => <Badge key={i} variant="outline" className="ml-1">{t.name || t}</Badge>)}
                    </div>
                  )}
                  {(parseMutation.data as any).beneficiaries?.length > 0 && (
                    <div><span className="text-muted-foreground text-xs block mb-1">Beneficiaries:</span>
                      {(parseMutation.data as any).beneficiaries.map((b: any, i: number) => (
                        <div key={i} className="flex justify-between py-0.5 border-b border-border/30 last:border-0 text-xs">
                          <span>{b.name || b}</span>
                          {b.share && <span className="text-muted-foreground">{b.share}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-[10px] text-muted-foreground text-center">
        Estate planning information is for illustrative purposes. Consult an estate planning attorney for legal advice.
      </p>
    </div>
    </AppShell>
  );
}
