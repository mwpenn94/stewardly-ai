/**
 * GitHub client for the code chat — Round B2.
 *
 * Wraps the subset of the GitHub REST API the code chat needs to:
 *   - Read repo files
 *   - Create branches
 *   - Commit + push (via GitHub's contents API for low-conflict
 *     workflows; falls back to git CLI for complex merges)
 *   - Open pull requests
 *   - Read existing PRs / issues for context
 *
 * Auth model: stores OAuth2 tokens (or PATs for development) in the
 * existing `integration_connections` table the GHL client reuses.
 * Connection slug is `github` and credentialsEncrypted holds either
 * `{ kind: "pat", token }` or `{ kind: "oauth2", access_token, refresh_token, expires_at }`.
 *
 * The client is intentionally network-only — every call hits api.github.com
 * — so all credentials, tokens, and rate limits stay observable from
 * the integration health dashboard.
 */

import { getDb } from "../../db";
import { integrationConnections, integrationProviders } from "../../../drizzle/schema";
import { and, eq } from "drizzle-orm";
import { logger } from "../../_core/logger";
import { decryptCredentials } from "../encryption";

// ─── Credentials ──────────────────────────────────────────────────────────

export interface GitHubPATCredentials {
  kind: "pat";
  token: string;
  username?: string;
}

export interface GitHubOAuthCredentials {
  kind: "oauth2";
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string; // ISO
  scope?: string;
}

export type GitHubCredentials = GitHubPATCredentials | GitHubOAuthCredentials;

export async function loadGitHubCredentials(
  connectionId: string,
): Promise<GitHubCredentials | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(integrationConnections)
    .where(eq(integrationConnections.id, connectionId))
    .limit(1);
  const row = rows[0];
  if (!row || !row.credentialsEncrypted) return null;
  try {
    return JSON.parse(row.credentialsEncrypted) as GitHubCredentials;
  } catch (err) {
    logger.error({ connectionId, err }, "github credentials parse failed");
    return null;
  }
}

/**
 * Env-based credential fallback for the admin Code Chat UI.
 *
 * Returns a Personal Access Token credential if `GITHUB_TOKEN` is set.
 * This lets a deployment wire the GitHub integration without having to
 * provision an `integration_connections` row — useful for the "Code
 * Chat" admin surface which is used by a small number of operators.
 *
 * The env path is SEPARATE from the DB-backed `loadGitHubCredentials`
 * flow so per-user OAuth connections still take precedence when they
 * exist. Callers decide the precedence.
 */
export function loadGitHubCredentialsFromEnv(): GitHubCredentials | null {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;
  return { kind: "pat", token };
}

/**
 * Resolve GitHub credentials for a specific user, preferring a
 * user-scoped `integration_connections` row over the process-wide
 * `GITHUB_TOKEN` env var.
 *
 * Pass 77: before this helper existed, the admin Code Chat → GitHub
 * tab only knew about the env var. That meant only one GitHub
 * identity could be used per deployment, and the "connect via the
 * Integrations page" button couldn't actually do anything. This
 * function unifies the two paths: it first looks up the `github`
 * provider row, finds an ACTIVE `integration_connections` row owned
 * by the caller, decrypts the credentials, and returns them. On any
 * miss it falls through to the env PAT (if set), and finally null.
 *
 * The returned tuple includes the `source` so the UI can show the
 * user whether they're on the "your connected account" path or the
 * "shared deployment token" path — those have very different blast
 * radius properties for self-update commits.
 */
export interface ResolvedGitHubCredentials {
  credentials: GitHubCredentials;
  source: "user_connection" | "env";
  connectionId?: string;
}

