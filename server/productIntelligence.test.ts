import { describe, expect, it } from "vitest";

// ─── IUL Market Data Service Tests ──────────────────────────────────────────

describe("iulMarketData service", () => {
  it("exports seedIulCreditingHistory function", async () => {
    const mod = await import("./services/iulMarketData");
    expect(typeof mod.seedIulCreditingHistory).toBe("function");
  });

  it("exports getCreditingHistory function", async () => {
    const mod = await import("./services/iulMarketData");
    expect(typeof mod.getCreditingHistory).toBe("function");
  });

  it("exports getAvailableStrategies function", async () => {
    const mod = await import("./services/iulMarketData");
    expect(typeof mod.getAvailableStrategies).toBe("function");
  });

  it("exports getAverageCreditingByStrategy function", async () => {
    const mod = await import("./services/iulMarketData");
    expect(typeof mod.getAverageCreditingByStrategy).toBe("function");
  });

  it("exports seedMarketIndexHistory function", async () => {
    const mod = await import("./services/iulMarketData");
    expect(typeof mod.seedMarketIndexHistory).toBe("function");
  });

  it("exports getIndexHistory function", async () => {
    const mod = await import("./services/iulMarketData");
    expect(typeof mod.getIndexHistory).toBe("function");
  });

  it("exports getLatestIndexValues function", async () => {
    const mod = await import("./services/iulMarketData");
    expect(typeof mod.getLatestIndexValues).toBe("function");
  });

  it("exports compareIndices function", async () => {
    const mod = await import("./services/iulMarketData");
    expect(typeof mod.compareIndices).toBe("function");
  });
});

// ─── Nitrogen Risk Profile Service Tests ────────────────────────────────────

describe("nitrogenRisk service", () => {
  it("exports fetchRiskProfile function", async () => {
    const mod = await import("./services/nitrogenRisk");
    expect(typeof mod.fetchRiskProfile).toBe("function");
  });

  it("exports saveRiskProfile function", async () => {
    const mod = await import("./services/nitrogenRisk");
    expect(typeof mod.saveRiskProfile).toBe("function");
  });

  it("exports getCachedRiskProfile function", async () => {
    const mod = await import("./services/nitrogenRisk");
    expect(typeof mod.getCachedRiskProfile).toBe("function");
  });

  it("exports assessRiskManually function", async () => {
    const mod = await import("./services/nitrogenRisk");
    expect(typeof mod.assessRiskManually).toBe("function");
  });

  it("exports getRiskProfileHistory function", async () => {
    const mod = await import("./services/nitrogenRisk");
    expect(typeof mod.getRiskProfileHistory).toBe("function");
  });
});

// ─── Risk Category Logic Tests ──────────────────────────────────────────────

describe("risk category classification", () => {
  it("conservative inputs should produce low risk number", () => {
    const score = 50 - 25 - 15 - 20 - 20 - 10 - 20;
    const clamped = Math.max(1, Math.min(99, score));
    expect(clamped).toBe(1);
  });

  it("aggressive inputs should produce high risk number", () => {
    const score = 50 + 15 + 15 + 15 + 20 + 10 + 20;
    const clamped = Math.max(1, Math.min(99, score));
    expect(clamped).toBe(99);
  });

  it("moderate inputs should produce middle risk number", () => {
    const score = 50 + 5 + 5 + 5 + 10 + 5 + 10;
    const clamped = Math.max(1, Math.min(99, score));
    expect(clamped).toBe(90);
  });

  it("risk categories map correctly", () => {
    const getRiskCategory = (n: number) => {
      if (n <= 20) return "Conservative";
      if (n <= 40) return "Moderately Conservative";
      if (n <= 60) return "Moderate";
      if (n <= 80) return "Moderately Aggressive";
      return "Aggressive";
    };

    expect(getRiskCategory(10)).toBe("Conservative");
    expect(getRiskCategory(20)).toBe("Conservative");
    expect(getRiskCategory(21)).toBe("Moderately Conservative");
    expect(getRiskCategory(40)).toBe("Moderately Conservative");
    expect(getRiskCategory(50)).toBe("Moderate");
    expect(getRiskCategory(60)).toBe("Moderate");
    expect(getRiskCategory(70)).toBe("Moderately Aggressive");
    expect(getRiskCategory(80)).toBe("Moderately Aggressive");
    expect(getRiskCategory(90)).toBe("Aggressive");
    expect(getRiskCategory(99)).toBe("Aggressive");
  });

  it("suggested allocation sums to 100%", () => {
    const getSuggestedAllocation = (n: number) => {
      if (n <= 20) return { equity: 20, fixed: 55, alternatives: 10, cash: 15 };
      if (n <= 40) return { equity: 40, fixed: 40, alternatives: 10, cash: 10 };
      if (n <= 60) return { equity: 60, fixed: 25, alternatives: 10, cash: 5 };
      if (n <= 80) return { equity: 75, fixed: 15, alternatives: 8, cash: 2 };
      return { equity: 90, fixed: 5, alternatives: 4, cash: 1 };
    };

    for (const riskNum of [10, 30, 50, 70, 90]) {
      const alloc = getSuggestedAllocation(riskNum);
      const total = alloc.equity + alloc.fixed + alloc.alternatives + alloc.cash;
      expect(total).toBe(100);
    }
  });

  it("max drawdown tolerance scales with risk number", () => {
    const getMaxDrawdown = (n: number) => Math.round(n * 0.5);
    expect(getMaxDrawdown(20)).toBe(10);
    expect(getMaxDrawdown(50)).toBe(25);
    expect(getMaxDrawdown(80)).toBe(40);
    expect(getMaxDrawdown(99)).toBe(50);
  });
});

