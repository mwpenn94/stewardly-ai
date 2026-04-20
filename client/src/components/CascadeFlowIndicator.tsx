/**
 * CascadeFlowIndicator — Visual indicator showing data flow between workflow stages.
 *
 * Pass 133: Shows how data cascades between Plan → Protect → Practice stages
 * in the Wealth Engine, and between stages in Learning and Command Center.
 *
 * Renders as a compact horizontal flow with arrows and status indicators.
 */
import { ArrowRight, CheckCircle2, Circle, AlertCircle } from "lucide-react";

export interface CascadeStage {
  label: string;
  icon: React.ElementType;
  status: "complete" | "active" | "pending" | "warning";
  /** Brief description of what flows into the next stage */
  flowLabel?: string;
  /** Number of items or data points in this stage */
  count?: number;
}

interface CascadeFlowIndicatorProps {
  stages: CascadeStage[];
  className?: string;
  compact?: boolean;
}

const STATUS_STYLES = {
  complete: {
    ring: "ring-emerald-500/30 bg-emerald-500/10",
    icon: "text-emerald-500",
    text: "text-emerald-500",
    dot: CheckCircle2,
  },
  active: {
    ring: "ring-primary/30 bg-primary/10",
    icon: "text-primary",
    text: "text-primary",
    dot: Circle,
  },
  pending: {
    ring: "ring-border/30 bg-background/50",
    icon: "text-muted-foreground/50",
    text: "text-muted-foreground/50",
    dot: Circle,
  },
  warning: {
    ring: "ring-amber-500/30 bg-amber-500/10",
    icon: "text-amber-500",
    text: "text-amber-500",
    dot: AlertCircle,
  },
};

export function CascadeFlowIndicator({
  stages,
  className = "",
  compact = false,
}: CascadeFlowIndicatorProps) {
  return (
    <div className={`flex items-center gap-1 overflow-x-auto flex-wrap sm:flex-nowrap ${className}`} role="list" aria-label="Cascade data flow">
      {stages.map((stage, idx) => {
        const style = STATUS_STYLES[stage.status];
        const Icon = stage.icon;
        const StatusDot = style.dot;
        const isLast = idx === stages.length - 1;

        return (
          <div key={idx} className="flex items-center gap-1" role="listitem">
            {/* Stage node */}
            <div className={`flex items-center gap-1.5 rounded-lg ring-1 px-2 py-1.5 ${style.ring} transition-colors`}>
              <div className="relative">
                <Icon className={`w-3.5 h-3.5 ${style.icon}`} />
                <StatusDot className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 ${style.text}`} />
              </div>
              <div className="min-w-0">
                <p className={`text-[10px] font-semibold leading-tight ${style.text}`}>{stage.label}</p>
                {!compact && stage.count !== undefined && (
                  <p className="text-[8px] text-muted-foreground/60">{stage.count} items</p>
                )}
              </div>
            </div>

            {/* Flow arrow + label */}
            {!isLast && (
              <div className="flex flex-col items-center gap-0 mx-0.5 shrink-0">
                <ArrowRight className="w-3 h-3 text-muted-foreground/30" />
                {!compact && stage.flowLabel && (
                  <span className="text-[7px] text-muted-foreground/40 whitespace-nowrap">{stage.flowLabel}</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * CascadeFlowCard — Wraps CascadeFlowIndicator in a card with title and description.
 */
interface CascadeFlowCardProps {
  title: string;
  description?: string;
  stages: CascadeStage[];
  className?: string;
}

export function CascadeFlowCard({
  title,
  description,
  stages,
  className = "",
}: CascadeFlowCardProps) {
  return (
    <div className={`rounded-lg border border-border/30 bg-card/30 p-3 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground">{title}</h4>
          {description && <p className="text-[9px] text-muted-foreground/60 mt-0.5">{description}</p>}
        </div>
      </div>
      <CascadeFlowIndicator stages={stages} />
    </div>
  );
}
