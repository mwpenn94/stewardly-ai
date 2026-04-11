/**
 * Tests for webFetch.ts (Pass 250). Covers the three independently-
 * useful pure functions (validateUrl, htmlToMarkdown, truncateContent)
 * plus a small fetchUrl suite that uses a stub fetch.
 */

import { describe, it, expect } from "vitest";
import {
  validateUrl,
  htmlToMarkdown,
  truncateContent,
  fetchUrl,
  WebFetchError,
} from "./webFetch";

// ─── validateUrl ─────────────────────────────────────────────────────────

describe("validateUrl", () => {
  it("accepts https URLs", () => {
    expect(validateUrl("https://example.com/foo")).toBe(
      "https://example.com/foo",
    );
  });

  it("accepts http URLs", () => {
    expect(validateUrl("http://example.com/bar")).toBe(
      "http://example.com/bar",
    );
  });

  it("rejects empty / non-string", () => {
    expect(() => validateUrl("")).toThrow(WebFetchError);
    expect(() => validateUrl("   ")).toThrow(WebFetchError);
    // @ts-expect-error — defensive parse
    expect(() => validateUrl(null)).toThrow(WebFetchError);
  });

  it("rejects malformed URLs", () => {
    expect(() => validateUrl("not a url")).toThrow(WebFetchError);
  });

  it("rejects non-http(s) schemes", () => {
    expect(() => validateUrl("file:///etc/passwd")).toThrow(WebFetchError);
    expect(() => validateUrl("ftp://example.com")).toThrow(WebFetchError);
    expect(() => validateUrl("javascript:alert(1)")).toThrow(WebFetchError);
  });

  it("rejects localhost", () => {
    expect(() => validateUrl("http://localhost:3000")).toThrow(WebFetchError);
    expect(() => validateUrl("http://LOCALHOST:8080")).toThrow(WebFetchError);
  });

  it("rejects loopback 127.x", () => {
    expect(() => validateUrl("http://127.0.0.1")).toThrow(WebFetchError);
    expect(() => validateUrl("http://127.1.2.3")).toThrow(WebFetchError);
  });

  it("rejects private RFC-1918 ranges", () => {
    expect(() => validateUrl("http://10.0.0.1")).toThrow(WebFetchError);
    expect(() => validateUrl("http://192.168.1.1")).toThrow(WebFetchError);
    expect(() => validateUrl("http://172.16.0.5")).toThrow(WebFetchError);
    expect(() => validateUrl("http://172.31.255.255")).toThrow(WebFetchError);
  });

  it("allows 172.15 (outside private range)", () => {
    expect(validateUrl("http://172.15.0.1")).toBe("http://172.15.0.1/");
  });

  it("rejects AWS IMDS and link-local", () => {
    expect(() => validateUrl("http://169.254.169.254")).toThrow(WebFetchError);
    expect(() => validateUrl("http://169.254.1.1")).toThrow(WebFetchError);
  });

  it("rejects IPv6 loopback + link-local", () => {
    expect(() => validateUrl("http://[::1]")).toThrow(WebFetchError);
    expect(() => validateUrl("http://[fe80::1]")).toThrow(WebFetchError);
  });

  it("strips inline credentials", () => {
    const out = validateUrl("https://user:pass@example.com/foo");
    expect(out).not.toContain("user");
    expect(out).not.toContain("pass");
  });
});

// ─── htmlToMarkdown ──────────────────────────────────────────────────────

describe("htmlToMarkdown", () => {
  it("returns empty for empty", () => {
    expect(htmlToMarkdown("")).toBe("");
  });

  it("strips scripts and styles", () => {
    const html = `<html><head><style>body { color: red }</style></head><body>Hi<script>alert(1)</script></body></html>`;
    const md = htmlToMarkdown(html);
    expect(md).toContain("Hi");
    expect(md).not.toContain("alert");
    expect(md).not.toContain("color: red");
  });

  it("extracts the <title> as h1", () => {
    const md = htmlToMarkdown("<html><head><title>Docs</title></head><body><p>hello</p></body></html>");
    expect(md).toContain("# Docs");
    expect(md).toContain("hello");
  });

  it("converts headings", () => {
    const md = htmlToMarkdown("<h1>A</h1><h2>B</h2><h3>C</h3>");
    expect(md).toContain("# A");
    expect(md).toContain("## B");
    expect(md).toContain("### C");
  });

  it("converts paragraphs to blank-line separated", () => {
    const md = htmlToMarkdown("<p>first</p><p>second</p>");
    expect(md).toContain("first");
    expect(md).toContain("second");
    expect(md).toMatch(/first\n\nsecond/);
  });

  it("converts anchor tags to text (URL)", () => {
    const md = htmlToMarkdown('<a href="https://example.com">docs</a>');
    expect(md).toContain("docs (https://example.com)");
  });

  it("returns just the URL when anchor text matches href", () => {
    const md = htmlToMarkdown(
      '<a href="https://example.com">https://example.com</a>',
    );
    expect(md).toBe("https://example.com");
  });

  it("converts list items to bullets", () => {
    const md = htmlToMarkdown("<ul><li>first</li><li>second</li></ul>");
    expect(md).toContain("- first");
    expect(md).toContain("- second");
  });

  it("converts pre blocks to fenced code", () => {
    const md = htmlToMarkdown("<pre>const x = 1;</pre>");
    expect(md).toContain("```");
    expect(md).toContain("const x = 1;");
  });

  it("converts inline code to backticks", () => {
    const md = htmlToMarkdown("Use <code>npm install</code>");
    expect(md).toContain("`npm install`");
  });

  it("decodes common HTML entities", () => {
    const md = htmlToMarkdown("<p>Tom &amp; Jerry &lt;3 &copy;</p>");
    expect(md).toContain("Tom & Jerry <3 ©");
  });

  it("decodes numeric entities", () => {
    const md = htmlToMarkdown("<p>&#8212; &#x2014;</p>");
    expect(md).toContain("—");
  });

  it("collapses multiple blank lines", () => {
    const md = htmlToMarkdown("<p>a</p><p>b</p><p>c</p>");
    // no more than 2 newlines in a row
    expect(md).not.toMatch(/\n\n\n/);
  });

  it("strips iframes and svgs", () => {
    const md = htmlToMarkdown(
      '<p>kept</p><iframe src="evil">nope</iframe><svg><path/></svg>',
    );
    expect(md).toContain("kept");
    expect(md).not.toContain("nope");
    expect(md).not.toContain("path");
  });

  it("converts bold and italic", () => {
    const md = htmlToMarkdown(
      "<p><strong>bold</strong> and <em>italic</em></p>",
    );
    expect(md).toContain("**bold**");
    expect(md).toContain("_italic_");
  });
});

