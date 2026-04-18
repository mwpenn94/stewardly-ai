/**
 * specializedWorkflows.ts — Low-priority specialized planning workflows
 * 
 * Implements three advanced advisory domains:
 * 1. Special Needs Planning — ABLE accounts, SNTs, government benefit preservation
 * 2. Elder Care Coordination — LTC assessment, care continuum, Medicaid planning
 * 3. Cross-Border Planning — treaty analysis, FBAR/FATCA, foreign tax credits
 */

// ─── SPECIAL NEEDS PLANNING ────────────────────────────────────────

interface SpecialNeedsPlanInput {
  clientAge: number;
  dependentAge: number;
  dependentName: string;
  disabilityType: string;
  currentBenefits: string[];  // SSI, SSDI, Medicaid, etc.
  currentAssets: number;
  annualCareExpenses: number;
  existingTrust?: boolean;
  trustType?: string;
  stateCode: string;
  parentAge?: number;
  parentHealth?: string;
}

export function generateSpecialNeedsPlan(input: SpecialNeedsPlanInput) {
  const ssiAssetLimit = 2000; // Individual SSI resource limit
  const ableMaxAnnual = 18000; // 2024 ABLE account annual contribution limit
  const ableMaxBalance = 100000; // ABLE balance before SSI suspension

  // Determine benefit preservation risk
  const assetRisk = input.currentAssets > ssiAssetLimit ? "HIGH" : "LOW";
  const benefitsAtRisk = input.currentBenefits.filter(b => 
    ["SSI", "Medicaid"].includes(b.toUpperCase())
  );

  // Trust recommendations
  const trustRecommendations: Array<{
    type: string;
    description: string;
    priority: string;
    rationale: string;
  }> = [];

  // First-party SNT (d4A) — if dependent has own assets
  if (input.dependentAge < 65 && input.currentAssets > ssiAssetLimit) {
    trustRecommendations.push({
      type: "First-Party Special Needs Trust (d4A)",
      description: "Self-settled trust funded with dependent's own assets",
      priority: "CRITICAL",
      rationale: `Current assets ($${input.currentAssets.toLocaleString()}) exceed SSI resource limit ($${ssiAssetLimit}). Trust preserves benefit eligibility while protecting assets.`,
    });
  }

  // Third-party SNT — if parents want to leave inheritance
  if (input.parentAge && input.parentAge > 50) {
    trustRecommendations.push({
      type: "Third-Party Special Needs Trust",
      description: "Trust funded by family members, no Medicaid payback requirement",
      priority: "HIGH",
      rationale: "Allows parents to leave inheritance without jeopardizing government benefits. No Medicaid payback provision required at beneficiary's death.",
    });
  }

  // Pooled trust — for smaller amounts
  if (input.currentAssets > ssiAssetLimit && input.currentAssets < 100000) {
    trustRecommendations.push({
      type: "Pooled Special Needs Trust",
      description: "Managed by nonprofit, lower setup costs for smaller estates",
      priority: "MEDIUM",
      rationale: "Cost-effective alternative to individual SNT for estates under $100K. Managed by nonprofit organization.",
    });
  }

  // ABLE account analysis
  const ableEligible = input.dependentAge >= 0; // Disability onset before age 26 (ABLE Age Adjustment Act)
  const ableRecommendation = ableEligible ? {
    eligible: true,
    maxAnnualContribution: ableMaxAnnual,
    maxBalanceBeforeSsiSuspension: ableMaxBalance,
    taxAdvantage: "Tax-free growth and withdrawals for qualified disability expenses",
    stateProgram: `${input.stateCode} ABLE program`,
    complementsSNT: true,
    note: "ABLE accounts complement but do not replace SNTs. First $100K excluded from SSI resource test.",
  } : {
    eligible: false,
    reason: "Disability onset must be before age 26 (ABLE Age Adjustment Act of 2025 raised to 46)",
  };

  // Government benefit preservation strategy
  const preservationStrategy = {
    currentBenefitsAtRisk: benefitsAtRisk,
    assetRiskLevel: assetRisk,
    actions: [] as string[],
  };

  if (assetRisk === "HIGH") {
    preservationStrategy.actions.push(
      "Immediately establish SNT or ABLE account to hold excess assets",
      "Do NOT gift assets directly to dependent — use trust structure",
      "Review all bank accounts and ensure dependent's countable resources stay below $2,000",
    );
  }
  preservationStrategy.actions.push(
    "Coordinate with benefits attorney to review all income and asset sources",
    "Establish letter of intent documenting care preferences and routines",
    "Name SNT as beneficiary on life insurance and retirement accounts (not the dependent directly)",
    "Review guardian/conservator designations annually",
  );

  // Care cost projection
  const inflationRate = 0.04; // Healthcare inflation
  const yearsToProject = Math.max(30, 85 - input.dependentAge);
  const projectedCosts: Array<{ year: number; annualCost: number; cumulativeCost: number }> = [];
  let cumulative = 0;
  for (let y = 0; y < Math.min(yearsToProject, 50); y += 5) {
    const annualCost = input.annualCareExpenses * Math.pow(1 + inflationRate, y);
    cumulative += annualCost * 5;
    projectedCosts.push({ year: y, annualCost: Math.round(annualCost), cumulativeCost: Math.round(cumulative) });
  }

  return {
    dependentProfile: {
      name: input.dependentName,
      age: input.dependentAge,
      disabilityType: input.disabilityType,
      currentBenefits: input.currentBenefits,
    },
    trustRecommendations,
    ableAccount: ableRecommendation,
    benefitPreservation: preservationStrategy,
    careCostProjection: {
      currentAnnualCost: input.annualCareExpenses,
      inflationAssumption: inflationRate,
      projectionYears: yearsToProject,
      milestones: projectedCosts,
      lifetimeEstimate: cumulative,
    },
    letterOfIntent: {
      required: true,
      sections: [
        "Daily care routines and preferences",
        "Medical history and current medications",
        "Behavioral considerations and triggers",
        "Social activities and community connections",
        "Housing preferences and requirements",
        "Financial management instructions",
        "Guardian/caregiver succession plan",
      ],
    },
    complianceNotes: [
      "Special needs planning requires coordination with qualified disability attorney",
      "Trust documents must comply with state-specific requirements",
      "Annual review of government benefit eligibility rules is essential",
      "ABLE account rules vary by state — verify state program details",
    ],
  };
}

