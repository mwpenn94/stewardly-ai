/**
 * SnapTrade Service — Per-user brokerage connection management.
 *
 * Architecture:
 * - Platform stores ONE clientId + consumerKey (via integration_connections for "snaptrade" provider)
 * - Each end-user gets their own SnapTrade user (snaptrade_users table)
 * - Users connect brokerages via the SnapTrade Connection Portal
 * - Higher roles (advisor/manager/admin) can view associated clients' connection status
 */
import { Snaptrade } from "snaptrade-typescript-sdk";
import { requireDb } from "../db";
import {
  snapTradeUsers,
  snapTradeBrokerageConnections,
  snapTradeAccounts,
  snapTradePositions,
  integrationProviders,
  integrationConnections,
} from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "./encryption";
import { ENV } from "../_core/env";
import crypto from "crypto";

const uuid = () => crypto.randomUUID();

// ─── Platform Credentials ─────────────────────────────────────────────
let _snaptradeClient: Snaptrade | null = null;

/**
 * Get the platform-level SnapTrade clientId + consumerKey.
 * Priority: ENV vars > integration_connections table (DB fallback).
 */
async function getPlatformCredentials(): Promise<{ clientId: string; consumerKey: string } | null> {
  // 1. Check ENV vars first (set via webdev_request_secrets)
  if (ENV.snapTradeClientId && ENV.snapTradeConsumerKey) {
    return { clientId: ENV.snapTradeClientId, consumerKey: ENV.snapTradeConsumerKey };
  }

  // 2. Fallback: check DB integration_connections
  const db = await requireDb();
  const providers = await db.select().from(integrationProviders)
    .where(eq(integrationProviders.slug, "snaptrade"));
  if (!providers.length) return null;

  const connections = await db.select().from(integrationConnections)
    .where(eq(integrationConnections.providerId, providers[0].id));

  for (const conn of connections) {
    if (conn.credentialsEncrypted) {
      try {
        const creds = JSON.parse(decrypt(conn.credentialsEncrypted));
        const clientId = creds.client_id || creds.clientId || "";
        const consumerKey = creds.consumer_key || creds.consumerKey || creds.api_key || creds.apiKey || "";
        if (clientId && consumerKey) return { clientId, consumerKey };
      } catch { /* skip bad creds */ }
    }
  }
  return null;
}

/**
 * Get or create a SnapTrade SDK client using platform credentials.
 */
async function getClient(): Promise<Snaptrade> {
  if (_snaptradeClient) return _snaptradeClient;

  const creds = await getPlatformCredentials();
  if (!creds) {
    throw new Error("SnapTrade platform credentials not configured. An admin must connect SnapTrade with clientId + consumerKey in the Integrations page.");
  }

  _snaptradeClient = new Snaptrade({
    clientId: creds.clientId,
    consumerKey: creds.consumerKey,
  });
  return _snaptradeClient;
}

/** Reset cached client (e.g., after credentials change). */
export function resetSnapTradeClient() {
  _snaptradeClient = null;
}

// ─── User Registration ────────────────────────────────────────────────

/**
 * Register a user with SnapTrade (or return existing registration).
 * Each app user gets a unique SnapTrade user identity.
 */
export async function registerSnapTradeUser(userId: number): Promise<{
  snapTradeUserId: string;
  isNew: boolean;
}> {
  const db = await requireDb();

  // Check for existing registration
  const existing = await db.select().from(snapTradeUsers)
    .where(and(eq(snapTradeUsers.userId, userId), eq(snapTradeUsers.status, "active")));

  if (existing.length > 0) {
    return { snapTradeUserId: existing[0].snapTradeUserId, isNew: false };
  }

  // Register with SnapTrade
  const client = await getClient();
  const snapUserId = `stewardly-user-${userId}`;

  const response = await client.authentication.registerSnapTradeUser({
    userId: snapUserId,
  });

  const userSecret = response.data?.userSecret;
  if (!userSecret) {
    throw new Error("SnapTrade registration failed — no userSecret returned");
  }

  // Store encrypted
  const id = uuid();
  await db.insert(snapTradeUsers).values({
    id,
    userId,
    snapTradeUserId: snapUserId,
    snapTradeUserSecretEncrypted: encrypt(userSecret),
    status: "active",
  });

  return { snapTradeUserId: snapUserId, isNew: true };
}

