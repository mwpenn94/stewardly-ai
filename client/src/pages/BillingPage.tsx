/**
 * BillingPage — Subscription management, usage tracking, and invoices.
 */
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, CreditCard, Receipt, TrendingUp, Zap, Check } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const PLANS = [
  { name: "Starter", price: "$49", period: "/mo", features: ["1 advisor", "50 clients", "Basic AI chat", "5 reports/mo"], current: false },
  { name: "Professional", price: "$149", period: "/mo", features: ["5 advisors", "250 clients", "Full AI suite", "Unlimited reports", "CRM sync", "Lead pipeline"], current: true },
  { name: "Enterprise", price: "Custom", period: "", features: ["Unlimited advisors", "Unlimited clients", "White-label", "API access", "Dedicated support", "Custom integrations"], current: false },
];

const INVOICES = [
  { date: "Apr 1, 2026", amount: "$149.00", status: "paid", id: "INV-2026-0401" },
  { date: "Mar 1, 2026", amount: "$149.00", status: "paid", id: "INV-2026-0301" },
  { date: "Feb 1, 2026", amount: "$149.00", status: "paid", id: "INV-2026-0201" },
  { date: "Jan 1, 2026", amount: "$149.00", status: "paid", id: "INV-2026-0101" },
];

export default function BillingPage() {
  const [, navigate] = useLocation();

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <SEOHead title="Billing" description="Subscription management and billing" />

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><CreditCard className="h-6 w-6" /> Billing</h1>
          <p className="text-sm text-muted-foreground">Manage your subscription and view invoices</p>
        </div>
      </div>

      {/* Usage */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Current Usage</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "Clients", used: 87, max: 250 },
            { label: "AI Conversations", used: 342, max: 1000 },
            { label: "Reports Generated", used: 28, max: 100 },
            { label: "Storage", used: 2.1, max: 10, unit: "GB" },
          ].map(u => (
            <div key={u.label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span>{u.label}</span>
                <span className="text-xs text-muted-foreground">{u.used}{u.unit ? u.unit : ""} / {u.max}{u.unit ? u.unit : ""}</span>
              </div>
              <Progress value={Math.round((u.used / u.max) * 100)} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map(plan => (
          <Card key={plan.name} className={plan.current ? "border-primary" : ""}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{plan.name}</h3>
                {plan.current && <Badge className="text-[10px]">Current</Badge>}
              </div>
              <div>
                <span className="text-2xl font-bold font-mono tabular-nums">{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.period}</span>
              </div>
              <ul className="space-y-1.5">
                {plan.features.map(f => (
                  <li key={f} className="text-xs flex items-center gap-1.5">
                    <Check className="h-3 w-3 text-emerald-400" /> {f}
                  </li>
                ))}
              </ul>
              <Button
                variant={plan.current ? "outline" : "default"}
                size="sm"
                className="w-full"
                onClick={() => toast.info(plan.current ? "You're on this plan" : "Plan upgrade coming soon")}
              >
                {plan.current ? "Current Plan" : plan.price === "Custom" ? "Contact Sales" : "Upgrade"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Invoices */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Recent Invoices</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {INVOICES.map(inv => (
              <div key={inv.id} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{inv.id}</p>
                    <p className="text-xs text-muted-foreground">{inv.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono">{inv.amount}</span>
                  <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">Paid</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
