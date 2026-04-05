/**
 * NMLS Consumer Access — Mortgage Loan Originator verification
 * ToS-GATED: Manual verification required.
 * Manual verification: https://www.nmlsconsumeraccess.org
 */
import { logger } from "../../_core/logger";

const log = logger.child({ module: "nmlsConsumerAccess" });

export interface NmlsVerificationResult {
  status: "verified" | "not_found" | "tos_blocked" | "error";
  nmlsId?: string;
  name?: string;
  licenseStates?: string[];
  registrationStatus?: string;
  message: string;
}

export async function verifyNmls(name: string, nmlsId?: string): Promise<NmlsVerificationResult> {
  log.info({ name: name.slice(0, 3) + "***" }, "NMLS verification requested (ToS-gated)");

  return {
    status: "tos_blocked",
    nmlsId,
    name,
    message: "NMLS Consumer Access requires manual verification and does not provide a public API. " +
      "Manual lookup available at https://www.nmlsconsumeraccess.org. " +
      "For bulk verification, contact NMLS directly.",
  };
}

export function isNmlsApiAvailable(): boolean {
  return false; // No API available
}
