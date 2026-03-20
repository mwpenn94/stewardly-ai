/**
 * Enhanced Data Ingestion Services
 * Adds bulk scraping, RSS/Atom feed parsing, sitemap crawling,
 * product catalog parsing, competitor intelligence, data quality scoring,
 * and persistent insight generation.
 */
import { getDb } from "../db";
import { eq, desc, sql, and } from "drizzle-orm";
import {
  dataSources, ingestionJobs, ingestedRecords,
  webScrapeResults, bulkImportBatches, dataQualityScores,
  ingestionInsights, scrapeSchedules,
} from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";
import { dataIngestion } from "./dataIngestion";

// ─── Bulk Scraper Service ─────────────────────────────────────────────────
export class BulkScraperService {
  /**
   * Scrape multiple URLs in a batch, saving results and creating ingested records
   */
  async scrapeMultipleUrls(
    urls: string[],
    batchName: string,
    extractionPrompt?: string,
    triggeredBy?: number
  ) {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    // Create batch record
    const [batch] = await db.insert(bulkImportBatches).values({
      batchName,
      importType: "multi_url_scrape",
      totalItems: urls.length,
      status: "processing",
      inputData: { urls, extractionPrompt },
      triggeredBy,
      startedAt: Date.now(),
      createdAt: Date.now(),
    }).$returningId();

    const results: Array<{ url: string; status: string; entities: number }> = [];
    let success = 0, failed = 0;

    for (const url of urls) {
      try {
        const page = await dataIngestion.scraperService.scrapeUrl(url, extractionPrompt);
        await dataIngestion.scraperService.saveScrapeResult(null, null, page);

        // Normalize entities into ingested records
        if (page.entities.length > 0) {
          await dataIngestion.normalizerService.normalizeAndStore(
            page.entities.map((e: any) => ({
              dataSourceId: 0,
              jobId: 0,
              recordType: "entity",
              entityId: `bulk-${url}-${e.name}-${Date.now()}`,
              title: e.name || url,
              summary: e.context || e.value || "",
              data: { ...e, sourceUrl: url },
              confidence: 0.7,
              tags: ["bulk_scrape", batchName],
            }))
          );
        }

        results.push({ url, status: "success", entities: page.entities.length });
        success++;
      } catch (err: any) {
        results.push({ url, status: "failed", entities: 0 });
        failed++;
      }

      // Update progress
      await db.update(bulkImportBatches).set({
        processedItems: success + failed,
        successItems: success,
        failedItems: failed,
      }).where(eq(bulkImportBatches.id, batch.id));
    }

    // Finalize batch
    await db.update(bulkImportBatches).set({
      status: failed === urls.length ? "failed" : "completed",
      processedItems: urls.length,
      successItems: success,
      failedItems: failed,
      resultsJson: results,
      completedAt: Date.now(),
    }).where(eq(bulkImportBatches.id, batch.id));

    return { batchId: batch.id, total: urls.length, success, failed, results };
  }

  /**
   * Crawl a sitemap and extract all URLs, then scrape them
   */
  async crawlSitemap(sitemapUrl: string, batchName: string, maxUrls = 50, triggeredBy?: number) {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    // Fetch sitemap XML
    const response = await fetch(sitemapUrl, {
      headers: { "User-Agent": "Stewardry/1.0 SitemapCrawler" },
      signal: AbortSignal.timeout(15000),
    });
    const xml = await response.text();

    // Extract URLs from sitemap
    const urlRegex = /<loc>(.*?)<\/loc>/g;
    const urls: string[] = [];
    let match;
    while ((match = urlRegex.exec(xml)) !== null && urls.length < maxUrls) {
      urls.push(match[1]);
    }

    if (urls.length === 0) return { batchId: 0, total: 0, success: 0, failed: 0, results: [] };

    // Create batch and scrape
    const [batch] = await db.insert(bulkImportBatches).values({
      batchName: `Sitemap: ${batchName}`,
      importType: "sitemap_crawl",
      totalItems: urls.length,
      status: "processing",
      inputData: { sitemapUrl, urls },
      triggeredBy,
      startedAt: Date.now(),
      createdAt: Date.now(),
    }).$returningId();

    const results: Array<{ url: string; status: string; entities: number }> = [];
    let success = 0, failed = 0;

    for (const url of urls) {
      try {
        const page = await dataIngestion.scraperService.scrapeUrl(url);
        await dataIngestion.scraperService.saveScrapeResult(null, null, page);
        results.push({ url, status: "success", entities: page.entities.length });
        success++;
      } catch {
        results.push({ url, status: "failed", entities: 0 });
        failed++;
      }

      await db.update(bulkImportBatches).set({
        processedItems: success + failed,
        successItems: success,
        failedItems: failed,
      }).where(eq(bulkImportBatches.id, batch.id));
    }

    await db.update(bulkImportBatches).set({
      status: "completed",
      resultsJson: results,
      completedAt: Date.now(),
    }).where(eq(bulkImportBatches.id, batch.id));

    return { batchId: batch.id, total: urls.length, success, failed, results };
  }
}