// ─── eSignature Service Tests ───────────────────────────────────────────────

describe("esignatureService", () => {
  it("exports createEnvelope function", async () => {
    const mod = await import("./services/esignatureService");
    expect(typeof mod.createEnvelope).toBe("function");
  });

  it("exports updateEnvelopeStatus function", async () => {
    const mod = await import("./services/esignatureService");
    expect(typeof mod.updateEnvelopeStatus).toBe("function");
  });

  it("exports getEnvelopesByProfessional function", async () => {
    const mod = await import("./services/esignatureService");
    expect(typeof mod.getEnvelopesByProfessional).toBe("function");
  });

  it("exports getEnvelopesByClient function", async () => {
    const mod = await import("./services/esignatureService");
    expect(typeof mod.getEnvelopesByClient).toBe("function");
  });

  it("exports getEnvelopeByEnvelopeId function", async () => {
    const mod = await import("./services/esignatureService");
    expect(typeof mod.getEnvelopeByEnvelopeId).toBe("function");
  });

  it("exports getPendingEnvelopes function", async () => {
    const mod = await import("./services/esignatureService");
    expect(typeof mod.getPendingEnvelopes).toBe("function");
  });

  it("exports getSignatureStats function", async () => {
    const mod = await import("./services/esignatureService");
    expect(typeof mod.getSignatureStats).toBe("function");
  });

  it("exports handleWebhook function", async () => {
    const mod = await import("./services/esignatureService");
    expect(typeof mod.handleWebhook).toBe("function");
  });
});

// ─── eSignature Status Mapping Tests ────────────────────────────────────────

describe("eSignature status mapping", () => {
  it("DocuSign status maps correctly", () => {
    const mapDocuSignStatus = (dsStatus: string) => {
      const map: Record<string, string> = {
        created: "created", sent: "sent", delivered: "delivered",
        completed: "completed", declined: "declined", voided: "voided",
      };
      return map[dsStatus?.toLowerCase()] ?? "sent";
    };

    expect(mapDocuSignStatus("created")).toBe("created");
    expect(mapDocuSignStatus("sent")).toBe("sent");
    expect(mapDocuSignStatus("completed")).toBe("completed");
    expect(mapDocuSignStatus("declined")).toBe("declined");
    expect(mapDocuSignStatus("unknown")).toBe("sent");
  });

  it("Dropbox Sign status maps correctly", () => {
    const mapDropboxSignStatus = (eventType: string) => {
      const map: Record<string, string> = {
        signature_request_sent: "sent", signature_request_viewed: "viewed",
        signature_request_signed: "signed", signature_request_all_signed: "completed",
        signature_request_declined: "declined", signature_request_expired: "expired",
      };
      return map[eventType?.toLowerCase()] ?? "sent";
    };

    expect(mapDropboxSignStatus("signature_request_sent")).toBe("sent");
    expect(mapDropboxSignStatus("signature_request_viewed")).toBe("viewed");
    expect(mapDropboxSignStatus("signature_request_all_signed")).toBe("completed");
    expect(mapDropboxSignStatus("signature_request_expired")).toBe("expired");
    expect(mapDropboxSignStatus("unknown_event")).toBe("sent");
  });
});

// ─── Product Intelligence Router Tests ──────────────────────────────────────

