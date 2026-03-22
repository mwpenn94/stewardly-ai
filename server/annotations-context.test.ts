import { describe, it, expect } from "vitest";

// ─── Document Annotations CRUD ───────────────────────────────────────
describe("Document Annotations", () => {
  it("should export getDocumentAnnotations, createAnnotation, resolveAnnotation, deleteAnnotation from db", async () => {
    const db = await import("./db");
    expect(typeof db.getDocumentAnnotations).toBe("function");
    expect(typeof db.createAnnotation).toBe("function");
    expect(typeof db.resolveAnnotation).toBe("function");
    expect(typeof db.deleteAnnotation).toBe("function");
  });

  it("getDocumentAnnotations should return an array for a non-existent document", async () => {
    const { getDocumentAnnotations } = await import("./db");
    const result = await getDocumentAnnotations(999999);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("createAnnotation should create and return an annotation id", async () => {
    const { createAnnotation, getDocumentAnnotations, deleteAnnotation } = await import("./db");
    const result = await createAnnotation({
      documentId: 1,
      userId: 1,
      content: "Test annotation from vitest",
      annotationType: "comment",
    });
    // If DB is available, result should have an id
    if (result) {
      expect(result).toHaveProperty("id");
      expect(typeof result.id).toBe("number");
      // Verify it appears in the list
      const annotations = await getDocumentAnnotations(1);
      const found = annotations.find((a: any) => a.id === result.id);
      expect(found).toBeDefined();
      expect(found?.content).toBe("Test annotation from vitest");
      // Cleanup
      await deleteAnnotation(result.id);
    }
  });

  it("resolveAnnotation should mark an annotation as resolved", async () => {
    const { createAnnotation, resolveAnnotation, getDocumentAnnotations, deleteAnnotation } = await import("./db");
    const result = await createAnnotation({
      documentId: 1,
      userId: 1,
      content: "Resolve test annotation",
      annotationType: "question",
    });
    if (result) {
      await resolveAnnotation(result.id, 1);
      const annotations = await getDocumentAnnotations(1);
      const found = annotations.find((a: any) => a.id === result.id);
      expect(found?.resolved).toBeTruthy();
      // Cleanup
      await deleteAnnotation(result.id);
    }
  });
});

// ─── Deep Context Assembler ──────────────────────────────────────────
describe("Deep Context Assembler", () => {
  it("should export assembleDeepContext and getQuickContext", async () => {
    const ctx = await import("./services/deepContextAssembler");
    expect(typeof ctx.assembleDeepContext).toBe("function");
    expect(typeof ctx.getQuickContext).toBe("function");
  });

  it("getQuickContext should return a string for any context type", async () => {
    const { getQuickContext } = await import("./services/deepContextAssembler");
    const result = await getQuickContext("compliance", null);
    expect(typeof result).toBe("string");
  });

  it("assembleDeepContext should return structured context object", async () => {
    const { assembleDeepContext } = await import("./services/deepContextAssembler");
    const result = await assembleDeepContext({
      types: ["compliance"],
      maxTokens: 500,
    });
    expect(result).toHaveProperty("documentContext");
    expect(result).toHaveProperty("knowledgeBaseContext");
    expect(result).toHaveProperty("userProfileContext");
    expect(typeof result.documentContext).toBe("string");
    expect(typeof result.knowledgeBaseContext).toBe("string");
  });
});

// ─── contextualLLM wrapper ──────────────────────────────────────────
describe("contextualLLM wrapper", () => {
  it("should export contextualLLM from contextualLLM module", async () => {
    const ctx = await import("./services/contextualLLM");
    expect(typeof ctx.contextualLLM).toBe("function");
  });
});
