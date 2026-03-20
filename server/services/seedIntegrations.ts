import { getDb } from "../db";
import { integrationProviders, carrierImportTemplates } from "../../drizzle/schema";
import crypto from "crypto";

const uuid = () => crypto.randomUUID();

const PROVIDERS = [
  {
    id: uuid(), slug: "gohighlevel", name: "GoHighLevel", description: "All-in-one CRM, marketing automation, and sales pipeline management for agencies.", category: "crm" as const,
    ownershipTier: "organization" as const, authMethod: "oauth2" as const,
    baseUrl: "https://services.leadconnectorhq.com",
    docsUrl: "https://marketplace.gohighlevel.com/docs/",
    signupUrl: "https://www.gohighlevel.com/",
    freeTierDescription: "No free plan. 14-day trial. API included on all paid plans ($97+/mo).",
    freeTierLimit: "14-day trial",
  },
  {
    id: uuid(), slug: "smsit", name: "SMS-iT", description: "Multi-channel messaging platform for SMS, MMS, WhatsApp, and email campaigns.", category: "messaging" as const,
    ownershipTier: "organization" as const, authMethod: "bearer_token" as const,
    baseUrl: "https://tool-it.smsit.ai/api",
    docsUrl: "https://smsit.stoplight.io",
    signupUrl: "https://www.smsit.ai/",
    freeTierDescription: "No free tier. RAAS plans from $9/mo. Trial available on request.",
    freeTierLimit: "None",
  },
  {
    id: uuid(), slug: "national-life", name: "National Life Group", description: "Life insurance carrier. Manual CSV/PDF import from agent portal.", category: "carrier" as const,
    ownershipTier: "professional" as const, authMethod: "manual_upload" as const,
    docsUrl: "https://www.nationallife.com/Contact-For-Agents",
    signupUrl: "https://www.nationallife.com/",
    freeTierDescription: "Agent Portal free for contracted agents. No API — manual CSV/PDF import.",
    freeTierLimit: "Unlimited manual uploads",
  },
  {
    id: uuid(), slug: "massmutual", name: "MassMutual", description: "Life insurance and financial services carrier. Manual CSV/PDF import.", category: "carrier" as const,
    ownershipTier: "professional" as const, authMethod: "manual_upload" as const,
    docsUrl: "https://www.massmutual.com/financial-professionals",
    signupUrl: "https://www.massmutual.com/",
    freeTierDescription: "Portal free for affiliated advisors. No API — manual CSV/PDF import.",
    freeTierLimit: "Unlimited manual uploads",
  },
  {
    id: uuid(), slug: "esi-fidelity", name: "ESI / Fidelity Wealthscape", description: "Custodial investment platform via BridgeFT integration.", category: "investments" as const,
    ownershipTier: "organization" as const, authMethod: "api_key" as const,
    baseUrl: "https://api.bridgeft.com/v2",
    docsUrl: "https://docs.bridgeft.com/docs/welcome-v26",
    signupUrl: "https://docs.bridgeft.com/",
    freeTierDescription: "Requires BridgeFT partnership. Org-level integration via Fidelity Integration Xchange.",
    freeTierLimit: "Partnership required",
  },
  {
    id: uuid(), slug: "bridgeft", name: "BridgeFT WealthTech API", description: "Unified API for investment account data, performance, and transactions.", category: "investments" as const,
    ownershipTier: "organization" as const, authMethod: "api_key" as const,
    baseUrl: "https://api.bridgeft.com/v2",
    docsUrl: "https://docs.bridgeft.com/docs/welcome-v26",
    signupUrl: "https://docs.bridgeft.com/",
    freeTierDescription: "No free tier. Partnership/licensing required.",
    freeTierLimit: "Partnership required",
  },
  {
    id: uuid(), slug: "wealthbridge", name: "WealthBridge Financial", description: "Independent firm data via custodial integrations.", category: "investments" as const,
    ownershipTier: "organization" as const, authMethod: "api_key" as const,
    freeTierDescription: "Independent firm — data via custodial integrations (LPL, Schwab). No direct API.",
    freeTierLimit: "Via custodian",
  },
  {
    id: uuid(), slug: "plaid", name: "Plaid", description: "Bank account linking, transaction data, and investment holdings.", category: "investments" as const,
    ownershipTier: "organization" as const, authMethod: "api_key" as const,
    baseUrl: "https://production.plaid.com",
    docsUrl: "https://plaid.com/docs/api/",
    signupUrl: "https://dashboard.plaid.com/signup/",
    freeTierDescription: "Free sandbox (unlimited). Production requires approval. Per-connection pricing.",
    freeTierLimit: "Unlimited sandbox; production costs per-link",
  },
  {
    id: uuid(), slug: "census-bureau", name: "U.S. Census Bureau", description: "Demographic data: income, population, education, housing by geography.", category: "demographics" as const,
    ownershipTier: "platform" as const, authMethod: "api_key" as const,
    baseUrl: "https://api.census.gov/data",
    docsUrl: "https://www.census.gov/data/developers.html",
    signupUrl: "https://api.census.gov/data/key_signup.html",
    freeTierDescription: "Completely free. Unlimited queries with API key.",
    freeTierLimit: "Unlimited",
  },
  {
    id: uuid(), slug: "bls", name: "Bureau of Labor Statistics", description: "CPI, unemployment, wages, and occupation data.", category: "economic" as const,
    ownershipTier: "platform" as const, authMethod: "api_key" as const,
    baseUrl: "https://api.bls.gov/publicAPI/v2/timeseries/data/",
    docsUrl: "https://www.bls.gov/developers/",
    signupUrl: "https://data.bls.gov/registrationEngine/",
    freeTierDescription: "Completely free. V1: no key (25/day). V2: free key (500/day).",
    freeTierLimit: "Unlimited (500 queries/day with free key)",
  },
  {
    id: uuid(), slug: "fred", name: "FRED (Federal Reserve Economic Data)", description: "800,000+ economic time series: rates, inflation, GDP, markets.", category: "economic" as const,
    ownershipTier: "platform" as const, authMethod: "api_key" as const,
    baseUrl: "https://api.stlouisfed.org/fred",
    docsUrl: "https://fred.stlouisfed.org/docs/api/fred/",
    signupUrl: "https://fred.stlouisfed.org/docs/api/api_key.html",
    freeTierDescription: "Completely free. 800,000+ economic time series.",
    freeTierLimit: "Unlimited",
  },
  {
    id: uuid(), slug: "bea", name: "Bureau of Economic Analysis", description: "Regional GDP, personal income, and consumer spending data.", category: "economic" as const,
    ownershipTier: "platform" as const, authMethod: "api_key" as const,
    baseUrl: "https://apps.bea.gov/api/data",
    docsUrl: "https://apps.bea.gov/api/_pdf/bea_web_service_api_user_guide.pdf",
    signupUrl: "https://apps.bea.gov/API/signup/",
    freeTierDescription: "Completely free. GDP, personal income, consumer spending.",
    freeTierLimit: "Unlimited",
  },
  {
    id: uuid(), slug: "sec-edgar", name: "SEC EDGAR", description: "SEC filing monitoring: 10-K, 10-Q, 8-K, Form ADV.", category: "regulatory" as const,
    ownershipTier: "platform" as const, authMethod: "none" as const,
    baseUrl: "https://data.sec.gov",
    docsUrl: "https://www.sec.gov/os/accessing-edgar-data",
    freeTierDescription: "Completely free. No API key required. 10 req/sec fair use.",
    freeTierLimit: "Unlimited",
  },
  {
    id: uuid(), slug: "finra-brokercheck", name: "FINRA BrokerCheck", description: "Advisor/broker verification, disciplinary history, and registration.", category: "regulatory" as const,
    ownershipTier: "platform" as const, authMethod: "none" as const,
    baseUrl: "https://api.brokercheck.finra.org",
    docsUrl: "https://developer.finra.org/",
    signupUrl: "https://developer.finra.org/",
    freeTierDescription: "Free public access for BrokerCheck data. Developer Center for advanced API.",
    freeTierLimit: "Unlimited public lookups",
  },
  {
    id: uuid(), slug: "peopledatalabs", name: "People Data Labs", description: "Contact enrichment: income, employer, education, social profiles.", category: "enrichment" as const,
    ownershipTier: "professional" as const, authMethod: "api_key" as const,
    baseUrl: "https://api.peopledatalabs.com/v5",
    docsUrl: "https://docs.peopledatalabs.com/",
    signupUrl: "https://www.peopledatalabs.com/signup",
    freeTierDescription: "Free tier: 100 person records/month per API key. Advisor-level distribution multiplies this.",
    freeTierLimit: "100 records/month per key",
  },
  {
    id: uuid(), slug: "compulife", name: "COMPULIFE", description: "Life insurance quoting engine with carrier comparison.", category: "insurance" as const,
    ownershipTier: "organization" as const, authMethod: "api_key" as const,
    baseUrl: "https://api.compulife.com",
    docsUrl: "https://compulife.com/api/",
    signupUrl: "https://compulife.com/",
    freeTierDescription: "2-month free trial for new subscribers. Then volume-based pricing.",
    freeTierLimit: "2-month free trial",
  },
  {
    id: uuid(), slug: "canopy-connect", name: "Canopy Connect", description: "Insurance policy data aggregation and verification.", category: "insurance" as const,
    ownershipTier: "organization" as const, authMethod: "api_key" as const,
    baseUrl: "https://api.usecanopy.com",
    docsUrl: "https://www.usecanopy.com/api",
    signupUrl: "https://www.usecanopy.com/api/api-plans",
    freeTierDescription: "Free sandbox for development. Paid production plans.",
    freeTierLimit: "Free sandbox",
  },
  {
    id: uuid(), slug: "attom", name: "ATTOM Data", description: "Property data: valuations, ownership, tax assessments, sales history.", category: "property" as const,
    ownershipTier: "organization" as const, authMethod: "api_key" as const,
    baseUrl: "https://api.gateway.attomdata.com",
    docsUrl: "https://api.gateway.attomdata.com/docs",
    signupUrl: "https://www.attomdata.com/",
    freeTierDescription: "Free trial available. Then PAYG or annual contract.",
    freeTierLimit: "Free trial",
  },
  {
    id: uuid(), slug: "snaptrade", name: "SnapTrade", description: "Brokerage account linking and trading API.", category: "investments" as const,
    ownershipTier: "professional" as const, authMethod: "api_key" as const,
    baseUrl: "https://api.snaptrade.com",
    docsUrl: "https://docs.snaptrade.com/",
    signupUrl: "https://snaptrade.com/",
    freeTierDescription: "Free tier: 5 brokerage connections per API key.",
    freeTierLimit: "5 connections per key",
  },
  {
    id: uuid(), slug: "n8n", name: "n8n (Self-Hosted)", description: "Self-hosted workflow automation for custom integrations.", category: "middleware" as const,
    ownershipTier: "platform" as const, authMethod: "api_key" as const,
    baseUrl: "https://localhost:5678",
    docsUrl: "https://docs.n8n.io/",
    signupUrl: "https://n8n.io/",
    freeTierDescription: "Self-hosted is completely free. Unlimited workflow automation.",
    freeTierLimit: "Unlimited (self-hosted)",
  },
];

