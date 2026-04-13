/* ═══════════════════════════════════════════════════════════════
   WealthBridge Unified Wealth Engine v7 — Calculation Engine
   Extracted from Calculators.tsx for code-splitting
   ═══════════════════════════════════════════════════════════════ */

/* ═══ RATES — Age-based premium rate tables from industry data (2025-2026) ═══ */
export const RATES = {
  termPer100K: [{age:20,rate:31},{age:25,rate:33},{age:30,rate:35},{age:35,rate:42},{age:40,rate:56},{age:45,rate:78},{age:50,rate:135},{age:55,rate:195},{age:60,rate:377},{age:65,rate:620},{age:70,rate:1557}],
  iulPer100K: [{age:20,rate:480},{age:25,rate:540},{age:30,rate:660},{age:35,rate:840},{age:40,rate:1080},{age:45,rate:1380},{age:50,rate:1800},{age:55,rate:2400},{age:60,rate:3240},{age:65,rate:4500}],
  wlPer100K: [{age:20,rate:603},{age:25,rate:720},{age:30,rate:862},{age:35,rate:1020},{age:40,rate:1277},{age:45,rate:1620},{age:50,rate:2014},{age:55,rate:2580},{age:60,rate:3360},{age:65,rate:4500}],
  diPctBenefit: [{age:25,rate:.020},{age:30,rate:.022},{age:35,rate:.025},{age:40,rate:.030},{age:45,rate:.038},{age:50,rate:.048},{age:55,rate:.060},{age:60,rate:.080}],
  ltcAnnual: [{age:40,rate:2400},{age:45,rate:3200},{age:50,rate:4200},{age:55,rate:5600},{age:60,rate:7800},{age:65,rate:10800},{age:70,rate:15600}],
  aumFee: (aum: number) => { if(aum>=5e6) return .006; if(aum>=1e6) return .0085; if(aum>=5e5) return .01; return .0125; },
  fiaRiderFee: .01,
  groupPerEmp: 7911,
  bracketsMFJ: [[23200,.10],[94300,.12],[201050,.22],[383900,.24],[487450,.32],[731200,.35],[1e9,.37]] as [number,number][],
  bracketsSingle: [[11600,.10],[47150,.12],[100525,.22],[191950,.24],[243725,.32],[609350,.35],[1e9,.37]] as [number,number][],
};

/* ═══ HELPER FUNCTIONS ═══ */
export function fmt(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return '—';
  if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  return '$' + Math.round(n).toLocaleString();
}
export function fmtSm(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return '—';
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e9) return s + '$' + (a / 1e9).toFixed(1) + 'B';
  if (a >= 1e6) { const m = a / 1e6; return s + '$' + (m >= 10 ? Math.round(m) : m.toFixed(1)) + 'M'; }
  if (a >= 10000) { const k = Math.round(a / 1e3); return s + '$' + k + 'K'; }
  if (a >= 1000) { const k = a / 1e3; return s + '$' + (k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)) + 'K'; }
  return s + '$' + Math.round(a);
}
export function pct(n: number): string { if (!isFinite(n)) return '—'; return (n * 100).toFixed(1) + '%'; }
export function fv(p: number, m: number, r: number, y: number): number {
  const rm = r / 12;
  if (rm === 0) return p + m * y * 12;
  return p * Math.pow(1 + rm, y * 12) + m * (Math.pow(1 + rm, y * 12) - 1) / rm;
}
export function interpRate(table: {age:number,rate:number}[], age: number): number {
  if (age <= table[0].age) return table[0].rate;
  if (age >= table[table.length - 1].age) return table[table.length - 1].rate;
  for (let i = 0; i < table.length - 1; i++) {
    if (age >= table[i].age && age <= table[i + 1].age) {
      const p = (age - table[i].age) / (table[i + 1].age - table[i].age);
      const r = table[i].rate + (table[i + 1].rate - table[i].rate) * p;
      return r >= 1 ? Math.round(r) : r;
    }
  }
  return table[table.length - 1].rate;
}
export function estPrem(type: string, age: number, amount: number): number {
  if (amount <= 0) return 0;
  switch (type) {
    case 'term': return Math.round(interpRate(RATES.termPer100K, age) * (amount / 100000));
    case 'iul': return Math.round(interpRate(RATES.iulPer100K, age) * (amount / 100000));
    case 'wl': return Math.round(interpRate(RATES.wlPer100K, age) * (amount / 100000));
    case 'di': return Math.round(interpRate(RATES.diPctBenefit, age) * amount);
    case 'ltc': return Math.round(interpRate(RATES.ltcAnnual, age) * (amount / 150000));
    case 'group': return Math.round(RATES.groupPerEmp * amount);
    default: return 0;
  }
}
export function sc(val: number): { label: string; color: string; icon: string } {
  if (val >= 3) return { label: 'Strong', color: 'text-green-400', icon: '✓' };
  if (val >= 2) return { label: 'Moderate', color: 'text-yellow-400', icon: '⚠' };
  return { label: 'Needs Attention', color: 'text-red-400', icon: '✗' };
}
export function getBracketRate(income: number, brackets: [number, number][]): number {
  let tax = 0, prev = 0;
  for (const [limit, rate] of brackets) {
    if (income <= limit) { tax += (income - prev) * rate; break; }
    tax += (limit - prev) * rate; prev = limit;
  }
  return income > 0 ? tax / income : 0;
}

