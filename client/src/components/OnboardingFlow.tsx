/**
 * OnboardingFlow -- per-persona onboarding wizard with:
 * - Animated step transitions
 * - Progress dots
 * - Skippable steps with action / secondaryAction per step
 * - Guard for empty steps array
 */
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  SkipForward,
  User,
  Briefcase,
  Shield,
  Users,
  Crown,
  MessageSquare,
  Calculator,
  BookOpen,
  Settings,
  BarChart3,
  Zap,
  Lock,
  Target,
  type LucideIcon,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────
export type Persona = "person" | "client" | "advisor" | "manager" | "steward";

export interface OnboardingStep {
  title: string;
  description: string;
  icon: LucideIcon;
  /** Primary CTA on this step (optional -- defaults to "Next"). */
  action?: { label: string; onClick: () => void };
  /** Secondary / alternative CTA. */
  secondaryAction?: { label: string; onClick: () => void };
  /** Whether this individual step can be skipped. Default true. */
  skippable?: boolean;
}

export interface OnboardingFlowProps {
  persona: Persona;
  steps: OnboardingStep[];
  onComplete: () => void;
  onSkipAll: () => void;
}

// ── Animation variants ──────────────────────────────────────────────
import type { Variants } from "framer-motion";

const slideVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
    transition: { duration: 0.2, ease: "easeIn" as const },
  }),
};

// ── Persona helpers ─────────────────────────────────────────────────
const PERSONA_LABELS: Record<Persona, string> = {
  person: "Personal",
  client: "Client",
  advisor: "Advisor",
  manager: "Manager",
  steward: "Administrator",
};

const PERSONA_ICONS: Record<Persona, LucideIcon> = {
  person: User,
  client: User,
  advisor: Briefcase,
  manager: Users,
  steward: Crown,
};

// ── Default step sets per persona ───────────────────────────────────
export function getPersonaSteps(persona: Persona): OnboardingStep[] {
  switch (persona) {
    case "person":
      return [
        {
          title: "Welcome to Stewardly",
          description:
            "Your AI-powered financial companion. Ask questions, run calculators, and get compliant guidance.",
          icon: MessageSquare,
          skippable: false,
        },
        {
          title: "Try a calculator",
          description:
            "Explore retirement projections, insurance comparisons, and estate planning tools -- all built in.",
          icon: Calculator,
        },
        {
          title: "Learn at your pace",
          description:
            "Access 366+ definitions, flashcards, and practice quizzes on financial topics.",
          icon: BookOpen,
        },
      ];

    case "client":
      return [
        {
          title: "Welcome aboard",
          description:
            "Your advisor has connected you to Stewardly. You can ask questions, view your plan, and track progress here.",
          icon: MessageSquare,
          skippable: false,
        },
        {
          title: "Your financial score",
          description:
            "We measure 12 dimensions of financial protection so you always know where you stand.",
          icon: BarChart3,
        },
        {
          title: "Secure and compliant",
          description:
            "Your data is encrypted at rest and every interaction is logged per FINRA requirements.",
          icon: Lock,
        },
      ];

    case "advisor":
      return [
        {
          title: "Welcome, Advisor",
          description:
            "Stewardly is your AI co-pilot -- compliance-native, multi-model, and built for growth.",
          icon: Briefcase,
          skippable: false,
        },
        {
          title: "Wealth Engine",
          description:
            "Run UWE, BIE, HE, and Monte Carlo calculations for clients, then generate PDF reports.",
          icon: Calculator,
        },
        {
          title: "Lead Pipeline",
          description:
            "Capture, enrich, and score leads with propensity models. Drag-and-drop Kanban built in.",
          icon: Target,
        },
        {
          title: "Continuous Learning",
          description:
            "Track CE credits, study for exams with SRS flashcards, and stay current on regulatory changes.",
          icon: BookOpen,
        },
        {
          title: "Configure your practice",
          description:
            "Set up CRM sync, integrations, and model preferences in Settings.",
          icon: Settings,
        },
      ];

    case "manager":
      return [
        {
          title: "Welcome, Manager",
          description:
            "Oversee your team's pipeline, compliance, and production metrics from one place.",
          icon: Users,
          skippable: false,
        },
        {
          title: "Team oversight",
          description:
            "View team performance, lead distribution, and compliance status at a glance.",
          icon: BarChart3,
        },
        {
          title: "AI agents",
          description:
            "Deploy autonomous agents for compliance audits, client outreach, and report generation.",
          icon: Zap,
        },
        {
          title: "Customize settings",
          description:
            "Configure organization-level branding, model preferences, and permission tiers.",
          icon: Settings,
        },
      ];

    case "steward":
      return [
        {
          title: "Welcome, Steward",
          description:
            "Full platform access -- system health, data freshness, rate management, and code chat.",
          icon: Crown,
          skippable: false,
        },
        {
          title: "System health",
          description:
            "Monitor 37 cron jobs, integration status, and scheduler telemetry in real time.",
          icon: Shield,
        },
        {
          title: "Intelligence layer",
          description:
            "23 models, consensus scoring, weight presets, and the ReAct multi-turn loop.",
          icon: Zap,
        },
        {
          title: "Code Chat",
          description:
            "Claude-Code-style ReAct loop over the codebase -- read, search, write (admin-gated).",
          icon: Settings,
        },
      ];
  }
}

