/**
 * PublicCalculators — Public-facing financial calculators with lead capture.
 * Embeddable calculators for retirement, tax, insurance, and estate planning.
 */
import { useState } from "react";
import { SEOHead } from "@/components/SEOHead";
import { LeadCaptureGate } from "@/components/LeadCaptureGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, DollarSign, PiggyBank, TrendingUp, Shield, Heart } from "lucide-react";
import { toast } from "sonner";

function RetirementCalculator() {
  const [age, setAge] = useState(35);
  const [retireAge, setRetireAge] = useState(65);
  const [savings, setSavings] = useState(250000);
  const [monthly, setMonthly] = useState(1500);
  const [result, setResult] = useState<number | null>(null);

  const calculate = () => {
    const years = retireAge - age;
    const rate = 0.07 / 12;
    const months = years * 12;
    const fv = savings * Math.pow(1 + rate, months) + monthly * ((Math.pow(1 + rate, months) - 1) / rate);
    setResult(Math.round(fv));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2"><PiggyBank className="h-4 w-4" /> Retirement Savings Calculator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Current Age</Label><Input type="number" value={age} onChange={e => setAge(+e.target.value)} /></div>
          <div><Label className="text-xs">Retirement Age</Label><Input type="number" value={retireAge} onChange={e => setRetireAge(+e.target.value)} /></div>
          <div><Label className="text-xs">Current Savings ($)</Label><Input type="number" value={savings} onChange={e => setSavings(+e.target.value)} /></div>
          <div><Label className="text-xs">Monthly Contribution ($)</Label><Input type="number" value={monthly} onChange={e => setMonthly(+e.target.value)} /></div>
        </div>
        <Button onClick={calculate} className="w-full"><Calculator className="h-4 w-4 mr-1" /> Calculate</Button>
        {result !== null && (
          <div className="p-3 bg-muted/30 rounded-lg text-center">
            <p className="text-xs text-muted-foreground">Projected Retirement Savings</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-primary">${result.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">Assuming 7% average annual return</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TaxBracketCalculator() {
  const [income, setIncome] = useState(150000);
  const [result, setResult] = useState<{ effective: string; marginal: string; tax: number } | null>(null);

  const calculate = () => {
    const brackets = [
      { min: 0, max: 23850, rate: 0.10 },
      { min: 23850, max: 96950, rate: 0.12 },
      { min: 96950, max: 206700, rate: 0.22 },
      { min: 206700, max: 394600, rate: 0.24 },
      { min: 394600, max: 501050, rate: 0.32 },
      { min: 501050, max: 751600, rate: 0.35 },
      { min: 751600, max: Infinity, rate: 0.37 },
    ];
    let tax = 0;
    let marginal = "10%";
    for (const b of brackets) {
      if (income > b.min) {
        const taxable = Math.min(income, b.max) - b.min;
        tax += taxable * b.rate;
        marginal = `${b.rate * 100}%`;
      }
    }
    setResult({ effective: `${(tax / income * 100).toFixed(1)}%`, marginal, tax: Math.round(tax) });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" /> Tax Bracket Calculator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div><Label className="text-xs">Taxable Income (MFJ)</Label><Input type="number" value={income} onChange={e => setIncome(+e.target.value)} /></div>
        <Button onClick={calculate} className="w-full"><Calculator className="h-4 w-4 mr-1" /> Calculate</Button>
        {result && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground">Federal Tax</p>
              <p className="text-lg font-bold">${result.tax.toLocaleString()}</p>
            </div>
            <div className="p-2 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground">Effective Rate</p>
              <p className="text-lg font-bold">{result.effective}</p>
            </div>
            <div className="p-2 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground">Marginal Rate</p>
              <p className="text-lg font-bold">{result.marginal}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PublicCalculators() {
  const [gated, setGated] = useState(false);

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <SEOHead title="Financial Calculators" description="Free financial planning calculators for retirement, tax, and insurance analysis" />

      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Financial Calculators</h1>
        <p className="text-muted-foreground max-w-lg mx-auto">Free tools to help you plan your financial future. Get personalized results and expert insights.</p>
      </div>

      <Tabs defaultValue="retirement">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="retirement">Retirement</TabsTrigger>
          <TabsTrigger value="tax">Tax Brackets</TabsTrigger>
        </TabsList>

        <TabsContent value="retirement" className="mt-4">
          <RetirementCalculator />
        </TabsContent>
        <TabsContent value="tax" className="mt-4">
          <TaxBracketCalculator />
        </TabsContent>
      </Tabs>

      {!gated && (
        <LeadCaptureGate
          title="Get Your Personalized Financial Plan"
          description="Enter your email to receive a detailed analysis based on your calculator results, plus access to advanced planning tools."
          onCapture={(email) => {
            setGated(true);
            toast.success(`Analysis sent to ${email}`);
          }}
        >
          <div className="text-sm text-muted-foreground text-center p-4">Advanced planning tools and personalized analysis will appear here.</div>
        </LeadCaptureGate>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: Shield, title: "Insurance Needs", desc: "Calculate your coverage gaps" },
          { icon: Heart, title: "Medicare Costs", desc: "Estimate IRMAA surcharges" },
          { icon: TrendingUp, title: "Social Security", desc: "Optimize claiming strategy" },
        ].map(c => (
          <Card key={c.title} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => toast.info("Calculator coming soon")}>
            <CardContent className="p-4 flex items-center gap-3">
              <c.icon className="h-8 w-8 text-primary/60" />
              <div>
                <p className="text-sm font-medium">{c.title}</p>
                <p className="text-xs text-muted-foreground">{c.desc}</p>
              </div>
              <Badge variant="outline" className="ml-auto text-[10px]">Soon</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
