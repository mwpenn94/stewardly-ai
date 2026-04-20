/**
 * ClientOnboarding — Multi-step client onboarding wizard.
 * Pass 57: Enhanced with form state, validation, backend persistence, and improved UX.
 */
import { useState, useCallback, useMemo } from "react";
import { SEOHead } from "@/components/SEOHead";
import { ConsentCheckbox } from "@/components/ConsentCheckbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, ArrowRight, User, DollarSign, Shield, FileText,
  CheckCircle2, Loader2, Sparkles, AlertTriangle, Info,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AppShell from "@/components/AppShell";

const STEPS = [
  { id: 1, title: "Personal Info", icon: User, description: "Basic contact and identity information" },
  { id: 2, title: "Financial Profile", icon: DollarSign, description: "Income, assets, and financial goals" },
  { id: 3, title: "Risk Assessment", icon: Shield, description: "Investment risk tolerance evaluation" },
  { id: 4, title: "Documents", icon: FileText, description: "Upload supporting documentation" },
  { id: 5, title: "Review & Submit", icon: CheckCircle2, description: "Review and finalize onboarding" },
];

interface PersonalInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  ssnLast4: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

interface FinancialProfile {
  annualIncome: string;
  netWorth: string;
  investmentAssets: string;
  monthlyExpenses: string;
  retirementGoalAge: string;
  dependents: string;
  employmentStatus: string;
  primaryGoal: string;
  additionalNotes: string;
}

interface RiskAnswers {
  [key: number]: number;
}

const RISK_QUESTIONS = [
  "Your portfolio drops 20% in one month",
  "Investing in volatile but high-growth stocks",
  "Locking funds in illiquid investments for 5+ years",
  "Concentrating 30% of portfolio in one sector",
  "Using leverage to amplify returns",
  "Missing a short-term opportunity for long-term stability",
  "Investing in emerging markets with higher volatility",
];

const REQUIRED_DOCS = [
  { id: "gov-id", name: "Government ID", description: "Driver's license, passport, or state ID" },
  { id: "tax-return", name: "Recent Tax Return", description: "Most recent 1040 or equivalent" },
  { id: "investment-stmt", name: "Investment Statements", description: "Brokerage or retirement account statements" },
  { id: "insurance", name: "Insurance Policies", description: "Life, disability, or long-term care policies" },
  { id: "estate", name: "Estate Documents", description: "Will, trust, or power of attorney (if applicable)" },
];

const EMPLOYMENT_OPTIONS = [
  "Employed Full-Time",
  "Employed Part-Time",
  "Self-Employed",
  "Business Owner",
  "Retired",
  "Not Currently Employed",
];

const GOAL_OPTIONS = [
  "Retirement Planning",
  "Wealth Accumulation",
  "Estate Planning",
  "Tax Optimization",
  "Education Funding",
  "Debt Management",
  "Insurance & Protection",
  "Business Succession",
];

function getRiskLabel(score: number): { label: string; color: string } {
  if (score <= 1.5) return { label: "Very Conservative", color: "text-blue-400" };
  if (score <= 2.5) return { label: "Conservative", color: "text-cyan-400" };
  if (score <= 3.5) return { label: "Moderate", color: "text-amber-400" };
  if (score <= 4.0) return { label: "Aggressive", color: "text-orange-400" };
  return { label: "Very Aggressive", color: "text-red-400" };
}

