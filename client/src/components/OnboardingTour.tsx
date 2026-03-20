/**
 * AI-Guided Onboarding Tour / Site Support System
 * Provides a step-by-step walkthrough of the platform's key features
 * with spotlight highlighting and contextual tooltips.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  X, ChevronRight, ChevronLeft, Sparkles, MessageSquare,
  BarChart3, Shield, Users, FileText, Settings, HelpCircle,
  Lightbulb, Zap, Globe,
} from "lucide-react";

interface TourStep {
  id: string;
  title: string;
  description: string;
  target?: string; // CSS selector for spotlight
  placement: "top" | "bottom" | "left" | "right" | "center";
  icon: React.ReactNode;
  category: "getting-started" | "features" | "advanced";
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Stewardry",
    description: "Your AI-powered digital financial twin. I'll guide you through the platform's key features so you can get the most out of your experience.",
    placement: "center",
    icon: <Sparkles className="w-5 h-5" />,
    category: "getting-started",
  },
  {
    id: "chat",
    title: "AI Chat — Your Digital Twin",
    description: "Start a conversation with your AI assistant. It understands general topics and financial advisory equally well. Use the focus mode selector to shift between General, Financial, or Both.",
    target: "[data-tour='chat-input']",
    placement: "top",
    icon: <MessageSquare className="w-5 h-5" />,
    category: "getting-started",
  },
  {
    id: "voice-mode",
    title: "Hands-Free Voice Mode",
    description: "Toggle voice mode for a hands-free experience. The AI listens, responds with natural speech, and automatically continues the conversation. Perfect for multitasking.",
    target: "[data-tour='voice-toggle']",
    placement: "bottom",
    icon: <Zap className="w-5 h-5" />,
    category: "features",
  },
  {
    id: "context-sharing",
    title: "Share Context with AI",
    description: "Upload documents, share your screen, use your camera, or paste images. The AI analyzes visual and textual content to provide better, more contextual advice.",
    target: "[data-tour='context-buttons']",
    placement: "top",
    icon: <FileText className="w-5 h-5" />,
    category: "features",
  },
  {
    id: "sidebar-nav",
    title: "Navigation Sidebar",
    description: "Access all platform features from the sidebar: Market Data, Financial Tools, Documents, Products, Settings, and more. Each section is designed to complement your AI conversations.",
    target: "[data-tour='sidebar']",
    placement: "right",
    icon: <Globe className="w-5 h-5" />,
    category: "getting-started",
  },
  {
    id: "market-data",
    title: "Real-Time Market Data",
    description: "View live market quotes, charts, and financial news. The AI can also pull market data directly into your conversations for analysis.",
    target: "[data-tour='market-data']",
    placement: "right",
    icon: <BarChart3 className="w-5 h-5" />,
    category: "features",
  },
  {
    id: "financial-tools",
    title: "Financial Planning Tools",
    description: "Access calculators for IUL projections, premium finance ROI, retirement planning, and product comparison. Results can be discussed with the AI for deeper analysis.",
    target: "[data-tour='financial-tools']",
    placement: "right",
    icon: <Lightbulb className="w-5 h-5" />,
    category: "features",
  },
  {
    id: "compliance",
    title: "Built-In Compliance",
    description: "Every conversation includes appropriate disclaimers. Financial advice is flagged for review, and a complete audit trail is maintained for regulatory compliance.",
    target: "[data-tour='compliance']",
    placement: "bottom",
    icon: <Shield className="w-5 h-5" />,
    category: "advanced",
  },
  {
    id: "data-intelligence",
    title: "Data Intelligence Hub",
    description: "Ingest data from multiple sources — web scraping, RSS feeds, CSV uploads, and API feeds. The AI continuously learns from ingested data to improve its insights.",
    target: "[data-tour='data-intelligence']",
    placement: "right",
    icon: <BarChart3 className="w-5 h-5" />,
    category: "advanced",
  },
  {
    id: "settings",
    title: "Personalize Your Experience",
    description: "Customize your AI's communication style, upload a talking avatar, adjust your profile, and manage your preferences in Settings.",
    target: "[data-tour='settings']",
    placement: "right",
    icon: <Settings className="w-5 h-5" />,
    category: "getting-started",
  },
  {
    id: "email-campaigns",
    title: "Email Campaigns",
    description: "Create and send personalized email campaigns to clients. Use AI to generate professional content, manage recipients, and track campaign performance.",
    target: "[data-tour='email-campaigns']",
    placement: "right",
    icon: <Globe className="w-5 h-5" />,
    category: "advanced",
  },
  {
    id: "products-marketplace",
    title: "Product Marketplace",
    description: "Browse financial products with AI-powered suitability scoring. Compare products side-by-side and get personalized recommendations based on your client profiles.",
    target: "[data-tour='products']",
    placement: "right",
    icon: <Users className="w-5 h-5" />,
    category: "features",
  },
  {
    id: "guest-access",
    title: "Guest Access",
    description: "You can explore all features without signing in. Your data is saved for the session. Sign in anytime to save permanently and access across devices.",
    placement: "center",
    icon: <Users className="w-5 h-5" />,
    category: "getting-started",
  },
  {
    id: "help-system",
    title: "Help is Always Available",
    description: "Click the help button (bottom-right) or press Ctrl+/ for page-specific tips, keyboard shortcuts, and FAQ. The help adapts to whichever page you're on.",
    placement: "center",
    icon: <HelpCircle className="w-5 h-5" />,
    category: "getting-started",
  },
  {
    id: "complete",
    title: "You're All Set!",
    description: "You're ready to explore. Start a conversation, upload a document, or check the market data. Your AI assistant is here to help with anything — financial or otherwise.",
    placement: "center",
    icon: <Sparkles className="w-5 h-5" />,
    category: "getting-started",
  },
];

interface OnboardingTourProps {
  onComplete: () => void;
  isOpen: boolean;
}

export function OnboardingTour({ onComplete, isOpen }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const step = TOUR_STEPS[currentStep];
  const progress = ((currentStep + 1) / TOUR_STEPS.length) * 100;

  // Find and highlight target element
  useEffect(() => {
    if (!isOpen || !step?.target) {
      setSpotlightRect(null);
      return;
    }

    const el = document.querySelector(step.target);
    if (el) {
      const rect = el.getBoundingClientRect();
      setSpotlightRect(rect);
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      setSpotlightRect(null);
    }
  }, [currentStep, isOpen, step?.target]);

  const handleNext = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(c => c + 1);
    } else {
      onComplete();
    }
  }, [currentStep, onComplete]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) setCurrentStep(c => c - 1);
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  if (!isOpen) return null;

  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (!spotlightRect || step.placement === "center") {
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 10001,
      };
    }

    const padding = 16;
    const style: React.CSSProperties = {
      position: "fixed",
      zIndex: 10001,
      maxWidth: "380px",
    };

    switch (step.placement) {
      case "top":
        style.bottom = `${window.innerHeight - spotlightRect.top + padding}px`;
        style.left = `${spotlightRect.left + spotlightRect.width / 2}px`;
        style.transform = "translateX(-50%)";
        break;
      case "bottom":
        style.top = `${spotlightRect.bottom + padding}px`;
        style.left = `${spotlightRect.left + spotlightRect.width / 2}px`;
        style.transform = "translateX(-50%)";
        break;
      case "left":
        style.top = `${spotlightRect.top + spotlightRect.height / 2}px`;
        style.right = `${window.innerWidth - spotlightRect.left + padding}px`;
        style.transform = "translateY(-50%)";
        break;
      case "right":
        style.top = `${spotlightRect.top + spotlightRect.height / 2}px`;
        style.left = `${spotlightRect.right + padding}px`;
        style.transform = "translateY(-50%)";
        break;
    }

    return style;
  };

  return (
    <>
      {/* Overlay */}
      <div
        ref={overlayRef}
        className="fixed inset-0 z-[10000] bg-black/60 transition-opacity duration-300"
        onClick={handleSkip}
      >
        {/* Spotlight cutout */}
        {spotlightRect && (
          <div
            className="absolute border-2 border-primary rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] transition-all duration-300"
            style={{
              top: spotlightRect.top - 4,
              left: spotlightRect.left - 4,
              width: spotlightRect.width + 8,
              height: spotlightRect.height + 8,
            }}
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>

      {/* Tooltip Card */}
      <div style={getTooltipStyle()} onClick={(e) => e.stopPropagation()}>
        <Card className="shadow-2xl border-primary/20">
          <CardContent className="p-4 space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                  {step.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{step.title}</h3>
                  <Badge variant="outline" className="text-[10px] mt-0.5">
                    {step.category.replace("-", " ")}
                  </Badge>
                </div>
              </div>
              <Button variant="ghost" size="icon-sm" className="shrink-0" onClick={handleSkip}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground leading-relaxed">
              {step.description}
            </p>

            {/* Progress bar */}
            <div className="w-full bg-muted rounded-full h-1">
              <div
                className="bg-primary h-1 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {currentStep + 1} of {TOUR_STEPS.length}
              </span>
              <div className="flex gap-1.5">
                {currentStep > 0 && (
                  <Button variant="outline" size="sm" className="text-xs" onClick={handlePrev}>
                    <ChevronLeft className="w-3.5 h-3.5 mr-0.5" /> Back
                  </Button>
                )}
                <Button size="sm" className="text-xs" onClick={handleNext}>
                  {currentStep === TOUR_STEPS.length - 1 ? "Get Started" : "Next"}
                  {currentStep < TOUR_STEPS.length - 1 && <ChevronRight className="w-3.5 h-3.5 ml-0.5" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

/**
 * Help button that triggers the tour or shows contextual help
 */
export function HelpButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="outline"
      size="icon"
      className="rounded-full"
      onClick={onClick}
      title="Start guided tour"
    >
      <HelpCircle className="w-5 h-5" />
    </Button>
  );
}

/**
 * Hook to manage tour state with localStorage persistence
 */
export function useOnboardingTour() {
  const STORAGE_KEY = "onboarding_tour_completed";

  const [isOpen, setIsOpen] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const startTour = useCallback(() => setIsOpen(true), []);

  const completeTour = useCallback(() => {
    setIsOpen(false);
    setHasCompleted(true);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // localStorage not available
    }
  }, []);

  // Auto-start for first-time users (after a short delay)
  useEffect(() => {
    if (!hasCompleted) {
      const timer = setTimeout(() => setIsOpen(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [hasCompleted]);

  return { isOpen, hasCompleted, startTour, completeTour };
}
