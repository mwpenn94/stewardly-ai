/**
 * IUL Crediting History & Market Index Data Service
 * Phase 2 of Prompt 2: Insurance product intelligence data
 */
import { getDb } from "../db";
import { iulCreditingHistory, marketIndexHistory, insuranceCarriers, insuranceProducts } from "../../drizzle/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";

// ─── IUL Crediting History ────────────────────────────────────────────────

export async function seedIulCreditingHistory(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const carriers = await db.select().from(insuranceCarriers).limit(10);
  const products = await db.select().from(insuranceProducts).limit(20);
  if (carriers.length === 0 || products.length === 0) return 0;

  const strategies = [
    { name: "S&P 500 Annual PTP", capRange: [8, 13], partRange: [100, 100], spreadRange: [0, 0], floor: "0" },
    { name: "S&P 500 Monthly Average", capRange: [3, 5], partRange: [100, 100], spreadRange: [0, 0], floor: "0" },
    { name: "S&P 500 Uncapped Spread", capRange: [999, 999], partRange: [100, 100], spreadRange: [2, 4], floor: "0" },
    { name: "S&P 500 Participation", capRange: [999, 999], partRange: [30, 60], spreadRange: [0, 0], floor: "0" },
    { name: "Barclays Dynamic Balance", capRange: [6, 10], partRange: [100, 100], spreadRange: [0, 0], floor: "1" },
    { name: "JPM Mozaic II", capRange: [999, 999], partRange: [80, 120], spreadRange: [0, 2], floor: "0" },
    { name: "Fixed Account", capRange: [3, 4.5], partRange: [100, 100], spreadRange: [0, 0], floor: "2" },
  ];

  const sp500Returns: Record<number, number> = {
    2019: 31.5, 2020: 18.4, 2021: 28.7, 2022: -18.1, 2023: 26.3, 2024: 23.3, 2025: 5.2,
  };

  const records: any[] = [];

  for (const product of products.slice(0, 5)) {
    for (const strategy of strategies) {
      for (let year = 2019; year <= 2025; year++) {
        // Deterministic: use midpoint of range + slight year-based offset for variety
        const yearOffset = (year - 2019) / 12; // 0 to 0.5 across years
        const cap = strategy.capRange[0] + (strategy.capRange[1] - strategy.capRange[0]) * (0.5 + yearOffset * 0.3);
        const part = strategy.partRange[0] + (strategy.partRange[1] - strategy.partRange[0]) * (0.5 + yearOffset * 0.2);
        const spread = strategy.spreadRange[0] + (strategy.spreadRange[1] - strategy.spreadRange[0]) * (0.5 - yearOffset * 0.1);

        const indexReturn = sp500Returns[year] ?? 5;
        let credited: number;
        if (indexReturn <= 0) {
          credited = Math.max(parseFloat(strategy.floor), 0);
        } else {
          const afterPart = indexReturn * (part / 100);
          const afterSpread = Math.max(afterPart - spread, 0);
          credited = cap < 999 ? Math.min(afterSpread, cap) : afterSpread;
        }

        records.push({
          productId: product.id,
          effectiveDate: `${year}-01-01`,
          indexStrategy: strategy.name,
          capRate: cap.toFixed(2),
          participationRate: part.toFixed(1),
          floorRate: strategy.floor,
          spread: spread.toFixed(2),
          multiplierBonus: credited.toFixed(2),
          source: "seed",
        });
      }
    }
  }

  const batchSize = 50;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    await db.insert(iulCreditingHistory).values(batch);
  }

  return records.length;
}

export async function getCreditingHistory(productId: number, strategy?: string): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(iulCreditingHistory.productId, productId)];
  if (strategy) conditions.push(eq(iulCreditingHistory.indexStrategy, strategy));

  return db.select().from(iulCreditingHistory).where(and(...conditions)).orderBy(desc(iulCreditingHistory.effectiveDate));
}

export async function getAvailableStrategies(productId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .selectDistinct({ strategy: iulCreditingHistory.indexStrategy })
    .from(iulCreditingHistory)
    .where(eq(iulCreditingHistory.productId, productId));

  return rows.map((r) => r.strategy);
}

export async function getAverageCreditingByStrategy(productId: number): Promise<{ strategy: string; avgCap: string; avgPart: string; count: number }[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      strategy: iulCreditingHistory.indexStrategy,
      avgCap: sql<string>`AVG(CAST(cap_rate AS DECIMAL(10,2)))`,
      avgPart: sql<string>`AVG(CAST(participation_rate AS DECIMAL(10,2)))`,
      count: sql<number>`COUNT(*)`,
    })
    .from(iulCreditingHistory)
    .where(eq(iulCreditingHistory.productId, productId))
    .groupBy(iulCreditingHistory.indexStrategy);

  return rows.map((r) => ({
    strategy: r.strategy,
    avgCap: parseFloat(String(r.avgCap)).toFixed(2),
    avgPart: parseFloat(String(r.avgPart)).toFixed(1),
    count: Number(r.count),
  }));
}

// ─── Market Index History ─────────────────────────────────────────────────

