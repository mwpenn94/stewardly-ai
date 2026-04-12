/**
 * webFetch.test.ts — Parity Pass 1.
 *
 * Coverage:
 *   - validateUrl: scheme, private-host guard, allowlist, parsing
 *   - htmlToText: script/style removal, block newlines, entity decode
 *   - decodeHtmlEntities: named + numeric
 *   - parseContentType / isAcceptedContentType
 *   - fetchUrl: stubbed fetch implementation for every failure mode +
 *     happy path + size truncation
 */

import { describe, it, expect } from "vitest";
import {
  validateUrl,
  htmlToText,
  decodeHtmlEntities,
  parseContentType,
  isAcceptedContentType,
  fetchUrl,
  WebFetchError,
} from "./webFetch";

// ─── validateUrl ────────────────────────────────────────────────────────

describe("validateUrl", () => {
  it("accepts an https URL", () => {
    const r = validateUrl("https://example.com/docs");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.url.hostname).toBe("example.com");
  });

  it("accepts an http URL", () => {
    const r = validateUrl("http://example.com/");
    expect(r.ok).toBe(true);
  });

  it("rejects garbage strings", () => {
    const r = validateUrl("not a url");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_url");
  });

  it("rejects file:// URLs", () => {
    const r = validateUrl("file:///etc/passwd");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad_scheme");
  });

  it("rejects data: URLs", () => {
    const r = validateUrl("data:text/html,<h1>x</h1>");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad_scheme");
  });

  it("rejects javascript: URLs", () => {
    const r = validateUrl("javascript:alert(1)");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad_scheme");
  });

  it("blocks loopback 127.0.0.1", () => {
    const r = validateUrl("http://127.0.0.1/");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("private_host");
  });

  it("blocks localhost", () => {
    const r = validateUrl("http://localhost:8080/");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("private_host");
  });

  it("blocks RFC1918 10.0.0.0/8", () => {
    const r = validateUrl("http://10.0.0.5/");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("private_host");
  });

  it("blocks RFC1918 192.168.0.0/16", () => {
    const r = validateUrl("http://192.168.1.1/");
    expect(r.ok).toBe(false);
  });

  it("blocks RFC1918 172.16.0.0/12", () => {
    const r = validateUrl("http://172.20.0.1/");
    expect(r.ok).toBe(false);
  });

  it("allows 172.15 (outside 172.16–172.31 RFC1918)", () => {
    const r = validateUrl("http://172.15.1.1/");
    expect(r.ok).toBe(true);
  });

  it("blocks link-local 169.254 (AWS metadata)", () => {
    const r = validateUrl("http://169.254.169.254/latest/meta-data/");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("private_host");
  });

  it("blocks IPv6 loopback ::1", () => {
    const r = validateUrl("http://[::1]/");
    expect(r.ok).toBe(false);
  });

  it("blocks .internal TLD", () => {
    const r = validateUrl("http://k8s.internal/api");
    expect(r.ok).toBe(false);
  });

  it("blocks .local TLD", () => {
    const r = validateUrl("http://service.local/health");
    expect(r.ok).toBe(false);
  });

  it("blocks GCP metadata hostname", () => {
    const r = validateUrl("http://metadata.google.internal/");
    expect(r.ok).toBe(false);
  });

  it("allows URLs when allowlist matches exact host", () => {
    const r = validateUrl("https://docs.example.com/api", ["docs.example.com"]);
    expect(r.ok).toBe(true);
  });

  it("allows URLs when allowlist matches parent suffix", () => {
    const r = validateUrl("https://docs.example.com/api", ["example.com"]);
    expect(r.ok).toBe(true);
  });

  it("rejects URLs when allowlist is set and host is not covered", () => {
    const r = validateUrl("https://evil.example.net/", ["example.com"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not_allowlisted");
  });

  it("ignores empty-string entries in the allowlist", () => {
    const r = validateUrl("https://docs.example.com/", ["", "docs.example.com"]);
    expect(r.ok).toBe(true);
  });
});

// ─── decodeHtmlEntities ────────────────────────────────────────────────

describe("decodeHtmlEntities", () => {
  it("decodes &amp; &lt; &gt;", () => {
    expect(decodeHtmlEntities("a &amp; b &lt; c &gt; d")).toBe("a & b < c > d");
  });

  it("decodes &quot; and &apos;", () => {
    expect(decodeHtmlEntities("&quot;x&apos;y&quot;")).toBe("\"x'y\"");
  });

  it("decodes numeric entities", () => {
    expect(decodeHtmlEntities("caf&#233;")).toBe("café");
  });

  it("decodes hex entities", () => {
    expect(decodeHtmlEntities("&#xe9;")).toBe("é");
  });

  it("leaves unknown entities alone", () => {
    expect(decodeHtmlEntities("&unknownentity;")).toBe("&unknownentity;");
  });

  it("decodes &nbsp;", () => {
    expect(decodeHtmlEntities("hello&nbsp;world")).toBe("hello world");
  });

  it("decodes &mdash; and &hellip;", () => {
    expect(decodeHtmlEntities("wait&hellip;&mdash;yes")).toBe("wait…—yes");
  });
});

// ─── htmlToText ────────────────────────────────────────────────────────

describe("htmlToText", () => {
  it("strips <script> blocks", () => {
    const html = "<p>before</p><script>alert('x')</script><p>after</p>";
    const out = htmlToText(html);
    expect(out).not.toContain("alert");
    expect(out).toContain("before");
    expect(out).toContain("after");
  });

  it("strips <style> blocks", () => {
    const html = "<style>.a{color:red}</style><p>text</p>";
    expect(htmlToText(html)).toBe("text");
  });

  it("strips HTML comments", () => {
    const html = "<!-- TODO: delete --><p>visible</p>";
    expect(htmlToText(html)).toBe("visible");
  });

  it("introduces newlines on block closers", () => {
    const html = "<div>a</div><div>b</div><div>c</div>";
    const out = htmlToText(html);
    expect(out.split("\n").filter(Boolean)).toEqual(["a", "b", "c"]);
  });

  it("handles headings", () => {
    const html = "<h1>Title</h1><p>Body text here.</p>";
    const out = htmlToText(html);
    expect(out).toContain("Title");
    expect(out).toContain("Body text here.");
  });

  it("decodes entities inside the body", () => {
    const html = "<p>Caf&eacute; &amp; Bar</p>";
    // &eacute; is not in our small named-entity map → stays as entity
    const out = htmlToText(html);
    expect(out).toContain("&");
    expect(out).not.toContain("<p>");
  });

  it("collapses consecutive blank lines", () => {
    const html = "<div>a</div><div></div><div></div><div>b</div>";
    const out = htmlToText(html);
    const lines = out.split("\n");
    // Should not have two consecutive empty lines
    let prevEmpty = false;
    for (const line of lines) {
      if (line === "") {
        expect(prevEmpty).toBe(false);
        prevEmpty = true;
      } else {
        prevEmpty = false;
      }
    }
  });

  it("returns empty string for empty input", () => {
    expect(htmlToText("")).toBe("");
  });

  it("handles <br> as line break", () => {
    const html = "line1<br>line2<br/>line3";
    const out = htmlToText(html);
    expect(out).toBe("line1\nline2\nline3");
  });

  it("preserves link text", () => {
    const html = '<a href="https://example.com">click me</a>';
    expect(htmlToText(html)).toBe("click me");
  });
});

// ─── parseContentType / isAcceptedContentType ──────────────────────────

describe("parseContentType", () => {
  it("extracts bare type from header with charset", () => {
    expect(parseContentType("text/html; charset=utf-8")).toBe("text/html");
  });

  it("lowercases the type", () => {
    expect(parseContentType("TEXT/HTML")).toBe("text/html");
  });

  it("returns empty for null", () => {
    expect(parseContentType(null)).toBe("");
  });

  it("returns empty for undefined", () => {
    expect(parseContentType(undefined)).toBe("");
  });
});

describe("isAcceptedContentType", () => {
  it("accepts text/html", () => {
    expect(isAcceptedContentType("text/html")).toBe(true);
  });

  it("accepts application/json", () => {
    expect(isAcceptedContentType("application/json")).toBe(true);
  });

  it("is lenient for empty content-type", () => {
    expect(isAcceptedContentType("")).toBe(true);
  });

  it("rejects image/png", () => {
    expect(isAcceptedContentType("image/png")).toBe(false);
  });

  it("rejects application/octet-stream", () => {
    expect(isAcceptedContentType("application/octet-stream")).toBe(false);
  });

  it("rejects video/mp4", () => {
    expect(isAcceptedContentType("video/mp4")).toBe(false);
  });
});

// ─── fetchUrl (stubbed fetch) ──────────────────────────────────────────

function makeStubResponse(opts: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  contentType?: string;
  body?: string;
}): Response {
  const body = opts.body ?? "";
  const status = opts.status ?? 200;
  const headers = new Headers();
  if (opts.contentType) headers.set("content-type", opts.contentType);
  return new Response(body, {
    status,
    statusText: opts.statusText ?? "OK",
    headers,
  });
}

