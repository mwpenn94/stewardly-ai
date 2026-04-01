import { describe, it, expect } from "vitest";
import { conversations, messages, gateReviews, insuranceQuotes, insuranceApplications, premiumFinanceCases, advisoryExecutions, complianceFlags, agentActions, carrierConnections, estateDocuments, dataSources, ingestedRecords, knowledgeIngestionJobs } from "../drizzle/schema";

// ─── Schema Column Name Alignment Tests ─────────────────────────────────────
// These tests verify that the Drizzle schema SQL column names match the actual
// database column names (camelCase convention) after the migration fix.

describe("Schema Column Name Alignment", () => {
  describe("conversations table", () => {
    it("should have correct column names", () => {
      expect(conversations.id.name).toBe("id");
      expect(conversations.userId.name).toBe("userId");
      expect(conversations.title.name).toBe("title");
      expect(conversations.createdAt.name).toBe("createdAt");
      expect(conversations.updatedAt.name).toBe("updatedAt");
    });
  });

  describe("messages table", () => {
    it("should have correct column names", () => {
      expect(messages.id.name).toBe("id");
      expect(messages.conversationId.name).toBe("conversationId");
      expect(messages.role.name).toBe("role");
      expect(messages.content.name).toBe("content");
      expect(messages.createdAt.name).toBe("createdAt");
    });
  });

  describe("gateReviews table — previously failing with 500 errors", () => {
    it("should use camelCase column names matching DB", () => {
      expect(gateReviews.actionId.name).toBe("actionId");
      expect(gateReviews.actionType.name).toBe("actionType");
      expect(gateReviews.complianceTier.name).toBe("complianceTier");
      expect(gateReviews.classificationRationale.name).toBe("classificationRationale");
      expect(gateReviews.reviewerId.name).toBe("reviewerId");
      expect(gateReviews.reviewerLicenseNumber.name).toBe("reviewerLicenseNumber");
      expect(gateReviews.reviewerLicenseState.name).toBe("reviewerLicenseState");
      expect(gateReviews.decision.name).toBe("decision");
      expect(gateReviews.modificationDetails.name).toBe("modificationDetails");
      expect(gateReviews.complianceNotes.name).toBe("complianceNotes");
      expect(gateReviews.workflowType.name).toBe("workflowType");
      expect(gateReviews.clientId.name).toBe("clientId");
      expect(gateReviews.professionalId.name).toBe("professionalId");
      expect(gateReviews.firmId.name).toBe("firmId");
      expect(gateReviews.createdAt.name).toBe("createdAt");
    });
  });

  describe("insuranceQuotes table", () => {
    it("should use camelCase column names matching DB", () => {
      expect(insuranceQuotes.clientId.name).toBe("clientId");
      expect(insuranceQuotes.professionalId.name).toBe("professionalId");
      expect(insuranceQuotes.carrierName.name).toBe("carrierName");
      expect(insuranceQuotes.productType.name).toBe("productType");
      expect(insuranceQuotes.productName.name).toBe("productName");
    });
  });

  describe("insuranceApplications table", () => {
    it("should use camelCase column names matching DB", () => {
      expect(insuranceApplications.clientId.name).toBe("clientId");
      expect(insuranceApplications.professionalId.name).toBe("professionalId");
      expect(insuranceApplications.carrierName.name).toBe("carrierName");
      expect(insuranceApplications.productName.name).toBe("productName");
      expect(insuranceApplications.gateStatus.name).toBe("gateStatus");
      expect(insuranceApplications.carrierStatus.name).toBe("carrierStatus");
      expect(insuranceApplications.policyNumber.name).toBe("policyNumber");
      expect(insuranceApplications.createdAt.name).toBe("createdAt");
      expect(insuranceApplications.updatedAt.name).toBe("updatedAt");
    });
  });

  describe("premiumFinanceCases table", () => {
    it("should use camelCase column names matching DB", () => {
      expect(premiumFinanceCases.clientId.name).toBe("clientId");
      expect(premiumFinanceCases.professionalId.name).toBe("professionalId");
      expect(premiumFinanceCases.insurancePolicyRef.name).toBe("insurancePolicyRef");
      expect(premiumFinanceCases.lenderName.name).toBe("lenderName");
      expect(premiumFinanceCases.termYears.name).toBe("termYears");
      expect(premiumFinanceCases.collateralType.name).toBe("collateralType");
      expect(premiumFinanceCases.gateStatus.name).toBe("gateStatus");
      expect(premiumFinanceCases.createdAt.name).toBe("createdAt");
    });
  });

  describe("advisoryExecutions table", () => {
    it("should use camelCase column names matching DB", () => {
      expect(advisoryExecutions.clientId.name).toBe("clientId");
      expect(advisoryExecutions.professionalId.name).toBe("professionalId");
      expect(advisoryExecutions.executionType.name).toBe("executionType");
      expect(advisoryExecutions.createdAt.name).toBe("createdAt");
    });
  });
});