/**
 * Get the SnapTrade user credentials for API calls.
 */
async function getSnapTradeUserCreds(userId: number): Promise<{
  snapTradeUserId: string;
  userSecret: string;
}> {
  const db = await requireDb();
  const rows = await db.select().from(snapTradeUsers)
    .where(and(eq(snapTradeUsers.userId, userId), eq(snapTradeUsers.status, "active")));

  if (!rows.length) {
    throw new Error("User not registered with SnapTrade. Please register first.");
  }

  return {
    snapTradeUserId: rows[0].snapTradeUserId,
    userSecret: decrypt(rows[0].snapTradeUserSecretEncrypted),
  };
}

// ─── Connection Portal ────────────────────────────────────────────────

/**
 * Generate a Connection Portal URL for a user to connect their brokerage.
 */
export async function getConnectionPortalUrl(
  userId: number,
  customRedirect?: string
): Promise<{ redirectUrl: string }> {
  // Ensure user is registered
  await registerSnapTradeUser(userId);

  const client = await getClient();
  const { snapTradeUserId, userSecret } = await getSnapTradeUserCreds(userId);

  const response = await client.authentication.loginSnapTradeUser({
    userId: snapTradeUserId,
    userSecret,
    ...(customRedirect ? { customRedirect } : {}),
  });

  // The SDK returns different shapes depending on version; access safely
  const data = response.data as any;
  const redirectUrl = data?.redirectURI || data?.loginRedirectURI || data?.redirectUri || data?.redirect_uri || "";
  if (!redirectUrl) {
    throw new Error("Failed to generate Connection Portal URL");
  }

  return { redirectUrl: String(redirectUrl) };
}

// ─── Brokerage Connections ────────────────────────────────────────────

/**
 * Sync brokerage connections from SnapTrade for a user.
 * Fetches the latest connections and updates our local DB.
 */
export async function syncBrokerageConnections(userId: number): Promise<{
  connections: Array<{
    id: string;
    brokerageName: string | null;
    brokerageType: string | null;
    status: string;
  }>;
  synced: number;
}> {
  const client = await getClient();
  const { snapTradeUserId, userSecret } = await getSnapTradeUserCreds(userId);
  const db = await requireDb();

  // Fetch connections from SnapTrade
  const response = await client.connections.listBrokerageAuthorizations({
    userId: snapTradeUserId,
    userSecret,
  });

  const remoteConnections = response.data || [];
  const results: Array<{ id: string; brokerageName: string | null; brokerageType: string | null; status: string }> = [];

  // Get existing local connections for this user
  const stUser = await db.select().from(snapTradeUsers)
    .where(and(eq(snapTradeUsers.userId, userId), eq(snapTradeUsers.status, "active")));
  if (!stUser.length) return { connections: [], synced: 0 };

  for (const rc of remoteConnections) {
    const authId = String(rc.id || "");
    if (!authId) continue;

    const brokerageName = rc.brokerage?.name || null;
    const brokerageType = rc.type || null;
    const isDisabled = rc.disabled === true;
    const status = isDisabled ? "disabled" : "active";

    // Upsert local record
    const existing = await db.select().from(snapTradeBrokerageConnections)
      .where(and(
        eq(snapTradeBrokerageConnections.userId, userId),
        eq(snapTradeBrokerageConnections.brokerageAuthorizationId, authId)
      ));

    if (existing.length > 0) {
      await db.update(snapTradeBrokerageConnections)
        .set({
          brokerageName,
          brokerageType: brokerageType as string | null,
          status: status as "active" | "disabled" | "error" | "deleted",
          disabledReason: isDisabled ? (rc.disabledDate ? `Disabled since ${rc.disabledDate}` : "Connection disabled") : null,
          lastSyncAt: new Date(),
          lastSyncStatus: "success",
        })
        .where(eq(snapTradeBrokerageConnections.id, existing[0].id));
      results.push({ id: existing[0].id, brokerageName, brokerageType: brokerageType as string | null, status });
    } else {
      const id = uuid();
      await db.insert(snapTradeBrokerageConnections).values({
        id,
        userId,
        snapTradeUserId: stUser[0].id,
        brokerageAuthorizationId: authId,
        brokerageName,
        brokerageType: brokerageType as string | null,
        status: status as "active" | "disabled" | "error" | "deleted",
        lastSyncAt: new Date(),
        lastSyncStatus: "success",
      });
      results.push({ id, brokerageName, brokerageType: brokerageType as string | null, status });
    }
  }

  return { connections: results, synced: results.length };
}

