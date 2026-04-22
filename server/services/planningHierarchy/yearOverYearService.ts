/**
 * Year-over-Year Comparison Service
 * 
 * Section 7.2 Enhancement: Annual Review
 * - Time-series planning node snapshots
 * - Goal progress visualization data
 * - Plan adherence trending
 * - Milestone tracking with trend indicators
 * - Cross-period delta analysis
 * 
 * Integrates with:
 * - Planning hierarchy (reads node snapshots)
 * - Cascading engine (alignment health over time)
 * - Benchmark engine (peer comparison trends)
 * - PFR generator (annual review data assembly)
 */

import { getDb } from "../../db";
import { sql } from "drizzle-orm";

// ─── TYPES ────────────────────────────────────────────────────────

export interface PlanningSnapshot {
  id: number;
  clientId: number;
  advisorId: number | null;
  snapshotDate: string;
  snapshotType: "annual" | "quarterly" | "milestone" | "manual";
  label: string;
  nodesJson: Array<{
    nodeId: number;
    nodeType: string;
    label: string;
    currentValue: number;
    targetValue: number;
    status: string;
    fundingRatio: number;
  }>;
  goalsJson: Array<{
    goalId: number;
    name: string;
    targetAmount: number;
    currentAmount: number;
    progressPct: number;
    priority: number;
    status: string;
  }>;
  metricsJson: {
    totalNetWorth: number;
    totalAssets: number;
    totalLiabilities: number;
    savingsRate: number;
    debtToIncomeRatio: number;
    emergencyFundMonths: number;
    insuranceCoverageRatio: number;
    retirementReadinessScore: number;
    overallAlignmentScore: number;
    goalCompletionRate: number;
  };
  createdAt: string;
}

export interface YoYComparison {
  clientId: number;
  periods: Array<{
    date: string;
    label: string;
    type: string;
  }>;
  metrics: Array<{
    metricName: string;
    category: string;
    values: Array<{ date: string; value: number }>;
    trend: "improving" | "declining" | "stable";
    changeFromFirst: number;
    changeFromPrevious: number;
  }>;
  goalProgress: Array<{
    goalName: string;
    priority: number;
    milestones: Array<{ date: string; progressPct: number; amount: number }>;
    trend: "on-track" | "ahead" | "behind" | "at-risk";
    projectedCompletionDate: string | null;
  }>;
  nodeDeltas: Array<{
    nodeLabel: string;
    nodeType: string;
    deltas: Array<{ date: string; currentValue: number; targetValue: number; fundingRatio: number }>;
    trend: "improving" | "declining" | "stable";
  }>;
  summary: {
    overallTrend: "improving" | "declining" | "stable" | "mixed";
    keyWins: string[];
    areasOfConcern: string[];
    recommendations: string[];
  };
}

export interface PlanAdherence {
  clientId: number;
  period: string;
  adherenceScore: number; // 0-100
  categories: Array<{
    category: string;
    planned: number;
    actual: number;
    adherencePct: number;
    status: "on-track" | "ahead" | "behind";
  }>;
  missedMilestones: string[];
  achievedMilestones: string[];
}

// ─── SNAPSHOT MANAGEMENT ──────────────────────────────────────────

