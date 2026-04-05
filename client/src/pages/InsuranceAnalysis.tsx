/**
 * InsuranceAnalysis — Insurance needs analysis and gap identification.
 * Shows coverage gaps, policy comparisons, and carrier recommendations.
 */
import { SEOHead } from "@/components/SEOHead";
import { FinancialScoreCard } from "@/components/FinancialScoreCard";
import { CalculatorInsight } from "@/components/CalculatorInsight";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Shield, Heart, Home, Car, Umbrella, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const COVERAGE = [
  { type: "Life Insurance", icon: Heart, current: 500000, recommended: 1200000, status: "gap", carrier: "Northwestern Mutual", premium: "$145/mo" },
  { type: "Disability (LTD)", icon: Shield, current: 60, recommended: 60, status: "adequate", carrier: "Guardian", premium: "$89/mo" },
  { type: "Homeowners", icon: Home, current: 450000, recommended: 550000, status: "gap", carrier: "State Farm", premium: "$210/mo" },
  { type: "Auto", icon: Car, current: 300000, recommended: 300000, status: "adequate", carrier: "GEICO", premium: "$165/mo" },
  { type: "Umbrella", icon: Umbrella, current: 0, recommended: 2000000, status: "missing", carrier: "—", premium: "~$35/mo" },
];

export default function InsuranceAnalysis() {
  const [, navigate] = useLocation();

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <SEOHead title="Insurance Analysis" description="Insurance needs analysis and coverage gap identification" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/advisory")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Insurance Analysis</h1>
            <p className="text-sm text-muted-foreground">Coverage assessment and gap identification</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FinancialScoreCard title="Coverage Score" value={62} format="number" icon={Shield} trend="down" trendValue="2 gaps found" />
        <FinancialScoreCard title="Annual Premiums" value="$7,320" icon={Heart} />
        <FinancialScoreCard title="Potential Savings" value="$840/yr" icon={CheckCircle2} trend="up" trendValue="Bundle discount" />
      </div>

      <CalculatorInsight
        title="Critical: No Umbrella Policy"
        summary="With $1.25M in assets and no umbrella liability coverage, you're exposed to significant lawsuit risk."
        detail="An umbrella policy providing $2M in excess liability coverage typically costs $300–$500/year and protects against catastrophic claims exceeding your auto/home policy limits. Given your net worth, this is the highest-priority insurance gap."
        severity="critical"
        actionLabel="Get Umbrella Quotes"
        onAction={() => toast.info("Carrier quoting coming soon")}
      />

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Coverage Overview</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            {COVERAGE.map(c => {
              const Icon = c.icon;
              const pct = c.status === "missing" ? 0 : c.status === "adequate" ? 100 : Math.round((c.current / c.recommended) * 100);
              return (
                <div key={c.type} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{c.type}</span>
                      {c.status === "adequate" && <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">Adequate</Badge>}
                      {c.status === "gap" && <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">Gap</Badge>}
                      {c.status === "missing" && <Badge variant="outline" className="text-[10px] text-red-400 border-red-500/30">Missing</Badge>}
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <span>{c.carrier}</span> • <span>{c.premium}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={pct} className="h-2 flex-1" />
                    <span className="text-xs text-muted-foreground w-16 text-right">
                      {c.status === "missing" ? "None" : `${typeof c.current === "number" && c.current > 100 ? `$${(c.current / 1000).toFixed(0)}K` : `${c.current}%`}`}
                      {c.status !== "adequate" && c.status !== "missing" && ` / ${typeof c.recommended === "number" && c.recommended > 100 ? `$${(c.recommended / 1000).toFixed(0)}K` : `${c.recommended}%`}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <CalculatorInsight
        title="Life Insurance Gap: $700K"
        summary="Current $500K term policy covers only 42% of the recommended $1.2M based on income replacement and debt obligations."
        detail="Recommendation: Add a $750K 20-year term policy. At age 41, estimated premium is $65–$85/month for preferred rates. This closes the gap and covers mortgage payoff + 10 years income replacement."
        severity="warning"
        actionLabel="Compare Term Quotes"
        onAction={() => toast.info("Quote comparison coming soon")}
      />
    </div>
  );
}
