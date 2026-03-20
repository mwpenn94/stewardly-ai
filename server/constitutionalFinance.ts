import { getDb } from "./db";
import { constitutionalViolations } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";

// ─── The 12 Constitutional Principles ──────────────────────────
export const CONSTITUTIONAL_PRINCIPLES = [
  { number: 1, text: "Fiduciary First: Every recommendation must prioritize the client's best interest above all else, including advisor compensation." },
  { number: 2, text: "Transparency: All fees, conflicts of interest, and limitations must be disclosed clearly and proactively." },
  { number: 3, text: "Suitability: Recommendations must be appropriate for the client's specific situation, goals, risk tolerance, and time horizon." },
  { number: 4, text: "Education Before Action: Clients should understand what they're doing and why before implementing any strategy." },
  { number: 5, text: "Holistic View: Financial advice must consider the complete picture — tax, estate, insurance, investments, and behavioral factors." },
  { number: 6, text: "Evidence-Based: Strategies should be grounded in empirical research and sound financial theory, not speculation." },
  { number: 7, text: "Cost Consciousness: Lower-cost alternatives should be preferred when they offer comparable outcomes." },
  { number: 8, text: "Behavioral Awareness: Advice must account for known behavioral biases and help clients make rational decisions." },
  { number: 9, text: "Privacy & Security: Client data must be protected with the highest standards and used only for their benefit." },
  { number: 10, text: "Accessibility: Financial guidance should be available regardless of wealth level, with appropriate scope adjustments." },
  { number: 11, text: "Accountability: Every recommendation should have a clear rationale that can be reviewed and audited." },
  { number: 12, text: "Continuous Improvement: The system must learn from outcomes and improve its guidance over time." },
];

// ─── Types ─────────────────────────────────────────────────────
export interface ConstitutionalCheck {
  passed: boolean;
  violations: ViolationDetail[];
  score: number; // 0-100 (constitutional compliance score)
  modifiedResponse?: string;
}

export interface ViolationDetail {
  principleNumber: number;
  principleText: string;
  severity: "low" | "medium" | "high";
  description: string;
  suggestedFix: string;
}

// ─── Rule-Based Checks ────────────────────────────────────────
const PRODUCT_PUSH_PATTERNS = [
  /you (should|must|need to) buy/i,
  /I recommend (purchasing|buying|investing in) (this|the) specific/i,
  /guaranteed returns/i,
  /risk[- ]free investment/i,
  /can't lose/i,
  /act now before/i,
  /limited time offer/i,
  /everyone should own/i,
];

const MISSING_DISCLOSURE_PATTERNS = [
  { pattern: /annuity|insurance product|whole life/i, requiredDisclosure: "insurance products" },
  { pattern: /specific (fund|stock|bond|ETF)/i, requiredDisclosure: "specific investment" },
  { pattern: /tax (strategy|shelter|avoidance)/i, requiredDisclosure: "tax strategy" },
];

