/**
 * Seed: Workflow Event Chains, KB Sharing Defaults, Compensation Brackets,
 *        ZIP Code Demographics (Arizona), Platform Changelog, Usage Budgets
 * Idempotent: checks existing records before insert.
 */
import { getDb } from "../db";
import {
  workflowEventChains, kbSharingDefaults, compensationBrackets,
  zipCodeDemographics, platformChangelog, usageBudgets,
} from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "../_core/logger";

// ─── Workflow Event Chains ──────────────────────────────────────────────────
const WORKFLOWS = [
  {
    name: "New Lead Welcome Sequence",
    eventType: "lead.created",
    actionsJson: JSON.stringify([
      { step: 1, action: "send_email", template: "welcome_lead", delay: 0 },
      { step: 2, action: "assign_advisor", method: "round_robin", delay: 0 },
      { step: 3, action: "create_task", assignee: "advisor", title: "Follow up with new lead", dueHours: 24 },
      { step: 4, action: "send_email", template: "advisor_introduction", delay: 86400 },
      { step: 5, action: "send_email", template: "educational_content", delay: 259200 },
    ]),
  },
  {
    name: "Calculator Completion Follow-up",
    eventType: "calculator.completed",
    actionsJson: JSON.stringify([
      { step: 1, action: "save_results", destination: "lead_profile_accumulator", delay: 0 },
      { step: 2, action: "score_lead", model: "propensity_default", delay: 0 },
      { step: 3, action: "conditional", condition: "score > 70", trueAction: "notify_advisor", falseAction: "add_to_nurture" },
    ]),
  },
  {
    name: "Policy Anniversary Review",
    eventType: "policy.anniversary",
    actionsJson: JSON.stringify([
      { step: 1, action: "generate_review", type: "annual_policy_review", delay: 0 },
      { step: 2, action: "send_notification", channel: "in_app", template: "policy_review_ready", delay: 0 },
      { step: 3, action: "send_email", template: "policy_anniversary", delay: 0 },
      { step: 4, action: "create_task", assignee: "advisor", title: "Annual policy review", dueHours: 168 },
    ]),
  },
  {
    name: "Compliance Alert Escalation",
    eventType: "compliance.flag_raised",
    actionsJson: JSON.stringify([
      { step: 1, action: "notify_compliance_officer", urgency: "high", delay: 0 },
      { step: 2, action: "pause_conversation", reason: "compliance_review", delay: 0 },
      { step: 3, action: "create_audit_entry", type: "compliance_flag", delay: 0 },
      { step: 4, action: "conditional", condition: "severity == critical", trueAction: "notify_admin", falseAction: "await_review" },
    ]),
  },
  {
    name: "Client Onboarding Workflow",
    eventType: "client.onboarded",
    actionsJson: JSON.stringify([
      { step: 1, action: "create_digital_twin", delay: 0 },
      { step: 2, action: "run_protection_score", delay: 0 },
      { step: 3, action: "send_email", template: "onboarding_welcome", delay: 0 },
      { step: 4, action: "schedule_meeting", type: "discovery", delay: 86400 },
      { step: 5, action: "send_email", template: "document_checklist", delay: 172800 },
    ]),
  },
  {
    name: "Regulatory Update Distribution",
    eventType: "regulatory.update_ingested",
    actionsJson: JSON.stringify([
      { step: 1, action: "classify_relevance", model: "regulatory_classifier", delay: 0 },
      { step: 2, action: "conditional", condition: "relevance_score > 0.7", trueAction: "notify_all_advisors", falseAction: "log_only" },
      { step: 3, action: "update_knowledge_base", category: "regulatory", delay: 0 },
    ]),
  },
  {
    name: "Meeting Completed Follow-up",
    eventType: "meeting.completed",
    actionsJson: JSON.stringify([
      { step: 1, action: "generate_summary", source: "transcript", delay: 0 },
      { step: 2, action: "extract_action_items", delay: 0 },
      { step: 3, action: "send_email", template: "meeting_summary", recipients: "attendees", delay: 3600 },
      { step: 4, action: "create_tasks", source: "action_items", delay: 0 },
    ]),
  },
  {
    name: "Data Pipeline Failure Alert",
    eventType: "pipeline.failed",
    actionsJson: JSON.stringify([
      { step: 1, action: "log_health_event", severity: "error", delay: 0 },
      { step: 2, action: "retry_pipeline", maxRetries: 3, backoffMs: 60000, delay: 60 },
      { step: 3, action: "conditional", condition: "retries_exhausted", trueAction: "notify_admin", falseAction: "log_recovery" },
    ]),
  },
];

