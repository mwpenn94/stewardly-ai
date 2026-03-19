/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

// ─── APP-SPECIFIC TYPES ──────────────────────────────────────────

// User roles — 4-tier access system
export type UserRole = "user" | "advisor" | "manager" | "admin";

// Advisory modes
export type AdvisoryMode = "client" | "coach" | "manager";

// Focus modes — controls AI expertise emphasis
export type FocusMode = "general" | "financial" | "both";

// Chat message for frontend
export type ChatMessage = {
  id?: number;
  role: "user" | "assistant" | "system";
  content: string;
  confidenceScore?: number | null;
  complianceStatus?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: Date;
};

// Suitability questionnaire data
export type SuitabilityData = {
  riskTolerance: "conservative" | "moderate" | "aggressive";
  investmentHorizon: string;
  annualIncome: string;
  netWorth: string;
  investmentExperience: "none" | "limited" | "moderate" | "extensive";
  financialGoals: string[];
  insuranceNeeds: string[];
};

// Role-based mode access mapping
export const ROLE_MODE_ACCESS: Record<UserRole, AdvisoryMode[]> = {
  user: [],  // general users see no advisory modes, just focus toggle
  advisor: ["client", "coach"],
  manager: ["client", "coach", "manager"],
  admin: ["client", "coach", "manager"],
};