export async function loadGitHubCredentialsForUser(
  userId: number,
): Promise<ResolvedGitHubCredentials | null> {
  const db = await getDb();
  if (db) {
    try {
      // 1. Look up the `github` provider row.
      const providerRows = await db
        .select({ id: integrationProviders.id })
        .from(integrationProviders)
        .where(eq(integrationProviders.slug, "github"))
        .limit(1);
      const provider = providerRows[0];
      if (provider) {
        // 2. Find the user's active connection for this provider.
        const connRows = await db
          .select()
          .from(integrationConnections)
          .where(
            and(
              eq(integrationConnections.providerId, provider.id),
              eq(integrationConnections.userId, userId),
            ),
          )
          .limit(1);
        const conn = connRows[0];
        if (conn && conn.credentialsEncrypted && conn.status !== "disconnected") {
          // 3. Decrypt. encryptCredentials / decryptCredentials are
          //    the same helpers used by the Integrations page, so we
          //    inherit their key rotation + format handling.
          try {
            const raw = decryptCredentials(conn.credentialsEncrypted) as
              | Record<string, unknown>
              | null;
            if (raw && typeof raw.token === "string" && raw.token.length > 0) {
              return {
                credentials: {
                  kind: "pat",
                  token: raw.token,
                  username: typeof raw.username === "string" ? raw.username : undefined,
                },
                source: "user_connection",
                connectionId: conn.id,
              };
            }
            // Parity Pass 12: narrow via Record<string, unknown>
            // access instead of `as any` chain. Every field is
            // validated individually so a partial or malformed
            // oauth2 payload can't crash the type system (e.g. a
            // stale migration that has access_token but missing
            // refresh_token). expires_at can legitimately arrive
            // as ISO string, epoch seconds, or epoch ms depending on
            // which OAuth provider populated the row; normalizeExpiresAt
            // maps all three to a single ISO string.
            if (raw && typeof raw.access_token === "string") {
              const refreshToken =
                typeof raw.refresh_token === "string" ? raw.refresh_token : undefined;
              const expiresAt = normalizeExpiresAt(raw.expires_at);
              const scope = typeof raw.scope === "string" ? raw.scope : undefined;
              return {
                credentials: {
                  kind: "oauth2",
                  accessToken: raw.access_token,
                  refreshToken,
                  expiresAt,
                  scope,
                },
                source: "user_connection",
                connectionId: conn.id,
              };
            }
          } catch (err) {
            logger.warn({ userId, err: String(err) }, "github decryptCredentials failed — falling through to env");
          }
        }
      }
    } catch (err) {
      logger.warn({ userId, err: String(err) }, "loadGitHubCredentialsForUser: DB lookup failed — falling through to env");
    }
  }

  // 4. Env fallback — same token for every caller.
  const envCreds = loadGitHubCredentialsFromEnv();
  if (envCreds) return { credentials: envCreds, source: "env" };
  return null;
}

/**
 * Parity Pass 12: normalize an expires_at field from a credentials
 * payload into a single ISO string. Accepts:
 *   - undefined/null → undefined
 *   - ISO string → pass-through after Date() validation
 *   - epoch seconds (< 1e12) → multiplied to ms then ISO
 *   - epoch ms (>= 1e12) → ISO
 * Rejects anything that produces an Invalid Date.
 */
export function normalizeExpiresAt(raw: unknown): string | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === "string") {
    const d = new Date(raw);
    return Number.isFinite(d.getTime()) ? d.toISOString() : undefined;
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    // Heuristic: values below 1e12 are almost certainly epoch seconds
    // (31 Dec 2001 in ms is ~1.01e9, 1 Dec 2033 in s is ~2e9)
    const ms = raw < 1e12 ? raw * 1000 : raw;
    const d = new Date(ms);
    return Number.isFinite(d.getTime()) ? d.toISOString() : undefined;
  }
  return undefined;
}

/** Default owner/repo for the Stewardly self-update workflow, overridable via env. */
export function getDefaultRepo(): { owner: string; repo: string } {
  const raw = process.env.GITHUB_REPO ?? "mwpenn94/stewardly-ai";
  const parsed = parseRepoString(raw);
  return parsed ?? { owner: "mwpenn94", repo: "stewardly-ai" };
}

export function getAuthHeader(creds: GitHubCredentials): string {
  return creds.kind === "pat"
    ? `Bearer ${creds.token}`
    : `Bearer ${creds.accessToken}`;
}

// ─── HTTP helper ──────────────────────────────────────────────────────────

const GH_BASE = "https://api.github.com";

export class GitHubError extends Error {
  constructor(message: string, public status: number, public body?: unknown) {
    super(message);
    this.name = "GitHubError";
  }
}

async function ghFetch<T>(
  creds: GitHubCredentials,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const url = path.startsWith("http") ? path : `${GH_BASE}${path}`;
  const headers: Record<string, string> = {
    Authorization: getAuthHeader(creds),
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "stewardly-codechat/1.0",
  };
  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    headers["Content-Type"] = "application/json";
  }
  const resp = await fetch(url, init);
  if (!resp.ok) {
    let parsed: unknown;
    try {
      parsed = await resp.json();
    } catch {
      parsed = await resp.text().catch(() => "");
    }
    throw new GitHubError(
      `GitHub ${method} ${path} → ${resp.status}`,
      resp.status,
      parsed,
    );
  }
  if (resp.status === 204) return {} as T;
  return (await resp.json()) as T;
}

