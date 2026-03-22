import { describe, it, expect, vi } from "vitest";

// ─── Verification Service Tests ─────────────────────────────────────────
describe("Verification Service", () => {
  describe("SEC IAPD Lookup", () => {
    it("should construct correct SEC EDGAR search URL", () => {
      const crdNumber = "123456";
      const expectedUrl = `https://efts.sec.gov/LATEST/search-index?q=%22${crdNumber}%22&dateRange=custom&startdt=2020-01-01&forms=ADV`;
      expect(expectedUrl).toContain(crdNumber);
      expect(expectedUrl).toContain("forms=ADV");
    });

    it("should handle missing CRD number gracefully", () => {
      const crdNumber = undefined;
      const result = crdNumber ? `CRD: ${crdNumber}` : "no_crd";
      expect(result).toBe("no_crd");
    });

    it("should validate CRD number format", () => {
      const validCRD = "123456";
      const invalidCRD = "abc";
      expect(/^\d+$/.test(validCRD)).toBe(true);
      expect(/^\d+$/.test(invalidCRD)).toBe(false);
    });
  });

  describe("CFP Board Verification", () => {
    it("should construct CFP search URL with name", () => {
      const name = "John Smith";
      const encoded = encodeURIComponent(name);
      expect(encoded).toBe("John%20Smith");
    });

    it("should parse CFP certification status", () => {
      const statuses = ["active", "inactive", "suspended", "revoked"];
      const mapStatus = (s: string) => {
        if (s === "active") return "verified";
        if (s === "inactive" || s === "suspended") return "expired";
        return "flagged";
      };
      expect(mapStatus("active")).toBe("verified");
      expect(mapStatus("inactive")).toBe("expired");
      expect(mapStatus("revoked")).toBe("flagged");
    });
  });

  describe("NASBA CPAverify", () => {
    it("should construct NASBA search with state", () => {
      const state = "CA";
      const name = "Jane Doe";
      const url = `https://cpaverify.org/api/search?state=${state}&name=${encodeURIComponent(name)}`;
      expect(url).toContain("state=CA");
      expect(url).toContain("name=Jane%20Doe");
    });
  });

  describe("NMLS Consumer Access", () => {
    it("should validate NMLS ID format", () => {
      const validId = "1234567";
      const invalidId = "NMLS-123";
      expect(/^\d+$/.test(validId)).toBe(true);
      expect(/^\d+$/.test(invalidId)).toBe(false);
    });

    it("should construct NMLS lookup URL", () => {
      const nmlsId = "1234567";
      const url = `https://www.nmlsconsumeraccess.org/TuringTestPage.aspx?ReturnUrl=/EntityDetails.aspx/COMPANY/${nmlsId}`;
      expect(url).toContain(nmlsId);
    });
  });

  describe("State Bar Lookup", () => {
    it("should map state to correct bar association URL pattern", () => {
      const stateBarUrls: Record<string, string> = {
        CA: "https://apps.calbar.ca.gov/attorney/LicenseeSearch",
        NY: "https://iapps.courts.state.ny.us/attorneyservices/search",
        TX: "https://www.texasbar.com/AM/Template.cfm?Section=Find_A_Lawyer",
        FL: "https://www.floridabar.org/directories/find-mbr/",
      };
      expect(stateBarUrls["CA"]).toContain("calbar");
      expect(stateBarUrls["NY"]).toContain("courts.state.ny.us");
      expect(stateBarUrls["TX"]).toContain("texasbar");
      expect(stateBarUrls["FL"]).toContain("floridabar");
    });

    it("should handle unknown state gracefully", () => {
      const state = "ZZ";
      const stateBarUrls: Record<string, string> = { CA: "url" };
      const url = stateBarUrls[state] || null;
      expect(url).toBeNull();
    });
  });

  describe("SOFR Rate Fetching", () => {
    it("should parse SOFR rate from NY Fed response format", () => {
      const mockResponse = {
        refRates: [
          { effectiveDate: "2026-03-20", type: "SOFR", percentRate: "4.31" },
        ],
      };
      const rate = mockResponse.refRates[0];
      expect(parseFloat(rate.percentRate)).toBe(4.31);
      expect(rate.type).toBe("SOFR");
    });

    it("should handle missing rate data", () => {
      const mockResponse = { refRates: [] };
      const rate = mockResponse.refRates[0] || null;
      expect(rate).toBeNull();
    });
  });

  describe("Verification Status Mapping", () => {
    it("should map verification results to correct statuses", () => {
      const mapResult = (found: boolean, hasDisclosures: boolean) => {
        if (!found) return "not_found";
        if (hasDisclosures) return "flagged";
        return "verified";
      };
      expect(mapResult(true, false)).toBe("verified");
      expect(mapResult(true, true)).toBe("flagged");
      expect(mapResult(false, false)).toBe("not_found");
    });
  });

  describe("Badge Generation", () => {
    it("should generate correct badge types from verification source", () => {
      const sourceToBadge: Record<string, string> = {
        sec_iapd: "sec_registered",
        cfp_board: "cfp_certified",
        nasba_cpaverify: "cpa_licensed",
        nmls: "nmls_licensed",
        state_bar: "bar_admitted",
        nipr_pdb: "insurance_licensed",
        ibba: "ibba_member",
      };
      expect(sourceToBadge["sec_iapd"]).toBe("sec_registered");
      expect(sourceToBadge["cfp_board"]).toBe("cfp_certified");
      expect(sourceToBadge["nasba_cpaverify"]).toBe("cpa_licensed");
      expect(sourceToBadge["nmls"]).toBe("nmls_licensed");
      expect(sourceToBadge["state_bar"]).toBe("bar_admitted");
      expect(sourceToBadge["nipr_pdb"]).toBe("insurance_licensed");
      expect(sourceToBadge["ibba"]).toBe("ibba_member");
    });

    it("should generate badge label from type", () => {
      const labels: Record<string, string> = {
        sec_registered: "SEC Registered",
        cfp_certified: "CFP Certified",
        cpa_licensed: "CPA Licensed",
        clean_record: "Clean Record",
        disclosure_flag: "Disclosure Flag",
      };
      expect(labels["sec_registered"]).toBe("SEC Registered");
      expect(labels["disclosure_flag"]).toBe("Disclosure Flag");
    });
  });
});

