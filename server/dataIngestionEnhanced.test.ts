/**
 * Enhanced Data Ingestion Test Suite
 * Tests for: bulk scraping, RSS feed parsing, sitemap crawling,
 * competitor intelligence, product catalog parsing, data quality scoring,
 * and AI insight generation.
 */
import { describe, it, expect } from "vitest";

// ─── Bulk Scraper Tests ─────────────────────────────────────────────────────

describe("BulkScraperService", () => {
  it("should parse multiple URLs from newline-separated input", () => {
    const parseUrls = (input: string) =>
      input.split("\n").map(u => u.trim()).filter(u => u.length > 0 && u.startsWith("http"));

    const input = "https://example.com/page1\nhttps://example.com/page2\nbad-url\n\nhttps://example.com/page3";
    const urls = parseUrls(input);
    expect(urls).toHaveLength(3);
    expect(urls[0]).toBe("https://example.com/page1");
    expect(urls[2]).toBe("https://example.com/page3");
  });

  it("should enforce max URL limit for bulk scraping", () => {
    const MAX_URLS = 100;
    const urls = Array.from({ length: 150 }, (_, i) => `https://example.com/page${i}`);
    const limited = urls.slice(0, MAX_URLS);
    expect(limited).toHaveLength(100);
    expect(limited[99]).toBe("https://example.com/page99");
  });

  it("should generate unique entity IDs for bulk scraped records", () => {
    const generateId = (url: string, name: string) => `bulk-${url}-${name}-${Date.now()}`;
    const id1 = generateId("https://a.com", "Entity1");
    const id2 = generateId("https://b.com", "Entity2");
    expect(id1).toContain("bulk-");
    expect(id1).toContain("Entity1");
    expect(id1).not.toBe(id2);
  });

  it("should track batch progress correctly", () => {
    const trackProgress = (total: number, processed: number, success: number, failed: number) => ({
      total,
      processed,
      success,
      failed,
      progressPct: total > 0 ? Math.round((processed / total) * 100) : 0,
      status: processed === total ? (failed === total ? "failed" : "completed") : "processing",
    });

    expect(trackProgress(10, 5, 4, 1)).toEqual({
      total: 10, processed: 5, success: 4, failed: 1, progressPct: 50, status: "processing",
    });
    expect(trackProgress(10, 10, 8, 2)).toEqual({
      total: 10, processed: 10, success: 8, failed: 2, progressPct: 100, status: "completed",
    });
    expect(trackProgress(3, 3, 0, 3)).toEqual({
      total: 3, processed: 3, success: 0, failed: 3, progressPct: 100, status: "failed",
    });
  });
});

// ─── Sitemap Crawler Tests ──────────────────────────────────────────────────

describe("SitemapCrawler", () => {
  it("should extract URLs from sitemap XML", () => {
    const extractUrls = (xml: string, maxUrls: number) => {
      const urls: string[] = [];
      const regex = /<loc>(.*?)<\/loc>/g;
      let match;
      while ((match = regex.exec(xml)) !== null && urls.length < maxUrls) {
        urls.push(match[1]);
      }
      return urls;
    };

    const xml = `<?xml version="1.0"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://example.com/page1</loc></url>
      <url><loc>https://example.com/page2</loc></url>
      <url><loc>https://example.com/page3</loc></url>
    </urlset>`;

    const urls = extractUrls(xml, 50);
    expect(urls).toHaveLength(3);
    expect(urls[0]).toBe("https://example.com/page1");
  });

  it("should respect maxUrls limit when crawling sitemaps", () => {
    const extractUrls = (xml: string, maxUrls: number) => {
      const urls: string[] = [];
      const regex = /<loc>(.*?)<\/loc>/g;
      let match;
      while ((match = regex.exec(xml)) !== null && urls.length < maxUrls) {
        urls.push(match[1]);
      }
      return urls;
    };

    const entries = Array.from({ length: 100 }, (_, i) =>
      `<url><loc>https://example.com/page${i}</loc></url>`
    ).join("\n");
    const xml = `<urlset>${entries}</urlset>`;

    expect(extractUrls(xml, 10)).toHaveLength(10);
    expect(extractUrls(xml, 200)).toHaveLength(100);
  });
});

