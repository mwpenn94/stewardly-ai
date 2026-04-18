/**
 * planningHierarchy/db.ts — Database helpers for the Unified Hierarchical Planning Architecture.
 * Supports forward/backward planning, roll-up/roll-down aggregation, rich reasoning & references.
 */
import { getDb } from "../../db";
import {
  planningNodes, clientGoals, planningReferences,
  personalFinancialReviews, clientDiscovery, planningAssumptions,
  type InsertPlanningNode, type InsertClientGoal,
  type InsertPlanningReference, type InsertPersonalFinancialReview,
  type InsertClientDiscovery, type InsertPlanningAssumption,
} from "../../../drizzle/schema";
import { eq, and, inArray, desc, asc, isNull } from "drizzle-orm";

// ─── PLANNING NODES ──────────────────────────────────────────────────────

export async function createPlanningNode(data: InsertPlanningNode) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [result] = await db.insert(planningNodes).values(data).$returningId();
  return result.id;
}

export async function getPlanningNode(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [node] = await db.select().from(planningNodes).where(eq(planningNodes.id, id));
  return node ?? null;
}

export async function getChildNodes(parentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(planningNodes)
    .where(eq(planningNodes.parentId, parentId))
    .orderBy(asc(planningNodes.level));
}

export async function getRootNodes(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(planningNodes)
    .where(and(eq(planningNodes.ownerId, ownerId), isNull(planningNodes.parentId)))
    .orderBy(desc(planningNodes.updatedAt));
}

export async function getNodesByLevel(ownerId: number, level: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(planningNodes)
    .where(and(eq(planningNodes.ownerId, ownerId), eq(planningNodes.level, level as any)))
    .orderBy(desc(planningNodes.updatedAt));
}

export async function getNodesByEntity(entityType: string, entityId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(planningNodes)
    .where(and(eq(planningNodes.entityType, entityType), eq(planningNodes.entityId, entityId)));
}

export async function updatePlanningNode(id: number, data: Partial<InsertPlanningNode>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(planningNodes).set(data).where(eq(planningNodes.id, id));
}

/** Recursively collect the full ancestor chain (bottom-up roll-up) */
export async function getAncestorChain(nodeId: number): Promise<number[]> {
  const MAX_DEPTH = 20; // Safety guard against circular references
  const db = await getDb();
  if (!db) return [];
  const chain: number[] = [];
  let currentId: number | null = nodeId;
  let depth = 0;
  while (currentId && depth < MAX_DEPTH) {
    const node = await getPlanningNode(currentId);
    if (!node || !node.parentId) break;
    chain.push(node.parentId);
    currentId = node.parentId;
    depth++;
  }
  return chain;
}

/** Recursively collect all descendant IDs (top-down roll-down) */
export async function getDescendantIds(nodeId: number, depth = 0): Promise<number[]> {
  const MAX_DEPTH = 20; // Safety guard against circular references
  if (depth >= MAX_DEPTH) return [];
  const db = await getDb();
  if (!db) return [];
  const ids: number[] = [];
  const children = await getChildNodes(nodeId);
  for (const child of children) {
    ids.push(child.id);
    const grandchildren = await getDescendantIds(child.id, depth + 1);
    ids.push(...grandchildren);
  }
  return ids;
}

/** Roll-up aggregation: sum currentValue of all descendants */
export async function rollUpValue(nodeId: number): Promise<{ total: number; count: number }> {
  const db = await getDb();
  if (!db) return { total: 0, count: 0 };
  const descendantIds = await getDescendantIds(nodeId);
  if (descendantIds.length === 0) {
    const node = await getPlanningNode(nodeId);
    return { total: Number(node?.currentValue ?? 0), count: 1 };
  }
  const nodes = await db.select().from(planningNodes)
    .where(inArray(planningNodes.id, descendantIds));
  const total = nodes.reduce((sum, n) => sum + Number(n.currentValue ?? 0), 0);
  return { total, count: nodes.length };
}

// ─── CLIENT GOALS ────────────────────────────────────────────────────────

export async function createClientGoal(data: InsertClientGoal) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [result] = await db.insert(clientGoals).values(data).$returningId();
  return result.id;
}

export async function getClientGoals(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clientGoals)
    .where(eq(clientGoals.clientId, clientId))
    .orderBy(asc(clientGoals.priorityRank));
}

export async function getGoalsByAdvisor(advisorId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clientGoals)
    .where(eq(clientGoals.advisorId, advisorId))
    .orderBy(desc(clientGoals.updatedAt));
}

export async function updateClientGoal(id: number, data: Partial<InsertClientGoal>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(clientGoals).set(data).where(eq(clientGoals.id, id));
}