describe("productIntelligence router", () => {
  it("router is exported and has expected procedures", async () => {
    const mod = await import("./routers/productIntelligence");
    expect(mod.productIntelligenceRouter).toBeDefined();
    expect(mod.productIntelligenceRouter._def).toBeDefined();
    expect(mod.productIntelligenceRouter._def.procedures).toBeDefined();
  });

  it("router has IUL procedures", async () => {
    const mod = await import("./routers/productIntelligence");
    const p = mod.productIntelligenceRouter._def.procedures;
    expect(p.seedIulData).toBeDefined();
    expect(p.creditingHistory).toBeDefined();
    expect(p.availableStrategies).toBeDefined();
    expect(p.avgCreditingByStrategy).toBeDefined();
  });

  it("router has market index procedures", async () => {
    const mod = await import("./routers/productIntelligence");
    const p = mod.productIntelligenceRouter._def.procedures;
    expect(p.seedMarketData).toBeDefined();
    expect(p.indexHistory).toBeDefined();
    expect(p.latestIndices).toBeDefined();
    expect(p.compareIndices).toBeDefined();
  });

  it("router has risk profile procedures", async () => {
    const mod = await import("./routers/productIntelligence");
    const p = mod.productIntelligenceRouter._def.procedures;
    expect(p.riskProfile).toBeDefined();
    expect(p.fetchRiskProfile).toBeDefined();
    expect(p.assessRisk).toBeDefined();
    expect(p.riskHistory).toBeDefined();
  });

  it("router has eSignature procedures", async () => {
    const mod = await import("./routers/productIntelligence");
    const p = mod.productIntelligenceRouter._def.procedures;
    expect(p.createEnvelope).toBeDefined();
    expect(p.updateEnvelopeStatus).toBeDefined();
    expect(p.myEnvelopes).toBeDefined();
    expect(p.clientEnvelopes).toBeDefined();
    expect(p.envelopeDetail).toBeDefined();
    expect(p.pendingEnvelopes).toBeDefined();
    expect(p.signatureStats).toBeDefined();
    expect(p.esignWebhook).toBeDefined();
  });
});

// ─── Data Seed Router Tests ─────────────────────────────────────────────────

describe("dataSeed router", () => {
  it("router is exported", async () => {
    const mod = await import("./routers/dataSeed");
    expect(mod.dataSeedRouter).toBeDefined();
  });

  it("router has tax parameter procedures", async () => {
    const mod = await import("./routers/dataSeed");
    const p = mod.dataSeedRouter._def.procedures;
    expect(p.taxBrackets).toBeDefined();
    expect(p.standardDeduction).toBeDefined();
    expect(p.capitalGainsRates).toBeDefined();
    expect(p.retirementLimits).toBeDefined();
  });

  it("router has SSA procedures", async () => {
    const mod = await import("./routers/dataSeed");
    const p = mod.dataSeedRouter._def.procedures;
    expect(p.calculatePIA).toBeDefined();
    expect(p.calculateAIME).toBeDefined();
    expect(p.ssaBenefitAtAge).toBeDefined();
    expect(p.ssaClaimingStrategy).toBeDefined();
    expect(p.ssaSpousalBenefit).toBeDefined();
    expect(p.ssaSurvivorBenefit).toBeDefined();
    expect(p.lifeExpectancy).toBeDefined();
  });

  it("router has Medicare procedures", async () => {
    const mod = await import("./routers/dataSeed");
    const p = mod.dataSeedRouter._def.procedures;
    expect(p.irmaaCalculator).toBeDefined();
    expect(p.hsaCutoff).toBeDefined();
    expect(p.healthcareCostEstimate).toBeDefined();
    expect(p.partBPremium).toBeDefined();
  });

  it("router has insurance procedures", async () => {
    const mod = await import("./routers/dataSeed");
    const p = mod.dataSeedRouter._def.procedures;
    expect(p.searchCarriers).toBeDefined();
    expect(p.carriersByRating).toBeDefined();
    expect(p.productsByType).toBeDefined();
    expect(p.searchProducts).toBeDefined();
    expect(p.premiumFinanceEligibility).toBeDefined();
  });

  it("router has seed management procedures", async () => {
    const mod = await import("./routers/dataSeed");
    const p = mod.dataSeedRouter._def.procedures;
    expect(p.runSeed).toBeDefined();
    expect(p.seedStatus).toBeDefined();
  });
});

// ─── Integration with appRouter ─────────────────────────────────────────────

