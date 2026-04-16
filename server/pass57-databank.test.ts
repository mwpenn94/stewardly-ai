/**
 * Pass 57 — DataBank Enrichment Service Tests
 */
import { describe, it, expect } from "vitest";
import {
  KEY_FINANCIAL_INDICATORS,
  getFinancialIndicatorContext,
} from "./services/databankEnrichment";

describe("DataBank Enrichment Service", () => {
  describe("KEY_FINANCIAL_INDICATORS", () => {
    it("has 12 key indicators", () => {
      expect(KEY_FINANCIAL_INDICATORS).toHaveLength(12);
    });

    it("each indicator has code, name, and category", () => {
      for (const ind of KEY_FINANCIAL_INDICATORS) {
        expect(ind.code).toBeTruthy();
        expect(ind.name).toBeTruthy();
        expect(ind.category).toBeTruthy();
      }
    });

    it("includes GDP indicator", () => {
      const gdp = KEY_FINANCIAL_INDICATORS.find(i => i.code === "NY.GDP.MKTP.CD");
      expect(gdp).toBeDefined();
      expect(gdp!.name).toContain("GDP");
    });

    it("includes inflation indicator", () => {
      const cpi = KEY_FINANCIAL_INDICATORS.find(i => i.code === "FP.CPI.TOTL.ZG");
      expect(cpi).toBeDefined();
      expect(cpi!.name).toContain("Inflation");
    });

    it("includes unemployment indicator", () => {
      const unemp = KEY_FINANCIAL_INDICATORS.find(i => i.code === "SL.UEM.TOTL.ZS");
      expect(unemp).toBeDefined();
      expect(unemp!.name).toContain("Unemployment");
    });

    it("covers all expected categories", () => {
      const categories = new Set(KEY_FINANCIAL_INDICATORS.map(i => i.category));
      expect(categories.has("economic")).toBe(true);
      expect(categories.has("labor")).toBe(true);
      expect(categories.has("trade")).toBe(true);
      expect(categories.has("fiscal")).toBe(true);
      expect(categories.has("monetary")).toBe(true);
      expect(categories.has("markets")).toBe(true);
    });

    it("all codes follow World Bank format (dots and uppercase)", () => {
      for (const ind of KEY_FINANCIAL_INDICATORS) {
        expect(ind.code).toMatch(/^[A-Z][A-Z0-9.]+$/);
      }
    });
  });

  describe("getFinancialIndicatorContext", () => {
    it("returns a non-empty markdown string", async () => {
      const context = await getFinancialIndicatorContext();
      expect(context).toBeTruthy();
      expect(context.length).toBeGreaterThan(100);
    });

    it("includes World Bank header", async () => {
      const context = await getFinancialIndicatorContext();
      expect(context).toContain("World Bank Development Indicators");
    });

    it("includes all indicator names", async () => {
      const context = await getFinancialIndicatorContext();
      for (const ind of KEY_FINANCIAL_INDICATORS) {
        expect(context).toContain(ind.name);
      }
    });

    it("includes all indicator codes", async () => {
      const context = await getFinancialIndicatorContext();
      for (const ind of KEY_FINANCIAL_INDICATORS) {
        expect(context).toContain(ind.code);
      }
    });
  });
});
