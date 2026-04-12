/**
 * CommitTimelinePanel — git log timeline (Pass 257).
 *
 * Shows recent commits grouped by day with author / subject / body
 * preview / file stats. Complements GitStatusPanel (current state)
 * and PRDrafterPanel (branch delta) by providing the historical
 * "what changed when" view.
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  GitCommit,
  User,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  // Today? Yesterday? Otherwise day-month
  const now = new Date();
  const delta = now.getTime() - d.getTime();
  const days = Math.floor(delta / (24 * 60 * 60 * 1000));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CommitTimelinePanel() {
  const [limit, setLimit] = useState(50);
  const [search, setSearch] = useState("");
  const [author, setAuthor] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [includeStats, setIncludeStats] = useState(true);

  const historyQuery = trpc.codeChat.gitLogHistory.useQuery(
    {
      limit,
      search: search || undefined,
      author: author || undefined,
      includeStats,
    },
    {
      staleTime: 30_000,
    },
  );

  const groups = historyQuery.data?.groups ?? [];
  const stats = historyQuery.data?.stats;

  const toggleExpanded = (sha: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(sha)) next.delete(sha);
      else next.add(sha);
      return next;
    });
  };

  const topAuthors = useMemo(() => stats?.authors.slice(0, 5) ?? [], [stats]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-accent" />
            Commit Timeline
            {stats && (
              <Badge variant="outline" className="text-[10px] font-mono">
                {stats.total} commit{stats.total === 1 ? "" : "s"}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by subject / body…"
              className="h-8 text-xs flex-1 min-w-[200px]"
              aria-label="Filter commits by subject"
            />
            <Input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Author"
              className="h-8 text-xs w-[140px]"
              aria-label="Filter commits by author"
            />
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="h-8 px-2 text-xs rounded border border-border bg-background"
              aria-label="Max commits"
            >
              {[20, 50, 100, 200].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={includeStats}
                onChange={(e) => setIncludeStats(e.target.checked)}
              />
              file stats
            </label>
          </div>
          {stats && (
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap">
              {stats.totalAdditions > 0 && (
                <span>
                  +<strong className="text-emerald-500">{stats.totalAdditions}</strong>
                </span>
              )}
              {stats.totalDeletions > 0 && (
                <span>
                  −<strong className="text-destructive">{stats.totalDeletions}</strong>
                </span>
              )}
              {topAuthors.length > 0 && (
                <span className="flex items-center gap-2">
                  <User className="h-3 w-3" />
                  {topAuthors.map((a) => `${a.author} (${a.count})`).join(" · ")}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {historyQuery.isLoading ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 mx-auto animate-spin" />
          </CardContent>
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            <GitCommit className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
            No commits found.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <Card key={group.date}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                  {formatDate(group.date)}
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    {group.commits.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-border/30">
                {group.commits.map((commit) => {
                  const isExpanded = expanded.has(commit.sha);
                  return (
                    <div key={commit.sha}>
                      <button
                        type="button"
                        onClick={() => toggleExpanded(commit.sha)}
                        className="w-full text-left p-3 hover:bg-muted/40 flex items-start gap-3"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">{commit.subject}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                            <span className="font-mono">{commit.shortSha}</span>
                            <span>·</span>
                            <span>{commit.author}</span>
                            <span>·</span>
                            <span>{formatTime(commit.date)}</span>
                            {commit.stats && (
                              <>
                                <span>·</span>
                                <span className="font-mono">
                                  {commit.stats.filesChanged} file{commit.stats.filesChanged === 1 ? "" : "s"}
                                </span>
                                <span className="font-mono">
                                  <span className="text-emerald-500">+{commit.stats.additions}</span>
                                  {" "}
                                  <span className="text-destructive">−{commit.stats.deletions}</span>
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="px-3 pb-3 pl-10 space-y-1">
                          {commit.body ? (
                            <pre className="text-[11px] text-muted-foreground font-mono whitespace-pre-wrap break-words">
                              {commit.body}
                            </pre>
                          ) : (
                            <div className="text-[11px] text-muted-foreground italic">
                              No additional body.
                            </div>
                          )}
                          {commit.email && (
                            <div className="text-[10px] font-mono text-muted-foreground">
                              {commit.email}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