export async function seedWorkflowEventChains(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  let inserted = 0;
  for (const w of WORKFLOWS) {
    const existing = await db.select({ id: workflowEventChains.id })
      .from(workflowEventChains)
      .where(eq(workflowEventChains.name, w.name))
      .limit(1);
    if (existing.length > 0) continue;
    try {
      await db.insert(workflowEventChains).values({
        name: w.name,
        eventType: w.eventType,
        actionsJson: w.actionsJson,
        isActive: true,
      });
      inserted++;
    } catch (e: any) {
      if (!e?.message?.includes("Duplicate")) logger.error({ operation: "seedWorkflows", err: e }, e?.message);
    }
  }
  return inserted;
}

// ─── KB Sharing Defaults ────────────────────────────────────────────────────
const KB_DEFAULTS: Array<{ relationshipType: string; topic: string; defaultAccessLevel: string; rationale: string }> = [
  { relationshipType: "financial_advisor", topic: "all", defaultAccessLevel: "read", rationale: "Financial advisors need broad read access to provide comprehensive advice across all financial domains." },
  { relationshipType: "insurance_agent", topic: "insurance", defaultAccessLevel: "full", rationale: "Insurance agents need full access to insurance-related knowledge to properly assess coverage needs and recommend products." },
  { relationshipType: "insurance_agent", topic: "health_finance", defaultAccessLevel: "read", rationale: "Health finance knowledge helps insurance agents understand client healthcare cost exposure." },
  { relationshipType: "tax_professional", topic: "tax", defaultAccessLevel: "full", rationale: "Tax professionals need full access to tax knowledge for accurate planning and preparation." },
  { relationshipType: "tax_professional", topic: "retirement", defaultAccessLevel: "read", rationale: "Retirement account knowledge is essential for tax planning around distributions and conversions." },
  { relationshipType: "estate_attorney", topic: "estate", defaultAccessLevel: "full", rationale: "Estate attorneys need full access to estate planning knowledge for comprehensive document preparation." },
  { relationshipType: "estate_attorney", topic: "insurance", defaultAccessLevel: "summary", rationale: "Insurance summary helps estate attorneys understand ILIT and policy ownership structures." },
  { relationshipType: "accountant", topic: "tax", defaultAccessLevel: "full", rationale: "Accountants need full tax knowledge access for accurate financial reporting and planning." },
  { relationshipType: "accountant", topic: "budgeting", defaultAccessLevel: "read", rationale: "Budget data helps accountants understand cash flow patterns for better financial management." },
  { relationshipType: "mortgage_broker", topic: "real_estate", defaultAccessLevel: "full", rationale: "Mortgage brokers need full real estate knowledge for property financing assessments." },
  { relationshipType: "mortgage_broker", topic: "debt", defaultAccessLevel: "read", rationale: "Debt information helps mortgage brokers assess DTI ratios and lending eligibility." },
  { relationshipType: "real_estate_agent", topic: "real_estate", defaultAccessLevel: "read", rationale: "Real estate agents benefit from property and market knowledge for client advisory." },
  { relationshipType: "other", topic: "general", defaultAccessLevel: "summary", rationale: "Other professionals receive summary-level general knowledge by default." },
];

