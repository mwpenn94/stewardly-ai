/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Stewardly Config Store — ConfigStore & LayerStore Implementation
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Connects the platform-agnostic config resolver to Stewardly's Drizzle ORM
 * schema. Implements both ConfigStore and LayerStore interfaces.
 */

import type { LayerLevel } from "./types";
import type { ConfigStore, LayerSettings } from "./aiConfigResolver";
import type { LayerStore } from "./aiLayersRouter";
import { getDb } from "../../db";
import {
  platformAISettings,
  organizationAISettings,
  managerAISettings,
  professionalAISettings,
  userPreferences,
  userOrganizationRoles,
} from "../../../drizzle/schema";
import { eq } from "drizzle-orm";

// ─── LAYER TABLE MAP ─────────────────────────────────────────────────────────

const LAYER_TABLES: Record<LayerLevel, any> = {
  1: platformAISettings,
  2: organizationAISettings,
  3: managerAISettings,
  4: professionalAISettings,
  5: userPreferences,
};

// ─── IMPLEMENTATION ──────────────────────────────────────────────────────────

export const stewardlyConfigStore: LayerStore = {
  async getLayerSettings(userId: number): Promise<LayerSettings[]> {
    const db = await getDb();
    if (!db) return [];

    const layers: LayerSettings[] = [];

    // L1: Platform
    try {
      const [platform] = await db
        .select()
        .from(platformAISettings)
        .where(eq(platformAISettings.settingKey, "default"))
        .limit(1);
      layers.push({
        layer: 1,
        name: "Platform",
        settings: platform ? (platform as unknown as Record<string, unknown>) : null,
      });
    } catch {
      layers.push({ layer: 1, name: "Platform", settings: null });
    }

    // L2: Organization (find user's org)
    try {
      const [orgRole] = await db
        .select()
        .from(userOrganizationRoles)
        .where(eq(userOrganizationRoles.userId, userId))
        .limit(1);

      if (orgRole) {
        const [orgSettings] = await db
          .select()
          .from(organizationAISettings)
          .where(eq(organizationAISettings.organizationId, orgRole.organizationId))
          .limit(1);
        layers.push({
          layer: 2,
          name: "Organization",
          settings: orgSettings ? (orgSettings as unknown as Record<string, unknown>) : null,
        });
      } else {
        layers.push({ layer: 2, name: "Organization", settings: null });
      }
    } catch {
      layers.push({ layer: 2, name: "Organization", settings: null });
    }

    // L3: Manager
    try {
      const [managerSettings] = await db
        .select()
        .from(managerAISettings)
        .where(eq(managerAISettings.managerId, userId))
        .limit(1);
      layers.push({
        layer: 3,
        name: "Manager",
        settings: managerSettings ? (managerSettings as unknown as Record<string, unknown>) : null,
      });
    } catch {
      layers.push({ layer: 3, name: "Manager", settings: null });
    }

    // L4: Professional
    try {
      const [profSettings] = await db
        .select()
        .from(professionalAISettings)
        .where(eq(professionalAISettings.professionalId, userId))
        .limit(1);
      layers.push({
        layer: 4,
        name: "Professional",
        settings: profSettings ? (profSettings as unknown as Record<string, unknown>) : null,
      });
    } catch {
      layers.push({ layer: 4, name: "Professional", settings: null });
    }

    // L5: User
    try {
      const [userPrefs] = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);
      layers.push({
        layer: 5,
        name: "User",
        settings: userPrefs ? (userPrefs as unknown as Record<string, unknown>) : null,
      });
    } catch {
      layers.push({ layer: 5, name: "User", settings: null });
    }

    return layers;
  },

  async getLayerConfig(layer: LayerLevel, entityId: number): Promise<Record<string, unknown> | null> {
    const db = await getDb();
    if (!db) return null;

    const table = LAYER_TABLES[layer];
    if (!table) return null;

    try {
      // Each layer uses a different ID column
      const idColumn =
        layer === 1 ? table.settingKey :
        layer === 2 ? table.organizationId :
        layer === 3 ? table.managerId :
        layer === 4 ? table.professionalId :
        table.userId;

      const idValue = layer === 1 ? "default" : entityId;

      const [row] = await db
        .select()
        .from(table)
        .where(eq(idColumn, idValue))
        .limit(1);

      return row ? (row as unknown as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  },

  async upsertLayerConfig(
    layer: LayerLevel,
    entityId: number,
    settings: Record<string, unknown>,
  ): Promise<void> {
    const db = await getDb();
    if (!db) return;

    const table = LAYER_TABLES[layer];
    if (!table) return;

    const idColumn =
      layer === 1 ? table.settingKey :
      layer === 2 ? table.organizationId :
      layer === 3 ? table.managerId :
      layer === 4 ? table.professionalId :
      table.userId;

    const idValue = layer === 1 ? "default" : entityId;

    const existing = await db
      .select()
      .from(table)
      .where(eq(idColumn, idValue))
      .limit(1);

    if (existing.length > 0) {
      await db.update(table).set(settings).where(eq(idColumn, idValue));
    } else {
      const insertData = layer === 1
        ? { settingKey: "default", ...settings }
        : { [idColumn.name]: entityId, ...settings };
      await db.insert(table).values(insertData);
    }
  },
};

export default stewardlyConfigStore;
