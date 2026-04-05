/**
 * State Bar Verification — Attorney credential verification
 * ToS-GATED: Per-state ToS check required. Each state bar has different rules.
 */
import { logger } from "../../_core/logger";

const log = logger.child({ module: "stateBar" });

export interface StateBarResult {
  status: "verified" | "not_found" | "tos_blocked" | "error";
  barNumber?: string;
  state?: string;
  name?: string;
  admissionDate?: string;
  barStatus?: string;
  disciplinaryActions?: boolean;
  message: string;
}

// Known state bar lookup URLs for manual verification
const STATE_BAR_URLS: Record<string, string> = {
  AZ: "https://www.azbar.org/for-the-public/find-a-lawyer/",
  CA: "https://apps.calbar.ca.gov/attorney/LicenseeSearch/QuickSearch",
  NY: "https://iapps.courts.state.ny.us/attorneyservices/search",
  TX: "https://www.texasbar.com/AM/Template.cfm?Section=Find_A_Lawyer",
  FL: "https://www.floridabar.org/directories/find-mbr/",
  IL: "https://www.iardc.org/lawyersearch.asp",
};

export async function verifyStateBar(name: string, state: string, barNumber?: string): Promise<StateBarResult> {
  log.info({ name: name.slice(0, 3) + "***", state }, "State bar verification requested (ToS-gated)");

  const lookupUrl = STATE_BAR_URLS[state.toUpperCase()] || "Contact the relevant state bar association";

  return {
    status: "tos_blocked",
    barNumber,
    state: state.toUpperCase(),
    name,
    message: `State bar verification for ${state.toUpperCase()} requires per-state ToS review. ` +
      `Automated scraping may violate state bar terms of service. ` +
      `Manual verification: ${lookupUrl}`,
  };
}

export function getStateBarUrl(state: string): string | null {
  return STATE_BAR_URLS[state.toUpperCase()] || null;
}

export function getSupportedStates(): string[] {
  return Object.keys(STATE_BAR_URLS);
}
