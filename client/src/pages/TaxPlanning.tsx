/**
 * TaxPlanning — Tax planning analysis dashboard with bracket visualization,
 * Roth conversion analysis, tax-loss harvesting, and strategy recommendations.
 */
import { SEOHead } from "@/components/SEOHead";
import { LeadCaptureGate } from "@/components/LeadCaptureGate";
import { FinancialScoreCard } from "@/components/FinancialScoreCard";
import { CalculatorInsight } from "@/components/CalculatorInsight";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, DollarSign, TrendingDown, Calculator, FileText, PiggyBank, BarChart3 } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const BRACKETS_2026 = [
  { rate: "10%", single: "$0 – $11,925", married: "$0 – $23,850", fill: 100 },
  { rate: "12%", single: "$11,926 – $48,475", married: "$23,851 – $96,950", fill: 100 },
  { rate: "22%", single: "$48,476 – $103,350", married: "$96,951 – $206,700", fill: 78 },
  { rate: "24%", single: "$103,351 – $197,300", married: "$206,701 – $394,600", fill: 0 },
  { rate: "32%", single: "$197,301 – $250,525", married: "$394,601 – $501,050", fill: 0 },
  { rate: "35%", single: "$250,526 – $626,350", married: "$501,051 – $751,600", fill: 0 },
  { rate: "37%", single: "Over $626,350", married: "Over $751,600", fill: 0 },
];

export default function TaxPlanning() {
  const [, navigate] = useLocation();

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <SEOHead title="Tax Planning" description="Tax planning analysis and optimization strategies" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/advisory")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Tax Planning</h1>
            <p className="text-sm text-muted-foreground">2026 tax analysis and optimization strategies</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => toast.info("Tax report export coming soon")}>
          <FileText className="h-3.5 w-3.5 mr-1" /> Export Analysis
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <FinancialScoreCard title="Effective Rate" value="18.4%" icon={DollarSign} trend="down" trendValue="-1.2% vs last year" />
        <FinancialScoreCard title="Tax Savings Found" value="$12,400" icon={PiggyBank} trend="up" trendValue="3 strategies" />
        <FinancialScoreCard title="Harvesting Opps" value={5} format="number" icon={TrendingDown} trend="up" trendValue="$8,200 potential" />
        <FinancialScoreCard title="Roth Space" value="$23,000" icon={BarChart3} />
      </div>

      <Tabs defaultValue="brackets">
        <TabsList>
          <TabsTrigger value="brackets">Tax Brackets</TabsTrigger>
          <TabsTrigger value="strategies">Strategies</TabsTrigger>
          <TabsTrigger value="harvesting">Tax-Loss Harvesting</TabsTrigger>
        </TabsList>

        <TabsContent value="brackets" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">2026 Federal Tax Brackets (Married Filing Jointly)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {BRACKETS_2026.map(b => (
                  <div key={b.rate} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium w-12">{b.rate}</span>
                      <span className="text-muted-foreground text-xs">{b.married}</span>
                    </div>
                    <Progress value={b.fill} className="h-2" />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Current taxable income fills through the 22% bracket (78% filled). Consider Roth conversions up to the 24% bracket boundary.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="strategies" className="space-y-4 mt-4">
          <LeadCaptureGate
            title="Unlock Tax Optimization Strategies"
            description="Enter your email to access personalized Roth conversion modeling, charitable giving analysis, and QBI deduction calculations."
            onCapture={(email) => toast.success(`Tax strategies sent to ${email}`)}
          >
          <CalculatorInsight
            title="Roth Conversion Opportunity"
            summary="You have $23,000 of room in the 22% bracket before hitting 24%. Converting traditional IRA funds now locks in the lower rate."
            detail="Converting $23,000 at 22% costs $5,060 in taxes now but saves an estimated $8,050 in future taxes at the projected 35% retirement bracket. Net benefit: $2,990 plus tax-free growth."
            severity="success"
            actionLabel="Model Conversion"
            onAction={() => navigate("/chat")}
          />
          <CalculatorInsight
            title="Charitable Giving — Donor Advised Fund"
            summary="Bunching 2 years of charitable giving into a DAF this year could save $3,400 in taxes."
            detail="By contributing $20,000 to a DAF this year instead of $10,000/year, you itemize this year (saving $3,400 vs standard deduction) and take the standard deduction next year."
            severity="info"
            actionLabel="Calculate DAF Impact"
            onAction={() => navigate("/chat")}
          />
          <CalculatorInsight
            title="Qualified Business Income Deduction"
            summary="Your consulting income may qualify for the 20% QBI deduction, saving up to $6,000."
            detail="If taxable income stays below $394,600 (MFJ), the full 20% deduction applies to qualified business income. Ensure W-2 wage and property basis tests are met."
            severity="info"
          />
          </LeadCaptureGate>
        </TabsContent>

        <TabsContent value="harvesting" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <div className="space-y-3">
                {[
                  { ticker: "VWO", loss: -2400, basis: 15000, current: 12600, replacement: "IEMG" },
                  { ticker: "ARKK", loss: -3100, basis: 8000, current: 4900, replacement: "QQQM" },
                  { ticker: "XLE", loss: -1200, basis: 10000, current: 8800, replacement: "VDE" },
                  { ticker: "SLV", loss: -800, basis: 5000, current: 4200, replacement: "SIVR" },
                  { ticker: "BNDX", loss: -700, basis: 12000, current: 11300, replacement: "IAGG" },
                ].map(h => (
                  <div key={h.ticker} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div>
                      <span className="font-mono text-sm font-medium">{h.ticker}</span>
                      <span className="text-xs text-muted-foreground ml-2">→ {h.replacement}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-red-400">${h.loss.toLocaleString()}</span>
                      <p className="text-xs text-muted-foreground">Basis: ${h.basis.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
                <div className="pt-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Total Harvestable Losses</span>
                  <span className="text-lg font-bold text-red-400">-$8,200</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
