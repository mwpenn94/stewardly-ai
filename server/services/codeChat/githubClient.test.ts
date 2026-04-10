/**
 * Tests for the GitHub client write surface (Pass 201).
 *
 * These use a stubbed fetch so they run offline. The assertions
 * focus on:
 *   - URL + method + body shape sent to the GitHub API
 *   - Happy-path decoding of response payloads
 *   - Error surfaces (GitHubError with status code)
 *   - Multi-file commit flow (blob → tree → commit → ref)
 *   - Push-access verification gate
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  GitHubError,
  createBranch,
  mergePullRequest,
  updatePullRequest,
  getAuthenticatedUser,
  listUserRepositories,
  listBranches,
  commitMultipleFiles,
  verifyPushAccess,
  parseRepoString,
  deleteBranch,
  type GitHubCredentials,
} from "./githubClient";

const creds: GitHubCredentials = { kind: "pat", token: "gh-test-token" };

interface StubCall {
  url: string;
  method: string;
  body?: unknown;
}

let stubCalls: StubCall[] = [];
let stubResponders: Array<(req: StubCall) => Response | Promise<Response>> = [];

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  stubCalls = [];
  stubResponders = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    const call: StubCall = {
      url: url.toString(),
      method: init.method ?? "GET",
      body: init.body ? JSON.parse(init.body as string) : undefined,
    };
    stubCalls.push(call);
    const responder = stubResponders.shift();
    if (!responder) {
      return new Response(
        JSON.stringify({ message: "no stub responder configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
    return responder(call);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function respondWith(responder: (req: StubCall) => Response | Promise<Response>) {
  stubResponders.push(responder);
}

describe("githubClient — parseRepoString", () => {
  it("parses owner/repo", () => {
    expect(parseRepoString("mwpenn94/stewardly-ai")).toEqual({
      owner: "mwpenn94",
      repo: "stewardly-ai",
    });
  });
  it("rejects malformed input", () => {
    expect(parseRepoString("nope")).toBeNull();
    expect(parseRepoString("a/b/c")).toBeNull();
  });
});

describe("githubClient — getAuthenticatedUser", () => {
  it("returns the authenticated user's profile", async () => {
    respondWith(() =>
      jsonResponse({
        login: "octocat",
        id: 1,
        avatar_url: "https://example.test/avatar.png",
        name: "The Octocat",
        email: null,
      }),
    );
    const user = await getAuthenticatedUser(creds);
    expect(user.login).toBe("octocat");
    expect(user.name).toBe("The Octocat");
    expect(stubCalls[0].url).toContain("/user");
    expect(stubCalls[0].method).toBe("GET");
  });

  it("raises GitHubError on 401", async () => {
    respondWith(() => errorResponse(401, "Bad credentials"));
    await expect(getAuthenticatedUser(creds)).rejects.toBeInstanceOf(GitHubError);
  });
});

describe("githubClient — listUserRepositories", () => {
  it("filters to pushable repos when onlyPushable=true", async () => {
    respondWith(() =>
      jsonResponse([
        {
          name: "a",
          full_name: "octocat/a",
          owner: { login: "octocat" },
          default_branch: "main",
          description: null,
          private: false,
          permissions: { admin: true, push: true, pull: true },
          pushed_at: "2026-04-01T00:00:00Z",
          html_url: "https://github.com/octocat/a",
        },
        {
          name: "b",
          full_name: "octocat/b",
          owner: { login: "octocat" },
          default_branch: "main",
          description: null,
          private: true,
          permissions: { admin: false, push: false, pull: true },
          pushed_at: null,
          html_url: "https://github.com/octocat/b",
        },
      ]),
    );
    const repos = await listUserRepositories(creds, { onlyPushable: true });
    expect(repos.length).toBe(1);
    expect(repos[0].fullName).toBe("octocat/a");
    expect(stubCalls[0].url).toContain("/user/repos");
    expect(stubCalls[0].url).toContain("affiliation=");
  });
});

describe("githubClient — listBranches", () => {
  it("maps the payload to BranchSummary[]", async () => {
    respondWith(() =>
      jsonResponse([
        { name: "main", commit: { sha: "abc123" }, protected: true },
        { name: "feat/x", commit: { sha: "def456" }, protected: false },
      ]),
    );
    const branches = await listBranches(creds, "octocat", "a");
    expect(branches).toHaveLength(2);
    expect(branches[0]).toEqual({ name: "main", sha: "abc123", protected: true });
  });
});

describe("githubClient — createBranch", () => {
  it("resolves base SHA then posts a new ref", async () => {
    respondWith(() => jsonResponse({ object: { sha: "baseSha" } }));
    respondWith(() =>
      jsonResponse({ ref: "refs/heads/feat", object: { sha: "baseSha" } }),
    );
    const result = await createBranch(creds, "octocat", "a", "feat", "main");
    expect(result.ref).toBe("refs/heads/feat");
    expect(stubCalls[0].url).toContain("/git/refs/heads/main");
    expect(stubCalls[1].url).toContain("/git/refs");
    expect(stubCalls[1].method).toBe("POST");
    expect((stubCalls[1].body as any).sha).toBe("baseSha");
  });
});

describe("githubClient — commitMultipleFiles", () => {
  it("runs the 5-step git data flow", async () => {
    // 1. get branch sha
    respondWith(() => jsonResponse({ object: { sha: "baseCommitSha" } }));
    // 2. get base commit for tree sha
    respondWith(() => jsonResponse({ tree: { sha: "baseTreeSha" } }));
    // 3. create blob #1
    respondWith(() => jsonResponse({ sha: "blob1Sha" }));
    // 4. create blob #2
    respondWith(() => jsonResponse({ sha: "blob2Sha" }));
    // 5. create tree
    respondWith(() => jsonResponse({ sha: "newTreeSha" }));
    // 6. create commit
    respondWith(() =>
      jsonResponse({
        sha: "newCommitSha",
        html_url: "https://github.com/octocat/a/commit/newCommitSha",
      }),
    );
    // 7. update ref
    respondWith(() => jsonResponse({}));

    const result = await commitMultipleFiles(creds, "octocat", "a", {
      branch: "main",
      message: "multi file commit",
      files: [
        { path: "a.txt", content: "hello" },
        { path: "b.txt", content: "world" },
      ],
    });

    expect(result.commitSha).toBe("newCommitSha");
    expect(result.treeSha).toBe("newTreeSha");
    expect(result.filesChanged).toBe(2);
    expect(stubCalls.map((c) => c.url)).toEqual([
      expect.stringContaining("/git/refs/heads/main"),
      expect.stringContaining("/git/commits/baseCommitSha"),
      expect.stringContaining("/git/blobs"),
      expect.stringContaining("/git/blobs"),
      expect.stringContaining("/git/trees"),
      expect.stringContaining("/git/commits"),
      expect.stringContaining("/git/refs/heads/main"),
    ]);
    // Verify tree body includes both entries
    const treeBody = stubCalls[4].body as any;
    expect(treeBody.base_tree).toBe("baseTreeSha");
    expect(treeBody.tree).toHaveLength(2);
    expect(treeBody.tree[0].sha).toBe("blob1Sha");
    // Verify commit parents
    const commitBody = stubCalls[5].body as any;
    expect(commitBody.parents).toEqual(["baseCommitSha"]);
    expect(commitBody.tree).toBe("newTreeSha");
    // Verify ref update
    const refBody = stubCalls[6].body as any;
    expect(refBody.sha).toBe("newCommitSha");
    expect(stubCalls[6].method).toBe("PATCH");
  });

  it("handles file deletions via sha:null entries", async () => {
    respondWith(() => jsonResponse({ object: { sha: "baseCommitSha" } }));
    respondWith(() => jsonResponse({ tree: { sha: "baseTreeSha" } }));
    // No blob calls for a pure delete
    respondWith(() => jsonResponse({ sha: "newTreeSha" }));
    respondWith(() => jsonResponse({ sha: "newCommitSha", html_url: "u" }));
    respondWith(() => jsonResponse({}));

    const result = await commitMultipleFiles(creds, "o", "r", {
      branch: "main",
      message: "delete",
      files: [{ path: "old.txt", content: "", deleted: true }],
    });
    expect(result.filesChanged).toBe(1);
    // tree create body should carry sha: null to delete
    const treeBody = stubCalls[2].body as any;
    expect(treeBody.tree[0].sha).toBeNull();
  });

  it("rejects empty file lists", async () => {
    await expect(
      commitMultipleFiles(creds, "o", "r", {
        branch: "main",
        message: "x",
        files: [],
      }),
    ).rejects.toThrow(/at least one file/);
  });
});

describe("githubClient — mergePullRequest", () => {
  it("returns merge result on success", async () => {
    respondWith(() =>
      jsonResponse({ sha: "mergedSha", merged: true, message: "merged" }),
    );
    const r = await mergePullRequest(creds, "o", "r", 42, {
      mergeMethod: "squash",
    });
    expect(r.sha).toBe("mergedSha");
    expect(r.merged).toBe(true);
    expect(stubCalls[0].method).toBe("PUT");
    expect(stubCalls[0].url).toContain("/pulls/42/merge");
    expect((stubCalls[0].body as any).merge_method).toBe("squash");
  });

  it("throws GitHubError on 405 not mergeable", async () => {
    respondWith(() => errorResponse(405, "Pull Request is not mergeable"));
    await expect(mergePullRequest(creds, "o", "r", 1)).rejects.toBeInstanceOf(
      GitHubError,
    );
  });
});

describe("githubClient — updatePullRequest", () => {
  it("PATCHes with only the provided fields", async () => {
    respondWith(() =>
      jsonResponse({
        number: 5,
        html_url: "u",
        title: "new",
        body: null,
        state: "open",
        head: { ref: "f" },
        base: { ref: "m" },
      }),
    );
    await updatePullRequest(creds, "o", "r", 5, { title: "new" });
    expect(stubCalls[0].method).toBe("PATCH");
    expect(stubCalls[0].url).toContain("/pulls/5");
    expect((stubCalls[0].body as any).title).toBe("new");
  });
});

describe("githubClient — verifyPushAccess", () => {
  it("returns canPush=true when permissions.push is granted", async () => {
    respondWith(() =>
      jsonResponse({ permissions: { push: true, admin: false } }),
    );
    expect(await verifyPushAccess(creds, "o", "r")).toEqual({ canPush: true });
  });

  it("returns canPush=false with reason when push is denied", async () => {
    respondWith(() =>
      jsonResponse({ permissions: { push: false, admin: false } }),
    );
    const r = await verifyPushAccess(creds, "o", "r");
    expect(r.canPush).toBe(false);
    expect(r.reason).toMatch(/push permission/);
  });

  it("returns canPush=false on 404 not found", async () => {
    respondWith(() => errorResponse(404, "Not Found"));
    const r = await verifyPushAccess(creds, "o", "r");
    expect(r.canPush).toBe(false);
    expect(r.reason).toMatch(/not found/i);
  });
});

describe("githubClient — deleteBranch", () => {
  it("issues DELETE against the branch ref", async () => {
    respondWith(() => new Response(null, { status: 204 }));
    await deleteBranch(creds, "o", "r", "feat/x");
    expect(stubCalls[0].method).toBe("DELETE");
    expect(stubCalls[0].url).toContain("/git/refs/heads/feat%2Fx");
  });
});
