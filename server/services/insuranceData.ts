import { getDb } from "../db";
import { insuranceCarriers, insuranceProducts, iulCreditingHistory } from "../../drizzle/schema";
import { eq, and, like, gte, sql } from "drizzle-orm";
import { logger } from "../_core/logger";

// ─── Top 50 Insurance Carriers (AM Best Ratings as of 2025) ────────────────

const TOP_CARRIERS = [
  { name: "Northwestern Mutual", aliases: ["NML", "NorthwesternMutual"], fsr: "A++", numeric: 15, outlook: "Stable", sp: "AA+", naic: "67091", state: "WI", type: "Mutual", founded: 1857, assets: "324", surplus: "35", products: ["WL","UL","IUL","VUL","Term","DI","LTC","Annuity"] },
  { name: "New York Life", aliases: ["NYL"], fsr: "A++", numeric: 15, outlook: "Stable", sp: "AA+", naic: "66915", state: "NY", type: "Mutual", founded: 1845, assets: "400", surplus: "30", products: ["WL","UL","Term","Annuity"] },
  { name: "MassMutual", aliases: ["Massachusetts Mutual"], fsr: "A++", numeric: 15, outlook: "Stable", sp: "AA+", naic: "65935", state: "MA", type: "Mutual", founded: 1851, assets: "300", surplus: "24", products: ["WL","UL","IUL","Term","DI","Annuity"] },
  { name: "Guardian Life", aliases: ["Guardian"], fsr: "A++", numeric: 15, outlook: "Stable", sp: "AA+", naic: "64246", state: "NY", type: "Mutual", founded: 1860, assets: "80", surplus: "10", products: ["WL","UL","Term","DI","Dental","Vision"] },
  { name: "Penn Mutual", aliases: ["Penn Mutual Life"], fsr: "A+", numeric: 13, outlook: "Stable", sp: "A+", naic: "67644", state: "PA", type: "Mutual", founded: 1847, assets: "25", surplus: "3.5", products: ["WL","UL","IUL","VUL","Term","Annuity"] },
  { name: "Pacific Life", aliases: ["PacLife"], fsr: "A+", numeric: 13, outlook: "Stable", sp: "A+", naic: "67466", state: "NE", type: "Stock", founded: 1868, assets: "200", surplus: "8", products: ["IUL","VUL","Annuity","Term"] },
  { name: "Lincoln Financial", aliases: ["Lincoln National","LFG"], fsr: "A+", numeric: 13, outlook: "Stable", sp: "A", naic: "65676", state: "IN", type: "Stock", founded: 1905, assets: "350", surplus: "12", products: ["UL","IUL","VUL","Term","Annuity","DI"] },
  { name: "Prudential Financial", aliases: ["Prudential","Pru"], fsr: "A+", numeric: 13, outlook: "Stable", sp: "AA-", naic: "68241", state: "NJ", type: "Stock", founded: 1875, assets: "900", surplus: "20", products: ["UL","IUL","VUL","Term","GUL","Annuity"] },
  { name: "MetLife", aliases: ["Metropolitan Life"], fsr: "A+", numeric: 13, outlook: "Stable", sp: "AA-", naic: "65978", state: "NY", type: "Stock", founded: 1868, assets: "700", surplus: "25", products: ["UL","Term","GUL","Annuity","Dental","Vision"] },
  { name: "Transamerica", aliases: ["Transamerica Life"], fsr: "A", numeric: 11, outlook: "Stable", sp: "A", naic: "86231", state: "IA", type: "Stock", founded: 1906, assets: "250", surplus: "8", products: ["UL","IUL","Term","WL","Annuity"] },
  { name: "Nationwide", aliases: ["Nationwide Life"], fsr: "A+", numeric: 13, outlook: "Stable", sp: "A+", naic: "66869", state: "OH", type: "Mutual", founded: 1926, assets: "280", surplus: "15", products: ["UL","IUL","VUL","Term","Annuity"] },
  { name: "John Hancock", aliases: ["Manulife"], fsr: "A+", numeric: 13, outlook: "Stable", sp: "AA-", naic: "65838", state: "MA", type: "Stock", founded: 1862, assets: "250", surplus: "10", products: ["UL","IUL","VUL","Term","LTC","Annuity"] },
  { name: "Principal Financial", aliases: ["Principal Life"], fsr: "A+", numeric: 13, outlook: "Stable", sp: "A+", naic: "61271", state: "IA", type: "Stock", founded: 1879, assets: "300", surplus: "12", products: ["UL","IUL","Term","DI","Annuity"] },
  { name: "Securian Financial", aliases: ["Minnesota Life"], fsr: "A+", numeric: 13, outlook: "Stable", sp: "AA-", naic: "66168", state: "MN", type: "Mutual", founded: 1880, assets: "60", surplus: "5", products: ["UL","IUL","VUL","Term","Annuity"] },
  { name: "Allianz Life", aliases: ["Allianz"], fsr: "A+", numeric: 13, outlook: "Stable", sp: "AA", naic: "90611", state: "MN", type: "Stock", founded: 1979, assets: "180", surplus: "8", products: ["IUL","FIA","Annuity"] },
  { name: "Protective Life", aliases: ["Protective"], fsr: "A+", numeric: 13, outlook: "Stable", sp: "AA-", naic: "68136", state: "AL", type: "Stock", founded: 1907, assets: "120", surplus: "6", products: ["UL","IUL","Term","Annuity"] },
  { name: "Sammons Financial", aliases: ["North American"], fsr: "A", numeric: 11, outlook: "Stable", sp: null, naic: "66974", state: "IA", type: "Stock", founded: 1886, assets: "45", surplus: "3", products: ["IUL","FIA","Annuity"] },
  { name: "Mutual of Omaha", aliases: ["MutualOfOmaha"], fsr: "A+", numeric: 13, outlook: "Stable", sp: "A+", naic: "71412", state: "NE", type: "Mutual", founded: 1909, assets: "50", surplus: "5", products: ["UL","IUL","Term","WL","Medicare Supplement"] },
  { name: "Unum Group", aliases: ["Unum"], fsr: "A-", numeric: 9, outlook: "Stable", sp: "BBB+", naic: "62235", state: "TN", type: "Stock", founded: 1848, assets: "60", surplus: "4", products: ["DI","LTD","STD","Life","Dental","Vision"] },
  { name: "Aflac", aliases: ["American Family Life"], fsr: "A+", numeric: 13, outlook: "Stable", sp: "A+", naic: "60380", state: "NE", type: "Stock", founded: 1955, assets: "150", surplus: "10", products: ["Supplemental","Cancer","Accident","Hospital","DI"] },
  { name: "State Farm", aliases: ["State Farm Life"], fsr: "A++", numeric: 15, outlook: "Stable", sp: null, naic: "69108", state: "IL", type: "Mutual", founded: 1922, assets: "130", surplus: "15", products: ["WL","UL","Term"] },
  { name: "USAA Life", aliases: ["USAA"], fsr: "A++", numeric: 15, outlook: "Stable", sp: "AA", naic: "69663", state: "TX", type: "Stock", founded: 1963, assets: "30", surplus: "4", products: ["WL","UL","Term","Annuity"] },
  { name: "Thrivent Financial", aliases: ["Thrivent"], fsr: "A++", numeric: 15, outlook: "Stable", sp: "AA+", naic: "56014", state: "WI", type: "Fraternal", founded: 1902, assets: "90", surplus: "10", products: ["WL","UL","IUL","Term","Annuity"] },
  { name: "Ohio National", aliases: ["Ohio National Financial"], fsr: "A", numeric: 11, outlook: "Stable", sp: null, naic: "67172", state: "OH", type: "Mutual", founded: 1909, assets: "40", surplus: "2.5", products: ["WL","UL","IUL","Term","DI","Annuity"] },
  { name: "Ameritas Life", aliases: ["Ameritas"], fsr: "A", numeric: 11, outlook: "Stable", sp: null, naic: "61301", state: "NE", type: "Mutual", founded: 1887, assets: "30", surplus: "2", products: ["UL","IUL","VUL","Term","Dental","Vision"] },
  { name: "Global Atlantic", aliases: ["Forethought Life"], fsr: "A", numeric: 11, outlook: "Positive", sp: "A-", naic: "70769", state: "IN", type: "Stock", founded: 2004, assets: "160", surplus: "6", products: ["IUL","FIA","Annuity","MYGA"] },
  { name: "Athene", aliases: ["Athene Annuity"], fsr: "A", numeric: 11, outlook: "Stable", sp: "A", naic: "61689", state: "IA", type: "Stock", founded: 2009, assets: "260", surplus: "10", products: ["FIA","MYGA","Annuity"] },
  { name: "Corebridge Financial", aliases: ["AIG Life","VALIC"], fsr: "A", numeric: 11, outlook: "Stable", sp: "A", naic: "70106", state: "TX", type: "Stock", founded: 2022, assets: "350", surplus: "12", products: ["UL","IUL","VUL","Term","Annuity"] },
  { name: "Equitable", aliases: ["AXA Equitable","AXA"], fsr: "A+", numeric: 13, outlook: "Stable", sp: "A+", naic: "62944", state: "NY", type: "Stock", founded: 1859, assets: "200", surplus: "8", products: ["VUL","IUL","Annuity","Term"] },
  { name: "Voya Financial", aliases: ["Voya","ING"], fsr: "A", numeric: 11, outlook: "Stable", sp: "A-", naic: "86509", state: "IA", type: "Stock", founded: 2013, assets: "100", surplus: "5", products: ["UL","Term","Annuity","Group"] },
  { name: "OneAmerica", aliases: ["American United Life"], fsr: "A+", numeric: 13, outlook: "Stable", sp: null, naic: "60895", state: "IN", type: "Mutual", founded: 1877, assets: "80", surplus: "4", products: ["WL","UL","IUL","Term","Annuity","DI","LTC"] },
  { name: "Symetra", aliases: ["Symetra Life"], fsr: "A", numeric: 11, outlook: "Stable", sp: "A", naic: "68608", state: "WA", type: "Stock", founded: 1957, assets: "50", surplus: "3", products: ["UL","IUL","Term","Annuity","DI","Group"] },
  { name: "National Life Group", aliases: ["National Life","LSW"], fsr: "A", numeric: 11, outlook: "Stable", sp: null, naic: "66680", state: "VT", type: "Mutual", founded: 1848, assets: "45", surplus: "3", products: ["IUL","VUL","Term","Annuity"] },
  { name: "Brighthouse Financial", aliases: ["Brighthouse"], fsr: "A", numeric: 11, outlook: "Stable", sp: "A", naic: "86800", state: "DE", type: "Stock", founded: 2017, assets: "250", surplus: "8", products: ["VUL","IUL","Annuity"] },
  { name: "Jackson National", aliases: ["Jackson"], fsr: "A", numeric: 11, outlook: "Stable", sp: "A", naic: "65056", state: "MI", type: "Stock", founded: 1961, assets: "300", surplus: "10", products: ["VA","FIA","RILA","Annuity"] },
  { name: "Fidelity & Guaranty Life", aliases: ["F&G","FGL"], fsr: "A-", numeric: 9, outlook: "Positive", sp: "BBB+", naic: "63274", state: "IA", type: "Stock", founded: 1959, assets: "55", surplus: "3", products: ["IUL","FIA","MYGA","Annuity"] },
  { name: "American General", aliases: ["AIG","AGLC"], fsr: "A", numeric: 11, outlook: "Stable", sp: "A", naic: "60488", state: "TX", type: "Stock", founded: 1960, assets: "200", surplus: "8", products: ["UL","IUL","GUL","Term","Annuity"] },
  { name: "Banner Life", aliases: ["Legal & General America"], fsr: "A+", numeric: 13, outlook: "Stable", sp: "AA-", naic: "94250", state: "MD", type: "Stock", founded: 1981, assets: "10", surplus: "1.5", products: ["Term"] },
  { name: "Haven Life", aliases: ["MassMutual subsidiary"], fsr: "A++", numeric: 15, outlook: "Stable", sp: "AA+", naic: "65935", state: "NY", type: "Stock", founded: 2015, assets: "N/A", surplus: "N/A", products: ["Term"] },
  { name: "Ladder Life", aliases: ["Ladder"], fsr: "A+", numeric: 13, outlook: "Stable", sp: null, naic: "N/A", state: "CA", type: "InsurTech", founded: 2017, assets: "N/A", surplus: "N/A", products: ["Term"] },
  { name: "TIAA", aliases: ["TIAA-CREF"], fsr: "A++", numeric: 15, outlook: "Stable", sp: "AA+", naic: "69345", state: "NY", type: "Stock", founded: 1918, assets: "350", surplus: "20", products: ["Annuity","WL","Term"] },
  { name: "AIG", aliases: ["American International Group"], fsr: "A", numeric: 11, outlook: "Stable", sp: "A", naic: "60488", state: "NY", type: "Stock", founded: 1919, assets: "500", surplus: "15", products: ["UL","IUL","Term","GUL","Annuity","Travel"] },
  { name: "Cincinnati Life", aliases: ["Cincinnati Financial"], fsr: "A+", numeric: 13, outlook: "Stable", sp: "A+", naic: "76236", state: "OH", type: "Stock", founded: 1988, assets: "8", surplus: "1.5", products: ["WL","Term","Annuity"] },
  { name: "Erie Family Life", aliases: ["Erie Insurance"], fsr: "A+", numeric: 13, outlook: "Stable", sp: "A+", naic: "62065", state: "PA", type: "Stock", founded: 1967, assets: "5", surplus: "1", products: ["WL","UL","Term","Annuity"] },
  { name: "Kansas City Life", aliases: ["KCL"], fsr: "B++", numeric: 7, outlook: "Stable", sp: null, naic: "65129", state: "MO", type: "Stock", founded: 1895, assets: "4", surplus: "0.5", products: ["WL","UL","Term","Annuity"] },
  { name: "Zurich", aliases: ["Zurich North America"], fsr: "A+", numeric: 13, outlook: "Stable", sp: "AA-", naic: "16535", state: "IL", type: "Stock", founded: 1912, assets: "60", surplus: "5", products: ["Group","Term","AD&D"] },
  { name: "Sun Life", aliases: ["Sun Life Financial","Sun Life US"], fsr: "A+", numeric: 13, outlook: "Stable", sp: "AA-", naic: "80802", state: "MI", type: "Stock", founded: 1865, assets: "200", surplus: "8", products: ["Group","DI","LTD","STD","Dental","Vision","Stop Loss"] },
  { name: "Genworth Financial", aliases: ["Genworth"], fsr: "B++", numeric: 7, outlook: "Negative", sp: "B+", naic: "70025", state: "VA", type: "Stock", founded: 2004, assets: "100", surplus: "4", products: ["LTC","MI","Annuity"] },
  { name: "Wilton Re", aliases: ["Wilton Re Life"], fsr: "A-", numeric: 9, outlook: "Stable", sp: null, naic: "N/A", state: "CT", type: "Stock", founded: 2004, assets: "20", surplus: "2", products: ["Reinsurance","UL","Term"] },
  { name: "Great-West Lifeco", aliases: ["Empower","Great-West"], fsr: "A+", numeric: 13, outlook: "Stable", sp: "A+", naic: "63665", state: "CO", type: "Stock", founded: 1891, assets: "250", surplus: "10", products: ["Group","Annuity","Term","Retirement"] },
];

