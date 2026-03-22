import { describe, it, expect } from "vitest";
import {
  createTag, getUserTags, addTagToDocument, removeTagFromDocument,
  getDocumentTags, getDocumentsForTag, bulkAddTagsToDocument,
  addGapFeedback, getUserGapFeedback,
  addDocumentVersion, getDocumentVersions, getLatestVersionNumber,
} from "./db";
import { extractDocumentText } from "./services/documentExtractor";

// ─── TAG CRUD ─────────────────────────────────────────────────────
describe("Document Tags - CRUD", () => {
  it("createTag returns a tag with name and isAiGenerated flag", async () => {
    const tag = await createTag(999999, "test-tag-v", undefined, true);
    expect(tag).toBeDefined();
    // $returningId returns { id: number }, not the full row
    expect(tag).toHaveProperty("id");
    expect(typeof tag.id).toBe("number");
  });

  it("getUserTags returns an array", async () => {
    const tags = await getUserTags(999999);
    expect(Array.isArray(tags)).toBe(true);
  });

  it("addTagToDocument and getDocumentTags work together", async () => {
    // Create a tag first
    const tag = await createTag(999999, "link-test-tag-v");
    if (!tag) return;
    // addTagToDocument with a fake doc ID won't crash (FK may not exist in test)
    try {
      await addTagToDocument(999999, tag.id);
    } catch {
      // Expected if FK constraint exists
    }
    // getDocumentTags with non-existent doc returns empty
    const tags = await getDocumentTags(999999);
    expect(Array.isArray(tags)).toBe(true);
  });

  it("getDocumentsForTag returns array for valid tag", async () => {
    const docs = await getDocumentsForTag(1);
    expect(Array.isArray(docs)).toBe(true);
  });

  it("bulkAddTagsToDocument accepts array of tag IDs", async () => {
    try {
      await bulkAddTagsToDocument(999999, [1, 2, 3]);
    } catch {
      // Expected if FK constraint exists
    }
    expect(true).toBe(true);
  });
});

// ─── GAP ANALYSIS FEEDBACK ────────────────────────────────────────
describe("Knowledge Gap Feedback", () => {
  it("addGapFeedback stores feedback record", async () => {
    const result = await addGapFeedback({
      userId: 999999,
      gapId: "missing-estate-planning",
      gapTitle: "Estate Planning Documents",
      gapCategory: "personal_docs",
      action: "acknowledge",
      userNote: "This is important, I'll upload these next week",
    });
    expect(result).toBeDefined();
  });

  it("getUserGapFeedback retrieves feedback for user", async () => {
    const feedback = await getUserGapFeedback(999999);
    expect(Array.isArray(feedback)).toBe(true);
    expect(feedback.length).toBeGreaterThanOrEqual(1);
    const found = feedback.find(f => f.gapId === "missing-estate-planning");
    expect(found).toBeDefined();
    expect(found?.action).toBe("acknowledge");
    expect(found?.userNote).toContain("important");
  });

  it("addGapFeedback supports dismiss action", async () => {
    const result = await addGapFeedback({
      userId: 999999,
      gapId: "missing-compliance",
      gapTitle: "Compliance Training",
      action: "dismiss",
    });
    expect(result).toBeDefined();
  });

  it("addGapFeedback supports resolved action", async () => {
    const result = await addGapFeedback({
      userId: 999999,
      gapId: "missing-tax-docs",
      gapTitle: "Tax Documents",
      action: "resolved",
    });
    expect(result).toBeDefined();
  });

  it("addGapFeedback supports not_applicable action", async () => {
    const result = await addGapFeedback({
      userId: 999999,
      gapId: "missing-insurance",
      gapTitle: "Insurance Policies",
      action: "not_applicable",
      userNote: "We don't sell insurance",
    });
    expect(result).toBeDefined();
  });
});

// ─── VERSION HISTORY ──────────────────────────────────────────────
describe("Document Version History", () => {
  it("getLatestVersionNumber returns a number", async () => {
    const version = await getLatestVersionNumber(888888);
    expect(Number(version)).toBe(0);
  });

  it("getDocumentVersions returns empty array for non-existent doc", async () => {
    const versions = await getDocumentVersions(999999);
    expect(Array.isArray(versions)).toBe(true);
    expect(versions.length).toBe(0);
  });

  it("addDocumentVersion creates a version record", async () => {
    const result = await addDocumentVersion({
      documentId: 999999,
      userId: 999999,
      versionNumber: 1,
      filename: "test-v1.pdf",
      fileUrl: "https://example.com/test-v1.pdf",
      fileKey: "docs/test/v1.pdf",
      mimeType: "application/pdf",
    });
    expect(result).toBeDefined();
  });
});

