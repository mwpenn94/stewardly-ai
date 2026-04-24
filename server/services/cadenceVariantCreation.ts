/**
 * Cadence Variant Creation Service — PROMPT 9
 * =============================================
 * Creates geography/compliance/audience variants of existing cadences.
 * Uses LLM to adapt touch content for regional compliance (e.g., NM ESI rules),
 * cultural nuances, and audience-specific language.
 */
import { invokeLLM } from "../_core/llm";
import { getCadence, CADENCE_LIBRARY, type CadenceDefinition, type CadenceTouch } from "./cadenceEngine";

// ─── Types ───────────────────────────────────────────────────────────────

export interface VariantRequest {
  baseCadenceId: string;
  variantType: "geographic" | "compliance" | "audience" | "channel_shift";
  variantName: string;
  variantDescription: string;
  adaptationRules: {
    geography?: string;           // e.g., "New Mexico", "California"
    complianceOverlay?: string;   // e.g., "NM ESI rules", "CA CCPA"
    audienceSegment?: string;     // e.g., "Medical professionals", "Tech executives"
    channelPreference?: string;   // e.g., "LinkedIn-heavy", "Email-only"
    toneAdjustment?: string;      // e.g., "More formal", "More casual"
    excludeChannels?: string[];   // e.g., ["phone"] for DNC-heavy regions
  };
  esiPreApprovalId?: string;
}

export interface VariantResult {
  variantCadenceId: string;
  variantName: string;
  baseCadenceId: string;
  variantType: VariantRequest["variantType"];
  touches: CadenceTouch[];
  adaptationNotes: string[];
  complianceNotes: string[];
  createdAt: number;
}

// ─── Variant Generation ──────────────────────────────────────────────────

