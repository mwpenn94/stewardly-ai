/**
 * Tests for the vitest JSON parser — Pass 258.
 *
 * These are pure parser tests against synthetic vitest output, so
 * they don't need to actually spawn a subprocess.
 */

import { describe, it, expect } from "vitest";
import { parseVitestJson } from "./testRunner";

describe("parseVitestJson", () => {
  it("returns empty defaults for empty input", () => {
    const out = parseVitestJson("");
    expect(out.files).toEqual([]);
    expect(out.totalPassed).toBe(0);
  });

  it("parses a single passing test file", () => {
    const json = JSON.stringify({
      numTotalTests: 1,
      testResults: [
        {
          name: "src/foo.test.ts",
          perfStats: { runtime: 42 },
          assertionResults: [
            {
              title: "it works",
              fullName: "foo > it works",
              status: "passed",
              duration: 10,
            },
          ],
        },
      ],
    });
    const out = parseVitestJson(json);
    expect(out.files).toHaveLength(1);
    expect(out.files![0].status).toBe("passed");
    expect(out.files![0].numPassed).toBe(1);
    expect(out.totalPassed).toBe(1);
  });

  it("parses a failing test with message", () => {
    const json = JSON.stringify({
      testResults: [
        {
          name: "a.test.ts",
          assertionResults: [
            {
              title: "broken",
              fullName: "a > broken",
              status: "failed",
              duration: 5,
              failureMessages: ["Expected 1 got 2\n  at line 10"],
            },
          ],
        },
      ],
    });
    const out = parseVitestJson(json);
    expect(out.files![0].status).toBe("failed");
    expect(out.files![0].assertions[0].failureMessage).toBe("Expected 1 got 2");
    expect(out.totalFailed).toBe(1);
  });

  it("counts skipped tests", () => {
    const json = JSON.stringify({
      testResults: [
        {
          name: "b.test.ts",
          assertionResults: [
            { title: "t1", fullName: "b > t1", status: "skipped", duration: 0 },
            { title: "t2", fullName: "b > t2", status: "todo", duration: 0 },
          ],
        },
      ],
    });
    const out = parseVitestJson(json);
    expect(out.totalSkipped).toBe(2);
    expect(out.files![0].status).toBe("skipped");
  });

  it("handles a mixed file", () => {
    const json = JSON.stringify({
      testResults: [
        {
          name: "mix.test.ts",
          assertionResults: [
            { title: "t1", fullName: "", status: "passed", duration: 1 },
            { title: "t2", fullName: "", status: "failed", duration: 1, failureMessages: ["boom"] },
            { title: "t3", fullName: "", status: "skipped", duration: 0 },
          ],
        },
      ],
    });
    const out = parseVitestJson(json);
    expect(out.files![0].status).toBe("failed");
    expect(out.files![0].numPassed).toBe(1);
    expect(out.files![0].numFailed).toBe(1);
    expect(out.files![0].numSkipped).toBe(1);
  });

  it("handles multiple files", () => {
    const json = JSON.stringify({
      testResults: [
        {
          name: "a.test.ts",
          assertionResults: [{ title: "t", status: "passed", duration: 1 }],
        },
        {
          name: "b.test.ts",
          assertionResults: [{ title: "t", status: "failed", duration: 1 }],
        },
      ],
    });
    const out = parseVitestJson(json);
    expect(out.files).toHaveLength(2);
    expect(out.totalPassed).toBe(1);
    expect(out.totalFailed).toBe(1);
  });

  it("tolerates missing fields", () => {
    const json = JSON.stringify({
      testResults: [
        {
          name: "a.test.ts",
          assertionResults: [
            { status: "passed" }, // no title, no duration
          ],
        },
      ],
    });
    const out = parseVitestJson(json);
    expect(out.files![0].assertions[0].title).toBe("");
    expect(out.files![0].assertions[0].duration).toBeNull();
  });

  it("treats unknown statuses as failed", () => {
    const json = JSON.stringify({
      testResults: [
        {
          name: "a.test.ts",
          assertionResults: [{ title: "t", status: "weird", duration: 0 }],
        },
      ],
    });
    const out = parseVitestJson(json);
    expect(out.totalFailed).toBe(1);
  });

  it("recovers when log noise precedes JSON", () => {
    const noise = "Running vitest...\n[info] starting tests...\n";
    const jsonPart = JSON.stringify({
      testResults: [
        {
          name: "a.test.ts",
          assertionResults: [{ title: "t", status: "passed", duration: 1 }],
        },
      ],
    });
    // Parser tries raw JSON first; if that fails, it scans for last {
    const out = parseVitestJson(noise + "\n" + jsonPart);
    expect(out.totalPassed).toBe(1);
  });

  it("returns fatalError on unparseable", () => {
    const out = parseVitestJson("garbage not json");
    expect(out.fatalError).toBeDefined();
  });

  it("parses an empty test run", () => {
    const json = JSON.stringify({ testResults: [] });
    const out = parseVitestJson(json);
    expect(out.files).toEqual([]);
    expect(out.totalPassed).toBe(0);
  });
});