export async function captureSnapshot(
  clientId: number,
  advisorId: number | null,
  snapshotType: PlanningSnapshot["snapshotType"],
  label: string
): Promise<number> {
  const db = (await getDb())!;

  // Gather current planning nodes
  let nodes: PlanningSnapshot["nodesJson"] = [];
  try {
    const [nodeRows] = await db.execute(sql`SELECT id, node_type, label, current_value, target_value, status
       FROM planning_nodes WHERE client_id = ${clientId} AND deleted_at IS NULL`);
    nodes = (nodeRows as unknown as any[]).map(r => ({
      nodeId: r.id,
      nodeType: r.node_type ?? "goal",
      label: r.label ?? "",
      currentValue: parseFloat(r.current_value) || 0,
      targetValue: parseFloat(r.target_value) || 0,
      status: r.status ?? "active",
      fundingRatio: r.target_value > 0 ? (parseFloat(r.current_value) || 0) / parseFloat(r.target_value) : 0,
    }));
  } catch { /* table may not exist */ }

  // Gather current goals
  let goals: PlanningSnapshot["goalsJson"] = [];
  try {
    const [goalRows] = await db.execute(sql`SELECT id, name, target_amount, current_amount, priority, status
       FROM client_goals WHERE client_id = ${clientId}`);
    goals = (goalRows as unknown as any[]).map(r => ({
      goalId: r.id,
      name: r.name ?? "",
      targetAmount: parseFloat(r.target_amount) || 0,
      currentAmount: parseFloat(r.current_amount) || 0,
      progressPct: r.target_amount > 0 ? ((parseFloat(r.current_amount) || 0) / parseFloat(r.target_amount)) * 100 : 0,
      priority: r.priority ?? 5,
      status: r.status ?? "active",
    }));
  } catch { /* table may not exist */ }

  // Compute aggregate metrics
  const totalAssets = nodes.filter(n => n.currentValue > 0).reduce((s, n) => s + n.currentValue, 0);
  const totalLiabilities = nodes.filter(n => n.nodeType === "debt" || n.nodeType === "liability").reduce((s, n) => s + Math.abs(n.currentValue), 0);
  const totalNetWorth = totalAssets - totalLiabilities;
  const goalCompletionRate = goals.length > 0
    ? (goals.filter(g => g.status === "completed").length / goals.length) * 100
    : 0;
  const overallAlignmentScore = nodes.length > 0
    ? nodes.reduce((s, n) => s + Math.min(n.fundingRatio, 1), 0) / nodes.length * 100
    : 0;

  const metrics: PlanningSnapshot["metricsJson"] = {
    totalNetWorth,
    totalAssets,
    totalLiabilities,
    savingsRate: 0, // Would need income data
    debtToIncomeRatio: 0,
    emergencyFundMonths: 0,
    insuranceCoverageRatio: 0,
    retirementReadinessScore: 0,
    overallAlignmentScore,
    goalCompletionRate,
  };

  // Try to enrich from financial profile
  try {
    const [profiles] = await db.execute(sql`SELECT financial_profile_json FROM users WHERE id = ${clientId} LIMIT 1`);
    const profileArr = profiles as unknown as any[];
    if (profileArr.length && profileArr[0].financial_profile_json) {
      const fp = typeof profileArr[0].financial_profile_json === "string"
        ? JSON.parse(profileArr[0].financial_profile_json)
        : profileArr[0].financial_profile_json;
      if (fp.savingsRate) metrics.savingsRate = fp.savingsRate;
      if (fp.debtToIncomeRatio) metrics.debtToIncomeRatio = fp.debtToIncomeRatio;
      if (fp.emergencyFundMonths) metrics.emergencyFundMonths = fp.emergencyFundMonths;
    }
  } catch { /* profile may not exist */ }

  const [result] = await db.execute(sql`INSERT INTO planning_snapshots (client_id, advisor_id, snapshot_date, snapshot_type, label,
      nodes_json, goals_json, metrics_json)
    VALUES (${clientId}, ${advisorId}, CURDATE(), ${snapshotType}, ${label}, ${JSON.stringify(nodes)}, ${JSON.stringify(goals)}, ${JSON.stringify(metrics)})`);

  return (result as any).insertId;
}

export async function getSnapshots(clientId: number, limit = 20): Promise<PlanningSnapshot[]> {
  const db = (await getDb())!;
  const [rows] = await db.execute(sql`SELECT * FROM planning_snapshots WHERE client_id = ${clientId}
     ORDER BY snapshot_date DESC LIMIT ${limit}`);
  return (rows as unknown as any[]).map(parseSnapshotRow);
}

