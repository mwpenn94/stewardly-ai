/**
 * SensitivityAnalysis — Tornado chart + parameter sensitivity visualization.
 * Part of Wealth Engine 4.0+ maturity push.
 */
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { BarChart3, TrendingUp, TrendingDown, Loader2, Info, Zap } from 'lucide-react';

function fmt(n: number): string {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

interface Props {
  savings: number;
  income: number;
  age: number;
  retireAge: number;
  investReturn: number;
  volatility?: number;
}

export default function SensitivityAnalysis({ savings, income, age, retireAge, investReturn, volatility = 0.15 }: Props) {
  const [results, setResults] = useState<any>(null);
  const sensitivityMut = trpc.calculatorEngine.sensitivityAnalysis.useMutation({ onError: (e) => toast.error(e.message) });

  const years = Math.max(10, retireAge - age);
  const annualContribution = Math.round(income * 0.10);

  const runAnalysis = async () => {
    const data = await sensitivityMut.mutateAsync({
      baseReturn: investReturn || 0.07, baseVolatility: volatility,
      startBalance: savings, annualContribution, years, trials: 500,
    });
    setResults(data);
    toast.success('Sensitivity analysis complete');
  };

  if (!results) {
    return (
      <Card className="border-dashed border-primary/30">
        <CardContent className="p-6 text-center space-y-3">
          <BarChart3 className="w-10 h-10 text-primary/50 mx-auto" />
          <div>
            <p className="text-sm font-medium text-foreground">Sensitivity Analysis</p>
            <p className="text-xs text-muted-foreground mt-1">
              Discover which inputs matter most to your financial outcome.
              Tests return rate, volatility, savings, and time horizon variations.
            </p>
          </div>
          <Button onClick={runAnalysis} disabled={sensitivityMut.isPending} size="sm" className="gap-1.5">
            {sensitivityMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            {sensitivityMut.isPending ? 'Running 2,800 simulations...' : 'Run Sensitivity Analysis'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { tornado, results: paramResults } = results;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Parameter Impact (Tornado Chart)
              </CardTitle>
              <CardDescription className="text-xs mt-1">Which inputs have the biggest effect on your portfolio outcome</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={runAnalysis} disabled={sensitivityMut.isPending} className="h-7 text-xs gap-1">
              {sensitivityMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              Re-run
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {tornado.map((item: any, i: number) => {
            const range = item.highOutcome - item.lowOutcome;
            const maxRange = Math.max(...tornado.map((t: any) => t.highOutcome - t.lowOutcome));
            const barWidth = maxRange > 0 ? (range / maxRange) * 100 : 0;
            const isPos = item.elasticity > 0;
            return (
              <div key={item.parameter} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                    {item.label}
                  </span>
                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge variant="outline" className={`text-[10px] ${Math.abs(item.elasticity) > 1 ? 'border-red-500/30 text-red-400' : 'border-muted'}`}>
                          ε = {item.elasticity.toFixed(2)}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        Elasticity: a 1% change in {item.label.toLowerCase()} produces a ~{Math.abs(item.elasticity).toFixed(1)}% change in median outcome.
                      </TooltipContent>
                    </Tooltip>
                    <span className="text-muted-foreground">{fmt(item.lowOutcome)} → {fmt(item.highOutcome)}</span>
                  </div>
                </div>
                <div className="h-6 bg-muted/30 rounded-md overflow-hidden relative">
                  <div className={`h-full rounded-md transition-all ${isPos ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-red-500/20 border border-red-500/30'}`}
                    style={{ width: `${Math.max(barWidth, 5)}%` }}>
                    <div className="absolute inset-0 flex items-center px-2 text-[10px] font-medium">
                      <span className={isPos ? 'text-emerald-400' : 'text-red-400'}>
                        {isPos ? <TrendingUp className="w-3 h-3 inline mr-1" /> : <TrendingDown className="w-3 h-3 inline mr-1" />}
                        Δ {fmt(range)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {paramResults.map((param: any) => (
          <Card key={param.parameter} className="overflow-hidden">
            <CardHeader className="pb-2 bg-muted/20">
              <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                {param.label}
                <Badge variant="outline" className="text-[9px] ml-auto">ε = {param.elasticity.toFixed(2)}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-border/30 bg-muted/10">
                      <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Value</th>
                      <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">P10</th>
                      <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Median</th>
                      <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">P90</th>
                      <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Success</th>
                    </tr>
                  </thead>
                  <tbody>
                    {param.points.map((pt: any, i: number) => {
                      const isBase = i === Math.floor(param.points.length / 2);
                      return (
                        <tr key={i} className={`border-b border-border/10 ${isBase ? 'bg-primary/5 font-semibold' : 'hover:bg-muted/10'}`}>
                          <td className="px-2 py-1.5 text-foreground">{pt.label}</td>
                          <td className="px-2 py-1.5 text-right text-red-400">{fmt(pt.p10)}</td>
                          <td className="px-2 py-1.5 text-right text-foreground">{fmt(pt.medianOutcome)}</td>
                          <td className="px-2 py-1.5 text-right text-emerald-400">{fmt(pt.p90)}</td>
                          <td className="px-2 py-1.5 text-right">
                            <span className={pt.successRate >= 95 ? 'text-emerald-400' : pt.successRate >= 80 ? 'text-amber-400' : 'text-red-400'}>
                              {pt.successRate}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Key Insight</p>
              <p>
                {tornado[0] && (
                  <>
                    <strong className="text-foreground">{tornado[0].label}</strong> has the highest impact on your outcome
                    (elasticity: {tornado[0].elasticity.toFixed(2)}). A small change produces
                    a {fmt(tornado[0].highOutcome - tornado[0].lowOutcome)} range in median portfolio value.
                  </>
                )}
              </p>
              <p className="text-[10px] text-muted-foreground/70">
                Based on {(paramResults[0]?.points?.length ?? 0) * 500} Monte Carlo simulations across {paramResults.length} parameters.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
