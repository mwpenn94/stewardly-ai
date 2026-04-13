/**
 * LeadCard — Compact card for displaying a lead in pipeline views.
 * Shows name, source, score, stage, and quick actions.
 */
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PropensityGauge } from "./PropensityGauge";
import { VerificationBadge } from "./VerificationBadge";
import { PiiMaskedField } from "./PiiMaskedField";
import { User, Mail, Phone, Calendar, MoreHorizontal, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeadCardProps {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  source: string;
  stage: string;
  score: number;
  verified?: boolean;
  lastActivity?: string;
  onClick?: () => void;
  onQuickAction?: (action: string) => void;
  className?: string;
}

const stageColors: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  contacted: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  qualified: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  proposal: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  negotiation: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  won: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  lost: "bg-red-500/10 text-red-400 border-red-500/30",
};

export function LeadCard({
  name, email, phone, source, stage, score, verified, lastActivity,
  onClick, onQuickAction, className,
}: LeadCardProps) {
  return (
    <Card
      className={cn("cursor-pointer hover:border-primary/40 transition-colors group", className)}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm truncate">{name}</span>
              {verified && <VerificationBadge status="verified" size="sm" />}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {email && (
                <span className="flex items-center gap-1 truncate">
                  <Mail className="h-3 w-3 shrink-0" /> <PiiMaskedField value={email} visibleChars={4} />
                </span>
              )}
              {phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3 shrink-0" /> <PiiMaskedField value={phone} visibleChars={4} />
                </span>
              )}
            </div>
          </div>
          <PropensityGauge score={score} size="sm" />
        </div>

        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn("text-[10px] capitalize", stageColors[stage] ?? "")}>
              {stage}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {source}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            {lastActivity && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Calendar className="h-3 w-3" /> {lastActivity}
              </span>
            )}
            <Button
              variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={e => { e.stopPropagation(); onQuickAction?.("view"); }}
            >
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
