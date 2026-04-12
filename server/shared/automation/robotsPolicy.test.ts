import { describe, it, expect } from "vitest";
import {
  parseRobots,
  isAllowed,
  RobotsChecker,
  type RobotsFetcher,
} from "./robotsPolicy";

describe("parseRobots", () => {
  it("parses groups with multiple UAs + allow/disallow + crawl-delay", () => {
    const text = `
User-agent: Googlebot
User-agent: Bingbot
Disallow: /private/
Allow: /public/
Crawl-delay: 2

User-agent: *
Disallow: /

Sitemap: https://example.com/sitemap.xml
`;
    const p = parseRobots(text);
    expect(p.groups).toHaveLength(2);
    expect(p.groups[0].agents).toEqual(["googlebot", "bingbot"]);
    expect(p.groups[0].rules).toHaveLength(2);
    expect(p.groups[0].crawlDelay).toBe(2);
    expect(p.groups[1].agents).toEqual(["*"]);
    expect(p.sitemaps).toEqual(["https://example.com/sitemap.xml"]);
  });

  it("skips comments and blank lines", () => {
    const text = `
# This is a comment
User-agent: *  # inline
Disallow: /x   # another
`;
    const p = parseRobots(text);
    expect(p.groups).toHaveLength(1);
    expect(p.groups[0].rules[0].path).toBe("/x");
  });

  it("returns empty policy for non-string", () => {
    // @ts-expect-error testing bad input
    const p = parseRobots(null);
    expect(p.groups).toHaveLength(0);
  });

  it("ignores directives before any User-agent", () => {
    const p = parseRobots("Disallow: /nope\nUser-agent: *\nDisallow: /x");
    expect(p.groups).toHaveLength(1);
    expect(p.groups[0].rules.map((r) => r.path)).toEqual(["/x"]);
  });
});

describe("isAllowed", () => {
  const policy = parseRobots(`
User-agent: *
Disallow: /private/
Allow: /private/public/
Disallow: /*.pdf$
Crawl-delay: 5

User-agent: BadBot
Disallow: /
`);

  it("allows paths with no matching rule", () => {
    const d = isAllowed(policy, "StewardlyAI-Browser/1.0", "/hello");
    expect(d.allowed).toBe(true);
    expect(d.crawlDelay).toBe(5);
  });

  it("blocks disallowed paths", () => {
    const d = isAllowed(policy, "StewardlyAI-Browser/1.0", "/private/secret");
    expect(d.allowed).toBe(false);
    expect(d.matchedRule?.path).toBe("/private/");
  });

  it("allow-longer-than-disallow wins", () => {
    const d = isAllowed(policy, "StewardlyAI-Browser/1.0", "/private/public/file.html");
    expect(d.allowed).toBe(true);
  });

  it("wildcard + $ anchor blocks .pdf", () => {
    const d = isAllowed(policy, "StewardlyAI-Browser/1.0", "/docs/report.pdf");
    expect(d.allowed).toBe(false);
  });

  it("specific UA group overrides *", () => {
    const d = isAllowed(policy, "BadBot/9", "/hello");
    expect(d.allowed).toBe(false);
  });

  it("surfaces crawlDelay from wildcard group", () => {
    const d = isAllowed(policy, "StewardlyAI-Browser/1.0", "/");
    expect(d.crawlDelay).toBe(5);
  });
});

describe("RobotsChecker", () => {
  function stubFetcher(pages: Record<string, string | null>): RobotsFetcher {
    return {
      async fetchRobots(url: string) {
        return pages[url] ?? null;
      },
    };
  }

  it("caches fetched policy across calls", async () => {
    let count = 0;
    const fetcher: RobotsFetcher = {
      async fetchRobots() {
        count++;
        return "User-agent: *\nDisallow: /x\n";
      },
    };
    const checker = new RobotsChecker(fetcher);
    const d1 = await checker.check("https://ex.com/x", "ua");
    const d2 = await checker.check("https://ex.com/y", "ua");
    expect(d1.allowed).toBe(false);
    expect(d2.allowed).toBe(true);
    expect(count).toBe(1);
  });

  it("degrades to allow-all when robots.txt is missing", async () => {
    const checker = new RobotsChecker(stubFetcher({}));
    const d = await checker.check("https://ex.com/anything", "ua");
    expect(d.allowed).toBe(true);
  });

  it("refetches after TTL expires", async () => {
    let count = 0;
    const fetcher: RobotsFetcher = {
      async fetchRobots() {
        count++;
        return count === 1 ? "User-agent: *\nDisallow: /x\n" : "User-agent: *\nAllow: /x\n";
      },
    };
    let now = 0;
    const checker = new RobotsChecker(fetcher, 1000, () => now);
    const d1 = await checker.check("https://ex.com/x", "ua");
    expect(d1.allowed).toBe(false);
    now = 2000;
    const d2 = await checker.check("https://ex.com/x", "ua");
    expect(d2.allowed).toBe(true);
    expect(count).toBe(2);
  });
});