export async function seedKbSharingDefaults(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  let inserted = 0;
  for (const kd of KB_DEFAULTS) {
    const existing = await db.select({ id: kbSharingDefaults.id })
      .from(kbSharingDefaults)
      .where(and(
        eq(kbSharingDefaults.relationshipType, kd.relationshipType as any),
        eq(kbSharingDefaults.topic, kd.topic as any),
      ))
      .limit(1);
    if (existing.length > 0) continue;
    try {
      await db.insert(kbSharingDefaults).values({
        relationshipType: kd.relationshipType as any,
        topic: kd.topic as any,
        defaultAccessLevel: kd.defaultAccessLevel as any,
        rationale: kd.rationale,
      });
      inserted++;
    } catch (e: any) {
      if (!e?.message?.includes("Duplicate")) logger.error({ operation: "seedKbDefaults", err: e }, e?.message);
    }
  }
  return inserted;
}

// ─── Compensation Brackets ──────────────────────────────────────────────────
const COMP_BRACKETS = [
  { bracketName: "New Agent", gdcMin: "0", gdcMax: "50000", commissionRate: "50.00", roleSegment: "entry" },
  { bracketName: "Developing Agent", gdcMin: "50001", gdcMax: "100000", commissionRate: "60.00", roleSegment: "developing" },
  { bracketName: "Established Agent", gdcMin: "100001", gdcMax: "200000", commissionRate: "70.00", roleSegment: "established" },
  { bracketName: "Senior Agent", gdcMin: "200001", gdcMax: "350000", commissionRate: "80.00", roleSegment: "senior" },
  { bracketName: "Top Producer", gdcMin: "350001", gdcMax: "500000", commissionRate: "85.00", roleSegment: "top_producer" },
  { bracketName: "Elite Producer", gdcMin: "500001", gdcMax: "1000000", commissionRate: "90.00", roleSegment: "elite" },
  { bracketName: "Managing General Agent", gdcMin: "1000001", gdcMax: "99999999", commissionRate: "95.00", roleSegment: "mga" },
];

export async function seedCompensationBrackets(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  let inserted = 0;
  for (const cb of COMP_BRACKETS) {
    const existing = await db.select({ id: compensationBrackets.id })
      .from(compensationBrackets)
      .where(eq(compensationBrackets.bracketName, cb.bracketName))
      .limit(1);
    if (existing.length > 0) continue;
    try {
      await db.insert(compensationBrackets).values({
        bracketName: cb.bracketName,
        gdcMin: cb.gdcMin,
        gdcMax: cb.gdcMax,
        commissionRate: cb.commissionRate,
        roleSegment: cb.roleSegment,
        effectiveDate: new Date("2025-01-01"),
      });
      inserted++;
    } catch (e: any) {
      if (!e?.message?.includes("Duplicate")) logger.error({ operation: "seedCompBrackets", err: e }, e?.message);
    }
  }
  return inserted;
}

