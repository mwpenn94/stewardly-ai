/**
 * mediumPriorityWorkflows.ts — Medium-priority advisory workflows
 * 
 * Implements five remaining CFP-standard workflows:
 * 1. Prospect-to-Client Conversion — structured onboarding pipeline
 * 2. Estate Document Review — will/trust gap identification
 * 3. Charitable Planning — CRT, CLT, DAF, private foundation analysis
 * 4. Divorce Financial Planning — QDRO, asset division, support analysis
 * 5. Business Succession Planning — buy-sell, key person, transition strategy
 */

// ─── PROSPECT-TO-CLIENT CONVERSION ─────────────────────────────────

interface ProspectInput {
  prospectName: string;
  prospectEmail?: string;
  referralSource?: string;
  estimatedAssets: number;
  estimatedIncome: number;
  age: number;
  primaryConcerns: string[];
  currentAdvisor?: boolean;
  meetingDate?: string;
  stateCode: string;
}

export function generateProspectConversionPlan(input: ProspectInput) {
  // Prospect scoring
  const assetScore = input.estimatedAssets >= 1000000 ? 5 : input.estimatedAssets >= 500000 ? 4 : input.estimatedAssets >= 250000 ? 3 : input.estimatedAssets >= 100000 ? 2 : 1;
  const incomeScore = input.estimatedIncome >= 250000 ? 5 : input.estimatedIncome >= 150000 ? 4 : input.estimatedIncome >= 100000 ? 3 : input.estimatedIncome >= 75000 ? 2 : 1;
  const ageScore = input.age >= 45 && input.age <= 65 ? 5 : input.age >= 35 && input.age < 45 ? 4 : input.age > 65 ? 3 : 2;
  const referralScore = input.referralSource ? 5 : 3;
  const competitorScore = input.currentAdvisor ? 2 : 4;
  const totalScore = Math.round((assetScore + incomeScore + ageScore + referralScore + competitorScore) / 5 * 20);

  // Conversion pipeline stages
  const pipeline = [
    {
      stage: 1,
      name: "Initial Contact",
      description: "Introduction call or meeting to establish rapport",
      duration: "1-3 days",
      actions: [
        "Send personalized introduction email/letter",
        "Schedule 15-minute discovery call",
        "Prepare prospect dossier from available information",
        "Review referral source context (if applicable)",
      ],
      deliverables: ["Introduction email sent", "Discovery call scheduled"],
      completed: false,
    },
    {
      stage: 2,
      name: "Discovery Meeting",
      description: "Comprehensive fact-finding session",
      duration: "60-90 minutes",
      actions: [
        "Conduct structured discovery interview",
        "Gather financial documents (statements, tax returns, insurance policies)",
        "Identify goals, concerns, and values",
        "Assess risk tolerance and time horizons",
        "Document family dynamics and key relationships",
      ],
      deliverables: ["Completed discovery questionnaire", "Document collection checklist"],
      completed: false,
    },
    {
      stage: 3,
      name: "Analysis & Proposal",
      description: "Prepare comprehensive financial analysis and proposal",
      duration: "5-7 business days",
      actions: [
        "Run wealth engine calculators with prospect data",
        "Generate gap analysis across all planning domains",
        "Prepare personalized financial review (PFR)",
        "Create fee schedule and engagement terms",
        "Develop preliminary recommendations",
      ],
      deliverables: ["Financial analysis summary", "Engagement proposal", "Fee disclosure"],
      completed: false,
    },
    {
      stage: 4,
      name: "Presentation Meeting",
      description: "Present findings and proposed engagement",
      duration: "60-90 minutes",
      actions: [
        "Walk through financial analysis findings",
        "Present identified gaps and opportunities",
        "Explain proposed service model and fees",
        "Address questions and objections",
        "Discuss next steps and timeline",
      ],
      deliverables: ["Presentation deck", "Written proposal"],
      completed: false,
    },
    {
      stage: 5,
      name: "Engagement Signing",
      description: "Formalize the advisory relationship",
      duration: "1-5 business days",
      actions: [
        "Prepare engagement letter / advisory agreement",
        "Complete compliance documentation (KYC, AML, suitability)",
        "Obtain signatures on all required forms",
        "Set up client in CRM and planning systems",
        "Schedule first implementation meeting",
      ],
      deliverables: ["Signed engagement letter", "Completed compliance forms", "Client onboarded in systems"],
      completed: false,
    },
  ];

  // Compliance requirements
  const complianceChecklist = [
    { item: "Know Your Customer (KYC) verification", required: true, regulation: "FINRA Rule 2090" },
    { item: "Anti-Money Laundering (AML) screening", required: true, regulation: "BSA/AML" },
    { item: "Suitability assessment", required: true, regulation: "FINRA Rule 2111 / Reg BI" },
    { item: "Privacy notice delivery", required: true, regulation: "Regulation S-P" },
    { item: "Form CRS delivery", required: true, regulation: "SEC Rule 17a-14" },
    { item: "ADV Part 2A/2B delivery", required: input.estimatedAssets >= 100000, regulation: "SEC Rule 204-3" },
    { item: "Fee disclosure acknowledgment", required: true, regulation: "DOL Fiduciary Rule" },
  ];

  return {
    prospect: {
      name: input.prospectName,
      score: totalScore,
      tier: totalScore >= 80 ? "A" : totalScore >= 60 ? "B" : totalScore >= 40 ? "C" : "D",
      scoring: { assetScore, incomeScore, ageScore, referralScore, competitorScore },
    },
    pipeline,
    complianceChecklist,
    estimatedConversionTime: "2-4 weeks",
    followUpSchedule: [
      { day: 1, action: "Send thank-you note after initial contact" },
      { day: 3, action: "Follow up if discovery meeting not yet scheduled" },
      { day: 7, action: "Send relevant educational content" },
      { day: 14, action: "Check in on document collection progress" },
      { day: 21, action: "Confirm presentation meeting date" },
      { day: 30, action: "Final follow-up if engagement not signed" },
    ],
  };
}

