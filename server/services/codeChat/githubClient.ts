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
            if (raw && typeof (raw as any).access_token === "string") {
              return {
                credentials: {
                  kind: "oauth2",
                  accessToken: (raw as any).access_token,
                  refreshToken: (raw as any).refresh_token,
                  expiresAt: (raw as any).expires_at,
                  scope: (raw as any).scope,
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

// ─── Owner/repo parser (used by the chat tool) ───────────────────────────

export function parseRepoString(s: string): {
  owner: string;
  repo: string;
} | null {
  const match = s.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}
