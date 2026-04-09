/**
 * EMBA Learning — initial content seed (Task 7E).
 *
 * Seeds the 12 canonical exam tracks and 8 core disciplines. In a
 * production deployment with the real EMBA JSON files, this module
 * would load `client/src/data/emba_data.json` and `tracks_data.json`;
 * here, we seed the structural skeleton (track metadata + discipline
 * catalog) so the UI, agent tools, and permission matrix have
 * something to reason about even before the large JSON payloads
 * arrive.
 *
 * Idempotent: safe to run multiple times. Checks `slug` uniqueness
 * before inserting so re-running never duplicates rows.
 */

import { logger } from "../../_core/logger";

const log = logger.child({ module: "learning/seed" });

// ─── 8 Core disciplines (from EMBA Knowledge Base) ───────────────────────

export const CORE_DISCIPLINES: Array<{
  slug: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  sortOrder: number;
}> = [
  { slug: "accounting", name: "Accounting", description: "Financial statements, GAAP, ratios, auditing.", color: "#3b82f6", icon: "BookOpen", sortOrder: 1 },
  { slug: "finance", name: "Finance", description: "Time value of money, capital budgeting, markets.", color: "#10b981", icon: "TrendingUp", sortOrder: 2 },
  { slug: "economics", name: "Economics", description: "Micro, macro, monetary policy, trade.", color: "#f59e0b", icon: "BarChart3", sortOrder: 3 },
  { slug: "markets", name: "Markets & Economies", description: "Equities, debt, derivatives, historical analysis.", color: "#8b5cf6", icon: "LineChart", sortOrder: 4 },
  { slug: "strategy", name: "Strategy", description: "Competitive analysis, positioning, frameworks.", color: "#ec4899", icon: "Target", sortOrder: 5 },
  { slug: "operations", name: "Operations", description: "Process design, supply chain, quality.", color: "#14b8a6", icon: "Settings", sortOrder: 6 },
  { slug: "leadership", name: "Leadership & Organizations", description: "Organizational behavior, management, culture.", color: "#f97316", icon: "Users", sortOrder: 7 },
  { slug: "ethics", name: "Ethics & Compliance", description: "Fiduciary duty, Reg BI, suitability, disclosure.", color: "#ef4444", icon: "Shield", sortOrder: 8 },
];

// ─── 12 canonical exam tracks ────────────────────────────────────────────

export const CORE_TRACKS: Array<{
  slug: string;
  name: string;
  category: "securities" | "planning" | "insurance";
  title: string;
  subtitle: string;
  description: string;
  color: string;
  emoji: string;
  tagline: string;
  sortOrder: number;
}> = [
  { slug: "sie", name: "SIE", category: "securities", title: "Securities Industry Essentials", subtitle: "FINRA Co-Requisite", description: "Foundational securities knowledge required for FINRA qualification exams.", color: "#3b82f6", emoji: "📚", tagline: "Your gateway to the securities industry", sortOrder: 1 },
  { slug: "series7", name: "Series 7", category: "securities", title: "General Securities Representative", subtitle: "FINRA Series 7", description: "Full scope of products a general securities rep can sell.", color: "#1d4ed8", emoji: "📊", tagline: "The general securities license", sortOrder: 2 },
  { slug: "series66", name: "Series 66", category: "securities", title: "Uniform Combined State Law", subtitle: "NASAA Series 66", description: "Combined state law exam for investment adviser representatives.", color: "#0891b2", emoji: "⚖️", tagline: "State registration for advisers", sortOrder: 3 },
  { slug: "cfp", name: "CFP", category: "planning", title: "Certified Financial Planner", subtitle: "CFP Board", description: "Comprehensive financial planning across all seven domains.", color: "#10b981", emoji: "🎯", tagline: "The gold standard in planning", sortOrder: 4 },
  { slug: "financial_planning", name: "Financial Planning", category: "planning", title: "Financial Planning Fundamentals", subtitle: "Core competencies", description: "Cash flow, budgeting, goals, and holistic planning fundamentals.", color: "#059669", emoji: "💰", tagline: "Build a plan from first principles", sortOrder: 5 },
  { slug: "investment_advisory", name: "Investment Advisory", category: "planning", title: "Investment Advisory Practice", subtitle: "RIA fundamentals", description: "Portfolio construction, rebalancing, and fiduciary practice.", color: "#065f46", emoji: "📈", tagline: "Run a fiduciary advisory practice", sortOrder: 6 },
  { slug: "estate_planning", name: "Estate Planning", category: "planning", title: "Estate Planning Specialization", subtitle: "Wealth transfer", description: "Wills, trusts, gifting strategies, and estate tax planning.", color: "#7c3aed", emoji: "🏛️", tagline: "Wealth transfer done right", sortOrder: 7 },
  { slug: "premium_financing", name: "Premium Financing", category: "insurance", title: "Premium Financing Specialization", subtitle: "Advanced life insurance", description: "Structuring life policies financed with third-party lenders.", color: "#b91c1c", emoji: "💎", tagline: "High-net-worth insurance strategy", sortOrder: 8 },
  { slug: "life_health", name: "Life & Health", category: "insurance", title: "State Life & Health License", subtitle: "Insurance basics", description: "Term, whole, universal life, health, disability, LTC.", color: "#dc2626", emoji: "❤️", tagline: "The protection license", sortOrder: 9 },
  { slug: "general_insurance", name: "General Insurance", category: "insurance", title: "State General Insurance License", subtitle: "Broad coverage", description: "Multiple lines including personal and commercial products.", color: "#ea580c", emoji: "🛡️", tagline: "Multi-line licensure", sortOrder: 10 },
  { slug: "p_and_c", name: "Property & Casualty", category: "insurance", title: "State P&C License", subtitle: "Auto, home, commercial", description: "Personal and commercial property and liability coverages.", color: "#f59e0b", emoji: "🏠", tagline: "Protect property and people", sortOrder: 11 },
  { slug: "surplus_lines", name: "Surplus Lines", category: "insurance", title: "State Surplus Lines Broker License", subtitle: "Non-admitted carriers", description: "Placement with non-admitted insurers for hard-to-place risks.", color: "#be123c", emoji: "📜", tagline: "Non-admitted market expertise", sortOrder: 12 },
];

