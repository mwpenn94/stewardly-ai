/**
 * C7 — Capability Modes Service
 * CRUD, auto-suggest based on user query, mode switching, prompt assembly
 */
import { getDb } from "../db";
import { capabilityModes } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

export async function listModes(activeOnly = true) {
  const db = await getDb(); if (!db) return null as any;
  const conditions: any[] = [];
  if (activeOnly) conditions.push(eq(capabilityModes.active, true));
  return db.select().from(capabilityModes)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(capabilityModes.sortOrder);
}

export async function getMode(id: number) {
  const db = await getDb(); if (!db) return null as any;
  const [mode] = await db.select().from(capabilityModes).where(eq(capabilityModes.id, id));
  return mode ?? null;
}

export async function getModeByName(name: string) {
  const db = await getDb(); if (!db) return null as any;
  const [mode] = await db.select().from(capabilityModes).where(eq(capabilityModes.name, name));
  return mode ?? null;
}

export async function createMode(data: {
  name: string; description?: string; icon?: string;
  systemPromptAdditions?: string; requiredKnowledgeCategories?: string[];
  availableTools?: string[]; availableModels?: string[];
  defaultForRoles?: string[]; sortOrder?: number;
}) {
  const db = await getDb(); if (!db) return null as any;
  const [row] = await db.insert(capabilityModes).values({
    name: data.name,
    description: data.description ?? null,
    icon: data.icon ?? null,
    systemPromptAdditions: data.systemPromptAdditions ?? null,
    requiredKnowledgeCategories: data.requiredKnowledgeCategories ? JSON.stringify(data.requiredKnowledgeCategories) : null,
    availableTools: data.availableTools ? JSON.stringify(data.availableTools) : null,
    availableModels: data.availableModels ? JSON.stringify(data.availableModels) : null,
    defaultForRoles: data.defaultForRoles ? JSON.stringify(data.defaultForRoles) : null,
    sortOrder: data.sortOrder ?? 0,
  });
  return { id: row.insertId };
}

export async function updateMode(id: number, data: Partial<{
  name: string; description: string; icon: string;
  systemPromptAdditions: string; requiredKnowledgeCategories: string[];
  availableTools: string[]; availableModels: string[];
  defaultForRoles: string[]; active: boolean; sortOrder: number;
}>) {
  const db = await getDb(); if (!db) return null as any;
  const updateData: any = { ...data };
  if (data.requiredKnowledgeCategories) updateData.requiredKnowledgeCategories = JSON.stringify(data.requiredKnowledgeCategories);
  if (data.availableTools) updateData.availableTools = JSON.stringify(data.availableTools);
  if (data.availableModels) updateData.availableModels = JSON.stringify(data.availableModels);
  if (data.defaultForRoles) updateData.defaultForRoles = JSON.stringify(data.defaultForRoles);
  await db.update(capabilityModes).set(updateData).where(eq(capabilityModes.id, id));
  return getMode(id);
}

export async function deleteMode(id: number) {
  const db = await getDb(); if (!db) return null as any;
  await db.update(capabilityModes).set({ active: false } as any).where(eq(capabilityModes.id, id));
  return true;
}

/** Suggest the best mode based on user query content */
export function suggestMode(query: string, userRole: string): string {
  const q = query.toLowerCase();
  // Financial keywords
  if (/\b(invest|retire|mortgage|insurance|iul|premium|401k|ira|estate|tax|debt|loan|portfolio|stock|bond|mutual fund|annuity|roth)\b/.test(q)) {
    return "Financial Advisory";
  }
  // Study keywords
  if (/\b(study|quiz|exam|certification|test|practice|flashcard|series 6|series 7|cfp|cfa|clu|chfc)\b/.test(q)) {
    return "Study";
  }
  // Planning keywords
  if (/\b(plan|goal|timeline|project|budget|save for|when can i|how long|target)\b/.test(q)) {
    return "Planning";
  }
  // Research keywords
  if (/\b(research|analyze|compare|data|statistics|report|benchmark|trend|market)\b/.test(q)) {
    return "Research";
  }
  // Coaching keywords
  if (/\b(motivat|coach|habit|procrastinat|stress|anxiety|overwhelm|help me start|nudge|encourage)\b/.test(q)) {
    return "Coaching";
  }
  // Onboarding keywords
  if (/\b(get started|new here|how do i|setup|first time|tutorial|walkthrough|features)\b/.test(q)) {
    return "Onboarding";
  }
  return "General";
}

/** Get modes available for a specific role */
export async function getModesForRole(role: string) {
  const modes = await listModes(true);
  return modes.filter((m: any) => {
    const roles = typeof m.defaultForRoles === "string"
      ? JSON.parse(m.defaultForRoles)
      : m.defaultForRoles;
    return Array.isArray(roles) && roles.includes(role);
  });
}

/** Assemble system prompt additions for a given mode */
export async function getModePromptAdditions(modeName: string): Promise<string> {
  const mode = await getModeByName(modeName);
  return mode?.systemPromptAdditions ?? "";
}
