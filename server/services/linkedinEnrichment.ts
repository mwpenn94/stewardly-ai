/**
 * LinkedIn Enrichment Service
 * 
 * Uses Manus Data API to enrich leads with LinkedIn profile data.
 * No user credentials needed — works via the built-in Data API Hub.
 * 
 * Capabilities:
 * - Profile lookup by username (get full profile data)
 * - People search by keywords, company, title, name
 * - Company details lookup
 * - Lead enrichment (match leads to LinkedIn profiles)
 */
import { callDataApi } from "../_core/dataApi";
import { logger } from "../_core/logger";
import { requireDb, getRawPool } from "../db";
import crypto from "crypto";

const log = logger.child({ service: "linkedinEnrichment" });

// ─── Types ─────────────────────────────────────────────────────────────

export interface LinkedInProfile {
  username: string;
  firstName: string;
  lastName: string;
  headline: string;
  summary: string;
  location: string;
  profileUrl: string;
  profilePicture: string;
  isOpenToWork: boolean;
  isPremium: boolean;
  followerCount: number;
  connectionCount: number;
  positions: Array<{
    title: string;
    companyName: string;
    startYear: number;
    endYear: number | null;
    isCurrent: boolean;
  }>;
  educations: Array<{
    schoolName: string;
    degree: string;
    fieldOfStudy: string;
  }>;
  skills: Array<{ name: string; endorsements: number }>;
}

export interface LinkedInSearchResult {
  fullName: string;
  headline: string;
  location: string;
  profileUrl: string;
  username: string;
  profilePicture: string;
}

export interface EnrichmentResult {
  leadId: string;
  matched: boolean;
  profile: LinkedInProfile | null;
  confidence: number;
  enrichedFields: string[];
}

// ─── Profile Lookup ────────────────────────────────────────────────────

export async function getLinkedInProfile(username: string): Promise<LinkedInProfile | null> {
  try {
    const data = await callDataApi("LinkedIn/get_user_profile_by_username", {
      query: { username },
    }) as any;

    if (!data || data.error || (!data.username && !data.id && !data.firstName)) {
      log.warn({ username }, "[LinkedIn] Profile not found or API error");
      return null;
    }

    // Handle both direct response and wrapped response
    const profile = data.data || data;

    return {
      username: profile.username || username,
      firstName: profile.firstName || "",
      lastName: profile.lastName || "",
      headline: profile.headline || "",
      summary: profile.summary || "",
      location: profile.geo?.full || profile.location || "",
      profileUrl: `https://linkedin.com/in/${profile.username || username}`,
      profilePicture: profile.profilePicture || "",
      isOpenToWork: !!profile.isOpenToWork,
      isPremium: !!profile.isPremium,
      followerCount: profile.followerCount || 0,
      connectionCount: profile.connectionCount || 0,
      positions: (profile.position || []).map((p: any) => ({
        title: p.title || "",
        companyName: p.companyName || "",
        startYear: p.start?.year || 0,
        endYear: p.end?.year || null,
        isCurrent: !p.end?.year || p.end.year === 0,
      })),
      educations: (profile.educations || []).map((e: any) => ({
        schoolName: e.schoolName || "",
        degree: e.degree || "",
        fieldOfStudy: e.fieldOfStudy || "",
      })),
      skills: (profile.skills || []).map((s: any) => ({
        name: s.name || "",
        endorsements: s.endorsementsCount || 0,
      })),
    };
  } catch (err: any) {
    log.error({ err, username }, "[LinkedIn] Profile lookup failed");
    return null;
  }
}

// ─── People Search ─────────────────────────────────────────────────────