/* ═══ PRODUCT MODEL FUNCTIONS ═══ */
export interface ProductResult {
  cashValue: number; deathBenefit: number; taxSaving: number;
  livingBenefit: number; legacyValue: number; annualCost: number;
  label: string; carrier: string; expectedValue?: number;
  incomeValue?: number;
}
export function modelTerm(age: number, face: number, termLen = 20): ProductResult {
  const annPrem = estPrem('term', age, face);
  return { cashValue: 0, deathBenefit: face, taxSaving: 0, livingBenefit: 0,
    legacyValue: face, annualCost: annPrem, label: `Term ${termLen}yr`, carrier: 'NLG' };
}
export function modelIUL(age: number, face: number, annPrem?: number): ProductResult {
  const prem = annPrem || estPrem('iul', age, face);
  const cashValue = Math.round(prem * 10 * 0.6);
  return { cashValue, deathBenefit: face, taxSaving: Math.round(cashValue * 0.25),
    livingBenefit: Math.round(face * 0.5), legacyValue: face, annualCost: prem,
    label: 'IUL', carrier: 'NLG FlexLife' };
}
export function modelWL(age: number, face: number, annPrem?: number): ProductResult {
  const prem = annPrem || estPrem('wl', age, face);
  const cashValue = Math.round(prem * 10 * 0.45);
  return { cashValue, deathBenefit: face, taxSaving: Math.round(cashValue * 0.25),
    livingBenefit: 0, legacyValue: face, annualCost: prem,
    label: 'Whole Life', carrier: 'NLG/MassMutual' };
}
export function modelDI(age: number, annBenefit: number): ProductResult {
  const prem = estPrem('di', age, annBenefit);
  return { cashValue: 0, deathBenefit: 0, taxSaving: 0,
    livingBenefit: annBenefit, legacyValue: 0, annualCost: prem,
    expectedValue: Math.round(annBenefit * 0.012 * 2.88),
    label: 'Disability Insurance', carrier: 'Guardian' };
}
export function modelLTC(age: number, benefitPool = 150000): ProductResult {
  const prem = estPrem('ltc', age, benefitPool);
  return { cashValue: 0, deathBenefit: Math.round(prem * 10 * 0.8), taxSaving: Math.round(prem * 0.15),
    livingBenefit: benefitPool, legacyValue: Math.round(prem * 10 * 0.8), annualCost: prem,
    label: 'Hybrid LTC', carrier: 'Lincoln MoneyGuard' };
}
export function modelFIA(deposit: number, annContrib = 0): ProductResult {
  const value = Math.round((deposit + annContrib * 10) * Math.pow(1.055, 10));
  const income = Math.round(value * 0.055);
  return { cashValue: value, deathBenefit: Math.round(value * 1.1), taxSaving: Math.round(value * 0.15),
    livingBenefit: 0, legacyValue: Math.round(value * 1.1), annualCost: Math.round(deposit * RATES.fiaRiderFee),
    incomeValue: income, label: 'FIA', carrier: 'NLG/Athene' };
}

/* ═══ SCORING ENGINE ═══ */
export interface DomainScore { name: string; score: number; maxScore: number; }
export interface Pillar { name: string; domains: string[]; score: number; maxScore: number; }
export interface Recommendation { product: string; coverage: string; premium: number; monthly: number; carrier: string; priority: string; }

