/**
 * Business Broker Verification — IBBA and state registration checks
 * ToS-GATED: Requires IBBA membership verification and state-specific lookups.
 */
import { logger } from "../../_core/logger";

const log = logger.child({ module: "businessBroker" });

export interface BusinessBrokerResult {
  status: "verified" | "not_found" | "tos_blocked" | "error";
  name?: string;
  ibbaNumber?: string;
  cbi?: boolean; // Certified Business Intermediary
  stateRegistrations?: string[];
  message: string;
}

export async function verifyBusinessBroker(name: string, ibbaNumber?: string): Promise<BusinessBrokerResult> {
  log.info({ name: name.slice(0, 3) + "***" }, "Business broker verification requested (ToS-gated)");

  return {
    status: "tos_blocked",
    name,
    ibbaNumber,
    message: "Business broker verification requires IBBA membership directory access and state-specific lookups. " +
      "Manual verification: https://www.ibba.org/find-a-business-broker/. " +
      "CBI certification can be verified through IBBA directly.",
  };
}

export function isIbbaApiAvailable(): boolean {
  return !!process.env.IBBA_API_KEY;
}
