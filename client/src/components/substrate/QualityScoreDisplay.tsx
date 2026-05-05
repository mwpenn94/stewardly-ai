/**
 * QualityScoreDisplay — AEGIS quality score visualization.
 *
 * Shows the 5-dimension quality score for an AI response:
 *   - Accuracy, Completeness, Relevance, Coherence, Safety
 *   - Overall score with confidence interval
 *   - Improvement suggestions
 *
 * Absorbed from manus-next-app AEGISQualityScoreDisplay with Stewardly adaptations.
 *
 * @substrate-ui: quality-score
 */
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  CheckCircle, AlertTriangle, XCircle,
  TrendingUp, HelpCircle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ─── Types ───────────────────────────────────────────────────────────────────

interface QualityScore {
  accuracy: number;
  completeness: number;
  relevance: number;
  coherence: number;
  safety: number;
  overall: number;
}

interface QualityScoreDisplayProps {
  score: QualityScore;
  suggestions?: string[];
  compact?: boolean;
  className?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getScoreColor(score: number): string {
  if (score >= 0.8) return "text-green-400";
  if (score >= 0.6) return "text-yellow-400";
  return "text-red-400";
}

function getScoreIcon(score: number) {
  if (score >= 0.8) return CheckCircle;
  if (score >= 0.6) return AlertTriangle;
  return XCircle;
}

function formatScore(score: number): string {
  return Math.round(score * 100).toString();
}

// ─── Component ───────────────────────────────────────────────────────────────

export function QualityScoreDisplay({
  score,
  suggestions,
  compact = false,
  className,
}: QualityScoreDisplayProps) {
  const OverallIcon = getScoreIcon(score.overall);

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("inline-flex items-center gap-1 cursor-default", className)}>
              <OverallIcon className={cn("w-3.5 h-3.5", getScoreColor(score.overall))} />
              <span className={cn("text-xs font-medium", getScoreColor(score.overall))}>
                {formatScore(score.overall)}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[200px]">
            <div className="space-y-1 text-xs">
              <div className="font-medium">Quality Score: {formatScore(score.overall)}%</div>
              <ScoreDimensions score={score} />
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className={cn(
        "rounded-lg border border-border/50 bg-muted/30 p-3 space-y-2",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <OverallIcon className={cn("w-4 h-4", getScoreColor(score.overall))} />
          <span className="text-sm font-medium">
            Quality: {formatScore(score.overall)}%
          </span>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              AEGIS quality assessment across 5 dimensions
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Dimensions */}
      <ScoreDimensions score={score} />

      {/* Suggestions */}
      {suggestions && suggestions.length > 0 && (
        <div className="pt-1 border-t border-border/30">
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
            <TrendingUp className="w-3 h-3" />
            <span>Improvements</span>
          </div>
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {suggestions.slice(0, 3).map((s, i) => (
              <li key={i} className="pl-2 border-l border-border/50">{s}</li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ScoreDimensions({ score }: { score: QualityScore }) {
  const dimensions: Array<{ label: string; value: number }> = [
    { label: "Accuracy", value: score.accuracy },
    { label: "Completeness", value: score.completeness },
    { label: "Relevance", value: score.relevance },
    { label: "Coherence", value: score.coherence },
    { label: "Safety", value: score.safety },
  ];

  return (
    <div className="space-y-1">
      {dimensions.map((dim) => (
        <div key={dim.label} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-24">{dim.label}</span>
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${dim.value * 100}%` }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className={cn(
                "h-full rounded-full",
                dim.value >= 0.8 ? "bg-green-500" :
                dim.value >= 0.6 ? "bg-yellow-500" : "bg-red-500"
              )}
            />
          </div>
          <span className={cn("text-xs font-mono w-6", getScoreColor(dim.value))}>
            {formatScore(dim.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default QualityScoreDisplay;