export function computeScorecard(s: Record<string, number>): {
  domains: DomainScore[]; pillars: Pillar[]; overall: number; maxScore: number; pctScore: number;
} {
  const domains: DomainScore[] = [
    { name: 'Cash Flow', score: s.cash ?? 0, maxScore: 3 },
    { name: 'Protection', score: s.protect ?? 0, maxScore: 3 },
    { name: 'Growth', score: s.growth ?? 0, maxScore: 3 },
    { name: 'Retirement', score: s.retire ?? 0, maxScore: 3 },
    { name: 'Tax', score: s.tax ?? 0, maxScore: 3 },
    { name: 'Estate', score: s.estate ?? 0, maxScore: 3 },
    { name: 'Education', score: s.edu ?? 0, maxScore: 3 },
  ];
  const pillars: Pillar[] = [
    { name: 'Plan', domains: ['Cash Flow', 'Tax'], score: (s.cash ?? 0) + (s.tax ?? 0), maxScore: 6 },
    { name: 'Protect', domains: ['Protection', 'Estate'], score: (s.protect ?? 0) + (s.estate ?? 0), maxScore: 6 },
    { name: 'Grow', domains: ['Growth', 'Retirement', 'Education'], score: (s.growth ?? 0) + (s.retire ?? 0) + (s.edu ?? 0), maxScore: 9 },
  ];
  const overall = domains.reduce((a, d) => a + d.score, 0);
  const maxScore = domains.reduce((a, d) => a + d.maxScore, 0);
  return { domains, pillars, overall, maxScore, pctScore: Math.round(overall / maxScore * 100) };
}

export function buildRecommendations(age: number, income: number, dep: number, nw: number,
  existIns: number, mortgage: number, debt: number, isBiz: boolean, scores: Record<string, number>): Recommendation[] {
  const recs: Recommendation[] = [];
  const dimeNeed = dep > 0 ? Math.round(income * 10 + mortgage + debt + dep * 50000 + 25000 - existIns) : Math.round(income * 6 + debt - existIns);
  if (dimeNeed > 50000) {
    const termFace = Math.round(Math.min(dimeNeed * 0.6, dimeNeed));
    const iulFace = Math.round(dimeNeed * 0.4);
    if (termFace > 0) {
      const p = estPrem('term', age, termFace);
      recs.push({ product: 'NLG Term 20yr', coverage: fmtSm(termFace), premium: p, monthly: Math.round(p / 12), carrier: 'National Life Group', priority: scores.protect < 2 ? 'High' : 'Medium' });
    }
    if (iulFace > 100000) {
      const p = estPrem('iul', age, iulFace);
      recs.push({ product: 'NLG IUL FlexLife', coverage: fmtSm(iulFace), premium: p, monthly: Math.round(p / 12), carrier: 'National Life Group', priority: 'Medium' });
    }
  }
  if (income > 30000) {
    const diBen = Math.round(income * 0.6);
    const p = estPrem('di', age, diBen);
    recs.push({ product: 'Guardian DI', coverage: fmt(diBen) + '/yr', premium: p, monthly: Math.round(p / 12), carrier: 'Guardian', priority: scores.protect < 2 ? 'High' : 'Medium' });
  }
  if (age >= 35) {
    const p = estPrem('ltc', age, 150000);
    recs.push({ product: 'Lincoln MoneyGuard LTC', coverage: '$150K pool', premium: p, monthly: Math.round(p / 12), carrier: 'Lincoln Financial', priority: age >= 50 ? 'High' : 'Low' });
  }
  if (scores.retire < 3 && nw > 50000) {
    const deposit = Math.round(Math.min(nw * 0.2, 200000));
    const p = Math.round(deposit * RATES.fiaRiderFee);
    recs.push({ product: 'NLG FIA + Income Rider', coverage: fmtSm(deposit) + ' deposit', premium: p, monthly: Math.round(p / 12), carrier: 'NLG/Athene', priority: 'Medium' });
  }
  if (isBiz) {
    const keyPrem = estPrem('term', age, income * 3);
    recs.push({ product: 'Key Person (Term)', coverage: fmtSm(income * 3), premium: keyPrem, monthly: Math.round(keyPrem / 12), carrier: 'NLG', priority: 'High' });
  }
  return recs;
}

/* ═══ CALCULATION ENGINES ═══ */

// Cash Flow
export interface CFResult {
  gross: number; taxRate: number; net: number; expenses: {label:string;amount:number}[];
  totalExp: number; surplus: number; saveRate: number; dti: number;
  emTarget: number; emGap: number; goalTarget?: number;
}
export function calcCashFlow(gross: number, taxRate: number, housing: number, transport: number,
  food: number, insurance: number, debtPmt: number, other: number,
  emMonths: number, savings: number, goalRate?: number): CFResult {
  const net = Math.round(gross * (1 - taxRate));
  const expenses = [
    {label:'Housing',amount:housing},{label:'Transport',amount:transport},{label:'Food',amount:food},
    {label:'Insurance',amount:insurance},{label:'Debt Pmts',amount:debtPmt},{label:'Other',amount:other}
  ];
  const totalExp = expenses.reduce((a,e)=>a+e.amount,0);
  const surplus = net - totalExp;
  const saveRate = gross > 0 ? surplus / gross : 0;
  const dti = gross > 0 ? (housing + debtPmt) / gross : 0;
  const emTarget = emMonths * totalExp;
  const emGap = Math.max(0, emTarget - Math.min(savings, emTarget));
  return { gross, taxRate, net, expenses, totalExp, surplus, saveRate, dti, emTarget, emGap,
    goalTarget: goalRate ? Math.round(gross * goalRate) : undefined };
}

