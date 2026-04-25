/**
 * Shared SRS difficulty rating component (Pass 155).
 *
 * Shows 4 buttons (Again / Hard / Good / Easy) with color-coded styling
 * and interval preview labels. Used after answering a quiz question or
 * flashcard to let the learner rate perceived difficulty before advancing.
 *
 * Keyboard shortcuts: 1 = Again, 2 = Hard, 3 = Good, 4 = Easy
 */
import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RotateCw, X, Check, Sparkles } from "lucide-react";

export type Difficulty = "again" | "hard" | "good" | "easy";

const DIFFICULTY_LEVELS: Difficulty[] = ["again", "hard", "good", "easy"];

const DIFF_CONFIG: Record<
  Difficulty,
  { label: string; color: string; darkColor: string; icon: React.ReactNode }
> = {
  again: {
    label: "Again",
    color: "border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-800",
    darkColor: "dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950",
    icon: <RotateCw className="h-3.5 w-3.5" />,
  },
  hard: {
    label: "Hard",
    color: "border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800",
    darkColor: "dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-950",
    icon: <X className="h-3.5 w-3.5" />,
  },
  good: {
    label: "Good",
    color: "border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800",
    darkColor: "dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950",
    icon: <Check className="h-3.5 w-3.5" />,
  },
  easy: {
    label: "Easy",
    color: "border-sky-300 text-sky-700 hover:bg-sky-50 hover:text-sky-800",
    darkColor: "dark:border-sky-800 dark:text-sky-400 dark:hover:bg-sky-950",
    icon: <Sparkles className="h-3.5 w-3.5" />,
  },
};

// SRS interval preview constants (mirrors server-side mastery.ts)
const SRS_IVALS: Record<number, number> = { 0: 0, 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };
const SRS_DMULT: Record<string, number> = { again: 0, hard: 0.5, good: 1.0, easy: 1.5 };

function previewLabel(confidence: number, d: Difficulty): string {
  const conf = Math.max(0, Math.min(5, confidence));
  const nextConf = d === "again" ? 0 : Math.min(5, conf + 1);
  const baseDays = SRS_IVALS[nextConf] ?? 1;
  const days = Math.max(0, baseDays * (SRS_DMULT[d] ?? 1));
  if (days < 1 / 1440) return "<1m";
  if (days < 1 / 24) return `${Math.round(days * 24 * 60)}m`;
  if (days < 1) return `${Math.round(days * 24)}h`;
  if (days < 14) return `${Math.round(days)}d`;
  if (days < 60) return `${Math.round(days / 7)}w`;
  return `${Math.round(days / 30)}mo`;
}

interface DifficultyRatingProps {
  /** Current SRS confidence level (0-5) for the item */
  confidence: number;
  /** Called when user selects a difficulty */
  onRate: (difficulty: Difficulty) => void;
  /** Disable buttons (e.g. while mutation is pending) */
  disabled?: boolean;
  /** Whether to listen for keyboard shortcuts 1-4 */
  enableKeyboard?: boolean;
  /** Optional label above the buttons */
  label?: string;
}

export function DifficultyRating({
  confidence,
  onRate,
  disabled = false,
  enableKeyboard = true,
  label = "How difficult was this?",
}: DifficultyRatingProps) {
  useEffect(() => {
    if (!enableKeyboard || disabled) return;
    function handle(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      const idx = Number(e.key) - 1;
      if (idx >= 0 && idx < 4) {
        e.preventDefault();
        onRate(DIFFICULTY_LEVELS[idx]);
      }
    }
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [enableKeyboard, disabled, onRate]);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground text-center">{label}</p>
      <div className="grid grid-cols-4 gap-2">
        {DIFFICULTY_LEVELS.map((d) => {
          const cfg = DIFF_CONFIG[d];
          const lbl = previewLabel(confidence, d);
          return (
            <Button
              key={d}
              variant="outline"
              size="sm"
              className={`flex flex-col items-center gap-0.5 h-auto py-2 ${cfg.color} ${cfg.darkColor}`}
              onClick={() => onRate(d)}
              disabled={disabled}
              aria-label={`Rate ${cfg.label} — next review in ${lbl}`}
            >
              <span className="flex items-center gap-1 text-xs font-medium">
                {cfg.icon} {cfg.label}
              </span>
              <span className="text-[10px] opacity-70 font-mono">{lbl}</span>
            </Button>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground text-center">
        Keys: 1 Again · 2 Hard · 3 Good · 4 Easy
      </p>
    </div>
  );
}

export { DIFFICULTY_LEVELS, DIFF_CONFIG, previewLabel };
