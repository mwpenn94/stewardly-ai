/**
 * Pass 77 — Data Depth: Wire remaining hardcoded pages to real tRPC data
 *
 * Covers:
 * 1. LeadDetail wired to leadPipeline.getPipeline (no more DEMO_LEAD)
 * 2. WebhookManager wired to webhooks.list, webhooks.eventLog, webhooks.stats
 * 3. AdvisorProfile wired to professionals.getById
 * 4. AppShell NotificationBell integration
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const CLIENT = path.resolve(__dirname, "../client/src");

describe("Pass 77 — LeadDetail data wiring", () => {
  const filePath = path.join(CLIENT, "pages/LeadDetail.tsx");
  let src: string;

  it("exists", () => {
    expect(fs.existsSync(filePath)).toBe(true);
    src = fs.readFileSync(filePath, "utf8");
  });

  it("imports trpc", () => {
    src = src || fs.readFileSync(filePath, "utf8");
    expect(src).toContain("import { trpc }");
  });

  it("uses leadPipeline.getPipeline query", () => {
    src = src || fs.readFileSync(filePath, "utf8");
    expect(src).toContain("leadPipeline.getPipeline");
  });

  it("no longer has DEMO_LEAD constant", () => {
    src = src || fs.readFileSync(filePath, "utf8");
    expect(src).not.toContain("const DEMO_LEAD");
  });

  it("has loading state", () => {
    src = src || fs.readFileSync(filePath, "utf8");
    expect(src).toContain("isLoading");
    expect(src).toContain("Loader2");
  });

  it("has error state", () => {
    src = src || fs.readFileSync(filePath, "utf8");
    expect(src).toContain("error");
    expect(src).toContain("not found");
  });
});

describe("Pass 77 — WebhookManager data wiring", () => {
  const filePath = path.join(CLIENT, "pages/WebhookManager.tsx");
  let src: string;

  it("exists", () => {
    expect(fs.existsSync(filePath)).toBe(true);
    src = fs.readFileSync(filePath, "utf8");
  });

  it("imports trpc", () => {
    src = src || fs.readFileSync(filePath, "utf8");
    expect(src).toContain("import { trpc }");
  });

  it("uses webhooks.list query", () => {
    src = src || fs.readFileSync(filePath, "utf8");
    expect(src).toContain("webhooks.list");
  });

  it("uses webhooks.eventLog query", () => {
    src = src || fs.readFileSync(filePath, "utf8");
    expect(src).toContain("webhooks.eventLog");
  });

  it("uses webhooks.stats query", () => {
    src = src || fs.readFileSync(filePath, "utf8");
    expect(src).toContain("webhooks.stats");
  });

  it("no longer has hardcoded WEBHOOKS constant", () => {
    src = src || fs.readFileSync(filePath, "utf8");
    expect(src).not.toContain("const WEBHOOKS");
    expect(src).not.toContain("const RECENT_DELIVERIES");
  });

  it("has toggle and delete mutations", () => {
    src = src || fs.readFileSync(filePath, "utf8");
    expect(src).toContain("webhooks.toggle.useMutation");
    expect(src).toContain("webhooks.delete.useMutation");
  });

  it("has loading states", () => {
    src = src || fs.readFileSync(filePath, "utf8");
    expect(src).toContain("loadingHooks");
    expect(src).toContain("loadingLog");
  });
});

describe("Pass 77 — AdvisorProfile data wiring", () => {
  const filePath = path.join(CLIENT, "pages/AdvisorProfile.tsx");
  let src: string;

  it("exists", () => {
    expect(fs.existsSync(filePath)).toBe(true);
    src = fs.readFileSync(filePath, "utf8");
  });

  it("imports trpc", () => {
    src = src || fs.readFileSync(filePath, "utf8");
    expect(src).toContain("import { trpc }");
  });

  it("uses professionals.getById query", () => {
    src = src || fs.readFileSync(filePath, "utf8");
    expect(src).toContain("professionals.getById");
  });

  it("no longer has hardcoded advisor data", () => {
    src = src || fs.readFileSync(filePath, "utf8");
    expect(src).not.toContain("Sarah Johnson, CFP");
    expect(src).not.toContain("(303) 555-0142");
    expect(src).not.toContain("sarah@stewardly.com");
  });

  it("has loading and error states", () => {
    src = src || fs.readFileSync(filePath, "utf8");
    expect(src).toContain("isLoading");
    expect(src).toContain("Advisor Not Found");
  });

  it("computes initials dynamically", () => {
    src = src || fs.readFileSync(filePath, "utf8");
    expect(src).toContain("initials");
    expect(src).toContain("useMemo");
  });
});

describe("Pass 77 — AppShell notification integration", () => {
  const filePath = path.join(CLIENT, "components/AppShell.tsx");
  let src: string;

  it("imports NotificationBell", () => {
    src = fs.readFileSync(filePath, "utf8");
    expect(src).toContain("NotificationBell");
  });

  it("imports useNotifications", () => {
    src = src || fs.readFileSync(filePath, "utf8");
    expect(src).toContain("useNotifications");
  });

  it("renders NotificationBell in mobile header", () => {
    src = src || fs.readFileSync(filePath, "utf8");
    expect(src).toContain("onMarkAsRead={markAsRead}");
  });

  it("renders desktop notification bell", () => {
    src = src || fs.readFileSync(filePath, "utf8");
    expect(src).toContain("hidden lg:flex fixed");
  });

  it("renders ChangelogBell", () => {
    src = src || fs.readFileSync(filePath, "utf8");
    expect(src).toContain("ChangelogBell");
  });
});
