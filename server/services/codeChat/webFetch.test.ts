import { describe, it, expect } from "vitest";
import {
  htmlToText,
  validateFetchUrl,
  webFetch,
  WebFetchError,
  DEFAULT_ALLOWED_HOSTS,
} from "./webFetch";

describe("validateFetchUrl", () => {
  it("accepts a simple allowlisted https URL", () => {
    const url = validateFetchUrl(
      "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
      DEFAULT_ALLOWED_HOSTS,
    );
    expect(url.hostname).toBe("developer.mozilla.org");
  });

  it("accepts subdomain of allowlisted host", () => {
    const url = validateFetchUrl(
      "https://api.github.com/repos/anthropics/anthropic-sdk-python",
      DEFAULT_ALLOWED_HOSTS,
    );
    expect(url.hostname).toBe("api.github.com");
  });

  it("rejects http:// when paired with blocked hostname", () => {
    expect(() =>
      validateFetchUrl("http://localhost:8080/foo", DEFAULT_ALLOWED_HOSTS),
    ).toThrow(WebFetchError);
  });

  it("rejects non-http schemes", () => {
    expect(() =>
      validateFetchUrl("file:///etc/passwd", DEFAULT_ALLOWED_HOSTS),
    ).toThrow(/only http\/https/i);
  });

  it("rejects file:// / ftp:// schemes", () => {
    expect(() =>
      validateFetchUrl("ftp://example.com/foo", DEFAULT_ALLOWED_HOSTS),
    ).toThrow(WebFetchError);
  });

  it("rejects unparseable URLs", () => {
    expect(() =>
      validateFetchUrl("not-a-url", DEFAULT_ALLOWED_HOSTS),
    ).toThrow(/invalid URL/);
  });

  it("rejects localhost", () => {
    expect(() =>
      validateFetchUrl("http://localhost/admin", DEFAULT_ALLOWED_HOSTS),
    ).toThrow(/blocked/);
  });

  it("rejects private IP ranges", () => {
    expect(() =>
      validateFetchUrl("http://10.0.0.1/", DEFAULT_ALLOWED_HOSTS),
    ).toThrow(/private IP/);
    expect(() =>
      validateFetchUrl("http://192.168.1.1/", DEFAULT_ALLOWED_HOSTS),
    ).toThrow(/private IP/);
    expect(() =>
      validateFetchUrl("http://172.16.0.1/", DEFAULT_ALLOWED_HOSTS),
    ).toThrow(/private IP/);
  });

  it("rejects AWS metadata endpoint", () => {
    expect(() =>
      validateFetchUrl(
        "http://169.254.169.254/latest/meta-data/",
        DEFAULT_ALLOWED_HOSTS,
      ),
    ).toThrow(/private IP/);
  });

  it("rejects hosts not on the allowlist", () => {
    expect(() =>
      validateFetchUrl("https://example.evil.com/", DEFAULT_ALLOWED_HOSTS),
    ).toThrow(/not on the fetch allowlist/);
  });

  it("honors the additional-hosts override", () => {
    const url = validateFetchUrl("https://example.com/docs", [
      ...DEFAULT_ALLOWED_HOSTS,
      "example.com",
    ]);
    expect(url.hostname).toBe("example.com");
  });
});

