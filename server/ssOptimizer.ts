/**
 * Social Security Optimizer — Claiming strategy analysis
 * Part F: Market Completeness — D11
 * 
 * Features:
 * - PIA calculation from earnings history
 * - Break-even analysis for claiming ages 62-70
 * - Spousal benefit optimization
 * - Survivor benefit analysis
 * - Taxation of benefits modeling
 * - Longevity-adjusted NPV comparison
 */

// Monthly benefit reduction/increase factors
const EARLY_REDUCTION_FIRST_36 = 5 / 900;  // 5/9 of 1% per month for first 36 months early
const EARLY_REDUCTION_AFTER_36 = 5 / 1200; // 5/12 of 1% per month beyond 36 months
const DELAYED_CREDIT_PER_MONTH = 2 / 300;  // 2/3 of 1% per month after FRA (8% per year)

// 2025 bend points for PIA calculation
const BEND_POINT_1 = 1174;
const BEND_POINT_2 = 7078;

export interface EarningsRecord {
  year: number;
  earnings: number;
}

export interface SSInput {
  birthYear: number;
  birthMonth: number; // 1-12
  earningsHistory: EarningsRecord[];  // up to 35 highest years
  estimatedPIA?: number;              // if known, skip calculation
  spouseBirthYear?: number;
  spousePIA?: number;
  filingStatus: "single" | "married";
  lifeExpectancy: number;             // age at death estimate
  spouseLifeExpectancy?: number;
  discountRate: number;               // for NPV, typically 0.02-0.04
}

export interface ClaimingScenario {
  claimingAge: number;
  monthlyBenefit: number;
  annualBenefit: number;
  reductionOrIncrease: string;        // e.g., "-25%" or "+24%"
  breakEvenVs62: number | null;       // age where cumulative exceeds claiming at 62
  breakEvenVsFRA: number | null;      // age where cumulative exceeds claiming at FRA
  cumulativeBy80: number;
  cumulativeBy85: number;
  cumulativeBy90: number;
  npv: number;                        // net present value at claiming age
  recommendation: string;
}

export interface SSResult {
  pia: number;
  fra: number;                        // full retirement age
  scenarios: ClaimingScenario[];
  spousalBenefit?: number;
  survivorBenefit?: number;
  optimalAge: number;
  optimalReason: string;
  taxablePercentage: number;          // estimated % of benefits subject to tax
  recommendations: string[];
}

function getFRA(birthYear: number): number {
  if (birthYear <= 1937) return 65;
  if (birthYear === 1938) return 65 + 2/12;
  if (birthYear === 1939) return 65 + 4/12;
  if (birthYear === 1940) return 65 + 6/12;
  if (birthYear === 1941) return 65 + 8/12;
  if (birthYear === 1942) return 65 + 10/12;
  if (birthYear >= 1943 && birthYear <= 1954) return 66;
  if (birthYear === 1955) return 66 + 2/12;
  if (birthYear === 1956) return 66 + 4/12;
  if (birthYear === 1957) return 66 + 6/12;
  if (birthYear === 1958) return 66 + 8/12;
  if (birthYear === 1959) return 66 + 10/12;
  return 67; // 1960+
}

function calculatePIA(earningsHistory: EarningsRecord[]): number {
  // Use top 35 years, indexed to current dollars (simplified)
  const sorted = [...earningsHistory]
    .sort((a, b) => b.earnings - a.earnings)
    .slice(0, 35);
  
  const totalIndexed = sorted.reduce((sum, e) => sum + e.earnings, 0);
  const aime = Math.round(totalIndexed / (35 * 12)); // Average Indexed Monthly Earnings

  // PIA formula with bend points
  let pia = 0;
  if (aime <= BEND_POINT_1) {
    pia = aime * 0.90;
  } else if (aime <= BEND_POINT_2) {
    pia = BEND_POINT_1 * 0.90 + (aime - BEND_POINT_1) * 0.32;
  } else {
    pia = BEND_POINT_1 * 0.90 + (BEND_POINT_2 - BEND_POINT_1) * 0.32 + (aime - BEND_POINT_2) * 0.15;
  }

  return Math.round(pia * 100) / 100;
}

function getMonthlyBenefit(pia: number, fra: number, claimingAge: number): number {
  const monthsEarlyOrLate = Math.round((claimingAge - fra) * 12);
  
  if (monthsEarlyOrLate === 0) return pia;
  
  if (monthsEarlyOrLate < 0) {
    // Early claiming
    const monthsEarly = Math.abs(monthsEarlyOrLate);
    let reduction = 0;
    if (monthsEarly <= 36) {
      reduction = monthsEarly * EARLY_REDUCTION_FIRST_36;
    } else {
      reduction = 36 * EARLY_REDUCTION_FIRST_36 + (monthsEarly - 36) * EARLY_REDUCTION_AFTER_36;
    }
    return Math.round(pia * (1 - reduction) * 100) / 100;
  } else {
    // Delayed claiming
    const monthsLate = monthsEarlyOrLate;
    const increase = monthsLate * DELAYED_CREDIT_PER_MONTH;
    return Math.round(pia * (1 + increase) * 100) / 100;
  }
}

