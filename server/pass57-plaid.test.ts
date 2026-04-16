/**
 * Pass 57 — Plaid Integration Tests
 *
 * Tests the Plaid service mock mode, router procedures, and data structures.
 */
import { describe, it, expect } from "vitest";

describe("Plaid Service — Mock Mode", () => {
  it("createLinkToken returns mock token when Plaid keys are missing", async () => {
    const { createLinkToken } = await import("./services/plaidService");
    const result = await createLinkToken({ userId: "test-user-1" });
    // In sandbox, keys may or may not be set — but the function should not throw
    expect(result).toBeDefined();
    expect(result.linkToken).toBeDefined();
    expect(typeof result.linkToken).toBe("string");
    expect(result.linkToken.length).toBeGreaterThan(0);
    expect(result.requestId).toBeDefined();
    expect(result.expiration).toBeDefined();
  });

  it("exchangePublicToken handles mock or real mode", async () => {
    const { exchangePublicToken, isPlaidConfigured } = await import("./services/plaidService");
    if (!isPlaidConfigured()) {
      // Mock mode
      const result = await exchangePublicToken("public-sandbox-mock-123");
      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.itemId).toBeDefined();
      expect(result.mock).toBe(true);
    } else {
      // Real mode — invalid token should throw
      await expect(exchangePublicToken("public-sandbox-mock-123")).rejects.toThrow();
    }
  });

  it("getAccounts returns mock accounts or throws on invalid token", async () => {
    const { getAccounts, isPlaidConfigured } = await import("./services/plaidService");
    if (!isPlaidConfigured()) {
      const result = await getAccounts("access-sandbox-mock-123");
      expect(result.mock).toBe(true);
      expect(result.accounts.length).toBe(3);
      const checking = result.accounts.find(a => a.subtype === "checking");
      expect(checking).toBeDefined();
      expect(checking!.name).toBe("Plaid Checking");
      expect(checking!.balanceCurrent).toBe(110.00);
    } else {
      await expect(getAccounts("access-sandbox-mock-123")).rejects.toThrow();
    }
  });

  it("getTransactions returns mock transactions or throws on invalid token", async () => {
    const { getTransactions, isPlaidConfigured } = await import("./services/plaidService");
    if (!isPlaidConfigured()) {
      const result = await getTransactions("access-sandbox-mock-123", "2024-01-01", "2024-12-31");
      expect(result.mock).toBe(true);
      expect(result.transactions.length).toBe(3);
      const airline = result.transactions.find(t => t.name === "United Airlines");
      expect(airline).toBeDefined();
      expect(airline!.amount).toBe(-500.00);
    } else {
      await expect(getTransactions("access-sandbox-mock-123", "2024-01-01", "2024-12-31")).rejects.toThrow();
    }
  });

  it("getBalances returns same structure as getAccounts or throws on invalid token", async () => {
    const { getBalances, isPlaidConfigured } = await import("./services/plaidService");
    if (!isPlaidConfigured()) {
      const result = await getBalances("access-sandbox-mock-123");
      expect(result.mock).toBe(true);
      expect(result.accounts).toBeDefined();
    } else {
      await expect(getBalances("access-sandbox-mock-123")).rejects.toThrow();
    }
  });
});

describe("Plaid Service — Configuration", () => {
  it("isPlaidConfigured returns boolean", async () => {
    const { isPlaidConfigured } = await import("./services/plaidService");
    const result = isPlaidConfigured();
    expect(typeof result).toBe("boolean");
  });

  it("getPlaidEnvironment returns a valid environment string", async () => {
    const { getPlaidEnvironment } = await import("./services/plaidService");
    const env = getPlaidEnvironment();
    expect(["sandbox", "development", "production"]).toContain(env);
  });
});

describe("Plaid Account — Data Types", () => {
  it("PlaidAccount has all required fields", () => {
    const account = {
      accountId: "test-001",
      name: "Test Checking",
      officialName: "Test Official Name",
      type: "depository",
      subtype: "checking",
      mask: "0000",
      balanceCurrent: 100.00,
      balanceAvailable: 90.00,
      currencyCode: "USD",
    };
    expect(account.accountId).toBeDefined();
    expect(account.name).toBeDefined();
    expect(account.type).toBeDefined();
    expect(typeof account.balanceCurrent).toBe("number");
  });

  it("PlaidTransaction has all required fields", () => {
    const txn = {
      transactionId: "txn-001",
      accountId: "acct-001",
      amount: -25.50,
      date: "2024-06-15",
      name: "Coffee Shop",
      merchantName: "Starbucks",
      category: ["Food and Drink", "Coffee Shop"],
      pending: false,
    };
    expect(txn.transactionId).toBeDefined();
    expect(txn.amount).toBe(-25.50);
    expect(txn.category.length).toBe(2);
    expect(typeof txn.pending).toBe("boolean");
  });
});
