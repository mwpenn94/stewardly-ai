import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calculator, TrendingDown, RefreshCw, DollarSign, Loader2, BarChart3, ArrowRight , ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { SEOHead } from "@/components/SEOHead";
import { fmt, pct } from "@/lib/format";

const FILING_STATUSES = [
  { value: "single", label: "Single" },
  { value: "mfj", label: "Married Filing Jointly" },
  { value: "mfs", label: "Married Filing Separately" },
  { value: "hoh", label: "Head of Household" },
] as const;

type FilingStatus = typeof FILING_STATUSES[number]["value"];

export default function TaxProjector() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  
  const [tab, setTab] = useState("single-year");

  // Single year form
  const [yearCtx, setYearCtx] = useState({
    year: new Date().getFullYear(),
    filingStatus: "single" as FilingStatus,
    ordinaryIncomeUSD: 150000,
    longTermCapGainsUSD: 20000,
    qualifiedDividendsUSD: 5000,
    traditionalDistributionsUSD: 0,
    itemizedDeductionUSD: 0,
    aboveTheLineUSD: 0,
    primaryAge: 45,
    spouseAge: 0,
  });

  // State tax
  const [stateCode, setStateCode] = useState("CA");

  // RMD
  const [rmdAge, setRmdAge] = useState(73);
  const [rmdBalance, setRmdBalance] = useState(500000);

  // IRMAA
  const [irmaaMagi, setIrmaaMagi] = useState(200000);
  const [irmaaStatus, setIrmaaStatus] = useState<FilingStatus>("single");

  // Roth ladder
  const [rothBalance, setRothBalance] = useState(500000);
  const [rothTargetRate, setRothTargetRate] = useState(0.22);

  const singleYearQ = trpc.tax.projectYear.useQuery(yearCtx, { enabled: false });
  const stateTaxQ = trpc.tax.projectStateTax.useQuery(
    { year: yearCtx, state: stateCode as any, livesInNYC: false },
    { enabled: false }
  );
  const rmdQ = trpc.tax.rmd.useQuery({ age: rmdAge, priorYearBalance: rmdBalance }, { enabled: false });
  const irmaaQ = trpc.tax.irmaa.useQuery({ magi: irmaaMagi, status: irmaaStatus }, { enabled: false });
  const supportedStatesQ = trpc.tax.supportedStates.useQuery();

  const setField = <K extends keyof typeof yearCtx>(k: K, v: typeof yearCtx[K]) =>
    setYearCtx((p) => ({ ...p, [k]: v }));

  const formatCurrency = fmt;
  const formatPct = pct;

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <button type="button" onClick={() => navigate("/wealth-engine")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1 mb-2">
        <ArrowLeft className="h-4 w-4" /> Back to Wealth Engine
      </button>
      <SEOHead title="Tax Projector" description="Multi-year tax projection and Roth conversion analysis" />
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Calculator className="h-8 w-8 text-primary" /> Tax Projector
        </h1>
        <p className="text-muted-foreground mt-1">
          Multi-year federal + state tax projection, Roth conversion ladder, RMD calculator, and IRMAA tier lookup.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="single-year" className="gap-1"><DollarSign className="h-4 w-4" /> Single Year</TabsTrigger>
          <TabsTrigger value="state-tax" className="gap-1"><BarChart3 className="h-4 w-4" /> State Tax</TabsTrigger>
          <TabsTrigger value="rmd" className="gap-1"><TrendingDown className="h-4 w-4" /> RMD</TabsTrigger>
          <TabsTrigger value="irmaa" className="gap-1"><Badge variant="outline" className="text-xs">IRMAA</Badge></TabsTrigger>
        </TabsList>

        {/* Single Year */}
        <TabsContent value="single-year" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>Federal Tax Projection</CardTitle><CardDescription>Project federal income tax for a single year</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2"><Label>Tax Year</Label><Input type="number" value={yearCtx.year} onChange={(e) => setField("year", +e.target.value)} /></div>
                <div className="space-y-2">
                  <Label>Filing Status</Label>
                  <Select value={yearCtx.filingStatus} onValueChange={(v) => setField("filingStatus", v as FilingStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{FILING_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Age</Label><Input type="number" value={yearCtx.primaryAge} onChange={(e) => setField("primaryAge", +e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Ordinary Income ($)</Label><Input type="number" value={yearCtx.ordinaryIncomeUSD} onChange={(e) => setField("ordinaryIncomeUSD", +e.target.value)} /></div>
                <div className="space-y-2"><Label>Long-Term Cap Gains ($)</Label><Input type="number" value={yearCtx.longTermCapGainsUSD} onChange={(e) => setField("longTermCapGainsUSD", +e.target.value)} /></div>
                <div className="space-y-2"><Label>Qualified Dividends ($)</Label><Input type="number" value={yearCtx.qualifiedDividendsUSD} onChange={(e) => setField("qualifiedDividendsUSD", +e.target.value)} /></div>
                <div className="space-y-2"><Label>Traditional IRA Distributions ($)</Label><Input type="number" value={yearCtx.traditionalDistributionsUSD} onChange={(e) => setField("traditionalDistributionsUSD", +e.target.value)} /></div>
                <div className="space-y-2"><Label>Itemized Deductions ($)</Label><Input type="number" value={yearCtx.itemizedDeductionUSD} onChange={(e) => setField("itemizedDeductionUSD", +e.target.value)} /></div>
                <div className="space-y-2"><Label>Above-the-Line Deductions ($)</Label><Input type="number" value={yearCtx.aboveTheLineUSD} onChange={(e) => setField("aboveTheLineUSD", +e.target.value)} /></div>
              </div>
              <Button onClick={() => singleYearQ.refetch()} disabled={singleYearQ.isFetching} className="w-full">
                {singleYearQ.isFetching ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Calculating...</> : <><ArrowRight className="h-4 w-4 mr-2" /> Project Federal Tax</>}
              </Button>
            </CardContent>
          </Card>

          {singleYearQ.data && (
            <Card className="border-primary/30">
              <CardHeader><CardTitle>Federal Tax Results</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(singleYearQ.data as Record<string, any>).filter(([k]) => typeof (singleYearQ.data as any)[k] === "number").slice(0, 8).map(([k, v]) => (
                    <div key={k} className="bg-muted/50 rounded-lg p-3 text-center">
                      <div className="text-xs text-muted-foreground capitalize">{k.replace(/USD$/, "").replace(/([A-Z])/g, " $1").trim()}</div>
                      <div className="text-lg font-bold mt-1">{typeof v === "number" && v < 1 ? formatPct(v as number) : formatCurrency(v as number)}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* State Tax */}
        <TabsContent value="state-tax" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>Combined Federal + State Tax</CardTitle><CardDescription>See your total tax burden including state taxes</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>State</Label>
                <Select value={stateCode} onValueChange={setStateCode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(supportedStatesQ.data as unknown as string[] || ["CA", "NY", "IL", "TX"]).map((s: string) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">Uses the income values from the Single Year tab above.</p>
              <Button onClick={() => stateTaxQ.refetch()} disabled={stateTaxQ.isFetching} className="w-full">
                {stateTaxQ.isFetching ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Calculating...</> : <><ArrowRight className="h-4 w-4 mr-2" /> Project State + Federal Tax</>}
              </Button>
            </CardContent>
          </Card>

          {stateTaxQ.data && (
            <Card className="border-primary/30">
              <CardHeader><CardTitle>Combined Tax Results — {stateCode}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <div className="text-xs text-muted-foreground">Combined Effective Rate</div>
                    <div className="text-xl font-bold mt-1">{formatPct((stateTaxQ.data as any).combinedEffectiveRate ?? 0)}</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <div className="text-xs text-muted-foreground">Federal Tax</div>
                    <div className="text-lg font-bold mt-1">{formatCurrency((stateTaxQ.data as any).federal?.totalTaxUSD ?? 0)}</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <div className="text-xs text-muted-foreground">State Tax</div>
                    <div className="text-lg font-bold mt-1">{formatCurrency((stateTaxQ.data as any).state?.totalStateTaxUSD ?? 0)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* RMD */}
        <TabsContent value="rmd" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>Required Minimum Distribution (RMD)</CardTitle><CardDescription>Calculate your RMD using the Uniform Lifetime Table</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Age</Label><Input type="number" value={rmdAge} onChange={(e) => setRmdAge(+e.target.value)} /></div>
                <div className="space-y-2"><Label>Prior Year Balance ($)</Label><Input type="number" value={rmdBalance} onChange={(e) => setRmdBalance(+e.target.value)} /></div>
              </div>
              <Button onClick={() => rmdQ.refetch()} disabled={rmdQ.isFetching} className="w-full">
                {rmdQ.isFetching ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Calculating...</> : <><ArrowRight className="h-4 w-4 mr-2" /> Calculate RMD</>}
              </Button>
            </CardContent>
          </Card>

          {rmdQ.data && (
            <Card className="border-primary/30">
              <CardContent className="pt-6 text-center">
                <div className="text-sm text-muted-foreground">Required Minimum Distribution</div>
                <div className="text-3xl font-bold mt-2">{formatCurrency((rmdQ.data as any).amount ?? 0)}</div>
                <div className="text-sm text-muted-foreground mt-1">Based on age {rmdAge} with ${rmdBalance.toLocaleString()} balance</div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* IRMAA */}
        <TabsContent value="irmaa" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>IRMAA Tier Lookup</CardTitle><CardDescription>Check your Medicare Income-Related Monthly Adjustment Amount tier</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>MAGI ($)</Label><Input type="number" value={irmaaMagi} onChange={(e) => setIrmaaMagi(+e.target.value)} /></div>
                <div className="space-y-2">
                  <Label>Filing Status</Label>
                  <Select value={irmaaStatus} onValueChange={(v) => setIrmaaStatus(v as FilingStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{FILING_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={() => irmaaQ.refetch()} disabled={irmaaQ.isFetching} className="w-full">
                {irmaaQ.isFetching ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Looking up...</> : <><ArrowRight className="h-4 w-4 mr-2" /> Look Up IRMAA Tier</>}
              </Button>
            </CardContent>
          </Card>

          {irmaaQ.data && (
            <Card className="border-primary/30">
              <CardContent className="pt-6">
                <pre className="text-sm bg-muted/50 p-4 rounded-lg overflow-auto whitespace-pre-wrap">{JSON.stringify(irmaaQ.data, null, 2)}</pre>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
