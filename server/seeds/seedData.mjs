/**
 * Seed data for integration providers, carrier import templates,
 * analytical models, and model schedules.
 * Run: node server/seeds/seedData.mjs
 */
import { randomUUID } from "crypto";

// ─── 20 Integration Providers ────────────────────────────────────────────────
export const integrationProviders = [
  {
    id: randomUUID(), slug: "salesforce-crm", name: "Salesforce CRM",
    description: "Enterprise CRM for client relationship management, pipeline tracking, and activity logging.",
    category: "crm", ownershipTier: "organization", authMethod: "oauth2",
    baseUrl: "https://login.salesforce.com", docsUrl: "https://developer.salesforce.com/docs",
    signupUrl: "https://www.salesforce.com/form/signup/freetrial-sales/",
    freeTierDescription: "30-day free trial with full feature access", freeTierLimit: "30 days",
    logoUrl: null, isActive: true
  },
  {
    id: randomUUID(), slug: "hubspot-crm", name: "HubSpot CRM",
    description: "Free CRM with contact management, deal tracking, and email integration.",
    category: "crm", ownershipTier: "organization", authMethod: "oauth2",
    baseUrl: "https://api.hubapi.com", docsUrl: "https://developers.hubspot.com/docs",
    signupUrl: "https://www.hubspot.com/products/crm",
    freeTierDescription: "Free tier with unlimited contacts and basic CRM features", freeTierLimit: "Unlimited contacts",
    logoUrl: null, isActive: true
  },
  {
    id: randomUUID(), slug: "wealthbox-crm", name: "Wealthbox CRM",
    description: "Purpose-built CRM for financial advisors with compliance workflows and client portal.",
    category: "crm", ownershipTier: "professional", authMethod: "api_key",
    baseUrl: "https://api.wealthbox.com/v1", docsUrl: "https://dev.wealthbox.com",
    signupUrl: "https://www.wealthbox.com/pricing",
    freeTierDescription: "14-day free trial", freeTierLimit: "14 days",
    logoUrl: null, isActive: true
  },
  {
    id: randomUUID(), slug: "redtail-crm", name: "Redtail CRM",
    description: "Financial services CRM with compliance archiving and workflow automation.",
    category: "crm", ownershipTier: "professional", authMethod: "api_key",
    baseUrl: "https://api.redtailtechnology.com/crm/v1", docsUrl: "https://corporate.redtailtechnology.com/api",
    signupUrl: "https://corporate.redtailtechnology.com/pricing",
    freeTierDescription: "30-day free trial", freeTierLimit: "30 days",
    logoUrl: null, isActive: true
  },
  {
    id: randomUUID(), slug: "twilio-messaging", name: "Twilio",
    description: "Programmable SMS, voice, and WhatsApp messaging for client communications.",
    category: "messaging", ownershipTier: "organization", authMethod: "api_key",
    baseUrl: "https://api.twilio.com/2010-04-01", docsUrl: "https://www.twilio.com/docs",
    signupUrl: "https://www.twilio.com/try-twilio",
    freeTierDescription: "Free trial with $15.50 credit", freeTierLimit: "$15.50 credit",
    logoUrl: null, isActive: true
  },
  {
    id: randomUUID(), slug: "sendgrid-email", name: "SendGrid",
    description: "Transactional and marketing email delivery with analytics and templates.",
    category: "messaging", ownershipTier: "organization", authMethod: "api_key",
    baseUrl: "https://api.sendgrid.com/v3", docsUrl: "https://docs.sendgrid.com",
    signupUrl: "https://signup.sendgrid.com/",
    freeTierDescription: "100 emails/day free forever", freeTierLimit: "100 emails/day",
    logoUrl: null, isActive: true
  },
  {
    id: randomUUID(), slug: "applied-epic", name: "Applied Epic",
    description: "Insurance agency management system for policy administration, accounting, and client management.",
    category: "carrier", ownershipTier: "organization", authMethod: "oauth2",
    baseUrl: "https://api.appliedsystems.com", docsUrl: "https://developer.appliedsystems.com",
    signupUrl: "https://www.appliedsystems.com/contact",
    freeTierDescription: null, freeTierLimit: null,
    logoUrl: null, isActive: true
  },
  {
    id: randomUUID(), slug: "vertafore-ams360", name: "Vertafore AMS360",
    description: "Insurance agency management with carrier connectivity and commission tracking.",
    category: "carrier", ownershipTier: "organization", authMethod: "api_key",
    baseUrl: "https://api.vertafore.com", docsUrl: "https://developer.vertafore.com",
    signupUrl: "https://www.vertafore.com/contact",
    freeTierDescription: null, freeTierLimit: null,
    logoUrl: null, isActive: true
  },
  {
    id: randomUUID(), slug: "plaid-investments", name: "Plaid",
    description: "Financial account aggregation for investment accounts, balances, and transactions.",
    category: "investments", ownershipTier: "platform", authMethod: "api_key",
    baseUrl: "https://production.plaid.com", docsUrl: "https://plaid.com/docs",
    signupUrl: "https://dashboard.plaid.com/signup",
    freeTierDescription: "100 items in sandbox, pay-per-use in production", freeTierLimit: "100 sandbox items",
    logoUrl: null, isActive: true
  },
  {
    id: randomUUID(), slug: "yodlee-aggregation", name: "Yodlee (Envestnet)",
    description: "Financial data aggregation covering 17,000+ financial institutions worldwide.",
    category: "investments", ownershipTier: "platform", authMethod: "oauth2",
    baseUrl: "https://production.api.yodlee.com/ysl", docsUrl: "https://developer.yodlee.com",
    signupUrl: "https://developer.yodlee.com/user/register",
    freeTierDescription: "Sandbox environment with test data", freeTierLimit: "Sandbox only",
    logoUrl: null, isActive: true
  },
  {
    id: randomUUID(), slug: "morningstar-data", name: "Morningstar Data",
    description: "Investment research data including fund ratings, performance, and portfolio analytics.",
    category: "investments", ownershipTier: "platform", authMethod: "api_key",
    baseUrl: "https://api.morningstar.com/v2", docsUrl: "https://developer.morningstar.com",
    signupUrl: "https://developer.morningstar.com/register",
    freeTierDescription: "Limited API calls on developer tier", freeTierLimit: "500 calls/month",
    logoUrl: null, isActive: true
  },
  {
    id: randomUUID(), slug: "ipipeline-insurance", name: "iPipeline",
    description: "Life insurance quoting, e-application, and underwriting automation.",
    category: "insurance", ownershipTier: "organization", authMethod: "api_key",
    baseUrl: "https://api.ipipeline.com", docsUrl: "https://developer.ipipeline.com",
    signupUrl: "https://www.ipipeline.com/contact",
    freeTierDescription: null, freeTierLimit: null,
    logoUrl: null, isActive: true
  },
  {
    id: randomUUID(), slug: "census-bureau", name: "US Census Bureau",
    description: "Demographic data including population, income, education, and housing statistics.",
    category: "demographics", ownershipTier: "platform", authMethod: "api_key",
    baseUrl: "https://api.census.gov/data", docsUrl: "https://www.census.gov/data/developers.html",
    signupUrl: "https://api.census.gov/data/key_signup.html",
    freeTierDescription: "Free with API key, 500 requests/day", freeTierLimit: "500 requests/day",
    logoUrl: null, isActive: true
  },
  {
    id: randomUUID(), slug: "bls-data", name: "Bureau of Labor Statistics",
    description: "Employment, inflation (CPI), wages, and productivity data.",
    category: "economic", ownershipTier: "platform", authMethod: "api_key",
    baseUrl: "https://api.bls.gov/publicAPI/v2", docsUrl: "https://www.bls.gov/developers/",
    signupUrl: "https://data.bls.gov/registrationEngine/",
    freeTierDescription: "Free with registration, 500 daily queries", freeTierLimit: "500 queries/day",
    logoUrl: null, isActive: true
  },
  {
    id: randomUUID(), slug: "fred-data", name: "FRED (Federal Reserve)",
    description: "Economic data including interest rates, GDP, unemployment, and monetary policy indicators.",
    category: "economic", ownershipTier: "platform", authMethod: "api_key",
    baseUrl: "https://api.stlouisfed.org/fred", docsUrl: "https://fred.stlouisfed.org/docs/api/fred/",
    signupUrl: "https://fredaccount.stlouisfed.org/apikeys",
    freeTierDescription: "Free with API key, 120 requests/minute", freeTierLimit: "120 requests/min",
    logoUrl: null, isActive: true
  },
  {
    id: randomUUID(), slug: "sec-edgar", name: "SEC EDGAR",
    description: "SEC filings, company disclosures, and regulatory documents.",
    category: "regulatory", ownershipTier: "platform", authMethod: "none",
    baseUrl: "https://efts.sec.gov/LATEST", docsUrl: "https://www.sec.gov/edgar/searchedgar/efulltext.htm",
    signupUrl: null,
    freeTierDescription: "Free public access, 10 requests/second", freeTierLimit: "10 requests/sec",
    logoUrl: null, isActive: true
  },
  {
    id: randomUUID(), slug: "finra-brokercheck", name: "FINRA BrokerCheck",
    description: "Broker and advisor background verification, disciplinary history, and registration status.",
    category: "regulatory", ownershipTier: "platform", authMethod: "none",
    baseUrl: "https://api.brokercheck.finra.org", docsUrl: "https://www.finra.org/brokercheck",
    signupUrl: null,
    freeTierDescription: "Free public access", freeTierLimit: "Rate limited",
    logoUrl: null, isActive: true
  },
  {
    id: randomUUID(), slug: "fullstory-enrichment", name: "FullStory",
    description: "Digital experience analytics with session replay and behavioral insights.",
    category: "enrichment", ownershipTier: "platform", authMethod: "api_key",
    baseUrl: "https://api.fullstory.com", docsUrl: "https://developer.fullstory.com",
    signupUrl: "https://www.fullstory.com/plans/",
    freeTierDescription: "Free tier with 1,000 sessions/month", freeTierLimit: "1,000 sessions/month",
    logoUrl: null, isActive: true
  },
  {
    id: randomUUID(), slug: "zapier-middleware", name: "Zapier",
    description: "No-code automation platform connecting 6,000+ apps with triggers and actions.",
    category: "middleware", ownershipTier: "organization", authMethod: "api_key",
    baseUrl: "https://hooks.zapier.com", docsUrl: "https://platform.zapier.com/docs",
    signupUrl: "https://zapier.com/sign-up",
    freeTierDescription: "Free tier with 100 tasks/month and 5 zaps", freeTierLimit: "100 tasks/month",
    logoUrl: null, isActive: true
  },
  {
    id: randomUUID(), slug: "zillow-property", name: "Zillow (Bridge Interactive)",
    description: "Property valuation, listing data, and real estate market analytics.",
    category: "property", ownershipTier: "platform", authMethod: "api_key",
    baseUrl: "https://api.bridgedataoutput.com/api/v2", docsUrl: "https://bridgedataoutput.com/docs/explorer",
    signupUrl: "https://bridgedataoutput.com/register",
    freeTierDescription: "1,000 API calls/day on developer plan", freeTierLimit: "1,000 calls/day",
    logoUrl: null, isActive: true
  }
];

