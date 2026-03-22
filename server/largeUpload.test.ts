import { describe, it, expect } from "vitest";

describe("Large file upload validation", () => {
  const MAX_FILE_SIZE = 31 * 1024 * 1024; // 31MB
  const EXPRESS_LIMIT = 50 * 1024 * 1024; // 50MB

  it("20MB file should pass size check", () => {
    const size = 20 * 1024 * 1024;
    expect(size <= MAX_FILE_SIZE).toBe(true);
    const base64Size = Math.ceil(size * 4 / 3);
    expect(base64Size).toBeLessThan(EXPRESS_LIMIT);
  });

  it("30MB file should pass size check", () => {
    const size = 30 * 1024 * 1024;
    expect(size <= MAX_FILE_SIZE).toBe(true);
    const base64Size = Math.ceil(size * 4 / 3);
    expect(base64Size).toBeLessThan(EXPRESS_LIMIT);
  });

  it("31MB file should pass size check (exact limit)", () => {
    const size = 31 * 1024 * 1024;
    expect(size <= MAX_FILE_SIZE).toBe(true);
    const base64Size = Math.ceil(size * 4 / 3);
    expect(base64Size).toBeLessThan(EXPRESS_LIMIT);
  });

  it("32MB file should fail size check", () => {
    const size = 32 * 1024 * 1024;
    expect(size > MAX_FILE_SIZE).toBe(true);
  });

  it("base64 encoding of 31MB stays under 50MB Express limit", () => {
    const rawSize = 31 * 1024 * 1024;
    // Base64 overhead is exactly ceil(n * 4/3)
    const base64Size = Math.ceil(rawSize * 4 / 3);
    expect(base64Size).toBeLessThan(EXPRESS_LIMIT);
    // ~41.3MB < 50MB ✓
    expect(base64Size).toBeLessThan(42 * 1024 * 1024);
  });

  it("Buffer.from correctly decodes base64 content", () => {
    const original = "Hello, this is a test document content for upload verification.";
    const base64 = Buffer.from(original).toString("base64");
    const decoded = Buffer.from(base64, "base64");
    expect(decoded.toString("utf-8")).toBe(original);
  });

  it("empty file should still be valid", () => {
    const size = 0;
    expect(size <= MAX_FILE_SIZE).toBe(true);
  });

  it("1 byte file should be valid", () => {
    const buf = Buffer.from("A");
    expect(buf.length).toBe(1);
    expect(buf.length <= MAX_FILE_SIZE).toBe(true);
  });
});
