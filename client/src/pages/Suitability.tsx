import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { ArrowLeft, Shield, CheckCircle, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";

const FINANCIAL_GOALS = [
  "Retirement planning", "Wealth accumulation", "Estate planning",
  "Education funding", "Business succession", "Tax optimization",
  "Income protection", "Legacy planning",
];

const INSURANCE_NEEDS = [
  "Life insurance", "Disability insurance", "Long-term care",
  "Key person insurance", "Buy-sell funding", "Premium financing",
  "Executive benefits", "Charitable giving",
];

export default function Suitability() {
  useAuth({ redirectOnUnauthenticated: true });
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const existing = trpc.suitability.get.useQuery();
  const submit = trpc.suitability.submit.useMutation({
    onSuccess: () => {
      toast.success("Suitability assessment completed");
      utils.suitability.get.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const [risk, setRisk] = useState<"conservative" | "moderate" | "aggressive">("moderate");
  const [horizon, setHorizon] = useState("10-20 years");
  const [income, setIncome] = useState("$100,000 - $250,000");
  const [netWorth, setNetWorth] = useState("$250,000 - $1,000,000");
  const [experience, setExperience] = useState<"none" | "limited" | "moderate" | "extensive">("moderate");
  const [goals, setGoals] = useState<string[]>([]);
  const [needs, setNeeds] = useState<string[]>([]);

  const toggleGoal = (g: string) => setGoals(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  const toggleNeed = (n: string) => setNeeds(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]);

  const handleSubmit = () => {
    if (goals.length === 0) { toast.error("Please select at least one financial goal"); return; }
    submit.mutate({ riskTolerance: risk, investmentHorizon: horizon, annualIncome: income, netWorth, investmentExperience: experience, financialGoals: goals, insuranceNeeds: needs });
  };

  if (existing.data?.completedAt) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border bg-card/30 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="font-semibold text-sm">Suitability Assessment</span>
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Assessment Complete</h2>
          <p className="text-muted-foreground text-sm mb-2">Your suitability profile is active. The AI can now provide personalized financial guidance.</p>
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto text-left">
            <div className="p-3 rounded-lg bg-card border border-border">
              <p className="text-[10px] text-muted-foreground">Risk</p>
              <p className="text-sm font-medium capitalize">{existing.data.riskTolerance}</p>
            </div>
            <div className="p-3 rounded-lg bg-card border border-border">
              <p className="text-[10px] text-muted-foreground">Horizon</p>
              <p className="text-sm font-medium">{existing.data.investmentHorizon}</p>
            </div>
            <div className="p-3 rounded-lg bg-card border border-border">
              <p className="text-[10px] text-muted-foreground">Experience</p>
              <p className="text-sm font-medium capitalize">{existing.data.investmentExperience}</p>
            </div>
            <div className="p-3 rounded-lg bg-card border border-border">
              <p className="text-[10px] text-muted-foreground">Income</p>
              <p className="text-sm font-medium">{existing.data.annualIncome}</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 mt-8">
            <Button variant="outline" onClick={() => navigate("/chat")} className="text-sm">Go to Chat</Button>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90 text-sm" onClick={() => { /* allow retake by clearing existing */ existing.data!.completedAt = null as any; }}>Retake Assessment</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/30 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="font-semibold text-sm">Suitability Assessment</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
            <Shield className="w-6 h-6 text-accent" />
          </div>
          <h1 className="text-xl font-semibold mb-1">Financial Suitability Profile</h1>
          <p className="text-muted-foreground text-sm">Complete this assessment to unlock personalized financial guidance from your AI.</p>
        </div>

        {/* Risk Tolerance */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Risk Tolerance</CardTitle></CardHeader>
          <CardContent>
            <RadioGroup value={risk} onValueChange={(v) => setRisk(v as typeof risk)} className="space-y-2">
              {[
                { value: "conservative", label: "Conservative", desc: "Prefer stability and capital preservation" },
                { value: "moderate", label: "Moderate", desc: "Balance between growth and stability" },
                { value: "aggressive", label: "Aggressive", desc: "Prioritize growth, accept higher volatility" },
              ].map(opt => (
                <label key={opt.value} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-secondary/50 cursor-pointer transition-colors">
                  <RadioGroupItem value={opt.value} className="mt-0.5" />
                  <div><p className="text-sm font-medium">{opt.label}</p><p className="text-xs text-muted-foreground">{opt.desc}</p></div>
                </label>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Financial Details */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Financial Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs mb-1.5 block">Investment Horizon</Label>
                <Select value={horizon} onValueChange={setHorizon}>
                  <SelectTrigger className="bg-secondary border-border h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Less than 5 years", "5-10 years", "10-20 years", "20+ years"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Annual Income</Label>
                <Select value={income} onValueChange={setIncome}>
                  <SelectTrigger className="bg-secondary border-border h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Under $50,000", "$50,000 - $100,000", "$100,000 - $250,000", "$250,000 - $500,000", "$500,000 - $1,000,000", "Over $1,000,000"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Net Worth</Label>
                <Select value={netWorth} onValueChange={setNetWorth}>
                  <SelectTrigger className="bg-secondary border-border h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Under $100,000", "$100,000 - $250,000", "$250,000 - $1,000,000", "$1,000,000 - $5,000,000", "Over $5,000,000"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Investment Experience</Label>
                <Select value={experience} onValueChange={(v) => setExperience(v as typeof experience)}>
                  <SelectTrigger className="bg-secondary border-border h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[{ v: "none", l: "None" }, { v: "limited", l: "Limited" }, { v: "moderate", l: "Moderate" }, { v: "extensive", l: "Extensive" }].map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial Goals */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Financial Goals</CardTitle><CardDescription className="text-xs">Select all that apply</CardDescription></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FINANCIAL_GOALS.map(g => (
                <label key={g} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border hover:bg-secondary/50 cursor-pointer transition-colors">
                  <Checkbox checked={goals.includes(g)} onCheckedChange={() => toggleGoal(g)} />
                  <span className="text-sm">{g}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Insurance Needs */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Insurance Needs</CardTitle><CardDescription className="text-xs">Select all that apply</CardDescription></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {INSURANCE_NEEDS.map(n => (
                <label key={n} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border hover:bg-secondary/50 cursor-pointer transition-colors">
                  <Checkbox checked={needs.includes(n)} onCheckedChange={() => toggleNeed(n)} />
                  <span className="text-sm">{n}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90 h-11 text-sm" onClick={handleSubmit} disabled={submit.isPending}>
          {submit.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
          Complete Assessment
        </Button>

        <p className="text-[10px] text-muted-foreground text-center">
          This information is used solely to personalize your AI experience and is protected by our privacy policy.
        </p>
      </div>
    </div>
  );
}