// ─── 7 Carrier Import Templates ──────────────────────────────────────────────
export const carrierImportTemplates = [
  {
    id: randomUUID(), carrierId: "northwestern-mutual", reportType: "inforce_illustration",
    name: "Northwestern Mutual — In-Force Illustration (CSV)",
    description: "Import in-force policy illustrations from Northwestern Mutual CSV exports.",
    columnMappings: JSON.stringify({
      policyNumber: "Policy Number", insuredName: "Insured Name", productType: "Product",
      faceAmount: "Face Amount", cashValue: "Cash Value", annualPremium: "Annual Premium",
      deathBenefit: "Death Benefit", loanBalance: "Loan Balance", issueDate: "Issue Date"
    }),
    parserType: "csv",
    sampleHeaders: JSON.stringify(["Policy Number","Insured Name","Product","Face Amount","Cash Value","Annual Premium","Death Benefit","Loan Balance","Issue Date"]),
    isSystem: true, createdBy: null
  },
  {
    id: randomUUID(), carrierId: "massmutual", reportType: "policy_summary",
    name: "MassMutual — Policy Summary (CSV)",
    description: "Import policy summary data from MassMutual CSV exports.",
    columnMappings: JSON.stringify({
      policyNumber: "Contract Number", insuredName: "Owner Name", productType: "Plan Code",
      faceAmount: "Specified Amount", cashValue: "Total Cash Value", annualPremium: "Planned Premium",
      deathBenefit: "Current Death Benefit", issueDate: "Issue Date", status: "Status"
    }),
    parserType: "csv",
    sampleHeaders: JSON.stringify(["Contract Number","Owner Name","Plan Code","Specified Amount","Total Cash Value","Planned Premium","Current Death Benefit","Issue Date","Status"]),
    isSystem: true, createdBy: null
  },
  {
    id: randomUUID(), carrierId: "prudential", reportType: "annual_statement",
    name: "Prudential — Annual Statement (PDF Table)",
    description: "Extract annual statement data from Prudential PDF reports.",
    columnMappings: JSON.stringify({
      policyNumber: "Policy No.", insuredName: "Insured", productType: "Product Type",
      faceAmount: "Face Amount", cashValue: "Account Value", annualPremium: "Premium",
      deathBenefit: "Death Benefit", issueDate: "Effective Date"
    }),
    parserType: "pdf_table",
    sampleHeaders: JSON.stringify(["Policy No.","Insured","Product Type","Face Amount","Account Value","Premium","Death Benefit","Effective Date"]),
    isSystem: true, createdBy: null
  },
  {
    id: randomUUID(), carrierId: "guardian", reportType: "commission_statement",
    name: "Guardian — Commission Statement (Excel)",
    description: "Import commission data from Guardian Excel exports.",
    columnMappings: JSON.stringify({
      policyNumber: "Policy #", agentCode: "Agent Code", insuredName: "Insured",
      commissionType: "Comm Type", amount: "Amount", premiumBasis: "Premium Basis",
      effectiveDate: "Effective", productType: "Product"
    }),
    parserType: "excel",
    sampleHeaders: JSON.stringify(["Policy #","Agent Code","Insured","Comm Type","Amount","Premium Basis","Effective","Product"]),
    isSystem: true, createdBy: null
  },
  {
    id: randomUUID(), carrierId: "transamerica", reportType: "inforce_listing",
    name: "Transamerica — In-Force Listing (CSV)",
    description: "Import in-force policy listings from Transamerica CSV exports.",
    columnMappings: JSON.stringify({
      policyNumber: "Policy Number", insuredName: "Insured Name", productType: "Plan Name",
      faceAmount: "Initial Face Amount", cashValue: "Surrender Value", annualPremium: "Modal Premium",
      deathBenefit: "Current Death Benefit", issueDate: "Issue Date", status: "Policy Status"
    }),
    parserType: "csv",
    sampleHeaders: JSON.stringify(["Policy Number","Insured Name","Plan Name","Initial Face Amount","Surrender Value","Modal Premium","Current Death Benefit","Issue Date","Policy Status"]),
    isSystem: true, createdBy: null
  },
  {
    id: randomUUID(), carrierId: "pacific-life", reportType: "performance_report",
    name: "Pacific Life — Performance Report (PDF OCR)",
    description: "OCR extraction from Pacific Life performance report PDFs.",
    columnMappings: JSON.stringify({
      policyNumber: "Contract Number", insuredName: "Contract Owner", productType: "Product",
      faceAmount: "Specified Amount", cashValue: "Accumulation Value", annualPremium: "Planned Premium",
      deathBenefit: "Death Benefit", returnRate: "Net Rate of Return"
    }),
    parserType: "pdf_ocr",
    sampleHeaders: JSON.stringify(["Contract Number","Contract Owner","Product","Specified Amount","Accumulation Value","Planned Premium","Death Benefit","Net Rate of Return"]),
    isSystem: true, createdBy: null
  },
  {
    id: randomUUID(), carrierId: "nationwide", reportType: "client_report",
    name: "Nationwide — Client Report (Excel)",
    description: "Import client policy data from Nationwide Excel reports.",
    columnMappings: JSON.stringify({
      policyNumber: "Policy Number", insuredName: "Client Name", productType: "Product Name",
      faceAmount: "Face Amount", cashValue: "Cash Surrender Value", annualPremium: "Annual Premium",
      deathBenefit: "Death Benefit Amount", issueDate: "Policy Issue Date", status: "Status"
    }),
    parserType: "excel",
    sampleHeaders: JSON.stringify(["Policy Number","Client Name","Product Name","Face Amount","Cash Surrender Value","Annual Premium","Death Benefit Amount","Policy Issue Date","Status"]),
    isSystem: true, createdBy: null
  }
];

