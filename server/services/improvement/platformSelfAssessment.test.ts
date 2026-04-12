/**
 * Tests for platformSelfAssessment — continuous improvement self-assessment engine.
 */
import { describe, it, expect } from "vitest";
import {
  assessChatHealth,
  assessLearningHealth,
  assessCalculatorHealth,
  assessAgentHealth,
  composeHealthReport,
  formatReportMarkdown,
  type ChatHealthInput,
  type LearningHealthInput,
  type CalculatorHealthInput,
  type AgentHealthInput,
} from "./platformSelfAssessment";

// ─── Chat Health ───────────────────────────────────────────────────

describe("assessChatHealth", () => {
  const healthy: ChatHealthInput = {
    totalConversations: 500,
    avgResponseTimeMs: 3000,
    errorRate: 0.005,
    avgUserRating: 4.2,
    activeUsers24h: 15,
  };

  it("scores healthy system at 100", () => {
    const result = assessChatHealth(healthy);
    expect(result.status).toBe("healthy");
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it("degrades score for high error rate", () => {
    const result = assessChatHealth({ ...healthy, errorRate: 0.08 });
    expect(result.score).toBeLessThan(80);
    expect(result.issues.some((i) => i.includes("error rate"))).toBe(true);
  });

  it("degrades score for slow responses", () => {
    const result = assessChatHealth({ ...healthy, avgResponseTimeMs: 12000 });
    expect(result.score).toBeLessThan(80);
    expect(result.issues.some((i) => i.includes("Slow"))).toBe(true);
  });

  it("degrades score for low satisfaction", () => {
    const result = assessChatHealth({ ...healthy, avgUserRating: 2.5 });
    expect(result.score).toBeLessThanOrEqual(80);
    expect(result.issues.some((i) => i.includes("satisfaction"))).toBe(true);
  });

  it("degrades score for no active users", () => {
    const result = assessChatHealth({ ...healthy, activeUsers24h: 0 });
    expect(result.score).toBeLessThan(100);
    expect(result.issues.some((i) => i.includes("No active users"))).toBe(true);
  });

  it("accumulates multiple issues", () => {
    const result = assessChatHealth({
      ...healthy,
      errorRate: 0.1,
      avgResponseTimeMs: 15000,
      avgUserRating: 2.0,
    });
    expect(result.issues.length).toBeGreaterThanOrEqual(3);
    expect(result.status).toBe("critical");
  });
});

// ─── Learning Health ───────────────────────────────────────────────

describe("assessLearningHealth", () => {
  const healthy: LearningHealthInput = {
    totalTracks: 12,
    tracksWithContent: 10,
    avgMasteryScore: 3.5,
    activeLearners7d: 8,
    questionsAnswered7d: 150,
    dueReviewCount: 20,
  };

  it("scores healthy learning at 100", () => {
    const result = assessLearningHealth(healthy);
    expect(result.status).toBe("healthy");
    expect(result.score).toBe(100);
  });

  it("degrades for low content coverage", () => {
    const result = assessLearningHealth({ ...healthy, tracksWithContent: 3 });
    expect(result.issues.some((i) => i.includes("content coverage"))).toBe(true);
  });

  it("degrades for high overdue reviews", () => {
    const result = assessLearningHealth({ ...healthy, dueReviewCount: 200 });
    expect(result.issues.some((i) => i.includes("overdue"))).toBe(true);
  });

  it("degrades for zero learners", () => {
    const result = assessLearningHealth({ ...healthy, activeLearners7d: 0 });
    expect(result.issues.some((i) => i.includes("No active learners"))).toBe(true);
  });
});

// ─── Calculator Health ─────────────────────────────────────────────

describe("assessCalculatorHealth", () => {
  const healthy: CalculatorHealthInput = {
    totalCalculations7d: 50,
    uniqueCalculatorTypes: 5,
    avgCalculationTimeMs: 500,
    errorCount7d: 0,
  };

  it("scores healthy calculators at 100", () => {
    const result = assessCalculatorHealth(healthy);
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it("degrades for high error count", () => {
    const result = assessCalculatorHealth({ ...healthy, errorCount7d: 15 });
    expect(result.issues.some((i) => i.includes("errors"))).toBe(true);
  });

  it("degrades for low type diversity", () => {
    const result = assessCalculatorHealth({ ...healthy, uniqueCalculatorTypes: 1 });
    expect(result.issues.some((i) => i.includes("diversity"))).toBe(true);
  });

  it("degrades for zero calculations", () => {
    const result = assessCalculatorHealth({ ...healthy, totalCalculations7d: 0 });
    expect(result.issues.some((i) => i.includes("No calculations"))).toBe(true);
  });
});

// ─── Agent Health ──────────────────────────────────────────────────

describe("assessAgentHealth", () => {
  const healthy: AgentHealthInput = {
    totalAgentRuns7d: 20,
    successRate: 0.9,
    avgCostPerRun: 0.5,
    activeAgents: 3,
    totalAgents: 5,
  };

  it("scores healthy agents at 100", () => {
    const result = assessAgentHealth(healthy);
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it("degrades for low success rate", () => {
    const result = assessAgentHealth({ ...healthy, successRate: 0.5 });
    expect(result.issues.some((i) => i.includes("success rate"))).toBe(true);
  });

  it("degrades for high cost", () => {
    const result = assessAgentHealth({ ...healthy, avgCostPerRun: 3.5 });
    expect(result.issues.some((i) => i.includes("cost"))).toBe(true);
  });

  it("degrades for no active agents", () => {
    const result = assessAgentHealth({ ...healthy, activeAgents: 0 });
    expect(result.issues.some((i) => i.includes("No active agents"))).toBe(true);
  });
});

// ─── Report Composition ────────────────────────────────────────────

describe("composeHealthReport", () => {
  it("produces a healthy report when all subsystems are healthy", () => {
    const subsystems = [
      assessChatHealth({ totalConversations: 100, avgResponseTimeMs: 2000, errorRate: 0.001, avgUserRating: 4.5, activeUsers24h: 10 }),
      assessLearningHealth({ totalTracks: 12, tracksWithContent: 12, avgMasteryScore: 4.0, activeLearners7d: 5, questionsAnswered7d: 100, dueReviewCount: 10 }),
      assessCalculatorHealth({ totalCalculations7d: 50, uniqueCalculatorTypes: 6, avgCalculationTimeMs: 300, errorCount7d: 0 }),
      assessAgentHealth({ totalAgentRuns7d: 15, successRate: 0.95, avgCostPerRun: 0.3, activeAgents: 3, totalAgents: 5 }),
    ];
    const report = composeHealthReport(subsystems);
    expect(report.overallScore).toBe(100);
    expect(report.overallStatus).toBe("healthy");
    expect(report.hypotheses).toHaveLength(0);
    expect(report.summary).toContain("EXCELLENT");
  });

  it("degrades when one subsystem has issues", () => {
    const subsystems = [
      assessChatHealth({ totalConversations: 100, avgResponseTimeMs: 15000, errorRate: 0.1, avgUserRating: 2.0, activeUsers24h: 0 }),
      assessLearningHealth({ totalTracks: 12, tracksWithContent: 12, avgMasteryScore: 4.0, activeLearners7d: 5, questionsAnswered7d: 100, dueReviewCount: 10 }),
      assessCalculatorHealth({ totalCalculations7d: 50, uniqueCalculatorTypes: 6, avgCalculationTimeMs: 300, errorCount7d: 0 }),
      assessAgentHealth({ totalAgentRuns7d: 15, successRate: 0.95, avgCostPerRun: 0.3, activeAgents: 3, totalAgents: 5 }),
    ];
    const report = composeHealthReport(subsystems);
    expect(report.overallScore).toBeLessThan(80);
    expect(report.hypotheses.length).toBeGreaterThan(0);
    expect(report.summary).toContain("issue");
  });

  it("generates hypotheses sorted by priority", () => {
    const subsystems = [
      assessChatHealth({ totalConversations: 100, avgResponseTimeMs: 15000, errorRate: 0.1, avgUserRating: 2.0, activeUsers24h: 0 }),
    ];
    const report = composeHealthReport(subsystems);
    const priorities = report.hypotheses.map((h) => h.priority);
    for (let i = 1; i < priorities.length; i++) {
      expect(priorities[i]).toBeLessThanOrEqual(priorities[i - 1]);
    }
  });

  it("handles empty subsystems array", () => {
    const report = composeHealthReport([]);
    expect(report.overallScore).toBe(0);
    expect(report.hypotheses).toHaveLength(0);
  });
});

// ─── Markdown Formatter ────────────────────────────────────────────

describe("formatReportMarkdown", () => {
  it("produces readable markdown", () => {
    const subsystems = [
      assessChatHealth({ totalConversations: 100, avgResponseTimeMs: 12000, errorRate: 0.08, avgUserRating: 4.0, activeUsers24h: 5 }),
    ];
    const report = composeHealthReport(subsystems);
    const md = formatReportMarkdown(report);
    expect(md).toContain("# Platform Health Report");
    expect(md).toContain("## Subsystems");
    expect(md).toContain("ai_chat");
    expect(md).toContain("## Improvement Hypotheses");
  });

  it("shows 'No issues' for healthy subsystem", () => {
    const subsystems = [
      assessChatHealth({ totalConversations: 100, avgResponseTimeMs: 2000, errorRate: 0.001, avgUserRating: 4.5, activeUsers24h: 10 }),
    ];
    const report = composeHealthReport(subsystems);
    const md = formatReportMarkdown(report);
    expect(md).toContain("No issues detected");
  });
});