// ─── Account & Position Sync ──────────────────────────────────────────

/**
 * Sync all accounts and positions for a user from SnapTrade.
 */
export async function syncAccountsAndPositions(userId: number): Promise<{
  accounts: number;
  positions: number;
}> {
  const client = await getClient();
  const { snapTradeUserId, userSecret } = await getSnapTradeUserCreds(userId);
  const db = await requireDb();

  // Fetch accounts
  const accountsResp = await client.accountInformation.listUserAccounts({
    userId: snapTradeUserId,
    userSecret,
  });

  const remoteAccounts = accountsResp.data || [];
  let accountCount = 0;
  let positionCount = 0;

  // Get local connections to link accounts
  const localConns = await db.select().from(snapTradeBrokerageConnections)
    .where(eq(snapTradeBrokerageConnections.userId, userId));
  const connMap = new Map(localConns.map(c => [c.brokerageAuthorizationId, c.id]));

  for (const acct of remoteAccounts) {
    const stAccountId = String(acct.id || "");
    if (!stAccountId) continue;

    // Find the local connection this account belongs to
    const authId = String((acct as any).brokerage_authorization?.id || "");
    const connectionId = connMap.get(authId) || localConns[0]?.id || "";

    const accountName = acct.name || null;
    const accountNumber = acct.number || null;
    const accountType = (acct as any).meta?.type || null;
    const institutionName = (acct as any).institution_name || null;

    // Get balance info
    let cashBalance: string | null = null;
    let marketValue: string | null = null;
    let totalValue: string | null = null;
    try {
      const balResp = await client.accountInformation.getUserAccountBalance({
        userId: snapTradeUserId,
        userSecret,
        accountId: stAccountId,
      });
      const balances = balResp.data || [];
      for (const b of balances) {
        if (b.currency?.code === "USD" || !b.currency) {
          cashBalance = String(b.cash || 0);
          // totalValue from balance
        }
      }
    } catch { /* balance fetch optional */ }

    // Upsert account
    const existingAcct = await db.select().from(snapTradeAccounts)
      .where(and(
        eq(snapTradeAccounts.userId, userId),
        eq(snapTradeAccounts.snapTradeAccountId, stAccountId)
      ));

    let localAccountId: string;
    if (existingAcct.length > 0) {
      localAccountId = existingAcct[0].id;
      await db.update(snapTradeAccounts)
        .set({
          accountName, accountNumber, accountType, institutionName,
          cashBalance, marketValue, totalValue,
          lastSyncAt: new Date(),
          syncDataJson: acct as any,
        })
        .where(eq(snapTradeAccounts.id, localAccountId));
    } else {
      localAccountId = uuid();
      await db.insert(snapTradeAccounts).values({
        id: localAccountId,
        userId,
        connectionId,
        snapTradeAccountId: stAccountId,
        accountName, accountNumber, accountType, institutionName,
        cashBalance, marketValue, totalValue,
        currency: "USD",
        lastSyncAt: new Date(),
        syncDataJson: acct as any,
      });
    }
    accountCount++;

    // Fetch positions for this account
    try {
      const posResp = await client.accountInformation.getUserAccountPositions({
        userId: snapTradeUserId,
        userSecret,
        accountId: stAccountId,
      });

      const remotePositions = posResp.data || [];
      for (const pos of remotePositions) {
        const ticker = pos.symbol?.symbol?.symbol || null;
        const symbolName = pos.symbol?.symbol?.description || null;
        const symbolType = pos.symbol?.symbol?.type?.code || null;
        const units = pos.units != null ? String(pos.units) : null;
        const avgPrice = pos.averageEntryPrice != null ? String(pos.averageEntryPrice) : null;
        const curPrice = pos.price != null ? String(pos.price) : null;
        const mktValue = (pos.units && pos.price) ? String(Number(pos.units) * Number(pos.price)) : null;

        // Upsert position by account + ticker
        const existingPos = ticker ? await db.select().from(snapTradePositions)
          .where(and(
            eq(snapTradePositions.accountId, localAccountId),
            eq(snapTradePositions.symbolTicker, ticker)
          )) : [];

        if (existingPos.length > 0) {
          await db.update(snapTradePositions)
            .set({
              symbolName, symbolType, units, averagePrice: avgPrice, currentPrice: curPrice,
              marketValue: mktValue, rawJson: pos as any, lastSyncAt: new Date(),
            })
            .where(eq(snapTradePositions.id, existingPos[0].id));
        } else {
          await db.insert(snapTradePositions).values({
            id: uuid(),
            userId,
            accountId: localAccountId,
            symbolTicker: ticker,
            symbolName, symbolType, units, averagePrice: avgPrice, currentPrice: curPrice,
            marketValue: mktValue, currency: "USD", rawJson: pos as any, lastSyncAt: new Date(),
          });
        }
        positionCount++;
      }
    } catch { /* positions fetch optional */ }
  }

  return { accounts: accountCount, positions: positionCount };
}