// Protection — DIME method
export interface PRResult {
  dimeNeed: number; components: {label:string;amount:number}[];
  existingCoverage: number; gap: number; products: {need:string;coverage:number;product:string;premium:number;monthly:number;carrier:string}[];
  totalPremium: number; diNeed: number; diPrem: number; ltcPool: number; ltcPrem: number;
}
export function calcProtection(income: number, dep: number, mortgage: number, debt: number,
  existIns: number, age: number, yrs: number, payoffRate: number, eduPerChild: number,
  finalExp: number, ssBenefit: number, diPct: number): PRResult {
  const components = [
    {label:'Debt Payoff',amount:mortgage+debt},
    {label:'Income Replace ('+yrs+'yr)',amount:Math.round(income*yrs*(1-payoffRate))},
    {label:'Education ('+dep+' children)',amount:dep*eduPerChild},
    {label:'Final Expenses',amount:finalExp},
  ];
  const dimeNeed = components.reduce((a,c)=>a+c.amount,0);
  const gap = Math.max(0, dimeNeed - existIns);
  const termFace = Math.round(gap * 0.6);
  const iulFace = Math.round(gap * 0.4);
  const products: PRResult['products'] = [];
  if (termFace > 0) products.push({need:'Income Replace',coverage:termFace,product:'NLG Term 20yr',premium:estPrem('term',age,termFace),monthly:Math.round(estPrem('term',age,termFace)/12),carrier:'National Life Group'});
  if (iulFace > 100000) products.push({need:'Wealth+Legacy',coverage:iulFace,product:'NLG IUL FlexLife',premium:estPrem('iul',age,iulFace),monthly:Math.round(estPrem('iul',age,iulFace)/12),carrier:'National Life Group'});
  const diNeed = Math.round(income * diPct);
  const diPrem = estPrem('di', age, diNeed);
  products.push({need:'Disability Income',coverage:diNeed,product:'Guardian DI to 65',premium:diPrem,monthly:Math.round(diPrem/12),carrier:'Guardian'});
  const ltcPool = 150000;
  const ltcPrem = estPrem('ltc', age, ltcPool);
  if (age >= 35) products.push({need:'LTC Coverage',coverage:ltcPool,product:'Lincoln MoneyGuard',premium:ltcPrem,monthly:Math.round(ltcPrem/12),carrier:'Lincoln Financial'});
  const totalPremium = products.reduce((a,p)=>a+p.premium,0);
  return { dimeNeed, components, existingCoverage: existIns, gap, products, totalPremium, diNeed, diPrem, ltcPool, ltcPrem };
}

// Growth — multi-vehicle comparison
export interface GRResult {
  yrs: number; vehicles: {name:string;value:number;taxFree:boolean;note:string}[];
  taxEdge: number;
}
export function calcGrowth(age: number, retireAge: number, monthlySav: number, existing: number,
  infRate: number, taxReturn: number, iul_return: number, fia_return: number): GRResult {
  const yrs = Math.max(1, retireAge - age);
  const taxable = Math.round(fv(existing, monthlySav, taxReturn * 0.75, yrs));
  const four01k = Math.round(fv(existing, monthlySav, taxReturn, yrs));
  const roth = Math.round(fv(existing, monthlySav, taxReturn, yrs));
  const iul = Math.round(fv(0, monthlySav, iul_return, yrs));
  const fia = Math.round(fv(existing * 0.3, 0, fia_return, yrs));
  const vehicles = [
    {name:'Taxable Brokerage',value:taxable,taxFree:false,note:'Capital gains tax on growth'},
    {name:'401(k)/IRA',value:four01k,taxFree:false,note:'Tax-deferred; taxed at withdrawal'},
    {name:'Roth IRA/401(k)',value:roth,taxFree:true,note:'Tax-free growth & withdrawal'},
    {name:'IUL Cash Value',value:iul,taxFree:true,note:'Tax-free loans (IRC §7702)'},
    {name:'FIA + Income Rider',value:fia,taxFree:false,note:'Principal protected, capped upside'},
  ];
  const taxEdge = roth + iul - taxable - Math.round(four01k * 0.75);
  return { yrs, vehicles, taxEdge };
}