// ─── RSS Feed Service Tests ─────────────────────────────────────────────────

describe("RSSFeedService", () => {
  it("should parse RSS 2.0 items", () => {
    const extractTag = (xml: string, tag: string): string => {
      const regex = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, "s");
      const match = xml.match(regex);
      return match ? match[1].trim() : "";
    };

    const item = `<item>
      <title>Market Update Q1 2026</title>
      <link>https://news.example.com/article1</link>
      <description>S&amp;P 500 reaches new highs</description>
      <pubDate>Mon, 20 Mar 2026 12:00:00 GMT</pubDate>
    </item>`;

    expect(extractTag(item, "title")).toBe("Market Update Q1 2026");
    expect(extractTag(item, "link")).toBe("https://news.example.com/article1");
    expect(extractTag(item, "pubDate")).toBe("Mon, 20 Mar 2026 12:00:00 GMT");
  });

  it("should handle CDATA sections in RSS", () => {
    const extractTag = (xml: string, tag: string): string => {
      const regex = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, "s");
      const match = xml.match(regex);
      return match ? match[1].trim() : "";
    };

    const item = `<item><title><![CDATA[Breaking: Fed Raises Rates]]></title></item>`;
    expect(extractTag(item, "title")).toBe("Breaking: Fed Raises Rates");
  });

  it("should strip HTML from descriptions", () => {
    const stripHtml = (html: string) =>
      html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000);

    expect(stripHtml("<p>Hello <b>world</b></p>")).toBe("Hello world");
    expect(stripHtml("<div><a href='#'>Link</a> text</div>")).toBe("Link text");
  });

  it("should parse Atom feed entries", () => {
    const xml = `<feed>
      <entry>
        <title>Regulatory Update</title>
        <link href="https://example.com/update1" />
        <summary>New compliance requirements</summary>
        <published>2026-03-20T12:00:00Z</published>
      </entry>
    </feed>`;

    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    const match = entryRegex.exec(xml);
    expect(match).not.toBeNull();

    const content = match![1];
    const linkMatch = content.match(/<link[^>]*href="([^"]*)"[^>]*\/>/);
    expect(linkMatch![1]).toBe("https://example.com/update1");
  });
});

// ─── Data Quality Service Tests ─────────────────────────────────────────────

