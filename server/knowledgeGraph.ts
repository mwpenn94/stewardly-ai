/**
 * Knowledge Graph (A2) — Financial Relationship Graph
 * 
 * Maps relationships between people, accounts, goals, insurance,
 * properties, liabilities, income sources, tax entities, and estate plans.
 */
import { getDb } from "./db";
import { kgNodes, kgEdges } from "../drizzle/schema";
import { eq, and, or, desc } from "drizzle-orm";

// ─── NODE OPERATIONS ────────────────────────────────────────────
export async function addNode(data: {
  userId: number;
  nodeType: typeof kgNodes.$inferInsert["nodeType"];
  label: string;
  dataJson?: any;
  status?: "active" | "inactive" | "pending";
}) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(kgNodes).values(data).$returningId();
  return result;
}

export async function getNodes(userId: number, nodeType?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(kgNodes.userId, userId)];
  if (nodeType) conditions.push(eq(kgNodes.nodeType, nodeType as any));
  return db.select().from(kgNodes).where(and(...conditions)).orderBy(desc(kgNodes.updatedAt));
}

export async function updateNode(id: number, userId: number, data: Partial<{
  label: string;
  dataJson: any;
  status: "active" | "inactive" | "pending";
}>) {
  const db = await getDb();
  if (!db) return;
  await db.update(kgNodes).set(data).where(and(eq(kgNodes.id, id), eq(kgNodes.userId, userId)));
}

export async function deleteNode(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  // Delete connected edges first
  await db.delete(kgEdges).where(
    and(
      eq(kgEdges.userId, userId),
      or(eq(kgEdges.sourceNodeId, id), eq(kgEdges.targetNodeId, id))
    )
  );
  await db.delete(kgNodes).where(and(eq(kgNodes.id, id), eq(kgNodes.userId, userId)));
}

// ─── EDGE OPERATIONS ────────────────────────────────────────────
export async function addEdge(data: {
  userId: number;
  sourceNodeId: number;
  targetNodeId: number;
  edgeType: typeof kgEdges.$inferInsert["edgeType"];
  weight?: number;
  metadataJson?: any;
}) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(kgEdges).values(data).$returningId();
  return result;
}

export async function getEdges(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(kgEdges).where(eq(kgEdges.userId, userId));
}

export async function deleteEdge(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(kgEdges).where(and(eq(kgEdges.id, id), eq(kgEdges.userId, userId)));
}

// ─── FULL GRAPH ASSEMBLY ────────────────────────────────────────
export async function getFullGraph(userId: number) {
  const nodes = await getNodes(userId);
  const edges = await getEdges(userId);
  return { nodes, edges };
}

// ─── GRAPH CONTEXT FOR AI PROMPTS ───────────────────────────────
export async function assembleGraphContext(userId: number): Promise<string> {
  const { nodes, edges } = await getFullGraph(userId);
  if (nodes.length === 0) return "";
  const parts: string[] = ["FINANCIAL KNOWLEDGE GRAPH:"];
  // Group nodes by type
  const grouped: Record<string, typeof nodes> = {};
  for (const n of nodes) {
    if (!grouped[n.nodeType]) grouped[n.nodeType] = [];
    grouped[n.nodeType].push(n);
  }
  for (const [type, items] of Object.entries(grouped)) {
    parts.push(`  ${type.toUpperCase()}:`);
    for (const item of items) {
      const data = item.dataJson ? ` (${JSON.stringify(item.dataJson)})` : "";
      parts.push(`    - ${item.label}${data} [${item.status}]`);
    }
  }
  if (edges.length > 0) {
    parts.push("  RELATIONSHIPS:");
    const nodeMap = new Map(nodes.map(n => [n.id, n.label]));
    for (const e of edges) {
      const src = nodeMap.get(e.sourceNodeId) || `#${e.sourceNodeId}`;
      const tgt = nodeMap.get(e.targetNodeId) || `#${e.targetNodeId}`;
      parts.push(`    - ${src} --[${e.edgeType}]--> ${tgt}`);
    }
  }
  return parts.join("\n");
}
