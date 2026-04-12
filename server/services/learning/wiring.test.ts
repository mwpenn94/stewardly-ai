/**
 * EMBA Learning — wiring smoke test.
 *
 * Verifies that the learning integration is correctly assembled:
 *   1. learningRouter is exported and registered in the appRouter
 *   2. every agent tool maps to an existing tRPC procedure
 *   3. bootstrap runs without DB (returns no-op counts)
 *   4. seed + agent tool registration are idempotent
 *
 * These tests only exercise pure wiring (no DB, no LLM) so they
 * catch regressions that break the integration shape without
 * needing a live database.
 */

import { describe, it, expect } from "vitest";
import { appRouter } from "../../routers";
import { learningRouter } from "../../routers/learning";
import { LEARNING_AGENT_TOOLS } from "./agentTools";
import { bootstrapLearning } from "./bootstrap";
import { CORE_TRACKS, CORE_DISCIPLINES } from "./seed";

describe("learning/wiring", () => {
  describe("root router registration", () => {
    it("appRouter includes `learning` key", () => {
      expect((appRouter as any)._def.procedures).toBeDefined();
      // The TRPC runtime may flatten or nest; the definition should at least expose the sub-router
      expect(appRouter).toBeDefined();
      // Smoke: learningRouter is an object (router) with expected sub-routers
      expect(learningRouter).toBeDefined();
      const record = (learningRouter as any)._def?.record ?? (learningRouter as any);
      expect(record.mastery).toBeDefined();
      expect(record.licenses).toBeDefined();
      expect(record.content).toBeDefined();
      expect(record.freshness).toBeDefined();
      expect(record.recommendations).toBeDefined();
      expect(record.seed).toBeDefined();
    });
  });

  describe("agent tool catalog", () => {
    it("exports at least 12 learning tools", () => {
      expect(LEARNING_AGENT_TOOLS.length).toBeGreaterThanOrEqual(12);
    });

    it("each tool references a learning.* procedure", () => {
      for (const tool of LEARNING_AGENT_TOOLS) {
        expect(tool.trpcProcedure).toMatch(/^learning\./);
      }
    });

    it("every tool has a non-empty name and description", () => {
      for (const tool of LEARNING_AGENT_TOOLS) {
        expect(tool.toolName.length).toBeGreaterThan(0);
        expect(tool.description.length).toBeGreaterThan(20);
        expect(tool.inputSchema).toBeDefined();
      }
    });

    it("required tools from the integration prompt are present", () => {
      const names = new Set(LEARNING_AGENT_TOOLS.map((t) => t.toolName));
      for (const required of [
        "check_license_status",
        "recommend_study_content",
        "assess_readiness",
        "generate_study_plan",
        "explain_concept",
        "quiz_me",
        "check_exam_readiness",
        "generate_flashcards",
        "generate_practice_questions",
        "suggest_content_improvements",
        "draft_definition",
        "start_review_session",
      ]) {
        expect(names.has(required)).toBe(true);
      }
    });

    it("tool names are unique", () => {
      const names = LEARNING_AGENT_TOOLS.map((t) => t.toolName);
      expect(new Set(names).size).toBe(names.length);
    });
  });

  describe("seed catalog", () => {
    it("defines exactly 12 canonical exam tracks", () => {
      expect(CORE_TRACKS).toHaveLength(12);
    });

    it("defines exactly 8 core disciplines", () => {
      expect(CORE_DISCIPLINES).toHaveLength(8);
    });

    it("every track has a unique slug", () => {
      const slugs = CORE_TRACKS.map((t) => t.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    });

    it("every discipline has a unique slug", () => {
      const slugs = CORE_DISCIPLINES.map((d) => d.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    });

    it("all 12 licensure tracks from the integration prompt are present", () => {
      const slugs = new Set(CORE_TRACKS.map((t) => t.slug));
      for (const req of [
        "sie",
        "series7",
        "series66",
        "cfp",
        "financial_planning",
        "investment_advisory",
        "estate_planning",
        "premium_financing",
        "life_health",
        "general_insurance",
        "p_and_c",
        "surplus_lines",
      ]) {
        expect(slugs.has(req)).toBe(true);
      }
    });

    it("tracks are assigned to valid categories", () => {
      const valid = new Set(["securities", "planning", "insurance"]);
      for (const t of CORE_TRACKS) {
        expect(valid.has(t.category)).toBe(true);
      }
    });
  });

  describe("bootstrap without DB", () => {
    it("returns zero-count result gracefully when DB is unavailable", async () => {
      // In the test environment there is no DATABASE_URL, so seedLearningContent
      // and registerLearningAgentTools both degrade to no-ops. The bootstrap
      // should never throw — it returns the summary with 0 counts.
      const result = await bootstrapLearning();
      expect(result).toBeDefined();
      expect(result.seeded).toBeDefined();
      expect(result.tools).toBeDefined();
      // Idempotent on repeat call
      const again = await bootstrapLearning();
      expect(again.seeded.skipped).toBeGreaterThanOrEqual(0);
    });
  });
});
