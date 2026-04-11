/**
 * ImportGraphPanel — inspect file dependencies (Pass 245).
 *
 * Left card: lookup input + stats strip + hot-files leaderboard.
 * Right card: for the selected file, shows imports (out-edges) and
 * importedBy (in-edges) lists with click-to-navigate.
 *
 * Click any file in either list to drill into its dependencies.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  GitBranch,
  ArrowRight,
  ArrowLeft,
  Flame,
  RefreshCw,
  Loader2,
  FileCode,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

export default function ImportGraphPanel() {
  const [path, setPath] = useState<string>("server/_core/index.ts");
  const depsQuery = trpc.codeChat.fileDependencies.useQuery(
    { path },
    { enabled: !!path, staleTime: 30_000 },
  );
  const hotQuery = trpc.codeChat.importGraphHotFiles.useQuery(
    { limit: 10 },
    { staleTime: 30_000 },
  );
  const rebuildMutation = trpc.codeChat.rebuildImportGraph.useMutation();
  const utils = trpc.useUtils();

  const handleRebuild = async () => {
    try {
      await rebuildMutation.mutateAsync();
      utils.codeChat.fileDependencies.invalidate();
      utils.codeChat.importGraphHotFiles.invalidate();
      toast.success("Import graph rebuilt");
    } catch (err: any) {
      toast.error(`Rebuild failed: ${err.message ?? err}`);
    }
  };

  const deps = depsQuery.data;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4" /> Dependency graph
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRebuild}
              disabled={rebuildMutation.isPending}
              className="h-7 text-[10px]"
            >
              <RefreshCw
                className={`h-3 w-3 mr-1 ${rebuildMutation.isPending ? "animate-spin" : ""}`}
              />
              Rebuild
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="Workspace-relative path…"
              className="text-xs font-mono"
              aria-label="File path to inspect"
            />
          </div>

          {/* Stats strip */}
          {hotQuery.data?.stats && (
            <div className="flex flex-wrap gap-1.5 text-[10px]">
              <Badge variant="outline" className="h-5 px-1.5 border-border/60 font-mono">
                {hotQuery.data.stats.totalFiles} files
              </Badge>
              <Badge variant="outline" className="h-5 px-1.5 border-border/60 font-mono">
                {hotQuery.data.stats.totalEdges} edges
              </Badge>
              <Badge variant="outline" className="h-5 px-1.5 border-border/60 font-mono">
                {hotQuery.data.stats.leafCount} leaves
              </Badge>
              <Badge variant="outline" className="h-5 px-1.5 border-border/60 font-mono">
                avg fanout {hotQuery.data.stats.avgFanout.toFixed(1)}
              </Badge>
            </div>
          )}

          {/* Hot files leaderboard */}
          <div className="border rounded-md overflow-hidden">
            <div className="px-3 py-1.5 bg-background/60 border-b border-border/30 flex items-center gap-1.5 text-[11px] font-medium">
              <Flame className="h-3 w-3 text-chart-3" /> Most-imported files
            </div>
            {hotQuery.isLoading ? (
              <p className="text-[10px] text-muted-foreground italic text-center py-3">
                Loading…
              </p>
            ) : (
              <ul className="divide-y divide-border/20 max-h-64 overflow-y-auto">
                {(hotQuery.data?.hot ?? []).map((entry) => (
                  <li key={entry.path}>
                    <button
                      type="button"
                      onClick={() => setPath(entry.path)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-[10px] hover:bg-secondary/20 text-left"
                    >
                      <span className="font-mono truncate">{entry.path}</span>
                      <Badge
                        variant="outline"
                        className="shrink-0 text-[9px] h-4 px-1 border-chart-3/40 text-chart-3"
                      >
                        {entry.count} in
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 min-w-0">
            <FileCode className="h-4 w-4 shrink-0" />
            <span className="font-mono text-xs truncate">{path}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {depsQuery.isLoading ? (
            <p className="text-xs text-muted-foreground italic text-center py-6">
              <Loader2 className="h-3 w-3 animate-spin inline-block mr-1" />
              Loading dependencies…
            </p>
          ) : !deps ? (
            <p className="text-xs text-muted-foreground italic text-center py-6">
              Enter a workspace-relative path on the left.
            </p>
          ) : (
            <>
              {/* Imports (outgoing) */}
              <div className="border rounded-md overflow-hidden">
                <div className="px-3 py-1.5 bg-background/60 border-b border-border/30 flex items-center gap-1.5 text-[11px] font-medium">
                  <ArrowRight className="h-3 w-3 text-accent" />
                  Imports ({deps.imports.length})
                </div>
                {deps.imports.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground italic text-center py-3">
                    No workspace-internal imports.
                  </p>
                ) : (
                  <ul className="divide-y divide-border/20 max-h-40 overflow-y-auto">
                    {deps.imports.map((dep) => (
                      <li key={dep}>
                        <button
                          type="button"
                          onClick={() => setPath(dep)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] hover:bg-secondary/20 text-left font-mono"
                        >
                          {dep}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Imported by (incoming) */}
              <div className="border rounded-md overflow-hidden">
                <div className="px-3 py-1.5 bg-background/60 border-b border-border/30 flex items-center gap-1.5 text-[11px] font-medium">
                  <ArrowLeft className="h-3 w-3 text-chart-3" />
                  Imported by ({deps.importedBy.length})
                </div>
                {deps.importedBy.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground italic text-center py-3">
                    No files import this. It's a leaf.
                  </p>
                ) : (
                  <ul className="divide-y divide-border/20 max-h-40 overflow-y-auto">
                    {deps.importedBy.map((dep) => (
                      <li key={dep}>
                        <button
                          type="button"
                          onClick={() => setPath(dep)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] hover:bg-secondary/20 text-left font-mono"
                        >
                          {dep}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Unresolved specifiers */}
              {deps.unresolved.length > 0 && (
                <div className="border rounded-md overflow-hidden">
                  <div className="px-3 py-1.5 bg-background/60 border-b border-border/30 flex items-center gap-1.5 text-[11px] font-medium">
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                    Unresolved ({deps.unresolved.length})
                  </div>
                  <ul className="divide-y divide-border/20 max-h-32 overflow-y-auto">
                    {deps.unresolved.map((spec, i) => (
                      <li
                        key={`${spec}-${i}`}
                        className="px-3 py-1.5 text-[10px] font-mono text-muted-foreground"
                      >
                        {spec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
