/**
 * platformSelfAssessment — Continuous improvement self-assessment engine.
 *
 * Aggregates health metrics from multiple subsystems, produces a structured
 * health report, and generates improvement hypothesis candidates that the
 * improvement engine can test.
 *
 * Pure functions — no DB access, no LLM calls. Designed for unit testing.
 * The caller (cron task) provides the raw data; this module scores it.
 */

// ─── Types ─────────────────────────────────────────────────────────

export type HealthStatus = "healthy" | "degraded" | "critical" | "unknown";

export interface SubsystemHealth {
  name: string;
  status: HealthStatus;
  score: number; // 0-100
  metrics: Record<string, number | string>;
  issues: string[];
}

export interface PlatformHealthReport {
  timestamp: number;
  overallScore: number; // 0-100 weighted average
  overallStatus: HealthStatus;
  subsystems: SubsystemHealth[];
  hypotheses: ImprovementHypothesis[];
  summary: string;
}

export interface ImprovementHypothesis {
  id: string;
  subsystem: string;
  signal: string;
  hypothesis: string;
  expectedImpact: "low" | "medium" | "high";
  effort: "small" | "medium" | "large";
  priority: number; // 1-10, higher = more urgent
}

// ─── Subsystem Health Assessors ────────────────────────────────────

export interface ChatHealthInput {
  totalConversations: number;
  avgResponseTimeMs: number;
  errorRate: number; // 0-1
  avgUserRating: number; // 0-5
  activeUsers24h: number;
}

export function assessChatHealth(input: ChatHealthInput): SubsystemHealth {
  const issues: string[] = [];
  let score = 100;

  if (input.errorRate > 0.05) {
    score -= 30;
    issues.push(`High error rate: ${(input.errorRate * 100).toFixed(1)}% (threshold: 5%)`);
  } else if (input.errorRate > 0.01) {
    score -= 10;
    issues.push(`Elevated error rate: ${(input.errorRate * 100).toFixed(1)}%`);
  }

  if (input.avgResponseTimeMs > 10000) {
    score -= 25;
    issues.push(`Slow responses: ${(input.avgResponseTimeMs / 1000).toFixed(1)}s avg (threshold: 10s)`);
  } else if (input.avgResponseTimeMs > 5000) {
    score -= 10;
    issues.push(`Elevated response time: ${(input.avgResponseTimeMs / 1000).toFixed(1)}s avg`);
  }

  if (input.avgUserRating < 3.0 && input.totalConversations > 10) {
    score -= 20;
    issues.push(`Low user satisfaction: ${input.avgUserRating.toFixed(1)}/5.0`);
  }

  if (input.activeUsers24h === 0 && input.totalConversations > 0) {
    score -= 15;
    issues.push("No active users in last 24h despite historical usage");
  }

  return {
    name: "ai_chat",
    status: scoreToStatus(score),
    score: Math.max(0, score),
    metrics: {
      totalConversations: input.totalConversations,
      avgResponseTimeMs: input.avgResponseTimeMs,
      errorRate: input.errorRate,
      avgUserRating: input.avgUserRating,
      activeUsers24h: input.activeUsers24h,
    },
    issues,
  };
}

export interface LearningHealthInput {
  totalTracks: number;
  tracksWithContent: number; // tracks that have chapters + questions
  avgMasteryScore: number; // 0-5
  activeLearners7d: number;
  questionsAnswered7d: number;
  dueReviewCount: number;
}

export function assessLearningHealth(input: LearningHealthInput): SubsystemHealth {
  const issues: string[] = [];
  let score = 100;

  const contentCoverage = input.totalTracks > 0
    ? input.tracksWithContent / input.totalTracks
    : 0;

  if (contentCoverage < 0.5) {
    score -= 30;
    issues.push(`Low content coverage: ${(contentCoverage * 100).toFixed(0)}% of tracks have content`);
  } else if (contentCoverage < 0.8) {
    score -= 15;
    issues.push(`Partial content coverage: ${(contentCoverage * 100).toFixed(0)}%`);
  }

  if (input.dueReviewCount > 100 && input.activeLearners7d > 0) {
    score -= 15;
    issues.push(`${input.dueReviewCount} overdue SRS reviews (learner disengagement risk)`);
  }

  if (input.activeLearners7d === 0 && input.totalTracks > 0) {
    score -= 20;
    issues.push("No active learners in last 7 days");
  }

  return {
    name: "learning",
    status: scoreToStatus(score),
    score: Math.max(0, score),
    metrics: {
      totalTracks: input.totalTracks,
      tracksWithContent: input.tracksWithContent,
      contentCoverage: `${(contentCoverage * 100).toFixed(0)}%`,
      avgMasteryScore: input.avgMasteryScore,
      activeLearners7d: input.activeLearners7d,
      questionsAnswered7d: input.questionsAnswered7d,
      dueReviewCount: input.dueReviewCount,
    },
    issues,
  };
}