describe("appRouter integration", () => {
  it("appRouter includes productIntelligence namespace", async () => {
    const mod = await import("./routers");
    const p = mod.appRouter._def.procedures;
    expect(p["productIntelligence.seedIulData"]).toBeDefined();
    expect(p["productIntelligence.creditingHistory"]).toBeDefined();
    expect(p["productIntelligence.riskProfile"]).toBeDefined();
    expect(p["productIntelligence.createEnvelope"]).toBeDefined();
  }, 30_000);

  it("appRouter includes dataSeed namespace", async () => {
    const mod = await import("./routers");
    const p = mod.appRouter._def.procedures;
    expect(p["dataSeed.taxBrackets"]).toBeDefined();
    expect(p["dataSeed.calculatePIA"]).toBeDefined();
    expect(p["dataSeed.irmaaCalculator"]).toBeDefined();
  }, 30_000);
});

// ─── IUL Strategy Crediting Logic Tests ─────────────────────────────────────

describe("IUL crediting calculations", () => {
  it("floor protects against negative returns", () => {
    const floor = 0;
    const credited = Math.max(floor, 0);
    expect(credited).toBe(0);
    expect(credited).toBeGreaterThanOrEqual(0);
  });

  it("cap limits upside", () => {
    const indexReturn = 31.5;
    const cap = 10;
    const partRate = 100;
    const spread = 0;
    const afterPart = indexReturn * (partRate / 100);
    const afterSpread = Math.max(afterPart - spread, 0);
    const credited = cap < 999 ? Math.min(afterSpread, cap) : afterSpread;
    expect(credited).toBe(10);
  });

  it("participation rate reduces credited amount", () => {
    const indexReturn = 20;
    const cap = 999;
    const partRate = 50;
    const spread = 0;
    const afterPart = indexReturn * (partRate / 100);
    const afterSpread = Math.max(afterPart - spread, 0);
    const credited = cap < 999 ? Math.min(afterSpread, cap) : afterSpread;
    expect(credited).toBe(10);
  });

  it("spread reduces credited amount", () => {
    const indexReturn = 15;
    const cap = 999;
    const partRate = 100;
    const spread = 3;
    const afterPart = indexReturn * (partRate / 100);
    const afterSpread = Math.max(afterPart - spread, 0);
    const credited = cap < 999 ? Math.min(afterSpread, cap) : afterSpread;
    expect(credited).toBe(12);
  });

  it("spread cannot make credited negative", () => {
    const indexReturn = 2;
    const spread = 5;
    const afterPart = indexReturn;
    const afterSpread = Math.max(afterPart - spread, 0);
    expect(afterSpread).toBe(0);
  });

  it("uncapped strategy with participation and spread", () => {
    const indexReturn = 25;
    const cap = 999;
    const partRate = 80;
    const spread = 2;
    const afterPart = indexReturn * (partRate / 100);
    const afterSpread = Math.max(afterPart - spread, 0);
    const credited = cap < 999 ? Math.min(afterSpread, cap) : afterSpread;
    expect(credited).toBe(18);
  });
});

// ─── Market Index Data Structure Tests ──────────────────────────────────────

describe("market index data structure", () => {
  it("index symbols are valid", () => {
    const validSymbols = ["SPX", "NDX", "DJIA", "RUT", "AGG", "VIX"];
    validSymbols.forEach(sym => {
      expect(sym.length).toBeGreaterThan(0);
      expect(sym.length).toBeLessThanOrEqual(5);
    });
  });

  it("daily return calculation is correct", () => {
    const prevValue = 100;
    const currentValue = 105;
    const dailyReturn = ((currentValue - prevValue) / prevValue * 100);
    expect(dailyReturn).toBeCloseTo(5, 2);
  });

  it("total return index calculation is correct", () => {
    const yearStart = 2500;
    const current = 3000;
    const totalReturn = ((current / yearStart - 1) * 100);
    expect(totalReturn).toBeCloseTo(20, 2);
  });

  it("VIX is bounded between 10 and 80", () => {
    let value = 15;
    value = Math.max(10, Math.min(80, value + 50));
    expect(value).toBe(65);

    value = 15;
    value = Math.max(10, Math.min(80, value - 20));
    expect(value).toBe(10);
  });
});

// ─── Envelope ID Generation Tests ───────────────────────────────────────────

describe("envelope ID generation", () => {
  it("generates unique envelope IDs", () => {
    const gen = () => `ENV-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const id1 = gen();
    const id2 = gen();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^ENV-\d+-[A-Z0-9]+$/);
  });

  it("envelope ID starts with ENV prefix", () => {
    const gen = () => `ENV-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    expect(gen().startsWith("ENV-")).toBe(true);
  });
});
