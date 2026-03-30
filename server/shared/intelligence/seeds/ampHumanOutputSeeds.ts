/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AMP & Human Output — Platform Knowledge Base Seeds
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Seeds the platform-layer knowledge base with foundational content about:
 *   - Adaptive Mastery Pathway (AMP) — 6-phase learning progression
 *   - Human Output Framework — 10-domain human development model
 *
 * These seeds ensure every project using @platform/intelligence has access
 * to the AMP and Human Output frameworks as contextual knowledge.
 *
 * Schema compatibility:
 *   The KnowledgeBaseSeed interface uses platform-agnostic field names.
 *   The Stewardly-specific seedStewardlyKnowledgeBase() maps these to the
 *   actual knowledgeArticles table columns (category, contentType, source, active).
 */

export interface KnowledgeBaseSeed {
  title: string;
  content: string;
  category: string;
  subcategory?: string;
  contentType: "process" | "concept" | "reference" | "template" | "faq" | "policy" | "guide";
  source: "manual" | "ingested" | "ai_generated" | "conversation_mining";
}

// ─── AMP SEEDS ───────────────────────────────────────────────────────────────

export const AMP_SEEDS: KnowledgeBaseSeed[] = [
  {
    title: "Adaptive Mastery Pathway (AMP) — Overview",
    category: "amp_framework",
    subcategory: "overview",
    contentType: "concept",
    source: "manual",
    content: `The Adaptive Mastery Pathway (AMP) is a 6-phase learning progression framework that guides users from initial orientation through mastery and continuous refinement. Each phase adapts its AI tier, time allocation, and coaching intensity based on the user's demonstrated competency and engagement patterns.

The six phases are:
1. Orientation — Initial onboarding, goal setting, and baseline assessment. Uses fast-tier AI for quick responses. Target: 10 minutes.
2. Foundation — Core concept building and knowledge scaffolding. Uses balanced-tier AI. Target: 20 minutes.
3. Guided Practice — Structured exercises with real-time AI feedback. Uses balanced-tier AI. Target: 25 minutes.
4. Independent Application — Self-directed work with AI available on demand. Uses deep-tier AI for complex analysis. Target: 30 minutes.
5. Mastery Assessment — Competency evaluation and gap identification. Uses deep-tier AI for nuanced assessment. Target: 15 minutes.
6. Continuous Refinement — Ongoing optimization and advanced skill development. Uses balanced-tier AI. Target: 10 minutes.

Phase transitions are triggered by engagement signals (amp_engagement memory category), competency demonstrations, and time-on-task metrics. The system tracks momentum and can accelerate or decelerate progression based on individual performance.`,
  },
  {
    title: "AMP Phase 1 — Orientation",
    category: "amp_framework",
    subcategory: "phase1",
    contentType: "guide",
    source: "manual",
    content: `Orientation is the entry point of the Adaptive Mastery Pathway. During this phase, the AI:
- Assesses the user's current knowledge level through conversational probing
- Establishes learning goals aligned with the user's stated objectives
- Creates a baseline competency profile across relevant domains
- Sets expectations for the learning journey ahead
- Introduces key concepts at a high level

The AI tier for Orientation is "fast" — prioritizing responsiveness and engagement over depth. The target duration is 10 minutes, though this adapts based on user complexity.

Transition criteria to Foundation: User has articulated at least one clear learning goal, baseline assessment is complete, and the user has demonstrated basic comprehension of the domain scope.`,
  },
  {
    title: "AMP Phase 2 — Foundation",
    category: "amp_framework",
    subcategory: "phase2",
    contentType: "guide",
    source: "manual",
    content: `Foundation is where core knowledge scaffolding occurs. During this phase, the AI:
- Delivers structured content organized by prerequisite dependencies
- Uses spaced repetition principles to reinforce key concepts
- Adapts explanation complexity to the user's demonstrated comprehension
- Introduces domain-specific vocabulary and mental models
- Builds connections between new concepts and the user's existing knowledge

The AI tier for Foundation is "balanced" — providing thorough explanations while maintaining engagement. Target duration: 20 minutes.

Transition criteria to Guided Practice: User demonstrates comprehension of core concepts (>70% accuracy on check questions), can articulate key principles in their own words, and shows readiness for application.`,
  },
  {
    title: "AMP Phase 3 — Guided Practice",
    category: "amp_framework",
    subcategory: "phase3",
    contentType: "guide",
    source: "manual",
    content: `Guided Practice provides structured exercises with real-time AI feedback. During this phase, the AI:
- Presents progressively challenging scenarios and problems
- Provides immediate, specific feedback on user responses
- Offers hints and scaffolding when the user struggles
- Tracks error patterns to identify persistent misconceptions
- Celebrates progress and maintains motivation

The AI tier is "balanced" with emphasis on responsive feedback loops. Target duration: 25 minutes.

Transition criteria to Independent Application: User achieves >80% accuracy on practice exercises, demonstrates ability to self-correct with minimal hints, and shows confidence in applying concepts.`,
  },
  {
    title: "AMP Phase 4 — Independent Application",
    category: "amp_framework",
    subcategory: "phase4",
    contentType: "guide",
    source: "manual",
    content: `Independent Application is where users apply knowledge to real-world scenarios with AI available on demand. During this phase, the AI:
- Steps back to an advisory role rather than leading
- Responds to user-initiated questions with deep, nuanced analysis
- Provides complex scenario analysis when requested
- Tracks self-directed learning patterns
- Identifies areas where the user may need additional support

The AI tier is "deep" — providing thorough, expert-level analysis when consulted. Target duration: 30 minutes.

Transition criteria to Mastery Assessment: User has completed at least 3 independent application exercises, demonstrates consistent accuracy without AI assistance, and shows ability to handle edge cases.`,
  },
  {
    title: "AMP Phase 5 — Mastery Assessment",
    category: "amp_framework",
    subcategory: "phase5",
    contentType: "guide",
    source: "manual",
    content: `Mastery Assessment evaluates competency and identifies remaining gaps. During this phase, the AI:
- Administers comprehensive competency evaluations
- Tests both knowledge recall and application ability
- Identifies specific gaps for targeted remediation
- Provides detailed performance analytics
- Generates a mastery profile across all assessed domains

The AI tier is "deep" for nuanced evaluation. Target duration: 15 minutes.

Transition criteria to Continuous Refinement: User achieves mastery threshold (>85% across all assessed areas), or specific remediation plan is created for remaining gaps.`,
  },
  {
    title: "AMP Phase 6 — Continuous Refinement",
    category: "amp_framework",
    subcategory: "phase6",
    contentType: "guide",
    source: "manual",
    content: `Continuous Refinement is the ongoing optimization phase. During this phase, the AI:
- Monitors for knowledge decay and triggers refreshers
- Introduces advanced concepts and edge cases
- Connects mastered domains to new learning opportunities
- Tracks long-term trajectory via ho_domain_trajectory memory category
- Adapts coaching frequency based on engagement patterns

The AI tier is "balanced" for efficient ongoing support. Target duration: 10 minutes per session.

This phase has no exit criteria — it continues indefinitely, with the user cycling back to earlier phases if significant new content is introduced or if knowledge decay is detected.`,
  },
];