// ─── RSS Feed Service ─────────────────────────────────────────────────────
export class RSSFeedService {
  /**
   * Parse an RSS/Atom feed and ingest articles as records
   */
  async ingestFeed(feedUrl: string, batchName: string, maxItems = 25, triggeredBy?: number) {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const response = await fetch(feedUrl, {
      headers: { "User-Agent": "Stewardry/1.0 FeedReader" },
      signal: AbortSignal.timeout(15000),
    });
    const xml = await response.text();

    // Parse RSS items
    const items = this.parseRSSItems(xml, maxItems);

    const [batch] = await db.insert(bulkImportBatches).values({
      batchName: `RSS: ${batchName}`,
      importType: "rss_feed",
      totalItems: items.length,
      status: "processing",
      inputData: { feedUrl },
      triggeredBy,
      startedAt: Date.now(),
      createdAt: Date.now(),
    }).$returningId();

    let success = 0, failed = 0;

    for (const item of items) {
      try {
        await db.insert(ingestedRecords).values({
          dataSourceId: 0,
          recordType: "news_article",
          entityId: `rss-${item.link || item.title}-${Date.now()}`,
          title: item.title,
          contentSummary: item.description,
          structuredData: { ...item, feedUrl },
          confidenceScore: "0.85",
          tags: ["rss_feed", batchName],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        success++;
      } catch {
        failed++;
      }
    }

    await db.update(bulkImportBatches).set({
      status: "completed",
      processedItems: items.length,
      successItems: success,
      failedItems: failed,
      completedAt: Date.now(),
    }).where(eq(bulkImportBatches.id, batch.id));

    return { batchId: batch.id, total: items.length, success, failed };
  }

  private parseRSSItems(xml: string, maxItems: number) {
    const items: Array<{ title: string; link: string; description: string; pubDate: string; category: string }> = [];

    // RSS 2.0 items
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < maxItems) {
      const content = match[1];
      items.push({
        title: this.extractTag(content, "title"),
        link: this.extractTag(content, "link"),
        description: this.stripHtml(this.extractTag(content, "description")),
        pubDate: this.extractTag(content, "pubDate"),
        category: this.extractTag(content, "category"),
      });
    }

    // Atom entries
    if (items.length === 0) {
      const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
      while ((match = entryRegex.exec(xml)) !== null && items.length < maxItems) {
        const content = match[1];
        const linkMatch = content.match(/<link[^>]*href="([^"]*)"[^>]*\/>/);
        items.push({
          title: this.extractTag(content, "title"),
          link: linkMatch ? linkMatch[1] : "",
          description: this.stripHtml(this.extractTag(content, "summary") || this.extractTag(content, "content")),
          pubDate: this.extractTag(content, "published") || this.extractTag(content, "updated"),
          category: this.extractTag(content, "category"),
        });
      }
    }

    return items;
  }

  private extractTag(xml: string, tag: string): string {
    const regex = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, "s");
    const match = xml.match(regex);
    return match ? match[1].trim() : "";
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000);
  }
}