export interface CalculatorHealthInput {
  totalCalculations7d: number;
  uniqueCalculatorTypes: number;
  avgCalculationTimeMs: number;
  errorCount7d: number;
}

export function assessCalculatorHealth(input: CalculatorHealthInput): SubsystemHealth {
  const issues: string[] = [];
  let score = 100;

  if (input.errorCount7d > 10) {
    score -= 25;
    issues.push(`${input.errorCount7d} calculation errors in last 7 days`);
  }

  if (input.uniqueCalculatorTypes < 3 && input.totalCalculations7d > 0) {
    score -= 10;
    issues.push(`Only ${input.uniqueCalculatorTypes} calculator types used — low diversity`);
  }

  if (input.totalCalculations7d === 0) {
    score -= 15;
    issues.push("No calculations run in last 7 days");
  }

  return {
    name: "calculators",
    status: scoreToStatus(score),
    score: Math.max(0, score),
    metrics: {
      totalCalculations7d: input.totalCalculations7d,
      uniqueCalculatorTypes: input.uniqueCalculatorTypes,
      avgCalculationTimeMs: input.avgCalculationTimeMs,
      errorCount7d: input.errorCount7d,
    },
    issues,
  };
}

export interface AgentHealthInput {
  totalAgentRuns7d: number;
  successRate: number; // 0-1
  avgCostPerRun: number;
  activeAgents: number;
  totalAgents: number;
}

export function assessAgentHealth(input: AgentHealthInput): SubsystemHealth {
  const issues: string[] = [];
  let score = 100;

  if (input.successRate < 0.7 && input.totalAgentRuns7d > 5) {
    score -= 30;
    issues.push(`Low agent success rate: ${(input.successRate * 100).toFixed(0)}%`);
  }

  if (input.avgCostPerRun > 2.0 && input.totalAgentRuns7d > 5) {
    score -= 15;
    issues.push(`High agent cost: $${input.avgCostPerRun.toFixed(2)}/run`);
  }

  if (input.activeAgents === 0 && input.totalAgents > 0) {
    score -= 20;
    issues.push("No active agents despite configured instances");
  }

  return {
    name: "agents",
    status: scoreToStatus(score),
    score: Math.max(0, score),
    metrics: {
      totalAgentRuns7d: input.totalAgentRuns7d,
      successRate: input.successRate,
      avgCostPerRun: input.avgCostPerRun,
      activeAgents: input.activeAgents,
      totalAgents: input.totalAgents,
    },
    issues,
  };
}

// ─── Report Composition ────────────────────────────────────────────

const SUBSYSTEM_WEIGHTS: Record<string, number> = {
  ai_chat: 0.35,
  learning: 0.25,
  calculators: 0.20,
  agents: 0.20,
};

export function composeHealthReport(
  subsystems: SubsystemHealth[],
): PlatformHealthReport {
  // Weighted average score
  let totalWeight = 0;
  let weightedSum = 0;
  for (const sub of subsystems) {
    const weight = SUBSYSTEM_WEIGHTS[sub.name] ?? 0.1;
    weightedSum += sub.score * weight;
    totalWeight += weight;
  }
  const overallScore = totalWeight > 0
    ? Math.round(weightedSum / totalWeight)
    : 0;

  // Generate hypotheses from issues
  const hypotheses = generateHypotheses(subsystems);

  // Build summary
  const criticalCount = subsystems.filter((s) => s.status === "critical").length;
  const degradedCount = subsystems.filter((s) => s.status === "degraded").length;
  const totalIssues = subsystems.reduce((sum, s) => sum + s.issues.length, 0);

  let summary: string;
  if (criticalCount > 0) {
    summary = `Platform health CRITICAL: ${criticalCount} subsystem(s) critical, ${totalIssues} total issues. Immediate attention needed.`;
  } else if (degradedCount > 0) {
    summary = `Platform health DEGRADED: ${degradedCount} subsystem(s) degraded, ${totalIssues} total issues.`;
  } else if (totalIssues > 0) {
    summary = `Platform health GOOD with ${totalIssues} minor issue(s). Score: ${overallScore}/100.`;
  } else {
    summary = `Platform health EXCELLENT. All subsystems operational. Score: ${overallScore}/100.`;
  }

  return {
    timestamp: Date.now(),
    overallScore,
    overallStatus: scoreToStatus(overallScore),
    subsystems,
    hypotheses,
    summary,
  };
}

// ─── Hypothesis Generation ─────────────────────────────────────────