// ─── HUMAN OUTPUT SEEDS ──────────────────────────────────────────────────────

export const HUMAN_OUTPUT_SEEDS: KnowledgeBaseSeed[] = [
  {
    title: "Human Output Framework — Overview",
    category: "human_output_framework",
    subcategory: "overview",
    contentType: "concept",
    source: "manual",
    content: `The Human Output Framework is a 10-domain model for holistic human development and performance optimization. Each domain represents a critical dimension of human capability that can be measured, tracked, and improved through targeted coaching and practice.

The 10 domains are:
1. Critical Thinking & Decision Making — Analytical reasoning, cognitive bias awareness, evidence-based judgment
2. Emotional Intelligence & Relationships — Self-awareness, empathy, social skills, conflict resolution
3. Communication & Influence — Written and verbal clarity, persuasion, active listening, public speaking
4. Creativity & Innovation — Divergent thinking, problem reframing, ideation, creative confidence
5. Leadership & Management — Team building, delegation, vision setting, accountability
6. Physical Health & Energy — Exercise, nutrition, sleep, stress management, energy optimization
7. Financial Acumen — Budgeting, investing, risk assessment, financial planning, wealth building
8. Technical Mastery — Domain-specific technical skills, tool proficiency, continuous learning
9. Strategic Vision & Planning — Long-term thinking, goal setting, resource allocation, scenario planning
10. Resilience & Adaptability — Stress tolerance, change management, recovery, growth mindset

Each domain is scored on a 0-1 scale, with target scores and coaching frequencies configurable per AI layer. The framework tracks trajectory over time via the ho_domain_trajectory memory category, enabling personalized development recommendations.`,
  },
  {
    title: "Human Output — Critical Thinking & Decision Making",
    category: "human_output_framework",
    subcategory: "critical_thinking",
    contentType: "concept",
    source: "manual",
    content: `Critical Thinking & Decision Making encompasses the ability to analyze information objectively, identify cognitive biases, evaluate evidence, and make sound judgments under uncertainty.

Key competencies:
- Logical reasoning and argument evaluation
- Cognitive bias recognition (confirmation bias, anchoring, availability heuristic, etc.)
- Evidence-based decision frameworks (expected value, decision trees, pre-mortem analysis)
- First-principles thinking
- Bayesian updating of beliefs based on new information

Coaching approach: Present real-world scenarios requiring analysis, challenge assumptions, introduce decision frameworks, and track improvement in decision quality over time. The AI should model good reasoning rather than just providing answers.

Assessment indicators: Quality of questions asked, ability to identify unstated assumptions, consistency of reasoning across similar problems, willingness to update views when presented with contrary evidence.`,
  },
  {
    title: "Human Output — Emotional Intelligence & Relationships",
    category: "human_output_framework",
    subcategory: "emotional_intelligence",
    contentType: "concept",
    source: "manual",
    content: `Emotional Intelligence & Relationships covers self-awareness, empathy, social skills, and the ability to build and maintain meaningful personal and professional relationships.

Key competencies:
- Self-awareness: recognizing own emotions, triggers, and patterns
- Self-regulation: managing emotional responses constructively
- Empathy: understanding others' perspectives and emotional states
- Social skills: building rapport, navigating social dynamics, conflict resolution
- Relationship maintenance: investment, boundaries, reciprocity

Coaching approach: Reflect emotional patterns observed in conversations, suggest perspective-taking exercises, model empathetic communication, and track relationship health indicators over time.

Assessment indicators: Emotional vocabulary range, frequency of perspective-taking, conflict resolution approach, quality of described relationships.`,
  },
  {
    title: "Human Output — Communication & Influence",
    category: "human_output_framework",
    subcategory: "communication",
    contentType: "concept",
    source: "manual",
    content: `Communication & Influence encompasses written and verbal clarity, persuasion, active listening, storytelling, and the ability to convey complex ideas effectively.

Key competencies:
- Clear, concise written communication
- Structured verbal presentation
- Active listening and question formulation
- Persuasion and influence techniques
- Storytelling and narrative construction
- Audience adaptation

Coaching approach: Analyze communication patterns in user messages, suggest improvements to clarity and structure, introduce persuasion frameworks, and practice audience-adapted communication.

Assessment indicators: Message clarity scores, question quality, ability to summarize complex topics, evidence of audience awareness.`,
  },
  {
    title: "Human Output — Financial Acumen",
    category: "human_output_framework",
    subcategory: "financial_acumen",
    contentType: "concept",
    source: "manual",
    content: `Financial Acumen covers the knowledge and skills needed to make sound financial decisions, including budgeting, investing, risk assessment, tax optimization, and long-term wealth building.

Key competencies:
- Personal budgeting and cash flow management
- Investment fundamentals (asset classes, diversification, risk-return tradeoff)
- Tax optimization strategies
- Insurance and risk management
- Retirement planning and compound growth
- Debt management and credit optimization
- Estate planning basics

Coaching approach: Assess current financial literacy level, introduce concepts progressively, use real portfolio data (via integrations) for personalized guidance, and track improvement in financial decision quality.

Assessment indicators: Quality of financial questions asked, understanding of risk-return tradeoffs, evidence of financial planning behavior, portfolio diversification awareness.`,
  },
];

