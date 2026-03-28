import { useAuth } from "@/_core/hooks/useAuth";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import {
  ArrowLeft, TrendingUp, TrendingDown, Search, BarChart3,
  RefreshCw, Loader2, DollarSign, Activity,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";

const WATCHLIST = [
  { symbol: "SPY", name: "S&P 500 ETF" },
  { symbol: "QQQ", name: "Nasdaq 100 ETF" },
  { symbol: "DIA", name: "Dow Jones ETF" },
  { symbol: "IWM", name: "Russell 2000 ETF" },
  { symbol: "TLT", name: "20+ Year Treasury" },
  { symbol: "GLD", name: "Gold ETF" },
];

const watchlistSymbols = WATCHLIST.map(w => w.symbol);

export default function MarketData() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [searchSymbol, setSearchSymbol] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  const stableSymbols = useMemo(() => watchlistSymbols, []);
  const quotesQuery = trpc.market.getQuotes.useQuery(
    { symbols: stableSymbols },
    { enabled: isAuthenticated, refetchInterval: 60000 }
  );

  const detailQuery = trpc.market.getQuote.useQuery(
    { symbol: selectedSymbol || "" },
    { enabled: isAuthenticated && !!selectedSymbol }
  );

  if (authLoading) {
    return <AppShell title="Market Data"><div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div></AppShell>;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <BarChart3 className="w-12 h-12 text-accent mb-4" />
        <h1 className="text-xl font-semibold mb-2">Market Data</h1>
        <p className="text-muted-foreground text-sm mb-4">Sign in to access real-time market data</p>
        <Button className="bg-accent text-accent-foreground" onClick={() => window.location.href = getLoginUrl()}>Sign In</Button>
      </div>
    );
  }

  const handleSearch = () => {
    const s = searchSymbol.trim().toUpperCase();
    if (s) { setSelectedSymbol(s); setSearchSymbol(""); }
  };

  return (
    <AppShell title="Market Data">
    <div className="min-h-screen">
      <header className="border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <BarChart3 className="w-5 h-5 text-accent" />
        <h1 className="text-lg font-semibold">Market Data</h1>
        <div className="ml-auto">
          <Button variant="ghost" size="icon" onClick={() => quotesQuery.refetch()} disabled={quotesQuery.isFetching}>
            <RefreshCw className={`w-4 h-4 ${quotesQuery.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Search */}
        <div className="flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search symbol (e.g., AAPL)..."
              value={searchSymbol}
              onChange={(e) => setSearchSymbol(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-9"
            />
          </div>
          <Button onClick={handleSearch} className="bg-accent text-accent-foreground">Look Up</Button>
        </div>

        {/* Selected symbol detail */}
        {selectedSymbol && (
          <Card className="border-accent/30">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-accent" />
                {selectedSymbol}
                {detailQuery.isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              </CardTitle>
              {detailQuery.data?.name && <p className="text-sm text-muted-foreground">{detailQuery.data.name}</p>}
            </CardHeader>
            <CardContent>
              {detailQuery.data?.price != null ? (
                <div className="space-y-4">
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-bold">${detailQuery.data.price.toFixed(2)}</span>
                    {detailQuery.data.change != null && (
                      <span className={`flex items-center gap-1 text-lg font-medium ${detailQuery.data.change >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {detailQuery.data.change >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                        {detailQuery.data.change >= 0 ? "+" : ""}{detailQuery.data.change.toFixed(2)}
                        {detailQuery.data.changePercent != null && ` (${detailQuery.data.changePercent >= 0 ? "+" : ""}${detailQuery.data.changePercent.toFixed(2)}%)`}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    {[
                      { label: "Volume", value: detailQuery.data.volume ? (detailQuery.data.volume / 1e6).toFixed(1) + "M" : "—" },
                      { label: "Market Cap", value: detailQuery.data.marketCap ? "$" + (detailQuery.data.marketCap / 1e9).toFixed(1) + "B" : "—" },
                      { label: "Day High", value: detailQuery.data.dayHigh?.toFixed(2) ?? "—" },
                      { label: "Day Low", value: detailQuery.data.dayLow?.toFixed(2) ?? "—" },
                    ].map(item => (
                      <div key={item.label}>
                        <p className="text-muted-foreground text-xs">{item.label}</p>
                        <p className="font-medium">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : detailQuery.isError ? (
                <p className="text-sm text-muted-foreground">Unable to fetch data for {selectedSymbol}</p>
              ) : !detailQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">No data available for {selectedSymbol}</p>
              ) : null}
            </CardContent>
          </Card>
        )}

        {/* Watchlist */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Watchlist</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {quotesQuery.isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
              ))
            ) : quotesQuery.data?.length ? (
              (Array.isArray(quotesQuery.data) ? quotesQuery.data : []).map((q: any, idx: number) => (
                <Card
                  key={q.symbol || idx}
                  className={`cursor-pointer transition-all hover:border-accent/40 ${selectedSymbol === q.symbol ? "border-accent/60 bg-accent/5" : ""}`}
                  onClick={() => setSelectedSymbol(q.symbol)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">{q.symbol}</span>
                      {(q.change ?? 0) >= 0 ? <TrendingUp className="w-4 h-4 text-green-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold">{q.price != null ? `$${q.price.toFixed(2)}` : "—"}</span>
                      <span className={`text-xs font-medium ${(q.change ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {q.changePercent != null ? `${q.changePercent >= 0 ? "+" : ""}${q.changePercent.toFixed(2)}%` : "—"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{q.name || WATCHLIST[idx]?.name || q.symbol}</p>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Market data unavailable</p>
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Data via Yahoo Finance. Prices may be delayed. Not investment advice.
        </p>
      </div>
    </div>
    </AppShell>
  );
}
