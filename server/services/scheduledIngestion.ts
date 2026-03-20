/**
 * Scheduled Ingestion Service
 * 1. Cron runner for scrape_schedules → auto-refresh data sources
 * 2. CSV/Excel bulk upload → parse and ingest tabular data
 * 3. Insight-to-action workflow → connect insights to tasks/notifications
 */
import { getDb } from "../db";
import { eq, and, lte, desc, sql } from "drizzle-orm";
import {
  scrapeSchedules, dataSources, ingestionJobs, ingestedRecords,
  bulkImportBatches, ingestionInsights, insightActions,
} from "../../drizzle/schema";
import { dataIngestion } from "./dataIngestion";
import { insightGenerator, dataQualityService } from "./dataIngestionEnhanced";
import { notifyOwner } from "../_core/notification";

// ─── Cron Schedule Runner ────────────────────────────────────────────────
export class ScheduleRunnerService {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private running = false;

  /**
   * Start the schedule runner — checks every 60s for due schedules
   */
  start(intervalMs = 60_000) {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.tick(), intervalMs);
    console.log("[ScheduleRunner] Started with interval", intervalMs, "ms");
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Check for due schedules and execute them
   */
  async tick() {
    if (this.running) return; // prevent overlapping runs
    this.running = true;
    try {
      const db = await getDb();
      if (!db) return;

      const now = Date.now();
      // Find enabled schedules that are due (nextRunAt <= now or null)
      const dueSchedules = await db.select().from(scrapeSchedules)
        .where(and(
          eq(scrapeSchedules.enabled, true),
          lte(scrapeSchedules.nextRunAt, now),
        ))
        .limit(10);

      for (const schedule of dueSchedules) {
        try {
          await this.executeSchedule(schedule);
        } catch (err: any) {
          console.error(`[ScheduleRunner] Failed schedule ${schedule.id}:`, err.message);
          if (schedule.notifyOnFailure) {
            await notifyOwner({
              title: `Ingestion Schedule Failed`,
              content: `Schedule #${schedule.id} for data source #${schedule.dataSourceId} failed: ${err.message}`,
            });
          }
        }
      }
    } finally {
      this.running = false;
    }
  }

