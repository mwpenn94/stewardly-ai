/**
 * 6-Dimension Recruit Scoring Engine
 * ====================================
 * GAP-02: Implements PROMPT 1 from claude_api_prompt_library.md
 * 
 * Dimensions (weighted composite):
 *   1. Production Fit (20%) — match to WealthBridge production model
 *   2. Cultural Fit (15%) — alignment with stewardship-informed philosophy
 *   3. Geographic Fit (10%) — proximity to target geographies
 *   4. Network Leverage (20%) — cascade potential to colleagues
 *   5. Compliance Posture (20%) — clean FINRA BrokerCheck record
 *   6. Engagement Signal (15%) — outreach engagement quality
 * 
 * Tier assignment: ≥80 = Tier 1; 65-79 = Tier 2; 50-64 = Tier 3; <50 = Hold
 */
import { invokeLLM } from "../_core/llm";
import { logger } from "../_core/logger";
const log = logger.child({ module: "recruitScoring" });

// ─── Types ───────────────────────────────────────────────────────────────

export interface RecruitDimensionScore {
  score: number; // 0-100
  rationale: string;
}

export interface RecruitScoringResult {
  candidateName: string;
  scores: {
    productionFit: RecruitDimensionScore;
    culturalFit: RecruitDimensionScore;
    geographicFit: RecruitDimensionScore;
    networkLeverage: RecruitDimensionScore;
    compliancePosture: RecruitDimensionScore;
    engagementSignal: RecruitDimensionScore;
  };
  compositeScore: number; // 0-100
  tier: "Tier 1" | "Tier 2" | "Tier 3" | "Hold";
  cascadePotential: {
    estimatedColleaguesUnlockable: number;
    rationale: string;
  };
  priorityActions: string[];
}

export interface RecruitCandidateData {
  candidateName: string;
  candidateCurrentFirm?: string;
  candidateCredentials?: string; // "CFP, RICP, CRPC, CFA, etc."
  candidateGeography?: string; // "city, state"
  candidateLinkedinData?: string; // recent posts, network composition
  candidateBrokercheckData?: string; // CRD, disclosures, employment history
  candidateEngagementHistory?: string; // prior touches, replies, meetings
  candidateReferralSource?: string; // cold outbound, network cascade, COI referral, inbound
}

// ─── Constants ───────────────────────────────────────────────────────────

export const DIMENSION_WEIGHTS = {
  productionFit: 0.20,
  culturalFit: 0.15,
  geographicFit: 0.10,
  networkLeverage: 0.20,
  compliancePosture: 0.20,
  engagementSignal: 0.15,
} as const;

export const TIER_THRESHOLDS = {
  tier1: 80,
  tier2: 65,
  tier3: 50,
} as const;

// ─── Scoring Prompt ──────────────────────────────────────────────────────

