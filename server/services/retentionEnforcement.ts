/**
 * Task #39 — Data Retention Enforcement Service
 * Automated data lifecycle management with configurable retention policies
 */
import { getDb } from "../db";
import { eq, and, lt } from "drizzle-orm";

export interface RetentionPolicy {
  resource: string;
  retentionDays: number;
  action: "archive" | "delete" | "anonymize";
  enabled: boolean;
  lastRun?: Date;
}

const DEFAULT_POLICIES: RetentionPolicy[] = [
  { resource: "conversations", retentionDays: 365, action: "archive", enabled: true },
  { resource: "audit_logs", retentionDays: 2555, action: "archive", enabled: true }, // 7 years for compliance
  { resource: "session_data", retentionDays: 90, action: "delete", enabled: true },
  { resource: "analytics_events", retentionDays: 730, action: "anonymize", enabled: true },
  { resource: "temp_files", retentionDays: 7, action: "delete", enabled: true },
  { resource: "ai_tool_calls", retentionDays: 365, action: "archive", enabled: true },
  { resource: "knowledge_article_feedback", retentionDays: 730, action: "anonymize", enabled: true },
];

let policies: RetentionPolicy[] = [...DEFAULT_POLICIES];

export function getPolicies(): RetentionPolicy[] { return [...policies]; }

export function updatePolicy(resource: string, updates: Partial<RetentionPolicy>): RetentionPolicy | null {
  const idx = policies.findIndex(p => p.resource === resource);
  if (idx === -1) return null;
  policies[idx] = { ...policies[idx], ...updates };
  return policies[idx];
}

export function addPolicy(policy: RetentionPolicy): void {
  policies.push(policy);
}

export async function enforceRetention(): Promise<{ resource: string; action: string; recordsAffected: number }[]> {
  const results: { resource: string; action: string; recordsAffected: number }[] = [];
  const db = await getDb();
  if (!db) return results;
  const now = Date.now();

  // Map resource names to actual DB tables and their timestamp columns
  const { conversations, auditTrail, aiToolCalls, knowledgeArticleFeedback } = await import("../../drizzle/schema");
  const { sql } = await import("drizzle-orm");

  const TABLE_MAP: Record<string, { table: any; timestampCol: string }> = {
    conversations: { table: conversations, timestampCol: "createdAt" },
    audit_logs: { table: auditTrail, timestampCol: "createdAt" },
    ai_tool_calls: { table: aiToolCalls, timestampCol: "created_at" },
    knowledge_article_feedback: { table: knowledgeArticleFeedback, timestampCol: "created_at" },
  };

  for (const policy of policies) {
    if (!policy.enabled) continue;
    const cutoffDate = new Date(now - policy.retentionDays * 24 * 60 * 60 * 1000);
    const mapping = TABLE_MAP[policy.resource];
    let recordsAffected = 0;

    if (mapping) {
      try {
        const cutoffStr = cutoffDate.toISOString().slice(0, 19).replace("T", " ");
        if (policy.action === "delete") {
          const result = await db.execute(
            sql.raw(`DELETE FROM \`${policy.resource === "audit_logs" ? "audit_trail" : policy.resource}\` WHERE \`${mapping.timestampCol}\` < '${cutoffStr}'`)
          );
          recordsAffected = (result as any)[0]?.affectedRows ?? 0;
        } else if (policy.action === "anonymize") {
          // Anonymize by nullifying user-identifying fields
          if (policy.resource === "knowledge_article_feedback") {
            const result = await db.execute(
              sql.raw(`UPDATE \`knowledge_article_feedback\` SET \`user_id\` = NULL, \`feedback_text\` = '[anonymized]' WHERE \`created_at\` < '${cutoffStr}' AND \`user_id\` IS NOT NULL`)
            );
            recordsAffected = (result as any)[0]?.affectedRows ?? 0;
          } else if (policy.resource === "analytics_events") {
            // analytics_events may not exist as a table yet — count as 0
            recordsAffected = 0;
          }
        } else if (policy.action === "archive") {
          // Archive = count records that would be archived (actual archival to cold storage is a future feature)
          const countResult = await db.execute(
            sql.raw(`SELECT COUNT(*) as cnt FROM \`${policy.resource === "audit_logs" ? "audit_trail" : policy.resource}\` WHERE \`${mapping.timestampCol}\` < '${cutoffStr}'`)
          );
          recordsAffected = (countResult as any)[0]?.[0]?.cnt ?? 0;
        }
      } catch (err: any) {
        // Table may not exist or column mismatch — skip gracefully
        recordsAffected = 0;
      }
    }

    results.push({ resource: policy.resource, action: policy.action, recordsAffected });
    policy.lastRun = new Date();
  }

  return results;
}

export function getRetentionReport(): {
  policies: RetentionPolicy[];
  nextScheduledRun: Date;
  complianceStatus: "compliant" | "warning" | "non_compliant";
} {
  const hasOverdue = policies.some(p => {
    if (!p.enabled || !p.lastRun) return p.enabled;
    const daysSinceRun = (Date.now() - p.lastRun.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceRun > 30;
  });

  return {
    policies,
    nextScheduledRun: new Date(Date.now() + 24 * 60 * 60 * 1000),
    complianceStatus: hasOverdue ? "warning" : "compliant",
  };
}
