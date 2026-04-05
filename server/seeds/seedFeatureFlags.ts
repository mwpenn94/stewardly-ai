/**
 * Seed: Feature Flags
 * Platform-level feature flags controlling feature availability.
 * Idempotent: checks existing flagKey before insert.
 */
import { getDb } from "../db";
import { featureFlags } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { logger } from "../_core/logger";

const FLAGS = [
  // Core AI Features
  { flagKey: "ai_chat_enabled", label: "AI Chat", description: "Enable AI-powered financial chat assistant" },
  { flagKey: "ai_voice_mode", label: "Voice Mode", description: "Enable voice input/output for AI conversations" },
  { flagKey: "ai_multi_model", label: "Multi-Model Synthesis", description: "Enable querying multiple AI models and synthesizing responses" },
  { flagKey: "ai_consensus_mode", label: "Consensus Mode", description: "Enable consensus-based responses from multiple models" },
  { flagKey: "ai_focus_modes", label: "Focus Modes", description: "Enable specialized focus modes (insurance, tax, estate, etc.)" },
  { flagKey: "ai_proactive_insights", label: "Proactive Insights", description: "Enable AI-generated proactive financial insights" },
  { flagKey: "ai_document_analysis", label: "Document Analysis", description: "Enable AI-powered document upload and analysis" },
  // Calculator Suite
  { flagKey: "calc_protection_score", label: "Protection Score Calculator", description: "Financial protection score assessment tool" },
  { flagKey: "calc_retirement_planner", label: "Retirement Planner", description: "Monte Carlo retirement planning calculator" },
  { flagKey: "calc_iul_comparison", label: "IUL Comparison Tool", description: "IUL vs market investment comparison calculator" },
  { flagKey: "calc_tax_optimizer", label: "Tax Optimization Calculator", description: "Tax bracket and optimization analysis" },
  { flagKey: "calc_estate_planner", label: "Estate Planning Calculator", description: "Estate tax and trust planning calculator" },
  { flagKey: "calc_premium_finance", label: "Premium Finance Calculator", description: "Premium financing eligibility and analysis" },
  { flagKey: "calc_social_security", label: "Social Security Optimizer", description: "SSA claiming strategy optimizer" },
  { flagKey: "calc_roth_conversion", label: "Roth Conversion Analyzer", description: "Roth conversion tax impact analysis" },
  { flagKey: "calc_income_replacement", label: "Income Replacement Calculator", description: "Life insurance needs analysis" },
  // Platform Features
  { flagKey: "digital_twin", label: "Digital Financial Twin", description: "Comprehensive digital financial twin modeling" },
  { flagKey: "advisor_matching", label: "Advisor Matching", description: "AI-powered advisor-client matching system" },
  { flagKey: "community_forums", label: "Community Forums", description: "Professional community discussion forums" },
  { flagKey: "education_hub", label: "Education Hub", description: "Financial education modules and courses" },
  { flagKey: "content_articles", label: "Content Articles", description: "SEO-optimized financial education articles" },
  { flagKey: "referral_tracking", label: "Referral Tracking", description: "Client and professional referral tracking" },
  { flagKey: "embed_widgets", label: "Embeddable Widgets", description: "Calculator widgets for advisor websites" },
  // Professional Features
  { flagKey: "practice_analytics", label: "Practice Analytics", description: "Professional practice management analytics" },
  { flagKey: "client_segmentation", label: "Client Segmentation", description: "AI-powered client tier classification" },
  { flagKey: "pipeline_management", label: "Pipeline Management", description: "Sales pipeline tracking and management" },
  { flagKey: "compliance_screening", label: "Compliance Pre-screening", description: "Automated compliance review of AI responses" },
  { flagKey: "carrier_connections", label: "Carrier Connections", description: "Direct carrier API integrations" },
  { flagKey: "meeting_intelligence", label: "Meeting Intelligence", description: "AI meeting transcription and insights" },
  // Admin Features
  { flagKey: "data_pipelines", label: "Data Pipelines", description: "Automated government data ingestion pipelines" },
  { flagKey: "model_engine", label: "Analytical Model Engine", description: "Scheduled analytical model execution" },
  { flagKey: "lead_import", label: "Lead Import System", description: "Multi-format lead import and enrichment" },
  { flagKey: "integration_hub", label: "Integration Hub", description: "Third-party integration management" },
  { flagKey: "knowledge_base", label: "Knowledge Base Management", description: "AI knowledge base ingestion and management" },
  { flagKey: "fairness_testing", label: "AI Fairness Testing", description: "Demographic fairness testing for AI responses" },
  { flagKey: "usage_budgets", label: "Usage Budgets", description: "AI usage tracking and budget management" },
];

export async function seedFeatureFlags(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  let inserted = 0;
  for (const flag of FLAGS) {
    const existing = await db.select({ id: featureFlags.id })
      .from(featureFlags)
      .where(eq(featureFlags.flagKey, flag.flagKey))
      .limit(1);
    if (existing.length > 0) continue;
    try {
      await db.insert(featureFlags).values({
        flagKey: flag.flagKey,
        label: flag.label,
        description: flag.description,
        enabled: true,
        scope: "platform",
      });
      inserted++;
    } catch (e: any) {
      if (!e?.message?.includes("Duplicate")) {
        logger.error({ operation: "seedFeatureFlags", err: e }, `[SeedFeatureFlags] Error: ${e?.message}`);
      }
    }
  }
  return inserted;
}
