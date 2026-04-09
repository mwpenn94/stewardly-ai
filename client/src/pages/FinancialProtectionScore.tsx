/**
 * FinancialProtectionScore — Mobile-first 12-dimension questionnaire
 * Score gauge + share. Gate personalized plan behind email capture.
 */
import { useState, useMemo } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Shield, ChevronRight, ChevronLeft, Share2,
  Loader2, Heart, Home, Umbrella, FileText, DollarSign,
  TrendingUp, Users, Lock, AlertTriangle,
} from "lucide-react";

interface Dimension {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  weight: number;
  options: { label: string; value: number }[];
}

const DIMENSIONS: Dimension[] = [
  { id: "lifeInsurance", label: "Life Insurance", description: "Coverage relative to income needs", icon: <Heart className="w-5 h-5" />, weight: 12, options: [{ label: "None", value: 0 }, { label: "Some coverage", value: 40 }, { label: "Adequate (10x income)", value: 75 }, { label: "Fully optimized", value: 100 }] },
  { id: "disabilityInsurance", label: "Disability Insurance", description: "Income replacement if unable to work", icon: <Shield className="w-5 h-5" />, weight: 10, options: [{ label: "None", value: 0 }, { label: "Employer-only", value: 40 }, { label: "60%+ replacement", value: 75 }, { label: "Own-occupation policy", value: 100 }] },
  { id: "healthInsurance", label: "Health Insurance", description: "Medical coverage adequacy", icon: <Umbrella className="w-5 h-5" />, weight: 10, options: [{ label: "Uninsured", value: 0 }, { label: "High-deductible only", value: 40 }, { label: "Good plan + HSA", value: 75 }, { label: "Comprehensive", value: 100 }] },
  { id: "homeInsurance", label: "Property Insurance", description: "Home/auto/umbrella coverage", icon: <Home className="w-5 h-5" />, weight: 8, options: [{ label: "Minimal", value: 20 }, { label: "Standard", value: 50 }, { label: "Full replacement", value: 80 }, { label: "With umbrella", value: 100 }] },
  { id: "emergencyFund", label: "Emergency Fund", description: "Months of expenses in liquid savings", icon: <DollarSign className="w-5 h-5" />, weight: 10, options: [{ label: "Less than 1 month", value: 10 }, { label: "1-3 months", value: 40 }, { label: "3-6 months", value: 75 }, { label: "6+ months", value: 100 }] },
  { id: "estatePlan", label: "Estate Plan", description: "Will, trust, POA, healthcare directive", icon: <FileText className="w-5 h-5" />, weight: 8, options: [{ label: "Nothing in place", value: 0 }, { label: "Basic will only", value: 35 }, { label: "Will + POA", value: 65 }, { label: "Complete plan", value: 100 }] },
  { id: "beneficiaries", label: "Beneficiary Review", description: "All accounts have current beneficiaries", icon: <Users className="w-5 h-5" />, weight: 6, options: [{ label: "Never reviewed", value: 10 }, { label: "Some accounts", value: 40 }, { label: "Most accounts", value: 70 }, { label: "All current", value: 100 }] },
  { id: "longTermCare", label: "Long-Term Care", description: "Plan for extended care needs", icon: <Heart className="w-5 h-5" />, weight: 8, options: [{ label: "No plan", value: 0 }, { label: "Self-insure hope", value: 25 }, { label: "Hybrid policy", value: 75 }, { label: "Dedicated LTC", value: 100 }] },
  { id: "liabilityProtection", label: "Liability Protection", description: "Umbrella policy and asset protection", icon: <Lock className="w-5 h-5" />, weight: 7, options: [{ label: "None", value: 0 }, { label: "Basic auto/home", value: 35 }, { label: "Umbrella policy", value: 75 }, { label: "Full asset protection", value: 100 }] },
  { id: "identityProtection", label: "Identity Protection", description: "Credit monitoring and fraud prevention", icon: <Lock className="w-5 h-5" />, weight: 5, options: [{ label: "Nothing", value: 0 }, { label: "Free monitoring", value: 40 }, { label: "Paid service", value: 70 }, { label: "Comprehensive + freeze", value: 100 }] },
  { id: "taxEfficiency", label: "Tax Efficiency", description: "Tax-advantaged account utilization", icon: <TrendingUp className="w-5 h-5" />, weight: 8, options: [{ label: "No tax planning", value: 10 }, { label: "401k only", value: 40 }, { label: "Multiple accounts", value: 70 }, { label: "Full optimization", value: 100 }] },
  { id: "retirementReadiness", label: "Retirement Readiness", description: "On track for retirement goals", icon: <TrendingUp className="w-5 h-5" />, weight: 8, options: [{ label: "Not saving", value: 0 }, { label: "Behind target", value: 30 }, { label: "On track", value: 75 }, { label: "Ahead of target", value: 100 }] },
];

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-500";
  if (score >= 60) return "text-amber-500";
  return "text-red-500";
}

