/* ═══════════════════════════════════════════════════════════════
   CompareDiffOverlay — Compare mode diff highlights (Pass 155)
   Detects overlapping numeric metrics between two panels and
   shows color-coded delta badges in a summary bar.
   ═══════════════════════════════════════════════════════════════ */
import { useMemo, useState } from 'react';
import { ArrowUp, ArrowDown, Minus, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type MetricSnapshot = {
  label: string;
  value: number;
  format?: 'currency' | 'percent' | 'number';
};

type DiffItem = {
  label: string;
  leftValue: number;
  rightValue: number;
  delta: number;
  deltaPct: number;
  format: 'currency' | 'percent' | 'number';
};

function formatValue(v: number, fmt: 'currency' | 'percent' | 'number'): string {
  if (fmt === 'currency') {
    if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
    return `$${v.toLocaleString()}`;
  }
  if (fmt === 'percent') return `${(v * 100).toFixed(1)}%`;
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatDelta(d: number, fmt: 'currency' | 'percent' | 'number'): string {
  const sign = d > 0 ? '+' : '';
  if (fmt === 'currency') {
    if (Math.abs(d) >= 1_000_000) return `${sign}$${(d / 1_000_000).toFixed(1)}M`;
    if (Math.abs(d) >= 1_000) return `${sign}$${(d / 1_000).toFixed(0)}K`;
    return `${sign}$${d.toLocaleString()}`;
  }
  if (fmt === 'percent') return `${sign}${(d * 100).toFixed(1)}pp`;
  return `${sign}${formatValue(d, 'number')}`;
}

/** Extract overlapping metrics from two WealthEngineData snapshots */
export function extractComparableMetrics(
  leftData: Record<string, any>,
  rightData: Record<string, any>,
  leftPanelId: string,
  rightPanelId: string,
): MetricSnapshot[][] {
  // Build metrics from the WealthEngineData objects
  const leftMetrics: MetricSnapshot[] = [];
  const rightMetrics: MetricSnapshot[] = [];

  // Common financial metrics that appear across panels
  const metricPaths: { key: string; label: string; format: 'currency' | 'percent' | 'number' }[] = [
    { key: 'totalIncome', label: 'Total Income', format: 'currency' },
    { key: 'netWorth', label: 'Net Worth', format: 'currency' },
    { key: 'grossEstate', label: 'Gross Estate', format: 'currency' },
    { key: 'totalProtection', label: 'Total Protection', format: 'currency' },
    { key: 'protectionGap', label: 'Protection Gap', format: 'currency' },
    { key: 'retirementGap', label: 'Retirement Gap', format: 'currency' },
    { key: 'monthlySurplus', label: 'Monthly Surplus', format: 'currency' },
    { key: 'emergencyFund', label: 'Emergency Fund', format: 'currency' },
    { key: 'taxLiability', label: 'Tax Liability', format: 'currency' },
    { key: 'effectiveTaxRate', label: 'Effective Tax Rate', format: 'percent' },
    { key: 'savingsRate', label: 'Savings Rate', format: 'percent' },
    { key: 'debtToIncomeRatio', label: 'Debt-to-Income', format: 'percent' },
    { key: 'healthScore', label: 'Health Score', format: 'number' },
  ];

  for (const mp of metricPaths) {
    const lv = extractNestedValue(leftData, mp.key);
    const rv = extractNestedValue(rightData, mp.key);
    if (typeof lv === 'number' && !isNaN(lv)) leftMetrics.push({ label: mp.label, value: lv, format: mp.format });
    if (typeof rv === 'number' && !isNaN(rv)) rightMetrics.push({ label: mp.label, value: rv, format: mp.format });
  }

  return [leftMetrics, rightMetrics];
}

function extractNestedValue(data: Record<string, any>, key: string): any {
  if (data[key] !== undefined) return data[key];
  // Search one level deep
  for (const v of Object.values(data)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && v[key] !== undefined) return v[key];
  }
  return undefined;
}

export function CompareDiffOverlay({
  leftMetrics,
  rightMetrics,
  leftLabel,
  rightLabel,
}: {
  leftMetrics: MetricSnapshot[];
  rightMetrics: MetricSnapshot[];
  leftLabel: string;
  rightLabel: string;
}) {
  const [showDiff, setShowDiff] = useState(true);

  const diffs = useMemo<DiffItem[]>(() => {
    const result: DiffItem[] = [];
    for (const lm of leftMetrics) {
      const rm = rightMetrics.find(r => r.label === lm.label);
      if (!rm) continue;
      const delta = rm.value - lm.value;
      const deltaPct = lm.value !== 0 ? delta / Math.abs(lm.value) : 0;
      result.push({
        label: lm.label,
        leftValue: lm.value,
        rightValue: rm.value,
        delta,
        deltaPct,
        format: lm.format || 'number',
      });
    }
    return result;
  }, [leftMetrics, rightMetrics]);

  if (diffs.length === 0) return null;

  return (
    <div className="mb-3 rounded-lg border border-border/50 bg-card/80 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b border-border/30">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Diff: {diffs.length} overlapping metrics
        </span>
        <Button variant="ghost" size="sm" onClick={() => setShowDiff(d => !d)}
          className="h-6 px-2 text-[10px] gap-1 text-muted-foreground">
          {showDiff ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          {showDiff ? 'Hide' : 'Show'}
        </Button>
      </div>
      {showDiff && (
        <div className="p-2">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1 text-[11px]">
            {/* Header */}
            <div className="text-muted-foreground/60 font-medium">Metric</div>
            <div className="text-muted-foreground/60 font-medium text-right">{leftLabel}</div>
            <div className="text-muted-foreground/60 font-medium text-right">{rightLabel}</div>
            <div className="text-muted-foreground/60 font-medium text-right">Delta</div>
            {/* Rows */}
            {diffs.map(d => (
              <div key={d.label} className="contents">
                <div className="text-foreground/80 truncate">{d.label}</div>
                <div className="text-right text-foreground/70 font-mono">{formatValue(d.leftValue, d.format)}</div>
                <div className="text-right text-foreground/70 font-mono">{formatValue(d.rightValue, d.format)}</div>
                <div className={`text-right font-mono flex items-center justify-end gap-0.5 ${
                  d.delta > 0 ? 'text-green-400' : d.delta < 0 ? 'text-red-400' : 'text-muted-foreground'
                }`}>
                  {d.delta > 0 ? <ArrowUp className="w-2.5 h-2.5" /> : d.delta < 0 ? <ArrowDown className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
                  <span>{formatDelta(d.delta, d.format)}</span>
                  {d.deltaPct !== 0 && <span className="text-[9px] text-muted-foreground/50 ml-0.5">({d.deltaPct > 0 ? '+' : ''}{(d.deltaPct * 100).toFixed(0)}%)</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
