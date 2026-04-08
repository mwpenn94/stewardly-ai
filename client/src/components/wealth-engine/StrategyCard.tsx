/**
 * StrategyCard — one card per comparison strategy in the SCUI comparison
 * table. Shows the strategy name, winner badges, top-line metrics, and
 * a small sparkline of the projection. Animates metric count-ups on
 * mount and when the horizon changes.
 */

import { chartTokens } from "@/lib/wealth-engine/tokens";
import {
  formatCurrency,
  formatPercent,
  useCountUp,
  useReducedMotion,
} from "@/lib/wealth-engine/animations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, ShieldCheck, TrendingUp } from "lucide-react";

export interface StrategyCardProps {
  name: string;
  color?: string;
  totalValue: number;
  netValue: number;
  totalLiquidWealth: number;
  totalProtection: number;
  totalTaxSavings: number;
  roi: number;
  isWinnerTotalValue?: boolean;
  isWinnerProtection?: boolean;
  isWinnerROI?: boolean;
  sparkline?: number[];
  onClick?: () => void;
  selected?: boolean;
}

export function StrategyCard(props: StrategyCardProps) {
  const reduced = useReducedMotion();
  const animTotal = useCountUp(props.totalValue, { enabled: !reduced });
  const animNet = useCountUp(props.netValue, { enabled: !reduced });
  const animLiquid = useCountUp(props.totalLiquidWealth, { enabled: !reduced });
  const animROI = useCountUp(props.roi, { enabled: !reduced });

  const accent = props.color || chartTokens.colors.wealthbridge;

  return (
    <Card
      onClick={props.onClick}
      className={`cursor-pointer transition-all hover:shadow-md ${props.selected ? "ring-2" : ""}`}
      style={{
        borderLeft: `4px solid ${accent}`,
        ...(props.selected ? { boxShadow: `0 0 0 2px ${accent}` } : {}),
      }}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-start justify-between gap-2 text-base">
          <span>{props.name}</span>
          <div className="flex flex-col gap-1 items-end">
            {props.isWinnerTotalValue && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Award className="h-3 w-3" /> Highest Value
              </Badge>
            )}
            {props.isWinnerProtection && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <ShieldCheck className="h-3 w-3" /> Most Protection
              </Badge>
            )}
            {props.isWinnerROI && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <TrendingUp className="h-3 w-3" /> Best ROI
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <MetricRow label="Total Value" value={formatCurrency(animTotal)} primary accent={accent} />
          <MetricRow label="Net Value" value={formatCurrency(animNet)} />
          <MetricRow label="Liquid Wealth" value={formatCurrency(animLiquid)} />
          <MetricRow label="Protection" value={formatCurrency(props.totalProtection)} />
          <MetricRow label="Tax Savings" value={formatCurrency(props.totalTaxSavings)} />
          <MetricRow
            label="ROI"
            value={props.roi > 0 ? `${animROI.toFixed(1)}x` : "—"}
          />
        </div>

        {props.sparkline && props.sparkline.length > 1 && (
          <Sparkline values={props.sparkline} color={accent} />
        )}
      </CardContent>
    </Card>
  );
}

function MetricRow({
  label,
  value,
  primary,
  accent,
}: {
  label: string;
  value: string;
  primary?: boolean;
  accent?: string;
}) {
  return (
    <div
      className={`flex flex-col ${primary ? "col-span-2 py-1 rounded-md px-2" : ""}`}
      style={primary ? { background: accent ? `${accent}10` : undefined } : undefined}
    >
      <span className="text-[11px] uppercase text-muted-foreground tracking-wide">
        {label}
      </span>
      <span
        className={`font-semibold ${primary ? "text-base" : "text-sm"}`}
        style={{
          fontVariantNumeric: "tabular-nums",
          color: primary ? accent : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 240;
  const h = 40;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => ({
    x: (i / (values.length - 1)) * w,
    y: h - ((v - min) / range) * h,
  }));
  const d =
    "M" +
    points.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={40} className="mt-1">
      <path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
    </svg>
  );
}
