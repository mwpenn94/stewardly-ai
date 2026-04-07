/**
 * Guardrails — Input/Output screening for PII, injection attacks, and URL hallucination
 */
export { detectHallucinatedURLs, stripHallucinatedURLs, extractURLsFromText } from "./urlHallucination";

// ─── PII Patterns ────────────────────────────────────────────────────────
const PII_PATTERNS: Array<{ name: string; pattern: RegExp; severity: "high" | "medium" }> = [
  { name: "ssn", pattern: /\b\d{3}-?\d{2}-?\d{4}\b/, severity: "high" },
  { name: "credit_card", pattern: /\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6(?:011|5\d{2}))[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/, severity: "high" },
  { name: "email", pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, severity: "medium" },
  { name: "phone", pattern: /\b(?:\+1[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}\b/, severity: "medium" },
  { name: "dob", pattern: /\b(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])\/(?:19|20)\d{2}\b/, severity: "medium" },
  { name: "routing_number", pattern: /\b\d{9}\b(?=.*(?:routing|ABA|transit))/i, severity: "high" },
  { name: "account_number", pattern: /\b(?:account|acct)[#: ]*\d{8,17}\b/i, severity: "high" },
];

// ─── Injection Patterns ──────────────────────────────────────────────────
const INJECTION_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "ignore_instructions", pattern: /ignore\s+(?:all\s+)?(?:previous|above|prior)\s+instructions/i },
  { name: "you_are_now", pattern: /you\s+are\s+now\s+(?:a|an|the)\s+/i },
  { name: "system_override", pattern: /^system:/im },
  { name: "bypass_attempt", pattern: /(?:bypass|jailbreak|escape|override)\s+(?:safety|filter|guardrail|restriction)/i },
  { name: "role_play_attack", pattern: /(?:pretend|act\s+as\s+if|imagine)\s+you\s+(?:have\s+no|don't\s+have|are\s+free\s+from)\s+(?:restrictions|limits|rules)/i },
  { name: "base64_injection", pattern: /(?:decode|interpret)\s+(?:this\s+)?base64/i },
];

export interface ScreenResult {
  passed: boolean;
  checks: Array<{
    name: string;
    type: "pii" | "injection";
    severity: "high" | "medium" | "low";
    matched: boolean;
  }>;
}

export function screenInput(input: string): ScreenResult {
  const checks: ScreenResult["checks"] = [];
  let passed = true;

  for (const { name, pattern, severity } of PII_PATTERNS) {
    const matched = pattern.test(input);
    checks.push({ name, type: "pii", severity, matched });
    if (matched && severity === "high") passed = false;
  }

  for (const { name, pattern } of INJECTION_PATTERNS) {
    const matched = pattern.test(input);
    checks.push({ name, type: "injection", severity: "high", matched });
    if (matched) passed = false;
  }

  return { passed, checks };
}

export function screenOutput(output: string): ScreenResult {
  const checks: ScreenResult["checks"] = [];
  let passed = true;

  // Check for PII leakage in output
  for (const { name, pattern, severity } of PII_PATTERNS) {
    const matched = pattern.test(output);
    checks.push({ name, type: "pii", severity, matched });
    if (matched && severity === "high") passed = false;
  }

  return { passed, checks };
}

/** Mask detected PII in text */
export function maskPII(text: string): string {
  let masked = text;
  for (const { name, pattern } of PII_PATTERNS) {
    masked = masked.replace(new RegExp(pattern, "g"), `[REDACTED_${name.toUpperCase()}]`);
  }
  return masked;
}
