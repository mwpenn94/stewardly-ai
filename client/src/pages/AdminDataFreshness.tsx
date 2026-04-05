/**
 * AdminDataFreshness — Provider status grid with refresh/pause controls. Admin only.
 */
import { useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Database, RefreshCw, Loader2, XCircle, Clock,
  CheckCircle2, AlertTriangle, Pause, Play,
} from "lucide-react";

interface DataProvider {
  name: string;
  source: string;
  schedule: string;
  category: string;
  lastRefresh: string;
  status: "fresh" | "stale" | "error";
}

const PROVIDERS: DataProvider[] = [
  { name: "SOFR Rates", source: "FRED API", schedule: "Daily 6am", category: "Rates", lastRefresh: "2h ago", status: "fresh" },
  { name: "Market Close", source: "Market Data API", schedule: "Daily 7pm", category: "Market", lastRefresh: "14h ago", status: "fresh" },
  { name: "SEC IAPD", source: "SEC.gov", schedule: "Weekly", category: "Verification", lastRefresh: "3d ago", status: "fresh" },
  { name: "CFP Board", source: "CFP Board API", schedule: "Monthly", category: "Verification", lastRefresh: "12d ago", status: "fresh" },
  { name: "NASBA CPA", source: "NASBA API", schedule: "Monthly", category: "Verification", lastRefresh: "18d ago", status: "fresh" },
  { name: "NMLS Consumer", source: "NMLS API", schedule: "Monthly", category: "Verification", lastRefresh: "15d ago", status: "fresh" },
  { name: "State Bar", source: "State Bar APIs", schedule: "Monthly", category: "Verification", lastRefresh: "20d ago", status: "stale" },
  { name: "AM Best Ratings", source: "AM Best", schedule: "Monthly", category: "Insurance", lastRefresh: "25d ago", status: "fresh" },
  { name: "Census Data", source: "Census API", schedule: "Monthly", category: "Demographics", lastRefresh: "8d ago", status: "fresh" },
  { name: "IRS Parameters", source: "IRS.gov", schedule: "Annual", category: "Tax", lastRefresh: "45d ago", status: "fresh" },
  { name: "SSA Parameters", source: "SSA.gov", schedule: "Annual", category: "Social Security", lastRefresh: "60d ago", status: "fresh" },
  { name: "Medicare Premiums", source: "CMS.gov", schedule: "Annual", category: "Medicare", lastRefresh: "90d ago", status: "fresh" },
  { name: "Product Rates", source: "Carrier APIs", schedule: "Monthly", category: "Insurance", lastRefresh: "10d ago", status: "fresh" },
  { name: "IUL Crediting", source: "Carrier Reports", schedule: "Quarterly", category: "Insurance", lastRefresh: "30d ago", status: "fresh" },
];

const statusIcon = (s: DataProvider["status"]) => {
  switch (s) {
    case "fresh": return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    case "stale": return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    case "error": return <XCircle className="w-4 h-4 text-red-500" />;
  }
};

export default function AdminDataFreshness() {
  const { user, loading: authLoading } = useAuth();
  const [paused, setPaused] = useState<Record<string, boolean>>({});

  if (authLoading) {
    return <AppShell><div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div></AppShell>;
  }

  if (!user || user.role !== "admin") {
    return <AppShell><div className="flex flex-col items-center justify-center h-64 gap-4"><XCircle className="w-12 h-12 text-red-500" /><p className="text-muted-foreground">Admin access required</p></div></AppShell>;
  }

  const freshCount = PROVIDERS.filter(p => p.status === "fresh").length;
  const staleCount = PROVIDERS.filter(p => p.status === "stale").length;

  return (
    <AppShell>
      <div className="container max-w-6xl py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Database className="w-6 h-6" /> Data Freshness</h1>
            <p className="text-muted-foreground">Monitor data provider status and refresh schedules</p>
          </div>
          <Button variant="outline" onClick={() => toast.info("Triggering refresh check...")}>
            <RefreshCw className="w-4 h-4 mr-2" /> Check All
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold text-emerald-500">{freshCount}</p>
              <p className="text-xs text-muted-foreground">Fresh</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold text-amber-500">{staleCount}</p>
              <p className="text-xs text-muted-foreground">Stale</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold">{PROVIDERS.length}</p>
              <p className="text-xs text-muted-foreground">Total Providers</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PROVIDERS.map(provider => (
            <Card key={provider.name} className={paused[provider.name] ? "opacity-60" : ""}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      {statusIcon(provider.status)}
                      <p className="font-medium text-sm">{provider.name}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{provider.source}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{provider.schedule}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="outline">{provider.category}</Badge>
                      <span className="text-muted-foreground">Last: {provider.lastRefresh}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => toast.info(`Refreshing ${provider.name}...`)}>
                      <RefreshCw className="w-3 h-3" />
                    </Button>
                    <Switch
                      checked={!paused[provider.name]}
                      onCheckedChange={(checked) => {
                        setPaused(prev => ({ ...prev, [provider.name]: !checked }));
                        toast.info(checked ? `${provider.name} resumed` : `${provider.name} paused`);
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