// ─── Read Helpers ─────────────────────────────────────────────────────

/**
 * Get a user's SnapTrade registration status.
 */
export async function getSnapTradeStatus(userId: number): Promise<{
  registered: boolean;
  connectionsCount: number;
  accountsCount: number;
}> {
  const db = await requireDb();

  const stUser = await db.select().from(snapTradeUsers)
    .where(and(eq(snapTradeUsers.userId, userId), eq(snapTradeUsers.status, "active")));

  if (!stUser.length) {
    return { registered: false, connectionsCount: 0, accountsCount: 0 };
  }

  const connections = await db.select().from(snapTradeBrokerageConnections)
    .where(and(eq(snapTradeBrokerageConnections.userId, userId)));
  const activeConns = connections.filter(c => c.status === "active" || c.status === "disabled");

  const accounts = await db.select().from(snapTradeAccounts)
    .where(eq(snapTradeAccounts.userId, userId));

  return {
    registered: true,
    connectionsCount: activeConns.length,
    accountsCount: accounts.length,
  };
}

/**
 * Get all accounts for a user (local DB, no API call).
 */
export async function getUserAccounts(userId: number) {
  const db = await requireDb();
  return db.select().from(snapTradeAccounts)
    .where(eq(snapTradeAccounts.userId, userId));
}

/**
 * Get all positions for a user (local DB, no API call).
 */
export async function getUserPositions(userId: number) {
  const db = await requireDb();
  return db.select().from(snapTradePositions)
    .where(eq(snapTradePositions.userId, userId));
}

/**
 * Get all brokerage connections for a user (local DB).
 */
export async function getUserBrokerageConnections(userId: number) {
  const db = await requireDb();
  return db.select().from(snapTradeBrokerageConnections)
    .where(eq(snapTradeBrokerageConnections.userId, userId));
}

/**
 * Remove a brokerage connection (soft delete locally, remove from SnapTrade).
 */
export async function removeBrokerageConnection(userId: number, connectionId: string): Promise<boolean> {
  const db = await requireDb();
  const conn = await db.select().from(snapTradeBrokerageConnections)
    .where(and(
      eq(snapTradeBrokerageConnections.id, connectionId),
      eq(snapTradeBrokerageConnections.userId, userId)
    ));

  if (!conn.length) return false;

  // Try to remove from SnapTrade
  try {
    const client = await getClient();
    const { snapTradeUserId, userSecret } = await getSnapTradeUserCreds(userId);
    await client.connections.removeBrokerageAuthorization({
      userId: snapTradeUserId,
      userSecret,
      authorizationId: conn[0].brokerageAuthorizationId,
    });
  } catch { /* best effort */ }

  // Soft delete locally
  await db.update(snapTradeBrokerageConnections)
    .set({ status: "deleted" })
    .where(eq(snapTradeBrokerageConnections.id, connectionId));

  // Also remove associated accounts and positions
  const accounts = await db.select().from(snapTradeAccounts)
    .where(eq(snapTradeAccounts.connectionId, connectionId));
  for (const acct of accounts) {
    await db.delete(snapTradePositions).where(eq(snapTradePositions.accountId, acct.id));
  }
  await db.delete(snapTradeAccounts).where(eq(snapTradeAccounts.connectionId, connectionId));

  return true;
}

/**
 * Check if platform SnapTrade credentials are configured.
 */
export async function isPlatformConfigured(): Promise<boolean> {
  try {
    const creds = await getPlatformCredentials();
    return creds !== null;
  } catch {
    return false;
  }
}