export async function seedMarketIndexHistory(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const indices = [
    { symbol: "SPX", baseValue: 2500 },
    { symbol: "NDX", baseValue: 7000 },
    { symbol: "DJIA", baseValue: 25000 },
    { symbol: "RUT", baseValue: 1500 },
    { symbol: "AGG", baseValue: 105 },
    { symbol: "VIX", baseValue: 15 },
  ];

  // Fetch real historical data from Yahoo Finance via data API
  const { callDataApi } = await import("../_core/dataApi");
  const YAHOO_TICKERS: Record<string, string> = {
    SPX: "^GSPC", NDX: "^IXIC", DJIA: "^DJI", RUT: "^RUT", AGG: "AGG", VIX: "^VIX",
  };
  const records: any[] = [];

  for (const index of indices) {
    const ticker = YAHOO_TICKERS[index.symbol] || index.symbol;
    let monthlyData: Array<{ date: string; open: number; close: number }> = [];
    try {
      const resp = await callDataApi("/yahoo_finance/get_stock_chart", {
        symbol: ticker, interval: "1mo", range: "7y",
      });
      const quotes = resp?.chart?.result?.[0];
      if (quotes?.timestamp && quotes?.indicators?.quote?.[0]) {
        const timestamps = quotes.timestamp as number[];
        const q = quotes.indicators.quote[0];
        monthlyData = timestamps.map((ts: number, i: number) => ({
          date: new Date(ts * 1000).toISOString().slice(0, 10),
          open: q.open?.[i] ?? 0,
          close: q.close?.[i] ?? 0,
        })).filter((d: any) => d.open > 0 && d.close > 0);
      }
    } catch {
      // Fallback to deterministic data if API fails
    }

    if (monthlyData.length > 0) {
      let yearStartValue = monthlyData[0].open;
      let currentYear = parseInt(monthlyData[0].date.slice(0, 4));
      for (const d of monthlyData) {
        const yr = parseInt(d.date.slice(0, 4));
        if (yr !== currentYear) { yearStartValue = d.open; currentYear = yr; }
        const dailyReturn = ((d.close - d.open) / d.open * 100).toFixed(4);
        const totalReturnIdx = ((d.close / yearStartValue - 1) * 100).toFixed(4);
        records.push({
          indexSymbol: index.symbol,
          date: d.date.slice(0, 7) + "-01",
          openPrice: d.open.toFixed(2),
          closePrice: d.close.toFixed(2),
          dailyReturn,
          totalReturnIndex: totalReturnIdx,
        });
      }
    } else {
      // Deterministic fallback using known annual returns
      let value = index.baseValue;
      let yearStartValue = value;
      const knownReturns: Record<number, number> = { 2019: 0.315, 2020: 0.184, 2021: 0.287, 2022: -0.181, 2023: 0.263, 2024: 0.233, 2025: 0.052 };
      for (let year = 2019; year <= 2025; year++) {
        yearStartValue = value;
        const annualReturn = knownReturns[year] ?? 0.08;
        const monthlyReturn = annualReturn / 12;
        for (let month = 1; month <= 12; month++) {
          if (year === 2025 && month > 3) break;
          const prevValue = value;
          value = value * (1 + monthlyReturn);
          records.push({
            indexSymbol: index.symbol,
            date: `${year}-${String(month).padStart(2, "0")}-01`,
            openPrice: prevValue.toFixed(2),
            closePrice: value.toFixed(2),
            dailyReturn: ((value - prevValue) / prevValue * 100).toFixed(4),
            totalReturnIndex: ((value / yearStartValue - 1) * 100).toFixed(4),
          });
        }
      }
    }
  }

  const batchSize = 50;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    await db.insert(marketIndexHistory).values(batch);
  }

  return records.length;
}

export async function getIndexHistory(symbol: string, months?: number): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(marketIndexHistory.indexSymbol, symbol)];
  if (months) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    conditions.push(gte(marketIndexHistory.date, cutoff.toISOString().split("T")[0]));
  }

  return db.select().from(marketIndexHistory).where(and(...conditions)).orderBy(desc(marketIndexHistory.date));
}

export async function getLatestIndexValues(): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  const subquery = db
    .select({
      indexSymbol: marketIndexHistory.indexSymbol,
      maxDate: sql<string>`MAX(date)`.as("max_date"),
    })
    .from(marketIndexHistory)
    .groupBy(marketIndexHistory.indexSymbol)
    .as("latest");

  return db
    .select()
    .from(marketIndexHistory)
    .innerJoin(subquery, and(
      eq(marketIndexHistory.indexSymbol, subquery.indexSymbol),
      eq(marketIndexHistory.date, subquery.maxDate),
    ));
}

export async function compareIndices(symbols: string[], months: number = 12): Promise<Record<string, { totalReturn: number; avgVolatility: number; latestClose: number }>> {
  const db = await getDb();
  if (!db) return {};

  const result: Record<string, { totalReturn: number; avgVolatility: number; latestClose: number }> = {};

  for (const symbol of symbols) {
    const history = await getIndexHistory(symbol, months);
    if (history.length < 2) continue;

    const latest = history[0];
    const oldest = history[history.length - 1];
    const latestClose = parseFloat(latest.closePrice ?? "0");
    const oldestClose = parseFloat(oldest.closePrice ?? "0");
    const totalReturn = oldestClose > 0 ? ((latestClose - oldestClose) / oldestClose) * 100 : 0;

    result[symbol] = {
      totalReturn: parseFloat(totalReturn.toFixed(2)),
      avgVolatility: 0, // Would need daily data for proper vol calc
      latestClose,
    };
  }

  return result;
}
