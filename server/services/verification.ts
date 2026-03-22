import { getDb } from "../db";
import {
  professionalVerifications,
  coiVerificationBadges,
  verificationSchedules,
  premiumFinanceRates,
  professionals,
  type InsertProfessionalVerification,
  type InsertCoiVerificationBadge,
} from "../../drizzle/schema";
import { eq, and, desc, lte, sql } from "drizzle-orm";
import { ENV } from "../_core/env";

// ─── Types ──────────────────────────────────────────────────────────────
export type VerificationSource =
  | "finra_brokercheck" | "sec_iapd" | "cfp_board" | "nasba_cpaverify"
  | "nipr_pdb" | "nmls" | "state_bar" | "ibba" | "martindale" | "avvo";

export type VerificationStatus = "verified" | "not_found" | "flagged" | "expired" | "pending";

export interface VerificationResult {
  source: VerificationSource;
  status: VerificationStatus;
  externalId?: string;
  externalUrl?: string;
  rawData?: Record<string, unknown>;
  disclosures?: Array<Record<string, unknown>>;
  licenseStates?: string[];
  licenseExpiration?: Date | null;
  badges?: Array<{ type: string; label: string; data?: Record<string, unknown> }>;
}

// ─── SEC IAPD Verification ──────────────────────────────────────────────
// Free API: adviserinfo.sec.gov
export async function verifySECIAPD(name: string, crdNumber?: string): Promise<VerificationResult> {
  try {
    const searchParam = crdNumber || name;
    const url = `https://api.adviserinfo.sec.gov/search/individual?query=${encodeURIComponent(searchParam)}&hl=true&nrows=10&start=0`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "Stewardly/1.0 (professional-verification)" },
    });
    if (!resp.ok) throw new Error(`SEC IAPD HTTP ${resp.status}`);
    const data = await resp.json() as any;
    const hits = data?.hits?.hits || [];
    if (hits.length === 0) {
      return { source: "sec_iapd", status: "not_found" };
    }
    const best = hits[0]._source || {};
    const disclosures = (best.disc_rp_dtls || []).map((d: any) => ({
      type: d.disc_type,
      date: d.disc_dtl_dt,
      description: d.disc_dtl_desc,
    }));
    const hasDisclosures = disclosures.length > 0;
    const badges: VerificationResult["badges"] = [];
    if (best.ia_reg === "Y") badges.push({ type: "fiduciary", label: "SEC Registered Investment Adviser" });
    if (!hasDisclosures) badges.push({ type: "no_disclosures", label: "No Disclosures" });
    return {
      source: "sec_iapd",
      status: hasDisclosures ? "flagged" : "verified",
      externalId: best.indvl_pk || crdNumber,
      externalUrl: crdNumber
        ? `https://adviserinfo.sec.gov/individual/summary/${crdNumber}`
        : `https://adviserinfo.sec.gov`,
      rawData: best,
      disclosures,
      licenseStates: best.ia_states ? best.ia_states.split(",").map((s: string) => s.trim()) : [],
      badges,
    };
  } catch (err: any) {
    console.error("[Verification] SEC IAPD error:", err.message);
    return { source: "sec_iapd", status: "pending", rawData: { error: err.message } };
  }
}

