/**
 * NIPR Producer Database — Insurance producer verification
 * ToS-GATED: API access pending. NIPR requires partnership agreement.
 * Manual verification: https://pdb.nipr.com
 */
import { logger } from "../../_core/logger";

const log = logger.child({ module: "niprPdb" });

export interface NiprResult {
  status: "verified" | "not_found" | "tos_blocked" | "error";
  npn?: string; // National Producer Number
  name?: string;
  licenseStates?: string[];
  linesOfAuthority?: string[];
  appointmentStatus?: string;
  message: string;
}

export async function verifyInsuranceProducer(name: string, npn?: string): Promise<NiprResult> {
  log.info({ name: name.slice(0, 3) + "***" }, "NIPR verification requested (ToS-gated)");

  return {
    status: "tos_blocked",
    npn,
    name,
    message: "NIPR Producer Database requires API partnership agreement. " +
      "Manual lookup available at https://pdb.nipr.com. " +
      "For API access, contact NIPR at (816) 783-8500 or visit https://nipr.com/products-and-services.",
  };
}

export function isNiprApiAvailable(): boolean {
  return !!process.env.NIPR_API_KEY;
}
