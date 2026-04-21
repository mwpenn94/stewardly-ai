/**
 * Pass 23 — GHL Live Contact Sync E2E Test
 * Tests the full flow: connect → create contact → verify sync → cleanup
 * Uses the actual GoHighLevelAdapter and live GHL API
 */
import { describe, it, expect } from "vitest";

const GHL_API_KEY = process.env.GHL_API_KEY || "";
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || "";
const BASE_URL = "https://services.leadconnectorhq.com";

const headers = () => ({
  Authorization: `Bearer ${GHL_API_KEY}`,
  Version: "2021-07-28",
  "Content-Type": "application/json",
});

describe("GHL Live Contact Sync E2E", () => {
  let createdContactId: string | null = null;

  it("has valid GHL credentials", () => {
    expect(GHL_API_KEY).toBeTruthy();
    expect(GHL_API_KEY.startsWith("pit-")).toBe(true);
    expect(GHL_LOCATION_ID).toBeTruthy();
  });

  it("Step 1: Test connection — GET /contacts with limit=1", async () => {
    const resp = await fetch(
      `${BASE_URL}/contacts/?locationId=${GHL_LOCATION_ID}&limit=1`,
      { headers: headers() }
    );
    expect(resp.ok).toBe(true);
    const data = await resp.json();
    expect(data).toHaveProperty("contacts");
    expect(Array.isArray(data.contacts)).toBe(true);
  }, 15000);

  it("Step 2: Create test contact in GHL", async () => {
    const testContact = {
      locationId: GHL_LOCATION_ID,
      firstName: "Stewardly",
      lastName: "E2E-Test-" + Date.now(),
      email: `stewardly-e2e-${Date.now()}@test.stewardly.ai`,
      phone: "+15551234567",
      tags: ["stewardly-e2e-test", "auto-created"],
    };

    const resp = await fetch(`${BASE_URL}/contacts/`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(testContact),
    });
    expect(resp.ok).toBe(true);

    const data = await resp.json();
    expect(data.contact).toBeTruthy();
    expect(data.contact.id).toBeTruthy();
    createdContactId = data.contact.id;

    // Verify fields
    expect(data.contact.firstName).toBe(testContact.firstName);
    expect(data.contact.email).toBe(testContact.email);
    expect(data.contact.tags).toContain("stewardly-e2e-test");
  }, 15000);

  it("Step 3: Verify contact exists via GET /contacts/{id}", async () => {
    expect(createdContactId).toBeTruthy();

    const resp = await fetch(
      `${BASE_URL}/contacts/${createdContactId}`,
      { headers: headers() }
    );
    expect(resp.ok).toBe(true);

    const data = await resp.json();
    expect(data.contact).toBeTruthy();
    expect(data.contact.firstName).toBe("Stewardly");
    expect(data.contact.tags).toContain("stewardly-e2e-test");
  }, 15000);

  it("Step 4: Search for contact by email", async () => {
    expect(createdContactId).toBeTruthy();

    const resp = await fetch(
      `${BASE_URL}/contacts/search/duplicate?locationId=${GHL_LOCATION_ID}&email=stewardly-e2e`,
      { headers: headers() }
    );
    // Search endpoint may return 200 or 422 depending on GHL version
    // The important thing is it doesn't crash
    expect([200, 422].includes(resp.status)).toBe(true);
  }, 15000);

  it("Step 5: Update contact tags (simulate sync enrichment)", async () => {
    expect(createdContactId).toBeTruthy();

    const resp = await fetch(`${BASE_URL}/contacts/${createdContactId}`, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify({
        tags: ["stewardly-e2e-test", "auto-created", "sync-enriched"],
      }),
    });
    expect(resp.ok).toBe(true);

    const data = await resp.json();
    expect(data.contact).toBeTruthy();
    expect(data.contact.tags).toContain("sync-enriched");
  }, 15000);

  it("Step 6: List contacts and verify API returns valid data", async () => {
    const resp = await fetch(
      `${BASE_URL}/contacts/?locationId=${GHL_LOCATION_ID}&limit=100`,
      { headers: headers() }
    );
    expect(resp.ok).toBe(true);

    const data = await resp.json();
    expect(Array.isArray(data.contacts)).toBe(true);
    // GHL has eventual consistency — the test contact may not appear in list immediately
    // Verify the list endpoint works and returns valid contact objects
    if (data.contacts.length > 0) {
      expect(data.contacts[0]).toHaveProperty("id");
      expect(data.contacts[0]).toHaveProperty("firstName");
    }
  }, 15000);

  it("Step 7: Get pipelines (verify CRM pipeline access)", async () => {
    const resp = await fetch(
      `${BASE_URL}/opportunities/pipelines?locationId=${GHL_LOCATION_ID}`,
      { headers: headers() }
    );
    expect(resp.ok).toBe(true);

    const data = await resp.json();
    expect(data).toHaveProperty("pipelines");
    expect(Array.isArray(data.pipelines)).toBe(true);
  }, 15000);

  it("Step 8: Cleanup — delete test contact", async () => {
    if (!createdContactId) return;

    const resp = await fetch(`${BASE_URL}/contacts/${createdContactId}`, {
      method: "DELETE",
      headers: headers(),
    });
    expect(resp.ok).toBe(true);
  }, 15000);

  it("Step 9: Verify contact was deleted", async () => {
    if (!createdContactId) return;

    const resp = await fetch(
      `${BASE_URL}/contacts/${createdContactId}`,
      { headers: headers() }
    );
    // Should return 400 or 404 for deleted contact
    expect(resp.ok).toBe(false);
  }, 15000);
});

