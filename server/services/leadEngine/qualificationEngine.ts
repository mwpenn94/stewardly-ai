/**
 * Qualification Engine — Score leads for sales readiness
 * Score = (required×0.4) + (valuable×0.35) + (premium×0.25)
 * Qualify when score≥0.7 AND propensity≥0.5
 */

const REQUIRED_FIELDS = ["email", "firstName", "state"];
const VALUABLE_FIELDS = ["age", "income", "primaryInterest"];
const PREMIUM_FIELDS = ["assets", "homeownership", "businessOwner"];

export interface QualificationResult {
  score: number;
  qualified: boolean;
  missingRequired: string[];
  missingValuable: string[];
  missingPremium: string[];
}

export function qualifyLead(
  profile: Record<string, unknown>,
  propensityScore: number,
): QualificationResult {
  const requiredFilled = REQUIRED_FIELDS.filter(f => profile[f] != null && profile[f] !== "").length;
  const valuableFilled = VALUABLE_FIELDS.filter(f => profile[f] != null && profile[f] !== "").length;
  const premiumFilled = PREMIUM_FIELDS.filter(f => profile[f] != null && profile[f] !== "").length;

  const score =
    (requiredFilled / REQUIRED_FIELDS.length) * 0.4 +
    (valuableFilled / VALUABLE_FIELDS.length) * 0.35 +
    (premiumFilled / PREMIUM_FIELDS.length) * 0.25;

  const qualified = score >= 0.7 && propensityScore >= 0.5;

  return {
    score: Math.round(score * 100) / 100,
    qualified,
    missingRequired: REQUIRED_FIELDS.filter(f => !profile[f]),
    missingValuable: VALUABLE_FIELDS.filter(f => !profile[f]),
    missingPremium: PREMIUM_FIELDS.filter(f => !profile[f]),
  };
}
