/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AI Layers Router — CRUD handlers for the 5-layer config system
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Provides Express-compatible handlers for managing AI configuration layers:
 *   1: Platform → 2: Organization → 3: Manager → 4: Professional → 5: User
 */

import type { LayerLevel } from "./types";

// ── Types ────────────────────────────────────────────────────────────────────

export interface AuthContext {
  userId: number;
  orgId?: number;
  teamId?: number;
  role: "admin" | "manager" | "advisor" | "viewer";
}

export interface LayerStore {
  getLayer(level: LayerLevel, entityId: number): Promise<Record<string, unknown> | null>;
  setLayer(level: LayerLevel, entityId: number, settings: Record<string, unknown>): Promise<void>;
  deleteLayer(level: LayerLevel, entityId: number): Promise<void>;
}

export interface LayerHandlers {
  get: (req: any, res: any) => Promise<void>;
  set: (req: any, res: any) => Promise<void>;
  delete: (req: any, res: any) => Promise<void>;
}

// ── Role check ───────────────────────────────────────────────────────────────

const ROLE_RANK: Record<string, number> = {
  viewer: 0,
  advisor: 1,
  manager: 2,
  admin: 3,
};

export function hasMinRole(auth: AuthContext, minRole: AuthContext["role"]): boolean {
  return (ROLE_RANK[auth.role] ?? 0) >= (ROLE_RANK[minRole] ?? 999);
}

// ── Handler factory ──────────────────────────────────────────────────────────

export function createLayerHandlers(
  store: LayerStore,
  level: LayerLevel,
  minRole: AuthContext["role"] = "admin"
): LayerHandlers {
  return {
    async get(req, res) {
      const auth: AuthContext = req.auth;
      if (!hasMinRole(auth, "viewer")) return res.status(403).json({ error: "Forbidden" });
      const entityId = Number(req.params.entityId ?? auth.userId);
      const settings = await store.getLayer(level, entityId);
      res.json({ level, entityId, settings: settings ?? {} });
    },
    async set(req, res) {
      const auth: AuthContext = req.auth;
      if (!hasMinRole(auth, minRole)) return res.status(403).json({ error: "Forbidden" });
      const entityId = Number(req.params.entityId ?? auth.userId);
      await store.setLayer(level, entityId, req.body);
      res.json({ ok: true, level, entityId });
    },
    async delete(req, res) {
      const auth: AuthContext = req.auth;
      if (!hasMinRole(auth, minRole)) return res.status(403).json({ error: "Forbidden" });
      const entityId = Number(req.params.entityId ?? auth.userId);
      await store.deleteLayer(level, entityId);
      res.json({ ok: true, level, entityId, deleted: true });
    },
  };
}

/**
 * Create handlers for all 5 layers at once.
 */
export function createAllLayerHandlers(store: LayerStore): Record<LayerLevel, LayerHandlers> {
  return {
    1: createLayerHandlers(store, 1, "admin"),
    2: createLayerHandlers(store, 2, "admin"),
    3: createLayerHandlers(store, 3, "manager"),
    4: createLayerHandlers(store, 4, "advisor"),
    5: createLayerHandlers(store, 5, "viewer"),
  };
}
