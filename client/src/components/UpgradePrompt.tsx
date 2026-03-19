import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { ArrowRight, Lock, Sparkles, Save, Shield } from "lucide-react";

interface UpgradePromptProps {
  /** Which tier to suggest upgrading to */
  targetTier: "email" | "full" | "advisor";
  /** Current conversation count */
  conversationCount?: number;
  /** Current message count */
  messageCount?: number;
  /** Compact mode (inline banner vs full card) */
  compact?: boolean;
  /** Optional affiliate org slug */
  affiliateSlug?: string;
}

const TIER_BENEFITS = {
  email: {
    title: "Save your progress",
    subtitle: "Create a free account to keep your conversations and preferences",
    benefits: [
      { icon: <Save className="w-4 h-4" />, text: "Save conversation history" },
      { icon: <Sparkles className="w-4 h-4" />, text: "Personalized AI responses" },
      { icon: <Shield className="w-4 h-4" />, text: "Upload documents for context" },
    ],
    cta: "Sign up free",
  },
  full: {
    title: "Unlock your full AI twin",
    subtitle: "Get the complete experience with all features",
    benefits: [
      { icon: <Sparkles className="w-4 h-4" />, text: "Full AI personalization" },
      { icon: <Shield className="w-4 h-4" />, text: "Financial planning tools" },
      { icon: <Lock className="w-4 h-4" />, text: "Secure document vault" },
    ],
    cta: "Create full account",
  },
  advisor: {
    title: "Connect with a professional",
    subtitle: "Get matched with a financial advisor for personalized guidance",
    benefits: [
      { icon: <Sparkles className="w-4 h-4" />, text: "Professional financial advice" },
      { icon: <Shield className="w-4 h-4" />, text: "Compliance-grade records" },
      { icon: <Lock className="w-4 h-4" />, text: "Shared advisor dashboard" },
    ],
    cta: "Find an advisor",
  },
};

export function UpgradePrompt({
  targetTier,
  conversationCount,
  messageCount,
  compact = false,
  affiliateSlug,
}: UpgradePromptProps) {
  const tier = TIER_BENEFITS[targetTier];
  const loginUrl = getLoginUrl();

  if (compact) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-accent/5 border border-accent/20 rounded-xl">
        <Sparkles className="w-4 h-4 text-accent shrink-0" />
        <p className="text-sm text-muted-foreground flex-1">
          {messageCount && messageCount >= 3
            ? "Want to save your progress? "
            : ""}
          {tier.subtitle}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 border-accent/30 text-accent hover:bg-accent/10"
          onClick={() => (window.location.href = loginUrl)}
        >
          {tier.cta}
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-card border border-border rounded-2xl shadow-lg">
      <div className="text-center mb-4">
        <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3">
          <Sparkles className="w-6 h-6 text-accent" />
        </div>
        <h3 className="text-lg font-semibold">{tier.title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{tier.subtitle}</p>
      </div>

      <div className="space-y-3 mb-6">
        {tier.benefits.map((b, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <div className="text-accent">{b.icon}</div>
            <span>{b.text}</span>
          </div>
        ))}
      </div>

      {conversationCount != null && (
        <p className="text-xs text-muted-foreground text-center mb-4">
          You've used {conversationCount} of 5 free conversations
        </p>
      )}

      <Button
        className="w-full"
        onClick={() => (window.location.href = loginUrl)}
      >
        {tier.cta}
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>

      <p className="text-[10px] text-muted-foreground text-center mt-3">
        Free to sign up. No credit card required.
      </p>
    </div>
  );
}
