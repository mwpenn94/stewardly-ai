/**
 * HNW Narrative Scoring Engine
 * =============================
 * GAP-03: Implements PROMPT 2 from claude_api_prompt_library.md
 * 
 * Evaluates HNW prospects on 3 dimensions:
 *   1. Wealth Signal Strength (Strong/Moderate/Weak)
 *   2. Fit with HNW Funnel (High/Medium/Low)
 *   3. Engagement Difficulty Estimate (Low/Medium/High)
 * 
 * Outputs: recommended cadence, personalization inputs, compliance flags
 */
import { invokeLLM } from "../_core/llm";
import { logger } from "../_core/logger";
const log = logger.child({ module: "hnwNarrativeScoring" });

// ─── Types ───────────────────────────────────────────────────────────────

export type WealthSignalStrength = "Strong" | "Moderate" | "Weak";
export type FunnelFit = "High" | "Medium" | "Low";
export type EngagementDifficulty = "Low" | "Medium" | "High";

export interface NarrativeScore {
  wealthSignalStrength: WealthSignalStrength;
  fitWithHnwFunnel: FunnelFit;
  engagementDifficultyEstimate: EngagementDifficulty;
  summaryParagraph: string;
}

export interface PersonalizationInputs {
  specificObservation: string;
  valuePieceRecommendation: string;
  peerCompanyRecommendation: string;
  specificValueProposition: string;
}

export interface HnwScoringResult {
  prospectName: string;
  narrativeScore: NarrativeScore;
  recommendedCadence: string;
  personalizationInputs: PersonalizationInputs;
  complianceFlags: string[];
}

export interface HnwProspectData {
  prospectName: string;
  prospectCompany?: string;
  prospectRole?: string;
  prospectGeography?: string; // city, state
  wealthSignal?: string; // what surfaced this prospect (property purchase, business sale, etc.)
  linkedinData?: string;
  publicRecords?: string;
  mutualConnections?: string;
  priorOutreach?: string;
}

// ─── Scoring Prompt ──────────────────────────────────────────────────────

const HNW_NARRATIVE_PROMPT = `You are evaluating a high-net-worth prospect for WealthBridge Financial Group's Arizona Region 1 practice. Mike Penn is the Managing Director. Geographic focus: Pima, Mohave, Santa Cruz counties in Arizona, expanding to New Mexico (Albuquerque, Santa Fe, Las Cruces). Pattern 4 stack operates ESI-pre-approved cadences.

Evaluate the following prospect on three dimensions:

1. WEALTH SIGNAL STRENGTH: How strong is the wealth signal that surfaced this prospect? Strong = clear high-net-worth indicator (e.g., $1M+ property purchase, $5M+ business sale, $10M+ insider transaction). Moderate = above-average wealth indicator. Weak = ambiguous signal.

2. FIT WITH HNW FUNNEL: How well does this prospect fit the WealthBridge HNW client profile? High = clear fit (HNW individual, business owner, executive, retiree with significant assets). Medium = possible fit. Low = unlikely fit.

3. ENGAGEMENT DIFFICULTY ESTIMATE: How hard will it be to engage this prospect in conversation? Low = warm introduction available, COI connection, or strong personalization hook. Medium = standard cold outreach difficulty. High = no warm path, no obvious personalization, busy senior executive.

For RECOMMENDED CADENCE: choose the appropriate cadence from:
- HNW_PROSPECT_12TOUCH_v1: standard 12-touch over 120 days for AZ-based prospects
- HNW_PROSPECT_NM_12TOUCH_v1: 12-touch with NM-specific compliance language for NM-based prospects
- DORMANT_REENGAGEMENT_v1: 3-touch over 30 days for prospects with prior contact >90 days ago

For PERSONALIZATION INPUTS: provide specific values that the cadence drafting prompt will use to fill in {{variables}} in the cadence touches.

For COMPLIANCE FLAGS: flag any prospect-specific compliance considerations.

PROSPECT DATA:
{prospect_data}

Respond ONLY with valid JSON matching this schema:
{
  "prospect_name": "string",
  "narrative_score": {
    "wealth_signal_strength": "Strong | Moderate | Weak",
    "fit_with_HNW_funnel": "High | Medium | Low",
    "engagement_difficulty_estimate": "Low | Medium | High",
    "summary_paragraph": "string"
  },
  "recommended_cadence": "string",
  "personalization_inputs": {
    "specific_observation": "string",
    "value_piece_recommendation": "string",
    "peer_company_recommendation": "string",
    "specific_value_proposition": "string"
  },
  "compliance_flags": ["string"]
}`;

