import { describe, expect, it } from "vitest";
import { listAdapters } from "./registry";
import { parsePfmCsv } from "./pfmParser/csvParser";

// ─── REGISTRY UNIT TESTS ─────────────────────────────────────────
describe("Financial Data Registry", () => {
  describe("listAdapters", () => {
    it("returns all registered adapters", () => {
      const adapters = listAdapters();
      expect(adapters).toBeInstanceOf(Array);
      expect(adapters.length).toBeGreaterThanOrEqual(10);
    });

    it("each adapter has id and name", () => {
      const adapters = listAdapters();
      for (const adapter of adapters) {
        expect(adapter).toHaveProperty("id");
        expect(adapter).toHaveProperty("name");
        expect(typeof adapter.id).toBe("string");
        expect(typeof adapter.name).toBe("string");
        expect(adapter.id.length).toBeGreaterThan(0);
        expect(adapter.name.length).toBeGreaterThan(0);
      }
    });

    it("includes expected core adapters", () => {
      const adapters = listAdapters();
      const ids = adapters.map(a => a.id);
      expect(ids).toContain("fred");
      expect(ids).toContain("edgar");
      expect(ids).toContain("treasury");
      expect(ids).toContain("bea");
      expect(ids).toContain("bls");
      expect(ids).toContain("openfigi");
      expect(ids).toContain("gleif");
      expect(ids).toContain("plaid");
    });

    it("includes freemium adapters", () => {
      const adapters = listAdapters();
      const ids = adapters.map(a => a.id);
      expect(ids).toContain("fmp");
      expect(ids).toContain("polygon");
      expect(ids).toContain("tiingo");
    });

    it("returns unique adapter IDs", () => {
      const adapters = listAdapters();
      const ids = adapters.map(a => a.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });
});

// ─── PFM PARSER UNIT TESTS ───────────────────────────────────────
describe("PFM CSV Parser", () => {
  describe("parsePfmCsv", () => {
    it("parses Mint CSV correctly", () => {
      const csv = `Date,Description,Original Description,Amount,Transaction Type,Category,Account Name,Labels,Notes
01/15/2024,Coffee Shop,STARBUCKS #1234,5.50,debit,Food & Dining,Chase Checking,,
01/16/2024,Salary,ACME CORP PAYROLL,3500.00,credit,Income,Chase Checking,,`;
      const result = parsePfmCsv(csv);
      expect(result.detectedSource).toBe("mint");
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0]).toMatchObject({
        description: "Coffee Shop",
        category: "Food & Dining",
        account: "Chase Checking",
      });
      expect(result.transactions[0].amount).toBeCloseTo(-5.50);
      expect(result.transactions[1].amount).toBeCloseTo(3500.00);
    });

    it("parses YNAB CSV correctly", () => {
      const csv = `Account,Date,Payee,Category,Memo,Outflow,Inflow
Chase Checking,01/15/2024,Starbucks,Food & Dining,,5.50,
Chase Checking,01/16/2024,ACME Corp,Income,,,3500.00`;
      const result = parsePfmCsv(csv);
      expect(result.detectedSource).toBe("ynab");
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0].amount).toBeCloseTo(-5.50);
      expect(result.transactions[1].amount).toBeCloseTo(3500.00);
    });

    it("handles empty CSV (header only)", () => {
      const csv = `Date,Description,Original Description,Amount,Transaction Type,Category,Account Name,Labels,Notes`;
      const result = parsePfmCsv(csv);
      expect(result.transactions).toHaveLength(0);
      expect(result.result.totalRows).toBe(0);
    });

    it("returns correct row counts in result", () => {
      const csv = `Date,Description,Original Description,Amount,Transaction Type,Category,Account Name,Labels,Notes
01/15/2024,Coffee,STARBUCKS,5.50,debit,Food,Chase,,
01/16/2024,Salary,ACME,3500.00,credit,Income,Chase,,
01/17/2024,Gas,SHELL,45.00,debit,Transport,Chase,,`;
      const result = parsePfmCsv(csv);
      expect(result.result.totalRows).toBe(3);
      expect(result.result.importedRows).toBe(3);
    });

    it("returns category breakdown", () => {
      const csv = `Date,Description,Original Description,Amount,Transaction Type,Category,Account Name,Labels,Notes
01/15/2024,Coffee,STARBUCKS,5.50,debit,Food,Chase,,
01/16/2024,Lunch,SUBWAY,12.00,debit,Food,Chase,,
01/17/2024,Gas,SHELL,45.00,debit,Transport,Chase,,`;
      const result = parsePfmCsv(csv);
      expect(result.result.categoryBreakdown).toHaveProperty("Food");
      expect(result.result.categoryBreakdown).toHaveProperty("Transport");
    });

    it("returns mappings array", () => {
      const csv = `Date,Description,Original Description,Amount,Transaction Type,Category,Account Name,Labels,Notes
01/15/2024,Coffee,STARBUCKS,5.50,debit,Food,Chase,,`;
      const result = parsePfmCsv(csv);
      expect(result.mappings).toBeInstanceOf(Array);
      expect(result.mappings.length).toBeGreaterThan(0);
      const targetFields = result.mappings.map(m => m.targetField);
      expect(targetFields).toContain("date");
    });

    it("detects source as 'other' for unknown format", () => {
      const csv = `col1,col2,col3
a,b,c
d,e,f`;
      const result = parsePfmCsv(csv);
      expect(result.detectedSource).toBe("other");
    });

    it("handles hint source override", () => {
      const csv = `Date,Description,Amount,Category
01/15/2024,Coffee,-5.50,Food`;
      const result = parsePfmCsv(csv, "quicken");
      expect(result.detectedSource).toBe("quicken");
    });
  });
});

