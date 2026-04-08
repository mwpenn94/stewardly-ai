/**
 * BackPlanFunnel — Visualize reverse-engineered activity funnel from BIE back-plan.
 * Shows approaches → set → held → apps → placed with conversion rates.
 */
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, Target, Users, Phone, FileCheck, CheckCircle2 } from "lucide-react";

interface FunnelData {
  approaches: number;
  set: number;
  held: number;
  apps: number;
  placed: number;
  avgCase: number;
  daily: { approaches: number };
  weekly: { approaches: number };
  monthly: { approaches: number; apps: number; gdc: number };
  annual: { approaches: number; apps: number; gdc: number };
}

interface BackPlanResult {
  neededGDC: number;
  bracketRate: number;
  bracketLabel: string;
  funnel: FunnelData;
}

interface Props {
  result: BackPlanResult;
  targetIncome: number;
  title?: string;
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

const FUNNEL_STEPS = [
  { key: "approaches", label: "Approaches", icon: Users, color: "#94A3B8", desc: "Total contacts needed" },
  { key: "set", label: "Appointments Set", icon: Phone, color: "#3B82F6", desc: "25% conversion" },
  { key: "held", label: "Appointments Held", icon: Target, color: "#8B5CF6", desc: "60% show rate" },
  { key: "apps", label: "Applications", icon: FileCheck, color: "#F59E0B", desc: "70% close rate" },
  { key: "placed", label: "Cases Placed", icon: CheckCircle2, color: "#22C55E", desc: "85% placement" },
];

export default function BackPlanFunnel({ result, targetIncome, title = "Activity Back-Plan" }: Props) {
  const f = result.funnel;
  const maxVal = f.approaches || 1;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-xs">
              Target: {fmt(targetIncome)} income → {fmt(result.neededGDC)} GDC needed ({result.bracketLabel}, {(result.bracketRate * 100).toFixed(0)}% bracket)
            </CardDescription>
          </div>
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
            {fmt(targetIncome)} target
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Funnel visualization */}
        <div className="space-y-1">
          {FUNNEL_STEPS.map((step, i) => {
            const val = (f as any)[step.key] || 0;
            const widthPct = Math.max(20, (val / maxVal) * 100);
            return (
              <div key={step.key}>
                <div className="flex items-center gap-3">
                  <step.icon className="w-4 h-4 flex-shrink-0" style={{ color: step.color }} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs">{step.label}</span>
                      <span className="text-xs font-mono tabular-nums font-semibold">{val.toLocaleString()}</span>
                    </div>
                    <div
                      className="h-6 rounded-md flex items-center justify-center transition-all duration-500"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: step.color,
                        opacity: 0.25,
                        marginLeft: `${(100 - widthPct) / 2}%`,
                      }}
                    >
                      <span className="text-[9px] text-muted-foreground">{step.desc}</span>
                    </div>
                  </div>
                </div>
                {i < FUNNEL_STEPS.length - 1 && (
                  <div className="flex justify-center py-0.5">
                    <ArrowDown className="w-3 h-3 text-muted-foreground/40" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Activity cadence */}
        <div className="border-t border-border/30 pt-3">
          <p className="text-xs font-medium mb-2">Required Activity Cadence</p>
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-secondary/50 rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Daily</p>
              <p className="text-lg font-semibold tabular-nums">{f.daily.approaches}</p>
              <p className="text-[9px] text-muted-foreground">approaches</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Weekly</p>
              <p className="text-lg font-semibold tabular-nums">{f.weekly.approaches}</p>
              <p className="text-[9px] text-muted-foreground">approaches</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Monthly</p>
              <p className="text-lg font-semibold tabular-nums">{f.monthly.apps}</p>
              <p className="text-[9px] text-muted-foreground">applications</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Monthly GDC</p>
              <p className="text-lg font-semibold tabular-nums text-emerald-400">{fmt(f.monthly.gdc)}</p>
              <p className="text-[9px] text-muted-foreground">target</p>
            </div>
          </div>
        </div>

        {/* Average case size */}
        <div className="flex items-center justify-between bg-secondary/30 rounded-lg p-2.5 text-xs">
          <span className="text-muted-foreground">Average Case Size</span>
          <span className="font-semibold tabular-nums">{fmt(f.avgCase)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
