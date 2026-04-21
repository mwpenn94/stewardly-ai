import { describe, it, expect, vi } from "vitest";

const GHL_API_KEY = process.env.GHL_API_KEY || "";
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || "";
const GHL_BASE = "https://services.leadconnectorhq.com";

const ghlHeaders = {
  Authorization: `Bearer ${GHL_API_KEY}`,
  Version: "2021-07-28",
  "Content-Type": "application/json",
};

describe("GoHighLevel CRM E2E Integration", () => {
  it("should have valid GHL credentials configured", () => {
    expect(GHL_API_KEY).toBeTruthy();
    expect(GHL_API_KEY).toMatch(/^pit-/);
    expect(GHL_LOCATION_ID).toBeTruthy();
    expect(GHL_LOCATION_ID.length).toBeGreaterThan(5);
  });

  it("should authenticate with GHL API and list contacts", async () => {
    const resp = await fetch(
      `${GHL_BASE}/contacts/?locationId=${GHL_LOCATION_ID}&limit=5`,
      { headers: ghlHeaders }
    );
    expect(resp.ok).toBe(true);
    const data = await resp.json();
    expect(data).toHaveProperty("contacts");
    expect(Array.isArray(data.contacts)).toBe(true);
  });

  it("should create a test contact in GHL", async () => {
    const testContact = {
      firstName: "Stewardly",
      lastName: "TestSync",
      email: `stewardly-test-${Date.now()}@stewardly-e2e.test`,
      phone: "+15551234567",
      locationId: GHL_LOCATION_ID,
      tags: ["stewardly-e2e-test"],
    };

    const resp = await fetch(`${GHL_BASE}/contacts/`, {
      method: "POST",
      headers: ghlHeaders,
      body: JSON.stringify(testContact),
    });
    expect(resp.ok).toBe(true);
    const data = await resp.json();
    expect(data).toHaveProperty("contact");
    expect(data.contact).toHaveProperty("id");
    expect(data.contact.firstName).toBe("Stewardly");
    expect(data.contact.lastName).toBe("TestSync");

    // Store contact ID for cleanup
    const contactId = data.contact.id;

    // Verify the contact can be retrieved
    const getResp = await fetch(
      `${GHL_BASE}/contacts/${contactId}`,
      { headers: ghlHeaders }
    );
    expect(getResp.ok).toBe(true);
    const getContact = await getResp.json();
    expect(getContact.contact.id).toBe(contactId);

    // Clean up: delete the test contact
    const delResp = await fetch(
      `${GHL_BASE}/contacts/${contactId}`,
      { method: "DELETE", headers: ghlHeaders }
    );
    expect(delResp.ok).toBe(true);
  });

  it("should list GHL pipelines (opportunities)", async () => {
    const resp = await fetch(
      `${GHL_BASE}/opportunities/pipelines?locationId=${GHL_LOCATION_ID}`,
      { headers: ghlHeaders }
    );
    expect(resp.ok).toBe(true);
    const data = await resp.json();
    expect(data).toHaveProperty("pipelines");
    expect(Array.isArray(data.pipelines)).toBe(true);
  });

  it("should list GHL calendars", async () => {
    const resp = await fetch(
      `${GHL_BASE}/calendars/?locationId=${GHL_LOCATION_ID}`,
      { headers: ghlHeaders }
    );
    expect(resp.ok).toBe(true);
    const data = await resp.json();
    expect(data).toHaveProperty("calendars");
    expect(Array.isArray(data.calendars)).toBe(true);
  });

  it("should list GHL custom fields", async () => {
    const resp = await fetch(
      `${GHL_BASE}/locations/${GHL_LOCATION_ID}/customFields`,
      { headers: ghlHeaders }
    );
    expect(resp.ok).toBe(true);
    const data = await resp.json();
    expect(data).toHaveProperty("customFields");
    expect(Array.isArray(data.customFields)).toBe(true);
  });

  it("should search contacts by tag", async () => {
    const resp = await fetch(
      `${GHL_BASE}/contacts/?locationId=${GHL_LOCATION_ID}&limit=5&query=stewardly`,
      { headers: ghlHeaders }
    );
    expect(resp.ok).toBe(true);
    const data = await resp.json();
    expect(data).toHaveProperty("contacts");
  });

  it("should verify the integrationFailover module loads", async () => {
    const failover = await import("./services/integrationFailover");
    expect(failover).toBeDefined();
    expect(typeof failover.getGHLContactsWithFailover).toBe("function");
    expect(typeof failover.getGHLPipelinesWithFailover).toBe("function");
  });
});