// ─── ADAPTER INTERFACE TESTS ─────────────────────────────────────
describe("Adapter Interface Compliance", () => {
  it("EDGAR adapter exports correct interface", async () => {
    const { edgarAdapter } = await import("./adapters/edgarAdapter");
    expect(edgarAdapter).toHaveProperty("id");
    expect(edgarAdapter).toHaveProperty("name");
    expect(edgarAdapter).toHaveProperty("description");
    expect(edgarAdapter).toHaveProperty("tier");
    expect(edgarAdapter).toHaveProperty("requiresKey");
    expect(edgarAdapter).toHaveProperty("supportedActions");
    expect(edgarAdapter).toHaveProperty("query");
    expect(edgarAdapter).toHaveProperty("healthCheck");
    expect(typeof edgarAdapter.query).toBe("function");
    expect(typeof edgarAdapter.healthCheck).toBe("function");
    expect(edgarAdapter.id).toBe("edgar");
    expect(edgarAdapter.requiresKey).toBe(false);
  });

  it("Treasury adapter exports correct interface", async () => {
    const { treasuryAdapter } = await import("./adapters/treasuryAdapter");
    expect(treasuryAdapter.id).toBe("treasury");
    expect(treasuryAdapter.requiresKey).toBe(false);
    expect(treasuryAdapter.supportedActions).toContain("yields");
    expect(treasuryAdapter.supportedActions).toContain("debt");
    expect(treasuryAdapter.supportedActions).toContain("rates");
    expect(typeof treasuryAdapter.query).toBe("function");
    expect(typeof treasuryAdapter.healthCheck).toBe("function");
  });

  it("OpenFIGI adapter exports correct interface", async () => {
    const { openFigiAdapter } = await import("./adapters/openFigiAdapter");
    expect(openFigiAdapter.id).toBe("openfigi");
    expect(openFigiAdapter.requiresKey).toBe(false);
    expect(typeof openFigiAdapter.query).toBe("function");
    expect(typeof openFigiAdapter.healthCheck).toBe("function");
  });

  it("GLEIF adapter exports correct interface", async () => {
    const { gleifAdapter } = await import("./adapters/gleifAdapter");
    expect(gleifAdapter.id).toBe("gleif");
    expect(gleifAdapter.requiresKey).toBe(false);
    expect(typeof gleifAdapter.query).toBe("function");
    expect(typeof gleifAdapter.healthCheck).toBe("function");
  });

  it("FRED adapter exports correct interface", async () => {
    const { fredAdapter } = await import("./adapters/fredAdapter");
    expect(fredAdapter.id).toBe("fred");
    expect(fredAdapter.requiresKey).toBe(true);
    expect(fredAdapter.tier).toBe("free_with_key");
    expect(typeof fredAdapter.query).toBe("function");
    expect(typeof fredAdapter.healthCheck).toBe("function");
  });

  it("BEA adapter exports correct interface", async () => {
    const { beaAdapter } = await import("./adapters/beaAdapter");
    expect(beaAdapter.id).toBe("bea");
    expect(typeof beaAdapter.query).toBe("function");
    expect(typeof beaAdapter.healthCheck).toBe("function");
  });

  it("BLS adapter exports correct interface", async () => {
    const { blsAdapter } = await import("./adapters/blsAdapter");
    expect(blsAdapter.id).toBe("bls");
    expect(typeof blsAdapter.query).toBe("function");
    expect(typeof blsAdapter.healthCheck).toBe("function");
  });

  it("Plaid adapter exports correct interface", async () => {
    const { plaidAdapter } = await import("./adapters/plaidAdapter");
    expect(plaidAdapter.id).toBe("plaid");
    expect(plaidAdapter.tier).toBe("paid");
    expect(plaidAdapter.requiresKey).toBe(true);
    expect(typeof plaidAdapter.query).toBe("function");
    expect(typeof plaidAdapter.healthCheck).toBe("function");
  });

  it("FMP adapter exports correct interface", async () => {
    const { fmpAdapter } = await import("./adapters/fmpAdapter");
    expect(fmpAdapter.id).toBe("fmp");
    expect(fmpAdapter.tier).toBe("freemium");
    expect(typeof fmpAdapter.query).toBe("function");
    expect(typeof fmpAdapter.healthCheck).toBe("function");
  });

  it("Polygon adapter exports correct interface", async () => {
    const { polygonAdapter } = await import("./adapters/polygonAdapter");
    expect(polygonAdapter.id).toBe("polygon");
    expect(polygonAdapter.tier).toBe("freemium");
    expect(typeof polygonAdapter.query).toBe("function");
    expect(typeof polygonAdapter.healthCheck).toBe("function");
  });

  it("Tiingo adapter exports correct interface", async () => {
    const { tiingoAdapter } = await import("./adapters/tiingoAdapter");
    expect(tiingoAdapter.id).toBe("tiingo");
    expect(tiingoAdapter.tier).toBe("freemium");
    expect(typeof tiingoAdapter.query).toBe("function");
    expect(typeof tiingoAdapter.healthCheck).toBe("function");
  });
});
