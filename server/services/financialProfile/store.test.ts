/**
 * Tests for the server-side financial profile store.
 *
 * These tests exercise the graceful-degradation paths (no DB) and
 * the sanitization the store wraps around the shared module. They
 * deliberately do NOT spin up a MySQL instance — that's covered
 * separately by the env-dependent integration test files.
 *
 * Without DATABASE_URL set, getDb() returns null, and every method
 * in the store should still return a sensible value (sanitized
 * patch / null) instead of throwing.
 */

import { describe, it, expect } from "vitest";
import {
  getProfile,
  setProfile,
  setProfileWithEvents,
  replaceProfile,
  deleteProfile,
} from "./store";

describe("financialProfile store / no-DB graceful degradation", () => {
  it("getProfile returns null without a DB", async () => {
    delete process.env.DATABASE_URL;
    const result = await getProfile(123);
    expect(result).toBeNull();
  });

  it("setProfile returns the sanitized patch without a DB", async () => {
    delete process.env.DATABASE_URL;
    const result = await setProfile(123, { age: 40, income: 120000 }, "user");
    expect(result).not.toBeNull();
    expect(result?.age).toBe(40);
    expect(result?.income).toBe(120000);
    expect(result?.source).toBe("user");
    expect(result?.updatedAt).toBeDefined();
  });

  it("setProfile clamps invalid values via the shared sanitizer", async () => {
    delete process.env.DATABASE_URL;
    const result = await setProfile(
      123,
      // @ts-expect-error — out of range values
      { age: -50, marginalRate: 5, dependents: 7.9 },
      "user",
    );
    expect(result?.age).toBe(0);
    expect(result?.marginalRate).toBe(0.55);
    expect(result?.dependents).toBe(8);
  });

  it("setProfile drops NaN and Infinity", async () => {
    delete process.env.DATABASE_URL;
    const result = await setProfile(
      123,
      // @ts-expect-error — invalid numerics
      { age: 40, income: Number.NaN, savings: Number.POSITIVE_INFINITY },
      "user",
    );
    expect(result?.age).toBe(40);
    expect(result?.income).toBeUndefined();
    expect(result?.savings).toBeUndefined();
  });

  it("setProfile tags the supplied source", async () => {
    delete process.env.DATABASE_URL;
    const result = await setProfile(
      456,
      { age: 30 },
      "quick_quote",
    );
    expect(result?.source).toBe("quick_quote");
  });

  it("replaceProfile returns the sanitized profile without a DB", async () => {
    delete process.env.DATABASE_URL;
    const result = await replaceProfile(
      789,
      { age: 50, income: 200000, isBizOwner: true },
      "csv_import",
    );
    expect(result?.age).toBe(50);
    expect(result?.income).toBe(200000);
    expect(result?.isBizOwner).toBe(true);
    expect(result?.source).toBe("csv_import");
  });

  it("deleteProfile is a no-op without a DB and does not throw", async () => {
    delete process.env.DATABASE_URL;
    await expect(deleteProfile(999)).resolves.toBeUndefined();
  });

  it("setProfileWithEvents returns sanitized patch and empty events without a DB", async () => {
    delete process.env.DATABASE_URL;
    const result = await setProfileWithEvents(
      111,
      { age: 40, income: 120000 },
      "user",
    );
    expect(result.profile?.age).toBe(40);
    // Without a DB we can't read the prior snapshot, so no events fire.
    expect(result.events).toEqual([]);
  });
});
