/**
 * RiskAssessment — Client risk profiling and portfolio risk analysis.
 * Shows risk questionnaire results, portfolio risk metrics, and allocation recommendations.
 */
import { SEOHead } from "@/components/SEOHead";
import { LeadCaptureGate } from "@/components/LeadCaptureGate";
import { FinancialScoreCard } from "@/components/FinancialScoreCard";
import { PropensityGauge } from "@/components/PropensityGauge";
import { CalculatorInsight } from "@/components/CalculatorInsight";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, BarChart3, Shield, TrendingDown, AlertTriangle, Target } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const RISK_FACTORS = [
  { name: "Time Horizon", score: 8, description: "20+ years to retirement" },
  { name: "Income Stability", score: 7, description: "Stable W-2 employment" },
  { name: "Loss Tolerance", score: 5, description: "Moderate — uncomfortable with >15% drawdown" },
  { name: "Investment Knowledge", score: 6, description: "Intermediate understanding" },
  { name: "Liquidity Needs", score: 7, description: "6-month emergency fund in place" },
];

const ALLOCATION = [
  { asset: "US Equities", current: 55, target: 50, color: "bg-blue-500" },
  { asset: "International Equities", current: 15, target: 20, color: "bg-indigo-500" },
  { asset: "Fixed Income", current: 20, target: 22, color: "bg-emerald-500" },
  { asset: "Real Estate", current: 5, target: 5, color: "bg-amber-500" },
  { asset: "Alternatives", current: 3, target: 3, color: "bg-purple-500" },
  { asset: "Cash", current: 2, target: 0, color: "bg-gray-400" },
];

export default function RiskAssessment() {
  const [, navigate] = useLocation();
  const overallScore = Math.round(RISK_FACTORS.reduce((s, f) => s + f.score, 0) / RISK_FACTORS.length * 10);

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <SEOHead title="Risk Assessment" description="Client risk profiling and portfolio risk analysis" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/advisory")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Risk Assessment</h1>
            <p className="text-sm text-muted-foreground">Risk profiling, portfolio analysis, and allocation recommendations</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => toast.info("Risk questionnaire coming soon")}>
          <Target className="h-3.5 w-3.5 mr-1" /> Retake Assessment
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <FinancialScoreCard title="Risk Score" value={overallScore} format="number" icon={BarChart3} trend="flat" trendValue="Moderate Growth" />
        <FinancialScoreCard title="Portfolio Beta" value="0.92" icon={TrendingDown} />
        <FinancialScoreCard title="Max Drawdown (1yr)" value="-12.4%" icon={AlertTriangle} />
        <FinancialScoreCard title="Sharpe Ratio" value="1.24" icon={Shield} trend="up" trendValue="Above benchmark" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Factors */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Risk Profile Factors</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {RISK_FACTORS.map(f => (
              <div key={f.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{f.name}</span>
                  <span className="text-muted-foreground text-xs">{f.score}/10</span>
                </div>
                <Progress value={f.score * 10} className="h-2" />
                <p className="text-xs text-muted-foreground">{f.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Overall Score */}
        <Card>
          <CardContent className="p-6 flex flex-col items-center justify-center">
            <PropensityGauge score={overallScore} label="Overall Risk Score" size="lg" />
            <Badge variant="outline" className="mt-3">Moderate Growth Profile</Badge>
            <p className="text-xs text-muted-foreground mt-2 text-center max-w-xs">
              Suitable for a balanced portfolio with 50–60% equities, 20–25% fixed income, and 15–25% alternatives/real estate.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Allocation */}
      <LeadCaptureGate
        title="Unlock Portfolio Allocation Analysis"
        description="Enter your email to access detailed allocation drift analysis, rebalancing recommendations, and personalized risk optimization strategies."
        onCapture={(email) => toast.success(`Risk analysis sent to ${email}`)}
      >
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Asset Allocation: Current vs Target</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {ALLOCATION.map(a => (
              <div key={a.asset} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-sm ${a.color}`} />
                    <span>{a.asset}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground">Current: {a.current}%</span>
                    <span>Target: {a.target}%</span>
                    {Math.abs(a.current - a.target) > 3 && (
                      <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">Drift</Badge>
                    )}
                  </div>
                </div>
                <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`absolute h-full ${a.color} opacity-40 rounded-full`} style={{ width: `${a.target}%` }} />
                  <div className={`absolute h-full ${a.color} rounded-full`} style={{ width: `${a.current}%` }} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <CalculatorInsight
        title="Rebalancing Recommended"
        summary="US Equities are 5% over target. Consider rebalancing $62,500 from US equities to international equities."
        detail="The current overweight in US equities increases concentration risk. Rebalancing to target would reduce portfolio beta from 0.92 to 0.87 and improve international diversification. Tax-loss harvesting in the international allocation could offset rebalancing gains."
        severity="warning"
        actionLabel="Generate Rebalancing Plan"
        onAction={() => navigate("/chat")}
      />
      </LeadCaptureGate>
    </div>
  );
}