import { getDb } from "../../db";
import {
  learningDisciplines as learningDisciplinesTable,
  learningTracks as learningTracksTable,
} from "../../../drizzle/schema";
import { eq } from "drizzle-orm";

export interface SeedResult {
  /** Disciplines actually inserted on this run. */
  disciplines: number;
  /** Tracks actually inserted on this run. */
  tracks: number;
  /** Rows that already existed and were left alone. */
  skipped: number;
  /**
   * Any error that bubbled up from `upsertDiscipline` / `createTrack`,
   * with enough context for an operator to fix it. If non-empty the
   * Content Studio toast shows the first one. Pass 76.
   */
  errors: string[];
}

/**
 * Seed the 8 core disciplines + 12 canonical exam tracks.
 *
 * Pass 76 rewrite: the original implementation called `upsertDiscipline`
 * + `createTrack` from `content.ts` and silently swallowed every error
 * inside their try/catch blocks. If the DB was missing the
 * `learning_*` tables (which happened on a fresh deploy before the
 * 0010_emba_learning migration ran), the toast would show
 * "Seeded 0 disciplines, 0 tracks (0 skipped)" with no indication of
 * why. Users had no way to diagnose it.
 *
 * The rewrite talks to drizzle directly so every error propagates
 * with its real message into `result.errors`. It also correctly
 * distinguishes "already existed" (skipped) from "just inserted"
 * for disciplines — the old code lumped both into `disciplinesInserted`.
 */
export async function seedLearningContent(): Promise<SeedResult> {
  const result: SeedResult = { disciplines: 0, tracks: 0, skipped: 0, errors: [] };
  const db = await getDb();
  if (!db) {
    result.errors.push("Database not available — getDb() returned null");
    log.warn("seedLearningContent: db unavailable");
    return result;
  }

  // ── Disciplines ───────────────────────────────────────────────────
  for (const d of CORE_DISCIPLINES) {
    try {
      const existing = await db
        .select({ id: learningDisciplinesTable.id })
        .from(learningDisciplinesTable)
        .where(eq(learningDisciplinesTable.slug, d.slug))
        .limit(1);
      if (existing.length > 0) {
        result.skipped += 1;
        continue;
      }
      await db.insert(learningDisciplinesTable).values({
        slug: d.slug,
        name: d.name,
        description: d.description ?? null,
        color: d.color ?? null,
        icon: d.icon ?? null,
        sortOrder: d.sortOrder ?? 0,
        isCore: true,
        createdBy: null,
      });
      result.disciplines += 1;
    } catch (err) {
      const msg = `upsert discipline ${d.slug} failed: ${String((err as Error).message ?? err)}`;
      log.warn({ err, slug: d.slug }, msg);
      result.errors.push(msg);
    }
  }

  // ── Tracks ────────────────────────────────────────────────────────
  for (const t of CORE_TRACKS) {
    try {
      const existing = await db
        .select({ id: learningTracksTable.id })
        .from(learningTracksTable)
        .where(eq(learningTracksTable.slug, t.slug))
        .limit(1);
      if (existing.length > 0) {
        result.skipped += 1;
        continue;
      }
      await db.insert(learningTracksTable).values({
        slug: t.slug,
        name: t.name,
        category: t.category,
        title: t.title,
        subtitle: t.subtitle,
        description: t.description,
        color: t.color,
        emoji: t.emoji,
        tagline: t.tagline,
        createdBy: null,
        sortOrder: t.sortOrder,
      });
      result.tracks += 1;
    } catch (err) {
      const msg = `insert track ${t.slug} failed: ${String((err as Error).message ?? err)}`;
      log.warn({ err, slug: t.slug }, msg);
      result.errors.push(msg);
    }
  }

  log.info(result, "seedLearningContent complete");
  return result;
}