// Retirement — SS claiming comparison + portfolio withdrawal
export interface RTResult {
  ssComparison: {age:number;monthly:number;annual:number;cumAt80:number;cumAt85:number;cumAt90:number}[];
  bestAge: number; portfolioAtRetire: number; withdrawal: number; monthlyIncome: number;
  incomeGap: number; rmd72: number;
}
export function calcRetirement(age: number, retireAge: number, ss62: number, ss67: number, ss70: number,
  pension: number, withdrawalRate: number, savings: number, monthlySav: number): RTResult {
  const yrs = Math.max(1, retireAge - age);
  const portfolio = Math.round(fv(savings, monthlySav, 0.07, yrs));
  const withdrawal = Math.round(portfolio * withdrawalRate);
  const ssOptions = [{age:62,monthly:ss62},{age:67,monthly:ss67},{age:70,monthly:ss70}];
  const ssComparison = ssOptions.map(o => {
    const annual = o.monthly * 12;
    const cumAt = (targetAge: number) => { if (o.age > targetAge) return 0; return annual * (targetAge - o.age); };
    return { age: o.age, monthly: o.monthly, annual, cumAt80: cumAt(80), cumAt85: cumAt(85), cumAt90: cumAt(90) };
  });
  const bestAge = ssComparison.reduce((a,b) => b.cumAt85 > a.cumAt85 ? b : a).age;
  const bestSS = ssComparison.find(s => s.age === bestAge)!;
  const monthlyIncome = Math.round(withdrawal / 12 + bestSS.monthly + pension);
  const incomeGap = Math.max(0, Math.round(savings * 0.04 / 12) - monthlyIncome);
  const rmd72 = Math.round(portfolio / 27.4);
  return { ssComparison, bestAge, portfolioAtRetire: portfolio, withdrawal, monthlyIncome, incomeGap, rmd72 };
}

// Tax Planning
export interface TXResult {
  strategies: {name:string;saving:number;note:string}[];
  totalSaving: number; effectiveRate: number; marginalRate: number;
  rothConversion: {amount:number;taxNow:number;taxFreeFuture:number;netBenefit:number};
}
export function calcTax(income: number, stateRate: number, isSelfEmployed: boolean,
  filing: string, retirement401k: number, hsaContrib: number, charitableGiving: number): TXResult {
  const brackets = filing === 'mfj' ? RATES.bracketsMFJ : RATES.bracketsSingle;
  const fedTax = income > 0 ? (() => { let t=0,p=0; for(const[l,r]of brackets){if(income<=l){t+=(income-p)*r;break;}t+=(l-p)*r;p=l;} return t; })() : 0;
  const marginalRate = brackets.find(([l]) => income <= l)?.[1] ?? 0.37;
  const effectiveRate = income > 0 ? (fedTax + income * stateRate) / income : 0;
  const strategies: TXResult['strategies'] = [];
  const max401k = 23500;
  const gap401k = Math.max(0, max401k - retirement401k);
  if (gap401k > 0) strategies.push({name:'Max 401(k)', saving: Math.round(gap401k * marginalRate), note: `Contribute additional ${fmt(gap401k)}/yr`});
  const maxHSA = filing === 'mfj' ? 8300 : 4150;
  const gapHSA = Math.max(0, maxHSA - hsaContrib);
  if (gapHSA > 0) strategies.push({name:'Max HSA', saving: Math.round(gapHSA * (marginalRate + 0.0765)), note: 'Triple tax advantage'});
  const rothAmount = Math.min(50000, income * 0.1);
  const rothTaxNow = Math.round(rothAmount * marginalRate);
  const rothFuture = Math.round(rothAmount * Math.pow(1.07, 20));
  const rothTaxFree = Math.round(rothFuture * marginalRate);
  strategies.push({name:'Roth Conversion', saving: Math.round(rothTaxFree - rothTaxNow), note: `Convert ${fmt(rothAmount)} now, save ${fmt(rothTaxFree - rothTaxNow)} in taxes over 20yr`});
  if (charitableGiving > 0) strategies.push({name:'Charitable Deduction', saving: Math.round(charitableGiving * marginalRate), note: `${fmt(charitableGiving)} giving × ${pct(marginalRate)} rate`});
  if (isSelfEmployed) strategies.push({name:'QBI Deduction (§199A)', saving: Math.round(Math.min(income * 0.2, 182100) * marginalRate), note: '20% of qualified business income'});
  const stdDeduction = filing === 'mfj' ? 29200 : 14600;
  strategies.push({name:'Standard Deduction', saving: Math.round(stdDeduction * marginalRate), note: `${fmt(stdDeduction)} (${filing === 'mfj' ? 'MFJ' : 'Single'})`});
  const totalSaving = strategies.reduce((a,s) => a + s.saving, 0);
  return { strategies, totalSaving, effectiveRate, marginalRate,
    rothConversion: { amount: rothAmount, taxNow: rothTaxNow, taxFreeFuture: rothFuture, netBenefit: rothTaxFree - rothTaxNow }};
}

