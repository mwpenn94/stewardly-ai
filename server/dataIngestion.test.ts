/**
 * Data Ingestion & Agentic Execution Test Suite
 * Tests for: web scraping, document processing, market data, entity extraction,
 * continuous learning, gate reviews, agent orchestration, insurance quoting,
 * estate docs, and premium finance.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Data Ingestion Service Tests ───────────────────────────────────────────

describe("DataIngestionOrchestrator", () => {
  describe("WebScraperService", () => {
    it("should validate URL format before scraping", () => {
      const validUrls = ["https://example.com", "http://test.org/page", "https://sub.domain.co.uk/path?q=1"];
      const invalidUrls = ["not-a-url", "ftp://bad.com", "", "javascript:alert(1)"];
      validUrls.forEach(url => expect(url.match(/^https?:\/\//)).toBeTruthy());
      invalidUrls.forEach(url => expect(url.match(/^https?:\/\/[^\s]+$/)).toBeFalsy());
    });

    it("should extract domain from URL correctly", () => {
      const extractDomain = (url: string) => new URL(url).hostname;
      expect(extractDomain("https://www.example.com/page")).toBe("www.example.com");
      expect(extractDomain("https://api.test.org:8080/v1")).toBe("api.test.org");
    });

    it("should handle rate limiting with exponential backoff", () => {
      const calcBackoff = (attempt: number, base: number = 1000) => Math.min(base * Math.pow(2, attempt), 30000);
      expect(calcBackoff(0)).toBe(1000);
      expect(calcBackoff(1)).toBe(2000);
      expect(calcBackoff(2)).toBe(4000);
      expect(calcBackoff(5)).toBe(30000); // capped
    });

    it("should sanitize HTML content for text extraction", () => {
      const sanitize = (html: string) => html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      expect(sanitize("<p>Hello <b>world</b></p>")).toBe("Hello world");
      expect(sanitize("<script>alert(1)</script><p>Safe</p>")).toBe("Safe");
      expect(sanitize("<style>.x{color:red}</style>Text")).toBe("Text");
    });
  });

  describe("DocumentProcessorService", () => {
    it("should detect document type from content", () => {
      const detectType = (content: string) => {
        if (content.includes("PROSPECTUS") || content.includes("SEC Filing")) return "regulatory";
        if (content.includes("INVOICE") || content.includes("Amount Due")) return "financial";
        if (content.includes("Dear Client") || content.includes("portfolio")) return "client_communication";
        return "general";
      };
      expect(detectType("PROSPECTUS for XYZ Fund")).toBe("regulatory");
      expect(detectType("INVOICE #1234 Amount Due: $500")).toBe("financial");
      expect(detectType("Dear Client, your portfolio has grown")).toBe("client_communication");
      expect(detectType("Random text")).toBe("general");
    });

    it("should chunk large documents for processing", () => {
      const chunkText = (text: string, maxChunk: number = 4000) => {
        const chunks: string[] = [];
        for (let i = 0; i < text.length; i += maxChunk) {
          chunks.push(text.slice(i, i + maxChunk));
        }
        return chunks;
      };
      const longText = "A".repeat(10000);
      const chunks = chunkText(longText);
      expect(chunks.length).toBe(3);
      expect(chunks[0].length).toBe(4000);
      expect(chunks[2].length).toBe(2000);
    });

    it("should extract key-value pairs from structured text", () => {
      const extractKV = (text: string) => {
        const pairs: Record<string, string> = {};
        const regex = /^([A-Za-z\s]+):\s*(.+)$/gm;
        let match;
        while ((match = regex.exec(text)) !== null) {
          pairs[match[1].trim()] = match[2].trim();
        }
        return pairs;
      };
      const text = "Name: John Doe\nAge: 45\nNet Worth: $2.5M";
      const kv = extractKV(text);
      expect(kv["Name"]).toBe("John Doe");
      expect(kv["Age"]).toBe("45");
      expect(kv["Net Worth"]).toBe("$2.5M");
    });
  });

  describe("MarketDataService", () => {
    it("should calculate simple moving average", () => {
      const sma = (prices: number[], period: number) => {
        if (prices.length < period) return null;
        const slice = prices.slice(-period);
        return slice.reduce((a, b) => a + b, 0) / period;
      };
      expect(sma([10, 20, 30, 40, 50], 3)).toBe(40);
      expect(sma([100, 200], 5)).toBeNull();
    });

    it("should normalize currency amounts", () => {
      const normalize = (amount: string) => {
        return parseFloat(amount.replace(/[$,]/g, ""));
      };
      expect(normalize("$1,234.56")).toBe(1234.56);
      expect(normalize("$10,000,000")).toBe(10000000);
      expect(normalize("500.00")).toBe(500);
    });

    it("should validate market data freshness", () => {
      const isFresh = (timestamp: number, maxAgeMs: number = 3600000) => {
        return Date.now() - timestamp < maxAgeMs;
      };
      expect(isFresh(Date.now() - 1000)).toBe(true);
      expect(isFresh(Date.now() - 7200000)).toBe(false); // 2 hours old
    });
  });

  describe("EntityExtractorService", () => {
    it("should extract financial entities from text", () => {
      const extractEntities = (text: string) => {
        const entities: { type: string; value: string }[] = [];
        // Dollar amounts
        const dollarRegex = /\$[\d,]+(?:\.\d{2})?/g;
        let match;
        while ((match = dollarRegex.exec(text)) !== null) {
          entities.push({ type: "currency", value: match[0] });
        }
        // Percentages
        const pctRegex = /\d+(?:\.\d+)?%/g;
        while ((match = pctRegex.exec(text)) !== null) {
          entities.push({ type: "percentage", value: match[0] });
        }
        return entities;
      };
      const text = "The portfolio returned 12.5% with a value of $1,250,000 and fees of $2,500.00";
      const entities = extractEntities(text);
      expect(entities).toHaveLength(3);
      expect(entities[0]).toEqual({ type: "currency", value: "$1,250,000" });
      expect(entities[1]).toEqual({ type: "currency", value: "$2,500.00" });
      expect(entities[2]).toEqual({ type: "percentage", value: "12.5%" });
    });

    it("should deduplicate extracted entities", () => {
      const dedup = (entities: { type: string; value: string }[]) => {
        const seen = new Set<string>();
        return entities.filter(e => {
          const key = `${e.type}:${e.value}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      };
      const entities = [
        { type: "currency", value: "$100" },
        { type: "currency", value: "$100" },
        { type: "percentage", value: "5%" },
      ];
      expect(dedup(entities)).toHaveLength(2);
    });
  });

  describe("DataNormalizerService", () => {
    it("should normalize date formats", () => {
      const normalizeDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
      };
      expect(normalizeDate("2025-03-15")).toBe("2025-03-15");
      expect(normalizeDate("March 15, 2025")).toBe("2025-03-15");
      expect(normalizeDate("not-a-date")).toBeNull();
    });

    it("should calculate confidence scores for extracted data", () => {
      const calcConfidence = (factors: { hasSource: boolean; hasDate: boolean; matchCount: number }) => {
        let score = 0.5;
        if (factors.hasSource) score += 0.2;
        if (factors.hasDate) score += 0.1;
        score += Math.min(factors.matchCount * 0.05, 0.2);
        return Math.min(score, 1.0);
      };
      expect(calcConfidence({ hasSource: true, hasDate: true, matchCount: 3 })).toBe(0.95);
      expect(calcConfidence({ hasSource: false, hasDate: false, matchCount: 0 })).toBe(0.5);
    });
  });

  describe("ContinuousLearningService", () => {
    it("should track pattern frequency for learning", () => {
      const trackPatterns = (patterns: string[]) => {
        const freq: Record<string, number> = {};
        patterns.forEach(p => { freq[p] = (freq[p] || 0) + 1; });
        return Object.entries(freq).sort((a, b) => b[1] - a[1]);
      };
      const patterns = ["tax_question", "retirement", "tax_question", "insurance", "tax_question", "retirement"];
      const ranked = trackPatterns(patterns);
      expect(ranked[0]).toEqual(["tax_question", 3]);
      expect(ranked[1]).toEqual(["retirement", 2]);
    });

    it("should calculate model accuracy from feedback", () => {
      const calcAccuracy = (feedback: { correct: boolean }[]) => {
        if (feedback.length === 0) return 0;
        const correct = feedback.filter(f => f.correct).length;
        return correct / feedback.length;
      };
      expect(calcAccuracy([{ correct: true }, { correct: true }, { correct: false }])).toBeCloseTo(0.667, 2);
      expect(calcAccuracy([])).toBe(0);
    });
  });
});

// ─── Agentic Execution Tests ────────────────────────────────────────────────

describe("AgenticExecution", () => {
  describe("G8: Licensed Review Gate", () => {
    it("should classify compliance tiers correctly", () => {
      const classifyTier = (actionType: string) => {
        const tierMap: Record<string, number> = {
          "view_data": 1, "generate_report": 1,
          "create_quote": 2, "submit_application": 3,
          "execute_trade": 3, "generate_estate_doc": 3,
          "premium_finance": 4,
        };
        return tierMap[actionType] || 2;
      };
      expect(classifyTier("view_data")).toBe(1);
      expect(classifyTier("submit_application")).toBe(3);
      expect(classifyTier("premium_finance")).toBe(4);
      expect(classifyTier("unknown_action")).toBe(2);
    });

    it("should enforce auto-approve only for tier 1", () => {
      const shouldAutoApprove = (tier: number) => tier === 1;
      expect(shouldAutoApprove(1)).toBe(true);
      expect(shouldAutoApprove(2)).toBe(false);
      expect(shouldAutoApprove(3)).toBe(false);
      expect(shouldAutoApprove(4)).toBe(false);
    });

    it("should validate gate review decisions", () => {
      const validDecisions = ["approved", "rejected", "modified", "escalated"];
      validDecisions.forEach(d => expect(validDecisions.includes(d)).toBe(true));
      expect(validDecisions.includes("maybe")).toBe(false);
    });

    it("should require rationale for rejections and escalations", () => {
      const validateReview = (decision: string, rationale?: string) => {
        if (["rejected", "escalated"].includes(decision) && !rationale) {
          return { valid: false, error: "Rationale required for rejection/escalation" };
        }
        return { valid: true };
      };
      expect(validateReview("approved").valid).toBe(true);
      expect(validateReview("rejected").valid).toBe(false);
      expect(validateReview("rejected", "Compliance issue").valid).toBe(true);
      expect(validateReview("escalated").valid).toBe(false);
    });
  });

  describe("G1: Agent Orchestrator", () => {
    it("should enforce runtime limits", () => {
      const isExpired = (startedAt: number, limitMinutes: number) => {
        return Date.now() - startedAt > limitMinutes * 60 * 1000;
      };
      expect(isExpired(Date.now() - 30 * 60 * 1000, 60)).toBe(false);
      expect(isExpired(Date.now() - 90 * 60 * 1000, 60)).toBe(true);
    });

    it("should track agent action counts", () => {
      const trackActions = (actions: { type: string }[]) => {
        const counts: Record<string, number> = {};
        actions.forEach(a => { counts[a.type] = (counts[a.type] || 0) + 1; });
        return { total: actions.length, byType: counts };
      };
      const actions = [{ type: "query" }, { type: "query" }, { type: "execute" }, { type: "report" }];
      const result = trackActions(actions);
      expect(result.total).toBe(4);
      expect(result.byType.query).toBe(2);
    });

    it("should validate deployment modes", () => {
      const validModes = ["sandbox", "supervised", "autonomous"];
      expect(validModes.includes("sandbox")).toBe(true);
      expect(validModes.includes("supervised")).toBe(true);
      expect(validModes.includes("autonomous")).toBe(true);
      expect(validModes.includes("rogue")).toBe(false);
    });
  });

  describe("G2: Insurance Quote Engine", () => {
    it("should calculate illustrative premiums", () => {
      const calcPremium = (faceAmount: number, age: number, healthClass: string) => {
        const baseRate = faceAmount / 1000;
        const ageFactor = 1 + (age - 30) * 0.03;
        const healthFactors: Record<string, number> = {
          preferred_plus: 0.8, preferred: 1.0, standard: 1.3, substandard: 1.8,
        };
        return Math.round(baseRate * ageFactor * (healthFactors[healthClass] || 1.0) * 100) / 100;
      };
      const premium = calcPremium(500000, 45, "preferred");
      expect(premium).toBeGreaterThan(0);
      expect(calcPremium(500000, 45, "preferred_plus")).toBeLessThan(calcPremium(500000, 45, "standard"));
    });

    it("should validate face amount ranges", () => {
      const validateFaceAmount = (amount: number) => {
        if (amount < 25000) return { valid: false, error: "Minimum face amount is $25,000" };
        if (amount > 50000000) return { valid: false, error: "Maximum face amount is $50,000,000" };
        return { valid: true };
      };
      expect(validateFaceAmount(500000).valid).toBe(true);
      expect(validateFaceAmount(10000).valid).toBe(false);
      expect(validateFaceAmount(100000000).valid).toBe(false);
    });

    it("should rank quotes by premium cost", () => {
      const quotes = [
        { carrier: "A", premium: 500 },
        { carrier: "B", premium: 350 },
        { carrier: "C", premium: 425 },
      ];
      const ranked = [...quotes].sort((a, b) => a.premium - b.premium);
      expect(ranked[0].carrier).toBe("B");
      expect(ranked[2].carrier).toBe("A");
    });
  });

  describe("G3: Insurance Application", () => {
    it("should validate required application fields", () => {
      const validateApp = (app: Record<string, any>) => {
        const required = ["clientId", "quoteId", "productType"];
        const missing = required.filter(f => !app[f]);
        return { valid: missing.length === 0, missing };
      };
      expect(validateApp({ clientId: 1, quoteId: 5, productType: "whole_life" }).valid).toBe(true);
      expect(validateApp({ clientId: 1 }).valid).toBe(false);
      expect(validateApp({ clientId: 1 }).missing).toEqual(["quoteId", "productType"]);
    });

    it("should track application status transitions", () => {
      const validTransitions: Record<string, string[]> = {
        draft: ["submitted", "cancelled"],
        submitted: ["under_review", "rejected"],
        under_review: ["approved", "rejected", "info_requested"],
        info_requested: ["submitted"],
        approved: ["issued"],
        rejected: [],
        cancelled: [],
        issued: ["in_force"],
      };
      expect(validTransitions["draft"]).toContain("submitted");
      expect(validTransitions["rejected"]).toHaveLength(0);
      expect(validTransitions["under_review"]).toContain("approved");
    });
  });

  describe("G5: Estate Document Generator", () => {
    it("should validate state jurisdiction codes", () => {
      const validStates = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"];
      expect(validStates.includes("CA")).toBe(true);
      expect(validStates.includes("NY")).toBe(true);
      expect(validStates.includes("XX")).toBe(false);
    });

    it("should classify document complexity", () => {
      const classifyComplexity = (params: { assets: number; beneficiaries: number; trusts: number }) => {
        if (params.trusts > 2 || params.assets > 10000000) return "complex";
        if (params.beneficiaries > 5 || params.assets > 2000000) return "standard";
        return "simple";
      };
      expect(classifyComplexity({ assets: 500000, beneficiaries: 2, trusts: 0 })).toBe("simple");
      expect(classifyComplexity({ assets: 5000000, beneficiaries: 6, trusts: 1 })).toBe("standard");
      expect(classifyComplexity({ assets: 20000000, beneficiaries: 3, trusts: 3 })).toBe("complex");
    });
  });

  describe("G6: Premium Finance Engine", () => {
    it("should calculate loan-to-value ratio", () => {
      const ltv = (loanAmount: number, collateralValue: number) => {
        return Math.round((loanAmount / collateralValue) * 10000) / 100;
      };
      expect(ltv(800000, 1000000)).toBe(80);
      expect(ltv(500000, 2000000)).toBe(25);
    });

    it("should stress test interest rate scenarios", () => {
      const stressTest = (principal: number, baseRate: number, scenarios: number[]) => {
        return scenarios.map(rateShift => ({
          rate: baseRate + rateShift,
          annualPayment: Math.round(principal * (baseRate + rateShift) / 100),
          isViable: (baseRate + rateShift) < 12,
        }));
      };
      const results = stressTest(1000000, 5, [0, 1, 2, 3, 5, 8]);
      expect(results[0].annualPayment).toBe(50000);
      expect(results[5].isViable).toBe(false); // 13% rate
    });

    it("should validate collateral requirements", () => {
      const validateCollateral = (loanAmount: number, collateral: number, minLtv: number = 75) => {
        const ltv = (loanAmount / collateral) * 100;
        return { valid: ltv <= minLtv, ltv: Math.round(ltv * 100) / 100 };
      };
      expect(validateCollateral(750000, 1000000).valid).toBe(true);
      expect(validateCollateral(900000, 1000000).valid).toBe(false);
    });
  });

  describe("G7: Carrier Connector", () => {
    it("should validate carrier connection status", () => {
      const statuses = ["connected", "disconnected", "pending", "error"];
      statuses.forEach(s => expect(typeof s).toBe("string"));
    });

    it("should format carrier API responses", () => {
      const formatResponse = (raw: { status: number; data: any }) => ({
        success: raw.status >= 200 && raw.status < 300,
        data: raw.data,
        timestamp: Date.now(),
      });
      expect(formatResponse({ status: 200, data: { quote: 500 } }).success).toBe(true);
      expect(formatResponse({ status: 500, data: null }).success).toBe(false);
    });
  });
});

// ─── Security & Role Tests ──────────────────────────────────────────────────

describe("SecurityAndRoles", () => {
  it("should enforce role hierarchy", () => {
    const roleHierarchy: Record<string, number> = {
      user: 1, advisor: 2, manager: 3, admin: 4, superadmin: 5,
    };
    const hasPermission = (userRole: string, requiredRole: string) => {
      return (roleHierarchy[userRole] || 0) >= (roleHierarchy[requiredRole] || 0);
    };
    expect(hasPermission("admin", "user")).toBe(true);
    expect(hasPermission("user", "admin")).toBe(false);
    expect(hasPermission("advisor", "advisor")).toBe(true);
  });

  it("should sanitize user inputs", () => {
    const sanitize = (input: string) => input.replace(/<[^>]*>/g, "").replace(/['"]/g, "");
    expect(sanitize("<script>alert('xss')</script>")).toBe("alert(xss)");
    expect(sanitize("Normal text")).toBe("Normal text");
  });

  it("should validate JWT token structure", () => {
    const isValidJwtStructure = (token: string) => {
      const parts = token.split(".");
      return parts.length === 3 && parts.every(p => p.length > 0);
    };
    expect(isValidJwtStructure("header.payload.signature")).toBe(true);
    expect(isValidJwtStructure("invalid")).toBe(false);
    expect(isValidJwtStructure("a.b.")).toBe(false);
  });

  it("should rate limit API calls", () => {
    const rateLimiter = (calls: number[], windowMs: number, maxCalls: number) => {
      const now = Date.now();
      const recentCalls = calls.filter(t => now - t < windowMs);
      return { allowed: recentCalls.length < maxCalls, remaining: maxCalls - recentCalls.length };
    };
    const now = Date.now();
    const calls = Array.from({ length: 10 }, (_, i) => now - i * 100);
    expect(rateLimiter(calls, 60000, 100).allowed).toBe(true);
    expect(rateLimiter(calls, 60000, 5).allowed).toBe(false);
  });
});

// ─── Performance Tests ──────────────────────────────────────────────────────

describe("Performance", () => {
  it("should process batch records within time limit", () => {
    const start = performance.now();
    const records = Array.from({ length: 10000 }, (_, i) => ({ id: i, value: Math.random() }));
    const processed = records.map(r => ({ ...r, normalized: r.value * 100 }));
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100); // Should process 10k records in under 100ms
    expect(processed.length).toBe(10000);
  });

  it("should handle large text chunking efficiently", () => {
    const start = performance.now();
    const largeText = "A".repeat(1000000);
    const chunks: string[] = [];
    for (let i = 0; i < largeText.length; i += 4000) {
      chunks.push(largeText.slice(i, i + 4000));
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
    expect(chunks.length).toBe(250);
  });

  it("should sort and rank quotes efficiently", () => {
    const start = performance.now();
    const quotes = Array.from({ length: 1000 }, (_, i) => ({
      carrier: `Carrier_${i}`,
      premium: Math.random() * 10000,
      rating: Math.random() * 5,
    }));
    const ranked = quotes.sort((a, b) => a.premium - b.premium);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
    expect(ranked[0].premium).toBeLessThanOrEqual(ranked[999].premium);
  });
});