const RECRUIT_SCORING_PROMPT = `You are scoring a recruit candidate for WealthBridge Financial Group's Arizona Region 1 practice. Mike Penn is the Managing Director. The practice operates Pattern 4 from the v10 Lead Sourcing Compendium ($1,050-$1,200/mo stack). Geographic focus: Pima, Mohave, Santa Cruz counties in Arizona, expanding to New Mexico. Cultural orientation: faith-informed stewardship principles.

Score the following candidate across six dimensions (0-100 each):

1. PRODUCTION FIT (weight 20%): Match to WealthBridge production model and product mix. Consider: years of FS production experience, current AUM under management, product mix (insurance vs securities vs advisory), client demographics.

2. CULTURAL FIT (weight 15%): Alignment with stewardship-informed operating philosophy. Consider: stated values, charitable activities, faith-aligned credentials (e.g., Kingdom Advisors), public communications tone.

3. GEOGRAPHIC FIT (weight 10%): Consider: current location, willingness to relocate or operate remotely, existing network in target geographies (Pima, Mohave, Santa Cruz, NM Albuquerque, NM Santa Fe).

4. NETWORK LEVERAGE (weight 20%): Cascade potential to colleagues at current firm. Consider: tenure at current firm, peer relationships visible in LinkedIn network, mutual connections at WealthBridge.

5. COMPLIANCE POSTURE (weight 20%): Clean FINRA BrokerCheck record. Consider: any U4 disclosures, customer complaints, regulatory actions, employment history irregularities, current state licensing status.

6. ENGAGEMENT SIGNAL (weight 15%): Recent outreach engagement quality. Consider: time-to-response, depth of replies, expressed interest indicators, referral source quality.

Composite = (production_fit × 0.20) + (cultural_fit × 0.15) + (geographic_fit × 0.10) + (network_leverage × 0.20) + (compliance_posture × 0.20) + (engagement_signal × 0.15)

Tier assignment: ≥80 = Tier 1; 65-79 = Tier 2; 50-64 = Tier 3; <50 = Hold.

For cascade potential: identify how many colleagues at the candidate's current firm could be unlocked through warm introduction if this candidate signs. Reference: Amadori → 24 NWM AZ colleagues; Krasne → 10 NYL Tucson; Justice → 8+ NM conversions.

For priority actions: list the top 3 next steps for this candidate (e.g., "Send Touch 1 of cadence A," "Verify BrokerCheck disclosure flagged for personal review," "Coordinate stewardship-aligned conversation").

CANDIDATE DATA:
{candidate_data}

Respond ONLY with valid JSON matching this schema:
{
  "candidate_name": "string",
  "scores": {
    "production_fit": {"score": 0-100, "rationale": "string"},
    "cultural_fit": {"score": 0-100, "rationale": "string"},
    "geographic_fit": {"score": 0-100, "rationale": "string"},
    "network_leverage": {"score": 0-100, "rationale": "string"},
    "compliance_posture": {"score": 0-100, "rationale": "string"},
    "engagement_signal": {"score": 0-100, "rationale": "string"}
  },
  "composite_score": 0-100,
  "tier": "Tier 1 | Tier 2 | Tier 3 | Hold",
  "cascade_potential": {
    "estimated_colleagues_unlockable": integer,
    "rationale": "string"
  },
  "priority_actions": ["string", "string", "string"]
}`;

// ─── Scoring Functions ───────────────────────────────────────────────────

/**
 * Calculate composite score from individual dimension scores.
 * Pure function — no LLM needed.
 */
export function calculateComposite(scores: {
  productionFit: number;
  culturalFit: number;
  geographicFit: number;
  networkLeverage: number;
  compliancePosture: number;
  engagementSignal: number;
}): number {
  return Math.round(
    scores.productionFit * DIMENSION_WEIGHTS.productionFit +
    scores.culturalFit * DIMENSION_WEIGHTS.culturalFit +
    scores.geographicFit * DIMENSION_WEIGHTS.geographicFit +
    scores.networkLeverage * DIMENSION_WEIGHTS.networkLeverage +
    scores.compliancePosture * DIMENSION_WEIGHTS.compliancePosture +
    scores.engagementSignal * DIMENSION_WEIGHTS.engagementSignal
  );
}

/**
 * Assign tier based on composite score.
 */
export function assignTier(compositeScore: number): "Tier 1" | "Tier 2" | "Tier 3" | "Hold" {
  if (compositeScore >= TIER_THRESHOLDS.tier1) return "Tier 1";
  if (compositeScore >= TIER_THRESHOLDS.tier2) return "Tier 2";
  if (compositeScore >= TIER_THRESHOLDS.tier3) return "Tier 3";
  return "Hold";
}

/**
 * Score a recruit candidate using LLM (PROMPT 1 from claude_api_prompt_library.md).
 * Falls back to manual scoring if LLM is unavailable.
 */
