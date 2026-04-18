/**
 * Plaid Adapter — Paid (Stub)
 *
 * Pass 121: Plaid Link integration for account aggregation.
 * This is a stub that checks for PLAID_CLIENT_ID and PLAID_SECRET
 * and provides health status. Full implementation requires Plaid Link
 * on the frontend and webhook handling on the backend.
 */

import type { FinancialDataAdapter, AdapterHealth, AdapterQueryResult } from "../types";

function getConfig() {
  return {
    clientId: process.env.PLAID_CLIENT_ID || undefined,
    secret: process.env.PLAID_SECRET || undefined,
    env: process.env.PLAID_ENV || "sandbox",
  };
}

export const plaidAdapter: FinancialDataAdapter = {
  id: "plaid",
  name: "Plaid",
  description: "Bank account aggregation, transactions, and identity verification",
  tier: "paid",
  requiresKey: true,
  supportedActions: ["create_link_token", "exchange_public_token", "get_accounts", "get_transactions"],

  async healthCheck(): Promise<AdapterHealth> {
    const cfg = getConfig();
    if (!cfg.clientId || !cfg.secret) {
      return {
        adapterId: "plaid", name: "Plaid", status: "not_configured",
        lastChecked: Date.now(), tier: "paid", requiresKey: true, keyConfigured: false,
        message: "PLAID_CLIENT_ID and PLAID_SECRET not set. Sign up at plaid.com",
      };
    }
    try {
      const start = Date.now();
      // Verify credentials by calling /institutions/get with minimal params
      const res = await fetch(`https://${cfg.env}.plaid.com/institutions/get`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: cfg.clientId,
          secret: cfg.secret,
          count: 1,
          offset: 0,
          country_codes: ["US"],
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`Plaid API error: ${res.status}`);
      return {
        adapterId: "plaid", name: "Plaid", status: "healthy",
        lastChecked: Date.now(), latencyMs: Date.now() - start,
        tier: "paid", requiresKey: true, keyConfigured: true,
      };
    } catch (err) {
      return {
        adapterId: "plaid", name: "Plaid", status: "degraded",
        lastChecked: Date.now(), tier: "paid", requiresKey: true, keyConfigured: true,
        message: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },

  async query(action: string, params: Record<string, unknown>): Promise<AdapterQueryResult> {
    const cfg = getConfig();
    if (!cfg.clientId || !cfg.secret) {
      throw new Error("Plaid not configured. Set PLAID_CLIENT_ID and PLAID_SECRET.");
    }

    const baseUrl = `https://${cfg.env}.plaid.com`;

    switch (action) {
      case "create_link_token": {
        const userId = String(params.userId || "");
        const res = await fetch(`${baseUrl}/link/token/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: cfg.clientId,
            secret: cfg.secret,
            user: { client_user_id: userId },
            client_name: "WealthBridge AI",
            products: ["transactions"],
            country_codes: ["US"],
            language: "en",
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) throw new Error(`Plaid link/token/create error: ${res.status}`);
        const data = await res.json();
        return { data: { linkToken: data.link_token, expiration: data.expiration }, source: "Plaid", adapterId: "plaid" };
      }
      case "exchange_public_token": {
        const publicToken = String(params.publicToken || "");
        const res = await fetch(`${baseUrl}/item/public_token/exchange`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: cfg.clientId,
            secret: cfg.secret,
            public_token: publicToken,
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) throw new Error(`Plaid token exchange error: ${res.status}`);
        const data = await res.json();
        return { data: { accessToken: data.access_token, itemId: data.item_id }, source: "Plaid", adapterId: "plaid" };
      }
      case "get_accounts": {
        const accessToken = String(params.accessToken || "");
        const res = await fetch(`${baseUrl}/accounts/get`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: cfg.clientId,
            secret: cfg.secret,
            access_token: accessToken,
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) throw new Error(`Plaid accounts/get error: ${res.status}`);
        const data = await res.json();
        return { data: data.accounts || [], source: "Plaid", adapterId: "plaid" };
      }
      case "get_transactions": {
        const accessToken = String(params.accessToken || "");
        const startDate = String(params.startDate || "");
        const endDate = String(params.endDate || "");
        const res = await fetch(`${baseUrl}/transactions/get`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: cfg.clientId,
            secret: cfg.secret,
            access_token: accessToken,
            start_date: startDate,
            end_date: endDate,
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) throw new Error(`Plaid transactions/get error: ${res.status}`);
        const data = await res.json();
        return { data: data.transactions || [], source: "Plaid", adapterId: "plaid" };
      }
      default:
        throw new Error(`Plaid adapter: unsupported action '${action}'`);
    }
  },
};
