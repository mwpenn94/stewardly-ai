import { getDb } from "../db";
import { enrichmentCache } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

// ─── Enrichment Result ──────────────────────────────────────────────────
export interface EnrichmentResult {
  source: string;
  confidence: number;
  data: {
    fullName?: string;
    title?: string;
    company?: string;
    companyDomain?: string;
    linkedinUrl?: string;
    twitterUrl?: string;
    location?: string;
    bio?: string;
    avatar?: string;
    employmentHistory?: Array<{ company: string; title: string; startDate?: string; endDate?: string }>;
    socialProfiles?: Record<string, string>;
    companyInfo?: {
      name?: string;
      domain?: string;
      industry?: string;
      employeeCount?: number;
      revenue?: string;
      description?: string;
      logo?: string;
    };
  };
}

// ─── Clearbit Enrichment ────────────────────────────────────────────────
export async function enrichViaClearbit(email: string, apiKey?: string): Promise<EnrichmentResult | null> {
  if (!apiKey) {
    console.warn("[Enrichment] No Clearbit API key configured");
    return null;
  }
  try {
    const resp = await fetch(`https://person-stream.clearbit.com/v2/combined/find?email=${encodeURIComponent(email)}`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) {
      if (resp.status === 404) return null;
      throw new Error(`Clearbit HTTP ${resp.status}`);
    }
    const data = await resp.json() as any;
    const person = data?.person;
    const company = data?.company;
    return {
      source: "clearbit",
      confidence: 0.85,
      data: {
        fullName: person?.name?.fullName,
        title: person?.employment?.title,
        company: person?.employment?.name,
        companyDomain: person?.employment?.domain,
        linkedinUrl: person?.linkedin?.handle ? `https://linkedin.com/in/${person.linkedin.handle}` : undefined,
        twitterUrl: person?.twitter?.handle ? `https://twitter.com/${person.twitter.handle}` : undefined,
        location: person?.location,
        bio: person?.bio,
        avatar: person?.avatar,
        employmentHistory: person?.employment ? [{
          company: person.employment.name,
          title: person.employment.title,
          startDate: person.employment.startDate,
        }] : [],
        socialProfiles: {
          ...(person?.linkedin?.handle && { linkedin: `https://linkedin.com/in/${person.linkedin.handle}` }),
          ...(person?.twitter?.handle && { twitter: `https://twitter.com/${person.twitter.handle}` }),
          ...(person?.github?.handle && { github: `https://github.com/${person.github.handle}` }),
        },
        companyInfo: company ? {
          name: company.name,
          domain: company.domain,
          industry: company.category?.industry,
          employeeCount: company.metrics?.employees,
          revenue: company.metrics?.estimatedAnnualRevenue,
          description: company.description,
          logo: company.logo,
        } : undefined,
      },
    };
  } catch (err: any) {
    console.error("[Enrichment] Clearbit error:", err.message);
    return null;
  }
}

// ─── FullContact Enrichment ─────────────────────────────────────────────
export async function enrichViaFullContact(email: string, apiKey?: string): Promise<EnrichmentResult | null> {
  if (!apiKey) {
    console.warn("[Enrichment] No FullContact API key configured");
    return null;
  }
  try {
    const resp = await fetch("https://api.fullcontact.com/v3/person.enrich", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) {
      if (resp.status === 404) return null;
      throw new Error(`FullContact HTTP ${resp.status}`);
    }
    const data = await resp.json() as any;
    return {
      source: "fullcontact",
      confidence: 0.75,
      data: {
        fullName: data?.fullName,
        title: data?.title,
        company: data?.organization,
        location: data?.location,
        bio: data?.bio,
        avatar: data?.avatar,
        linkedinUrl: data?.linkedin,
        twitterUrl: data?.twitter,
        socialProfiles: data?.socialProfiles || {},
        employmentHistory: data?.employment?.map((e: any) => ({
          company: e.name,
          title: e.title,
          startDate: e.start?.year?.toString(),
          endDate: e.end?.year?.toString(),
        })) || [],
      },
    };
  } catch (err: any) {
    console.error("[Enrichment] FullContact error:", err.message);
    return null;
  }
}

// ─── Enrichment Waterfall Orchestrator ──────────────────────────────────
// Tries providers in order of data quality, caches results
export async function enrichContact(
  email: string,
  options?: {
    clearbitApiKey?: string;
    fullContactApiKey?: string;
    skipCache?: boolean;
  },
): Promise<EnrichmentResult | null> {
  const db = await getDb();

  // Check cache first
  if (!options?.skipCache && db) {
    const cached = await db.select().from(enrichmentCache)
      .where(eq(enrichmentCache.lookupKey, `email:${email}`))
      .orderBy(desc(enrichmentCache.fetchedAt))
      .limit(1);
    if (cached.length > 0 && cached[0].resultJson) {
      const cacheAge = Date.now() - (cached[0].fetchedAt?.getTime() || 0);
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      if (cacheAge < thirtyDays) {
        return {
          source: cached[0].providerSlug || "cache",
          confidence: parseFloat(String(cached[0].qualityScore || "0.5")),
          data: cached[0].resultJson as any,
        };
      }
    }
  }

  // Waterfall: Clearbit → FullContact
  const providers = [
    { name: "clearbit", fn: () => enrichViaClearbit(email, options?.clearbitApiKey) },
    { name: "fullcontact", fn: () => enrichViaFullContact(email, options?.fullContactApiKey) },
  ];

  for (const provider of providers) {
    const result = await provider.fn();
    if (result && result.data.fullName) {
      // Cache the result
      if (db) {
        const id = crypto.randomUUID();
        await db.insert(enrichmentCache).values({
          id,
          lookupKey: `email:${email}`,
          lookupType: "email",
          providerSlug: provider.name,
          resultJson: result.data,
          qualityScore: String(result.confidence),
          fetchedAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
      }
      return result;
    }
  }

  return null;
}

// ─── Merge enrichment data with existing profile ────────────────────────
export function mergeEnrichmentData(
  existing: Record<string, unknown>,
  enrichment: EnrichmentResult,
): Record<string, unknown> {
  const merged = { ...existing };
  const data = enrichment.data;

  // Only fill in missing fields, don't overwrite existing data
  if (!merged.title && data.title) merged.title = data.title;
  if (!merged.company && data.company) merged.company = data.company;
  if (!merged.linkedinUrl && data.linkedinUrl) merged.linkedinUrl = data.linkedinUrl;
  if (!merged.location && data.location) merged.location = data.location;
  if (!merged.bio && data.bio) merged.bio = data.bio;
  if (!merged.avatar && data.avatar) merged.avatar = data.avatar;
  if (!merged.companyInfo && data.companyInfo) merged.companyInfo = data.companyInfo;

  // Merge social profiles
  const existingSocial = (merged.socialProfiles as Record<string, string>) || {};
  const newSocial = data.socialProfiles || {};
  merged.socialProfiles = { ...newSocial, ...existingSocial }; // existing takes priority

  return merged;
}
