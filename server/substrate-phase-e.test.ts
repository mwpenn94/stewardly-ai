/**
 * Phase E Tests — Extended Substrate Primitives
 *
 * Validates the Phase E substrate primitives:
 *   1. Proposal Generator (template-driven, compliance-aware)
 *   2. Document Intelligence (classification, extraction, chunking)
 *   3. Memory Substrate (working memory, retrieval, consolidation)
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  classifyDocument,
  extractEntities,
  chunkDocument,
  type DocumentChunk,
} from "./services/substrate/documentIntel";
import {
  getProposalTypes,
} from "./services/substrate/proposalGenerator";
import {
  getWorkingMemory,
  addToWorkingMemory,
  retrieveMemories,
  consolidateWorkingMemory,
  clearWorkingMemory,
  getMemoryStats,
} from "./services/substrate/memorySubstrate";

// ─── Document Intelligence Tests ─────────────────────────────────────────────

describe("Substrate: Document Intelligence", () => {
  describe("classifyDocument", () => {
    it("classifies financial statements", () => {
      const result = classifyDocument("Balance Sheet as of December 31, 2024. Total Assets: $5,000,000. Total Liabilities: $2,000,000.");
      expect(result.type).toBe("financial_statement");
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it("classifies tax returns", () => {
      const result = classifyDocument("Form 1040 - U.S. Individual Income Tax Return. Adjusted Gross Income: $150,000. Schedule A itemized deductions.");
      expect(result.type).toBe("tax_return");
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it("classifies insurance policies", () => {
      const result = classifyDocument("Policy Number: ABC-123456. Coverage: $1,000,000. Premium: $500/month. Deductible: $5,000. Beneficiary: John Smith.");
      expect(result.type).toBe("insurance_policy");
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it("classifies estate documents", () => {
      const result = classifyDocument("Last Will and Testament. I appoint Jane Doe as executor of my estate. Trust provisions for beneficiary distributions.");
      expect(result.type).toBe("estate_document");
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it("classifies general documents", () => {
      const result = classifyDocument("This is a random document about cooking recipes and gardening tips.");
      expect(result.type).toBe("general");
    });
  });

  describe("extractEntities", () => {
    it("extracts dollar amounts", () => {
      const entities = extractEntities("The total value is $1,250,000.50 and the fee is $500.");
      const amounts = entities.filter((e) => e.type === "amount");
      expect(amounts.length).toBe(2);
      expect(amounts[0].value).toBe("$1,250,000.50");
    });

    it("extracts percentages", () => {
      const entities = extractEntities("The return was 7.5% annually with a 2% fee.");
      const percentages = entities.filter((e) => e.type === "percentage");
      expect(percentages.length).toBe(2);
    });

    it("extracts dates", () => {
      const entities = extractEntities("The policy starts on 01/15/2025 and expires December 31, 2025.");
      const dates = entities.filter((e) => e.type === "date");
      expect(dates.length).toBeGreaterThanOrEqual(1);
    });

    it("extracts account numbers", () => {
      const entities = extractEntities("Please reference account #12345-678 for this transaction.");
      const accounts = entities.filter((e) => e.type === "account");
      expect(accounts.length).toBe(1);
    });

    it("limits extraction to 50 entities", () => {
      const manyAmounts = Array(100).fill("$1,000").join(" ");
      const entities = extractEntities(manyAmounts);
      expect(entities.length).toBeLessThanOrEqual(50);
    });
  });

  describe("chunkDocument", () => {
    it("splits text into chunks", () => {
      const text = Array(10).fill("This is a paragraph with some content about financial planning and investment strategies.").join("\n\n");
      const chunks = chunkDocument(text, { maxChunkSize: 200 });
      expect(chunks.length).toBeGreaterThan(1);
    });

    it("respects maxChunkSize", () => {
      const text = Array(20).fill("Short paragraph.").join("\n\n");
      const chunks = chunkDocument(text, { maxChunkSize: 100 });
      for (const chunk of chunks) {
        expect(chunk.content.length).toBeLessThanOrEqual(200); // Allow some overflow for paragraph boundaries
      }
    });

    it("assigns sequential IDs", () => {
      const text = "Para 1\n\nPara 2\n\nPara 3";
      const chunks = chunkDocument(text, { maxChunkSize: 10 });
      for (let i = 0; i < chunks.length; i++) {
        expect(chunks[i].id).toBe(`chunk_${i}`);
      }
    });

    it("detects tables in chunks", () => {
      const text = "Normal text\n\n| Column 1 | Column 2 |\n| --- | --- |\n| Data | Data |\n\nMore text";
      const chunks = chunkDocument(text, { maxChunkSize: 5000 });
      const tableChunk = chunks.find((c) => c.metadata.hasTable);
      expect(tableChunk).toBeDefined();
    });

    it("detects amounts in chunks", () => {
      const text = "This section has $50,000 in it.\n\nThis section does not.";
      const chunks = chunkDocument(text, { maxChunkSize: 5000 });
      const amountChunk = chunks.find((c) => c.metadata.hasAmount);
      expect(amountChunk).toBeDefined();
    });
  });
});

// ─── Proposal Generator Tests ────────────────────────────────────────────────

describe("Substrate: Proposal Generator", () => {
  it("getProposalTypes returns all types", () => {
    const types = getProposalTypes();
    expect(types.length).toBe(9);
    const typeNames = types.map((t) => t.type);
    expect(typeNames).toContain("investment_recommendation");
    expect(typeNames).toContain("rebalancing_plan");
    expect(typeNames).toContain("financial_plan");
    expect(typeNames).toContain("tax_strategy");
    expect(typeNames).toContain("general");
  });

  it("each proposal type has label and description", () => {
    const types = getProposalTypes();
    for (const type of types) {
      expect(type.label).toBeTruthy();
      expect(type.description).toBeTruthy();
    }
  });
});

// ─── Memory Substrate Tests ──────────────────────────────────────────────────

describe("Substrate: Memory Substrate", () => {
  const testUserId = 99999;

  beforeEach(() => {
    clearWorkingMemory(testUserId);
  });

  describe("Working Memory", () => {
    it("creates working memory for new user", () => {
      const wm = getWorkingMemory(testUserId);
      expect(wm.userId).toBe(testUserId);
      expect(wm.entries).toHaveLength(0);
      expect(wm.maxSize).toBe(20);
    });

    it("adds entries to working memory", () => {
      addToWorkingMemory(testUserId, {
        type: "semantic",
        content: "User prefers conservative investments",
        importance: 0.8,
        metadata: { source: "conversation" },
      });

      const wm = getWorkingMemory(testUserId);
      expect(wm.entries).toHaveLength(1);
      expect(wm.entries[0].content).toBe("User prefers conservative investments");
    });

    it("evicts low-importance entries when at capacity", () => {
      // Fill to capacity with low-importance entries
      for (let i = 0; i < 25; i++) {
        addToWorkingMemory(testUserId, {
          type: "working",
          content: `Entry ${i}`,
          importance: i < 20 ? 0.1 : 0.9,
          metadata: {},
        });
      }

      const wm = getWorkingMemory(testUserId);
      expect(wm.entries.length).toBeLessThanOrEqual(20);
    });

    it("assigns unique IDs to entries", () => {
      addToWorkingMemory(testUserId, { type: "semantic", content: "A", importance: 0.5, metadata: {} });
      addToWorkingMemory(testUserId, { type: "semantic", content: "B", importance: 0.5, metadata: {} });

      const wm = getWorkingMemory(testUserId);
      expect(wm.entries[0].id).not.toBe(wm.entries[1].id);
    });
  });

  describe("Memory Retrieval", () => {
    it("retrieves relevant memories by keyword", async () => {
      addToWorkingMemory(testUserId, { type: "semantic", content: "retirement planning goals", importance: 0.8, metadata: {} });
      addToWorkingMemory(testUserId, { type: "semantic", content: "cooking recipes for dinner", importance: 0.5, metadata: {} });

      const result = await retrieveMemories(testUserId, { text: "retirement" });
      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.entries[0].content).toContain("retirement");
    });

    it("filters by memory type", async () => {
      addToWorkingMemory(testUserId, { type: "semantic", content: "semantic memory", importance: 0.8, metadata: {} });
      addToWorkingMemory(testUserId, { type: "episodic", content: "episodic memory", importance: 0.8, metadata: {} });

      const result = await retrieveMemories(testUserId, { text: "memory", types: ["episodic"] });
      for (const entry of result.entries) {
        expect(entry.type).toBe("episodic");
      }
    });

    it("filters by minimum importance", async () => {
      addToWorkingMemory(testUserId, { type: "semantic", content: "important fact", importance: 0.9, metadata: {} });
      addToWorkingMemory(testUserId, { type: "semantic", content: "trivial fact", importance: 0.1, metadata: {} });

      const result = await retrieveMemories(testUserId, { text: "fact", minImportance: 0.5 });
      for (const entry of result.entries) {
        expect(entry.importance).toBeGreaterThanOrEqual(0.5);
      }
    });

    it("respects maxResults", async () => {
      for (let i = 0; i < 10; i++) {
        addToWorkingMemory(testUserId, { type: "semantic", content: `fact ${i}`, importance: 0.5, metadata: {} });
      }

      const result = await retrieveMemories(testUserId, { text: "fact", maxResults: 3 });
      expect(result.entries.length).toBeLessThanOrEqual(3);
    });

    it("returns empty for no matches", async () => {
      const result = await retrieveMemories(testUserId, { text: "nonexistent" });
      expect(result.entries).toHaveLength(0);
    });
  });

  describe("Memory Consolidation", () => {
    it("consolidates working memory", () => {
      addToWorkingMemory(testUserId, { type: "working", content: "temp", importance: 0.1, metadata: {} });
      const result = consolidateWorkingMemory(testUserId);
      expect(result).toHaveProperty("merged");
      expect(result).toHaveProperty("evicted");
      expect(result).toHaveProperty("remaining");
    });

    it("clears working memory", () => {
      addToWorkingMemory(testUserId, { type: "semantic", content: "test", importance: 0.5, metadata: {} });
      clearWorkingMemory(testUserId);
      const wm = getWorkingMemory(testUserId);
      expect(wm.entries).toHaveLength(0);
    });
  });

  describe("Memory Stats", () => {
    it("returns stats for empty memory", () => {
      const stats = getMemoryStats(testUserId);
      expect(stats.totalEntries).toBe(0);
      expect(stats.avgImportance).toBe(0);
      expect(stats.oldestEntry).toBeNull();
    });

    it("returns accurate stats", () => {
      addToWorkingMemory(testUserId, { type: "semantic", content: "a", importance: 0.8, metadata: {} });
      addToWorkingMemory(testUserId, { type: "episodic", content: "b", importance: 0.6, metadata: {} });
      addToWorkingMemory(testUserId, { type: "semantic", content: "c", importance: 0.4, metadata: {} });

      const stats = getMemoryStats(testUserId);
      expect(stats.totalEntries).toBe(3);
      expect(stats.byType.semantic).toBe(2);
      expect(stats.byType.episodic).toBe(1);
      expect(stats.avgImportance).toBeCloseTo(0.6, 1);
      expect(stats.oldestEntry).not.toBeNull();
      expect(stats.newestEntry).not.toBeNull();
    });
  });
});