// ─── truncateContent ─────────────────────────────────────────────────────

describe("truncateContent", () => {
  it("returns unchanged when under the cap", () => {
    const { content, truncated } = truncateContent("hello", 10);
    expect(content).toBe("hello");
    expect(truncated).toBe(false);
  });

  it("truncates when over the cap and adds marker", () => {
    const long = "x".repeat(100);
    const { content, truncated } = truncateContent(long, 20);
    expect(truncated).toBe(true);
    expect(content).toMatch(/truncated 80 chars/);
  });

  it("respects custom cap argument", () => {
    const { truncated } = truncateContent("a".repeat(50), 30);
    expect(truncated).toBe(true);
  });
});

// ─── fetchUrl (with stubbed fetch) ───────────────────────────────────────

function makeStubFetch(
  body: string | null,
  opts: {
    status?: number;
    statusText?: string;
    contentType?: string;
    headers?: Record<string, string>;
    reject?: Error;
  } = {},
): typeof fetch {
  return (async () => {
    if (opts.reject) throw opts.reject;
    const status = opts.status ?? 200;
    const statusText = opts.statusText ?? "OK";
    const bodyStr = body ?? "";
    const headers = new Headers({
      "content-type": opts.contentType ?? "text/html",
      ...opts.headers,
    });
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText,
      headers,
      async text() {
        return bodyStr;
      },
      body: null,
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

describe("fetchUrl", () => {
  it("returns converted markdown for HTML responses", async () => {
    const stub = makeStubFetch(
      "<html><head><title>Docs</title></head><body><p>hello world</p></body></html>",
    );
    const result = await fetchUrl("https://example.com/docs", {
      fetchImpl: stub,
    });
    expect(result.status).toBe(200);
    expect(result.content).toContain("# Docs");
    expect(result.content).toContain("hello world");
    expect(result.truncated).toBe(false);
  });

  it("pretty-prints JSON responses", async () => {
    const stub = makeStubFetch('{"foo":"bar","nested":{"x":1}}', {
      contentType: "application/json",
    });
    const result = await fetchUrl("https://api.example.com/data", {
      fetchImpl: stub,
    });
    expect(result.content).toContain(`"foo": "bar"`);
    expect(result.content).toContain(`"nested"`);
  });

  it("passes through plain text unmodified (except CRLF normalization)", async () => {
    const stub = makeStubFetch("line1\r\nline2", {
      contentType: "text/plain",
    });
    const result = await fetchUrl("https://example.com/file.txt", {
      fetchImpl: stub,
    });
    expect(result.content).toBe("line1\nline2");
  });

  it("throws WebFetchError on HTTP errors", async () => {
    const stub = makeStubFetch("<p>not found</p>", {
      status: 404,
      statusText: "Not Found",
    });
    await expect(
      fetchUrl("https://example.com/missing", { fetchImpl: stub }),
    ).rejects.toThrow(/HTTP 404/);
  });

  it("throws on validation failure before calling fetch", async () => {
    let called = false;
    const stub = (async () => {
      called = true;
      return {} as Response;
    }) as unknown as typeof fetch;
    await expect(
      fetchUrl("http://localhost", { fetchImpl: stub }),
    ).rejects.toThrow(/blocked host/);
    expect(called).toBe(false);
  });

  it("wraps network errors", async () => {
    const stub = makeStubFetch(null, { reject: new Error("boom") });
    await expect(
      fetchUrl("https://example.com", { fetchImpl: stub }),
    ).rejects.toThrow(/boom/);
  });

  it("throws typed TIMEOUT error on AbortError", async () => {
    const stub = (async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    }) as unknown as typeof fetch;
    try {
      await fetchUrl("https://example.com", { fetchImpl: stub });
      expect.fail("should have thrown");
    } catch (e: any) {
      expect(e).toBeInstanceOf(WebFetchError);
      expect(e.code).toBe("TIMEOUT");
    }
  });
});