  /**
   * Execute a single schedule — run the data source ingestion
   */
  private async executeSchedule(schedule: any) {
    const db = await getDb();
    if (!db) return;

    // Get the data source
    const [source] = await db.select().from(dataSources)
      .where(eq(dataSources.id, schedule.dataSourceId))
      .limit(1);

    if (!source) {
      // Disable orphaned schedule
      await db.update(scrapeSchedules).set({ enabled: false })
        .where(eq(scrapeSchedules.id, schedule.id));
      return;
    }

    // Create ingestion job
    const [job] = await db.insert(ingestionJobs).values({
      dataSourceId: source.id,
      status: "running",
      triggeredBy: 0,
      startedAt: Date.now(),
      createdAt: Date.now(),
    }).$returningId();

    let recordsIngested = 0;
    let error: string | null = null;

    try {
      // Execute based on source type
      if (source.sourceType === "web_scrape" && source.url) {
        const page = await dataIngestion.scraperService.scrapeUrl(source.url);
        await dataIngestion.scraperService.saveScrapeResult(source.id, job.id, page);
        recordsIngested = page.entities.length;
      } else if (source.sourceType === "api_feed" && source.url) {
        // For API feeds, use the orchestrator's runIngestion
        const result = await dataIngestion.runIngestion(source.id, 0);
        recordsIngested = result?.recordsCreated || 0;
      } else if (source.sourceType === "news_feed" && source.url) {
        // RSS feed re-ingestion
        const response = await fetch(source.url, {
          headers: { "User-Agent": "Stewardry/1.0 ScheduledFeedReader" },
          signal: AbortSignal.timeout(15000),
        });
        const xml = await response.text();
        const itemRegex = new RegExp("<item>([\\s\\S]*?)</item>", "g");
        let match;
        while ((match = itemRegex.exec(xml)) !== null && recordsIngested < 50) {
          const content = match[1];
          const titleMatch = content.match(new RegExp("<title[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</title>"));
          const title = titleMatch?.[1]?.trim() || "";
          const descMatch = content.match(new RegExp("<description[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</description>"));
          const desc = descMatch?.[1]?.trim() || "";
          await db.insert(ingestedRecords).values({
            dataSourceId: source.id,
            ingestionJobId: job.id,
            recordType: "news_article",
            entityId: `sched-rss-${source.id}-${title}-${Date.now()}`,
            title: title.slice(0, 500),
            contentSummary: desc.replace(/<[^>]+>/g, " ").slice(0, 2000),
            structuredData: { feedUrl: source.url },
            confidenceScore: "0.85",
            tags: ["scheduled", source.name],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          recordsIngested++;
        }
      }

      // Update job as completed
      await db.update(ingestionJobs).set({
        status: "completed",
        recordsCreated: recordsIngested,
        recordsProcessed: recordsIngested,
        completedAt: Date.now(),
        durationMs: Date.now() - (job.id ? Date.now() : 0),
      }).where(eq(ingestionJobs.id, job.id));

      // Update data source stats
      await db.update(dataSources).set({
        lastRunAt: Date.now(),
        lastSuccessAt: Date.now(),
        totalRecordsIngested: sql`total_records_ingested + ${recordsIngested}`,
        updatedAt: Date.now(),
      }).where(eq(dataSources.id, source.id));

    } catch (err: any) {
      error = err.message;
      await db.update(ingestionJobs).set({
        status: "failed",
        errorLog: error,
        completedAt: Date.now(),
      }).where(eq(ingestionJobs.id, job.id));
    }

    // Calculate next run time from cron expression
    const nextRun = this.calculateNextRun(schedule.cronExpression);
    await db.update(scrapeSchedules).set({
      lastRunAt: Date.now(),
      nextRunAt: nextRun,
    }).where(eq(scrapeSchedules.id, schedule.id));

    // Auto-score data quality after scheduled run
    try {
      await dataQualityService.scoreDataSource(source.id, job.id);
    } catch { /* non-critical */ }

    return { jobId: job.id, recordsIngested, error };
  }

  /**
   * Simple cron-like next run calculator
   * Supports: "every_5m", "every_15m", "every_1h", "every_6h", "every_12h", "every_24h", "daily_9am"
   * Also supports standard cron: "0 * * * *" (every hour), "0 9 * * *" (daily at 9am)
   */
  calculateNextRun(cronExpression: string): number {
    const now = Date.now();
    const shortcuts: Record<string, number> = {
      "every_5m": 5 * 60 * 1000,
      "every_15m": 15 * 60 * 1000,
      "every_30m": 30 * 60 * 1000,
      "every_1h": 60 * 60 * 1000,
      "every_6h": 6 * 60 * 60 * 1000,
      "every_12h": 12 * 60 * 60 * 1000,
      "every_24h": 24 * 60 * 60 * 1000,
    };
    if (shortcuts[cronExpression]) {
      return now + shortcuts[cronExpression];
    }
    // For standard cron, default to 1 hour
    return now + 60 * 60 * 1000;
  }
}

// ─── CSV/Excel Bulk Upload Service ───────────────────────────────────────
export class CSVUploadService {
  /**
   * Parse CSV content and ingest records
   */
  async ingestCSV(
    csvContent: string,
    batchName: string,
    recordType: string,
    columnMapping?: Record<string, string>,
    triggeredBy?: number
  ) {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    // Parse CSV
    const rows = this.parseCSV(csvContent);
    if (rows.length === 0) return { batchId: 0, total: 0, success: 0, failed: 0 };

    const headers = rows[0];
    const dataRows = rows.slice(1).filter(r => r.some(cell => cell.trim()));

    // Create batch
    const [batch] = await db.insert(bulkImportBatches).values({
      batchName: `CSV: ${batchName}`,
      importType: "csv_upload",
      totalItems: dataRows.length,
      status: "processing",
      inputData: { headers, columnMapping, recordType },
      triggeredBy,
      startedAt: Date.now(),
      createdAt: Date.now(),
    }).$returningId();

    let success = 0, failed = 0;

    // Map columns
    const mapping = columnMapping || this.autoMapColumns(headers, recordType);

    for (const row of dataRows) {
      try {
        const record: Record<string, any> = {};
        headers.forEach((header: string, i: number) => {
          record[header] = row[i] || "";
        });

        const title = record[mapping.title || headers[0]] || `Row ${success + failed + 1}`;
        const summary = record[mapping.summary || headers[1]] || "";
        const entityId = record[mapping.entityId || ""] || `csv-${batchName}-${Date.now()}-${success + failed}`;

        const validRecordType = ["customer_profile", "organization", "product", "market_price", "regulatory_update", "news_article", "competitor_intel", "document_extract", "entity", "metric"].includes(recordType) ? recordType : "entity";

        await db.insert(ingestedRecords).values({
          dataSourceId: 0,
          recordType: validRecordType as any,
          entityId: entityId.toString().slice(0, 255),
          title: title.toString().slice(0, 500),
          contentSummary: summary.toString().slice(0, 2000),
          structuredData: record,
          confidenceScore: "0.90",
          tags: ["csv_upload", batchName],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        success++;
      } catch {
        failed++;
      }

      // Update progress every 50 rows
      if ((success + failed) % 50 === 0) {
        await db.update(bulkImportBatches).set({
          processedItems: success + failed,
          successItems: success,
          failedItems: failed,
        }).where(eq(bulkImportBatches.id, batch.id));
      }
    }

    // Finalize
    await db.update(bulkImportBatches).set({
      status: failed === dataRows.length ? "failed" : "completed",
      processedItems: dataRows.length,
      successItems: success,
      failedItems: failed,
      completedAt: Date.now(),
    }).where(eq(bulkImportBatches.id, batch.id));

    return { batchId: batch.id, total: dataRows.length, success, failed, headers, mapping };
  }

  /**
   * Parse CSV string into 2D array
   */
  private parseCSV(content: string): string[][] {
    const rows: string[][] = [];
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim()) continue;
      const cells: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === "," && !inQuotes) {
          cells.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
      cells.push(current.trim());
      rows.push(cells);
    }
    return rows;
  }

  /**
   * Auto-map CSV columns to record fields based on header names
   */
  private autoMapColumns(headers: string[], recordType: string): Record<string, string> {
    const mapping: Record<string, string> = {};
    const lowerHeaders = headers.map(h => h.toLowerCase().trim());

    // Title mapping
    const titleCandidates = ["name", "title", "company", "organization", "product", "subject", "label"];
    for (const c of titleCandidates) {
      const idx = lowerHeaders.findIndex(h => h.includes(c));
      if (idx >= 0) { mapping.title = headers[idx]; break; }
    }
    if (!mapping.title) mapping.title = headers[0];

    // Summary mapping
    const summaryCandidates = ["description", "summary", "notes", "details", "bio", "overview"];
    for (const c of summaryCandidates) {
      const idx = lowerHeaders.findIndex(h => h.includes(c));
      if (idx >= 0) { mapping.summary = headers[idx]; break; }
    }
    if (!mapping.summary) mapping.summary = headers.length > 1 ? headers[1] : headers[0];

    // Entity ID mapping
    const idCandidates = ["id", "email", "phone", "account", "code", "sku"];
    for (const c of idCandidates) {
      const idx = lowerHeaders.findIndex(h => h.includes(c));
      if (idx >= 0) { mapping.entityId = headers[idx]; break; }
    }

    return mapping;
  }

  /**
   * Parse tab-separated values (TSV)
   */
  async ingestTSV(tsvContent: string, batchName: string, recordType: string, triggeredBy?: number) {
    // Convert TSV to CSV
    const csvContent = tsvContent.split(/\r?\n/).map(line => {
      return line.split("\t").map(cell => {
        if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(",");
    }).join("\n");
    return this.ingestCSV(csvContent, batchName, recordType, undefined, triggeredBy);
  }
}

// ─── Insight-to-Action Workflow Service ──────────────────────────────────
export class InsightActionService {
  /**
   * Process unacknowledged insights and create actions based on severity/type
   */
  async processNewInsights() {
    const db = await getDb();
    if (!db) return { processed: 0, actions: [] };

    // Get unacknowledged, actionable insights
    const insights = await db.select().from(ingestionInsights)
      .where(and(
        eq(ingestionInsights.acknowledged, false),
        eq(ingestionInsights.actionable, true),
      ))
      .orderBy(desc(ingestionInsights.createdAt))
      .limit(50);

    const actions: any[] = [];

    for (const insight of insights) {
      const action = await this.createActionForInsight(insight);
      if (action) actions.push(action);
    }

    return { processed: insights.length, actions };
  }

  /**
   * Create an appropriate action based on insight type and severity
   */
  private async createActionForInsight(insight: any) {
    const db = await getDb();
    if (!db) return null;

    let actionType: string;
    let priority: string;
    let payload: any = {};

    // Determine action based on severity
    switch (insight.severity) {
      case "critical":
        actionType = "alert_escalated";
        priority = "urgent";
        // Send immediate notification
        await notifyOwner({
          title: `CRITICAL: ${insight.title}`,
          content: `${insight.description}\n\nType: ${insight.insightType}\nSeverity: CRITICAL\nAction required immediately.`,
        });
        payload.notificationSent = true;
        break;
      case "high":
        actionType = "notification_sent";
        priority = "high";
        await notifyOwner({
          title: `High Priority Insight: ${insight.title}`,
          content: `${insight.description}\n\nType: ${insight.insightType}`,
        });
        payload.notificationSent = true;
        break;
      case "medium":
        actionType = "task_created";
        priority = "medium";
        payload.suggestedAction = this.getSuggestedAction(insight);
        break;
      case "low":
      default:
        actionType = "review_scheduled";
        priority = "low";
        payload.reviewNote = "Scheduled for next review cycle";
        break;
    }

    // Determine due date based on priority
    const dueDays: Record<string, number> = { urgent: 1, high: 3, medium: 7, low: 14 };
    const dueAt = Date.now() + (dueDays[priority] || 7) * 24 * 60 * 60 * 1000;

    const [action] = await db.insert(insightActions).values({
      insightId: insight.id,
      actionType: actionType as any,
      actionPayload: payload,
      priority: priority as any,
      status: "pending",
      dueAt,
      createdAt: Date.now(),
    }).$returningId();

    return { id: action.id, insightId: insight.id, actionType, priority, title: insight.title };
  }

  /**
   * Get suggested action text based on insight type
   */
  private getSuggestedAction(insight: any): string {
    const suggestions: Record<string, string> = {
      trend: "Review trend data and adjust strategy accordingly",
      anomaly: "Investigate anomaly and verify data accuracy",
      opportunity: "Evaluate opportunity and create action plan",
      risk: "Assess risk exposure and implement mitigation measures",
      recommendation: "Review recommendation and decide on implementation",
      competitive_intel: "Analyze competitive landscape and update positioning",
      market_shift: "Review market conditions and adjust portfolio allocations",
      regulatory_change: "Review regulatory update and ensure compliance",
    };
    return suggestions[insight.insightType] || "Review and take appropriate action";
  }

  /**
   * Get pending actions with their associated insights
   */
  async getPendingActions(limit = 20) {
    const db = await getDb();
    if (!db) return [];
    const actions = await db.select().from(insightActions)
      .where(eq(insightActions.status, "pending"))
      .orderBy(desc(insightActions.createdAt))
      .limit(limit);

    // Enrich with insight data
    const enriched = [];
    for (const action of actions) {
      const [insight] = await db.select().from(ingestionInsights)
        .where(eq(ingestionInsights.id, action.insightId))
        .limit(1);
      enriched.push({ ...action, insight: insight || null });
    }
    return enriched;
  }

  /**
   * Complete an action
   */
  async completeAction(actionId: number) {
    const db = await getDb();
    if (!db) return;
    await db.update(insightActions).set({
      status: "completed",
      completedAt: Date.now(),
    }).where(eq(insightActions.id, actionId));
  }

  /**
   * Dismiss an action
   */
  async dismissAction(actionId: number) {
    const db = await getDb();
    if (!db) return;
    await db.update(insightActions).set({
      status: "dismissed",
      completedAt: Date.now(),
    }).where(eq(insightActions.id, actionId));
  }

  /**
   * Get action stats
   */
  async getStats() {
    const db = await getDb();
    if (!db) return { pending: 0, completed: 0, dismissed: 0, overdue: 0 };

    const [stats] = await db.select({
      pending: sql<number>`SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)`,
      completed: sql<number>`SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)`,
      dismissed: sql<number>`SUM(CASE WHEN status = 'dismissed' THEN 1 ELSE 0 END)`,
      overdue: sql<number>`SUM(CASE WHEN status = 'pending' AND due_at < ${Date.now()} THEN 1 ELSE 0 END)`,
    }).from(insightActions);

    return {
      pending: Number(stats?.pending || 0),
      completed: Number(stats?.completed || 0),
      dismissed: Number(stats?.dismissed || 0),
      overdue: Number(stats?.overdue || 0),
    };
  }

  /**
   * Generate insights and immediately process them into actions
   */
  async generateAndProcess() {
    const insights = await insightGenerator.generateAndPersistInsights();
    const result = await this.processNewInsights();
    return { insightsGenerated: insights.length, ...result };
  }
}

// ─── Export Singleton Instances ──────────────────────────────────────────
export const scheduleRunner = new ScheduleRunnerService();
export const csvUploadService = new CSVUploadService();
export const insightActionService = new InsightActionService();