// ─── Data Quality Service ─────────────────────────────────────────────────
export class DataQualityService {
  /**
   * Score data quality for a data source based on recent ingestion
   */
  async scoreDataSource(dataSourceId: number, ingestionJobId?: number) {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    // Get recent records for this source
    const records = await db.select().from(ingestedRecords)
      .where(eq(ingestedRecords.dataSourceId, dataSourceId))
      .orderBy(desc(ingestedRecords.createdAt))
      .limit(100);

    // Calculate quality dimensions
    const completeness = this.calculateCompleteness(records);
    const accuracy = this.calculateAccuracy(records);
    const freshness = this.calculateFreshness(records);
    const consistency = this.calculateConsistency(records);
    const overall = (completeness + accuracy + freshness + consistency) / 4;

    const issues: string[] = [];
    const recommendations: string[] = [];

    if (completeness < 70) {
      issues.push("Low data completeness — many records missing key fields");
      recommendations.push("Review source configuration to capture all required fields");
    }
    if (accuracy < 70) {
      issues.push("Low confidence scores across records");
      recommendations.push("Consider adding verification steps or improving extraction prompts");
    }
    if (freshness < 70) {
      issues.push("Data is stale — many records are older than 7 days");
      recommendations.push("Increase ingestion frequency or set up scheduled scraping");
    }
    if (consistency < 70) {
      issues.push("Inconsistent record types or formats detected");
      recommendations.push("Normalize data formats and standardize entity naming");
    }

    const [score] = await db.insert(dataQualityScores).values({
      dataSourceId,
      ingestionJobId,
      completeness: String(completeness),
      accuracy: String(accuracy),
      freshness: String(freshness),
      consistency: String(consistency),
      overallScore: String(overall),
      issuesFound: issues,
      recommendations,
      scoredAt: Date.now(),
    }).$returningId();

    return { id: score.id, completeness, accuracy, freshness, consistency, overall, issues, recommendations };
  }

  private calculateCompleteness(records: any[]): number {
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
  }

  private calculateAccuracy(records: any[]): number {
    if (records.length === 0) return 0;
    const avgConfidence = records.reduce((sum, r) => sum + Number(r.confidenceScore || 0), 0) / records.length;
    return Math.round(avgConfidence * 100);
  }

  private calculateFreshness(records: any[]): number {
    if (records.length === 0) return 0;
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const fresh = records.filter(r => (now - (r.createdAt || 0)) < sevenDays).length;
    return Math.round((fresh / records.length) * 100);
  }

  private calculateConsistency(records: any[]): number {
    if (records.length === 0) return 0;
    // Check if records have consistent types
    const types = new Set(records.map(r => r.recordType));
    const typeConsistency = types.size <= 3 ? 100 : Math.max(50, 100 - (types.size - 3) * 10);
    return Math.round(typeConsistency);
  }
}

