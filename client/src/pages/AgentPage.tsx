/**
 * AgentPage — Direct agent interaction surface with calculator tool awareness.
 *
 * Provides a focused chat interface that highlights the 7 calculator tools
 * available in the AI chat, plus contextual advisor prompts. Accessible
 * to all users (not admin-gated) via /agent route.
 */
import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Calculator, TrendingUp, Shield, BarChart3, Building2, DollarSign,
  Brain, ChevronRight, Sparkles, ArrowRight, Briefcase, Target,
} from "lucide-react";
import { useLocation } from "wouter";
import { navigateToChat } from "@/lib/navigateToChat";

const CALCULATOR_TOOLS = [
  {
    id: "retirement",
    name: "Retirement Projection",
    description: "Future income needs, savings trajectory, Social Security estimates, gap analysis",
    icon: TrendingUp,
    samplePrompt: "Run a retirement projection for a 45-year-old making $150,000 with $200k saved",
    color: "text-blue-500",
  },
  {
    id: "tax",
    name: "Tax Estimate",
    description: "Federal bracket analysis, effective rate, optimization suggestions",
    icon: DollarSign,
    samplePrompt: "What's the tax impact of converting $50,000 from traditional to Roth IRA for a married couple making $180k?",
    color: "text-green-500",
  },
  {
    id: "protection",
    name: "Protection Analysis",
    description: "Life insurance need, disability gap, LTC exposure, protection score",
    icon: Shield,
    samplePrompt: "How much life insurance does a family with 2 kids, $300k mortgage, and $120k income need?",
    color: "text-amber-500",
  },
  {
    id: "monte-carlo",
    name: "Monte Carlo Simulation",
    description: "Portfolio projection across thousands of scenarios with probability of success",
    icon: BarChart3,
    samplePrompt: "Run a Monte Carlo simulation on a $500k portfolio with 60/40 allocation over 30 years",
    color: "text-purple-500",
  },
  {
    id: "estate",
    name: "Estate Analysis",
    description: "Estate tax exposure, beneficiary planning, trust recommendations",
    icon: Building2,
    samplePrompt: "Analyze estate planning needs for a married couple with a $3M estate and no trust",
    color: "text-rose-500",
  },
  {
    id: "entity",
    name: "Business Entity Comparison",
    description: "Sole Prop vs LLC vs S-Corp vs C-Corp for tax efficiency and liability",
    icon: Briefcase,
    samplePrompt: "Compare business entity types for a consultant making $200k revenue with $40k expenses",
    color: "text-cyan-500",
  },
  {
    id: "income",
    name: "Income Projection",
    description: "Advisor practice income with GDC, overrides, bonuses, channel diversification",
    icon: Target,
    samplePrompt: "Project 5-year income for an experienced advisor with $250k base GDC and 10% growth",
    color: "text-orange-500",
  },
];

const QUICK_PROMPTS = [
  "I'm 35, married, making $120k. What should my financial plan look like?",
  "Compare the tax impact of S-Corp vs LLC for my $180k consulting business",
  "My client is 55 with $800k saved. Will they have enough to retire at 62?",
  "Run a comprehensive protection analysis for a family with young children",
  "What estate planning strategies should a $5M estate consider before the 2025 exemption sunset?",
];

export default function AgentPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const handlePrompt = (prompt: string) => {
    navigateToChat(prompt);
  };

  return (
    <div className="container max-w-5xl py-8 space-y-8">
      <SEOHead title="Agent" description="AI-powered financial calculator agent" />

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Brain className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Financial Agent</h1>
            <p className="text-muted-foreground text-sm">
              AI-powered financial calculations — ask anything and the agent will run the right tool
            </p>
          </div>
        </div>
      </div>

      {/* Calculator Tools Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Calculator className="h-5 w-5" /> Available Calculator Tools
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {CALCULATOR_TOOLS.map((tool) => (
            <Card
              key={tool.id}
              className="group cursor-pointer hover:border-primary/40 transition-all hover:shadow-md"
              onClick={() => handlePrompt(tool.samplePrompt)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`shrink-0 h-9 w-9 rounded-lg bg-muted flex items-center justify-center ${tool.color}`}>
                    <tool.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{tool.name}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">live</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{tool.description}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  <Sparkles className="h-3 w-3" /> Try it <ChevronRight className="h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Separator />

      {/* Quick Prompts */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Sparkles className="h-5 w-5" /> Quick Prompts
        </h2>
        <div className="space-y-2">
          {QUICK_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handlePrompt(prompt)}
              className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 hover:border-primary/30 transition-all group flex items-center gap-3"
            >
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
              <span className="text-sm">{prompt}</span>
            </button>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-base">How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { step: "1", title: "Ask a Question", desc: "Type any financial question in natural language — the AI understands context." },
              { step: "2", title: "Agent Selects Tools", desc: "The AI automatically picks the right calculator tool(s) and runs them with your parameters." },
              { step: "3", title: "Get Actionable Results", desc: "Receive detailed projections, comparisons, and personalized recommendations." },
            ].map((s) => (
              <div key={s.step} className="flex gap-3">
                <div className="shrink-0 h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                  {s.step}
                </div>
                <div>
                  <div className="font-medium text-sm">{s.title}</div>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <div className="text-center">
        <Button size="lg" onClick={() => navigate("/chat")} className="gap-2">
          <Brain className="h-5 w-5" /> Open Chat to Start
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          All calculator tools are also available in the main chat interface
        </p>
      </div>
    </div>
  );
}