// ─── ESTATE DOCUMENT REVIEW ────────────────────────────────────────

interface EstateDocReviewInput {
  clientAge: number;
  maritalStatus: string;
  stateCode: string;
  hasWill: boolean;
  willDate?: string;
  hasTrust: boolean;
  trustType?: string;
  trustDate?: string;
  hasPOA: boolean;
  hasHealthcareDirective: boolean;
  hasLivingWill: boolean;
  hasBeneficiaryDesignations: boolean;
  estimatedEstate: number;
  hasMinorChildren: boolean;
  hasBlendedFamily: boolean;
  hasBusinessInterests: boolean;
  hasCharitableIntent: boolean;
  lastReviewDate?: string;
}

export function generateEstateDocumentReview(input: EstateDocReviewInput) {
  const currentYear = new Date().getFullYear();
  const estateExemption = 13610000; // 2024 federal estate tax exemption
  const sunsetExemption = 7000000; // Post-2025 TCJA sunset approximate

  // Document freshness check
  const willAge = input.willDate ? currentYear - new Date(input.willDate).getFullYear() : null;
  const trustAge = input.trustDate ? currentYear - new Date(input.trustDate).getFullYear() : null;
  const lastReviewAge = input.lastReviewDate ? currentYear - new Date(input.lastReviewDate).getFullYear() : null;

  // Gap identification
  const gaps: Array<{ category: string; issue: string; severity: string; recommendation: string }> = [];

  if (!input.hasWill) {
    gaps.push({
      category: "Will",
      issue: "No will on file — intestacy laws will govern distribution",
      severity: "CRITICAL",
      recommendation: "Draft a will immediately. State intestacy laws may not align with client wishes.",
    });
  } else if (willAge && willAge > 5) {
    gaps.push({
      category: "Will",
      issue: `Will is ${willAge} years old — may not reflect current wishes or law changes`,
      severity: "HIGH",
      recommendation: "Review and update will to reflect current family situation, asset levels, and tax law.",
    });
  }

  if (!input.hasTrust && input.estimatedEstate > 500000) {
    gaps.push({
      category: "Trust",
      issue: "No trust established — estate may go through probate",
      severity: input.estimatedEstate > 1000000 ? "HIGH" : "MEDIUM",
      recommendation: "Consider a revocable living trust to avoid probate, maintain privacy, and provide incapacity planning.",
    });
  }

  if (!input.hasPOA) {
    gaps.push({
      category: "Power of Attorney",
      issue: "No financial power of attorney on file",
      severity: "CRITICAL",
      recommendation: "Execute a durable financial power of attorney immediately. Without one, court intervention may be needed for incapacity.",
    });
  }

  if (!input.hasHealthcareDirective) {
    gaps.push({
      category: "Healthcare Directive",
      issue: "No healthcare proxy/directive on file",
      severity: "CRITICAL",
      recommendation: "Execute a healthcare proxy and advance directive. Critical for medical decision-making during incapacity.",
    });
  }

  if (!input.hasLivingWill) {
    gaps.push({
      category: "Living Will",
      issue: "No living will on file",
      severity: "HIGH",
      recommendation: "Draft a living will specifying end-of-life care preferences.",
    });
  }

  if (!input.hasBeneficiaryDesignations) {
    gaps.push({
      category: "Beneficiary Designations",
      issue: "Beneficiary designations not reviewed — may override will/trust provisions",
      severity: "HIGH",
      recommendation: "Audit all beneficiary designations on retirement accounts, life insurance, and transfer-on-death accounts. These override will/trust provisions.",
    });
  }

  if (input.hasMinorChildren && !input.hasTrust) {
    gaps.push({
      category: "Minor Children",
      issue: "Minor children without trust protection — assets may be managed by court-appointed guardian",
      severity: "HIGH",
      recommendation: "Establish a trust for minor children's inheritance. Name guardian in will. Consider age-staggered distributions.",
    });
  }

  if (input.hasBlendedFamily) {
    gaps.push({
      category: "Blended Family",
      issue: "Blended family requires careful planning to balance competing interests",
      severity: "MEDIUM",
      recommendation: "Consider QTIP trust to provide for surviving spouse while preserving assets for children from prior marriage.",
    });
  }

  if (input.hasBusinessInterests) {
    gaps.push({
      category: "Business Interests",
      issue: "Business interests require succession and buy-sell planning",
      severity: "HIGH",
      recommendation: "Review buy-sell agreement, key person insurance, and business succession plan. Ensure business interests are properly addressed in estate documents.",
    });
  }

  // Estate tax exposure
  const taxExposure = {
    currentExemption: estateExemption,
    sunsetExemption,
    estimatedEstate: input.estimatedEstate,
    currentExposure: Math.max(0, input.estimatedEstate - estateExemption),
    sunsetExposure: Math.max(0, input.estimatedEstate - sunsetExemption),
    currentTax: Math.max(0, (input.estimatedEstate - estateExemption) * 0.40),
    sunsetTax: Math.max(0, (input.estimatedEstate - sunsetExemption) * 0.40),
    planningUrgency: input.estimatedEstate > sunsetExemption ? "HIGH" : "LOW",
  };

  if (taxExposure.sunsetExposure > 0) {
    gaps.push({
      category: "Estate Tax",
      issue: `Estate of $${(input.estimatedEstate / 1e6).toFixed(1)}M may face $${(taxExposure.sunsetTax / 1e6).toFixed(1)}M in estate taxes after TCJA sunset`,
      severity: "HIGH",
      recommendation: "Implement estate tax reduction strategies before TCJA sunset: ILIT, GRAT, SLAT, annual gifting program.",
    });
  }

  return {
    documentInventory: {
      will: { exists: input.hasWill, date: input.willDate, age: willAge },
      trust: { exists: input.hasTrust, type: input.trustType, date: input.trustDate, age: trustAge },
      poa: { exists: input.hasPOA },
      healthcareDirective: { exists: input.hasHealthcareDirective },
      livingWill: { exists: input.hasLivingWill },
      beneficiaryDesignations: { reviewed: input.hasBeneficiaryDesignations },
    },
    gaps,
    gapSummary: {
      critical: gaps.filter(g => g.severity === "CRITICAL").length,
      high: gaps.filter(g => g.severity === "HIGH").length,
      medium: gaps.filter(g => g.severity === "MEDIUM").length,
      total: gaps.length,
    },
    taxExposure,
    lastReview: { date: input.lastReviewDate, age: lastReviewAge },
    recommendedActions: gaps.sort((a, b) => {
      const sev = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return (sev[a.severity as keyof typeof sev] ?? 3) - (sev[b.severity as keyof typeof sev] ?? 3);
    }).map(g => g.recommendation),
    attorneyReferral: gaps.some(g => g.severity === "CRITICAL") ? {
      needed: true,
      specialties: ["Estate planning attorney", "Elder law attorney"],
      urgency: "Immediate — critical gaps in estate documents",
    } : {
      needed: lastReviewAge !== null && lastReviewAge > 3,
      specialties: ["Estate planning attorney"],
      urgency: "Schedule within 30 days",
    },
  };
}

