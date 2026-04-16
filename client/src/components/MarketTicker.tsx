/**
 * MarketTicker — Scrolling market data ticker for the dashboard header.
 *
 * Shows live market quotes (SPY, QQQ, DIA, IWM, BTC, Gold) from the
 * market data tRPC procedure. Refreshes every 60s. Uses CSS animation
 * for smooth infinite scroll.
 *
 * Disclosure level 2+ (Standard) to keep the Essential view clean.
 */

import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useDisclosure } from "@/contexts/DisclosureContext";

const TICKER_SYMBOLS = ["SPY", "QQQ", "DIA", "IWM", "GLD", "TLT"];

interface TickerItem {
  symbol: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
}

function TickerChip({ item }: { item: TickerItem }) {
  const isUp = (item.change ?? 0) >= 0;
  const isFlat = item.change === 0 || item.change === null;

  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1 text-xs whitespace-nowrap">
      <span className="font-semibold text-foreground/80">{item.symbol}</span>
      <span className="font-mono tabular-nums text-foreground/70">
        {item.price != null ? `$${item.price.toFixed(2)}` : "—"}
      </span>
      {!isFlat && (
        <span className={`flex items-center gap-0.5 font-medium ${isUp ? "text-emerald-400" : "text-red-400"}`}>
          {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {item.changePercent != null ? `${item.changePercent >= 0 ? "+" : ""}${item.changePercent.toFixed(2)}%` : ""}
        </span>
      )}
      {isFlat && <Minus className="w-3 h-3 text-muted-foreground/50" />}
    </div>
  );
}

export function MarketTicker() {
  const { level } = useDisclosure();
  const quotesQuery = trpc.market.getQuotes.useQuery(
    { symbols: TICKER_SYMBOLS },
    { refetchInterval: 60_000, staleTime: 30_000, enabled: level >= 2 }
  );

  const items: TickerItem[] = useMemo(() => {
    if (!quotesQuery.data || !Array.isArray(quotesQuery.data)) {
      return TICKER_SYMBOLS.map(s => ({ symbol: s, price: null, change: null, changePercent: null }));
    }
    return quotesQuery.data.map((q: any) => ({
      symbol: q.symbol || "—",
      price: q.price ?? null,
      change: q.change ?? null,
      changePercent: q.changePercent ?? null,
    }));
  }, [quotesQuery.data]);

  // Don't render at disclosure level 1 (Essential)
  if (level < 2) return null;

  return (
    <div
      className="w-full overflow-hidden border-b border-border/30 bg-card/20 backdrop-blur-sm"
      role="marquee"
      aria-label="Market ticker"
      aria-live="polite"
    >
      <div className="flex animate-ticker">
        {/* Duplicate items for seamless infinite scroll */}
        {[...items, ...items].map((item, i) => (
          <TickerChip key={`${item.symbol}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}