// ─── Arizona ZIP Code Demographics ──────────────────────────────────────────
// Top 30 Arizona ZIP codes by population/wealth relevance (IRS SOI + Census data)
const AZ_ZIPS = [
  { zip: "85254", city: "Scottsdale", county: "Maricopa", latitude: "33.6117", longitude: "-111.9260", totalPopulation: 42500, medianHouseholdIncome: "112000", medianAge: "45.2", homeownershipRate: "72.5", avgAgi: "145000", pctReturnsOver200k: "28.5", wealthIndex: "8.5" },
  { zip: "85255", city: "Scottsdale", county: "Maricopa", latitude: "33.7294", longitude: "-111.8569", totalPopulation: 38200, medianHouseholdIncome: "142000", medianAge: "48.1", homeownershipRate: "78.3", avgAgi: "195000", pctReturnsOver200k: "38.2", wealthIndex: "9.2" },
  { zip: "85258", city: "Scottsdale", county: "Maricopa", latitude: "33.5585", longitude: "-111.8906", totalPopulation: 29800, medianHouseholdIncome: "98000", medianAge: "52.3", homeownershipRate: "68.1", avgAgi: "125000", pctReturnsOver200k: "22.4", wealthIndex: "7.8" },
  { zip: "85260", city: "Scottsdale", county: "Maricopa", latitude: "33.6308", longitude: "-111.8569", totalPopulation: 45100, medianHouseholdIncome: "108000", medianAge: "43.7", homeownershipRate: "74.2", avgAgi: "138000", pctReturnsOver200k: "25.8", wealthIndex: "8.2" },
  { zip: "85262", city: "Scottsdale", county: "Maricopa", latitude: "33.7500", longitude: "-111.7800", totalPopulation: 18500, medianHouseholdIncome: "165000", medianAge: "55.4", homeownershipRate: "85.1", avgAgi: "225000", pctReturnsOver200k: "42.1", wealthIndex: "9.5" },
  { zip: "85253", city: "Paradise Valley", county: "Maricopa", latitude: "33.5400", longitude: "-111.9400", totalPopulation: 14200, medianHouseholdIncome: "198000", medianAge: "50.8", homeownershipRate: "88.5", avgAgi: "310000", pctReturnsOver200k: "52.3", wealthIndex: "9.8" },
  { zip: "85048", city: "Phoenix (Ahwatukee)", county: "Maricopa", latitude: "33.3100", longitude: "-111.9800", totalPopulation: 52800, medianHouseholdIncome: "95000", medianAge: "38.5", homeownershipRate: "71.8", avgAgi: "118000", pctReturnsOver200k: "18.9", wealthIndex: "7.5" },
  { zip: "85224", city: "Chandler", county: "Maricopa", latitude: "33.3062", longitude: "-111.8413", totalPopulation: 48200, medianHouseholdIncome: "82000", medianAge: "35.2", homeownershipRate: "62.4", avgAgi: "98000", pctReturnsOver200k: "14.2", wealthIndex: "6.8" },
  { zip: "85226", city: "Chandler", county: "Maricopa", latitude: "33.2800", longitude: "-111.8800", totalPopulation: 43500, medianHouseholdIncome: "88000", medianAge: "36.8", homeownershipRate: "65.1", avgAgi: "105000", pctReturnsOver200k: "16.5", wealthIndex: "7.1" },
  { zip: "85249", city: "Chandler", county: "Maricopa", latitude: "33.2300", longitude: "-111.7900", totalPopulation: 35800, medianHouseholdIncome: "115000", medianAge: "37.4", homeownershipRate: "78.9", avgAgi: "142000", pctReturnsOver200k: "26.3", wealthIndex: "8.3" },
  { zip: "85284", city: "Tempe", county: "Maricopa", latitude: "33.3700", longitude: "-111.9100", totalPopulation: 28500, medianHouseholdIncome: "78000", medianAge: "32.1", homeownershipRate: "55.8", avgAgi: "92000", pctReturnsOver200k: "12.8", wealthIndex: "6.5" },
  { zip: "85016", city: "Phoenix (Biltmore)", county: "Maricopa", latitude: "33.5100", longitude: "-112.0200", totalPopulation: 38900, medianHouseholdIncome: "72000", medianAge: "38.9", homeownershipRate: "48.2", avgAgi: "95000", pctReturnsOver200k: "15.8", wealthIndex: "6.9" },
  { zip: "85018", city: "Phoenix (Arcadia)", county: "Maricopa", latitude: "33.5000", longitude: "-111.9800", totalPopulation: 32400, medianHouseholdIncome: "105000", medianAge: "42.3", homeownershipRate: "68.5", avgAgi: "135000", pctReturnsOver200k: "24.1", wealthIndex: "8.0" },
  { zip: "85044", city: "Phoenix", county: "Maricopa", latitude: "33.3300", longitude: "-111.9900", totalPopulation: 55200, medianHouseholdIncome: "85000", medianAge: "36.5", homeownershipRate: "64.3", avgAgi: "102000", pctReturnsOver200k: "15.2", wealthIndex: "7.0" },
  { zip: "85268", city: "Fountain Hills", county: "Maricopa", latitude: "33.6100", longitude: "-111.7300", totalPopulation: 24800, medianHouseholdIncome: "78000", medianAge: "55.8", homeownershipRate: "76.2", avgAgi: "98000", pctReturnsOver200k: "18.5", wealthIndex: "7.4" },
  { zip: "85308", city: "Glendale", county: "Maricopa", latitude: "33.6500", longitude: "-112.1800", totalPopulation: 62500, medianHouseholdIncome: "72000", medianAge: "34.2", homeownershipRate: "68.5", avgAgi: "85000", pctReturnsOver200k: "10.2", wealthIndex: "6.2" },
  { zip: "85142", city: "Queen Creek", county: "Maricopa", latitude: "33.2500", longitude: "-111.6300", totalPopulation: 48500, medianHouseholdIncome: "105000", medianAge: "32.8", homeownershipRate: "82.5", avgAgi: "125000", pctReturnsOver200k: "20.5", wealthIndex: "7.8" },
  { zip: "85286", city: "Chandler", county: "Maricopa", latitude: "33.2600", longitude: "-111.8500", totalPopulation: 38200, medianHouseholdIncome: "92000", medianAge: "35.5", homeownershipRate: "70.2", avgAgi: "110000", pctReturnsOver200k: "17.8", wealthIndex: "7.3" },
  { zip: "85718", city: "Tucson (Catalina Foothills)", county: "Pima", latitude: "32.3400", longitude: "-110.9100", totalPopulation: 28500, medianHouseholdIncome: "95000", medianAge: "48.5", homeownershipRate: "72.8", avgAgi: "128000", pctReturnsOver200k: "22.8", wealthIndex: "7.9" },
  { zip: "85750", city: "Tucson (Sabino Canyon)", county: "Pima", latitude: "32.3100", longitude: "-110.8200", totalPopulation: 22800, medianHouseholdIncome: "88000", medianAge: "50.2", homeownershipRate: "75.5", avgAgi: "115000", pctReturnsOver200k: "19.5", wealthIndex: "7.6" },
  { zip: "86336", city: "Sedona", county: "Yavapai", latitude: "34.8697", longitude: "-111.7610", totalPopulation: 10300, medianHouseholdIncome: "68000", medianAge: "58.5", homeownershipRate: "72.1", avgAgi: "95000", pctReturnsOver200k: "18.2", wealthIndex: "7.3" },
  { zip: "86301", city: "Prescott", county: "Yavapai", latitude: "34.5400", longitude: "-112.4685", totalPopulation: 42500, medianHouseholdIncome: "55000", medianAge: "52.8", homeownershipRate: "62.5", avgAgi: "72000", pctReturnsOver200k: "8.5", wealthIndex: "5.8" },
  { zip: "86004", city: "Flagstaff", county: "Coconino", latitude: "35.1983", longitude: "-111.6513", totalPopulation: 35200, medianHouseholdIncome: "58000", medianAge: "28.5", homeownershipRate: "45.2", avgAgi: "68000", pctReturnsOver200k: "7.8", wealthIndex: "5.5" },
  { zip: "85383", city: "Peoria", county: "Maricopa", latitude: "33.7800", longitude: "-112.2400", totalPopulation: 42800, medianHouseholdIncome: "98000", medianAge: "38.2", homeownershipRate: "78.5", avgAgi: "118000", pctReturnsOver200k: "19.2", wealthIndex: "7.6" },
  { zip: "85395", city: "Goodyear", county: "Maricopa", latitude: "33.4400", longitude: "-112.3600", totalPopulation: 55200, medianHouseholdIncome: "92000", medianAge: "35.8", homeownershipRate: "75.8", avgAgi: "108000", pctReturnsOver200k: "16.8", wealthIndex: "7.2" },
  { zip: "85296", city: "Gilbert", county: "Maricopa", latitude: "33.3100", longitude: "-111.7500", totalPopulation: 48500, medianHouseholdIncome: "105000", medianAge: "34.5", homeownershipRate: "80.2", avgAgi: "128000", pctReturnsOver200k: "22.5", wealthIndex: "8.0" },
  { zip: "85297", city: "Gilbert", county: "Maricopa", latitude: "33.2800", longitude: "-111.7200", totalPopulation: 52800, medianHouseholdIncome: "110000", medianAge: "33.8", homeownershipRate: "82.5", avgAgi: "135000", pctReturnsOver200k: "24.8", wealthIndex: "8.2" },
  { zip: "85298", city: "Gilbert", county: "Maricopa", latitude: "33.2500", longitude: "-111.6800", totalPopulation: 38500, medianHouseholdIncome: "118000", medianAge: "35.2", homeownershipRate: "85.1", avgAgi: "145000", pctReturnsOver200k: "27.5", wealthIndex: "8.5" },
  { zip: "85234", city: "Mesa (Red Mountain)", county: "Maricopa", latitude: "33.4200", longitude: "-111.7200", totalPopulation: 42500, medianHouseholdIncome: "82000", medianAge: "36.8", homeownershipRate: "68.5", avgAgi: "98000", pctReturnsOver200k: "14.5", wealthIndex: "6.8" },
  { zip: "85374", city: "Surprise", county: "Maricopa", latitude: "33.6700", longitude: "-112.3700", totalPopulation: 58500, medianHouseholdIncome: "68000", medianAge: "48.5", homeownershipRate: "72.8", avgAgi: "82000", pctReturnsOver200k: "9.8", wealthIndex: "6.0" },
];

