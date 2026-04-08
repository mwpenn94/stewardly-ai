/**
 * EMBA Learning — ReAct agent tool registration (Task 2B + 5D + 7D).
 *
 * This module registers the learning-specific tools in the
 * `aiToolsRegistry` so the ReAct agent can reason about licensure,
 * SRS mastery, and content authoring alongside wealth planning.
 *
 * Tools exposed to the agent:
 *   - check_license_status       (Task 2B)
 *   - recommend_study_content    (Task 2B + 5C)
 *   - assess_readiness           (Task 2B)
 *   - generate_study_plan        (Task 2B)
 *   - explain_concept            (Task 5D)
 *   - quiz_me                    (Task 5D)
 *   - check_exam_readiness       (Task 5D)
 *   - generate_flashcards        (Task 7D)
 *   - generate_practice_questions (Task 7D)
 *   - suggest_content_improvements (Task 7D)
 *   - draft_definition           (Task 7D)
 *
 * Registration is idempotent — existing tool rows (matched by name)
 * are not duplicated. Called once at server startup (see
 * server/services/learning/bootstrap.ts).
 */

import { registerTool, getToolByName } from "../aiToolsRegistry";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "learning/agentTools" });

export interface LearningToolDef {
  toolName: string;
  toolType: "calculator" | "model" | "action" | "query" | "report";
  description: string;
  inputSchema: any;
  trpcProcedure: string;
}

export const LEARNING_AGENT_TOOLS: LearningToolDef[] = [
  {
    toolName: "check_license_status",
    toolType: "query",
    description:
      "Check a user's license status, CE progress, and upcoming deadlines. Returns every license on file with expiration days-out, CE credits remaining, and any active alerts.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    trpcProcedure: "learning.licenses.alerts",
  },
  {
    toolName: "recommend_study_content",
    toolType: "query",
    description:
      "Recommend what the user should study next based on SRS weak items, upcoming exams, CE requirements, and recent calculator usage patterns. Returns a prioritized list with reasoning.",
    inputSchema: {
      type: "object",
      properties: {
        recentCalculators: {
          type: "array",
          items: { type: "string" },
          description: "Names of calculators the user touched recently (e.g. 'rothExplorer', 'stressTest')",
        },
      },
      required: [],
    },
    trpcProcedure: "learning.recommendations.forMe",
  },
  {
    toolName: "assess_readiness",
    toolType: "query",
    description:
      "Assess whether a user is ready for a specific license exam based on mastery data and practice test scores. Returns readiness score (0-1), weak areas, and estimated prep time.",
    inputSchema: {
      type: "object",
      properties: {
        trackSlug: {
          type: "string",
          description: "Slug of the exam track (e.g. 'series7', 'cfp', 'life_health')",
        },
      },
      required: ["trackSlug"],
    },
    trpcProcedure: "learning.mastery.assessReadiness",
  },
  {
    toolName: "generate_study_plan",
    toolType: "action",
    description:
      "Create a personalized study plan for an exam or CE requirement with daily targets based on current mastery and available time window.",
    inputSchema: {
      type: "object",
      properties: {
        licenseType: { type: "string" },
        targetDate: { type: "string", format: "date-time" },
      },
      required: ["licenseType"],
    },
    trpcProcedure: "learning.recommendations.forMe",
  },
  {
    toolName: "explain_concept",
    toolType: "query",
    description:
      "Explain a financial concept from the EMBA knowledge base. Searches definitions, formulas, and cases and returns a structured explanation with cross-references.",
    inputSchema: {
      type: "object",
      properties: {
        concept: { type: "string" },
      },
      required: ["concept"],
    },
    trpcProcedure: "learning.content.explain",
  },
  {
    toolName: "quiz_me",
    toolType: "action",
    description:
      "Generate a quiz question on a specific topic, discipline, or track. Returns an interactive multiple-choice question the agent can pose inline.",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string" },
        discipline: { type: "string" },
        difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
        trackId: { type: "number" },
      },
      required: [],
    },
    trpcProcedure: "learning.content.listQuestions",
  },
  {
    toolName: "check_exam_readiness",
    toolType: "query",
    description:
      "Assess readiness for a specific license exam (alias for assess_readiness with a licensure-friendly interface).",
    inputSchema: {
      type: "object",
      properties: {
        exam: {
          type: "string",
          description: "Exam slug or name (e.g. 'series7', 'Series 7', 'cfp')",
        },
      },
      required: ["exam"],
    },
    trpcProcedure: "learning.mastery.assessReadiness",
  },
  {
    toolName: "generate_flashcards",
    toolType: "action",
    description:
      "Auto-generate flashcards from a chapter or topic using the LLM. Saves as draft (source='ai_generated') for user review before publishing.",
    inputSchema: {
      type: "object",
      properties: {
        trackId: { type: "number" },
        chapterId: { type: "number" },
        count: { type: "number", minimum: 1, maximum: 50 },
      },
      required: ["trackId", "count"],
    },
    trpcProcedure: "learning.content.createFlashcard",
  },
  {
    toolName: "generate_practice_questions",
    toolType: "action",
    description:
      "Auto-generate practice questions from content using the LLM with options, correct answer, and explanation. Saves as draft for user review.",
    inputSchema: {
      type: "object",
      properties: {
        trackId: { type: "number" },
        topics: { type: "array", items: { type: "string" } },
        difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
        count: { type: "number", minimum: 1, maximum: 50 },
      },
      required: ["trackId", "count"],
    },
    trpcProcedure: "learning.content.createQuestion",
  },
  {
    toolName: "suggest_content_improvements",
    toolType: "query",
    description:
      "Analyze existing content (quiz failure rates, SRS patterns, search-but-not-found queries, outdated references) and suggest prioritized improvements.",
    inputSchema: {
      type: "object",
      properties: {
        trackId: { type: "number" },
        disciplineId: { type: "number" },
      },
      required: [],
    },
    trpcProcedure: "learning.freshness.pendingUpdates",
  },
  {
    toolName: "draft_definition",
    toolType: "action",
    description:
      "Draft a definition for a financial term using the LLM + existing knowledge base context. Checks for duplicates and returns a reviewable draft.",
    inputSchema: {
      type: "object",
      properties: {
        term: { type: "string" },
        discipline: { type: "string" },
      },
      required: ["term"],
    },
    trpcProcedure: "learning.content.createDefinition",
  },
];

export async function registerLearningAgentTools(): Promise<{ registered: number; skipped: number }> {
  let registered = 0;
  let skipped = 0;
  for (const def of LEARNING_AGENT_TOOLS) {
    try {
      const existing = await getToolByName(def.toolName);
      if (existing) {
        skipped += 1;
        continue;
      }
      const result = await registerTool({
        toolName: def.toolName,
        toolType: def.toolType,
        description: def.description,
        inputSchema: def.inputSchema,
        trpcProcedure: def.trpcProcedure,
        requiresAuth: true,
      });
      if (result) registered += 1;
    } catch (err) {
      log.warn({ err: String(err), tool: def.toolName }, "registerLearningAgentTools: tool registration failed");
    }
  }
  log.info({ registered, skipped, total: LEARNING_AGENT_TOOLS.length }, "registerLearningAgentTools complete");
  return { registered, skipped };
}