// ─── Repo info ────────────────────────────────────────────────────────────

export interface RepoInfo {
  owner: string;
  repo: string;
  defaultBranch: string;
  description: string | null;
  isPrivate: boolean;
}

export async function getRepoInfo(
  creds: GitHubCredentials,
  owner: string,
  repo: string,
): Promise<RepoInfo> {
  const data = await ghFetch<{
    default_branch: string;
    description: string | null;
    private: boolean;
  }>(creds, "GET", `/repos/${owner}/${repo}`);
  return {
    owner,
    repo,
    defaultBranch: data.default_branch,
    description: data.description,
    isPrivate: data.private,
  };
}

// ─── File operations ──────────────────────────────────────────────────────

export interface RepoFile {
  path: string;
  sha: string;
  content: string;
  encoding: string;
  size: number;
}

export async function getFileContents(
  creds: GitHubCredentials,
  owner: string,
  repo: string,
  filePath: string,
  ref?: string,
): Promise<RepoFile> {
  const qs = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  const data = await ghFetch<{
    sha: string;
    content: string;
    encoding: string;
    size: number;
  }>(creds, "GET", `/repos/${owner}/${repo}/contents/${filePath}${qs}`);
  // GitHub returns base64-encoded content
  const decoded = Buffer.from(data.content, "base64").toString("utf8");
  return {
    path: filePath,
    sha: data.sha,
    content: decoded,
    encoding: data.encoding,
    size: data.size,
  };
}

export interface CreateOrUpdateFileInput {
  message: string;
  content: string; // raw text; we base64-encode here
  branch: string;
  /** If updating an existing file, pass its current SHA to enable optimistic concurrency */
  sha?: string;
  committer?: { name: string; email: string };
}

export async function createOrUpdateFile(
  creds: GitHubCredentials,
  owner: string,
  repo: string,
  filePath: string,
  input: CreateOrUpdateFileInput,
): Promise<{ commitSha: string; contentSha: string }> {
  const body: Record<string, unknown> = {
    message: input.message,
    content: Buffer.from(input.content, "utf8").toString("base64"),
    branch: input.branch,
  };
  if (input.sha) body.sha = input.sha;
  if (input.committer) body.committer = input.committer;
  const data = await ghFetch<{
    commit: { sha: string };
    content: { sha: string };
  }>(creds, "PUT", `/repos/${owner}/${repo}/contents/${filePath}`, body);
  return { commitSha: data.commit.sha, contentSha: data.content.sha };
}

// ─── Branches ─────────────────────────────────────────────────────────────

export async function getBranchSha(
  creds: GitHubCredentials,
  owner: string,
  repo: string,
  branch: string,
): Promise<string> {
  const data = await ghFetch<{ object: { sha: string } }>(
    creds,
    "GET",
    `/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`,
  );
  return data.object.sha;
}

export async function createBranch(
  creds: GitHubCredentials,
  owner: string,
  repo: string,
  newBranch: string,
  fromBranch: string,
): Promise<{ ref: string; sha: string }> {
  const baseSha = await getBranchSha(creds, owner, repo, fromBranch);
  const data = await ghFetch<{ ref: string; object: { sha: string } }>(
    creds,
    "POST",
    `/repos/${owner}/${repo}/git/refs`,
    { ref: `refs/heads/${newBranch}`, sha: baseSha },
  );
  return { ref: data.ref, sha: data.object.sha };
}

// ─── Pull requests ────────────────────────────────────────────────────────

export interface PullRequest {
  number: number;
  url: string;
  title: string;
  body: string | null;
  state: string;
  head: string;
  base: string;
}

export async function createPullRequest(
  creds: GitHubCredentials,
  owner: string,
  repo: string,
  input: {
    title: string;
    body?: string;
    head: string;
    base: string;
    draft?: boolean;
  },
): Promise<PullRequest> {
  const data = await ghFetch<{
    number: number;
    html_url: string;
    title: string;
    body: string | null;
    state: string;
    head: { ref: string };
    base: { ref: string };
  }>(creds, "POST", `/repos/${owner}/${repo}/pulls`, input);
  return {
    number: data.number,
    url: data.html_url,
    title: data.title,
    body: data.body,
    state: data.state,
    head: data.head.ref,
    base: data.base.ref,
  };
}

