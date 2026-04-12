/**
 * Client-side case study registry (Pass 4 — learning experience).
 *
 * Pre-Pass-4 state: `CaseStudySimulator` shipped with a single hardcoded
 * DEMO_CASE and the `/learning/case/:caseId` route ignored the `:caseId`
 * param entirely. Clicking "Case Studies" from the Learning Home tile
 * navigated to a URL that looked like it was track-scoped but always
 * rendered the same estate-planning demo case regardless.
 *
 * This registry fixes G10 with the minimum viable path: a typed,
 * client-side catalog of scenarios keyed by a stable id, looked up
 * by the `CaseStudySimulatorRoute` wrapper. Adding more cases is a
 * single commit — just append to `CASE_STUDY_REGISTRY`. When the
 * server-side `learning_cases` table is eventually wired into a tRPC
 * procedure, this registry becomes a fallback cache.
 *
 * Pure export: `getCaseStudyById(id)` / `listCaseStudies()` — no side
 * effects, straightforward to unit test.
 */

export interface CaseStudyOption {
  key: string;
  text: string;
  consequence: string;
  score: number;
  complianceFlag?: string;
  nextDecisionIndex?: number;
}

export interface CaseStudyDecision {
  prompt: string;
  options: CaseStudyOption[];
  audioScript?: string;
}

export interface CaseStudyData {
  id: string;
  title: string;
  moduleSlug: string;
  clientProfile: string;
  situation: string;
  decisions: CaseStudyDecision[];
  audioIntro?: string;
  /** Optional human-readable discipline label for the tile subtitle. */
  discipline?: string;
  /** Difficulty — surfaced in the picker UI. */
  difficulty?: "beginner" | "intermediate" | "advanced";
}

// ─── Registry ─────────────────────────────────────────────────────────────

