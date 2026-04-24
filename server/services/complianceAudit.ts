/**
 * Compliance Audit Engine
 * ========================
 * GAP-08: Compliance audit cadence (daily 1-2 random sample, monthly 20-message audit)
 * GAP-15: ESI pre-approval ID tracking (AntiRebateLanguageVerified, ESIPreApprovalID, ESIPreApprovalExpiry)
 * 
 * Implements proactive compliance monitoring per v10 spec:
 *   - Daily random-sample audit of 1-2 sent messages
 *   - Monthly full audit of 20 messages
 *   - Pass / Conditional Pass / Fail grading
 *   - Audit log with full trail
 */
import { runComplianceChecks, type ComplianceCheck } from "./cadenceTouchDrafting";
import { logger } from "../_core/logger";
const log = logger.child({ module: "complianceAudit" });

// ─── Types ───────────────────────────────────────────────────────────────

export type AuditGrade = "Pass" | "Conditional Pass" | "Fail";

export interface AuditResult {
  auditId: string;
  messageId: string;
  auditType: "daily_random" | "monthly_full" | "ad_hoc";
  timestamp: number;
  grade: AuditGrade;
  complianceCheck: ComplianceCheck;
  findings: string[];
  remediation: string[];
  auditorNotes: string;
}

export interface AuditSummary {
  period: string; // "2026-04" format
  totalAudited: number;
  passCount: number;
  conditionalPassCount: number;
  failCount: number;
  passRate: number; // 0-1
  topFindings: string[];
  overallGrade: AuditGrade;
}

export interface EsiTracking {
  esiPreApprovalId: string;
  esiPreApprovalExpiry: number; // unix ms
  antiRebateLanguageVerified: boolean;
  lastVerifiedAt: number;
  verifiedBy: string; // user who verified
}

// ─── Audit Functions ─────────────────────────────────────────────────────

/**
 * Audit a single sent message for compliance.
 */
