/**
 * Task #24 — Dynamic Knowledge Graph Service
 * Entity extraction, relationship mapping, entity resolution,
 * and graph-based context assembly for conversations.
 */
import { getDb } from "../db";
import { knowledgeGraphEntities, knowledgeGraphEdges, entityResolutionRules } from "../../drizzle/schema";
import { eq, and, desc, like, sql, or } from "drizzle-orm";
import { contextualLLM } from "../shared/stewardlyWiring";

type EntityType = "person" | "company" | "product" | "concept" | "regulation" | "account";

interface ExtractedEntity {
  name: string;
  type: EntityType;
  aliases?: string[];
  metadata?: Record<string, any>;
}

interface ExtractedRelationship {
  fromName: string;
  toName: string;
  relationshipType: string;
  weight?: number;
}

// ─── Entity Extraction via LLM ───────────────────────────────────────────
export async function extractEntitiesFromText(text: string): Promise<{
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
}> {
  try {
    const response = await contextualLLM({ userId: null, contextType: "analysis",
      messages: [
        {
          role: "system",
          content: `Extract financial entities and relationships from the text. Return JSON with:
{
  "entities": [{"name": "...", "type": "person|company|product|concept|regulation|account", "aliases": [], "metadata": {}}],
  "relationships": [{"fromName": "...", "toName": "...", "relationshipType": "...", "weight": 1.0}]
}
Focus on: people, companies, financial products, regulatory concepts, and accounts.`,
        },
        { role: "user", content: text },
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
                    name: { type: "string" },
                    type: { type: "string", enum: ["person", "company", "product", "concept", "regulation", "account"] },
                    aliases: { type: "array", items: { type: "string" } },
                  },
                  required: ["name", "type"],
                  additionalProperties: false,
                },
              },
              relationships: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    fromName: { type: "string" },
                    toName: { type: "string" },
                    relationshipType: { type: "string" },
                    weight: { type: "number" },
                  },
                  required: ["fromName", "toName", "relationshipType"],
                  additionalProperties: false,
                },
              },
            },
            required: ["entities", "relationships"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices?.[0]?.message?.content;
    const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
    if (!content) return { entities: [], relationships: [] };
    return JSON.parse(content);
  } catch {
    return { entities: [], relationships: [] };
  }
}

// ─── Entity Resolution ───────────────────────────────────────────────────
export async function resolveEntity(name: string): Promise<number | null> {
  const db = (await getDb())!;

  // Check resolution rules first
  const rules = await db.select().from(entityResolutionRules).orderBy(desc(entityResolutionRules.confidence));
  for (const rule of rules) {
    if (new RegExp(rule.pattern, "i").test(name)) {
      return rule.canonicalEntityId;
    }
  }

  // Check existing entities by canonical name or aliases
  const [exact] = await db.select().from(knowledgeGraphEntities)
    .where(eq(knowledgeGraphEntities.canonicalName, name)).limit(1);
  if (exact) return exact.id;

  // Fuzzy match via LIKE
  const [fuzzy] = await db.select().from(knowledgeGraphEntities)
    .where(like(knowledgeGraphEntities.canonicalName, `%${name}%`)).limit(1);
  return fuzzy?.id ?? null;
}

// ─── Upsert Entity ──────────────────────────────────────────────────────
export async function upsertEntity(entity: ExtractedEntity): Promise<number> {
  const db = (await getDb())!;
  const existingId = await resolveEntity(entity.name);

  if (existingId) {
    // Update confidence and last verified
    await db.update(knowledgeGraphEntities).set({
      confidence: sql`LEAST(confidence + 0.05, 1.0)`,
      lastVerified: new Date(),
    }).where(eq(knowledgeGraphEntities.id, existingId));
    return existingId;
  }

  const [result] = await db.insert(knowledgeGraphEntities).values({
    entityType: entity.type,
    canonicalName: entity.name,
    aliases: entity.aliases ?? [],
    metadata: entity.metadata ?? {},
    confidence: 0.8,
    source: "llm_extraction",
    lastVerified: new Date(),
  }).$returningId();

  return result.id;
}

