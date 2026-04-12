/**
 * TaxPlanning — Interactive tax planning analysis with live bracket visualization,
 * multi-year projections, Roth conversion analysis, and strategy recommendations.
 * Wired to real taxProjector tRPC endpoints.
 */
import { SEOHead } from "@/components/SEOHead";
import { LeadCaptureGate } from "@/components/LeadCaptureGate";
import { CalculatorInsight } from "@/components/CalculatorInsight";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useFinancialProfile, profileValue } from "@/hooks/useFinancialProfile";
import { ArrowLeft, DollarSign, TrendingDown, Calculator, FileText, PiggyBank, BarChart3, Loader2, Play } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useState, useCallback } from "react";
import AppShell from "@/components/AppShell";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function SliderInput({
  label, value, onChange, min, max, step = 1, prefix = "$", suffix = "",
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step?: number;
  prefix?: string; suffix?: string;
}) {
  const display = prefix === "$" ? fmt(value) : `${prefix}${value.toLocaleString()}${suffix}`;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-xs font-mono text-foreground">{display}</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min} max={max} step={step}
        aria-label={label}
        className="[&_[role=slider]]:h-3.5 [&_[role=slider]]:w-3.5"
      />
    </div>
  );
}

export default function TaxPlanning() {
  const [, navigate] = useLocation();
  const { profile, updateProfile } = useFinancialProfile("tax-planning");

  // ─── Inputs (initialized from shared profile if available) ──
  const [filingStatus, setFilingStatus] = useState<"single" | "mfj" | "hoh">(profileValue(profile, "filingStatus", "mfj"));
  const [wages, setWages] = useState(profileValue(profile, "annualIncome", 150000));
  const [selfEmployment, setSelfEmployment] = useState(profileValue(profile, "selfEmploymentIncome", 0));
  const [interestIncome, setInterestIncome] = useState(profileValue(profile, "interestIncome", 2000));
  const [dividendIncome, setDividendIncome] = useState(profileValue(profile, "dividendIncome", 5000));
  const [longTermCapGains, setLongTermCapGains] = useState(profileValue(profile, "longTermCapGains", 0));
  const [rentalIncome, setRentalIncome] = useState(profileValue(profile, "rentalIncome", 0));
  const [itemizedDeductions, setItemizedDeductions] = useState(profileValue(profile, "itemizedDeductions", 30000));
  const [retirementContributions, setRetirementContributions] = useState(profileValue(profile, "retirementContributions", 23000));
  const [hsaContributions, setHsaContributions] = useState(profileValue(profile, "hsaContributions", 4150));
  const [stateCode, setStateCode] = useState(profileValue(profile, "stateCode", "TX"));
  const [rothConversion, setRothConversion] = useState(0);

  // Write inputs back to shared profile when analysis runs
  const syncToProfile = useCallback(() => {
    updateProfile({
      filingStatus, annualIncome: wages, selfEmploymentIncome: selfEmployment,
      interestIncome, dividendIncome, longTermCapGains, rentalIncome,
      itemizedDeductions, retirementContributions, hsaContributions, stateCode,
      isMarried: filingStatus === "mfj",
    });
  }, [filingStatus, wages, selfEmployment, interestIncome, dividendIncome, longTermCapGains, rentalIncome, itemizedDeductions, retirementContributions, hsaContributions, stateCode, updateProfile]);

  // ─── tRPC mutations ─────────────────────────────────────
  const taxCalc = trpc.taxProjector.project.useMutation({ onError: (e) => toast.error(e.message) });
  const multiYearCalc = trpc.taxProjector.multiYear.useMutation({ onError: (e) => toast.error(e.message) });
  const rothCalc = trpc.taxProjector.rothComparison.useMutation({ onError: (e) => toast.error(e.message) });

  const buildInput = useCallback(() => ({
    filingStatus,
    wages,
    selfEmploymentIncome: selfEmployment,
    interestIncome,
    dividendIncome,
    ordinaryDividends: 0,
    shortTermCapGains: 0,
    longTermCapGains,
    rentalIncome,
    otherIncome: 0,
    rothConversion,
    itemizedDeductions,
    retirementContributions,
    hsaContributions,
    stateCode,
    dependents: 0,
    year: new Date().getFullYear(),
  }), [filingStatus, wages, selfEmployment, interestIncome, dividendIncome, longTermCapGains, rentalIncome, rothConversion, itemizedDeductions, retirementContributions, hsaContributions, stateCode]);

  const runProjection = useCallback(() => {
    const input = buildInput();
    taxCalc.mutate(input);
    syncToProfile();
  }, [buildInput, taxCalc, syncToProfile]);

  const runMultiYear = useCallback(() => {
    const input = buildInput();
    multiYearCalc.mutate({ ...input, years: 5, inflationRate: 0.03 });
  }, [buildInput, multiYearCalc]);

  const runRothComparison = useCallback(() => {
    const input = buildInput();
    rothCalc.mutate({ ...input, conversionAmounts: [0, 10000, 25000, 50000, 75000, 100000] });
  }, [buildInput, rothCalc]);

  const result = taxCalc.data as any;
  const multiYearResult = multiYearCalc.data as any;
  const rothResult = rothCalc.data as any;
  const isLoading = taxCalc.isPending || multiYearCalc.isPending || rothCalc.isPending;

  return (
    <AppShell title="Tax Planning">
    <div className="container max-w-5xl py-8 space-y-6">
      <SEOHead title="Tax Planning" description="Tax planning analysis and optimization strategies" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/calculators")} aria-label="Back to calculators">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-heading">Tax Planning</h1>
            <p className="text-sm text-muted-foreground">Interactive tax analysis and optimization strategies</p>
          </div>
        </div>
        <Button
          onClick={() => { runProjection(); runMultiYear(); runRothComparison(); }}
          disabled={isLoading}
          aria-label="Run tax analysis"
        >
          {isLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
          Run Analysis
        </Button>
      </div>

      {/* ─── Inputs ────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Tax Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Filing Status</Label>
              <Select value={filingStatus} onValueChange={(v) => setFilingStatus(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="mfj">Married Filing Jointly</SelectItem>
                  <SelectItem value="hoh">Head of Household</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">State</Label>
              <Select value={stateCode} onValueChange={setStateCode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["TX", "CA", "NY", "FL", "WA", "IL", "PA", "OH", "GA", "NC", "NJ", "VA", "CO", "AZ", "MA", "TN", "NV"].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            <SliderInput label="W-2 Wages" value={wages} onChange={setWages} min={0} max={1000000} step={5000} />
            <SliderInput label="Self-Employment Income" value={selfEmployment} onChange={setSelfEmployment} min={0} max={500000} step={5000} />
            <SliderInput label="Interest Income" value={interestIncome} onChange={setInterestIncome} min={0} max={100000} step={500} />
            <SliderInput label="Qualified Dividends" value={dividendIncome} onChange={setDividendIncome} min={0} max={200000} step={1000} />
            <SliderInput label="Long-Term Capital Gains" value={longTermCapGains} onChange={setLongTermCapGains} min={0} max={500000} step={5000} />
            <SliderInput label="Rental Income" value={rentalIncome} onChange={setRentalIncome} min={0} max={200000} step={2000} />
            <SliderInput label="Itemized Deductions" value={itemizedDeductions} onChange={setItemizedDeductions} min={0} max={200000} step={1000} />
            <SliderInput label="Retirement Contributions (401k/IRA)" value={retirementContributions} onChange={setRetirementContributions} min={0} max={69000} step={500} />
            <SliderInput label="HSA Contributions" value={hsaContributions} onChange={setHsaContributions} min={0} max={8300} step={100} />
            <SliderInput label="Roth Conversion Amount" value={rothConversion} onChange={setRothConversion} min={0} max={200000} step={5000} />
          </div>
        </CardContent>
      </Card>

      {/* ─── Results ───────────────────────────────────────── */}
      {result && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
              <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Federal Tax</p>
              <p className="text-lg font-semibold tabular-nums">{fmt(result.federalTax ?? result.totalFederalTax ?? 0)}</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
              <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Effective Rate</p>
              <p className="text-lg font-semibold tabular-nums">{pct(result.effectiveRate ?? 0)}</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
              <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">State Tax</p>
              <p className="text-lg font-semibold tabular-nums">{fmt(result.stateTax ?? 0)}</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
              <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Total Tax</p>
              <p className="text-lg font-semibold tabular-nums text-accent">{fmt(result.totalTax ?? (result.federalTax ?? 0) + (result.stateTax ?? 0))}</p>
            </div>
          </div>

          <Tabs defaultValue="brackets">
            <TabsList>
              <TabsTrigger value="brackets">Bracket Breakdown</TabsTrigger>
              <TabsTrigger value="roth">Roth Conversion</TabsTrigger>
              <TabsTrigger value="multiyear">5-Year Projection</TabsTrigger>
            </TabsList>

            <TabsContent value="brackets" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    Federal Bracket Fill ({filingStatus === "mfj" ? "Married Filing Jointly" : filingStatus === "single" ? "Single" : "Head of Household"})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {result.brackets ? (
                    <div className="space-y-3">
                      {(result.brackets as any[]).map((b: any, i: number) => (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium w-12">{pct(b.rate ?? b.bracket ?? 0)}</span>
                            <span className="text-muted-foreground text-xs">
                              {fmt(b.rangeStart ?? b.from ?? 0)} – {fmt(b.rangeEnd ?? b.to ?? 0)}
                            </span>
                            <span className="text-xs font-mono">{fmt(b.taxInBracket ?? b.tax ?? 0)}</span>
                          </div>
                          <Progress value={Math.min(100, (b.fill ?? b.fillPct ?? 0) * 100)} className="h-2" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Taxable income: {fmt(result.taxableIncome ?? 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Marginal rate: {pct(result.marginalRate ?? 0)}
                      </p>
                    </div>
                  )}
                  {result.marginalRate && (
                    <p className="text-xs text-muted-foreground mt-4">
                      Marginal rate: {pct(result.marginalRate)}. Taxable income: {fmt(result.taxableIncome ?? 0)}.
                      {rothConversion === 0 && " Consider Roth conversions to fill unused lower bracket space."}
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="roth" className="space-y-4 mt-4">
              <LeadCaptureGate
                title="Unlock Roth Conversion Analysis"
                description="Enter your email to access personalized Roth conversion modeling with marginal cost analysis."
                onCapture={(email) => toast.success(`Roth analysis sent to ${email}`)}
              >
                {rothResult ? (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Roth Conversion Scenarios</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {Array.isArray(rothResult.scenarios ?? rothResult) ? (
                        <div className="space-y-2">
                          {((rothResult.scenarios ?? rothResult) as any[]).map((s: any, i: number) => (
                            <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                              <div>
                                <span className="text-sm font-medium">Convert {fmt(s.conversionAmount ?? s.amount ?? 0)}</span>
                                <p className="text-xs text-muted-foreground">Marginal cost: {pct(s.marginalRate ?? s.marginalCost ?? 0)}</p>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-mono">{fmt(s.totalTax ?? s.additionalTax ?? 0)}</span>
                                <p className="text-xs text-muted-foreground">
                                  {s.additionalTax != null ? `+${fmt(s.additionalTax)}` : "total tax"}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Run the analysis to see Roth conversion scenarios.</p>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <p className="text-sm text-muted-foreground">Click "Run Analysis" to generate Roth conversion scenarios.</p>
                    </CardContent>
                  </Card>
                )}
              </LeadCaptureGate>
            </TabsContent>

            <TabsContent value="multiyear" className="mt-4">
              {multiYearResult ? (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">5-Year Tax Projection (3% inflation)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {Array.isArray(multiYearResult.years ?? multiYearResult) ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-5 gap-2 text-xs text-muted-foreground border-b border-border pb-2 mb-2">
                          <span>Year</span>
                          <span className="text-right">Income</span>
                          <span className="text-right">Federal</span>
                          <span className="text-right">State</span>
                          <span className="text-right">Total</span>
                        </div>
                        {((multiYearResult.years ?? multiYearResult) as any[]).map((yr: any, i: number) => (
                          <div key={i} className="grid grid-cols-5 gap-2 text-sm py-1 border-b border-border/30 last:border-0">
                            <span className="font-mono">{yr.year ?? new Date().getFullYear() + i}</span>
                            <span className="text-right font-mono">{fmt(yr.grossIncome ?? yr.totalIncome ?? 0)}</span>
                            <span className="text-right font-mono">{fmt(yr.federalTax ?? 0)}</span>
                            <span className="text-right font-mono">{fmt(yr.stateTax ?? 0)}</span>
                            <span className="text-right font-mono text-accent">{fmt(yr.totalTax ?? 0)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Multi-year projection data format not recognized.</p>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-sm text-muted-foreground">Click "Run Analysis" to generate multi-year projections.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* ─── Strategy insights (always visible) ────────────── */}
      {result && result.marginalRate != null && (
        <div className="space-y-4">
          {result.marginalRate > 0.22 && (
            <CalculatorInsight
              title="Roth Conversion Opportunity"
              summary={`Your marginal rate is ${pct(result.marginalRate)}. Converting traditional IRA funds at this rate may be beneficial if you expect higher rates in retirement.`}
              detail={`With taxable income of ${fmt(result.taxableIncome ?? 0)}, consider conversions that stay within the ${pct(result.marginalRate)} bracket. Use the Roth Conversion tab to model specific amounts.`}
              severity="info"
              actionLabel="View Roth Scenarios"
            />
          )}
          {retirementContributions < 23000 && (
            <CalculatorInsight
              title="Max Out Retirement Contributions"
              summary={`You're contributing ${fmt(retirementContributions)} of the ${fmt(23000)} 401(k) limit. Increasing saves ${fmt((23000 - retirementContributions) * (result.marginalRate ?? 0.22))} in taxes.`}
              severity="success"
            />
          )}
        </div>
      )}

      {/* ─── Empty state ───────────────────────────────────── */}
      {!result && !isLoading && (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <Calculator className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Adjust the inputs above and click "Run Analysis" to see your tax breakdown, Roth conversion scenarios, and multi-year projections.</p>
          </CardContent>
        </Card>
      )}
    </div>
    </AppShell>
  );
}
