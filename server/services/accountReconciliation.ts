/**
 * Task #52 — Account Reconciliation Service
 * Cross-reference financial data across sources for consistency
 */

export interface ReconciliationResult {
  sourceA: string;
  sourceB: string;
  field: string;
  valueA: any;
  valueB: any;
  status: "match" | "mismatch" | "missing_a" | "missing_b";
  severity: "info" | "warning" | "critical";
  resolution?: string;
}

export interface ReconciliationReport {
  id: string;
  userId: number;
  runAt: string;
  totalChecks: number;
  matches: number;
  mismatches: number;
  missing: number;
  results: ReconciliationResult[];
  overallStatus: "clean" | "warnings" | "action_required";
}

export function reconcileAccounts(userId: number, profileData: Record<string, any>, externalData: Record<string, any>, source = "external"): ReconciliationReport {
  const results: ReconciliationResult[] = [];
  const allKeys = new Set([...Object.keys(profileData), ...Object.keys(externalData)]);

  for (const key of Array.from(allKeys)) {
    const valA = profileData[key];
    const valB = externalData[key];

    if (valA === undefined && valB !== undefined) {
      results.push({ sourceA: "profile", sourceB: source, field: key, valueA: null, valueB: valB, status: "missing_a", severity: "warning" });
    } else if (valA !== undefined && valB === undefined) {
      results.push({ sourceA: "profile", sourceB: source, field: key, valueA: valA, valueB: null, status: "missing_b", severity: "info" });
    } else if (JSON.stringify(valA) !== JSON.stringify(valB)) {
      const severity = ["balance", "income", "netWorth", "totalAssets"].includes(key) ? "critical" as const : "warning" as const;
      results.push({ sourceA: "profile", sourceB: source, field: key, valueA: valA, valueB: valB, status: "mismatch", severity });
    } else {
      results.push({ sourceA: "profile", sourceB: source, field: key, valueA: valA, valueB: valB, status: "match", severity: "info" });
    }
  }

  const matches = results.filter(r => r.status === "match").length;
  const mismatches = results.filter(r => r.status === "mismatch").length;
  const missing = results.filter(r => r.status.startsWith("missing")).length;
  const hasCritical = results.some(r => r.severity === "critical" && r.status !== "match");

  return {
    id: `recon_${Date.now()}`,
    userId,
    runAt: new Date().toISOString(),
    totalChecks: results.length,
    matches,
    mismatches,
    missing,
    results,
    overallStatus: hasCritical ? "action_required" : mismatches > 0 ? "warnings" : "clean",
  };
}

export function suggestResolutions(report: ReconciliationReport): Array<{ field: string; suggestion: string; confidence: number }> {
  return report.results
    .filter(r => r.status === "mismatch" || r.status.startsWith("missing"))
    .map(r => {
      if (r.status === "missing_a") {
        return { field: r.field, suggestion: `Import ${r.field} from ${r.sourceB}: ${JSON.stringify(r.valueB)}`, confidence: 0.8 };
      }
      if (r.status === "mismatch") {
        return { field: r.field, suggestion: `Review discrepancy: profile=${JSON.stringify(r.valueA)} vs ${r.sourceB}=${JSON.stringify(r.valueB)}`, confidence: 0.6 };
      }
      return { field: r.field, suggestion: `No action needed for ${r.field}`, confidence: 0.9 };
    });
}
