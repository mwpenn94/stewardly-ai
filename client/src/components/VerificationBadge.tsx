/**
 * VerificationBadge — Single inline verification badge for a professional credential.
 * Compact version of VerificationBadges for use in cards, lists, and headers.
 */
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ShieldCheck, ShieldAlert, ShieldX, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type VerificationStatus = "verified" | "pending" | "expired" | "failed" | "loading";

interface VerificationBadgeProps {
  status: VerificationStatus;
  label?: string;
  expiresAt?: string;
  className?: string;
  size?: "sm" | "md";
}

const statusConfig = {
  verified: { icon: ShieldCheck, color: "text-emerald-400", bg: "bg-emerald-500/10", text: "Verified" },
  pending: { icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10", text: "Pending" },
  expired: { icon: ShieldAlert, color: "text-orange-400", bg: "bg-orange-500/10", text: "Expired" },
  failed: { icon: ShieldX, color: "text-red-400", bg: "bg-red-500/10", text: "Failed" },
  loading: { icon: Loader2, color: "text-muted-foreground", bg: "bg-muted/50", text: "Checking..." },
} as const;

export function VerificationBadge({ status, label, expiresAt, className, size = "sm" }: VerificationBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5", config.bg, className)}>
            <Icon className={cn(iconSize, config.color, status === "loading" && "animate-spin")} />
            {label && <span className={cn(textSize, "font-medium", config.color)}>{label}</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs font-medium">{config.text}{label ? `: ${label}` : ""}</p>
          {expiresAt && <p className="text-xs text-muted-foreground">Expires: {expiresAt}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
