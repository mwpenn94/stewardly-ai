/**
 * Medicare Navigator — Enrollment planning & cost projection
 * Part F: Market Completeness
 *
 * Pure computation — no API keys needed.
 * IRMAA surcharge modeling, Part D gap analysis, Medigap vs MA comparison.
 */

export type MedicarePathway = "original_medigap" | "medicare_advantage" | "employer_group";

export interface MedicareInput {
  age: number;
  retirementAge: number;
  magi: number; // Modified AGI for IRMAA
  filingStatus: "single" | "mfj";
  hasEmployerCoverage: boolean;
  monthlyPrescriptionCosts: number;
  expectedAnnualMedical: number;
  preferredDoctors?: number; // count of specialists
  travelFrequency?: "none" | "moderate" | "heavy";
  chronicConditions?: number;
  yearsToModel?: number;
}

export interface IRMAABracket {
  magiThreshold: number;
  partBSurcharge: number;
  partDSurcharge: number;
  monthlyPartB: number;
  monthlyPartD: number;
}

export interface MedicarePathwayResult {
  pathway: MedicarePathway;
  label: string;
  monthlyPremium: number;
  annualPremium: number;
  annualOutOfPocket: number;
  totalAnnualCost: number;
  pros: string[];
  cons: string[];
  score: number; // 0-100 fit score
}

export interface MedicareResult {
  pathways: MedicarePathwayResult[];
  bestPathway: string;
  irmaaBracket: IRMAABracket;
  irmaaStrategies: string[];
  enrollmentTimeline: { event: string; deadline: string; penalty: string }[];
  partDGapAnalysis: {
    hitsDonutHole: boolean;
    donutHoleStart: number;
    catastrophicStart: number;
    annualDrugCost: number;
    outOfPocketDrugCost: number;
  };
  totalProjectedCost: number;
  yearsModeled: number;
}

// 2025 IRMAA brackets (approximate)
const IRMAA_BRACKETS_SINGLE: IRMAABracket[] = [
  { magiThreshold: 0, partBSurcharge: 0, partDSurcharge: 0, monthlyPartB: 185, monthlyPartD: 35 },
  { magiThreshold: 103000, partBSurcharge: 74, partDSurcharge: 13, monthlyPartB: 259, monthlyPartD: 48 },
  { magiThreshold: 129000, partBSurcharge: 185, partDSurcharge: 33, monthlyPartB: 370, monthlyPartD: 68 },
  { magiThreshold: 161000, partBSurcharge: 296, partDSurcharge: 54, monthlyPartB: 481, monthlyPartD: 89 },
  { magiThreshold: 193000, partBSurcharge: 407, partDSurcharge: 74, monthlyPartB: 592, monthlyPartD: 109 },
  { magiThreshold: 500000, partBSurcharge: 444, partDSurcharge: 81, monthlyPartB: 629, monthlyPartD: 116 },
];

const IRMAA_BRACKETS_MFJ: IRMAABracket[] = [
  { magiThreshold: 0, partBSurcharge: 0, partDSurcharge: 0, monthlyPartB: 185, monthlyPartD: 35 },
  { magiThreshold: 206000, partBSurcharge: 74, partDSurcharge: 13, monthlyPartB: 259, monthlyPartD: 48 },
  { magiThreshold: 258000, partBSurcharge: 185, partDSurcharge: 33, monthlyPartB: 370, monthlyPartD: 68 },
  { magiThreshold: 322000, partBSurcharge: 296, partDSurcharge: 54, monthlyPartB: 481, monthlyPartD: 89 },
  { magiThreshold: 386000, partBSurcharge: 407, partDSurcharge: 74, monthlyPartB: 592, monthlyPartD: 109 },
  { magiThreshold: 750000, partBSurcharge: 444, partDSurcharge: 81, monthlyPartB: 629, monthlyPartD: 116 },
];

function getIRMAABracket(magi: number, filing: "single" | "mfj"): IRMAABracket {
  const brackets = filing === "mfj" ? IRMAA_BRACKETS_MFJ : IRMAA_BRACKETS_SINGLE;
  let bracket = brackets[0];
  for (const b of brackets) {
    if (magi >= b.magiThreshold) bracket = b;
  }
  return bracket;
}