const CARRIER_TEMPLATES = [
  {
    id: uuid(), carrierSlug: "national-life", reportType: "commission_statement",
    name: "NLG Commission Statement", description: "Standard NLG commission statement CSV export",
    columnMappings: JSON.stringify({ "Agent Name": "agent_name", "Policy Number": "policy_number", "Insured Name": "insured_name", "Product": "product_name", "Commission Type": "commission_type", "Commission Amount": "commission_amount", "Premium": "premium_amount", "Issue Date": "issue_date" }),
    parserType: "csv" as const, sampleHeaders: JSON.stringify(["Agent Name", "Policy Number", "Insured Name", "Product", "Commission Type", "Commission Amount", "Premium", "Issue Date"]),
    isSystem: true,
  },
  {
    id: uuid(), carrierSlug: "national-life", reportType: "production_report",
    name: "NLG Production Report", description: "NLG monthly production report CSV",
    columnMappings: JSON.stringify({ "Agent": "agent_name", "Policy #": "policy_number", "Product": "product_name", "Face Amount": "face_amount", "Annual Premium": "annual_premium", "Status": "status", "App Date": "application_date", "Issue Date": "issue_date" }),
    parserType: "csv" as const, sampleHeaders: JSON.stringify(["Agent", "Policy #", "Product", "Face Amount", "Annual Premium", "Status", "App Date", "Issue Date"]),
    isSystem: true,
  },
  {
    id: uuid(), carrierSlug: "national-life", reportType: "inforce_report",
    name: "NLG Inforce Policy List", description: "NLG inforce policy listing CSV",
    columnMappings: JSON.stringify({ "Policy Number": "policy_number", "Insured": "insured_name", "Product": "product_name", "Face Amount": "face_amount", "Cash Value": "cash_value", "Premium": "annual_premium", "Status": "status", "Issue Date": "issue_date" }),
    parserType: "csv" as const, sampleHeaders: JSON.stringify(["Policy Number", "Insured", "Product", "Face Amount", "Cash Value", "Premium", "Status", "Issue Date"]),
    isSystem: true,
  },
  {
    id: uuid(), carrierSlug: "massmutual", reportType: "commission_statement",
    name: "MassMutual Commission Statement", description: "MassMutual commission statement CSV",
    columnMappings: JSON.stringify({ "Representative": "agent_name", "Policy No": "policy_number", "Owner": "insured_name", "Plan": "product_name", "Type": "commission_type", "Amount": "commission_amount", "Target Premium": "premium_amount", "Effective Date": "issue_date" }),
    parserType: "csv" as const, sampleHeaders: JSON.stringify(["Representative", "Policy No", "Owner", "Plan", "Type", "Amount", "Target Premium", "Effective Date"]),
    isSystem: true,
  },
  {
    id: uuid(), carrierSlug: "massmutual", reportType: "production_report",
    name: "MassMutual Production Report", description: "MassMutual production report CSV",
    columnMappings: JSON.stringify({ "Rep": "agent_name", "Policy": "policy_number", "Plan Name": "product_name", "Death Benefit": "face_amount", "Premium": "annual_premium", "App Status": "status", "Submit Date": "application_date" }),
    parserType: "csv" as const, sampleHeaders: JSON.stringify(["Rep", "Policy", "Plan Name", "Death Benefit", "Premium", "App Status", "Submit Date"]),
    isSystem: true,
  },
  {
    id: uuid(), carrierSlug: "generic", reportType: "commission_statement",
    name: "Generic Carrier Commission CSV", description: "Flexible template for any carrier commission statement",
    columnMappings: JSON.stringify({ "Agent": "agent_name", "Policy": "policy_number", "Client": "insured_name", "Product": "product_name", "Type": "commission_type", "Amount": "commission_amount", "Premium": "premium_amount", "Date": "issue_date" }),
    parserType: "csv" as const, sampleHeaders: JSON.stringify(["Agent", "Policy", "Client", "Product", "Type", "Amount", "Premium", "Date"]),
    isSystem: true,
  },
  {
    id: uuid(), carrierSlug: "generic", reportType: "policy_list",
    name: "Generic Policy List CSV", description: "Flexible template for any carrier policy listing",
    columnMappings: JSON.stringify({ "Policy Number": "policy_number", "Client Name": "insured_name", "Product": "product_name", "Face Amount": "face_amount", "Premium": "annual_premium", "Status": "status", "Effective Date": "issue_date" }),
    parserType: "csv" as const, sampleHeaders: JSON.stringify(["Policy Number", "Client Name", "Product", "Face Amount", "Premium", "Status", "Effective Date"]),
    isSystem: true,
  },
];

