export const LEAD_SOURCES = [
  { sourceName: "LinkedIn Organic", sourceType: "organic", segment: "professional", costModel: "free", qualityScore: "0.65" },
  { sourceName: "LinkedIn Paid Ads", sourceType: "paid", segment: "professional", costModel: "per_click", avgCost: "8.50", qualityScore: "0.70" },
  { sourceName: "LinkedIn Sales Navigator", sourceType: "paid", segment: "professional", costModel: "subscription", avgCost: "100.00", qualityScore: "0.75" },
  { sourceName: "Dripify Automation", sourceType: "paid", segment: "professional", costModel: "subscription", avgCost: "59.00", qualityScore: "0.60" },
  { sourceName: "Client Referral", sourceType: "referral", segment: "client", costModel: "free", qualityScore: "0.90" },
  { sourceName: "Professional Referral", sourceType: "referral", segment: "professional", costModel: "free", qualityScore: "0.85" },
  { sourceName: "COI Referral (CPA/Attorney)", sourceType: "referral", segment: "coi", costModel: "revenue_share", qualityScore: "0.88" },
  { sourceName: "Realtor Referral", sourceType: "referral", segment: "coi", costModel: "revenue_share", qualityScore: "0.80" },
  { sourceName: "Financial Seminar", sourceType: "event", segment: "client", costModel: "per_lead", avgCost: "25.00", qualityScore: "0.75" },
  { sourceName: "Industry Conference", sourceType: "event", segment: "professional", costModel: "per_lead", avgCost: "50.00", qualityScore: "0.70" },
  { sourceName: "NAPFA Directory", sourceType: "directory", segment: "professional", costModel: "subscription", qualityScore: "0.72" },
  { sourceName: "FPA Directory", sourceType: "directory", segment: "professional", costModel: "subscription", qualityScore: "0.68" },
  { sourceName: "NAIFA Directory", sourceType: "directory", segment: "professional", costModel: "subscription", qualityScore: "0.65" },
  { sourceName: "SEO Organic Traffic", sourceType: "organic", segment: "client", costModel: "free", qualityScore: "0.55" },
  { sourceName: "Calculator Lead Capture", sourceType: "organic", segment: "client", costModel: "free", qualityScore: "0.80" },
  { sourceName: "Financial Protection Score", sourceType: "organic", segment: "client", costModel: "free", qualityScore: "0.85" },
  { sourceName: "Content Marketing", sourceType: "organic", segment: "client", costModel: "free", qualityScore: "0.50" },
  { sourceName: "Webinar Registrant", sourceType: "event", segment: "client", costModel: "per_lead", avgCost: "15.00", qualityScore: "0.72" },
  { sourceName: "Google Ads", sourceType: "paid", segment: "client", costModel: "per_click", avgCost: "12.00", qualityScore: "0.60" },
  { sourceName: "Facebook/Meta Ads", sourceType: "paid", segment: "client", costModel: "per_click", avgCost: "6.00", qualityScore: "0.45" },
  { sourceName: "CPA Partnership Program", sourceType: "partnership", segment: "coi", costModel: "revenue_share", qualityScore: "0.85" },
  { sourceName: "Attorney Partnership", sourceType: "partnership", segment: "coi", costModel: "revenue_share", qualityScore: "0.82" },
  { sourceName: "Embed Widget Lead", sourceType: "organic", segment: "client", costModel: "free", qualityScore: "0.78" },
  { sourceName: "SMS-iT Inbound", sourceType: "organic", segment: "client", costModel: "per_lead", avgCost: "2.00", qualityScore: "0.55" },
  { sourceName: "GHL Pipeline Import", sourceType: "organic", segment: "client", costModel: "free", qualityScore: "0.60" },
];
export async function seed() {
  console.log(`[seed:13] Lead sources: ${LEAD_SOURCES.length} sources defined across organic/paid/referral/event/directory/partnership`);
}
if (import.meta.url === `file://${process.argv[1]}`) seed();
