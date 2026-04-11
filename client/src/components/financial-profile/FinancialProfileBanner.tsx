/**
 * FinancialProfileBanner — a compact status chip + CTA that any
 * calculator or planning page can drop at the top of its card to
 * show the user whether a saved profile is available, how complete
 * it is, and a one-click "use my saved profile" action.
 *
 * Why this is a force multiplier: every planning page previously
 * started from cold defaults. With this banner + the
 * `useFinancialProfile` hook, every calculator tells the user
 * "your profile is 80% ready — want me to prefill?" and the prefill
 * happens via a passed-in handler that knows how to map the
 * `FinancialProfile` shape into the calculator's local state.
 */

import { useFinancialProfile } from "@/hooks/useFinancialProfile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Sparkles, Wand2 } from "lucide-react";
import type { FinancialProfile } from "@/stores/financialProfile";
import { cn } from "@/lib/utils";

interface FinancialProfileBannerProps {
  /** Called when the user clicks "Use saved profile" — receives the
   *  current profile so the calculator can map it into its local state. */
  onPrefill: (profile: FinancialProfile) => void;
  /** Optional short label showing which fields the calculator will prefill. */
  usesFields?: (keyof FinancialProfile)[];
  /** Hide the banner when there is no saved profile at all. */
  hideWhenEmpty?: boolean;
  /** Tailwind className passthrough for layout overrides. */
  className?: string;
  /** Override the default action label. */
  actionLabel?: string;
}

const TONE_STYLE: Record<
  "empty" | "sparse" | "partial" | "full",
  { bg: string; text: string; icon: React.ReactNode }
> = {
  empty: {
    bg: "bg-muted/40 border-border/50",
    text: "text-muted-foreground",
    icon: <Sparkles className="w-3.5 h-3.5" />,
  },
  sparse: {
    bg: "bg-amber-500/10 border-amber-500/30",
    text: "text-amber-500",
    icon: <Sparkles className="w-3.5 h-3.5" />,
  },
  partial: {
    bg: "bg-accent/8 border-accent/30",
    text: "text-accent",
    icon: <Wand2 className="w-3.5 h-3.5" />,
  },
  full: {
    bg: "bg-emerald-500/10 border-emerald-500/30",
    text: "text-emerald-500",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
};

export function FinancialProfileBanner({
  onPrefill,
  usesFields = [],
  hideWhenEmpty = true,
  className,
  actionLabel = "Use saved profile",
}: FinancialProfileBannerProps) {
  const { profile, hasProfile, completeness, completenessStatus } =
    useFinancialProfile();

  if (!hasProfile && hideWhenEmpty) return null;

  const tone = TONE_STYLE[completenessStatus.tone];
  const pct = Math.round(completeness * 100);

  const missingCount =
    usesFields.length > 0
      ? usesFields.filter((f) => profile[f] === undefined).length
      : 0;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs",
        tone.bg,
        className,
      )}
      role="status"
      aria-live="polite"
      data-testid="financial-profile-banner"
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className={cn("flex-shrink-0", tone.text)}>{tone.icon}</span>
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("font-medium", tone.text)}>
            {completenessStatus.label}
          </span>
          {hasProfile && (
            <Badge
              variant="outline"
              className="h-4 px-1 text-[10px] font-mono tabular-nums border-current"
            >
              {pct}%
            </Badge>
          )}
          {usesFields.length > 0 && hasProfile && (
            <span className="text-[10px] text-muted-foreground truncate hidden sm:inline">
              · {usesFields.length - missingCount}/{usesFields.length} fields available
            </span>
          )}
        </div>
      </div>
      {hasProfile && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs flex-shrink-0"
          onClick={() => onPrefill(profile)}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
