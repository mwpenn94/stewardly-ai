/**
 * Tests for package inspector — Pass 261.
 */

import { describe, it, expect } from "vitest";
import {
  parsePackageJson,
  classifyDependency,
  aggregate,
} from "./packageInspector";

describe("parsePackageJson", () => {
  it("parses a complete package.json", () => {
    const info = parsePackageJson(
      "package.json",
      JSON.stringify({
        name: "stewardly",
        version: "1.0.0",
        description: "test",
        dependencies: { react: "^19.0.0", "@types/node": "^20.0.0" },
        devDependencies: { vitest: "^2.0.0" },
        peerDependencies: { typescript: "^5.0.0" },
        scripts: { dev: "tsx watch", test: "vitest run" },
      }),
    );
    expect(info).not.toBeNull();
    expect(info!.name).toBe("stewardly");
    expect(info!.totalDeps).toBe(2);
    expect(info!.totalDevDeps).toBe(1);
    expect(info!.totalPeerDeps).toBe(1);
    expect(info!.dependencies).toHaveLength(4);
    expect(info!.scripts).toEqual({ dev: "tsx watch", test: "vitest run" });
  });

  it("returns null on malformed JSON", () => {
    expect(parsePackageJson("a/package.json", "{oops")).toBeNull();
  });

  it("handles missing optional fields", () => {
    const info = parsePackageJson(
      "package.json",
      JSON.stringify({ dependencies: { a: "1.0.0" } }),
    );
    expect(info).not.toBeNull();
    expect(info!.name).toBe("(unnamed)");
    expect(info!.version).toBe("0.0.0");
    expect(info!.totalDevDeps).toBe(0);
  });

  it("tolerates scripts being an array", () => {
    const info = parsePackageJson(
      "package.json",
      JSON.stringify({ scripts: ["not-an-object"] }),
    );
    expect(info).not.toBeNull();
    expect(info!.scripts).toEqual({});
  });

  it("returns null for non-object JSON", () => {
    expect(parsePackageJson("package.json", "42")).toBeNull();
  });
});

describe("classifyDependency", () => {
  it("detects pinned versions", () => {
    expect(classifyDependency("1.2.3").kind).toBe("pinned");
  });

  it("detects caret ranges", () => {
    expect(classifyDependency("^1.2.3").kind).toBe("range");
  });

  it("detects tilde ranges", () => {
    expect(classifyDependency("~1.2.3").kind).toBe("range");
  });

  it("flags wildcards as warnings", () => {
    expect(classifyDependency("*").severity).toBe("warning");
    expect(classifyDependency("latest").severity).toBe("warning");
  });

  it("detects local paths", () => {
    expect(classifyDependency("file:../x").kind).toBe("local");
    expect(classifyDependency("link:./y").kind).toBe("local");
    expect(classifyDependency("workspace:*").kind).toBe("local");
  });

  it("detects git sources", () => {
    expect(classifyDependency("git+https://github.com/foo/bar.git").kind).toBe("git");
    expect(classifyDependency("github:foo/bar").kind).toBe("git");
  });

  it("detects open ranges", () => {
    expect(classifyDependency(">=2.0.0").kind).toBe("range");
    expect(classifyDependency("1.0.0 || 2.0.0").kind).toBe("range");
  });
});

describe("aggregate", () => {
  it("rolls up totals and warnings", () => {
    const pkgs = [
      {
        path: "package.json",
        name: "a",
        version: "1",
        dependencies: [
          { name: "lodash", versionRange: "*", kind: "dependencies" as const },
          { name: "react", versionRange: "^19.0.0", kind: "dependencies" as const },
        ],
        scripts: {},
        totalDeps: 2,
        totalDevDeps: 0,
        totalPeerDeps: 0,
        totalOptionalDeps: 0,
      },
    ];
    const out = aggregate(pkgs);
    expect(out.totalPackages).toBe(1);
    expect(out.totalDependencies).toBe(2);
    expect(out.warnings).toHaveLength(1);
    expect(out.warnings[0].dependency).toBe("lodash");
  });

  it("returns zeros for empty input", () => {
    const out = aggregate([]);
    expect(out.totalPackages).toBe(0);
    expect(out.warnings).toEqual([]);
  });
});
