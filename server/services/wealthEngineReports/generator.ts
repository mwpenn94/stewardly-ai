/**
 * WealthBridge wealth-engine report generator — Phase 5A orchestrator.
 *
 * Entry point that:
 *  1. Loads the underlying engine outputs (HE projection, BIE biz years,
 *     comparison + winners) — passed in by the caller
 *  2. Picks the right template (1 of 4) based on `template` field
 *  3. Builds the ReportSection[] via the templates module
 *  4. Hands off to the existing pdfGenerator.generateFinancialReport()
 *  5. Returns the resulting Buffer (or persists to generatedDocuments)
 *
 * The 4 templates intentionally reuse the same downstream PDF renderer
 * so the visual style is consistent and we don't have a parallel PDF
 * stack to maintain.
 */

import { generateFinancialReport, type PDFReportInput } from "../pdfGenerator";
import {
  buildExecutiveSummary,
  buildCompletePlan,
  buildPracticeGrowthPlan,
  buildProspectPreview,
  withDefaults,
  type WealthReportTemplate,
  type ExecutiveSummaryInput,
  type CompletePlanInput,
  type PracticeGrowthInput,
  type ProspectPreviewInput,
} from "./templates";
import { METHODOLOGY_DISCLOSURE } from "../../shared/calculators";

export interface GenerateReportOptions {
  template: WealthReportTemplate;
  clientName: string;
  advisorName?: string;
  firmName?: string;
  payload:
    | { kind: "executive_summary"; input: ExecutiveSummaryInput }
    | { kind: "complete_plan"; input: CompletePlanInput }
    | { kind: "practice_growth"; input: PracticeGrowthInput }
    | { kind: "prospect_preview"; input: ProspectPreviewInput };
}

export async function generateWealthEngineReport(
  opts: GenerateReportOptions,
): Promise<Buffer> {
  const sections = (() => {
    switch (opts.payload.kind) {
      case "executive_summary":
        return buildExecutiveSummary(opts.payload.input);
      case "complete_plan":
        return buildCompletePlan(opts.payload.input);
      case "practice_growth":
        return buildPracticeGrowthPlan(opts.payload.input);
      case "prospect_preview":
        return buildProspectPreview(opts.payload.input);
    }
  })();

  const pdfInput: PDFReportInput = {
    clientName: opts.clientName,
    advisorName: opts.advisorName,
    firmName: opts.firmName ?? "WealthBridge",
    generatedAt: new Date(),
    sections: withDefaults(sections),
    disclaimer: METHODOLOGY_DISCLOSURE.disclaimer,
  };

  return generateFinancialReport(pdfInput);
}

// ─── Helper: derive a sensible filename ──────────────────────────────────
export function reportFilename(
  template: WealthReportTemplate,
  clientName: string,
): string {
  const safe = clientName.replace(/[^a-zA-Z0-9-]+/g, "_").toLowerCase();
  const ts = new Date().toISOString().slice(0, 10);
  return `${safe}_${template}_${ts}.pdf`;
}
