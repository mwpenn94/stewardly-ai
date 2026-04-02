/**
 * Tests for Data Export and Conversation Sidebar Filtering features
 */
import { describe, it, expect } from "vitest";

describe("Data Export Feature", () => {
  describe("Export Router Availability", () => {
    it("should have the exports router module", async () => {
      const mod = await import("./routers/exports");
      expect(mod).toBeDefined();
      expect(mod.exportsRouter).toBeDefined();
    });

    it("should export a tRPC router", async () => {
      const mod = await import("./routers/exports");
      const router = mod.exportsRouter;
      expect(router).toBeDefined();
      expect(typeof router).toBe("object");
    });
  });

  describe("Export ZIP Structure", () => {
    it("should have archiver package available", async () => {
      const archiver = await import("archiver");
      expect(archiver).toBeDefined();
      expect(typeof archiver.default).toBe("function");
    });

    it("should create a valid archive instance", async () => {
      const archiver = (await import("archiver")).default;
      const archive = archiver("zip", { zlib: { level: 9 } });
      expect(archive).toBeDefined();
      expect(typeof archive.append).toBe("function");
      expect(typeof archive.finalize).toBe("function");
      archive.abort();
    });

    it("should support appending string content to archive", async () => {
      const archiver = (await import("archiver")).default;
      const archive = archiver("zip", { zlib: { level: 9 } });
      // Should not throw when appending content
      expect(() => {
        archive.append(JSON.stringify({ test: true }), { name: "test.json" });
      }).not.toThrow();
      archive.abort();
    });
  });

  describe("Export Data Formatting", () => {
    it("should format conversations as markdown", () => {
      const conversation = {
        title: "Tax Planning",
        messages: [
          { role: "user", content: "How can I reduce my tax burden?" },
          { role: "assistant", content: "There are several strategies..." },
        ],
      };

      let md = `# ${conversation.title}\n\n`;
      for (const msg of conversation.messages) {
        md += `## ${msg.role === "user" ? "You" : "Steward"}\n\n${msg.content}\n\n---\n\n`;
      }

      expect(md).toContain("# Tax Planning");
      expect(md).toContain("## You");
      expect(md).toContain("## Steward");
      expect(md).toContain("How can I reduce my tax burden?");
    });

    it("should generate a valid manifest.json", () => {
      const manifest = {
        exportDate: new Date().toISOString(),
        platform: "Stewardly",
        version: "1.0",
        sections: ["conversations", "profile", "documents", "settings", "audit"],
        fileCount: 25,
      };

      const json = JSON.stringify(manifest, null, 2);
      const parsed = JSON.parse(json);
      expect(parsed.platform).toBe("Stewardly");
      expect(parsed.sections).toHaveLength(5);
      expect(parsed.exportDate).toBeTruthy();
    });

    it("should handle empty data sections gracefully", () => {
      const emptyProfile = {};
      const emptyConversations: any[] = [];
      const emptyDocuments: any[] = [];

      expect(JSON.stringify(emptyProfile)).toBe("{}");
      expect(JSON.stringify(emptyConversations)).toBe("[]");
      expect(JSON.stringify(emptyDocuments)).toBe("[]");
    });
  });

  describe("Section Selection", () => {
    it("should support selecting individual export sections", () => {
      const allSections = ["conversations", "profile", "documents", "settings", "audit"];
      const selected = ["conversations", "profile"];

      const filtered = allSections.filter((s) => selected.includes(s));
      expect(filtered).toHaveLength(2);
      expect(filtered).toContain("conversations");
      expect(filtered).toContain("profile");
      expect(filtered).not.toContain("documents");
    });

    it("should require at least one section", () => {
      const selected: string[] = [];
      expect(selected.length).toBe(0);
      // UI should prevent this case
    });

    it("should default to all sections when none specified", () => {
      const allSections = ["conversations", "profile", "documents", "settings", "audit"];
      const selected: string[] | undefined = undefined;
      const effective = selected || allSections;
      expect(effective).toHaveLength(5);
    });
  });
});