// Estate
export interface ESResult {
  grossEstate: number; exemption: number; taxable: number; estateTax: number;
  ilitSaving: number; netToHeirs: number; withPlanning: number;
  documents: {name:string;status:string;priority:string}[];
}
export function calcEstate(grossEstate: number, exemption: number, growthRate: number,
  giftingAnnual: number, willStatus: string): ESResult {
  const taxable = Math.max(0, grossEstate - exemption);
  const estateTax = Math.round(taxable * 0.40);
  const ilitSaving = estateTax;
  const netToHeirs = grossEstate - estateTax;
  const withPlanning = grossEstate - Math.round(estateTax * 0.1);
  const documents: ESResult['documents'] = [
    {name:'Last Will & Testament', status: willStatus === 'will' || willStatus === 'trust' ? 'Complete' : 'Missing', priority: 'High'},
    {name:'Revocable Living Trust', status: willStatus === 'trust' ? 'Complete' : 'Missing', priority: 'High'},
    {name:'Durable Power of Attorney', status: willStatus !== 'none' ? 'Likely' : 'Missing', priority: 'High'},
    {name:'Healthcare Directive', status: willStatus !== 'none' ? 'Likely' : 'Missing', priority: 'High'},
    {name:'Beneficiary Designations', status: 'Review Annually', priority: 'Medium'},
    {name:'ILIT (if needed)', status: estateTax > 0 ? 'Recommended' : 'N/A', priority: estateTax > 0 ? 'High' : 'Low'},
  ];
  return { grossEstate, exemption, taxable, estateTax, ilitSaving, netToHeirs, withPlanning, documents };
}

// Education
export interface EDResult {
  children: number; avgAge: number; yrsToCollege: number;
  futureCostPerChild: number; totalFutureCost: number;
  projectedPer529: number; totalProjected: number;
  gapPerChild: number; totalGap: number;
  additionalMonthlyNeeded: number;
}
export function calcEducation(children: number, avgAge: number, targetCost: number,
  infRate: number, returnRate: number, currentBal: number, monthlyContrib: number): EDResult {
  const yrs = Math.max(1, 18 - avgAge);
  const futureCostPerChild = Math.round(targetCost * Math.pow(1 + infRate, yrs));
  const totalFutureCost = futureCostPerChild * children;
  const projectedPer529 = Math.round(fv(currentBal / children, monthlyContrib / children, returnRate, yrs));
  const totalProjected = projectedPer529 * children;
  const gapPerChild = Math.max(0, futureCostPerChild - projectedPer529);
  const totalGap = gapPerChild * children;
  const rm = returnRate / 12;
  const additionalMonthlyNeeded = gapPerChild > 0 && yrs > 0
    ? Math.round(gapPerChild / ((Math.pow(1 + rm, yrs * 12) - 1) / rm))
    : 0;
  return { children, avgAge, yrsToCollege: yrs, futureCostPerChild, totalFutureCost,
    projectedPer529, totalProjected, gapPerChild, totalGap, additionalMonthlyNeeded };
}

/* ═══ COST-BENEFIT ANALYSIS ENGINE ═══ */
export interface HorizonData { yr: number; cost: number; benefit: number; net: number; roi: string; }
export function buildHorizonData(recs: Recommendation[], age: number, income: number, horizons: number[]): HorizonData[] {
  return horizons.map(yr => {
    let totalCost = 0, totalBenefit = 0;
    recs.forEach(r => {
      const annCost = r.premium;
      const isIUL = r.product.includes('IUL');
      const isTerm = r.product.includes('Term');
      const isDI = r.product.includes('DI') || r.product.includes('Disability');
      const isLTC = r.product.includes('LTC') || r.product.includes('MoneyGuard');
      const isFIA = r.product.includes('FIA');
      const termLen = isTerm ? 20 : 99;
      const payYrs = isIUL ? Math.min(yr, 20) : isTerm ? Math.min(yr, termLen) : isDI ? Math.min(yr, Math.max(0, 65 - age)) : yr;
      totalCost += annCost * payYrs;
      const cvNum = parseInt(String(r.coverage).replace(/[^0-9]/g, '')) || 0;
      if (isTerm && yr <= termLen) totalBenefit += cvNum;
      if (isIUL) {
        let cv = 0; for (let y = 1; y <= yr; y++) cv = (cv + (y <= 20 ? annCost : 0)) * (y <= 20 ? 1.04 : 1.05);
        totalBenefit += cvNum + Math.round(cv) + Math.round(cv * 0.25) + Math.round(cvNum * 0.5);
      }
      if (isDI) totalBenefit += Math.round(cvNum * Math.min(yr, 65 - age) * 0.012 * 2.88);
      if (isLTC) totalBenefit += Math.round(150000 * Math.pow(1.03, yr));
      if (isFIA) totalBenefit += Math.round(cvNum * Math.pow(1.055, yr));
    });
    const net = totalBenefit - totalCost;
    const roi = totalCost > 0 ? (totalBenefit / totalCost).toFixed(1) : '—';
    return { yr, cost: totalCost, benefit: totalBenefit, net, roi };
  });
}