export function auditMessage(params: {
  messageId: string;
  body: string;
  channel: string;
  esiPreApprovalId: string;
  tcpaConsentVerified?: boolean;
  auditType: AuditResult["auditType"];
}): AuditResult {
  try {
    if (!params.messageId) throw new Error("messageId is required for audit");
    if (!params.body) throw new Error("message body is required for audit");
    if (!params.channel) throw new Error("channel is required for audit");

    const complianceCheck = runComplianceChecks(
      params.body,
      params.channel,
      params.esiPreApprovalId,
      params.tcpaConsentVerified ?? false
    );

    const findings: string[] = [];
    const remediation: string[] = [];

    if (!complianceCheck.esiPreApprovalVerified) {
      findings.push("ESI pre-approval ID missing or invalid");
      remediation.push("Obtain valid ESI pre-approval before next send");
    }
    if (complianceCheck.performanceProjectionsPresent) {
      findings.push("Performance projections detected in message body");
      remediation.push("Remove all performance projections — FINRA 2210 violation");
    }
    if (complianceCheck.forwardLookingClaimsPresent) {
      findings.push("Forward-looking claims detected");
      remediation.push("Remove forward-looking claims — SEC Marketing Rule violation");
    }
    if (complianceCheck.antiRebateLanguageRequired && !complianceCheck.antiRebateLanguagePresent) {
      findings.push("Anti-rebate language required but missing");
      remediation.push("Add ARS § 20-451 disclosure before next send");
    }
    if (!complianceCheck.tcpaConsentVerified && (params.channel === "phone" || params.channel === "sms")) {
      findings.push("TCPA consent not verified for phone/SMS");
      remediation.push("Verify TCPA consent before phone/SMS outreach");
    }

    // Check for unresolved template variables
    const unresolvedVars = params.body.match(/\{\{[^}]+\}\}/g);
    if (unresolvedVars) {
      findings.push(`Unresolved template variables: ${unresolvedVars.join(", ")}`);
      remediation.push("Resolve all template variables before sending");
    }

    // Check for prohibited content patterns
    const prohibitedPatterns = [
      { pattern: /\b(?:guarantee|guaranteed)\b/i, finding: "Guarantee language detected" },
      { pattern: /\b(?:risk[- ]?free|no[- ]?risk)\b/i, finding: "Risk-free language detected" },
      { pattern: /\b(?:best|top|#1|number one)\s+(?:advisor|firm|company|practice)/i, finding: "Superlative claims about firm detected" },
    ];
    for (const { pattern, finding } of prohibitedPatterns) {
      if (pattern.test(params.body)) {
        findings.push(finding);
        remediation.push(`Remove prohibited language: ${finding}`);
      }
    }

    // Grade assignment
    let grade: AuditGrade;
    if (findings.length === 0) {
      grade = "Pass";
    } else if (findings.every(f => f.includes("template variables") || f.includes("Anti-rebate"))) {
      grade = "Conditional Pass";
    } else {
      grade = "Fail";
    }

    const auditId = `AUDIT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    log.info("Audit %s: grade=%s findings=%d", auditId, grade, findings.length);

    return {
      auditId,
      messageId: params.messageId,
      auditType: params.auditType,
      timestamp: Date.now(),
      grade,
      complianceCheck,
      findings,
      remediation,
      auditorNotes: findings.length === 0
        ? "Message passes all compliance checks."
        : `${findings.length} finding(s) detected. ${grade === "Fail" ? "BLOCKED — do not send." : "Review and remediate before next send."}`,
    };
  } catch (error) {
    log.error("Audit failed for message %s: %s", params.messageId, error);
    return {
      auditId: `AUDIT-ERR-${Date.now()}`,
      messageId: params.messageId,
      auditType: params.auditType,
      timestamp: Date.now(),
      grade: "Fail",
      complianceCheck: {
        esiPreApprovalVerified: false,
        performanceProjectionsPresent: false,
        forwardLookingClaimsPresent: false,
        antiRebateLanguageRequired: false,
        antiRebateLanguagePresent: false,
        tcpaConsentVerified: false,
      },
      findings: [`Audit engine error: ${error instanceof Error ? error.message : "Unknown error"}`],
      remediation: ["Manual compliance review required — audit engine encountered an error"],
      auditorNotes: "SYSTEM ERROR — manual review required before sending.",
    };
  }
}

/**
 * Select random messages for daily audit.
 * Returns indices of messages to audit (1-2 per day).
 */
export function selectDailyAuditSample(totalSentToday: number): number[] {
  try {
    if (typeof totalSentToday !== "number" || totalSentToday < 0) return [];
    if (totalSentToday === 0) return [];
    if (totalSentToday <= 2) return Array.from({ length: totalSentToday }, (_, i) => i);
    // Select 1-2 random indices
    const count = totalSentToday > 10 ? 2 : 1;
    const indices = new Set<number>();
    while (indices.size < count) {
      indices.add(Math.floor(Math.random() * totalSentToday));
    }
    return Array.from(indices);
  } catch (error) {
    log.error("selectDailyAuditSample failed: %s", error);
    return [0]; // Fallback: audit the first message
  }
}

/**
 * Generate monthly audit summary from individual audit results.
 */
export function generateMonthlySummary(audits: AuditResult[]): AuditSummary {
  try {
    if (!Array.isArray(audits) || audits.length === 0) {
      const now = new Date();
      return {
        period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
        totalAudited: 0,
        passCount: 0,
        conditionalPassCount: 0,
        failCount: 0,
        passRate: 1,
        topFindings: [],
        overallGrade: "Pass",
      };
    }

    const passCount = audits.filter(a => a.grade === "Pass").length;
    const conditionalPassCount = audits.filter(a => a.grade === "Conditional Pass").length;
    const failCount = audits.filter(a => a.grade === "Fail").length;
    const passRate = audits.length > 0 ? (passCount + conditionalPassCount * 0.5) / audits.length : 1;

    // Aggregate top findings
    const findingCounts = new Map<string, number>();
    for (const audit of audits) {
      for (const finding of audit.findings) {
        findingCounts.set(finding, (findingCounts.get(finding) || 0) + 1);
      }
    }
    const topFindings = Array.from(findingCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([finding, count]) => `${finding} (${count}×)`);

    let overallGrade: AuditGrade;
    if (passRate >= 0.95) overallGrade = "Pass";
    else if (passRate >= 0.80) overallGrade = "Conditional Pass";
    else overallGrade = "Fail";

    const now = new Date();
    return {
      period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      totalAudited: audits.length,
      passCount,
      conditionalPassCount,
      failCount,
      passRate,
      topFindings,
      overallGrade,
    };
  } catch (error) {
    log.error("generateMonthlySummary failed: %s", error);
    const now = new Date();
    return {
      period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      totalAudited: audits?.length ?? 0,
      passCount: 0,
      conditionalPassCount: 0,
      failCount: 0,
      passRate: 0,
      topFindings: ["Summary generation error — manual review required"],
      overallGrade: "Fail",
    };
  }
}

/**
 * Validate ESI pre-approval tracking data.
 */
export function validateEsiTracking(tracking: EsiTracking): {
  valid: boolean;
  issues: string[];
} {
  try {
    if (!tracking) return { valid: false, issues: ["No ESI tracking data provided"] };

    const issues: string[] = [];
    if (!tracking.esiPreApprovalId || tracking.esiPreApprovalId.startsWith("{{")) {
      issues.push("ESI pre-approval ID is missing or placeholder");
    }
    if (tracking.esiPreApprovalExpiry < Date.now()) {
      issues.push("ESI pre-approval has expired");
    }
    if (!tracking.antiRebateLanguageVerified) {
      issues.push("Anti-rebate language not verified");
    }
    // Check if verification is stale (>90 days)
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;
    if (Date.now() - tracking.lastVerifiedAt > ninetyDays) {
      issues.push("ESI verification is stale (>90 days) — re-verification required");
    }
    return { valid: issues.length === 0, issues };
  } catch (error) {
    log.error("validateEsiTracking failed: %s", error);
    return { valid: false, issues: [`Validation error: ${error instanceof Error ? error.message : "Unknown"}`] };
  }
}