// ── Component ───────────────────────────────────────────────────────
export default function OnboardingFlow({
  persona,
  steps,
  onComplete,
  onSkipAll,
}: OnboardingFlowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  // Bug fix: guard for empty steps array
  if (!steps || steps.length === 0) {
    return null;
  }

  const step = steps[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === steps.length - 1;
  const StepIcon = step.icon;
  const PersonaIcon = PERSONA_ICONS[persona] ?? User;

  const goNext = useCallback(() => {
    if (isLast) {
      onComplete();
    } else {
      setDirection(1);
      setCurrentIndex((prev) => Math.min(prev + 1, steps.length - 1));
    }
  }, [isLast, onComplete, steps.length]);

  const goBack = useCallback(() => {
    setDirection(-1);
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const skipStep = useCallback(() => {
    if (isLast) {
      onComplete();
    } else {
      setDirection(1);
      setCurrentIndex((prev) => Math.min(prev + 1, steps.length - 1));
    }
  }, [isLast, onComplete, steps.length]);

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Header with persona badge */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <PersonaIcon className="w-4 h-4" />
          <span>{PERSONA_LABELS[persona]} Setup</span>
        </div>
        <button
          type="button"
          onClick={onSkipAll}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip all
        </button>
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === currentIndex
                ? "w-6 bg-accent"
                : i < currentIndex
                  ? "w-2 bg-accent/50"
                  : "w-2 bg-border"
            }`}
          />
        ))}
      </div>

      {/* Animated step content */}
      <div className="relative overflow-hidden min-h-[200px]">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="flex flex-col items-center text-center px-4"
          >
            {/* Step icon */}
            <div className="flex items-center justify-center rounded-2xl bg-accent/10 p-4 mb-6">
              <StepIcon className="w-8 h-8 text-accent" />
            </div>

            {/* Step text */}
            <h3 className="font-heading text-xl mb-2">{step.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
              {step.description}
            </p>

            {/* Step actions */}
            {(step.action || step.secondaryAction) && (
              <div className="flex items-center gap-3 mt-6">
                {step.action && (
                  <Button size="sm" onClick={step.action.onClick}>
                    {step.action.label}
                  </Button>
                )}
                {step.secondaryAction && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={step.secondaryAction.onClick}
                  >
                    {step.secondaryAction.label}
                  </Button>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-4 border-t border-border">
        {/* Back */}
        <Button
          variant="ghost"
          size="sm"
          onClick={goBack}
          disabled={isFirst}
          className="gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </Button>

        <div className="flex items-center gap-2">
          {/* Skip (per-step) */}
          {step.skippable !== false && !isLast && (
            <Button
              variant="ghost"
              size="sm"
              onClick={skipStep}
              className="gap-1.5 text-muted-foreground"
            >
              <SkipForward className="w-3.5 h-3.5" />
              Skip
            </Button>
          )}

          {/* Next / Finish */}
          <Button size="sm" onClick={goNext} className="gap-1.5">
            {isLast ? (
              <>
                <CheckCircle className="w-3.5 h-3.5" />
                Finish
              </>
            ) : (
              <>
                Next
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Step counter */}
      <div className="text-center mt-3 text-xs text-muted-foreground">
        Step {currentIndex + 1} of {steps.length}
      </div>
    </div>
  );
}
