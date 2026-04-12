/**
 * Tests for sensitiveRedaction.ts (Pass 15 — PII/secret redaction).
 */

import { describe, it, expect } from "vitest";
import {
  redactRecord,
  redactRecords,
  summarizeRedaction,
} from "./sensitiveRedaction";

describe("redactRecord — field name matching", () => {
  it("redacts ssn field", () => {
    const { record, report } = redactRecord({ name: "Alice", ssn: "123-45-6789" });
    expect(record.name).toBe("Alice");
    expect(record.ssn).not.toBe("123-45-6789");
    expect(report.byCategory.ssn).toBe(1);
  });

  it("redacts password field unconditionally", () => {
    const { record } = redactRecord({ username: "alice", password: "supersecret" });
    expect(record.password).not.toBe("supersecret");
  });

  it("redacts api_key field", () => {
    const { record, report } = redactRecord({
      name: "A",
      api_key: "sk_live_abcdef1234567890",
    });
    expect(record.api_key).not.toBe("sk_live_abcdef1234567890");
    expect(report.byCategory.api_key).toBe(1);
  });

  it("redacts credit_card field by name", () => {
    const { record, report } = redactRecord({ credit_card: "4111 1111 1111 1111" });
    expect(record.credit_card).not.toBe("4111 1111 1111 1111");
    expect(report.byCategory.credit_card).toBe(1);
  });
});

describe("redactRecord — value pattern matching", () => {
  it("detects SSN in an unlabeled field", () => {
    const { record, report } = redactRecord({
      notes: "Please contact customer 123-45-6789 to update their file",
    });
    // Wait — the notes field isn't SSN-labeled but the value contains an SSN
    // The current matcher checks field name first; value-pattern matches
    // when the field name doesn't already match. So the notes field should
    // be redacted via value pattern match.
    expect(report.redactedCount).toBeGreaterThan(0);
    expect(record.notes).not.toContain("123-45-6789");
  });

  it("detects JWT in generic field", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123xyz456def";
    const { record, report } = redactRecord({ token_value: jwt });
    expect(record.token_value).not.toBe(jwt);
    expect(report.redactedCount).toBe(1);
  });

  it("detects PEM private key block", () => {
    const pem = "-----BEGIN RSA PRIVATE KEY-----\nMIIE...";
    const { record, report } = redactRecord({ key_blob: pem });
    expect(record.key_blob).not.toBe(pem);
    expect(report.byCategory.private_key).toBe(1);
  });

  it("detects Bearer token in string", () => {
    const { record, report } = redactRecord({
      auth: "Bearer abcdefghijklmnopqrstuvwxyz12345",
    });
    expect(record.auth).not.toContain("abcdefghijklmnopqrstuvwxyz12345");
    expect(report.byCategory.bearer_token).toBe(1);
  });
});

describe("redactRecord — leaves non-sensitive fields alone", () => {
  it("preserves name + email + amount fields", () => {
    const { record } = redactRecord({
      name: "Alice Smith",
      email: "alice@example.com",
      amount: 1000,
    });
    expect(record.name).toBe("Alice Smith");
    expect(record.email).toBe("alice@example.com");
    expect(record.amount).toBe(1000);
  });
});

describe("redactRecord — strategy: mask", () => {
  it("preserves last 4 chars by default", () => {
    const { record } = redactRecord({ ssn: "123456789" });
    expect(record.ssn).toMatch(/\*+6789$/);
  });

  it("honors preserveLastN=0", () => {
    const { record } = redactRecord({ ssn: "123456789" }, { preserveLastN: 0 });
    expect(record.ssn).toBe("*********");
  });
});

describe("redactRecord — strategy: tokenize", () => {
  it("replaces with [REDACTED_*] tokens", () => {
    const { record } = redactRecord(
      { ssn: "123-45-6789" },
      { strategy: "tokenize" },
    );
    expect(record.ssn).toMatch(/^\[REDACTED_SSN_\d+\]$/);
  });

  it("same value across records gets same token", () => {
    const { records } = redactRecords(
      [
        { id: 1, ssn: "111-11-1111" },
        { id: 2, ssn: "111-11-1111" },
        { id: 3, ssn: "222-22-2222" },
      ],
      { strategy: "tokenize" },
    );
    expect(records[0].ssn).toBe(records[1].ssn);
    expect(records[0].ssn).not.toBe(records[2].ssn);
  });
});

describe("redactRecord — strategy: nullify", () => {
  it("replaces with null", () => {
    const { record } = redactRecord(
      { ssn: "123-45-6789", name: "A" },
      { strategy: "nullify" },
    );
    expect(record.ssn).toBeNull();
    expect(record.name).toBe("A");
  });
});

describe("redactRecords — batch + report", () => {
  it("aggregates counts across records", () => {
    const { report } = redactRecords([
      { id: 1, ssn: "123-45-6789", password: "foo" },
      { id: 2, ssn: "987-65-4321" },
      { id: 3, api_key: "abcdef1234567890abcdef12345" },
    ]);
    expect(report.redactedCount).toBe(4);
    expect(report.byCategory.ssn).toBe(2);
    expect(report.byCategory.password).toBe(1);
    expect(report.byCategory.api_key).toBe(1);
  });

  it("reports unique field names", () => {
    const { report } = redactRecords([
      { id: 1, ssn: "123-45-6789" },
      { id: 2, ssn: "987-65-4321" },
      { id: 3, password: "foo" },
    ]);
    expect(report.fields).toContain("ssn");
    expect(report.fields).toContain("password");
    expect(report.fields.length).toBe(2);
  });
});

describe("redactRecord — customRules", () => {
  it("accepts user-defined rules", () => {
    const { record, report } = redactRecord(
      { employee_id: "EMP-12345" },
      {
        customRules: [
          {
            category: "passport",
            fieldNames: [/employee_id/],
          },
        ],
      },
    );
    expect(record.employee_id).not.toBe("EMP-12345");
    expect(report.byCategory.passport).toBe(1);
  });
});

describe("summarizeRedaction", () => {
  it("returns 'no sensitive data' for empty report", () => {
    const { report } = redactRecord({ name: "Alice" });
    expect(summarizeRedaction(report)).toContain("No sensitive data");
  });

  it("produces compact summary with categories", () => {
    const { report } = redactRecord({ ssn: "123-45-6789", password: "foo" });
    const summary = summarizeRedaction(report);
    expect(summary).toContain("redacted");
    expect(summary).toContain("ssn=1");
  });
});
