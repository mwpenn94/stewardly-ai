/**
 * TodoMarkerPanel — workspace TODO / FIXME / HACK inventory (Pass 246).
 *
 * Lists every marker comment in the workspace with kind/author/search
 * filtering. Click a row to dispatch the existing `codechat-open-file`
 * custom event so the FileBrowser jumps to the exact line.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ListTodo,
  AlertTriangle,
  Info,
  Bug,
  Wrench,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

const MARKER_KINDS = [
  "TODO",
  "FIXME",
  "HACK",
  "XXX",
  "NOTE",
  "OPTIMIZE",
  "PERF",
  "BUG",
] as const;
type MarkerKind = (typeof MARKER_KINDS)[number];

const KIND_STYLE: Record<MarkerKind, { color: string; Icon: typeof Info }> = {
  TODO: { color: "text-accent border-accent/40 bg-accent/5", Icon: ListTodo },
  FIXME: { color: "text-destructive border-destructive/40 bg-destructive/5", Icon: AlertTriangle },
  BUG: { color: "text-destructive border-destructive/40 bg-destructive/5", Icon: Bug },
  HACK: { color: "text-amber-500 border-amber-500/40 bg-amber-500/5", Icon: Wrench },
  XXX: { color: "text-amber-500 border-amber-500/40 bg-amber-500/5", Icon: AlertTriangle },
  NOTE: { color: "text-muted-foreground border-border/60", Icon: Info },
  OPTIMIZE: { color: "text-chart-3 border-chart-3/40 bg-chart-3/5", Icon: Wrench },
  PERF: { color: "text-chart-3 border-chart-3/40 bg-chart-3/5", Icon: Wrench },
};

export default function TodoMarkerPanel() {
  const [selectedKinds, setSelectedKinds] = useState<MarkerKind[]>([]);
  const [search, setSearch] = useState("");
  const [author, setAuthor] = useState<string | null>(null);

  const scanQuery = trpc.codeChat.scanTodoMarkers.useQuery(
    {
      kinds: selectedKinds.length > 0 ? selectedKinds : undefined,
      search: search || undefined,
      author: author || undefined,
      limit: 500,
    },
    { staleTime: 30_000 },
  );

  const rebuildMutation = trpc.codeChat.rebuildTodoMarkers.useMutation();
  const utils = trpc.useUtils();

  const toggleKind = (kind: MarkerKind) => {
    setSelectedKinds((prev) =>
      prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind],
    );
  };

  const handleRebuild = async () => {
    try {
      const result = await rebuildMutation.mutateAsync();
      utils.codeChat.scanTodoMarkers.invalidate();
      toast.success(`Rescan complete: ${result.count} markers found`);
    } catch (err: any) {
      toast.error(`Rebuild failed: ${err.message ?? err}`);
    }
  };

  const openFile = (path: string, line: number) => {
    window.dispatchEvent(
      new CustomEvent("codechat-open-file", {
        detail: { path, line },
      }),
    );
  };

  const data = scanQuery.data;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ListTodo className="h-4 w-4" /> TODO markers
              {data && (
                <Badge variant="outline" className="text-[9px] h-5 px-1.5 border-border/60 font-mono">
                  {data.total} / {data.totalUnfiltered}
                </Badge>
              )}
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
              Rescan
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search markers…"
              className="text-xs font-mono max-w-xs"
              aria-label="Search markers"
            />
            {author && (
              <Badge
                variant="outline"
                className="text-[10px] h-5 px-1.5 border-accent/40 text-accent cursor-pointer"
                onClick={() => setAuthor(null)}
              >
                author: {author} ×
              </Badge>
            )}
          </div>

          {/* Kind filter chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {MARKER_KINDS.map((kind) => {
              const style = KIND_STYLE[kind];
              const selected = selectedKinds.includes(kind);
              const count = data?.byKind[kind] ?? 0;
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => toggleKind(kind)}
                  className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${
                    selected
                      ? style.color
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                  aria-pressed={selected}
                  disabled={count === 0}
                >
                  {kind} ({count})
                </button>
              );
            })}
            {selectedKinds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedKinds([])}
                className="text-[10px] text-muted-foreground hover:text-foreground underline"
              >
                clear
              </button>
            )}
          </div>

          {/* Top authors + files */}
          {data && (data.topAuthors.length > 0 || data.topFiles.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-mono">
              {data.topAuthors.length > 0 && (
                <div className="border rounded-md p-2">
                  <div className="text-muted-foreground font-medium mb-1">By author</div>
                  <div className="space-y-0.5">
                    {data.topAuthors.slice(0, 5).map((a) => (
                      <button
                        key={a.author}
                        type="button"
                        onClick={() => setAuthor(a.author === author ? null : a.author)}
                        className="w-full flex items-center justify-between gap-2 hover:bg-secondary/20 px-1 rounded"
                      >
                        <span className="truncate">{a.author}</span>
                        <span className="text-muted-foreground tabular-nums">{a.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {data.topFiles.length > 0 && (
                <div className="border rounded-md p-2">
                  <div className="text-muted-foreground font-medium mb-1">By file</div>
                  <div className="space-y-0.5">
                    {data.topFiles.slice(0, 5).map((f) => (
                      <div
                        key={f.path}
                        className="flex items-center justify-between gap-2 px-1"
                      >
                        <span className="truncate">{f.path}</span>
                        <span className="text-muted-foreground tabular-nums">{f.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Marker list */}
          {scanQuery.isLoading ? (
            <p className="text-xs text-muted-foreground italic text-center py-6">
              <Loader2 className="h-3 w-3 animate-spin inline-block mr-1" />
              Scanning workspace…
            </p>
          ) : !data || data.markers.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-6">
              No markers match the current filters.
            </p>
          ) : (
            <ul className="divide-y divide-border/20 border rounded-md max-h-[60vh] overflow-y-auto">
              {data.markers.map((marker, idx) => {
                const style = KIND_STYLE[marker.kind as MarkerKind] ?? KIND_STYLE.TODO;
                const Icon = style.Icon;
                return (
                  <li key={`${marker.path}:${marker.line}:${idx}`}>
                    <button
                      type="button"
                      onClick={() => openFile(marker.path, marker.line)}
                      className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-secondary/20 transition-colors"
                    >
                      <Icon className={`h-3 w-3 shrink-0 mt-0.5 ${style.color.split(" ")[0]}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={`text-[9px] h-4 px-1.5 border ${style.color}`}
                          >
                            {marker.kind}
                          </Badge>
                          {marker.author && (
                            <Badge
                              variant="outline"
                              className="text-[9px] h-4 px-1.5 border-chart-2/40 text-chart-2"
                            >
                              {marker.author}
                            </Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground/70 font-mono">
                            {marker.path}:{marker.line}
                          </span>
                        </div>
                        <div className="text-xs text-foreground mt-0.5 break-words">
                          {marker.message || <span className="italic text-muted-foreground">(no message)</span>}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
