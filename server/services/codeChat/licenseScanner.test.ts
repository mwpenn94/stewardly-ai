import { describe, it, expect } from "vitest";
import {
  classifyLicense,
  assessRisk,
  classifyDependency,
  classifyDependencies,
  summarizeLicenses,
  filterDependencies,
  extractLicense,
  type DependencyEntry,
} from "./licenseScanner";

const dep = (over: Partial<DependencyEntry> = {}): DependencyEntry => ({
  name: "test-pkg",
  version: "1.0.0",
  license: "MIT",
  ...over,
});

describe("licenseScanner — classifyLicense", () => {
  it("classifies permissive licenses", () => {
    expect(classifyLicense("MIT")).toBe("permissive");
    expect(classifyLicense("Apache-2.0")).toBe("permissive");
    expect(classifyLicense("BSD-3-Clause")).toBe("permissive");
    expect(classifyLicense("ISC")).toBe("permissive");
    expect(classifyLicense("Unlicense")).toBe("permissive");
  });

  it("classifies weak copyleft", () => {
    expect(classifyLicense("LGPL-2.1")).toBe("weak_copyleft");
    expect(classifyLicense("MPL-2.0")).toBe("weak_copyleft");
    expect(classifyLicense("EPL-2.0")).toBe("weak_copyleft");
  });

  it("classifies strong copyleft", () => {
    expect(classifyLicense("GPL-3.0")).toBe("strong_copyleft");
    expect(classifyLicense("AGPL-3.0")).toBe("strong_copyleft");
    expect(classifyLicense("SSPL-1.0")).toBe("strong_copyleft");
  });

  it("detects commercial markers", () => {
    expect(classifyLicense("UNLICENSED")).toBe("commercial");
    expect(classifyLicense("Proprietary")).toBe("commercial");
    expect(classifyLicense("SEE LICENSE IN LICENSE.txt")).toBe("commercial");
  });

  it("returns unknown for empty/garbage", () => {
    expect(classifyLicense("")).toBe("unknown");
    expect(classifyLicense("???")).toBe("unknown");
  });

  it("picks the most permissive category in OR expressions", () => {
    expect(classifyLicense("MIT OR GPL-3.0")).toBe("permissive");
    expect(classifyLicense("(LGPL-2.1 OR GPL-3.0)")).toBe("weak_copyleft");
    expect(classifyLicense("(GPL-3.0 OR SSPL-1.0)")).toBe("strong_copyleft");
  });

  it("is case insensitive", () => {
    expect(classifyLicense("mit")).toBe("permissive");
    expect(classifyLicense("gPl-3.0")).toBe("strong_copyleft");
  });
});

describe("licenseScanner — assessRisk", () => {
  it("assigns 0 to permissive", () => {
    expect(assessRisk("permissive").risk).toBe(0);
  });

  it("assigns 1 with note to weak copyleft", () => {
    const r = assessRisk("weak_copyleft");
    expect(r.risk).toBe(1);
    expect(r.note).toBeDefined();
  });

  it("assigns 3 to strong copyleft", () => {
    expect(assessRisk("strong_copyleft").risk).toBe(3);
  });

  it("assigns 2 to commercial and unknown", () => {
    expect(assessRisk("commercial").risk).toBe(2);
    expect(assessRisk("unknown").risk).toBe(2);
  });
});

describe("licenseScanner — classifyDependency / classifyDependencies", () => {
  it("attaches category + risk to a single dep", () => {
    const c = classifyDependency(dep({ license: "GPL-3.0" }));
    expect(c.category).toBe("strong_copyleft");
    expect(c.risk).toBe(3);
  });

  it("sorts by risk descending", () => {
    const list = classifyDependencies([
      dep({ name: "safe", license: "MIT" }),
      dep({ name: "risky", license: "GPL-3.0" }),
      dep({ name: "warn", license: "Proprietary" }),
    ]);
    expect(list[0]!.name).toBe("risky");
    expect(list[1]!.name).toBe("warn");
    expect(list[2]!.name).toBe("safe");
  });

  it("tiebreaks alphabetically at same risk level", () => {
    const list = classifyDependencies([
      dep({ name: "zeta", license: "MIT" }),
      dep({ name: "alpha", license: "MIT" }),
      dep({ name: "beta", license: "MIT" }),
    ]);
    expect(list.map((l) => l.name)).toEqual(["alpha", "beta", "zeta"]);
  });
});

describe("licenseScanner — summarizeLicenses", () => {
  const deps = classifyDependencies([
    dep({ name: "a", license: "MIT" }),
    dep({ name: "b", license: "MIT" }),
    dep({ name: "c", license: "Apache-2.0" }),
    dep({ name: "d", license: "GPL-3.0" }),
    dep({ name: "e", license: "Proprietary" }),
  ]);

  it("counts by category", () => {
    const s = summarizeLicenses(deps);
    expect(s.byCategory.permissive).toBe(3);
    expect(s.byCategory.strong_copyleft).toBe(1);
    expect(s.byCategory.commercial).toBe(1);
  });

  it("ranks licenses by count", () => {
    const s = summarizeLicenses(deps);
    expect(s.byLicense[0]!.license).toBe("MIT");
    expect(s.byLicense[0]!.count).toBe(2);
  });

  it("lists risky deps (risk >= 2)", () => {
    const s = summarizeLicenses(deps);
    expect(s.risky).toHaveLength(2);
    expect(s.risky.map((d) => d.name).sort()).toEqual(["d", "e"]);
  });

  it("tracks the highest risk seen", () => {
    const s = summarizeLicenses(deps);
    expect(s.highestRisk).toBe(3);
  });
});

describe("licenseScanner — filterDependencies", () => {
  const deps = classifyDependencies([
    dep({ name: "a", license: "MIT" }),
    dep({ name: "b", license: "GPL-3.0" }),
    dep({ name: "c", license: "Proprietary" }),
  ]);

  it("filters by category", () => {
    expect(filterDependencies(deps, { category: "strong_copyleft" })).toHaveLength(1);
  });

  it("filters by min risk", () => {
    expect(filterDependencies(deps, { minRisk: 2 })).toHaveLength(2);
    expect(filterDependencies(deps, { minRisk: 3 })).toHaveLength(1);
  });

  it("filters by search", () => {
    expect(filterDependencies(deps, { search: "GPL" })).toHaveLength(1);
    expect(filterDependencies(deps, { search: "mit" })).toHaveLength(1);
  });

  it("composes filters", () => {
    expect(
      filterDependencies(deps, { minRisk: 2, search: "GPL" }),
    ).toHaveLength(1);
  });
});

describe("licenseScanner — extractLicense", () => {
  it("handles string shape", () => {
    expect(extractLicense({ license: "MIT" })).toBe("MIT");
  });

  it("handles object shape with type", () => {
    expect(extractLicense({ license: { type: "MIT", url: "x" } })).toBe("MIT");
  });

  it("handles legacy licenses array", () => {
    expect(
      extractLicense({
        licenses: [{ type: "MIT" }, { type: "Apache-2.0" }],
      }),
    ).toBe("MIT OR Apache-2.0");
  });

  it("handles array of strings", () => {
    expect(extractLicense({ licenses: ["MIT", "BSD-3-Clause"] })).toBe(
      "MIT OR BSD-3-Clause",
    );
  });

  it("returns empty on missing license field", () => {
    expect(extractLicense({})).toBe("");
    expect(extractLicense(null)).toBe("");
  });
});