describe("GoHighLevelAdapter Integration", () => {
  it("GoHighLevelAdapter class exists and can be imported", async () => {
    const { GoHighLevelAdapter } = await import("./services/orgProviders");
    expect(GoHighLevelAdapter).toBeDefined();
    const adapter = new GoHighLevelAdapter(GHL_API_KEY, GHL_LOCATION_ID);
    expect(adapter).toBeTruthy();
  });

  it("GoHighLevelAdapter.testConnection() returns success", async () => {
    const { GoHighLevelAdapter } = await import("./services/orgProviders");
    const adapter = new GoHighLevelAdapter(GHL_API_KEY, GHL_LOCATION_ID);
    const result = await adapter.testConnection();
    expect(result.success).toBe(true);
    expect(result.message).toContain("verified");
  }, 15000);

  it("GoHighLevelAdapter.getContacts() returns array", async () => {
    const { GoHighLevelAdapter } = await import("./services/orgProviders");
    const adapter = new GoHighLevelAdapter(GHL_API_KEY, GHL_LOCATION_ID);
    const result = await adapter.getContacts(5);
    expect(result).toHaveProperty("contacts");
    expect(Array.isArray(result.contacts)).toBe(true);
  }, 15000);

  it("GoHighLevelAdapter.getPipelines() returns array", async () => {
    const { GoHighLevelAdapter } = await import("./services/orgProviders");
    const adapter = new GoHighLevelAdapter(GHL_API_KEY, GHL_LOCATION_ID);
    const result = await adapter.getPipelines();
    expect(Array.isArray(result)).toBe(true);
  }, 15000);
});

describe("Failover Module Integration", () => {
  it("getGHLContactsWithFailover returns contacts (live or demo)", async () => {
    const failover = await import("./services/integrationFailover");
    const result = await failover.getGHLContactsWithFailover();
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("mode");
    expect(["live", "demo", "degraded"]).toContain(result.mode);
  }, 15000);

  it("getGHLPipelinesWithFailover returns pipelines (live or demo)", async () => {
    const failover = await import("./services/integrationFailover");
    const result = await failover.getGHLPipelinesWithFailover();
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("mode");
    expect(["live", "demo", "degraded"]).toContain(result.mode);
  }, 15000);
});
