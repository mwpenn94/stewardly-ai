/**
 * EnvInspectorPanel — admin-only env variable inspector (Pass 256).
 *
 * Shows which env vars are set in the running process, which are
 * missing from the expected set, and masked previews of every value
 * so secrets don't leak to the client.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Lock,
  Eye,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";

type EnvCategory =
  | "database"
  | "api_key"
  | "auth"
  | "feature_flag"
  | "service_url"
  | "aws"
  | "mail"
  | "observability"
  | "general";

const CATEGORY_LABEL: Record<EnvCategory, string> = {
  database: "Database",
  api_key: "API Keys",
  auth: "Auth & Secrets",
  feature_flag: "Feature Flags",
  service_url: "Service URLs",
  aws: "AWS",
  mail: "Mail",
  observability: "Observability",
  general: "General",
};

const CATEGORY_COLOR: Record<EnvCategory, string> = {
  database: "text-chart-3 border-chart-3/40",
  api_key: "text-accent border-accent/40",
  auth: "text-destructive border-destructive/40",
  feature_flag: "text-amber-500 border-amber-500/40",
  service_url: "text-sky-400 border-sky-400/40",
  aws: "text-amber-500 border-amber-500/40",
  mail: "text-emerald-500 border-emerald-500/40",
  observability: "text-chart-3 border-chart-3/40",
  general: "text-muted-foreground border-border/60",
};

export default function EnvInspectorPanel() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<EnvCategory | "all">("all");
  const [onlyMissing, setOnlyMissing] = useState(false);

  const inspectQuery = trpc.codeChat.inspectEnv.useQuery(
    {
      category: category === "all" ? undefined : category,
      onlyMissing,
      search: search || undefined,
    },
    {
      enabled: isAdmin,
      staleTime: 30_000,
    },
  );

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          <Lock className="h-5 w-5 mx-auto mb-2" />
          Admin access required to inspect environment variables.
        </CardContent>
      </Card>
    );
  }

  const entries = inspectQuery.data?.entries ?? [];
  const byCategory = inspectQuery.data?.byCategory;
  const missingCount = inspectQuery.data?.missingCount ?? 0;
  const requiredMissing = inspectQuery.data?.requiredMissing ?? 0;
  const totalPresent = inspectQuery.data?.totalPresent ?? 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4 text-accent" />
            Environment Variables
            <Badge variant="outline" className="text-[10px] font-mono">
              {totalPresent} set
            </Badge>
            {requiredMissing > 0 && (
              <Badge
                variant="outline"
                className="text-destructive border-destructive/40 font-mono"
              >
                {requiredMissing} required missing
              </Badge>
            )}
            {missingCount > 0 && requiredMissing === 0 && (
              <Badge
                variant="outline"
                className="text-amber-500 border-amber-500/40 font-mono"
              >
                {missingCount} expected missing
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or category…"
              className="h-8 text-xs"
              aria-label="Search env vars"
            />
            <label className="flex items-center gap-1.5 text-xs whitespace-nowrap cursor-pointer">
              <input
                type="checkbox"
                checked={onlyMissing}
                onChange={(e) => setOnlyMissing(e.target.checked)}
                aria-label="Only missing"
              />
              Only missing
            </label>
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
            {(Object.keys(CATEGORY_LABEL) as EnvCategory[]).map((cat) => {
              const count = byCategory?.[cat] ?? 0;
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

      {entries.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 mx-auto mb-2 text-emerald-500" />
            No matching environment variables.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y divide-border/40">
            {entries.map((entry) => (
              <div
                key={entry.name}
                className="p-3 flex items-center gap-3 hover:bg-muted/30"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm truncate">
                      {entry.name}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] capitalize ${
                        CATEGORY_COLOR[entry.category as EnvCategory]
                      }`}
                    >
                      {CATEGORY_LABEL[entry.category as EnvCategory]}
                    </Badge>
                    {entry.required && (
                      <Badge
                        variant="outline"
                        className="text-[10px] text-destructive border-destructive/40"
                      >
                        required
                      </Badge>
                    )}
                    {entry.missing && (
                      <Badge
                        variant="outline"
                        className="text-[10px] text-amber-500 border-amber-500/40"
                      >
                        missing
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                    {entry.missing ? (
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        not set in process.env
                      </span>
                    ) : entry.revealed ? (
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {entry.displayValue}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Lock className="h-3 w-3" />
                        {entry.displayValue}
                      </span>
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