export function navigateMedicare(input: MedicareInput): MedicareResult {
  const years = input.yearsToModel || 20;
  const irmaa = getIRMAABracket(input.magi, input.filingStatus);

  // Part D donut hole analysis (2025 approximate)
  const annualDrugCost = input.monthlyPrescriptionCosts * 12;
  const deductible = 590;
  const initialCoverageLimit = 5030;
  const catastrophicThreshold = 8000;
  const hitsDonutHole = annualDrugCost > initialCoverageLimit;
  const oopDrugCost = annualDrugCost <= deductible
    ? annualDrugCost
    : annualDrugCost <= initialCoverageLimit
      ? deductible + (annualDrugCost - deductible) * 0.25
      : hitsDonutHole
        ? deductible + (initialCoverageLimit - deductible) * 0.25 + (Math.min(annualDrugCost, catastrophicThreshold) - initialCoverageLimit) * 0.25 + Math.max(0, annualDrugCost - catastrophicThreshold) * 0.05
        : annualDrugCost * 0.25;

  // Pathway 1: Original Medicare + Medigap
  const medigapPremium = 200 + (input.age - 65) * 8; // Age-rated estimate
  const origMonthly = irmaa.monthlyPartB + irmaa.monthlyPartD + medigapPremium;
  const origAnnualPremium = origMonthly * 12;
  const origOOP = Math.round(oopDrugCost + input.expectedAnnualMedical * 0.05); // Medigap covers most
  const origScore = 70 + (input.travelFrequency === "heavy" ? 15 : 0) + ((input.preferredDoctors || 0) > 3 ? 10 : 0) - (input.chronicConditions || 0) * 2;

  // Pathway 2: Medicare Advantage
  const maMonthly = irmaa.monthlyPartB + 25; // Many MA plans have $0 premium + Part B
  const maAnnualPremium = maMonthly * 12;
  const maOOP = Math.round(input.expectedAnnualMedical * 0.20 + oopDrugCost * 0.8); // Higher cost-sharing
  const maMOOP = 8300; // Max OOP
  const maScore = 65 + (input.chronicConditions || 0 > 0 ? 10 : 0) - (input.travelFrequency === "heavy" ? 20 : 0) - ((input.preferredDoctors || 0) > 3 ? 10 : 0);

  // Pathway 3: Employer group (if available)
  const empMonthly = input.hasEmployerCoverage ? 350 : 0;
  const empAnnualPremium = empMonthly * 12;
  const empOOP = Math.round(input.expectedAnnualMedical * 0.15);
  const empScore = input.hasEmployerCoverage ? 85 : 0;

  const pathways: MedicarePathwayResult[] = [
    {
      pathway: "original_medigap",
      label: "Original Medicare + Medigap",
      monthlyPremium: Math.round(origMonthly),
      annualPremium: Math.round(origAnnualPremium),
      annualOutOfPocket: origOOP,
      totalAnnualCost: Math.round(origAnnualPremium + origOOP),
      pros: ["Any doctor/hospital nationwide", "Predictable costs with Medigap", "Best for travelers", "No referrals needed"],
      cons: ["Higher premiums", "Separate Part D plan needed", "No extra benefits (dental/vision)"],
      score: Math.min(100, Math.max(0, origScore)),
    },
    {
      pathway: "medicare_advantage",
      label: "Medicare Advantage (Part C)",
      monthlyPremium: Math.round(maMonthly),
      annualPremium: Math.round(maAnnualPremium),
      annualOutOfPocket: Math.min(maOOP, maMOOP),
      totalAnnualCost: Math.round(maAnnualPremium + Math.min(maOOP, maMOOP)),
      pros: ["Lower premiums", "Often includes dental/vision/hearing", "Drug coverage included", `Max OOP: $${maMOOP.toLocaleString()}`],
      cons: ["Network restrictions", "May need referrals", "Limited travel coverage", "Plan changes annually"],
      score: Math.min(100, Math.max(0, maScore)),
    },
  ];

  if (input.hasEmployerCoverage) {
    pathways.push({
      pathway: "employer_group",
      label: "Employer Group Coverage",
      monthlyPremium: empMonthly,
      annualPremium: empAnnualPremium,
      annualOutOfPocket: empOOP,
      totalAnnualCost: empAnnualPremium + empOOP,
      pros: ["Familiar coverage", "May delay Part B enrollment", "Often includes dependents"],
      cons: ["Tied to employment", "Must coordinate with Medicare", "May lose if retire"],
      score: empScore,
    });
  }

  const best = pathways.reduce((a, b) => a.score > b.score ? a : b);

  // IRMAA reduction strategies
  const irmaaStrategies: string[] = [];
  if (irmaa.partBSurcharge > 0) {
    irmaaStrategies.push("Roth conversions before 63 to reduce MAGI at 65 (2-year lookback)");
    irmaaStrategies.push("Defer capital gains realization in the 2 years before Medicare enrollment");
    irmaaStrategies.push("Use QCDs to reduce AGI if over 70½");
    if (input.filingStatus === "mfj") irmaaStrategies.push("Consider filing separately if one spouse has much higher income");
  }
  irmaaStrategies.push("Appeal IRMAA if life-changing event (retirement, divorce, death of spouse)");

  // Enrollment timeline
  const enrollmentTimeline = [
    { event: "Initial Enrollment Period (IEP)", deadline: "3 months before to 3 months after turning 65", penalty: "10% Part B penalty per year of delay" },
    { event: "Part D enrollment", deadline: "Same as IEP or Special Enrollment Period", penalty: "1% per month of delay added to premium permanently" },
    { event: "Medigap open enrollment", deadline: "6 months after Part B effective date", penalty: "Medical underwriting may apply after window" },
    { event: "Annual Election Period", deadline: "October 15 - December 7 each year", penalty: "N/A — opportunity to change plans" },
  ];

  if (input.hasEmployerCoverage) {
    enrollmentTimeline.unshift({
      event: "Special Enrollment Period (employer)",
      deadline: "8 months after employer coverage ends",
      penalty: "No penalty if enrolled within SEP window",
    });
  }

  const totalProjectedCost = Math.round(best.totalAnnualCost * years * 1.04); // 4% medical inflation

  return {
    pathways,
    bestPathway: best.pathway,
    irmaaBracket: irmaa,
    irmaaStrategies,
    enrollmentTimeline,
    partDGapAnalysis: {
      hitsDonutHole: hitsDonutHole,
      donutHoleStart: initialCoverageLimit,
      catastrophicStart: catastrophicThreshold,
      annualDrugCost: Math.round(annualDrugCost),
      outOfPocketDrugCost: Math.round(oopDrugCost),
    },
    totalProjectedCost,
    yearsModeled: years,
  };
}