// ─── Seed Functions ────────────────────────────────────────────────────────

export async function seedInsuranceCarriers(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  let inserted = 0;
  for (const c of TOP_CARRIERS) {
    try {
      await db.insert(insuranceCarriers).values({
        carrierName: c.name,
        carrierNameAliases: c.aliases,
        amBestFsr: c.fsr,
        amBestFsrNumeric: c.numeric,
        amBestOutlook: c.outlook,
        spRating: c.sp,
        naicId: c.naic,
        domicileState: c.state,
        companyType: c.type,
        yearFounded: c.founded,
        totalAssetsBillions: c.assets,
        statutorySurplusBillions: c.surplus,
        productLines: c.products,
        ratingLastUpdated: "2025-01-15",
        active: true,
      });
      inserted++;
    } catch (e: any) {
      if (!e?.message?.includes("Duplicate")) logger.error( { operation: "carriers", err: e },"[Carriers] Insert error:", e?.message);
    }
  }
  return inserted;
}

export async function seedSampleProducts(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  // Get carrier IDs for product mapping
  const carriers = await db.select({ id: insuranceCarriers.id, name: insuranceCarriers.carrierName }).from(insuranceCarriers);
  const carrierMap = new Map(carriers.map(c => [c.name, c.id]));

  const products = [
    // Northwestern Mutual
    { carrier: "Northwestern Mutual", name: "NM Whole Life", type: "WL", category: "permanent", minFace: "25000", maxFace: "50000000", minAge: 0, maxAge: 90, features: { dividends: true, paidUp: true, cashValue: true } },
    { carrier: "Northwestern Mutual", name: "NM Custom IUL", type: "IUL", category: "permanent", minFace: "100000", maxFace: "50000000", minAge: 0, maxAge: 80, features: { indexOptions: ["S&P 500","MSCI EAFE"], capRate: true, floorRate: 0 } },
    // Pacific Life
    { carrier: "Pacific Life", name: "Pacific Discovery Xelerator IUL 3", type: "IUL", category: "permanent", minFace: "100000", maxFace: "65000000", minAge: 0, maxAge: 85, features: { indexOptions: ["S&P 500","DJIA","MSCI EAFE","Custom"], multiplier: true, persistencyBonus: true } },
    // Lincoln Financial
    { carrier: "Lincoln Financial", name: "Lincoln WealthAccumulate IUL 2025", type: "IUL", category: "permanent", minFace: "100000", maxFace: "50000000", minAge: 0, maxAge: 80, features: { indexOptions: ["S&P 500","Russell 2000","MSCI EAFE"], capRate: true, participationRate: true } },
    // Prudential
    { carrier: "Prudential Financial", name: "PruLife Index Advantage UL", type: "IUL", category: "permanent", minFace: "100000", maxFace: "50000000", minAge: 18, maxAge: 80, features: { indexOptions: ["S&P 500","MSCI EAFE","Bloomberg Barclays"], capRate: true, floorRate: 0 } },
    // Allianz
    { carrier: "Allianz Life", name: "Allianz Life Pro+ Elite IUL", type: "IUL", category: "permanent", minFace: "50000", maxFace: "50000000", minAge: 0, maxAge: 80, features: { indexOptions: ["S&P 500","PIMCO","Bloomberg"], multiplier: true, bonusRate: true } },
    // National Life
    { carrier: "National Life Group", name: "LSW FlexLife IUL", type: "IUL", category: "permanent", minFace: "50000", maxFace: "25000000", minAge: 0, maxAge: 85, features: { indexOptions: ["S&P 500","Fidelity AIM"], capRate: true, chronicIllnessRider: true } },
    // Term products
    { carrier: "Banner Life", name: "OPTerm 10", type: "Term", category: "term", minFace: "100000", maxFace: "10000000", minAge: 18, maxAge: 70, features: { termLength: 10, convertible: true, renewableToAge: 95 } },
    { carrier: "Banner Life", name: "OPTerm 20", type: "Term", category: "term", minFace: "100000", maxFace: "10000000", minAge: 18, maxAge: 65, features: { termLength: 20, convertible: true, renewableToAge: 95 } },
    { carrier: "Haven Life", name: "Haven Term", type: "Term", category: "term", minFace: "100000", maxFace: "3000000", minAge: 18, maxAge: 64, features: { termLength: 20, online: true, noExam: "up to $1M" } },
    // Annuity products
    { carrier: "Athene", name: "Athene Agility 10 FIA", type: "FIA", category: "annuity", minFace: "25000", maxFace: "5000000", minAge: 0, maxAge: 85, features: { surrenderPeriod: 10, indexOptions: ["S&P 500","DJIA"], bonusRate: "8%" } },
    { carrier: "Jackson National", name: "Jackson Market Link Pro II VA", type: "VA", category: "annuity", minFace: "10000", maxFace: "5000000", minAge: 0, maxAge: 90, features: { subaccounts: 100, livingBenefit: true, deathBenefit: true } },
    // DI products
    { carrier: "Guardian Life", name: "Guardian ProVider Plus DI", type: "DI", category: "disability", minFace: "N/A", maxFace: "N/A", minAge: 18, maxAge: 60, features: { ownOccupation: true, residualBenefit: true, futureIncrease: true } },
    { carrier: "Unum Group", name: "Unum Individual DI", type: "DI", category: "disability", minFace: "N/A", maxFace: "N/A", minAge: 18, maxAge: 60, features: { ownOccupation: true, costOfLiving: true, returnOfPremium: true } },
    // LTC
    { carrier: "Genworth Financial", name: "Genworth Privileged Choice Flex 3", type: "LTC", category: "ltc", minFace: "N/A", maxFace: "N/A", minAge: 30, maxAge: 79, features: { inflationProtection: true, sharedCare: true, homeCare: true } },
  ];

  let inserted = 0;
  for (const p of products) {
    const carrierId = carrierMap.get(p.carrier);
    if (!carrierId) continue;
    try {
      await db.insert(insuranceProducts).values({
        carrierId,
        productName: p.name,
        productType: p.type,
        productCategory: p.category,
        features: p.features,
        minFaceAmount: p.minFace,
        maxFaceAmount: p.maxFace,
        minIssueAge: p.minAge,
        maxIssueAge: p.maxAge,
        active: true,
        lastRateUpdate: "2025-01-15",
      });
      inserted++;
    } catch (e: any) {
      if (!e?.message?.includes("Duplicate")) logger.error( { operation: "products", err: e },"[Products] Insert error:", e?.message);
    }
  }
  return inserted;
}

