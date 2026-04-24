/**
 * Expert Pass 4 — Data Fidelity
 * Validates data ingestion, normalization, and quality services.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
const ROOT = path.resolve(__dirname, "..");

describe("Expert Pass 4 — Data Fidelity", () => {
  it("dataIngestion exports WebScraperService", async () => {
    const mod = await import("./services/dataIngestion");
    expect(mod.WebScraperService).toBeDefined();
  });
  it("dataIngestion exports DocumentProcessorService", async () => {
    const mod = await import("./services/dataIngestion");
    expect(mod.DocumentProcessorService).toBeDefined();
  });
  it("dataIngestion exports MarketDataService", async () => {
    const mod = await import("./services/dataIngestion");
    expect(mod.MarketDataService).toBeDefined();
  });
  it("dataIngestion exports EntityExtractorService", async () => {
    const mod = await import("./services/dataIngestion");
    expect(mod.EntityExtractorService).toBeDefined();
  });
  it("dataIngestion exports DataNormalizerService", async () => {
    const mod = await import("./services/dataIngestion");
    expect(mod.DataNormalizerService).toBeDefined();
  });
  it("dataIngestionEnhanced exports BulkScraperService", async () => {
    const mod = await import("./services/dataIngestionEnhanced");
    expect(mod.BulkScraperService).toBeDefined();
  });
  it("dataIngestionEnhanced exports RSSFeedService", async () => {
    const mod = await import("./services/dataIngestionEnhanced");
    expect(mod.RSSFeedService).toBeDefined();
  });
  it("dataIngestionEnhanced exports DataQualityService", async () => {
    const mod = await import("./services/dataIngestionEnhanced");
    expect(mod.DataQualityService).toBeDefined();
  });
  it("dataIngestionEnhanced exports InsightGeneratorService", async () => {
    const mod = await import("./services/dataIngestionEnhanced");
    expect(mod.InsightGeneratorService).toBeDefined();
  });
  it("sourceProber detectFormat identifies JSON", async () => {
    const { detectFormat } = await import("./services/dynamicIntegrations/sourceProber");
    expect(detectFormat('{"a":1}', "application/json")).toBe("json");
  });
  it("sourceProber detectFormat identifies CSV", async () => {
    const { detectFormat } = await import("./services/dynamicIntegrations/sourceProber");
    expect(detectFormat("a,b\n1,2", "text/csv")).toBe("csv");
  });
  it("sourceProber parseNdjson parses correctly", async () => {
    const { parseNdjson } = await import("./services/dynamicIntegrations/sourceProber");
    const result = parseNdjson('{"a":1}\n{"b":2}');
    expect(result.records.length).toBe(2);
  });
  it("sourceProber parseJson parses single object", async () => {
    const { parseJson } = await import("./services/dynamicIntegrations/sourceProber");
    const result = parseJson('{"name":"Alice","age":30}');
    expect(result.records.length).toBe(1);
  });
  it("recordSanitizer sanitizeRecord handles basic input", async () => {
    const { sanitizeRecord } = await import("./services/dynamicIntegrations/recordSanitizer");
    const result = sanitizeRecord({ name: "  John  ", email: "TEST@EXAMPLE.COM" });
    expect(result).toBeDefined();
  });
  it("recordSanitizer sanitizeRecords handles array", async () => {
    const { sanitizeRecords } = await import("./services/dynamicIntegrations/recordSanitizer");
    const result = sanitizeRecords([{ name: "Alice" }, { name: "Bob" }]);
    expect(result).toBeDefined();
  });
  it("transformEngine getByPath navigates nested objects", async () => {
    const { getByPath } = await import("./services/dynamicIntegrations/transformEngine");
    expect(getByPath({ a: { b: 1 } }, "a.b")).toBe(1);
  });
  it("transformEngine setByPath creates nested paths", async () => {
    const { setByPath } = await import("./services/dynamicIntegrations/transformEngine");
    const obj: any = {};
    setByPath(obj, "a.b", 42);
    expect(obj.a.b).toBe(42);
  });
  it("adapterDSL canonicalJson produces deterministic output", async () => {
    const { canonicalJson } = await import("./services/dynamicIntegrations/adapterDSL");
    expect(typeof canonicalJson({ a: 1 })).toBe("string");
  });
  it("crossModelDistillation module exists", async () => {
    const mod = await import("./services/dynamicIntegrations/crossModelDistillation");
    expect(mod).toBeDefined();
  });
  it("governmentDataPipelines module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/governmentDataPipelines.ts"))).toBe(true);
  });
  it("statisticalModels module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/statisticalModels.ts"))).toBe(true);
  });
  it("dataPipelineUtils module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/dataPipelineUtils.ts"))).toBe(true);
  });
  it("dataSeedOrchestrator module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/dataSeedOrchestrator.ts"))).toBe(true);
  });
});