export async function getSnapshotById(id: number): Promise<PlanningSnapshot | null> {
  const db = (await getDb())!;
  const [rows] = await db.execute(sql`SELECT * FROM planning_snapshots WHERE id = ${id}`);
  const arr = rows as unknown as any[];
  if (!arr.length) return null;
  return parseSnapshotRow(arr[0]);
}

function parseSnapshotRow(r: any): PlanningSnapshot {
  return {
    id: r.id,
    clientId: r.client_id,
    advisorId: r.advisor_id,
    snapshotDate: r.snapshot_date,
    snapshotType: r.snapshot_type,
    label: r.label ?? "",
    nodesJson: typeof r.nodes_json === "string" ? JSON.parse(r.nodes_json) : (r.nodes_json ?? []),
    goalsJson: typeof r.goals_json === "string" ? JSON.parse(r.goals_json) : (r.goals_json ?? []),
    metricsJson: typeof r.metrics_json === "string" ? JSON.parse(r.metrics_json) : (r.metrics_json ?? {}),
    createdAt: r.created_at,
  };
}

// ─── YEAR-OVER-YEAR COMPARISON ────────────────────────────────────

export async function generateYoYComparison(clientId: number): Promise<YoYComparison> {
  const snapshots = await getSnapshots(clientId, 20);

  if (snapshots.length < 2) {
    return {
      clientId,
      periods: snapshots.map(s => ({ date: s.snapshotDate, label: s.label, type: s.snapshotType })),
      metrics: [],
      goalProgress: [],
      nodeDeltas: [],
      summary: {
        overallTrend: "stable",
        keyWins: [],
        areasOfConcern: snapshots.length === 0 ? ["No snapshots captured yet. Create an initial snapshot to begin tracking."] : ["Only one snapshot available. Capture another to enable comparison."],
        recommendations: ["Capture quarterly snapshots for meaningful trend analysis"],
      },
    };
  }

  // Sort chronologically
  const sorted = [...snapshots].sort((a, b) => new Date(a.snapshotDate).getTime() - new Date(b.snapshotDate).getTime());

  const periods = sorted.map(s => ({ date: s.snapshotDate, label: s.label, type: s.snapshotType }));

  // Build metric time series
  const metricKeys: Array<{ key: keyof PlanningSnapshot["metricsJson"]; name: string; category: string }> = [
    { key: "totalNetWorth", name: "Total Net Worth", category: "Wealth" },
    { key: "totalAssets", name: "Total Assets", category: "Wealth" },
    { key: "totalLiabilities", name: "Total Liabilities", category: "Debt" },
    { key: "savingsRate", name: "Savings Rate", category: "Cash Flow" },
    { key: "debtToIncomeRatio", name: "Debt-to-Income Ratio", category: "Debt" },
    { key: "emergencyFundMonths", name: "Emergency Fund (Months)", category: "Protection" },
    { key: "insuranceCoverageRatio", name: "Insurance Coverage Ratio", category: "Protection" },
    { key: "retirementReadinessScore", name: "Retirement Readiness", category: "Retirement" },
    { key: "overallAlignmentScore", name: "Plan Alignment Score", category: "Planning" },
    { key: "goalCompletionRate", name: "Goal Completion Rate", category: "Goals" },
  ];

  const metrics: YoYComparison["metrics"] = metricKeys.map(mk => {
    const values = sorted.map(s => ({
      date: s.snapshotDate,
      value: (s.metricsJson as any)?.[mk.key] ?? 0,
    }));
    const first = values[0]?.value ?? 0;
    const last = values[values.length - 1]?.value ?? 0;
    const prev = values.length >= 2 ? values[values.length - 2]?.value ?? 0 : first;
    const changeFromFirst = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;
    const changeFromPrevious = prev !== 0 ? ((last - prev) / Math.abs(prev)) * 100 : 0;

    // For liabilities and debt ratio, declining is improving
    const isInverseMetric = mk.key === "totalLiabilities" || mk.key === "debtToIncomeRatio";
    const trend: "improving" | "declining" | "stable" =
      Math.abs(changeFromFirst) < 2 ? "stable"
      : (isInverseMetric ? changeFromFirst < 0 : changeFromFirst > 0) ? "improving"
      : "declining";

    return { metricName: mk.name, category: mk.category, values, trend, changeFromFirst, changeFromPrevious };
  });

  // Build goal progress time series
  const allGoalNames = new Set<string>();
  sorted.forEach(s => s.goalsJson?.forEach(g => allGoalNames.add(g.name)));

  const goalProgress: YoYComparison["goalProgress"] = Array.from(allGoalNames).map(goalName => {
    const milestones = sorted.map(s => {
      const g = s.goalsJson?.find(g2 => g2.name === goalName);
      return {
        date: s.snapshotDate,
        progressPct: g?.progressPct ?? 0,
        amount: g?.currentAmount ?? 0,
      };
    });
    const latestProgress = milestones[milestones.length - 1]?.progressPct ?? 0;
    const prevProgress = milestones.length >= 2 ? milestones[milestones.length - 2]?.progressPct ?? 0 : 0;
    const goal = sorted[sorted.length - 1]?.goalsJson?.find(g => g.name === goalName);

    let trend: "on-track" | "ahead" | "behind" | "at-risk";
    if (latestProgress >= 100) trend = "ahead";
    else if (latestProgress >= prevProgress && latestProgress >= 50) trend = "on-track";
    else if (latestProgress < prevProgress) trend = "at-risk";
    else trend = "behind";

    return {
      goalName,
      priority: goal?.priority ?? 5,
      milestones,
      trend,
      projectedCompletionDate: null, // Would need time-series regression
    };
  });

  // Build node delta time series
  const allNodeLabels = new Set<string>();
  sorted.forEach(s => s.nodesJson?.forEach(n => allNodeLabels.add(n.label)));

  const nodeDeltas: YoYComparison["nodeDeltas"] = Array.from(allNodeLabels).slice(0, 50).map(nodeLabel => {
    const deltas = sorted.map(s => {
      const n = s.nodesJson?.find(n2 => n2.label === nodeLabel);
      return {
        date: s.snapshotDate,
        currentValue: n?.currentValue ?? 0,
        targetValue: n?.targetValue ?? 0,
        fundingRatio: n?.fundingRatio ?? 0,
      };
    });
    const firstFR = deltas[0]?.fundingRatio ?? 0;
    const lastFR = deltas[deltas.length - 1]?.fundingRatio ?? 0;
    const trend: "improving" | "declining" | "stable" =
      Math.abs(lastFR - firstFR) < 0.05 ? "stable"
      : lastFR > firstFR ? "improving"
      : "declining";

    return {
      nodeLabel,
      nodeType: sorted[sorted.length - 1]?.nodesJson?.find(n => n.label === nodeLabel)?.nodeType ?? "goal",
      deltas,
      trend,
    };
  });

  // Generate summary
  const improvingMetrics = metrics.filter(m => m.trend === "improving").map(m => m.metricName);
  const decliningMetrics = metrics.filter(m => m.trend === "declining").map(m => m.metricName);
  const atRiskGoals = goalProgress.filter(g => g.trend === "at-risk").map(g => g.goalName);

  const overallTrend: YoYComparison["summary"]["overallTrend"] =
    improvingMetrics.length > decliningMetrics.length * 2 ? "improving"
    : decliningMetrics.length > improvingMetrics.length * 2 ? "declining"
    : improvingMetrics.length === 0 && decliningMetrics.length === 0 ? "stable"
    : "mixed";

  const keyWins = improvingMetrics.slice(0, 3).map(m => `${m} is trending positively`);
  const areasOfConcern = [
    ...decliningMetrics.slice(0, 3).map(m => `${m} is declining — review and adjust strategy`),
    ...atRiskGoals.slice(0, 2).map(g => `Goal "${g}" is at risk — consider increasing contributions or adjusting timeline`),
  ];
  const recommendations = [
    ...(decliningMetrics.length > 0 ? ["Schedule a focused review session to address declining metrics"] : []),
    ...(atRiskGoals.length > 0 ? ["Revisit goal priorities and timelines for at-risk goals"] : []),
    "Continue capturing quarterly snapshots for trend analysis",
    "Share this comparison report with the client during the annual review",
  ];

  return { clientId, periods, metrics, goalProgress, nodeDeltas, summary: { overallTrend, keyWins, areasOfConcern, recommendations } };
}

