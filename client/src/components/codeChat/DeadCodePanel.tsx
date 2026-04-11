/**
 * DeadCodePanel — unused exports + orphan files (Pass 259).
 *
 * Cross-references the symbol index with the import graph to surface
 * exported symbols that nothing imports. Click-through opens the
 * file in the FileBrowser.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Trash2,
  FileX,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

export default function DeadCodePanel() {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const deadQuery = trpc.codeChat.detectDeadCode.useQuery(
    { limit: 500 },
    { staleTime: 60_000 },
  );

  const summary = deadQuery.data?.summary;
  const groups = deadQuery.data?.groups ?? [];
  const orphanFiles = deadQuery.data?.orphanFiles ?? [];

  const filteredGroups = groups
    .map((g) => {
      if (!search) return g;
      const s = search.toLowerCase();
      if (g.path.toLowerCase().includes(s)) return g;
      const entries = g.entries.filter((e) => e.name.toLowerCase().includes(s));
      return { ...g, entries };
    })
    .filter((g) => g.entries.length > 0);

  const toggleExpanded = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const openFile = (path: string, line: number) => {
    window.dispatchEvent(
      new CustomEvent("codechat-open-file", {
        detail: { path, line },
      }),
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trash2 className="h-4 w-4 text-accent" />
            Dead Code
            {summary && (
              <>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {summary.deadEntries} suspect
                </Badge>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {summary.orphanFiles} orphan files
                </Badge>
                {summary.deadEntries === 0 && (
                  <Badge
                    variant="outline"
                    className="text-emerald-500 border-emerald-500/40"
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    clean
                  </Badge>
                )}
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by path or symbol name…"
            className="h-8 text-xs"
            aria-label="Search dead code"
          />
          {summary && Object.keys(summary.byKind).length > 0 && (
            <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              {Object.entries(summary.byKind).map(([kind, count]) => (
                <div
                  key={kind}
                  className="px-2 py-0.5 rounded bg-muted/40 font-mono"
                >
                  {kind}: <strong className="text-foreground">{count}</strong>
                </div>
              ))}
              <span className="ml-auto">
                scanned {summary.totalExports} exports · skipped {summary.skippedEntrypoints} entrypoints
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {deadQuery.isLoading ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 mx-auto animate-spin" />
          </CardContent>
        </Card>
      ) : filteredGroups.length === 0 && search ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No dead code matches &ldquo;{search}&rdquo;.
          </CardContent>
        </Card>
      ) : filteredGroups.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 mx-auto mb-2 text-emerald-500" />
            No suspected dead code. The import graph covers every exported
            symbol in a non-entrypoint file.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredGroups.map((group) => {
            const isExpanded = expanded.has(group.path);
            return (
              <Card key={group.path}>
                <CardContent className="p-0">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(group.path)}
                    className="w-full text-left p-3 hover:bg-muted/40 flex items-center gap-3"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <FileX className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <span className="font-mono text-sm truncate flex-1">
                      {group.path}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {group.entries.length} symbol{group.entries.length === 1 ? "" : "s"}
                    </Badge>
                  </button>
                  {isExpanded && (
                    <div className="divide-y divide-border/30 border-t border-border/40">
                      {group.entries.map((entry) => (
                        <button
                          key={`${entry.path}:${entry.line}:${entry.name}`}
                          type="button"
                          onClick={() => openFile(entry.path, entry.line)}
                          className="w-full text-left px-3 py-2 pl-10 hover:bg-muted/30 flex items-start gap-2"
                        >
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {entry.kind}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-xs">{entry.name}</div>
                            {entry.snippet && (
                              <div className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">
                                {entry.snippet}
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            line {entry.line}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {orphanFiles.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
              Orphan files ({orphanFiles.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-border/40">
            {orphanFiles.slice(0, 30).map((path) => (
              <button
                key={path}
                type="button"
                onClick={() => openFile(path, 1)}
                className="w-full text-left px-4 py-2 hover:bg-muted/40 font-mono text-xs truncate"
              >
                {path}
              </button>
            ))}
            {orphanFiles.length > 30 && (
              <div className="px-4 py-2 text-[11px] text-muted-foreground italic">
                +{orphanFiles.length - 30} more orphan files
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
