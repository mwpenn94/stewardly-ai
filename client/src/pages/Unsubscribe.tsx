/**
 * Unsubscribe — One-click CAN-SPAM unsubscribe. Token-validated URL.
 * Route: /unsubscribe?token=xxx&email=xxx
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2, Mail, MailX } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";

function useSearchParams() {
  const [params] = useState(() => new URLSearchParams(window.location.search));
  return params;
}

export default function Unsubscribe() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const emailHint = params.get("email") || "";
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const unsubMutation = trpc.leadCapture.unsubscribe.useMutation({
    onSuccess: () => setStatus("success"),
    onError: () => setStatus("error"),
  });

  const handleUnsubscribe = () => {
    if (!token) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    unsubMutation.mutate({ emailHash: token });
  };

  // Auto-unsubscribe on load for one-click compliance
  useEffect(() => {
    if (token && status === "idle") {
      handleUnsubscribe();
    }
  }, []);

  const seoHead = <SEOHead title="Unsubscribe — Stewardly" description="Manage your email subscription preferences" />;

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        {seoHead}
        <Card className="max-w-md w-full mx-4">
          <CardContent className="py-12 text-center space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">Processing your request...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        {seoHead}
        <Card className="max-w-md w-full mx-4">
          <CardContent className="py-12 text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
            <h2 className="text-xl font-bold">Successfully Unsubscribed</h2>
            {emailHint && (
              <p className="text-muted-foreground">
                <span className="font-medium">{emailHint}</span> has been removed from our mailing list.
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              You will no longer receive marketing emails from us. Please allow up to 24 hours for changes to take effect.
            </p>
            <p className="text-xs text-muted-foreground mt-4">
              If you unsubscribed by mistake, contact your advisor to re-subscribe.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        {seoHead}
        <Card className="max-w-md w-full mx-4">
          <CardContent className="py-12 text-center space-y-4">
            <XCircle className="w-16 h-16 text-red-500 mx-auto" />
            <h2 className="text-xl font-bold">Unable to Process</h2>
            <p className="text-muted-foreground">
              We could not process your unsubscribe request. The link may be invalid or expired.
            </p>
            <Button variant="outline" onClick={() => { setStatus("idle"); }}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Idle — shouldn't normally reach here if token is present (auto-unsub fires)
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      {seoHead}
      <Card className="max-w-md w-full mx-4">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <MailX className="w-8 h-8 text-muted-foreground" />
          </div>
          <CardTitle>Unsubscribe</CardTitle>
          <CardDescription>Click below to unsubscribe from our mailing list</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {emailHint && (
            <p className="text-center text-sm text-muted-foreground">
              Email: <span className="font-medium">{emailHint}</span>
            </p>
          )}
          <Button className="w-full" onClick={handleUnsubscribe} disabled={!token}>
            Confirm Unsubscribe
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            This action complies with CAN-SPAM Act requirements.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
