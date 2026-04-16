/**
 * DisclosureSection — Progressive disclosure wrapper for page sections.
 *
 * Wraps any content block and conditionally renders it based on the
 * global disclosure level from DisclosureContext.
 *
 * Usage:
 *   <DisclosureSection minLevel={3} label="Advanced Analytics">
 *     <AdvancedCharts />
 *   </DisclosureSection>
 *
 * When the user's disclosure level is below minLevel, the section is
 * either hidden entirely or shown as a collapsed teaser (configurable).
 */

import { ReactNode } from "react";
import { useDisclosure } from "@/contexts/DisclosureContext";
import { ChevronRight, Lock } from "lucide-react";

interface DisclosureSectionProps {
  /** Minimum disclosure level required to show this section (1-4) */
  minLevel: 1 | 2 | 3 | 4;
  /** Human-readable label for the section (shown in teaser mode) */
  label?: string;
  /** Content to render when disclosure level is met */
  children: ReactNode;
  /** If true, show a teaser card when level is not met. Default: false (hide entirely) */
  showTeaser?: boolean;
  /** Optional className for the wrapper */
  className?: string;
}

const LEVEL_NAMES: Record<number, string> = {
  1: "Essential",
  2: "Standard",
  3: "Advanced",
  4: "Expert",
};

export function DisclosureSection({
  minLevel,
  label,
  children,
  showTeaser = false,
  className = "",
}: DisclosureSectionProps) {
  const { level } = useDisclosure();

  if (level >= minLevel) {
    return <div className={className}>{children}</div>;
  }

  if (!showTeaser || !label) return null;

  return (
    <div
      className={`rounded-lg border border-dashed border-border/40 bg-card/20 px-4 py-3 flex items-center gap-3 text-muted-foreground/60 ${className}`}
      role="region"
      aria-label={`${label} — requires ${LEVEL_NAMES[minLevel]} level`}
    >
      <Lock className="w-4 h-4 flex-none" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{label}</p>
        <p className="text-xs">
          Available at <span className="text-primary/70 font-medium">{LEVEL_NAMES[minLevel]}</span> disclosure level
        </p>
      </div>
      <ChevronRight className="w-4 h-4 flex-none" />
    </div>
  );
}

/**
 * useDisclosureGate — Hook version for conditional logic in components.
 *
 * Usage:
 *   const showAdvanced = useDisclosureGate(3);
 *   if (showAdvanced) { ... }
 */
export function useDisclosureGate(minLevel: 1 | 2 | 3 | 4): boolean {
  const { level } = useDisclosure();
  return level >= minLevel;
}
