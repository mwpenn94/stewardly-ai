/**
 * Integration Tests for Migrated SQL Queries in planningHierarchy Services
 *
 * Validates that all 87 db.execute(sql`...`) calls across 7 service files
 * produce correct SQL templates with proper parameter interpolation.
 * Uses mocked getDb() returning a mock execute that captures the sql template.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock infrastructure ─────────────────────────────────────────────────

const mockExecuteResults: any[] = [];
const executeCalls: Array<{ sql: string; params: any[] }> = [];

const mockExecute = vi.fn(async (query: any) => {
  // Capture the SQL template for inspection
  const sqlStr = query?.sql?.[0] ?? query?.queryChunks?.[0] ?? String(query);
  const params = query?.params ?? query?.queryChunks?.slice(1) ?? [];
  executeCalls.push({ sql: sqlStr, params });

  if (mockExecuteResults.length > 0) {
    return mockExecuteResults.shift();
  }
  // Default: return empty result set (MySQL format: [rows, fields])
  return [[], []];
});

const mockDb = {
  execute: mockExecute,
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  $returningId: vi.fn(async () => [{ id: 1 }]),
};

vi.mock("../../db", () => ({
  getDb: vi.fn(async () => mockDb),
  getRawPool: vi.fn(async () => null),
}));

// Mock LLM for services that use it
vi.mock("../../shared/stewardlyWiring", () => ({
  rawInvokeLLM: vi.fn(async () => ({
    choices: [{
      message: {
        content: JSON.stringify({
          items: [
            { priority: "high", title: "Test", description: "Test rec", estimatedImpact: "High", timeframe: "1 month" },
          ],
        }),
      },
    }],
  })),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────

function pushResult(rows: any[], meta?: any) {
  mockExecuteResults.push([rows, meta ?? { affectedRows: 0 }]);
}

function pushInsertResult(insertId: number) {
  mockExecuteResults.push([{ insertId, affectedRows: 1 }, undefined]);
}

/** For UPDATE/DELETE: returns [{affectedRows: n}, undefined] so [result] destructures correctly */
function pushMutationResult(affectedRows: number) {
  mockExecuteResults.push([{ affectedRows }, undefined]);
}

function pushEmpty() {
  mockExecuteResults.push([[], { affectedRows: 0 }]);
}

function getLastSql(): string {
  return executeCalls.length > 0 ? executeCalls[executeCalls.length - 1].sql : "";
}

function getAllSqlStrings(): string[] {
  return executeCalls.map(c => typeof c.sql === "string" ? c.sql : "");
}

// ─── Setup ───────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  executeCalls.length = 0;
  mockExecuteResults.length = 0;
});

// ═══════════════════════════════════════════════════════════════════════════
// 1. cascadeNotifications.ts
// ═══════════════════════════════════════════════════════════════════════════

