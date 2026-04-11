import { describe, it, expect } from "vitest";
import {
  classifyUpdate,
  parseNpmOutdated,
  parseNpmAudit,
  filterOutdated,
  filterVulns,
} from "./npmInspector";

describe("npmInspector — classifyUpdate", () => {
  it("detects major bumps", () => {
    expect(classifyUpdate("1.2.3", "2.0.0")).toBe("major");
  });

  it("detects minor bumps", () => {
    expect(classifyUpdate("1.2.3", "1.3.0")).toBe("minor");
  });

  it("detects patch bumps", () => {
    expect(classifyUpdate("1.2.3", "1.2.4")).toBe("patch");
  });

  it("returns none when versions match", () => {
    expect(classifyUpdate("1.2.3", "1.2.3")).toBe("none");
  });

  it("strips pre-release suffixes", () => {
    expect(classifyUpdate("1.2.3-beta.1", "1.2.3")).toBe("none");
    expect(classifyUpdate("1.2.3", "2.0.0-rc.1")).toBe("major");
  });

  it("ignores ~ and ^ prefixes", () => {
    expect(classifyUpdate("^1.2.3", "^2.0.0")).toBe("major");
  });
});

describe("npmInspector — parseNpmOutdated", () => {
  it("parses a typical outdated blob", () => {
    const raw = JSON.stringify({
      "react": {
        current: "18.0.0",
        wanted: "18.2.0",
        latest: "19.0.0",
        type: "dependencies",
      },
      "vitest": {
        current: "2.1.9",
        wanted: "2.1.9",
        latest: "2.1.10",
        type: "devDependencies",
      },
    });
    const out = parseNpmOutdated(raw);
    expect(out).toHaveLength(2);
    // major update should sort first
    expect(out[0]!.name).toBe("react");
    expect(out[0]!.severity).toBe("major");
    expect(out[1]!.severity).toBe("patch");
  });

  it("returns empty on non-object input", () => {
    expect(parseNpmOutdated("[]")).toHaveLength(0);
    expect(parseNpmOutdated("null")).toHaveLength(0);
  });

  it("returns empty on malformed JSON", () => {
    expect(parseNpmOutdated("not json")).toHaveLength(0);
  });

  it("skips entries missing current or latest", () => {
    const raw = JSON.stringify({
      "ok": { current: "1.0.0", latest: "2.0.0" },
      "bad": {},
    });
    const out = parseNpmOutdated(raw);
    expect(out).toHaveLength(1);
    expect(out[0]!.name).toBe("ok");
  });

  it("sorts by severity then name", () => {
    const raw = JSON.stringify({
      "a-patch": { current: "1.0.0", latest: "1.0.1" },
      "b-major": { current: "1.0.0", latest: "2.0.0" },
      "c-minor": { current: "1.0.0", latest: "1.1.0" },
    });
    const out = parseNpmOutdated(raw);
    expect(out.map((e) => e.name)).toEqual(["b-major", "c-minor", "a-patch"]);
  });
});

describe("npmInspector — parseNpmAudit", () => {
  it("parses the v7+ shape with vulnerabilities", () => {
    const raw = JSON.stringify({
      vulnerabilities: {
        "lodash": {
          severity: "high",
          range: "<4.17.21",
          fixAvailable: true,
          via: [{ name: "CVE-2023-xxx", source: "cve" }],
        },
        "minimist": {
          severity: "critical",
          range: "<1.2.6",
          fixAvailable: { name: "minimist", version: "1.2.6" },
          via: [],
        },
      },
    });
    const { entries, summary } = parseNpmAudit(raw);
    expect(entries).toHaveLength(2);
    // Critical should sort first
    expect(entries[0]!.name).toBe("minimist");
    expect(entries[0]!.severity).toBe("critical");
    expect(entries[0]!.fixAvailable).toBe(true);
    expect(summary.critical).toBe(1);
    expect(summary.high).toBe(1);
    expect(summary.total).toBe(2);
  });

  it("returns empty on malformed JSON", () => {
    const { entries, summary } = parseNpmAudit("not json");
    expect(entries).toHaveLength(0);
    expect(summary.total).toBe(0);
  });

  it("handles missing vulnerabilities key", () => {
    const { entries } = parseNpmAudit(JSON.stringify({ metadata: {} }));
    expect(entries).toHaveLength(0);
  });

  it("normalizes unknown severities to info", () => {
    const raw = JSON.stringify({
      vulnerabilities: {
        "weird": { severity: "strange" },
      },
    });
    const { entries } = parseNpmAudit(raw);
    expect(entries[0]!.severity).toBe("info");
  });

  it("extracts string names from via array", () => {
    const raw = JSON.stringify({
      vulnerabilities: {
        "dep": {
          severity: "high",
          via: ["CVE-1", { name: "CVE-2" }, { source: "CVE-3" }],
        },
      },
    });
    const { entries } = parseNpmAudit(raw);
    expect(entries[0]!.via).toEqual(["CVE-1", "CVE-2", "CVE-3"]);
  });
});

describe("npmInspector — filterOutdated", () => {
  const entries = parseNpmOutdated(
    JSON.stringify({
      "react": { current: "18.0.0", latest: "19.0.0", type: "dependencies" },
      "vitest": { current: "2.1.9", latest: "2.1.10", type: "devDependencies" },
      "zod": { current: "3.22.0", latest: "3.22.4", type: "dependencies" },
    }),
  );

  it("filters by severity", () => {
    expect(filterOutdated(entries, { severity: "major" })).toHaveLength(1);
    expect(filterOutdated(entries, { severity: "patch" })).toHaveLength(2);
  });

  it("filters by type", () => {
    expect(filterOutdated(entries, { type: "devDependencies" })).toHaveLength(1);
  });

  it("filters by search", () => {
    expect(filterOutdated(entries, { search: "react" })).toHaveLength(1);
  });
});

describe("npmInspector — filterVulns", () => {
  const { entries } = parseNpmAudit(
    JSON.stringify({
      vulnerabilities: {
        "a": { severity: "critical" },
        "b": { severity: "high" },
        "c": { severity: "low" },
      },
    }),
  );

  it("filters by min severity", () => {
    expect(filterVulns(entries, { minSeverity: "high" })).toHaveLength(2);
    expect(filterVulns(entries, { minSeverity: "critical" })).toHaveLength(1);
  });

  it("filters by search", () => {
    expect(filterVulns(entries, { search: "a" })).toHaveLength(1);
  });
});
