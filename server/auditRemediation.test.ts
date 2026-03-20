import { describe, it, expect } from "vitest";
import {
  stripPII,
  maskPIIForLLM,
  detectPII,
  getTopicDisclaimer,
  needsFinancialDisclaimer,
  buildSystemPrompt,
} from "./prompts";

// ─── PII MASKING TESTS (1D) ─────────────────────────────────────────────

describe("Enhanced PII Masking (1D)", () => {
  it("should redact SSNs in various formats", () => {
    expect(stripPII("My SSN is 123-45-6789")).toContain("[SSN_REDACTED]");
    expect(stripPII("SSN: 123.45.6789")).toContain("[SSN_REDACTED]");
    expect(stripPII("SSN: 123456789")).toContain("[SSN_REDACTED]");
  });

  it("should redact credit card numbers with spaces/dashes", () => {
    expect(stripPII("Card: 4111111111111111")).toContain("[CARD_REDACTED]");
    expect(stripPII("Card: 4111-1111-1111-1111")).toContain("[CARD_REDACTED]");
    expect(stripPII("Card: 4111 1111 1111 1111")).toContain("[CARD_REDACTED]");
  });

  it("should redact account numbers with keyword prefix", () => {
    expect(stripPII("Account #12345678")).toContain("[ACCOUNT_REDACTED]");
    // 9-digit numbers after 'acct:' may match SSN pattern first — both are redacted
    const acctResult = stripPII("acct: 987654321");
    expect(acctResult.includes("[ACCOUNT_REDACTED]") || acctResult.includes("[SSN_REDACTED]")).toBe(true);
    const routingResult = stripPII("routing 123456789");
    expect(routingResult.includes("[ACCOUNT_REDACTED]") || routingResult.includes("[SSN_REDACTED]")).toBe(true);
  });

  it("should redact phone numbers in various US formats", () => {
    expect(stripPII("Call me at 555-123-4567")).toContain("[PHONE_REDACTED]");
    expect(stripPII("Phone: (555) 123-4567")).toContain("[PHONE_REDACTED]");
    expect(stripPII("Call +1 555 123 4567")).toContain("[PHONE_REDACTED]");
  });

  it("should redact email addresses", () => {
    expect(stripPII("Email: john@example.com")).toContain("[EMAIL_REDACTED]");
    expect(stripPII("Send to user.name+tag@domain.co.uk")).toContain("[EMAIL_REDACTED]");
  });

  it("should redact street addresses", () => {
    expect(stripPII("I live at 123 Main Street")).toContain("[ADDRESS_REDACTED]");
    expect(stripPII("Address: 456 Oak Avenue")).toContain("[ADDRESS_REDACTED]");
  });

  it("maskPIIForLLM should strip all PII types", () => {
    const text = "My SSN is 123-45-6789 and email is test@test.com";
    const masked = maskPIIForLLM(text);
    expect(masked).toContain("[SSN_REDACTED]");
    expect(masked).toContain("[EMAIL_REDACTED]");
    expect(masked).not.toContain("123-45-6789");
    expect(masked).not.toContain("test@test.com");
  });
});

// ─── PII DETECTION TESTS ────────────────────────────────────────────────

describe("PII Detection", () => {
  it("should detect SSN", () => {
    const result = detectPII("My SSN is 123-45-6789");
    expect(result.hasPII).toBe(true);
    expect(result.types).toContain("SSN");
  });

  it("should detect email", () => {
    const result = detectPII("Email me at john@example.com");
    expect(result.hasPII).toBe(true);
    expect(result.types).toContain("email");
  });

  it("should return false for clean text", () => {
    const result = detectPII("I want to learn about retirement planning");
    expect(result.hasPII).toBe(false);
  });
});

// ─── TOPIC-SPECIFIC DISCLAIMERS (3B) ────────────────────────────────────

describe("Topic-Specific Disclaimers (3B)", () => {
  it("should add investment disclaimer for investment content", () => {
    const disclaimer = getTopicDisclaimer("You should invest in a diversified portfolio of stocks and bonds");
    expect(disclaimer).toBeTruthy();
    expect(disclaimer).toContain("Investment Disclaimer");
  });

  it("should add insurance disclaimer for insurance content", () => {
    const disclaimer = getTopicDisclaimer("A term life insurance policy with $500k coverage would cost about $50/month");
    expect(disclaimer).toBeTruthy();
    expect(disclaimer).toContain("Insurance Disclaimer");
  });

  it("should add tax disclaimer for tax content", () => {
    const disclaimer = getTopicDisclaimer("You can claim this as a tax deduction on your 1099");
    expect(disclaimer).toBeTruthy();
    expect(disclaimer).toContain("Tax Disclaimer");
  });

  it("should add multiple disclaimers when content spans topics", () => {
    const disclaimer = getTopicDisclaimer("You should invest in stocks and buy a term life insurance policy to get a tax deduction");
    expect(disclaimer).toBeTruthy();
    expect(disclaimer).toContain("Investment Disclaimer");
    expect(disclaimer).toContain("Insurance Disclaimer");
    expect(disclaimer).toContain("Tax Disclaimer");
  });

  it("should return null for non-financial content", () => {
    const disclaimer = getTopicDisclaimer("The weather today is sunny and warm");
    expect(disclaimer).toBeNull();
  });
});

// ─── AI IDENTITY DISCLOSURE (2A) ────────────────────────────────────────

describe("AI Identity Disclosure (2A)", () => {
  it("should include AI identity disclosure in system prompt", () => {
    const prompt = buildSystemPrompt({
      userName: "Test User",
      mode: "client",
      focus: "general",
    });
    expect(prompt).toContain("<identity>");
    expect(prompt).toContain("Stewardly");
    expect(prompt).toContain("AI-powered advisory assistant");
    expect(prompt).toContain("NOT a human financial advisor");
  });
});

// ─── REASONING TRANSPARENCY (2C) ────────────────────────────────────────

describe("Reasoning Transparency (2C)", () => {
  it("should include reasoning transparency instructions in system prompt", () => {
    const prompt = buildSystemPrompt({
      userName: "Test User",
      mode: "client",
      focus: "financial",
    });
    expect(prompt).toContain("REASONING TRANSPARENCY");
    expect(prompt).toContain("**Reasoning:**");
  });
});

// ─── CONVERSATIONAL TONE (5D) ───────────────────────────────────────────

describe("Conversational Tone Rules (5D)", () => {
  it("should include tone rules in system prompt", () => {
    const prompt = buildSystemPrompt({
      userName: "Test User",
      mode: "client",
      focus: "general",
    });
    expect(prompt).toContain("TONE RULES");
    expect(prompt).toContain("contractions");
    expect(prompt).toContain("NEVER start with");
  });

  it("should include response length guidelines", () => {
    const prompt = buildSystemPrompt({
      userName: "Test User",
      mode: "client",
      focus: "financial",
    });
    expect(prompt).toContain("RESPONSE LENGTH");
    expect(prompt).toContain("NEVER pad responses");
  });
});

// ─── FINANCIAL DISCLAIMER DETECTION ─────────────────────────────────────

describe("Financial Disclaimer Detection", () => {
  it("should detect financial advice in financial focus", () => {
    expect(needsFinancialDisclaimer("I recommend investing in index funds", "financial")).toBe(true);
  });

  it("should not flag general focus content", () => {
    expect(needsFinancialDisclaimer("I recommend investing in index funds", "general")).toBe(false);
  });

  it("should detect insurance-related content", () => {
    expect(needsFinancialDisclaimer("Your IUL policy cash value projection", "financial")).toBe(true);
  });
});
