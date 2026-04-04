import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  tenantId: number | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  // Tenant ID from user's affiliated organization — available in ctx.tenantId
  // for all tRPC procedures. Use ctx.tenantId in queries to enforce row-level isolation.
  // AsyncLocalStorage (runWithTenant) is used at the Express middleware level
  // for non-tRPC routes (SSE streaming, MCP, webhooks).
  const tenantId = user?.affiliateOrgId ?? null;

  return {
    req: opts.req,
    res: opts.res,
    user,
    tenantId,
  };
}
