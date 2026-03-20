/**
 * Divorce Financial Analyzer — Asset division & tax impact modeling
 * Part F: Market Completeness
 *
 * Pure computation — no API keys needed.
 * Covers: equitable distribution, tax basis tracking, alimony/support modeling, lifestyle analysis.
 */

export type AssetType = "cash" | "retirement_pretax" | "retirement_roth" | "brokerage" | "real_estate" | "business" | "stock_options" | "other";
export type PropertyClassification = "marital" | "separate" | "commingled";

export interface DivorceAsset {
  name: string;
  type: AssetType;
  fairMarketValue: number;
  costBasis?: number;
  classification: PropertyClassification;
  owner: "spouse1" | "spouse2" | "joint";
  notes?: string;
}

export interface DivorceInput {
  assets: DivorceAsset[];
  spouse1Income: number;
  spouse2Income: number;
  spouse1Age: number;
  spouse2Age: number;
  yearsMarried: number;
  childrenCount: number;
  childrenAges: number[];
  state: string;
  filingStatus: "mfj_current" | "single_post";
  marginalRate: number;
  alimonyAnnual?: number;
  alimonyYears?: number;
  childSupportMonthly?: number;
}

export interface AssetDivisionScenario {
  name: string;
  spouse1Assets: { asset: string; value: number; afterTaxValue: number }[];
  spouse2Assets: { asset: string; value: number; afterTaxValue: number }[];
  spouse1Total: number;
  spouse2Total: number;
  spouse1AfterTax: number;
  spouse2AfterTax: number;
  splitRatio: string;
  taxImpact: number;
  notes: string[];
}

export interface DivorceResult {
  totalMaritalEstate: number;
  totalSeparateProperty: number;
  scenarios: AssetDivisionScenario[];
  bestScenario: string;
  taxConsiderations: string[];
  supportAnalysis: {
    alimonyTotal: number;
    alimonyTaxImpact: number;
    childSupportTotal: number;
    totalSupportCost: number;
  };
  lifestyleAnalysis: {
    currentHouseholdIncome: number;
    spouse1PostDivorceIncome: number;
    spouse2PostDivorceIncome: number;
    lifestyleGap: number;
  };
  timeline: string[];
}

function afterTaxValue(asset: DivorceAsset, rate: number): number {
  switch (asset.type) {
    case "retirement_pretax": return asset.fairMarketValue * (1 - rate);
    case "brokerage": {
      const gain = asset.fairMarketValue - (asset.costBasis || asset.fairMarketValue);
      return asset.fairMarketValue - Math.max(0, gain) * 0.238;
    }
    case "stock_options": return asset.fairMarketValue * (1 - rate);
    case "retirement_roth": return asset.fairMarketValue; // Tax-free
    default: return asset.fairMarketValue;
  }
}