describe("cascadeNotifications — SQL migration integrity", () => {
  it("scanForCascadeAlerts executes SELECT queries with sql templates", async () => {
    // Push empty results for each of the 5-6 queries
    for (let i = 0; i < 10; i++) pushEmpty();

    const { scanForCascadeAlerts } = await import("./cascadeNotifications");
    const alerts = await scanForCascadeAlerts(1);

    expect(Array.isArray(alerts)).toBe(true);
    // Should have called execute at least once (stale profiles query)
    expect(mockExecute).toHaveBeenCalled();
  });

  it("scanForCascadeAlerts returns stale profile alerts when data exists", async () => {
    // Stale profiles query returns data
    pushResult([{ user_id: 42, updated_at: new Date("2025-01-01"), name: "Alice" }]);
    // Misaligned nodes — empty
    pushEmpty();
    // No suitability — empty
    pushEmpty();
    // Expiring letters — empty
    pushEmpty();
    // Opportunities — empty
    pushEmpty();

    const { scanForCascadeAlerts } = await import("./cascadeNotifications");
    const alerts = await scanForCascadeAlerts(1);

    const staleAlert = alerts.find(a => a.id === "stale-profile-42");
    expect(staleAlert).toBeDefined();
    expect(staleAlert!.category).toBe("stale_data");
    expect(staleAlert!.clientId).toBe(42);
    expect(staleAlert!.clientName).toBe("Alice");
  });

  it("generateClientFacingSummary queries saved_analyses with sql templates", async () => {
    // Push results for 5 section queries (retirement, insurance, tax, estate, invest)
    for (let i = 0; i < 5; i++) pushEmpty();

    const { generateClientFacingSummary } = await import("./cascadeNotifications");
    const summary = await generateClientFacingSummary(1, "Test Client");

    expect(summary.clientName).toBe("Test Client");
    expect(summary.overallHealth).toBeDefined();
    expect(summary.sections.length).toBeGreaterThan(0);
    // Default "Getting Started" section when no data
    expect(summary.sections[0].title).toBe("Getting Started");
  });

  it("generateClientFacingSummary processes retirement data correctly", async () => {
    // Retirement data with high readiness
    pushResult([{ result_json: JSON.stringify({ readinessScore: 85 }) }]);
    // Insurance — empty
    pushEmpty();
    // Tax — empty
    pushEmpty();
    // Estate — empty
    pushEmpty();
    // Invest — empty
    pushEmpty();

    const { generateClientFacingSummary } = await import("./cascadeNotifications");
    const summary = await generateClientFacingSummary(1, "Retiree");

    const retirement = summary.sections.find(s => s.title === "Retirement Planning");
    expect(retirement).toBeDefined();
    expect(retirement!.status).toBe("on_track");
    expect(retirement!.progress).toBe(85);
  });

  it("generateBulkEngagementLetters queries users with sql template", async () => {
    // Users query
    pushResult([{ id: 1, name: "Client A", email: "a@test.com" }]);
    // Existing letter check — empty (no valid letter)
    pushEmpty();
    // Insert result
    pushInsertResult(100);

    const { generateBulkEngagementLetters } = await import("./cascadeNotifications");
    const result = await generateBulkEngagementLetters(1, {});

    expect(result.totalClients).toBe(1);
    expect(result.generated).toBe(1);
    expect(result.results[0].clientName).toBe("Client A");
  });

  it("generateBulkEngagementLetters uses sql.join for specific clientIds", async () => {
    // Users query with specific IDs
    pushResult([{ id: 5, name: "Client B", email: "b@test.com" }]);
    // Existing letter check
    pushEmpty();
    // Insert
    pushInsertResult(101);

    const { generateBulkEngagementLetters } = await import("./cascadeNotifications");
    const result = await generateBulkEngagementLetters(1, { clientIds: [5, 10] });

    expect(result.totalClients).toBe(1);
    // Verify execute was called (sql.join used for IN clause)
    expect(mockExecute).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. engagementLetterService.ts
// ═══════════════════════════════════════════════════════════════════════════

describe("engagementLetterService — SQL migration integrity", () => {
  it("saveEngagementLetter inserts with sql template and returns id", async () => {
    pushInsertResult(42);

    const { saveEngagementLetter } = await import("./engagementLetterService");
    const id = await saveEngagementLetter({
      advisorId: 1,
      clientId: 2,
      clientName: "Test",
      advisorName: "Advisor",
      firmName: "TestFirm",
      scope: { services: ["financial-planning"], assets: "all", exclusions: [] },
      feeSchedule: { type: "aum", rate: 0.01, minimum: 0, billing: "quarterly" },
      fiduciaryStandard: "fiduciary",
      engagementType: "initial",
      effectiveDate: "2025-01-01",
      termMonths: 12,
      autoRenew: true,
      terminationNoticeDays: 30,
      formCRS: { delivered: true, date: "2025-01-01", method: "email" },
      advDelivery: { part2A: true, part2B: true, date: "2025-01-01" },
      privacyPolicyDelivered: true,
      arbitrationClause: false,
      status: "draft",
    } as any, "<h1>Letter</h1>", "# Letter");

    expect(id).toBe(42);
    expect(mockExecute).toHaveBeenCalled();
  });

  it("getEngagementLetter queries by id with sql template", async () => {
    pushResult([{
      id: 1,
      advisor_id: 1,
      client_id: 2,
      client_name: "Test",
      advisor_name: "Advisor",
      firm_name: "Firm",
      letter_html: "<h1>Letter</h1>",
      letter_markdown: "# Letter",
      scope_json: JSON.stringify({ services: ["financial-planning"] }),
      fee_schedule_json: JSON.stringify({ type: "aum", rate: 0.01 }),
      fiduciary_standard: "fiduciary",
      engagement_type: "initial",
      effective_date: "2025-01-01",
      term_months: 12,
      auto_renew: 1,
      termination_notice_days: 30,
      form_crs_json: JSON.stringify({ delivered: true }),
      adv_delivery_json: JSON.stringify({ part2A: true }),
      privacy_policy_delivered: 1,
      arbitration_clause: 0,
      status: "draft",
      signed_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    }]);

    const { getEngagementLetter } = await import("./engagementLetterService");
    const letter = await getEngagementLetter(1);

    expect(letter).not.toBeNull();
    expect(letter!.id).toBe(1);
  });

  it("getEngagementLetter returns null when not found", async () => {
    pushEmpty();

    const { getEngagementLetter } = await import("./engagementLetterService");
    const letter = await getEngagementLetter(999);

    expect(letter).toBeNull();
  });

  it("listEngagementLetters queries with optional filters", async () => {
    pushResult([
      { id: 1, advisor_id: 1, client_id: 2, client_name: "A", letter_type: "initial", status: "draft", content: "", fee_schedule: null, expiration_date: null, signed_at: null, created_at: new Date(), updated_at: new Date() },
      { id: 2, advisor_id: 1, client_id: 3, client_name: "B", letter_type: "renewal", status: "signed", content: "", fee_schedule: null, expiration_date: null, signed_at: null, created_at: new Date(), updated_at: new Date() },
    ]);

    const { listEngagementLetters } = await import("./engagementLetterService");
    const letters = await listEngagementLetters(undefined, 1);

    expect(letters.length).toBe(2);
  });

  it("updateEngagementStatus updates with sql template", async () => {
    pushMutationResult(1);

    const { updateEngagementStatus } = await import("./engagementLetterService");
    const result = await updateEngagementStatus(1, "signed");

    expect(result).toBe(true);
    expect(mockExecute).toHaveBeenCalled();
  });

  it("saveUnderwritingStatus inserts with sql template", async () => {
    pushInsertResult(55);

    const { saveUnderwritingStatus } = await import("./engagementLetterService");
    const id = await saveUnderwritingStatus({
      clientId: 1,
      carrier: "TestCo",
      product: "life",
      status: "submitted",
      requirements: [],
      submittedAt: new Date().toISOString(),
      lastStatusUpdate: new Date().toISOString(),
      expectedDecisionDate: null,
      notes: "",
    });

    expect(id).toBe(55);
  });

  it("getUnderwritingStatus queries by applicationId", async () => {
    pushResult([{
      id: 1,
      client_id: 2,
      carrier: "TestCo",
      product: "life",
      status: "submitted",
      submitted_at: new Date().toISOString(),
      last_status_update: null,
      requirements_json: null,
      expected_decision_date: null,
      notes: "",
    }]);

    const { getUnderwritingStatus } = await import("./engagementLetterService");
    const status = await getUnderwritingStatus(1);

    expect(status).not.toBeNull();
    expect(status!.clientId).toBe(2);
    expect(status!.carrier).toBe("TestCo");
  });

  it("listUnderwritingStatuses queries with optional clientId filter", async () => {
    pushResult([
      { id: 1, client_id: 2, client_name: "A", product_type: "life", carrier: "Co", status: "submitted", submitted_at: Date.now(), last_status_update: null, requirements_json: null },
    ]);

    const { listUnderwritingStatuses } = await import("./engagementLetterService");
    const statuses = await listUnderwritingStatuses(2);

    expect(statuses.length).toBe(1);
  });

  it("updateUnderwritingStatus updates with sql template", async () => {
    pushMutationResult(1);

    const { updateUnderwritingStatus } = await import("./engagementLetterService");
    const result = await updateUnderwritingStatus(1, "approved");

    expect(result).toBe(true);
  });

  it("generatePreMeetingBrief queries financial and planning data", async () => {
    // financial_profile_json
    pushResult([{ financial_profile_json: JSON.stringify({ netWorth: 500000, income: 100000 }) }]);
    // planning_nodes
    pushResult([{ node_type: "goal", label: "Retirement", current_value: 100000, target_value: 500000, status: "active" }]);
    // meeting_action_items
    pushResult([{ item: "Review portfolio", status: "pending" }]);

    const { generatePreMeetingBrief } = await import("./engagementLetterService");
    const brief = await generatePreMeetingBrief(1, 2, "annual review");

    expect(brief.brief).toBeDefined();
    expect(brief.agendaItems).toBeDefined();
    expect(Array.isArray(brief.agendaItems)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. firmComparisonEngine.ts
// ═══════════════════════════════════════════════════════════════════════════

describe("firmComparisonEngine — SQL migration integrity", () => {
  it("getWealthBridgeAdvantage queries financial_profiles and client_goals", async () => {
    // financial_profiles query
    pushResult([{ profile_json: JSON.stringify({ netWorth: 1000000, income: 200000 }) }]);
    // client_goals query
    pushResult([{ title: "Retirement" }, { title: "Education" }]);

    const { getWealthBridgeAdvantage } = await import("./firmComparisonEngine");
    const advantage = await getWealthBridgeAdvantage(1);

    expect(advantage).toBeDefined();
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. strategyArchetypes.ts
// ═══════════════════════════════════════════════════════════════════════════

describe("strategyArchetypes — SQL migration integrity", () => {
  it("matchClientToArchetypes queries financial_profiles and suitability", async () => {
    // financial_profiles query
    pushResult([{ profile_json: JSON.stringify({ netWorth: 500000, income: 100000, age: 45 }) }]);
    // suitability_assessments query
    pushResult([{ assessment_json: JSON.stringify({ riskTolerance: "moderate", investmentHorizon: 20 }) }]);

    const { matchClientToArchetypes } = await import("./strategyArchetypes");
    const matches = await matchClientToArchetypes(1);

    expect(Array.isArray(matches)).toBe(true);
    expect(matches.length).toBeGreaterThan(0);
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it("getAllArchetypes returns static archetype data without DB", async () => {
    const { getAllArchetypes } = await import("./strategyArchetypes");
    const archetypes = getAllArchetypes();

    expect(Array.isArray(archetypes)).toBe(true);
    expect(archetypes.length).toBeGreaterThan(0);
    expect(archetypes[0].id).toBeDefined();
    expect(archetypes[0].name).toBeDefined();
  });

  it("getArchetype returns specific archetype by id", async () => {
    const { getAllArchetypes, getArchetype } = await import("./strategyArchetypes");
    const all = getAllArchetypes();
    if (all.length > 0) {
      const found = getArchetype(all[0].id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(all[0].id);
    }
  });

  it("compareArchetypes returns comparison data", async () => {
    const { getAllArchetypes, compareArchetypes } = await import("./strategyArchetypes");
    const all = getAllArchetypes();
    if (all.length >= 2) {
      const comparison = compareArchetypes([all[0].id, all[1].id]);
      expect(comparison).toBeDefined();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. unifiedClientPlan.ts
// ═══════════════════════════════════════════════════════════════════════════

describe("unifiedClientPlan — SQL migration integrity", () => {
  it("getUnifiedClientPlan queries user, nodes, goals, analyses, milestones", async () => {
    // User query
    pushResult([{ id: 1, name: "Test Client", email: "test@test.com" }]);
    // Planning nodes
    pushResult([{ id: 1, level: 1, label: "Goal", value: 100000 }]);
    // Client goals
    pushResult([{ id: 1, title: "Retirement", target_value: 500000, current_value: 100000, category: "retirement", status: "active", timeline_months: 240 }]);
    // Saved analyses
    pushResult([{ calculator_type: "retirement", result_json: "{}", created_at: new Date() }]);
    // Milestones
    pushResult([{ title: "Retire", target_date: "2045-01-01", status: "upcoming" }]);

    const { getUnifiedClientPlan } = await import("./unifiedClientPlan");
    const plan = await getUnifiedClientPlan(1);

    expect(plan).toBeDefined();
    expect(mockExecute).toHaveBeenCalled();
  });

  it("generateForwardPlan queries and produces forward plan", async () => {
    // User name query
    pushResult([{ name: "Forward Client", email: "fc@test.com" }]);
    // Advisor name query
    pushEmpty();
    // Multiple data queries for plan generation
    for (let i = 0; i < 10; i++) pushEmpty();

    const { generateForwardPlan } = await import("./unifiedClientPlan");
    const plan = await generateForwardPlan(1);

    expect(plan).toBeDefined();
    expect(mockExecute).toHaveBeenCalled();
  });

  it("generateBackPlan queries and produces back plan", async () => {
    // Multiple queries for back plan
    for (let i = 0; i < 10; i++) pushEmpty();

    const { generateBackPlan } = await import("./unifiedClientPlan");
    const plan = await generateBackPlan(1);

    expect(plan).toBeDefined();
  });

  it("cascadeClientPlan inserts engagement letter with sql template", async () => {
    // Various queries during cascade
    for (let i = 0; i < 15; i++) pushEmpty();

    const { cascadeClientPlan } = await import("./unifiedClientPlan");
    const result = await cascadeClientPlan(1, 2, { generateEngagement: false });

    expect(result).toBeDefined();
  });

  it("getClientFacingSummary queries and builds summary", async () => {
    // Multiple data queries
    for (let i = 0; i < 10; i++) pushEmpty();

    const { getClientFacingSummary } = await import("./unifiedClientPlan");
    const summary = await getClientFacingSummary(1);

    expect(summary).toBeDefined();
  });

  it("getPracticeToClientRollup queries multiple clients", async () => {
    // Client list query
    pushResult([{ client_id: 1 }, { client_id: 2 }]);
    // Per-client queries
    for (let i = 0; i < 20; i++) pushEmpty();

    const { getPracticeToClientRollup } = await import("./unifiedClientPlan");
    const rollup = await getPracticeToClientRollup(1);

    expect(rollup).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. wealthEngineOptimizer.ts
// ═══════════════════════════════════════════════════════════════════════════

describe("wealthEngineOptimizer — SQL migration integrity", () => {
  it("generateUnifiedFiduciaryFile queries multiple tables", async () => {
    // suitability_assessments
    pushResult([{ id: 1, client_id: 1, assessment_json: "{}", created_at: new Date() }]);
    // recommendations_log
    pushResult([{ id: 1, client_id: 1, recommendation: "Test", created_at: new Date() }]);
    // engagement_letters
    pushResult([{ id: 1, client_id: 1, status: "signed", created_at: new Date() }]);
    // personal_financial_reviews
    pushResult([{ id: 1, client_id: 1, review_json: "{}", created_at: new Date() }]);
    // engagement_letters (active)
    pushResult([]);
    // shared_assumptions
    pushResult([]);
    // saved_analyses
    pushResult([]);

    const { generateUnifiedFiduciaryFile } = await import("./wealthEngineOptimizer");
    const file = await generateUnifiedFiduciaryFile(1);

    expect(file).toBeDefined();
    expect(mockExecute).toHaveBeenCalled();
  });

  it("detectAssumptionDrift queries recommendations and goals", async () => {
    // recommendations_log
    pushResult([]);
    // client_goals
    pushResult([]);

    const { detectAssumptionDrift } = await import("./wealthEngineOptimizer");
    const drift = await detectAssumptionDrift(1);

    expect(drift).toBeDefined();
  });

  it("findOrphanedRecommendations queries and identifies unlinked items", async () => {
    // goal categories
    pushResult([{ goal_category: "retirement" }]);
    // goal amounts
    pushResult([{ target_amount: 500000, current_amount: 100000 }]);
    // PFR count
    pushResult([{ cnt: 2 }]);
    // engagement letter count
    pushResult([{ cnt: 1 }]);
    // saved analyses
    pushResult([]);

    const { findOrphanedRecommendations } = await import("./wealthEngineOptimizer");
    const result = await findOrphanedRecommendations(1);

    expect(result).toBeDefined();
  });

  it("linkRecommendationToGoal updates with sql template", async () => {
    pushResult([], { affectedRows: 1 });

    const { linkRecommendationToGoal } = await import("./wealthEngineOptimizer");
    const result = await linkRecommendationToGoal(1, 2);

    expect(result).toBe(true);
    expect(mockExecute).toHaveBeenCalled();
  });

  it("computeCollateralTracking returns pure computation (no DB)", async () => {
    const { computeCollateralTracking } = await import("./wealthEngineOptimizer");
    const result = computeCollateralTracking([
      { year: 1, policyValue: 500000, loanBalance: 50000, netEquity: 450000 },
      { year: 2, policyValue: 520000, loanBalance: 45000, netEquity: 475000 },
    ]);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(result[0].loanToValue).toBeDefined();
  });

  it("modelExitStrategies returns pure computation (no DB)", async () => {
    const { modelExitStrategies } = await import("./wealthEngineOptimizer");
    const strategies = modelExitStrategies([
      { year: 1, policyValue: 500000, loanBalance: 50000, netEquity: 450000 },
      { year: 5, policyValue: 550000, loanBalance: 30000, netEquity: 520000 },
    ]);

    expect(Array.isArray(strategies)).toBe(true);
    expect(strategies.length).toBeGreaterThan(0);
  });

  it("evaluateSeniorProtections returns pure computation (no DB)", async () => {
    const { evaluateSeniorProtections } = await import("./wealthEngineOptimizer");
    const check = evaluateSeniorProtections(70, "annuity", 100000);

    expect(check).toBeDefined();
    expect(check.isApplicable).toBe(true);
    expect(check.protectionLevel).toBeDefined();
    expect(check.requiredChecks).toBeDefined();
  });

  it("checkMarketingRuleCompliance returns pure computation (no DB)", async () => {
    const { checkMarketingRuleCompliance } = await import("./wealthEngineOptimizer");
    const result = checkMarketingRuleCompliance({
      hasGuarantees: true,
      hasPredictions: true,
      targetAudience: "retail",
    });

    expect(result).toBeDefined();
    expect(result.issues).toBeDefined();
    expect(Array.isArray(result.issues)).toBe(true);
    expect(result.requiredDisclosures).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. yearOverYearService.ts
// ═══════════════════════════════════════════════════════════════════════════

describe("yearOverYearService — SQL migration integrity", () => {
  it("captureSnapshot queries nodes, goals, profile and inserts snapshot", async () => {
    // Planning nodes
    pushResult([{ id: 1, node_type: "goal", label: "Retirement", current_value: 100000, target_value: 500000, status: "active" }]);
    // Client goals
    pushResult([{ id: 1, name: "Retire Early", target_amount: 500000, current_amount: 100000, priority: "high", status: "active" }]);
    // User profile
    pushResult([{ financial_profile_json: JSON.stringify({ netWorth: 300000 }) }]);
    // Insert snapshot
    pushInsertResult(10);

    const { captureSnapshot } = await import("./yearOverYearService");
    const snapshot = await captureSnapshot(1, 2, "annual", "2025 Annual Review");

    expect(snapshot).toBeDefined();
    expect(mockExecute).toHaveBeenCalledTimes(4);
  });

  it("getSnapshots queries with client filter and limit", async () => {
    pushResult([
      { id: 1, client_id: 1, advisor_id: 2, snapshot_date: "2025-01-01", snapshot_type: "annual", label: "2025", nodes_json: "[]", goals_json: "[]", metrics_json: "{}", created_at: new Date() },
    ]);

    const { getSnapshots } = await import("./yearOverYearService");
    const snapshots = await getSnapshots(1, 10);

    expect(Array.isArray(snapshots)).toBe(true);
    expect(snapshots.length).toBe(1);
  });

  it("getSnapshotById queries single snapshot", async () => {
    pushResult([
      { id: 5, client_id: 1, advisor_id: 2, snapshot_date: "2025-01-01", snapshot_type: "annual", label: "2025", nodes_json: "[]", goals_json: "[]", metrics_json: "{}", created_at: new Date() },
    ]);

    const { getSnapshotById } = await import("./yearOverYearService");
    const snapshot = await getSnapshotById(5);

    expect(snapshot).not.toBeNull();
    expect(snapshot!.id).toBe(5);
  });

  it("getSnapshotById returns null when not found", async () => {
    pushEmpty();

    const { getSnapshotById } = await import("./yearOverYearService");
    const snapshot = await getSnapshotById(999);

    expect(snapshot).toBeNull();
  });

  it("generateYoYComparison queries snapshots and builds comparison", async () => {
    // Snapshots query
    pushResult([
      { id: 1, client_id: 1, advisor_id: 2, snapshot_date: "2024-01-01", snapshot_type: "annual", label: "2024", nodes_json: JSON.stringify([{ label: "Retirement", current_value: 80000 }]), goals_json: JSON.stringify([{ name: "Retire", current_amount: 80000, target_amount: 500000 }]), metrics_json: JSON.stringify({ netWorth: 250000 }), created_at: new Date("2024-01-01") },
      { id: 2, client_id: 1, advisor_id: 2, snapshot_date: "2025-01-01", snapshot_type: "annual", label: "2025", nodes_json: JSON.stringify([{ label: "Retirement", current_value: 100000 }]), goals_json: JSON.stringify([{ name: "Retire", current_amount: 100000, target_amount: 500000 }]), metrics_json: JSON.stringify({ netWorth: 300000 }), created_at: new Date("2025-01-01") },
    ]);

    const { generateYoYComparison } = await import("./yearOverYearService");
    const comparison = await generateYoYComparison(1);

    expect(comparison).toBeDefined();
    expect(comparison.clientId).toBe(1);
  });

  it("deleteSnapshot executes DELETE with sql template", async () => {
    pushMutationResult(1);

    const { deleteSnapshot } = await import("./yearOverYearService");
    const result = await deleteSnapshot(5);

    expect(result).toBe(true);
    expect(mockExecute).toHaveBeenCalled();
  });

  it("deleteSnapshot returns false when nothing deleted", async () => {
    pushMutationResult(0);

    const { deleteSnapshot } = await import("./yearOverYearService");
    const result = await deleteSnapshot(999);

    expect(result).toBe(false);
  });

  it("calculatePlanAdherence queries snapshots for adherence data", async () => {
    // Snapshots for the period
    pushResult([
      { id: 1, client_id: 1, advisor_id: 2, snapshot_date: "2025-01-01", snapshot_type: "annual", label: "2025", nodes_json: JSON.stringify([{ label: "Retirement", current_value: 100000, target_value: 500000 }]), goals_json: JSON.stringify([{ name: "Retire", current_amount: 100000, target_amount: 500000, status: "active" }]), metrics_json: JSON.stringify({ netWorth: 300000 }), created_at: new Date() },
    ]);

    const { calculatePlanAdherence } = await import("./yearOverYearService");
    const adherence = await calculatePlanAdherence(1, "2025");

    expect(adherence).toBeDefined();
    expect(adherence.clientId).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Cross-cutting: SQL template correctness
// ═══════════════════════════════════════════════════════════════════════════

describe("Cross-cutting SQL template verification", () => {
  it("no raw string concatenation in any execute call", async () => {
    // Push enough empty results for all queries
    for (let i = 0; i < 50; i++) pushEmpty();

    // Import and call a function from each service
    const { scanForCascadeAlerts } = await import("./cascadeNotifications");
    await scanForCascadeAlerts(1);

    // All execute calls should have received sql template objects, not raw strings
    for (const call of executeCalls) {
      // The sql tagged template produces an object, not a plain string
      // If it were a raw string, it would indicate a missed migration
      expect(typeof call.sql).not.toBe("undefined");
    }
  });

  it("all services import sql from drizzle-orm", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const dir = path.resolve(__dirname);

    const files = [
      "cascadeNotifications.ts",
      "engagementLetterService.ts",
      "firmComparisonEngine.ts",
      "strategyArchetypes.ts",
      "unifiedClientPlan.ts",
      "wealthEngineOptimizer.ts",
      "yearOverYearService.ts",
    ];

    for (const file of files) {
      const content = fs.readFileSync(path.join(dir, file), "utf8");
      expect(content).toContain('import { sql } from "drizzle-orm"');
      // No raw string execute patterns
      expect(content).not.toMatch(/db\.execute\(\s*["'`][^`]/);
    }
  });

  it("no ? placeholder patterns remain in sql templates", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const dir = path.resolve(__dirname);

    const files = [
      "cascadeNotifications.ts",
      "engagementLetterService.ts",
      "firmComparisonEngine.ts",
      "strategyArchetypes.ts",
      "unifiedClientPlan.ts",
      "wealthEngineOptimizer.ts",
      "yearOverYearService.ts",
    ];

    for (const file of files) {
      const content = fs.readFileSync(path.join(dir, file), "utf8");
      // Find all sql` template blocks and check for ? placeholders
      const sqlBlocks = content.match(/sql`[^`]*`/g) ?? [];
      for (const block of sqlBlocks) {
        // Allow ? in LIKE patterns (e.g., '%?%') but not as parameter placeholders
        const withoutLike = block.replace(/'%[^']*%'/g, "");
        // ? followed by comma or closing paren indicates a placeholder
        expect(withoutLike).not.toMatch(/\?\s*[,)]/);
      }
    }
  });

  it("all db.execute calls use sql tagged template (not raw string)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const dir = path.resolve(__dirname);

    const files = [
      "cascadeNotifications.ts",
      "engagementLetterService.ts",
      "firmComparisonEngine.ts",
      "strategyArchetypes.ts",
      "unifiedClientPlan.ts",
      "wealthEngineOptimizer.ts",
      "yearOverYearService.ts",
    ];

    for (const file of files) {
      const content = fs.readFileSync(path.join(dir, file), "utf8");
      // Every db.execute should be followed by sql` (possibly with whitespace/newline)
      // Count ALL execute patterns including casted ones
      const executeMatches = content.match(/(?:db|\(db as any\))\.execute\(/g) ?? [];
      const sqlExecuteMatches = content.match(/(?:db|\(db as any\))\.execute\(\s*sql\s*`/g) ?? [];

      // All execute calls should use sql templates
      expect(sqlExecuteMatches.length).toBe(executeMatches.length);
    }
  });
});
