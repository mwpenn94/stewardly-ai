/**
 * MEDDPICC Field Completion Service — PROMPT 5
 * ==============================================
 * Analyzes discovery call transcripts to auto-populate MEDDPICC fields.
 * Uses LLM to extract structured qualification data from conversation context,
 * with confidence scoring and evidence quotes for each field.
 *
 * Trigger: Discovery call held; transcript available; opportunity in pipeline.
 * Compliance: Transcripts may contain MNPI — store in GLBA-compliant storage.
 *             Do not retain transcripts beyond 90 days unless prospect becomes client.
 */
import { invokeLLM } from "../_core/llm";

// ─── Types ───────────────────────────────────────────────────────────────

export type ConfidenceLevel = "High" | "Medium" | "Low";

export type StageRecommendation =
  | "Maintain Discovery"
  | "Advance to Solution Design"
  | "Advance to Validation"
  | "Disqualify";

export interface MeddpiccFieldValue {
  value: string;
  confidence: ConfidenceLevel;
  evidenceQuote: string | null;
}

export interface MeddpiccFields {
  metrics: MeddpiccFieldValue;
  economicBuyer: MeddpiccFieldValue;
  decisionCriteria: MeddpiccFieldValue;
  decisionProcess: MeddpiccFieldValue;
  paperProcess: MeddpiccFieldValue;
  identifyPain: MeddpiccFieldValue;
  champion: MeddpiccFieldValue;
  competition: MeddpiccFieldValue;
}

export interface MeddpiccCompletionResult {
  opportunityId: string;
  fields: MeddpiccFields;
  fieldsComplete: number;
  nextCallFocusAreas: string[];
  stageAdvancementRecommendation: StageRecommendation;
  transcriptAnalyzedAt: number;
  complianceNotes: string[];
}

export interface MeddpiccCompletionInput {
  opportunityId: string;
  prospectName: string;
  callTranscript: string;
  currentMeddpiccState?: Partial<Record<keyof MeddpiccFields, string>>;
}

// ─── Constants ───────────────────────────────────────────────────────────

const MEDDPICC_FIELD_DEFINITIONS: Record<string, string> = {
  Metrics: 'Quantified pain or value the prospect cares about (e.g., "Reduce tax drag on $5M portfolio by 1.5% annually")',
  Economic_Buyer: 'Who has financial authority to commit (e.g., "Self-directed retiree; spouse co-decides")',
  Decision_Criteria: 'What criteria will they use to evaluate (e.g., "Fee transparency, fiduciary duty, tax efficiency")',
  Decision_Process: 'How and when will they decide (e.g., "Will compare 3 advisors over next 6 weeks; commitment by Q3")',
  Paper_Process: 'What paperwork or onboarding required (e.g., "Standard advisory agreement; ACAT transfer from current custodian")',
  Identify_Pain: 'Specific pain point or dissatisfaction (e.g., "Current advisor unresponsive; no annual planning session in 2 years")',
  Champion: 'Internal advocate / referrer (e.g., "Spouse is enthusiastic; CPA referred to us")',
  Competition: 'What alternatives are they considering (e.g., "Currently with [competitor]; also evaluating [robo-advisor]")',
};

const STAGE_RULES = `
For STAGE ADVANCEMENT RECOMMENDATION:
- Maintain Discovery: <5 fields populated with confidence >= Medium
- Advance to Solution Design: 5-7 fields populated with confidence >= Medium AND quantified pain identified
- Advance to Validation: All 8 fields populated; champion confirmed; economic buyer aware
- Disqualify: pain not real, champion absent, decision process unworkable, or competition strongly preferred
`;

// ─── Empty/Default State ─────────────────────────────────────────────────

const EMPTY_FIELD: MeddpiccFieldValue = {
  value: "Not Discovered",
  confidence: "Low",
  evidenceQuote: null,
};

export function createEmptyMeddpicc(): MeddpiccFields {
  return {
    metrics: { ...EMPTY_FIELD },
    economicBuyer: { ...EMPTY_FIELD },
    decisionCriteria: { ...EMPTY_FIELD },
    decisionProcess: { ...EMPTY_FIELD },
    paperProcess: { ...EMPTY_FIELD },
    identifyPain: { ...EMPTY_FIELD },
    champion: { ...EMPTY_FIELD },
    competition: { ...EMPTY_FIELD },
  };
}

// ─── Field Counting ──────────────────────────────────────────────────────

