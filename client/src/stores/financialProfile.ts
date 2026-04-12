/**
 * Client-side re-export of the shared financial profile primitives.
 *
 * The actual logic lives in `shared/financialProfile.ts` so the
 * server (G9 server-side persistence) and client can use identical
 * sanitization, merging, and completeness scoring code paths.
 *
 * Keep this file as a thin barrel — do NOT add new functions here.
 * If you want to add a new helper, put it in shared/ first so the
 * server can use it too.
 */

export type {
  FinancialProfile,
  FinancialProfileState,
} from "@shared/financialProfile";

export {
  EMPTY_PROFILE,
  FINANCIAL_PROFILE_STORAGE_KEY,
  FINANCIAL_PROFILE_VERSION,
  completenessLabel,
  diffProfiles,
  mergeProfile,
  parseFinancialProfile,
  profileCompleteness,
  sanitizeProfile,
  serializeProfileState,
  toEngineProfile,
} from "@shared/financialProfile";