function generateHypotheses(subsystems: SubsystemHealth[]): ImprovementHypothesis[] {
  const hypotheses: ImprovementHypothesis[] = [];
  let idCounter = 0;

  for (const sub of subsystems) {
    for (const issue of sub.issues) {
      const h = issueToHypothesis(sub.name, issue, ++idCounter);
      if (h) hypotheses.push(h);
    }
  }

  // Sort by priority descending
  return hypotheses.sort((a, b) => b.priority - a.priority);
}

function issueToHypothesis(
  subsystem: string,
  issue: string,
  id: number,
): ImprovementHypothesis | null {
  const base = {
    id: `hyp-${id}`,
    subsystem,
    signal: issue,
  };

  // Pattern match on common issue types
  if (issue.includes("error rate") || issue.includes("errors")) {
    return {
      ...base,
      hypothesis: `Investigate root cause of ${subsystem} errors. Check logs for common failure patterns. Consider adding retry logic or better error messages.`,
      expectedImpact: issue.includes("High") ? "high" : "medium",
      effort: "medium",
      priority: issue.includes("High") ? 9 : 6,
    };
  }

  if (issue.includes("response time") || issue.includes("Slow")) {
    return {
      ...base,
      hypothesis: `Profile ${subsystem} response pipeline for bottlenecks. Consider caching frequent queries, optimizing context assembly, or reducing token count.`,
      expectedImpact: "medium",
      effort: "medium",
      priority: 7,
    };
  }

  if (issue.includes("satisfaction") || issue.includes("rating")) {
    return {
      ...base,
      hypothesis: `Analyze low-rated conversations for patterns. Common causes: irrelevant answers, hallucinations, missing context. Consider prompt tuning or RAG improvements.`,
      expectedImpact: "high",
      effort: "large",
      priority: 8,
    };
  }

  if (issue.includes("content coverage")) {
    return {
      ...base,
      hypothesis: `Expand learning content for tracks missing chapters/questions. Re-run GitHub import or author new content via Content Studio.`,
      expectedImpact: "high",
      effort: "medium",
      priority: 7,
    };
  }

  if (issue.includes("overdue") || issue.includes("disengagement")) {
    return {
      ...base,
      hypothesis: `Send reminder notifications for overdue SRS reviews. Consider gamification (streaks, badges) to improve retention.`,
      expectedImpact: "medium",
      effort: "small",
      priority: 5,
    };
  }

  if (issue.includes("No active") || issue.includes("No calculations")) {
    return {
      ...base,
      hypothesis: `Low engagement in ${subsystem}. Consider improving discoverability (nav placement, chat suggestions), onboarding prompts, or proactive insight nudges.`,
      expectedImpact: "medium",
      effort: "medium",
      priority: 4,
    };
  }

  if (issue.includes("cost")) {
    return {
      ...base,
      hypothesis: `Reduce ${subsystem} per-run cost. Consider model downgrade for simple tasks, caching common results, or reducing max iterations.`,
      expectedImpact: "medium",
      effort: "small",
      priority: 6,
    };
  }

  if (issue.includes("success rate")) {
    return {
      ...base,
      hypothesis: `Improve agent success rate. Analyze failure patterns, refine tool definitions, add better error recovery, or increase iteration budget for complex tasks.`,
      expectedImpact: "high",
      effort: "medium",
      priority: 8,
    };
  }

  // Generic fallback
  return {
    ...base,
    hypothesis: `Investigate and address: ${issue}`,
    expectedImpact: "low",
    effort: "small",
    priority: 3,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────

function scoreToStatus(score: number): HealthStatus {
  if (score >= 80) return "healthy";
  if (score >= 50) return "degraded";
  if (score >= 0) return "critical";
  return "unknown";
}

/** Format a health report as a compact markdown string for logging or LLM context. */
export function formatReportMarkdown(report: PlatformHealthReport): string {
  const lines: string[] = [
    `# Platform Health Report`,
    `**Score:** ${report.overallScore}/100 (${report.overallStatus})`,
    `**Summary:** ${report.summary}`,
    "",
    "## Subsystems",
  ];

  for (const sub of report.subsystems) {
    lines.push(`### ${sub.name} — ${sub.score}/100 (${sub.status})`);
    if (sub.issues.length > 0) {
      for (const issue of sub.issues) {
        lines.push(`- ${issue}`);
      }
    } else {
      lines.push("- No issues detected");
    }
  }

  if (report.hypotheses.length > 0) {
    lines.push("", "## Improvement Hypotheses");
    for (const h of report.hypotheses) {
      lines.push(`- **[P${h.priority}]** ${h.subsystem}: ${h.hypothesis}`);
    }
  }

  return lines.join("\n");
}
