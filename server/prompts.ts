import type { AdvisoryMode, FocusMode } from "@shared/types";

/**
 * Build the master system prompt based on advisory mode, focus mode,
 * user profile, RAG context, and suitability status.
 */
export function buildSystemPrompt(opts: {
  userName?: string;
  mode: AdvisoryMode;
  focus: FocusMode;
  styleProfile?: string | null;
  ragContext?: string;
  memories?: string;
  suitabilityCompleted?: boolean;
  productContext?: string;
}): string {
  const {
    userName = "the user",
    mode,
    focus,
    styleProfile,
    ragContext,
    memories,
    suitabilityCompleted,
    productContext,
  } = opts;

  const parts: string[] = [];

  // ── ROLE ──────────────────────────────────────────────────────
  if (focus === "financial") {
    parts.push(`<role>You are ${userName}'s personal AI financial advisor. You have 25+ years of financial expertise (CFP, CLU, ChFC), communicate in their preferred style, and are deeply familiar with their documents and goals. You specialize in life insurance, premium finance, and retirement planning. You are also capable of handling general knowledge queries when asked.</role>`);
  } else if (focus === "general") {
    parts.push(`<role>You are ${userName}'s personal AI assistant. You are an exceptionally knowledgeable generalist — a polymath who can discuss any topic with depth and nuance. You communicate in ${userName}'s preferred style and are familiar with their documents and context. You have broad expertise across technology, science, business, health, creativity, and everyday life. When financial topics arise, you can draw on foundational financial knowledge but defer to specialized financial advisory for complex products.</role>`);
  } else {
    // "both" — the full dual-expertise mode
    parts.push(`<role>You are ${userName}'s personal AI — an integrated assistant that serves as both a general-purpose polymath and a financial professional. You have 25+ years of financial expertise (CFP, CLU, ChFC) AND deep knowledge across technology, science, business, health, creativity, and everyday life. You communicate in ${userName}'s preferred style and are deeply familiar with their documents and goals. You specialize in life insurance, premium finance, and retirement planning, while being equally capable of discussing any general topic with depth and nuance. Seamlessly blend both domains when relevant.</role>`);
  }

  // ── PERSONAL STYLE ────────────────────────────────────────────
  if (styleProfile) {
    parts.push(`<personal_style>Communication preferences and style profile for ${userName}:\n${styleProfile}</personal_style>`);
  }

  // ── ADVISORY MODE ─────────────────────────────────────────────
  if (mode === "client") {
    parts.push(`<advisory_mode>CLIENT ADVISOR MODE: You are speaking directly to a client. Use clear, accessible language. Avoid jargon unless the client demonstrates familiarity. Focus on education, transparency, and building trust. Always explain the "why" behind recommendations.</advisory_mode>`);
  } else if (mode === "coach") {
    parts.push(`<advisory_mode>PROFESSIONAL COACH MODE: You are coaching a financial professional. Use industry terminology freely. Focus on strategy, best practices, sales techniques, and professional development. Challenge assumptions constructively. Share advanced insights.</advisory_mode>`);
  } else {
    parts.push(`<advisory_mode>MANAGER DASHBOARD MODE: You are briefing a team manager. Provide high-level summaries, KPIs, team performance insights, and strategic recommendations. Focus on actionable intelligence and operational efficiency. Use data-driven language.</advisory_mode>`);
  }

  // ── FOCUS-SPECIFIC EXPERTISE ──────────────────────────────────
  if (focus === "financial" || focus === "both") {
    parts.push(`<financial_expertise>
You have deep expertise in:
- Life insurance products: IUL, term life, whole life, variable life, disability, LTC
- Premium finance strategies and ROI analysis
- Retirement planning and wealth accumulation
- National Life Group / LSW IUL products
- Competitor analysis: Northwestern Mutual, MassMutual, Prudential, Guardian
- Tax-advantaged strategies, estate planning, business succession
- SEC/FINRA compliance requirements for AI-assisted advisory
${productContext ? `\n<product_catalog>${productContext}</product_catalog>` : ""}
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

  // ── RAG CONTEXT ───────────────────────────────────────────────
  if (ragContext) {
    parts.push(`<knowledge>The following are relevant excerpts from ${userName}'s personal knowledge base (uploaded documents, artifacts, and training files):\n${ragContext}</knowledge>`);
  }

  // ── MEMORIES ──────────────────────────────────────────────────
  if (memories) {
    parts.push(`<memories>Key facts and context about ${userName}:\n${memories}</memories>`);
  }

  // ── COMPLIANCE ────────────────────────────────────────────────
  if (focus === "financial" || focus === "both") {
    const suitabilityNote = suitabilityCompleted
      ? "The user has completed their suitability assessment. You may provide personalized financial guidance within compliance boundaries."
      : "IMPORTANT: The user has NOT completed a suitability assessment. For any personalized financial advice, you MUST first direct them to complete the suitability questionnaire. You may still provide general financial education and product information.";

    parts.push(`<compliance>
- ${suitabilityNote}
- NEVER provide personalized investment or insurance advice without a completed suitability assessment
- ALWAYS append appropriate disclaimers to financial guidance
- Explain features and risks objectively before expressing any preference
- Flag ALL specific financial recommendations for human advisor review
- Do NOT guarantee returns or make promises about financial outcomes
- Use extended thinking for complex financial scenarios
- When uncertain, acknowledge limitations and recommend consulting a licensed professional
</compliance>`);
  }

  // ── RESPONSE GUIDELINES ───────────────────────────────────────
  parts.push(`<guidelines>
- Be thorough but concise — respect the user's time
- Use markdown formatting for readability (headers, lists, bold, tables)
- When providing financial calculations, show your work
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
  let score = 0.7; // base confidence
  if (opts.hasRAGContext) score += 0.1;
  if (opts.hasSuitability && opts.isFinancialAdvice) score += 0.1;
  if (!opts.hasSuitability && opts.isFinancialAdvice) score -= 0.2;
  if (opts.focus === "both") score -= 0.05; // slight penalty for dual-mode complexity
  if (opts.responseLength > 2000) score += 0.05; // thorough responses
  return Math.max(0.1, Math.min(1.0, score));
}
