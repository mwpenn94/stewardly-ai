/**
 * Unit tests for the cross-module fiduciary report generator.
 * Pass 14 of the hybrid build loop — error-states angle.
 */
import { describe, it, expect } from "vitest";
import { buildFiduciaryReport } from "./fiduciaryReport";
import { computeDrift } from "../portfolio/rebalancing";
import { runLedger } from "../portfolio/ledger";
import { projectYear } from "../tax/projector";
import { projectStateTax } from "../tax/stateTax";
import { detectWashSales } from "../portfolio/washSale";
import { trackShortPositions } from "../portfolio/shortPositions";
import { overallSummary } from "../comparables/scoring";
import type { YearContext } from "../tax/projector";
import type { Transaction } from "../portfolio/ledger";

// ─── Minimum viable report ───────────────────────────────────────────────

describe("reports/fiduciaryReport — minimum viable", () => {
  it("builds a report with only clientName + advisorName + generatedAt", () => {
    const r = buildFiduciaryReport({
      clientName: "John Doe",
      advisorName: "Jane Smith",
      generatedAt: "2026-04-12T12:00:00Z",
    });
    expect(r.markdown).toContain("# Fiduciary Compliance Report");
    expect(r.markdown).toContain("John Doe");
    expect(r.markdown).toContain("Jane Smith");
    expect(r.summary.sectionsPresent).toHaveLength(0);
    expect(r.summary.sectionsMissing.length).toBeGreaterThan(0);
  });

  it("emits a warning when clientName or advisorName is missing", () => {
    const r = buildFiduciaryReport({
      clientName: "",
      advisorName: "",
      generatedAt: "2026-04-12T12:00:00Z",
    });
    expect(r.summary.warnings.some((w) => /Missing/i.test(w))).toBe(true);
  });
});

// ─── Single-section reports ──────────────────────────────────────────────