// ─── 16 Analytical Models (5 layers) ─────────────────────────────────────────
export const analyticalModels = [
  // Platform layer (4)
  { id: randomUUID(), name: "Market Sentiment Analyzer", slug: "market-sentiment", description: "Analyzes market news and social media to gauge overall market sentiment and sector-specific trends.", layer: "platform", category: "market", executionType: "hybrid", inputSchema: JSON.stringify({ fields: ["timeRange", "sectors", "sources"] }), outputSchema: JSON.stringify({ fields: ["overallSentiment", "sectorBreakdown", "trendDirection", "confidence"] }), dependencies: null, version: "1.0.0", isActive: true },
  { id: randomUUID(), name: "Economic Indicator Tracker", slug: "economic-indicators", description: "Tracks and correlates key economic indicators (CPI, GDP, unemployment, Fed funds rate) for macro outlook.", layer: "platform", category: "market", executionType: "statistical", inputSchema: JSON.stringify({ fields: ["indicators", "timeRange", "correlationPairs"] }), outputSchema: JSON.stringify({ fields: ["currentValues", "trends", "correlations", "forecast"] }), dependencies: null, version: "1.0.0", isActive: true },
  { id: randomUUID(), name: "Regulatory Change Monitor", slug: "regulatory-monitor", description: "Monitors SEC, FINRA, and state regulatory changes that may affect advisory practices.", layer: "platform", category: "compliance", executionType: "llm", inputSchema: JSON.stringify({ fields: ["regulatoryBodies", "topics", "dateRange"] }), outputSchema: JSON.stringify({ fields: ["changes", "impactAssessment", "actionItems", "effectiveDates"] }), dependencies: null, version: "1.0.0", isActive: true },
  { id: randomUUID(), name: "Platform Usage Analytics", slug: "platform-analytics", description: "Aggregates platform usage patterns to identify feature adoption, engagement trends, and optimization opportunities.", layer: "platform", category: "operational", executionType: "statistical", inputSchema: JSON.stringify({ fields: ["dateRange", "metrics", "segments"] }), outputSchema: JSON.stringify({ fields: ["activeUsers", "featureAdoption", "engagementScores", "churnRisk"] }), dependencies: null, version: "1.0.0", isActive: true },
  // Organization layer (3)
  { id: randomUUID(), name: "Team Performance Scorer", slug: "team-performance", description: "Evaluates team-level advisory performance across client satisfaction, compliance adherence, and revenue metrics.", layer: "organization", category: "operational", executionType: "statistical", inputSchema: JSON.stringify({ fields: ["teamId", "dateRange", "metrics"] }), outputSchema: JSON.stringify({ fields: ["overallScore", "metricBreakdown", "benchmarkComparison", "recommendations"] }), dependencies: null, version: "1.0.0", isActive: true },
  { id: randomUUID(), name: "Client Segment Analyzer", slug: "client-segments", description: "Segments clients by demographics, behavior, and financial profile for targeted service delivery.", layer: "organization", category: "behavioral", executionType: "hybrid", inputSchema: JSON.stringify({ fields: ["organizationId", "segmentCriteria", "minClusterSize"] }), outputSchema: JSON.stringify({ fields: ["segments", "segmentProfiles", "migrationPatterns", "opportunities"] }), dependencies: null, version: "1.0.0", isActive: true },
  { id: randomUUID(), name: "Compliance Risk Heatmap", slug: "compliance-heatmap", description: "Generates compliance risk scores across the organization identifying high-risk areas and advisors.", layer: "organization", category: "compliance", executionType: "rule_based", inputSchema: JSON.stringify({ fields: ["organizationId", "riskFactors", "threshold"] }), outputSchema: JSON.stringify({ fields: ["heatmap", "highRiskAreas", "advisorScores", "mitigationPlan"] }), dependencies: null, version: "1.0.0", isActive: true },
  // Manager layer (3)
  { id: randomUUID(), name: "Advisor Coaching Recommender", slug: "advisor-coaching", description: "Analyzes advisor interactions and outcomes to generate personalized coaching recommendations.", layer: "manager", category: "engagement", executionType: "llm", inputSchema: JSON.stringify({ fields: ["advisorId", "dateRange", "focusAreas"] }), outputSchema: JSON.stringify({ fields: ["strengths", "improvementAreas", "coachingPlan", "benchmarks"] }), dependencies: null, version: "1.0.0", isActive: true },
  { id: randomUUID(), name: "Revenue Forecast Model", slug: "revenue-forecast", description: "Projects team and individual revenue based on pipeline, conversion rates, and seasonal patterns.", layer: "manager", category: "financial", executionType: "statistical", inputSchema: JSON.stringify({ fields: ["teamId", "forecastPeriod", "assumptions"] }), outputSchema: JSON.stringify({ fields: ["forecast", "confidenceInterval", "driverAnalysis", "scenarios"] }), dependencies: null, version: "1.0.0", isActive: true },
  { id: randomUUID(), name: "Client Attrition Predictor", slug: "attrition-predictor", description: "Predicts client churn risk based on engagement patterns, satisfaction scores, and life events.", layer: "manager", category: "behavioral", executionType: "hybrid", inputSchema: JSON.stringify({ fields: ["clientIds", "lookbackDays", "features"] }), outputSchema: JSON.stringify({ fields: ["riskScores", "topFactors", "retentionActions", "timeline"] }), dependencies: null, version: "1.0.0", isActive: true },
  // Professional layer (3)
  { id: randomUUID(), name: "Suitability Engine", slug: "suitability-engine", description: "Comprehensive 12-dimension suitability assessment for product and strategy recommendations.", layer: "professional", category: "suitability", executionType: "hybrid", inputSchema: JSON.stringify({ fields: ["clientProfile", "riskTolerance", "goals", "timeHorizon"] }), outputSchema: JSON.stringify({ fields: ["overallScore", "dimensionScores", "recommendations", "warnings"] }), dependencies: null, version: "1.0.0", isActive: true },
  { id: randomUUID(), name: "Portfolio Optimization Engine", slug: "portfolio-optimizer", description: "Optimizes asset allocation based on modern portfolio theory, risk constraints, and client preferences.", layer: "professional", category: "financial", executionType: "statistical", inputSchema: JSON.stringify({ fields: ["currentHoldings", "constraints", "targetReturn", "riskBudget"] }), outputSchema: JSON.stringify({ fields: ["optimalAllocation", "efficientFrontier", "expectedReturn", "expectedRisk"] }), dependencies: null, version: "1.0.0", isActive: true },
  { id: randomUUID(), name: "Client Engagement Scorer", slug: "engagement-scorer", description: "Scores client engagement level based on interaction frequency, response times, and feature usage.", layer: "professional", category: "engagement", executionType: "rule_based", inputSchema: JSON.stringify({ fields: ["clientId", "dateRange", "channels"] }), outputSchema: JSON.stringify({ fields: ["engagementScore", "channelBreakdown", "trend", "nextBestAction"] }), dependencies: null, version: "1.0.0", isActive: true },
  // User layer (3)
  { id: randomUUID(), name: "Monte Carlo Retirement Simulator", slug: "monte-carlo-retirement", description: "10,000-iteration Monte Carlo simulation for retirement planning with percentile-based outcomes.", layer: "user", category: "financial", executionType: "statistical", inputSchema: JSON.stringify({ fields: ["currentAge", "retirementAge", "currentSavings", "monthlyContribution", "expectedReturn", "volatility", "annualExpenses"] }), outputSchema: JSON.stringify({ fields: ["successRate", "percentiles", "yearByYear", "shortfallRisk"] }), dependencies: null, version: "1.0.0", isActive: true },
  { id: randomUUID(), name: "Risk Tolerance Assessor", slug: "risk-tolerance", description: "Multi-factor risk tolerance assessment combining behavioral, financial capacity, and time horizon analysis.", layer: "user", category: "risk", executionType: "hybrid", inputSchema: JSON.stringify({ fields: ["questionnaire", "financialProfile", "investmentExperience"] }), outputSchema: JSON.stringify({ fields: ["riskScore", "riskCategory", "allocation", "behavioralInsights"] }), dependencies: null, version: "1.0.0", isActive: true },
  { id: randomUUID(), name: "Tax Optimization Analyzer", slug: "tax-optimizer", description: "Analyzes tax situation to identify optimization strategies including Roth conversions, harvesting, and bracket management.", layer: "user", category: "financial", executionType: "statistical", inputSchema: JSON.stringify({ fields: ["income", "filingStatus", "deductions", "investments", "retirementAccounts"] }), outputSchema: JSON.stringify({ fields: ["currentTax", "optimizedTax", "savings", "strategies", "bracketAnalysis"] }), dependencies: null, version: "1.0.0", isActive: true }
];