// ─── CFP Board Verification ─────────────────────────────────────────────
// cfp.net/verify - web lookup (no public API, use search endpoint)
export async function verifyCFPBoard(name: string, state?: string): Promise<VerificationResult> {
  try {
    const params = new URLSearchParams({ name });
    if (state) params.set("state", state);
    const url = `https://www.cfp.net/verify-a-cfp-professional/results?${params.toString()}`;
    // CFP Board doesn't have a public API; we store the lookup URL for manual verification
    // and attempt a basic search via their public-facing endpoint
    const searchUrl = `https://www.cfp.net/api/v1/verify?name=${encodeURIComponent(name)}${state ? `&state=${encodeURIComponent(state)}` : ""}`;
    try {
      const resp = await fetch(searchUrl, {
        headers: { "User-Agent": "Stewardly/1.0", "Accept": "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      if (resp.ok) {
        const data = await resp.json() as any;
        const results = data?.results || data?.data || [];
        if (Array.isArray(results) && results.length > 0) {
          return {
            source: "cfp_board",
            status: "verified",
            externalUrl: url,
            rawData: results[0],
            badges: [{ type: "cfp_certified", label: "CFP\u00AE Certified" }],
          };
        }
      }
    } catch {
      // API not available, fall through to manual lookup
    }
    // Return pending with manual verification URL
    return {
      source: "cfp_board",
      status: "pending",
      externalUrl: url,
      rawData: { manualVerificationRequired: true, lookupUrl: url },
    };
  } catch (err: any) {
    console.error("[Verification] CFP Board error:", err.message);
    return { source: "cfp_board", status: "pending", rawData: { error: err.message } };
  }
}

// ─── NASBA CPAverify ────────────────────────────────────────────────────
export async function verifyNASBA(name: string, state?: string): Promise<VerificationResult> {
  try {
    const url = `https://cpaverify.org/`;
    // NASBA CPAverify doesn't have a public API
    // Provide lookup URL for manual or n8n-driven verification
    return {
      source: "nasba_cpaverify",
      status: "pending",
      externalUrl: url,
      rawData: { manualVerificationRequired: true, searchName: name, state },
      badges: [],
    };
  } catch (err: any) {
    return { source: "nasba_cpaverify", status: "pending", rawData: { error: err.message } };
  }
}

// ─── NMLS Consumer Access ───────────────────────────────────────────────
export async function verifyNMLS(nmlsId: string): Promise<VerificationResult> {
  try {
    const url = `https://www.nmlsconsumeraccess.org/TuringTestPage.aspx?ReturnUrl=/EntityDetails.aspx/COMPANY/${nmlsId}`;
    // NMLS requires CAPTCHA for web access; provide lookup URL
    return {
      source: "nmls",
      status: "pending",
      externalId: nmlsId,
      externalUrl: `https://www.nmlsconsumeraccess.org/EntityDetails.aspx/COMPANY/${nmlsId}`,
      rawData: { manualVerificationRequired: true, nmlsId },
    };
  } catch (err: any) {
    return { source: "nmls", status: "pending", rawData: { error: err.message } };
  }
}

// ─── State Bar Verification ─────────────────────────────────────────────
const STATE_BAR_URLS: Record<string, string> = {
  CA: "https://apps.calbar.ca.gov/attorney/LicenseeSearch/QuickSearch",
  NY: "https://iapps.courts.state.ny.us/attorneyservices/search",
  TX: "https://www.texasbar.com/AM/Template.cfm?Section=Find_A_Lawyer",
  FL: "https://www.floridabar.org/directories/find-mbr/",
  IL: "https://www.iardc.org/ldetail.asp",
  PA: "https://www.padisciplinaryboard.org/for-the-public/find-attorney",
  OH: "https://www.supremecourt.ohio.gov/AttorneySearch/",
  GA: "https://www.gabar.org/membersearchresults.cfm",
  NJ: "https://portal.njcourts.gov/webe5/AttorneyRegPublic/",
  AZ: "https://www.azbar.org/for-the-public/find-a-lawyer/",
};

export async function verifyStateBar(name: string, state: string, barNumber?: string): Promise<VerificationResult> {
  const stateUpper = state.toUpperCase();
  const lookupUrl = STATE_BAR_URLS[stateUpper] || `https://www.google.com/search?q=${encodeURIComponent(`${state} state bar attorney search ${name}`)}`;
  return {
    source: "state_bar",
    status: "pending",
    externalId: barNumber,
    externalUrl: lookupUrl,
    rawData: { manualVerificationRequired: true, state: stateUpper, name, barNumber },
  };
}

// ─── SOFR / Treasury Rate Fetcher ───────────────────────────────────────
// Uses FRED API (free, already have key from data pipelines)
export async function fetchPremiumFinanceRates(): Promise<{
  sofr?: number; sofr30?: number; sofr90?: number;
  treasury10y?: number; treasury30y?: number; primeRate?: number;
}> {
  const fredApiKey = process.env.FRED_API_KEY;
  if (!fredApiKey) {
    console.warn("[Verification] No FRED API key for rate fetching");
    return {};
  }
  const seriesMap: Record<string, string> = {
    sofr: "SOFR",
    sofr30: "SOFR30DAYAVG",
    sofr90: "SOFR90DAYAVG",
    treasury10y: "DGS10",
    treasury30y: "DGS30",
    primeRate: "DPRIME",
  };
  const rates: Record<string, number> = {};
  for (const [key, seriesId] of Object.entries(seriesMap)) {
    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${fredApiKey}&file_type=json&sort_order=desc&limit=1`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (resp.ok) {
        const data = await resp.json() as any;
        const obs = data?.observations?.[0];
        if (obs && obs.value !== ".") {
          rates[key] = parseFloat(obs.value);
        }
      }
    } catch (err) {
      console.warn(`[Verification] FRED ${seriesId} fetch failed:`, err);
    }
  }
  return rates;
}

// ─── Subscription/Partnership Providers (Phase 3) ───────────────────────
export async function verifyNIPR(_name: string, _state: string, _npn?: string): Promise<VerificationResult> {
  return {
    source: "nipr_pdb",
    status: "pending",
    rawData: { requiresSubscription: true, provider: "NIPR Producer Database" },
    externalUrl: "https://pdb.nipr.com/",
  };
}

export async function verifyMartindale(name: string, state?: string): Promise<VerificationResult> {
  const searchUrl = `https://www.martindale.com/search/attorneys/?term=${encodeURIComponent(name)}${state ? `&state=${encodeURIComponent(state)}` : ""}`;
  return {
    source: "martindale",
    status: "pending",
    externalUrl: searchUrl,
    rawData: { manualVerificationRequired: true, lookupUrl: searchUrl },
  };
}

export async function verifyAvvo(name: string, state?: string): Promise<VerificationResult> {
  const searchUrl = `https://www.avvo.com/search/lawyer_search?q=${encodeURIComponent(name)}${state ? `&loc=${encodeURIComponent(state)}` : ""}`;
  return {
    source: "martindale", // Avvo uses martindale source enum
    status: "pending",
    externalUrl: searchUrl,
    rawData: { manualVerificationRequired: true, lookupUrl: searchUrl, provider: "avvo" },
  };
}

export async function verifyIBBA(name: string): Promise<VerificationResult> {
  return {
    source: "ibba",
    status: "pending",
    externalUrl: "https://www.ibba.org/find-a-business-broker/",
    rawData: { manualVerificationRequired: true, searchName: name },
  };
}

// ─── Orchestrator: Run All Applicable Verifications ─────────────────────
export async function runVerification(
  professionalId: number,
  name: string,
  credentials: string[],
  state?: string,
  crdNumber?: string,
  nmlsId?: string,
  barNumber?: string,
): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];
  const credSet = new Set(credentials.map(c => c.toLowerCase()));

  // Always run SEC IAPD for financial professionals
  if (credSet.has("cfp") || credSet.has("cfa") || credSet.has("chfc") || credSet.has("series 7") || credSet.has("series 66") || crdNumber) {
    results.push(await verifySECIAPD(name, crdNumber));
  }

  // CFP Board
  if (credSet.has("cfp")) {
    results.push(await verifyCFPBoard(name, state));
  }

  // CPA
  if (credSet.has("cpa")) {
    results.push(await verifyNASBA(name, state));
  }

  // NMLS for mortgage/insurance
  if (nmlsId || credSet.has("nmls") || credSet.has("mortgage")) {
    results.push(await verifyNMLS(nmlsId || ""));
  }

  // State Bar for attorneys
  if (credSet.has("jd") || credSet.has("esq") || credSet.has("attorney") || barNumber) {
    results.push(await verifyStateBar(name, state || "CA", barNumber));
  }

  // NIPR for insurance
  if (credSet.has("clu") || credSet.has("ricp") || credSet.has("life & health") || credSet.has("insurance")) {
    results.push(await verifyNIPR(name, state || "", undefined));
  }

  return results;
}

// ─── DB Helpers ─────────────────────────────────────────────────────────
export async function saveVerificationResult(
  professionalId: number,
  result: VerificationResult,
  method: "api" | "scrape" | "manual" | "n8n_workflow" = "api",
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const now = Date.now();
  const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 days default
  const [inserted] = await db.insert(professionalVerifications).values({
    professionalId,
    verificationSource: result.source,
    verificationStatus: result.status,
    externalId: result.externalId || null,
    externalUrl: result.externalUrl || null,
    rawData: result.rawData || null,
    disclosures: result.disclosures || null,
    licenseStates: result.licenseStates || null,
    licenseExpiration: result.licenseExpiration || null,
    verifiedAt: now,
    expiresAt,
    verificationMethod: method,
  });
  return (inserted as any).insertId;
}

export async function saveBadges(
  professionalId: number,
  badges: Array<{ type: string; label: string; data?: Record<string, unknown> }>,
  verificationId: number,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const now = Date.now();
  const expiresAt = now + 30 * 24 * 60 * 60 * 1000;
  for (const badge of badges) {
    await db.insert(coiVerificationBadges).values({
      professionalId,
      badgeType: badge.type as any,
      badgeLabel: badge.label,
      badgeData: badge.data || null,
      confidenceScore: "0.90",
      sourceVerificationId: verificationId,
      grantedAt: now,
      expiresAt,
    });
  }
}

export async function getVerificationsForProfessional(professionalId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(professionalVerifications)
    .where(eq(professionalVerifications.professionalId, professionalId))
    .orderBy(desc(professionalVerifications.verifiedAt));
}

export async function getBadgesForProfessional(professionalId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(coiVerificationBadges)
    .where(and(
      eq(coiVerificationBadges.professionalId, professionalId),
      eq(coiVerificationBadges.active, true),
    ))
    .orderBy(desc(coiVerificationBadges.grantedAt));
}

export async function getLatestRates() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(premiumFinanceRates)
    .orderBy(desc(premiumFinanceRates.rateDate))
    .limit(1);
  return rows[0] || null;
}

