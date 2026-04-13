/**
 * LeadCaptureGate — Wraps content behind a lead capture form.
 * Shows a preview of the content with a blurred overlay and a form to collect
 * name + email before revealing the full content.
 */
import { useState, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Lock, ArrowRight, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface LeadCaptureGateProps {
  children: ReactNode;
  title?: string;
  description?: string;
  source?: string;
  /** If true, content is already unlocked */
  unlocked?: boolean;
  onCapture?: (data: { name: string; email: string }) => void;
}

export function LeadCaptureGate({
  children,
  title = "Unlock Full Results",
  description = "Enter your details to access the complete analysis.",
  source = "calculator",
  unlocked: initialUnlocked = false,
  onCapture,
}: LeadCaptureGateProps) {
  const [unlocked, setUnlocked] = useState(initialUnlocked);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const captureMutation = trpc.leadCapture.captureFromCalculator.useMutation({ onError: (e) => toast.error(`Submission failed: ${e.message}`) });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    if (!consent) {
      toast.error("Please agree to the terms to continue");
      return;
    }

    setSubmitting(true);
    try {
      // Hash email client-side for privacy
      const encoder = new TextEncoder();
      const data = encoder.encode(email.trim().toLowerCase());
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const emailHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      await captureMutation.mutateAsync({
        calculatorType: source,
        emailHash,
        firstName: name.trim(),
      });
      setUnlocked(true);
      onCapture?.({ name: name.trim(), email: email.trim() });
      toast.success("Access granted!");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (unlocked) return <>{children}</>;

  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-sm opacity-50 max-h-64 overflow-hidden">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-background via-background/90 to-transparent">
        <Card className="w-full max-w-md mx-4 shadow-xl border-primary/20">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="gate-name">Name</Label>
                <Input id="gate-name" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gate-email">Email</Label>
                <Input id="gate-email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="flex items-start gap-2">
                <Checkbox id="gate-consent" checked={consent} onCheckedChange={v => setConsent(!!v)} className="mt-0.5" />
                <Label htmlFor="gate-consent" className="text-xs text-muted-foreground leading-tight">
                  I agree to receive communications and understand my data will be handled per the privacy policy.
                </Label>
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                Get Full Access
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