export async function createCadenceVariant(
  request: VariantRequest
): Promise<VariantResult> {
  const baseCadence = getCadence(request.baseCadenceId);
  if (!baseCadence) {
    throw new Error(`Base cadence "${request.baseCadenceId}" not found in library`);
  }

  // For cadences that reference another cadence's touches, resolve them
  const baseTouches = baseCadence.touches.length > 0
    ? baseCadence.touches
    : (baseCadence.touchesReference
        ? getCadence(baseCadence.touchesReference)?.touches ?? []
        : []);

  if (baseTouches.length === 0) {
    throw new Error(`Base cadence "${request.baseCadenceId}" has no touches to adapt`);
  }

  const systemPrompt = `You are a cadence variant creator for WealthBridge AI.
Your job is to adapt an existing outreach cadence for a new geography, compliance regime, audience, or channel preference.

Rules:
- Preserve the cadence structure (number of touches, timing, channel mix) unless the adaptation requires changes
- Adapt language for regional compliance (e.g., New Mexico ESI rules require specific disclosure language)
- Maintain FINRA 2210 compliance in all variants
- Never include performance projections or guaranteed returns
- Include anti-rebate language where required by state regulations
- Adapt cultural references and examples for the target audience
- If excluding channels, redistribute touches to remaining channels
- Return ONLY valid JSON matching the specified schema`;

  const userPrompt = `Create a ${request.variantType} variant of the "${baseCadence.name}" cadence.

VARIANT DETAILS:
- Name: ${request.variantName}
- Description: ${request.variantDescription}
- Type: ${request.variantType}
${request.adaptationRules.geography ? `- Geography: ${request.adaptationRules.geography}` : ""}
${request.adaptationRules.complianceOverlay ? `- Compliance Overlay: ${request.adaptationRules.complianceOverlay}` : ""}
${request.adaptationRules.audienceSegment ? `- Audience: ${request.adaptationRules.audienceSegment}` : ""}
${request.adaptationRules.channelPreference ? `- Channel Preference: ${request.adaptationRules.channelPreference}` : ""}
${request.adaptationRules.toneAdjustment ? `- Tone: ${request.adaptationRules.toneAdjustment}` : ""}
${request.adaptationRules.excludeChannels ? `- Exclude Channels: ${request.adaptationRules.excludeChannels.join(", ")}` : ""}

BASE CADENCE TOUCHES:
${baseTouches.map((t, i) => `Touch ${i + 1} (Day ${t.day}, ${t.channel}): ${t.subject || ""}\n${t.body}`).join("\n\n")}

Return a JSON object with:
{
  "touches": [{ "channel": "email|LinkedIn_Connection|LinkedIn_InMail|phone|text", "day": number, "subject": "string or null", "body": "string" }],
  "adaptationNotes": ["string"],
  "complianceNotes": ["string"]
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "cadence_variant",
          strict: true,
          schema: {
            type: "object",
            properties: {
              touches: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    channel: { type: "string" },
                    day: { type: "integer" },
                    subject: { type: "string" },
                    body: { type: "string" },
                  },
                  required: ["channel", "day", "subject", "body"],
                  additionalProperties: false,
                },
              },
              adaptationNotes: { type: "array", items: { type: "string" } },
              complianceNotes: { type: "array", items: { type: "string" } },
            },
            required: ["touches", "adaptationNotes", "complianceNotes"],
            additionalProperties: false,
          },
        },
      },
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
    const variantId = `${request.baseCadenceId}_${request.variantType}_${Date.now()}`;

    return {
      variantCadenceId: variantId,
      variantName: request.variantName,
      baseCadenceId: request.baseCadenceId,
      variantType: request.variantType,
      touches: parsed.touches || baseTouches,
      adaptationNotes: parsed.adaptationNotes || [],
      complianceNotes: parsed.complianceNotes || [],
      createdAt: Date.now(),
    };
  } catch (error) {
    // Fallback: return base touches with minimal adaptation notes
    return {
      variantCadenceId: `${request.baseCadenceId}_${request.variantType}_${Date.now()}`,
      variantName: request.variantName,
      baseCadenceId: request.baseCadenceId,
      variantType: request.variantType,
      touches: baseTouches,
      adaptationNotes: [`Variant creation encountered an error — base touches preserved. Manual review required.`],
      complianceNotes: [`Compliance review pending — original cadence compliance status applies.`],
      createdAt: Date.now(),
    };
  }
}

// ─── Validation ──────────────────────────────────────────────────────────

export function validateVariant(variant: VariantResult): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (!variant.touches || variant.touches.length === 0) {
    issues.push("Variant has no touches defined");
  }

  for (const [i, touch] of variant.touches.entries()) {
    if (!touch.channel) issues.push(`Touch ${i + 1}: missing channel`);
    if (typeof touch.day !== "number" || touch.day < 0) issues.push(`Touch ${i + 1}: invalid day`);
    if (!touch.body || touch.body.length < 10) issues.push(`Touch ${i + 1}: body too short or missing`);

    // Check for compliance red flags
    const lowerBody = touch.body.toLowerCase();
    if (lowerBody.includes("guarantee") && lowerBody.includes("return")) {
      issues.push(`Touch ${i + 1}: contains "guaranteed return" language — FINRA 2210 violation`);
    }
    if (/\d+%\s*(return|gain|profit|yield)/i.test(touch.body)) {
      issues.push(`Touch ${i + 1}: contains specific performance projection — SEC Marketing Rule violation`);
    }
  }

  // Check touch ordering
  for (let i = 1; i < variant.touches.length; i++) {
    if (variant.touches[i].day < variant.touches[i - 1].day) {
      issues.push(`Touch ${i + 1}: day ${variant.touches[i].day} is before touch ${i} day ${variant.touches[i - 1].day}`);
    }
  }

  return { valid: issues.length === 0, issues };
}

// ─── List Available Base Cadences ────────────────────────────────────────

export function listBaseCadences(): Array<{
  cadenceId: string;
  name: string;
  audienceSegment: string;
  touchCount: number;
  hasVariants: boolean;
}> {
  return CADENCE_LIBRARY.map(c => {
    // Resolve touchesReference for cadences that inherit touches from a parent
    let touchCount = c.touches.length;
    if (touchCount === 0 && c.touchesReference) {
      const parent = CADENCE_LIBRARY.find(p => p.cadenceId === c.touchesReference);
      if (parent) touchCount = parent.touches.length;
    }
    return {
      cadenceId: c.cadenceId,
      name: c.name,
      audienceSegment: c.audienceSegment,
      touchCount,
      hasVariants: !!c.touchesReference,
    };
  });
}