// ─── Lookup Functions ──────────────────────────────────────────────────────

export async function getCarrierByName(name: string) {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(insuranceCarriers)
    .where(like(insuranceCarriers.carrierName, `%${name}%`))
    .limit(5);

  return rows;
}

export async function getCarriersByMinRating(minNumeric: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(insuranceCarriers)
    .where(gte(insuranceCarriers.amBestFsrNumeric, minNumeric));
}

export async function getProductsByType(productType: string) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(insuranceProducts)
    .where(eq(insuranceProducts.productType, productType));
}

export async function getProductsByCarrier(carrierId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(insuranceProducts)
    .where(eq(insuranceProducts.carrierId, carrierId));
}

export async function searchProducts(query: string, category?: string) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [like(insuranceProducts.productName, `%${query}%`)];
  if (category) conditions.push(eq(insuranceProducts.productCategory, category));

  return db
    .select({
      product: insuranceProducts,
      carrier: insuranceCarriers,
    })
    .from(insuranceProducts)
    .innerJoin(insuranceCarriers, eq(insuranceProducts.carrierId, insuranceCarriers.id))
    .where(and(...conditions))
    .limit(50);
}

export async function checkPremiumFinanceEligibility(carrierId: number): Promise<{
  eligible: boolean;
  reason: string;
  rating: string | null;
}> {
  const db = await getDb();
  if (!db) return { eligible: false, reason: "Database unavailable", rating: null };

  const rows = await db
    .select()
    .from(insuranceCarriers)
    .where(eq(insuranceCarriers.id, carrierId))
    .limit(1);

  if (rows.length === 0) return { eligible: false, reason: "Carrier not found", rating: null };

  const carrier = rows[0];
  const minRating = 11; // A or higher required for premium finance
  const eligible = (carrier.amBestFsrNumeric ?? 0) >= minRating;

  return {
    eligible,
    reason: eligible
      ? `${carrier.carrierName} (${carrier.amBestFsr}) meets minimum A rating for premium finance`
      : `${carrier.carrierName} (${carrier.amBestFsr}) does not meet minimum A rating for premium finance`,
    rating: carrier.amBestFsr,
  };
}