// ─── Add Edge ────────────────────────────────────────────────────────────
export async function addEdge(fromId: number, toId: number, relationshipType: string, weight = 1.0): Promise<void> {
  const db = (await getDb())!;
  // Check for existing edge
  const [existing] = await db.select().from(knowledgeGraphEdges)
    .where(and(
      eq(knowledgeGraphEdges.fromEntityId, fromId),
      eq(knowledgeGraphEdges.toEntityId, toId),
      eq(knowledgeGraphEdges.relationshipType, relationshipType),
    )).limit(1);

  if (existing) {
    await db.update(knowledgeGraphEdges).set({
      weight: sql`LEAST(weight + 0.1, 5.0)`,
    }).where(eq(knowledgeGraphEdges.id, existing.id));
  } else {
    await db.insert(knowledgeGraphEdges).values({
      fromEntityId: fromId,
      toEntityId: toId,
      relationshipType,
      weight,
      source: "llm_extraction",
    });
  }
}

// ─── Process Text (Full Pipeline) ────────────────────────────────────────
export async function processTextForGraph(text: string): Promise<{
  entitiesAdded: number;
  edgesAdded: number;
}> {
  const { entities, relationships } = await extractEntitiesFromText(text);

  const entityIdMap = new Map<string, number>();
  for (const entity of entities) {
    const id = await upsertEntity(entity);
    entityIdMap.set(entity.name, id);
  }

  let edgesAdded = 0;
  for (const rel of relationships) {
    const fromId = entityIdMap.get(rel.fromName);
    const toId = entityIdMap.get(rel.toName);
    if (fromId && toId) {
      await addEdge(fromId, toId, rel.relationshipType, rel.weight ?? 1.0);
      edgesAdded++;
    }
  }

  return { entitiesAdded: entities.length, edgesAdded };
}

// ─── Graph Traversal for Context ─────────────────────────────────────────
export async function getEntityNeighborhood(entityId: number, depth = 2): Promise<{
  entities: Array<{ id: number; name: string; type: string; confidence: number }>;
  edges: Array<{ from: number; to: number; type: string; weight: number }>;
}> {
  const db = (await getDb())!;
  const visited = new Set<number>();
  const entities: Array<{ id: number; name: string; type: string; confidence: number }> = [];
  const edges: Array<{ from: number; to: number; type: string; weight: number }> = [];

  async function traverse(id: number, currentDepth: number) {
    if (visited.has(id) || currentDepth > depth) return;
    visited.add(id);

    const [entity] = await db.select().from(knowledgeGraphEntities)
      .where(eq(knowledgeGraphEntities.id, id)).limit(1);
    if (!entity) return;

    entities.push({
      id: entity.id,
      name: entity.canonicalName,
      type: entity.entityType,
      confidence: entity.confidence ?? 1,
    });

    const outEdges = await db.select().from(knowledgeGraphEdges)
      .where(eq(knowledgeGraphEdges.fromEntityId, id));
    const inEdges = await db.select().from(knowledgeGraphEdges)
      .where(eq(knowledgeGraphEdges.toEntityId, id));

    for (const edge of [...outEdges, ...inEdges]) {
      edges.push({
        from: edge.fromEntityId,
        to: edge.toEntityId,
        type: edge.relationshipType,
        weight: edge.weight ?? 1,
      });
      const nextId = edge.fromEntityId === id ? edge.toEntityId : edge.fromEntityId;
      await traverse(nextId, currentDepth + 1);
    }
  }

  await traverse(entityId, 0);
  return { entities, edges };
}

// ─── Query Helpers ───────────────────────────────────────────────────────
export async function searchEntities(query: string, limit = 20) {
  const db = (await getDb())!;
  return db.select().from(knowledgeGraphEntities)
    .where(like(knowledgeGraphEntities.canonicalName, `%${query}%`))
    .orderBy(desc(knowledgeGraphEntities.confidence))
    .limit(limit);
}

export async function getGraphStats() {
  const db = (await getDb())!;
  const [entityCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(knowledgeGraphEntities);
  const [edgeCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(knowledgeGraphEdges);
  return {
    totalEntities: entityCount?.count ?? 0,
    totalEdges: edgeCount?.count ?? 0,
  };
}
