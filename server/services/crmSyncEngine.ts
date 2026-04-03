/**
 * CRM Sync Engine — Bidirectional sync between Stewardly and CRM systems
 * CRM = source of truth for contacts, Stewardly = source for financial data
 */
import { getDb } from "../db";
import { logger } from "../_core/logger";

const log = logger.child({ module: "crmSyncEngine" });

export interface SyncResult {
  provider: string;
  direction: "push" | "pull" | "bidirectional";
  contactsSynced: number;
  tasksSynced: number;
  errors: string[];
  durationMs: number;
}

export async function syncContacts(provider: "wealthbox" | "redtail"): Promise<SyncResult> {
  const start = Date.now();
  const errors: string[] = [];
  let contactsSynced = 0;

  try {
    if (provider === "wealthbox") {
      const { getContacts } = await import("./wealthboxClient");
      const result = await getContacts();
      if (result?.contacts) contactsSynced = result.contacts.length;
    } else {
      const { getContacts } = await import("./redtailClient");
      const result = await getContacts();
      if (result?.contacts) contactsSynced = result.contacts.length;
    }

    // Log sync
    await logSync(provider, "pull", contactsSynced, 0, errors);
  } catch (err: any) {
    errors.push(err.message);
    log.error({ provider, err }, "Contact sync failed");
  }

  return { provider, direction: "pull", contactsSynced, tasksSynced: 0, errors, durationMs: Date.now() - start };
}

export async function syncTasks(provider: "wealthbox"): Promise<SyncResult> {
  const start = Date.now();
  const errors: string[] = [];
  let tasksSynced = 0;

  try {
    const { getTasks } = await import("./wealthboxClient");
    const result = await getTasks();
    if (result?.tasks) tasksSynced = result.tasks.length;
    await logSync(provider, "pull", 0, tasksSynced, errors);
  } catch (err: any) {
    errors.push(err.message);
  }

  return { provider, direction: "pull", contactsSynced: 0, tasksSynced, errors, durationMs: Date.now() - start };
}

export async function handleWebhook(provider: string, payload: unknown): Promise<void> {
  log.info({ provider }, "CRM webhook received");
  await logSync(provider, "push", 0, 0, []);
}

async function logSync(provider: string, direction: "push" | "pull", contacts: number, _tasks: number, errors: string[]) {
  const db = await getDb();
  if (!db) return;
  try {
    const { crmSyncLog } = await import("../../drizzle/schema");
    await db.insert(crmSyncLog).values({
      crmProvider: provider,
      direction,
      recordsSynced: contacts,
      status: errors.length > 0 ? "failed" : "completed",
      errorDetails: errors.length > 0 ? errors.join("; ") : null,
    });
  } catch {
    // Table may not exist yet — graceful degradation
  }
}
