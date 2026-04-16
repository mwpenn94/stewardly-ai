/**
 * BillingPage — Subscription management wired to Stripe.
 *
 * Uses trpc.billing.* procedures for:
 * - getPlans: fetch available subscription tiers
 * - getSubscription: fetch current user subscription status
 * - createCheckoutSession: redirect to Stripe Checkout
 * - createPortalSession: redirect to Stripe Customer Portal
 */
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CreditCard, Receipt, Check, ExternalLink, Loader2, Sparkles, Crown, Building2 } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";

const PLAN_ICONS: Record<string, React.ReactNode> = {
  starter: <Sparkles className="h-5 w-5 text-blue-400" />,
  professional: <Crown className="h-5 w-5 text-amber-400" />,
  enterprise: <Building2 className="h-5 w-5 text-purple-400" />,
};

export default function BillingPage() {
  const [, navigate] = useLocation();
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const { data: plans, isLoading: plansLoading } = trpc.billing.getPlans.useQuery();
  const { data: subscription, isLoading: subLoading } = trpc.billing.getSubscription.useQuery();

  const checkoutMutation = trpc.billing.createCheckout.useMutation({
    onSuccess: (data: { url: string | null }) => {
      if (data.url) {
        toast.info("Redirecting to Stripe Checkout...");
        window.open(data.url, "_blank", "noopener,noreferrer");
      }
    },
    onError: (err: { message: string }) => {
      toast.error(err.message || "Failed to create checkout session");
    },
    onSettled: () => setCheckoutLoading(null),
  });

  const portalMutation = trpc.billing.createPortalSession.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        toast.info("Opening Stripe Customer Portal...");
        window.open(data.url, "_blank", "noopener,noreferrer");
      }
    },
    onError: (err) => {
      toast.error(err.message || "Failed to open billing portal");
    },
  });

  const currentPlanId = subscription?.plan?.id ?? null;

  const planList = useMemo(() => {
    if (!plans) return [];
    return plans.map((p: any) => ({
      ...p,
      displayPrice: billingInterval === "year"
        ? `$${(p.priceYearly / 100).toFixed(0)}`
        : `$${(p.priceMonthly / 100).toFixed(0)}`,
      period: billingInterval === "year" ? "/yr" : "/mo",
      isCurrent: p.id === currentPlanId,
    }));
  }, [plans, billingInterval, currentPlanId]);

  const handleCheckout = (planId: string) => {
    setCheckoutLoading(planId);
    checkoutMutation.mutate({ planId: planId as "starter" | "professional" | "enterprise", interval: billingInterval });
  };

  return (
    <AppShell title="Billing">
      <div className="container max-w-5xl py-6 sm:py-8 space-y-6">
        <SEOHead title="Billing" description="Subscription management and billing" />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <CreditCard className="h-5 w-5 sm:h-6 sm:w-6" /> Billing & Subscription
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage your subscription, view usage, and access invoices
            </p>
          </div>
        </div>

        {/* Current Subscription Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Current Subscription</span>
              {subscription && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => portalMutation.mutate()}
                  disabled={portalMutation.isPending}
                >
                  {portalMutation.isPending ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <ExternalLink className="h-3 w-3 mr-1" />
                  )}
                  Manage in Stripe
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : subscription ? (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  {PLAN_ICONS[subscription.plan?.id ?? ""] ?? <CreditCard className="h-5 w-5" />}
                  <span className="text-lg font-semibold capitalize">{subscription.plan?.name ?? "Unknown"} Plan</span>
                </div>
                <Badge
                  variant="outline"
                  className={
                    subscription.status === "active"
                      ? "text-emerald-400 border-emerald-500/30"
                      : "text-amber-400 border-amber-500/30"
                  }
                >
                  {subscription.status}
                </Badge>
                {subscription.currentPeriodEnd && (
                  <span className="text-xs text-muted-foreground">
                    Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No active subscription. Choose a plan below to get started.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Usage (mock data for now — would come from a usage tracking procedure) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Current Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Clients", used: 87, max: 250 },
              { label: "AI Conversations", used: 342, max: 1000 },
              { label: "Reports Generated", used: 28, max: 100 },
              { label: "Storage", used: 2.1, max: 10, unit: "GB" },
            ].map((u) => (
              <div key={u.label} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{u.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {u.used}
                    {u.unit ?? ""} / {u.max}
                    {u.unit ?? ""}
                  </span>
                </div>
                <Progress value={Math.round((u.used / u.max) * 100)} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Billing Interval Toggle */}
        <div className="flex items-center justify-center gap-2">
          <Button
            variant={billingInterval === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setBillingInterval("month")}
          >
            Monthly
          </Button>
          <Button
            variant={billingInterval === "year" ? "default" : "outline"}
            size="sm"
            onClick={() => setBillingInterval("year")}
          >
            Yearly
            <Badge variant="secondary" className="ml-1.5 text-[10px]">
              Save 20%
            </Badge>
          </Button>
        </div>

        {/* Plans */}
        {plansLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-8 w-20" />
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((j) => (
                      <Skeleton key={j} className="h-4 w-full" />
                    ))}
                  </div>
                  <Skeleton className="h-9 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {planList.map((plan: any) => (
              <Card
                key={plan.id}
                className={`relative ${plan.popular ? "border-primary ring-1 ring-primary/20" : ""} ${plan.isCurrent ? "border-emerald-500/50" : ""}`}
              >
                {plan.popular && !plan.isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground text-[10px]">
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardContent className="p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {PLAN_ICONS[plan.id]}
                      <h3 className="font-semibold">{plan.name}</h3>
                    </div>
                    {plan.isCurrent && (
                      <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                        Current
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{plan.description}</p>
                  <div>
                    <span className="text-2xl font-bold font-mono tabular-nums">
                      {plan.displayPrice}
                    </span>
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {plan.features.map((f: string) => (
                      <li key={f} className="text-xs flex items-start gap-1.5">
                        <Check className="h-3 w-3 text-emerald-400 mt-0.5 shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant={plan.isCurrent ? "outline" : plan.popular ? "default" : "outline"}
                    size="sm"
                    className="w-full"
                    disabled={plan.isCurrent || checkoutLoading === plan.id}
                    onClick={() => {
                      if (plan.id === "enterprise") {
                        toast.info("Contact sales@stewardly.com for enterprise pricing");
                      } else {
                        handleCheckout(plan.id);
                      }
                    }}
                  >
                    {checkoutLoading === plan.id ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Processing...
                      </>
                    ) : plan.isCurrent ? (
                      "Current Plan"
                    ) : plan.id === "enterprise" ? (
                      "Contact Sales"
                    ) : (
                      "Subscribe"
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Payment History / Portal Link */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Receipt className="h-4 w-4" /> Payment History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              View your complete payment history, download invoices, and manage payment methods
              through the Stripe Customer Portal.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending}
            >
              {portalMutation.isPending ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <ExternalLink className="h-3 w-3 mr-1" />
              )}
              Open Payment Portal
            </Button>
          </CardContent>
        </Card>

        {/* Test Mode Notice */}
        <div className="text-center text-xs text-muted-foreground/60 py-2">
          <p>
            Payments are processed securely by Stripe. For testing, use card number{" "}
            <code className="bg-muted px-1 py-0.5 rounded text-[10px]">4242 4242 4242 4242</code>{" "}
            with any future expiry and CVC.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
