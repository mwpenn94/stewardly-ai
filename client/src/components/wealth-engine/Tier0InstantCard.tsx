/**
 * Tier0InstantCard — "Zillow Zestimate" style instant score card.
 *
 * Pass 45 (C3 Progressive Disclosure): Every engine surface should offer
 * a Tier 0 "instant" view: 1-2 inputs max, single primary output, <200ms
 * load, one-thumb mobile zone. Design ethos: "Retirement adequacy: 72/100 · configure ›"
 *
 * Usage:
 *   <Tier0InstantCard
 *     title="Retirement Adequacy"
 *     score={72}
 *     maxScore={100}
 *     status="caution"
 *     subtitle="Based on age 40, $180K saved"
 *     configureHref="/wealth-engine/retirement"
 *     configureLabel="Configure"
 *   />
 */
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";

type Status = "excellent" | "good" | "caution" | "warning" | "critical" | "unknown";

const STATUS_COLORS: Record<Status, { ring: string; text: string; bg: string }> = {
  excellent: { ring: "stroke-emerald-400", text: "text-emerald-400", bg: "bg-emerald-400/10" },
  good:      { ring: "stroke-sky-400",     text: "text-sky-400",     bg: "bg-sky-400/10" },
  caution:   { ring: "stroke-amber-400",   text: "text-amber-400",   bg: "bg-amber-400/10" },
  warning:   { ring: "stroke-orange-400",  text: "text-orange-400",  bg: "bg-orange-400/10" },
  critical:  { ring: "stroke-red-400",     text: "text-red-400",     bg: "bg-red-400/10" },
  unknown:   { ring: "stroke-muted-foreground/30", text: "text-muted-foreground", bg: "bg-muted/10" },
};

interface Tier0InstantCardProps {
  title: string;
  score: number | null;
  maxScore?: number;
  status?: Status;
  subtitle?: string;
  configureHref: string;
  configureLabel?: string;
  icon?: React.ReactNode;
  loading?: boolean;
}

function scoreToStatus(score: number, max: number): Status {
  const pct = (score / max) * 100;
  if (pct >= 80) return "excellent";
  if (pct >= 65) return "good";
  if (pct >= 50) return "caution";
  if (pct >= 35) return "warning";
  return "critical";
}

function ScoreRing({ score, maxScore, status }: { score: number; maxScore: number; status: Status }) {
  const pct = Math.min(100, Math.max(0, (score / maxScore) * 100));
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const colors = STATUS_COLORS[status];

  return (
    <div className="relative w-16 h-16 flex-none">
      <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-border/30" />
        <circle
          cx="32" cy="32" r={r} fill="none" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          className={`${colors.ring} transition-all duration-700 ease-out`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-sm font-bold tabular-nums ${colors.text}`}>{score}</span>
      </div>
    </div>
  );
}

export default function Tier0InstantCard({
  title, score, maxScore = 100, status, subtitle,
  configureHref, configureLabel = "Configure", icon, loading,
}: Tier0InstantCardProps) {
  const [, navigate] = useLocation();
  const resolvedStatus = status ?? (score != null ? scoreToStatus(score, maxScore) : "unknown");
  const colors = STATUS_COLORS[resolvedStatus];

  return (
    <Card
      className={`group cursor-pointer border-border/40 hover:border-primary/30 transition-all duration-200 ${colors.bg}`}
      onClick={() => navigate(configureHref)}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(configureHref); } }}
      aria-label={`${title}: ${score != null ? `${score} out of ${maxScore}` : "not calculated"}. Click to configure.`}
    >
      <CardContent className="flex items-center gap-3 py-3 px-4">
        {loading ? (
          <div className="w-16 h-16 flex-none flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : score != null ? (
          <ScoreRing score={score} maxScore={maxScore} status={resolvedStatus} />
        ) : (
          <div className="w-16 h-16 flex-none flex items-center justify-center rounded-full bg-muted/20">
            {icon || <span className="text-lg text-muted-foreground">—</span>}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium truncate">{title}</span>
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors">
          <span className="hidden sm:inline">{configureLabel}</span>
          <ChevronRight className="w-4 h-4" />
        </div>
      </CardContent>
    </Card>
  );
}

export { type Status, STATUS_COLORS, scoreToStatus };
