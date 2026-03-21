/**
 * Task #54 — Market Data Streaming Service
 * Real-time market data feeds, alerts, and portfolio impact analysis
 */

export interface MarketDataPoint {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
  source: string;
}

export interface MarketAlert {
  id: string;
  userId: number;
  symbol: string;
  condition: "above" | "below" | "change_percent";
  threshold: number;
  triggered: boolean;
  triggeredAt?: string;
  createdAt: string;
}

export interface PortfolioImpact {
  symbol: string;
  currentPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  portfolioWeight: number;
  portfolioImpact: number; // dollar impact
  portfolioImpactPercent: number;
}

// In-memory market data cache
const marketCache = new Map<string, MarketDataPoint>();
const alerts: MarketAlert[] = [];

// Simulated market data (in production, would connect to real feeds)
const MARKET_INDICES = [
  { symbol: "SPY", name: "S&P 500 ETF", basePrice: 520.50 },
  { symbol: "QQQ", name: "Nasdaq 100 ETF", basePrice: 445.20 },
  { symbol: "DIA", name: "Dow Jones ETF", basePrice: 395.80 },
  { symbol: "IWM", name: "Russell 2000 ETF", basePrice: 210.30 },
  { symbol: "AGG", name: "US Aggregate Bond ETF", basePrice: 98.50 },
  { symbol: "GLD", name: "Gold ETF", basePrice: 215.40 },
  { symbol: "VNQ", name: "Real Estate ETF", basePrice: 85.20 },
  { symbol: "TLT", name: "20+ Year Treasury ETF", basePrice: 92.10 },
];

export function getMarketSnapshot(): MarketDataPoint[] {
  return MARKET_INDICES.map(idx => {
    const randomChange = (Math.random() - 0.5) * idx.basePrice * 0.02;
    const price = Math.round((idx.basePrice + randomChange) * 100) / 100;
    const change = Math.round(randomChange * 100) / 100;
    const changePercent = Math.round((change / idx.basePrice) * 10000) / 100;

    const point: MarketDataPoint = {
      symbol: idx.symbol,
      price,
      change,
      changePercent,
      volume: Math.floor(Math.random() * 50000000),
      timestamp: new Date().toISOString(),
      source: "simulated",
    };
    marketCache.set(idx.symbol, point);
    return point;
  });
}

export function getSymbolData(symbol: string): MarketDataPoint | null {
  return marketCache.get(symbol) ?? null;
}

export function createAlert(userId: number, symbol: string, condition: MarketAlert["condition"], threshold: number): MarketAlert {
  const alert: MarketAlert = {
    id: `alert_${Date.now()}`,
    userId,
    symbol,
    condition,
    threshold,
    triggered: false,
    createdAt: new Date().toISOString(),
  };
  alerts.push(alert);
  return alert;
}

export function getUserAlerts(userId: number): MarketAlert[] {
  return alerts.filter(a => a.userId === userId);
}

export function deleteAlert(alertId: string): boolean {
  const idx = alerts.findIndex(a => a.id === alertId);
  if (idx === -1) return false;
  alerts.splice(idx, 1);
  return true;
}

export function checkAlerts(): MarketAlert[] {
  const triggered: MarketAlert[] = [];
  for (const alert of alerts) {
    if (alert.triggered) continue;
    const data = marketCache.get(alert.symbol);
    if (!data) continue;

    let shouldTrigger = false;
    if (alert.condition === "above" && data.price > alert.threshold) shouldTrigger = true;
    if (alert.condition === "below" && data.price < alert.threshold) shouldTrigger = true;
    if (alert.condition === "change_percent" && Math.abs(data.changePercent) > alert.threshold) shouldTrigger = true;

    if (shouldTrigger) {
      alert.triggered = true;
      alert.triggeredAt = new Date().toISOString();
      triggered.push(alert);
    }
  }
  return triggered;
}

export function calculatePortfolioImpact(holdings: Array<{ symbol: string; shares: number; costBasis: number }>): {
  impacts: PortfolioImpact[];
  totalValue: number;
  totalChange: number;
  totalChangePercent: number;
} {
  const impacts: PortfolioImpact[] = [];
  let totalValue = 0;
  let totalPreviousValue = 0;

  for (const holding of holdings) {
    const data = marketCache.get(holding.symbol);
    if (!data) continue;

    const currentValue = data.price * holding.shares;
    const previousClose = data.price - data.change;
    const previousValue = previousClose * holding.shares;
    totalValue += currentValue;
    totalPreviousValue += previousValue;

    impacts.push({
      symbol: holding.symbol,
      currentPrice: data.price,
      previousClose,
      change: data.change,
      changePercent: data.changePercent,
      portfolioWeight: 0, // Calculated after totals
      portfolioImpact: currentValue - previousValue,
      portfolioImpactPercent: 0,
    });
  }

  // Calculate weights and impact percentages
  for (const impact of impacts) {
    const currentValue = impact.currentPrice * (holdings.find(h => h.symbol === impact.symbol)?.shares ?? 0);
    impact.portfolioWeight = totalValue > 0 ? Math.round((currentValue / totalValue) * 10000) / 100 : 0;
    impact.portfolioImpactPercent = totalPreviousValue > 0 ? Math.round((impact.portfolioImpact / totalPreviousValue) * 10000) / 100 : 0;
  }

  return {
    impacts,
    totalValue: Math.round(totalValue * 100) / 100,
    totalChange: Math.round((totalValue - totalPreviousValue) * 100) / 100,
    totalChangePercent: totalPreviousValue > 0 ? Math.round(((totalValue - totalPreviousValue) / totalPreviousValue) * 10000) / 100 : 0,
  };
}
