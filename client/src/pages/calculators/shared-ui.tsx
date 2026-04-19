/**
 * shared-ui.tsx — Shared UI primitives used across calculator hubs.
 *
 * Extracted from ClientWealthHub, AdvancedStrategiesHub, and PanelsD
 * to eliminate duplication and ensure visual consistency.
 */
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";

/* ─── Practice Input ────────────────────────────────────────────── */

/** Compact labeled number input with optional prefix/suffix. Used across Practice Management panels. */
export function PInput({ label, value, onChange, prefix, suffix, className = '' }: {
  label: string; value: number | string; onChange: (v: string) => void;
  prefix?: string; suffix?: string; className?: string;
}) {
  return (
    <div className={`space-y-0.5 ${className}`}>
      <Label className="text-[10px] font-medium text-muted-foreground">{label}</Label>
      <div className="relative">
        {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/50">{prefix}</span>}
        <Input type="number" value={value} onChange={e => onChange(e.target.value)}
          className={`h-7 text-xs ${prefix ? 'pl-5' : ''} ${suffix ? 'pr-6' : ''}`} />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/50">{suffix}</span>}
      </div>
    </div>
  );
}

/* ─── Section Header ─────────────────────────────────────────────── */

/** Consistent section header label used in all hub panels. */
export function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-wider text-primary/80 bg-primary/5 px-3 py-1.5 rounded-md border border-primary/10 mb-2">
      {children}
    </div>
  );
}

/* ─── Score Ring ──────────────────────────────────────────────────── */

interface ScoreRingProps {
  /** 0–100 score value */
  score: number;
  /** SVG size in px (default 120) */
  size?: number;
  /** Custom label map: score threshold → label text.
   *  Defaults to "On Track / Needs Attention / At Risk / Critical" */
  labels?: { high: string; mid: string; low: string; critical: string };
}

/** Animated circular score indicator with color-coded badge. */
export function ScoreRing({ score, size = 120, labels }: ScoreRingProps) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color =
    score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : score >= 40 ? "#f97316" : "#ef4444";
  const defaultLabels = { high: "On Track", mid: "Needs Attention", low: "At Risk", critical: "Critical" };
  const l = labels ?? defaultLabels;
  const label = score >= 80 ? l.high : score >= 60 ? l.mid : score >= 40 ? l.low : l.critical;
  const sw = size >= 110 ? 8 : 7;
  const fontSize = size >= 110 ? "text-2xl" : "text-xl";

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.1} strokeWidth={sw} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className={`${fontSize} font-bold`} style={{ color }}>{score}</span>
        <span className="text-[9px] text-muted-foreground">/100</span>
      </div>
      <Badge
        variant={score >= 80 ? "default" : score >= 60 ? "secondary" : "destructive"}
        className="mt-1 text-[9px]"
      >
        {label}
      </Badge>
    </div>
  );
}

/* ─── Allocation Slider ──────────────────────────────────────────── */

interface AllocationSliderProps {
  label: string;
  value: number;
  color: string;
  icon: React.ElementType;
  desc: string;
  amount: string;
  onDrag: (v: number) => void;
  onNavigate?: () => void;
  /** Tooltip for the drag bar (default: "Drag to rebalance") */
  dragTooltip?: string;
}

/**
 * Draggable allocation slider used for domain/strategy rebalancing.
 * Previously duplicated as DomainSlider and StrategySlider.
 */
export function AllocationSlider({
  label, value, color, icon: Icon, desc, amount, onDrag, onNavigate,
  dragTooltip = "Drag to rebalance — other items adjust proportionally",
}: AllocationSliderProps) {
  const [dragging, setDragging] = useState(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const bar = e.currentTarget;
    bar.setPointerCapture(e.pointerId);
    setDragging(true);
    const rect = bar.getBoundingClientRect();
    const p = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
    onDrag(p);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const p = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
    onDrag(p);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium flex items-center gap-1" style={{ color }}>
          <Icon className="w-3 h-3" /> {label}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{value}%</span>
          <span className="font-semibold text-foreground">{amount}</span>
          {onNavigate && (
            <button
              onClick={onNavigate}
              className="text-[9px] text-primary hover:underline flex items-center gap-0.5"
            >
              Go <ArrowRight className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div
          className="flex-1 h-3 bg-muted/30 rounded-full overflow-hidden relative cursor-grab active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
          title={dragTooltip}
        >
          <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: color }} />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-5 rounded-sm border-2 bg-background shadow-md"
            style={{ left: `calc(${value}% - 6px)`, borderColor: color }}
          />
        </div>
      </div>
      <p className="text-[9px] text-muted-foreground/60">{desc}</p>
    </div>
  );
}
