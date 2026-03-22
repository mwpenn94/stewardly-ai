import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Clock,
  Loader2,
} from "lucide-react";

interface RateItem {
  label: string;
  value: number | null;
  key: string;
}

export function PremiumFinanceRates() {
  const { data: rateRow, isLoading } = trpc.verification.getLatestRates.useQuery();

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Transform the single row into an array of rate items
  const rateItems: RateItem[] = rateRow
    ? [
        { label: "SOFR Overnight", value: rateRow.sofr ? parseFloat(rateRow.sofr) : null, key: "sofr" },
        { label: "SOFR 30-Day Avg", value: rateRow.sofr30 ? parseFloat(rateRow.sofr30) : null, key: "sofr30" },
        { label: "SOFR 90-Day Avg", value: rateRow.sofr90 ? parseFloat(rateRow.sofr90) : null, key: "sofr90" },
        { label: "10Y Treasury", value: rateRow.treasury10y ? parseFloat(rateRow.treasury10y) : null, key: "treasury10y" },
        { label: "30Y Treasury", value: rateRow.treasury30y ? parseFloat(rateRow.treasury30y) : null, key: "treasury30y" },
        { label: "Prime Rate", value: rateRow.primeRate ? parseFloat(rateRow.primeRate) : null, key: "primeRate" },
      ].filter((r) => r.value !== null)
    : [];

  if (rateItems.length === 0) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Premium Finance Rates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No rate data available. SOFR and prime rates will appear here once fetched.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          Premium Finance Rates
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rateItems.map((item) => (
            <RateCard key={item.key} label={item.label} value={item.value!} />
          ))}
        </div>
        {rateRow?.rateDate && (
          <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            As of: {new Date(rateRow.rateDate).toLocaleDateString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RateCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-3 rounded-lg bg-background/50 border border-border/30 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Badge variant="outline" className="text-xs text-zinc-500 border-0 px-1">
          <Minus className="h-3 w-3" />
        </Badge>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-semibold tabular-nums">
          {value.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}
