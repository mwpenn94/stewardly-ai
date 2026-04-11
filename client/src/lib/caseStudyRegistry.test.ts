import { describe, it, expect } from "vitest";
import {
  CASE_STUDY_REGISTRY,
  getCaseStudyById,
  listCaseStudies,
  pickDefaultForTrackSlug,
} from "./caseStudyRegistry";

describe("learning/caseStudyRegistry — registry integrity", () => {
  it("has at least one case study", () => {
    expect(CASE_STUDY_REGISTRY.length).toBeGreaterThan(0);
  });

  it("every case has a unique id", () => {
    const ids = CASE_STUDY_REGISTRY.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every case has non-empty required fields", () => {
    for (const c of CASE_STUDY_REGISTRY) {
      expect(c.id).toBeTruthy();
      expect(c.title).toBeTruthy();
      expect(c.moduleSlug).toBeTruthy();
      expect(c.clientProfile).toBeTruthy();
      expect(c.situation).toBeTruthy();
      expect(c.decisions.length).toBeGreaterThan(0);
    }
  });

  it("every decision has at least 2 options", () => {
    for (const c of CASE_STUDY_REGISTRY) {
      for (const d of c.decisions) {
        expect(d.prompt).toBeTruthy();
        expect(d.options.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("every option has a unique key within its decision", () => {
    for (const c of CASE_STUDY_REGISTRY) {
      for (const d of c.decisions) {
        const keys = d.options.map((o) => o.key);
        expect(new Set(keys).size).toBe(keys.length);
      }
    }
  });

  it("every option has a score in a reasonable range", () => {
    for (const c of CASE_STUDY_REGISTRY) {
      for (const d of c.decisions) {
        for (const o of d.options) {
          expect(o.score).toBeGreaterThanOrEqual(0);
          expect(o.score).toBeLessThanOrEqual(10);
        }
      }
    }
  });

  it("nextDecisionIndex if present points to a valid decision", () => {
    for (const c of CASE_STUDY_REGISTRY) {
      for (const d of c.decisions) {
        for (const o of d.options) {
          if (o.nextDecisionIndex != null) {
            expect(o.nextDecisionIndex).toBeGreaterThanOrEqual(0);
            expect(o.nextDecisionIndex).toBeLessThan(c.decisions.length);
          }
        }
      }
    }
  });
});

describe("learning/caseStudyRegistry — getCaseStudyById", () => {
  it("returns null for missing / empty / non-string ids", () => {
    expect(getCaseStudyById(null)).toBe(null);
    expect(getCaseStudyById(undefined)).toBe(null);
    expect(getCaseStudyById("")).toBe(null);
  });

  it("returns the case for a known id", () => {
    const c = getCaseStudyById("estate-hnw");
    expect(c?.id).toBe("estate-hnw");
    expect(c?.title).toContain("Estate");
  });

  it("is case-insensitive", () => {
    expect(getCaseStudyById("ESTATE-HNW")?.id).toBe("estate-hnw");
    expect(getCaseStudyById("Estate-Hnw")?.id).toBe("estate-hnw");
  });

  it("returns null for unknown ids", () => {
    expect(getCaseStudyById("nope")).toBe(null);
    expect(getCaseStudyById("estate-hnw-xyz")).toBe(null);
  });
});

describe("learning/caseStudyRegistry — listCaseStudies", () => {
  it("returns a clone, not the source array", () => {
    const a = listCaseStudies();
    const b = listCaseStudies();
    expect(a).not.toBe(CASE_STUDY_REGISTRY);
    expect(a).not.toBe(b);
    expect(a.length).toBe(CASE_STUDY_REGISTRY.length);
  });

  it("mutating the clone does not affect the registry", () => {
    const clone = listCaseStudies();
    clone.pop();
    expect(CASE_STUDY_REGISTRY.length).toBeGreaterThan(clone.length);
  });
});

describe("learning/caseStudyRegistry — pickDefaultForTrackSlug", () => {
  it("always returns something (non-null fallback)", () => {
    expect(pickDefaultForTrackSlug(undefined)).toBeTruthy();
    expect(pickDefaultForTrackSlug("")).toBeTruthy();
    expect(pickDefaultForTrackSlug("unknown-track")).toBeTruthy();
  });

  it("matches a case whose moduleSlug contains the track slug", () => {
    const out = pickDefaultForTrackSlug("estate");
    expect(out.id).toBe("estate-hnw");
  });

  it("matches via bidirectional substring", () => {
    const out = pickDefaultForTrackSlug("financial");
    expect(out.moduleSlug.toLowerCase()).toContain("financial");
  });

  it("falls back to the first registry entry for unrelated slugs", () => {
    const out = pickDefaultForTrackSlug("zzz-not-a-real-track");
    expect(out).toBe(CASE_STUDY_REGISTRY[0]);
  });
});
