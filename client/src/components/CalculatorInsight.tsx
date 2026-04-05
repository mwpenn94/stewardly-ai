/**
 * CalculatorInsight — Displays AI-generated insight cards alongside calculator results.
 * Shows a brief AI analysis with expandable detail and optional CTA.
 */
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, ChevronDown, ChevronUp, Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalculatorInsightProps {
  title: string;
  summary: string;
  detail?: string;
  severity?: "info" | "warning" | "success" | "critical";
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

const severityStyles = {
  info: "border-blue-500/30 bg-blue-500/5",
  warning: "border-amber-500/30 bg-amber-500/5",
  success: "border-emerald-500/30 bg-emerald-500/5",
  critical: "border-red-500/30 bg-red-500/5",
} as const;

const severityIcons = {
  info: "text-blue-400",
  warning: "text-amber-400",
  success: "text-emerald-400",
  critical: "text-red-400",
} as const;

export function CalculatorInsight({
  title,
  summary,
  detail,
  severity = "info",
  actionLabel,
  onAction,
  className,
}: CalculatorInsightProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={cn("transition-all", severityStyles[severity], className)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">
            <Lightbulb className={cn("h-5 w-5", severityIcons[severity])} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm">{title}</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                <Sparkles className="h-3 w-3 mr-0.5" /> AI Insight
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
            {detail && expanded && (
              <p className="text-sm text-muted-foreground/80 mt-2 leading-relaxed">{detail}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              {detail && (
                <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setExpanded(!expanded)}>
                  {expanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                  {expanded ? "Less" : "More"}
                </Button>
              )}
              {actionLabel && onAction && (
                <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-primary" onClick={onAction}>
                  {actionLabel} <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