// ─── Insight Generator Service ────────────────────────────────────────────
export class InsightGeneratorService {
  /**
   * Generate and persist AI insights from ingested data
   */
  async generateAndPersistInsights() {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    // Get recent records
    const recentRecords = await db.select().from(ingestedRecords)
      .orderBy(desc(ingestedRecords.createdAt))
      .limit(100);

    if (recentRecords.length === 0) return [];

    const summaries = recentRecords
      .map((r: any) => `[${r.recordType}] ${r.title}: ${r.contentSummary || ""}`)
      .join("\n")
      .slice(0, 12000);

    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a financial intelligence analyst. Analyze recently ingested data and generate structured insights. Each insight should have a type (trend/anomaly/opportunity/risk/recommendation/competitive_intel/market_shift/regulatory_change), title, description, and severity (low/medium/high/critical). Return JSON array of insights.`,
          },
          {
            role: "user",
            content: `Analyze this data and generate 3-7 actionable insights:\n\n${summaries}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "insights_result",
            strict: true,
            schema: {
              type: "object",
              properties: {
                insights: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string" },
                      title: { type: "string" },
                      description: { type: "string" },
                      severity: { type: "string" },
                    },
                    required: ["type", "title", "description", "severity"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["insights"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices?.[0]?.message?.content;
      const parsed = content ? JSON.parse(content as string) : { insights: [] };

      // Persist insights
      const persisted = [];
      for (const insight of parsed.insights) {
        const validType = ["trend", "anomaly", "opportunity", "risk", "recommendation", "competitive_intel", "market_shift", "regulatory_change"].includes(insight.type) ? insight.type : "recommendation";
        const validSeverity = ["low", "medium", "high", "critical"].includes(insight.severity) ? insight.severity : "medium";

        const [result] = await db.insert(ingestionInsights).values({
          insightType: validType as any,
          title: insight.title.slice(0, 500),
          description: insight.description,
          severity: validSeverity as any,
          actionable: true,
          createdAt: Date.now(),
        }).$returningId();

        persisted.push({ id: result.id, ...insight });
      }

      return persisted;
    } catch {
      return [];
    }
  }

  /**
   * Get recent insights
   */
  async getInsights(limit = 20) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(ingestionInsights)
      .orderBy(desc(ingestionInsights.createdAt))
      .limit(limit);
  }

  /**
   * Acknowledge an insight
   */
  async acknowledgeInsight(insightId: number, userId: number) {
    const db = await getDb();
    if (!db) return;
    await db.update(ingestionInsights).set({
      acknowledged: true,
      acknowledgedBy: userId,
    }).where(eq(ingestionInsights.id, insightId));
  }
}

// ─── Product Catalog Parser ───────────────────────────────────────────────
export class ProductCatalogParser {
  /**
   * Parse a product catalog page and extract product data
   */
  async parseProductPage(url: string, productCategory?: string) {
    const page = await dataIngestion.scraperService.scrapeUrl(
      url,
      `Extract all financial products, insurance products, or investment offerings. For each product include: name, type, provider, key features, pricing/rates, eligibility requirements, and any disclaimers. Category hint: ${productCategory || "general"}`
    );

    // Store as product records
    const db = await getDb();
    if (!db) return { products: page.entities, url };

    for (const entity of page.entities) {
      await db.insert(ingestedRecords).values({
        dataSourceId: 0,
        recordType: "product",
        entityId: `product-${entity.name}-${Date.now()}`,
        title: entity.name || "Unknown Product",
        contentSummary: entity.context || entity.value || "",
        structuredData: { ...entity, sourceUrl: url, category: productCategory },
        confidenceScore: "0.75",
        tags: ["product_catalog", productCategory || "general"],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return { products: page.entities, url };
  }
}

// ─── Competitor Intelligence Service ──────────────────────────────────────
export class CompetitorIntelService {
  /**
   * Scrape and analyze a competitor's public information
   */
  async analyzeCompetitor(competitorUrl: string, competitorName: string) {
    const page = await dataIngestion.scraperService.scrapeUrl(
      competitorUrl,
      `Analyze this competitor's website. Extract: company overview, products/services offered, pricing information, target market, unique selling propositions, technology stack indicators, team size indicators, and any recent news or announcements.`
    );

    // Use LLM for deeper competitive analysis
    let analysis: any = {};
    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are a competitive intelligence analyst. Provide a structured competitive analysis based on the scraped data.",
          },
          {
            role: "user",
            content: `Analyze competitor "${competitorName}" based on this data:\n\nTitle: ${page.title}\nContent: ${page.content.slice(0, 5000)}\nEntities: ${JSON.stringify(page.entities).slice(0, 3000)}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "competitor_analysis",
            strict: true,
            schema: {
              type: "object",
              properties: {
                overview: { type: "string" },
                strengths: { type: "array", items: { type: "string" } },
                weaknesses: { type: "array", items: { type: "string" } },
                products: { type: "array", items: { type: "string" } },
                targetMarket: { type: "string" },
                pricingModel: { type: "string" },
                differentiators: { type: "array", items: { type: "string" } },
                threats: { type: "array", items: { type: "string" } },
                opportunities: { type: "array", items: { type: "string" } },
              },
              required: ["overview", "strengths", "weaknesses", "products", "targetMarket", "pricingModel", "differentiators", "threats", "opportunities"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices?.[0]?.message?.content;
      analysis = content ? JSON.parse(content as string) : {};
    } catch {
      analysis = { overview: "Analysis unavailable", strengths: [], weaknesses: [], products: [], targetMarket: "", pricingModel: "", differentiators: [], threats: [], opportunities: [] };
    }

    // Store as competitor intel record
    const db = await getDb();
    if (db) {
      await db.insert(ingestedRecords).values({
        dataSourceId: 0,
        recordType: "competitor_intel",
        entityId: `competitor-${competitorName}-${Date.now()}`,
        title: `Competitor: ${competitorName}`,
        contentSummary: analysis.overview || page.title,
        structuredData: { ...analysis, sourceUrl: competitorUrl, scrapedContent: page.content.slice(0, 2000) },
        confidenceScore: "0.70",
        tags: ["competitor", competitorName],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return { competitorName, url: competitorUrl, analysis };
  }
}

// ─── Export Singleton Instances ────────────────────────────────────────────
export const bulkScraper = new BulkScraperService();
export const rssFeedService = new RSSFeedService();
export const dataQualityService = new DataQualityService();
export const insightGenerator = new InsightGeneratorService();
export const productCatalogParser = new ProductCatalogParser();
export const competitorIntel = new CompetitorIntelService();