// ─── PLANNING REFERENCES ────────────────────────────────────────────────

export async function addReference(data: InsertPlanningReference) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [result] = await db.insert(planningReferences).values(data).$returningId();
  return result.id;
}

export async function getReferencesForNode(nodeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(planningReferences)
    .where(eq(planningReferences.planningNodeId, nodeId))
    .orderBy(desc(planningReferences.createdAt));
}

// ─── PERSONAL FINANCIAL REVIEWS ─────────────────────────────────────────

export async function createPFR(data: InsertPersonalFinancialReview) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [result] = await db.insert(personalFinancialReviews).values(data).$returningId();
  return result.id;
}

export async function getClientPFRs(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(personalFinancialReviews)
    .where(eq(personalFinancialReviews.clientId, clientId))
    .orderBy(desc(personalFinancialReviews.reviewDate));
}

export async function getAdvisorPFRs(advisorId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(personalFinancialReviews)
    .where(eq(personalFinancialReviews.advisorId, advisorId))
    .orderBy(desc(personalFinancialReviews.reviewDate));
}

export async function updatePFR(id: number, data: Partial<InsertPersonalFinancialReview>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(personalFinancialReviews).set(data).where(eq(personalFinancialReviews.id, id));
}

// ─── CLIENT DISCOVERY ───────────────────────────────────────────────────

export async function upsertClientDiscovery(data: InsertClientDiscovery) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existing = await db.select().from(clientDiscovery)
    .where(eq(clientDiscovery.clientId, data.clientId));
  if (existing.length > 0) {
    await db.update(clientDiscovery).set(data).where(eq(clientDiscovery.clientId, data.clientId));
    return existing[0].id;
  }
  const [result] = await db.insert(clientDiscovery).values(data).$returningId();
  return result.id;
}

export async function getClientDiscovery(clientId: number) {
  const db = await getDb();
  if (!db) return null;
  const [disc] = await db.select().from(clientDiscovery)
    .where(eq(clientDiscovery.clientId, clientId));
  return disc ?? null;
}

// ─── PLANNING ASSUMPTIONS ───────────────────────────────────────────────

export async function upsertPlanningAssumptions(data: InsertPlanningAssumption) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existing = await db.select().from(planningAssumptions)
    .where(and(
      eq(planningAssumptions.ownerId, data.ownerId),
      eq(planningAssumptions.scope, data.scope ?? "advisor"),
    ));
  if (existing.length > 0) {
    await db.update(planningAssumptions).set(data)
      .where(eq(planningAssumptions.id, existing[0].id));
    return existing[0].id;
  }
  const [result] = await db.insert(planningAssumptions).values(data).$returningId();
  return result.id;
}

export async function getAssumptions(ownerId: number, scope?: string) {
  const db = await getDb();
  if (!db) return scope ? null : [];
  if (scope) {
    const [a] = await db.select().from(planningAssumptions)
      .where(and(
        eq(planningAssumptions.ownerId, ownerId),
        eq(planningAssumptions.scope, scope as any),
      ));
    return a ?? null;
  }
  return db.select().from(planningAssumptions)
    .where(eq(planningAssumptions.ownerId, ownerId))
    .orderBy(desc(planningAssumptions.updatedAt));
}

/** Resolve effective assumptions by walking up the scope hierarchy:
 *  client → advisor → firm → platform (each level inherits from parent if not set) */
export async function resolveEffectiveAssumptions(clientId: number, advisorId?: number) {
  const db = await getDb();
  if (!db) return {};
  const scopes = ["client", "advisor", "firm", "platform"] as const;
  const entityIds = [clientId, advisorId ?? 0, 0, 0];
  
  let merged: Record<string, any> = {};
  
  for (let i = scopes.length - 1; i >= 0; i--) {
    const [assumption] = await db.select().from(planningAssumptions)
      .where(and(
        eq(planningAssumptions.scope, scopes[i]),
        eq(planningAssumptions.scopeEntityId, entityIds[i]),
      ));
    if (assumption) {
      const fields = [
        "inflationRate", "equityReturn", "bondReturn", "riskFreeRate",
        "taxBracketFederal", "taxBracketState", "capitalGainsRate",
        "estateExemption", "sofrRate", "mortalityTable",
      ] as const;
      for (const f of fields) {
        if (assumption[f] != null) merged[f] = assumption[f];
      }
      if (assumption.customAssumptions) {
        merged.customAssumptions = { ...merged.customAssumptions, ...(assumption.customAssumptions as any) };
      }
    }
  }
  
  return merged;
}
