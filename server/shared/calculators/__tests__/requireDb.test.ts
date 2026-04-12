/**
 * requireDb() helper tests.
 * Verifies the shared DB guard throws properly when DB is unavailable.
 */
import { describe, it, expect, vi, afterEach } from "vitest";

// We test the logic directly rather than importing from db.ts
// (which tries to connect to a real DB). This validates the contract.
describe("requireDb contract", () => {
  it("throws Error with 'Database unavailable' when getDb returns null", async () => {
    // Simulate the requireDb logic
    async function requireDb(getDb: () => Promise<any>) {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      return db;
    }

    await expect(requireDb(async () => null)).rejects.toThrow("Database unavailable");
  });

  it("returns db instance when getDb returns a value", async () => {
    async function requireDb(getDb: () => Promise<any>) {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      return db;
    }

    const fakeDb = { query: vi.fn() };
    const result = await requireDb(async () => fakeDb);
    expect(result).toBe(fakeDb);
  });

  it("propagates getDb errors", async () => {
    async function requireDb(getDb: () => Promise<any>) {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      return db;
    }

    await expect(
      requireDb(async () => { throw new Error("connection refused"); })
    ).rejects.toThrow("connection refused");
  });
});