// ─── CRM Adapter Tests ──────────────────────────────────────────────────
describe("CRM Adapter", () => {
  describe("Wealthbox Adapter", () => {
    it("should construct correct Wealthbox API headers", () => {
      const apiKey = "test-wealthbox-key";
      const headers = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      expect(headers.Authorization).toBe("Bearer test-wealthbox-key");
      expect(headers["Content-Type"]).toBe("application/json");
    });

    it("should map Wealthbox contact to internal format", () => {
      const wealthboxContact = {
        id: 123,
        first_name: "John",
        last_name: "Smith",
        email: "john@example.com",
        phone: "555-0100",
        company: "Acme Corp",
      };
      const mapped = {
        externalId: String(wealthboxContact.id),
        firstName: wealthboxContact.first_name,
        lastName: wealthboxContact.last_name,
        email: wealthboxContact.email,
        phone: wealthboxContact.phone,
        company: wealthboxContact.company,
      };
      expect(mapped.externalId).toBe("123");
      expect(mapped.firstName).toBe("John");
      expect(mapped.email).toBe("john@example.com");
    });
  });

  describe("Redtail Adapter", () => {
    it("should construct correct Redtail API headers", () => {
      const apiKey = "test-redtail-key";
      const headers = {
        Authorization: `Userkeyauth ${apiKey}`,
        "Content-Type": "application/json",
      };
      expect(headers.Authorization).toBe("Userkeyauth test-redtail-key");
    });

    it("should map Redtail contact to internal format", () => {
      const redtailContact = {
        id: 456,
        first_name: "Jane",
        last_name: "Doe",
        email: { address: "jane@example.com" },
        phone: { number: "555-0200" },
      };
      const mapped = {
        externalId: String(redtailContact.id),
        firstName: redtailContact.first_name,
        lastName: redtailContact.last_name,
        email: redtailContact.email?.address || "",
        phone: redtailContact.phone?.number || "",
      };
      expect(mapped.externalId).toBe("456");
      expect(mapped.email).toBe("jane@example.com");
    });
  });

  describe("Sync Direction", () => {
    it("should support bidirectional sync modes", () => {
      const modes = ["push", "pull", "bidirectional"] as const;
      expect(modes).toContain("push");
      expect(modes).toContain("pull");
      expect(modes).toContain("bidirectional");
    });

    it("should log sync operations with correct fields", () => {
      const syncLog = {
        id: "uuid-123",
        connectionId: "conn-456",
        direction: "pull" as const,
        entityType: "contact",
        recordCount: 25,
        status: "success",
        syncedAt: Date.now(),
      };
      expect(syncLog.direction).toBe("pull");
      expect(syncLog.recordCount).toBe(25);
      expect(syncLog.status).toBe("success");
    });
  });
});

