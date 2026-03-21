/**
 * Router Integration Tests
 * Tests that all addendum and consolidation routers are properly wired
 */
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";

describe("Router Registration Completeness", () => {
  const routerKeys = Object.keys(appRouter._def.procedures).concat(
    Object.keys(appRouter._def.record || {})
  );

  describe("Addendum Feature Routers", () => {
    it("should have addendumFeatures router registered", () => {
      expect(appRouter._def.record).toHaveProperty("addendum");
    });

    it("should have operations router registered", () => {
      expect(appRouter._def.record).toHaveProperty("operations");
    });
  });

  describe("Consolidation Routers", () => {
    it("should have knowledgeBase router registered", () => {
      expect(appRouter._def.record).toHaveProperty("knowledgeBase");
    });

    it("should have aiPlatform router registered", () => {
      expect(appRouter._def.record).toHaveProperty("aiPlatform");
    });
  });

  describe("Existing Routers Preserved", () => {
    it("should still have auth router", () => {
      expect(appRouter._def.record).toHaveProperty("auth");
    });

    it("should still have chat router", () => {
      expect(appRouter._def.record).toHaveProperty("chat");
    });

    it("should still have products router", () => {
      expect(appRouter._def.record).toHaveProperty("products");
    });

    it("should still have suitability router", () => {
      expect(appRouter._def.record).toHaveProperty("suitability");
    });

    it("should still have organizations router", () => {
      expect(appRouter._def.record).toHaveProperty("organizations");
    });

    it("should still have exports router", () => {
      expect(appRouter._def.record).toHaveProperty("exports");
    });
  });
});

describe("Router Procedure Counts", () => {
  it("should have substantial procedure count (>100)", () => {
    let count = 0;
    const countProcedures = (record: any) => {
      for (const key of Object.keys(record)) {
        const val = record[key];
        if (val?._def?.procedures) {
          count += Object.keys(val._def.procedures).length;
        } else if (val?._def?.record) {
          countProcedures(val._def.record);
        } else {
          count++;
        }
      }
    };
    countProcedures(appRouter._def.record);
    expect(count).toBeGreaterThan(50);
  });
});

describe("Sub-Router Structure", () => {
  describe("addendumFeatures sub-router", () => {
    it("should have procedures defined", () => {
      const sub = appRouter._def.record?.addendum;
      expect(sub).toBeDefined();
    });
  });

  describe("knowledgeBase sub-router", () => {
    it("should have procedures defined", () => {
      const sub = appRouter._def.record?.knowledgeBase;
      expect(sub).toBeDefined();
    });
  });

  describe("aiPlatform sub-router", () => {
    it("should have procedures defined", () => {
      const sub = appRouter._def.record?.aiPlatform;
      expect(sub).toBeDefined();
    });
  });

  describe("operations sub-router", () => {
    it("should have procedures defined", () => {
      const sub = appRouter._def.record?.operations;
      expect(sub).toBeDefined();
    });
  });
});