/* ═══ STRATEGY COMPARISON DATA ═══ */
export const STRATEGIES = [
  { name: 'Conservative', color: '#3B82F6', annualCost: '$3K-8K',
    bestFor: 'Risk-averse, near retirement',
    description: 'Focus on guaranteed products: whole life, FIA with income rider, term for gap coverage. Minimal market exposure.',
    products: ['Whole Life', 'FIA + Income Rider', 'Term 20yr', 'DI'],
    taxFree: false, deathBenefit: true, marketProtection: true, ltcCoverage: false, creditorProtected: true, complexity: 'Low',
    scores: { Protection: 5, Growth: 2, 'Tax Efficiency': 3, Liquidity: 2, Legacy: 4, Complexity: 1 } as Record<string, number> },
  { name: 'Balanced', color: '#10B981', annualCost: '$5K-15K',
    bestFor: 'Most families, mid-career',
    description: 'Blend of term + IUL for protection and growth, 401(k)/Roth for retirement, DI + LTC for income protection.',
    products: ['Term 20yr', 'IUL', 'DI', 'LTC Hybrid', '401(k)', 'Roth IRA'],
    taxFree: true, deathBenefit: true, marketProtection: true, ltcCoverage: true, creditorProtected: true, complexity: 'Medium',
    scores: { Protection: 4, Growth: 4, 'Tax Efficiency': 4, Liquidity: 3, Legacy: 4, Complexity: 3 } as Record<string, number> },
  { name: 'Aggressive Growth', color: '#F59E0B', annualCost: '$8K-25K',
    bestFor: 'High earners, long horizon',
    description: 'Maximize IUL cash value + Roth conversions + FIA for tax-free retirement income. Aggressive accumulation.',
    products: ['IUL (max-funded)', 'Roth IRA', 'FIA', 'Term (gap)', 'DI'],
    taxFree: true, deathBenefit: true, marketProtection: true, ltcCoverage: false, creditorProtected: true, complexity: 'High',
    scores: { Protection: 3, Growth: 5, 'Tax Efficiency': 5, Liquidity: 4, Legacy: 3, Complexity: 4 } as Record<string, number> },
  { name: 'Legacy', color: '#8B5CF6', annualCost: '$15K-50K+',
    bestFor: 'HNW, estate planning focus',
    description: 'ILIT with survivorship life, premium finance for leverage, charitable strategies, dynasty trust funding.',
    products: ['Survivorship IUL', 'ILIT', 'Premium Finance', 'Charitable Trust', 'FIA'],
    taxFree: true, deathBenefit: true, marketProtection: true, ltcCoverage: true, creditorProtected: true, complexity: 'Very High',
    scores: { Protection: 5, Growth: 4, 'Tax Efficiency': 5, Liquidity: 2, Legacy: 5, Complexity: 5 } as Record<string, number> },
];

/* ═══ CALCULATION METHODS REFERENCE ═══ */
export const CALC_METHODS = [
  { domain: 'Cash Flow', method: 'Gross-to-net budget analysis with DTI ratio', source: 'BLS Consumer Expenditure Survey 2024' },
  { domain: 'Protection', method: 'DIME method (Debt + Income + Mortgage + Education)', source: 'LIMRA 2024, SOA mortality tables' },
  { domain: 'Growth', method: 'Future value with monthly contributions, multi-vehicle comparison', source: 'Morningstar 2024 capital market assumptions' },
  { domain: 'Retirement', method: 'SS claiming age comparison + 4% withdrawal rule', source: 'SSA 2024, Trinity Study (Bengen)' },
  { domain: 'Tax', method: 'Marginal bracket analysis + deduction optimization', source: 'IRS Rev Proc 2024-40, IRC §199A/§408A' },
  { domain: 'Estate', method: 'Gross estate minus exemption, 40% federal rate', source: 'IRC §2010, 2024 exemption $13.61M' },
  { domain: 'Education', method: '529 FV projection with inflation-adjusted cost', source: 'College Board 2024, Vanguard 529' },
  { domain: 'Cost-Benefit', method: 'Multi-horizon NPV across all product dimensions', source: 'Industry actuarial tables, carrier illustrations' },
  { domain: 'Premiums', method: 'Age-interpolated rate tables (term/IUL/WL/DI/LTC)', source: 'NLG, Guardian, Lincoln, Athene rate sheets' },
];

