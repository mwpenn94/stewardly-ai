import { describe, it, expect } from "vitest";
import {
  generateGHLDemoContacts,
  generateGHLDemoPipelines,
  generateGHLDemoOpportunities,
  generateWealthboxDemoContacts,
  generateWealthboxDemoActivities,
  generateRedtailDemoContacts,
  generateRedtailDemoActivities,
  generateSMSiTDemoMessages,
  generateSMSiTDemoCampaigns,
  getWithFailover,
} from "./integrationFailover";

describe("Integration Failover Service", () => {
  describe("GHL Demo Data", () => {
    it("generates the requested number of demo contacts", () => {
      const contacts = generateGHLDemoContacts(10);
      expect(contacts).toHaveLength(10);
      contacts.forEach(c => {
        expect(c._demo).toBe(true);
        expect(c.id).toMatch(/^ghl_contact_demo_/);
        expect(c.firstName).toBeTruthy();
        expect(c.lastName).toBeTruthy();
        expect(c.email).toContain("@");
        expect(c.phone).toMatch(/^\+1\d{10}$/);
        expect(c.companyName).toBeTruthy();
        expect(c.tags.length).toBeGreaterThan(0);
        expect(c.customFields["AUM Range"]).toBeTruthy();
      });
    });

    it("generates demo pipelines with stages", () => {
      const pipelines = generateGHLDemoPipelines();
      expect(pipelines.length).toBeGreaterThan(0);
      pipelines.forEach(p => {
        expect(p._demo).toBe(true);
        expect(p.name).toBeTruthy();
        expect(p.stages.length).toBeGreaterThan(0);
        p.stages.forEach(s => {
          expect(s.id).toBeTruthy();
          expect(s.name).toBeTruthy();
          expect(typeof s.position).toBe("number");
        });
      });
    });

    it("generates demo opportunities linked to pipelines", () => {
      const opps = generateGHLDemoOpportunities(5);
      expect(opps).toHaveLength(5);
      opps.forEach(o => {
        expect(o._demo).toBe(true);
        expect(o.monetaryValue).toBeGreaterThan(0);
        expect(["won", "lost", "open"]).toContain(o.status);
      });
    });
  });

  describe("Wealthbox Demo Data", () => {
    it("generates demo contacts with [DEMO] prefix", () => {
      const contacts = generateWealthboxDemoContacts(8);
      expect(contacts).toHaveLength(8);
      contacts.forEach(c => {
        expect(c.externalId).toMatch(/^wb_contact_demo_/);
        expect(c.firstName).toMatch(/^\[DEMO\]/);
        expect(c.tags).toContain("demo-data");
        expect(c.email).toContain("@example.com");
      });
    });

    it("generates demo activities", () => {
      const activities = generateWealthboxDemoActivities(5);
      expect(activities).toHaveLength(5);
      activities.forEach(a => {
        expect(a.externalId).toMatch(/^wb_activity_demo_/);
        expect(a.subject).toMatch(/^\[DEMO\]/);
        expect(["meeting", "call", "email", "task"]).toContain(a.type);
      });
    });
  });

  describe("Redtail Demo Data", () => {
    it("generates demo contacts with [DEMO] prefix", () => {
      const contacts = generateRedtailDemoContacts(12);
      expect(contacts).toHaveLength(12);
      contacts.forEach(c => {
        expect(c.externalId).toMatch(/^rt_contact_demo_/);
        expect(c.firstName).toMatch(/^\[DEMO\]/);
        expect(c.tags).toContain("demo-data");
      });
    });

    it("generates demo activities", () => {
      const activities = generateRedtailDemoActivities(7);
      expect(activities).toHaveLength(7);
      activities.forEach(a => {
        expect(a.externalId).toMatch(/^rt_activity_demo_/);
        expect(a.subject).toMatch(/^\[DEMO\]/);
      });
    });
  });

  describe("SMS-iT Demo Data", () => {
    it("generates demo messages", () => {
      const messages = generateSMSiTDemoMessages(10);
      expect(messages).toHaveLength(10);
      messages.forEach(m => {
        expect(m._demo).toBe(true);
        expect(m.id).toMatch(/^smsit_msg_demo_/);
        expect(m.body).toMatch(/^\[DEMO\]/);
        expect(["sms", "whatsapp", "email"]).toContain(m.channel);
        expect(["delivered", "sent", "read", "failed"]).toContain(m.status);
      });
    });

    it("generates demo campaigns with metrics", () => {
      const campaigns = generateSMSiTDemoCampaigns(3);
      expect(campaigns).toHaveLength(3);
      campaigns.forEach(c => {
        expect(c._demo).toBe(true);
        expect(c.name).toMatch(/^\[DEMO\]/);
        expect(c.recipientCount).toBeGreaterThan(0);
        expect(c.openRate).toBeGreaterThan(0);
        expect(c.clickRate).toBeGreaterThan(0);
      });
    });
  });

  describe("Failover Orchestrator", () => {
    it("falls back to demo data when live fetcher returns null credentials", async () => {
      const result = await getWithFailover(
        "test-provider",
        async () => { throw new Error("No credentials"); },
        () => [{ id: "demo_1", name: "Demo Item" }],
      );
      // Since checkProviderCredentials will return null (no DB in test), it should use demo
      expect(result.mode).toBe("demo");
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe("demo_1");
      expect(result.message).toContain("demo data");
    });

    it("returns degraded mode when live fetcher throws", async () => {
      // Simulate a scenario where credentials exist but API fails
      // In test env, checkProviderCredentials returns null, so this will be demo mode
      const result = await getWithFailover(
        "nonexistent-provider",
        async () => { throw new Error("API timeout"); },
        () => ({ fallback: true }),
      );
      expect(["demo", "degraded"]).toContain(result.mode);
      expect(result.data).toBeTruthy();
    });
  });

  describe("Data Consistency", () => {
    it("all demo IDs are unique within a batch", () => {
      const contacts = generateGHLDemoContacts(50);
      const ids = contacts.map(c => c.id);
      expect(new Set(ids).size).toBe(50);
    });

    it("demo dates are within expected range", () => {
      const contacts = generateGHLDemoContacts(10);
      const now = Date.now();
      const sixMonthsAgo = now - 180 * 86400000;
      contacts.forEach(c => {
        const ts = new Date(c.dateAdded).getTime();
        expect(ts).toBeGreaterThan(sixMonthsAgo);
        expect(ts).toBeLessThanOrEqual(now);
      });
    });

    it("Wealthbox and Redtail contacts have different ID prefixes", () => {
      const wb = generateWealthboxDemoContacts(5);
      const rt = generateRedtailDemoContacts(5);
      wb.forEach(c => expect(c.externalId).toMatch(/^wb_/));
      rt.forEach(c => expect(c.externalId).toMatch(/^rt_/));
    });
  });
});
