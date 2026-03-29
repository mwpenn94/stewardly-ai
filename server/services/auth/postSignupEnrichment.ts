import { getDb } from "../../db";
import { users, authEnrichmentLog, integrationConnections } from "../../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { profileMerger, ProviderData } from "./profileMerger";
import { apolloService } from "./apolloService";
import { decrypt } from "../encryption";
import crypto from "crypto";
import { logger } from "../../_core/logger";

/**
 * Post-signup enrichment pipeline.
 * Runs asynchronously after ANY sign-in method completes.
 * Fills in gaps using available data sources, from free to limited-quota.
 */
export class PostSignupEnrichment {
  /**
   * Main enrichment entry point — runs all steps in order
   */
  async enrichNewUser(userId: number): Promise<{
    fieldsEnriched: string[];
    completeness: number;
    sources: string[];
  }> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (userRows.length === 0) throw new Error("User not found");
    const user = userRows[0];

    const fieldsEnriched: string[] = [];
    const sources: string[] = [];

    // STEP 1: Census Geographic Enrichment (FREE, instant)
    try {
      const censusResult = await this.censusEnrichment(user);
      if (censusResult) {
        fieldsEnriched.push(...censusResult.fields);
        sources.push("census");
        await profileMerger.mergeProviderData(userId, {
          source: "pdl", // Using pdl as closest match in enum
          fields: censusResult.providerFields,
        });
      }
    } catch (e) {
      logger.warn( { operation: "postSignupEnrichment" },"Census enrichment failed:", e);
    }

    // STEP 2: BLS Occupation Enrichment (FREE, instant)
    try {
      const blsResult = await this.blsEnrichment(user);
      if (blsResult) {
        fieldsEnriched.push(...blsResult.fields);
        sources.push("bls");
        await profileMerger.mergeProviderData(userId, {
          source: "pdl",
          fields: blsResult.providerFields,
        });
      }
    } catch (e) {
      logger.warn( { operation: "postSignupEnrichment" },"BLS enrichment failed:", e);
    }

    // STEP 3: FRED Rate Context (FREE, instant)
    try {
      const fredResult = await this.fredRateContext();
      if (fredResult) {
        fieldsEnriched.push("rate_context");
        sources.push("fred");
        // Store rate context in user's sign-in data for AI conversations
        await db.update(users).set({
          signInDataJson: {
            ...(user.signInDataJson as any || {}),
            rate_context: fredResult,
          },
        }).where(eq(users.id, userId));
      }
    } catch (e) {
      logger.warn( { operation: "postSignupEnrichment" },"FRED enrichment failed:", e);
    }

    // STEP 4: Apollo Enrichment (LIMITED — only if advisor has Apollo key)
    try {
      const apolloResult = await this.apolloEnrichment(userId, user);
      if (apolloResult) {
        fieldsEnriched.push(...apolloResult.fields);
        sources.push("apollo");
      }
    } catch (e) {
      logger.warn( { operation: "postSignupEnrichment" },"Apollo enrichment failed:", e);
    }

    // STEP 5: FINRA BrokerCheck (FREE — if user appears to be a financial professional)
    try {
      const finraResult = await this.finraBrokerCheck(user);
      if (finraResult) {
        fieldsEnriched.push(...finraResult.fields);
        sources.push("finra");
      }
    } catch (e) {
      logger.warn( { operation: "postSignupEnrichment" },"FINRA enrichment failed:", e);
    }

    // Calculate final completeness
    const updatedUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const completeness = profileMerger.calculateCompleteness(
      (updatedUser[0]?.signInDataJson as any) || {}
    );

    // Log results
    await db.insert(authEnrichmentLog).values({
      id: crypto.randomUUID(),
      userId,
      provider: "manus",
      eventType: "manual_enrich",
      fieldsCaptured: fieldsEnriched,
      fieldsNew: fieldsEnriched,
      fieldsUpdated: [],
      rawResponseHash: crypto.createHash("sha256").update(JSON.stringify({ fieldsEnriched, sources })).digest("hex"),
      suitabilityDimensionsUpdated: ["identity_demographics", "financial_position", "experience_knowledge"],
    });

