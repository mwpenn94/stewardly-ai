/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AMP & Human Output Seeds — Test Suite
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, vi } from "vitest";
import {
  AMP_SEEDS,
  HUMAN_OUTPUT_SEEDS,
  seedAMPHumanOutputContent,
} from "../seeds/ampHumanOutputSeeds";
import type { KnowledgeBaseSeed } from "../seeds/ampHumanOutputSeeds";

describe("AMP Seeds", () => {
  it("should have seeds for all 6 AMP phases plus overview", () => {
    expect(AMP_SEEDS.length).toBe(7);
    expect(AMP_SEEDS[0].title).toContain("Overview");
    expect(AMP_SEEDS[1].title).toContain("Orientation");
    expect(AMP_SEEDS[2].title).toContain("Foundation");
    expect(AMP_SEEDS[3].title).toContain("Guided Practice");
    expect(AMP_SEEDS[4].title).toContain("Independent Application");
    expect(AMP_SEEDS[5].title).toContain("Mastery Assessment");
    expect(AMP_SEEDS[6].title).toContain("Continuous Refinement");
  });

  it("should have correct category and schema-compatible fields for all AMP seeds", () => {
    const validContentTypes = ["process", "concept", "reference", "template", "faq", "policy", "guide"];
    const validSources = ["manual", "ingested", "ai_generated", "conversation_mining"];

    for (const seed of AMP_SEEDS) {
      expect(seed.category).toBe("amp_framework");
      expect(validContentTypes).toContain(seed.contentType);
      expect(validSources).toContain(seed.source);
      expect(seed.content.length).toBeGreaterThan(100);
    }
  });

  it("should reference amp_engagement memory category", () => {
    const overview = AMP_SEEDS[0];
    expect(overview.content).toContain("amp_engagement");
  });

  it("should have subcategory for each phase", () => {
    expect(AMP_SEEDS[0].subcategory).toBe("overview");
    expect(AMP_SEEDS[1].subcategory).toBe("phase1");
    expect(AMP_SEEDS[6].subcategory).toBe("phase6");
  });
});

describe("Human Output Seeds", () => {
  it("should have seeds for overview and key domains", () => {
    expect(HUMAN_OUTPUT_SEEDS.length).toBeGreaterThanOrEqual(5);
    expect(HUMAN_OUTPUT_SEEDS[0].title).toContain("Overview");
  });

  it("should have correct category and schema-compatible fields for all HO seeds", () => {
    const validContentTypes = ["process", "concept", "reference", "template", "faq", "policy", "guide"];
    const validSources = ["manual", "ingested", "ai_generated", "conversation_mining"];

    for (const seed of HUMAN_OUTPUT_SEEDS) {
      expect(seed.category).toBe("human_output_framework");
      expect(validContentTypes).toContain(seed.contentType);
      expect(validSources).toContain(seed.source);
      expect(seed.content.length).toBeGreaterThan(100);
    }
  });

  it("should reference ho_domain_trajectory memory category", () => {
    const overview = HUMAN_OUTPUT_SEEDS[0];
    expect(overview.content).toContain("ho_domain_trajectory");
  });

  it("should cover all 10 domains in overview", () => {
    const overview = HUMAN_OUTPUT_SEEDS[0];
    expect(overview.content).toContain("Critical Thinking");
    expect(overview.content).toContain("Emotional Intelligence");
    expect(overview.content).toContain("Communication");
    expect(overview.content).toContain("Creativity");
    expect(overview.content).toContain("Leadership");
    expect(overview.content).toContain("Physical Health");
    expect(overview.content).toContain("Financial Acumen");
    expect(overview.content).toContain("Technical Mastery");
    expect(overview.content).toContain("Strategic Vision");
    expect(overview.content).toContain("Resilience");
  });

  it("should have subcategories for domain seeds", () => {
    for (const seed of HUMAN_OUTPUT_SEEDS) {
      expect(seed.subcategory).toBeDefined();
      expect(typeof seed.subcategory).toBe("string");
    }
  });
});

describe("seedAMPHumanOutputContent", () => {
  it("should call insertArticle for each seed", async () => {
    const insertArticle = vi.fn(async () => {});

    const result = await seedAMPHumanOutputContent(insertArticle);

    const totalSeeds = AMP_SEEDS.length + HUMAN_OUTPUT_SEEDS.length;
    expect(insertArticle).toHaveBeenCalledTimes(totalSeeds);
    expect(result.seeded).toBe(totalSeeds);
    expect(result.skipped).toBe(0);
  });

  it("should pass schema-compatible seed objects to insertArticle", async () => {
    const insertArticle = vi.fn(async () => {});

    await seedAMPHumanOutputContent(insertArticle);

    const firstCall = insertArticle.mock.calls[0][0] as KnowledgeBaseSeed;
    expect(firstCall).toHaveProperty("title");
    expect(firstCall).toHaveProperty("content");
    expect(firstCall).toHaveProperty("category");
    expect(firstCall).toHaveProperty("contentType");
    expect(firstCall).toHaveProperty("source");
    // Should NOT have legacy fields
    expect(firstCall).not.toHaveProperty("tags");
    expect(firstCall).not.toHaveProperty("isPublic");
  });

  it("should skip duplicates gracefully (PostgreSQL error code)", async () => {
    let callCount = 0;
    const insertArticle = vi.fn(async () => {
      callCount++;
      if (callCount <= 3) {
        const err: any = new Error("duplicate");
        err.code = "23505";
        throw err;
      }
    });

    const result = await seedAMPHumanOutputContent(insertArticle);

    expect(result.skipped).toBe(3);
    expect(result.seeded).toBe(AMP_SEEDS.length + HUMAN_OUTPUT_SEEDS.length - 3);
  });

  it("should skip duplicates gracefully (MySQL error code)", async () => {
    let callCount = 0;
    const insertArticle = vi.fn(async () => {
      callCount++;
      if (callCount <= 2) {
        const err: any = new Error("Duplicate entry 'AMP Phase 1' for key 'title'");
        err.errno = 1062;
        err.code = "ER_DUP_ENTRY";
        throw err;
      }
    });

    const result = await seedAMPHumanOutputContent(insertArticle);

    expect(result.skipped).toBe(2);
    expect(result.seeded).toBe(AMP_SEEDS.length + HUMAN_OUTPUT_SEEDS.length - 2);
  });

  it("should propagate non-duplicate errors", async () => {
    const insertArticle = vi.fn(async () => {
      throw new Error("connection failed");
    });

    await expect(seedAMPHumanOutputContent(insertArticle)).rejects.toThrow("connection failed");
  });
});
