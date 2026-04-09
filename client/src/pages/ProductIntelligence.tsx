/**
 * Product Intelligence Dashboard
 * Surfaces IUL crediting history, market indices, risk profiling, and eSignature tracking
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  ArrowLeft, TrendingUp, Shield, FileSignature, BarChart3, Loader2,
  RefreshCw, Target, Activity, ChevronRight, DollarSign, Percent,
  LineChart, PieChart, Clock, CheckCircle2, AlertCircle, Send,
  Eye, FileText, Download, Plus, Gauge,
} from "lucide-react";

export default function ProductIntelligence() {
  const [activeTab, setActiveTab] = useState("market");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center gap-3">
            <Link href="/chat">
              <Button variant="ghost" size="icon" aria-label="Back to chat"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            <div className="flex-1">
              <h1 className="text-xl font-bold">Product Intelligence</h1>
              <p className="text-sm text-muted-foreground">Market data, IUL crediting, risk profiles, and eSignatures</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value="market" className="gap-1 text-xs sm:text-sm">
              <TrendingUp className="h-3 w-3" /> Market
            </TabsTrigger>
            <TabsTrigger value="iul" className="gap-1 text-xs sm:text-sm">
              <BarChart3 className="h-3 w-3" /> IUL
            </TabsTrigger>
            <TabsTrigger value="risk" className="gap-1 text-xs sm:text-sm">
              <Shield className="h-3 w-3" /> Risk
            </TabsTrigger>
            <TabsTrigger value="esign" className="gap-1 text-xs sm:text-sm">
              <FileSignature className="h-3 w-3" /> eSign
            </TabsTrigger>
          </TabsList>

          <TabsContent value="market" className="space-y-4 mt-4">
            <MarketIndicesSection />
          </TabsContent>

          <TabsContent value="iul" className="space-y-4 mt-4">
            <IulCreditingSection />
          </TabsContent>

          <TabsContent value="risk" className="space-y-4 mt-4">
            <RiskProfileSection />
          </TabsContent>

          <TabsContent value="esign" className="space-y-4 mt-4">
            <EsignatureSection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ─── Market Indices Section ─────────────────────────────────────────────────

function MarketIndicesSection() {
  const [selectedSymbol, setSelectedSymbol] = useState("SPX");
  const [months, setMonths] = useState(12);

  const seedMutation = trpc.productIntelligence.seedMarketData.useMutation({
    onSuccess: (data) => {
      toast.success(`Market Data Seeded: ${data.seeded} records created`);
    },
    onError: (err) => {
      toast.error(`Seed Failed: ${err.message}`);
    },
  });

  const symbolsInput = useMemo(() => ["SPX", "NDX", "DJIA", "RUT", "AGG", "VIX"], []);
  const compareQuery = trpc.productIntelligence.compareIndices.useQuery(
    { symbols: symbolsInput, months },
    { enabled: true }
  );

  const historyQuery = trpc.productIntelligence.indexHistory.useQuery(
    { symbol: selectedSymbol, months },
    { enabled: !!selectedSymbol }
  );

  const indices = compareQuery.data ?? {};

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <LineChart className="h-5 w-5 text-blue-500" /> Market Indices
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => seedMutation.mutate()}
          disabled={seedMutation.isPending}
        >
          {seedMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
          Seed Data
        </Button>
      </div>

      {/* Index Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Object.entries(indices).map(([symbol, data]) => (
          <Card
            key={symbol}
            className={`cursor-pointer transition-all hover:shadow-md ${selectedSymbol === symbol ? "ring-2 ring-primary" : ""}`}
            onClick={() => setSelectedSymbol(symbol)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm">{symbol}</span>
                <Badge variant={data.totalReturn >= 0 ? "default" : "destructive"} className="text-xs">
                  {data.totalReturn >= 0 ? "+" : ""}{data.totalReturn}%
                </Badge>
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums">
                {data.latestClose.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {months}mo return
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {Object.keys(indices).length === 0 && !compareQuery.isLoading && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <LineChart className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground mb-3">No market data yet. Seed historical index data to get started.</p>
            <Button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
              {seedMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Seed Market Data
            </Button>
          </CardContent>
        </Card>
      )}

      {/* History Table */}
      {historyQuery.data && historyQuery.data.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{selectedSymbol} — Monthly History</CardTitle>
            <CardDescription>Last {months} months of data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-2">Date</th>
                    <th className="text-right py-2 px-2">Open</th>
                    <th className="text-right py-2 px-2">Close</th>
                    <th className="text-right py-2 px-2">Return</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(historyQuery.data) ? historyQuery.data : []).slice(0, 24).map((row: any, i: number) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 px-2">{row.date}</td>
                      <td className="text-right py-2 px-2">{parseFloat(row.openPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td className="text-right py-2 px-2">{parseFloat(row.closePrice).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td className={`text-right py-2 px-2 ${parseFloat(row.dailyReturn) >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {parseFloat(row.dailyReturn) >= 0 ? "+" : ""}{parseFloat(row.dailyReturn).toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Time Range Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Time range:</span>
        {[6, 12, 24, 60].map((m) => (
          <Button
            key={m}
            variant={months === m ? "default" : "outline"}
            size="sm"
            onClick={() => setMonths(m)}
          >
            {m < 12 ? `${m}mo` : `${m / 12}yr`}
          </Button>
        ))}
      </div>
    </>
  );
}

// ─── IUL Crediting Section ──────────────────────────────────────────────────

function IulCreditingSection() {
  const [productId, setProductId] = useState(1);
  const [selectedStrategy, setSelectedStrategy] = useState<string | undefined>(undefined);

  const seedMutation = trpc.productIntelligence.seedIulData.useMutation({
    onSuccess: (data) => {
      toast.success(`IUL Data Seeded: ${data.seeded} crediting records created`);
    },
    onError: (err) => {
      toast.error(`Seed Failed: ${err.message}`);
    },
  });

  const strategiesQuery = trpc.productIntelligence.availableStrategies.useQuery({ productId });
  const avgQuery = trpc.productIntelligence.avgCreditingByStrategy.useQuery({ productId });
  const historyQuery = trpc.productIntelligence.creditingHistory.useQuery(
    { productId, strategy: selectedStrategy },
    { enabled: true }
  );

  const strategies = strategiesQuery.data ?? [];
  const avgData = avgQuery.data ?? [];

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-emerald-500" /> IUL Crediting History
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => seedMutation.mutate()}
          disabled={seedMutation.isPending}
        >
          {seedMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
          Seed IUL Data
        </Button>
      </div>

      {/* Strategy Averages */}
      {avgData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {avgData.map((s) => (
            <Card
              key={s.strategy}
              className={`cursor-pointer transition-all hover:shadow-md ${selectedStrategy === s.strategy ? "ring-2 ring-primary" : ""}`}
              onClick={() => setSelectedStrategy(selectedStrategy === s.strategy ? undefined : s.strategy)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm truncate">{s.strategy}</span>
                  <Badge variant="outline" className="text-xs">{s.count} periods</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <div className="text-xs text-muted-foreground">Avg Cap</div>
                    <div className="text-lg font-bold text-emerald-500">{s.avgCap}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Avg Part.</div>
                    <div className="text-lg font-bold text-blue-500">{s.avgPart}%</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {avgData.length === 0 && !avgQuery.isLoading && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground mb-3">No IUL crediting data yet. Seed data to analyze index strategies.</p>
            <Button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
              {seedMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Seed IUL Data
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Crediting History Table */}
      {historyQuery.data && historyQuery.data.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Crediting History {selectedStrategy ? `— ${selectedStrategy}` : "— All Strategies"}
            </CardTitle>
            <CardDescription>Product #{productId} historical cap/participation rates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-2">Date</th>
                    <th className="text-left py-2 px-2">Strategy</th>
                    <th className="text-right py-2 px-2">Cap</th>
                    <th className="text-right py-2 px-2">Part.</th>
                    <th className="text-right py-2 px-2">Spread</th>
                    <th className="text-right py-2 px-2">Credited</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(historyQuery.data) ? historyQuery.data : []).slice(0, 30).map((row: any, i: number) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 px-2">{row.effectiveDate}</td>
                      <td className="py-2 px-2 truncate max-w-[120px]">{row.indexStrategy}</td>
                      <td className="text-right py-2 px-2">{parseFloat(row.capRate).toFixed(1)}%</td>
                      <td className="text-right py-2 px-2">{parseFloat(row.participationRate).toFixed(0)}%</td>
                      <td className="text-right py-2 px-2">{parseFloat(row.spread).toFixed(2)}%</td>
                      <td className="text-right py-2 px-2 text-emerald-500 font-medium">
                        {parseFloat(row.multiplierBonus).toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Product Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Product ID:</span>
        {[1, 2, 3, 4, 5].map((id) => (
          <Button
            key={id}
            variant={productId === id ? "default" : "outline"}
            size="sm"
            onClick={() => { setProductId(id); setSelectedStrategy(undefined); }}
          >
            #{id}
          </Button>
        ))}
      </div>
    </>
  );
}

// ─── Risk Profile Section ───────────────────────────────────────────────────

function RiskProfileSection() {
  const [showAssessment, setShowAssessment] = useState(false);

  // Form state for manual assessment
  const [age, setAge] = useState("45");
  const [experience, setExperience] = useState<"none" | "beginner" | "intermediate" | "advanced">("intermediate");
  const [timeHorizon, setTimeHorizon] = useState<"1-3" | "3-5" | "5-10" | "10+">("10+");
  const [lossReaction, setLossReaction] = useState<"sell_all" | "sell_some" | "hold" | "buy_more">("hold");
  const [incomeStability, setIncomeStability] = useState<"unstable" | "moderate" | "stable" | "very_stable">("stable");
  const [goalPriority, setGoalPriority] = useState<"preservation" | "income" | "growth" | "aggressive_growth">("growth");

  const profileQuery = trpc.productIntelligence.riskProfile.useQuery(undefined, {
    retry: false,
  });

  const assessMutation = trpc.productIntelligence.assessRisk.useMutation({
    onSuccess: () => {
      toast.success("Risk Profile Updated");
      profileQuery.refetch();
      setShowAssessment(false);
    },
    onError: (err) => {
      toast.error(`Assessment Failed: ${err.message}`);
    },
  });

  const profile = profileQuery.data;

  const riskColor = (num: number) => {
    if (num <= 20) return "text-blue-500";
    if (num <= 40) return "text-cyan-500";
    if (num <= 60) return "text-yellow-500";
    if (num <= 80) return "text-orange-500";
    return "text-red-500";
  };

  const riskBg = (num: number) => {
    if (num <= 20) return "bg-blue-500";
    if (num <= 40) return "bg-cyan-500";
    if (num <= 60) return "bg-yellow-500";
    if (num <= 80) return "bg-orange-500";
    return "bg-red-500";
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="h-5 w-5 text-purple-500" /> Risk Profile
        </h2>
        <Button variant="outline" size="sm" onClick={() => setShowAssessment(!showAssessment)}>
          <Target className="h-3 w-3 mr-1" />
          {showAssessment ? "Cancel" : "Take Assessment"}
        </Button>
      </div>

      {/* Current Profile */}
      {profile && (
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Risk Gauge */}
              <div className="flex flex-col items-center">
                <div className="relative w-32 h-32">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/20" />
                    <circle
                      cx="50" cy="50" r="40" fill="none" strokeWidth="8"
                      className={riskBg(profile.riskNumber)}
                      strokeDasharray={`${profile.riskNumber * 2.51} 251`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-3xl font-bold font-mono tabular-nums ${riskColor(profile.riskNumber)}`}>{profile.riskNumber}</span>
                    <span className="text-xs text-muted-foreground">/ 99</span>
                  </div>
                </div>
                <Badge className="mt-2">{profile.riskCategory}</Badge>
              </div>

              {/* Allocation */}
              <div className="flex-1 space-y-3 w-full">
                <h3 className="font-medium">Suggested Allocation</h3>
                <AllocationBar label="Equity" value={profile.equityAllocation} color="bg-blue-500" />
                <AllocationBar label="Fixed Income" value={profile.fixedIncomeAllocation} color="bg-emerald-500" />
                <AllocationBar label="Alternatives" value={profile.alternativesAllocation} color="bg-purple-500" />
                <AllocationBar label="Cash" value={profile.cashAllocation} color="bg-amber-500" />
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Max Drawdown Tolerance</span>
                  <span className="font-medium">{profile.maxDrawdownTolerance}%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Time Horizon</span>
                  <span className="font-medium">{profile.timeHorizon}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!profile && !profileQuery.isLoading && !showAssessment && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Gauge className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground mb-3">No risk profile yet. Take the assessment to determine your risk tolerance.</p>
            <Button onClick={() => setShowAssessment(true)}>
              <Target className="h-4 w-4 mr-2" /> Start Assessment
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Assessment Form */}
      {showAssessment && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Risk Tolerance Assessment</CardTitle>
            <CardDescription>Answer 6 questions to determine your risk profile</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Age</Label>
                <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Investment Experience</Label>
                <Select value={experience} onValueChange={(v: any) => setExperience(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Time Horizon</Label>
                <Select value={timeHorizon} onValueChange={(v: any) => setTimeHorizon(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1-3">1-3 years</SelectItem>
                    <SelectItem value="3-5">3-5 years</SelectItem>
                    <SelectItem value="5-10">5-10 years</SelectItem>
                    <SelectItem value="10+">10+ years</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Reaction to 20% Loss</Label>
                <Select value={lossReaction} onValueChange={(v: any) => setLossReaction(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sell_all">Sell everything</SelectItem>
                    <SelectItem value="sell_some">Sell some</SelectItem>
                    <SelectItem value="hold">Hold steady</SelectItem>
                    <SelectItem value="buy_more">Buy more</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Income Stability</Label>
                <Select value={incomeStability} onValueChange={(v: any) => setIncomeStability(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unstable">Unstable</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="stable">Stable</SelectItem>
                    <SelectItem value="very_stable">Very Stable</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Goal Priority</Label>
                <Select value={goalPriority} onValueChange={(v: any) => setGoalPriority(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preservation">Capital Preservation</SelectItem>
                    <SelectItem value="income">Income Generation</SelectItem>
                    <SelectItem value="growth">Growth</SelectItem>
                    <SelectItem value="aggressive_growth">Aggressive Growth</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => assessMutation.mutate({
                age: parseInt(age),
                investmentExperience: experience,
                timeHorizon,
                reactionToLoss: lossReaction,
                incomeStability,
                goalPriority,
              })}
              disabled={assessMutation.isPending}
            >
              {assessMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Target className="h-4 w-4 mr-2" />}
              Calculate Risk Profile
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function AllocationBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="font-medium">{value}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

// ─── eSignature Section ─────────────────────────────────────────────────────

function EsignatureSection() {

  const envelopesQuery = trpc.productIntelligence.myEnvelopes.useQuery(undefined, {
    retry: false,
  });

  const statsQuery = trpc.productIntelligence.signatureStats.useQuery(undefined, {
    retry: false,
  });

  const createMutation = trpc.productIntelligence.createEnvelope.useMutation({
    onSuccess: (data) => {
      toast.success(`Envelope Created: ${data.envelopeId}`);
      envelopesQuery.refetch();
      statsQuery.refetch();
    },
    onError: (err) => {
      toast.error(`Create Failed: ${err.message}`);
    },
  });

  const stats = statsQuery.data;
  const envelopes = envelopesQuery.data ?? [];

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "sent": return <Send className="h-4 w-4 text-blue-500" />;
      case "viewed": return <Eye className="h-4 w-4 text-amber-500" />;
      case "signed": return <FileText className="h-4 w-4 text-emerald-500" />;
      case "declined": case "voided": case "expired": return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileSignature className="h-5 w-5 text-amber-500" /> eSignature Tracking
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => createMutation.mutate({ provider: "manual", documentType: "Financial Agreement" })}
          disabled={createMutation.isPending}
        >
          <Plus className="h-3 w-3 mr-1" /> New Envelope
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={FileText} label="Total" value={stats.total} color="text-blue-500" />
          <StatCard icon={Clock} label="Pending" value={stats.pending} color="text-amber-500" />
          <StatCard icon={CheckCircle2} label="Completed" value={stats.completed} color="text-green-500" />
          <StatCard icon={Activity} label="Avg Days" value={stats.avgCompletionDays} color="text-purple-500" />
        </div>
      )}

      {/* Envelopes List */}
      {envelopes.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Envelopes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {envelopes.slice(0, 20).map((env: any) => (
                <div key={env.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30">
                  {statusIcon(env.status)}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{env.documentType || "Document"}</div>
                    <div className="text-xs text-muted-foreground">
                      {env.envelopeId} · {env.provider}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs capitalize">{env.status}</Badge>
                  {env.createdAt && (
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {new Date(env.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : !envelopesQuery.isLoading ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <FileSignature className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground mb-3">No eSignature envelopes yet. Create one to start tracking.</p>
            <Button
              onClick={() => createMutation.mutate({ provider: "manual", documentType: "Financial Agreement" })}
              disabled={createMutation.isPending}
            >
              <Plus className="h-4 w-4 mr-2" /> Create Envelope
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <Icon className={`h-5 w-5 ${color}`} />
        <div>
          <div className="text-2xl font-bold font-mono tabular-nums">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
