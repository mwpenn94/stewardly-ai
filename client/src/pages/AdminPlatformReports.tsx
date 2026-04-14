/**
 * AdminPlatformReports — Aggregate production, regional comparison, campaign ROI. Admin only.
 */
import { useState } from "react";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  FileText, Loader2, XCircle, Download, Calendar,
  TrendingUp, BarChart3, Globe, DollarSign,
} from "lucide-react";

export default function AdminPlatformReports() {
  const { user, loading: authLoading } = useAuth();
  const [generating, setGenerating] = useState(false);

  const generateReport = trpc.businessReports.generate.useMutation({
    onSuccess: () => { toast.success("Report generated!"); setGenerating(false); },
    onError: () => { toast.error("Report generation failed"); setGenerating(false); },
  });

  if (authLoading) {
    return <AppShell title="Platform Reports"><div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div></AppShell>;
      <SEOHead title="Platform Reports" description="View platform analytics and usage reports" />
  }
  if (!user || user.role !== "admin") {
    return <AppShell title="Platform Reports"><div className="flex flex-col items-center justify-center h-64 gap-4"><XCircle className="w-12 h-12 text-red-500" /><p className="text-muted-foreground">Admin access required</p></div></AppShell>;
  }

  const reportTypes = [
    { type: "performance", label: "Performance Report", description: "Aggregate production metrics across all advisors", icon: <TrendingUp className="w-5 h-5" /> },
    { type: "campaign", label: "Campaign ROI", description: "Marketing campaign performance and ROI analysis", icon: <BarChart3 className="w-5 h-5" /> },
    { type: "regional", label: "Regional Comparison", description: "Performance comparison across regions", icon: <Globe className="w-5 h-5" /> },
    { type: "pipeline", label: "Pipeline Health", description: "Lead pipeline status and conversion metrics", icon: <DollarSign className="w-5 h-5" /> },
    { type: "clientOutcomes", label: "Client Outcomes", description: "Client satisfaction and outcome tracking", icon: <FileText className="w-5 h-5" /> },
    { type: "industry", label: "Industry Benchmarks", description: "Performance vs industry benchmarks", icon: <BarChart3 className="w-5 h-5" /> },
  ];

  const handleGenerate = (type: string) => {
    setGenerating(true);
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    generateReport.mutate({
      type,
      scopeType: "platform",
      periodStart: monthAgo.toISOString(),
      periodEnd: now.toISOString(),
    });
  };

  return (
    <AppShell title="Platform Reports">
      <div className="container max-w-6xl py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6" /> Platform Reports</h1>
          <p className="text-muted-foreground">Generate and view aggregate platform reports</p>
        </div>

        <Tabs defaultValue="generate">
          <TabsList>
            <TabsTrigger value="generate">Generate Reports</TabsTrigger>
            <TabsTrigger value="history">Report History</TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reportTypes.map(rt => (
                <Card key={rt.type} className="hover:bg-muted/30 transition-colors">
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        {rt.icon}
                      </div>
                      <div>
                        <p className="font-medium">{rt.label}</p>
                        <p className="text-xs text-muted-foreground">{rt.description}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={generating}
                      onClick={() => handleGenerate(rt.type)}
                    >
                      {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
                      Generate
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Generated reports will appear here.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