export function analyzeDivorce(input: DivorceInput): DivorceResult {
  const maritalAssets = input.assets.filter(a => a.classification === "marital" || a.classification === "commingled");
  const separateAssets = input.assets.filter(a => a.classification === "separate");
  const totalMarital = maritalAssets.reduce((s, a) => s + a.fairMarketValue, 0);
  const totalSeparate = separateAssets.reduce((s, a) => s + a.fairMarketValue, 0);

  // Scenario 1: 50/50 FMV split
  const half = totalMarital / 2;
  const s1Assets50: { asset: string; value: number; afterTaxValue: number }[] = [];
  const s2Assets50: { asset: string; value: number; afterTaxValue: number }[] = [];
  let s1Running = 0;
  const sorted = [...maritalAssets].sort((a, b) => b.fairMarketValue - a.fairMarketValue);
  for (const asset of sorted) {
    const atv = afterTaxValue(asset, input.marginalRate);
    if (s1Running < half) {
      s1Assets50.push({ asset: asset.name, value: asset.fairMarketValue, afterTaxValue: Math.round(atv) });
      s1Running += asset.fairMarketValue;
    } else {
      s2Assets50.push({ asset: asset.name, value: asset.fairMarketValue, afterTaxValue: Math.round(atv) });
    }
  }

  // Scenario 2: Tax-equalized split
  const totalAfterTax = maritalAssets.reduce((s, a) => s + afterTaxValue(a, input.marginalRate), 0);
  const halfAT = totalAfterTax / 2;
  const s1AssetsTax: typeof s1Assets50 = [];
  const s2AssetsTax: typeof s1Assets50 = [];
  let s1ATRunning = 0;
  for (const asset of sorted) {
    const atv = afterTaxValue(asset, input.marginalRate);
    if (s1ATRunning < halfAT) {
      s1AssetsTax.push({ asset: asset.name, value: asset.fairMarketValue, afterTaxValue: Math.round(atv) });
      s1ATRunning += atv;
    } else {
      s2AssetsTax.push({ asset: asset.name, value: asset.fairMarketValue, afterTaxValue: Math.round(atv) });
    }
  }

  const scenarios: AssetDivisionScenario[] = [
    {
      name: "50/50 Fair Market Value",
      spouse1Assets: s1Assets50,
      spouse2Assets: s2Assets50,
      spouse1Total: Math.round(s1Assets50.reduce((s, a) => s + a.value, 0)),
      spouse2Total: Math.round(s2Assets50.reduce((s, a) => s + a.value, 0)),
      spouse1AfterTax: Math.round(s1Assets50.reduce((s, a) => s + a.afterTaxValue, 0)),
      spouse2AfterTax: Math.round(s2Assets50.reduce((s, a) => s + a.afterTaxValue, 0)),
      splitRatio: "50/50",
      taxImpact: Math.round(Math.abs(s1Assets50.reduce((s, a) => s + a.afterTaxValue, 0) - s2Assets50.reduce((s, a) => s + a.afterTaxValue, 0))),
      notes: ["Equal FMV but may have unequal after-tax values", "Simpler to negotiate"],
    },
    {
      name: "Tax-Equalized Split",
      spouse1Assets: s1AssetsTax,
      spouse2Assets: s2AssetsTax,
      spouse1Total: Math.round(s1AssetsTax.reduce((s, a) => s + a.value, 0)),
      spouse2Total: Math.round(s2AssetsTax.reduce((s, a) => s + a.value, 0)),
      spouse1AfterTax: Math.round(s1AssetsTax.reduce((s, a) => s + a.afterTaxValue, 0)),
      spouse2AfterTax: Math.round(s2AssetsTax.reduce((s, a) => s + a.afterTaxValue, 0)),
      splitRatio: "Tax-adjusted",
      taxImpact: Math.round(Math.abs(s1AssetsTax.reduce((s, a) => s + a.afterTaxValue, 0) - s2AssetsTax.reduce((s, a) => s + a.afterTaxValue, 0))),
      notes: ["Equal after-tax value", "More equitable long-term", "May require unequal FMV split"],
    },
  ];

  // Support analysis
  const alimonyTotal = (input.alimonyAnnual || 0) * (input.alimonyYears || 0);
  const alimonyTaxImpact = 0; // Post-TCJA: no deduction/income for alimony
  const childSupportTotal = (input.childSupportMonthly || 0) * 12 * Math.max(0, ...input.childrenAges.map(a => 18 - a));

  // Lifestyle analysis
  const currentHousehold = input.spouse1Income + input.spouse2Income;
  const s1PostIncome = input.spouse1Income - (input.alimonyAnnual || 0) - (input.childSupportMonthly || 0) * 12;
  const s2PostIncome = input.spouse2Income + (input.alimonyAnnual || 0) + (input.childSupportMonthly || 0) * 12;

  const taxConsiderations = [
    "QDRO required for retirement account transfers (no tax event)",
    "Home sale: $250K/$500K exclusion may apply if sold within 2 years",
    "Stock options: exercise timing affects tax liability significantly",
    "Alimony (post-2018): not deductible by payer, not income to recipient",
    "Child support: not deductible, not taxable income",
    "Filing status changes to Single or Head of Household in year of divorce",
  ];

  if (maritalAssets.some(a => a.type === "business")) {
    taxConsiderations.push("Business valuation: consider discount for lack of marketability");
  }

  const timeline = [
    "Gather complete financial disclosure (30-60 days)",
    "Obtain independent valuations for real estate, business, stock options",
    "File QDRO for retirement account division",
    "Update beneficiary designations on all accounts",
    "Revise estate plan (will, trust, POA, healthcare directive)",
    "Update insurance beneficiaries and coverage",
    "Establish individual credit and banking",
    "File tax returns (consider filing jointly for final year if beneficial)",
  ];

  return {
    totalMaritalEstate: Math.round(totalMarital),
    totalSeparateProperty: Math.round(totalSeparate),
    scenarios,
    bestScenario: "Tax-Equalized Split",
    taxConsiderations,
    supportAnalysis: {
      alimonyTotal: Math.round(alimonyTotal),
      alimonyTaxImpact: Math.round(alimonyTaxImpact),
      childSupportTotal: Math.round(childSupportTotal),
      totalSupportCost: Math.round(alimonyTotal + childSupportTotal),
    },
    lifestyleAnalysis: {
      currentHouseholdIncome: Math.round(currentHousehold),
      spouse1PostDivorceIncome: Math.round(s1PostIncome),
      spouse2PostDivorceIncome: Math.round(s2PostIncome),
      lifestyleGap: Math.round(currentHousehold / 2 - Math.min(s1PostIncome, s2PostIncome)),
    },
    timeline,
  };
}
