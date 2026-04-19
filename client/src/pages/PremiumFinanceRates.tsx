import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, History, RefreshCw, Loader2, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";

export default function PremiumFinanceRates({ embedded = false }: { embedded?: boolean } = {}) {
  const { user } = useAuth();
  const [tab, setTab] = useState("current");
  const [historyLimit, setHistoryLimit] = useState(30);

  const ratesQ = trpc.premiumFinanceRates.getRates.useQuery(undefined, { enabled: !!user });
  const historyQ = trpc.premiumFinanceRates.getRateHistory.useQuery({ limit: historyLimit }, { enabled: !!user });

  const formatRate = (r: number | null | undefined) => r != null ? `${(r * 100).toFixed(3)}%` : "—";
  const formatDate = (d: string | number | null | undefined) => d ? new Date(d).toLocaleDateString() : "—";

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <SEOHead title="Premium Finance Rates" description="Premium finance rate analysis and history" />
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <TrendingUp className="h-8 w-8 text-primary" /> Premium Finance Rates
        </h1>
        <p className="text-muted-foreground mt-1">
          Live SOFR rates and historical trends for premium financing analysis.
        </p>
        <p className="text-xs text-muted-foreground mt-1">For full premium financing modeling with projections, see <a href="/wealth-engine" className="text-primary hover:underline">Wealth Engine → ③ Protect → Premium Financing</a></p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="current" className="gap-1"><TrendingUp className="h-4 w-4" /> Current Rates</TabsTrigger>
          <TabsTrigger value="history" className="gap-1"><History className="h-4 w-4" /> Rate History</TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Current SOFR Rates</CardTitle>
                <CardDescription>Secured Overnight Financing Rate — benchmark for premium finance loans</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => ratesQ.refetch()} disabled={ratesQ.isFetching}>
                <RefreshCw className={`h-4 w-4 mr-1 ${ratesQ.isFetching ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {ratesQ.isLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : ratesQ.error ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Unable to fetch rates. FRED API key may be required.</p>
                  <p className="text-xs mt-1">{ratesQ.error.message}</p>
                </div>
              ) : ratesQ.data ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {(() => {
                      const d = ratesQ.data as any;
                      const items = [
                        { label: "SOFR Rate", value: formatRate(d.sofrRate ?? d.rate) },
                        { label: "30-Day Avg", value: formatRate(d.avg30Day ?? d.average30) },
                        { label: "90-Day Avg", value: formatRate(d.avg90Day ?? d.average90) },
                        { label: "Last Updated", value: formatDate(d.date ?? d.lastUpdated) },
                      ];
                      return items.map((m) => (
                        <div key={m.label} className="bg-muted/50 rounded-lg p-4 text-center">
                          <div className="text-xs text-muted-foreground">{m.label}</div>
                          <div className="text-xl font-bold mt-1">{m.value}</div>
                        </div>
                      ));
                    })()}
                  </div>

                  {/* Spread Analysis */}
                  <Card className="bg-muted/30">
                    <CardContent className="pt-4">
                      <h4 className="font-semibold text-sm mb-3">Premium Finance Spread Analysis</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center text-sm">
                        {[
                          { label: "Typical Loan Rate", spread: 2.5 },
                          { label: "Conservative Spread", spread: 3.0 },
                          { label: "Aggressive Spread", spread: 2.0 },
                        ].map((s) => {
                          const base = (ratesQ.data as any).sofrRate ?? (ratesQ.data as any).rate ?? 0.05;
                          return (
                            <div key={s.label} className="bg-background rounded-lg p-3">
                              <div className="text-xs text-muted-foreground">{s.label}</div>
                              <div className="text-lg font-bold">{((base + s.spread / 100) * 100).toFixed(2)}%</div>
                              <div className="text-xs text-muted-foreground">SOFR + {s.spread}%</div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle>SOFR Rate History</CardTitle><CardDescription>Historical rate data for trend analysis</CardDescription></div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">Days:</Label>
                <Input type="number" value={historyLimit} onChange={(e) => setHistoryLimit(+e.target.value)} className="w-20" min={7} max={365} />
              </div>
            </CardHeader>
            <CardContent>
              {historyQ.isLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : historyQ.error ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Unable to fetch rate history.</p>
                </div>
              ) : (historyQ.data as any[])?.length ? (
                <div className="space-y-2 max-h-96 overflow-auto">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-semibold text-muted-foreground border-b pb-2 sticky top-0 bg-background">
                    <div>Date</div><div>Rate</div><div>Change</div><div>Trend</div>
                  </div>
                  {(historyQ.data as any[]).map((entry: any, i: number) => {
                    const prev = (historyQ.data as any[])[i + 1];
                    const rate = entry.rate ?? entry.sofrRate ?? 0;
                    const prevRate = prev?.rate ?? prev?.sofrRate ?? rate;
                    const change = rate - prevRate;
                    return (
                      <div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm py-1.5 border-b border-border/30">
                        <div>{formatDate(entry.date)}</div>
                        <div className="font-mono">{formatRate(rate)}</div>
                        <div className={change > 0 ? "text-red-500" : change < 0 ? "text-green-500" : "text-muted-foreground"}>
                          {change > 0 ? "+" : ""}{(change * 100).toFixed(3)}%
                        </div>
                        <div>
                          {change > 0 ? <ArrowUpRight className="h-4 w-4 text-red-500" /> : change < 0 ? <ArrowDownRight className="h-4 w-4 text-green-500" /> : <Minus className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No rate history available.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