export function countCompletedFields(fields: MeddpiccFields): number {
  let count = 0;
  const fieldKeys: (keyof MeddpiccFields)[] = [
    "metrics", "economicBuyer", "decisionCriteria", "decisionProcess",
    "paperProcess", "identifyPain", "champion", "competition",
  ];
  for (const key of fieldKeys) {
    const field = fields[key];
    if (field && field.value !== "Not Discovered" && field.confidence !== "Low") {
      count++;
    }
  }
  return count;
}

// ─── Stage Recommendation Logic (deterministic fallback) ─────────────────

export function determineStageRecommendation(
  fields: MeddpiccFields,
  fieldsComplete: number
): StageRecommendation {
  // Check for disqualification signals
  if (
    fields.identifyPain.value === "Not Discovered" &&
    fields.champion.value === "Not Discovered" &&
    fields.competition.confidence === "High" &&
    fields.competition.value.toLowerCase().includes("strongly preferred")
  ) {
    return "Disqualify";
  }

  // All 8 populated + champion confirmed + economic buyer aware
  if (
    fieldsComplete === 8 &&
    fields.champion.confidence !== "Low" &&
    fields.economicBuyer.confidence !== "Low"
  ) {
    return "Advance to Validation";
  }

  // 5-7 fields with quantified pain
  if (
    fieldsComplete >= 5 &&
    fieldsComplete <= 7 &&
    fields.identifyPain.value !== "Not Discovered"
  ) {
    return "Advance to Solution Design";
  }

  return "Maintain Discovery";
}

// ─── Focus Area Identification ───────────────────────────────────────────

export function identifyFocusAreas(fields: MeddpiccFields): string[] {
  const focusAreas: string[] = [];
  const fieldMap: Record<keyof MeddpiccFields, string> = {
    metrics: "Quantify the prospect's pain in dollar terms or measurable outcomes",
    economicBuyer: "Identify who has financial authority and decision-making power",
    decisionCriteria: "Understand what criteria they'll use to evaluate advisors",
    decisionProcess: "Map out their timeline and decision-making process",
    paperProcess: "Clarify onboarding requirements and paperwork expectations",
    identifyPain: "Surface specific pain points or dissatisfaction with current situation",
    champion: "Identify an internal advocate or referral source who supports engagement",
    competition: "Understand what alternatives they're evaluating",
  };

  for (const [key, description] of Object.entries(fieldMap)) {
    const field = fields[key as keyof MeddpiccFields];
    if (!field || field.value === "Not Discovered" || field.confidence === "Low") {
      focusAreas.push(description);
    }
  }

  return focusAreas.slice(0, 4); // Top 4 focus areas for next call
}

// ─── LLM-Powered Transcript Analysis ────────────────────────────────────