export async function seedZipCodeDemographics(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  let inserted = 0;
  for (const z of AZ_ZIPS) {
    const existing = await db.select({ zip: zipCodeDemographics.zip })
      .from(zipCodeDemographics)
      .where(eq(zipCodeDemographics.zip, z.zip))
      .limit(1);
    if (existing.length > 0) continue;
    try {
      await db.insert(zipCodeDemographics).values({
        zip: z.zip,
        city: z.city,
        county: z.county,
        state: "AZ",
        latitude: z.latitude,
        longitude: z.longitude,
        totalPopulation: z.totalPopulation,
        medianHouseholdIncome: z.medianHouseholdIncome,
        medianAge: z.medianAge,
        homeownershipRate: z.homeownershipRate,
        avgAgi: z.avgAgi,
        pctReturnsOver200k: z.pctReturnsOver200k,
        wealthIndex: z.wealthIndex,
        numReturns: Math.round(z.totalPopulation * 0.42),
      });
      inserted++;
    } catch (e: any) {
      if (!e?.message?.includes("Duplicate")) logger.error({ operation: "seedZipCodes", err: e }, e?.message);
    }
  }
  return inserted;
}

// ─── Platform Changelog ─────────────────────────────────────────────────────
const CHANGELOG_ENTRIES = [
  {
    version: "1.0.0", title: "Platform Launch",
    description: "Initial release of Stewardly AI platform with core financial advisory capabilities, AI chat, and basic calculator suite.",
    featureKeys: ["ai_chat", "protection_score", "retirement_planner"],
    changeType: "new_feature" as const,
    impactedRoles: ["user", "admin", "professional"],
  },
  {
    version: "1.1.0", title: "Intelligence Hub & Multi-Model AI",
    description: "Added multi-model AI synthesis with consensus mode, focus modes for specialized financial domains, and the Intelligence Hub dashboard.",
    featureKeys: ["ai_multi_model", "ai_consensus_mode", "ai_focus_modes", "intelligence_hub"],
    changeType: "new_feature" as const,
    impactedRoles: ["user", "professional"],
  },
  {
    version: "1.2.0", title: "Digital Financial Twin",
    description: "Comprehensive digital financial twin modeling integrating all accounts, insurance policies, tax situations, and goals into a unified view.",
    featureKeys: ["digital_twin", "net_worth_tracking", "cash_flow_analysis"],
    changeType: "new_feature" as const,
    impactedRoles: ["user"],
  },
  {
    version: "1.3.0", title: "Calculator Suite Expansion",
    description: "Added IUL comparison, tax optimizer, estate planner, premium finance, Social Security optimizer, and Roth conversion calculators.",
    featureKeys: ["calc_iul_comparison", "calc_tax_optimizer", "calc_estate_planner", "calc_premium_finance", "calc_social_security", "calc_roth_conversion"],
    changeType: "new_feature" as const,
    impactedRoles: ["user", "professional"],
  },
  {
    version: "1.4.0", title: "Professional Practice Management",
    description: "Practice analytics, client segmentation, pipeline management, and production tracking for financial professionals.",
    featureKeys: ["practice_analytics", "client_segmentation", "pipeline_management"],
    changeType: "new_feature" as const,
    impactedRoles: ["professional", "admin"],
  },
  {
    version: "1.5.0", title: "Voice Mode & Meeting Intelligence",
    description: "Added voice input/output for AI conversations and AI-powered meeting transcription with action item extraction.",
    featureKeys: ["ai_voice_mode", "meeting_intelligence"],
    changeType: "new_feature" as const,
    impactedRoles: ["user", "professional"],
  },
  {
    version: "1.6.0", title: "Integration Hub & Data Pipelines",
    description: "20+ third-party integrations, automated government data pipelines (BLS, FRED, Census, SEC EDGAR), and carrier connections.",
    featureKeys: ["integration_hub", "data_pipelines", "carrier_connections"],
    changeType: "new_feature" as const,
    impactedRoles: ["admin"],
  },
  {
    version: "1.7.0", title: "Education Hub & Content Articles",
    description: "Financial education modules, SEO-optimized content articles, and glossary of financial terms.",
    featureKeys: ["education_hub", "content_articles", "glossary"],
    changeType: "new_feature" as const,
    impactedRoles: ["user"],
  },
  {
    version: "1.8.0", title: "Compliance & Fairness Framework",
    description: "Automated compliance pre-screening, AI fairness testing across demographics, and disclaimer management system.",
    featureKeys: ["compliance_screening", "fairness_testing", "disclaimers"],
    changeType: "new_feature" as const,
    impactedRoles: ["admin", "professional"],
  },
  {
    version: "1.9.0", title: "Community & Referral System",
    description: "Professional community forums, embeddable calculator widgets, and comprehensive referral tracking system.",
    featureKeys: ["community_forums", "embed_widgets", "referral_tracking"],
    changeType: "new_feature" as const,
    impactedRoles: ["user", "professional"],
  },
];

