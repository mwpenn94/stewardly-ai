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
        const cap = strategy.capRange[0] + Math.random() * (strategy.capRange[1] - strategy.capRange[0]);
        const part = strategy.partRange[0] + Math.random() * (strategy.partRange[1] - strategy.partRange[0]);
        const spread = strategy.spreadRange[0] + Math.random() * (strategy.spreadRange[1] - strategy.spreadRange[0]);

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

  const records: any[] = [];

  for (const index of indices) {
    let value = index.baseValue;
    let yearStartValue = value;

    for (let year = 2019; year <= 2025; year++) {
      yearStartValue = value;
      for (let month = 1; month <= 12; month++) {
        if (year === 2025 && month > 3) break;

        const monthlyReturn = index.symbol === "VIX"
          ? (Math.random() - 0.5) * 10
          : (Math.random() - 0.45) * 0.08;

        const prevValue = value;
        if (index.symbol === "VIX") {
          value = Math.max(10, Math.min(80, value + monthlyReturn));
        } else {
          value = value * (1 + monthlyReturn);
        }

        const dailyReturn = ((value - prevValue) / prevValue * 100).toFixed(4);
        const totalReturnIdx = ((value / yearStartValue - 1) * 100).toFixed(4);

        records.push({
          indexSymbol: index.symbol,
          date: `${year}-${String(month).padStart(2, "0")}-01`,
          openPrice: prevValue.toFixed(2),
          closePrice: value.toFixed(2),
          dailyReturn,
          totalReturnIndex: totalReturnIdx,
        });
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