// ─── CHARITABLE PLANNING ───────────────────────────────────────────

interface CharitablePlanInput {
  clientAge: number;
  spouseAge?: number;
  taxBracket: number;  // decimal, e.g. 0.37
  stateCode: string;
  annualCharitableGiving: number;
  appreciatedAssets: Array<{
    type: string;
    value: number;
    costBasis: number;
    holdingPeriod: number;  // years
  }>;
  charitableGoals: string[];
  desiredIncome: boolean;
  desiredTaxDeduction: boolean;
  desiredLegacy: boolean;
  estimatedEstate: number;
  totalIncome: number;
}

export function generateCharitablePlan(input: CharitablePlanInput) {
  const totalAppreciatedValue = input.appreciatedAssets.reduce((s, a) => s + a.value, 0);
  const totalUnrealizedGain = input.appreciatedAssets.reduce((s, a) => s + (a.value - a.costBasis), 0);
  const capitalGainsTax = totalUnrealizedGain * 0.238; // 20% + 3.8% NIIT

  // Vehicle analysis
  const vehicles: Array<{
    type: string;
    description: string;
    suitability: number;
    taxDeduction: number;
    incomeStream: boolean;
    controlRetained: boolean;
    advantages: string[];
    disadvantages: string[];
  }> = [];

  // Donor-Advised Fund (DAF)
  vehicles.push({
    type: "Donor-Advised Fund (DAF)",
    description: "Immediate tax deduction, grants to charities over time",
    suitability: input.desiredTaxDeduction ? 9 : 6,
    taxDeduction: Math.min(totalAppreciatedValue, input.totalIncome * 0.30),
    incomeStream: false,
    controlRetained: true,
    advantages: [
      "Immediate tax deduction in high-income year",
      "Avoid capital gains on appreciated assets",
      "Flexible grant-making over time",
      "Low setup cost and administrative burden",
      "Can name successor advisors",
    ],
    disadvantages: [
      "Irrevocable contribution",
      "No income stream to donor",
      "AGI limitation: 30% for appreciated property, 60% for cash",
      "Cannot fund private foundation from DAF",
    ],
  });

  // Charitable Remainder Trust (CRT)
  if (input.desiredIncome && input.clientAge >= 40) {
    const crtPayoutRate = 0.05; // 5% minimum
    const crtIncome = totalAppreciatedValue * crtPayoutRate;
    const remainderFactor = 0.10; // Must be at least 10% of initial value
    const deduction = totalAppreciatedValue * remainderFactor * 2; // Simplified

    vehicles.push({
      type: "Charitable Remainder Trust (CRT)",
      description: "Income stream to donor, remainder to charity",
      suitability: input.desiredIncome ? 9 : 4,
      taxDeduction: Math.min(deduction, input.totalIncome * 0.30),
      incomeStream: true,
      controlRetained: false,
      advantages: [
        `Annual income of ~$${Math.round(crtIncome).toLocaleString()} (${(crtPayoutRate * 100).toFixed(0)}% payout)`,
        "Partial tax deduction on contribution",
        "Avoid capital gains on appreciated assets",
        "Diversify concentrated positions tax-free inside trust",
        "Can use CRUT (unitrust) for inflation protection",
      ],
      disadvantages: [
        "Irrevocable — cannot reclaim assets",
        "10% remainder requirement limits payout rate",
        "Complex setup and annual administration",
        "Income taxable to beneficiary",
      ],
    });
  }

  // Charitable Lead Trust (CLT)
  if (input.desiredLegacy && input.estimatedEstate > 5000000) {
    vehicles.push({
      type: "Charitable Lead Trust (CLT)",
      description: "Income to charity now, remainder to heirs later",
      suitability: input.desiredLegacy ? 8 : 3,
      taxDeduction: totalAppreciatedValue * 0.40, // Simplified
      incomeStream: false,
      controlRetained: false,
      advantages: [
        "Reduce estate/gift tax on transfers to heirs",
        "Charity receives income stream during trust term",
        "Appreciation passes to heirs estate-tax-free",
        "Effective for high-growth assets",
      ],
      disadvantages: [
        "Heirs receive nothing during trust term",
        "Complex setup and administration",
        "If assets underperform, heirs receive less",
        "Grantor CLT: donor taxed on trust income",
      ],
    });
  }

  // Private Foundation
  if (input.annualCharitableGiving >= 50000 || totalAppreciatedValue >= 1000000) {
    vehicles.push({
      type: "Private Foundation",
      description: "Maximum control over charitable giving",
      suitability: input.annualCharitableGiving >= 100000 ? 8 : 5,
      taxDeduction: Math.min(totalAppreciatedValue * 0.20, input.totalIncome * 0.30),
      incomeStream: false,
      controlRetained: true,
      advantages: [
        "Maximum control over grant-making",
        "Family involvement and legacy",
        "Can hire family members (reasonable compensation)",
        "Perpetual existence",
        "Can make grants to individuals (scholarships)",
      ],
      disadvantages: [
        "Lower deduction limits (30% cash, 20% appreciated property)",
        "5% minimum annual distribution requirement",
        "Excise tax on net investment income (1.39%)",
        "Significant administrative burden and cost",
        "Public disclosure requirements (Form 990-PF)",
      ],
    });
  }

  // Qualified Charitable Distribution (QCD)
  if (input.clientAge >= 70.5) {
    vehicles.push({
      type: "Qualified Charitable Distribution (QCD)",
      description: "Direct IRA distribution to charity (up to $105,000/year)",
      suitability: 9,
      taxDeduction: 0, // Not a deduction — excluded from income
      incomeStream: false,
      controlRetained: true,
      advantages: [
        "Satisfies Required Minimum Distribution (RMD)",
        "Excluded from taxable income (better than deduction)",
        "No itemization required",
        "Reduces AGI (helps with Medicare premiums, Social Security taxation)",
        "Up to $105,000 per year (2024)",
      ],
      disadvantages: [
        "Must be age 70½ or older",
        "Must go directly from IRA to charity",
        "Cannot go to DAF or private foundation",
        "Only from traditional IRA (not 401k)",
      ],
    });
  }

  return {
    currentGiving: {
      annual: input.annualCharitableGiving,
      taxBenefit: input.annualCharitableGiving * input.taxBracket,
      effectiveCost: input.annualCharitableGiving * (1 - input.taxBracket),
    },
    appreciatedAssets: {
      totalValue: totalAppreciatedValue,
      totalGain: totalUnrealizedGain,
      potentialCapitalGainsTax: capitalGainsTax,
      taxSavingsFromDonation: capitalGainsTax + totalAppreciatedValue * input.taxBracket * 0.30,
    },
    vehicles: vehicles.sort((a, b) => b.suitability - a.suitability),
    recommendedStrategy: vehicles.length > 0 ? vehicles[0].type : "Direct charitable gifts",
    complianceNotes: [
      "Charitable deductions subject to AGI limitations (60% cash, 30% appreciated property to public charities)",
      "Appraisal required for non-cash gifts over $5,000",
      "Substantiation requirements vary by gift amount",
      "State tax deductions may differ from federal",
      "Consult tax advisor before implementing any charitable strategy",
    ],
  };
}

