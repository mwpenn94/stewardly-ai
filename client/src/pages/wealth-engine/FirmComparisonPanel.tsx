/**
 * FirmComparisonPanel — Total benefits vs total costs comparison across firms.
 *
 * Backend data shapes (from firmComparisonEngine.ts):
 *   generateFirmComparison → FirmComparisonResult {
 *     clientProfile, firms: FirmProfile[], strategyComparisons: StrategyComparison[],
 *     componentComparisons: ComponentComparison[], recommendation, wealthbridgeAdvantage
 *   }
 *   FirmProfile has: category, label, description, color, costs{}, benefits{}, capabilities{}, metrics{}
 *   getWealthBridgeAdvantage → { totalSavingsVsAverage, totalBenefitVsAverage, uniqueCapabilities[],
 *     clientTestimonialThemes[], totalCostSavings10Year, totalBenefitGain10Year, netAdvantage10Year }
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Loader2, BarChart3, DollarSign, TrendingUp, CheckCircle2, XCircle,
  Building2, Zap, AlertTriangle
} from "lucide-react";
import { fmt } from '@/lib/format';
export default function FirmComparisonPanel() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("firms");
  const [clientId, setClientId] = useState("");
  const cid = parseInt(clientId) || 0;

  const firmsQ = trpc.planningHierarchy.generateFirmComparison.useQuery(
    { clientId: cid },
    { enabled: !!user && cid > 0, retry: false }
  );
  const advantageQ = trpc.planningHierarchy.getWealthBridgeAdvantage.useQuery(
    { clientId: cid },
    { enabled: !!user && cid > 0 && activeTab === "advantage", retry: false }
  );

  if (!user) {
    return (
      <div className="space-y-6 p-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-accent" /> Firm & Strategy Comparison
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Sign in to access firm comparison analysis.</p>
        </div>
        <Card className="bg-card/60 border-accent/10">
          <CardContent className="p-8 text-center">
            <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">Authentication Required</p>
            <p className="text-xs text-muted-foreground mt-1">This feature requires sign-in to access client data.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const data = firmsQ.data;

  return (
    <div className="space-y-6 p-4">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-accent" /> Firm & Strategy Comparison
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Compare total benefits vs total costs across firm categories, strategy offerings, and WealthBridge advantage.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Input
          placeholder="Enter Client ID"
          value={clientId}
          onChange={e => setClientId(e.target.value)}
          className="w-48 h-8 text-xs"
        />
        {firmsQ.isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        {firmsQ.isError && <span className="text-xs text-red-400">Error: {firmsQ.error?.message}</span>}
      </div>

      {data && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap gap-1">
            <TabsTrigger value="firms" className="gap-1 text-xs"><Building2 className="w-3 h-3" /> Firm Types</TabsTrigger>
            <TabsTrigger value="strategies" className="gap-1 text-xs"><DollarSign className="w-3 h-3" /> Strategy Comparison</TabsTrigger>
            <TabsTrigger value="advantage" className="gap-1 text-xs"><Zap className="w-3 h-3" /> WealthBridge Advantage</TabsTrigger>
          </TabsList>

          {/* ── FIRM TYPES TAB ── */}
          <TabsContent value="firms" className="space-y-4">
            {/* Summary Table */}
            <Card className="bg-card/60 border-accent/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Firm Category Comparison</CardTitle>
                <CardDescription className="text-[11px]">Total benefits, costs, and net value across firm types</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left p-1.5 font-medium">Firm Type</th>
                        <th className="text-center p-1.5 font-medium">Annual Benefits</th>
                        <th className="text-center p-1.5 font-medium">Annual Costs</th>
                        <th className="text-center p-1.5 font-medium">Net Value</th>
                        <th className="text-center p-1.5 font-medium">ROI</th>
                        <th className="text-center p-1.5 font-medium">Fiduciary</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.firms.map((f: any) => (
                        <tr key={f.category} className={`border-b border-border/20 ${f.category === "wealthbridge" || f.category === "wealthbridge_premium" ? "bg-accent/5" : ""}`}>
                          <td className="p-1.5">
                            <div className="flex items-center gap-1">
                              {(f.category === "wealthbridge" || f.category === "wealthbridge_premium") && <Zap className="w-3 h-3 text-accent" />}
                              <span className={(f.category === "wealthbridge" || f.category === "wealthbridge_premium") ? "font-semibold text-accent" : ""}>{f.label}</span>
                            </div>
                          </td>
                          <td className="p-1.5 text-center text-emerald-400">{fmt(f.benefits?.totalAnnualBenefit ?? 0)}</td>
                          <td className="p-1.5 text-center text-red-400">{fmt(f.costs?.totalAnnualCost ?? 0)}</td>
                          <td className="p-1.5 text-center font-semibold">
                            <span className={(f.metrics?.netValueAdd ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}>
                              {fmt(f.metrics?.netValueAdd ?? 0)}
                            </span>
                          </td>
                          <td className="p-1.5 text-center">{((f.metrics?.roi ?? 0) * 100).toFixed(0)}%</td>
                          <td className="p-1.5 text-center">
                            {f.capabilities?.fiduciary ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mx-auto" /> : <XCircle className="w-3.5 h-3.5 text-muted-foreground mx-auto" />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Recommendation */}
            {data.recommendation && (
              <Card className="bg-card/60 border-accent/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1"><TrendingUp className="w-4 h-4 text-accent" /> Recommendation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center mb-3">
                    <div className="rounded bg-background/50 p-2">
                      <p className="text-[10px] text-muted-foreground">Best Overall</p>
                      <p className="text-xs font-bold text-accent capitalize">{data.recommendation.bestOverall?.replace(/_/g, " ")}</p>
                    </div>
                    <div className="rounded bg-background/50 p-2">
                      <p className="text-[10px] text-muted-foreground">Best Value</p>
                      <p className="text-xs font-bold capitalize">{data.recommendation.bestValue?.replace(/_/g, " ")}</p>
                    </div>
                    <div className="rounded bg-background/50 p-2">
                      <p className="text-[10px] text-muted-foreground">Best Service</p>
                      <p className="text-xs font-bold capitalize">{data.recommendation.bestService?.replace(/_/g, " ")}</p>
                    </div>
                    <div className="rounded bg-background/50 p-2">
                      <p className="text-[10px] text-muted-foreground">Best for Goals</p>
                      <p className="text-xs font-bold capitalize">{data.recommendation.bestForGoals?.replace(/_/g, " ")}</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{data.recommendation.rationale}</p>
                </CardContent>
              </Card>
            )}

            {/* Detailed Firm Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.firms.map((f: any) => {
                const isWB = f.category === "wealthbridge" || f.category === "wealthbridge_premium";
                return (
                  <Card key={f.category} className={`bg-card/60 ${isWB ? "border-accent/30" : "border-accent/10"}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-1">
                          {isWB && <Zap className="w-3.5 h-3.5 text-accent" />}
                          {f.label}
                        </CardTitle>
                        <Badge variant={f.capabilities?.fiduciary ? "default" : "outline"} className="text-[9px]">
                          {f.capabilities?.fiduciary ? "Fiduciary" : "Suitability"}
                        </Badge>
                      </div>
                      <CardDescription className="text-[10px]">{f.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                        <div className="rounded bg-background/50 p-1.5">
                          <p className="text-muted-foreground">Annual Benefit</p>
                          <p className="font-semibold text-emerald-400">{fmt(f.benefits?.totalAnnualBenefit ?? 0)}</p>
                        </div>
                        <div className="rounded bg-background/50 p-1.5">
                          <p className="text-muted-foreground">Annual Cost</p>
                          <p className="font-semibold text-red-400">{fmt(f.costs?.totalAnnualCost ?? 0)}</p>
                        </div>
                        <div className="rounded bg-background/50 p-1.5">
                          <p className="text-muted-foreground">10yr Net</p>
                          <p className="font-semibold">{fmt((f.benefits?.totalBenefitOver10Years ?? 0) - (f.costs?.totalCostOver10Years ?? 0))}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(f.capabilities ?? {}).filter(([_, v]) => v).map(([cap]) => (
                          <Badge key={cap} variant="outline" className="text-[8px] capitalize">{cap.replace(/([A-Z])/g, " $1").trim()}</Badge>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div><span className="text-muted-foreground">Client Satisfaction:</span> <span className="font-semibold">{f.metrics?.clientSatisfaction}/10</span></div>
                        <div><span className="text-muted-foreground">Retention:</span> <span className="font-semibold">{f.metrics?.retentionRate}%</span></div>
                        <div><span className="text-muted-foreground">Break-Even:</span> <span className="font-semibold">{f.metrics?.breakEvenMonths} months</span></div>
                        <div><span className="text-muted-foreground">Advisor Ratio:</span> <span className="font-semibold">1:{f.metrics?.advisorToClientRatio}</span></div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* ── STRATEGY COMPARISON TAB ── */}
          <TabsContent value="strategies" className="space-y-4">
            {data.strategyComparisons && data.strategyComparisons.length > 0 ? (
              <div className="space-y-4">
                <Card className="bg-card/60 border-accent/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Strategy Comparison Across Firms</CardTitle>
                    <CardDescription className="text-[11px]">How each strategy performs across different firm types</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {data.strategyComparisons.map((sc: any, i: number) => (
                        <div key={i} className="rounded-lg bg-background/50 p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium">{sc.strategyName}</span>
                            <div className="flex items-center gap-2 text-[10px]">
                              <Badge variant="outline" className="text-[8px] border-emerald-400 text-emerald-400">Best: {sc.bestFirm?.replace(/_/g, " ")}</Badge>
                              <Badge variant="outline" className="text-[8px] border-red-400 text-red-400">Worst: {sc.worstFirm?.replace(/_/g, " ")}</Badge>
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground mb-2">{sc.description}</p>
                          <div className="overflow-x-auto">
                            <table className="w-full text-[10px]">
                              <thead>
                                <tr className="border-b border-border/30">
                                  <th className="text-left p-1 font-medium">Firm</th>
                                  <th className="text-center p-1 font-medium">Available</th>
                                  <th className="text-center p-1 font-medium">Cost</th>
                                  <th className="text-center p-1 font-medium">Benefit</th>
                                  <th className="text-center p-1 font-medium">Net Value</th>
                                  <th className="text-center p-1 font-medium">Quality</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(sc.firms ?? []).map((firm: any, j: number) => (
                                  <tr key={j} className="border-b border-border/10">
                                    <td className="p-1 capitalize">{firm.firmCategory?.replace(/_/g, " ")}</td>
                                    <td className="p-1 text-center">
                                      {firm.available ? <CheckCircle2 className="w-3 h-3 text-emerald-400 mx-auto" /> : <XCircle className="w-3 h-3 text-muted-foreground mx-auto" />}
                                    </td>
                                    <td className="p-1 text-center text-red-400">{fmt(firm.cost)}</td>
                                    <td className="p-1 text-center text-emerald-400">{fmt(firm.benefit)}</td>
                                    <td className="p-1 text-center font-semibold">
                                      <span className={firm.netValue >= 0 ? "text-emerald-400" : "text-red-400"}>{fmt(firm.netValue)}</span>
                                    </td>
                                    <td className="p-1 text-center">
                                      <Badge variant="outline" className={`text-[7px] ${
                                        firm.quality === "excellent" ? "border-emerald-400 text-emerald-400" :
                                        firm.quality === "good" ? "border-blue-400 text-blue-400" :
                                        firm.quality === "adequate" ? "border-amber-400 text-amber-400" :
                                        "border-muted-foreground text-muted-foreground"
                                      }`}>{firm.quality}</Badge>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="bg-card/60 border-accent/10">
                <CardContent className="p-6 text-center">
                  <DollarSign className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No strategy comparisons available.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── WEALTHBRIDGE ADVANTAGE TAB ── */}
          <TabsContent value="advantage" className="space-y-4">
            {advantageQ.isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Computing advantage...</div>
            ) : advantageQ.isError ? (
              <Card className="bg-card/60 border-red-500/20"><CardContent className="p-4 text-center">
                <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
                <p className="text-sm text-red-400">Failed to compute advantage</p>
                <p className="text-xs text-muted-foreground mt-1">{advantageQ.error?.message}</p>
              </CardContent></Card>
            ) : advantageQ.data ? (
              <div className="space-y-4">
                <Card className="bg-card/60 border-accent/20">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-accent" />
                      <CardTitle className="text-base">The WealthBridge Advantage</CardTitle>
                    </div>
                    <CardDescription className="text-[11px]">
                      How WealthBridge AI's integrated platform compares to the industry average
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                      <div className="rounded bg-background/50 p-3">
                        <p className="text-[10px] text-muted-foreground">Annual Cost Savings vs Average</p>
                        <p className="text-xl font-bold text-emerald-400">{fmt(advantageQ.data.totalSavingsVsAverage)}</p>
                      </div>
                      <div className="rounded bg-background/50 p-3">
                        <p className="text-[10px] text-muted-foreground">Annual Benefit vs Average</p>
                        <p className="text-xl font-bold text-accent">{fmt(advantageQ.data.totalBenefitVsAverage)}</p>
                      </div>
                      <div className="rounded bg-background/50 p-3">
                        <p className="text-[10px] text-muted-foreground">10-Year Net Advantage</p>
                        <p className="text-xl font-bold text-emerald-400">{fmt(advantageQ.data.netAdvantage10Year)}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="rounded bg-background/50 p-2">
                        <p className="text-[10px] text-muted-foreground">10-Year Cost Savings</p>
                        <p className="text-lg font-bold">{fmt(advantageQ.data.totalCostSavings10Year)}</p>
                      </div>
                      <div className="rounded bg-background/50 p-2">
                        <p className="text-[10px] text-muted-foreground">10-Year Benefit Gain</p>
                        <p className="text-lg font-bold">{fmt(advantageQ.data.totalBenefitGain10Year)}</p>
                      </div>
                    </div>

                    {/* Unique Capabilities */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium">Unique Capabilities</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                        {(advantageQ.data.uniqueCapabilities ?? []).map((cap: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 rounded bg-background/50 p-2 text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" />
                            <span>{cap}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Client Testimonial Themes */}
                    {advantageQ.data.clientTestimonialThemes && advantageQ.data.clientTestimonialThemes.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium">Client Testimonial Themes</p>
                        <div className="flex flex-wrap gap-1">
                          {advantageQ.data.clientTestimonialThemes.map((theme: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-[9px]">{theme}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </TabsContent>
        </Tabs>
      )}

      {!data && cid > 0 && !firmsQ.isLoading && !firmsQ.isError && (
        <Card className="bg-card/60 border-accent/10">
          <CardContent className="p-6 text-center">
            <Building2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No comparison data found for Client #{cid}.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