export async function seedIntegrationProviders() {
  const db = (await getDb())!;
  console.log("[Seed] Seeding integration providers...");
  for (const provider of PROVIDERS) {
    try {
      await db.insert(integrationProviders).values(provider).onDuplicateKeyUpdate({
        set: {
          name: provider.name,
          description: provider.description,
          category: provider.category,
          ownershipTier: provider.ownershipTier,
          authMethod: provider.authMethod,
          baseUrl: provider.baseUrl,
          docsUrl: provider.docsUrl,
          signupUrl: provider.signupUrl,
          freeTierDescription: provider.freeTierDescription,
          freeTierLimit: provider.freeTierLimit,
        },
      });
    } catch (e) {
      console.error(`[Seed] Failed to seed provider ${provider.slug}:`, e);
    }
  }
  console.log(`[Seed] Seeded ${PROVIDERS.length} integration providers.`);
}

export async function seedCarrierTemplates() {
  const db = (await getDb())!;
  console.log("[Seed] Seeding carrier import templates...");
  for (const tmpl of CARRIER_TEMPLATES) {
    try {
      await db.insert(carrierImportTemplates).values(tmpl).onDuplicateKeyUpdate({
        set: { name: tmpl.name },
      });
    } catch (e) {
      console.error(`[Seed] Failed to seed template ${tmpl.name}:`, e);
    }
  }
  console.log(`[Seed] Seeded ${CARRIER_TEMPLATES.length} carrier import templates.`);
}

export async function seedAll() {
  await seedIntegrationProviders();
  await seedCarrierTemplates();
}