// ─── SEED FUNCTION ───────────────────────────────────────────────────────────

/**
 * Seed AMP and Human Output content into the platform knowledge base.
 *
 * @param insertArticle - Project-specific function to insert a knowledge article.
 */
export async function seedAMPHumanOutputContent(
  insertArticle: (seed: KnowledgeBaseSeed) => Promise<void>,
): Promise<{ seeded: number; skipped: number }> {
  const allSeeds = [...AMP_SEEDS, ...HUMAN_OUTPUT_SEEDS];
  let seeded = 0;
  let skipped = 0;

  for (const seed of allSeeds) {
    try {
      await insertArticle(seed);
      seeded++;
    } catch (err: any) {
      // Skip duplicates — MySQL uses error code 1062 for unique constraint violations
      if (
        err?.code === "23505" ||
        err?.code === "ER_DUP_ENTRY" ||
        err?.errno === 1062 ||
        err?.message?.includes("duplicate") ||
        err?.message?.includes("Duplicate entry")
      ) {
        skipped++;
      } else {
        throw err;
      }
    }
  }

  return { seeded, skipped };
}

/**
 * Stewardly-specific seed function that inserts into the knowledgeArticles table.
 *
 * Maps the platform-agnostic KnowledgeBaseSeed fields to the actual
 * knowledgeArticles schema:
 *   - category → category
 *   - subcategory → subcategory
 *   - contentType → contentType (enum: process|concept|reference|template|faq|policy|guide)
 *   - source → source (enum: manual|ingested|ai_generated|conversation_mining)
 *   - active defaults to true
 */
export async function seedStewardlyKnowledgeBase(): Promise<{ seeded: number; skipped: number }> {
  const { getDb } = await import("../../../db");
  const { knowledgeArticles } = await import("../../../../drizzle/schema");

  const db = await getDb();
  if (!db) return { seeded: 0, skipped: 0 };

  return seedAMPHumanOutputContent(async (seed) => {
    await db.insert(knowledgeArticles).values({
      title: seed.title,
      content: seed.content,
      category: seed.category,
      subcategory: seed.subcategory ?? null,
      contentType: seed.contentType,
      source: seed.source,
      active: true,
    });
  });
}
