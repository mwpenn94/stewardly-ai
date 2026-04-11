import { describe, it, expect } from "vitest";
import {
  parseVitestOutput,
  filterFileResults,
  sortFileResults,
  type TestFileResult,
} from "./testRunner";

const sampleCleanRun = `
 ✓ client/src/components/codeChat/actionPalette.test.ts (21 tests) 9ms
 ✓ server/services/codeChat/diagnostics.test.ts (22 tests) 10ms
 ✓ client/src/components/codeChat/keyChords.test.ts (14 tests) 15ms

 Test Files  3 passed (3)
      Tests  57 passed (57)
   Start at  06:50:48
   Duration  381ms
`;

const sampleFailedRun = `
 ✓ server/services/codeChat/diagnostics.test.ts (22 tests) 10ms
 ❯ server/services/codeChat/broken.test.ts (5 tests | 2 failed) 17ms
   × broken — feature A > does the thing 2ms
     → expected 1 to be 2
   × broken — feature B > handles errors 3ms
     → TypeError: undefined is not a function

 Test Files  1 failed | 1 passed (2)
      Tests  2 failed | 25 passed (27)
   Duration  412ms
`;

const mkFile = (over: Partial<TestFileResult>): TestFileResult => ({
  path: "a.test.ts",
  status: "passed",
  totalTests: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  failures: [],
  ...over,
});

describe("testRunner — parseVitestOutput (clean run)", () => {
  it("parses all passing file rows", () => {
    const { files, summary } = parseVitestOutput(sampleCleanRun);
    expect(files).toHaveLength(3);
    expect(files.every((f) => f.status === "passed")).toBe(true);
    expect(files[0]!.totalTests).toBe(21);
    expect(files[0]!.passed).toBe(21);
  });

  it("parses the aggregate summary", () => {
    const { summary } = parseVitestOutput(sampleCleanRun);
    expect(summary.files.passed).toBe(3);
    expect(summary.files.total).toBe(3);
    expect(summary.tests.passed).toBe(57);
    expect(summary.tests.total).toBe(57);
  });

  it("parses the total duration", () => {
    const { summary } = parseVitestOutput(sampleCleanRun);
    expect(summary.durationMs).toBe(381);
  });

  it("captures file durations", () => {
    const { files } = parseVitestOutput(sampleCleanRun);
    expect(files[0]!.durationMs).toBe(9);
  });
});

describe("testRunner — parseVitestOutput (failed run)", () => {
  it("marks failing files with failed status", () => {
    const { files } = parseVitestOutput(sampleFailedRun);
    const broken = files.find((f) => f.path.includes("broken"));
    expect(broken).toBeDefined();
    expect(broken!.status).toBe("failed");
    expect(broken!.failed).toBe(2);
  });

  it("captures per-test failure names and durations", () => {
    const { files } = parseVitestOutput(sampleFailedRun);
    const broken = files.find((f) => f.path.includes("broken"))!;
    expect(broken.failures).toHaveLength(2);
    expect(broken.failures[0]!.name).toContain("feature A");
    expect(broken.failures[0]!.durationMs).toBe(2);
  });

  it("attaches failure detail messages", () => {
    const { files } = parseVitestOutput(sampleFailedRun);
    const broken = files.find((f) => f.path.includes("broken"))!;
    expect(broken.failures[0]!.error).toContain("expected 1 to be 2");
    expect(broken.failures[1]!.error).toContain("TypeError");
  });

  it("parses mixed aggregate summary", () => {
    const { summary } = parseVitestOutput(sampleFailedRun);
    expect(summary.files.failed).toBe(1);
    expect(summary.files.passed).toBe(1);
    expect(summary.tests.failed).toBe(2);
    expect(summary.tests.passed).toBe(25);
  });
});

describe("testRunner — parseVitestOutput (edge cases)", () => {
  it("returns empty on empty input", () => {
    const { files, summary } = parseVitestOutput("");
    expect(files).toHaveLength(0);
    expect(summary.files.total).toBe(0);
  });

  it("synthesizes summary when the aggregate row is missing", () => {
    const raw = `
 ✓ a.test.ts (5 tests) 10ms
 ✓ b.test.ts (3 tests) 5ms
`;
    const { summary } = parseVitestOutput(raw);
    expect(summary.files.total).toBe(2);
    expect(summary.tests.total).toBe(8);
  });

  it("strips ANSI escape codes from input", () => {
    const ansi = "\x1b[32m ✓\x1b[0m client/foo.test.ts (5 tests) 10ms";
    const { files } = parseVitestOutput(ansi);
    expect(files).toHaveLength(1);
    expect(files[0]!.status).toBe("passed");
  });

  it("handles second-unit durations", () => {
    const raw = " ✓ a.test.ts (1 tests) 1.5s";
    const { files } = parseVitestOutput(raw);
    expect(files[0]!.durationMs).toBe(1500);
  });

  it("does not match non-test files", () => {
    const raw = " ✓ package.json (1 tests) 1ms";
    const { files } = parseVitestOutput(raw);
    expect(files).toHaveLength(0);
  });
});

describe("testRunner — filterFileResults", () => {
  const files = [
    mkFile({ path: "a.test.ts", status: "passed", totalTests: 10, passed: 10 }),
    mkFile({
      path: "b.test.ts",
      status: "failed",
      totalTests: 5,
      failed: 2,
      passed: 3,
      failures: [
        { name: "does the thing", status: "failed" },
      ],
    }),
    mkFile({ path: "c.test.ts", status: "skipped", totalTests: 0, skipped: 0 }),
  ];

  it("filters by status", () => {
    expect(filterFileResults(files, { status: ["failed"] })).toHaveLength(1);
    expect(filterFileResults(files, { status: ["passed", "failed"] })).toHaveLength(2);
  });

  it("filters by path search", () => {
    expect(filterFileResults(files, { search: "b.test" })).toHaveLength(1);
  });

  it("filters by failure name search", () => {
    expect(filterFileResults(files, { search: "the thing" })).toHaveLength(1);
  });

  it("composes filters", () => {
    expect(
      filterFileResults(files, { status: ["failed"], search: "b.test" }),
    ).toHaveLength(1);
    expect(
      filterFileResults(files, { status: ["passed"], search: "b.test" }),
    ).toHaveLength(0);
  });
});

describe("testRunner — sortFileResults", () => {
  it("sorts failures first", () => {
    const sorted = sortFileResults([
      mkFile({ path: "a.test.ts", status: "passed" }),
      mkFile({ path: "b.test.ts", status: "failed" }),
      mkFile({ path: "c.test.ts", status: "skipped" }),
    ]);
    expect(sorted[0]!.status).toBe("failed");
    expect(sorted[1]!.status).toBe("passed");
    expect(sorted[2]!.status).toBe("skipped");
  });

  it("sorts same-status files alphabetically", () => {
    const sorted = sortFileResults([
      mkFile({ path: "z.test.ts" }),
      mkFile({ path: "a.test.ts" }),
      mkFile({ path: "m.test.ts" }),
    ]);
    expect(sorted.map((f) => f.path)).toEqual([
      "a.test.ts",
      "m.test.ts",
      "z.test.ts",
    ]);
  });
});
