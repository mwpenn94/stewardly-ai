import { requireDb } from "../db";
import { integrationProviders, carrierImportTemplates } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { logger } from "../_core/logger";

const uuid = () => crypto.randomUUID();

export const PROVIDERS = [
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
  {
    id: uuid(), slug: "gleif", name: "GLEIF (Global LEI Foundation)", description: "Legal Entity Identifier (LEI) lookup, entity verification, and ownership chain resolution. Zero-cost, foundational for cross-client portfolio analytics.", category: "regulatory" as const,
    ownershipTier: "platform" as const, authMethod: "none" as const,
    baseUrl: "https://api.gleif.org/api/v1",
    docsUrl: "https://www.gleif.org/en/lei-data/gleif-api",
    freeTierDescription: "Completely free. No API key required. 60 req/min.",
    freeTierLimit: "Unlimited",
  },
  {
    id: uuid(), slug: "treasury-fiscal", name: "U.S. Treasury Fiscal Data", description: "Treasury exchange rates, national debt, average interest rates on Treasury securities. Zero-cost government API.", category: "government" as const,
    ownershipTier: "platform" as const, authMethod: "none" as const,
    baseUrl: "https://api.fiscaldata.treasury.gov/services/api/fiscal_service",
    docsUrl: "https://fiscaldata.treasury.gov/api-documentation/",
    freeTierDescription: "Completely free. No API key required. No rate limits.",
    freeTierLimit: "Unlimited",
  },
  {
    id: uuid(), slug: "world-bank", name: "World Bank Open Data", description: "Global economic indicators: GDP, inflation, unemployment, FDI. 200+ countries, 60+ years of data. Zero-cost international source.", category: "government" as const,
    ownershipTier: "platform" as const, authMethod: "none" as const,
    baseUrl: "https://api.worldbank.org/v2",
    docsUrl: "https://datahelpdesk.worldbank.org/knowledgebase/articles/889392",
    freeTierDescription: "Completely free. No API key required. No rate limits.",
    freeTierLimit: "Unlimited",
  },
  {
    id: uuid(), slug: "openfigi", name: "OpenFIGI", description: "Financial Instrument Global Identifier (FIGI) mapping service. FIGI-to-ticker, CUSIP, ISIN resolution for instrument identification.", category: "enrichment" as const,
    ownershipTier: "platform" as const, authMethod: "api_key" as const,
    baseUrl: "https://api.openfigi.com",
    docsUrl: "https://www.openfigi.com/api",
    signupUrl: "https://www.openfigi.com/api#api-key",
    freeTierDescription: "Free API key. 250 req/min with key, 25 req/min without.",
    freeTierLimit: "250 req/min with free key",
  },
  {
    id: uuid(), slug: "naic", name: "NAIC Financial Data", description: "National Association of Insurance Commissioners — carrier financial data, consumer complaint ratios, model regulations. Foundational for Protection surfaces.", category: "regulatory" as const,
    ownershipTier: "platform" as const, authMethod: "none" as const,
    baseUrl: "https://content.naic.org",
    docsUrl: "https://content.naic.org/cipr-topics",
    freeTierDescription: "Public data freely available. Some reports require NAIC membership.",
    freeTierLimit: "Unlimited (public data)",
  },
  {
    id: uuid(), slug: "ffiec", name: "FFIEC (Federal Financial Institutions Examination Council)", description: "Bank financial data, CRA ratings, demographic data. Foundational for banking-side defaults and institution verification.", category: "regulatory" as const,
    ownershipTier: "platform" as const, authMethod: "none" as const,
    baseUrl: "https://cdr.ffiec.gov/public",
    docsUrl: "https://www.ffiec.gov/",
    freeTierDescription: "Completely free. Public access to all financial institution data.",
    freeTierLimit: "Unlimited",
  },
  {
    id: uuid(), slug: "fdic", name: "FDIC BankFind", description: "FDIC-insured institution data: bank financials, failed banks, branch locations, historical data. Foundational for banking analysis and institution verification.", category: "regulatory" as const,
    ownershipTier: "platform" as const, authMethod: "none" as const,
    baseUrl: "https://banks.data.fdic.gov/api",
    docsUrl: "https://banks.data.fdic.gov/docs/",
    freeTierDescription: "Completely free. No API key required. Public access to all FDIC data.",
    freeTierLimit: "Unlimited",
  },
  {
    id: uuid(), slug: "coingecko", name: "CoinGecko", description: "Cryptocurrency market data: prices, market caps, 24h changes, global stats. Covers 10,000+ coins. Essential for digital asset allocation surfaces.", category: "enrichment" as const,
    ownershipTier: "platform" as const, authMethod: "none" as const,
    baseUrl: "https://api.coingecko.com/api/v3",
    docsUrl: "https://docs.coingecko.com/reference/introduction",
    freeTierDescription: "Free public API. No key required. 10-30 req/min rate limit.",
    freeTierLimit: "10-30 req/min",
  },
  {
    id: uuid(), slug: "imf", name: "IMF DataMapper", description: "International Monetary Fund World Economic Outlook data: global GDP growth, inflation rates, current account balances for 190+ countries. Essential for international financial planning.", category: "enrichment" as const,
    ownershipTier: "platform" as const, authMethod: "none" as const,
    baseUrl: "https://www.imf.org/external/datamapper/api/v1",
    docsUrl: "https://www.imf.org/external/datamapper/api/help",
    freeTierDescription: "Completely free. No API key required. Public access to all IMF WEO data.",
    freeTierLimit: "Unlimited",
  },
  {
    id: uuid(), slug: "exchangerate-api", name: "ExchangeRate-API", description: "Real-time and historical foreign exchange rates for 160+ currencies. USD, EUR, GBP base rates with cross-rate calculations and DXY proxy index.", category: "enrichment" as const,
    ownershipTier: "platform" as const, authMethod: "none" as const,
    baseUrl: "https://open.er-api.com/v6",
    docsUrl: "https://www.exchangerate-api.com/docs/overview",
    freeTierDescription: "Free open access endpoint. No API key required. 1,500 requests/month.",
    freeTierLimit: "1,500 req/month",
  },
  {
    // Pass 77: GitHub is the first "developer tool" integration and
    // underpins the Code Chat self-update flow. It lives in the
    // `middleware` category alongside n8n because the enum doesn't
    // have a dedicated VCS slot and extending it would require a
    // migration. Users connect a personal access token through the
    // Integrations page and the codeChat router looks up the
    // credential from `integration_connections` before falling back
    // to the GITHUB_TOKEN env var.
    id: uuid(), slug: "github", name: "GitHub", description: "Connect a GitHub personal access token (PAT) to power the admin Code Chat self-update flow — status, pull requests, and future commit/PR automation.", category: "middleware" as const,
    ownershipTier: "professional" as const, authMethod: "bearer_token" as const,
    baseUrl: "https://api.github.com",
    docsUrl: "https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens",
    signupUrl: "https://github.com/settings/tokens",
    freeTierDescription: "Free for all GitHub accounts. Fine-grained PATs recommended with Contents + Pull requests read/write.",
    freeTierLimit: "Unlimited",
  },
  {
    id: uuid(), slug: "wealthbox", name: "Wealthbox CRM", description: "Financial advisor CRM with contact management, pipeline tracking, and workflow automation. Two-way sync for client data.", category: "crm" as const,
    ownershipTier: "professional" as const, authMethod: "bearer_token" as const,
    baseUrl: "https://api.crmworkspace.com/v1",
    docsUrl: "https://dev.wealthbox.com/",
    signupUrl: "https://www.wealthbox.com/",
    freeTierDescription: "No free tier. Plans from $49/mo per user. API included on all plans.",
    freeTierLimit: "None",
  },
  {
    id: uuid(), slug: "redtail", name: "Redtail CRM", description: "Industry-leading CRM for financial advisors. Contact management, workflow automation, and compliance tracking.", category: "crm" as const,
    ownershipTier: "professional" as const, authMethod: "api_key" as const,
    baseUrl: "https://smf.crm3.redtailtechnology.com/api/public/v1",
    docsUrl: "https://corporate.redtailtechnology.com/api",
    signupUrl: "https://corporate.redtailtechnology.com/",
    freeTierDescription: "No free tier. $99/mo per database (up to 15 users). API included.",
    freeTierLimit: "None",
  },
  {
    id: uuid(), slug: "salesforce", name: "Salesforce Financial Services Cloud", description: "Enterprise CRM with Financial Services Cloud for advisor-client relationship management, pipeline tracking, and compliance workflows.", category: "crm" as const,
    ownershipTier: "professional" as const, authMethod: "oauth2" as const,
    baseUrl: "https://login.salesforce.com",
    docsUrl: "https://developer.salesforce.com/docs",
    signupUrl: "https://www.salesforce.com/financial-services/",
    freeTierDescription: "No free tier. Enterprise pricing. Developer edition available for testing.",
    freeTierLimit: "None",
  },
  {
    id: uuid(), slug: "dripify", name: "Dripify", description: "LinkedIn automation platform for drip campaigns, connection requests, and outreach sequences. CSV export integration for lead pipeline.", category: "marketing" as const,
    ownershipTier: "professional" as const, authMethod: "api_key" as const,
    baseUrl: "https://dripify.io",
    docsUrl: "https://dripify.io/help",
    signupUrl: "https://dripify.io/",
    freeTierDescription: "Free trial available. Plans from $59/mo. CSV export on all plans.",
    freeTierLimit: "7-day trial",
  },
  {
    id: uuid(), slug: "linkedin", name: "LinkedIn / Sales Navigator", description: "Professional networking platform with Sales Navigator for advanced lead search, InMail, and relationship tracking. CSV export for lead lists.", category: "marketing" as const,
    ownershipTier: "professional" as const, authMethod: "oauth2" as const,
    baseUrl: "https://api.linkedin.com/v2",
    docsUrl: "https://learn.microsoft.com/en-us/linkedin/",
    signupUrl: "https://business.linkedin.com/sales-solutions",
    freeTierDescription: "Basic LinkedIn free. Sales Navigator from $99.99/mo. CSV export on Team+ plans.",
    freeTierLimit: "Basic profile access",
  },
  {
    id: uuid(), slug: "workable", name: "Workable", description: "Applicant Tracking System (ATS) for recruiting financial advisors, associates, and operations staff. Pipeline tracking and candidate management.", category: "recruiting" as const,
    ownershipTier: "professional" as const, authMethod: "api_key" as const,
    baseUrl: "https://www.workable.com/spi/v3",
    docsUrl: "https://workable.readme.io/reference",
    signupUrl: "https://www.workable.com/",
    freeTierDescription: "Free trial available. Starter plan from $149/mo. API on Pro+ plans.",
    freeTierLimit: "15-day trial",
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
  const db = await requireDb();
  logger.info( { operation: "seed" },"[Seed] Seeding integration providers...");
  // First, get existing providers by slug to handle upsert correctly
  const existing = await db.select({ id: integrationProviders.id, slug: integrationProviders.slug }).from(integrationProviders);
  const slugToId = new Map(existing.map(e => [e.slug, e.id]));
  let inserted = 0, updated = 0;
  for (const provider of PROVIDERS) {
    try {
      const existingId = slugToId.get(provider.slug);
      if (existingId) {
        // Update existing provider (keep the same ID)
        await db.update(integrationProviders).set({
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
          isActive: true,
        }).where(eq(integrationProviders.slug, provider.slug));
        updated++;
      } else {
        // Insert new provider
        await db.insert(integrationProviders).values(provider);
        inserted++;
      }
    } catch (e) {
      logger.error( { operation: "seed", err: e },`[Seed] Failed to seed provider ${provider.slug}:`, e);
    }
  }
  logger.info( { operation: "seed" },`[Seed] Seeded ${PROVIDERS.length} integration providers (${inserted} new, ${updated} updated).`);
}

export async function seedCarrierTemplates() {
  const db = await requireDb();
  logger.info( { operation: "seed" },"[Seed] Seeding carrier import templates...");
  for (const tmpl of CARRIER_TEMPLATES) {
    try {
      await db.insert(carrierImportTemplates).values(tmpl).onDuplicateKeyUpdate({
        set: { name: tmpl.name },
      });
    } catch (e) {
      logger.error( { operation: "seed", err: e },`[Seed] Failed to seed template ${tmpl.name}:`, e);
    }
  }
  logger.info( { operation: "seed" },`[Seed] Seeded ${CARRIER_TEMPLATES.length} carrier import templates.`);
}

export async function seedAll() {
  await seedIntegrationProviders();
  await seedCarrierTemplates();
}
