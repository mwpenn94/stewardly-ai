/**
 * Tests for the life event detector. Cover every event taxonomy
 * member with a concrete before/after transition, plus edge
 * cases (empty prev, no change, negative deltas for thresholds).
 */

import { describe, it, expect } from "vitest";
import { detectLifeEvents, summarizeEvents } from "@shared/lifeEventDetector";

describe("lifeEventDetector / baseline", () => {
  it("returns no events when prev is null", () => {
    expect(
      detectLifeEvents(null, { age: 40, income: 120000 }),
    ).toEqual([]);
  });

  it("returns no events when nothing changed", () => {
    const p = { age: 40, income: 120000 };
    expect(detectLifeEvents(p, p)).toEqual([]);
  });
});

describe("lifeEventDetector / marriage + divorce", () => {
  it("detects marriage when filingStatus → mfj", () => {
    const events = detectLifeEvents(
      { filingStatus: "single" },
      { filingStatus: "mfj" },
    );
    expect(events).toHaveLength(1);
    expect(events[0].key).toBe("marriage");
    expect(events[0].severity).toBe("high");
  });

  it("detects marriage when filingStatus → mfs (married separately)", () => {
    const events = detectLifeEvents(
      { filingStatus: "single" },
      { filingStatus: "mfs" },
    );
    expect(events[0].key).toBe("marriage");
  });

  it("detects divorce when mfj → single", () => {
    const events = detectLifeEvents(
      { filingStatus: "mfj" },
      { filingStatus: "single" },
    );
    expect(events[0].key).toBe("divorce");
    expect(events[0].severity).toBe("high");
  });
});

describe("lifeEventDetector / dependents", () => {
  it("fires new_dependent on dependents increase", () => {
    const events = detectLifeEvents({ dependents: 1 }, { dependents: 2 });
    expect(events[0].key).toBe("new_dependent");
    expect(events[0].delta).toBe(1);
    expect(events[0].severity).toBe("high");
  });

  it("handles undefined prev.dependents as 0", () => {
    const events = detectLifeEvents({}, { dependents: 2 });
    expect(events[0].key).toBe("new_dependent");
    expect(events[0].delta).toBe(2);
  });

  it("fires empty_nest when dependents drop to 0 from a positive count", () => {
    const events = detectLifeEvents({ dependents: 2 }, { dependents: 0 });
    expect(events[0].key).toBe("empty_nest");
    expect(events[0].severity).toBe("medium");
  });

  it("does NOT fire empty_nest when going 0 → 0", () => {
    const events = detectLifeEvents({ dependents: 0 }, { dependents: 0 });
    expect(events.find((e) => e.key === "empty_nest")).toBeUndefined();
  });
});

describe("lifeEventDetector / business owner", () => {
  it("fires business_entry on false → true", () => {
    const events = detectLifeEvents(
      { isBizOwner: false },
      { isBizOwner: true },
    );
    expect(events[0].key).toBe("business_entry");
    expect(events[0].suggestedQuoteId).toBe("business-income");
  });

  it("fires business_exit on true → false", () => {
    const events = detectLifeEvents(
      { isBizOwner: true },
      { isBizOwner: false },
    );
    expect(events[0].key).toBe("business_exit");
  });
});

describe("lifeEventDetector / HNW crossings", () => {
  it("fires hnw_crossing on $1M upward", () => {
    const events = detectLifeEvents(
      { netWorth: 900_000 },
      { netWorth: 1_200_000 },
    );
    expect(events.find((e) => e.key === "hnw_crossing")).toBeDefined();
  });

  it("fires two events on a jump past two thresholds", () => {
    const events = detectLifeEvents(
      { netWorth: 800_000 },
      { netWorth: 6_000_000 },
    );
    const hnw = events.filter((e) => e.key === "hnw_crossing");
    // Crossed $1M and $5M; $10M not yet
    expect(hnw.length).toBe(2);
  });

  it("does NOT fire on downward crossing", () => {
    const events = detectLifeEvents(
      { netWorth: 2_000_000 },
      { netWorth: 500_000 },
    );
    expect(events.find((e) => e.key === "hnw_crossing")).toBeUndefined();
  });
});