export async function scoreRecruitCandidate(
  candidate: RecruitCandidateData
): Promise<RecruitScoringResult> {
  const candidateDataStr = JSON.stringify(candidate, null, 2);
  const prompt = RECRUIT_SCORING_PROMPT.replace("{candidate_data}", candidateDataStr);

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a recruit scoring engine. Output ONLY valid JSON. No preamble, no commentary." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "recruit_scoring",
          strict: true,
          schema: {
            type: "object",
            properties: {
              candidate_name: { type: "string" },
              scores: {
                type: "object",
                properties: {
                  production_fit: { type: "object", properties: { score: { type: "number" }, rationale: { type: "string" } }, required: ["score", "rationale"], additionalProperties: false },
                  cultural_fit: { type: "object", properties: { score: { type: "number" }, rationale: { type: "string" } }, required: ["score", "rationale"], additionalProperties: false },
                  geographic_fit: { type: "object", properties: { score: { type: "number" }, rationale: { type: "string" } }, required: ["score", "rationale"], additionalProperties: false },
                  network_leverage: { type: "object", properties: { score: { type: "number" }, rationale: { type: "string" } }, required: ["score", "rationale"], additionalProperties: false },
                  compliance_posture: { type: "object", properties: { score: { type: "number" }, rationale: { type: "string" } }, required: ["score", "rationale"], additionalProperties: false },
                  engagement_signal: { type: "object", properties: { score: { type: "number" }, rationale: { type: "string" } }, required: ["score", "rationale"], additionalProperties: false },
                },
                required: ["production_fit", "cultural_fit", "geographic_fit", "network_leverage", "compliance_posture", "engagement_signal"],
                additionalProperties: false,
              },
              composite_score: { type: "number" },
              tier: { type: "string" },
              cascade_potential: {
                type: "object",
                properties: {
                  estimated_colleagues_unlockable: { type: "number" },
                  rationale: { type: "string" },
                },
                required: ["estimated_colleagues_unlockable", "rationale"],
                additionalProperties: false,
              },
              priority_actions: { type: "array", items: { type: "string" } },
            },
            required: ["candidate_name", "scores", "composite_score", "tier", "cascade_potential", "priority_actions"],
            additionalProperties: false,
          },
        },
      },
    });

    const raw = JSON.parse(response.choices[0].message.content || "{}");

    // Normalize to camelCase
    const result: RecruitScoringResult = {
      candidateName: raw.candidate_name,
      scores: {
        productionFit: raw.scores.production_fit,
        culturalFit: raw.scores.cultural_fit,
        geographicFit: raw.scores.geographic_fit,
        networkLeverage: raw.scores.network_leverage,
        compliancePosture: raw.scores.compliance_posture,
        engagementSignal: raw.scores.engagement_signal,
      },
      compositeScore: raw.composite_score,
      tier: raw.tier as RecruitScoringResult["tier"],
      cascadePotential: {
        estimatedColleaguesUnlockable: raw.cascade_potential.estimated_colleagues_unlockable,
        rationale: raw.cascade_potential.rationale,
      },
      priorityActions: raw.priority_actions,
    };

    // Validate composite calculation matches
    const recalculated = calculateComposite({
      productionFit: result.scores.productionFit.score,
      culturalFit: result.scores.culturalFit.score,
      geographicFit: result.scores.geographicFit.score,
      networkLeverage: result.scores.networkLeverage.score,
      compliancePosture: result.scores.compliancePosture.score,
      engagementSignal: result.scores.engagementSignal.score,
    });

    // Use recalculated if LLM's composite is off by more than 2 points
    if (Math.abs(recalculated - result.compositeScore) > 2) {
      log.warn("LLM composite %d differs from calculated %d — using calculated", result.compositeScore, recalculated);
      result.compositeScore = recalculated;
      result.tier = assignTier(recalculated);
    }

    log.info("Scored recruit %s: composite=%d tier=%s", result.candidateName, result.compositeScore, result.tier);
    return result;
  } catch (err) {
    log.error("LLM scoring failed for %s: %s", candidate.candidateName, err);
    throw new Error(`Recruit scoring failed: ${err}`);
  }
}

/**
 * Batch score multiple candidates (for weekly re-scoring).
 */
export async function batchScoreRecruit(
  candidates: RecruitCandidateData[]
): Promise<RecruitScoringResult[]> {
  const results: RecruitScoringResult[] = [];
  for (const candidate of candidates) {
    try {
      const result = await scoreRecruitCandidate(candidate);
      results.push(result);
    } catch (err) {
      log.error("Batch scoring failed for %s: %s", candidate.candidateName, err);
    }
  }
  return results;
}
