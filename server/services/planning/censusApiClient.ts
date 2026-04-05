/**
 * Census API Client — Fetch demographic data from US Census Bureau API
 * Env-gated: requires CENSUS_API_KEY
 */
import { logger } from "../../_core/logger";

const log = logger.child({ module: "censusApiClient" });

const CENSUS_BASE = "https://api.census.gov/data";

export interface DemographicData {
  zipCode: string;
  medianIncome: number | null;
  medianAge: number | null;
  totalPopulation: number | null;
  homeownershipRate: number | null;
  medianHomeValue: number | null;
  educationBachelorPlus: number | null;
}

function getApiKey(): string | null {
  return process.env.CENSUS_API_KEY || null;
}

export async function fetchDemographicsByZip(zipCode: string): Promise<DemographicData> {
  const apiKey = getApiKey();
  const empty: DemographicData = {
    zipCode, medianIncome: null, medianAge: null, totalPopulation: null,
    homeownershipRate: null, medianHomeValue: null, educationBachelorPlus: null,
  };

  if (!apiKey) {
    log.warn("CENSUS_API_KEY not set — returning empty demographics");
    return empty;
  }

  try {
    // ACS 5-Year estimates — most reliable for zip-level data
    const variables = "B19013_001E,B01002_001E,B01003_001E,B25003_001E,B25003_002E,B25077_001E,B15003_022E,B15003_023E,B15003_024E,B15003_025E";
    const url = `${CENSUS_BASE}/2023/acs/acs5?get=${variables}&for=zip%20code%20tabulation%20area:${zipCode}&key=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      log.warn({ status: response.status, zipCode }, "Census API request failed");
      return empty;
    }

    const data = await response.json() as string[][];
    if (data.length < 2) return empty;

    const values = data[1];
    const totalHousing = Number(values[3]) || 0;
    const ownerOccupied = Number(values[4]) || 0;
    const totalPop = Number(values[2]) || 0;

    // Education: bachelor's + master's + professional + doctorate
    const educatedPop = (Number(values[6]) || 0) + (Number(values[7]) || 0) + (Number(values[8]) || 0) + (Number(values[9]) || 0);

    return {
      zipCode,
      medianIncome: Number(values[0]) || null,
      medianAge: Number(values[1]) || null,
      totalPopulation: totalPop || null,
      homeownershipRate: totalHousing > 0 ? Math.round((ownerOccupied / totalHousing) * 10000) / 100 : null,
      medianHomeValue: Number(values[5]) || null,
      educationBachelorPlus: totalPop > 0 ? Math.round((educatedPop / totalPop) * 10000) / 100 : null,
    };
  } catch (e: any) {
    log.error({ error: e.message, zipCode }, "Census API error");
    return empty;
  }
}

export async function fetchBulkDemographics(zipCodes: string[]): Promise<Map<string, DemographicData>> {
  const results = new Map<string, DemographicData>();

  // Census API doesn't support bulk zip queries well, so we batch with delays
  for (const zip of zipCodes) {
    const data = await fetchDemographicsByZip(zip);
    results.set(zip, data);
    // Rate limit: 500 requests/day for free tier
    await new Promise((r) => setTimeout(r, 200));
  }

  log.info({ count: results.size }, "Bulk demographics fetched");
  return results;
}
