/**
 * PremiumEstimator — multi-product premium comparison table.
 *
 * Shows estimated annual premiums for all major insurance product types
 * based on a client's age and coverage amount. Uses the wealthEngine.estimatePremium
 * tRPC query for each product type.
 *
 * This is the "quick quoting" capability from the v7 HTML calculators.
 */

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { DollarSign, TrendingUp, Shield, Heart, Umbrella } from "lucide-react";

const PRODUCT_TYPES = [
  { type: "term" as const, label: "Term Life", icon: Shield, desc: "Income replacement", defaultAmount: 500000 },
  { type: "iul" as const, label: "Indexed Universal Life", icon: TrendingUp, desc: "Cash value + death benefit", defaultAmount: 500000 },
  { type: "wl" as const, label: "Whole Life", icon: DollarSign, desc: "Guaranteed cash value", defaultAmount: 250000 },
  { type: "di" as const, label: "Disability Income", icon: Heart, desc: "Income protection", defaultAmount: 5000 },
  { type: "ltc" as const, label: "Long-Term Care", icon: Umbrella, desc: "Care cost coverage", defaultAmount: 200000 },
] as const;

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function fmtMonthly(annual: number) {
  return fmt(Math.round(annual / 12));
}

interface Props {
  initialAge?: number;
  initialAmount?: number;
}

export function PremiumEstimator({ initialAge = 40, initialAmount = 500000 }: Props) {
  const [age, setAge] = useState(initialAge);
  const [amount, setAmount] = useState(initialAmount);

  // Fetch premiums for each product type
  const premiums = PRODUCT_TYPES.map(pt => ({
    ...pt,
    query: trpc.wealthEngine.estimatePremium.useQuery(
      { type: pt.type, age, amount: pt.type === "di" ? Math.round(amount * 0.01) : amount },
      { retry: false },
    ),
  }));

  const totalAnnual = useMemo(
    () => premiums.reduce((sum, p) => sum + (p.query.data?.premium ?? 0), 0),
    [premiums.map(p => p.query.data?.premium).join(",")],
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-accent" />
          Premium Estimator
        </CardTitle>
        <CardDescription className="text-xs">
          Estimated annual premiums by product type for quick quoting
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Client Age: {age}</Label>
            <Slider value={[age]} onValueChange={([v]) => setAge(v)} min={18} max={75} step={1} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Coverage Amount: {fmt(amount)}</Label>
            <Slider value={[amount]} onValueChange={([v]) => setAmount(v)} min={50000} max={5000000} step={25000} />
          </div>
        </div>

        {/* Premium table */}
        <div className="space-y-2">
          {premiums.map(p => {
            const Icon = p.icon;
            const premium = p.query.data?.premium ?? 0;
            return (
              <div
                key={p.type}
                className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 bg-card/60"
              >
                <Icon className="w-4 h-4 text-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{p.label}</span>
                    <Badge variant="outline" className="text-[9px] font-mono">{p.type.toUpperCase()}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{p.desc}</p>
                </div>
                <div className="text-right shrink-0">
                  {p.query.isLoading ? (
                    <span className="text-xs text-muted-foreground">...</span>
                  ) : (
                    <>
                      <div className="text-sm font-mono font-semibold text-accent">{fmt(premium)}<span className="text-[10px] text-muted-foreground">/yr</span></div>
                      <div className="text-[10px] text-muted-foreground font-mono">{fmtMonthly(premium)}/mo</div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Total */}
        <div className="flex items-center justify-between p-2.5 rounded-lg border border-accent/30 bg-accent/5">
          <span className="text-xs font-medium">Total Estimated Premium</span>
          <div className="text-right">
            <div className="text-sm font-mono font-semibold text-accent">{fmt(totalAnnual)}<span className="text-[10px] text-muted-foreground">/yr</span></div>
            <div className="text-[10px] text-muted-foreground font-mono">{fmtMonthly(totalAnnual)}/mo</div>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-[9px] text-muted-foreground/50">
          Premiums are estimated based on age-rated actuarial tables and may vary by carrier,
          underwriting class, and health status. Not a binding quote. Consult a licensed agent.
        </p>
      </CardContent>
    </Card>
  );
}