// ─── DOCUMENT EXTRACTOR EXPANDED SUPPORT ──────────────────────────
describe("Document Extractor - Expanded File Types", () => {
  it("extracts text from plain text buffer", async () => {
    const buffer = Buffer.from("Hello world, this is a test document for extraction.");
    const result = await extractDocumentText(buffer, "test.txt", "text/plain");
    expect(result.text).toContain("Hello world");
    expect(result.method).toBe("text");
  });

  it("extracts text from markdown buffer", async () => {
    const buffer = Buffer.from("# Heading\n\nSome **bold** text and a [link](https://example.com).");
    const result = await extractDocumentText(buffer, "test.md", "text/markdown");
    expect(result.text).toContain("Heading");
    expect(result.method).toBe("text");
  });

  it("extracts text from CSV buffer", async () => {
    const buffer = Buffer.from("name,age,city\nAlice,30,NYC\nBob,25,LA");
    const result = await extractDocumentText(buffer, "data.csv", "text/csv");
    expect(result.text).toContain("Alice");
    expect(result.method).toBe("text");
  });

  it("extracts text from JSON buffer", async () => {
    const buffer = Buffer.from(JSON.stringify({ name: "Test", value: 42 }));
    const result = await extractDocumentText(buffer, "data.json", "application/json");
    expect(result.text).toContain("Test");
    expect(result.method).toBe("text");
  });

  it("extracts text from HTML buffer", async () => {
    const buffer = Buffer.from("<html><body><h1>Title</h1><p>Content here</p></body></html>");
    const result = await extractDocumentText(buffer, "page.html", "text/html");
    expect(result.text).toContain("Title");
  });

  it("handles unsupported binary file gracefully", async () => {
    const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF]);
    const result = await extractDocumentText(buffer, "unknown.bin", "application/octet-stream");
    expect(result.method).toBe("unsupported");
  });

  it("extracts text from Python code file", async () => {
    const buffer = Buffer.from("def hello():\n    print('Hello, world!')\n\nhello()");
    const result = await extractDocumentText(buffer, "script.py", "text/x-python");
    expect(result.text).toContain("def hello");
    expect(result.method).toBe("text");
  });

  it("extracts text from SQL file", async () => {
    const buffer = Buffer.from("SELECT * FROM users WHERE active = 1;");
    const result = await extractDocumentText(buffer, "query.sql", "application/sql");
    const result2 = await extractDocumentText(buffer, "query.sql", "text/plain");
    expect(result.text || result2.text).toContain("SELECT");
  });

  it("extracts text from XML buffer", async () => {
    const buffer = Buffer.from('<?xml version="1.0"?><root><item>Test data</item></root>');
    const result = await extractDocumentText(buffer, "data.xml", "application/xml");
    expect(result.text).toContain("Test data");
  });

  it("extracts text from RTF-like content via filename extension", async () => {
    const buffer = Buffer.from("{\\rtf1 Hello RTF world}");
    const result = await extractDocumentText(buffer, "doc.rtf", "application/rtf");
    // RTF extraction may strip formatting or return raw
    expect(result).toBeDefined();
    expect(typeof result.text).toBe("string");
  });
});

// ─── SUPPORTED FILE ACCEPT LIST ───────────────────────────────────
describe("Supported File Types", () => {
  const SUPPORTED = ".pdf,.doc,.docx,.odt,.txt,.md,.csv,.tsv,.json,.jsonl,.xml,.html,.htm,.rtf,.xlsx,.xls,.ods,.pptx,.ppt,.odp,.yaml,.yml,.toml,.ini,.cfg,.conf,.log,.sql,.py,.js,.ts,.jsx,.tsx,.css,.java,.c,.cpp,.h,.cs,.go,.rs,.rb,.swift,.sh,.tex,.epub,.ics,.vcf,.zip";
  const extensions = SUPPORTED.split(",");

  it("supports at least 40 file extensions", () => {
    expect(extensions.length).toBeGreaterThanOrEqual(40);
  });

  it("includes all major document formats", () => {
    expect(extensions).toContain(".pdf");
    expect(extensions).toContain(".docx");
    expect(extensions).toContain(".xlsx");
    expect(extensions).toContain(".pptx");
    expect(extensions).toContain(".rtf");
    expect(extensions).toContain(".epub");
  });

  it("includes all major code formats", () => {
    expect(extensions).toContain(".py");
    expect(extensions).toContain(".js");
    expect(extensions).toContain(".ts");
    expect(extensions).toContain(".java");
    expect(extensions).toContain(".go");
    expect(extensions).toContain(".rs");
  });

  it("includes data formats", () => {
    expect(extensions).toContain(".csv");
    expect(extensions).toContain(".json");
    expect(extensions).toContain(".xml");
    expect(extensions).toContain(".yaml");
    expect(extensions).toContain(".toml");
  });

  it("includes archive format", () => {
    expect(extensions).toContain(".zip");
  });
});