// ─── ELDER CARE COORDINATION ───────────────────────────────────────

interface ElderCareInput {
  clientAge: number;
  healthStatus: string;  // excellent, good, fair, poor
  adlLimitations: string[];  // Activities of Daily Living
  iadlLimitations: string[];  // Instrumental ADLs
  currentLivingSituation: string;
  monthlyIncome: number;
  totalAssets: number;
  ltcInsurance: boolean;
  ltcDailyBenefit?: number;
  ltcBenefitPeriod?: number;  // years
  stateCode: string;
  spouseAge?: number;
  spouseHealth?: string;
  veteranStatus?: boolean;
}

export function generateElderCarePlan(input: ElderCareInput) {
  // ADL assessment (2+ ADL limitations = LTC insurance trigger)
  const adlCount = input.adlLimitations.length;
  const iadlCount = input.iadlLimitations.length;
  const ltcTrigger = adlCount >= 2;
  const cognitiveImpairment = input.adlLimitations.some(a => 
    a.toLowerCase().includes("cognitive") || a.toLowerCase().includes("memory")
  );

  // Care continuum assessment
  type CareLevel = {
    level: string;
    description: string;
    monthlyCost: number;
    appropriate: boolean;
    rationale: string;
  };

  const careLevels: CareLevel[] = [
    {
      level: "Independent Living",
      description: "Community with social activities, no medical care",
      monthlyCost: 3500,
      appropriate: adlCount === 0 && iadlCount <= 1,
      rationale: adlCount === 0 ? "Appropriate given current independence level" : "Not appropriate — ADL limitations require higher care level",
    },
    {
      level: "Assisted Living",
      description: "Help with ADLs, medication management, meals",
      monthlyCost: 5500,
      appropriate: adlCount >= 1 && adlCount <= 3 && !cognitiveImpairment,
      rationale: adlCount >= 1 && adlCount <= 3 ? "Appropriate for current ADL limitation level" : "May not match current needs",
    },
    {
      level: "Memory Care",
      description: "Specialized dementia/Alzheimer's care environment",
      monthlyCost: 7500,
      appropriate: cognitiveImpairment,
      rationale: cognitiveImpairment ? "Cognitive impairment indicates memory care need" : "Not currently indicated",
    },
    {
      level: "Skilled Nursing",
      description: "24/7 medical care, rehabilitation services",
      monthlyCost: 10000,
      appropriate: adlCount >= 4 || input.healthStatus === "poor",
      rationale: adlCount >= 4 ? "Multiple ADL limitations require skilled nursing" : "Not currently indicated",
    },
    {
      level: "Home Health Care",
      description: "Professional caregivers in client's home",
      monthlyCost: 6000,
      appropriate: adlCount >= 1 && adlCount <= 3,
      rationale: "Alternative to facility care — maintains independence while providing needed support",
    },
  ];

  const recommendedLevel = careLevels.find(c => c.appropriate) || careLevels[1];

  // Medicaid planning (if assets need protection)
  const medicaidAssetLimit = input.spouseAge ? 154140 : 2000; // 2024 CSRA
  const medicaidIncomeLimit = input.spouseAge ? 3853 : 2829; // Monthly
  const medicaidPlanning = {
    assetExposure: Math.max(0, input.totalAssets - medicaidAssetLimit),
    incomeExposure: Math.max(0, input.monthlyIncome - medicaidIncomeLimit),
    lookbackPeriod: 60, // months
    strategies: [] as string[],
  };

  if (medicaidPlanning.assetExposure > 0) {
    medicaidPlanning.strategies.push(
      "Irrevocable Medicaid Asset Protection Trust (must be funded 5+ years before need)",
      "Spousal refusal strategy (state-specific, consult elder law attorney)",
      "Caregiver child exception (child lived in home 2+ years providing care)",
      "Home equity protection through proper titling",
    );
  }

  // Veterans benefits assessment
  const veteranBenefits = input.veteranStatus ? {
    aidAndAttendance: {
      eligible: adlCount >= 2 || input.clientAge >= 65,
      maxMonthlyBenefit: input.spouseAge ? 2431 : 2229,
      description: "VA Aid & Attendance pension for veterans needing help with ADLs",
    },
    homeBound: {
      eligible: adlCount >= 1,
      maxMonthlyBenefit: 1881,
      description: "Housebound pension for veterans substantially confined to home",
    },
    note: "VA benefits have a 3-year lookback period for asset transfers",
  } : null;

  // LTC insurance gap analysis
  const ltcGap = input.ltcInsurance ? {
    dailyBenefit: input.ltcDailyBenefit || 0,
    benefitPeriod: input.ltcBenefitPeriod || 3,
    totalBenefitPool: (input.ltcDailyBenefit || 0) * 365 * (input.ltcBenefitPeriod || 3),
    estimatedDailyCost: recommendedLevel.monthlyCost / 30,
    dailyGap: Math.max(0, recommendedLevel.monthlyCost / 30 - (input.ltcDailyBenefit || 0)),
    monthlyGap: Math.max(0, recommendedLevel.monthlyCost - (input.ltcDailyBenefit || 0) * 30),
    yearsOfCoverage: input.ltcBenefitPeriod || 3,
    selfFundGap: Math.max(0, recommendedLevel.monthlyCost - (input.ltcDailyBenefit || 0) * 30) * 12 * (input.ltcBenefitPeriod || 3),
  } : {
    dailyBenefit: 0,
    benefitPeriod: 0,
    totalBenefitPool: 0,
    estimatedDailyCost: recommendedLevel.monthlyCost / 30,
    dailyGap: recommendedLevel.monthlyCost / 30,
    monthlyGap: recommendedLevel.monthlyCost,
    yearsOfCoverage: 0,
    selfFundGap: recommendedLevel.monthlyCost * 12 * 3, // 3-year average stay
  };

  return {
    assessment: {
      adlLimitations: input.adlLimitations,
      iadlLimitations: input.iadlLimitations,
      adlCount,
      iadlCount,
      ltcInsuranceTrigger: ltcTrigger,
      cognitiveImpairment,
      healthStatus: input.healthStatus,
    },
    careContinuum: {
      levels: careLevels,
      recommended: recommendedLevel,
    },
    ltcGapAnalysis: ltcGap,
    medicaidPlanning,
    veteranBenefits,
    financialProjection: {
      monthlyCareCost: recommendedLevel.monthlyCost,
      annualCareCost: recommendedLevel.monthlyCost * 12,
      yearsOfSelfFunding: input.totalAssets > 0 ? Math.floor(input.totalAssets / (recommendedLevel.monthlyCost * 12)) : 0,
      assetDepletionDate: input.totalAssets > 0
        ? new Date(Date.now() + Math.floor(input.totalAssets / (recommendedLevel.monthlyCost * 12)) * 365.25 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
        : "Immediate",
    },
    complianceNotes: [
      "Elder care planning requires coordination with elder law attorney",
      "Medicaid rules vary significantly by state — verify state-specific limits",
      "VA benefits require specific application process and documentation",
      "LTC insurance claims require physician certification of benefit triggers",
      "Annual review of care needs and financial projections recommended",
    ],
  };
}

// ─── CROSS-BORDER PLANNING ─────────────────────────────────────────

interface CrossBorderInput {
  citizenshipCountries: string[];
  residenceCountry: string;
  taxResidenceCountries: string[];
  foreignAccounts: Array<{
    country: string;
    accountType: string;
    maxBalance: number;
  }>;
  foreignIncome: Array<{
    country: string;
    type: string;  // employment, rental, dividends, etc.
    amount: number;
    taxPaid: number;
  }>;
  foreignRealEstate: Array<{
    country: string;
    value: number;
    rentalIncome?: number;
  }>;
  pficHoldings?: Array<{
    country: string;
    fundName: string;
    value: number;
  }>;
  totalWorldwideIncome: number;
  usTaxFiled: boolean;
}

export function generateCrossBorderPlan(input: CrossBorderInput) {
  const isUSPerson = input.citizenshipCountries.includes("US") || input.residenceCountry === "US";

  // FBAR analysis
  const totalForeignBalance = input.foreignAccounts.reduce((sum, a) => sum + a.maxBalance, 0);
  const fbarRequired = totalForeignBalance > 10000;
  const fbarAnalysis = {
    required: fbarRequired,
    threshold: 10000,
    totalForeignBalance,
    accountCount: input.foreignAccounts.length,
    deadline: "April 15 (auto-extended to October 15)",
    penalty: fbarRequired ? {
      nonWillful: "$12,500 per violation",
      willful: "Greater of $100,000 or 50% of account balance per violation",
      criminal: "Up to $500,000 and/or 10 years imprisonment",
    } : null,
    accounts: input.foreignAccounts.map(a => ({
      ...a,
      reportable: true,
    })),
  };

  // FATCA Form 8938 analysis
  const fatcaThreshold = input.residenceCountry === "US"
    ? { single: 50000, married: 100000, yearEnd: { single: 75000, married: 150000 } }
    : { single: 200000, married: 400000, yearEnd: { single: 300000, married: 600000 } };
  
  const fatcaRequired = totalForeignBalance > fatcaThreshold.single;
  const fatcaAnalysis = {
    required: fatcaRequired,
    threshold: fatcaThreshold,
    totalForeignAssets: totalForeignBalance + input.foreignRealEstate.reduce((s, r) => s + r.value, 0),
    form: "Form 8938 (Statement of Specified Foreign Financial Assets)",
    filedWith: "IRS (attached to tax return)",
    note: "FATCA and FBAR have different thresholds and filing requirements — both may be required",
  };

  // Foreign Tax Credit analysis
  const foreignTaxCredits = input.foreignIncome.map(inc => {
    const effectiveRate = inc.amount > 0 ? inc.taxPaid / inc.amount : 0;
    const usRate = 0.24; // Approximate marginal rate
    const creditLimitation = inc.amount * usRate;
    const allowableCredit = Math.min(inc.taxPaid, creditLimitation);
    const excessCredit = Math.max(0, inc.taxPaid - creditLimitation);

    return {
      country: inc.country,
      incomeType: inc.type,
      income: inc.amount,
      foreignTaxPaid: inc.taxPaid,
      effectiveForeignRate: effectiveRate,
      creditLimitation,
      allowableCredit,
      excessCredit,
      carryForward: excessCredit > 0,
      carryForwardYears: 10,
      method: effectiveRate > usRate ? "Credit preferred (high-tax country)" : "Credit or deduction analysis needed",
    };
  });

  const totalForeignTaxPaid = foreignTaxCredits.reduce((s, c) => s + c.foreignTaxPaid, 0);
  const totalAllowableCredit = foreignTaxCredits.reduce((s, c) => s + c.allowableCredit, 0);

  // Treaty analysis
  const treatyCountries = input.taxResidenceCountries.filter(c => c !== "US");
  const treatyAnalysis = treatyCountries.map(country => ({
    country,
    treatyExists: true, // Simplified — US has treaties with most major countries
    keyProvisions: [
      `Reduced withholding rates on dividends, interest, and royalties from ${country}`,
      `Tie-breaker rules for dual residents of US and ${country}`,
      `Potential exemption for certain pension/social security income`,
      `Competent authority procedures for double taxation disputes`,
    ],
    savingsClause: "US savings clause preserves US right to tax its citizens/residents",
    form: "Form 8833 (Treaty-Based Return Position Disclosure)",
  }));

  // PFIC analysis
  const pficAnalysis = input.pficHoldings && input.pficHoldings.length > 0 ? {
    hasPFICs: true,
    holdings: input.pficHoldings,
    totalValue: input.pficHoldings.reduce((s, p) => s + p.value, 0),
    electionOptions: [
      {
        type: "QEF Election",
        description: "Qualified Electing Fund — include pro-rata share of income annually",
        advantage: "Avoids excess distribution regime and interest charges",
        disadvantage: "Requires annual information from the fund (may be difficult to obtain)",
      },
      {
        type: "Mark-to-Market Election",
        description: "Recognize unrealized gains/losses annually",
        advantage: "Simpler than QEF, no fund cooperation needed",
        disadvantage: "Gains taxed as ordinary income, losses limited",
      },
      {
        type: "Default (Section 1291)",
        description: "Excess distribution regime with interest charges",
        advantage: "No annual action required",
        disadvantage: "Punitive tax treatment — excess distributions allocated over holding period with interest",
      },
    ],
    recommendation: "QEF election preferred if fund provides required information; otherwise mark-to-market",
  } : {
    hasPFICs: false,
    note: "No PFIC holdings identified. Avoid investing in foreign mutual funds or ETFs to prevent PFIC issues.",
  };

  // Filing obligations summary
  const filingObligations = [
    { form: "Form 1040", description: "US income tax return (worldwide income)", required: isUSPerson },
    { form: "FinCEN 114 (FBAR)", description: "Report of Foreign Bank and Financial Accounts", required: fbarRequired },
    { form: "Form 8938", description: "Statement of Specified Foreign Financial Assets", required: fatcaRequired },
    { form: "Form 1116", description: "Foreign Tax Credit", required: totalForeignTaxPaid > 0 },
    { form: "Form 8833", description: "Treaty-Based Return Position Disclosure", required: treatyCountries.length > 0 },
    { form: "Form 8621", description: "PFIC Annual Information Statement", required: (input.pficHoldings?.length ?? 0) > 0 },
    { form: "Form 3520", description: "Annual Return for Foreign Trusts", required: false },
    { form: "Form 5471", description: "Information Return for Foreign Corporation", required: false },
  ].filter(f => f.required);

  return {
    profile: {
      citizenships: input.citizenshipCountries,
      residence: input.residenceCountry,
      taxResidences: input.taxResidenceCountries,
      isUSPerson,
    },
    fbar: fbarAnalysis,
    fatca: fatcaAnalysis,
    foreignTaxCredits: {
      credits: foreignTaxCredits,
      totalForeignTaxPaid,
      totalAllowableCredit,
      netTaxSavings: totalAllowableCredit,
    },
    treatyAnalysis,
    pficAnalysis,
    filingObligations,
    riskAssessment: {
      complianceRisk: !input.usTaxFiled && isUSPerson ? "CRITICAL" : fbarRequired && !input.usTaxFiled ? "HIGH" : "LOW",
      penaltyExposure: !input.usTaxFiled && fbarRequired
        ? `Potential FBAR penalties up to $${Math.round(totalForeignBalance * 0.5).toLocaleString()} plus income tax penalties`
        : "Current compliance appears adequate",
      voluntaryDisclosure: !input.usTaxFiled && isUSPerson
        ? "Consider Streamlined Filing Compliance Procedures or Voluntary Disclosure Practice"
        : null,
    },
    complianceNotes: [
      "Cross-border tax planning requires coordination with international tax specialist",
      "Treaty provisions are complex and fact-specific — professional analysis required",
      "FBAR and FATCA penalties are severe — timely filing is critical",
      "Foreign tax credit carryforward expires after 10 years",
      "PFIC rules are among the most complex in the Internal Revenue Code",
      "State tax obligations may differ from federal — review state nexus rules",
    ],
  };
}
