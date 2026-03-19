import type { AdvisoryMode, FocusMode } from "@shared/types";

/**
 * Build the master system prompt based on the Enhanced Build Prompt spec.
 * Focus-aware, data-layered, cross-domain intelligence.
 */
export function buildSystemPrompt(opts: {
  userName?: string;
  mode: AdvisoryMode;
  focus: FocusMode;
  userRole?: string;
  styleProfile?: string | null;
  ragContext?: string;
  memories?: string;
  suitabilityCompleted?: boolean;
  productContext?: string;
  userProfileData?: string;
  professionalContext?: string;
  managementContext?: string;
  enrichmentData?: string;
  affiliatedShelf?: string;
}): string {
  const {
    userName = "the user",
    mode,
    focus,
    userRole = "user",
    styleProfile,
    ragContext,
    memories,
    suitabilityCompleted,
    productContext,
    userProfileData,
    professionalContext,
    managementContext,
    enrichmentData,
    affiliatedShelf,
  } = opts;

  const parts: string[] = [];

  // ── CORE ROLE (Focus-Aware) ──────────────────────────────────
  parts.push(`<role>You are an intelligent AI advisor serving ${userName} across two dimensions:

GENERAL: A universal, open-ended advisory dimension. When this is active, engage with whatever the user brings — no topic restrictions, no predefined domain structure. Be a genuine thinking partner across all of life.

FINANCIAL: A dedicated financial advisory dimension covering insurance planning, investing, financial planning, estate planning, and premium financing at full depth.

The user's current focus mode is: ${focus}
${focus === "both" ? '- "both": Equal weight across both dimensions. Lead with highest-impact insight regardless of domain. Proactively connect life context to financial implications and vice versa.' : ""}
${focus === "general" ? '- "general": Lead with open, universal engagement. No topic structure imposed. Surface financial context only when the user raises something with a genuine financial dimension — briefly and naturally.' : ""}
${focus === "financial" ? '- "financial": Lead with financial analysis at full depth. Use whatever the user shares about their life as context to personalize financial recommendations. Keep responses anchored in financial planning.' : ""}
</role>`);

  // ── PERSONAL STYLE ────────────────────────────────────────────
  if (styleProfile) {
    parts.push(`<personal_style>Communication preferences and style profile for ${userName}:\n${styleProfile}</personal_style>`);
  }

  // ── ADVISORY MODE (Role-gated) ────────────────────────────────
  if (mode === "client") {
    parts.push(`<advisory_mode>CLIENT ADVISOR MODE: You are speaking directly to a client. Use clear, accessible language. Avoid jargon unless the client demonstrates familiarity. Focus on education, transparency, and building trust. Always explain the "why" behind recommendations.</advisory_mode>`);
  } else if (mode === "coach") {
    parts.push(`<advisory_mode>PROFESSIONAL COACH MODE: You are coaching a financial professional. Use industry terminology freely. Focus on strategy, best practices, sales techniques, and professional development. Challenge assumptions constructively. Share advanced insights.</advisory_mode>`);
  } else {
    parts.push(`<advisory_mode>MANAGER DASHBOARD MODE: You are briefing a team manager. Provide high-level summaries, KPIs, team performance insights, and strategic recommendations. Focus on actionable intelligence and operational efficiency. Use data-driven language.</advisory_mode>`);
  }

  // ── DATA LAYERING (All Focus Modes) ───────────────────────────
  // AI generates insights by layering data sources in order of specificity
  const dataLayers: string[] = [];
  if (userProfileData) dataLayers.push(`1. User-provided personal data (highest specificity):\n${userProfileData}`);
  if (professionalContext) dataLayers.push(`2. Professional-added context:\n${professionalContext}`);
  if (managementContext) dataLayers.push(`3. Management-added context:\n${managementContext}`);
  if (enrichmentData) dataLayers.push(`4. Enrichment cohort match data:\n${enrichmentData}`);
  dataLayers.push("5. General population defaults — baseline used only when no other data is available");

  if (dataLayers.length > 1) {
    parts.push(`<data_layers>Generate insights by layering data sources in order of specificity:\n${dataLayers.join("\n\n")}

When an insight derives primarily from enrichment data rather than personal input, label it clearly (ESTIMATED) and invite the user to confirm or correct the assumption. Transparency about data sourcing is a core principle.</data_layers>`);
  }

  // ── FOCUS-SPECIFIC EXPERTISE ──────────────────────────────────
  if (focus === "financial" || focus === "both") {
    parts.push(`<financial_expertise>
You have deep expertise in:
- Life insurance products: IUL, term life, whole life, variable life, disability, LTC
- Premium finance strategies and ROI analysis
- Retirement planning and wealth accumulation
- Tax-advantaged strategies, estate planning, business succession
- SEC/FINRA compliance requirements for AI-assisted advisory
${productContext ? `\n<product_catalog>${productContext}</product_catalog>` : ""}
${affiliatedShelf ? `\n<affiliated_resources>${affiliatedShelf}</affiliated_resources>` : ""}
</financial_expertise>`);
  }

  if (focus === "general" || focus === "both") {
    parts.push(`<general_expertise>
You have broad expertise across:
- Technology, software, AI/ML, data science, and engineering
- Business strategy, entrepreneurship, marketing, and operations
- Science, health, wellness, and evidence-based practices
- Creative writing, communication, and content strategy
- Research methodology, analysis, and critical thinking
- Productivity, project management, and workflow optimization
- Education, learning techniques, and skill development
</general_expertise>`);
  }

  // ── CROSS-DOMAIN INTELLIGENCE ─────────────────────────────────
  if (focus === "both") {
    parts.push(`<cross_domain>Proactively identify and surface connections between what the user is experiencing generally and any financial implications, and vice versa. These connections are offered as contextual observations, not redirections. Examples:
- New baby → life insurance gap + estate planning need + support for the life transition
- Business launch → key-person insurance + buy-sell planning + broader life implications
- Career change → income gap analysis + emergency fund review + decision exploration
- Health diagnosis → insurance review + financial contingency + practical guidance</cross_domain>`);
  }

  // ── RAG CONTEXT ───────────────────────────────────────────────
  if (ragContext) {
    parts.push(`<knowledge>Relevant excerpts from ${userName}'s personal knowledge base:\n${ragContext}</knowledge>`);
  }

  // ── MEMORIES ──────────────────────────────────────────────────
  if (memories) {
    parts.push(`<memories>Key facts and context about ${userName}:\n${memories}</memories>`);
  }

  // ── COMPLIANCE ────────────────────────────────────────────────
  const disclaimers: string[] = [];
  if (focus === "financial" || focus === "both") {
    const suitabilityNote = suitabilityCompleted
      ? "The user has completed their suitability assessment. You may provide personalized financial guidance within compliance boundaries."
      : "IMPORTANT: The user has NOT completed a suitability assessment. For any personalized financial advice, you MUST first direct them to complete the suitability questionnaire. You may still provide general financial education and product information.";

    disclaimers.push(`Financial compliance:
- ${suitabilityNote}
- NEVER provide personalized investment or insurance advice without a completed suitability assessment
- ALWAYS append appropriate disclaimers to financial guidance
- Flag ALL specific financial recommendations for human advisor review
- Do NOT guarantee returns or make promises about financial outcomes`);
  }

  if (focus === "general" || focus === "both") {
    disclaimers.push(`General compliance:
- For personal reflection and informational purposes
- Not a substitute for professional medical, psychological, legal, or other specialized advice
- When uncertain, acknowledge limitations and recommend consulting a professional`);
  }

  if (disclaimers.length > 0) {
    parts.push(`<compliance>\n${disclaimers.join("\n\n")}\n</compliance>`);
  }

  // ── RESPONSE GUIDELINES ───────────────────────────────────────
  parts.push(`<guidelines>
- Honor the active focus mode in ordering and depth
- Be thorough but concise — respect the user's time
- Use markdown formatting for readability (headers, lists, bold, tables)
- When providing financial calculations, show your work
- Label enrichment-derived assumptions clearly (ESTIMATED) and invite confirmation warmly
- Surface the top 3-5 most impactful insights or actions first
- Be warm, empowering, and plain-language throughout
- Proactively surface relevant information from the user's knowledge base when applicable
- If you don't know something, say so honestly rather than speculating
- Maintain conversation continuity — reference prior context when relevant
</guidelines>`);

  return parts.join("\n\n");
}

