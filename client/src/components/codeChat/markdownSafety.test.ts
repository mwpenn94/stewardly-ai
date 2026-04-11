import { describe, it, expect } from "vitest";
import {
  safeMarkdownUrl,
  safeImageSrc,
  safeLinkProps,
  trustedShikiHtml,
} from "./markdownSafety";

describe("safeMarkdownUrl", () => {
  // Happy path
  it("passes through https URLs", () => {
    expect(safeMarkdownUrl("https://example.com/foo")).toBe(
      "https://example.com/foo",
    );
  });

  it("passes through http URLs", () => {
    expect(safeMarkdownUrl("http://example.com/")).toBe("http://example.com/");
  });

  it("passes through mailto: links", () => {
    expect(safeMarkdownUrl("mailto:foo@example.com")).toBe(
      "mailto:foo@example.com",
    );
  });

  it("passes through tel: links", () => {
    expect(safeMarkdownUrl("tel:+15551234567")).toBe("tel:+15551234567");
  });

  it("passes through anchor links unchanged", () => {
    expect(safeMarkdownUrl("#section-1")).toBe("#section-1");
  });

  it("passes through relative paths", () => {
    expect(safeMarkdownUrl("./foo.html")).toBe("./foo.html");
    expect(safeMarkdownUrl("../foo.html")).toBe("../foo.html");
    expect(safeMarkdownUrl("/abs/foo.html")).toBe("/abs/foo.html");
    expect(safeMarkdownUrl("foo.html")).toBe("foo.html");
  });

  it("passes through query strings", () => {
    expect(safeMarkdownUrl("?key=value:foo")).toBe("?key=value:foo");
  });

  it("ignores colons that come after a slash/question/hash", () => {
    expect(safeMarkdownUrl("/path?val=foo:bar")).toBe("/path?val=foo:bar");
    expect(safeMarkdownUrl("/path#anchor:point")).toBe("/path#anchor:point");
  });

  // XSS vectors
  it("blocks javascript: URLs", () => {
    expect(safeMarkdownUrl("javascript:alert(1)")).toBe("");
  });

  it("blocks JaVaScRiPt: case-insensitively", () => {
    expect(safeMarkdownUrl("JaVaScRiPt:alert(1)")).toBe("");
  });

  it("blocks vbscript: URLs", () => {
    expect(safeMarkdownUrl("vbscript:msgbox(1)")).toBe("");
  });

  it("blocks blob: URLs", () => {
    expect(safeMarkdownUrl("blob:https://example.com/abc")).toBe("");
  });

  it("blocks file: URLs", () => {
    expect(safeMarkdownUrl("file:///etc/passwd")).toBe("");
  });

  it("blocks data: URLs (links go through this; image src has separate path)", () => {
    expect(safeMarkdownUrl("data:text/html,<script>alert(1)</script>")).toBe(
      "",
    );
  });

  // Obfuscation tricks
  it("strips leading whitespace + control chars before parsing", () => {
    expect(safeMarkdownUrl("\tjavascript:alert(1)")).toBe("");
    expect(safeMarkdownUrl("\njavascript:alert(1)")).toBe("");
    expect(safeMarkdownUrl("  javascript:alert(1)")).toBe("");
    expect(safeMarkdownUrl("\u0000javascript:alert(1)")).toBe("");
  });

  // Defensive
  it("returns empty string for non-string input", () => {
    expect(safeMarkdownUrl(null)).toBe("");
    expect(safeMarkdownUrl(undefined)).toBe("");
    expect(safeMarkdownUrl(42)).toBe("");
    expect(safeMarkdownUrl({})).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(safeMarkdownUrl("")).toBe("");
  });
});

