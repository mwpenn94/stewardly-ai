/**
 * Cadence Touch Drafting Engine
 * ==============================
 * GAP-04: Implements PROMPT 3 from claude_api_prompt_library.md
 * 
 * Generates personalized cadence touches with full compliance checks:
 *   - ESI pre-approval verification
 *   - Anti-rebate language check (ARS § 20-451 / NM NAIC PLMA)
 *   - FINRA 2210 compliance
 *   - TCPA consent verification (phone/SMS)
 *   - Performance projection blocking
 *   - Forward-looking claims blocking
 */
import { invokeLLM } from "../_core/llm";
import { getCadence, renderTouch, type CadenceTouch } from "./cadenceEngine";
import { logger } from "../_core/logger";
const log = logger.child({ module: "cadenceTouchDrafting" });

// ─── Types ───────────────────────────────────────────────────────────────

export interface ComplianceCheck {
  esiPreApprovalVerified: boolean;
  antiRebateLanguageRequired: boolean;
  antiRebateLanguagePresent: boolean;
  finra2210Compliant: boolean;
  tcpaConsentVerified: boolean; // for phone/SMS only
  performanceProjectionsPresent: boolean; // should be false
  forwardLookingClaimsPresent: boolean; // should be false
  readyToSend: boolean;
}

export interface DraftedTouch {
  cadenceId: string;
  touchNumber: number;
  channel: string;
  subjectLine?: string;
  body: string;
  complianceCheck: ComplianceCheck;
  rationaleForPersonalization: string;
}

export interface TouchDraftInput {
  cadenceId: string;
  touchNumber: number;
  prospectData: Record<string, string>;
  personalizationInputs: Record<string, string>;
  esiPreApprovalId: string;
  senderSignatureBlock: string;
  tcpaConsentVerified?: boolean;
}

// ─── Compliance Patterns ─────────────────────────────────────────────────

const PERFORMANCE_PROJECTION_PATTERNS = [
  /\b(?:guarantee|guaranteed|will earn|will return|will make|will save)\b/i,
  /\b(?:projected returns?|expected returns?|anticipated returns?)\b/i,
  /\b(?:\d+%\s*(?:return|growth|yield|gain))\b/i,
  /\b(?:you (?:will|can) (?:expect|earn|receive|get))\b/i,
];

const FORWARD_LOOKING_PATTERNS = [
  /\b(?:will increase|will grow|will appreciate|will outperform)\b/i,
  /\b(?:is going to|are going to)\s+(?:increase|grow|rise|appreciate)\b/i,
  /\b(?:predict|forecast|project)\s+(?:that|a|an)\b/i,
];

const ANTI_REBATE_TRIGGERS = [
  /\b(?:compensation|commission|fee|rebate|incentive|bonus|payment)\b/i,
  /\b(?:split|sharing|referral fee|finder.?s fee)\b/i,
];

const ANTI_REBATE_DISCLOSURE = `\n\nDisclosure: In accordance with ARS § 20-451, no rebating of premiums, dividends, or other benefits is permitted. All compensation arrangements comply with applicable state insurance regulations.`;

// ─── Drafting Functions ──────────────────────────────────────────────────

/**
 * Run compliance checks on a drafted touch body.
 */
export function runComplianceChecks(
  body: string,
  channel: string,
  esiPreApprovalId: string,
  tcpaConsentVerified: boolean = false
): ComplianceCheck {
  const hasPerformanceProjections = PERFORMANCE_PROJECTION_PATTERNS.some(p => p.test(body));
  const hasForwardLookingClaims = FORWARD_LOOKING_PATTERNS.some(p => p.test(body));
  const antiRebateRequired = ANTI_REBATE_TRIGGERS.some(p => p.test(body));
  const antiRebatePresent = body.includes("ARS § 20-451") || body.includes("NAIC PLMA") || body.includes("anti-rebate");
  const isPhoneOrSms = channel === "phone" || channel === "sms";
  const esiVerified = !!esiPreApprovalId && !esiPreApprovalId.startsWith("{{");

  const readyToSend =
    esiVerified &&
    !hasPerformanceProjections &&
    !hasForwardLookingClaims &&
    (!antiRebateRequired || antiRebatePresent) &&
    (!isPhoneOrSms || tcpaConsentVerified);

  return {
    esiPreApprovalVerified: esiVerified,
    antiRebateLanguageRequired: antiRebateRequired,
    antiRebateLanguagePresent: antiRebatePresent,
    finra2210Compliant: !hasPerformanceProjections && !hasForwardLookingClaims,
    tcpaConsentVerified: isPhoneOrSms ? tcpaConsentVerified : true,
    performanceProjectionsPresent: hasPerformanceProjections,
    forwardLookingClaimsPresent: hasForwardLookingClaims,
    readyToSend,
  };
}

/**
 * Draft a personalized cadence touch using LLM (PROMPT 3).
 * Falls back to template rendering if LLM fails.
 */
