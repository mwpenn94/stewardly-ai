import { describe, it, expect } from "vitest";
import crypto from "crypto";

describe("GHL_WEBHOOK_SECRET validation", () => {
  it("GHL_WEBHOOK_SECRET is set and non-empty", () => {
    const secret = process.env.GHL_WEBHOOK_SECRET;
    expect(secret).toBeTruthy();
    expect(secret!.length).toBeGreaterThanOrEqual(20);
  });

  it("GHL_WEBHOOK_SECRET can produce valid HMAC-SHA256 signatures", () => {
    const secret = process.env.GHL_WEBHOOK_SECRET!;
    const testPayload = '{"type":"ContactCreate","data":{"id":"test"}}';
    const hmac = crypto.createHmac("sha256", secret).update(testPayload).digest("hex");
    expect(hmac).toBeTruthy();
    expect(hmac.length).toBe(64); // SHA-256 hex digest is always 64 chars

    // Verify the signature matches when recomputed
    const hmac2 = crypto.createHmac("sha256", secret).update(testPayload).digest("hex");
    expect(crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(hmac2))).toBe(true);
  });

  it("Ed25519 public key is valid and can be loaded", () => {
    const GHL_ED25519_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAoOF/3iMODmxMjAFy5uIbuLWqSQwlZ6EkF7VfOqBlHEM=
-----END PUBLIC KEY-----`;
    const keyObj = crypto.createPublicKey(GHL_ED25519_PUBLIC_KEY);
    expect(keyObj).toBeTruthy();
    expect(keyObj.type).toBe("public");
    expect(keyObj.asymmetricKeyType).toBe("ed25519");
  });
});
