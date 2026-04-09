/**
 * Code Chat — Round B5 admin UI.
 *
 * Minimal admin UI for the Claude-Code-style code chat foundation:
 *   - Read-only file browser (list_directory + read_file)
 *   - Roadmap table with iterate / rescore / mark-done actions
 *   - Word-diff visualizer for two responses
 *
 * Mutations (write/edit/bash) are NOT exposed in this initial UI;
 * they're available via the codeChat tRPC router but require admin
 * + confirmDangerous: true. Wiring those into the UI is deliberately
 * left for a follow-up iteration so the first-pass surface stays safe.
 */

import { useState } from "react";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Loader2,
  FileText,
  FolderOpen,
  GitBranch,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Github,
  ExternalLink,
  Lock,
  Unlock,
} from "lucide-react";
import { toast } from "sonner";

export default function CodeChatPage() {
  return (
    <AppShell title="Code Chat">
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Code Chat (Admin)</h1>
          <p className="text-sm text-muted-foreground">
            Read-only file browser, roadmap iterator, word-diff
            visualizer, and GitHub integration status for the Stewardly
            autonomous coding loop.
          </p>
        </header>

        <Tabs defaultValue="files">
          <TabsList>
            <TabsTrigger value="files">
              <FolderOpen className="mr-2 h-4 w-4" /> Files
            </TabsTrigger>
            <TabsTrigger value="roadmap">
              <GitBranch className="mr-2 h-4 w-4" /> Roadmap
            </TabsTrigger>
            <TabsTrigger value="diff">
              <Sparkles className="mr-2 h-4 w-4" /> Diff
            </TabsTrigger>
            <TabsTrigger value="github">
              <Github className="mr-2 h-4 w-4" /> GitHub
            </TabsTrigger>
          </TabsList>

          <TabsContent value="files">
            <FileBrowser />
          </TabsContent>

          <TabsContent value="roadmap">
            <RoadmapPanel />
          </TabsContent>

          <TabsContent value="diff">
            <DiffPanel />
          </TabsContent>

          <TabsContent value="github">
            <GitHubPanel />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

// ─── File Browser ─────────────────────────────────────────────────────────

function FileBrowser() {
  const [pathInput, setPathInput] = useState(".");
  const dispatch = trpc.codeChat.dispatch.useMutation();
  const [listing, setListing] = useState<{
    path: string;
    entries: Array<{ name: string; type: string; size?: number }>;
  } | null>(null);
  const [fileContent, setFileContent] = useState<{ path: string; content: string } | null>(null);

  const onList = async () => {
    const result = await dispatch.mutateAsync({
      call: { name: "list_directory", args: { path: pathInput } },
      allowMutations: false,
    });
    if (result.kind === "list") {
      setListing(result.result);
      setFileContent(null);
    } else if (result.kind === "error") {
      toast.error(`list failed: ${result.error}`);
    }
  };

  const onRead = async (relPath: string) => {
    const result = await dispatch.mutateAsync({
      call: { name: "read_file", args: { path: relPath } },
      allowMutations: false,
    });
    if (result.kind === "read") {
      setFileContent({ path: result.result.path, content: result.result.content });
    } else if (result.kind === "error") {
      toast.error(`read failed: ${result.error}`);
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="h-4 w-4" /> Workspace
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              placeholder="server/services"
            />
            <Button onClick={onList} disabled={dispatch.isPending}>
              {dispatch.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "List"}
            </Button>
          </div>
          {listing && (
            <div className="border rounded-md max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <tbody>
                  {listing.entries.map((e) => (
                    <tr
                      key={e.name}
                      className="hover:bg-muted cursor-pointer"
                      onClick={() => {
                        if (e.type === "file") {
                          onRead(`${listing.path}/${e.name}`.replace(/^\.\//, ""));
                        } else if (e.type === "directory") {
                          setPathInput(`${listing.path}/${e.name}`.replace(/^\.\//, ""));
                          setTimeout(onList, 0);
                        }
                      }}
                    >
                      <td className="py-1 px-2 w-8">
                        {e.type === "directory" ? "📁" : "📄"}
                      </td>
                      <td className="py-1 px-2">{e.name}</td>
                      <td className="py-1 px-2 text-right text-muted-foreground tabular-nums">
                        {e.size ? `${(e.size / 1024).toFixed(1)}KB` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> {fileContent?.path ?? "No file selected"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {fileContent ? (
            <pre className="text-xs overflow-auto max-h-[500px] bg-muted/50 p-3 rounded-md">
              <code>{fileContent.content}</code>
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              Click a file in the listing to view its contents.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Roadmap Panel ────────────────────────────────────────────────────────

function RoadmapPanel() {
  const roadmap = trpc.codeChat.getRoadmap.useQuery();
  const utils = trpc.useUtils();
  const addItem = trpc.codeChat.addRoadmapItem.useMutation({
    onSuccess: () => utils.codeChat.getRoadmap.invalidate(),
  });
  const iterate = trpc.codeChat.iterateRoadmap.useMutation({
    onSuccess: () => utils.codeChat.getRoadmap.invalidate(),
  });
  const updateStatus = trpc.codeChat.updateRoadmapStatus.useMutation({
    onSuccess: () => utils.codeChat.getRoadmap.invalidate(),
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const onAdd = async () => {
    if (!title.trim()) return;
    await addItem.mutateAsync({
      title,
      description,
      businessValue: 5,
      timeCriticality: 5,
      riskReduction: 5,
      effort: 3,
    });
    setTitle("");
    setDescription("");
    toast.success("Item added to roadmap");
  };

  const onIterate = async () => {
    const r = await iterate.mutateAsync({ topN: 5 });
    toast.success(`Iteration ${r.iterationNumber}: promoted ${r.promoted.length} item(s)`);
  };

  const items = roadmap.data?.roadmap.items ?? [];
  const health = roadmap.data?.health;

  return (
    <div className="space-y-4">
      {/* Health */}
      {health && (
        <Card>
          <CardContent className="grid grid-cols-3 md:grid-cols-6 gap-3 py-4">
            <Stat label="Total" value={health.totalItems} />
            <Stat label="Backlog" value={health.byStatus.backlog} />
            <Stat label="Ready" value={health.byStatus.ready} />
            <Stat label="In Progress" value={health.byStatus.in_progress} />
            <Stat label="Done" value={health.byStatus.done} />
            <Stat label="Avg Priority" value={health.averagePriority.toFixed(1)} />
          </CardContent>
        </Card>
      )}

      {/* Add new item */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add roadmap item</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-3 items-end">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="md:col-span-3 flex justify-between">
            <Button onClick={onAdd} disabled={addItem.isPending || !title.trim()}>
              {addItem.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Add
            </Button>
            <Button onClick={onIterate} disabled={iterate.isPending} variant="outline">
              {iterate.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Iterate roadmap
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items yet.</p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-md border"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.title}</span>
                      <Badge variant="outline">{item.status}</Badge>
                      {item.priority !== undefined && (
                        <Badge variant="secondary">prio {item.priority}</Badge>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {item.status !== "done" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          updateStatus.mutate({ id: item.id, status: "done" })
                        }
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {item.status !== "blocked" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          updateStatus.mutate({ id: item.id, status: "blocked" })
                        }
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-[11px] uppercase text-muted-foreground tracking-wide">
        {label}
      </div>
    </div>
  );
}

// ─── Diff Panel ──────────────────────────────────────────────────────────

function DiffPanel() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const diff = trpc.codeChat.diffResponses.useQuery(
    { a, b },
    { enabled: a.length > 0 && b.length > 0, staleTime: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Response A</Label>
          <Textarea value={a} onChange={(e) => setA(e.target.value)} rows={8} />
        </div>
        <div className="space-y-2">
          <Label>Response B</Label>
          <Textarea value={b} onChange={(e) => setB(e.target.value)} rows={8} />
        </div>
      </div>

      {diff.data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Word diff —{" "}
              <span className="font-normal text-sm text-muted-foreground">
                similarity {(diff.data.stats.similarity * 100).toFixed(0)}% • {diff.data.stats.shared} shared / {diff.data.stats.uniqueToA} A-only / {diff.data.stats.uniqueToB} B-only
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="leading-relaxed text-sm">
              {diff.data.segments.map((seg, i) => {
                const cls =
                  seg.op === "equal"
                    ? ""
                    : seg.op === "insert"
                      ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-200 px-1 rounded"
                      : "bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-200 px-1 rounded line-through";
                return (
                  <span key={i} className={cls}>
                    {seg.text}{" "}
                  </span>
                );
              })}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── GitHub Panel ─────────────────────────────────────────────────────────
//
// Shows the live state of the GitHub self-update integration:
//   - Is GITHUB_TOKEN configured?
//   - Can we reach the configured owner/repo?
//   - Open pull requests on the repo (admin can use this to track
//     in-flight changes without leaving the app).
//
// This is the first user-facing surface for the codeChat → github
// foundation. Write-side procedures (create branch, commit, open PR)
// remain admin+confirmDangerous only and are NOT exposed here yet —
// the read-side proves the integration is live before we add UI paths
// that mutate the repo.
function GitHubPanel() {
  const status = trpc.codeChat.githubStatus.useQuery(undefined, {
    retry: false,
  });
  const prs = trpc.codeChat.githubListOpenPRs.useQuery(undefined, {
    retry: false,
    enabled: status.data?.configured === true,
  });

  return (
    <div className="space-y-4 mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Github className="h-4 w-4" />
            Integration Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {status.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Probing GitHub…
            </div>
          ) : status.data?.configured ? (
            <>
              <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  Connected to{" "}
                  <code className="font-mono text-xs">
                    {status.data.owner}/{status.data.repo}
                  </code>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                <div>
                  <Label className="text-[10px] uppercase">
                    Default branch
                  </Label>
                  <div className="font-mono">
                    {status.data.defaultBranch ?? "—"}
                  </div>
                </div>
                <div>
                  <Label className="text-[10px] uppercase">Visibility</Label>
                  <div className="flex items-center gap-1">
                    {status.data.isPrivate ? (
                      <>
                        <Lock className="h-3 w-3" /> Private
                      </>
                    ) : (
                      <>
                        <Unlock className="h-3 w-3" /> Public
                      </>
                    )}
                  </div>
                </div>
              </div>
              {status.data.description && (
                <p className="text-xs text-muted-foreground italic">
                  {status.data.description}
                </p>
              )}
              {/* Pass 77: show which credential path was used. */}
              <p className="text-[11px] text-muted-foreground">
                Credential source:{" "}
                {status.data.source === "user_connection" ? (
                  <>
                    your connected account (
                    <a href="/integrations" className="underline">
                      /integrations
                    </a>
                    )
                  </>
                ) : status.data.source === "env" ? (
                  <>
                    deployment env var (<code className="font-mono">GITHUB_TOKEN</code>)
                  </>
                ) : (
                  "unknown"
                )}
              </p>
            </>
          ) : (
            <>
              <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <span>Not configured</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {status.data?.error ??
                  "Connect a GitHub account in /integrations (provider slug: `github`) or set the GITHUB_TOKEN env var as a deployment-wide fallback."}
              </p>
              <p className="text-[11px] text-muted-foreground">
                <a href="/integrations" className="underline">
                  Open Integrations →
                </a>{" "}
                · see{" "}
                <code className="font-mono">docs/ENV_SETUP.md</code> for the env fallback path.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GitBranch className="h-4 w-4" /> Open Pull Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!status.data?.configured ? (
            <p className="text-sm text-muted-foreground">
              Connect GitHub above to list open PRs.
            </p>
          ) : prs.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading PRs…
            </div>
          ) : prs.data?.error ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              {prs.data.error}
            </p>
          ) : (prs.data?.prs ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No open pull requests on{" "}
              <code className="font-mono text-xs">
                {status.data.owner}/{status.data.repo}
              </code>
              .
            </p>
          ) : (
            <ul className="space-y-2">
              {(prs.data?.prs ?? []).map((pr) => (
                <li
                  key={pr.number}
                  className="flex items-center justify-between gap-3 rounded border border-border/50 p-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        #{pr.number}
                      </Badge>
                      <span className="text-sm font-medium truncate">
                        {pr.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 font-mono truncate">
                      {pr.head} → {pr.base}
                    </p>
                  </div>
                  <a
                    href={pr.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    title="Open on GitHub"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
