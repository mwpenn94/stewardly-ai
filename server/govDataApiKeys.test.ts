/**
 * Validate Government Data API Keys (Tier 1 integrations)
 * Tests that FRED, BLS, Census, and BEA API keys are valid by making lightweight requests.
 * All tests have retry logic + graceful skip for transient network failures.
 */
import { describe, it, expect } from "vitest";

/** Retry-fetch helper: retries up to `maxAttempts` times, skips gracefully on persistent failure */
async function resilientFetch(url: string, init?: RequestInit, maxAttempts = 3): Promise<Response | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fetch(url, { signal: AbortSignal.timeout(10_000), ...init });
    } catch (e: any) {
      if (attempt === maxAttempts - 1) {
        console.warn(`API unreachable after ${maxAttempts} attempts: ${e.message}`);
        return null; // caller decides whether to skip
      }
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return null;
}

describe("Government Data API Keys", () => {
  it("FRED API key is valid and returns data", async () => {
    const key = process.env.FRED_API_KEY;
    expect(key).toBeTruthy();
    const url = `https://api.stlouisfed.org/fred/series?series_id=GDP&api_key=${key}&file_type=json`;
    const res = await resilientFetch(url);
    if (!res) return; // network unreachable — skip gracefully
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.seriess).toBeDefined();
    expect(data.seriess.length).toBeGreaterThan(0);
    expect(data.seriess[0].id).toBe("GDP");
  }, 35_000);

  it("BLS API key is valid and returns data", async () => {
    const key = process.env.BLS_API_KEY;
    expect(key).toBeTruthy();
    const res = await resilientFetch("https://api.bls.gov/publicAPI/v2/timeseries/data/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seriesid: ["CUUR0000SA0"],
        startyear: "2024",
        endyear: "2024",
        registrationkey: key,
      }),
    });
    if (!res) return; // network unreachable — skip gracefully
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.status).toBe("REQUEST_SUCCEEDED");
  }, 35_000);

  it("BEA API key is valid and returns data", async () => {
    const key = process.env.BEA_API_KEY;
    expect(key).toBeTruthy();
    const url = `https://apps.bea.gov/api/data/?method=GetDataSetList&UserID=${key}&ResultFormat=JSON`;
    const res = await resilientFetch(url);
    if (!res) return; // network unreachable — skip gracefully
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.BEAAPI).toBeDefined();
    expect(data.BEAAPI.Results).toBeDefined();
  }, 35_000);

  it("Census API key is valid and returns data", async () => {
    const key = process.env.CENSUS_API_KEY;
    expect(key).toBeTruthy();
    const url = `https://api.census.gov/data/2022/acs/acs5?get=NAME,B01001_001E&for=state:06&key=${key}`;
    const res = await resilientFetch(url);
    if (!res) return; // network unreachable — skip gracefully
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  }, 35_000);
});
