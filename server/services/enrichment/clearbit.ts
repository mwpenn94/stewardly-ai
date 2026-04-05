/**
 * Clearbit Enrichment — Env-gated stub for company/person enrichment
 * Activate by setting CLEARBIT_API_KEY environment variable
 */
import { logger } from "../../_core/logger";

const log = logger.child({ module: "clearbitEnrichment" });

export interface ClearbitPerson {
  fullName: string | null;
  title: string | null;
  company: string | null;
  linkedIn: string | null;
  location: string | null;
  estimatedIncome: string | null;
}

export interface ClearbitCompany {
  name: string | null;
  domain: string | null;
  industry: string | null;
  employeeCount: number | null;
  revenue: string | null;
  location: string | null;
}

function getApiKey(): string | null {
  return process.env.CLEARBIT_API_KEY || null;
}

export async function enrichPerson(email: string): Promise<ClearbitPerson | null> {
  const key = getApiKey();
  if (!key) {
    log.debug("CLEARBIT_API_KEY not set — skipping person enrichment");
    return null;
  }

  try {
    const res = await fetch(`https://person.clearbit.com/v2/people/find?email=${encodeURIComponent(email)}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      log.warn({ status: res.status, email }, "Clearbit person lookup failed");
      return null;
    }

    const data = await res.json();
    return {
      fullName: data.name?.fullName || null,
      title: data.employment?.title || null,
      company: data.employment?.name || null,
      linkedIn: data.linkedin?.handle ? `https://linkedin.com/in/${data.linkedin.handle}` : null,
      location: data.geo?.city ? `${data.geo.city}, ${data.geo.state}` : null,
      estimatedIncome: null, // Clearbit doesn't provide this directly
    };
  } catch (e: any) {
    log.error({ error: e.message, email }, "Clearbit person enrichment error");
    return null;
  }
}

export async function enrichCompany(domain: string): Promise<ClearbitCompany | null> {
  const key = getApiKey();
  if (!key) {
    log.debug("CLEARBIT_API_KEY not set — skipping company enrichment");
    return null;
  }

  try {
    const res = await fetch(`https://company.clearbit.com/v2/companies/find?domain=${encodeURIComponent(domain)}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return {
      name: data.name || null, domain: data.domain || null,
      industry: data.category?.industry || null,
      employeeCount: data.metrics?.employees || null,
      revenue: data.metrics?.estimatedAnnualRevenue || null,
      location: data.geo?.city ? `${data.geo.city}, ${data.geo.state}` : null,
    };
  } catch (e: any) {
    log.error({ error: e.message, domain }, "Clearbit company enrichment error");
    return null;
  }
}
