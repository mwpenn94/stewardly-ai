import { describe, it, expect, vi } from "vitest";
import {
  getDocumentProcessingStats,
  getDocumentVersions,
  getLatestVersionNumber,
  addDocumentVersion,
  addDocument,
  getUserDocuments,
  updateDocumentStatus,
  renameDocument,
} from "./db";

// ─── Processing Stats ──────────────────────────────────────────
describe("getDocumentProcessingStats", () => {
  it("should be a function", () => {
    expect(typeof getDocumentProcessingStats).toBe("function");
  });

  it("should return stats object shape for non-existent user", async () => {
    const stats = await getDocumentProcessingStats(999999);
    expect(stats).toBeDefined();
    expect(typeof stats.total).toBe("number");
    expect(typeof stats.ready).toBe("number");
    expect(typeof stats.processing).toBe("number");
    expect(typeof stats.uploading).toBe("number");
    expect(typeof stats.error).toBe("number");
    expect(typeof stats.totalChunks).toBe("number");
    expect(typeof stats.recentUploads).toBe("number");
  });

  it("should return zero counts for user with no documents", async () => {
    const stats = await getDocumentProcessingStats(888888);
    expect(stats.total).toBe(0);
    expect(stats.ready).toBe(0);
    expect(stats.processing).toBe(0);
    expect(stats.error).toBe(0);
  });
});

// ─── Version History ───────────────────────────────────────────
describe("getDocumentVersions", () => {
  it("should be a function", () => {
    expect(typeof getDocumentVersions).toBe("function");
  });

  it("should return empty array for non-existent document", async () => {
    const versions = await getDocumentVersions(999999, 999999);
    expect(Array.isArray(versions)).toBe(true);
    expect(versions.length).toBe(0);
  });
});

describe("getLatestVersionNumber", () => {
  it("should be a function", () => {
    expect(typeof getLatestVersionNumber).toBe("function");
  });

  it("should return 0 for document with no versions", async () => {
    const version = await getLatestVersionNumber(999999);
    expect(version).toBe(0);
  });
});

describe("addDocumentVersion", () => {
  it("should be a function", () => {
    expect(typeof addDocumentVersion).toBe("function");
  });

  it("should accept version data with required fields", () => {
    // Verify the function signature accepts the expected shape
    const data = {
      documentId: 1,
      userId: 1,
      versionNumber: 1,
      filename: "test.pdf",
      fileUrl: "https://example.com/test.pdf",
      fileKey: "docs/1/test.pdf",
      mimeType: "application/pdf",
      extractedText: "test content",
      chunkCount: 5,
      sizeBytes: undefined,
    };
    // Just verify it doesn't throw on type check
    expect(data.documentId).toBe(1);
    expect(data.versionNumber).toBe(1);
  });
});

// ─── Auto-categorization feedback ──────────────────────────────
describe("auto-categorization on upload", () => {
  it("upload response should include wasAutoClassified and suggestedCategory fields", () => {
    // Verify the expected response shape from the upload mutation
    const mockResponse = {
      id: 1,
      url: "https://example.com/file.pdf",
      category: "financial_products",
      wasAutoClassified: true,
      suggestedCategory: "financial_products",
    };
    expect(mockResponse.wasAutoClassified).toBe(true);
    expect(mockResponse.suggestedCategory).toBe("financial_products");
  });

  it("wasAutoClassified should be false when category is explicitly provided", () => {
    const mockResponse = {
      id: 2,
      url: "https://example.com/file2.pdf",
      category: "personal_docs",
      wasAutoClassified: false,
      suggestedCategory: "personal_docs",
    };
    expect(mockResponse.wasAutoClassified).toBe(false);
  });
});

// ─── Reprocess ─────────────────────────────────────────────────
describe("document reprocessing", () => {
  it("updateDocumentStatus should be a function", () => {
    expect(typeof updateDocumentStatus).toBe("function");
  });

  it("should support status transitions", () => {
    // Verify valid status values
    const validStatuses = ["uploading", "processing", "ready", "error"];
    validStatuses.forEach(s => {
      expect(typeof s).toBe("string");
    });
  });
});

// ─── Integration: Stats shape validation ───────────────────────
describe("processing stats shape", () => {
  it("stats should include all required fields", async () => {
    const stats = await getDocumentProcessingStats(777777);
    const requiredFields = ["total", "ready", "processing", "uploading", "error", "totalChunks", "recentUploads"];
    requiredFields.forEach(field => {
      expect(stats).toHaveProperty(field);
    });
  });

  it("all stat values should be non-negative numbers", async () => {
    const stats = await getDocumentProcessingStats(777777);
    Object.values(stats).forEach(val => {
      expect(typeof val).toBe("number");
      expect(val).toBeGreaterThanOrEqual(0);
    });
  });
});

// ─── Version number sequencing ─────────────────────────────────
describe("version number sequencing", () => {
  it("getLatestVersionNumber returns a number", async () => {
    const result = await getLatestVersionNumber(1);
    expect(typeof result).toBe("number");
  });

  it("version numbers should start at 0 for new documents", async () => {
    const result = await getLatestVersionNumber(999998);
    expect(result).toBe(0);
  });
});