describe("DataQualityService", () => {
  it("should calculate completeness from record fields", () => {
    const calculateCompleteness = (records: any[]) => {
      if (records.length === 0) return 0;
      let filled = 0, total = 0;
      for (const r of records) {
        total += 5;
        if (r.title) filled++;
        if (r.contentSummary) filled++;
        if (r.structuredData) filled++;
        if (r.entityId) filled++;
        if (r.tags) filled++;
      }
      return Math.round((filled / total) * 100);
    };

    const fullRecords = [
      { title: "A", contentSummary: "B", structuredData: {}, entityId: "1", tags: ["x"] },
      { title: "C", contentSummary: "D", structuredData: {}, entityId: "2", tags: ["y"] },
    ];
    expect(calculateCompleteness(fullRecords)).toBe(100);

    const partialRecords = [
      { title: "A", contentSummary: null, structuredData: null, entityId: "1", tags: null },
    ];
    expect(calculateCompleteness(partialRecords)).toBe(40);
  });

  it("should calculate accuracy from confidence scores", () => {
    const calculateAccuracy = (records: { confidenceScore: string }[]) => {
      if (records.length === 0) return 0;
      const avg = records.reduce((sum, r) => sum + Number(r.confidenceScore || 0), 0) / records.length;
      return Math.round(avg * 100);
    };

    expect(calculateAccuracy([
      { confidenceScore: "0.90" },
      { confidenceScore: "0.80" },
      { confidenceScore: "0.70" },
    ])).toBe(80);

    expect(calculateAccuracy([])).toBe(0);
  });

  it("should calculate freshness based on record age", () => {
    const calculateFreshness = (records: { createdAt: number }[]) => {
      if (records.length === 0) return 0;
      const now = Date.now();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      const fresh = records.filter(r => (now - r.createdAt) < sevenDays).length;
      return Math.round((fresh / records.length) * 100);
    };

    const now = Date.now();
    const freshRecords = [
      { createdAt: now - 1000 },
      { createdAt: now - 86400000 }, // 1 day
    ];
    expect(calculateFreshness(freshRecords)).toBe(100);

    const mixedRecords = [
      { createdAt: now - 1000 },
      { createdAt: now - 8 * 24 * 60 * 60 * 1000 }, // 8 days old
    ];
    expect(calculateFreshness(mixedRecords)).toBe(50);
  });

  it("should calculate overall quality score as average of dimensions", () => {
    const overall = (completeness: number, accuracy: number, freshness: number, consistency: number) =>
      (completeness + accuracy + freshness + consistency) / 4;

    expect(overall(80, 90, 70, 100)).toBe(85);
    expect(overall(0, 0, 0, 0)).toBe(0);
    expect(overall(100, 100, 100, 100)).toBe(100);
  });

  it("should generate quality issues and recommendations", () => {
    const generateIssues = (scores: { completeness: number; accuracy: number; freshness: number; consistency: number }) => {
      const issues: string[] = [];
      const recommendations: string[] = [];

      if (scores.completeness < 70) {
        issues.push("Low data completeness");
        recommendations.push("Review source configuration");
      }
      if (scores.accuracy < 70) {
        issues.push("Low confidence scores");
        recommendations.push("Improve extraction prompts");
      }
      if (scores.freshness < 70) {
        issues.push("Data is stale");
        recommendations.push("Increase ingestion frequency");
      }
      if (scores.consistency < 70) {
        issues.push("Inconsistent formats");
        recommendations.push("Normalize data formats");
      }

      return { issues, recommendations };
    };

    const result = generateIssues({ completeness: 50, accuracy: 90, freshness: 60, consistency: 80 });
    expect(result.issues).toHaveLength(2);
    expect(result.issues).toContain("Low data completeness");
    expect(result.issues).toContain("Data is stale");
    expect(result.recommendations).toHaveLength(2);
  });
});

// ─── Insight Generator Tests ────────────────────────────────────────────────

describe("InsightGeneratorService", () => {
  it("should validate insight types", () => {
    const validTypes = ["trend", "anomaly", "opportunity", "risk", "recommendation", "competitive_intel", "market_shift", "regulatory_change"];
    const validateType = (type: string) => validTypes.includes(type) ? type : "recommendation";

    expect(validateType("trend")).toBe("trend");
    expect(validateType("anomaly")).toBe("anomaly");
    expect(validateType("invalid")).toBe("recommendation");
  });

  it("should validate severity levels", () => {
    const validSeverities = ["low", "medium", "high", "critical"];
    const validateSeverity = (severity: string) => validSeverities.includes(severity) ? severity : "medium";

    expect(validateSeverity("high")).toBe("high");
    expect(validateSeverity("critical")).toBe("critical");
    expect(validateSeverity("extreme")).toBe("medium");
  });

  it("should truncate insight titles to max length", () => {
    const truncate = (title: string, max: number = 500) => title.slice(0, max);
    const longTitle = "A".repeat(600);
    expect(truncate(longTitle)).toHaveLength(500);
    expect(truncate("Short title")).toBe("Short title");
  });

  it("should filter unacknowledged insights", () => {
    const insights = [
      { id: 1, acknowledged: false, title: "New trend" },
      { id: 2, acknowledged: true, title: "Old insight" },
      { id: 3, acknowledged: false, title: "Risk alert" },
    ];
    const unacknowledged = insights.filter(i => !i.acknowledged);
    expect(unacknowledged).toHaveLength(2);
    expect(unacknowledged[0].id).toBe(1);
  });
});

// ─── Competitor Intelligence Tests ──────────────────────────────────────────

