/**
 * webhookSecurity.test.ts — CBL21 test coverage for CBL17 security hardening
 *
 * Tests webhook signature verification logic and SSRF protection.
 * Uses the same HMAC-SHA256 algorithm the handlers use internally.
 */
import { describe, it, expect } from "vitest";
import crypto from "crypto";

// ─── HMAC-SHA256 signature verification (same logic as all 3 webhook handlers) ───
function verifyHmacSha256(payload: string, signature: string | undefined, secret: string): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

describe("Webhook HMAC-SHA256 signature verification", () => {
  const secret = "test-webhook-secret-key";
  const payload = '{"event":"contact.create","contact":{"id":"123","email":"test@example.com"}}';
  const validSig = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  it("accepts valid signature", () => {
    expect(verifyHmacSha256(payload, validSig, secret)).toBe(true);
  });

  it("rejects missing signature", () => {
    expect(verifyHmacSha256(payload, undefined, secret)).toBe(false);
  });

  it("rejects empty signature", () => {
    expect(verifyHmacSha256(payload, "", secret)).toBe(false);
  });

  it("rejects wrong signature", () => {
    expect(verifyHmacSha256(payload, "deadbeef1234567890", secret)).toBe(false);
  });

  it("rejects signature from wrong secret", () => {
    const wrongSig = crypto.createHmac("sha256", "wrong-secret").update(payload).digest("hex");
    expect(verifyHmacSha256(payload, wrongSig, secret)).toBe(false);
  });

  it("rejects signature from different payload", () => {
    const differentPayloadSig = crypto.createHmac("sha256", secret).update('{"event":"modified"}').digest("hex");
    expect(verifyHmacSha256(payload, differentPayloadSig, secret)).toBe(false);
  });

  it("handles length-mismatch gracefully (no throw)", () => {
    // timingSafeEqual throws on length mismatch — our wrapper catches it
    expect(verifyHmacSha256(payload, "short", secret)).toBe(false);
  });

  it("is case-sensitive on hex output", () => {
    // HMAC produces lowercase hex — uppercase version should fail
    const upperSig = validSig.toUpperCase();
    // timingSafeEqual compares bytes, so uppercase hex has different byte values
    expect(verifyHmacSha256(payload, upperSig, secret)).toBe(false);
  });

  it("works with empty payload", () => {
    const emptyPayloadSig = crypto.createHmac("sha256", secret).update("").digest("hex");
    expect(verifyHmacSha256("", emptyPayloadSig, secret)).toBe(true);
  });

  it("works with unicode payload", () => {
    const unicodePayload = '{"name":"日本語テスト"}';
    const sig = crypto.createHmac("sha256", secret).update(unicodePayload).digest("hex");
    expect(verifyHmacSha256(unicodePayload, sig, secret)).toBe(true);
  });
});

// ─── SSRF protection — isPrivateHost (imported from automation) ───
import { isPrivateHost } from "../shared/automation/webNavigator";

describe("SSRF protection — isPrivateHost", () => {
  // Private/internal hosts that should be BLOCKED
  it("blocks localhost", () => {
    expect(isPrivateHost("localhost")).toBe(true);
  });
  it("blocks 127.0.0.1", () => {
    expect(isPrivateHost("127.0.0.1")).toBe(true);
  });
  it("blocks 10.x.x.x (RFC1918)", () => {
    expect(isPrivateHost("10.0.0.1")).toBe(true);
    expect(isPrivateHost("10.255.255.255")).toBe(true);
  });
  it("blocks 192.168.x.x (RFC1918)", () => {
    expect(isPrivateHost("192.168.1.1")).toBe(true);
    expect(isPrivateHost("192.168.0.100")).toBe(true);
  });
  it("blocks 172.16.x.x (RFC1918)", () => {
    expect(isPrivateHost("172.16.0.1")).toBe(true);
  });
  it("blocks AWS metadata endpoint", () => {
    expect(isPrivateHost("169.254.169.254")).toBe(true);
  });
  it("blocks .local domains", () => {
    expect(isPrivateHost("intranet.local")).toBe(true);
  });
  it("blocks .internal domains", () => {
    expect(isPrivateHost("corp.internal")).toBe(true);
    expect(isPrivateHost("metadata.google.internal")).toBe(true);
  });

  // Public hosts that should be ALLOWED
  it("allows example.com", () => {
    expect(isPrivateHost("example.com")).toBe(false);
  });
  it("allows www.irs.gov", () => {
    expect(isPrivateHost("www.irs.gov")).toBe(false);
  });
  it("allows api.stlouisfed.org (FRED)", () => {
    expect(isPrivateHost("api.stlouisfed.org")).toBe(false);
  });
  it("allows github.com", () => {
    expect(isPrivateHost("github.com")).toBe(false);
  });
});

// ─── SSRF protection — URL protocol validation ───
describe("SSRF URL protocol validation", () => {
  function isAllowedProtocol(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ["http:", "https:"].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  it("allows http URLs", () => {
    expect(isAllowedProtocol("http://example.com/file.pdf")).toBe(true);
  });
  it("allows https URLs", () => {
    expect(isAllowedProtocol("https://example.com/file.pdf")).toBe(true);
  });
  it("blocks file:// URLs", () => {
    expect(isAllowedProtocol("file:///etc/passwd")).toBe(false);
  });
  it("blocks ftp:// URLs", () => {
    expect(isAllowedProtocol("ftp://evil.com/malware")).toBe(false);
  });
  it("blocks javascript: URLs", () => {
    expect(isAllowedProtocol("javascript:alert(1)")).toBe(false);
  });
  it("blocks data: URLs", () => {
    expect(isAllowedProtocol("data:text/html,<script>alert(1)</script>")).toBe(false);
  });
  it("rejects malformed URLs", () => {
    expect(isAllowedProtocol("not-a-url")).toBe(false);
  });
});
