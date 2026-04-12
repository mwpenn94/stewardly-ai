/**
 * EstatePlanning — Interactive estate planning analysis with estate tax projections,
 * document checklist management, and beneficiary review.
 * Uses client-side estate tax calculations with current federal exemption rules.
 */
import { SEOHead } from "@/components/SEOHead";
import { LeadCaptureGate } from "@/components/LeadCaptureGate";
 * EstatePlanning — Document checklist + beneficiary review + real estate
 * tax projections via calculatorEngine.uweSimulate with estate product +
 * document parsing via estate.parseDocumentOffline.
 */
import { SEOHead } from "@/components/SEOHead";
import { CalculatorInsight } from "@/components/CalculatorInsight";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFinancialProfile, profileValue } from "@/hooks/useFinancialProfile";
import { PlanningCrossNav } from "@/components/PlanningCrossNav";
import { ArrowLeft, FileText, Users, DollarSign, CheckCircle2, XCircle, Clock, AlertTriangle, Scale, Calculator } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useMemo, useEffect, useCallback } from "react";
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

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function SliderInput({
  label, value, onChange, min, max, step = 1, prefix = "$",
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step?: number; prefix?: string;
}) {
  const display = prefix === "$" ? fmt(value) : `${prefix}${value.toLocaleString()}`;
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

// ─── Estate Tax Constants (2026) ──────────────────────────
const FEDERAL_EXEMPTION_2026 = 13_610_000;
const FEDERAL_EXEMPTION_SUNSET = 7_000_000; // Approximate post-TCJA sunset
const ESTATE_TAX_RATE = 0.40;
const ANNUAL_GIFT_EXCLUSION = 18_000;

// ─── Document types for estate checklist ──────────────────
const DOCUMENT_TYPES = [
  { name: "Last Will & Testament", priority: "critical", description: "Directs asset distribution and names guardians" },
  { name: "Revocable Living Trust", priority: "critical", description: "Avoids probate, provides incapacity planning" },
  { name: "Durable Power of Attorney", priority: "critical", description: "Financial decision authority if incapacitated" },
  { name: "Healthcare Directive", priority: "critical", description: "Medical decisions and end-of-life wishes" },
  { name: "HIPAA Authorization", priority: "important", description: "Allows access to medical records" },
  { name: "Beneficiary Designations", priority: "critical", description: "IRA, 401(k), life insurance beneficiaries" },
  { name: "Letter of Intent", priority: "helpful", description: "Non-binding wishes for personal property" },
  { name: "Guardianship Designation", priority: "important", description: "Names guardian for minor children" },
];

function computeEstateTax(netEstate: number, isMarried: boolean, portabilityUsed: number, useSunset: boolean) {
  const exemption = useSunset ? FEDERAL_EXEMPTION_SUNSET : FEDERAL_EXEMPTION_2026;
  const totalExemption = isMarried
    ? exemption + portabilityUsed
    : exemption;
  const taxableEstate = Math.max(0, netEstate - totalExemption);
  const estateTax = taxableEstate * ESTATE_TAX_RATE;
  return { taxableEstate, estateTax, exemption: totalExemption, headroom: totalExemption - netEstate };
}

export default function EstatePlanning() {
  const [, navigate] = useLocation();
  const { profile, updateProfile } = useFinancialProfile("estate-planning");

  // ─── Inputs (initialized from shared profile if available) ──
  const [netEstate, setNetEstate] = useState(profileValue(profile, "netEstate", 2_800_000));
  const [isMarried, setIsMarried] = useState(profileValue(profile, "isMarried", true));
  const [portabilityUsed, setPortabilityUsed] = useState(0);
  const [lifeInsurance, setLifeInsurance] = useState(profileValue(profile, "lifeInsuranceInEstate", profileValue(profile, "existingLifeInsurance", 500_000)));
  const [annualGrowthRate, setAnnualGrowthRate] = useState(6);
  const [currentAge, setCurrentAge] = useState(profileValue(profile, "currentAge", 45));
  const [lifeExpectancy, setLifeExpectancy] = useState(profileValue(profile, "lifeExpectancy", 85));

  // Sync estate data back to shared profile when user changes values
  const syncToProfile = useCallback(() => {
    updateProfile({
      netEstate, isMarried, lifeInsuranceInEstate: lifeInsurance,
      currentAge, lifeExpectancy,
    });
  }, [netEstate, isMarried, lifeInsurance, currentAge, lifeExpectancy, updateProfile]);

  // ─── Document tracker state ─────────────────────────────
  const [docStatus, setDocStatus] = useState<Record<string, "current" | "outdated" | "missing">>(() => {
    const initial: Record<string, "current" | "outdated" | "missing"> = {};
    DOCUMENT_TYPES.forEach(d => { initial[d.name] = "missing"; });
    return initial;
  });

  // Sync to shared profile on significant value changes (debounced)
  useEffect(() => {
    const t = setTimeout(syncToProfile, 500);
    return () => clearTimeout(t);
  }, [syncToProfile]);

  // ─── Calculations ───────────────────────────────────────
  const totalEstate = netEstate + lifeInsurance;
  const currentTax = useMemo(() => computeEstateTax(totalEstate, isMarried, portabilityUsed, false), [totalEstate, isMarried, portabilityUsed]);
  const sunsetTax = useMemo(() => computeEstateTax(totalEstate, isMarried, portabilityUsed, true), [totalEstate, isMarried, portabilityUsed]);

  // Project estate at death
  const yearsToLE = Math.max(0, lifeExpectancy - currentAge);
  const projectedEstate = totalEstate * Math.pow(1 + annualGrowthRate / 100, yearsToLE);
  const projectedTaxCurrent = useMemo(() => computeEstateTax(projectedEstate, isMarried, portabilityUsed, false), [projectedEstate, isMarried, portabilityUsed]);
  const projectedTaxSunset = useMemo(() => computeEstateTax(projectedEstate, isMarried, portabilityUsed, true), [projectedEstate, isMarried, portabilityUsed]);

  // Year-by-year projection for growth visualization
  const growthProjection = useMemo(() => {
    const rows = [];
    for (let y = 0; y <= Math.min(yearsToLE, 40); y += 5) {
      const est = totalEstate * Math.pow(1 + annualGrowthRate / 100, y);
      const tax = computeEstateTax(est, isMarried, portabilityUsed, false);
      const taxSunset = computeEstateTax(est, isMarried, portabilityUsed, true);
      rows.push({ year: y, age: currentAge + y, estate: est, tax: tax.estateTax, taxSunset: taxSunset.estateTax });
    }
    return rows;
  }, [totalEstate, annualGrowthRate, yearsToLE, currentAge, isMarried, portabilityUsed]);

  const docCurrent = Object.values(docStatus).filter(s => s === "current").length;
  const docTotal = DOCUMENT_TYPES.length;

  const statusIcon = { current: CheckCircle2, outdated: Clock, missing: XCircle };
  const statusColor = { current: "text-emerald-400", outdated: "text-amber-400", missing: "text-red-400" };
  const statusLabel = { current: "Current", outdated: "Needs Update", missing: "Missing" };
  const statusCycle: Record<string, "current" | "outdated" | "missing"> = { missing: "current", current: "outdated", outdated: "missing" };
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
      <SEOHead title="Estate Planning" description="Interactive estate planning with tax projections and document management" />

      <PlanningCrossNav />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/calculators")} aria-label="Back to calculators">
          <Button variant="ghost" size="sm" onClick={() => navigate("/calculators")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-heading flex items-center gap-2"><Scale className="h-6 w-6" /> Estate Planning</h1>
            <p className="text-sm text-muted-foreground">Interactive estate tax analysis, document review, and beneficiary planning</p>
            <p className="text-sm text-muted-foreground">Document review, beneficiary analysis, and estate tax projections</p>
          </div>
        </div>
      </div>

      {/* ─── Inputs ────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Estate Profile</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Marital Status</Label>
              <Select value={isMarried ? "married" : "single"} onValueChange={(v) => setIsMarried(v === "married")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="married">Married</SelectItem>
                  <SelectItem value="single">Single / Widowed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            <SliderInput label="Net Estate (excl. insurance)" value={netEstate} onChange={setNetEstate} min={0} max={50_000_000} step={100_000} />
            <SliderInput label="Life Insurance (in estate)" value={lifeInsurance} onChange={setLifeInsurance} min={0} max={10_000_000} step={50_000} />
            <SliderInput label="Current Age" value={currentAge} onChange={setCurrentAge} min={25} max={90} step={1} prefix="" />
            <SliderInput label="Life Expectancy" value={lifeExpectancy} onChange={setLifeExpectancy} min={currentAge + 1} max={100} step={1} prefix="" />
            <SliderInput label="Annual Growth Rate" value={annualGrowthRate} onChange={setAnnualGrowthRate} min={0} max={12} step={0.5} prefix="" />
            {isMarried && (
              <SliderInput label="Portability (DSUE) Used" value={portabilityUsed} onChange={setPortabilityUsed} min={0} max={FEDERAL_EXEMPTION_2026} step={100_000} />
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── Summary Stats ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Total Estate</p>
          <p className="text-lg font-semibold tabular-nums">{fmt(totalEstate)}</p>
        </div>
        <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Exemption Available</p>
          <p className="text-lg font-semibold tabular-nums">{fmt(currentTax.exemption)}</p>
        </div>
        <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Estate Tax (Today)</p>
          <p className={`text-lg font-semibold tabular-nums ${currentTax.estateTax === 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(currentTax.estateTax)}</p>
        </div>
        <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Doc Readiness</p>
          <p className="text-lg font-semibold tabular-nums">{docCurrent}/{docTotal}</p>
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

      <Tabs defaultValue="projections">
        <TabsList>
          <TabsTrigger value="projections">Tax Projections</TabsTrigger>
          <TabsTrigger value="documents">Documents ({docCurrent}/{docTotal})</TabsTrigger>
          <TabsTrigger value="strategies">Strategies</TabsTrigger>
          <TabsTrigger value="parser">Document Parser</TabsTrigger>
        </TabsList>

        <TabsContent value="projections" className="mt-4 space-y-4">
          <LeadCaptureGate
            title="Unlock Estate Tax Projections"
            description="Enter your email to access detailed estate tax projections, sunset modeling, and planning strategies."
            onCapture={() => {}}
          >
            {/* Current vs Sunset comparison */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Current Law (2026)</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Federal Exemption</span><span className="font-mono">{fmt(FEDERAL_EXEMPTION_2026)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Taxable Estate</span><span className="font-mono">{fmt(currentTax.taxableEstate)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Estate Tax (40%)</span><span className={`font-mono ${currentTax.estateTax === 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(currentTax.estateTax)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Headroom</span><span className="font-mono text-emerald-400">{fmt(Math.max(0, currentTax.headroom))}</span></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">If TCJA Sunsets <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">Risk</Badge></CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Reduced Exemption</span><span className="font-mono">{fmt(FEDERAL_EXEMPTION_SUNSET)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Taxable Estate</span><span className="font-mono">{fmt(sunsetTax.taxableEstate)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Estate Tax (40%)</span><span className={`font-mono ${sunsetTax.estateTax === 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(sunsetTax.estateTax)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Additional Exposure</span><span className="font-mono text-red-400">{fmt(sunsetTax.estateTax - currentTax.estateTax)}</span></div>
                </CardContent>
              </Card>
            </div>

            {/* Growth projection table */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Estate Growth & Tax Projection ({annualGrowthRate}% annual growth)</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <div className="grid grid-cols-5 gap-2 text-xs text-muted-foreground border-b border-border pb-2 mb-2">
                    <span>Age</span>
                    <span className="text-right">Estate Value</span>
                    <span className="text-right">Tax (Current)</span>
                    <span className="text-right">Tax (Sunset)</span>
                    <span className="text-right">Delta</span>
                  </div>
                  {growthProjection.map(row => (
                    <div key={row.year} className="grid grid-cols-5 gap-2 text-sm py-1 border-b border-border/30 last:border-0">
                      <span className="font-mono">{row.age}</span>
                      <span className="text-right font-mono">{fmt(row.estate)}</span>
                      <span className={`text-right font-mono ${row.tax === 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(row.tax)}</span>
                      <span className={`text-right font-mono ${row.taxSunset === 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(row.taxSunset)}</span>
                      <span className="text-right font-mono text-amber-400">{fmt(row.taxSunset - row.tax)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </LeadCaptureGate>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Estate Document Checklist</CardTitle>
              <p className="text-xs text-muted-foreground">Click status to cycle: Missing → Current → Needs Update</p>
            </CardHeader>
          <Card className="bg-card/60 border-border/50">
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {DOCUMENT_TYPES.map(doc => {
                  const status = docStatus[doc.name];
                  const Icon = statusIcon[status];
                  return (
                    <div key={doc.name} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <Icon className={`h-4 w-4 ${statusColor[status]}`} />
                        <div>
                          <p className="text-sm font-medium">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">{doc.description}</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[10px] capitalize"
                        onClick={() => {
                          setDocStatus(prev => ({ ...prev, [doc.name]: statusCycle[prev[doc.name]] }));
                        }}
                        aria-label={`${doc.name}, currently ${statusLabel[status]}. Click to change status`}
                      >
                        {statusLabel[status]}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="strategies" className="space-y-4 mt-4">
          {projectedTaxSunset.estateTax > 0 && (
            <CalculatorInsight
              title="Sunset Risk: Accelerated Gifting"
              summary={`If TCJA sunsets, your projected estate of ${fmt(projectedEstate)} at age ${lifeExpectancy} faces ${fmt(projectedTaxSunset.estateTax)} in estate tax.`}
              detail={`Consider gifting up to ${fmt(ANNUAL_GIFT_EXCLUSION)} per recipient per year (${fmt(ANNUAL_GIFT_EXCLUSION * 2)} for married couples). Over ${yearsToLE} years, gifting to 4 recipients = ${fmt(ANNUAL_GIFT_EXCLUSION * 2 * 4 * yearsToLE)} removed from estate. Also consider ILITs, GRATs, or SLATs for larger transfers.`}
              severity="warning"
              actionLabel="Discuss with Advisor"
              onAction={() => navigate("/chat")}
            />
          )}
          {lifeInsurance > 0 && (
            <CalculatorInsight
              title="ILIT Strategy for Life Insurance"
              summary={`Your ${fmt(lifeInsurance)} life insurance is currently in-estate. Moving it to an Irrevocable Life Insurance Trust (ILIT) removes it from your taxable estate.`}
              detail={`With an ILIT, the ${fmt(lifeInsurance)} death benefit passes to beneficiaries estate-tax-free. The 3-year lookback rule applies to existing policies transferred to an ILIT, so acting sooner is better. New policies purchased by the ILIT avoid the lookback entirely.`}
              severity="info"
            />
          )}
          {currentTax.headroom > 0 && (
            <CalculatorInsight
              title={`${fmt(currentTax.headroom)} of Exemption Headroom`}
              summary="Your current estate is below the federal exemption. Use this headroom strategically for lifetime gifts or Roth conversions."
              severity="success"
            />
          )}
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