// ─── PLAN ADHERENCE TRACKING ──────────────────────────────────────

export async function calculatePlanAdherence(clientId: number, periodLabel: string): Promise<PlanAdherence> {
  const snapshots = await getSnapshots(clientId, 4);
  if (snapshots.length < 2) {
    return {
      clientId,
      period: periodLabel,
      adherenceScore: 0,
      categories: [],
      missedMilestones: ["Insufficient snapshot data for adherence calculation"],
      achievedMilestones: [],
    };
  }

  const sorted = [...snapshots].sort((a, b) => new Date(a.snapshotDate).getTime() - new Date(b.snapshotDate).getTime());
  const previous = sorted[sorted.length - 2];
  const current = sorted[sorted.length - 1];

  // Compare nodes between periods
  const categories: PlanAdherence["categories"] = [];
  const achievedMilestones: string[] = [];
  const missedMilestones: string[] = [];

  const nodeTypes = new Set<string>();
  current.nodesJson?.forEach(n => nodeTypes.add(n.nodeType));

  for (const nodeType of nodeTypes) {
    const prevNodes = previous.nodesJson?.filter(n => n.nodeType === nodeType) ?? [];
    const currNodes = current.nodesJson?.filter(n => n.nodeType === nodeType) ?? [];

    const prevTotal = prevNodes.reduce((s, n) => s + n.targetValue, 0);
    const currTotal = currNodes.reduce((s, n) => s + n.currentValue, 0);

    if (prevTotal > 0) {
      const adherencePct = Math.min((currTotal / prevTotal) * 100, 150);
      categories.push({
        category: nodeType,
        planned: prevTotal,
        actual: currTotal,
        adherencePct,
        status: adherencePct >= 95 ? "on-track" : adherencePct >= 110 ? "ahead" : "behind",
      });
    }
  }

  // Check goal milestones
  const prevGoals = new Map(previous.goalsJson?.map(g => [g.name, g]) ?? []);
  for (const goal of current.goalsJson ?? []) {
    const prevGoal = prevGoals.get(goal.name);
    if (prevGoal) {
      if (goal.progressPct >= 100 && prevGoal.progressPct < 100) {
        achievedMilestones.push(`Goal "${goal.name}" completed!`);
      } else if (goal.progressPct < prevGoal.progressPct) {
        missedMilestones.push(`Goal "${goal.name}" regressed from ${prevGoal.progressPct.toFixed(0)}% to ${goal.progressPct.toFixed(0)}%`);
      }
    }
  }

  const adherenceScore = categories.length > 0
    ? categories.reduce((s, c) => s + Math.min(c.adherencePct, 100), 0) / categories.length
    : 0;

  return { clientId, period: periodLabel, adherenceScore, categories, missedMilestones, achievedMilestones };
}

// ─── DELETE SNAPSHOT ──────────────────────────────────────────────

export async function deleteSnapshot(id: number): Promise<boolean> {
  const db = (await getDb())!;
  const [result] = await db.execute(sql`DELETE FROM planning_snapshots WHERE id = ${id}`);
  return (result as any).affectedRows > 0;
}
