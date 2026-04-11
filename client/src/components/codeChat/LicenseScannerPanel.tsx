/**
 * LicenseScannerPanel — dependency license audit (Pass 258).
 *
 * Walks the project's package.json + node_modules and reports which
 * licenses each dependency carries. Flags strong copyleft / commercial
 * / unknown as higher-risk so users can audit their dependency tree.
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ScrollText,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Loader2,
} from "lucide-react";

type LicenseCategory =
  | "permissive"
  | "weak_copyleft"
  | "strong_copyleft"
  | "commercial"
  | "unknown";

const CATEGORY_LABEL: Record<LicenseCategory, string> = {
  permissive: "Permissive",
  weak_copyleft: "Weak copyleft",
  strong_copyleft: "Strong copyleft",
  commercial: "Commercial",
  unknown: "Unknown",
};

const CATEGORY_COLOR: Record<LicenseCategory, string> = {
  permissive: "text-emerald-500 border-emerald-500/40",
  weak_copyleft: "text-amber-500 border-amber-500/40",
  strong_copyleft: "text-destructive border-destructive/40",
  commercial: "text-amber-500 border-amber-500/40",
  unknown: "text-muted-foreground border-border/60",
};

function riskLabel(risk: number): string {
  switch (risk) {
    case 0:
      return "safe";
    case 1:
      return "caution";
    case 2:
      return "warn";
    case 3:
      return "review";
    default:
      return "unknown";
  }
}

export default function LicenseScannerPanel() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<LicenseCategory | "all">("all");
  const [rootOnly, setRootOnly] = useState(true);
  const [minRisk, setMinRisk] = useState(0);

  const scanQuery = trpc.codeChat.scanLicenses.useQuery(
    {
      rootOnly,
      category: category === "all" ? undefined : category,
      minRisk: minRisk > 0 ? minRisk : undefined,
      search: search || undefined,
    },
    {
      staleTime: 60_000,
    },
  );

  const deps = scanQuery.data?.deps ?? [];
  const summary = scanQuery.data?.summary;

  const highestRiskBadge = useMemo(() => {
    if (!summary) return null;
    if (summary.highestRisk >= 3) {
      return (
        <Badge
          variant="outline"
          className="text-destructive border-destructive/40"
        >
          <ShieldAlert className="h-3 w-3 mr-1" />
          review needed
        </Badge>
      );
    }
    if (summary.highestRisk >= 2) {
      return (
        <Badge
          variant="outline"
          className="text-amber-500 border-amber-500/40"
        >
          <AlertTriangle className="h-3 w-3 mr-1" />
          caution
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="text-emerald-500 border-emerald-500/40"
      >
        <CheckCircle2 className="h-3 w-3 mr-1" />
        all permissive
      </Badge>
    );
  }, [summary]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScrollText className="h-4 w-4 text-accent" />
            Dependency Licenses
            {summary && (
              <>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {summary.total} deps
                </Badge>
                {highestRiskBadge}
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name or license…"
              className="h-8 text-xs flex-1 min-w-[200px]"
              aria-label="Search licenses"
            />
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={rootOnly}
                onChange={(e) => setRootOnly(e.target.checked)}
              />
              Direct only
            </label>
            <select
              value={minRisk}
              onChange={(e) => setMinRisk(Number(e.target.value))}
              className="h-8 px-2 text-xs rounded border border-border bg-background"
              aria-label="Minimum risk level"
            >
              <option value={0}>all risks</option>
              <option value={1}>caution+</option>
              <option value={2}>warn+</option>
              <option value={3}>review only</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => setCategory("all")}
              className={`px-2 py-0.5 rounded-full border transition ${
                category === "all"
                  ? "bg-accent/10 text-accent border-accent/40"
                  : "text-muted-foreground border-border/60"
              }`}
            >
              all
            </button>
            {(Object.keys(CATEGORY_LABEL) as LicenseCategory[]).map((cat) => {
              const count = summary?.byCategory[cat] ?? 0;
              if (count === 0) return null;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-2 py-0.5 rounded-full border transition ${
                    category === cat
                      ? "bg-accent/10 text-accent border-accent/40"
                      : "text-muted-foreground border-border/60"
                  }`}
                >
                  {CATEGORY_LABEL[cat]} · {count}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {summary && summary.byLicense.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
              Top licenses
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {summary.byLicense.slice(0, 15).map((entry) => (
                <div
                  key={entry.license}
                  className="text-[11px] px-2 py-1 rounded bg-muted/40 font-mono"
                >
                  {entry.license} · {entry.count}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {scanQuery.isLoading ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 mx-auto animate-spin" />
          </CardContent>
        </Card>
      ) : deps.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            {scanQuery.data?.error ?? "No dependencies match the filters."}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y divide-border/40">
            {deps.map((d) => (
              <div key={`${d.name}@${d.version}`} className="p-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm truncate">{d.name}</span>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {d.version}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          CATEGORY_COLOR[d.category as LicenseCategory]
                        }`}
                      >
                        {CATEGORY_LABEL[d.category as LicenseCategory]}
                      </Badge>
                      {d.risk >= 2 && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            d.risk >= 3
                              ? "text-destructive border-destructive/40"
                              : "text-amber-500 border-amber-500/40"
                          }`}
                        >
                          {riskLabel(d.risk)}
                        </Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                      {d.license || "(no license declared)"}
                    </div>
                    {d.note && (
                      <div className="text-[11px] text-muted-foreground mt-0.5 italic">
                        {d.note}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
