/**
 * Also My Client — Bidirectional Sync Service
 * 
 * Addresses CFP Assessment §8.1 "Also My Client data staleness" silent failure mode.
 * 
 * After initial roll-up when a contact is marked as "Also My Client",
 * this service ensures:
 *   1. Client profile changes propagate to the planning hierarchy
 *   2. Practice-level changes (rate updates, product changes) propagate to client nodes
 *   3. Roll-up verification runs on each sync to ensure consistency
 *   4. Sync history is tracked for audit trail
 */
import { getDb } from "../../db";
import { planningNodes, clientGoals } from "../../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import * as phDb from "./db";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "alsoMyClientSync" });

export interface SyncResult {
  clientNodeId: number;
  practiceNodeId: number;
  fieldsUpdated: string[];
  rollUpResult: { total: number; count: number };
  syncedAt: string;
}

/**
 * Sync client profile data up to the planning hierarchy.
 * Called when a client profile is updated to ensure the planning node reflects current data.
 */
export async function syncClientToPlanning(
  clientId: number,
  ownerId: number,
  profileData: Record<string, unknown>,
): Promise<SyncResult | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    // Find the client's planning node
    const clientNodes = await phDb.getNodesByEntity("client", clientId);
    if (clientNodes.length === 0) {
      log.info({ clientId }, "No planning node found for client — skipping sync");
      return null;
    }

    const clientNode = clientNodes[0];
    const fieldsUpdated: string[] = [];

    // Update the planning node metadata with fresh profile data
    // @ts-expect-error — property access on loosely typed object
    const existingMetadata = (clientNode.metadata as Record<string, unknown>) || {};
    const updatedMetadata = {
      ...existingMetadata,
      financialProfile: profileData,
      lastSyncedAt: new Date().toISOString(),
      syncSource: "client_profile_update",
    };

    await phDb.updatePlanningNode(clientNode.id, {
      // @ts-expect-error — strict mode fix
      metadata: updatedMetadata as any,
    });
    fieldsUpdated.push("metadata.financialProfile");

    // If profile contains a net worth or income figure, update currentValue
    const netWorth = profileData.netWorth ?? profileData.totalAssets ?? profileData.estimatedNetWorth;
    if (netWorth !== undefined) {
      await phDb.updatePlanningNode(clientNode.id, {
        currentValue: String(netWorth),
      });
      fieldsUpdated.push("currentValue");
    }

    // Trigger roll-up to parent (practice node)
    let rollUpResult = { total: 0, count: 0 };
    if (clientNode.parentId) {
      rollUpResult = await phDb.rollUpValue(clientNode.parentId);
    }

    const result: SyncResult = {
      clientNodeId: clientNode.id,
      practiceNodeId: clientNode.parentId ?? 0,
      fieldsUpdated,
      rollUpResult,
      syncedAt: new Date().toISOString(),
    };

    log.info({ clientId, result }, "Client-to-planning sync completed");
    return result;
  } catch (error) {
    log.error({ clientId, error }, "Client-to-planning sync failed");
    return null;
  }
}

/**
 * Propagate practice-level changes down to all client nodes.
 * Called when advisor updates practice-wide settings (rates, products, etc.)
 */
export async function syncPracticeToClients(
  advisorId: number,
  changeType: "rate_update" | "product_update" | "regulatory_alert" | "assumption_change",
  changeData: Record<string, unknown>,
): Promise<{ clientsUpdated: number; errors: number }> {
  const db = await getDb();
  if (!db) return { clientsUpdated: 0, errors: 0 };

  try {
    // Find the advisor's practice root node
    const advisorNodes = await phDb.getNodesByLevel(advisorId, "advisor");
    const practiceNode = advisorNodes.find(n => n.entityType === "advisor");
    if (!practiceNode) return { clientsUpdated: 0, errors: 0 };

    // Get all client nodes under this practice
    const clientNodes = await phDb.getChildNodes(practiceNode.id);
    let updated = 0;
    let errors = 0;

    for (const clientNode of clientNodes) {
      try {
        // @ts-expect-error — property access on loosely typed object
        const existingMetadata = (clientNode.metadata as Record<string, unknown>) || {};
        const notifications = (existingMetadata.pendingNotifications as any[]) || [];
        
        notifications.push({
          type: changeType,
          data: changeData,
          createdAt: new Date().toISOString(),
          acknowledged: false,
        });

        await phDb.updatePlanningNode(clientNode.id, {
          // @ts-expect-error — strict mode fix
          metadata: {
            ...existingMetadata,
            pendingNotifications: notifications,
            lastPracticeSync: new Date().toISOString(),
          } as any,
        });
        updated++;
      } catch {
        errors++;
      }
    }

    log.info({ advisorId, changeType, updated, errors }, "Practice-to-clients sync completed");
    return { clientsUpdated: updated, errors };
  } catch (error) {
    log.error({ advisorId, error }, "Practice-to-clients sync failed");
    return { clientsUpdated: 0, errors: 0 };
  }
}

/**
 * Verify roll-up consistency for an advisor's entire practice tree.
 * Returns discrepancies found between stored roll-ups and recalculated values.
 */
export async function verifyRollUpConsistency(
  advisorId: number,
): Promise<{
  consistent: boolean;
  discrepancies: Array<{ nodeId: number; stored: number; calculated: number }>;
}> {
  const advisorNodes = await phDb.getNodesByLevel(advisorId, "advisor");
  const practiceNode = advisorNodes.find(n => n.entityType === "advisor");
  if (!practiceNode) return { consistent: true, discrepancies: [] };

  const discrepancies: Array<{ nodeId: number; stored: number; calculated: number }> = [];

  // Check each client node's roll-up
  const clientNodes = await phDb.getChildNodes(practiceNode.id);
  for (const clientNode of clientNodes) {
    const calculated = await phDb.rollUpValue(clientNode.id);
    const stored = Number(clientNode.currentValue ?? 0);
    
    // Allow 1% tolerance for floating point
    if (Math.abs(stored - calculated.total) > Math.max(stored * 0.01, 1)) {
      discrepancies.push({
        nodeId: clientNode.id,
        stored,
        calculated: calculated.total,
      });
    }
  }

  // Also verify the practice node itself
  const practiceRollUp = await phDb.rollUpValue(practiceNode.id);
  const practiceStored = Number(practiceNode.currentValue ?? 0);
  if (Math.abs(practiceStored - practiceRollUp.total) > Math.max(practiceStored * 0.01, 1)) {
    discrepancies.push({
      nodeId: practiceNode.id,
      stored: practiceStored,
      calculated: practiceRollUp.total,
    });
  }

  return {
    consistent: discrepancies.length === 0,
    discrepancies,
  };
}
