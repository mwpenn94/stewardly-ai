/**
 * Tests for Pass 4: Chat prefill query parameter parsing.
 *
 * The chat page supports ?prefill=<text> to pre-populate the input field
 * when navigating from calculators via "Discuss in Chat" buttons.
 */
import { describe, it, expect } from "vitest";

// Pure function extracted from the Chat.tsx useState initializer logic
function parsePrefillParam(search: string): string {
  try {
    const params = new URLSearchParams(search);
    const prefill = params.get("prefill");
    return prefill ?? "";
  } catch {
    return "";
  }
}

describe("Chat prefill query parameter", () => {
  it("extracts prefill text from query string", () => {
    const result = parsePrefillParam("?prefill=Hello%20world");
    expect(result).toBe("Hello world");
  });

  it("returns empty string when no prefill param", () => {
    expect(parsePrefillParam("")).toBe("");
    expect(parsePrefillParam("?other=value")).toBe("");
  });

  it("handles URL-encoded special characters", () => {
    const encoded = encodeURIComponent("I just ran an IUL projection. Can you help me interpret the results?");
    expect(parsePrefillParam(`?prefill=${encoded}`)).toBe(
      "I just ran an IUL projection. Can you help me interpret the results?"
    );
  });

  it("handles prefill with other params present", () => {
    const result = parsePrefillParam("?mode=single&prefill=test%20message&focus=financial");
    expect(result).toBe("test message");
  });

  it("handles empty prefill value", () => {
    expect(parsePrefillParam("?prefill=")).toBe("");
  });

  it("handles malformed query strings gracefully", () => {
    expect(parsePrefillParam("not-a-query")).toBe("");
  });

  it("preserves emoji and unicode in prefill", () => {
    const text = "What about my 401(k) plan? 📊";
    const encoded = encodeURIComponent(text);
    expect(parsePrefillParam(`?prefill=${encoded}`)).toBe(text);
  });

  it("handles very long prefill text", () => {
    const longText = "A".repeat(2000);
    const encoded = encodeURIComponent(longText);
    const result = parsePrefillParam(`?prefill=${encoded}`);
    expect(result).toBe(longText);
    expect(result.length).toBe(2000);
  });
});

// Test the calculator-to-chat navigation URL generation
describe("Calculator to Chat URL generation", () => {
  function buildChatUrl(calcTitle: string): string {
    const ctx = `I just ran a ${calcTitle} calculation. Can you help me interpret the results and suggest next steps?`;
    return `/chat?prefill=${encodeURIComponent(ctx)}`;
  }

  it("generates correct URL for IUL calculator", () => {
    const url = buildChatUrl("IUL Projection");
    expect(url).toContain("/chat?prefill=");
    expect(decodeURIComponent(url.split("prefill=")[1])).toContain("IUL Projection");
  });

  it("generates correct URL for Tax Projector", () => {
    const url = buildChatUrl("Tax Projector");
    expect(decodeURIComponent(url.split("prefill=")[1])).toContain("Tax Projector");
  });

  it("generates correct URL for Premium Finance", () => {
    const url = buildChatUrl("Premium Finance");
    expect(decodeURIComponent(url.split("prefill=")[1])).toContain("Premium Finance");
  });

  it("URL is properly encoded (no raw spaces)", () => {
    const url = buildChatUrl("Social Security Optimizer");
    expect(url).not.toContain(" ");
    expect(url).toContain("%20");
  });

  it("round-trips through encode/decode", () => {
    const title = "Retirement & Estate (Combined)";
    const url = buildChatUrl(title);
    const decoded = parsePrefillParam(url.replace("/chat", ""));
    expect(decoded).toContain(title);
  });
});
