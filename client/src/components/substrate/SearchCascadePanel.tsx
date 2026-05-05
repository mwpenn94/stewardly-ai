/**
 * SearchCascadePanel — Visualizes the multi-tier search cascade.
 * Absorbed from manus-next-app search engine pattern.
 *
 * Shows which search tiers were consulted (cache → local → web → deep)
 * and their latency/results. Used in the WorkspaceArtifactsPanel when
 * a search action is active.
 */
import { useState } from "react";
import { Search, Database, Globe, Brain, Check, Clock, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type SearchTier = "cache" | "local" | "web" | "deep";

interface TierResult {
  tier: SearchTier;
  status: "pending" | "searching" | "complete" | "skipped";
  latencyMs?: number;
  resultCount?: number;
  source?: string;
}

interface SearchCascadePanelProps {
  query: string;
  tiers: TierResult[];
  totalResults?: number;
  className?: string;
}

const TIER_CONFIG: Record<SearchTier, {
  icon: typeof Search;
  label: string;
  color: string;
}> = {
  cache: { icon: Database, label: "Memory Cache", color: "text-emerald-400" },
  local: { icon: Search, label: "Knowledge Base", color: "text-primary" },
  web: { icon: Globe, label: "Web Search", color: "text-amber-400" },
  deep: { icon: Brain, label: "Deep Research", color: "text-purple-400" },
};

export function SearchCascadePanel({
  query,
  tiers,
  totalResults,
  className = "",
}: SearchCascadePanelProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Query display */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/30 border border-border/50">
        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs text-foreground truncate">{query}</span>
        {totalResults !== undefined && (
          <Badge variant="secondary" className="ml-auto text-[10px] shrink-0">
            {totalResults} results
          </Badge>
        )}
      </div>

      {/* Cascade tiers */}
      <div className="space-y-1.5">
        {tiers.map((tier) => {
          const config = TIER_CONFIG[tier.tier];
          const Icon = config.icon;
          return (
            <div
              key={tier.tier}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md border transition-all duration-300 ${
                tier.status === "searching"
                  ? "border-primary/30 bg-primary/5"
                  : tier.status === "complete"
                  ? "border-border/50 bg-card/50"
                  : tier.status === "skipped"
                  ? "border-border/30 bg-transparent opacity-50"
                  : "border-border/30 bg-transparent"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 ${config.color}`} />
              <span className="text-xs font-medium flex-1">{config.label}</span>

              {/* Status indicator */}
              {tier.status === "searching" && (
                <Loader2 className="w-3 h-3 animate-spin text-primary" />
              )}
              {tier.status === "complete" && (
                <div className="flex items-center gap-1.5">
                  {tier.resultCount !== undefined && (
                    <span className="text-[10px] text-muted-foreground">
                      {tier.resultCount} hits
                    </span>
                  )}
                  {tier.latencyMs !== undefined && (
                    <span className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {tier.latencyMs}ms
                    </span>
                  )}
                  <Check className="w-3 h-3 text-emerald-400" />
                </div>
              )}
              {tier.status === "skipped" && (
                <span className="text-[10px] text-muted-foreground/50">skipped</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