export async function completeMeddpiccFromTranscript(
  input: MeddpiccCompletionInput
): Promise<MeddpiccCompletionResult> {
  // Validate input
  if (!input.callTranscript || input.callTranscript.trim().length < 50) {
    // Transcript too short — return empty state with focus areas
    const emptyFields = createEmptyMeddpicc();
    return {
      opportunityId: input.opportunityId,
      fields: emptyFields,
      fieldsComplete: 0,
      nextCallFocusAreas: identifyFocusAreas(emptyFields),
      stageAdvancementRecommendation: "Maintain Discovery",
      transcriptAnalyzedAt: Date.now(),
      complianceNotes: [
        "Transcript too short for meaningful analysis. Minimum 50 characters required.",
        "MNPI handling: No transcript data retained in this analysis.",
      ],
    };
  }

  // Build current state string for the prompt
  const currentStateStr = input.currentMeddpiccState
    ? Object.entries(input.currentMeddpiccState)
        .filter(([, v]) => v && v !== "Not Discovered")
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n") || "No fields currently populated."
    : "No fields currently populated.";

  const systemPrompt = `You are analyzing a discovery call transcript to populate MEDDPICC fields for the opportunity. MEDDPICC is the standard B2B sales qualification framework adapted for WealthBridge's HNW client funnel.

For each of the 8 fields, extract:
- VALUE: specific information from the transcript (or "Not Discovered" if not surfaced)
- CONFIDENCE: High (clearly stated), Medium (implied), Low (inferred)
- EVIDENCE_QUOTE: exact quote from transcript supporting the value (or null if Not Discovered)

Field definitions:
${Object.entries(MEDDPICC_FIELD_DEFINITIONS).map(([k, v], i) => `${i + 1}. ${k}: ${v}`).join("\n")}

${STAGE_RULES}

Respond ONLY with valid JSON matching the schema. No preamble, no commentary.`;

  const userPrompt = `PROSPECT: ${input.prospectName}
OPPORTUNITY: ${input.opportunityId}

CALL TRANSCRIPT:
${input.callTranscript}

CURRENT MEDDPICC STATE:
${currentStateStr}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "meddpicc_completion",
          strict: true,
          schema: {
            type: "object",
            properties: {
              MEDDPICC_fields: {
                type: "object",
                properties: {
                  Metrics: {
                    type: "object",
                    properties: {
                      value: { type: "string" },
                      confidence: { type: "string", enum: ["High", "Medium", "Low"] },
                      evidence_quote: { type: "string" },
                    },
                    required: ["value", "confidence", "evidence_quote"],
                    additionalProperties: false,
                  },
                  Economic_Buyer: {
                    type: "object",
                    properties: {
                      value: { type: "string" },
                      confidence: { type: "string", enum: ["High", "Medium", "Low"] },
                      evidence_quote: { type: "string" },
                    },
                    required: ["value", "confidence", "evidence_quote"],
                    additionalProperties: false,
                  },
                  Decision_Criteria: {
                    type: "object",
                    properties: {
                      value: { type: "string" },
                      confidence: { type: "string", enum: ["High", "Medium", "Low"] },
                      evidence_quote: { type: "string" },
                    },
                    required: ["value", "confidence", "evidence_quote"],
                    additionalProperties: false,
                  },
                  Decision_Process: {
                    type: "object",
                    properties: {
                      value: { type: "string" },
                      confidence: { type: "string", enum: ["High", "Medium", "Low"] },
                      evidence_quote: { type: "string" },
                    },
                    required: ["value", "confidence", "evidence_quote"],
                    additionalProperties: false,
                  },
                  Paper_Process: {
                    type: "object",
                    properties: {
                      value: { type: "string" },
                      confidence: { type: "string", enum: ["High", "Medium", "Low"] },
                      evidence_quote: { type: "string" },
                    },
                    required: ["value", "confidence", "evidence_quote"],
                    additionalProperties: false,
                  },
                  Identify_Pain: {
                    type: "object",
                    properties: {
                      value: { type: "string" },
                      confidence: { type: "string", enum: ["High", "Medium", "Low"] },
                      evidence_quote: { type: "string" },
                    },
                    required: ["value", "confidence", "evidence_quote"],
                    additionalProperties: false,
                  },
                  Champion: {
                    type: "object",
                    properties: {
                      value: { type: "string" },
                      confidence: { type: "string", enum: ["High", "Medium", "Low"] },
                      evidence_quote: { type: "string" },
                    },
                    required: ["value", "confidence", "evidence_quote"],
                    additionalProperties: false,
                  },
                  Competition: {
                    type: "object",
                    properties: {
                      value: { type: "string" },
                      confidence: { type: "string", enum: ["High", "Medium", "Low"] },
                      evidence_quote: { type: "string" },
                    },
                    required: ["value", "confidence", "evidence_quote"],
                    additionalProperties: false,
                  },
                },
                required: [
                  "Metrics", "Economic_Buyer", "Decision_Criteria", "Decision_Process",
                  "Paper_Process", "Identify_Pain", "Champion", "Competition",
                ],
                additionalProperties: false,
              },
              fields_complete: { type: "integer" },
              next_call_focus_areas: { type: "array", items: { type: "string" } },
              stage_advancement_recommendation: {
                type: "string",
                enum: ["Maintain Discovery", "Advance to Solution Design", "Advance to Validation", "Disqualify"],
              },
            },
            required: ["MEDDPICC_fields", "fields_complete", "next_call_focus_areas", "stage_advancement_recommendation"],
            additionalProperties: false,
          },
        },
      },
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
    const rawFields = parsed.MEDDPICC_fields || {};

    // Map LLM output to our typed interface
    const fields: MeddpiccFields = {
      metrics: mapField(rawFields.Metrics),
      economicBuyer: mapField(rawFields.Economic_Buyer),
      decisionCriteria: mapField(rawFields.Decision_Criteria),
      decisionProcess: mapField(rawFields.Decision_Process),
      paperProcess: mapField(rawFields.Paper_Process),
      identifyPain: mapField(rawFields.Identify_Pain),
      champion: mapField(rawFields.Champion),
      competition: mapField(rawFields.Competition),
    };

    const fieldsComplete = countCompletedFields(fields);
    const recommendation = determineStageRecommendation(fields, fieldsComplete);

    return {
      opportunityId: input.opportunityId,
      fields,
      fieldsComplete,
      nextCallFocusAreas: parsed.next_call_focus_areas || identifyFocusAreas(fields),
      stageAdvancementRecommendation: recommendation,
      transcriptAnalyzedAt: Date.now(),
      complianceNotes: [
        "MNPI handling: Transcript analyzed in-memory only. No raw transcript stored.",
        "GLBA compliance: Evidence quotes extracted for audit trail only.",
        fieldsComplete >= 5
          ? "Sufficient qualification data for fiduciary suitability assessment."
          : "Insufficient qualification data — additional discovery required before suitability assessment.",
      ],
    };
  } catch (error) {
    // Fallback: return empty state with error note
    const emptyFields = createEmptyMeddpicc();
    return {
      opportunityId: input.opportunityId,
      fields: emptyFields,
      fieldsComplete: 0,
      nextCallFocusAreas: identifyFocusAreas(emptyFields),
      stageAdvancementRecommendation: "Maintain Discovery",
      transcriptAnalyzedAt: Date.now(),
      complianceNotes: [
        `MEDDPICC analysis encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`,
        "Manual MEDDPICC field completion required.",
        "MNPI handling: No transcript data retained due to analysis failure.",
      ],
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function mapField(raw: any): MeddpiccFieldValue {
  if (!raw) return { ...EMPTY_FIELD };
  return {
    value: raw.value || "Not Discovered",
    confidence: validateConfidence(raw.confidence),
    evidenceQuote: raw.evidence_quote === "null" || !raw.evidence_quote ? null : raw.evidence_quote,
  };
}

function validateConfidence(c: any): ConfidenceLevel {
  if (c === "High" || c === "Medium" || c === "Low") return c;
  return "Low";
}

// ─── Merge with Existing State ───────────────────────────────────────────

/**
 * Merges new MEDDPICC analysis with existing state, preferring higher-confidence values.
 */
export function mergeMeddpiccStates(
  existing: MeddpiccFields,
  newAnalysis: MeddpiccFields
): MeddpiccFields {
  const confidenceRank: Record<ConfidenceLevel, number> = { High: 3, Medium: 2, Low: 1 };
  const merged = createEmptyMeddpicc();

  const keys: (keyof MeddpiccFields)[] = [
    "metrics", "economicBuyer", "decisionCriteria", "decisionProcess",
    "paperProcess", "identifyPain", "champion", "competition",
  ];

  for (const key of keys) {
    const existingField = existing[key];
    const newField = newAnalysis[key];

    // Prefer the field with higher confidence, or the new one if equal
    if (
      newField.value !== "Not Discovered" &&
      (existingField.value === "Not Discovered" ||
        confidenceRank[newField.confidence] >= confidenceRank[existingField.confidence])
    ) {
      merged[key] = newField;
    } else {
      merged[key] = existingField;
    }
  }

  return merged;
}

// ─── Transcript Compliance Check ─────────────────────────────────────────

/**
 * Checks if a transcript contains potential MNPI or sensitive data flags.
 * Returns warnings for the advisor to review before storing.
 */
export function checkTranscriptCompliance(transcript: string): {
  hasMnpiRisk: boolean;
  hasHealthInfo: boolean;
  hasSsnOrTin: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  let hasMnpiRisk = false;
  let hasHealthInfo = false;
  let hasSsnOrTin = false;

  // Check for SSN/TIN patterns
  if (/\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/.test(transcript)) {
    hasSsnOrTin = true;
    warnings.push("CRITICAL: Potential SSN/TIN detected in transcript. Must be redacted before storage.");
  }

  // Check for health information (HIPAA)
  const healthTerms = /\b(diagnosis|medication|treatment|surgery|hospital|medical condition|prescription)\b/i;
  if (healthTerms.test(transcript)) {
    hasHealthInfo = true;
    warnings.push("WARNING: Health-related information detected. HIPAA compliance review required.");
  }

  // Check for MNPI indicators
  const mnpiTerms = /\b(insider|non-public|confidential deal|pending merger|acquisition target|material information)\b/i;
  if (mnpiTerms.test(transcript)) {
    hasMnpiRisk = true;
    warnings.push("WARNING: Potential MNPI detected. SEC compliance review required before proceeding.");
  }

  // Check for account numbers
  if (/\b\d{8,12}\b/.test(transcript)) {
    warnings.push("NOTICE: Potential account numbers detected. Consider redaction for storage.");
  }

  if (warnings.length === 0) {
    warnings.push("No compliance flags detected in transcript scan.");
  }

  return { hasMnpiRisk, hasHealthInfo, hasSsnOrTin, warnings };
}
