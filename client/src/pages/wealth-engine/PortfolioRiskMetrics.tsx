/**
 * PortfolioRiskMetrics.tsx — Interactive portfolio risk analysis & efficient frontier
 *
 * Pass 63. Calls wealthEngine.portfolioRiskMetrics to compute:
 *   - Annualized return, volatility, Sharpe, Sortino, max drawdown
 *   - Efficient frontier scatter chart (risk vs return)
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "wouter";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import {
  ArrowLeft, TrendingUp, TrendingDown, Shield, Activity,
  BarChart3, Target, Gauge, AlertTriangle, Info, Play, RefreshCw,
} from "lucide-react";

const SAMPLE_RETURNS = {
  conservative: [0.005, 0.003, -0.002, 0.004, 0.006, 0.002, -0.001, 0.003, 0.005, 0.004, 0.002, 0.003, 0.001, -0.003, 0.004, 0.005, 0.003, 0.002, -0.001, 0.004, 0.003, 0.002, 0.005, 0.001],
  moderate: [0.012, 0.008, -0.006, 0.015, 0.010, -0.003, 0.018, 0.005, -0.008, 0.020, 0.012, 0.007, -0.004, 0.016, 0.009, -0.002, 0.014, 0.011, -0.007, 0.019, 0.008, 0.013, -0.005, 0.017],
  aggressive: [0.025, 0.015, -0.018, 0.030, 0.020, -0.012, 0.035, 0.010, -0.022, 0.040, 0.018, 0.028, -0.015, 0.032, 0.022, -0.010, 0.038, 0.014, -0.020, 0.042, 0.016, 0.026, -0.014, 0.036],
};
const BENCHMARK_RETURNS = [0.008, 0.006, -0.004, 0.010, 0.007, -0.002, 0.012, 0.005, -0.006, 0.014, 0.009, 0.008, -0.003, 0.011, 0.007, -0.001, 0.013, 0.006, -0.005, 0.015, 0.008, 0.010, -0.004, 0.012];

function useChartJS() {
  const [ready, setReady] = useState(false);
  const chartModule = useRef<any>(null);
  useEffect(() => {
    let mounted = true;
    import("chart.js").then(mod => {
      mod.Chart.register(...mod.registerables);
      chartModule.current = mod;
      if (mounted) setReady(true);
    });
    return () => { mounted = false; };
  }, []);
  return { ready, Chart: chartModule.current?.Chart };
}

function CanvasChart({ config, height = 300, ariaLabel = "Chart" }: { config: any; height?: number; ariaLabel?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);
  const { ready, Chart } = useChartJS();
  useEffect(() => {
    if (!ready || !Chart || !canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    chartRef.current = new Chart(ctx, config);
    return () => { chartRef.current?.destroy(); };
  }, [ready, Chart, config]);
  if (!ready) return <Skeleton className="w-full" style={{ height }} />;
  return <canvas ref={canvasRef} style={{ maxHeight: height }} role="img" aria-label={ariaLabel} />;
}

function MetricCard({ label, value, subtext, icon, color = "text-primary" }: {
  label: string; value: string; subtext?: string; icon: React.ReactNode; color?: string;
}) {
  return (
    <Card><CardContent className="pt-4"><div className="flex items-center gap-2 text-muted-foreground mb-1"><span className={color}>{icon}</span><span className="text-xs">{label}</span></div><div className="text-2xl font-bold">{value}</div>{subtext && <div className="text-xs text-muted-foreground mt-0.5">{subtext}</div>}</CardContent></Card>
  );
}

export default function PortfolioRiskMetrics() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<"conservative" | "moderate" | "aggressive">("moderate");
  const [riskFreeRate, setRiskFreeRate] = useState(4.0);
  const [customReturns, setCustomReturns] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  const returns = useMemo(() => {
    if (useCustom && customReturns.trim()) {
      const parsed = customReturns.split(",").map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
      return parsed.length >= 2 ? parsed : SAMPLE_RETURNS[profile];
    }
    return SAMPLE_RETURNS[profile];
  }, [profile, customReturns, useCustom]);

  const riskQ = trpc.wealthEngine.portfolioRiskMetrics.useQuery(
    { returns, riskFreeRate: riskFreeRate / 100, benchmarkReturns: BENCHMARK_RETURNS },
    { enabled: !!isAuthenticated && returns.length >= 2, staleTime: 30_000 },
  );

  const metrics = riskQ.data?.data;
  const frontier = metrics?.frontier ?? [];

  const frontierChartConfig = useMemo(() => {
    if (frontier.length === 0) return null;
    return {
      type: "scatter" as const,
      data: {
        datasets: [
          { label: "Efficient Frontier", data: frontier.map((p: any) => ({ x: +(p.volatility * 100).toFixed(2), y: +(p.targetReturn * 100).toFixed(2) })), backgroundColor: "rgba(212, 168, 67, 0.8)", borderColor: "rgba(212, 168, 67, 1)", pointRadius: 8, pointHoverRadius: 12, showLine: true, borderWidth: 2, fill: false, tension: 0.3 },
          ...(metrics ? [{ label: "Your Portfolio", data: [{ x: +(metrics.annualizedVolatility * 100).toFixed(2), y: +(metrics.annualizedReturn * 100).toFixed(2) }], backgroundColor: "rgba(239, 68, 68, 1)", borderColor: "rgba(239, 68, 68, 1)", pointRadius: 12, pointHoverRadius: 16, pointStyle: "star" as const }] : []),
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "bottom" as const }, tooltip: { callbacks: { label: (ctx: any) => `${ctx.dataset.label}: Return ${ctx.parsed.y}%, Risk ${ctx.parsed.x}%` } } },
        scales: { x: { title: { display: true, text: "Volatility (Risk) %" }, grid: { color: "rgba(128,128,128,0.1)" } }, y: { title: { display: true, text: "Expected Return %" }, grid: { color: "rgba(128,128,128,0.1)" } } },
      },
    };
  }, [frontier, metrics]);

  const returnsChartConfig = useMemo(() => ({
    type: "bar" as const,
    data: {
      labels: returns.map((_, i) => `P${i + 1}`),
      datasets: [{ label: "Period Return %", data: returns.map(r => +(r * 100).toFixed(2)), backgroundColor: returns.map(r => r >= 0 ? "rgba(34, 197, 94, 0.7)" : "rgba(239, 68, 68, 0.7)"), borderColor: returns.map(r => r >= 0 ? "rgba(34, 197, 94, 1)" : "rgba(239, 68, 68, 1)"), borderWidth: 1 }],
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { title: { display: true, text: "Return %" }, grid: { color: "rgba(128,128,128,0.1)" } }, x: { grid: { display: false } } } },
  }), [returns]);

  if (authLoading) return <AppShell><div className="container py-8"><Skeleton className="h-64 w-full" /></div></AppShell>;
  if (!isAuthenticated) {
    return (
      <AppShell>
        <SEOHead title="Portfolio Risk Metrics" description="Analyze portfolio risk and efficient frontier" />
        <div className="container py-16 text-center space-y-4">
          <Shield className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Portfolio Risk Metrics</h1>
          <p className="text-muted-foreground">Sign in to analyze your portfolio risk profile.</p>
          <Button onClick={() => window.location.href = getLoginUrl("/portfolio-risk")}>Sign In</Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <SEOHead title="Portfolio Risk Metrics" description="Efficient frontier and risk analysis" />
      <div className="container max-w-6xl py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild><Link href="/wealth-engine"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="h-6 w-6 text-primary" /> Portfolio Risk Metrics</h1>
            <p className="text-sm text-muted-foreground">Risk analysis, efficient frontier, and portfolio optimization</p>
          </div>
        </div>

        <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Gauge className="h-5 w-5" /> Configuration</CardTitle><CardDescription>Select a risk profile or enter custom returns</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2"><Label>Risk Profile</Label><div className="flex gap-2">{(["conservative", "moderate", "aggressive"] as const).map(p => (<Button key={p} variant={profile === p && !useCustom ? "default" : "outline"} size="sm" className="flex-1 capitalize" onClick={() => { setProfile(p); setUseCustom(false); }}>{p}</Button>))}</div></div>
          <div className="space-y-2"><Label>Risk-Free Rate: {riskFreeRate.toFixed(1)}%</Label><Slider value={[riskFreeRate]} onValueChange={([v]) => setRiskFreeRate(v)} min={0} max={10} step={0.1} className="mt-2" /></div>
          <div className="space-y-2"><Label>Custom Returns (comma-separated)</Label><div className="flex gap-2"><Input placeholder="0.02, -0.01, 0.03, ..." value={customReturns} onChange={e => setCustomReturns(e.target.value)} className="text-xs" /><Button variant="outline" size="sm" onClick={() => { const parsed = customReturns.split(",").map(s => parseFloat(s.trim())).filter(n => !isNaN(n)); if (parsed.length < 2) { toast.error("Need at least 2 return values"); return; } setUseCustom(true); toast.success(`Using ${parsed.length} custom returns`); }}><Play className="h-3 w-3" /></Button></div></div>
        </div></CardContent></Card>

        {riskQ.isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
        ) : riskQ.error ? (
          <Card><CardContent className="py-8 text-center"><AlertTriangle className="mx-auto h-8 w-8 text-red-500 mb-2" /><p className="text-sm text-muted-foreground">{riskQ.error.message}</p><Button variant="outline" size="sm" className="mt-4" onClick={() => riskQ.refetch()}><RefreshCw className="h-3 w-3 mr-1" /> Retry</Button></CardContent></Card>
        ) : metrics ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <MetricCard label="Annualized Return" value={`${(metrics.annualizedReturn * 100).toFixed(2)}%`} icon={<TrendingUp className="h-4 w-4" />} color={metrics.annualizedReturn >= 0 ? "text-green-500" : "text-red-500"} />
              <MetricCard label="Annualized Volatility" value={`${(metrics.annualizedVolatility * 100).toFixed(2)}%`} subtext="Standard deviation of returns" icon={<Activity className="h-4 w-4" />} color="text-yellow-500" />
              <MetricCard label="Sharpe Ratio" value={metrics.sharpeRatio.toFixed(4)} subtext={metrics.sharpeRatio > 1 ? "Good risk-adjusted return" : "Below average"} icon={<Target className="h-4 w-4" />} color={metrics.sharpeRatio > 1 ? "text-green-500" : "text-yellow-500"} />
              <MetricCard label="Sortino Ratio" value={metrics.sortinoRatio.toFixed(4)} subtext="Downside risk-adjusted return" icon={<Shield className="h-4 w-4" />} color={metrics.sortinoRatio > 1 ? "text-green-500" : "text-yellow-500"} />
              <MetricCard label="Max Drawdown" value={`${(metrics.maxDrawdown * 100).toFixed(2)}%`} subtext="Largest peak-to-trough decline" icon={<TrendingDown className="h-4 w-4" />} color="text-red-500" />
              <MetricCard label="Periods Analyzed" value={metrics.periods.toString()} subtext={`${returns.length} return observations`} icon={<BarChart3 className="h-4 w-4" />} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Target className="h-5 w-5" /> Efficient Frontier</CardTitle><CardDescription>Optimal risk-return tradeoff. The star marks your portfolio.</CardDescription></CardHeader><CardContent>{frontierChartConfig ? <CanvasChart config={frontierChartConfig} height={300} /> : <div className="h-64 flex items-center justify-center text-muted-foreground">Not enough data for frontier</div>}</CardContent></Card>
              <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Returns Distribution</CardTitle><CardDescription>Period-by-period returns (green = positive, red = negative)</CardDescription></CardHeader><CardContent><CanvasChart config={returnsChartConfig} height={300} /></CardContent></Card>
            </div>
            {frontier.length > 0 && (
              <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Info className="h-5 w-5" /> Frontier Points</CardTitle><CardDescription>Optimal portfolio allocations along the efficient frontier</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="py-2 pr-4 font-medium">#</th><th className="py-2 pr-4 font-medium text-right">Target Return</th><th className="py-2 pr-4 font-medium text-right">Volatility</th><th className="py-2 pr-4 font-medium text-right">Sharpe</th><th className="py-2 font-medium">Weights</th></tr></thead><tbody>{frontier.map((pt: any, i: number) => (<tr key={i} className="border-b border-border/50"><td className="py-2 pr-4">{i + 1}</td><td className="py-2 pr-4 text-right font-mono">{(pt.targetReturn * 100).toFixed(2)}%</td><td className="py-2 pr-4 text-right font-mono">{(pt.volatility * 100).toFixed(2)}%</td><td className="py-2 pr-4 text-right font-mono">{pt.sharpeRatio.toFixed(3)}</td><td className="py-2"><div className="flex gap-1 flex-wrap">{Object.entries(pt.weights).map(([id, w]: [string, any]) => (<Badge key={id} variant="outline" className="text-xs">{id}: {(w * 100).toFixed(0)}%</Badge>))}</div></td></tr>))}</tbody></table></div></CardContent></Card>
            )}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
