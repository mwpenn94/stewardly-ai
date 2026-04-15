/**
 * Stripe Products & Pricing Configuration
 *
 * Defines the subscription tiers for WealthBridge AI.
 * Price IDs are set after creating products in Stripe Dashboard.
 * For now, we use dynamic checkout with line_item price_data.
 */

export interface PlanConfig {
  id: string;
  name: string;
  description: string;
  priceMonthly: number; // cents
  priceYearly: number;  // cents
  features: string[];
  limits: {
    clients: number;
    advisors: number;
    aiConversations: number;
    reportsPerMonth: number;
    storageGb: number;
  };
  popular?: boolean;
}

export const PLANS: Record<string, PlanConfig> = {
  starter: {
    id: "starter",
    name: "Starter",
    description: "Perfect for independent advisors getting started with AI-powered wealth management.",
    priceMonthly: 4900,  // $49/mo
    priceYearly: 47000,  // $470/yr (~20% off)
    features: [
      "1 advisor seat",
      "Up to 50 clients",
      "Basic AI chat assistant",
      "5 wealth reports per month",
      "Financial profile management",
      "Basic portfolio tracking",
      "Email support",
    ],
    limits: {
      clients: 50,
      advisors: 1,
      aiConversations: 100,
      reportsPerMonth: 5,
      storageGb: 2,
    },
  },
  professional: {
    id: "professional",
    name: "Professional",
    description: "For growing practices that need the full AI suite and team collaboration.",
    priceMonthly: 14900, // $149/mo
    priceYearly: 143000, // $1,430/yr (~20% off)
    features: [
      "Up to 5 advisor seats",
      "Up to 250 clients",
      "Full AI suite (chat, voice, analysis)",
      "Unlimited wealth reports",
      "CRM sync & lead pipeline",
      "Meeting intelligence",
      "Plaid & brokerage integrations",
      "Priority support",
    ],
    limits: {
      clients: 250,
      advisors: 5,
      aiConversations: 1000,
      reportsPerMonth: -1, // unlimited
      storageGb: 10,
    },
    popular: true,
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    description: "White-label solution for large firms with custom integrations and dedicated support.",
    priceMonthly: 49900, // $499/mo
    priceYearly: 479000, // $4,790/yr (~20% off)
    features: [
      "Unlimited advisor seats",
      "Unlimited clients",
      "White-label branding",
      "Full API access",
      "Custom integrations",
      "Dedicated account manager",
      "SSO & advanced security",
      "Compliance & audit tools",
      "Custom AI model training",
    ],
    limits: {
      clients: -1,
      advisors: -1,
      aiConversations: -1,
      reportsPerMonth: -1,
      storageGb: 100,
    },
  },
};

export const PLAN_ORDER = ["starter", "professional", "enterprise"] as const;

/** Get a plan by ID */
export function getPlan(planId: string): PlanConfig | undefined {
  return PLANS[planId];
}

/** Get the price in cents for a plan + interval */
export function getPlanPrice(planId: string, interval: "month" | "year"): number {
  const plan = PLANS[planId];
  if (!plan) return 0;
  return interval === "year" ? plan.priceYearly : plan.priceMonthly;
}
