import { getDb } from "../db";
const CONFIGS = [
  { calculatorType: "premium_finance", gateType: "advisor_match" as const, valueProposition: "Get a personalized premium finance analysis with current SOFR rates from a licensed specialist." },
  { calculatorType: "ilit_dynasty", gateType: "advisor_match" as const, valueProposition: "Connect with an estate planning specialist for your ILIT/Dynasty trust analysis." },
  { calculatorType: "protection_backplan", gateType: "advisor_match" as const, valueProposition: "Get matched with a protection specialist to close your coverage gaps." },
  { calculatorType: "exec_comp", gateType: "advisor_match" as const, valueProposition: "Executive compensation strategies require specialized guidance. Connect with our team." },
  { calculatorType: "iul", gateType: "personalized_analysis" as const, valueProposition: "Get a personalized IUL analysis comparing carriers and crediting strategies." },
  { calculatorType: "retirement_backplan", gateType: "personalized_analysis" as const, valueProposition: "See your personalized retirement gap analysis with specific action steps." },
  { calculatorType: "estate_backplan", gateType: "personalized_analysis" as const, valueProposition: "Get your estate tax exposure analysis with specific reduction strategies." },
  { calculatorType: "growth_backplan", gateType: "personalized_analysis" as const, valueProposition: "See your personalized investment growth projection with contribution recommendations." },
  { calculatorType: "crt_daf_combo", gateType: "full_report_pdf" as const, valueProposition: "Download your complete charitable giving + estate planning report." },
  { calculatorType: "holistic_summary", gateType: "full_report_pdf" as const, valueProposition: "Download your complete Holistic Financial Scorecard with action plan." },
  { calculatorType: "tax_backplan", gateType: "save_and_compare" as const, valueProposition: "Save your tax optimization analysis to compare strategies." },
  { calculatorType: "cash_flow_backplan", gateType: "save_and_compare" as const, valueProposition: "Save your cash flow analysis to track progress." },
  { calculatorType: "education_backplan", gateType: "save_and_compare" as const, valueProposition: "Save your education funding plan to monitor your 529 progress." },
  { calculatorType: "protection_score", gateType: "personalized_analysis" as const, valueProposition: "Get your detailed Financial Protection Score with personalized recommendations." },
  { calculatorType: "retirement", gateType: "results_summary" as const, valueProposition: "See your retirement readiness summary." },
  { calculatorType: "term_quote", gateType: "results_summary" as const, valueProposition: "View your estimated term life insurance quotes." },
];
export async function seed() {
  const db = await getDb(); if (!db) { console.log("[seed:17] No DB — skipping"); return; }
  const { leadCaptureConfig } = await import("../../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  let inserted = 0;
  for (const c of CONFIGS) {
    const [exists] = await db.select().from(leadCaptureConfig).where(eq(leadCaptureConfig.calculatorType, c.calculatorType)).limit(1);
    if (exists) continue;
    await db.insert(leadCaptureConfig).values(c); inserted++;
  }
  console.log(`[seed:17] Lead capture configs: ${inserted} inserted`);
}
if (import.meta.url === `file://${process.argv[1]}`) seed();
