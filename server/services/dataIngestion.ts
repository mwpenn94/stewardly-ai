/**
 * Data Ingestion & Intelligence Pipeline
 * Orchestrates multi-source data ingestion: web scraping, document processing,
 * market data feeds, entity extraction, and continuous learning.
 */
import { getDb } from "../db";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  dataSources, ingestionJobs, ingestedRecords,
  marketDataCache, webScrapeResults, documentExtractions,
} from "../../drizzle/schema";
import { contextualLLM } from "../shared/intelligence/sovereignWiring"
import { contextualLLM } from "./contextualLLM";

// ─── Types ─────────────────────────────────────────────────────────────────
export interface IngestionResult {
  jobId: number;
  status: "completed" | "failed" | "partial";
  recordsProcessed: number;
  recordsCreated: number;
  recordsErrored: number;
  durationMs: number;
  insights: string[];
}

export interface ScrapedPage {
  url: string;
  title: string;
  content: string;
  entities: Record<string, any>[];
  metrics: Record<string, any>;
}

export interface ExtractedDocument {
  type: string;
  data: Record<string, any>;
  entities: Record<string, any>[];
  amounts: { label: string; value: number; currency: string }[];
  confidence: number;
}

// ─── Web Scraper Service ───────────────────────────────────────────────────
export class WebScraperService {
  /**
   * Scrape a URL and extract structured data using LLM
   */
  async scrapeUrl(url: string, extractionPrompt?: string): Promise<ScrapedPage> {
    try {
      // Use server-side fetch to get page content
      const response = await fetch(url, {
        headers: { "User-Agent": "Stewardly/1.0 DataIngestion" },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      // Strip HTML tags for text content
      const textContent = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 15000); // Limit for LLM context

      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : url;

      // Use LLM to extract structured entities and metrics
      const extractionResult = await this.extractWithLLM(textContent, extractionPrompt || "Extract all financial entities, organizations, products, amounts, dates, and key metrics.");

      return {
        url,
        title,
        content: textContent.slice(0, 5000),
        entities: extractionResult.entities,
        metrics: extractionResult.metrics,
      };
    } catch (error: any) {
      return {
        url,
        title: "",
        content: "",
        entities: [],
        metrics: { error: error.message },
      };
    }
  }

  /**
   * Use LLM to extract structured data from text
   */
  private async extractWithLLM(text: string, prompt: string) {
    try {
      const response = await contextualLLM({ userId: null, contextType: "ingestion",
        messages: [
          {
            role: "system",
            content: `You are a financial data extraction specialist. Extract structured data from the provided text. Return JSON with two keys: "entities" (array of {type, name, value, context}) and "metrics" (object of key-value pairs for numerical data).`,
          },
          {
            role: "user",
            content: `${prompt}\n\nText to analyze:\n${text.slice(0, 10000)}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "extraction_result",
            strict: true,
            schema: {
              type: "object",
              properties: {
                entities: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string" },
                      name: { type: "string" },
                      value: { type: "string" },
                      context: { type: "string" },
                    },
                    required: ["type", "name", "value", "context"],
                    additionalProperties: false,
                  },
                },
                metrics: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    summary: { type: "string" },
                  },
                  required: ["summary"],
                },
              },
              required: ["entities", "metrics"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices?.[0]?.message?.content;
      if (content) {
        return JSON.parse(content as string);
      }
      return { entities: [], metrics: {} };
    } catch {
      return { entities: [], metrics: {} };
    }
  }

  /**
   * Save scrape results to database
   */
  async saveScrapeResult(
    dataSourceId: number | null,
    jobId: number | null,
    page: ScrapedPage,
    httpStatus: number = 200
  ) {
    const hash = await this.hashContent(page.content);
    await (await getDb())!.insert(webScrapeResults).values({
      dataSourceId: dataSourceId,
      ingestionJobId: jobId,
      url: page.url,
      pageTitle: page.title,
      contentText: page.content,
      extractedEntities: page.entities,
      extractedMetrics: page.metrics,
      scrapeStatus: page.content ? "success" : "failed",
      httpStatus,
      contentHash: hash,
      scrapedAt: Date.now(),
    });
  }

  private async hashContent(content: string): Promise<string> {
    // Simple hash for dedup
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return hash.toString(16);
  }
}

// ─── Document Processor Service ────────────────────────────────────────────
export class DocumentProcessorService {
  /**
   * Extract structured data from a document using LLM
   */
  async processDocument(
    documentUrl: string,
    documentType: string,
    userId?: number,
    documentId?: number
  ): Promise<ExtractedDocument> {
    const startTime = Date.now();

    try {
      // Use LLM with document URL for extraction
      const response = await contextualLLM({ userId: null, contextType: "ingestion",
        messages: [
          {
            role: "system",
            content: `You are a financial document extraction specialist. Extract all relevant data from the provided document. Focus on: account numbers, balances, transactions, dates, names, addresses, tax figures, policy details, investment holdings, and any financial metrics. Return structured JSON.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract all structured financial data from this ${documentType} document. Return JSON with keys: "data" (all extracted fields), "entities" (people, orgs, accounts), "amounts" (all monetary values with labels).`,
              },
              {
                type: "file_url",
                file_url: { url: documentUrl, mime_type: "application/pdf" },
              },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "document_extraction",
            strict: true,
            schema: {
              type: "object",
              properties: {
                data: { type: "object", additionalProperties: false, properties: { summary: { type: "string" }, fields: { type: "string" } }, required: ["summary", "fields"] },
                entities: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { type: { type: "string" }, name: { type: "string" }, identifier: { type: "string" } },
                    required: ["type", "name", "identifier"],
                    additionalProperties: false,
                  },
                },
                amounts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { label: { type: "string" }, value: { type: "number" }, currency: { type: "string" } },
                    required: ["label", "value", "currency"],
                    additionalProperties: false,
                  },
                },
                confidence: { type: "number" },
              },
              required: ["data", "entities", "amounts", "confidence"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices?.[0]?.message?.content;
      const parsed = content ? JSON.parse(content as string) : { data: {}, entities: [], amounts: [], confidence: 0.5 };
      const processingTime = Date.now() - startTime;

      // Save extraction to database
      await (await getDb())!.insert(documentExtractions).values({
        userId,
        documentId,
        extractionType: this.mapDocType(documentType),
        extractedData: parsed.data,
        extractedEntities: parsed.entities,
        extractedAmounts: parsed.amounts,
        extractionConfidence: String(parsed.confidence),
        processingTimeMs: processingTime,
        llmModelUsed: "built-in",
        createdAt: Date.now(),
      });

      return {
        type: documentType,
        data: parsed.data,
        entities: parsed.entities,
        amounts: parsed.amounts,
        confidence: parsed.confidence,
      };
    } catch (error: any) {
      return {
        type: documentType,
        data: { error: error.message },
        entities: [],
        amounts: [],
        confidence: 0,
      };
    }
  }

  private mapDocType(type: string): any {
    const map: Record<string, string> = {
      "financial_statement": "financial_statement",
      "tax_return": "tax_return",
      "insurance_policy": "insurance_policy",
      "investment_statement": "investment_statement",
      "bank_statement": "bank_statement",
      "pay_stub": "pay_stub",
      "estate_document": "estate_document",
      "medical_record": "medical_record",
    };
    return map[type] || "custom";
  }
}

// ─── Market Data Service ───────────────────────────────────────────────────
export class MarketDataService {
  /**
   * Fetch FX rates from European Central Bank (free, no API key)
   */
  async fetchECBRates(): Promise<{ symbol: string; rate: number }[]> {
    try {
      const response = await fetch(
        "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml",
        { signal: AbortSignal.timeout(10000) }
      );
      const xml = await response.text();
      const rates: { symbol: string; rate: number }[] = [];

      // Parse XML for currency rates
      const regex = /currency='(\w+)'\s+rate='([\d.]+)'/g;
      let match;
      while ((match = regex.exec(xml)) !== null) {
        rates.push({ symbol: `EUR/${match[1]}`, rate: parseFloat(match[2]) });
      }

      // Also compute USD-based rates
      const eurUsd = rates.find((r) => r.symbol === "EUR/USD");
      if (eurUsd) {
        for (const rate of rates) {
          const currency = rate.symbol.split("/")[1];
          if (currency !== "USD") {
            rates.push({
              symbol: `USD/${currency}`,
              rate: rate.rate / eurUsd.rate,
            });
          }
        }
      }

      return rates;
    } catch {
      return [];
    }
  }

  /**
   * Fetch FRED economic indicators (free API)
   */
  async fetchFREDData(seriesId: string, apiKey?: string): Promise<{ date: string; value: number }[]> {
    try {
      // FRED requires an API key but has a free tier
      const key = apiKey || "DEMO_KEY";
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${key}&file_type=json&sort_order=desc&limit=30`;
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      const data = await response.json();

      return (data.observations || [])
        .filter((obs: any) => obs.value !== ".")
        .map((obs: any) => ({
          date: obs.date,
          value: parseFloat(obs.value),
        }));
    } catch {
      return [];
    }
  }

  /**
   * Save market data to cache
   */
  async cacheMarketData(
    symbol: string,
    dataType: string,
    value: number,
    source: string,
    observedAt?: number
  ) {
    const now = observedAt || Date.now();
    try {
      await (await getDb())!.insert(marketDataCache).values({
        symbol,
        dataType: dataType as any,
        value: String(value),
        source,
        observedAt: now,
        createdAt: Date.now(),
      });
    } catch {
      // Ignore duplicate key errors for idempotent caching
    }
  }

  /**
   * Get latest cached value for a symbol
   */
  async getLatestPrice(symbol: string): Promise<number | null> {
    const rows = await (await getDb())!
      .select()
      .from(marketDataCache)
      .where(eq(marketDataCache.symbol, symbol))
      .orderBy(desc(marketDataCache.observedAt))
      .limit(1);
    return rows.length > 0 ? Number(rows[0].value) : null;
  }
}

// ─── Entity Extractor Service ──────────────────────────────────────────────
export class EntityExtractorService {
  /**
   * Extract entities from text using LLM
   */
  async extractEntities(text: string, context?: string): Promise<Record<string, any>[]> {
    try {
      const response = await contextualLLM({ userId: null, contextType: "ingestion",
        messages: [
          {
            role: "system",
            content: `You are a financial entity extraction specialist. Extract all named entities from the text: people (with roles), organizations (with types), financial products, account numbers, monetary amounts, dates, addresses, and regulatory references. Return a JSON array of entities.`,
          },
          {
            role: "user",
            content: `${context ? `Context: ${context}\n\n` : ""}Extract entities from:\n${text.slice(0, 8000)}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "entity_extraction",
            strict: true,
            schema: {
              type: "object",
              properties: {
                entities: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string" },
                      name: { type: "string" },
                      value: { type: "string" },
                      role: { type: "string" },
                      confidence: { type: "number" },
                    },
                    required: ["type", "name", "value", "role", "confidence"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["entities"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices?.[0]?.message?.content;
      return content ? JSON.parse(content as string).entities : [];
    } catch {
      return [];
    }
  }
}

// ─── Data Normalizer Service ───────────────────────────────────────────────
export class DataNormalizerService {
  /**
   * Deduplicate and merge records by entity ID
   */
  async normalizeAndStore(
    records: Array<{
      dataSourceId: number;
      jobId: number;
      recordType: string;
      entityId: string;
      title: string;
      summary: string;
      data: Record<string, any>;
      confidence: number;
      tags?: string[];
    }>
  ): Promise<{ created: number; updated: number; skipped: number }> {
    let created = 0, updated = 0, skipped = 0;

    for (const record of records) {
      try {
        // Check for existing record with same entity ID
        const existing = await (await getDb())!
          .select()
          .from(ingestedRecords)
          .where(
            and(
              eq(ingestedRecords.entityId, record.entityId),
              eq(ingestedRecords.recordType, record.recordType as any)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          // Update if new data has higher confidence
          if (record.confidence > Number(existing[0].confidenceScore)) {
            await (await getDb())!
              .update(ingestedRecords)
              .set({
                contentSummary: record.summary,
                structuredData: record.data,
                confidenceScore: String(record.confidence),
                tags: record.tags,
                updatedAt: Date.now(),
              })
              .where(eq(ingestedRecords.id, existing[0].id));
            updated++;
          } else {
            skipped++;
          }
        } else {
          await (await getDb())!.insert(ingestedRecords).values({
            dataSourceId: record.dataSourceId,
            ingestionJobId: record.jobId,
            recordType: record.recordType as any,
            entityId: record.entityId,
            title: record.title,
            contentSummary: record.summary,
            structuredData: record.data,
            confidenceScore: String(record.confidence),
            tags: record.tags,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          created++;
        }
      } catch {
        skipped++;
      }
    }

    return { created, updated, skipped };
  }
}

// ─── Continuous Learning Service ───────────────────────────────────────────
export class ContinuousLearningService {
  /**
   * Generate AI insights from recently ingested data
   */
  async generateInsights(firmId?: number): Promise<string[]> {
    try {
      // Get recent ingested records
      const recentRecords = await (await getDb())!
        .select()
        .from(ingestedRecords)
        .orderBy(desc(ingestedRecords.createdAt))
        .limit(50);

      if (recentRecords.length === 0) return ["No recent data to analyze."];

      const summaries = recentRecords
        .map((r: any) => `[${r.recordType}] ${r.title}: ${r.contentSummary || ""}`)
        .join("\n");

      const response = await contextualLLM({ userId: null, contextType: "ingestion",
        messages: [
          {
            role: "system",
            content: `You are a financial intelligence analyst. Based on recently ingested data, generate 3-5 actionable insights for a financial advisory firm. Focus on: market trends, client opportunities, regulatory changes, competitive intelligence, and risk alerts.`,
          },
          {
            role: "user",
            content: `Generate insights from this recently ingested data:\n\n${summaries.slice(0, 8000)}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "insights",
            strict: true,
            schema: {
              type: "object",
              properties: {
                insights: {
                  type: "array",
                  items: { type: "string" },
                },
              },
              required: ["insights"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices?.[0]?.message?.content;
      return content ? JSON.parse(content as string).insights : [];
    } catch {
      return ["Unable to generate insights at this time."];
    }
  }

  /**
   * Build context enrichment for AI chat from ingested data
   */
  async getContextEnrichment(query: string, userId?: number): Promise<string> {
    try {
      // Search ingested records relevant to the query
      const records = await (await getDb())!
        .select()
        .from(ingestedRecords)
        .where(eq(ingestedRecords.isVerified, true))
        .orderBy(desc(ingestedRecords.confidenceScore))
        .limit(20);

      if (records.length === 0) return "";

      const context = records
        .map((r: any) => `[${r.recordType}|conf:${r.confidenceScore}] ${r.title}: ${r.contentSummary || ""}`)
        .join("\n");

      return `\n--- Ingested Intelligence Context ---\n${context}\n--- End Context ---\n`;
    } catch {
      return "";
    }
  }
}

// ─── Master Ingestion Orchestrator ─────────────────────────────────────────
export class DataIngestionOrchestrator {
  private scraper = new WebScraperService();
  private docProcessor = new DocumentProcessorService();
  private marketData = new MarketDataService();
  private entityExtractor = new EntityExtractorService();
  private normalizer = new DataNormalizerService();
  private learning = new ContinuousLearningService();

  /**
   * Run a full ingestion job for a data source
   */
  async runIngestion(dataSourceId: number, triggeredBy?: number): Promise<IngestionResult> {
    const startTime = Date.now();

    // Get the data source config
    const sources = await (await getDb())!
      .select()
      .from(dataSources)
      .where(eq(dataSources.id, dataSourceId))
      .limit(1);

    if (sources.length === 0) {
      throw new Error(`Data source ${dataSourceId} not found`);
    }

    const source = sources[0];

    // Create ingestion job
    const db = await getDb();
    const [job] = await db!.insert(ingestionJobs).values({
      dataSourceId,
      triggeredBy,
      status: "running",
      startedAt: Date.now(),
      createdAt: Date.now(),
    }).$returningId();

    const jobId = job.id;
    let recordsProcessed = 0, recordsCreated = 0, recordsErrored = 0;
    const insights: string[] = [];

    try {
      switch (source.sourceType) {
        case "web_scrape": {
          if (source.url) {
            const page = await this.scraper.scrapeUrl(source.url);
            await this.scraper.saveScrapeResult(dataSourceId, jobId, page);
            recordsProcessed++;
            if (page.entities.length > 0) recordsCreated += page.entities.length;
          }
          break;
        }
        case "market_data": {
          const rates = await this.marketData.fetchECBRates();
          for (const rate of rates) {
            await this.marketData.cacheMarketData(rate.symbol, "fx_rate", rate.rate, "ECB");
            recordsProcessed++;
            recordsCreated++;
          }
          break;
        }
        case "document_upload": {
          if (source.url) {
            const result = await this.docProcessor.processDocument(
              source.url,
              (source.configJson as any)?.documentType || "custom",
              triggeredBy
            );
            recordsProcessed++;
            if (result.confidence > 0) recordsCreated++;
            else recordsErrored++;
          }
          break;
        }
        case "api_feed":
        case "regulatory":
        case "news_feed":
        case "competitor":
        case "product_catalog":
        case "custom": {
          // For API-based sources, scrape the URL and extract data
          if (source.url) {
            const page = await this.scraper.scrapeUrl(source.url);
            await this.scraper.saveScrapeResult(dataSourceId, jobId, page);
            recordsProcessed++;
            if (page.entities.length > 0) {
              const normalizeResult = await this.normalizer.normalizeAndStore(
                page.entities.map((e: any) => ({
                  dataSourceId,
                  jobId,
                  recordType: this.mapSourceToRecordType(source.sourceType),
                  entityId: `${source.sourceType}-${e.name}-${Date.now()}`,
                  title: e.name,
                  summary: e.context || e.value,
                  data: e,
                  confidence: 0.75,
                  tags: [source.sourceType],
                }))
              );
              recordsCreated += normalizeResult.created;
            }
          }
          break;
        }
      }

      // Update job status
      const duration = Date.now() - startTime;
      await db!
        .update(ingestionJobs)
        .set({
          status: "completed",
          progressPct: 100,
          recordsProcessed,
          recordsCreated,
          recordsErrored,
          completedAt: Date.now(),
          durationMs: duration,
        })
        .where(eq(ingestionJobs.id, jobId));

      // Update source stats
      await db!
        .update(dataSources)
        .set({
          lastRunAt: Date.now(),
          lastSuccessAt: Date.now(),
          totalRecordsIngested: sql`${dataSources.totalRecordsIngested} + ${recordsCreated}`,
          updatedAt: Date.now(),
        })
        .where(eq(dataSources.id, dataSourceId));

      // Generate insights from new data
      const newInsights = await this.learning.generateInsights();
      insights.push(...newInsights);

      return {
        jobId,
        status: recordsErrored > 0 ? "partial" : "completed",
        recordsProcessed,
        recordsCreated,
        recordsErrored,
        durationMs: duration,
        insights,
      };
    } catch (error: any) {
      await (await getDb())!
        .update(ingestionJobs)
        .set({
          status: "failed",
          errorLog: error.message,
          completedAt: Date.now(),
          durationMs: Date.now() - startTime,
        })
        .where(eq(ingestionJobs.id, jobId));

      return {
        jobId,
        status: "failed",
        recordsProcessed,
        recordsCreated,
        recordsErrored: recordsErrored + 1,
        durationMs: Date.now() - startTime,
        insights: [],
      };
    }
  }

  private mapSourceToRecordType(sourceType: string): string {
    const map: Record<string, string> = {
      web_scrape: "entity",
      api_feed: "metric",
      market_data: "market_price",
      regulatory: "regulatory_update",
      news_feed: "news_article",
      competitor: "competitor_intel",
      product_catalog: "product",
      document_upload: "document_extract",
      custom: "entity",
    };
    return map[sourceType] || "entity";
  }

  // Expose sub-services for direct use
  get scraperService() { return this.scraper; }
  get documentService() { return this.docProcessor; }
  get marketDataService() { return this.marketData; }
  get entityExtractorService() { return this.entityExtractor; }
  get normalizerService() { return this.normalizer; }
  get learningService() { return this.learning; }
}

// Singleton instance
export const dataIngestion = new DataIngestionOrchestrator();