export async function listOpenPullRequests(
  creds: GitHubCredentials,
  owner: string,
  repo: string,
): Promise<PullRequest[]> {
  const data = await ghFetch<
    Array<{
      number: number;
      html_url: string;
      title: string;
      body: string | null;
      state: string;
      head: { ref: string };
      base: { ref: string };
    }>
  >(creds, "GET", `/repos/${owner}/${repo}/pulls?state=open&per_page=50`);
  return data.map((pr) => ({
    number: pr.number,
    url: pr.html_url,
    title: pr.title,
    body: pr.body,
    state: pr.state,
    head: pr.head.ref,
    base: pr.base.ref,
  }));
}

/**
 * Update an existing pull request (title, body, state, base).
 * Use `state: "closed"` to close without merging.
 */
export async function updatePullRequest(
  creds: GitHubCredentials,
  owner: string,
  repo: string,
  number: number,
  input: {
    title?: string;
    body?: string;
    state?: "open" | "closed";
    base?: string;
  },
): Promise<PullRequest> {
  const data = await ghFetch<{
    number: number;
    html_url: string;
    title: string;
    body: string | null;
    state: string;
    head: { ref: string };
    base: { ref: string };
  }>(creds, "PATCH", `/repos/${owner}/${repo}/pulls/${number}`, input);
  return {
    number: data.number,
    url: data.html_url,
    title: data.title,
    body: data.body,
    state: data.state,
    head: data.head.ref,
    base: data.base.ref,
  };
}

/**
 * Merge a pull request.
 *
 * `method`:
 *   - "merge"  — merge commit (preserves history)
 *   - "squash" — squash into a single commit
 *   - "rebase" — rebase the PR onto the base
 *
 * Returns the merge commit SHA on success. Throws GitHubError(405) if
 * the PR is not mergeable (conflicts, failing required checks,
 * branch-protection blocks).
 */
export interface MergeResult {
  sha: string;
  merged: boolean;
  message: string;
}

export async function mergePullRequest(
  creds: GitHubCredentials,
  owner: string,
  repo: string,
  number: number,
  input: {
    commitTitle?: string;
    commitMessage?: string;
    mergeMethod?: "merge" | "squash" | "rebase";
    sha?: string;
  } = {},
): Promise<MergeResult> {
  const body: Record<string, unknown> = {};
  if (input.commitTitle) body.commit_title = input.commitTitle;
  if (input.commitMessage) body.commit_message = input.commitMessage;
  if (input.mergeMethod) body.merge_method = input.mergeMethod;
  if (input.sha) body.sha = input.sha;
  const data = await ghFetch<{
    sha: string;
    merged: boolean;
    message: string;
  }>(creds, "PUT", `/repos/${owner}/${repo}/pulls/${number}/merge`, body);
  return {
    sha: data.sha,
    merged: data.merged,
    message: data.message,
  };
}

/** Single-PR detail view (includes mergeable state + checks). */
export interface PullRequestDetail extends PullRequest {
  mergeable: boolean | null;
  mergeableState: string;
  draft: boolean;
  commits: number;
  additions: number;
  deletions: number;
  changedFiles: number;
}

export async function getPullRequest(
  creds: GitHubCredentials,
  owner: string,
  repo: string,
  number: number,
): Promise<PullRequestDetail> {
  const data = await ghFetch<{
    number: number;
    html_url: string;
    title: string;
    body: string | null;
    state: string;
    head: { ref: string };
    base: { ref: string };
    mergeable: boolean | null;
    mergeable_state: string;
    draft: boolean;
    commits: number;
    additions: number;
    deletions: number;
    changed_files: number;
  }>(creds, "GET", `/repos/${owner}/${repo}/pulls/${number}`);
  return {
    number: data.number,
    url: data.html_url,
    title: data.title,
    body: data.body,
    state: data.state,
    head: data.head.ref,
    base: data.base.ref,
    mergeable: data.mergeable,
    mergeableState: data.mergeable_state,
    draft: data.draft,
    commits: data.commits,
    additions: data.additions,
    deletions: data.deletions,
    changedFiles: data.changed_files,
  };
}

// ─── User + repository listing ───────────────────────────────────────────
//
// These power the multi-repo GitHub write surface. The caller's PAT
// determines which repositories are visible — we only ever surface
// what the user themselves has access to.

export interface AuthenticatedUser {
  login: string;
  id: number;
  avatarUrl: string;
  name: string | null;
  email: string | null;
}

