/**
 * FullContact Enrichment — Env-gated stub for contact enrichment
 * Activate by setting FULLCONTACT_API_KEY environment variable
 */
import { logger } from "../../_core/logger";

const log = logger.child({ module: "fullContactEnrichment" });

export interface FullContactProfile {
  fullName: string | null;
  age: string | null;
  gender: string | null;
  location: string | null;
  title: string | null;
  organization: string | null;
  socialProfiles: Array<{ network: string; url: string }>;
  interests: string[];
}

function getApiKey(): string | null {
  return process.env.FULLCONTACT_API_KEY || null;
}

export async function enrichByEmail(email: string): Promise<FullContactProfile | null> {
  const key = getApiKey();
  if (!key) {
    log.debug("FULLCONTACT_API_KEY not set — skipping enrichment");
    return null;
  }

  try {
    const res = await fetch("https://api.fullcontact.com/v3/person.enrich", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      log.warn({ status: res.status, email }, "FullContact lookup failed");
      return null;
    }

    const data = await res.json();
    return {
      fullName: data.fullName || null,
      age: data.ageRange || null,
      gender: data.gender || null,
      location: data.location || null,
      title: data.title || null,
      organization: data.organization || null,
      socialProfiles: (data.socialProfiles || []).map((p: any) => ({ network: p.network, url: p.url })),
      interests: data.interests || [],
    };
  } catch (e: any) {
    log.error({ error: e.message, email }, "FullContact enrichment error");
    return null;
  }
}

export async function enrichByPhone(phone: string): Promise<FullContactProfile | null> {
  const key = getApiKey();
  if (!key) return null;

  try {
    const res = await fetch("https://api.fullcontact.com/v3/person.enrich", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return {
      fullName: data.fullName || null, age: data.ageRange || null, gender: data.gender || null,
      location: data.location || null, title: data.title || null, organization: data.organization || null,
      socialProfiles: [], interests: [],
    };
  } catch (e: any) {
    log.error({ error: e.message }, "FullContact phone enrichment error");
    return null;
  }
}
