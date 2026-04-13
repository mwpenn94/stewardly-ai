/**
 * ClientOnboarding — Multi-step client onboarding wizard.
 * Collects personal info, financial data, risk profile, and document uploads.
 * All form data is now controlled via useState and synced to the shared
 * financial profile on step 2 so cross-calculator data bridge works.
 */
import { useState, useCallback } from "react";
import { SEOHead } from "@/components/SEOHead";
import { ConsentCheckbox } from "@/components/ConsentCheckbox";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, User, DollarSign, Shield, FileText, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { useFinancialProfile } from "@/hooks/useFinancialProfile";

const STEPS = [
  { id: 1, title: "Personal Info", icon: User },
  { id: 2, title: "Financial Profile", icon: DollarSign },
  { id: 3, title: "Risk Assessment", icon: Shield },
  { id: 4, title: "Documents", icon: FileText },
  { id: 5, title: "Review", icon: CheckCircle2 },
];

interface PersonalInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  ssnLast4: string;
  address: string;
}

interface FinancialInfo {
  annualIncome: string;
  netWorth: string;
  investmentAssets: string;
  monthlyExpenses: string;
  retirementAge: string;
  dependents: string;
}

const RISK_QUESTIONS = [
  "Your portfolio drops 20% in one month",
  "Investing in volatile but high-growth stocks",
  "Locking funds in illiquid investments for 5+ years",
  "Concentrating 30% of portfolio in one sector",
  "Using leverage to amplify returns",
];

const REQUIRED_DOCS = [
  "Government ID",
  "Recent Tax Return",
  "Investment Statements",
  "Insurance Policies",
  "Estate Documents",
];