export async function getAuthenticatedUser(
  creds: GitHubCredentials,
): Promise<AuthenticatedUser> {
  const data = await ghFetch<{
    login: string;
    id: number;
    avatar_url: string;
    name: string | null;
    email: string | null;
  }>(creds, "GET", `/user`);
  return {
    login: data.login,
    id: data.id,
    avatarUrl: data.avatar_url,
    name: data.name,
    email: data.email,
  };
}

export interface RepoSummary {
  owner: string;
  repo: string;
  fullName: string;
  defaultBranch: string;
  description: string | null;
  isPrivate: boolean;
  permissions?: {
    admin: boolean;
    push: boolean;
    pull: boolean;
    maintain?: boolean;
    triage?: boolean;
  };
  pushedAt: string | null;
  htmlUrl: string;
}

/**
 * List repositories the caller has access to. Defaults to repos with
 * push permission (what the Code Chat write surface actually needs)
 * but callers can override with `affiliation: "owner,collaborator,organization_member"`
 * to see everything.
 */
export async function listUserRepositories(
  creds: GitHubCredentials,
  opts: {
    affiliation?: string;
    perPage?: number;
    sort?: "created" | "updated" | "pushed" | "full_name";
    onlyPushable?: boolean;
  } = {},
): Promise<RepoSummary[]> {
  const perPage = Math.min(Math.max(opts.perPage ?? 100, 1), 100);
  const sort = opts.sort ?? "pushed";
  const affiliation =
    opts.affiliation ?? "owner,collaborator,organization_member";
  const data = await ghFetch<
    Array<{
      name: string;
      full_name: string;
      owner: { login: string };
      default_branch: string;
      description: string | null;
      private: boolean;
      permissions?: {
        admin: boolean;
        push: boolean;
        pull: boolean;
        maintain?: boolean;
        triage?: boolean;
      };
      pushed_at: string | null;
      html_url: string;
    }>
  >(
    creds,
    "GET",
    `/user/repos?per_page=${perPage}&sort=${sort}&affiliation=${encodeURIComponent(affiliation)}`,
  );
  const all = data.map((r) => ({
    owner: r.owner.login,
    repo: r.name,
    fullName: r.full_name,
    defaultBranch: r.default_branch,
    description: r.description,
    isPrivate: r.private,
    permissions: r.permissions,
    pushedAt: r.pushed_at,
    htmlUrl: r.html_url,
  }));
  if (opts.onlyPushable) {
    return all.filter((r) => r.permissions?.push !== false);
  }
  return all;
}

/** List branches for a repo (paginated; returns first 100 by default). */
export interface BranchSummary {
  name: string;
  sha: string;
  protected: boolean;
}

export async function listBranches(
  creds: GitHubCredentials,
  owner: string,
  repo: string,
  perPage = 100,
): Promise<BranchSummary[]> {
  const data = await ghFetch<
    Array<{
      name: string;
      commit: { sha: string };
      protected: boolean;
    }>
  >(creds, "GET", `/repos/${owner}/${repo}/branches?per_page=${perPage}`);
  return data.map((b) => ({
    name: b.name,
    sha: b.commit.sha,
    protected: b.protected,
  }));
}

// ─── Multi-file commit via the Git Data API ───────────────────────────────
//
// GitHub's contents API (createOrUpdateFile) only handles one file per
// commit. For anything beyond a single-file change we build a tree +
// commit manually:
//   1. Get the base branch's tip SHA
//   2. Create a blob per file
//   3. Create a tree referencing every blob
//   4. Create a commit pointing at the new tree
//   5. Update the branch ref to the new commit
//
// This is the same path `git push` takes under the hood and lets us
// commit dozens of files atomically in a single commit.

export interface MultiFileCommitInput {
  branch: string;
  message: string;
  files: Array<{ path: string; content: string; deleted?: boolean }>;
  committer?: { name: string; email: string };
  author?: { name: string; email: string };
}

export interface MultiFileCommitResult {
  commitSha: string;
  treeSha: string;
  branch: string;
  filesChanged: number;
  url: string;
}