export async function searchLinkedInPeople(params: {
  keywords?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  title?: string;
  school?: string;
  start?: number;
}): Promise<{ results: LinkedInSearchResult[]; total: number }> {
  try {
    const query: Record<string, unknown> = {};
    if (params.keywords) query.keywords = params.keywords;
    if (params.firstName) query.firstName = params.firstName;
    if (params.lastName) query.lastName = params.lastName;
    if (params.company) query.company = params.company;
    if (params.title) query.keywordTitle = params.title;
    if (params.school) query.keywordSchool = params.school;
    if (params.start !== undefined) query.start = String(params.start);

    const data = await callDataApi("LinkedIn/search_people", { query }) as any;

    if (!data || !data.success) {
      return { results: [], total: 0 };
    }

    const items = data.data?.items || [];
    const total = data.data?.total || 0;

    return {
      results: items.map((p: any) => ({
        fullName: p.fullName || "",
        headline: p.headline || "",
        location: p.location || "",
        profileUrl: p.profileURL || "",
        username: p.username || "",
        profilePicture: p.profilePicture || "",
      })),
      total,
    };
  } catch (err: any) {
    log.error({ err }, "[LinkedIn] People search failed");
    return { results: [], total: 0 };
  }
}

// ─── Company Details ───────────────────────────────────────────────────

export async function getCompanyDetails(companyUsername: string): Promise<any> {
  try {
    const data = await callDataApi("LinkedIn/get_company_details", {
      query: { username: companyUsername },
    }) as any;

    if (!data || !data.success) return null;
    return data.data || null;
  } catch (err: any) {
    log.error({ err, companyUsername }, "[LinkedIn] Company lookup failed");
    return null;
  }
}

// ─── Lead Enrichment ───────────────────────────────────────────────────

/**
 * Enrich a lead from lead_pipeline with LinkedIn profile data.
 * Tries multiple matching strategies:
 * 1. If lead has a LinkedIn URL, extract username and fetch directly
 * 2. Search by name + company
 * 3. Search by name + title
 */
export async function enrichLead(leadId: string): Promise<EnrichmentResult> {
  const pool = await getRawPool();
  const [rows] = await pool.execute(
    "SELECT id, firstName, lastName, email, company, title, linkedinUrl, source FROM lead_pipeline WHERE id = ?",
    [leadId]
  ) as any;

  if (!rows || rows.length === 0) {
    return { leadId, matched: false, profile: null, confidence: 0, enrichedFields: [] };
  }

  const lead = rows[0];
  let profile: LinkedInProfile | null = null;
  let confidence = 0;

  // Strategy 1: Direct username from LinkedIn URL
  if (lead.linkedinUrl) {
    const username = extractLinkedInUsername(lead.linkedinUrl);
    if (username) {
      profile = await getLinkedInProfile(username);
      if (profile) confidence = 0.95;
    }
  }

  // Strategy 2: Search by name + company
  if (!profile && lead.firstName && lead.lastName) {
    const searchResults = await searchLinkedInPeople({
      firstName: lead.firstName,
      lastName: lead.lastName,
      company: lead.company || undefined,
    });

    if (searchResults.results.length > 0) {
      const bestMatch = searchResults.results[0];
      // Verify name match
      const nameMatch = bestMatch.fullName.toLowerCase().includes(lead.firstName.toLowerCase()) &&
                        bestMatch.fullName.toLowerCase().includes(lead.lastName.toLowerCase());
      if (nameMatch && bestMatch.username) {
        profile = await getLinkedInProfile(bestMatch.username);
        confidence = lead.company && bestMatch.headline?.toLowerCase().includes(lead.company.toLowerCase())
          ? 0.85 : 0.65;
      }
    }
  }

  // Strategy 3: Search by name + title
  if (!profile && lead.firstName && lead.lastName && lead.title) {
    const searchResults = await searchLinkedInPeople({
      firstName: lead.firstName,
      lastName: lead.lastName,
      title: lead.title,
    });

    if (searchResults.results.length > 0) {
      const bestMatch = searchResults.results[0];
      const nameMatch = bestMatch.fullName.toLowerCase().includes(lead.firstName.toLowerCase()) &&
                        bestMatch.fullName.toLowerCase().includes(lead.lastName.toLowerCase());
      if (nameMatch && bestMatch.username) {
        profile = await getLinkedInProfile(bestMatch.username);
        confidence = 0.55;
      }
    }
  }

  if (!profile) {
    return { leadId, matched: false, profile: null, confidence: 0, enrichedFields: [] };
  }

  // Update lead_pipeline with enriched data
  const enrichedFields: string[] = [];
  const updates: string[] = [];
  const values: any[] = [];

  if (profile.profileUrl && !lead.linkedinUrl) {
    updates.push("linkedinUrl = ?");
    values.push(profile.profileUrl);
    enrichedFields.push("linkedinUrl");
  }
  if (profile.headline && !lead.title) {
    updates.push("title = ?");
    values.push(profile.headline);
    enrichedFields.push("title");
  }
  if (profile.positions.length > 0 && !lead.company) {
    const currentPos = profile.positions.find(p => p.isCurrent) || profile.positions[0];
    updates.push("company = ?");
    values.push(currentPos.companyName);
    enrichedFields.push("company");
  }

  // Store full profile in customFields JSON
  const customFields = {
    linkedin_enriched: true,
    linkedin_enriched_at: Date.now(),
    linkedin_confidence: confidence,
    linkedin_headline: profile.headline,
    linkedin_location: profile.location,
    linkedin_followers: profile.followerCount,
    linkedin_connections: profile.connectionCount,
    linkedin_open_to_work: profile.isOpenToWork,
    linkedin_skills: profile.skills.slice(0, 10).map(s => s.name),
    linkedin_current_position: profile.positions.find(p => p.isCurrent) || null,
    linkedin_education: profile.educations.slice(0, 3),
  };
  updates.push("customFields = JSON_MERGE_PATCH(COALESCE(customFields, '{}'), ?)");
  values.push(JSON.stringify(customFields));
  enrichedFields.push("customFields");

  if (updates.length > 0) {
    values.push(leadId);
    await pool.execute(
      `UPDATE lead_pipeline SET ${updates.join(", ")} WHERE id = ?`,
      values
    );
    log.info({ leadId, enrichedFields, confidence }, "[LinkedIn] Lead enriched");
  }

  return { leadId, matched: true, profile, confidence, enrichedFields };
}