// ─── Missing Column Tests ────────────────────────────────────────────────────
// These tests verify that columns added during the migration are defined in schema

describe("Schema Missing Column Additions", () => {
  it("agentActions should have gateTriggered column", () => {
    expect(agentActions.gateTriggered).toBeDefined();
    expect(agentActions.gateTriggered.name).toBe("gate_triggered");
  });

  it("carrierConnections should have active column", () => {
    expect(carrierConnections.active).toBeDefined();
    expect(carrierConnections.active.name).toBe("active");
  });

  it("complianceFlags should have autoFixed column", () => {
    expect(complianceFlags.autoFixed).toBeDefined();
    expect(complianceFlags.autoFixed.name).toBe("auto_fixed");
  });

  it("dataSources should have isActive column", () => {
    expect(dataSources.isActive).toBeDefined();
    expect(dataSources.isActive.name).toBe("is_active");
  });

  it("estateDocuments should have finalized column", () => {
    expect(estateDocuments.finalized).toBeDefined();
    expect(estateDocuments.finalized.name).toBe("finalized");
  });

  it("ingestedRecords should have isVerified column", () => {
    expect(ingestedRecords.isVerified).toBeDefined();
    expect(ingestedRecords.isVerified.name).toBe("is_verified");
  });

  it("knowledgeIngestionJobs should have status column", () => {
    expect(knowledgeIngestionJobs.status).toBeDefined();
    expect(knowledgeIngestionJobs.status.name).toBe("status_col");
  });
});

// ─── No Snake Case Regression Tests ──────────────────────────────────────────
// Spot-check that none of the fixed tables have reverted to snake_case

describe("No Snake Case Regression", () => {
  const snakeCasePattern = /^[a-z]+_[a-z]/;

  it("gateReviews columns should not use snake_case", () => {
    const colNames = Object.values(gateReviews).filter((v: any) => v?.name).map((v: any) => v.name);
    const snakeCols = colNames.filter((n: string) => snakeCasePattern.test(n) && n !== "gate_triggered");
    expect(snakeCols).toEqual([]);
  });

  it("insuranceQuotes columns should not use snake_case", () => {
    const colNames = Object.values(insuranceQuotes).filter((v: any) => v?.name).map((v: any) => v.name);
    const snakeCols = colNames.filter((n: string) => snakeCasePattern.test(n));
    expect(snakeCols).toEqual([]);
  });

  it("insuranceApplications columns should not use snake_case", () => {
    const colNames = Object.values(insuranceApplications).filter((v: any) => v?.name).map((v: any) => v.name);
    const snakeCols = colNames.filter((n: string) => snakeCasePattern.test(n));
    expect(snakeCols).toEqual([]);
  });

  it("premiumFinanceCases columns should not use snake_case", () => {
    const colNames = Object.values(premiumFinanceCases).filter((v: any) => v?.name).map((v: any) => v.name);
    const snakeCols = colNames.filter((n: string) => snakeCasePattern.test(n));
    expect(snakeCols).toEqual([]);
  });
});
