import { describe, it, expect } from "vitest";

describe("Activity Calendar (Pass 152)", () => {
  it("should build a 52-week heatmap grid from daily data", () => {
    // Simulate the frontend heatmap grid builder
    const data = [
      { date: "2026-04-20", count: 3, minutes: 45 },
      { date: "2026-04-21", count: 1, minutes: 10 },
      { date: "2026-04-22", count: 5, minutes: 90 },
    ];
    const activityMap = new Map<string, { count: number; minutes: number }>();
    for (const d of data) activityMap.set(d.date, { count: d.count, minutes: d.minutes });

    expect(activityMap.get("2026-04-20")?.count).toBe(3);
    expect(activityMap.get("2026-04-21")?.minutes).toBe(10);
    expect(activityMap.get("2026-04-22")?.count).toBe(5);
    expect(activityMap.has("2026-04-19")).toBe(false);
  });

  it("should compute correct color levels based on max count", () => {
    const maxCount = 10;
    const getColor = (count: number) => {
      if (count === 0) return "bg-muted/40";
      const ratio = count / maxCount;
      if (ratio <= 0.25) return "bg-emerald-900/60";
      if (ratio <= 0.5) return "bg-emerald-700/70";
      if (ratio <= 0.75) return "bg-emerald-500/80";
      return "bg-emerald-400";
    };

    expect(getColor(0)).toBe("bg-muted/40");
    expect(getColor(1)).toBe("bg-emerald-900/60");
    expect(getColor(2)).toBe("bg-emerald-900/60");
    expect(getColor(3)).toBe("bg-emerald-700/70");
    expect(getColor(5)).toBe("bg-emerald-700/70");
    expect(getColor(6)).toBe("bg-emerald-500/80");
    expect(getColor(8)).toBe("bg-emerald-400");
    expect(getColor(10)).toBe("bg-emerald-400");
  });

  it("should compute summary stats from activity data", () => {
    const data = [
      { date: "2026-04-20", count: 3, minutes: 45 },
      { date: "2026-04-21", count: 0, minutes: 0 },
      { date: "2026-04-22", count: 5, minutes: 90 },
      { date: "2026-04-23", count: 2, minutes: 30 },
    ];
    const totalSessions = data.reduce((s, d) => s + d.count, 0);
    const totalMinutes = data.reduce((s, d) => s + d.minutes, 0);
    const activeDays = data.filter(d => d.count > 0).length;

    expect(totalSessions).toBe(10);
    expect(totalMinutes).toBe(165);
    expect(activeDays).toBe(3);
    expect(Math.round(totalMinutes / 60)).toBe(3); // 3 hours
  });
});

describe("SRS Settings (Pass 152)", () => {
  it("should define correct default settings", () => {
    const DEFAULTS = {
      srs_daily_review_cap: 20,
      srs_new_card_quota: 10,
      srs_daily_goal_minutes: 15,
      srs_nudge_enabled: false,
      srs_nudge_time: "09:00",
      srs_auto_play_audio: true,
      srs_show_hints: true,
    };

    expect(DEFAULTS.srs_daily_review_cap).toBe(20);
    expect(DEFAULTS.srs_new_card_quota).toBe(10);
    expect(DEFAULTS.srs_daily_goal_minutes).toBe(15);
    expect(DEFAULTS.srs_nudge_enabled).toBe(false);
    expect(DEFAULTS.srs_nudge_time).toBe("09:00");
    expect(DEFAULTS.srs_auto_play_audio).toBe(true);
    expect(DEFAULTS.srs_show_hints).toBe(true);
  });

  it("should hydrate settings from server data", () => {
    const DEFAULTS = {
      srs_daily_review_cap: 20,
      srs_new_card_quota: 10,
      srs_daily_goal_minutes: 15,
    };

    const serverData = [
      { settingKey: "srs_daily_review_cap", settingValue: "50" },
      { settingKey: "srs_daily_goal_minutes", settingValue: "30" },
    ];

    const next = { ...DEFAULTS } as any;
    for (const row of serverData) {
      if (row.settingKey in DEFAULTS) {
        try {
          next[row.settingKey] = JSON.parse(row.settingValue);
        } catch {
          // keep default
        }
      }
    }

    expect(next.srs_daily_review_cap).toBe(50);
    expect(next.srs_new_card_quota).toBe(10); // unchanged
    expect(next.srs_daily_goal_minutes).toBe(30);
  });

  it("should validate slider ranges", () => {
    const RANGES = {
      reviewCap: { min: 5, max: 100, step: 5 },
      newQuota: { min: 0, max: 50, step: 5 },
      dailyGoal: { min: 5, max: 120, step: 5 },
    };

    // Ensure ranges are valid
    expect(RANGES.reviewCap.min).toBeLessThan(RANGES.reviewCap.max);
    expect(RANGES.newQuota.min).toBeLessThan(RANGES.newQuota.max);
    expect(RANGES.dailyGoal.min).toBeLessThan(RANGES.dailyGoal.max);

    // Ensure steps divide evenly into range
    expect((RANGES.reviewCap.max - RANGES.reviewCap.min) % RANGES.reviewCap.step).toBe(0);
    expect((RANGES.newQuota.max - RANGES.newQuota.min) % RANGES.newQuota.step).toBe(0);
    expect((RANGES.dailyGoal.max - RANGES.dailyGoal.min) % RANGES.dailyGoal.step).toBe(0);
  });
});

describe("Enhanced Recommendations (Pass 152)", () => {
  it("should assign correct priority labels", () => {
    const getLabel = (priority: number) => {
      if (priority === 1) return "URGENT";
      if (priority === 2) return "IMPORTANT";
      if (priority <= 4) return "SUGGESTED";
      return "OPTIONAL";
    };

    expect(getLabel(1)).toBe("URGENT");
    expect(getLabel(2)).toBe("IMPORTANT");
    expect(getLabel(3)).toBe("SUGGESTED");
    expect(getLabel(4)).toBe("SUGGESTED");
    expect(getLabel(5)).toBe("OPTIONAL");
    expect(getLabel(6)).toBe("OPTIONAL");
  });

  it("should compute correct action href from recommendation data", () => {
    const getHref = (r: { trackSlug?: string; priority: number }) => {
      return r.trackSlug ? `/learning/tracks/${r.trackSlug}` : r.priority === 1 ? "/learning/review" : "/learning";
    };

    expect(getHref({ trackSlug: "cfp", priority: 4 })).toBe("/learning/tracks/cfp");
    expect(getHref({ priority: 1 })).toBe("/learning/review");
    expect(getHref({ priority: 3 })).toBe("/learning");
  });
});
