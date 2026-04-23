/**
 * Security module barrel export
 * Maintains backward compatibility with `import * as mfa from "../services/mfaService"`
 */
export { enrollMFA, verifyMFA, getMFAStatus, disableMFA } from "./mfa";
export { getCSPHeaders, checkRateLimit, sanitizeInput } from "./securityHardening";
export { enforceRowSecurity, buildTenantFilter, assertRowAccess } from "./rowSecurity";
export type { RowSecurityContext } from "./rowSecurity";
export { recordConsent, getConsents, generateDSAR, generateROPA } from "./consent";