export async function savePremiumFinanceRates(rates: Record<string, number | undefined>) {
  const db = await getDb();
  if (!db) return;
  const today = new Date().toISOString().split("T")[0];
  await db.insert(premiumFinanceRates).values({
    rateDate: new Date(today),
    sofr: rates.sofr?.toString() || null,
    sofr30: rates.sofr30?.toString() || null,
    sofr90: rates.sofr90?.toString() || null,
    treasury10y: rates.treasury10y?.toString() || null,
    treasury30y: rates.treasury30y?.toString() || null,
    primeRate: rates.primeRate?.toString() || null,
    fetchedAt: Date.now(),
  }).onDuplicateKeyUpdate({
    set: {
      sofr: sql`VALUES(sofr)`,
      sofr30: sql`VALUES(sofr_30)`,
      sofr90: sql`VALUES(sofr_90)`,
      treasury10y: sql`VALUES(treasury_10y)`,
      treasury30y: sql`VALUES(treasury_30y)`,
      primeRate: sql`VALUES(prime_rate)`,
      fetchedAt: sql`VALUES(fetched_at)`,
    },
  });
}

export async function scheduleVerification(
  professionalId: number,
  source: VerificationSource,
  frequencyDays: number = 30,
) {
  const db = await getDb();
  if (!db) return;
  const nextRun = Date.now() + frequencyDays * 24 * 60 * 60 * 1000;
  await db.insert(verificationSchedules).values({
    professionalId,
    verificationSource: source,
    frequencyDays,
    nextRunAt: nextRun,
  });
}

export async function getDueVerifications() {
  const db = await getDb();
  if (!db) return [];
  const now = Date.now();
  return db.select().from(verificationSchedules)
    .where(and(
      eq(verificationSchedules.enabled, true),
      lte(verificationSchedules.nextRunAt, now),
    ));
}
