/**
 * Reply Analysis Engine
 * ======================
 * GAP-06: Reply analysis + cadence pause (auto-pause on reply, OOO detection, manual queue routing)
 * GAP-13: Reply classification (interested/objection/info_request/opt_out/OOO/wrong_person)
 * 
 * Implements PROMPT 4 from claude_api_prompt_library.md:
 *   - Classifies replies into 7 categories
 *   - Determines cadence action (pause/continue/stop)
 *   - Routes to manual queue with recommended response template
 *   - Detects OOO with return date extraction
 *   - Handles universal opt-out per FCC revocation-all rule
 */
import { invokeLLM } from "../_core/llm";
import { classifyReply as ruleBasedClassify, type ReplyAnalysis, type ReplyClassification } from "./cadenceEngine";
import { logger } from "../_core/logger";
const log = logger.child({ module: "replyAnalysis" });

// ─── Types ───────────────────────────────────────────────────────────────

export interface DetailedReplyAnalysis extends ReplyAnalysis {
  confidence: number; // 0-1
  keyPhrases: string[];
  urgency: "high" | "medium" | "low";
  escalationRequired: boolean;
}

export interface ReplyContext {
  replyText: string;
  cadenceId: string;
  touchNumber: number;
  prospectName: string;
  prospectCompany?: string;
  channel: "email" | "LinkedIn" | "phone" | "sms";
  previousTouchSubject?: string;
}

// ─── Response Templates ──────────────────────────────────────────────────

export const RESPONSE_TEMPLATES: Record<string, string> = {
  INTERESTED_REPLY_TEMPLATE: `Hi {{prospect_first_name}},

Thank you for your interest! I'd love to find a time that works for both of us.

Here's my calendar: {{calendar_link}}

Alternatively, I'm available [suggest 2-3 specific times]. What works best for you?

Looking forward to connecting.

Best,
{{sender_full_name}}`,

  OBJECTION_HANDLING_TEMPLATE: `Hi {{prospect_first_name}},

I completely understand — timing is everything, and I appreciate you letting me know.

I'll make a note to circle back in [suggested timeframe based on objection]. In the meantime, if anything changes or if I can be helpful in any way, please don't hesitate to reach out.

Wishing you all the best.

{{sender_full_name}}`,

  INFO_REQUEST_TEMPLATE: `Hi {{prospect_first_name}},

Great question! Here's what I can share:

[Relevant information based on their specific question]

I've also attached [relevant ESI-approved resource] that goes into more detail.

Would you like to discuss this further? {{calendar_link}}

Best,
{{sender_full_name}}`,

  WRONG_PERSON_TEMPLATE: `Hi {{prospect_first_name}},

Thank you for letting me know. I apologize for the misdirected outreach.

I've updated my records accordingly. If you happen to know who might be the right person to connect with regarding {{specific_value}}, I'd appreciate the referral — but no obligation at all.

Best wishes,
{{sender_full_name}}`,

  OPT_OUT_CONFIRMATION: `Your request has been received and processed. You have been removed from all future communications across all channels (email, phone, SMS, LinkedIn) effective immediately.

If you believe this was done in error or wish to re-subscribe in the future, please contact us directly.

Reference ID: {{opt_out_reference_id}}`,
};

// ─── Analysis Functions ──────────────────────────────────────────────────

/**
 * Analyze a reply using LLM for nuanced classification.
 * Falls back to rule-based classification if LLM fails.
 */
export async function analyzeReply(context: ReplyContext): Promise<DetailedReplyAnalysis> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are analyzing a reply to a sales/recruiting cadence touch. Classify the reply and determine the appropriate action.

CLASSIFICATION CATEGORIES:
- interested: Prospect shows interest in meeting, learning more, or continuing conversation
- objection: Prospect declines but doesn't opt out (timing, satisfaction with current provider, etc.)
- info_request: Prospect asks for more information or clarification
- opt_out: Prospect explicitly requests to stop receiving communications
- out_of_office: Automated OOO reply — extract return date if available
- wrong_person: Prospect indicates they're not the right contact
- unclassified: Cannot determine intent — route to human review

RULES:
- OOO replies should NOT pause the cadence — reschedule based on return date
- Opt-outs are UNIVERSAL across ALL channels per FCC revocation-all rule
- Interested replies are HIGH URGENCY — respond within 2 hours
- Always err on the side of caution: if unclear, classify as unclassified and route to human`,
        },
        {
          role: "user",
          content: `Analyze this reply:

CONTEXT:
- Cadence: ${context.cadenceId}
- Touch #: ${context.touchNumber}
- Prospect: ${context.prospectName} at ${context.prospectCompany || "unknown"}
- Channel: ${context.channel}
- Previous touch subject: ${context.previousTouchSubject || "N/A"}

REPLY TEXT:
${context.replyText}

Output JSON:
{
  "classification": "interested|objection|info_request|opt_out|out_of_office|wrong_person|unclassified",
  "sentiment": "positive|neutral|negative",
  "confidence": 0.0-1.0,
  "key_phrases": ["string"],
  "suggested_action": "string",
  "ooo_return_date": "string or null",
  "should_pause_cadence": true/false,
  "should_route_to_manual_queue": true/false,
  "recommended_response_template": "string or null",
  "urgency": "high|medium|low",
  "escalation_required": true/false
}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "reply_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              classification: { type: "string" },
              sentiment: { type: "string" },
              confidence: { type: "number" },
              key_phrases: { type: "array", items: { type: "string" } },
              suggested_action: { type: "string" },
              ooo_return_date: { type: ["string", "null"] },
              should_pause_cadence: { type: "boolean" },
              should_route_to_manual_queue: { type: "boolean" },
              recommended_response_template: { type: ["string", "null"] },
              urgency: { type: "string" },
              escalation_required: { type: "boolean" },
            },
            required: ["classification", "sentiment", "confidence", "key_phrases", "suggested_action", "ooo_return_date", "should_pause_cadence", "should_route_to_manual_queue", "recommended_response_template", "urgency", "escalation_required"],
            additionalProperties: false,
          },
        },
      },
    });

    const raw = JSON.parse(response.choices[0].message.content || "{}");

    const result: DetailedReplyAnalysis = {
      classification: raw.classification as ReplyClassification,
      sentiment: raw.sentiment as "positive" | "neutral" | "negative",
      confidence: raw.confidence,
      keyPhrases: raw.key_phrases,
      suggestedAction: raw.suggested_action,
      oooReturnDate: raw.ooo_return_date || undefined,
      shouldPauseCadence: raw.should_pause_cadence,
      shouldRouteToManualQueue: raw.should_route_to_manual_queue,
      recommendedResponseTemplate: raw.recommended_response_template || undefined,
      urgency: raw.urgency as "high" | "medium" | "low",
      escalationRequired: raw.escalation_required,
    };

    log.info("Reply from %s classified as %s (confidence: %.2f, urgency: %s)",
      context.prospectName, result.classification, result.confidence, result.urgency);
    return result;
  } catch (err) {
    log.warn("LLM reply analysis failed, falling back to rule-based: %s", err);
    // Fallback to rule-based classification
    const ruleResult = ruleBasedClassify(context.replyText);
    return {
      ...ruleResult,
      confidence: 0.6,
      keyPhrases: [],
      urgency: ruleResult.classification === "interested" ? "high" : "medium",
      escalationRequired: false,
    };
  }
}

/**
 * Process an opt-out request — universal across all channels.
 * Returns the opt-out record to be saved.
 */
export function processOptOut(params: {
  prospectId: number;
  channel: string;
  optOutText: string;
}): {
  prospectId: number;
  optOutTimestamp: number;
  optOutChannel: string;
  scope: "all_channels";
  optOutText: string;
} {
  return {
    prospectId: params.prospectId,
    optOutTimestamp: Date.now(),
    optOutChannel: params.channel,
    scope: "all_channels", // FCC revocation-all rule
    optOutText: params.optOutText,
  };
}

/**
 * Calculate reschedule date for OOO replies.
 * Adds 2 business days after the detected return date.
 */
export function calculateOooReschedule(returnDateStr: string | undefined): number | null {
  if (!returnDateStr) return null;
  try {
    const returnDate = new Date(returnDateStr);
    if (isNaN(returnDate.getTime())) return null;
    // Add 2 business days
    let daysAdded = 0;
    const reschedule = new Date(returnDate);
    while (daysAdded < 2) {
      reschedule.setDate(reschedule.getDate() + 1);
      const day = reschedule.getDay();
      if (day !== 0 && day !== 6) daysAdded++;
    }
    return reschedule.getTime();
  } catch {
    return null;
  }
}
