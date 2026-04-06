import { getDb } from "../db";
export async function seed() {
  const db = await getDb(); if (!db) { console.log("[seed:ads] No DB"); return; }
  const { adPlacements } = await import("../../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const ADS = [
    { placementType: "product_recommendation" as const, advertiserName: "National Life Group", targetContext: "insurance", contentHtml: "Protect your family with NLG's top-rated IUL — tax-advantaged growth with downside protection.", ctaUrl: "https://www.nationallife.com", ctaText: "Get a Quote", enabled: true },
    { placementType: "contextual_banner" as const, advertiserName: "Holistiplan", targetContext: "tax", contentHtml: "Optimize your tax strategy with Holistiplan's AI-powered tax planning software.", ctaUrl: "https://holistiplan.com", ctaText: "Try Holistiplan", enabled: true },
    { placementType: "sponsored_content" as const, advertiserName: "EncorEstate", targetContext: "estate", contentHtml: "Estate documents made simple — wills, trusts, and POAs created in minutes.", ctaUrl: "https://encorestate.com", ctaText: "Start Your Plan", enabled: true },
    { placementType: "product_recommendation" as const, advertiserName: "Fidelity Charitable", targetContext: "charitable", contentHtml: "Maximize your charitable impact with a Donor-Advised Fund from Fidelity Charitable.", ctaUrl: "https://www.fidelitycharitable.org", ctaText: "Open a DAF", enabled: true },
    { placementType: "inline_cta" as const, advertiserName: "Equity Services Inc", targetContext: "retirement", contentHtml: "Ready to build your retirement portfolio? ESI advisors are here to help.", ctaUrl: "https://www.equityservices.com", ctaText: "Connect with ESI", enabled: true },
    { placementType: "contextual_banner" as const, advertiserName: "Guardian Life", targetContext: "disability", contentHtml: "Protect your income — Guardian Provider Choice DI covers up to 70% of earnings.", ctaUrl: "https://www.guardianlife.com", ctaText: "Get DI Quote", enabled: true },
    { placementType: "product_recommendation" as const, advertiserName: "Athene", targetContext: "annuity", contentHtml: "Secure guaranteed income with Athene's #1-rated Fixed Index Annuity.", ctaUrl: "https://www.athene.com", ctaText: "Learn More", enabled: true },
    { placementType: "sponsored_content" as const, advertiserName: "Lincoln Financial", targetContext: "ltc", contentHtml: "Plan for long-term care with Lincoln MoneyGuard — life insurance + LTC in one policy.", ctaUrl: "https://www.lincolnfinancial.com", ctaText: "Explore MoneyGuard", enabled: true },
  ];
  let inserted = 0;
  for (const ad of ADS) {
    const [exists] = await db.select().from(adPlacements).where(eq(adPlacements.advertiserName, ad.advertiserName)).limit(1);
    if (exists) continue;
    await db.insert(adPlacements).values(ad); inserted++;
  }
  console.log(`[seed:ads] Ad placements: ${inserted} inserted, ${ADS.length - inserted} skipped`);
}
if (import.meta.url === `file://${process.argv[1]}`) seed();