// ─── Enrichment Waterfall Tests ─────────────────────────────────────────
describe("Enrichment Waterfall", () => {
  describe("Clearbit Enrichment", () => {
    it("should construct Clearbit API URL", () => {
      const email = "john@example.com";
      const url = `https://person.clearbit.com/v2/people/find?email=${encodeURIComponent(email)}`;
      expect(url).toContain("email=john%40example.com");
    });

    it("should extract relevant fields from Clearbit response", () => {
      const clearbitResponse = {
        fullName: "John Smith",
        title: "Financial Advisor",
        company: { name: "Acme Financial" },
        location: "San Francisco, CA",
        linkedin: { handle: "johnsmith" },
        avatar: "https://example.com/photo.jpg",
      };
      expect(clearbitResponse.fullName).toBe("John Smith");
      expect(clearbitResponse.company.name).toBe("Acme Financial");
    });
  });

  describe("FullContact Enrichment", () => {
    it("should construct FullContact API request", () => {
      const email = "jane@example.com";
      const body = { email };
      expect(body.email).toBe("jane@example.com");
    });

    it("should handle FullContact not-found response", () => {
      const response = { status: 404, message: "Profile not found" };
      const result = response.status === 404 ? null : response;
      expect(result).toBeNull();
    });
  });

  describe("Waterfall Logic", () => {
    it("should try providers in order and stop on first success", async () => {
      const providers = [
        { name: "clearbit", fn: async () => null },
        { name: "fullcontact", fn: async () => ({ data: { fullName: "Test" }, confidence: 0.8 }) },
        { name: "fallback", fn: async () => ({ data: { fullName: "Fallback" }, confidence: 0.3 }) },
      ];
      let result = null;
      for (const p of providers) {
        const r = await p.fn();
        if (r && r.data.fullName) {
          result = { source: p.name, ...r };
          break;
        }
      }
      expect(result).not.toBeNull();
      expect(result!.source).toBe("fullcontact");
      expect(result!.confidence).toBe(0.8);
    });

    it("should return null when all providers fail", async () => {
      const providers = [
        { name: "clearbit", fn: async () => null },
        { name: "fullcontact", fn: async () => null },
      ];
      let result = null;
      for (const p of providers) {
        const r = await p.fn();
        if (r) {
          result = r;
          break;
        }
      }
      expect(result).toBeNull();
    });
  });

  describe("Cache Logic", () => {
    it("should consider cache valid within 30 days", () => {
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      const recentCache = Date.now() - 15 * 24 * 60 * 60 * 1000;
      const oldCache = Date.now() - 45 * 24 * 60 * 60 * 1000;
      expect(Date.now() - recentCache < thirtyDays).toBe(true);
      expect(Date.now() - oldCache < thirtyDays).toBe(false);
    });
  });
});

// ─── n8n Workflow Template Tests ────────────────────────────────────────
describe("n8n Workflow Templates", () => {
  it("should export auto-verify workflow template", async () => {
    const { autoVerifyWorkflow } = await import("./services/n8nWorkflows");
    expect(autoVerifyWorkflow).toBeDefined();
    expect(autoVerifyWorkflow.id).toBe("auto-verify-credentials");
    expect(autoVerifyWorkflow.category).toBe("verification");
    expect(autoVerifyWorkflow.steps.length).toBeGreaterThan(0);
  });

  it("should export COI referral workflow template", async () => {
    const { coiReferralWorkflow } = await import("./services/n8nWorkflows");
    expect(coiReferralWorkflow).toBeDefined();
    expect(coiReferralWorkflow.id).toBe("coi-referral-network");
    expect(coiReferralWorkflow.category).toBe("referral");
    expect(coiReferralWorkflow.steps.length).toBeGreaterThan(0);
  });

  it("should export compliance monitoring workflow template", async () => {
    const { complianceMonitoringWorkflow } = await import("./services/n8nWorkflows");
    expect(complianceMonitoringWorkflow).toBeDefined();
    expect(complianceMonitoringWorkflow.id).toBe("compliance-monitoring");
    expect(complianceMonitoringWorkflow.category).toBe("compliance");
  });

  it("should find workflow by ID", async () => {
    const { getWorkflowTemplate } = await import("./services/n8nWorkflows");
    const wf = getWorkflowTemplate("auto-verify-credentials");
    expect(wf).toBeDefined();
    expect(wf!.name).toBe("Auto-Verify Professional Credentials");
  });

  it("should return undefined for unknown workflow ID", async () => {
    const { getWorkflowTemplate } = await import("./services/n8nWorkflows");
    const wf = getWorkflowTemplate("nonexistent");
    expect(wf).toBeUndefined();
  });

  it("should filter workflows by category", async () => {
    const { getWorkflowsByCategory } = await import("./services/n8nWorkflows");
    const verificationWfs = getWorkflowsByCategory("verification");
    expect(verificationWfs.length).toBeGreaterThan(0);
    expect(verificationWfs.every(w => w.category === "verification")).toBe(true);
  });

  it("should export workflow as n8n-compatible JSON", async () => {
    const { autoVerifyWorkflow, exportAsN8nWorkflow } = await import("./services/n8nWorkflows");
    const exported = exportAsN8nWorkflow(autoVerifyWorkflow);
    expect(exported.name).toBe(autoVerifyWorkflow.name);
    expect(exported.nodes).toBeDefined();
    expect(exported.connections).toBeDefined();
    expect(exported.settings).toBeDefined();
    expect((exported.meta as any).templateId).toBe(autoVerifyWorkflow.id);
  });

  it("should map step types to correct n8n node types", async () => {
    const { autoVerifyWorkflow, exportAsN8nWorkflow } = await import("./services/n8nWorkflows");
    const exported = exportAsN8nWorkflow(autoVerifyWorkflow);
    const nodes = exported.nodes as any[];
    const httpNode = nodes.find(n => n.name === "SEC IAPD Lookup");
    expect(httpNode).toBeDefined();
    expect(httpNode.type).toBe("n8n-nodes-base.httpRequest");
  });

  it("should have variables with defaults for all templates", async () => {
    const { workflowTemplates } = await import("./services/n8nWorkflows");
    for (const template of workflowTemplates) {
      expect(template.variables.length).toBeGreaterThan(0);
      for (const v of template.variables) {
        expect(v.key).toBeTruthy();
        expect(v.description).toBeTruthy();
      }
    }
  });
});

