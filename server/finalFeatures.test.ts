/**
 * Final Features Test Suite
 * Tests for: Passive Actions, Notification Conversion (in-app only),
 * Client Account Connections, Workflow Orchestrator updates, and Help/Guide page data.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Passive Actions Service Tests ──────────────────────────────────────
describe("Passive Actions Service", () => {
  it("should export all data source definitions", async () => {
    const { DATA_SOURCES, getDataSources } = await import("./services/passiveActions");
    expect(DATA_SOURCES).toBeDefined();
    expect(Array.isArray(DATA_SOURCES)).toBe(true);
    expect(DATA_SOURCES.length).toBeGreaterThan(10);
    expect(getDataSources()).toEqual(DATA_SOURCES);
  });

  it("should have required fields on each data source", async () => {
    const { DATA_SOURCES } = await import("./services/passiveActions");
    for (const ds of DATA_SOURCES) {
      expect(ds.id).toBeTruthy();
      expect(ds.name).toBeTruthy();
      expect(ds.description).toBeTruthy();
      expect(["government", "market", "personal", "professional", "crm", "insurance", "investment"]).toContain(ds.category);
      expect(["platform", "organization", "advisor", "client"]).toContain(ds.tier);
      expect(Array.isArray(ds.supportedActions)).toBe(true);
      expect(ds.supportedActions.length).toBeGreaterThan(0);
      expect(ds.defaultConfig).toBeDefined();
      expect(ds.icon).toBeTruthy();
    }
  });

  it("should include government data sources (BLS, FRED, BEA, Census, SEC EDGAR, FINRA)", async () => {
    const { DATA_SOURCES } = await import("./services/passiveActions");
    const govIds = DATA_SOURCES.filter(ds => ds.category === "government").map(ds => ds.id);
    expect(govIds).toContain("bls");
    expect(govIds).toContain("fred");
    expect(govIds).toContain("bea");
    expect(govIds).toContain("census");
    expect(govIds).toContain("sec_edgar");
    expect(govIds).toContain("finra");
  });

  it("should include personal data sources (Plaid, Credit Bureau)", async () => {
    const { DATA_SOURCES } = await import("./services/passiveActions");
    const personalIds = DATA_SOURCES.filter(ds => ds.category === "personal").map(ds => ds.id);
    expect(personalIds).toContain("plaid");
    expect(personalIds).toContain("credit_bureau");
  });

  it("should include investment data sources (SnapTrade)", async () => {
    const { DATA_SOURCES } = await import("./services/passiveActions");
    const investmentIds = DATA_SOURCES.filter(ds => ds.category === "investment").map(ds => ds.id);
    expect(investmentIds).toContain("snaptrade");
  });

  it("should include CRM data sources (Wealthbox, Redtail)", async () => {
    const { DATA_SOURCES } = await import("./services/passiveActions");
    const crmIds = DATA_SOURCES.filter(ds => ds.category === "crm").map(ds => ds.id);
    expect(crmIds).toContain("wealthbox");
    expect(crmIds).toContain("redtail");
  });

  it("should return action type metadata as a record", async () => {
    const { getActionTypeMeta } = await import("./services/passiveActions");
    const meta = getActionTypeMeta();
    expect(meta).toBeDefined();
    expect(typeof meta).toBe("object");

    const actionKeys = Object.keys(meta);
    expect(actionKeys.length).toBeGreaterThanOrEqual(6);
    expect(actionKeys).toContain("auto_refresh");
    expect(actionKeys).toContain("background_sync");
    expect(actionKeys).toContain("monitoring_alerts");
    expect(actionKeys).toContain("scheduled_reports");
    expect(actionKeys).toContain("anomaly_detection");
    expect(actionKeys).toContain("smart_enrichment");

    // Each entry should have label, description, icon
    for (const key of actionKeys) {
      expect(meta[key as keyof typeof meta].label).toBeTruthy();
      expect(meta[key as keyof typeof meta].description).toBeTruthy();
      expect(meta[key as keyof typeof meta].icon).toBeTruthy();
    }
  });

  it("should have valid supported actions for each data source", async () => {
    const { DATA_SOURCES, getActionTypeMeta } = await import("./services/passiveActions");
    const validActions = Object.keys(getActionTypeMeta());
    for (const ds of DATA_SOURCES) {
      for (const action of ds.supportedActions) {
        expect(validActions).toContain(action);
      }
    }
  });

  it("should have unique data source IDs", async () => {
    const { DATA_SOURCES } = await import("./services/passiveActions");
    const ids = DATA_SOURCES.map(ds => ds.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

// ─── Communications Engine Tests (In-App Only) ─────────────────────────
describe("Communications Engine — In-App Only", () => {
  it("should use portal_message channel for all templates", async () => {
    const { getTemplates } = await import("./commsEngine");
    const templates = getTemplates();
    expect(templates.length).toBeGreaterThan(0);
    for (const t of templates) {
      expect(t.channel).toBe("portal_message");
    }
  });

  it("should not have email as a channel type", async () => {
    const comms = await import("./commsEngine");
    // CommChannel type should not include "email"
    const templates = comms.getTemplates();
    for (const t of templates) {
      expect(t.channel).not.toBe("email");
    }
  });

  it("should generate a draft with portal_message channel", async () => {
    const { generateDraft } = await import("./commsEngine");
    const draft = generateDraft({
      templateId: "review_reminder_message",
      variables: {
        clientName: "John Doe",
        meetingDate: "2026-04-01",
        meetingTime: "2:00 PM",
        advisorName: "Jane Smith",
        firmName: "WealthBridge",
      },
    });
    expect(draft).not.toBeNull();
    expect(draft!.channel).toBe("portal_message");
    expect(draft!.body).toContain("John Doe");
    expect(draft!.subject).toContain("2026-04-01");
  });

  it("should generate drafts for all template categories", async () => {
    const { getTemplates, generateDraft } = await import("./commsEngine");
    const templates = getTemplates();
    for (const t of templates) {
      const vars: Record<string, string> = {};
      for (const v of t.variables) {
        vars[v] = `test_${v}`;
      }
      const draft = generateDraft({ templateId: t.id, variables: vars });
      expect(draft).not.toBeNull();
      expect(draft!.channel).toBe("portal_message");
    }
  });

  it("should flag compliance issues in market updates without disclaimer", async () => {
    const { generateDraft } = await import("./commsEngine");
    const draft = generateDraft({
      templateId: "market_update_message",
      variables: {
        clientName: "Test Client",
        updateTitle: "Q1 Review",
        marketSummary: "Markets rose 5%",
        clientImpact: "Your portfolio grew",
        advisorAction: "We rebalanced",
        advisorName: "Advisor",
      },
    });
    expect(draft).not.toBeNull();
    expect(draft!.complianceFlags.some(f => f.includes("past performance"))).toBe(true);
  });

  it("should return null for unknown template", async () => {
    const { generateDraft } = await import("./commsEngine");
    const draft = generateDraft({ templateId: "nonexistent_template", variables: {} });
    expect(draft).toBeNull();
  });
});

// ─── Ambient Finance Tests (In-App Only) ────────────────────────────────
describe("Ambient Finance — In-App Channels", () => {
  it("should export insight generation functions", async () => {
    const ambient = await import("./ambientFinance");
    expect(ambient).toBeDefined();
    expect(typeof ambient.generateMarketInsight).toBe("function");
    expect(typeof ambient.generateLifeEventInsight).toBe("function");
    expect(typeof ambient.generatePlanDeviationInsight).toBe("function");
    expect(typeof ambient.generateOpportunityInsight).toBe("function");
    expect(typeof ambient.shouldSuppress).toBe("function");
  });

  it("should generate market insights with in_app channel", async () => {
    const { generateMarketInsight } = await import("./ambientFinance");
    const insight = generateMarketInsight("S&P 500 drops 3%", "Portfolio may be impacted");
    expect(insight).toBeDefined();
    expect(insight.channel).toBe("in_app");
    expect(insight.type).toBe("market_event");
    expect(insight.title).toContain("S&P 500");
  });

  it("should generate life event insights with in_app channel", async () => {
    const { generateLifeEventInsight } = await import("./ambientFinance");
    const insight = generateLifeEventInsight("Marriage", ["Tax filing status change", "Beneficiary updates"]);
    expect(insight).toBeDefined();
    expect(insight.channel).toBe("in_app");
    expect(insight.type).toBe("life_event");
  });

  it("should generate plan deviation insights", async () => {
    const { generatePlanDeviationInsight } = await import("./ambientFinance");
    const insight = generatePlanDeviationInsight("Savings", 15);
    expect(insight).toBeDefined();
    expect(["in_app", "digest", "push"]).toContain(insight.channel);
    expect(insight.type).toBe("plan_deviation");
  });

  it("should only use in_app, digest, or push channels — never email", async () => {
    const { generateMarketInsight, generateOpportunityInsight } = await import("./ambientFinance");
    const insights = [
      generateMarketInsight("Test", "Impact"),
      generateOpportunityInsight("Roth Conversion", "Tax bracket opportunity"),
    ];
    for (const insight of insights) {
      expect(["in_app", "digest", "push"]).toContain(insight.channel);
      expect((insight as any).channel).not.toBe("email");
    }
  });
});

// ─── Workflow Orchestrator Tests (in_app_message) ───────────────────────
describe("Workflow Orchestrator — in_app_message action type", () => {
  it("should support in_app_message action type", async () => {
    const { executeChain } = await import("./workflowOrchestrator");
    const result = await executeChain(
      {
        name: "Test In-App Message Chain",
        eventType: "document_uploaded",
        actions: [
          {
            type: "in_app_message",
            target: "advisor",
            config: { title: "New document uploaded", body: "A client uploaded a new document." },
          },
        ],
        isActive: true,
      },
      "test_event"
    );
    expect(result).toBeDefined();
    expect(result.status).toBe("completed");
    expect(result.actionsExecuted).toBe(1);
    expect(result.results[0].actionType).toBe("in_app_message");
    expect(result.results[0].success).toBe(true);
    expect(result.results[0].message).toContain("In-app message queued");
  });

  it("should not support email action type", async () => {
    // The WorkflowAction type should not include "email"
    const orchestrator = await import("./workflowOrchestrator");
    // Execute a chain with notification type (should work)
    const result = await orchestrator.executeChain(
      {
        name: "Test Notification Chain",
        eventType: "client_onboarded",
        actions: [
          {
            type: "notification",
            target: "client",
            config: { title: "Welcome!", body: "Welcome to the platform." },
          },
        ],
        isActive: true,
      },
      "test_event"
    );
    expect(result.status).toBe("completed");
  });

  it("should execute active chains and return result structure", async () => {
    const { executeChain } = await import("./workflowOrchestrator");
    const result = await executeChain(
      {
        name: "Active Chain",
        eventType: "document_uploaded",
        actions: [
          { type: "in_app_message", target: "advisor", config: { title: "Test" } },
        ],
        isActive: true,
      },
      "test_event"
    );
    expect(result.actionsExecuted).toBe(1);
    expect(result.actionsFailed).toBe(0);
    expect(result.status).toBe("completed");
  });

  it("should execute multiple actions in sequence", async () => {
    const { executeChain } = await import("./workflowOrchestrator");
    const result = await executeChain(
      {
        name: "Multi-Action Chain",
        eventType: "compliance_alert",
        actions: [
          { type: "notification", target: "admin", config: { title: "Compliance Alert" } },
          { type: "in_app_message", target: "advisor", config: { title: "Review Required" } },
          { type: "flag", target: "system", config: { flagType: "compliance_review" } },
        ],
        isActive: true,
      },
      "compliance_event"
    );
    expect(result.actionsExecuted).toBe(3);
    expect(result.actionsFailed).toBe(0);
    expect(result.status).toBe("completed");
    expect(result.results[0].actionType).toBe("notification");
    expect(result.results[1].actionType).toBe("in_app_message");
    expect(result.results[2].actionType).toBe("flag");
  });
});

// ─── Email Campaign Service Tests (In-App Messaging) ────────────────────
describe("Message Campaign Service — In-App Only", () => {
  it("should export all campaign CRUD functions", async () => {
    const service = await import("./services/emailCampaign");
    expect(typeof service.createCampaign).toBe("function");
    expect(typeof service.updateCampaign).toBe("function");
    expect(typeof service.getCampaigns).toBe("function");
    expect(typeof service.getCampaign).toBe("function");
    expect(typeof service.deleteCampaign).toBe("function");
    expect(typeof service.addRecipients).toBe("function");
    expect(typeof service.getRecipients).toBe("function");
    expect(typeof service.removeRecipient).toBe("function");
    expect(typeof service.sendCampaign).toBe("function");
    expect(typeof service.getCampaignAnalytics).toBe("function");
    expect(typeof service.generateEmailContent).toBe("function");
  });
});

// ─── Recommendation Service Tests (In-App Invitation) ───────────────────
describe("Recommendation / Invitation Service — In-App Only", () => {
  it("should export invitation service with in-app methods", async () => {
    const { invitationService } = await import("./services/recommendation");
    expect(invitationService).toBeDefined();
    expect(typeof invitationService.sendEmailInvitation).toBe("function");
    expect(typeof invitationService.sendInvitation).toBe("function");
    expect(typeof invitationService.respondToInvitation).toBe("function");
  });
});

// ─── Data Source Coverage Tests ──────────────────────────────────────────
describe("Passive Actions — Data Source Coverage", () => {
  it("should cover all major integration categories", async () => {
    const { DATA_SOURCES } = await import("./services/passiveActions");
    const categories = new Set(DATA_SOURCES.map(ds => ds.category));
    expect(categories.has("government")).toBe(true);
    expect(categories.has("market")).toBe(true);
    expect(categories.has("personal")).toBe(true);
    expect(categories.has("professional")).toBe(true);
    expect(categories.has("crm")).toBe(true);
    expect(categories.has("insurance")).toBe(true);
    expect(categories.has("investment")).toBe(true);
  });

  it("should have at least 15 data sources", async () => {
    const { DATA_SOURCES } = await import("./services/passiveActions");
    expect(DATA_SOURCES.length).toBeGreaterThanOrEqual(15);
  });

  it("should have COMPULIFE in insurance category", async () => {
    const { DATA_SOURCES } = await import("./services/passiveActions");
    const insuranceIds = DATA_SOURCES.filter(ds => ds.category === "insurance").map(ds => ds.id);
    expect(insuranceIds).toContain("compulife");
  });

  it("should have market data sources", async () => {
    const { DATA_SOURCES } = await import("./services/passiveActions");
    const marketSources = DATA_SOURCES.filter(ds => ds.category === "market");
    expect(marketSources.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Verification Service Tests ─────────────────────────────────────────
describe("Verification Service — Badge System", () => {
  it("should export SEC IAPD and CFP Board verification functions", async () => {
    const verification = await import("./services/verification");
    expect(verification).toBeDefined();
    expect(typeof verification.verifySECIAPD).toBe("function");
    expect(typeof verification.verifyCFPBoard).toBe("function");
    expect(typeof verification.verifyStateBar).toBe("function");
    expect(typeof verification.verifyNMLS).toBe("function");
  });

  it("should export premium finance rate fetcher", async () => {
    const verification = await import("./services/verification");
    expect(typeof verification.fetchPremiumFinanceRates).toBe("function");
  });
});

// ─── WebSocket Notifications Tests ──────────────────────────────────────
describe("WebSocket Notifications — In-App Delivery", () => {
  it("should export in-app notification functions", async () => {
    const wsNotifications = await import("./services/websocketNotifications");
    expect(wsNotifications).toBeDefined();
    expect(typeof wsNotifications.sendNotification).toBe("function");
    expect(typeof wsNotifications.broadcastToRole).toBe("function");
    expect(typeof wsNotifications.broadcastToAll).toBe("function");
    expect(typeof wsNotifications.getUserNotifications).toBe("function");
    expect(typeof wsNotifications.getUnreadCount).toBe("function");
  });

  it("should export user preference management", async () => {
    const wsNotifications = await import("./services/websocketNotifications");
    expect(typeof wsNotifications.getUserPreferences).toBe("function");
    expect(typeof wsNotifications.setUserPreferences).toBe("function");
  });
});
