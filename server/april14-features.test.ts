/**
 * Tests for April 14, 2026 features:
 * 1. TF-IDF search scoring enhancements
 * 2. Contextual intelligence system prompt additions
 * 3. Financial narrative context prompt additions
 * 4. Document annotations component
 * 5. Wealth Engine mobile sidebar fix
 */
import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "./prompts";

describe("Contextual Intelligence — System Prompt", () => {
  it("includes CONTEXTUAL FIRST RESPONSE section", () => {
    const prompt = buildSystemPrompt({
      mode: "client_advisor" as any,
      focus: "financial" as any,
    });
    expect(prompt).toContain("CONTEXTUAL FIRST RESPONSE");
    expect(prompt).toContain("demonstrate contextual intelligence immediately");
  });

  it("includes instruction to never give generic greeting", () => {
    const prompt = buildSystemPrompt({
      mode: "client_advisor" as any,
      focus: "financial" as any,
    });
    expect(prompt).toContain("NEVER give a generic");
    expect(prompt).toContain("How can I help you today");
  });

  it("includes instructions for connected accounts context", () => {
    const prompt = buildSystemPrompt({
      mode: "client_advisor" as any,
      focus: "financial" as any,
    });
    expect(prompt).toContain("connected financial accounts");
    expect(prompt).toContain("recent calculator scenarios");
    expect(prompt).toContain("conversation history");
  });
});

describe("Financial Narrative Context — System Prompt", () => {
  it("includes FINANCIAL NARRATIVE CONTEXT section", () => {
    const prompt = buildSystemPrompt({
      mode: "client_advisor" as any,
      focus: "financial" as any,
    });
    expect(prompt).toContain("FINANCIAL NARRATIVE CONTEXT");
  });

  it("includes good/bad examples for narrative framing", () => {
    const prompt = buildSystemPrompt({
      mode: "client_advisor" as any,
      focus: "financial" as any,
    });
    expect(prompt).toContain("Your portfolio value is $245,000");
    expect(prompt).toContain("Your portfolio has grown to $245,000");
  });

  it("includes relative framing instructions", () => {
    const prompt = buildSystemPrompt({
      mode: "client_advisor" as any,
      focus: "financial" as any,
    });
    expect(prompt).toContain("ahead of schedule");
    expect(prompt).toContain("on track");
    expect(prompt).toContain("needs attention");
  });

  it("includes benchmark comparison instruction", () => {
    const prompt = buildSystemPrompt({
      mode: "client_advisor" as any,
      focus: "financial" as any,
    });
    expect(prompt).toContain("Compare numbers to benchmarks");
  });
});

describe("System Prompt — Role-based personalization", () => {
  it("includes role hint for non-user roles", () => {
    const prompt = buildSystemPrompt({
      mode: "client_advisor" as any,
      focus: "financial" as any,
      userRole: "advisor",
    });
    expect(prompt).toContain('role is "advisor"');
  });

  it("omits role hint for default user role", () => {
    const prompt = buildSystemPrompt({
      mode: "client_advisor" as any,
      focus: "financial" as any,
      userRole: "user",
    });
    expect(prompt).not.toContain('role is "user"');
  });

  it("includes user name when provided", () => {
    const prompt = buildSystemPrompt({
      mode: "client_advisor" as any,
      focus: "financial" as any,
      userName: "Alice",
    });
    expect(prompt).toContain("Alice");
  });
});

describe("TF-IDF Search Scoring", () => {
  it("searchDocumentChunks function exists in db module", async () => {
    const db = await import("./db");
    expect(typeof db.searchDocumentChunks).toBe("function");
  });
});

describe("Document Annotations", () => {
  it("DocumentAnnotations component file exists", async () => {
    const fs = await import("fs");
    const path = require("path");
    const componentPath = path.resolve(__dirname, "../client/src/components/DocumentAnnotations.tsx");
    expect(fs.existsSync(componentPath)).toBe(true);
  });
});