// ─── DIVORCE FINANCIAL PLANNING ────────────────────────────────────

interface DivorcePlanInput {
  clientAge: number;
  spouseAge: number;
  marriageYears: number;
  stateCode: string;
  communityPropertyState: boolean;
  totalMaritalAssets: number;
  retirementAccounts: Array<{
    owner: string;
    type: string;
    balance: number;
  }>;
  realEstate: Array<{
    description: string;
    value: number;
    mortgage: number;
    ownership: string;
  }>;
  businessInterests: Array<{
    name: string;
    estimatedValue: number;
    ownership: string;
  }>;
  annualIncome: { client: number; spouse: number };
  childrenAges: number[];
  existingPrenup: boolean;
}

export function generateDivorcePlan(input: DivorcePlanInput) {
  const totalRetirement = input.retirementAccounts.reduce((s, a) => s + a.balance, 0);
  const totalRealEstate = input.realEstate.reduce((s, r) => s + (r.value - r.mortgage), 0);
  const totalBusiness = input.businessInterests.reduce((s, b) => s + b.estimatedValue, 0);
  const totalMarital = input.totalMaritalAssets;

  // Asset division analysis
  const assetDivision = {
    totalMaritalEstate: totalMarital,
    retirementAccounts: totalRetirement,
    realEstateEquity: totalRealEstate,
    businessInterests: totalBusiness,
    otherAssets: totalMarital - totalRetirement - totalRealEstate - totalBusiness,
    divisionMethod: input.communityPropertyState ? "Community Property (50/50)" : "Equitable Distribution",
  };

  // QDRO analysis for retirement accounts
  const qdroAnalysis = input.retirementAccounts.map(acct => ({
    accountType: acct.type,
    owner: acct.owner,
    balance: acct.balance,
    qdroRequired: ["401k", "403b", "pension", "defined_benefit"].includes(acct.type.toLowerCase()),
    qdroNote: acct.type.toLowerCase().includes("ira")
      ? "IRA division via transfer incident to divorce (no QDRO needed, use Form 1099-R)"
      : "QDRO required — must be approved by plan administrator before divorce is finalized",
    taxImplications: "Transfer incident to divorce is tax-free. Subsequent distributions taxed to recipient.",
    maritalPortion: input.marriageYears > 0 ? Math.min(1, input.marriageYears / 30) : 1,
  }));

  // Child support and custody financial analysis
  const childSupport = input.childrenAges.length > 0 ? {
    minorChildren: input.childrenAges.filter(a => a < 18).length,
    dependentChildren: input.childrenAges.filter(a => a < 21).length,
    estimatedMonthlySupport: Math.round(
      Math.max(input.annualIncome.client, input.annualIncome.spouse) * 0.17 *
      Math.min(input.childrenAges.filter(a => a < 18).length, 3) / 12
    ),
    durationYears: input.childrenAges.length > 0 ? Math.max(0, 18 - Math.min(...input.childrenAges)) : 0,
    taxTreatment: "Child support is not tax-deductible to payer and not taxable to recipient",
    healthInsurance: "Court typically orders continuation of health insurance for minor children",
  } : null;

  // Alimony/spousal support analysis
  const incomeDiff = Math.abs(input.annualIncome.client - input.annualIncome.spouse);
  const alimony = input.marriageYears >= 10 || incomeDiff > 50000 ? {
    likely: true,
    estimatedMonthly: Math.round(incomeDiff * 0.30 / 12),
    estimatedDuration: Math.min(input.marriageYears, Math.round(input.marriageYears * 0.5)),
    taxTreatment: "Post-2018 alimony: not deductible to payer, not taxable to recipient (for divorces after 12/31/2018)",
    factors: [
      `Marriage duration: ${input.marriageYears} years`,
      `Income disparity: $${incomeDiff.toLocaleString()}`,
      `Higher earner: ${input.annualIncome.client > input.annualIncome.spouse ? "Client" : "Spouse"}`,
    ],
  } : {
    likely: false,
    reason: `Short marriage (${input.marriageYears} years) and/or minimal income disparity`,
  };

  // Filing status impact
  const filingStatusImpact = {
    currentStatus: "Married Filing Jointly",
    postDivorceStatus: input.childrenAges.some(a => a < 18) ? "Head of Household (if custodial parent)" : "Single",
    estimatedTaxIncrease: Math.round(input.annualIncome.client * 0.03), // Simplified marriage penalty/bonus reversal
    note: "Filing status changes in the year divorce is finalized. If divorced by Dec 31, file as Single/HoH for entire year.",
  };

  return {
    assetDivision,
    qdroAnalysis,
    childSupport,
    alimony,
    filingStatusImpact,
    socialSecurityImpact: input.marriageYears >= 10 ? {
      eligible: true,
      note: "Marriage of 10+ years qualifies for spousal Social Security benefits (up to 50% of ex-spouse's benefit). Does not reduce ex-spouse's benefit.",
    } : {
      eligible: false,
      note: `Marriage of ${input.marriageYears} years does not qualify for spousal Social Security benefits (requires 10+ years).`,
    },
    insuranceConsiderations: [
      "Health insurance: COBRA coverage available for 36 months after divorce",
      "Life insurance: Review and update beneficiary designations immediately",
      "Disability insurance: May need individual policy if covered through spouse's employer",
      "Auto/home insurance: Separate policies needed after divorce",
    ],
    immediateActions: [
      "Secure copies of all financial documents before separation",
      "Open individual bank and credit accounts",
      "Do not make large financial moves without legal counsel",
      "Update estate documents (will, POA, healthcare directive)",
      "Review and update all beneficiary designations",
      "Consider temporary orders for financial protection during proceedings",
    ],
    complianceNotes: [
      "Divorce financial planning requires coordination with family law attorney",
      "QDRO must be approved by plan administrator — start process early",
      "Tax implications vary significantly by state and specific circumstances",
      "Business valuation may require independent appraiser",
      "Prenuptial agreement terms should be reviewed by attorney",
    ],
  };
}

