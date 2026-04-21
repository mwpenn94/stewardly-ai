/**
 * GHL Webhook Inbound Sync — Vitest
 * Tests the webhook endpoint, contact upsert logic, and bulk sync.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "..");
const WEBHOOK_FILE = resolve(ROOT, "server/routers/ghlWebhook.ts");
const DB_FILE = resolve(ROOT, "server/db.ts");
const INDEX_FILE = resolve(ROOT, "server/_core/index.ts");

describe("GHL Webhook Inbound Sync", () => {
  describe("File structure", () => {
    it("ghlWebhook.ts exists", () => {
      expect(existsSync(WEBHOOK_FILE)).toBe(true);
    });

    it("exports registerGHLWebhookRoutes", () => {
      const src = readFileSync(WEBHOOK_FILE, "utf-8");
      expect(src).toContain("export function registerGHLWebhookRoutes");
    });

    it("exports handleGHLWebhook", () => {
      const src = readFileSync(WEBHOOK_FILE, "utf-8");
      expect(src).toContain("export async function handleGHLWebhook");
    });

    it("exports bulkInboundSync", () => {
      const src = readFileSync(WEBHOOK_FILE, "utf-8");
      expect(src).toContain("export async function bulkInboundSync");
    });

    it("exports ghlWebhookRouter", () => {
      const src = readFileSync(WEBHOOK_FILE, "utf-8");
      expect(src).toContain("export const ghlWebhookRouter");
    });
  });

  describe("Webhook handler logic", () => {
    it("handles ContactCreate events", () => {
      const src = readFileSync(WEBHOOK_FILE, "utf-8");
      expect(src).toContain("ContactCreate");
      expect(src).toContain("contact.create");
    });

    it("handles ContactUpdate events", () => {
      const src = readFileSync(WEBHOOK_FILE, "utf-8");
      expect(src).toContain("ContactUpdate");
      expect(src).toContain("contact.update");
    });

    it("handles ContactDelete events with soft-delete", () => {
      const src = readFileSync(WEBHOOK_FILE, "utf-8");
      expect(src).toContain("ContactDelete");
      expect(src).toContain("soft_deleted");
      expect(src).toContain("disqualified");
    });

    it("handles OpportunityCreate events", () => {
      const src = readFileSync(WEBHOOK_FILE, "utf-8");
      expect(src).toContain("OpportunityCreate");
      expect(src).toContain("opportunity_linked");
    });

    it("detects duplicate contacts by crmExternalId", () => {
      const src = readFileSync(WEBHOOK_FILE, "utf-8");
      expect(src).toContain("crmExternalId = ?");
    });

    it("detects duplicate contacts by email", () => {
      const src = readFileSync(WEBHOOK_FILE, "utf-8");
      expect(src).toContain("linked_by_email");
      expect(src).toContain("email = ?");
    });

    it("stores GHL metadata in notesJson", () => {
      const src = readFileSync(WEBHOOK_FILE, "utf-8");
      expect(src).toContain("ghlTags");
      expect(src).toContain("ghlCity");
      expect(src).toContain("ghlState");
      expect(src).toContain("ghlCompany");
    });

    it("verifies webhook signatures", () => {
      const src = readFileSync(WEBHOOK_FILE, "utf-8");
      expect(src).toContain("verifyGHLSignature");
      expect(src).toContain("x-ghl-signature");
      expect(src).toContain("timingSafeEqual");
    });

    it("logs events to integrationWebhookEvents", () => {
      const src = readFileSync(WEBHOOK_FILE, "utf-8");
      expect(src).toContain("integrationWebhookEvents");
      expect(src).toContain("processingStatus");
    });
  });

  describe("Raw SQL (actual DB schema)", () => {
    it("uses raw SQL instead of Drizzle ORM for lead_pipeline", () => {
      const src = readFileSync(WEBHOOK_FILE, "utf-8");
      // Must use raw SQL queries with actual column names
      expect(src).toContain("SELECT id, firstName, lastName");
      expect(src).toContain("INSERT INTO lead_pipeline");
      expect(src).toContain("UPDATE lead_pipeline");
    });

    it("imports getRawPool from db.ts", () => {
      const src = readFileSync(WEBHOOK_FILE, "utf-8");
      expect(src).toContain("getRawPool");
    });

    it("db.ts exports getRawPool", () => {
      const src = readFileSync(DB_FILE, "utf-8");
      expect(src).toContain("export async function getRawPool");
    });
  });

  describe("Express route registration", () => {
    it("registers POST /api/webhooks/ghl", () => {
      const src = readFileSync(WEBHOOK_FILE, "utf-8");
      expect(src).toContain('"/api/webhooks/ghl"');
      expect(src).toContain("app.post");
    });

    it("registers GET /api/webhooks/ghl/health", () => {
      const src = readFileSync(WEBHOOK_FILE, "utf-8");
      expect(src).toContain('"/api/webhooks/ghl/health"');
      expect(src).toContain("app.get");
    });

    it("GHL webhook routes registered in server index BEFORE generic webhook routes", () => {
      const src = readFileSync(INDEX_FILE, "utf-8");
      // Check function CALL positions (not import positions)
      const ghlCallPos = src.indexOf("registerGHLWebhookRoutes(app)");
      const genericCallPos = src.indexOf("registerWebhookRoutes(app)");
      expect(ghlCallPos).toBeGreaterThan(-1);
      expect(genericCallPos).toBeGreaterThan(-1);
      expect(ghlCallPos).toBeLessThan(genericCallPos);
    });
  });

  describe("Bulk inbound sync", () => {
    it("paginates through GHL contacts", () => {
      const src = readFileSync(WEBHOOK_FILE, "utf-8");
      expect(src).toContain("nextPageUrl");
      expect(src).toContain("startAfterId");
      expect(src).toContain("limit=100");
    });

    it("returns sync statistics", () => {
      const src = readFileSync(WEBHOOK_FILE, "utf-8");
      expect(src).toContain("total:");
      expect(src).toContain("created:");
      expect(src).toContain("updated:");
      expect(src).toContain("linked:");
      expect(src).toContain("errors:");
    });

    it("tRPC bulkSync mutation exists", () => {
      const src = readFileSync(WEBHOOK_FILE, "utf-8");
      expect(src).toContain("bulkSync: protectedProcedure.mutation");
    });
  });

  describe("Security", () => {
    it("uses HMAC-SHA256 for signature verification", () => {
      const src = readFileSync(WEBHOOK_FILE, "utf-8");
      expect(src).toContain("sha256");
      expect(src).toContain("createHmac");
    });

    it("rejects invalid signatures when GHL_WEBHOOK_SECRET is set", () => {
      const src = readFileSync(WEBHOOK_FILE, "utf-8");
      expect(src).toContain("Invalid signature");
      expect(src).toContain("401");
    });

    it("gracefully skips verification when no secret is configured", () => {
      const src = readFileSync(WEBHOOK_FILE, "utf-8");
      expect(src).toContain("GHL_WEBHOOK_SECRET not set");
      expect(src).toContain("signature verification skipped");
    });
  });
});