/**
 * Batch enrich leads that haven't been enriched yet.
 * Processes up to `limit` leads per batch.
 */
export async function batchEnrichLeads(limit: number = 10): Promise<{
  processed: number;
  enriched: number;
  failed: number;
  results: EnrichmentResult[];
}> {
  const pool = await getRawPool();
  
  // Find leads without LinkedIn enrichment
  const [rows] = await pool.execute(
    `SELECT id FROM lead_pipeline 
     WHERE (customFields IS NULL OR JSON_EXTRACT(customFields, '$.linkedin_enriched') IS NULL)
     AND status != 'disqualified'
     ORDER BY createdAt DESC
     LIMIT ?`,
    [limit]
  ) as any;

  const results: EnrichmentResult[] = [];
  let enriched = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const result = await enrichLead(row.id);
      results.push(result);
      if (result.matched) enriched++;
      else failed++;
      
      // Rate limit: 1 request per 2 seconds to avoid API throttling
      await new Promise(r => setTimeout(r, 2000));
    } catch (err: any) {
      log.error({ err, leadId: row.id }, "[LinkedIn] Batch enrich error");
      failed++;
      results.push({ leadId: row.id, matched: false, profile: null, confidence: 0, enrichedFields: [] });
    }
  }

  return { processed: rows.length, enriched, failed, results };
}

// ─── Helpers ───────────────────────────────────────────────────────────

function extractLinkedInUsername(url: string): string | null {
  if (!url) return null;
  // Handle various LinkedIn URL formats
  const patterns = [
    /linkedin\.com\/in\/([^/?#]+)/,
    /linkedin\.com\/pub\/([^/?#]+)/,
    /linkedin\.com\/profile\/view\?id=([^&]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  // If it's just a username (no URL)
  if (!url.includes("/") && !url.includes(".")) return url;
  return null;
}
