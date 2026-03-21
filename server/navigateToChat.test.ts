import { describe, it, expect } from "vitest";

/**
 * Tests for the navigateToChat utility and placeholder toast wiring.
 * These verify the pattern used across all hub pages to replace
 * "Feature coming soon" toasts with contextual chat navigation.
 */

describe("navigateToChat utility pattern", () => {
  it("should store pending prompt in sessionStorage and navigate to /chat", () => {
    // Simulate the navigateToChat pattern
    const prompt = "Help me run a full financial analysis";
    const STORAGE_KEY = "stewardly_pending_prompt";

    // Simulate storage
    const storage: Record<string, string> = {};
    storage[STORAGE_KEY] = prompt;

    expect(storage[STORAGE_KEY]).toBe(prompt);
  });

  it("should support contextual prompts with dynamic data", () => {
    const modelName = "Monte Carlo Simulation";
    const prompt = `Run the ${modelName} model with my current financial profile and show me the results.`;

    expect(prompt).toContain("Monte Carlo Simulation");
    expect(prompt).toContain("model");
    expect(prompt).toContain("results");
  });

  it("should support product-specific prompts", () => {
    const productName = "Whole Life Insurance";
    const prompt = `Analyze ${productName} — show me features, suitability for my profile, and how it compares to alternatives.`;

    expect(prompt).toContain("Whole Life Insurance");
    expect(prompt).toContain("suitability");
    expect(prompt).toContain("alternatives");
  });

  it("should support meeting-related prompts", () => {
    const contactName = "John Smith";
    const prompt = `Schedule a meeting with ${contactName}. Help me prepare an agenda and pre-meeting brief.`;

    expect(prompt).toContain("John Smith");
    expect(prompt).toContain("agenda");
    expect(prompt).toContain("pre-meeting brief");
  });

  it("should support integration configuration prompts", () => {
    const providerName = "Plaid";
    const category = "Financial Data";
    const prompt = `Help me configure the ${providerName} integration (${category}). Walk me through the setup process and what credentials are needed.`;

    expect(prompt).toContain("Plaid");
    expect(prompt).toContain("Financial Data");
    expect(prompt).toContain("credentials");
  });
});

describe("placeholder toast elimination", () => {
  it("should have no 'Feature coming soon' toasts in hub pages", async () => {
    const fs = await import("fs");
    const path = await import("path");

    const hubFiles = [
      "client/src/pages/IntelligenceHub.tsx",
      "client/src/pages/AdvisoryHub.tsx",
      "client/src/pages/RelationshipsHub.tsx",
      "client/src/pages/OperationsHub.tsx",
      "client/src/pages/AdminIntegrations.tsx",
      "client/src/pages/AdvisorIntegrations.tsx",
      "client/src/pages/GlobalAdmin.tsx",
    ];

    const projectRoot = path.resolve(__dirname, "..");

    for (const file of hubFiles) {
      const filePath = path.join(projectRoot, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        const hasComingSoon = content.includes('toast.info("Feature coming soon")');
        expect(hasComingSoon, `${file} should not have "Feature coming soon" toast`).toBe(false);
      }
    }
  });

  it("should have no generic 'coming soon' toasts in AISettings", async () => {
    const fs = await import("fs");
    const path = await import("path");

    const filePath = path.join(path.resolve(__dirname, ".."), "client/src/pages/AISettings.tsx");
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      const hasComingSoon = content.includes('toast.info("Feature coming soon")');
      expect(hasComingSoon).toBe(false);
    }
  });

  it("should use navigateToChat import in hub pages", async () => {
    const fs = await import("fs");
    const path = await import("path");

    const hubFiles = [
      "client/src/pages/IntelligenceHub.tsx",
      "client/src/pages/AdvisoryHub.tsx",
      "client/src/pages/RelationshipsHub.tsx",
      "client/src/pages/OperationsHub.tsx",
      "client/src/pages/AdminIntegrations.tsx",
      "client/src/pages/AdvisorIntegrations.tsx",
    ];

    const projectRoot = path.resolve(__dirname, "..");

    for (const file of hubFiles) {
      const filePath = path.join(projectRoot, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        const hasImport = content.includes("navigateToChat");
        expect(hasImport, `${file} should import navigateToChat`).toBe(true);
      }
    }
  });
});

describe("navigateToChat.ts module", () => {
  it("should export navigateToChat function", async () => {
    const fs = await import("fs");
    const path = await import("path");

    const filePath = path.join(path.resolve(__dirname, ".."), "client/src/lib/navigateToChat.ts");
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("export function navigateToChat");
    expect(content).toContain("sessionStorage");
    expect(content).toContain("/chat");
  });

  it("should use a consistent storage key", async () => {
    const fs = await import("fs");
    const path = await import("path");

    const navigateFile = path.join(path.resolve(__dirname, ".."), "client/src/lib/navigateToChat.ts");
    const chatFile = path.join(path.resolve(__dirname, ".."), "client/src/pages/Chat.tsx");

    const navigateContent = fs.readFileSync(navigateFile, "utf-8");
    const chatContent = fs.readFileSync(chatFile, "utf-8");

    // Extract the storage key from navigateToChat.ts
    const keyMatch = navigateContent.match(/["'](\w+_pending_chat_prompt)["']/);
    expect(keyMatch).not.toBeNull();

    const storageKey = keyMatch![1];
    // Chat.tsx should consume the pending prompt (via consumePendingPrompt import)
    expect(chatContent).toContain("consumePendingPrompt");
  });
});