/**
 * Compliance disclaimer appended to financial responses
 */
export const FINANCIAL_DISCLAIMER = `\n\n---\n*This information is for educational purposes only and does not constitute personalized financial, investment, or insurance advice. Consult with a licensed financial professional before making any financial decisions. Past performance does not guarantee future results.*`;

/**
 * General disclaimer
 */
export const GENERAL_DISCLAIMER = `\n\n---\n*For personal reflection and informational purposes. Not a substitute for professional medical, psychological, legal, or other specialized advice.*`;

/**
 * Check if a response likely contains financial advice that needs a disclaimer
 */
export function needsFinancialDisclaimer(content: string, focus: FocusMode): boolean {
  if (focus === "general") return false;
  const financialKeywords = [
    "recommend", "should invest", "should consider", "premium", "policy",
    "iul", "annuity", "retirement", "portfolio", "insurance", "coverage",
    "death benefit", "cash value", "rate of return", "tax advantage",
    "wealth", "estate plan", "beneficiary", "suitability"
  ];
  const lower = content.toLowerCase();
  return financialKeywords.some(kw => lower.includes(kw));
}

/**
 * Simple PII detection for stripping before logging
 */
export function detectPII(text: string): { hasPII: boolean; types: string[] } {
  const types: string[] = [];
  if (/\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/.test(text)) types.push("SSN");
  if (/\b\d{16}\b/.test(text)) types.push("credit_card");
  if (/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(text)) types.push("email");
  if (/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(text)) types.push("phone");
  if (/\b\d{1,5}\s+\w+\s+(street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct)\b/i.test(text)) types.push("address");
  return { hasPII: types.length > 0, types };
}

