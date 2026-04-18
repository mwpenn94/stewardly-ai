/**
 * FirmComparisonPanel — Total benefits vs total costs comparison across firms,
 * offerings, and strategy components. Mirrors the original HTML comparison structure.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Loader2, BarChart3, DollarSign, TrendingUp, Shield, CheckCircle2, XCircle, ArrowRight, Building2, Target, Zap } from "lucide-react";

const fmt = (n: number) => {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
};

export default function FirmComparisonPanel() {
  const [activeTab, setActiveTab] = useState("firms");
  const [clientId, setClientId] = useState("");
  const cid = parseInt(clientId) || 0;

  const firmsQ = trpc.planningHierarchy.generateFirmComparison.useQuery(
    { clientId: cid },
    { enabled: cid > 0 }
  );
  const offeringsQ = trpc.planningHierarchy.compareStrategyAcrossFirms.useQuery(
    { clientId: cid },
    { enabled: cid > 0 && activeTab === "offerings" }
  );
  const advantageQ = trpc.planningHierarchy.getWealthBridgeAdvantage.useQuery(
    { clientId: cid },
    { enabled: cid > 0 && activeTab === "advantage" }
  );

  return (
    <div className="space-y-6 p-4">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-accent" /> Firm & Strategy Comparison
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Compare total benefits vs total costs across firm categories, offerings, and strategy components.
          Understand how different firm types serve different client needs.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Input
          placeholder="Enter Client ID (optional)"
          value={clientId}
          onChange={e => setClientId(e.target.value)}
          className="w-48 h-8 text-xs"
        />
        {firmsQ.isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="firms" className="gap-1 text-xs"><Building2 className="w-3 h-3" /> Firm Types</TabsTrigger>
          <TabsTrigger value="offerings" className="gap-1 text-xs"><DollarSign className="w-3 h-3" /> Offerings</TabsTrigger>
          <TabsTrigger value="advantage" className="gap-1 text-xs"><Zap className="w-3 h-3" /> WealthBridge Advantage</TabsTrigger>
        </TabsList>

        {/* ── FIRM TYPES TAB ── */}
        <TabsContent value="firms" className="space-y-4">
          {firmsQ.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading firm comparison...</div>
          ) : firmsQ.data ? (
            <div className="space-y-4">
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
                          <th className="text-center p-1.5 font-medium">Total Benefits</th>
                          <th className="text-center p-1.5 font-medium">Total Costs</th>
                          <th className="text-center p-1.5 font-medium">Net Value</th>
                          <th className="text-center p-1.5 font-medium">Fiduciary</th>
                          <th className="text-center p-1.5 font-medium">Fit Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {firmsQ.data.firms.map(f => (
                          <tr key={f.category} className={`border-b border-border/20 ${f.isWealthBridge ? "bg-accent/5" : ""}`}>
                            <td className="p-1.5">
                              <div className="flex items-center gap-1">
                                {f.isWealthBridge && <Zap className="w-3 h-3 text-accent" />}
                                <span className={f.isWealthBridge ? "font-semibold text-accent" : ""}>{f.category}</span>
                              </div>
                            </td>
                            <td className="p-1.5 text-center text-emerald-400">{fmt(f.totalBenefits)}</td>
                            <td className="p-1.5 text-center text-red-400">{fmt(f.totalCosts)}</td>
                            <td className="p-1.5 text-center font-semibold">
                              <span className={f.netValue >= 0 ? "text-emerald-400" : "text-red-400"}>{fmt(f.netValue)}</span>
                            </td>
                            <td className="p-1.5 text-center">
                              {f.fiduciaryStandard ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mx-auto" /> : <XCircle className="w-3.5 h-3.5 text-muted-foreground mx-auto" />}
                            </td>
                            <td className="p-1.5 text-center">
                              <span className={f.clientFitScore >= 80 ? "text-emerald-400 font-semibold" : f.clientFitScore >= 60 ? "text-amber-400" : "text-muted-foreground"}>
                                {f.clientFitScore}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Detailed Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {firmsQ.data.firms.map(f => (
                  <Card key={f.category} className={`bg-card/60 ${f.isWealthBridge ? "border-accent/30" : "border-accent/10"}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-1">
                          {f.isWealthBridge && <Zap className="w-3.5 h-3.5 text-accent" />}
                          {f.category}
                        </CardTitle>
                        <Badge variant={f.fiduciaryStandard ? "default" : "outline"} className="text-[9px]">
                          {f.fiduciaryStandard ? "Fiduciary" : "Suitability"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div>
                        <p className="text-[10px] font-medium text-emerald-400 mb-1">Benefits</p>
                        {f.benefits.map(b => (
                          <div key={b} className="flex items-start gap-1 text-[10px]">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                            <span>{b}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <p className="text-[10px] font-medium text-red-400 mb-1">Costs & Limitations</p>
                        {f.costs.map(c => (
                          <div key={c} className="flex items-start gap-1 text-[10px]">
                            <XCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                            <span>{c}</span>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center text-[10px] pt-1">
                        <div className="rounded bg-background/50 p-1">
                          <p className="text-muted-foreground">AUM Range</p>
                          <p className="font-semibold">{f.typicalAUMRange}</p>
                        </div>
                        <div className="rounded bg-background/50 p-1">
                          <p className="text-muted-foreground">Fee Model</p>
                          <p className="font-semibold">{f.feeModel}</p>
                        </div>
                        <div className="rounded bg-background/50 p-1">
                          <p className="text-muted-foreground">Specialties</p>
                          <p className="font-semibold">{f.specialties.length}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <Card className="bg-card/60 border-accent/10">
              <CardContent className="p-6 text-center">
                <Building2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Enter a Client ID for personalized firm comparison, or view general comparison.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── OFFERINGS TAB ── */}
        <TabsContent value="offerings" className="space-y-4">
          {offeringsQ.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading offerings...</div>
          ) : offeringsQ.data ? (
            <div className="space-y-4">
              <Card className="bg-card/60 border-accent/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Offering Comparison by Category</CardTitle>
                  <CardDescription className="text-[11px]">Benefits, costs, and value across all offering categories</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {offeringsQ.data.categories.map(cat => (
                      <div key={cat.name} className="rounded-lg bg-background/50 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium">{cat.name}</span>
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className="text-emerald-400">+{fmt(cat.totalBenefitValue)}</span>
                            <span className="text-red-400">-{fmt(cat.totalCostValue)}</span>
                            <span className={`font-semibold ${cat.netValue >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              Net: {fmt(cat.netValue)}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {cat.offerings.map(o => (
                            <div key={o.name} className="rounded bg-card/40 p-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-medium">{o.name}</span>
                                <Badge variant={o.available ? "default" : "outline"} className="text-[8px]">
                                  {o.available ? "Available" : "N/A"}
                                </Badge>
                              </div>
                              <p className="text-[9px] text-muted-foreground mt-0.5">{o.description}</p>
                              <div className="flex items-center justify-between mt-1 text-[9px]">
                                <span className="text-emerald-400">Value: {fmt(o.benefitValue)}</span>
                                <span className="text-red-400">Cost: {fmt(o.costValue)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </TabsContent>

        {/* ── WEALTHBRIDGE ADVANTAGE TAB ── */}
        <TabsContent value="advantage" className="space-y-4">
          {advantageQ.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Computing advantage...</div>
          ) : advantageQ.data ? (
            <div className="space-y-4">
              <Card className="bg-card/60 border-accent/20">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-accent" />
                    <CardTitle className="text-base">The WealthBridge Advantage</CardTitle>
                  </div>
                  <CardDescription className="text-[11px]">
                    How WealthBridge AI's integrated platform compares to traditional advisory models
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                    <div className="rounded bg-background/50 p-2">
                      <p className="text-[10px] text-muted-foreground">Total Benefit</p>
                      <p className="text-lg font-bold text-emerald-400">{fmt(advantageQ.data.totalBenefit)}</p>
                    </div>
                    <div className="rounded bg-background/50 p-2">
                      <p className="text-[10px] text-muted-foreground">Total Cost Savings</p>
                      <p className="text-lg font-bold text-accent">{fmt(advantageQ.data.totalCostSavings)}</p>
                    </div>
                    <div className="rounded bg-background/50 p-2">
                      <p className="text-[10px] text-muted-foreground">Net Advantage</p>
                      <p className="text-lg font-bold text-emerald-400">{fmt(advantageQ.data.netAdvantage)}</p>
                    </div>
                    <div className="rounded bg-background/50 p-2">
                      <p className="text-[10px] text-muted-foreground">Advantage Score</p>
                      <p className="text-lg font-bold text-accent">{advantageQ.data.advantageScore}/100</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium">Key Differentiators</p>
                    {advantageQ.data.differentiators.map((d, i) => (
                      <div key={i} className="flex items-start gap-2 rounded bg-background/50 p-2 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium">{d.area}</p>
                          <p className="text-muted-foreground">{d.description}</p>
                          <p className="text-emerald-400 text-[10px]">Value: {fmt(d.estimatedValue)}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium">Comparison vs Traditional Models</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="border-b border-border/50">
                            <th className="text-left p-1.5 font-medium">Capability</th>
                            <th className="text-center p-1.5 font-medium">Traditional</th>
                            <th className="text-center p-1.5 font-medium text-accent">WealthBridge</th>
                          </tr>
                        </thead>
                        <tbody>
                          {advantageQ.data.comparisons.map(c => (
                            <tr key={c.capability} className="border-b border-border/20">
                              <td className="p-1.5">{c.capability}</td>
                              <td className="p-1.5 text-center text-muted-foreground">{c.traditional}</td>
                              <td className="p-1.5 text-center text-accent font-medium">{c.wealthBridge}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