// ─── Default Model Schedules ─────────────────────────────────────────────────
// Generate schedules referencing the model IDs above
export function generateModelSchedules(models) {
  const scheduleMap = {
    "market-sentiment": { cron: "0 0 6,12,18 * * 1-5", tz: "America/New_York" },    // 3x daily weekdays
    "economic-indicators": { cron: "0 0 7 * * 1", tz: "America/New_York" },           // Weekly Monday 7am
    "regulatory-monitor": { cron: "0 0 8 * * 1-5", tz: "America/New_York" },          // Daily weekdays 8am
    "platform-analytics": { cron: "0 0 2 * * 0", tz: "UTC" },                         // Weekly Sunday 2am
    "team-performance": { cron: "0 0 6 1 * *", tz: "America/New_York" },              // Monthly 1st at 6am
    "client-segments": { cron: "0 0 3 1,15 * *", tz: "UTC" },                         // Bi-monthly 1st & 15th
    "compliance-heatmap": { cron: "0 0 5 * * 1", tz: "America/New_York" },            // Weekly Monday 5am
    "advisor-coaching": { cron: "0 0 7 * * 5", tz: "America/New_York" },              // Weekly Friday 7am
    "revenue-forecast": { cron: "0 0 6 1 * *", tz: "America/New_York" },              // Monthly 1st at 6am
    "attrition-predictor": { cron: "0 0 4 * * 1", tz: "America/New_York" },           // Weekly Monday 4am
    "suitability-engine": { cron: "0 0 3 * * *", tz: "UTC" },                         // Daily 3am (event-driven primarily)
    "portfolio-optimizer": { cron: "0 0 5 * * 1-5", tz: "America/New_York" },         // Daily weekdays 5am
    "engagement-scorer": { cron: "0 0 2 * * *", tz: "UTC" },                          // Daily 2am
    "monte-carlo-retirement": { cron: "0 0 4 1 * *", tz: "UTC" },                     // Monthly 1st (event-driven primarily)
    "risk-tolerance": { cron: "0 0 3 1,15 * *", tz: "UTC" },                          // Bi-monthly (event-driven primarily)
    "tax-optimizer": { cron: "0 0 5 1 1,4,7,10 *", tz: "America/New_York" }           // Quarterly 1st at 5am
  };

  return models.map(m => {
    const sched = scheduleMap[m.slug];
    if (!sched) return null;
    return {
      id: randomUUID(),
      modelId: m.id,
      cronExpression: sched.cron,
      timezone: sched.tz,
      isActive: true,
      lastRunAt: null,
      nextRunAt: null,
      filterCriteria: null
    };
  }).filter(Boolean);
}

// ─── SQL Generation ──────────────────────────────────────────────────────────
function esc(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "number") return String(v);
  return "'" + String(v).replace(/'/g, "''") + "'";
}

function buildInsert(table, rows) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const header = `INSERT INTO \`${table}\` (${cols.map(c => {
    // camelCase to snake_case
    return '`' + c.replace(/[A-Z]/g, m => '_' + m.toLowerCase()) + '`';
  }).join(", ")}) VALUES`;
  const values = rows.map(r => "(" + cols.map(c => esc(r[c])).join(", ") + ")").join(",\n");
  return header + "\n" + values + ";\n";
}

const schedules = generateModelSchedules(analyticalModels);

console.log("-- Seed: Integration Providers (20)");
console.log(buildInsert("integration_providers", integrationProviders));
console.log("-- Seed: Carrier Import Templates (7)");
console.log(buildInsert("carrier_import_templates", carrierImportTemplates));
console.log("-- Seed: Analytical Models (16)");
console.log(buildInsert("analytical_models", analyticalModels));
console.log("-- Seed: Model Schedules (" + schedules.length + ")");
console.log(buildInsert("model_schedules", schedules));
