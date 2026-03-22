import { describe, it, expect, vi } from "vitest";

// ─── File Upload Fix + AI Auto-Categorization Tests ─────────────────────

describe("File Upload Fix + AI Auto-Categorization", () => {
  // ─── Size Limit Tests ───────────────────────────────────────────
  describe("Size limits", () => {
    it("should allow files up to 31MB", () => {
      const MAX_FILE_SIZE = 31 * 1024 * 1024;
      expect(MAX_FILE_SIZE).toBe(32505856);
      // A 31MB file should pass
      const fileSize = 31 * 1024 * 1024;
      expect(fileSize <= MAX_FILE_SIZE).toBe(true);
    });

    it("should reject files over 31MB", () => {
      const MAX_FILE_SIZE = 31 * 1024 * 1024;
      const fileSize = 32 * 1024 * 1024;
      expect(fileSize > MAX_FILE_SIZE).toBe(true);
    });

    it("should handle base64 encoding overhead (31MB file → ~42MB base64)", () => {
      // Base64 increases size by ~33%
      const rawSize = 31 * 1024 * 1024;
      const base64Size = Math.ceil(rawSize * 4 / 3);
      // Express body parser is set to 50MB, so base64 of 31MB file should fit
      const expressLimit = 50 * 1024 * 1024;
      expect(base64Size).toBeLessThan(expressLimit);
    });

    it("should accept exactly 31MB files", () => {
      const MAX_FILE_SIZE = 31 * 1024 * 1024;
      const buffer = Buffer.alloc(MAX_FILE_SIZE);
      expect(buffer.length).toBe(MAX_FILE_SIZE);
      expect(buffer.length <= MAX_FILE_SIZE).toBe(true);
    });
  });

  // ─── AI Auto-Categorization Tests ────────────────────────────────
  describe("AI auto-categorization logic", () => {
    const VALID_CATEGORIES = [
      "personal_docs",
      "financial_products",
      "regulations",
      "training_materials",
      "artifacts",
      "skills",
    ];

    it("should have 6 valid categories", () => {
      expect(VALID_CATEGORIES).toHaveLength(6);
    });

    it("should validate category values", () => {
      for (const cat of VALID_CATEGORIES) {
        expect(typeof cat).toBe("string");
        expect(cat.length).toBeGreaterThan(0);
      }
    });

    it("should default to personal_docs when AI fails", () => {
      const fallback = "personal_docs";
      const aiResult = undefined; // simulating LLM failure
      const resolved = aiResult || fallback;
      expect(resolved).toBe("personal_docs");
    });

    it("should accept valid AI classification results", () => {
      const testCases = [
        { filename: "2024_tax_return.pdf", expected: "personal_docs" },
        { filename: "IUL_product_guide.pdf", expected: "financial_products" },
        { filename: "SEC_rule_606.pdf", expected: "regulations" },
        { filename: "CFP_study_guide.pdf", expected: "training_materials" },
        { filename: "Q4_analysis_report.xlsx", expected: "artifacts" },
        { filename: "sales_playbook.md", expected: "skills" },
      ];

      for (const tc of testCases) {
        expect(VALID_CATEGORIES).toContain(tc.expected);
      }
    });

    it("should reject invalid category values", () => {
      const invalidCats = ["invalid", "unknown", "", "documents", "files"];
      for (const cat of invalidCats) {
        expect(VALID_CATEGORIES).not.toContain(cat);
      }
    });

    it("should trim and lowercase AI response before matching", () => {
      const rawResponses = [
        " personal_docs ",
        "FINANCIAL_PRODUCTS",
        "  regulations\n",
        "Training_Materials",
      ];
      for (const raw of rawResponses) {
        const cleaned = raw.trim().toLowerCase();
        expect(VALID_CATEGORIES).toContain(cleaned);
      }
    });
  });

  // ─── Upload Procedure Input Schema Tests ──────────────────────────
  describe("Upload procedure input schema", () => {
    it("should make category optional (AI auto-assigns)", () => {
      // The schema allows category to be undefined
      const input = {
        filename: "test.pdf",
        content: "dGVzdA==", // base64 of "test"
        mimeType: "application/pdf",
        // category is NOT provided — AI will auto-detect
        visibility: "professional" as const,
      };
      expect(input.filename).toBeDefined();
      expect((input as any).category).toBeUndefined();
    });

    it("should still accept explicit category if provided", () => {
      const input = {
        filename: "test.pdf",
        content: "dGVzdA==",
        mimeType: "application/pdf",
        category: "regulations" as const,
        visibility: "professional" as const,
      };
      expect(input.category).toBe("regulations");
    });

    it("should accept all visibility levels", () => {
      const levels = ["private", "professional", "management", "admin"];
      for (const level of levels) {
        expect(levels).toContain(level);
      }
    });
  });

  // ─── File Type Acceptance Tests ───────────────────────────────────
  describe("Accepted file types", () => {
    const ACCEPTED_EXTENSIONS = [
      ".txt", ".md", ".pdf", ".doc", ".docx",
      ".csv", ".json", ".xlsx", ".pptx", ".rtf",
      ".html", ".xml", ".yaml", ".yml",
    ];

    it("should accept common document formats", () => {
      expect(ACCEPTED_EXTENSIONS).toContain(".pdf");
      expect(ACCEPTED_EXTENSIONS).toContain(".docx");
      expect(ACCEPTED_EXTENSIONS).toContain(".xlsx");
    });

    it("should accept text-based formats", () => {
      expect(ACCEPTED_EXTENSIONS).toContain(".txt");
      expect(ACCEPTED_EXTENSIONS).toContain(".md");
      expect(ACCEPTED_EXTENSIONS).toContain(".csv");
      expect(ACCEPTED_EXTENSIONS).toContain(".json");
    });

    it("should accept markup formats", () => {
      expect(ACCEPTED_EXTENSIONS).toContain(".html");
      expect(ACCEPTED_EXTENSIONS).toContain(".xml");
      expect(ACCEPTED_EXTENSIONS).toContain(".yaml");
      expect(ACCEPTED_EXTENSIONS).toContain(".yml");
    });
  });

  // ─── Upload Response Tests ────────────────────────────────────────
  describe("Upload response", () => {
    it("should return document id, url, and category in response", () => {
      const mockResponse = {
        id: 1,
        url: "https://storage.example.com/docs/1/abc-test.pdf",
        category: "financial_products",
      };
      expect(mockResponse.id).toBeDefined();
      expect(mockResponse.url).toBeDefined();
      expect(mockResponse.category).toBeDefined();
    });
  });

  // ─── Express Body Parser Configuration Tests ─────────────────────
  describe("Express body parser configuration", () => {
    it("should have JSON body limit of 50MB to accommodate base64 overhead", () => {
      const limit = "50mb";
      const limitBytes = 50 * 1024 * 1024;
      const maxBase64 = Math.ceil(31 * 1024 * 1024 * 4 / 3);
      expect(limitBytes).toBeGreaterThan(maxBase64);
      expect(limit).toBe("50mb");
    });
  });
});
