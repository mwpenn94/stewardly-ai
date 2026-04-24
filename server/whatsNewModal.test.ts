/**
 * WhatsNewModal — Unit tests for changelog data integrity and exports.
 *
 * Validates the CHANGELOG data structure, CURRENT_VERSION consistency,
 * CATEGORY_STYLES completeness, and version ordering.
 */
import { describe, it, expect } from "vitest";

// We test the data exports directly — the React component is tested via browser
// Import the data constants from the WhatsNewModal module
// Note: We use dynamic import to handle JSX in the module
describe("WhatsNewModal data exports", () => {
  it("CURRENT_VERSION matches the first changelog entry version", async () => {
    // Read the file directly to check version consistency
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/components/WhatsNewModal.tsx", "utf-8");

    // Extract CURRENT_VERSION
    const versionMatch = content.match(/CURRENT_VERSION\s*=\s*"([^"]+)"/);
    expect(versionMatch).toBeTruthy();
    const currentVersion = versionMatch![1];

    // Extract first changelog version
    const firstVersionMatch = content.match(/version:\s*"([^"]+)"/);
    expect(firstVersionMatch).toBeTruthy();
    const firstVersion = firstVersionMatch![1];

    expect(currentVersion).toBe(firstVersion);
  });

  it("all changelog entries have required fields", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/components/WhatsNewModal.tsx", "utf-8");

    // Check that each version entry has: version, date, headline, entries
    const versions = content.match(/version:\s*"[^"]+"/g);
    const dates = content.match(/date:\s*"[^"]+"/g);
    const headlines = content.match(/headline:\s*"[^"]+"/g);

    expect(versions).toBeTruthy();
    expect(dates).toBeTruthy();
    expect(headlines).toBeTruthy();
    expect(versions!.length).toBe(dates!.length);
    expect(versions!.length).toBe(headlines!.length);
    expect(versions!.length).toBeGreaterThanOrEqual(7);
  });

  it("all entry categories are valid", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/components/WhatsNewModal.tsx", "utf-8");

    // Extract all category values from entries
    const categories = content.match(/category:\s*"([^"]+)"/g);
    expect(categories).toBeTruthy();

    const validCategories = ["feature", "fix", "improvement", "security"];
    for (const cat of categories!) {
      const value = cat.match(/"([^"]+)"/)![1];
      expect(validCategories).toContain(value);
    }
  });

  it("CATEGORY_STYLES covers all 4 categories", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/components/WhatsNewModal.tsx", "utf-8");

    // Check that CATEGORY_STYLES has entries for all 4 categories
    expect(content).toContain('feature:');
    expect(content).toContain('fix:');
    expect(content).toContain('improvement:');
    expect(content).toContain('security:');
  });

  it("popup queue integration uses correct slot ID", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/components/WhatsNewModal.tsx", "utf-8");

    // Verify it uses the "whatsNew" popup slot
    expect(content).toContain('usePopupSlot("whatsNew")');
    expect(content).toContain('registerPopup("whatsNew")');
    expect(content).toContain('dismissPopup("whatsNew")');
  });

  it("localStorage key is defined and used consistently", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/components/WhatsNewModal.tsx", "utf-8");

    // Check storage key
    expect(content).toContain('stewardly_whats_new_last_seen_version');
    expect(content).toContain('safeGetItem(STORAGE_KEY)');
    expect(content).toContain('safeSetItem(STORAGE_KEY, CURRENT_VERSION)');
  });

  it("modal has proper accessibility attributes", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/components/WhatsNewModal.tsx", "utf-8");

    // Check for aria-describedby
    expect(content).toContain('aria-describedby="whats-new-description"');
    expect(content).toContain('id="whats-new-description"');
  });

  it("server-side integration calls correct tRPC procedures", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/components/WhatsNewModal.tsx", "utf-8");

    // Check tRPC procedure calls
    expect(content).toContain('exponentialEngine.getUnreadChangelogCount');
    expect(content).toContain('exponentialEngine.markAllChangelogRead');
  });

  it("versions are in descending chronological order", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/components/WhatsNewModal.tsx", "utf-8");

    const versions = content.match(/version:\s*"([^"]+)"/g)!.map(v => v.match(/"([^"]+)"/)![1]);
    // Each version should be >= the next (descending order)
    for (let i = 0; i < versions.length - 1; i++) {
      // Compare as strings — works for YYYY.MM.DD format
      const a = versions[i].replace(/[a-z]$/, '');
      const b = versions[i + 1].replace(/[a-z]$/, '');
      expect(a >= b).toBe(true);
    }
  });

  it("WhatsNewModal is mounted in App.tsx", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/App.tsx", "utf-8");

    expect(content).toContain('import WhatsNewModal from "./components/WhatsNewModal"');
    expect(content).toContain('<WhatsNewModal />');
  });
});