export const CASE_STUDY_REGISTRY: CaseStudyData[] = [
  {
    id: "estate-hnw",
    title: "High Net Worth Estate Plan",
    moduleSlug: "estate-planning",
    discipline: "Estate Planning",
    difficulty: "advanced",
    clientProfile:
      "A 62-year-old business owner with $8M in assets, married, 3 adult children.",
    situation:
      "The client wants to minimize estate taxes while ensuring equitable distribution among children, one of whom works in the family business.",
    decisions: [
      {
        prompt:
          "The client asks about transferring the business to the child who works there. What's your first recommendation?",
        options: [
          {
            key: "A",
            text: "Recommend an immediate full transfer via gift",
            consequence:
              "A full gift transfer could trigger significant gift tax liability and remove the client's control prematurely.",
            score: 3,
            complianceFlag: "Suitability concern: gift tax implications not fully disclosed",
          },
          {
            key: "B",
            text: "Suggest a buy-sell agreement with installment payments",
            consequence:
              "A buy-sell agreement provides a structured transition with fair market value documentation, useful for estate planning purposes.",
            score: 8,
            nextDecisionIndex: 1,
          },
          {
            key: "C",
            text: "Propose a family limited partnership (FLP)",
            consequence:
              "An FLP can provide valuation discounts and gradual transfer of ownership while retaining management control.",
            score: 9,
            nextDecisionIndex: 1,
          },
          {
            key: "D",
            text: "Recommend doing nothing until retirement",
            consequence:
              "Delaying planning could result in higher estate tax exposure and missed discount opportunities.",
            score: 2,
          },
        ],
      },
      {
        prompt:
          "The client is interested in your recommendation. They also want to ensure the other two children receive equitable value. How do you address this?",
        options: [
          {
            key: "A",
            text: "Recommend equal ownership splits across all three children",
            consequence:
              "Equal splits regardless of involvement can lead to conflicts and doesn't account for the working child's sweat equity.",
            score: 4,
          },
          {
            key: "B",
            text: "Use life insurance to equalize for non-business children",
            consequence:
              "An ILIT with sufficient coverage can provide equitable value to the non-business children without fragmenting business ownership.",
            score: 9,
          },
          {
            key: "C",
            text: "Suggest the business child buy out siblings over time",
            consequence:
              "This works but may strain the business with debt obligations and doesn't provide immediate security for the other children.",
            score: 6,
          },
        ],
      },
    ],
  },
  {
    id: "retirement-gap",
    title: "Retirement Income Gap",
    moduleSlug: "financial-planning",
    discipline: "Financial Planning",
    difficulty: "intermediate",
    clientProfile:
      "A 58-year-old dual-income couple, $850K saved, planning to retire at 65. They have a projected $400K shortfall.",
    situation:
      "The couple wants to know how to close the gap without extending their working years. They are risk-averse but also concerned about running out of money in their 80s.",
    decisions: [
      {
        prompt:
          "What's the first question you should ask before recommending any specific product?",
        options: [
          {
            key: "A",
            text: "What's your risk tolerance?",
            consequence:
              "Risk tolerance matters but is secondary to understanding their full income needs and legacy goals.",
            score: 5,
            nextDecisionIndex: 1,
          },
          {
            key: "B",
            text: "What are your essential vs discretionary expenses in retirement?",
            consequence:
              "Splitting essential from discretionary lets you match guaranteed income to non-negotiable costs — the foundation of a bucket strategy.",
            score: 9,
            nextDecisionIndex: 1,
          },
          {
            key: "C",
            text: "How much can you save per month between now and retirement?",
            consequence:
              "This is important but skips the needs-first analysis. You may end up over- or under-saving.",
            score: 4,
          },
          {
            key: "D",
            text: "When do you want to claim Social Security?",
            consequence:
              "Social Security timing matters but it's an output, not an input, to the plan.",
            score: 5,
          },
        ],
      },
      {
        prompt:
          "Given their risk aversion and the $400K shortfall, which approach is most defensible?",
        options: [
          {
            key: "A",
            text: "Shift entirely into fixed annuities for guaranteed income",
            consequence:
              "Total annuitization limits liquidity and can't keep up with inflation over 25+ years of retirement.",
            score: 4,
            complianceFlag: "Suitability: illiquidity + single-product concentration",
          },
          {
            key: "B",
            text: "Layer a SPIA + MYGA ladder under essentials, keep equities for discretionary + legacy",
            consequence:
              "Guaranteed coverage of essentials + growth for discretionary is a classic income bucket approach — matches their needs-first mindset.",
            score: 9,
          },
          {
            key: "C",
            text: "Increase equity exposure to try to beat the shortfall",
            consequence:
              "Piling on equity risk contradicts their stated risk tolerance and can fail catastrophically close to retirement.",
            score: 3,
            complianceFlag: "Suitability: risk beyond stated tolerance",
          },
          {
            key: "D",
            text: "Recommend they delay retirement to 67",
            consequence:
              "Delaying solves the math but not the request — the client asked how to close the gap WITHOUT working longer.",
            score: 5,
          },
        ],
      },
    ],
  },
  {
    id: "premium-finance-life",
    title: "Premium Financing for Life Insurance",
    moduleSlug: "life-insurance",
    discipline: "Life & Health Insurance",
    difficulty: "advanced",
    clientProfile:
      "A 55-year-old business owner with $15M net worth. Wants a $10M permanent life insurance policy for estate liquidity and wealth transfer.",
    situation:
      "The client's CPA recommended premium financing. Rates have moved and the original illustration may no longer hold. You need to recommend a path forward.",
    decisions: [
      {
        prompt:
          "The original illustration used SOFR + 2% at 4.5% total. Current SOFR + 2% is 7.1%. What's the right first step?",
        options: [
          {
            key: "A",
            text: "Proceed with the original plan — the illustration is still directionally correct",
            consequence:
              "A 260 bp rate move materially changes the exit strategy. Proceeding as-is exposes the client to a cash-call they didn't plan for.",
            score: 2,
            complianceFlag: "Suitability: material rate change not disclosed",
          },
          {
            key: "B",
            text: "Re-run the illustration with current rates and show the client the updated loan balance trajectory",
            consequence:
              "Updated projections let the client make an informed decision. This is the fiduciary path.",
            score: 9,
            nextDecisionIndex: 1,
          },
          {
            key: "C",
            text: "Cancel the policy and recommend a paid-up alternative",
            consequence:
              "Too reactive. The client can still benefit from premium financing, just with an adjusted exit strategy.",
            score: 4,
          },
        ],
      },
      {
        prompt:
          "The updated illustration shows the loan balance now exceeds the cash value for longer. How do you structure the exit?",
        options: [
          {
            key: "A",
            text: "Add an additional collateral assignment from the client's liquid investment account",
            consequence:
              "Supplemental collateral protects against the crossover risk and is standard practice in high-rate environments.",
            score: 9,
          },
          {
            key: "B",
            text: "Switch to a shorter-pay funding structure (e.g., 7-pay) and self-fund premiums",
            consequence:
              "Self-funding removes the loan risk entirely but forfeits the cash efficiency advantage of premium financing.",
            score: 7,
          },
          {
            key: "C",
            text: "Accept the crossover risk — rates will normalize",
            consequence:
              "Banking on rate normalization is speculation, not planning.",
            score: 3,
            complianceFlag: "Fiduciary concern: speculative rate assumption",
          },
        ],
      },
    ],
  },
];

// ─── Pure lookups ─────────────────────────────────────────────────────────

/**
 * Pure: look up a case study by id. Returns the case study if found,
 * null otherwise. The caller is responsible for picking a fallback.
 */
export function getCaseStudyById(id: string | undefined | null): CaseStudyData | null {
  if (typeof id !== "string" || id.length === 0) return null;
  const lower = id.toLowerCase();
  return CASE_STUDY_REGISTRY.find((c) => c.id.toLowerCase() === lower) ?? null;
}

/**
 * Pure: return a shallow clone of the registry so callers can sort /
 * filter without mutating the source of truth.
 */
export function listCaseStudies(): CaseStudyData[] {
  return CASE_STUDY_REGISTRY.slice();
}

/**
 * Pure: return the first case study whose moduleSlug contains the
 * given track slug (case-insensitive). Used by the LearningHome tile
 * to pick a sensible default when a user clicks "Case Studies"
 * without selecting a specific scenario.
 */
export function pickDefaultForTrackSlug(trackSlug: string | undefined | null): CaseStudyData {
  if (typeof trackSlug === "string" && trackSlug.length > 0) {
    const lower = trackSlug.toLowerCase();
    const match = CASE_STUDY_REGISTRY.find(
      (c) => c.moduleSlug.toLowerCase().includes(lower) || lower.includes(c.moduleSlug.toLowerCase()),
    );
    if (match) return match;
  }
  // Fallback to the first registered case — guaranteed to exist because
  // the registry is a compile-time constant with non-zero length.
  return CASE_STUDY_REGISTRY[0];
}
