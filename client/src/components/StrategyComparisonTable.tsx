/**
 * StrategyComparisonTable — Side-by-side comparison of holistic strategies.
 * Shows key metrics with winner highlighting and color-coded badges.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, TrendingUp, Shield, Coins, ArrowUpRight } from "lucide-react";

interface ComparisonRow {
  name: string;
  color: string;
  totalValue: number;
  netValue: number;
  roi: number;
  totalLiquidWealth: number;
  totalProtection: number;
  totalTaxSavings: number;
  bizIncome: number;
  totalGrossIncome: number;
  totalCost: number;
  savingsBalance?: number;
  productCashValue?: number;
  productDeathBenefit?: number;
  [key: string]: any;
}

interface Winners {
  [metric: string]: { name: string; color: string; value: number };
}

interface Props {
  comparison: ComparisonRow[];
  winners: Winners;
  horizon: number;
  title?: string;
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

const METRICS: { key: string; label: string; icon: any; format?: (v: number) => string }[] = [
  { key: "totalValue", label: "Total Value", icon: Trophy },
  { key: "netValue", label: "Net Value", icon: TrendingUp },
  { key: "roi", label: "ROI", icon: ArrowUpRight, format: (v) => `${(v * 100).toFixed(1)}%` },
  { key: "totalLiquidWealth", label: "Liquid Wealth", icon: Coins },
  { key: "totalProtection", label: "Protection", icon: Shield },
  { key: "totalTaxSavings", label: "Tax Savings", icon: Coins },
  { key: "totalGrossIncome", label: "Gross Income", icon: TrendingUp },
  { key: "bizIncome", label: "Biz Income (Yr)", icon: TrendingUp },
  { key: "totalCost", label: "Total Cost", icon: Coins },
];

export default function StrategyComparisonTable({ comparison, winners, horizon, title }: Props) {
  if (!comparison.length) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-8 text-center text-muted-foreground">
          Add strategies to compare.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title || `Strategy Comparison — Year ${horizon}`}</CardTitle>
          <Badge variant="outline" className="text-[10px]">{comparison.length} strategies</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px] text-xs">Metric</TableHead>
              {comparison.map((c) => (
                <TableHead key={c.name} className="text-xs text-center min-w-[120px]">
                  <div className="flex items-center justify-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="truncate max-w-[100px]">{c.name}</span>
                  </div>
                </TableHead>
              ))}
              <TableHead className="text-xs text-center w-[100px]">Winner</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {METRICS.map((m) => {
              const winner = winners[m.key];
              const formatFn = m.format || fmt;
              return (
                <TableRow key={m.key}>
                  <TableCell className="text-xs font-medium">
                    <div className="flex items-center gap-1.5">
                      <m.icon className="w-3 h-3 text-muted-foreground" />
                      {m.label}
                    </div>
                  </TableCell>
                  {comparison.map((c) => {
                    const val = c[m.key] ?? 0;
                    const isWinner = winner && winner.name === c.name;
                    return (
                      <TableCell
                        key={c.name}
                        className={`text-xs text-center tabular-nums ${isWinner ? "font-semibold text-emerald-400" : ""}`}
                      >
                        {formatFn(val)}
                        {isWinner && <Trophy className="w-3 h-3 inline ml-1 text-amber-400" />}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-xs text-center">
                    {winner ? (
                      <Badge variant="outline" className="text-[9px] px-1.5" style={{ borderColor: winner.color, color: winner.color }}>
                        {winner.name}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
