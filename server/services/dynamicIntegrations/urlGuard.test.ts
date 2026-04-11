import { describe, it, expect } from "vitest";
import {
  checkUrlSafety,
  assertUrlSafe,
  scrubSensitiveHeaders,
  scrubSensitiveText,
} from "./urlGuard";

describe("checkUrlSafety", () => {
  it("allows public https", () => {
    const r = checkUrlSafety("https://example.com/feed.json");
    expect(r.ok).toBe(true);
    expect(r.hostname).toBe("example.com");
  });
  it("allows public http", () => {
    const r = checkUrlSafety("http://example.com/data.csv");
    expect(r.ok).toBe(true);
  });
  it("blocks file://", () => {
    const r = checkUrlSafety("file:///etc/passwd");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/scheme/);
  });
  it("blocks ftp://", () => {
    const r = checkUrlSafety("ftp://example.com/data");
    expect(r.ok).toBe(false);
  });
  it("blocks gopher://", () => {
    const r = checkUrlSafety("gopher://example.com/1");
    expect(r.ok).toBe(false);
  });
  it("blocks localhost", () => {
    expect(checkUrlSafety("http://localhost/").ok).toBe(false);
    expect(checkUrlSafety("http://localhost:8080/").ok).toBe(false);
    expect(checkUrlSafety("http://LOCALHOST/").ok).toBe(false);
  });
  it("blocks 127.0.0.1 + subnet", () => {
    expect(checkUrlSafety("http://127.0.0.1/").ok).toBe(false);
    expect(checkUrlSafety("http://127.1.2.3/").ok).toBe(false);
  });
  it("blocks private ipv4 ranges", () => {
    expect(checkUrlSafety("http://10.0.0.5/").ok).toBe(false);
    expect(checkUrlSafety("http://172.16.0.1/").ok).toBe(false);
    expect(checkUrlSafety("http://192.168.1.1/").ok).toBe(false);
    expect(checkUrlSafety("http://169.254.169.254/").ok).toBe(false);
  });
  it("blocks aws / gcp metadata hosts", () => {
    expect(checkUrlSafety("http://169.254.169.254/latest/meta-data").ok).toBe(false);
    expect(checkUrlSafety("http://metadata.google.internal/").ok).toBe(false);
  });
  it("blocks ipv6 loopback", () => {
    expect(checkUrlSafety("http://[::1]/").ok).toBe(false);
  });
  it("blocks ipv6 link-local and ULA", () => {
    expect(checkUrlSafety("http://[fe80::1]/").ok).toBe(false);
    expect(checkUrlSafety("http://[fc00::1]/").ok).toBe(false);
    expect(checkUrlSafety("http://[fd00::1]/").ok).toBe(false);
  });
  it("blocks userinfo in URL", () => {
    const r = checkUrlSafety("http://user:pass@example.com/");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/userinfo/);
  });
  it("blocks unusual ports", () => {
    const r = checkUrlSafety("http://example.com:22/");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/port/);
  });
  it("allows standard alternate ports", () => {
    expect(checkUrlSafety("https://example.com:8443/").ok).toBe(true);
  });
  it("blocks suspicious localhost prefix", () => {
    const r = checkUrlSafety("http://localhost.evil.com/");
    expect(r.ok).toBe(false);
  });
  it("returns invalid URL for nonsense", () => {
    expect(checkUrlSafety("not a url").ok).toBe(false);
  });
  it("assertUrlSafe throws on unsafe", () => {
    expect(() => assertUrlSafe("http://localhost/")).toThrow(/unsafe URL/);
  });
  it("assertUrlSafe passes on safe", () => {
    expect(() => assertUrlSafe("https://example.com/")).not.toThrow();
  });
});

describe("scrubSensitiveHeaders", () => {
  it("redacts Authorization", () => {
    const out = scrubSensitiveHeaders({ Authorization: "Bearer abc123" });
    expect(out.Authorization).toBe("[redacted]");
  });
  it("redacts various sensitive keys", () => {
    const out = scrubSensitiveHeaders({
      Cookie: "session=xyz",
      "X-Api-Key": "k1",
      "X-Auth-Token": "t1",
      "Content-Type": "application/json",
    });
    expect(out["Cookie"]).toBe("[redacted]");
    expect(out["X-Api-Key"]).toBe("[redacted]");
    expect(out["X-Auth-Token"]).toBe("[redacted]");
    expect(out["Content-Type"]).toBe("application/json");
  });
  it("is case-insensitive on header names", () => {
    const out = scrubSensitiveHeaders({ AUTHORIZATION: "Basic dGVzdA==" });
    expect(out.AUTHORIZATION).toBe("[redacted]");
  });
  it("handles null/undefined", () => {
    expect(scrubSensitiveHeaders(null)).toEqual({});
    expect(scrubSensitiveHeaders(undefined)).toEqual({});
  });
});

describe("scrubSensitiveText", () => {
  it("redacts Bearer tokens", () => {
    const out = scrubSensitiveText("failed: Authorization: Bearer sk-live-abcdef.123");
    expect(out).toMatch(/\[redacted\]/);
    expect(out).not.toMatch(/sk-live-abcdef/);
  });
  it("redacts api_key query params", () => {
    const out = scrubSensitiveText("fetch https://api.example.com/data?api_key=abc123");
    expect(out).toMatch(/api_key=\[redacted\]/);
  });
  it("leaves innocuous text alone", () => {
    const out = scrubSensitiveText("fetch failed: timeout after 15s");
    expect(out).toBe("fetch failed: timeout after 15s");
  });
});
