/**
 * Tests for URL validator — Pass 272.
 */

import { describe, it, expect } from "vitest";
import {
  extractUrls,
  classifyUrl,
  labelForUrl,
  isSuspicious,
  inspectUrl,
  inspectAllUrls,
  TRUSTED_HOSTS,
} from "./urlValidator";

describe("extractUrls", () => {
  it("returns empty for text with no URLs", () => {
    expect(extractUrls("just plain text")).toEqual([]);
  });

  it("extracts a single URL", () => {
    expect(extractUrls("Visit https://github.com/foo")).toEqual([
      "https://github.com/foo",
    ]);
  });

  it("extracts multiple URLs", () => {
    const out = extractUrls(
      "See https://a.com and http://b.com for details.",
    );
    expect(out).toContain("https://a.com");
    expect(out).toContain("http://b.com");
  });

  it("dedupes repeated URLs", () => {
    const out = extractUrls("https://a.com and https://a.com again");
    expect(out).toHaveLength(1);
  });

  it("strips trailing punctuation", () => {
    expect(extractUrls("See https://a.com.")).toEqual(["https://a.com"]);
    expect(extractUrls("See https://a.com,")).toEqual(["https://a.com"]);
  });

  it("handles empty input", () => {
    expect(extractUrls("")).toEqual([]);
  });
});

describe("classifyUrl", () => {
  it("classifies GitHub issue", () => {
    expect(classifyUrl("https://github.com/foo/bar/issues/123")).toBe("issue");
  });

  it("classifies GitHub repo root as code", () => {
    expect(classifyUrl("https://github.com/foo/bar")).toBe("code");
  });

  it("classifies npm as package", () => {
    expect(classifyUrl("https://www.npmjs.com/package/react")).toBe("package");
  });

  it("classifies image URLs", () => {
    expect(classifyUrl("https://example.com/pic.png")).toBe("image");
  });

  it("classifies docs subdomain", () => {
    expect(classifyUrl("https://docs.anthropic.com/claude")).toBe("docs");
  });

  it("classifies developer.mozilla as docs", () => {
    expect(classifyUrl("https://developer.mozilla.org/en-US/")).toBe("docs");
  });

  it("classifies youtube as video", () => {
    expect(classifyUrl("https://youtube.com/watch?v=x")).toBe("video");
  });

  it("classifies api subdomain as api", () => {
    expect(classifyUrl("https://api.example.com/v1")).toBe("api");
  });

  it("falls back to unknown for unclassified", () => {
    expect(classifyUrl("https://example.com/foo")).toBe("unknown");
  });

  it("returns unknown on invalid URL", () => {
    expect(classifyUrl("not-a-url")).toBe("unknown");
  });
});

describe("labelForUrl", () => {
  it("strips protocol", () => {
    expect(labelForUrl("https://github.com/foo")).toBe("github.com/foo");
  });

  it("strips root path", () => {
    expect(labelForUrl("https://example.com/")).toBe("example.com");
  });

  it("truncates long URLs with ellipsis", () => {
    const long = `https://example.com/${"x".repeat(200)}`;
    const out = labelForUrl(long);
    expect(out.length).toBeLessThanOrEqual(60);
    expect(out).toContain("…");
  });

  it("returns raw URL slice on parse failure", () => {
    expect(labelForUrl("not a url")).toBe("not a url");
  });
});

describe("isSuspicious", () => {
  it("legitimate URLs are not suspicious", () => {
    expect(isSuspicious("https://github.com/foo/bar")).toBe(false);
  });

  it("excessive numbers in host", () => {
    expect(isSuspicious("https://foo12345.com")).toBe(true);
  });

  it("triple-dash in host", () => {
    expect(isSuspicious("https://foo---bar.com")).toBe(true);
  });

  it("no-vowel segment flags suspicious", () => {
    expect(isSuspicious("https://zxfbcdkrmn.com")).toBe(true);
  });

  it("invalid URLs are suspicious", () => {
    expect(isSuspicious("not-a-url")).toBe(true);
  });
});

describe("inspectUrl", () => {
  it("returns full structured inspection for valid URL", () => {
    const out = inspectUrl("https://github.com/foo/bar/issues/42?tab=1#comment");
    expect(out.protocol).toBe("https");
    expect(out.host).toBe("github.com");
    expect(out.pathname).toBe("/foo/bar/issues/42");
    expect(out.search).toBe("?tab=1");
    expect(out.hash).toBe("#comment");
    expect(out.category).toBe("issue");
    expect(out.trusted).toBe(true);
    expect(out.suspicious).toBe(false);
  });

  it("graceful on invalid URL", () => {
    const out = inspectUrl("not-valid");
    expect(out.category).toBe("unknown");
    expect(out.trusted).toBe(false);
    expect(out.suspicious).toBe(true);
  });

  it("untrusted hosts are marked not-trusted", () => {
    const out = inspectUrl("https://random.example.com");
    expect(out.trusted).toBe(false);
  });
});

describe("inspectAllUrls", () => {
  it("returns empty for no URLs", () => {
    expect(inspectAllUrls("hi")).toEqual([]);
  });

  it("inspects each URL and sorts by category", () => {
    const text =
      "See https://npmjs.com/package/x and https://github.com/foo/bar and https://docs.anthropic.com";
    const out = inspectAllUrls(text);
    expect(out.length).toBe(3);
    const categories = out.map((u) => u.category);
    // Alphabetical: code, docs, package
    expect(categories).toEqual(["code", "docs", "package"]);
  });
});

describe("TRUSTED_HOSTS", () => {
  it("contains major docs domains", () => {
    expect(TRUSTED_HOSTS.has("github.com")).toBe(true);
    expect(TRUSTED_HOSTS.has("docs.anthropic.com")).toBe(true);
    expect(TRUSTED_HOSTS.has("developer.mozilla.org")).toBe(true);
  });
});