describe("safeImageSrc", () => {
  it("passes through https image URLs", () => {
    expect(safeImageSrc("https://example.com/img.png")).toBe(
      "https://example.com/img.png",
    );
  });

  it("allows base64 PNG data URIs", () => {
    const png = "data:image/png;base64,iVBORw0KGgo=";
    expect(safeImageSrc(png)).toBe(png);
  });

  it("allows base64 JPEG data URIs", () => {
    const jpg = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ=";
    expect(safeImageSrc(jpg)).toBe(jpg);
    expect(safeImageSrc("data:image/jpg;base64,abc")).toBe(
      "data:image/jpg;base64,abc",
    );
  });

  it("allows base64 GIF / WEBP / AVIF", () => {
    expect(safeImageSrc("data:image/gif;base64,R0lGOD")).toMatch(/^data:/);
    expect(safeImageSrc("data:image/webp;base64,UklGR")).toMatch(/^data:/);
    expect(safeImageSrc("data:image/avif;base64,abcd")).toMatch(/^data:/);
  });

  it("BLOCKS data:image/svg+xml — SVG can carry scripts", () => {
    expect(
      safeImageSrc(
        "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>",
      ),
    ).toBe("");
  });

  it("blocks data: with non-image MIME", () => {
    expect(safeImageSrc("data:text/html;base64,abc")).toBe("");
    expect(safeImageSrc("data:application/javascript;base64,abc")).toBe("");
  });

  it("blocks data: without base64 marker (raw payload)", () => {
    expect(safeImageSrc("data:image/png,raw-bytes")).toBe("");
  });

  it("blocks javascript: in image src", () => {
    expect(safeImageSrc("javascript:alert(1)")).toBe("");
  });
});

describe("safeLinkProps", () => {
  it("passes through href + title + className", () => {
    const out = safeLinkProps({
      href: "https://example.com",
      title: "Example",
      className: "link",
    });
    expect(out).toEqual({
      href: "https://example.com",
      title: "Example",
      className: "link",
    });
  });

  it("DROPS unknown spread props (e.g. an injected onclick)", () => {
    const out = safeLinkProps({
      href: "https://example.com",
      onClick: () => {},
      onerror: "alert(1)",
      "data-evil": "yes",
    } as any);
    expect(out).toEqual({ href: "https://example.com" });
    expect("onClick" in out).toBe(false);
    expect("onerror" in out).toBe(false);
    expect("data-evil" in out).toBe(false);
  });

  it("re-runs href through the URL filter", () => {
    const out = safeLinkProps({ href: "javascript:alert(1)" });
    expect(out.href).toBe("");
  });

  it("returns a fresh object", () => {
    const props = { href: "https://example.com" };
    const out = safeLinkProps(props);
    expect(out).not.toBe(props);
  });
});

describe("trustedShikiHtml", () => {
  it("accepts well-formed Shiki output", () => {
    const html = `<pre class="shiki"><code><span>const x = 1;</span></code></pre>`;
    expect(trustedShikiHtml(html)).toBe(html);
  });

  it("rejects html with a <script> block", () => {
    const html = `<pre class="shiki"><script>alert(1)</script></pre>`;
    expect(trustedShikiHtml(html)).toBeNull();
  });

  it("rejects html with an inline event handler", () => {
    const html = `<pre class="shiki" onload="alert(1)"><code></code></pre>`;
    expect(trustedShikiHtml(html)).toBeNull();
  });

  it("rejects html with javascript: URI", () => {
    const html = `<pre class="shiki"><code><a href="javascript:alert(1)">x</a></code></pre>`;
    expect(trustedShikiHtml(html)).toBeNull();
  });

  it("rejects html that doesn't start with <pre", () => {
    expect(
      trustedShikiHtml(`<div>not shiki</div><pre></pre>`),
    ).toBeNull();
  });

  it("rejects html that doesn't end with </pre>", () => {
    expect(trustedShikiHtml(`<pre><code></code>`)).toBeNull();
  });

  it("rejects null / non-string input", () => {
    expect(trustedShikiHtml(null)).toBeNull();
    expect(trustedShikiHtml(undefined)).toBeNull();
    expect(trustedShikiHtml(42)).toBeNull();
    expect(trustedShikiHtml("")).toBeNull();
  });

  it("blocks the event-handler check case-insensitively", () => {
    const html = `<pre OnClIcK="alert(1)"><code></code></pre>`;
    expect(trustedShikiHtml(html)).toBeNull();
  });
});