export async function draftCadenceTouch(input: TouchDraftInput): Promise<DraftedTouch> {
  const cadence = getCadence(input.cadenceId);
  if (!cadence) throw new Error(`Cadence ${input.cadenceId} not found`);

  const touch = cadence.touches.find(t => t.touchNumber === input.touchNumber);
  if (!touch) throw new Error(`Touch ${input.touchNumber} not found in cadence ${input.cadenceId}`);

  // Merge prospect data + personalization inputs + sender info
  const allVariables: Record<string, string> = {
    ...input.prospectData,
    ...input.personalizationInputs,
    sender_full_name: input.senderSignatureBlock.split("\n")[0] || "",
    sender_first_name: (input.senderSignatureBlock.split("\n")[0] || "").split(" ")[0] || "",
    ESI_PREAPPROVAL_ID: input.esiPreApprovalId,
  };

  try {
    // Try LLM-based personalization
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are drafting a personalized cadence touch for the WealthBridge operating system. Fill in {{variables}} with prospect-specific content while maintaining strict compliance with the cadence's pre-approved structure.

RULES:
- Do NOT add performance projections or forward-looking claims
- Do NOT add guarantees or promises of returns
- Do NOT reference specific dollar amounts unless from public records
- Maintain the tone and structure of the original template
- Replace ALL {{variables}} with appropriate content
- If anti-rebate language is needed (compensation discussed), include ARS § 20-451 disclosure`,
        },
        {
          role: "user",
          content: `Draft touch ${input.touchNumber} of cadence ${input.cadenceId}.

TEMPLATE:
Subject: ${touch.subjectLine || "(no subject)"}
Body: ${touch.body}
Compliance notes: ${touch.complianceNotes}

PROSPECT DATA: ${JSON.stringify(input.prospectData)}
PERSONALIZATION INPUTS: ${JSON.stringify(input.personalizationInputs)}
SENDER: ${input.senderSignatureBlock}

Output JSON:
{
  "subject_line": "string or null",
  "body": "string with all variables replaced",
  "rationale_for_personalization": "string explaining why this phrasing for this prospect"
}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "cadence_touch_draft",
          strict: true,
          schema: {
            type: "object",
            properties: {
              subject_line: { type: ["string", "null"] },
              body: { type: "string" },
              rationale_for_personalization: { type: "string" },
            },
            required: ["subject_line", "body", "rationale_for_personalization"],
            additionalProperties: false,
          },
        },
      },
    });

    const raw = JSON.parse(response.choices[0].message.content || "{}");
    let body = raw.body || renderTouch(touch, allVariables).body;

    // Auto-inject anti-rebate if needed and missing
    const complianceCheck = runComplianceChecks(body, touch.channel, input.esiPreApprovalId, input.tcpaConsentVerified);
    if (complianceCheck.antiRebateLanguageRequired && !complianceCheck.antiRebateLanguagePresent) {
      body += ANTI_REBATE_DISCLOSURE;
      log.info("Auto-injected anti-rebate disclosure for touch %d", input.touchNumber);
    }

    // Re-check after potential injection
    const finalCheck = runComplianceChecks(body, touch.channel, input.esiPreApprovalId, input.tcpaConsentVerified);

    return {
      cadenceId: input.cadenceId,
      touchNumber: input.touchNumber,
      channel: touch.channel,
      subjectLine: raw.subject_line || undefined,
      body,
      complianceCheck: finalCheck,
      rationaleForPersonalization: raw.rationale_for_personalization || "Template-based rendering",
    };
  } catch (err) {
    log.warn("LLM drafting failed, falling back to template rendering: %s", err);
    // Fallback: simple variable replacement
    const rendered = renderTouch(touch, allVariables);
    const complianceCheck = runComplianceChecks(rendered.body, touch.channel, input.esiPreApprovalId, input.tcpaConsentVerified);

    return {
      cadenceId: input.cadenceId,
      touchNumber: input.touchNumber,
      channel: touch.channel,
      subjectLine: rendered.subject || undefined,
      body: rendered.body,
      complianceCheck,
      rationaleForPersonalization: "Fallback: template variable replacement only",
    };
  }
}

/**
 * Validate a drafted touch is safe to send.
 * Returns list of blocking issues.
 */
export function validateDraftForSend(draft: DraftedTouch): string[] {
  const issues: string[] = [];
  if (!draft.complianceCheck.esiPreApprovalVerified) issues.push("ESI pre-approval not verified");
  if (draft.complianceCheck.performanceProjectionsPresent) issues.push("Performance projections detected — BLOCKED");
  if (draft.complianceCheck.forwardLookingClaimsPresent) issues.push("Forward-looking claims detected — BLOCKED");
  if (draft.complianceCheck.antiRebateLanguageRequired && !draft.complianceCheck.antiRebateLanguagePresent) issues.push("Anti-rebate language required but missing");
  if (!draft.complianceCheck.tcpaConsentVerified && (draft.channel === "phone" || draft.channel === "sms")) issues.push("TCPA consent not verified for phone/SMS");
  // Check for unresolved variables
  const unresolvedVars = draft.body.match(/\{\{[^}]+\}\}/g);
  if (unresolvedVars) issues.push(`Unresolved variables: ${unresolvedVars.join(", ")}`);
  return issues;
}
