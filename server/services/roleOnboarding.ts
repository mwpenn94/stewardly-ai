/**
 * Task #32 — Role-Adaptive Onboarding Service
 * Separate onboarding paths for advisors, clients, and admins with
 * step tracking, skip-basics for experienced users, and progress persistence.
 */
import { getDb } from "../db";
import { onboardingProgress } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

type OnboardingPath = "advisor" | "client" | "admin";

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  required: boolean;
}

const ONBOARDING_PATHS: Record<OnboardingPath, OnboardingStep[]> = {
  advisor: [
    { id: 1, title: "Welcome & Profile Setup", description: "Set up your professional profile, credentials, and firm details", required: true },
    { id: 2, title: "Client Management", description: "Learn how to add clients, manage portfolios, and use the dashboard", required: true },
    { id: 3, title: "AI Assistant Training", description: "Configure AI behavior, set compliance guardrails, and customize prompts", required: true },
    { id: 4, title: "Compliance & Reporting", description: "Set up audit trails, compliance rules, and reporting templates", required: true },
    { id: 5, title: "Integrations & Data", description: "Connect CRM, custodian feeds, and financial data sources", required: false },
    { id: 6, title: "Advanced Features", description: "Explore what-if scenarios, backtesting, and multi-model AI", required: false },
  ],
  client: [
    { id: 1, title: "Welcome & Goals", description: "Tell us about your financial goals and risk tolerance", required: true },
    { id: 2, title: "Link Accounts", description: "Connect your bank accounts and investment portfolios", required: false },
    { id: 3, title: "Meet Your AI Assistant", description: "Learn how to chat with your financial AI and what it can help with", required: true },
    { id: 4, title: "Privacy & Controls", description: "Set your data sharing preferences and AI boundaries", required: true },
    { id: 5, title: "Explore Tools", description: "Try calculators, scenario planning, and financial health checks", required: false },
  ],
  admin: [
    { id: 1, title: "Platform Overview", description: "Understand the system architecture and admin capabilities", required: true },
    { id: 2, title: "User Management", description: "Manage users, roles, permissions, and access policies", required: true },
    { id: 3, title: "Compliance Configuration", description: "Set up compliance rules, audit policies, and regulatory monitoring", required: true },
    { id: 4, title: "AI Model Management", description: "Configure AI models, prompt experiments, and constitutional AI rules", required: true },
    { id: 5, title: "Infrastructure & Security", description: "Review encryption, key rotation, retention policies, and deployment", required: true },
  ],
};

// ─── Initialize Onboarding ───────────────────────────────────────────────
export async function initializeOnboarding(userId: number, path: OnboardingPath, skipBasics = false): Promise<{
  steps: OnboardingStep[];
  currentStep: number;
  totalSteps: number;
}> {
  const db = (await getDb())!;
  const steps = ONBOARDING_PATHS[path];

  // Check for existing progress
  const [existing] = await db.select().from(onboardingProgress)
    .where(and(eq(onboardingProgress.userId, userId), eq(onboardingProgress.path, path))).limit(1);

  if (existing) {
    return {
      steps,
      currentStep: existing.currentStep ?? 0,
      totalSteps: steps.length,
    };
  }

  const startStep = skipBasics ? Math.min(2, steps.length - 1) : 0;
  await db.insert(onboardingProgress).values({
    userId,
    path,
    currentStep: startStep,
    totalSteps: steps.length,
    completedSteps: [],
    skippedBasics: skipBasics,
  });

  return { steps, currentStep: startStep, totalSteps: steps.length };
}

// ─── Complete Step ───────────────────────────────────────────────────────
export async function completeStep(userId: number, path: OnboardingPath, stepId: number): Promise<{
  nextStep: number | null;
  completed: boolean;
}> {
  const db = (await getDb())!;
  const [progress] = await db.select().from(onboardingProgress)
    .where(and(eq(onboardingProgress.userId, userId), eq(onboardingProgress.path, path))).limit(1);

  if (!progress) throw new Error("Onboarding not initialized");

  const completedSteps = [...((progress.completedSteps as number[]) ?? []), stepId];
  const steps = ONBOARDING_PATHS[path];
  const nextStep = steps.find(s => !completedSteps.includes(s.id) && s.required);

  const isComplete = steps.filter(s => s.required).every(s => completedSteps.includes(s.id));

  await db.update(onboardingProgress).set({
    completedSteps,
    currentStep: nextStep?.id ?? (progress.currentStep ?? 0),
    completedAt: isComplete ? new Date() : undefined,
  }).where(eq(onboardingProgress.id, progress.id));

  return {
    nextStep: nextStep?.id ?? null,
    completed: isComplete,
  };
}

// ─── Query Helpers ───────────────────────────────────────────────────────
export async function getOnboardingProgress(userId: number, path?: OnboardingPath) {
  const db = (await getDb())!;
  const conditions = [eq(onboardingProgress.userId, userId)];
  if (path) conditions.push(eq(onboardingProgress.path, path));
  return db.select().from(onboardingProgress).where(and(...conditions));
}

export function getOnboardingSteps(path: OnboardingPath) {
  return ONBOARDING_PATHS[path];
}
