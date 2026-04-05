/**
 * CFP Board Verification — Certified Financial Planner credential check
 * ToS-GATED: CFP Board requires explicit authorization for automated lookups.
 * Manual verification: https://www.cfp.net/verify-a-cfp-professional
 */
import { logger } from "../../_core/logger";

const log = logger.child({ module: "cfpBoard" });

export interface CfpVerificationResult {
  status: "verified" | "not_found" | "tos_blocked" | "error";
  cfpId?: string;
  name?: string;
  certificationDate?: string;
  renewalDate?: string;
  disciplinaryHistory?: boolean;
  message: string;
}

/**
 * Verify CFP certification status.
 * Currently returns ToS-blocked status — automated lookups require CFP Board API agreement.
 */
export async function verifyCfp(name: string, _cfpId?: string): Promise<CfpVerificationResult> {
  log.info({ name: name.slice(0, 3) + "***" }, "CFP verification requested (ToS-gated)");

  return {
    status: "tos_blocked",
    name,
    message: "CFP Board automated verification requires explicit API authorization agreement. " +
      "Manual verification available at https://www.cfp.net/verify-a-cfp-professional. " +
      "Contact CFP Board at (800) 487-1497 for API access.",
  };
}

/**
 * Check if CFP Board API access is configured
 */
export function isCfpApiAvailable(): boolean {
  return !!process.env.CFP_BOARD_API_KEY;
}
