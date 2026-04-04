import { describe, expect, it } from "vitest";

describe("ALLOWED_ORIGINS env validation", () => {
  it("ALLOWED_ORIGINS is set and contains valid URLs", () => {
    const raw = process.env.ALLOWED_ORIGINS;
    expect(raw).toBeTruthy();
    const origins = raw!.split(",").map(o => o.trim());
    expect(origins.length).toBeGreaterThan(0);
    for (const origin of origins) {
      expect(origin).toMatch(/^https?:\/\//);
    }
  });

  it("ALLOWED_ORIGINS includes stewardly.manus.space", () => {
    const raw = process.env.ALLOWED_ORIGINS!;
    const origins = raw.split(",").map(o => o.trim());
    expect(origins.some(o => o.includes("stewardly.manus.space"))).toBe(true);
  });
});