describe("htmlToText", () => {
  it("extracts the <title>", () => {
    const { title } = htmlToText(
      "<html><head><title>Hello World</title></head><body>foo</body></html>",
    );
    expect(title).toBe("Hello World");
  });

  it("strips <script> and <style> entirely", () => {
    const { text } = htmlToText(
      `<html><body><script>evil()</script><style>.x{color:red}</style><p>kept</p></body></html>`,
    );
    expect(text).not.toContain("evil()");
    expect(text).not.toContain("color:red");
    expect(text).toContain("kept");
  });

  it("preserves link URLs inline as 'text (href)'", () => {
    const { text } = htmlToText(
      `<a href="https://example.com/docs">docs</a>`,
    );
    expect(text).toContain("docs (https://example.com/docs)");
  });

  it("omits naked-href link when the link text equals the href", () => {
    const { text } = htmlToText(
      `<a href="https://example.com">https://example.com</a>`,
    );
    expect(text).toBe("https://example.com");
  });

  it("turns <br> into newlines and <p> into paragraph breaks", () => {
    const { text } = htmlToText(`<p>one</p><p>two</p>three<br>four`);
    expect(text).toContain("one");
    expect(text).toContain("two");
    expect(text).toMatch(/three\nfour/);
  });

  it("prefixes list items with '- '", () => {
    const { text } = htmlToText(`<ul><li>alpha</li><li>beta</li></ul>`);
    expect(text).toContain("- alpha");
    expect(text).toContain("- beta");
  });

  it("decodes common HTML entities", () => {
    const { text } = htmlToText(
      `<p>Tom&amp;Jerry &mdash; a &quot;classic&quot;</p>`,
    );
    expect(text).toContain("Tom&Jerry");
    expect(text).toContain("—");
    expect(text).toContain('"classic"');
  });

  it("decodes numeric HTML entities", () => {
    const { text } = htmlToText(`<p>&#8212;&#x2014;</p>`);
    expect(text).toContain("——");
  });

  it("collapses runs of whitespace", () => {
    const { text } = htmlToText(`<p>hello     world\t\t\tfoo</p>`);
    expect(text).toBe("hello world foo");
  });

  it("caps the title at 200 chars", () => {
    const long = "a".repeat(500);
    const { title } = htmlToText(`<title>${long}</title>`);
    expect(title?.length).toBe(200);
  });

  it("returns empty string for empty input", () => {
    expect(htmlToText("").text).toBe("");
  });
});

describe("webFetch", () => {
  function makeFetchImpl(
    body: string,
    {
      status = 200,
      contentType = "text/html; charset=utf-8",
      url,
    }: { status?: number; contentType?: string; url?: string } = {},
  ): typeof fetch {
    return (async (input: RequestInfo | URL) => {
      const urlStr = url ?? (typeof input === "string" ? input : input.toString());
      return new Response(body, {
        status,
        headers: { "content-type": contentType },
      });
    }) as unknown as typeof fetch;
  }

  it("fetches + extracts HTML content", async () => {
    const html = `<!doctype html><html><head><title>Docs</title></head><body><h1>Welcome</h1><p>read me</p></body></html>`;
    const result = await webFetch({
      url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
      fetchImpl: makeFetchImpl(html),
    });
    expect(result.status).toBe(200);
    expect(result.title).toBe("Docs");
    expect(result.text).toContain("Welcome");
    expect(result.text).toContain("read me");
    expect(result.truncated).toBe(false);
  });

  it("returns plaintext content unchanged", async () => {
    const text = "# README\n\nHello World";
    const result = await webFetch({
      url: "https://raw.githubusercontent.com/foo/bar/main/README.md",
      fetchImpl: makeFetchImpl(text, { contentType: "text/plain" }),
    });
    expect(result.text).toBe(text);
    expect(result.title).toBeUndefined();
  });

  it("truncates oversize text and flags it", async () => {
    const huge = "x".repeat(100 * 1024); // 100KB
    const result = await webFetch({
      url: "https://developer.mozilla.org/en-US/docs/",
      fetchImpl: makeFetchImpl(huge, { contentType: "text/plain" }),
      maxBytes: 64 * 1024,
    });
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBe(64 * 1024);
  });

  it("rejects a URL before any network call", async () => {
    await expect(
      webFetch({
        url: "https://evil.example.com/",
        fetchImpl: makeFetchImpl("should not be called"),
      }),
    ).rejects.toThrow(/not on the fetch allowlist/);
  });

  it("raises TIMEOUT when the fetch aborts", async () => {
    const slowFetch: typeof fetch = (_, init) =>
      new Promise((_res, rej) => {
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          rej(err);
        });
      });
    await expect(
      webFetch({
        url: "https://github.com/foo/bar",
        fetchImpl: slowFetch,
        timeoutMs: 10,
      }),
    ).rejects.toThrow(/timeout/i);
  });

  it("surfaces fetch failures with FETCH_FAILED code", async () => {
    const boomFetch: typeof fetch = async () => {
      throw new Error("dns lookup failed");
    };
    try {
      await webFetch({
        url: "https://github.com/foo/bar",
        fetchImpl: boomFetch,
      });
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(WebFetchError);
      expect((err as WebFetchError).code).toBe("FETCH_FAILED");
    }
  });

  it("sniffs HTML from missing content-type", async () => {
    const html = `<!doctype html><title>X</title><body>hello</body>`;
    const result = await webFetch({
      url: "https://github.com/foo/bar",
      fetchImpl: makeFetchImpl(html, { contentType: "" }),
    });
    expect(result.title).toBe("X");
    expect(result.text).toContain("hello");
  });
});
