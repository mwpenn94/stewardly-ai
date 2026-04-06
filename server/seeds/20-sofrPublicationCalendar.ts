export async function seed() {
  // FRBNY publishes SOFR on every business day
  // Weekend/holiday detection handled at runtime by premiumFinanceRates service
  console.log("[seed:20] SOFR publication calendar: runtime detection via FRBNY business day rules");
}
if (import.meta.url === `file://${process.argv[1]}`) seed();