export async function commitMultipleFiles(
  creds: GitHubCredentials,
  owner: string,
  repo: string,
  input: MultiFileCommitInput,
): Promise<MultiFileCommitResult> {
  if (input.files.length === 0) {
    throw new Error("commitMultipleFiles requires at least one file");
  }

  // 1. Resolve the branch's current tip
  const baseSha = await getBranchSha(creds, owner, repo, input.branch);

  // Look up the base commit's tree SHA
  const baseCommit = await ghFetch<{ tree: { sha: string } }>(
    creds,
    "GET",
    `/repos/${owner}/${repo}/git/commits/${baseSha}`,
  );
  const baseTreeSha = baseCommit.tree.sha;

  // 2. Create a blob per non-deleted file
  const treeEntries: Array<{
    path: string;
    mode: "100644";
    type: "blob";
    sha?: string | null;
    content?: string;
  }> = [];

  for (const file of input.files) {
    if (file.deleted) {
      // Passing sha: null deletes the file from the new tree
      treeEntries.push({
        path: file.path,
        mode: "100644",
        type: "blob",
        sha: null,
      });
      continue;
    }
    const blob = await ghFetch<{ sha: string }>(
      creds,
      "POST",
      `/repos/${owner}/${repo}/git/blobs`,
      {
        content: Buffer.from(file.content, "utf8").toString("base64"),
        encoding: "base64",
      },
    );
    treeEntries.push({
      path: file.path,
      mode: "100644",
      type: "blob",
      sha: blob.sha,
    });
  }

  // 3. Create a new tree
  const tree = await ghFetch<{ sha: string }>(
    creds,
    "POST",
    `/repos/${owner}/${repo}/git/trees`,
    {
      base_tree: baseTreeSha,
      tree: treeEntries,
    },
  );

  // 4. Create the commit
  const commit = await ghFetch<{
    sha: string;
    html_url: string;
  }>(creds, "POST", `/repos/${owner}/${repo}/git/commits`, {
    message: input.message,
    tree: tree.sha,
    parents: [baseSha],
    author: input.author,
    committer: input.committer,
  });

  // 5. Update the branch ref
  await ghFetch(
    creds,
    "PATCH",
    `/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(input.branch)}`,
    { sha: commit.sha, force: false },
  );

  return {
    commitSha: commit.sha,
    treeSha: tree.sha,
    branch: input.branch,
    filesChanged: input.files.length,
    url: commit.html_url,
  };
}

// ─── Delete branch ───────────────────────────────────────────────────────

export async function deleteBranch(
  creds: GitHubCredentials,
  owner: string,
  repo: string,
  branch: string,
): Promise<void> {
  await ghFetch(
    creds,
    "DELETE",
    `/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`,
  );
}

// ─── Owner/repo parser (used by the chat tool) ───────────────────────────

export function parseRepoString(s: string): {
  owner: string;
  repo: string;
} | null {
  const match = s.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

// ─── Gists (Pass 219) ─────────────────────────────────────────────────────
//
// Minimal wrapper around the GitHub Gists API. Lets Code Chat
// publish a conversation as a shareable URL with one click. Uses the
// caller's own PAT so the gist is owned by the user, respects their
// account's public/secret default, and shows up in their own gist
// list.

export interface CreateGistInput {
  description: string;
  public: boolean;
  files: Record<string, { content: string }>;
}

export interface GistResult {
  id: string;
  url: string; // html_url
  rawUrl?: string;
}

export async function createGist(
  creds: GitHubCredentials,
  input: CreateGistInput,
): Promise<GistResult> {
  const data = await ghFetch<{
    id: string;
    html_url: string;
    files: Record<string, { raw_url: string }>;
  }>(creds, "POST", `/gists`, {
    description: input.description,
    public: input.public,
    files: input.files,
  });
  const firstFileKey = Object.keys(data.files)[0];
  return {
    id: data.id,
    url: data.html_url,
    rawUrl: firstFileKey ? data.files[firstFileKey].raw_url : undefined,
  };
}

// ─── Permission gate helper ───────────────────────────────────────────────
//
// Quick server-side sanity check: does the caller's token actually have
// push access to the requested repo? Used by the multi-repo write
// surface to give a clear error before we burn a commit/branch attempt
// against a repo the user only has read access to.

export async function verifyPushAccess(
  creds: GitHubCredentials,
  owner: string,
  repo: string,
): Promise<{ canPush: boolean; reason?: string }> {
  try {
    const info = await ghFetch<{
      permissions?: { push?: boolean; admin?: boolean };
    }>(creds, "GET", `/repos/${owner}/${repo}`);
    if (info.permissions?.push || info.permissions?.admin) {
      return { canPush: true };
    }
    return {
      canPush: false,
      reason:
        "Authenticated user does not have push permission on this repository.",
    };
  } catch (err) {
    const status = err instanceof GitHubError ? err.status : 0;
    return {
      canPush: false,
      reason:
        status === 404
          ? "Repository not found or not accessible to this token."
          : `GitHub permission probe failed (${status || "network"}).`,
    };
  }
}
