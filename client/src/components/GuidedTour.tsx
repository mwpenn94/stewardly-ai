import { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { usePopupSlot, registerPopup, dismissPopup } from "@/hooks/usePopupQueue";

interface TourStep {
  target: string; // CSS selector
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right";
  /** If true, skip this step when the target element is not found */
  optional?: boolean;
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
    position: "top",
  },
  {
    target: "[data-tour='voice-toggle']",
    title: "Voice Mode",
    description: "Toggle voice mode for hands-free conversations. The AI will speak responses aloud and listen for your voice input.",
    position: "top",
  },
  {
    target: "[data-tour='suggested-prompts']",
    title: "Suggested Prompts",
    description: "These prompts are personalized to your role and usage. They help you discover platform features and get actionable insights.",
    position: "top",
    optional: true,
  },
  {
    target: "[data-tour='sidebar-nav']",
    title: "Your Tools",
    description: "Access your financial calculators, document library, professional directory, integrations, and settings from the sidebar.",
    position: "right",
    optional: true, // Sidebar tools section may be collapsed
  },
];

const TOUR_STORAGE_KEY = "stewardly_tour_completed";

export function GuidedTour() {
  const [wantsToStart, setWantsToStart] = useState(false);
  const canShow = usePopupSlot("guidedTour");
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [location] = useLocation();
  const [effectiveSteps, setEffectiveSteps] = useState<TourStep[]>([]);

  // Register with the popup queue when on /chat and tour not completed
  useEffect(() => {
    if (!location.startsWith("/chat")) return;
    const completed = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!completed) {
      const timer = setTimeout(() => {
        setWantsToStart(true);
        registerPopup("guidedTour");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [location]);

  // When the queue grants us the slot, actually start the tour
  useEffect(() => {
    if (wantsToStart && canShow && !isActive) {
      // Build effective steps list by checking which targets exist
      const available = TOUR_STEPS.filter(step => {
        const el = document.querySelector(step.target);
        return el || !step.optional;
      });
      if (available.length > 0 && document.querySelector(available[0].target)) {
        setEffectiveSteps(available);
        setCurrentStep(0);
        setIsActive(true);
      } else {
        // No valid targets — dismiss from queue
        dismissPopup("guidedTour");
        setWantsToStart(false);
      }
    }
  }, [wantsToStart, canShow, isActive]);

  const currentTourStep = effectiveSteps[currentStep];

  const updateSpotlight = useCallback(() => {
    if (!isActive || !currentTourStep) return;
    const el = document.querySelector(currentTourStep.target);
    if (el) {
      const rect = el.getBoundingClientRect();
      setSpotlightRect(rect);
    } else {
      setSpotlightRect(null);
    }
  }, [currentStep, isActive, currentTourStep]);

  useEffect(() => {
    if (!isActive) return;
    const timer = setTimeout(updateSpotlight, 100);
    window.addEventListener("resize", updateSpotlight);
    window.addEventListener("scroll", updateSpotlight, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateSpotlight);
      window.removeEventListener("scroll", updateSpotlight, true);
    };
  }, [updateSpotlight, isActive]);

  const findNextVisibleStep = (fromIndex: number, direction: 1 | -1): number => {
    let idx = fromIndex + direction;
    while (idx >= 0 && idx < effectiveSteps.length) {
      const el = document.querySelector(effectiveSteps[idx].target);
      if (el) return idx;
      if (!effectiveSteps[idx].optional) return idx;
      idx += direction;
    }
    return -1;
  };

  const handleNext = () => {
    const nextIdx = findNextVisibleStep(currentStep, 1);
    if (nextIdx >= 0 && nextIdx < effectiveSteps.length) {
      setCurrentStep(nextIdx);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    const prevIdx = findNextVisibleStep(currentStep, -1);
    if (prevIdx >= 0) {
      setCurrentStep(prevIdx);
    }
  };

  const handleComplete = () => {
    setIsActive(false);
    setCurrentStep(0);
    setWantsToStart(false);
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
    dismissPopup("guidedTour");
  };

  const handleSkip = () => {
    setIsActive(false);
    setCurrentStep(0);
    setWantsToStart(false);
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
    dismissPopup("guidedTour");
  };

  if (!isActive || !currentTourStep) return null;

  const padding = 8;

  const getTooltipStyle = (): React.CSSProperties => {
    if (!spotlightRect) {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    }

    const pos = currentTourStep.position || "bottom";
    const tooltipWidth = Math.min(340, window.innerWidth - 32);
    const tooltipGap = 16;

    switch (pos) {
      case "top":
        return {
          bottom: `${window.innerHeight - spotlightRect.top + tooltipGap}px`,
          left: `${Math.max(16, Math.min(spotlightRect.left + spotlightRect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 16))}px`,
          maxWidth: `${tooltipWidth}px`,
        };
      case "bottom":
        return {
          top: `${spotlightRect.bottom + tooltipGap}px`,
          left: `${Math.max(16, Math.min(spotlightRect.left + spotlightRect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 16))}px`,
          maxWidth: `${tooltipWidth}px`,
        };
      case "left":
        return {
          top: `${Math.max(16, spotlightRect.top + spotlightRect.height / 2 - 60)}px`,
          right: `${window.innerWidth - spotlightRect.left + tooltipGap}px`,
          maxWidth: `${tooltipWidth}px`,
        };
      case "right":
        return {
          top: `${Math.max(16, spotlightRect.top + spotlightRect.height / 2 - 60)}px`,
          left: `${Math.min(spotlightRect.right + tooltipGap, window.innerWidth - tooltipWidth - 16)}px`,
          maxWidth: `${tooltipWidth}px`,
        };
      default:
        return {
          top: `${spotlightRect.bottom + tooltipGap}px`,
          left: `${Math.max(16, spotlightRect.left)}px`,
          maxWidth: `${tooltipWidth}px`,
        };
    }
  };

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[9999]">
      {/* Dark overlay with spotlight cutout */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
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

      {/* Click-blocker — but with a visible skip button at top-right for mobile */}
      <div className="absolute inset-0" />

      {/* Mobile-friendly skip button at top of screen */}
      <button
        onClick={handleSkip}
        className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card/90 backdrop-blur-sm border border-border text-sm text-muted-foreground hover:text-foreground transition-colors shadow-lg"
      >
        <X className="w-4 h-4" />
        <span className="sm:inline hidden">Skip tour</span>
      </button>

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
        className="absolute z-10 bg-card border border-border rounded-xl shadow-2xl p-4 sm:p-5"
        style={getTooltipStyle()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-muted-foreground font-medium">
            Step {currentStep + 1} of {effectiveSteps.length}
          </span>
          <button
            onClick={handleSkip}
            className="ml-auto text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <h3 className="text-sm sm:text-base font-semibold text-foreground mb-1.5">
          {currentTourStep.title}
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-4">
          {currentTourStep.description}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {effectiveSteps.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === currentStep ? "bg-emerald-400" : i < currentStep ? "bg-emerald-400/40" : "bg-muted"
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
              {currentStep === effectiveSteps.length - 1 ? "Get Started" : "Next"}
              {currentStep < effectiveSteps.length - 1 && (
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