export async function seedPlatformChangelog(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  let inserted = 0;
  for (const cl of CHANGELOG_ENTRIES) {
    const existing = await db.select({ id: platformChangelog.id })
      .from(platformChangelog)
      .where(eq(platformChangelog.version, cl.version))
      .limit(1);
    if (existing.length > 0) continue;
    try {
      await db.insert(platformChangelog).values({
        version: cl.version,
        title: cl.title,
        description: cl.description,
        featureKeys: JSON.stringify(cl.featureKeys),
        changeType: cl.changeType,
        impactedRoles: JSON.stringify(cl.impactedRoles),
      });
      inserted++;
    } catch (e: any) {
      if (!e?.message?.includes("Duplicate")) logger.error({ operation: "seedChangelog", err: e }, e?.message);
    }
  }
  return inserted;
}

// ─── Usage Budgets (Platform-level defaults) ────────────────────────────────
export async function seedUsageBudgets(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  // Seed platform-level default budget (scopeId=0 for platform)
  const existing = await db.select({ id: usageBudgets.id })
    .from(usageBudgets)
    .where(and(
      eq(usageBudgets.scopeType, "platform"),
      eq(usageBudgets.scopeId, 0),
    ))
    .limit(1);
  if (existing.length > 0) return 0;
  try {
    await db.insert(usageBudgets).values({
      scopeType: "platform",
      scopeId: 0,
      dailyQueryLimit: 500,
      monthlyQueryLimit: 10000,
      monthlyCostCeiling: "100.00",
      alertThresholdPct: 80,
    });
    return 1;
  } catch (e: any) {
    if (!e?.message?.includes("Duplicate")) logger.error({ operation: "seedUsageBudgets", err: e }, e?.message);
    return 0;
  }
}