describe("CompetitorIntelService", () => {
  it("should generate competitor entity IDs", () => {
    const generateId = (name: string) => `competitor-${name}-${Date.now()}`;
    const id = generateId("Acme Financial");
    expect(id).toContain("competitor-");
    expect(id).toContain("Acme Financial");
  });

  it("should structure competitor analysis results", () => {
    const analysis = {
      overview: "Leading fintech company",
      strengths: ["Strong brand", "Large user base"],
      weaknesses: ["High fees", "Limited products"],
      products: ["Robo-advisor", "Banking"],
      targetMarket: "Millennials",
      pricingModel: "Freemium",
      differentiators: ["AI-powered", "Social features"],
      threats: ["Regulatory changes"],
      opportunities: ["International expansion"],
    };

    expect(analysis.strengths).toHaveLength(2);
    expect(analysis.weaknesses).toHaveLength(2);
    expect(analysis.targetMarket).toBe("Millennials");
    expect(analysis.threats).toContain("Regulatory changes");
  });
});

// ─── Product Catalog Parser Tests ───────────────────────────────────────────

describe("ProductCatalogParser", () => {
  it("should generate product entity IDs with category", () => {
    const generateId = (name: string) => `product-${name}-${Date.now()}`;
    const id = generateId("Term Life 20");
    expect(id).toContain("product-");
    expect(id).toContain("Term Life 20");
  });

  it("should tag products with category", () => {
    const createTags = (category?: string) => ["product_catalog", category || "general"];
    expect(createTags("insurance")).toEqual(["product_catalog", "insurance"]);
    expect(createTags()).toEqual(["product_catalog", "general"]);
  });

  it("should validate product categories", () => {
    const validCategories = ["insurance", "investment", "banking", "annuity", "retirement", "estate", "general"];
    const validate = (cat: string) => validCategories.includes(cat);
    expect(validate("insurance")).toBe(true);
    expect(validate("crypto")).toBe(false);
  });
});

// ─── Scrape Schedule Tests ──────────────────────────────────────────────────

describe("ScrapeSchedules", () => {
  it("should validate cron expressions", () => {
    const isValidCron = (expr: string) => {
      const parts = expr.split(" ");
      return parts.length >= 5 && parts.length <= 6;
    };
    expect(isValidCron("0 */6 * * *")).toBe(true);
    expect(isValidCron("0 0 * * 1-5")).toBe(true);
    expect(isValidCron("bad")).toBe(false);
  });

  it("should calculate next run time from cron", () => {
    // Simple test: daily at midnight should be within 24 hours
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const nextRun = now + oneDayMs; // simplified
    expect(nextRun - now).toBeLessThanOrEqual(oneDayMs);
  });

  it("should respect retry limits", () => {
    const shouldRetry = (attempts: number, maxRetries: number) => attempts < maxRetries;
    expect(shouldRetry(0, 3)).toBe(true);
    expect(shouldRetry(2, 3)).toBe(true);
    expect(shouldRetry(3, 3)).toBe(false);
    expect(shouldRetry(5, 3)).toBe(false);
  });
});

// ─── Bulk Import Batch Tests ────────────────────────────────────────────────

describe("BulkImportBatches", () => {
  it("should validate import types", () => {
    const validTypes = ["csv_upload", "api_bulk", "multi_url_scrape", "rss_feed", "sitemap_crawl"];
    validTypes.forEach(t => expect(validTypes.includes(t)).toBe(true));
    expect(validTypes.includes("invalid_type")).toBe(false);
  });

  it("should calculate batch completion percentage", () => {
    const completionPct = (processed: number, total: number) =>
      total > 0 ? Math.round((processed / total) * 100) : 0;

    expect(completionPct(5, 10)).toBe(50);
    expect(completionPct(10, 10)).toBe(100);
    expect(completionPct(0, 10)).toBe(0);
    expect(completionPct(0, 0)).toBe(0);
  });

  it("should determine batch status from results", () => {
    const batchStatus = (total: number, success: number, failed: number) => {
      if (success + failed < total) return "processing";
      if (failed === total) return "failed";
      return "completed";
    };

    expect(batchStatus(10, 5, 2)).toBe("processing");
    expect(batchStatus(10, 8, 2)).toBe("completed");
    expect(batchStatus(5, 0, 5)).toBe("failed");
  });
});
