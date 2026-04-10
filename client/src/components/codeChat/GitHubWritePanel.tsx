/**
 * GitHubWritePanel — multi-repo GitHub write surface for Code Chat.
 *
 * Pass 201. Gives Code Chat users the ability to:
 *   - Pick any repo they have push access to (not just the app repo)
 *   - Create branches
 *   - Commit + push files (including inline edits from the file browser)
 *   - Open / update / merge pull requests
 *
 * Acts as the "cloud parity" surface for Claude-Code-like git flows.
 * Every mutation goes through the user's own GitHub token so the
 * effective access is what GitHub itself grants — not a shared
 * deployment-wide credential.
 */

import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  GitBranch,
  GitMerge,
  GitPullRequest,
  Github,
  Loader2,
  ExternalLink,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

interface RepoOption {
  owner: string;
  repo: string;
  fullName: string;
  defaultBranch: string;
  description: string | null;
  isPrivate: boolean;
  permissions?: { push: boolean; admin: boolean };
}

export default function GitHubWritePanel() {
  const me = trpc.codeChat.githubMe.useQuery(undefined, { retry: false });
  const reposQuery = trpc.codeChat.githubListMyRepos.useQuery(
    { onlyPushable: true, sort: "pushed", perPage: 100 },
    { retry: false, enabled: me.data?.connected === true },
  );

  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const selected = useMemo(() => {
    if (!reposQuery.data?.repos) return null;
    return (
      reposQuery.data.repos.find((r: RepoOption) => r.fullName === selectedRepo) ??
      null
    );
  }, [reposQuery.data, selectedRepo]);

  // Auto-select the first repo when the list loads
  useEffect(() => {
    if (!selectedRepo && reposQuery.data?.repos && reposQuery.data.repos.length > 0) {
      setSelectedRepo(reposQuery.data.repos[0].fullName);
    }
  }, [reposQuery.data, selectedRepo]);

  if (me.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking GitHub connection…
      </div>
    );
  }

  if (!me.data?.connected) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Github className="h-4 w-4" /> GitHub Not Connected
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            {me.data?.error ??
              "Connect a GitHub account from /integrations or set GITHUB_TOKEN as a fallback."}
          </p>
          <a
            href="/integrations"
            className="inline-flex items-center gap-1 text-accent underline"
          >
            Open Integrations <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      {/* Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Github className="h-4 w-4" /> Connected as @{me.data.user?.login ?? "—"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1">
          <p>
            Credential source:{" "}
            {me.data.source === "user_connection"
              ? "your connected account (/integrations)"
              : "deployment env var (GITHUB_TOKEN)"}
          </p>
          <p>
            You can push to any repo your token has access to — not just{" "}
            <code className="font-mono">mwpenn94/stewardly-ai</code>.
          </p>
        </CardContent>
      </Card>

      {/* Repo picker */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select a repository</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {reposQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading repositories…
            </div>
          ) : reposQuery.data?.error ? (
            <p className="text-sm text-destructive">{reposQuery.data.error}</p>
          ) : (
            <>
              <select
                value={selectedRepo}
                onChange={(e) => setSelectedRepo(e.target.value)}
                className="w-full h-9 rounded border border-border bg-background px-2 text-sm"
                aria-label="Select repository"
              >
                {(reposQuery.data?.repos ?? []).map((r: RepoOption) => (
                  <option key={r.fullName} value={r.fullName}>
                    {r.fullName} {r.isPrivate ? "🔒" : ""} — default: {r.defaultBranch}
                  </option>
                ))}
              </select>
              {selected?.description && (
                <p className="text-xs text-muted-foreground italic">
                  {selected.description}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {selected && <RepoWorkspace repo={selected} />}
    </div>
  );
}

// ─── Per-repo workspace ───────────────────────────────────────────────

function RepoWorkspace({ repo }: { repo: RepoOption }) {
  const branchesQuery = trpc.codeChat.githubListBranches.useQuery(
    { owner: repo.owner, repo: repo.repo },
    { retry: false },
  );
  const prsQuery = trpc.codeChat.githubListPullRequests.useQuery(
    { owner: repo.owner, repo: repo.repo },
    { retry: false },
  );
  const utils = trpc.useUtils();

  const [activeBranch, setActiveBranch] = useState<string>(repo.defaultBranch);

  useEffect(() => {
    setActiveBranch(repo.defaultBranch);
  }, [repo.defaultBranch, repo.fullName]);

  const refetchAll = () => {
    utils.codeChat.githubListBranches.invalidate({
      owner: repo.owner,
      repo: repo.repo,
    });
    utils.codeChat.githubListPullRequests.invalidate({
      owner: repo.owner,
      repo: repo.repo,
    });
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <BranchesCard
        repo={repo}
        branches={branchesQuery.data?.branches ?? []}
        loading={branchesQuery.isLoading}
        activeBranch={activeBranch}
        setActiveBranch={setActiveBranch}
        onChange={refetchAll}
      />
      <CommitFilesCard
        repo={repo}
        branch={activeBranch}
        onChange={refetchAll}
      />
      <PullRequestsCard
        repo={repo}
        prs={prsQuery.data?.prs ?? []}
        loading={prsQuery.isLoading}
        onChange={refetchAll}
      />
      <CreatePullRequestCard repo={repo} onChange={refetchAll} />
    </div>
  );
}

// ─── Branches card ───────────────────────────────────────────────────

function BranchesCard({
  repo,
  branches,
  loading,
  activeBranch,
  setActiveBranch,
  onChange,
}: {
  repo: RepoOption;
  branches: Array<{ name: string; sha: string; protected: boolean }>;
  loading: boolean;
  activeBranch: string;
  setActiveBranch: (b: string) => void;
  onChange: () => void;
}) {
  const [newBranch, setNewBranch] = useState("");
  const [base, setBase] = useState(repo.defaultBranch);
  const createBranch = trpc.codeChat.githubCreateBranch.useMutation();
  const deleteBranch = trpc.codeChat.githubDeleteBranch.useMutation();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <GitBranch className="h-4 w-4" /> Branches ({branches.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <div className="max-h-56 overflow-auto rounded border border-border/40 divide-y divide-border/30">
            {branches.map((b) => (
              <div
                key={b.name}
                className={`flex items-center gap-2 px-2 py-1.5 text-xs ${
                  activeBranch === b.name ? "bg-accent/10" : ""
                }`}
              >
                <button
                  className="flex-1 text-left font-mono truncate"
                  onClick={() => setActiveBranch(b.name)}
                  title={`sha: ${b.sha.slice(0, 7)}`}
                >
                  {b.name}
                  {b.protected && <Badge variant="outline" className="ml-2 text-[9px]">protected</Badge>}
                </button>
                {!b.protected &&
                  b.name !== "main" &&
                  b.name !== "master" && (
                    <button
                      className="text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        if (!confirm(`Delete branch '${b.name}'?`)) return;
                        const res = await deleteBranch.mutateAsync({
                          owner: repo.owner,
                          repo: repo.repo,
                          branch: b.name,
                        });
                        if (res.ok) {
                          toast.success(`Deleted ${b.name}`);
                          onChange();
                        } else toast.error(res.error);
                      }}
                      aria-label={`Delete branch ${b.name}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
              </div>
            ))}
          </div>
        )}
        <div className="space-y-2 pt-2 border-t border-border/40">
          <Label className="text-[10px] uppercase">Create new branch</Label>
          <div className="flex gap-2">
            <Input
              value={newBranch}
              onChange={(e) => setNewBranch(e.target.value)}
              placeholder="feature/my-branch"
              className="h-8 text-xs"
            />
            <select
              value={base}
              onChange={(e) => setBase(e.target.value)}
              className="h-8 text-xs rounded border border-border bg-background px-2"
              aria-label="Base branch"
            >
              {branches.map((b) => (
                <option key={b.name} value={b.name}>
                  from {b.name}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              onClick={async () => {
                if (!newBranch.trim()) return;
                const res = await createBranch.mutateAsync({
                  owner: repo.owner,
                  repo: repo.repo,
                  newBranch: newBranch.trim(),
                  fromBranch: base,
                });
                if (res.ok) {
                  toast.success(`Created ${newBranch}`);
                  setActiveBranch(newBranch.trim());
                  setNewBranch("");
                  onChange();
                } else toast.error(res.error);
              }}
              disabled={createBranch.isPending || !newBranch.trim()}
            >
              {createBranch.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Commit files card (inline editor) ───────────────────────────────

interface EditedFile {
  path: string;
  content: string;
  deleted?: boolean;
}

function CommitFilesCard({
  repo,
  branch,
  onChange,
}: {
  repo: RepoOption;
  branch: string;
  onChange: () => void;
}) {
  const [files, setFiles] = useState<EditedFile[]>([]);
  const [path, setPath] = useState("");
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const [fetchPath, setFetchPath] = useState("");

  const utils = trpc.useUtils();
  const commit = trpc.codeChat.githubCommitFiles.useMutation();
  const [fetching, setFetching] = useState(false);

  const addStagedFile = () => {
    if (!path.trim()) return;
    setFiles((prev) => [
      ...prev.filter((f) => f.path !== path),
      { path: path.trim(), content },
    ]);
    setPath("");
    setContent("");
    toast.success("Staged");
  };

  const loadFromRepo = async () => {
    if (!fetchPath.trim()) return;
    setFetching(true);
    try {
      const res = await utils.codeChat.githubGetFile.fetch({
        owner: repo.owner,
        repo: repo.repo,
        path: fetchPath.trim(),
        ref: branch,
      });
      if (res.file) {
        setPath(res.file.path);
        setContent(res.file.content);
        toast.success(`Loaded ${res.file.path}`);
      } else if (res.error) toast.error(res.error);
    } catch (err) {
      toast.error(String((err as Error).message ?? err));
    } finally {
      setFetching(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Send className="h-4 w-4" /> Commit &amp; Push to{" "}
          <code className="font-mono text-xs text-muted-foreground">{branch}</code>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Load from repo */}
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase">Load file from repo (optional)</Label>
          <div className="flex gap-2">
            <Input
              value={fetchPath}
              onChange={(e) => setFetchPath(e.target.value)}
              placeholder="path/to/file.ts"
              className="h-8 text-xs font-mono"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={loadFromRepo}
              disabled={!fetchPath.trim() || fetching}
            >
              {fetching ? <Loader2 className="h-3 w-3 animate-spin" /> : "Load"}
            </Button>
          </div>
        </div>

        {/* Inline editor */}
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase">Path</Label>
          <Input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="path/to/file.ts"
            className="h-8 text-xs font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase">Content</Label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            className="text-xs font-mono"
            placeholder="// file contents"
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={addStagedFile} disabled={!path.trim()}>
            Stage file
          </Button>
          {files.length > 0 && (
            <Badge variant="secondary">{files.length} staged</Badge>
          )}
        </div>

        {files.length > 0 && (
          <div className="space-y-2 border-t border-border/40 pt-3">
            <div className="max-h-32 overflow-auto rounded border border-border/30 divide-y divide-border/30">
              {files.map((f) => (
                <div key={f.path} className="flex items-center gap-2 px-2 py-1 text-xs">
                  <code className="flex-1 font-mono truncate">{f.path}</code>
                  <Badge variant="outline" className="text-[9px]">
                    {f.deleted ? "delete" : `${new Blob([f.content]).size}B`}
                  </Badge>
                  <button
                    onClick={() =>
                      setFiles((prev) => prev.filter((p) => p.path !== f.path))
                    }
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Unstage ${f.path}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Commit message"
              rows={2}
              className="text-xs"
            />
            <Button
              size="sm"
              className="w-full"
              onClick={async () => {
                if (!message.trim()) {
                  toast.error("Enter a commit message");
                  return;
                }
                const res = await commit.mutateAsync({
                  owner: repo.owner,
                  repo: repo.repo,
                  branch,
                  message: message.trim(),
                  files,
                });
                if (res.ok) {
                  toast.success(
                    `Committed ${(res as any).filesChanged ?? files.length} file(s)`,
                  );
                  setFiles([]);
                  setMessage("");
                  onChange();
                } else {
                  toast.error((res as any).error ?? "commit failed");
                }
              }}
              disabled={commit.isPending || files.length === 0}
            >
              {commit.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-2" />
              ) : (
                <Send className="h-3 w-3 mr-2" />
              )}
              Commit &amp; push {files.length} file{files.length === 1 ? "" : "s"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Pull requests card ───────────────────────────────────────────────

function PullRequestsCard({
  repo,
  prs,
  loading,
  onChange,
}: {
  repo: RepoOption;
  prs: Array<{
    number: number;
    url: string;
    title: string;
    state: string;
    head: string;
    base: string;
  }>;
  loading: boolean;
  onChange: () => void;
}) {
  const merge = trpc.codeChat.githubMergePullRequest.useMutation();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <GitPullRequest className="h-4 w-4" /> Open Pull Requests ({prs.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : prs.length === 0 ? (
          <p className="text-xs text-muted-foreground">No open PRs.</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-auto">
            {prs.map((pr) => (
              <div
                key={pr.number}
                className="border border-border/40 rounded p-2 space-y-1"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    #{pr.number}
                  </Badge>
                  <span className="text-xs font-medium truncate flex-1">{pr.title}</span>
                  <a
                    href={pr.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Open on GitHub"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <p className="text-[10px] font-mono text-muted-foreground truncate">
                  {pr.head} → {pr.base}
                </p>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px]"
                    onClick={async () => {
                      if (!confirm(`Merge PR #${pr.number}?`)) return;
                      const res = await merge.mutateAsync({
                        owner: repo.owner,
                        repo: repo.repo,
                        number: pr.number,
                        mergeMethod: "merge",
                      });
                      if (res.ok) {
                        toast.success(
                          `Merged #${pr.number} (${(res as any).merge?.sha?.slice(0, 7)})`,
                        );
                        onChange();
                      } else toast.error((res as any).error);
                    }}
                    disabled={merge.isPending}
                  >
                    <GitMerge className="h-3 w-3 mr-1" /> Merge
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px]"
                    onClick={async () => {
                      const res = await merge.mutateAsync({
                        owner: repo.owner,
                        repo: repo.repo,
                        number: pr.number,
                        mergeMethod: "squash",
                      });
                      if (res.ok) {
                        toast.success(`Squashed #${pr.number}`);
                        onChange();
                      } else toast.error((res as any).error);
                    }}
                    disabled={merge.isPending}
                  >
                    Squash
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Create PR card ───────────────────────────────────────────────────

function CreatePullRequestCard({
  repo,
  onChange,
}: {
  repo: RepoOption;
  onChange: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [head, setHead] = useState("");
  const [base, setBase] = useState(repo.defaultBranch);

  useEffect(() => {
    setBase(repo.defaultBranch);
  }, [repo.defaultBranch, repo.fullName]);

  const create = trpc.codeChat.githubCreatePullRequest.useMutation();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <GitPullRequest className="h-4 w-4" /> Open a Pull Request
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase">Head</Label>
            <Input
              value={head}
              onChange={(e) => setHead(e.target.value)}
              placeholder="feature/branch"
              className="h-8 text-xs font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase">Base</Label>
            <Input
              value={base}
              onChange={(e) => setBase(e.target.value)}
              placeholder="main"
              className="h-8 text-xs font-mono"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase">Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="PR title"
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase">Body</Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="text-xs"
          />
        </div>
        <Button
          size="sm"
          className="w-full"
          disabled={create.isPending || !title.trim() || !head.trim() || !base.trim()}
          onClick={async () => {
            const res = await create.mutateAsync({
              owner: repo.owner,
              repo: repo.repo,
              head: head.trim(),
              base: base.trim(),
              title: title.trim(),
              body: body.trim() || undefined,
            });
            if (res.ok) {
              toast.success(`Created PR #${(res as any).pr?.number}`);
              setTitle("");
              setBody("");
              setHead("");
              onChange();
            } else {
              toast.error((res as any).error);
            }
          }}
        >
          {create.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin mr-2" />
          ) : (
            <GitPullRequest className="h-3 w-3 mr-2" />
          )}
          Create PR
        </Button>
      </CardContent>
    </Card>
  );
}
