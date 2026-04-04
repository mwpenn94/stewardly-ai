import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { runWithTenant } from "../shared/tenantContext";

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

  const tenantId = user?.affiliateOrgId ?? null;

  // Establish AsyncLocalStorage tenant context for downstream queries
  if (tenantId != null && user) {
    runWithTenant({ tenantId, userId: user.id }, () => {});
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    tenantId,
  };
}