function calcNPV(annualBenefit: number, startAge: number, endAge: number, discountRate: number): number {
  let npv = 0;
  for (let age = startAge; age <= endAge; age++) {
    const yearsFromStart = age - startAge;
    npv += annualBenefit / Math.pow(1 + discountRate, yearsFromStart);
  }
  return Math.round(npv);
}

function calcCumulative(annualBenefit: number, startAge: number, targetAge: number): number {
  const years = Math.max(0, targetAge - startAge);
  return Math.round(annualBenefit * years);
}

export function optimizeSS(input: SSInput): SSResult {
  const pia = input.estimatedPIA ?? calculatePIA(input.earningsHistory);
  const fra = getFRA(input.birthYear);
  
  const scenarios: ClaimingScenario[] = [];
  let scenario62Cumulative80 = 0;
  let scenarioFRACumulative80 = 0;

  for (let age = 62; age <= 70; age++) {
    const monthly = getMonthlyBenefit(pia, fra, age);
    const annual = monthly * 12;
    const pctChange = ((monthly - pia) / pia) * 100;
    const reductionOrIncrease = pctChange >= 0 ? `+${pctChange.toFixed(1)}%` : `${pctChange.toFixed(1)}%`;

    const cumBy80 = calcCumulative(annual, age, 80);
    const cumBy85 = calcCumulative(annual, age, 85);
    const cumBy90 = calcCumulative(annual, age, 90);
    const npv = calcNPV(annual, age, input.lifeExpectancy, input.discountRate);

    if (age === 62) scenario62Cumulative80 = cumBy80;
    if (Math.abs(age - fra) < 0.5) scenarioFRACumulative80 = cumBy80;

    // Break-even vs 62
    let breakEvenVs62: number | null = null;
    if (age > 62) {
      const benefit62 = getMonthlyBenefit(pia, fra, 62) * 12;
      const headStart = benefit62 * (age - 62);
      if (annual > benefit62) {
        breakEvenVs62 = Math.round(age + headStart / (annual - benefit62));
      }
    }

    // Break-even vs FRA
    let breakEvenVsFRA: number | null = null;
    const fraRounded = Math.round(fra);
    if (age > fraRounded) {
      const benefitFRA = getMonthlyBenefit(pia, fra, fraRounded) * 12;
      const headStart = benefitFRA * (age - fraRounded);
      if (annual > benefitFRA) {
        breakEvenVsFRA = Math.round(age + headStart / (annual - benefitFRA));
      }
    }

    let recommendation = "";
    if (age === 62) recommendation = "Earliest possible. Best if health concerns or immediate need.";
    else if (Math.abs(age - fra) < 0.5) recommendation = "Full retirement age. No reduction or increase.";
    else if (age === 70) recommendation = "Maximum benefit. Best if healthy and can afford to wait.";
    else if (age < fra) recommendation = "Reduced benefit. Consider if you need income before FRA.";
    else recommendation = "Delayed credits accumulating. Good if healthy.";

    scenarios.push({
      claimingAge: age,
      monthlyBenefit: monthly,
      annualBenefit: annual,
      reductionOrIncrease,
      breakEvenVs62,
      breakEvenVsFRA,
      cumulativeBy80: cumBy80,
      cumulativeBy85: cumBy85,
      cumulativeBy90: cumBy90,
      npv,
      recommendation,
    });
  }

  // Find optimal by NPV
  const optimal = scenarios.reduce((best, s) => s.npv > best.npv ? s : best, scenarios[0]);

  // Spousal benefit (50% of higher earner's PIA, if applicable)
  const spousalBenefit = input.spousePIA && input.filingStatus === "married"
    ? Math.max(0, Math.round((pia * 0.5 - input.spousePIA) * 100) / 100)
    : undefined;

  // Survivor benefit (100% of deceased spouse's benefit)
  const survivorBenefit = input.spousePIA && input.filingStatus === "married"
    ? Math.max(pia, input.spousePIA)
    : undefined;

  // Tax estimation (simplified)
  const taxablePercentage = pia * 12 > 34000 ? 85 : pia * 12 > 25000 ? 50 : 0;

  const recommendations: string[] = [];
  if (input.lifeExpectancy >= 85) {
    recommendations.push("With your life expectancy, delaying to 70 maximizes lifetime benefits.");
  }
  if (input.lifeExpectancy < 78) {
    recommendations.push("Given health considerations, earlier claiming may maximize total benefits received.");
  }
  if (spousalBenefit && spousalBenefit > 0) {
    recommendations.push(`Spousal benefit of $${spousalBenefit.toFixed(0)}/mo available — coordinate claiming strategies.`);
  }
  if (taxablePercentage > 0) {
    recommendations.push(`Up to ${taxablePercentage}% of benefits may be taxable — plan for tax-efficient withdrawals.`);
  }

  return {
    pia,
    fra,
    scenarios,
    spousalBenefit,
    survivorBenefit,
    optimalAge: optimal.claimingAge,
    optimalReason: `Age ${optimal.claimingAge} maximizes NPV at $${optimal.npv.toLocaleString()} given ${input.lifeExpectancy} life expectancy and ${(input.discountRate * 100).toFixed(1)}% discount rate.`,
    taxablePercentage,
    recommendations,
  };
}