describe("fetchUrl", () => {
  it("returns HTML as plain text", async () => {
    const stub = async () =>
      makeStubResponse({
        contentType: "text/html; charset=utf-8",
        body: "<html><body><h1>Hello</h1><p>World</p><script>xss()</script></body></html>",
      });
    const r = await fetchUrl("https://example.com/", { fetchImpl: stub as any });
    expect(r.status).toBe(200);
    expect(r.htmlExtracted).toBe(true);
    expect(r.contentType).toBe("text/html");
    expect(r.content).toContain("Hello");
    expect(r.content).toContain("World");
    expect(r.content).not.toContain("xss()");
    expect(r.truncated).toBe(false);
  });

  it("returns raw text for application/json", async () => {
    const stub = async () =>
      makeStubResponse({
        contentType: "application/json",
        body: '{"a":1,"b":[2,3]}',
      });
    const r = await fetchUrl("https://api.example.com/", { fetchImpl: stub as any });
    expect(r.htmlExtracted).toBe(false);
    expect(r.content).toBe('{"a":1,"b":[2,3]}');
  });

  it("sniffs HTML mis-labeled as text/plain", async () => {
    const stub = async () =>
      makeStubResponse({
        contentType: "text/plain",
        body: "<!DOCTYPE html><html><body><p>oops</p></body></html>",
      });
    const r = await fetchUrl("https://example.com/", { fetchImpl: stub as any });
    expect(r.htmlExtracted).toBe(true);
    expect(r.content).toContain("oops");
  });

  it("throws INVALID_URL for garbage", async () => {
    await expect(
      fetchUrl("nope", { fetchImpl: async () => new Response() }),
    ).rejects.toMatchObject({ code: "INVALID_URL" });
  });

  it("throws BAD_SCHEME for file://", async () => {
    await expect(
      fetchUrl("file:///etc/passwd", { fetchImpl: async () => new Response() }),
    ).rejects.toMatchObject({ code: "BAD_SCHEME" });
  });

  it("throws PRIVATE_HOST for localhost", async () => {
    await expect(
      fetchUrl("http://localhost/", { fetchImpl: async () => new Response() }),
    ).rejects.toMatchObject({ code: "PRIVATE_HOST" });
  });

  it("throws NOT_ALLOWLISTED when allowedHosts is set and host misses", async () => {
    await expect(
      fetchUrl("https://evil.com/", {
        allowedHosts: ["example.com"],
        fetchImpl: async () => new Response(),
      }),
    ).rejects.toMatchObject({ code: "NOT_ALLOWLISTED" });
  });

  it("throws HTTP_ERROR on 404", async () => {
    const stub = async () =>
      makeStubResponse({ status: 404, statusText: "Not Found", body: "gone" });
    await expect(
      fetchUrl("https://example.com/missing", { fetchImpl: stub as any }),
    ).rejects.toMatchObject({ code: "HTTP_ERROR" });
  });

  it("throws BAD_CONTENT_TYPE on image/png", async () => {
    const stub = async () =>
      makeStubResponse({ contentType: "image/png", body: "binarydata" });
    await expect(
      fetchUrl("https://example.com/img", { fetchImpl: stub as any }),
    ).rejects.toMatchObject({ code: "BAD_CONTENT_TYPE" });
  });

  it("throws NETWORK_ERROR on fetch throw", async () => {
    const stub = async () => {
      throw new Error("ECONNRESET");
    };
    await expect(
      fetchUrl("https://example.com/", { fetchImpl: stub as any }),
    ).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });

  it("truncates responses exceeding maxBytes", async () => {
    const big = "a".repeat(2000);
    const stub = async () =>
      makeStubResponse({ contentType: "text/plain", body: big });
    const r = await fetchUrl("https://example.com/big", {
      fetchImpl: stub as any,
      maxBytes: 500,
    });
    expect(r.truncated).toBe(true);
    expect(r.byteLength).toBeLessThanOrEqual(500);
  });

  it("carries durationMs + status through", async () => {
    const stub = async () =>
      makeStubResponse({ contentType: "text/plain", body: "ok" });
    const r = await fetchUrl("https://example.com/", { fetchImpl: stub as any });
    expect(r.status).toBe(200);
    expect(typeof r.durationMs).toBe("number");
    expect(r.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("is a WebFetchError on every failure", async () => {
    try {
      await fetchUrl("http://localhost/", { fetchImpl: async () => new Response() });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(WebFetchError);
    }
  });
});