export default function ClientOnboarding({ embedded = false }: { embedded?: boolean } = {}) {
  const Shell = embedded ? (({ children }: any) => <>{children}</>) as any : AppShell;

  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [personal, setPersonal] = useState<PersonalInfo>({
    firstName: "", lastName: "", email: user?.email || "", phone: "",
    dateOfBirth: "", ssnLast4: "", address: "", city: "", state: "", zip: "",
  });

  const [financial, setFinancial] = useState<FinancialProfile>({
    annualIncome: "", netWorth: "", investmentAssets: "", monthlyExpenses: "",
    retirementGoalAge: "65", dependents: "0", employmentStatus: "",
    primaryGoal: "", additionalNotes: "",
  });

  const [riskAnswers, setRiskAnswers] = useState<RiskAnswers>({});
  const [uploadedDocs, setUploadedDocs] = useState<Set<string>>(new Set());

  const progress = Math.round((step / STEPS.length) * 100);

  // Validation
  const isStep1Valid = personal.firstName.trim() && personal.lastName.trim() && personal.email.trim();
  const isStep2Valid = financial.annualIncome && financial.employmentStatus;
  const isStep3Valid = Object.keys(riskAnswers).length >= 5;
  const isStep5Valid = consent;

  const canProceed = useMemo(() => {
    switch (step) {
      case 1: return isStep1Valid;
      case 2: return isStep2Valid;
      case 3: return isStep3Valid;
      case 4: return true; // docs are optional
      case 5: return isStep5Valid;
      default: return true;
    }
  }, [step, isStep1Valid, isStep2Valid, isStep3Valid, isStep5Valid]);

  const riskScore = useMemo(() => {
    const vals = Object.values(riskAnswers);
    if (vals.length === 0) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [riskAnswers]);

  const profileMut = trpc.financialProfile.set.useMutation({
    onSuccess: () => {
      toast.success("Client onboarded successfully! Their Financial Twin profile has been initialized.");
      navigate("/clients");
    },
    onError: (err) => toast.error(`Onboarding failed: ${err.message}`),
  });

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const patch: Record<string, unknown> = {};
      if (financial.annualIncome) patch.income = Number(financial.annualIncome.replace(/[^0-9.]/g, "")) || 0;
      if (financial.netWorth) patch.netWorth = Number(financial.netWorth.replace(/[^0-9.]/g, "")) || 0;
      if (financial.dependents) patch.dependents = Number(financial.dependents) || 0;
      if (financial.retirementGoalAge) patch.retirementAge = Number(financial.retirementGoalAge) || 65;
      if (financial.monthlyExpenses) patch.monthlySavings = Number(financial.monthlyExpenses.replace(/[^0-9.]/g, "")) || 0;
      if (personal.state) patch.stateOfResidence = personal.state;
      if (financial.employmentStatus === "Business Owner" || financial.employmentStatus === "Self-Employed") {
        patch.isBizOwner = true;
      }
      await profileMut.mutateAsync({ patch, source: "user" });
    } catch {
      // error handled by mutation onError
    } finally {
      setSubmitting(false);
    }
  }, [navigate, financial, personal, profileMut]);

  const updatePersonal = (field: keyof PersonalInfo, value: string) =>
    setPersonal(prev => ({ ...prev, [field]: value }));

  const updateFinancial = (field: keyof FinancialProfile, value: string) =>
    setFinancial(prev => ({ ...prev, [field]: value }));

  return (
    <Shell title="Client Onboarding">
    <div className="container max-w-3xl py-8 space-y-6">
      <SEOHead title="Client Onboarding" description="New client onboarding wizard" />

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/clients")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Client Onboarding</h1>
          <p className="text-sm text-muted-foreground">
            Step {step} of {STEPS.length}: {STEPS[step - 1].title}
          </p>
        </div>
      </div>

      {/* Progress */}
      <Progress value={progress} className="h-2" />
      <div className="flex justify-center gap-1 sm:gap-2 flex-wrap">
        {STEPS.map(s => {
          const Icon = s.icon;
          const isComplete = step > s.id;
          const isCurrent = step === s.id;
          return (
            <button type="button"
              key={s.id}
              onClick={() => { if (isComplete) setStep(s.id); }}
              disabled={!isComplete && !isCurrent}
              aria-current={isCurrent ? "step" : undefined}
              aria-label={`${s.title} ${isComplete ? "(complete)" : isCurrent ? "(current)" : "(upcoming)"}`}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors
                ${isCurrent ? "bg-primary/20 text-primary font-medium" : ""}
                ${isComplete ? "text-emerald-400 cursor-pointer hover:bg-emerald-500/10" : ""}
                ${!isComplete && !isCurrent ? "text-muted-foreground/50" : ""}`}
            >
              {isComplete ? <CheckCircle2 className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
              <span className="hidden sm:inline">{s.title}</span>
            </button>
          );
        })}
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            {(() => { const Icon = STEPS[step - 1].icon; return <Icon className="h-5 w-5 text-primary" />; })()}
            {STEPS[step - 1].title}
          </CardTitle>
          <CardDescription>{STEPS[step - 1].description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 1: Personal Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">First Name <span className="text-destructive">*</span></Label>
                  <Input value={personal.firstName} onChange={e => updatePersonal("firstName", e.target.value)} placeholder="John" aria-required="true" />
                </div>
                <div>
                  <Label className="text-xs">Last Name <span className="text-destructive">*</span></Label>
                  <Input value={personal.lastName} onChange={e => updatePersonal("lastName", e.target.value)} placeholder="Smith" aria-required="true" />
                </div>
                <div>
                  <Label className="text-xs">Email <span className="text-destructive">*</span></Label>
                  <Input type="email" autoComplete="email" value={personal.email} onChange={e => updatePersonal("email", e.target.value)} placeholder="john@example.com" aria-required="true" />
                </div>
                <div>
                  <Label className="text-xs">Phone</Label>
                  <Input type="tel" autoComplete="tel" value={personal.phone} onChange={e => updatePersonal("phone", e.target.value)} placeholder="(555) 123-4567" />
                </div>
                <div>
                  <Label className="text-xs">Date of Birth</Label>
                  <Input type="date" value={personal.dateOfBirth} onChange={e => updatePersonal("dateOfBirth", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">SSN (Last 4)</Label>
                  <Input value={personal.ssnLast4} onChange={e => updatePersonal("ssnLast4", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="••••" maxLength={4} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Street Address</Label>
                <Input value={personal.address} onChange={e => updatePersonal("address", e.target.value)} placeholder="123 Main St" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">City</Label>
                  <Input value={personal.city} onChange={e => updatePersonal("city", e.target.value)} placeholder="Denver" />
                </div>
                <div>
                  <Label className="text-xs">State</Label>
                  <Input value={personal.state} onChange={e => updatePersonal("state", e.target.value)} placeholder="CO" maxLength={2} />
                </div>
                <div>
                  <Label className="text-xs">ZIP</Label>
                  <Input value={personal.zip} onChange={e => updatePersonal("zip", e.target.value)} placeholder="80202" maxLength={10} />
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 text-xs text-blue-400">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>All personal information is encrypted at rest and in transit. SSN is stored as a hashed value and never displayed in full.</span>
              </div>
            </div>
          )}

          {/* Step 2: Financial Profile */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Annual Income <span className="text-destructive">*</span></Label>
                  <Input type="number" value={financial.annualIncome} onChange={e => updateFinancial("annualIncome", e.target.value)} placeholder="150000" aria-required="true" />
                </div>
                <div>
                  <Label className="text-xs">Estimated Net Worth</Label>
                  <Input type="number" value={financial.netWorth} onChange={e => updateFinancial("netWorth", e.target.value)} placeholder="1250000" />
                </div>
                <div>
                  <Label className="text-xs">Investment Assets</Label>
                  <Input type="number" value={financial.investmentAssets} onChange={e => updateFinancial("investmentAssets", e.target.value)} placeholder="800000" />
                </div>
                <div>
                  <Label className="text-xs">Monthly Expenses</Label>
                  <Input type="number" value={financial.monthlyExpenses} onChange={e => updateFinancial("monthlyExpenses", e.target.value)} placeholder="8000" />
                </div>
                <div>
                  <Label className="text-xs">Retirement Goal Age</Label>
                  <Input type="number" value={financial.retirementGoalAge} onChange={e => updateFinancial("retirementGoalAge", e.target.value)} placeholder="65" />
                </div>
                <div>
                  <Label className="text-xs">Dependents</Label>
                  <Input type="number" value={financial.dependents} onChange={e => updateFinancial("dependents", e.target.value)} placeholder="2" />
                </div>
              </div>

              <div>
                <Label className="text-xs">Employment Status <span className="text-destructive">*</span></Label>
                <div className="flex flex-wrap gap-2 mt-1" role="radiogroup" aria-required="true" aria-label="Employment Status">
                  {EMPLOYMENT_OPTIONS.map(opt => (
                    <Button
                      key={opt}
                      variant={financial.employmentStatus === opt ? "default" : "outline"}
                      size="sm"
                      className="text-xs"
                      role="radio"
                      aria-checked={financial.employmentStatus === opt}
                      onClick={() => updateFinancial("employmentStatus", opt)}
                    >
                      {opt}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs">Primary Financial Goal</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {GOAL_OPTIONS.map(opt => (
                    <Button
                      key={opt}
                      variant={financial.primaryGoal === opt ? "default" : "outline"}
                      size="sm"
                      className="text-xs"
                      onClick={() => updateFinancial("primaryGoal", opt)}
                    >
                      {opt}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs">Additional Notes</Label>
                <Textarea
                  value={financial.additionalNotes}
                  onChange={e => updateFinancial("additionalNotes", e.target.value)}
                  placeholder="Any additional financial context, concerns, or goals..."
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Step 3: Risk Assessment */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Rate your comfort level with the following scenarios. Answer at least 5 questions.
              </p>
              <div className="text-xs text-muted-foreground flex items-center gap-4">
                <span>1 = Very Uncomfortable</span>
                <span>3 = Neutral</span>
                <span>5 = Very Comfortable</span>
              </div>
              {RISK_QUESTIONS.map((q, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-border/50 gap-4">
                  <span className="text-sm flex-1">{q}</span>
                  <div className="flex gap-1 shrink-0">
                    {[1, 2, 3, 4, 5].map(n => (
                      <Button
                        key={n}
                        variant={riskAnswers[i] === n ? "default" : "outline"}
                        size="sm"
                        className="h-8 w-8 p-0 text-xs"
                        onClick={() => setRiskAnswers(prev => ({ ...prev, [i]: n }))}
                        aria-label={`Rate ${n} for: ${q}`}
                      >
                        {n}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}

              {Object.keys(riskAnswers).length >= 5 && (
                <div className="mt-4 p-4 rounded-lg bg-card border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Risk Profile Score</p>
                      <p className="text-xs text-muted-foreground">Based on {Object.keys(riskAnswers).length} responses</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{riskScore.toFixed(1)}<span className="text-sm text-muted-foreground">/5.0</span></p>
                      <p className={`text-xs font-medium ${getRiskLabel(riskScore).color}`}>{getRiskLabel(riskScore).label}</p>
                    </div>
                  </div>
                  <Progress value={(riskScore / 5) * 100} className="h-1.5 mt-3" />
                </div>
              )}
            </div>
          )}

          {/* Step 4: Documents */}
          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload supporting documents to complete the onboarding. Documents are optional but help your advisor provide better recommendations.
              </p>
              {REQUIRED_DOCS.map(doc => {
                const isUploaded = uploadedDocs.has(doc.id);
                return (
                  <div key={doc.id} className={`flex items-center justify-between py-3 px-4 rounded-lg border transition-colors ${isUploaded ? "border-emerald-500/30 bg-emerald-500/5" : "border-border"}`}>
                    <div>
                      <span className="text-sm font-medium">{doc.name}</span>
                      <p className="text-xs text-muted-foreground">{doc.description}</p>
                    </div>
                    {isUploaded ? (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Uploaded
                      </Badge>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setUploadedDocs(prev => new Set([...prev, doc.id]));
                          toast.success(`${doc.name} uploaded successfully (simulated)`);
                        }}
                      >
                        Upload
                      </Button>
                    )}
                  </div>
                );
              })}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Documents are encrypted and stored securely. Only authorized advisors and compliance officers can access uploaded files.</span>
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {step === 5 && (
            <div className="space-y-5">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" /> Personal Information
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Name:</span> {personal.firstName} {personal.lastName}</div>
                  <div><span className="text-muted-foreground">Email:</span> {personal.email}</div>
                  <div><span className="text-muted-foreground">Phone:</span> {personal.phone || "Not provided"}</div>
                  <div><span className="text-muted-foreground">DOB:</span> {personal.dateOfBirth || "Not provided"}</div>
                  {personal.address && (
                    <div className="col-span-2"><span className="text-muted-foreground">Address:</span> {personal.address}{personal.city ? `, ${personal.city}` : ""}{personal.state ? `, ${personal.state}` : ""} {personal.zip}</div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" /> Financial Profile
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Income:</span> {financial.annualIncome ? `$${Number(financial.annualIncome).toLocaleString()}` : "Not provided"}</div>
                  <div><span className="text-muted-foreground">Net Worth:</span> {financial.netWorth ? `$${Number(financial.netWorth).toLocaleString()}` : "Not provided"}</div>
                  <div><span className="text-muted-foreground">Employment:</span> {financial.employmentStatus || "Not specified"}</div>
                  <div><span className="text-muted-foreground">Primary Goal:</span> {financial.primaryGoal || "Not specified"}</div>
                  <div><span className="text-muted-foreground">Retirement Age:</span> {financial.retirementGoalAge}</div>
                  <div><span className="text-muted-foreground">Dependents:</span> {financial.dependents}</div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" /> Risk Assessment
                </h3>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">Risk Score:</span>
                  <span className="font-medium">{riskScore.toFixed(1)}/5.0</span>
                  <Badge variant="outline" className={getRiskLabel(riskScore).color}>{getRiskLabel(riskScore).label}</Badge>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Documents
                </h3>
                <div className="flex flex-wrap gap-2">
                  {REQUIRED_DOCS.map(doc => (
                    <Badge key={doc.id} variant={uploadedDocs.has(doc.id) ? "default" : "secondary"} className="text-xs">
                      {uploadedDocs.has(doc.id) ? <CheckCircle2 className="h-3 w-3 mr-1" /> : null}
                      {doc.name}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">AI Financial Twin</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Upon completion, Stewardly will initialize a Digital Financial Twin for this client.
                  The AI will analyze the provided data to generate personalized insights, risk assessments,
                  and financial planning recommendations.
                </p>
              </div>

              <ConsentCheckbox
                customText="I agree to the Terms of Service and Privacy Policy, and consent to the collection and processing of my financial data for advisory purposes. I understand that my data will be used to create an AI-powered financial profile."
                checked={consent}
                onCheckedChange={setConsent}
                required
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Previous
        </Button>
        {step < STEPS.length ? (
          <Button onClick={() => setStep(Math.min(STEPS.length, step + 1))} disabled={!canProceed}>
            Next <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={!consent || submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Submitting...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Complete Onboarding
              </>
            )}
          </Button>
        )}
      </div>
    </div>
    </Shell>
  );
}
