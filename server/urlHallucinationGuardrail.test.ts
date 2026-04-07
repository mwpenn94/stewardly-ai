/**
 * URL Hallucination Guardrail Tests
 *
 * Verifies that the guardrail correctly identifies URLs in AI responses
 * that were NOT present in the source context (tool/RAG/web-search output).
 * This is critical because the RICH MEDIA prompt guidance encourages the
 * model to include URLs, creating a risk of URL fabrication.
 */
import { describe, expect, it } from "vitest";
import {
  detectHallucinatedURLs,
  extractURLsFromText,
  stripHallucinatedURLs,
} from "./shared/guardrails/urlHallucination";

describe("extractURLsFromText", () => {
  it("extracts HTTP and HTTPS URLs", () => {
    const text = "Visit http://example.com and https://secure.example.com";
    const urls = extractURLsFromText(text);
    expect(urls).toContain("http://example.com");
    expect(urls).toContain("https://secure.example.com");
  });

  it("deduplicates repeated URLs", () => {
    const text = "See https://example.com and also https://example.com";
    const urls = extractURLsFromText(text);
    expect(urls.length).toBe(1);
  });

  it("returns empty array for text with no URLs", () => {
    expect(extractURLsFromText("No links here")).toEqual([]);
  });

  it("handles URLs with paths and query parameters", () => {
    const text = "Check https://example.com/path/to/resource?key=value&other=123";
    const urls = extractURLsFromText(text);
    expect(urls.length).toBe(1);
    expect(urls[0]).toContain("/path/to/resource");
  });
});

describe("detectHallucinatedURLs", () => {
  it("passes when all response URLs are in source context", () => {
    const source = "Found: https://example.com/report.pdf and https://example.com/data.csv";
    const response = "Download the report at https://example.com/report.pdf";

    const result = detectHallucinatedURLs(response, source);
    expect(result.passed).toBe(true);
    expect(result.hallucinated).toEqual([]);
    expect(result.legitimate.length).toBe(1);
  });

  it("fails when response contains URLs not in source", () => {
    const source = "No relevant URLs found.";
    const response = "Check https://fake-advisor.com/free-money.pdf";

    const result = detectHallucinatedURLs(response, source);
    expect(result.passed).toBe(false);
    expect(result.hallucinated.length).toBe(1);
    expect(result.hallucinated[0]).toContain("fake-advisor.com");
  });

  it("allows trusted government domains without source context", () => {
    const source = "General tax question.";
    const response = `
      IRS Form 1040: https://www.irs.gov/pub/irs-pdf/f1040.pdf
      SEC EDGAR: https://www.sec.gov/cgi-bin/browse-edgar
      FINRA BrokerCheck: https://brokercheck.finra.org/
      SSA benefits: https://www.ssa.gov/benefits
      Treasury rates: https://www.treasury.gov/resource-center
      FRED data: https://fred.stlouisfed.org/series/SOFR
    `;

    const result = detectHallucinatedURLs(response, source);
    expect(result.passed).toBe(true);
    expect(result.hallucinated).toEqual([]);
    expect(result.legitimate.length).toBe(6);
  });

  it("allows YouTube URLs as trusted media sources", () => {
    const source = "";
    const response = "Watch: https://www.youtube.com/watch?v=abc123 and https://youtu.be/xyz789";

    const result = detectHallucinatedURLs(response, source);
    expect(result.passed).toBe(true);
    expect(result.legitimate.length).toBe(2);
  });

  it("correctly separates legitimate from hallucinated in mixed responses", () => {
    const source = "Web search: https://www.investopedia.com/terms/i/iul.asp";
    const response = `
      Investopedia: https://www.investopedia.com/terms/i/iul.asp
      IRS guidance: https://www.irs.gov/retirement-plans
      Fake site: https://totally-fake-finance.com/secrets.pdf
    `;

    const result = detectHallucinatedURLs(response, source);
    expect(result.passed).toBe(false);
    expect(result.legitimate.length).toBe(2); // investopedia (source) + irs.gov (trusted)
    expect(result.hallucinated.length).toBe(1);
    expect(result.hallucinated[0]).toContain("totally-fake-finance.com");
  });

  it("handles empty response", () => {
    const result = detectHallucinatedURLs("", "some context");
    expect(result.passed).toBe(true);
    expect(result.totalURLs).toBe(0);
  });

  it("handles empty source context", () => {
    const result = detectHallucinatedURLs(
      "Visit https://www.irs.gov/help",
      ""
    );
    expect(result.passed).toBe(true); // irs.gov is trusted
  });

  it("allows Wikipedia as a trusted domain", () => {
    const result = detectHallucinatedURLs(
      "See https://en.wikipedia.org/wiki/Financial_planning",
      ""
    );
    expect(result.passed).toBe(true);
  });

  it("allows DOI links as trusted", () => {
    const result = detectHallucinatedURLs(
      "Research paper: https://doi.org/10.1234/example",
      ""
    );
    expect(result.passed).toBe(true);
  });

  it("flags multiple fabricated domains", () => {
    const source = "";
    const response = `
      https://not-real-1.com/doc.pdf
      https://not-real-2.org/report.docx
      https://fake-broker.net/signup
    `;

    const result = detectHallucinatedURLs(response, source);
    expect(result.passed).toBe(false);
    expect(result.hallucinated.length).toBe(3);
  });

  it("reports correct totalURLs count", () => {
    const response = "https://a.com https://b.com https://www.irs.gov/help";
    const result = detectHallucinatedURLs(response, "");
    expect(result.totalURLs).toBe(3);
  });
});

describe("stripHallucinatedURLs", () => {
  it("replaces hallucinated URLs with warning text", () => {
    const source = "";
    const response = "Check https://fake-site.com/report.pdf for details.";

    const { cleaned, strippedCount } = stripHallucinatedURLs(response, source);
    expect(strippedCount).toBe(1);
    expect(cleaned).toContain("[URL removed — source not verified]");
    expect(cleaned).not.toContain("fake-site.com");
  });

  it("preserves legitimate URLs", () => {
    const source = "Found: https://example.com/data.pdf";
    const response = "Download: https://example.com/data.pdf and also https://www.irs.gov/help";

    const { cleaned, strippedCount } = stripHallucinatedURLs(response, source);
    expect(strippedCount).toBe(0);
    expect(cleaned).toContain("https://example.com/data.pdf");
    expect(cleaned).toContain("https://www.irs.gov/help");
  });

  it("strips only hallucinated URLs in mixed content", () => {
    const source = "https://legit.com/doc.pdf";
    const response = "See https://legit.com/doc.pdf and https://fake.com/bad.pdf";

    const { cleaned, strippedCount } = stripHallucinatedURLs(response, source);
    expect(strippedCount).toBe(1);
    expect(cleaned).toContain("https://legit.com/doc.pdf");
    expect(cleaned).not.toContain("fake.com");
  });

  it("returns original text when no hallucinated URLs", () => {
    const response = "Plain text with no URLs.";
    const { cleaned, strippedCount } = stripHallucinatedURLs(response, "");
    expect(strippedCount).toBe(0);
    expect(cleaned).toBe(response);
  });
});