/* ═══ DUE DILIGENCE CHECKLIST ═══ */
export const DUE_DILIGENCE = [
  { item: 'Verify client identity and suitability (KYC/AML)', status: 'Pending' as const, note: 'Required before any product recommendation', category: 'Compliance' },
  { item: 'Document risk tolerance assessment', status: 'Complete' as const, note: 'Captured in Client Profile panel', category: 'Suitability' },
  { item: 'Review existing coverage and avoid replacement issues', status: 'Pending' as const, note: 'Request current policy declarations', category: 'Compliance' },
  { item: 'Confirm all income and asset figures with documentation', status: 'Pending' as const, note: 'Tax returns, pay stubs, account statements', category: 'Data' },
  { item: 'Run carrier-specific illustrations for recommended products', status: 'Not Started' as const, note: 'After product selection finalized', category: 'Products' },
  { item: 'Obtain medical records for underwriting (life/DI)', status: 'Not Started' as const, note: 'APS request after application', category: 'Underwriting' },
  { item: 'Review beneficiary designations on all accounts', status: 'Pending' as const, note: 'Check 401(k), IRA, life policies', category: 'Estate' },
  { item: 'Confirm tax filing status and state of residence', status: 'Complete' as const, note: 'Captured in Client Profile panel', category: 'Tax' },
  { item: 'Document all recommendations and client decisions', status: 'Pending' as const, note: 'Generate from Summary panel', category: 'Compliance' },
  { item: 'Schedule follow-up review within 12 months', status: 'Not Started' as const, note: 'Set calendar reminder', category: 'Service' },
  { item: 'Provide client with policy delivery receipt and free-look notice', status: 'Not Started' as const, note: 'After policy issuance', category: 'Compliance' },
  { item: 'Verify carrier financial strength ratings (AM Best A- or better)', status: 'Complete' as const, note: 'All recommended carriers A- or better', category: 'Products' },
];

/* ═══ ACTION PLAN BUILDER ═══ */
export interface ActionPhase { name: string; timeline: string; actions: string[]; priority: string; }
export function buildActionPlan(pace: 'standard'|'aggressive'|'gradual', recs: Recommendation[],
  scores: Record<string,number>, pr: PRResult, cf: CFResult, ed: EDResult): ActionPhase[] {
  const mult = pace === 'aggressive' ? 0.5 : pace === 'gradual' ? 1.5 : 1;
  const phases: ActionPhase[] = [];
  const p1Actions = ['Complete financial profile and risk assessment'];
  if (cf.emGap > 0) p1Actions.push(`Build emergency fund: ${fmtSm(cf.emGap)} gap`);
  if (scores.protect < 2) p1Actions.push('Apply for life insurance (DIME gap: ' + fmtSm(pr.gap) + ')');
  p1Actions.push('Review and update beneficiary designations');
  phases.push({ name: 'Foundation', timeline: `Month 1-${Math.round(2 * mult)}`, actions: p1Actions, priority: 'Critical' });
  const p2Actions: string[] = [];
  if (pr.gap > 0) p2Actions.push(`Finalize life insurance: ${fmtSm(pr.gap)} coverage`);
  p2Actions.push('Set up disability insurance');
  if (scores.estate < 2) p2Actions.push('Schedule estate attorney consultation');
  p2Actions.push('Automate savings transfers');
  phases.push({ name: 'Protection', timeline: `Month ${Math.round(2*mult)+1}-${Math.round(4*mult)}`, actions: p2Actions, priority: 'High' });
  const p3Actions = ['Maximize 401(k) contributions', 'Open/fund Roth IRA', 'Review IUL illustration and apply'];
  if (ed.totalGap > 0) p3Actions.push(`Increase 529 contributions (+${fmt(ed.additionalMonthlyNeeded)}/mo)`);
  phases.push({ name: 'Growth & Tax', timeline: `Month ${Math.round(4*mult)+1}-${Math.round(8*mult)}`, actions: p3Actions, priority: 'High' });
  const p4Actions = ['Review Roth conversion opportunity', 'Evaluate FIA for retirement income', 'Consider LTC hybrid coverage'];
  if (scores.estate < 3) p4Actions.push('Finalize estate documents (will/trust/POA)');
  phases.push({ name: 'Optimization', timeline: `Month ${Math.round(8*mult)+1}-${Math.round(12*mult)}`, actions: p4Actions, priority: 'Medium' });
  return phases;
}