describe("reports/fiduciaryReport — single sections", () => {
  const base = {
    clientName: "John Doe",
    advisorName: "Jane Smith",
    generatedAt: "2026-04-12T12:00:00Z",
  };

  it("includes a rebalancing section when rebalancing is provided", () => {
    const drift = computeDrift(
      [
        { id: "VTI", name: "US", marketValue: 70_000 },
        { id: "BND", name: "Bond", marketValue: 30_000 },
      ],
      [
        { id: "VTI", targetPct: 60 },
        { id: "BND", targetPct: 40 },
      ],
    );
    const r = buildFiduciaryReport({ ...base, rebalancing: drift });
    expect(r.markdown).toMatch(/## Rebalancing analysis/);
    expect(r.summary.sectionsPresent).toContain("rebalancing");
  });

  it("includes a ledger section when ledger is provided", () => {
    const transactions: Transaction[] = [
      {
        id: "b1",
        symbol: "VTI",
        timestamp: "2024-01-01",
        kind: "buy",
        shares: 10,
        pricePerShare: 100,
      },
    ];
    const ledger = runLedger(transactions, "FIFO");
    const r = buildFiduciaryReport({ ...base, ledger });
    expect(r.markdown).toMatch(/## Positions/);
    expect(r.summary.sectionsPresent).toContain("ledger");
  });

  it("includes a federal tax section when federalTax is provided", () => {
    const yr: YearContext = {
      year: 2024,
      filingStatus: "mfj",
      ordinaryIncomeUSD: 200_000,
      longTermCapGainsUSD: 0,
      qualifiedDividendsUSD: 0,
      traditionalDistributionsUSD: 0,
      itemizedDeductionUSD: 0,
      aboveTheLineUSD: 0,
      primaryAge: 50,
    };
    const federalTax = projectYear(yr);
    const r = buildFiduciaryReport({ ...base, federalTax });
    expect(r.markdown).toMatch(/## Federal tax projection/);
    expect(r.summary.headline.federalEffectiveRate).not.toBeNull();
  });

  it("includes a state tax section when stateTax is provided", () => {
    const yr: YearContext = {
      year: 2024,
      filingStatus: "mfj",
      ordinaryIncomeUSD: 200_000,
      longTermCapGainsUSD: 0,
      qualifiedDividendsUSD: 0,
      traditionalDistributionsUSD: 0,
      itemizedDeductionUSD: 0,
      aboveTheLineUSD: 0,
      primaryAge: 50,
    };
    const federalTax = projectYear(yr);
    const stateTax = projectStateTax({
      state: "CA",
      federal: federalTax,
      filingStatus: "mfj",
    });
    const r = buildFiduciaryReport({ ...base, federalTax, stateTax });
    expect(r.markdown).toMatch(/## State tax \(CA\)/);
    expect(r.summary.headline.combinedEffectiveRate).not.toBeNull();
  });

  it("includes a comparables section when comparables is provided", () => {
    const summary = overallSummary();
    const r = buildFiduciaryReport({ ...base, comparables: summary });
    expect(r.markdown).toMatch(/## Competitive benchmark/);
    expect(r.summary.sectionsPresent).toContain("comparables");
  });
});

// ─── Full cross-module report ────────────────────────────────────────────

describe("reports/fiduciaryReport — full cross-module", () => {
  const base = {
    clientName: "John Doe",
    advisorName: "Jane Smith",
    generatedAt: "2026-04-12T12:00:00Z",
  };

  it("composes all sections into one markdown document", () => {
    const transactions: Transaction[] = [
      {
        id: "b1",
        symbol: "VTI",
        timestamp: "2024-01-01",
        kind: "buy",
        shares: 100,
        pricePerShare: 100,
      },
      {
        id: "s1",
        symbol: "VTI",
        timestamp: "2024-06-01",
        kind: "sell",
        shares: 50,
        pricePerShare: 80,
      },
      {
        id: "b2",
        symbol: "VTI",
        timestamp: "2024-06-10",
        kind: "buy",
        shares: 50,
        pricePerShare: 85,
      },
    ];
    const ledger = runLedger(transactions, "FIFO");
    const drift = computeDrift(
      [
        { id: "VTI", name: "US", marketValue: 70_000 },
        { id: "BND", name: "Bond", marketValue: 30_000 },
      ],
      [
        { id: "VTI", targetPct: 60 },
        { id: "BND", targetPct: 40 },
      ],
    );
    const yr: YearContext = {
      year: 2024,
      filingStatus: "mfj",
      ordinaryIncomeUSD: 200_000,
      longTermCapGainsUSD: 0,
      qualifiedDividendsUSD: 0,
      traditionalDistributionsUSD: 0,
      itemizedDeductionUSD: 0,
      aboveTheLineUSD: 0,
      primaryAge: 50,
    };
    const federalTax = projectYear(yr);
    const stateTax = projectStateTax({
      state: "CA",
      federal: federalTax,
      filingStatus: "mfj",
    });
    const washSales = detectWashSales(transactions, ledger.realizedGains);
    const shorts = trackShortPositions(transactions);
    const comparables = overallSummary();

    const r = buildFiduciaryReport({
      ...base,
      rebalancing: drift,
      ledger,
      federalTax,
      stateTax,
      washSales,
      shorts,
      comparables,
    });

    // All 6 sections present
    expect(r.summary.sectionsPresent).toContain("rebalancing");
    expect(r.summary.sectionsPresent).toContain("ledger");
    expect(r.summary.sectionsPresent).toContain("federalTax");
    expect(r.summary.sectionsPresent).toContain("stateTax");
    expect(r.summary.sectionsPresent).toContain("washSales");
    expect(r.summary.sectionsPresent).toContain("shorts");
    expect(r.summary.sectionsPresent).toContain("comparables");

    // Headline metrics computed
    expect(r.summary.headline.sleevesInDrift).not.toBeNull();
    expect(r.summary.headline.federalEffectiveRate).not.toBeNull();
    expect(r.summary.headline.combinedEffectiveRate).not.toBeNull();
    expect(r.summary.headline.washSaleViolations).not.toBeNull();

    // Wash sale violation should be flagged (Pass 9 detected the
    // b2 buy within 10 days of s1 sell)
    expect(r.summary.headline.washSaleViolations).toBeGreaterThanOrEqual(1);
  });

  it("propagates component warnings to the aggregated warnings", () => {
    const drift = computeDrift(
      [{ id: "VTI", name: "US", marketValue: 100_000 }],
      [
        { id: "VTI", targetPct: 30 },
        { id: "BND", targetPct: 30 },
      ],
    );
    const r = buildFiduciaryReport({
      clientName: "John",
      advisorName: "Jane",
      generatedAt: "2026-04-12T12:00:00Z",
      rebalancing: drift,
    });
    // Drift warns because targets don't sum to 100 and BND has no holding
    expect(r.summary.warnings.length).toBeGreaterThan(0);
    expect(r.markdown).toMatch(/## Aggregated warnings/);
  });
});

// ─── Headline metric rules ───────────────────────────────────────────────

describe("reports/fiduciaryReport — headline rules", () => {
  it("returns null totalAssetsUSD when neither ledger nor rebalancing is provided", () => {
    const r = buildFiduciaryReport({
      clientName: "John",
      advisorName: "Jane",
      generatedAt: "2026-04-12",
    });
    expect(r.summary.headline.totalAssetsUSD).toBeNull();
  });

  it("prefers ledger cost-basis total over rebalancing total when both present", () => {
    const transactions: Transaction[] = [
      {
        id: "b1",
        symbol: "VTI",
        timestamp: "2024-01-01",
        kind: "buy",
        shares: 10,
        pricePerShare: 100,
      },
    ];
    const ledger = runLedger(transactions, "FIFO");
    const drift = computeDrift(
      [{ id: "VTI", name: "US", marketValue: 9_999 }],
      [{ id: "VTI", targetPct: 100 }],
    );
    const r = buildFiduciaryReport({
      clientName: "John",
      advisorName: "Jane",
      generatedAt: "2026-04-12",
      ledger,
      rebalancing: drift,
    });
    // Ledger total cost basis = 10 × $100 = $1,000 (not $9,999 from drift)
    expect(r.summary.headline.totalAssetsUSD).toBe(1000);
  });
});

// ─── Markdown invariants ─────────────────────────────────────────────────

describe("reports/fiduciaryReport — markdown invariants", () => {
  it("every report ends with the end marker", () => {
    const r = buildFiduciaryReport({
      clientName: "J",
      advisorName: "A",
      generatedAt: "2026-04-12",
    });
    expect(r.markdown).toMatch(/_End of report\._/);
  });

  it("headline table is emitted even with no data", () => {
    const r = buildFiduciaryReport({
      clientName: "J",
      advisorName: "A",
      generatedAt: "2026-04-12",
    });
    expect(r.markdown).toMatch(/## Headline/);
  });

  it("no section is emitted twice in a single report", () => {
    const transactions: Transaction[] = [
      {
        id: "b1",
        symbol: "VTI",
        timestamp: "2024-01-01",
        kind: "buy",
        shares: 10,
        pricePerShare: 100,
      },
    ];
    const ledger = runLedger(transactions, "FIFO");
    const r = buildFiduciaryReport({
      clientName: "J",
      advisorName: "A",
      generatedAt: "2026-04-12",
      ledger,
    });
    const posCount = (r.markdown.match(/## Positions/g) ?? []).length;
    expect(posCount).toBe(1);
  });
});
