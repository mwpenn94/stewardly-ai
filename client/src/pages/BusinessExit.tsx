import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, TrendingUp, Clock, History, ArrowRight, DollarSign, Users, BarChart3, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SEOHead } from "@/components/SEOHead";

const EXIT_PATHS = [
  { value: "sale", label: "Third-Party Sale" },
  { value: "merger", label: "Merger / Acquisition" },
  { value: "esop", label: "ESOP" },
  { value: "family", label: "Family Succession" },
  { value: "ipo", label: "IPO" },
  { value: "liquidation", label: "Liquidation" },
] as const;

type ExitPath = typeof EXIT_PATHS[number]["value"];

export default function BusinessExit({ embedded = false }: { embedded?: boolean } = {}) {
  const { user } = useAuth();
  
  const [tab, setTab] = useState("analyze");

  const [form, setForm] = useState({
    businessName: "",
    businessType: "LLC",
    annualRevenue: 500000,
    annualProfit: 100000,
    employeeCount: 5,
    ownerHoursPerWeek: 40,
    yearsInBusiness: 10,
    keyEmployeeDependence: 50,
    customerConcentration: 30,
    recurringRevenuePercent: 40,
    preferredTimeline: 5,
    preferredPath: "sale" as ExitPath,
  });

  const analyzeMut = trpc.businessExit.analyze.useMutation({
    onSuccess: () => {
      toast.success("Analysis Complete");
      historyQ.refetch();
      setTab("history");
    },
    onError: (e) => toast.error(e.message),
  });

  const historyQ = trpc.businessExit.history.useQuery(undefined, { enabled: !!user });

  const handleAnalyze = () => {
    if (!form.businessName.trim()) {
      toast.success("Required");
      return;
    }
    analyzeMut.mutate(form);
  };

  const setField = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <SEOHead title="Business Exit Planning" description="Business exit strategy analysis and planning" />
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Building2 className="h-8 w-8 text-primary" /> Business Exit Planner
        </h1>
        <p className="text-muted-foreground mt-1">
          Analyze your business readiness for exit and explore optimal paths to maximize value.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="analyze" className="gap-1"><BarChart3 className="h-4 w-4" /> Analyze</TabsTrigger>
          <TabsTrigger value="history" className="gap-1"><History className="h-4 w-4" /> History</TabsTrigger>
        </TabsList>

        <TabsContent value="analyze" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Business Profile</CardTitle>
              <CardDescription>Enter your business details for exit readiness analysis</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Business Name</Label>
                  <Input value={form.businessName} onChange={(e) => setField("businessName", e.target.value)} placeholder="Acme Corp" />
                </div>
                <div className="space-y-2">
                  <Label>Business Type</Label>
                  <Input value={form.businessType} onChange={(e) => setField("businessType", e.target.value)} placeholder="LLC, S-Corp, etc." />
                </div>
                <div className="space-y-2">
                  <Label>Annual Revenue ($)</Label>
                  <Input type="number" value={form.annualRevenue} onChange={(e) => setField("annualRevenue", +e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Annual Profit ($)</Label>
                  <Input type="number" value={form.annualProfit} onChange={(e) => setField("annualProfit", +e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Employee Count</Label>
                  <Input type="number" value={form.employeeCount} onChange={(e) => setField("employeeCount", +e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Owner Hours/Week</Label>
                  <Input type="number" value={form.ownerHoursPerWeek} onChange={(e) => setField("ownerHoursPerWeek", +e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Years in Business</Label>
                  <Input type="number" value={form.yearsInBusiness} onChange={(e) => setField("yearsInBusiness", +e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Preferred Timeline (years)</Label>
                  <Input type="number" value={form.preferredTimeline} onChange={(e) => setField("preferredTimeline", +e.target.value)} />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Key Employee Dependence: {form.keyEmployeeDependence}%</Label>
                  <Slider value={[form.keyEmployeeDependence]} onValueChange={([v]) => setField("keyEmployeeDependence", v)} max={100} step={5} />
                </div>
                <div className="space-y-2">
                  <Label>Customer Concentration: {form.customerConcentration}%</Label>
                  <Slider value={[form.customerConcentration]} onValueChange={([v]) => setField("customerConcentration", v)} max={100} step={5} />
                </div>
                <div className="space-y-2">
                  <Label>Recurring Revenue: {form.recurringRevenuePercent}%</Label>
                  <Slider value={[form.recurringRevenuePercent]} onValueChange={([v]) => setField("recurringRevenuePercent", v)} max={100} step={5} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Preferred Exit Path</Label>
                <Select value={form.preferredPath} onValueChange={(v) => setField("preferredPath", v as ExitPath)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXIT_PATHS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleAnalyze} disabled={analyzeMut.isPending} className="w-full">
                {analyzeMut.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Analyzing...</> : <><ArrowRight className="h-4 w-4 mr-2" /> Run Exit Analysis</>}
              </Button>
            </CardContent>
          </Card>

          {analyzeMut.data && (
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" /> Exit Analysis Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Readiness Score", value: `${(analyzeMut.data as any).readinessScore ?? "N/A"}/100` },
                    { label: "Est. Valuation", value: `$${((analyzeMut.data as any).estimatedValuation ?? 0).toLocaleString()}` },
                    { label: "Recommended Path", value: (analyzeMut.data as any).recommendedPath ?? "N/A" },
                    { label: "Timeline", value: `${(analyzeMut.data as any).recommendedTimeline ?? "N/A"} yrs` },
                  ].map((m) => (
                    <div key={m.label} className="bg-muted/50 rounded-lg p-3 text-center">
                      <div className="text-xs text-muted-foreground">{m.label}</div>
                      <div className="text-lg font-bold mt-1">{m.value}</div>
                    </div>
                  ))}
                </div>
                {(analyzeMut.data as any).recommendations && (
                  <div className="space-y-2">
                    <h4 className="font-semibold">Recommendations</h4>
                    <ul className="space-y-1">
                      {((analyzeMut.data as any).recommendations as string[]).map((r: string, i: number) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span> {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Analysis History</CardTitle>
            </CardHeader>
            <CardContent>
              {historyQ.isLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : !historyQ.data?.length ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No exit analyses yet. Run your first analysis to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(historyQ.data as any[]).map((h: any, i: number) => (
                    <div key={i} className="border rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <div className="font-medium">{h.businessName || h.input?.businessName || "Analysis"}</div>
                        <div className="text-sm text-muted-foreground">
                          {h.createdAt ? new Date(h.createdAt).toLocaleDateString() : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{h.recommendedPath || h.result?.recommendedPath || "—"}</Badge>
                        <Badge>{h.readinessScore ?? h.result?.readinessScore ?? "—"}/100</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