    return { fieldsEnriched, completeness, sources };
  }

  /**
   * STEP 1: Census Geographic Enrichment
   * Uses ZIP code to get neighborhood demographics
   */
  private async censusEnrichment(user: any): Promise<{
    fields: string[];
    providerFields: Record<string, { value: any; confidence: number }>;
  } | null> {
    // Extract ZIP from Google address or LinkedIn location
    const googleAddress = user.googleAddressJson as any;
    const zipCode = googleAddress?.postalCode || null;

    if (!zipCode) return null;

    // In production, query enrichment_cache for census-bureau data
    // For now, return a stub with the ZIP-based inference
    return {
      fields: ["neighborhood_demographics"],
      providerFields: {
        address: {
          value: { zipCode, source: "census", type: "zip_inference" },
          confidence: 0.20,
        },
      },
    };
  }

  /**
   * STEP 2: BLS Occupation Enrichment
   * Maps job title to BLS SOC code and median wage
   */
  private async blsEnrichment(user: any): Promise<{
    fields: string[];
    providerFields: Record<string, { value: any; confidence: number }>;
  } | null> {
    const jobTitle = user.jobTitle || user.linkedinHeadline;
    if (!jobTitle) return null;

    // BLS median wage lookup by occupation category
    // In production, this would query the enrichment_cache for BLS data
    const occupationEstimates: Record<string, number> = {
      "financial advisor": 94170,
      "financial planner": 94170,
      "wealth manager": 105000,
      "portfolio manager": 134180,
      "investment banker": 131710,
      "accountant": 77250,
      "software engineer": 127260,
      "attorney": 135740,
      "physician": 229300,
      "dentist": 163220,
      "pharmacist": 128570,
      "nurse": 81220,
      "teacher": 61690,
      "manager": 102450,
      "director": 115000,
      "vice president": 145000,
      "president": 160000,
      "ceo": 189520,
    };

    const titleLower = jobTitle.toLowerCase();
    let estimatedIncome: number | null = null;

    for (const [key, value] of Object.entries(occupationEstimates)) {
      if (titleLower.includes(key)) {
        estimatedIncome = value;
        break;
      }
    }

    if (!estimatedIncome) return null;

    return {
      fields: ["estimated_income"],
      providerFields: {
        income: {
          value: { estimated: estimatedIncome, source: "bls_median", occupation: titleLower },
          confidence: 0.35,
        },
      },
    };
  }

  /**
   * STEP 3: FRED Rate Context
   * Provides current economic rate environment for AI conversations
   */
  private async fredRateContext(): Promise<Record<string, any> | null> {
    // In production, query enrichment_cache for current FRED rates
    // Return stub with typical rate context
    return {
      fedFundsRate: "5.25-5.50%",
      thirtyYearMortgage: "6.75%",
      tenYearTreasury: "4.25%",
      sp500YTD: "+8.2%",
      inflation: "3.1%",
      lastUpdated: new Date().toISOString(),
      source: "fred_cache",
    };
  }

  /**
   * STEP 4: Apollo Enrichment
   * Only runs if the user's advisor has an Apollo API key configured
   */
  private async apolloEnrichment(userId: number, user: any): Promise<{
    fields: string[];
  } | null> {
    const db = await getDb();
    if (!db) return null;

    // Find if user has an advisor with Apollo connection
    // This would check the user's org and advisor's connections
    const apolloConnections = await db
      .select()
      .from(integrationConnections)
      .where(
        eq(integrationConnections.providerId, "apollo")
      )
      .limit(1);

    if (apolloConnections.length === 0) return null;

    const connection = apolloConnections[0];
    const creds = connection.credentialsEncrypted;
    if (!creds) return null;

    try {
      const apiKey = decrypt(creds);
      const result = await apolloService.enrichPerson(apiKey, {
        email: user.email || undefined,
        firstName: user.name?.split(" ")[0],
        lastName: user.name?.split(" ").slice(1).join(" "),
      });

      if (!result) return null;

      const fields: string[] = [];
      const providerFields: Record<string, { value: any; confidence: number }> = {};

      if (result.title) {
        fields.push("job_title");
        providerFields.job_title = { value: result.title, confidence: 0.80 };
      }
      if (result.organization?.name) {
        fields.push("employer");
        providerFields.employer = { value: result.organization.name, confidence: 0.80 };
      }
      if (result.phoneNumbers?.length > 0) {
        fields.push("phone");
        providerFields.phone = {
          value: result.phoneNumbers[0].sanitizedNumber,
          confidence: 0.85,
        };
      }
      if (result.email && result.emailStatus === "verified") {
        fields.push("verified_email");
        providerFields.email = { value: result.email, confidence: 0.90 };
      }

      if (fields.length > 0) {
        await profileMerger.mergeProviderData(userId, {
          source: "apollo",
          fields: providerFields,
        });
      }

      return { fields };
    } catch {
      return null;
    }
  }

  /**
   * STEP 5: FINRA BrokerCheck
   * Checks if user appears to be a financial professional
   */
  private async finraBrokerCheck(user: any): Promise<{
    fields: string[];
  } | null> {
    const title = (user.jobTitle || user.linkedinHeadline || "").toLowerCase();

    // Check if title suggests financial professional
    const financialTitles = [
      "advisor", "planner", "agent", "broker", "representative",
      "cfp", "clu", "chfc", "cfa", "registered representative",
      "financial consultant", "wealth advisor",
    ];

    const isFinancialPro = financialTitles.some((t) => title.includes(t));
    if (!isFinancialPro) return null;

    // In production, search FINRA BrokerCheck API
    // https://brokercheck.finra.org/
    // For now, flag the user as a potential financial professional
    return {
      fields: ["potential_financial_professional"],
    };
  }
}

export const postSignupEnrichment = new PostSignupEnrichment();
