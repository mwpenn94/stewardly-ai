import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { Shield, FileText, Eye, Lock } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

interface ConsentGateProps {
  children: React.ReactNode;
}

export default function ConsentGate({ children }: ConsentGateProps) {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [agreed, setAgreed] = useState(false);

  const tosStatus = trpc.settings.getTosStatus.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const acceptTos = trpc.settings.acceptTos.useMutation({
    onSuccess: () => tosStatus.refetch(),
  });

  // Not authenticated or loading — pass through (auth handled elsewhere)
  if (loading || !isAuthenticated) return <>{children}</>;

  // ToS already accepted — pass through
  if (tosStatus.data?.accepted) return <>{children}</>;

  // Still loading ToS status
  if (tosStatus.isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  // Show consent screen
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">Welcome to WealthBridge AI</h1>
          <p className="text-sm text-muted-foreground">
            Before you get started, please review and accept our terms.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <FileText className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Your Content Stays Yours</p>
                <p className="text-xs text-muted-foreground">You retain full ownership of everything you upload. We only process it to provide and improve the service.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Eye className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">You Control Visibility</p>
                <p className="text-xs text-muted-foreground">Choose who can see your documents and insights — keep them private, share with your advisor, management, or admins.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Lock className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">AI Responses Are Informational</p>
                <p className="text-xs text-muted-foreground">AI-generated content is not professional financial, legal, or tax advice. Always consult qualified professionals for important decisions.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            id="agree"
            checked={agreed}
            onCheckedChange={(checked) => setAgreed(checked === true)}
            className="mt-0.5"
          />
          <label htmlFor="agree" className="text-xs text-muted-foreground cursor-pointer leading-relaxed">
            I have read and agree to the{" "}
            <button
              onClick={() => navigate("/terms")}
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              Terms of Service
            </button>{" "}
            and{" "}
            <button
              onClick={() => navigate("/terms")}
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              Privacy Policy
            </button>
            , including how my data is used and shared within the access chain.
          </label>
        </div>

        <Button
          className="w-full"
          disabled={!agreed || acceptTos.isPending}
          onClick={() => acceptTos.mutate()}
        >
          {acceptTos.isPending ? "Accepting..." : "Accept & Continue"}
        </Button>

        <p className="text-[10px] text-center text-muted-foreground">
          You can review these terms anytime from Settings. You may delete your data or close your account at any time.
        </p>
      </div>
    </div>
  );
}
