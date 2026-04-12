/**
 * BusinessValuationPage — SDE multiple + 5-year exit projection.
 *
 * Thin UI over `wealthEngine.valueBusiness` tRPC mutation. Lets the
 * advisor (or owner) plug in revenue / EBITDA / owner add-back and
 * see the current valuation and a projected exit value across a
 * configurable horizon and growth assumption.
 */

import { useState } from "react";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import {
  Rocket, ArrowLeft, Loader2, TrendingUp, DollarSign, Sparkles, Calendar,
} from "lucide-react";
import { useLocation } from "wouter";

const fmt = (n: number) => {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
};
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export default function BusinessValuationPage() {
  const [, navigate] = useLocation();
  const [revenue, setRevenue] = useState(2_000_000);
  const [ebitda, setEbitda] = useState(400_000);
  const [ownerAddBack, setOwnerAddBack] = useState(100_000);
  const [growth, setGrowth] = useState(0.08);
  const [years, setYears] = useState(5);
  const [customMultiple, setCustomMultiple] = useState<number | null>(null);

  const valueMut = trpc.wealthEngine.valueBusiness.useMutation({
    onError: (e: any) => toast.error(e.message),
  });

  const run = () =>
    valueMut.mutate({
      annualRevenue: revenue,
      annualEbitda: ebitda,
      ownerAddBack,
      growthRate: growth,
      exitYears: years,
      industryMultiple: customMultiple ?? undefined,
    });

  const result = valueMut.data?.data;

  return (
    <AppShell title="Business Valuation">
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate("/wealth-engine")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Rocket className="w-4 h-4 text-emerald-400" />
              <h1 className="text-lg font-heading font-semibold">Business Valuation</h1>
            </div>
            <p className="text-xs text-muted-foreground">
              SDE multiple valuation + exit-horizon projection.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Input card */}
          <Card className="lg:col-span-2 bg-card/60 border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Financials</CardTitle>
              <CardDescription className="text-[11px]">
                SDE = EBITDA + owner add-back (salary, benefits, one-time costs).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <NumberField label="Annual Revenue" value={revenue} onChange={setRevenue} step={50_000} />
              <NumberField label="EBITDA" value={ebitda} onChange={setEbitda} step={10_000} />
              <NumberField label="Owner Add-Back" value={ownerAddBack} onChange={setOwnerAddBack} step={10_000} />

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Growth rate</Label>
                  <span className="text-xs font-mono">{pct(growth)}</span>
                </div>
                <Slider
                  value={[growth * 100]}
                  onValueChange={([v]) => setGrowth(v / 100)}
                  min={-10}
                  max={30}
                  step={1}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Exit horizon</Label>
                  <span className="text-xs font-mono">{years} yrs</span>
                </div>
                <Slider
                  value={[years]}
                  onValueChange={([v]) => setYears(v)}
                  min={1}
                  max={20}
                  step={1}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">
                  Override multiple (optional)
                </Label>
                <Input
                  type="number"
                  step={0.5}
                  placeholder="Auto"
                  value={customMultiple ?? ""}
                  onChange={(e) =>
                    setCustomMultiple(e.target.value === "" ? null : +e.target.value)
                  }
                  className="h-8 text-xs"
                />
              </div>

              <Button
                onClick={run}
                disabled={valueMut.isPending}
                className="w-full h-9 gap-1.5"
              >
                {valueMut.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                Value business
              </Button>
            </CardContent>
          </Card>

          {/* Result card */}
          <Card className="lg:col-span-3 bg-card/60 border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Valuation</CardTitle>
            </CardHeader>
            <CardContent>
              {!result && (
                <div className="text-center py-10 text-muted-foreground">
                  <Rocket className="w-8 h-8 mx-auto mb-2 text-muted-foreground/20" />
                  <p className="text-sm">Enter your financials, then click Value business.</p>
                </div>
              )}
              {result && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg p-4 bg-accent/5 border border-accent/20">
                      <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Today</p>
                      <p className="text-2xl font-heading font-semibold text-accent tabular-nums">
                        {fmt(result.currentValue)}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        SDE {fmt(result.sde)} × {result.multipleApplied.toFixed(1)}x
                      </p>
                    </div>
                    <div className="rounded-lg p-4 bg-emerald-500/5 border border-emerald-500/20">
                      <p className="text-[10px] uppercase text-muted-foreground tracking-wider">
                        In {years} years
                      </p>
                      <p className="text-2xl font-heading font-semibold text-emerald-400 tabular-nums">
                        {fmt(result.projectedExitValue)}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        CAGR {pct(result.cagr)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-md border border-border/40 p-3 bg-secondary/20">
                    <p className="text-[11px] text-muted-foreground">{result.reasoning}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] gap-1.5"
                      onClick={() => navigate("/wealth-engine/owner-comp")}
                    >
                      <DollarSign className="w-3 h-3" /> Optimize owner comp
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] gap-1.5"
                      onClick={() => navigate("/wealth-engine/strategy-comparison")}
                    >
                      <TrendingUp className="w-3 h-3" /> Wealth strategy
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] gap-1.5"
                      onClick={() => navigate("/engine-dashboard")}
                    >
                      <Calendar className="w-3 h-3" /> Exit planning
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <p className="text-[10px] text-muted-foreground text-center pt-2">
          Industry multiples derived from 2024 BizBuySell / IBBA medians. Illustrative only —
          commission a formal valuation before any sale or succession event.
        </p>
      </div>
    </AppShell>
  );
}

function NumberField({
  label, value, onChange, step = 1,
}: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        step={step}
        className="h-8 text-xs"
      />
    </div>
  );
}
