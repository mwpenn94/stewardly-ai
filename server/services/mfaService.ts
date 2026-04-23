/**
 * MFA Service — Backward Compatibility Re-export
 * 
 * This file has been split into focused modules under server/services/security/:
 * - mfa.ts — TOTP + backup codes
 * - securityHardening.ts — CSP, rate limiting, XSS protection
 * - rowSecurity.ts — row-level security and tenant filtering
 * - consent.ts — consent tracking, DSAR, ROPA
 * 
 * This file re-exports everything for backward compatibility.
 * New code should import directly from the specific module.
 */
export {
  enrollMFA,
  verifyMFA,
  getMFAStatus,
  disableMFA,
  getCSPHeaders,
  checkRateLimit,
  sanitizeInput,
  enforceRowSecurity,
  buildTenantFilter,
  assertRowAccess,
  recordConsent,
  getConsents,
  generateDSAR,
  generateROPA,
} from "./security";

export type { RowSecurityContext } from "./security";
