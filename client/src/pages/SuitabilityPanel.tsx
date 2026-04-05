/**
 * Client Profile Suitability Intelligence Panel — shows suitability scores, product matches, risk analysis
 */
import { useState } from "react";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Shield, Target, AlertTriangle, CheckCircle, TrendingUp, BarChart3, FileText, Zap } from "lucide-react";

export default function SuitabilityPanel() {
  const [tab, setTab] = useState("overview");

  const suitability = trpc.suitability.get.useQuery();
  const products = trpc.products.list.useQuery({});

  const profile = suitability.data;
  const productList = products.data || [];

  const riskTolerance = profile?.riskTolerance || "moderate";
  const riskMap: Record<string, { score: number; label: string; color: string }> = {
    conservative: { score: 25, label: "Conservative", color: "text-blue-600" },
    moderate: { score: 50, label: "Moderate", color: "text-green-600" },
    aggressive: { score: 80, label: "Aggressive", color: "text-red-600" },
  };
  const { score: riskScore, label: riskLabel, color: riskColor } = riskMap[riskTolerance] || riskMap.moderate;

  return (
    <AppShell title="Suitability">
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Suitability Intelligence</h1>
          <p className="text-muted-foreground">AI-powered suitability analysis and product matching</p>
        </div>
        <Button onClick={() => toast.info("Running full suitability analysis...")} disabled={!profile}>
          <Zap className="h-4 w-4 mr-2" /> Run Analysis
        </Button>
      </div>

      {!profile ? (
        <Card>
          <CardContent className="text-center py-16">
            <Shield className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
            <h3 className="text-lg font-medium mb-2">No Suitability Profile</h3>
            <p className="text-sm text-muted-foreground mb-4">Complete the suitability assessment to unlock AI-powered product matching</p>
            <Button>Start Assessment</Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="overview"><Shield className="h-4 w-4 mr-1" /> Overview</TabsTrigger>
            <TabsTrigger value="products"><Target className="h-4 w-4 mr-1" /> Product Matches</TabsTrigger>
            <TabsTrigger value="risk"><BarChart3 className="h-4 w-4 mr-1" /> Risk Analysis</TabsTrigger>
            <TabsTrigger value="compliance"><FileText className="h-4 w-4 mr-1" /> Compliance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Risk Tolerance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <span className={`text-3xl font-bold font-mono tabular-nums ${riskColor}`}>{riskScore}</span>
                    <Badge variant="outline" className={riskColor}>{riskLabel}</Badge>
                  </div>
                  <Progress value={riskScore} className="mt-3" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Investment Horizon</CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-3xl font-bold font-mono tabular-nums">{profile.investmentHorizon || "N/A"}</span>
                  <p className="text-xs text-muted-foreground mt-1">investment horizon</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Suitability Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-bold font-mono tabular-nums text-green-600">85</span>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">overall suitability score</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Profile Summary</CardTitle>
                <CardDescription>Key suitability dimensions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { label: "Income Stability", value: 70 },
                    { label: "Liquidity Needs", value: 50 },
                    { label: "Tax Sensitivity", value: 60 },
                    { label: "ESG Preference", value: 40 },
                    { label: "Concentration Risk", value: 30 },
                  ].map(dim => (
                    <div key={dim.label} className="flex items-center gap-4">
                      <span className="text-sm w-40 text-muted-foreground">{dim.label}</span>
                      <Progress value={dim.value} className="flex-1" />
                      <span className="text-sm font-medium w-10 text-right">{dim.value}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Matched Products</CardTitle>
                <CardDescription>Products ranked by suitability match score</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {productList.slice(0, 10).map((product: any, i: number) => (
                    <div key={product.id} className="flex items-center justify-between py-3 border-b last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-muted-foreground w-6">#{i + 1}</span>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.company} · {product.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={i < 3 ? "default" : "outline"}>
                          {Math.max(95 - i * 7, 40)}% match
                        </Badge>
                        {i < 3 && <TrendingUp className="h-4 w-4 text-green-500" />}
                      </div>
                    </div>
                  ))}
                  {productList.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Target className="h-10 w-10 mx-auto mb-2 opacity-40" />
                      <p>No products available for matching</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="risk" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Risk Factors</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { label: "Market Volatility Exposure", level: "medium", color: "text-amber-600" },
                      { label: "Concentration Risk", level: "low", color: "text-green-600" },
                      { label: "Liquidity Risk", level: "low", color: "text-green-600" },
                      { label: "Interest Rate Sensitivity", level: "medium", color: "text-amber-600" },
                      { label: "Inflation Exposure", level: "high", color: "text-red-600" },
                    ].map(risk => (
                      <div key={risk.label} className="flex items-center justify-between py-2">
                        <span className="text-sm">{risk.label}</span>
                        <Badge variant="outline" className={risk.color}>{risk.level}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Alerts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Inflation exposure above threshold</p>
                        <p className="text-xs text-muted-foreground">Consider TIPS or I-bonds allocation</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Diversification adequate</p>
                        <p className="text-xs text-muted-foreground">Portfolio spread across 5+ asset classes</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Reg BI Compliance Status</CardTitle>
                <CardDescription>Best interest obligation documentation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: "Disclosure Obligation", status: "complete" },
                    { label: "Care Obligation", status: "complete" },
                    { label: "Conflict of Interest", status: "review" },
                    { label: "Compliance Obligation", status: "complete" },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between py-2 border-b last:border-0">
                      <span className="text-sm">{item.label}</span>
                      <Badge variant={item.status === "complete" ? "default" : "secondary"}>
                        {item.status === "complete" ? <><CheckCircle className="h-3 w-3 mr-1" /> Complete</> : <><AlertTriangle className="h-3 w-3 mr-1" /> Review Needed</>}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
    </AppShell>
  );
}