export default function ClientOnboarding() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [consent, setConsent] = useState(false);
  const { profile, setProfile } = useFinancialProfile();
  const progress = Math.round((step / STEPS.length) * 100);

  // Step 1: Personal Info
  const [personal, setPersonal] = useState<PersonalInfo>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dob: "",
    ssnLast4: "",
    address: "",
  });

  // Step 2: Financial Profile
  const [financial, setFinancial] = useState<FinancialInfo>({
    annualIncome: profile.annualIncome?.toString() ?? "",
    netWorth: profile.netWorth?.toString() ?? "",
    investmentAssets: "",
    monthlyExpenses: "",
    retirementAge: profile.retirementAge?.toString() ?? "65",
    dependents: "",
  });

  // Step 3: Risk scores (index → selected rating 1-5, 0 = not set)
  const [riskScores, setRiskScores] = useState<number[]>(
    new Array(RISK_QUESTIONS.length).fill(0)
  );

  const updatePersonal = useCallback(
    (field: keyof PersonalInfo, value: string) =>
      setPersonal((p) => ({ ...p, [field]: value })),
    []
  );

  const updateFinancial = useCallback(
    (field: keyof FinancialInfo, value: string) =>
      setFinancial((f) => ({ ...f, [field]: value })),
    []
  );

  const handleRiskScore = useCallback((questionIndex: number, score: number) => {
    setRiskScores((prev) => {
      const next = [...prev];
      next[questionIndex] = prev[questionIndex] === score ? 0 : score;
      return next;
    });
  }, []);

  // Sync financial data to the shared profile when leaving step 2
  const syncFinancialProfile = useCallback(() => {
    const income = parseInt(financial.annualIncome, 10);
    const nw = parseInt(financial.netWorth, 10);
    const retAge = parseInt(financial.retirementAge, 10);
    setProfile({
      ...profile,
      ...(income > 0 ? { annualIncome: income } : {}),
      ...(nw > 0 ? { netWorth: nw } : {}),
      ...(retAge > 0 ? { retirementAge: retAge } : {}),
    });
  }, [financial, profile, setProfile]);

  const handleNext = useCallback(() => {
    if (step === 1) {
      if (!personal.firstName.trim() || !personal.lastName.trim() || !personal.email.trim()) {
        toast.error("Please fill in at least First Name, Last Name, and Email.");
        return;
      }
    }
    if (step === 2) {
      syncFinancialProfile();
    }
    setStep((s) => Math.min(STEPS.length, s + 1));
  }, [step, personal, syncFinancialProfile]);

  const handleComplete = useCallback(() => {
    if (step === 2) syncFinancialProfile();
    toast.success("Client onboarded successfully! Financial data synced across calculators.");
    navigate("/chat");
  }, [step, syncFinancialProfile, navigate]);

  const riskAvg = riskScores.filter((s) => s > 0).length > 0
    ? (riskScores.reduce((a, b) => a + b, 0) / riskScores.filter((s) => s > 0).length).toFixed(1)
    : "—";

  return (
    <AppShell title="Onboarding">
    <div className="container max-w-2xl py-6 px-4 sm:py-8 space-y-6">
      <SEOHead title="Client Onboarding" description="New client onboarding wizard" />

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/chat")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-heading">Client Onboarding</h1>
          <p className="text-sm text-muted-foreground">Step {step} of {STEPS.length}: {STEPS[step - 1].title}</p>
        </div>
      </div>

      <Progress value={progress} className="h-2" />

      <div className="flex justify-center gap-1 sm:gap-2 flex-wrap">
        {STEPS.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.id}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                step === s.id
                  ? "bg-accent/15 text-accent"
                  : step > s.id
                    ? "text-emerald-400"
                    : "text-muted-foreground"
              }`}
            >
              <Icon className="h-3 w-3" />
              <span className="hidden sm:inline">{s.title}</span>
            </div>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6">
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">First Name *</Label>
                  <Input value={personal.firstName} onChange={(e) => updatePersonal("firstName", e.target.value)} placeholder="John" />
                </div>
                <div>
                  <Label className="text-xs">Last Name *</Label>
                  <Input value={personal.lastName} onChange={(e) => updatePersonal("lastName", e.target.value)} placeholder="Smith" />
                </div>
                <div>
                  <Label className="text-xs">Email *</Label>
                  <Input type="email" value={personal.email} onChange={(e) => updatePersonal("email", e.target.value)} placeholder="john@example.com" />
                </div>
                <div>
                  <Label className="text-xs">Phone</Label>
                  <Input type="tel" value={personal.phone} onChange={(e) => updatePersonal("phone", e.target.value)} placeholder="(555) 123-4567" />
                </div>
                <div>
                  <Label className="text-xs">Date of Birth</Label>
                  <Input type="date" value={personal.dob} onChange={(e) => updatePersonal("dob", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">SSN (Last 4)</Label>
                  <Input value={personal.ssnLast4} onChange={(e) => updatePersonal("ssnLast4", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="••••" maxLength={4} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Address</Label>
                <Input value={personal.address} onChange={(e) => updatePersonal("address", e.target.value)} placeholder="123 Main St, Denver, CO 80202" />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Annual Income</Label>
                  <Input type="number" value={financial.annualIncome} onChange={(e) => updateFinancial("annualIncome", e.target.value)} placeholder="150000" />
                </div>
                <div>
                  <Label className="text-xs">Net Worth</Label>
                  <Input type="number" value={financial.netWorth} onChange={(e) => updateFinancial("netWorth", e.target.value)} placeholder="1250000" />
                </div>
                <div>
                  <Label className="text-xs">Investment Assets</Label>
                  <Input type="number" value={financial.investmentAssets} onChange={(e) => updateFinancial("investmentAssets", e.target.value)} placeholder="800000" />
                </div>
                <div>
                  <Label className="text-xs">Monthly Expenses</Label>
                  <Input type="number" value={financial.monthlyExpenses} onChange={(e) => updateFinancial("monthlyExpenses", e.target.value)} placeholder="8000" />
                </div>
                <div>
                  <Label className="text-xs">Retirement Goal Age</Label>
                  <Input type="number" value={financial.retirementAge} onChange={(e) => updateFinancial("retirementAge", e.target.value)} placeholder="65" />
                </div>
                <div>
                  <Label className="text-xs">Dependents</Label>
                  <Input type="number" value={financial.dependents} onChange={(e) => updateFinancial("dependents", e.target.value)} placeholder="2" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Financial data will sync to your shared profile, pre-populating calculators across the platform.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Rate your comfort level (1 = Very Uncomfortable, 5 = Very Comfortable):</p>
              {RISK_QUESTIONS.map((q, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between py-2 gap-2 border-b border-border/50">
                  <span className="text-sm">{q}</span>
                  <div className="flex gap-1 shrink-0">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Button
                        key={n}
                        variant={riskScores[i] === n ? "default" : "outline"}
                        size="sm"
                        className="h-7 w-7 p-0 text-xs"
                        onClick={() => handleRiskScore(i, n)}
                        aria-label={`Rate ${n} for: ${q}`}
                        aria-pressed={riskScores[i] === n}
                      >
                        {n}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Average risk tolerance: <strong>{riskAvg}</strong> / 5
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Upload the following documents to complete onboarding:</p>
              {REQUIRED_DOCS.map((doc) => (
                <div key={doc} className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-sm">{doc}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    title="Document upload requires server-side processing configuration"
                  >
                    Upload
                  </Button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Document upload will be available once server-side processing is configured.
              </p>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Review your information and agree to the terms.</p>

              {/* Summary */}
              <div className="space-y-3 text-sm">
                <div className="p-3 rounded-lg bg-card/50 border border-border/30">
                  <p className="font-medium text-xs text-muted-foreground uppercase tracking-wider mb-2">Personal Info</p>
                  <p>{personal.firstName} {personal.lastName}</p>
                  {personal.email && <p className="text-muted-foreground">{personal.email}</p>}
                  {personal.phone && <p className="text-muted-foreground">{personal.phone}</p>}
                </div>

                <div className="p-3 rounded-lg bg-card/50 border border-border/30">
                  <p className="font-medium text-xs text-muted-foreground uppercase tracking-wider mb-2">Financial Profile</p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    {financial.annualIncome && <p>Income: ${Number(financial.annualIncome).toLocaleString()}</p>}
                    {financial.netWorth && <p>Net Worth: ${Number(financial.netWorth).toLocaleString()}</p>}
                    {financial.investmentAssets && <p>Investments: ${Number(financial.investmentAssets).toLocaleString()}</p>}
                    {financial.retirementAge && <p>Retirement Age: {financial.retirementAge}</p>}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-card/50 border border-border/30">
                  <p className="font-medium text-xs text-muted-foreground uppercase tracking-wider mb-2">Risk Profile</p>
                  <p>Average tolerance: <strong>{riskAvg}</strong> / 5</p>
                  <p className="text-xs text-muted-foreground">
                    {Number(riskAvg) >= 4 ? "Aggressive" : Number(riskAvg) >= 3 ? "Moderate" : Number(riskAvg) >= 2 ? "Conservative" : "Not assessed"}
                  </p>
                </div>
              </div>

              <ConsentCheckbox
                customText="I agree to the Terms of Service and Privacy Policy, and consent to the collection and processing of my financial data for advisory purposes."
                checked={consent}
                onCheckedChange={setConsent}
                required
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Previous
        </Button>
        {step < STEPS.length ? (
          <Button onClick={handleNext}>
            Next <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleComplete} disabled={!consent}>
            <CheckCircle2 className="h-4 w-4 mr-1" /> Complete Onboarding
          </Button>
        )}
      </div>
    </div>
    </AppShell>
  );
}