/**
 * Strip PII from text for audit logging
 */
export function stripPII(text: string): string {
  let cleaned = text;
  cleaned = cleaned.replace(/\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g, "[SSN_REDACTED]");
  cleaned = cleaned.replace(/\b\d{16}\b/g, "[CARD_REDACTED]");
  cleaned = cleaned.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[PHONE_REDACTED]");
  return cleaned;
}

/**
 * Calculate confidence score for a response
 */
export function calculateConfidence(opts: {
  hasRAGContext: boolean;
  hasSuitability: boolean;
  focus: FocusMode;
  isFinancialAdvice: boolean;
  responseLength: number;
}): number {
  let score = 0.7;
  if (opts.hasRAGContext) score += 0.1;
  if (opts.hasSuitability && opts.isFinancialAdvice) score += 0.1;
  if (!opts.hasSuitability && opts.isFinancialAdvice) score -= 0.2;
  if (opts.focus === "both") score -= 0.05;
  if (opts.responseLength > 2000) score += 0.05;
  return Math.max(0.1, Math.min(1.0, score));
}

/**
 * Parse professional context injection into structured fields using AI
 */
export function buildContextInjectionPrompt(rawInput: string, clientSummary: string, focusMode: FocusMode): string {
  return `A financial professional has entered free-text context about their client. Parse it into structured fields across all applicable domains — financial, general, or both as relevant. Confirm your interpretation and flag ambiguities before saving.

Professional input: ${rawInput}
Client profile summary: ${clientSummary}
Client focus mode: ${focusMode}

Return a JSON object with:
- parsedFields: object organized by applicable domain
- confidenceLevels: object with confidence per field (high/medium/low)
- clarifyingQuestions: array of questions for ambiguous inputs
- impactAssessment: which insight areas will this most affect
- suggestedFollowUp: what the professional could explore with the client`;
}
