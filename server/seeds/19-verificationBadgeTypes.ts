import { getDb } from "../db";
const BADGES = [
  { badgeType: "sec_ria", displayName: "SEC Registered Investment Advisor", issuingAuthority: "U.S. Securities and Exchange Commission" },
  { badgeType: "finra_series_6", displayName: "FINRA Series 6", issuingAuthority: "Financial Industry Regulatory Authority" },
  { badgeType: "finra_series_7", displayName: "FINRA Series 7", issuingAuthority: "Financial Industry Regulatory Authority" },
  { badgeType: "finra_series_63", displayName: "FINRA Series 63", issuingAuthority: "Financial Industry Regulatory Authority" },
  { badgeType: "finra_series_65", displayName: "FINRA Series 65", issuingAuthority: "Financial Industry Regulatory Authority" },
  { badgeType: "finra_series_66", displayName: "FINRA Series 66", issuingAuthority: "Financial Industry Regulatory Authority" },
  { badgeType: "cfp", displayName: "Certified Financial Planner", issuingAuthority: "CFP Board" },
  { badgeType: "cpa", displayName: "Certified Public Accountant", issuingAuthority: "State Board of Accountancy" },
  { badgeType: "nmls", displayName: "NMLS Licensed Mortgage Originator", issuingAuthority: "Nationwide Multistate Licensing System" },
  { badgeType: "state_bar", displayName: "Licensed Attorney", issuingAuthority: "State Bar Association" },
  { badgeType: "nipr", displayName: "Licensed Insurance Producer", issuingAuthority: "National Insurance Producer Registry" },
];
export async function seed() {
  const db = await getDb(); if (!db) { console.log("[seed:19] No DB — skipping"); return; }
  const { coiVerificationBadges } = await import("../../drizzle/schema");
  // Badge types are reference data — just log what would be seeded
  console.log(`[seed:19] Verification badge types: ${BADGES.length} badge types defined`);
}
if (import.meta.url === `file://${process.argv[1]}`) seed();
