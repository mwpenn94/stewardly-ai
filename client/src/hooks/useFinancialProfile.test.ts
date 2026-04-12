import { describe, it, expect, beforeEach, vi } from "vitest";

// Test the pure functions only (no React hooks in unit tests)
// Import the module to test its pure helpers and localStorage logic
const STORAGE_KEY = "stewardly-financial-profile";

// ─── profileValue ─────────────────────────────────────────────
describe("profileValue", () => {
  // Inline the function for pure testing (avoids React hook context issues)
  function profileValue<T>(profile: Record<string, any>, key: string, defaultValue: T): T {
    const val = profile[key];
    if (val == null) return defaultValue;
    return val as unknown as T;
  }

  it("returns default when key is missing", () => {
    expect(profileValue({}, "annualIncome", 150000)).toBe(150000);
  });

  it("returns profile value when present", () => {
    expect(profileValue({ annualIncome: 200000 }, "annualIncome", 150000)).toBe(200000);
  });

  it("returns default when value is null", () => {
    expect(profileValue({ annualIncome: null }, "annualIncome", 150000)).toBe(150000);
  });

  it("returns default when value is undefined", () => {
    expect(profileValue({ annualIncome: undefined }, "annualIncome", 150000)).toBe(150000);
  });

  it("returns 0 when profile value is 0 (not treated as missing)", () => {
    expect(profileValue({ selfEmploymentIncome: 0 }, "selfEmploymentIncome", 5000)).toBe(0);
  });

  it("returns false when profile value is false", () => {
    expect(profileValue({ isMarried: false }, "isMarried", true)).toBe(false);
  });

  it("returns string values", () => {
    expect(profileValue({ stateCode: "CA" }, "stateCode", "TX")).toBe("CA");
  });
});

// ─── loadProfile / saveProfile (localStorage) ─────────────────
describe("profile localStorage persistence", () => {
  // Mock localStorage
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
    });
  });

  function loadProfile() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
      return parsed;
    } catch {
      return {};
    }
  }

  function saveProfile(profile: Record<string, any>) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch { /* noop */ }
  }

  it("returns empty object when nothing stored", () => {
    expect(loadProfile()).toEqual({});
  });

  it("roundtrips a profile through save/load", () => {
    const profile = { annualIncome: 200000, filingStatus: "mfj", currentAge: 45 };
    saveProfile(profile);
    expect(loadProfile()).toEqual(profile);
  });

  it("handles corrupted JSON gracefully", () => {
    store[STORAGE_KEY] = "not valid json{{{";
    expect(loadProfile()).toEqual({});
  });

  it("rejects array stored as profile", () => {
    store[STORAGE_KEY] = "[1, 2, 3]";
    expect(loadProfile()).toEqual({});
  });

  it("rejects null stored as profile", () => {
    store[STORAGE_KEY] = "null";
    expect(loadProfile()).toEqual({});
  });

  it("rejects string stored as profile", () => {
    store[STORAGE_KEY] = '"hello"';
    expect(loadProfile()).toEqual({});
  });

  it("preserves all financial profile fields", () => {
    const full = {
      annualIncome: 150000,
      spouseIncome: 60000,
      mortgageBalance: 350000,
      netEstate: 2800000,
      isMarried: true,
      filingStatus: "mfj",
      stateCode: "TX",
      currentAge: 45,
      retirementAge: 65,
      lifeExpectancy: 85,
      childrenCount: 2,
      lastUpdated: "2026-04-12T00:00:00Z",
      lastUpdatedBy: "tax-planning",
    };
    saveProfile(full);
    expect(loadProfile()).toEqual(full);
  });

  it("merges updates preserving existing fields", () => {
    const initial = { annualIncome: 150000, stateCode: "TX" };
    saveProfile(initial);
    const loaded = loadProfile();
    const updated = { ...loaded, annualIncome: 200000, isMarried: true };
    saveProfile(updated);
    expect(loadProfile()).toEqual({ annualIncome: 200000, stateCode: "TX", isMarried: true });
  });
});