// ─── BUSINESS SUCCESSION PLANNING ──────────────────────────────────

interface BusinessSuccessionInput {
  businessType: string;
  businessValue: number;
  annualRevenue: number;
  annualProfit: number;
  ownerAge: number;
  ownerHealthStatus: string;
  coOwners: Array<{ name: string; ownershipPct: number; age: number }>;
  keyEmployees: Array<{ name: string; role: string; critical: boolean }>;
  desiredExitTimeline: number; // years
  preferredSuccessor: string; // family, employee, external, none
  hasBuySellAgreement: boolean;
  hasKeyPersonInsurance: boolean;
  stateCode: string;
}

export function generateBusinessSuccessionPlan(input: BusinessSuccessionInput) {
  const totalOwnership = 100 - input.coOwners.reduce((s, o) => s + o.ownershipPct, 0);
  const ownerValue = input.businessValue * (totalOwnership / 100);

  // Succession strategy options
  const strategies: Array<{
    type: string;
    description: string;
    suitability: number;
    taxEfficiency: number;
    timeline: string;
    advantages: string[];
    disadvantages: string[];
  }> = [];

  // Family succession
  if (input.preferredSuccessor === "family" || input.preferredSuccessor === "none") {
    strategies.push({
      type: "Family Succession",
      description: "Transfer business to family members (children, relatives)",
      suitability: input.preferredSuccessor === "family" ? 9 : 5,
      taxEfficiency: 7,
      timeline: "3-10 years",
      advantages: [
        "Preserves family legacy and culture",
        "Gradual transition possible",
        "Gift/estate tax planning opportunities (GRAT, IDGT, installment sale)",
        "Potential valuation discounts (minority interest, lack of marketability)",
      ],
      disadvantages: [
        "Family dynamics may complicate transition",
        "Successor may lack skills or interest",
        "Potential conflicts with non-successor family members",
        "May need to equalize estate for non-business heirs",
      ],
    });
  }

  // Employee buyout (ESOP or management buyout)
  if (input.keyEmployees.length > 0) {
    strategies.push({
      type: "Employee/Management Buyout",
      description: "Sell to key employees or establish ESOP",
      suitability: input.preferredSuccessor === "employee" ? 9 : 6,
      taxEfficiency: 8,
      timeline: "2-5 years",
      advantages: [
        "Employees know the business and culture",
        "ESOP provides significant tax benefits (Section 1042 rollover)",
        "Motivates and retains key employees",
        "Gradual transition preserves operations",
      ],
      disadvantages: [
        "Employees may lack capital for purchase",
        "ESOP setup is complex and expensive",
        "Management buyout may require seller financing",
        "Valuation disputes possible",
      ],
    });
  }

  // External sale
  strategies.push({
    type: "External Sale",
    description: "Sell to third-party buyer (strategic or financial)",
    suitability: input.preferredSuccessor === "external" ? 9 : 5,
    taxEfficiency: 5,
    timeline: "6-18 months",
    advantages: [
      "Typically highest sale price",
      "Clean break for owner",
      "Strategic buyers may pay premium",
      "Professional transaction process",
    ],
    disadvantages: [
      "Loss of control over business culture",
      "Employees may face uncertainty",
      "Due diligence process is intensive",
      "Capital gains tax on full sale price",
      "May require earn-out or non-compete",
    ],
  });

  // Buy-sell agreement analysis
  const buySellAnalysis = {
    exists: input.hasBuySellAgreement,
    needed: input.coOwners.length > 0,
    triggerEvents: [
      "Death of owner",
      "Disability of owner",
      "Retirement",
      "Voluntary departure",
      "Divorce",
      "Bankruptcy",
    ],
    fundingMechanisms: [
      {
        type: "Cross-Purchase",
        description: "Each owner buys deceased/departing owner's share",
        bestFor: "2-3 owners",
        taxAdvantage: "Buyers get stepped-up basis",
      },
      {
        type: "Entity Redemption",
        description: "Business buys departing owner's share",
        bestFor: "4+ owners",
        taxAdvantage: "Simpler with many owners",
      },
      {
        type: "Wait-and-See (Hybrid)",
        description: "Entity has first option, then cross-purchase",
        bestFor: "Flexible situations",
        taxAdvantage: "Combines benefits of both",
      },
    ],
    insuranceFunding: !input.hasKeyPersonInsurance ? {
      needed: true,
      estimatedPremium: Math.round(ownerValue * 0.005), // Rough estimate
      coverageNeeded: ownerValue,
      note: "Life insurance is the most common funding mechanism for buy-sell agreements",
    } : { needed: false, note: "Key person insurance already in place" },
  };

  // Key person risk assessment
  const keyPersonRisk = {
    criticalEmployees: input.keyEmployees.filter(e => e.critical),
    riskLevel: input.keyEmployees.filter(e => e.critical).length >= 2 ? "HIGH" : input.keyEmployees.filter(e => e.critical).length === 1 ? "MEDIUM" : "LOW",
    insuranceNeeded: !input.hasKeyPersonInsurance && input.keyEmployees.some(e => e.critical),
    estimatedKeyPersonValue: input.annualProfit * 2, // 2x annual profit as key person value
    mitigationStrategies: [
      "Document all critical processes and procedures",
      "Cross-train employees on essential functions",
      "Implement retention agreements (golden handcuffs)",
      "Purchase key person life and disability insurance",
      "Develop management depth chart",
    ],
  };

  // Tax planning for exit
  const taxPlanning = {
    estimatedCapitalGains: ownerValue * 0.80, // Assume 80% is gain
    federalTax: ownerValue * 0.80 * 0.238, // 20% + 3.8% NIIT
    stateTax: ownerValue * 0.80 * 0.05, // Approximate state
    totalTax: ownerValue * 0.80 * 0.288,
    afterTaxProceeds: ownerValue - ownerValue * 0.80 * 0.288,
    strategies: [
      "Installment sale (Section 453) to defer capital gains",
      "Qualified Small Business Stock (Section 1202) exclusion if eligible",
      "Charitable Remainder Trust to defer and diversify",
      "Opportunity Zone investment to defer gains",
      "ESOP sale with Section 1042 rollover",
    ],
  };

  return {
    businessProfile: {
      type: input.businessType,
      value: input.businessValue,
      ownerValue,
      ownershipPct: totalOwnership,
      revenue: input.annualRevenue,
      profit: input.annualProfit,
      profitMargin: input.annualRevenue > 0 ? input.annualProfit / input.annualRevenue : 0,
    },
    strategies: strategies.sort((a, b) => b.suitability - a.suitability),
    recommendedStrategy: strategies[0]?.type || "External Sale",
    buySellAnalysis,
    keyPersonRisk,
    taxPlanning,
    timeline: {
      yearsToExit: input.desiredExitTimeline,
      phases: [
        { phase: "Assessment & Planning", duration: "3-6 months", actions: ["Business valuation", "Strategy selection", "Team assembly"] },
        { phase: "Preparation", duration: "6-18 months", actions: ["Optimize financials", "Document processes", "Develop successor"] },
        { phase: "Execution", duration: "6-12 months", actions: ["Negotiate terms", "Due diligence", "Legal documentation"] },
        { phase: "Transition", duration: "6-24 months", actions: ["Knowledge transfer", "Client introductions", "Gradual handoff"] },
      ],
    },
    complianceNotes: [
      "Business succession planning requires coordination with business attorney and CPA",
      "Buy-sell agreements should be reviewed annually and updated for value changes",
      "ESOP transactions require independent valuation and fiduciary trustee",
      "Section 1202 QSBS exclusion has specific holding period and business type requirements",
      "State-specific rules may affect transfer taxes and entity dissolution",
    ],
  };
}