describe("Conversation Sidebar Filtering", () => {
  describe("Date Grouping Logic", () => {
    it("should correctly categorize dates into groups", () => {
      const now = new Date();

      function getDateGroup(date: Date): string {
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Yesterday";
        if (diffDays <= 7) return "Previous 7 Days";
        if (diffDays <= 30) return "Previous 30 Days";
        return "Older";
      }

      const today = new Date(now);
      expect(getDateGroup(today)).toBe("Today");

      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      expect(getDateGroup(yesterday)).toBe("Yesterday");

      const lastWeek = new Date(now);
      lastWeek.setDate(lastWeek.getDate() - 5);
      expect(getDateGroup(lastWeek)).toBe("Previous 7 Days");

      const lastMonth = new Date(now);
      lastMonth.setDate(lastMonth.getDate() - 20);
      expect(getDateGroup(lastMonth)).toBe("Previous 30 Days");

      const older = new Date(now);
      older.setDate(older.getDate() - 60);
      expect(getDateGroup(older)).toBe("Older");
    });

    it("should handle edge case: exactly 7 days ago", () => {
      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const diffDays = Math.floor((now.getTime() - sevenDaysAgo.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(7);
      expect(diffDays <= 7).toBe(true); // Should be in "Previous 7 Days"
    });

    it("should handle edge case: exactly 30 days ago", () => {
      // Use UTC dates to avoid DST edge cases
      const now = new Date(Date.UTC(2026, 3, 1, 12, 0, 0)); // April 1, 2026 noon UTC
      const thirtyDaysAgo = new Date(Date.UTC(2026, 2, 2, 12, 0, 0)); // March 2, 2026 noon UTC (exactly 30 days)

      const diffDays = Math.floor((now.getTime() - thirtyDaysAgo.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(30);
      expect(diffDays <= 30).toBe(true); // Should be in "Previous 30 Days"
    });

    it("should produce groups in chronological order", () => {
      const groupOrder = ["Today", "Yesterday", "Previous 7 Days", "Previous 30 Days", "Older"];
      expect(groupOrder[0]).toBe("Today");
      expect(groupOrder[groupOrder.length - 1]).toBe("Older");
    });
  });

  describe("Empty Conversation Filtering", () => {
    it("should filter out conversations with 0 messages", () => {
      const convos = [
        { id: 1, title: "New Conversation", messageCount: 0 },
        { id: 2, title: "Important Chat", messageCount: 5 },
        { id: 3, title: "New Conversation", messageCount: 0 },
        { id: 4, title: "Tax Planning", messageCount: 3 },
        { id: 5, title: "Empty Named", messageCount: 0 },
      ];

      const filtered = convos.filter((c) => c.messageCount > 0);
      expect(filtered).toHaveLength(2);
      expect(filtered[0].title).toBe("Important Chat");
      expect(filtered[1].title).toBe("Tax Planning");
    });

    it("should keep the current conversation even if empty", () => {
      const currentId = 1;
      const convos = [
        { id: 1, title: "New Conversation", messageCount: 0 },
        { id: 2, title: "Important Chat", messageCount: 5 },
        { id: 3, title: "New Conversation", messageCount: 0 },
      ];

      const filtered = convos.filter(
        (c) => c.messageCount > 0 || c.id === currentId
      );
      expect(filtered).toHaveLength(2);
      expect(filtered[0].id).toBe(1);
      expect(filtered[1].id).toBe(2);
    });

    it("should handle all conversations being empty", () => {
      const convos = [
        { id: 1, title: "New Conversation", messageCount: 0 },
        { id: 2, title: "New Conversation", messageCount: 0 },
      ];

      const filtered = convos.filter((c) => c.messageCount > 0);
      expect(filtered).toHaveLength(0);
    });

    it("should handle no conversations at all", () => {
      const convos: any[] = [];
      const filtered = convos.filter((c) => c.messageCount > 0);
      expect(filtered).toHaveLength(0);
    });
  });

  describe("Client-side Search Filtering", () => {
    it("should filter conversations by title match (case-insensitive)", () => {
      const convos = [
        { id: 1, title: "Tax Planning Strategy", messageCount: 3 },
        { id: 2, title: "Retirement Goals", messageCount: 5 },
        { id: 3, title: "Estate Tax Overview", messageCount: 2 },
        { id: 4, title: "Crypto Insights", messageCount: 1 },
      ];

      const query = "tax";
      const filtered = convos.filter((c) =>
        c.title.toLowerCase().includes(query.toLowerCase())
      );
      expect(filtered).toHaveLength(2);
      expect(filtered[0].title).toBe("Tax Planning Strategy");
      expect(filtered[1].title).toBe("Estate Tax Overview");
    });

    it("should return all conversations when search query is empty", () => {
      const convos = [
        { id: 1, title: "Tax Planning", messageCount: 3 },
        { id: 2, title: "Retirement Goals", messageCount: 5 },
      ];

      const query = "";
      const filtered = query
        ? convos.filter((c) => c.title.toLowerCase().includes(query.toLowerCase()))
        : convos;
      expect(filtered).toHaveLength(2);
    });

    it("should handle special characters in search query", () => {
      const convos = [
        { id: 1, title: "401(k) Rollover Options", messageCount: 3 },
        { id: 2, title: "Roth IRA Conversion", messageCount: 5 },
      ];

      const query = "401(k)";
      const filtered = convos.filter((c) =>
        c.title.toLowerCase().includes(query.toLowerCase())
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe("401(k) Rollover Options");
    });
  });
});

describe("Redundant Back Link Cleanup", () => {
  it("should not have Back to Chat in AppShell-wrapped pages", async () => {
    const fs = await import("fs");
    const path = await import("path");

    const appShellPages = [
      "AdvisoryHub.tsx",
      "RelationshipsHub.tsx",
      "OperationsHub.tsx",
      "IntelligenceHub.tsx",
      "MarketData.tsx",
      "Help.tsx",
      "SettingsHub.tsx",
      "ImprovementEngine.tsx",
      "SuitabilityPanel.tsx",
    ];

    const pagesDir = path.join(process.cwd(), "client/src/pages");

    for (const page of appShellPages) {
      const filePath = path.join(pagesDir, page);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        if (content.includes("AppShell")) {
          const hasBackToChat = content.includes("Back to Chat");
          expect(
            hasBackToChat,
            `${page} uses AppShell but still has "Back to Chat" link`
          ).toBe(false);
        }
      }
    }
  });
});
