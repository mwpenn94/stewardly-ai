import { getDb } from "../db";
const RULES = [
  { ruleType: "tcpa" as const, ruleName: "TCPA Express Written Consent", description: "No auto-text/call without express written consent. Opt-out must be processed immediately.", enabled: true },
  { ruleType: "can_spam" as const, ruleName: "CAN-SPAM Compliance", description: "Unchecked consent checkbox, one-click unsubscribe, physical address in footer, honor opt-out within 10 days.", enabled: true },
  { ruleType: "finra" as const, ruleName: "FINRA 2210 Communications", description: "All AI-generated content must include required disclaimers. Archive all communications for 3 years.", enabled: true },
  { ruleType: "finra" as const, ruleName: "FINRA 2040 Supervision", description: "AI recommendations require supervisory review for suitability.", enabled: true },
  { ruleType: "finra" as const, ruleName: "FINRA 3110 Supervisory Systems", description: "Written procedures for supervising AI-generated advice.", enabled: true },
  { ruleType: "sec" as const, ruleName: "SEC Reg BI Best Interest", description: "Recommendations must be in client's best interest with suitability disclosure.", enabled: true },
  { ruleType: "sec" as const, ruleName: "SEC Marketing Rule", description: "AI-generated marketing must comply with anti-fraud provisions and substantiation requirements.", enabled: true },
  { ruleType: "ccpa" as const, ruleName: "CCPA/AZ Privacy", description: "Process PII deletion requests within 45 days. Right to know, delete, opt-out of sale.", enabled: true },
  { ruleType: "fcra" as const, ruleName: "FCRA Permissible Purpose", description: "Credit data only used for permissible purposes. Adverse action notices required.", enabled: true },
  { ruleType: "aml" as const, ruleName: "AML Red Flags", description: "Monitor for suspicious transaction patterns, structuring, unusual account activity.", enabled: true },
  { ruleType: "state" as const, ruleName: "AZ DOI Regulations", description: "Arizona Department of Insurance requirements for insurance recommendations.", enabled: true },
];
export async function seed() {
  const db = await getDb(); if (!db) { console.log("No DB — skipping"); return; }
  const { complianceRules } = await import("../../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  let inserted = 0;
  for (const r of RULES) {
    const [exists] = await db.select().from(complianceRules).where(eq(complianceRules.ruleName, r.ruleName)).limit(1);
    if (exists) continue;
    await db.insert(complianceRules).values(r); inserted++;
  }
  console.log(`[seed:16] Compliance rules: ${inserted} inserted`);
}
if (import.meta.url === `file://${process.argv[1]}`) seed();
