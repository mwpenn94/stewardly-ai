import { describe, it, expect } from "vitest";
import { fuseRecommendations, CALCULATOR_TRACK_MAP } from "./recommendations";

describe("learning/recommendations — fuseRecommendations", () => {
  it("prioritizes due items first (priority 1)", () => {
    const recs = fuseRecommendations({
      dueCount: 5,
      masteryPct: 80,
      licenseAlerts: [],
      recentCalculators: [],
      weakTrackSlugs: [],
    });
    expect(recs[0].priority).toBe(1);
    expect(recs[0].reason).toContain("5 items");
  });

  it("surfaces CE credit alerts at priority 2", () => {
    const recs = fuseRecommendations({
      dueCount: 0,
      masteryPct: 80,
      licenseAlerts: [
        { licenseType: "series66", alertType: "ce_credits_needed", daysOut: 30, message: "4 CE credits needed in 30 days for series66." },
      ],
      recentCalculators: [],
      weakTrackSlugs: [],
    });
    expect(recs[0].priority).toBe(2);
    expect(recs[0].licenseType).toBe("series66");
  });

  it("suggests tracks when recent calculators map to weak tracks", () => {
    const recs = fuseRecommendations({
      dueCount: 0,
      masteryPct: 80,
      licenseAlerts: [],
      recentCalculators: ["rothExplorer"],
      weakTrackSlugs: ["cfp"],
    });
    const cfpRec = recs.find((r) => r.trackSlug === "cfp");
    expect(cfpRec).toBeTruthy();
    expect(cfpRec!.priority).toBe(4);
  });

  it("does not suggest strong tracks", () => {
    const recs = fuseRecommendations({
      dueCount: 0,
      masteryPct: 80,
      licenseAlerts: [],
      recentCalculators: ["rothExplorer"],
      weakTrackSlugs: [], // all strong
    });
    expect(recs.find((r) => r.trackSlug === "cfp")).toBeUndefined();
  });

  it("shows broadening rec when mastery low and list sparse", () => {
    const recs = fuseRecommendations({
      dueCount: 0,
      masteryPct: 20,
      licenseAlerts: [],
      recentCalculators: [],
      weakTrackSlugs: [],
    });
    expect(recs.some((r) => r.priority === 5)).toBe(true);
  });

  it("returns empty when everything is healthy", () => {
    const recs = fuseRecommendations({
      dueCount: 0,
      masteryPct: 90,
      licenseAlerts: [],
      recentCalculators: [],
      weakTrackSlugs: [],
    });
    expect(recs).toHaveLength(0);
  });

  it("returns at most 6 recommendations", () => {
    const alerts = Array.from({ length: 10 }, (_, i) => ({
      licenseType: `lic${i}`,
      alertType: "ce_credits_needed",
      daysOut: 10,
      message: `alert ${i}`,
    }));
    const recs = fuseRecommendations({
      dueCount: 3,
      masteryPct: 10,
      licenseAlerts: alerts,
      recentCalculators: [],
      weakTrackSlugs: [],
    });
    expect(recs.length).toBeLessThanOrEqual(6);
  });
});

describe("CALCULATOR_TRACK_MAP", () => {
  it("maps the core calculators from the integration prompt", () => {
    expect(CALCULATOR_TRACK_MAP.rothExplorer).toContain("cfp");
    expect(CALCULATOR_TRACK_MAP.stressTest).toContain("series7");
    expect(CALCULATOR_TRACK_MAP.autoSelectProducts).toContain("life_health");
    expect(CALCULATOR_TRACK_MAP.holisticSimulate).toContain("estate_planning");
  });
});