const BIAS_PATTERNS = [
  { pattern: /always (invest|buy|sell)/i, bias: "absolute language", principle: 8 },
  { pattern: /market (will|is going to) (crash|boom|skyrocket)/i, bias: "market prediction", principle: 6 },
  { pattern: /you('re| are) (too|not) (old|young|rich|poor)/i, bias: "demographic stereotyping", principle: 3 },
];

export function checkConstitutionalCompliance(
  response: string,
  context?: { hasDisclosures?: boolean; isPersonalized?: boolean; mentionsProducts?: boolean }
): ConstitutionalCheck {
  const violations: ViolationDetail[] = [];

  // Principle 1: Fiduciary — check for product pushing
  for (const pattern of PRODUCT_PUSH_PATTERNS) {
    if (pattern.test(response)) {
      violations.push({
        principleNumber: 1,
        principleText: CONSTITUTIONAL_PRINCIPLES[0].text,
        severity: "high",
        description: "Response contains language that may push specific products without adequate analysis",
        suggestedFix: "Reframe as educational discussion of options with pros/cons for the client's specific situation",
      });
      break;
    }
  }

  // Principle 2: Transparency — check for missing disclosures
  for (const { pattern, requiredDisclosure } of MISSING_DISCLOSURE_PATTERNS) {
    if (pattern.test(response) && !context?.hasDisclosures) {
      violations.push({
        principleNumber: 2,
        principleText: CONSTITUTIONAL_PRINCIPLES[1].text,
        severity: "medium",
        description: `Discussion of ${requiredDisclosure} without appropriate disclosures`,
        suggestedFix: `Add disclosure about limitations, risks, and that this is educational — not a specific recommendation`,
      });
    }
  }

  // Principle 6 & 8: Evidence-based & Behavioral — check for bias patterns
  for (const { pattern, bias, principle } of BIAS_PATTERNS) {
    if (pattern.test(response)) {
      violations.push({
        principleNumber: principle,
        principleText: CONSTITUTIONAL_PRINCIPLES[principle - 1].text,
        severity: "medium",
        description: `Response contains ${bias} language`,
        suggestedFix: "Use probabilistic language and cite evidence rather than making absolute claims",
      });
    }
  }

  // Principle 4: Education Before Action — check if action without explanation
  const actionWords = /you should (immediately|right away|today|now)/i;
  if (actionWords.test(response)) {
    violations.push({
      principleNumber: 4,
      principleText: CONSTITUTIONAL_PRINCIPLES[3].text,
      severity: "medium",
      description: "Response urges immediate action without adequate educational context",
      suggestedFix: "Explain the reasoning and options before suggesting action steps",
    });
  }

  // Principle 7: Cost Consciousness — check if expensive option without alternatives
  const expensiveProducts = /variable annuity|whole life insurance|loaded fund|front[- ]load/i;
  const mentionsAlternatives = /alternative|lower[- ]cost|compare|instead|option/i;
  if (expensiveProducts.test(response) && !mentionsAlternatives.test(response)) {
    violations.push({
      principleNumber: 7,
      principleText: CONSTITUTIONAL_PRINCIPLES[6].text,
      severity: "low",
      description: "Mentions higher-cost product without presenting lower-cost alternatives",
      suggestedFix: "Include comparison with lower-cost alternatives when discussing expensive products",
    });
  }

  const score = Math.max(0, 100 - violations.reduce((sum, v) => {
    return sum + (v.severity === "high" ? 25 : v.severity === "medium" ? 15 : 8);
  }, 0));

  return {
    passed: violations.length === 0,
    violations,
    score,
  };
}

// ─── Auto-Modify Response ──────────────────────────────────────
export function autoModifyResponse(response: string, violations: ViolationDetail[]): string {
  let modified = response;

  // Add educational disclaimer if needed
  const hasHighSeverity = violations.some(v => v.severity === "high");
  if (hasHighSeverity) {
    modified += "\n\n---\n*This information is for educational purposes only and should not be considered personalized financial advice. Please consult with a qualified financial professional before making any financial decisions.*";
  }

  // Add disclosure if missing
  const needsDisclosure = violations.some(v => v.principleNumber === 2);
  if (needsDisclosure) {
    modified += "\n\n*Important: The products and strategies discussed above have risks and limitations that should be carefully considered in the context of your overall financial plan.*";
  }

  return modified;
}

// ─── DB Helpers ────────────────────────────────────────────────
export async function logViolation(messageId: number | null, violation: ViolationDetail) {
  const db = await getDb();
  if (!db) return;
  return db.insert(constitutionalViolations).values({
    messageId: messageId,
    principleNumber: violation.principleNumber,
    principleText: violation.principleText,
    violationDescription: violation.description,
    severity: violation.severity,
  });
}

export async function getViolationHistory(limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(constitutionalViolations)
    .orderBy(desc(constitutionalViolations.createdAt))
    .limit(limit);
}
