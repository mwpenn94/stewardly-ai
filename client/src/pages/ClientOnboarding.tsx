/**
 * ClientOnboarding — Multi-step client onboarding wizard.
 * Collects personal info, financial data, risk profile, and document uploads.
 */
import { useState } from "react";
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

const STEPS = [
  { id: 1, title: "Personal Info", icon: User },
  { id: 2, title: "Financial Profile", icon: DollarSign },
  { id: 3, title: "Risk Assessment", icon: Shield },
  { id: 4, title: "Documents", icon: FileText },
  { id: 5, title: "Review", icon: CheckCircle2 },
];

export default function ClientOnboarding() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [consent, setConsent] = useState(false);
  const progress = Math.round((step / STEPS.length) * 100);

  return (
    <AppShell title="Onboarding">
    <div className="container max-w-2xl py-8 space-y-6">
      <SEOHead title="Client Onboarding" description="New client onboarding wizard" />

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/clients")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Client Onboarding</h1>
          <p className="text-sm text-muted-foreground">Step {step} of {STEPS.length}: {STEPS[step - 1].title}</p>
        </div>
      </div>

      <Progress value={progress} className="h-2" />

      <div className="flex justify-center gap-2">
        {STEPS.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.id} className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${step === s.id ? "bg-primary/20 text-primary" : step > s.id ? "text-emerald-400" : "text-muted-foreground"}`}>
              <Icon className="h-3 w-3" />
              <span className="hidden sm:inline">{s.title}</span>
            </div>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-6">
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">First Name</Label><Input placeholder="John" /></div>
                <div><Label className="text-xs">Last Name</Label><Input placeholder="Smith" /></div>
                <div><Label className="text-xs">Email</Label><Input type="email" placeholder="john@example.com" /></div>
                <div><Label className="text-xs">Phone</Label><Input type="tel" placeholder="(555) 123-4567" /></div>
                <div><Label className="text-xs">Date of Birth</Label><Input type="date" /></div>
                <div><Label className="text-xs">SSN (Last 4)</Label><Input placeholder="••••" maxLength={4} /></div>
              </div>
              <div><Label className="text-xs">Address</Label><Input placeholder="123 Main St, Denver, CO 80202" /></div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Annual Income</Label><Input type="number" placeholder="150000" /></div>
                <div><Label className="text-xs">Net Worth</Label><Input type="number" placeholder="1250000" /></div>
                <div><Label className="text-xs">Investment Assets</Label><Input type="number" placeholder="800000" /></div>
                <div><Label className="text-xs">Monthly Expenses</Label><Input type="number" placeholder="8000" /></div>
                <div><Label className="text-xs">Retirement Goal Age</Label><Input type="number" placeholder="65" /></div>
                <div><Label className="text-xs">Dependents</Label><Input type="number" placeholder="2" /></div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Rate your comfort level with the following scenarios (1 = Very Uncomfortable, 5 = Very Comfortable):</p>
              {[
                "Your portfolio drops 20% in one month",
                "Investing in volatile but high-growth stocks",
                "Locking funds in illiquid investments for 5+ years",
                "Concentrating 30% of portfolio in one sector",
                "Using leverage to amplify returns",
              ].map((q, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-sm">{q}</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <Button key={n} variant="outline" size="sm" className="h-7 w-7 p-0 text-xs">{n}</Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Upload the following documents to complete onboarding:</p>
              {["Government ID", "Recent Tax Return", "Investment Statements", "Insurance Policies", "Estate Documents"].map(doc => (
                <div key={doc} className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-sm">{doc}</span>
                  <Button variant="outline" size="sm" onClick={() => toast.info("File upload coming soon")}>Upload</Button>
                </div>
              ))}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Please review the information and agree to the terms to complete onboarding.</p>
              <div className="space-y-2 text-sm">
                {STEPS.slice(0, 4).map(s => (
                  <div key={s.id} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>{s.title}</span>
                    <Badge variant="outline" className="text-[10px] text-emerald-400">Complete</Badge>
                  </div>
                ))}
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
          <Button onClick={() => setStep(Math.min(STEPS.length, step + 1))}>
            Next <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={() => { toast.success("Client onboarded successfully!"); navigate("/clients"); }} disabled={!consent}>
            <CheckCircle2 className="h-4 w-4 mr-1" /> Complete Onboarding
          </Button>
        )}
      </div>
    </div>
    </AppShell>
  );
}
