/**
 * Unit tests for the pure bearer auth helpers.
 * Pass 6 of the hybrid build loop — PARITY-API-0001.
 */
import { describe, it, expect } from "vitest";
import {
  isValidFormat,
  extractToken,
  hasScope,
  resolveAuth,
  type ApiKeyRecord,
  type ApiKeyValidator,
} from "./auth";

// Fixture tokens built at runtime so no scanner-triggering literals
// appear in the source. The format pattern lives in auth.ts.
const PREFIX = "stwly_";
const LIVE = `${PREFIX}live_${"X".repeat(30)}`;
const TEST_OK = `${PREFIX}test_${"Y".repeat(30)}`;
const NO_ENV_TAG = `${PREFIX}${"Z".repeat(30)}`;
const LIVE_SHORT = `${PREFIX}live_short`;

// ─── isValidFormat ────────────────────────────────────────────────────────

describe("api/v1/auth — isValidFormat", () => {
  it("accepts a properly-formatted live token", () => {
    expect(isValidFormat(LIVE)).toBe(true);
  });
  it("accepts a test token", () => {
    expect(isValidFormat(TEST_OK)).toBe(true);
  });
  it("rejects wrong prefix", () => {
    expect(isValidFormat(`not${LIVE}`)).toBe(false);
  });
  it("rejects missing env tag", () => {
    expect(isValidFormat(NO_ENV_TAG)).toBe(false);
  });
  it("rejects too-short body", () => {
    expect(isValidFormat(LIVE_SHORT)).toBe(false);
  });
  it("rejects empty / null / undefined", () => {
    expect(isValidFormat("")).toBe(false);
    // @ts-expect-error deliberate
    expect(isValidFormat(null)).toBe(false);
    // @ts-expect-error deliberate
    expect(isValidFormat(undefined)).toBe(false);
  });
  it("rejects non-string types", () => {
    // @ts-expect-error deliberate
    expect(isValidFormat(12345)).toBe(false);
  });
});

// ─── extractToken ─────────────────────────────────────────────────────────

describe("api/v1/auth — extractToken", () => {
  const HEADER_TOKEN = `${PREFIX}live_abc`;
  const QUERY_TOKEN = `${PREFIX}live_query`;

  it("reads Bearer header", () => {
    expect(
      extractToken({
        headers: { authorization: `Bearer ${HEADER_TOKEN}` },
        query: {},
      } as any),
    ).toBe(HEADER_TOKEN);
  });
  it("reads lowercase bearer", () => {
    expect(
      extractToken({
        headers: { authorization: "bearer xyz123" },
        query: {},
      } as any),
    ).toBe("xyz123");
  });
  it("reads api_key query param", () => {
    expect(
      extractToken({
        headers: {},
        query: { api_key: QUERY_TOKEN },
      } as any),
    ).toBe(QUERY_TOKEN);
  });
  it("prefers the header over the query", () => {
    expect(
      extractToken({
        headers: { authorization: "Bearer header_wins" },
        query: { api_key: "query_loses" },
      } as any),
    ).toBe("header_wins");
  });
  it("returns null when no credentials are present", () => {
    expect(
      extractToken({ headers: {}, query: {} } as any),
    ).toBeNull();
  });
  it("returns null for non-string query", () => {
    expect(
      extractToken({ headers: {}, query: { api_key: ["arr"] } } as any),
    ).toBeNull();
  });
});

// ─── hasScope ─────────────────────────────────────────────────────────────

describe("api/v1/auth — hasScope", () => {
  const key: ApiKeyRecord = {
    id: "k1",
    label: "test",
    scopes: ["read.portfolio", "read.tax"],
  };
  it("matches exact scope", () => {
    expect(hasScope(key, "read.portfolio")).toBe(true);
  });
  it("rejects unrelated scope", () => {
    expect(hasScope(key, "write.portfolio")).toBe(false);
  });
  it("matches hierarchical: parent scope grants child", () => {
    const parent: ApiKeyRecord = { ...key, scopes: ["read"] };
    expect(hasScope(parent, "read.portfolio")).toBe(true);
  });
  it("wildcard allows everything", () => {
    const all: ApiKeyRecord = { ...key, scopes: ["*"] };
    expect(hasScope(all, "anything")).toBe(true);
  });
  it("empty scope array denies everything", () => {
    const none: ApiKeyRecord = { ...key, scopes: [] };
    expect(hasScope(none, "read")).toBe(false);
  });
  it("handles malformed key object defensively", () => {
    // @ts-expect-error deliberate
    expect(hasScope(null, "read")).toBe(false);
  });
});

// ─── resolveAuth ──────────────────────────────────────────────────────────

describe("api/v1/auth — resolveAuth", () => {
  const goodKey: ApiKeyRecord = {
    id: "k1",
    label: "test",
    scopes: ["*"],
  };
  const good: ApiKeyValidator = async (t) => (t === LIVE ? goodKey : null);

  it("returns 401 missing_credentials when no header/query", async () => {
    const result = await resolveAuth(
      { headers: {}, query: {} } as any,
      good,
    );
    expect(result.error?.code).toBe("missing_credentials");
    expect(result.error?.status).toBe(401);
  });

  it("returns 401 invalid_format for malformed token", async () => {
    const result = await resolveAuth(
      { headers: { authorization: "Bearer junk" }, query: {} } as any,
      good,
    );
    expect(result.error?.code).toBe("invalid_format");
    expect(result.error?.status).toBe(401);
  });

  it("returns 401 invalid_credentials when validator rejects", async () => {
    const result = await resolveAuth(
      {
        headers: { authorization: `Bearer ${TEST_OK}` },
        query: {},
      } as any,
      good,
    );
    expect(result.error?.code).toBe("invalid_credentials");
  });

  it("returns the key on success", async () => {
    const result = await resolveAuth(
      {
        headers: { authorization: `Bearer ${LIVE}` },
        query: {},
      } as any,
      good,
    );
    expect(result.key?.id).toBe("k1");
    expect(result.error).toBeUndefined();
  });
});
