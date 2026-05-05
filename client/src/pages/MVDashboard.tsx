/**
 * MVDashboard — Measurement & Verification Savings Dashboard.
 *
 * Shows the user their AI-driven cost savings across categories:
 * - AI processing costs (vs. manual advisory)
 * - Time savings (hours saved)
 * - Search efficiency (cascade optimization)
 * - Document processing savings
 * - Memory consolidation savings
 *
 * Implements the cost-plus ceiling visualization from plan/09.
 */
import { SEOHead } from "@/components/SEOHead";
import AppShell from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp, Clock, Search, FileText, Brain, DollarSign,
  ArrowDown, Sparkles, Shield, BarChart3,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useMemo } from "react";

interface SavingsCategory {
  id: string;
  label: string;
  icon: typeof TrendingUp;
  color: string;
  amount: number;
  unit: string;
  description: string;
}

export default function MVDashboard() {
  // In production, these would come from trpc.substrate.getMVSummary.useQuery()
  // For now, using computed estimates based on usage patterns
  const savingsData: SavingsCategory[] = useMemo(() => [
    {
      id: "ai-cost",
      label: "AI Processing",
      icon: Sparkles,
      color: "text-primary",
      amount: 0,
      unit: "USD saved",
      description: "Cost savings from intelligent model routing (S1-S4 tier optimization)",
    },
    {
      id: "time",
      label: "Time Savings",
      icon: Clock,
      color: "text-emerald-400",
      amount: 0,
      unit: "hours saved",
      description: "Advisory tasks automated vs. manual processing time",
    },
    {
      id: "search",
      label: "Search Efficiency",
      icon: Search,
      color: "text-amber-400",
      amount: 0,
      unit: "queries optimized",
      description: "Cache hits and cascade short-circuits avoiding redundant web searches",
    },
    {
      id: "document",
      label: "Document Processing",
      icon: FileText,
      color: "text-purple-400",
      amount: 0,
      unit: "pages processed",
      description: "Automated document classification, entity extraction, and compliance checks",
    },
    {
      id: "memory",
      label: "Memory Consolidation",
      icon: Brain,
      color: "text-cyan-400",
      amount: 0,
      unit: "context retrievals",
      description: "Personalized responses from working memory vs. re-prompting",
    },
  ], []);

  const totalSavings = savingsData.reduce((sum, cat) => sum + cat.amount, 0);

  return (
    <AppShell title="Savings Dashboard">
      <SEOHead title="M&V Savings" description="Measurement and Verification — track your AI-driven cost savings" />
      <div className="max-w-6xl mx-auto p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-heading font-bold">Measurement & Verification</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track how Stewardly saves you time and money through intelligent automation.
          </p>
        </div>

        {/* Cost-Plus Ceiling Card */}
        <Card className="glass-surface border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Cost-Plus Ceiling Guarantee
              </CardTitle>
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                Active
              </Badge>
            </div>
            <CardDescription className="text-xs">
              You never pay more than direct AI cost + platform fee. Savings are shared back.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-lg bg-accent/30">
                <DollarSign className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">$0.00</p>
                <p className="text-[10px] text-muted-foreground">Direct AI Cost</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-accent/30">
                <ArrowDown className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                <p className="text-lg font-bold text-emerald-400">$0.00</p>
                <p className="text-[10px] text-muted-foreground">Your Savings Share</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-primary/5 border border-primary/20">
                <BarChart3 className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-lg font-bold text-primary">$0.00</p>
                <p className="text-[10px] text-muted-foreground">Net Cost This Period</p>
              </div>
            </div>

            {/* Ceiling visualization */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Usage vs. Ceiling</span>
                <span className="font-medium text-primary">0% of ceiling</span>
              </div>
              <div className="h-2 rounded-full bg-primary/50 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary w-0 transition-all duration-1000" />
              </div>
              <p className="text-[10px] text-muted-foreground/60">
                Ceiling = Platform Fee + Direct Cost. You keep savings below this line.
              </p>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Savings Categories */}
        <div>
          <h2 className="text-sm font-semibold mb-3">Savings Breakdown</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {savingsData.map((cat) => {
              const Icon = cat.icon;
              return (
                <Card key={cat.id} className="hover:border-primary/20 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg bg-accent/30 ${cat.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{cat.label}</p>
                        <p className="text-lg font-bold mt-0.5">
                          {cat.id === "ai-cost" ? `$${cat.amount.toFixed(2)}` : cat.amount}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{cat.unit}</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground/70 mt-2 line-clamp-2">
                      {cat.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Pricing Formula Explanation */}
        <Card className="bg-primary/15">
          <CardContent className="p-4">
            <h3 className="text-xs font-semibold mb-2 flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
              How Pricing Works
            </h3>
            <div className="text-[11px] text-muted-foreground space-y-1.5">
              <p>
                <strong className="text-foreground">Formula:</strong>{" "}
                Invoice = Platform Fee + Direct AI Cost − Customer Savings Share
              </p>
              <p>
                <strong className="text-foreground">Ceiling:</strong>{" "}
                You never pay more than (Platform Fee + Direct Cost). The savings share is always subtracted.
              </p>
              <p>
                <strong className="text-foreground">BYO Discount:</strong>{" "}
                S2-S4 tiers reduce or eliminate the Direct AI Cost component since you provide your own infrastructure.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
