/**
 * AI-Guided Onboarding Tour / Site Support System
 * Provides a step-by-step walkthrough of the platform's key features
 * with spotlight highlighting and contextual tooltips.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { sendFeedback } from "@/lib/feedbackSpecs";
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
    title: "Welcome to Stewardly",
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
    description: "Press Shift+V or tap the microphone button to activate hands-free mode. The AI listens to you, responds with natural speech, and automatically continues the conversation. You can interrupt the AI at any time by simply speaking (barge-in). Perfect for multitasking or when your hands are busy.",
    target: "[data-tour='voice-toggle']",
    placement: "bottom",
    icon: <Zap className="w-5 h-5" />,
    category: "features",
  },
  {
    id: "voice-commands",
    title: "Voice Commands",
    description: "In hands-free mode, say: \"stop\" to cancel a response, \"new chat\" to start fresh, \"bookmark\" to save a message, \"open palette\" for the command palette, \"cancel\" to clear input, or \"undo\" to revert. The AI also understands financial terms like IUL, 401(k), EBITDA, and Monte Carlo automatically.",
    placement: "center",
    icon: <MessageSquare className="w-5 h-5" />,
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
    id: "wealth-engine",
    title: "Wealth Engine — My Plan",
    description: "Your unified financial planning hub. Start with 'My Plan' to see your holistic overview, then explore the Profile panel to enter client details across retirement, insurance, education, estate, and more.",
    target: "[data-tour='wealth-engine']",
    placement: "right",
    icon: <BarChart3 className="w-5 h-5" />,
    category: "features",
  },
  {
    id: "client-profile",
    title: "Client Profile — Complete Picture",
    description: "Enter comprehensive client data: core financials, retirement planning, insurance & protection, education, estate & legacy, budget, employment, and charitable giving. All fields auto-save and cascade through every calculator.",
    target: "[data-tour='client-profile']",
    placement: "right",
    icon: <Users className="w-5 h-5" />,
    category: "features",
  },
  {
    id: "client-wealth-hub",
    title: "Client Wealth Hub",
    description: "See the complete financial picture in one view: protection score, tax optimization, retirement readiness, growth trajectory, estate plan, and education funding — all with actionable recommendations.",
    target: "[data-tour='client-wealth-hub']",
    placement: "right",
    icon: <Shield className="w-5 h-5" />,
    category: "features",
  },
  {
    id: "practice-management",
    title: "Practice Management — Business Income Engine",
    description: "Model your entire practice: production funnel, recruiting pipeline, P&L economics, GDC brackets, team overrides, channel marketing ROI, and multi-stream income roll-up. All panels are interconnected and cascade.",
    target: "[data-tour='practice-management']",
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
    title: "Message Campaigns",
    description: "Create and send personalized in-app message campaigns to clients. Use AI to generate professional content, manage recipients, and track campaign performance.",
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

/**
 * Role-adaptive tour mapping: maps server-side role steps to client-side tour steps.
 * The server returns role-specific steps (advisor/client/admin), and we map them
 * to the appropriate TOUR_STEPS entries for spotlight highlighting.
 */
const ROLE_STEP_MAP: Record<string, string[]> = {
  advisor: ["welcome", "chat", "voice-mode", "sidebar-nav", "financial-tools", "wealth-engine", "client-profile", "client-wealth-hub", "practice-management", "compliance", "data-intelligence", "settings", "email-campaigns", "products-marketplace", "help-system", "complete"],
  client: ["welcome", "chat", "voice-mode", "voice-commands", "context-sharing", "sidebar-nav", "financial-tools", "wealth-engine", "settings", "guest-access", "help-system", "complete"],
  admin: ["welcome", "sidebar-nav", "data-intelligence", "compliance", "settings", "email-campaigns", "products-marketplace", "help-system", "complete"],
};

export function OnboardingTour({ onComplete, isOpen }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const [userRole, setUserRole] = useState<string>("advisor");
  const overlayRef = useRef<HTMLDivElement>(null);

  // Determine role-filtered steps
  const roleStepIds = ROLE_STEP_MAP[userRole] || ROLE_STEP_MAP.advisor;
  const filteredSteps = TOUR_STEPS.filter(s => roleStepIds.includes(s.id));
  const step = filteredSteps[currentStep] || TOUR_STEPS[0];
  const progress = ((currentStep + 1) / filteredSteps.length) * 100;

  // Load user role from localStorage (set during auth)
  useEffect(() => {
    try {
      const stored = localStorage.getItem("stewardly_user_role");
      if (stored && ROLE_STEP_MAP[stored]) setUserRole(stored);
    } catch { /* ignore */ }
  }, []);

  // Resume: load last step from localStorage when tour opens
  useEffect(() => {
    if (isOpen) {
      try {
        const savedStep = localStorage.getItem("onboarding_tour_step");
        if (savedStep) {
          const parsed = parseInt(savedStep, 10);
          if (parsed >= 0 && parsed < filteredSteps.length) setCurrentStep(parsed);
        }
      } catch { /* ignore */ }
    }
  }, [isOpen, filteredSteps.length]);

  // Persist current step for resume
  useEffect(() => {
    if (isOpen) {
      try { localStorage.setItem("onboarding_tour_step", String(currentStep)); } catch { /* ignore */ }
    }
  }, [currentStep, isOpen]);

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
    if (currentStep < filteredSteps.length - 1) {
      sendFeedback("onboarding.step_complete");
      setCurrentStep(c => c + 1);
    } else {
      sendFeedback("onboarding.complete", { persona: "tour", role: userRole });
      try { localStorage.removeItem("onboarding_tour_step"); } catch { /* ignore */ }
      onComplete();
    }
  }, [currentStep, filteredSteps.length, onComplete, userRole]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) setCurrentStep(c => c - 1);
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    // Don't remove step — allows resume later
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
              <Button variant="ghost" size="icon-sm" className="shrink-0" onClick={handleSkip} aria-label="Skip tour">
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
                {currentStep + 1} of {filteredSteps.length}
              </span>
              <div className="flex gap-1.5">
                {currentStep > 0 && (
                  <Button variant="outline" size="sm" className="text-xs" onClick={handlePrev}>
                    <ChevronLeft className="w-3.5 h-3.5 mr-0.5" /> Back
                  </Button>
                )}
                <Button size="sm" className="text-xs" onClick={handleNext}>
                  {currentStep === filteredSteps.length - 1 ? "Get Started" : "Next"}
                  {currentStep < filteredSteps.length - 1 && <ChevronRight className="w-3.5 h-3.5 ml-0.5" />}
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
      aria-label="Start guided tour"
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

  // Pass 120: Removed auto-open popup behavior. The tour is now triggered
  // only when the user explicitly clicks "Start Tour" from the notification
  // bell or settings. This prevents the tour from blocking the user's
  // workflow on first visit.

  return { isOpen, hasCompleted, startTour, completeTour };
}
