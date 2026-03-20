import { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TourStep {
  target: string; // CSS selector
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right";
}

const TOUR_STEPS: TourStep[] = [
  {
    target: "[data-tour='chat-input']",
    title: "Start a Conversation",
    description: "Ask anything — financial questions, general advice, or study help. The AI adapts to your needs and learns your style over time.",
    position: "top",
  },
  {
    target: "[data-tour='focus-mode']",
    title: "Focus Modes",
    description: "Switch between General, Financial, or Study modes. Each mode tailors the AI's expertise and response style to your current need.",
    position: "bottom",
  },
  {
    target: "[data-tour='sidebar-nav']",
    title: "Your Tools",
    description: "Access your financial calculators, document library, professional directory, integrations, and settings from the sidebar.",
    position: "right",
  },
  {
    target: "[data-tour='voice-toggle']",
    title: "Voice Mode",
    description: "Toggle voice mode for hands-free conversations. The AI will speak responses aloud and listen for your voice input.",
    position: "bottom",
  },
  {
    target: "[data-tour='suggested-prompts']",
    title: "Suggested Prompts",
    description: "These prompts are personalized to your role and usage. They help you discover platform features and get actionable insights.",
    position: "top",
  },
];

const TOUR_STORAGE_KEY = "stewardry_tour_completed";

export function GuidedTour() {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const completed = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!completed) {
      // Delay tour start to let the page render
      const timer = setTimeout(() => setIsActive(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const updateSpotlight = useCallback(() => {
    if (!isActive) return;
    const step = TOUR_STEPS[currentStep];
    const el = document.querySelector(step.target);
    if (el) {
      const rect = el.getBoundingClientRect();
      setSpotlightRect(rect);
    } else {
      setSpotlightRect(null);
    }
  }, [currentStep, isActive]);

  useEffect(() => {
    updateSpotlight();
    window.addEventListener("resize", updateSpotlight);
    return () => window.removeEventListener("resize", updateSpotlight);
  }, [updateSpotlight]);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    setIsActive(false);
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
  };

  const handleSkip = () => {
    setIsActive(false);
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
  };

  if (!isActive) return null;

  const step = TOUR_STEPS[currentStep];
  const padding = 8;

  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (!spotlightRect) {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    }

    const pos = step.position || "bottom";
    const tooltipWidth = 340;
    const tooltipGap = 16;

    switch (pos) {
      case "top":
        return {
          bottom: `${window.innerHeight - spotlightRect.top + tooltipGap}px`,
          left: `${Math.max(16, Math.min(spotlightRect.left + spotlightRect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 16))}px`,
        };
      case "bottom":
        return {
          top: `${spotlightRect.bottom + tooltipGap}px`,
          left: `${Math.max(16, Math.min(spotlightRect.left + spotlightRect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 16))}px`,
        };
      case "left":
        return {
          top: `${spotlightRect.top + spotlightRect.height / 2 - 60}px`,
          right: `${window.innerWidth - spotlightRect.left + tooltipGap}px`,
        };
      case "right":
        return {
          top: `${spotlightRect.top + spotlightRect.height / 2 - 60}px`,
          left: `${spotlightRect.right + tooltipGap}px`,
        };
      default:
        return {
          top: `${spotlightRect.bottom + tooltipGap}px`,
          left: `${spotlightRect.left}px`,
        };
    }
  };

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[9999]" onClick={handleSkip}>
      {/* Dark overlay with spotlight cutout */}
      <svg className="absolute inset-0 w-full h-full" onClick={handleSkip}>
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {spotlightRect && (
              <rect
                x={spotlightRect.left - padding}
                y={spotlightRect.top - padding}
                width={spotlightRect.width + padding * 2}
                height={spotlightRect.height + padding * 2}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.7)"
          mask="url(#tour-mask)"
        />
      </svg>

      {/* Spotlight ring */}
      {spotlightRect && (
        <div
          className="absolute border-2 border-emerald-400 rounded-lg pointer-events-none animate-pulse"
          style={{
            left: spotlightRect.left - padding,
            top: spotlightRect.top - padding,
            width: spotlightRect.width + padding * 2,
            height: spotlightRect.height + padding * 2,
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        className="absolute z-10 w-[340px] bg-card border border-border rounded-xl shadow-2xl p-5"
        style={getTooltipStyle()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-muted-foreground font-medium">
            Step {currentStep + 1} of {TOUR_STEPS.length}
          </span>
          <button
            onClick={handleSkip}
            className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <h3 className="text-base font-semibold text-foreground mb-1.5">
          {step.title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          {step.description}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === currentStep ? "bg-emerald-400" : "bg-muted"
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button variant="ghost" size="sm" onClick={handlePrev}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleNext}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {currentStep === TOUR_STEPS.length - 1 ? "Get Started" : "Next"}
              {currentStep < TOUR_STEPS.length - 1 && (
                <ChevronRight className="w-4 h-4 ml-1" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function resetTour() {
  localStorage.removeItem(TOUR_STORAGE_KEY);
}
