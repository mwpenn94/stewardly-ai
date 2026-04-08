import { describe, it, expect } from "vitest";
import { computeChecksum, diffChecksums, REGULATORY_SOURCES } from "./freshness";

describe("learning/freshness — pure helpers", () => {
  describe("computeChecksum", () => {
    it("produces stable 32-char hex from string", () => {
      const a = computeChecksum("hello world");
      const b = computeChecksum("hello world");
      expect(a).toBe(b);
      expect(a).toHaveLength(32);
      expect(/^[0-9a-f]+$/.test(a)).toBe(true);
    });
    it("changes on different input", () => {
      expect(computeChecksum("a")).not.toBe(computeChecksum("b"));
    });
    it("handles Buffer input", () => {
      const s = computeChecksum(Buffer.from("hi"));
      expect(s).toHaveLength(32);
    });
  });

  describe("diffChecksums", () => {
    it("first-seed when no prior checksum", () => {
      const d = diffChecksums(null, "abc");
      expect(d.changed).toBe(true);
      expect(d.reason).toBe("first-seed");
    });
    it("unchanged when equal", () => {
      const d = diffChecksums("abc", "abc");
      expect(d.changed).toBe(false);
      expect(d.reason).toBe("unchanged");
    });
    it("mismatch when different", () => {
      const d = diffChecksums("abc", "xyz");
      expect(d.changed).toBe(true);
      expect(d.reason).toBe("checksum-mismatch");
    });
  });

  describe("REGULATORY_SOURCES catalog", () => {
    it("includes FINRA, NASAA, CFP_Board, IRS, NAIC, State_DOI", () => {
      const names = REGULATORY_SOURCES.map((s) => s.name);
      expect(names).toContain("FINRA");
      expect(names).toContain("NASAA");
      expect(names).toContain("CFP_Board");
      expect(names).toContain("IRS");
      expect(names).toContain("NAIC");
      expect(names).toContain("State_DOI");
    });
    it("every source has a non-empty affects list", () => {
      for (const s of REGULATORY_SOURCES) {
        expect(s.affects.length).toBeGreaterThan(0);
      }
    });
  });
});
