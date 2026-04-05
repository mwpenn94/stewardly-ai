/**
 * AdminRateManagement — Rate profiles grid + AI recommendations. Admin only.
 */
import { useState } from "react";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  TrendingUp, Loader2, XCircle, RefreshCw, Sparkles,
  ArrowUpRight, ArrowDownRight, Clock, DollarSign,
} from "lucide-react";

export default function AdminRateManagement() {
  const { user, loading: authLoading } = useAuth();

  // Rate profiles are managed through the scraping/rate services

  if (authLoading) {
    return <AppShell><div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div></AppShell>;
  }
  if (!user || user.role !== "admin") {
    return <AppShell><div className="flex flex-col items-center justify-center h-64 gap-4"><XCircle className="w-12 h-12 text-red-500" /><p className="text-muted-foreground">Admin access required</p></div></AppShell>;
  }

  const profiles: any[] = [];

  return (
    <AppShell>
      <div className="container max-w-6xl py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><TrendingUp className="w-6 h-6" /> Rate Management</h1>
            <p className="text-muted-foreground">Manage rate profiles and AI-powered rate recommendations</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => toast.info("Running AI rate analysis...")}>
              <Sparkles className="w-4 h-4 mr-2" /> AI Recommendations
            </Button>
            <Button variant="outline" onClick={() => toast.info("Refreshing...")}>
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
          </div>
        </div>

        <Tabs defaultValue="profiles">
          <TabsList>
            <TabsTrigger value="profiles">Rate Profiles</TabsTrigger>
            <TabsTrigger value="history">Rate History</TabsTrigger>
            <TabsTrigger value="recommendations">AI Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="profiles" className="space-y-4">
            {profiles.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No rate profiles configured yet.</p>
                  <Button className="mt-4" onClick={() => toast.info("Feature coming soon")}>Create Profile</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {profiles.map((profile: any) => (
                  <Card key={profile.id}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{profile.name || profile.productType || "Rate Profile"}</p>
                        <Badge variant={profile.isActive ? "default" : "outline"}>
                          {profile.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Type</p>
                          <p className="font-medium">{profile.productType || "—"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Updated</p>
                          <p className="font-medium">{profile.updatedAt ? new Date(profile.updatedAt).toLocaleDateString() : "—"}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardContent className="py-12 text-center">
                <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Rate history visualization coming soon.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recommendations">
            <Card>
              <CardContent className="py-12 text-center">
                <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">AI rate recommendations will appear here after analysis runs.</p>
                <Button className="mt-4" variant="outline" onClick={() => toast.info("Triggering AI analysis...")}>
                  Run Analysis
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
