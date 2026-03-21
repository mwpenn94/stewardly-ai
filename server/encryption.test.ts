import { describe, it, expect } from "vitest";
import { encrypt, decrypt, encryptCredentials, decryptCredentials } from "./services/encryption";

describe("Integration Encryption (INTEGRATION_ENCRYPTION_KEY)", () => {
  it("should encrypt and decrypt a string roundtrip", () => {
    const plaintext = "test-api-key-12345";
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted.length).toBeGreaterThan(0);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("should encrypt and decrypt credentials object roundtrip", () => {
    const creds = {
      apiKey: "sk-test-abc123",
      clientId: "client-456",
      clientSecret: "secret-789",
    };
    const encrypted = encryptCredentials(creds);
    expect(typeof encrypted).toBe("string");
    expect(encrypted).not.toContain("sk-test-abc123");
    const decrypted = decryptCredentials(encrypted);
    expect(decrypted).toEqual(creds);
  });

  it("should produce different ciphertexts for the same input (random IV)", () => {
    const plaintext = "same-input";
    const enc1 = encrypt(plaintext);
    const enc2 = encrypt(plaintext);
    expect(enc1).not.toBe(enc2);
    expect(decrypt(enc1)).toBe(plaintext);
    expect(decrypt(enc2)).toBe(plaintext);
  });
});