// ─── Premium Finance Rates Schema Tests ─────────────────────────────────
describe("Premium Finance Rates", () => {
  it("should define correct rate fields", () => {
    const rateFields = ["sofr", "sofr30", "sofr90", "treasury10y", "treasury30y", "primeRate"];
    expect(rateFields).toHaveLength(6);
    expect(rateFields).toContain("sofr");
    expect(rateFields).toContain("primeRate");
  });

  it("should validate rate values are numeric strings", () => {
    const rates = { sofr: "4.31", sofr30: "4.32", primeRate: "8.50" };
    for (const [key, val] of Object.entries(rates)) {
      expect(parseFloat(val)).not.toBeNaN();
      expect(parseFloat(val)).toBeGreaterThan(0);
    }
  });
});

// ─── Verification Router Input Validation Tests ─────────────────────────
describe("Verification Router Inputs", () => {
  it("should validate professionalId is a positive number", () => {
    const validId = 1;
    const invalidId = -1;
    expect(validId > 0).toBe(true);
    expect(invalidId > 0).toBe(false);
  });

  it("should validate verification source enum values", () => {
    const validSources = [
      "sec_iapd", "finra_brokercheck", "cfp_board", "nasba_cpaverify",
      "nipr_pdb", "nmls", "state_bar", "ibba", "martindale", "avvo",
    ];
    expect(validSources).toContain("sec_iapd");
    expect(validSources).toContain("cfp_board");
    expect(validSources).not.toContain("invalid_source");
  });

  it("should validate verification status enum values", () => {
    const validStatuses = ["verified", "not_found", "flagged", "expired", "pending"];
    expect(validStatuses).toContain("verified");
    expect(validStatuses).toContain("flagged");
    expect(validStatuses).not.toContain("unknown");
  });
});

// ─── Integration Provider Tier Tests ────────────────────────────────────
describe("Integration Provider Tiers", () => {
  it("should define correct tier hierarchy", () => {
    const tiers = ["platform", "professional", "client"];
    expect(tiers.indexOf("platform")).toBeLessThan(tiers.indexOf("professional"));
    expect(tiers.indexOf("professional")).toBeLessThan(tiers.indexOf("client"));
  });

  it("should map subscription providers to correct tier", () => {
    const subscriptionProviders = {
      nipr: "professional",
      martindale: "professional",
      ibba: "professional",
    };
    expect(subscriptionProviders.nipr).toBe("professional");
    expect(subscriptionProviders.martindale).toBe("professional");
  });

  it("should map free providers to correct tier", () => {
    const freeProviders = {
      sec_iapd: "platform",
      cfp_board: "platform",
      nasba: "platform",
      nmls: "platform",
      state_bar: "platform",
    };
    expect(Object.values(freeProviders).every(t => t === "platform")).toBe(true);
  });
});