// ─── Scoring Functions ───────────────────────────────────────────────────

/**
 * Score an HNW prospect using LLM (PROMPT 2 from claude_api_prompt_library.md).
 */
export async function scoreHnwProspect(
  prospect: HnwProspectData
): Promise<HnwScoringResult> {
  const prospectDataStr = JSON.stringify(prospect, null, 2);
  const prompt = HNW_NARRATIVE_PROMPT.replace("{prospect_data}", prospectDataStr);

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are an HNW prospect evaluation engine. Output ONLY valid JSON. No preamble, no commentary." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "hnw_narrative_scoring",
          strict: true,
          schema: {
            type: "object",
            properties: {
              prospect_name: { type: "string" },
              narrative_score: {
                type: "object",
                properties: {
                  wealth_signal_strength: { type: "string" },
                  fit_with_HNW_funnel: { type: "string" },
                  engagement_difficulty_estimate: { type: "string" },
                  summary_paragraph: { type: "string" },
                },
                required: ["wealth_signal_strength", "fit_with_HNW_funnel", "engagement_difficulty_estimate", "summary_paragraph"],
                additionalProperties: false,
              },
              recommended_cadence: { type: "string" },
              personalization_inputs: {
                type: "object",
                properties: {
                  specific_observation: { type: "string" },
                  value_piece_recommendation: { type: "string" },
                  peer_company_recommendation: { type: "string" },
                  specific_value_proposition: { type: "string" },
                },
                required: ["specific_observation", "value_piece_recommendation", "peer_company_recommendation", "specific_value_proposition"],
                additionalProperties: false,
              },
              compliance_flags: { type: "array", items: { type: "string" } },
            },
            required: ["prospect_name", "narrative_score", "recommended_cadence", "personalization_inputs", "compliance_flags"],
            additionalProperties: false,
          },
        },
      },
    });

    const raw = JSON.parse(response.choices[0].message.content || "{}");

    const result: HnwScoringResult = {
      prospectName: raw.prospect_name,
      narrativeScore: {
        wealthSignalStrength: raw.narrative_score.wealth_signal_strength as WealthSignalStrength,
        fitWithHnwFunnel: raw.narrative_score.fit_with_HNW_funnel as FunnelFit,
        engagementDifficultyEstimate: raw.narrative_score.engagement_difficulty_estimate as EngagementDifficulty,
        summaryParagraph: raw.narrative_score.summary_paragraph,
      },
      recommendedCadence: raw.recommended_cadence,
      personalizationInputs: {
        specificObservation: raw.personalization_inputs.specific_observation,
        valuePieceRecommendation: raw.personalization_inputs.value_piece_recommendation,
        peerCompanyRecommendation: raw.personalization_inputs.peer_company_recommendation,
        specificValueProposition: raw.personalization_inputs.specific_value_proposition,
      },
      complianceFlags: raw.compliance_flags,
    };

    log.info("Scored HNW prospect %s: signal=%s fit=%s difficulty=%s cadence=%s",
      result.prospectName,
      result.narrativeScore.wealthSignalStrength,
      result.narrativeScore.fitWithHnwFunnel,
      result.narrativeScore.engagementDifficultyEstimate,
      result.recommendedCadence
    );
    return result;
  } catch (err) {
    log.error("HNW scoring failed for %s: %s", prospect.prospectName, err);
    throw new Error(`HNW narrative scoring failed: ${err}`);
  }
}

/**
 * Validate that a recommended cadence exists in the cadence library.
 */
export function validateCadenceRecommendation(cadenceId: string): boolean {
  const validCadences = [
    "HNW_PROSPECT_12TOUCH_v1",
    "HNW_PROSPECT_NM_12TOUCH_v1",
    "RECRUIT_TIER1_12TOUCH_v1",
    "COI_MAINTENANCE_QUARTERLY_v1",
    "STEWARDLY_AFFILIATE_ONBOARDING_v1",
    "WTA_PCMP_B2B_PROSPECT_v1",
    "DORMANT_REENGAGEMENT_v1",
  ];
  return validCadences.includes(cadenceId);
}
