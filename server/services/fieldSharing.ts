/**
 * Task #46 — Field-Level Sharing Controls Service
 * Granular per-field visibility controls for user profiles and data
 */
import { getDb } from "../db";
import { eq, and } from "drizzle-orm";

export type VisibilityLevel = "private" | "professional" | "management" | "admin" | "public";

export interface FieldSharingRule {
  fieldName: string;
  displayName: string;
  category: "personal" | "financial" | "professional" | "suitability" | "preferences";
  defaultVisibility: VisibilityLevel;
  userOverridable: boolean;
  sensitivityLevel: "low" | "medium" | "high" | "critical";
}

const FIELD_RULES: FieldSharingRule[] = [
  // Personal
  { fieldName: "name", displayName: "Full Name", category: "personal", defaultVisibility: "professional", userOverridable: true, sensitivityLevel: "medium" },
  { fieldName: "email", displayName: "Email Address", category: "personal", defaultVisibility: "professional", userOverridable: true, sensitivityLevel: "high" },
  { fieldName: "age", displayName: "Age", category: "personal", defaultVisibility: "professional", userOverridable: true, sensitivityLevel: "medium" },
  { fieldName: "zipCode", displayName: "ZIP Code", category: "personal", defaultVisibility: "professional", userOverridable: true, sensitivityLevel: "medium" },
  { fieldName: "familySituation", displayName: "Family Situation", category: "personal", defaultVisibility: "professional", userOverridable: true, sensitivityLevel: "medium" },
  // Financial
  { fieldName: "incomeRange", displayName: "Income Range", category: "financial", defaultVisibility: "professional", userOverridable: true, sensitivityLevel: "high" },
  { fieldName: "savingsRange", displayName: "Savings Range", category: "financial", defaultVisibility: "professional", userOverridable: true, sensitivityLevel: "high" },
  { fieldName: "investmentSummary", displayName: "Investment Summary", category: "financial", defaultVisibility: "professional", userOverridable: true, sensitivityLevel: "critical" },
  { fieldName: "insuranceSummary", displayName: "Insurance Summary", category: "financial", defaultVisibility: "professional", userOverridable: true, sensitivityLevel: "high" },
  { fieldName: "estateExposure", displayName: "Estate Exposure", category: "financial", defaultVisibility: "management", userOverridable: true, sensitivityLevel: "critical" },
  // Professional
  { fieldName: "jobTitle", displayName: "Job Title", category: "professional", defaultVisibility: "public", userOverridable: true, sensitivityLevel: "low" },
  { fieldName: "employerName", displayName: "Employer", category: "professional", defaultVisibility: "professional", userOverridable: true, sensitivityLevel: "medium" },
  // Suitability
  { fieldName: "riskTolerance", displayName: "Risk Tolerance", category: "suitability", defaultVisibility: "professional", userOverridable: false, sensitivityLevel: "high" },
  { fieldName: "investmentHorizon", displayName: "Investment Horizon", category: "suitability", defaultVisibility: "professional", userOverridable: false, sensitivityLevel: "medium" },
  { fieldName: "suitabilityScore", displayName: "Suitability Score", category: "suitability", defaultVisibility: "management", userOverridable: false, sensitivityLevel: "high" },
  // Preferences
  { fieldName: "focusPreference", displayName: "Focus Mode", category: "preferences", defaultVisibility: "private", userOverridable: true, sensitivityLevel: "low" },
  { fieldName: "styleProfile", displayName: "Communication Style", category: "preferences", defaultVisibility: "professional", userOverridable: true, sensitivityLevel: "low" },
];

// In-memory user overrides (in production, stored in DB)
const userOverrides = new Map<string, VisibilityLevel>(); // key: `${userId}:${fieldName}`

export function getFieldRules(category?: string): FieldSharingRule[] {
  if (category) return FIELD_RULES.filter(r => r.category === category);
  return [...FIELD_RULES];
}

export function getFieldVisibility(userId: number, fieldName: string): VisibilityLevel {
  const override = userOverrides.get(`${userId}:${fieldName}`);
  if (override) return override;
  const rule = FIELD_RULES.find(r => r.fieldName === fieldName);
  return rule?.defaultVisibility ?? "private";
}

export function setFieldVisibility(userId: number, fieldName: string, visibility: VisibilityLevel): boolean {
  const rule = FIELD_RULES.find(r => r.fieldName === fieldName);
  if (!rule || !rule.userOverridable) return false;
  userOverrides.set(`${userId}:${fieldName}`, visibility);
  return true;
}

export function getUserFieldOverrides(userId: number): Record<string, VisibilityLevel> {
  const overrides: Record<string, VisibilityLevel> = {};
  const prefix = `${userId}:`;
  for (const key of Array.from(userOverrides.keys())) {
    if (key.startsWith(prefix)) {
      overrides[key.replace(prefix, "")] = userOverrides.get(key)!;
    }
  }
  return overrides;
}

const VISIBILITY_HIERARCHY: Record<VisibilityLevel, number> = {
  private: 0, professional: 1, management: 2, admin: 3, public: 4,
};

export function canViewField(viewerRole: string, fieldVisibility: VisibilityLevel): boolean {
  const roleToVisibility: Record<string, VisibilityLevel> = {
    user: "private", advisor: "professional", professional: "professional",
    manager: "management", admin: "admin",
  };
  const viewerLevel = VISIBILITY_HIERARCHY[roleToVisibility[viewerRole] ?? "private"];
  const fieldLevel = VISIBILITY_HIERARCHY[fieldVisibility];
  return viewerLevel >= fieldLevel || fieldVisibility === "public";
}

export function filterFieldsForViewer(data: Record<string, any>, userId: number, viewerRole: string): Record<string, any> {
  const filtered: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const visibility = getFieldVisibility(userId, key);
    if (canViewField(viewerRole, visibility)) {
      filtered[key] = value;
    }
  }
  return filtered;
}