function scoreTier(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Strong";
  if (score >= 70) return "Good";
  if (score >= 60) return "Fair";
  if (score >= 40) return "Needs Attention";
  return "Critical";
}

export default function FinancialProtectionScore() {
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const totalScore = useMemo(() => {
    const totalWeight = DIMENSIONS.reduce((s, d) => s + d.weight, 0);
    const weightedSum = DIMENSIONS.reduce((s, d) => {
      const val = answers[d.id] ?? 0;
      return s + (val / 100) * d.weight;
    }, 0);
    return Math.round((weightedSum / totalWeight) * 100);
  }, [answers]);

  const weakest = useMemo(() => {
    return [...DIMENSIONS]
      .map(d => ({ ...d, score: answers[d.id] ?? 0 }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 3);
  }, [answers]);

  if (authLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Shield className="w-12 h-12 text-primary" />
          <p className="text-muted-foreground">Sign in to assess your financial protection</p>
          <Button onClick={() => { window.location.href = getLoginUrl(); }}>Sign In</Button>
        </div>
      </AppShell>
    );
  }

  // Intro
  if (step === 0) {
    return (
      <AppShell>
        <div className="container max-w-2xl py-8 space-y-6">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">Financial Protection Score</h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              Assess your financial protection across 12 critical dimensions. Takes about 3 minutes.
            </p>
          </div>
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {DIMENSIONS.map(d => (
                  <div key={d.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                    {d.icon}
                    <span>{d.label}</span>
                  </div>
                ))}
              </div>
              <Button className="w-full" size="lg" onClick={() => setStep(1)}>
                Start Assessment <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  // Results
  if (step === DIMENSIONS.length + 1) {
    const shareText = `I scored ${totalScore}/100 on my Financial Protection Score! ${scoreTier(totalScore)} rating.`;
    return (
      <AppShell>
        <div className="container max-w-2xl py-8 space-y-6">
          <div className="text-center space-y-4">
            <div className="mx-auto w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
              <span className={`text-4xl font-bold ${scoreColor(totalScore)}`}>{totalScore}</span>
            </div>
            <h1 className="text-2xl font-bold">Your Protection Score</h1>
            <Badge variant={totalScore >= 70 ? "default" : "destructive"} className="text-sm">
              {scoreTier(totalScore)}
            </Badge>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-lg">Score Breakdown</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {DIMENSIONS.map(d => {
                const val = answers[d.id] ?? 0;
                return (
                  <div key={d.id} className="relative space-y-1">
      {/* Warm gold radial glow */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.10]" style={{ background: 'radial-gradient(ellipse at 30% 50%, oklch(0.76 0.14 80) 0%, transparent 70%)' }} />
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">{d.icon} {d.label}</span>
                      <span className={scoreColor(val)}>{val}%</span>
                    </div>
                    <Progress value={val} className="h-2" />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {weakest.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Areas Needing Attention
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {weakest.map(d => (
                  <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      {d.icon}
                      <div>
                        <p className="font-medium text-sm">{d.label}</p>
                        <p className="text-xs text-muted-foreground">{d.description}</p>
                      </div>
                    </div>
                    <Badge variant="destructive">{d.score}%</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => {
              if (navigator.share) {
                navigator.share({ title: "Financial Protection Score", text: shareText }).catch(() => {});
              } else {
                navigator.clipboard.writeText(shareText);
                toast.success("Copied to clipboard!");
              }
            }}>
              <Share2 className="w-4 h-4 mr-2" /> Share
            </Button>
            <Button className="flex-1" onClick={() => { setStep(0); setAnswers({}); }}>
              Retake Assessment
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  // Question steps (1-12)
  const dim = DIMENSIONS[step - 1];
  const progress = (step / DIMENSIONS.length) * 100;

  return (
    <AppShell>
      <div className="container max-w-2xl py-8 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Question {step} of {DIMENSIONS.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                {dim.icon}
              </div>
              <div>
                <CardTitle className="text-lg">{dim.label}</CardTitle>
                <p className="text-sm text-muted-foreground">{dim.description}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={String(answers[dim.id] ?? "")}
              onValueChange={(val) => setAnswers(prev => ({ ...prev, [dim.id]: Number(val) }))}
              className="space-y-3"
            >
              {dim.options.map(opt => (
                <div key={opt.value} className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value={String(opt.value)} id={`${dim.id}-${opt.value}`} />
                  <Label htmlFor={`${dim.id}-${opt.value}`} className="flex-1 cursor-pointer">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 1}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <Button
            className="flex-1"
            onClick={() => setStep(s => s + 1)}
            disabled={answers[dim.id] === undefined}
          >
            {step === DIMENSIONS.length ? "See Results" : "Next"} <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