describe("lifeEventDetector / income spike + drop", () => {
  it("fires income_spike on ≥25% increase", () => {
    const events = detectLifeEvents(
      { income: 100_000 },
      { income: 130_000 },
    );
    expect(events.find((e) => e.key === "income_spike")).toBeDefined();
  });

  it("fires income_drop on ≥25% decrease", () => {
    const events = detectLifeEvents(
      { income: 200_000 },
      { income: 140_000 },
    );
    expect(events.find((e) => e.key === "income_drop")).toBeDefined();
  });

  it("does NOT fire on small movements", () => {
    const events = detectLifeEvents(
      { income: 100_000 },
      { income: 110_000 },
    );
    expect(events.find((e) => e.key === "income_spike")).toBeUndefined();
    expect(events.find((e) => e.key === "income_drop")).toBeUndefined();
  });
});

describe("lifeEventDetector / retirement windows", () => {
  it("fires retirement_approach when crossing age 55", () => {
    const events = detectLifeEvents({ age: 54 }, { age: 55 });
    expect(events.find((e) => e.key === "retirement_approach")).toBeDefined();
  });

  it("fires retirement when crossing retirementAge", () => {
    const events = detectLifeEvents(
      { age: 64, retirementAge: 65 },
      { age: 65, retirementAge: 65 },
    );
    expect(events.find((e) => e.key === "retirement")).toBeDefined();
  });

  it("does NOT fire retirement when retirementAge is missing", () => {
    const events = detectLifeEvents({ age: 64 }, { age: 70 });
    expect(events.find((e) => e.key === "retirement")).toBeUndefined();
  });
});

describe("lifeEventDetector / estate exposure", () => {
  it("fires when net worth crosses single exemption (13.61M)", () => {
    const events = detectLifeEvents(
      { filingStatus: "single", netWorth: 10_000_000 },
      { filingStatus: "single", netWorth: 14_000_000 },
    );
    expect(events.find((e) => e.key === "estate_exposure")).toBeDefined();
  });

  it("fires when net worth crosses mfj exemption (27.22M)", () => {
    const events = detectLifeEvents(
      { filingStatus: "mfj", netWorth: 20_000_000 },
      { filingStatus: "mfj", netWorth: 28_000_000 },
    );
    expect(events.find((e) => e.key === "estate_exposure")).toBeDefined();
  });

  it("does NOT fire if already above exemption before", () => {
    const events = detectLifeEvents(
      { filingStatus: "single", netWorth: 14_000_000 },
      { filingStatus: "single", netWorth: 15_000_000 },
    );
    expect(events.find((e) => e.key === "estate_exposure")).toBeUndefined();
  });
});

describe("lifeEventDetector / ordering", () => {
  it("returns high-severity events first", () => {
    // Combine a high-severity event (marriage) with a medium (HNW)
    const events = detectLifeEvents(
      { filingStatus: "single", netWorth: 900_000 },
      { filingStatus: "mfj", netWorth: 1_200_000 },
    );
    expect(events[0].severity).toBe("high");
    expect(events[events.length - 1].severity === "medium" || events[events.length - 1].severity === "high").toBe(true);
  });
});

describe("lifeEventDetector / summarizeEvents", () => {
  it("returns zeros for an empty list", () => {
    const s = summarizeEvents([]);
    expect(s.total).toBe(0);
    expect(s.topEvent).toBeNull();
  });

  it("counts by severity", () => {
    const events = detectLifeEvents(
      { filingStatus: "single", dependents: 1, netWorth: 900_000 },
      { filingStatus: "mfj", dependents: 2, netWorth: 1_200_000 },
    );
    const s = summarizeEvents(events);
    expect(s.total).toBeGreaterThanOrEqual(2);
    expect(s.high).toBeGreaterThanOrEqual(2); // marriage + new_dependent
    expect(s.topEvent?.severity).toBe("high");
  });
});
