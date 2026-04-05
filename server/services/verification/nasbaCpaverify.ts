/**
 * NASBA CPAverify — CPA credential verification
 * ToS-GATED: Conservative rate limit (2 requests per minute).
 * Manual verification: https://cpaverify.org
 */
import { logger } from "../../_core/logger";

const log = logger.child({ module: "nasbaCpaverify" });

export interface CpaVerificationResult {
  status: "verified" | "not_found" | "tos_blocked" | "error";
  licenseNumber?: string;
  state?: string;
  name?: string;
  licenseStatus?: string;
  expirationDate?: string;
  message: string;
}

export async function verifyCpa(name: string, state?: string, licenseNumber?: string): Promise<CpaVerificationResult> {
  log.info({ name: name.slice(0, 3) + "***", state }, "CPA verification requested (ToS-gated)");

  return {
    status: "tos_blocked",
    name,
    state,
    licenseNumber,
    message: "NASBA CPAverify has a conservative rate limit (2 rpm) and requires ToS acceptance. " +
      "Manual verification available at https://cpaverify.org. " +
      "For bulk verification, contact NASBA for API partnership.",
  };
}

export function isCpaVerifyAvailable(): boolean {
  return !!process.env.NASBA_API_KEY;
}
