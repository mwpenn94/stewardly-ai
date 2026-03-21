/**
 * Intelligence Hub (C23)
 * Consolidates: Data Intelligence, Analytics Hub, Model Results, Intelligence Feed
 * Tabs: Overview | Models | Data | Analytics
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import { navigateToChat } from "@/lib/navigateToChat";
import {
  ArrowLeft, Brain, BarChart3, Database, TrendingUp, Loader2,
  Play, Eye, RefreshCw, Lightbulb, Target, Activity, Zap,
  ChevronRight, Clock, AlertTriangle,
} from "lucide-react";

export default function IntelligenceHub() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center gap-3">
            <Link href="/chat">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">Intelligence</h1>
              <p className="text-sm text-muted-foreground">Models, data insights, and analytics</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <QuickStat icon={Brain} label="AI Models" value="8" color="text-blue-500" />
          <QuickStat icon={Database} label="Data Sources" value="5" color="text-purple-500" />
          <QuickStat icon={TrendingUp} label="Insights Today" value="—" color="text-green-500" />
          <QuickStat icon={Lightbulb} label="Predictions" value="—" color="text-amber-500" />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="gap-1">
              <Activity className="h-3 w-3" /> Overview
            </TabsTrigger>
            <TabsTrigger value="models" className="gap-1">
              <Brain className="h-3 w-3" /> Models
            </TabsTrigger>
            <TabsTrigger value="data" className="gap-1">
              <Database className="h-3 w-3" /> Data
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1">
              <BarChart3 className="h-3 w-3" /> Analytics
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <OverviewSection />
          </TabsContent>

          {/* Models Tab */}
          <TabsContent value="models" className="space-y-4 mt-4">
            <ModelsSection />
          </TabsContent>

          {/* Data Tab */}
          <TabsContent value="data" className="space-y-4 mt-4">
            <DataSection />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4 mt-4">
            <AnalyticsSection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function QuickStat({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <Icon className={`h-5 w-5 ${color}`} />
        <div>
          <div className="text-lg font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewSection() {
  return (
    <div className="space-y-4">
      {/* Intelligence Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Intelligence Feed</CardTitle>
          <CardDescription>Recent insights and predictions from your AI models</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <InsightItem
            icon={TrendingUp}
            title="Portfolio Risk Assessment Updated"
            description="Your risk score has improved by 3 points based on recent market conditions"
            time="2h ago"
            type="positive"
          />
          <InsightItem
            icon={Lightbulb}
            title="Retirement Gap Detected"
            description="Based on current savings rate, consider increasing contributions by $200/mo"
            time="5h ago"
            type="warning"
          />
          <InsightItem
            icon={Target}
            title="Product Match Found"
            description="New IUL product matches your client's suitability profile with 94% confidence"
            time="1d ago"
            type="info"
          />
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => navigateToChat("Run a full portfolio risk analysis and provide a comprehensive report on my current positions, risk exposure, and recommendations", "financial")}>
            <Zap className="h-4 w-4" />
            <span className="text-xs">Run Full Analysis</span>
          </Button>
          <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => navigateToChat("Give me a morning brief: summarize today's key market movements, any portfolio alerts, upcoming client meetings, and action items for the day", "financial")}>
            <Lightbulb className="h-4 w-4" />
            <span className="text-xs">Morning Brief</span>
          </Button>
          <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => navigateToChat("Compare the top insurance and annuity products available on the platform. Show me a side-by-side comparison of features, costs, and suitability scores", "financial")}>
            <BarChart3 className="h-4 w-4" />
            <span className="text-xs">Compare Products</span>
          </Button>
          <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => navigateToChat("What are the latest market insights and trends? Cover equities, fixed income, and insurance product trends that are relevant to my practice", "financial")}>
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs">Market Insights</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function InsightItem({ icon: Icon, title, description, time, type }: {
  icon: any; title: string; description: string; time: string;
  type: "positive" | "warning" | "info";
}) {
  const colors = {
    positive: "text-green-500",
    warning: "text-amber-500",
    info: "text-blue-500",
  };
  return (
    <div className="flex gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <Icon className={`h-5 w-5 ${colors[type]} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <div className="text-xs text-muted-foreground shrink-0">{time}</div>
    </div>
  );
}

function ModelsSection() {
  const models = [
    { name: "Portfolio Risk", type: "Risk Assessment", status: "active", accuracy: 92, lastRun: "2h ago" },
    { name: "Retirement Projection", type: "Financial Planning", status: "active", accuracy: 88, lastRun: "1d ago" },
    { name: "Product Suitability", type: "Matching", status: "active", accuracy: 94, lastRun: "3h ago" },
    { name: "Tax Optimization", type: "Tax Planning", status: "active", accuracy: 86, lastRun: "1d ago" },
    { name: "Insurance Needs", type: "Needs Analysis", status: "active", accuracy: 91, lastRun: "5h ago" },
    { name: "Estate Planning", type: "Estate Analysis", status: "active", accuracy: 89, lastRun: "2d ago" },
    { name: "Debt Optimization", type: "Debt Analysis", status: "active", accuracy: 87, lastRun: "1d ago" },
    { name: "Behavioral Finance", type: "Behavioral", status: "active", accuracy: 85, lastRun: "3d ago" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">AI Model Fleet</h3>
        <Button size="sm" variant="outline" onClick={() => navigateToChat("Run all AI models and give me a consolidated report: Portfolio Risk, Retirement Projection, Product Suitability, Tax Optimization, Insurance Needs, Estate Planning, Debt Optimization, and Behavioral Finance analysis", "financial")}>
          <Play className="h-3 w-3 mr-1" /> Run All
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {models.map((model) => (
          <Card key={model.name}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-medium text-sm">{model.name}</div>
                  <div className="text-xs text-muted-foreground">{model.type}</div>
                </div>
                <Badge variant="default" className="text-xs">{model.status}</Badge>
              </div>
              <div className="space-y-1 mb-3">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Accuracy</span>
                  <span>{model.accuracy}%</span>
                </div>
                <Progress value={model.accuracy} className="h-1.5" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {model.lastRun}
                </span>
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => navigateToChat(`Run the ${model.name} model (${model.type}) and provide detailed results with recommendations`, "financial")}>
                  <Play className="h-3 w-3 mr-1" /> Run
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function DataSection() {
  const sources = [
    { name: "Market Data", provider: "Yahoo Finance", status: "connected", records: "Real-time" },
    { name: "Product Database", provider: "Internal", status: "connected", records: "150+ products" },
    { name: "Regulatory Feed", provider: "SEC/FINRA/NAIC", status: "monitoring", records: "Daily updates" },
    { name: "Knowledge Base", provider: "Internal", status: "connected", records: "Growing" },
    { name: "User Documents", provider: "Uploaded", status: "connected", records: "Per-user" },
  ];

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Data Sources</h3>
      <div className="space-y-2">
        {sources.map((source) => (
          <Card key={source.name}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-purple-500" />
                <div>
                  <div className="font-medium text-sm">{source.name}</div>
                  <div className="text-xs text-muted-foreground">{source.provider}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{source.records}</span>
                <Badge variant={source.status === "connected" ? "default" : "secondary"} className="text-xs">
                  {source.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Knowledge Base</CardTitle>
          <CardDescription>AI-curated knowledge articles and training data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <div className="text-lg font-bold">—</div>
              <div className="text-xs text-muted-foreground">Articles</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <div className="text-lg font-bold">—</div>
              <div className="text-xs text-muted-foreground">Categories</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <div className="text-lg font-bold">—</div>
              <div className="text-xs text-muted-foreground">Freshness</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AnalyticsSection() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platform Analytics</CardTitle>
          <CardDescription>Usage patterns and AI performance metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <div className="text-lg font-bold">—</div>
              <div className="text-xs text-muted-foreground">Conversations</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <div className="text-lg font-bold">—</div>
              <div className="text-xs text-muted-foreground">AI Responses</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <div className="text-lg font-bold">—</div>
              <div className="text-xs text-muted-foreground">Tools Used</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <div className="text-lg font-bold">—</div>
              <div className="text-xs text-muted-foreground">Satisfaction</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Model Performance</CardTitle>
          <CardDescription>Accuracy and usage across all AI models</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground text-sm">
            <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Analytics will populate as you use the platform.
            <br />
            <Button variant="link" size="sm" className="mt-1 text-xs" onClick={() => navigateToChat("Show me detailed analytics on AI model performance, response accuracy, and usage patterns across the platform")}>
              Ask the AI for detailed analytics reports →
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
