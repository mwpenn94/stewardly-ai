/**
 * MedicareAnalysis — Medicare enrollment guidance and plan comparison.
 * Shows IRMAA brackets, Part D analysis, and Medigap vs Advantage comparison.
 */
import { SEOHead } from "@/components/SEOHead";
import { FinancialScoreCard } from "@/components/FinancialScoreCard";
import { CalculatorInsight } from "@/components/CalculatorInsight";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Heart, DollarSign, Calendar, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const IRMAA_BRACKETS = [
  { magi: "≤ $103,000", partB: "$174.70", partD: "$0.00", total: "$174.70" },
  { magi: "$103,001 – $129,000", partB: "$244.60", partD: "$12.90", total: "$257.50" },
  { magi: "$129,001 – $161,000", partB: "$349.40", partD: "$33.30", total: "$382.70" },
  { magi: "$161,001 – $193,000", partB: "$454.20", partD: "$53.80", total: "$508.00" },
  { magi: "$193,001 – $500,000", partB: "$559.00", partD: "$74.20", total: "$633.20" },
  { magi: "> $500,000", partB: "$594.00", partD: "$81.00", total: "$675.00" },
];

export default function MedicareAnalysis() {
  const [, navigate] = useLocation();

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <SEOHead title="Medicare Analysis" description="Medicare enrollment guidance and plan comparison" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/advisory")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Heart className="h-6 w-6" /> Medicare Analysis</h1>
            <p className="text-sm text-muted-foreground">Enrollment guidance, IRMAA analysis, and plan comparison</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <FinancialScoreCard title="Projected IRMAA" value="$257.50/mo" icon={DollarSign} trend="up" trendValue="Bracket 2" />
        <FinancialScoreCard title="Enrollment Window" value="Oct 15 – Dec 7" icon={Calendar} />
        <FinancialScoreCard title="Part D Coverage" value="Standard" icon={Heart} />
        <FinancialScoreCard title="Annual Premium" value="$3,090" icon={DollarSign} />
      </div>

      <Tabs defaultValue="irmaa">
        <TabsList>
          <TabsTrigger value="irmaa">IRMAA Brackets</TabsTrigger>
          <TabsTrigger value="comparison">Plan Comparison</TabsTrigger>
          <TabsTrigger value="timeline">Enrollment Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="irmaa" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">2026 IRMAA Brackets (Single Filer)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-xs text-muted-foreground font-medium">MAGI (2024)</th>
                      <th className="text-right py-2 text-xs text-muted-foreground font-medium">Part B</th>
                      <th className="text-right py-2 text-xs text-muted-foreground font-medium">Part D Surcharge</th>
                      <th className="text-right py-2 text-xs text-muted-foreground font-medium">Total/mo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {IRMAA_BRACKETS.map((b, i) => (
                      <tr key={i} className={`border-b border-border/50 ${i === 1 ? "bg-primary/5" : ""}`}>
                        <td className="py-2">{b.magi} {i === 1 && <Badge variant="outline" className="text-[10px] ml-1">You</Badge>}</td>
                        <td className="text-right font-mono">{b.partB}</td>
                        <td className="text-right font-mono">{b.partD}</td>
                        <td className="text-right font-mono font-medium">{b.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          <CalculatorInsight
            title="IRMAA Reduction Opportunity"
            summary="Reducing 2024 MAGI by $4,000 (to below $103,000) would eliminate the IRMAA surcharge, saving $994/year."
            detail="Consider maximizing pre-tax 401(k) contributions, HSA contributions, or charitable QCDs to reduce MAGI below the first IRMAA threshold. A $4,000 reduction saves $82.80/month in combined Part B and Part D surcharges."
            severity="warning"
            actionLabel="Model MAGI Reduction"
            onAction={() => navigate("/chat")}
          />
        </TabsContent>

        <TabsContent value="comparison" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Medicare Advantage (Part C)</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Monthly Premium</span><span>$0 – $50</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Max Out-of-Pocket</span><span>$8,300</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Network</span><span>HMO/PPO</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Drug Coverage</span><span>Usually included</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Extra Benefits</span><span>Dental, vision, hearing</span></div>
                <Badge variant="outline" className="text-xs mt-2">Best for: Budget-conscious, healthy</Badge>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Original Medicare + Medigap</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Monthly Premium</span><span>$150 – $300 (Medigap)</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Max Out-of-Pocket</span><span>Varies by plan</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Network</span><span>Any Medicare provider</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Drug Coverage</span><span>Separate Part D needed</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Extra Benefits</span><span>None (add separately)</span></div>
                <Badge variant="outline" className="text-xs mt-2">Best for: Travel, specialist access</Badge>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <div className="space-y-4">
                {[
                  { date: "3 months before 65th birthday", event: "Initial Enrollment Period begins", status: "upcoming", detail: "Can enroll in Parts A, B, and D" },
                  { date: "Month of 65th birthday", event: "Coverage can begin", status: "upcoming", detail: "Enroll by this date to avoid gaps" },
                  { date: "3 months after 65th birthday", event: "Initial Enrollment Period ends", status: "upcoming", detail: "Late enrollment may incur penalties" },
                  { date: "Oct 15 – Dec 7 (annually)", event: "Open Enrollment Period", status: "recurring", detail: "Switch Advantage plans or add/change Part D" },
                  { date: "Jan 1 – Mar 31 (annually)", event: "Medicare Advantage OEP", status: "recurring", detail: "Switch Advantage plans or return to Original Medicare" },
                ].map((t, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${t.status === "upcoming" ? "bg-primary/20" : "bg-muted/50"}`}>
                        <Clock className="h-3.5 w-3.5" />
                      </div>
                      {i < 4 && <div className="w-px flex-1 bg-border mt-1" />}
                    </div>
                    <div className="pb-3">
                      <p className="text-sm font-medium">{t.event}</p>
                      <p className="text-xs text-muted-foreground">{t.date}</p>
                      <p className="text-xs text-muted-foreground/70 mt-0.5">{t.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
