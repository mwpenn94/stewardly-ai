/* ═══════════════════════════════════════════════════════════════
   WealthBridge Unified Wealth Engine v7 — Calculation Engine
   Extracted from Calculators.tsx for code-splitting
   ═════════════════════════════════════════════════════════════ */
import { fmt, fmtSm, pct } from './format';
export { fmt, fmtSm, pct };

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
  bracketsMFJ: [[23850,.10],[96950,.12],[206700,.22],[394600,.24],[501050,.32],[751600,.35],[1e9,.37]] as [number,number][],
  bracketsSingle: [[11925,.10],[48475,.12],[103350,.22],[197300,.24],[250525,.32],[626350,.35],[1e9,.37]] as [number,number][],
};

/* ═══ HELPER FUNCTIONS ═══ */
// fmt, fmtSm, pct imported from format.ts (zero-import leaf) to avoid TDZ crashes
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
  const max401k = getConfig('max401k');
  const gap401k = Math.max(0, max401k - retirement401k);
  if (gap401k > 0) strategies.push({name:'Max 401(k)', saving: Math.round(gap401k * marginalRate), note: `Contribute additional ${fmt(gap401k)}/yr`});
  const maxHSA = filing === 'mfj' ? getConfig('maxHSA').family : getConfig('maxHSA').single;
  const gapHSA = Math.max(0, maxHSA - hsaContrib);
  if (gapHSA > 0) strategies.push({name:'Max HSA', saving: Math.round(gapHSA * (marginalRate + 0.0765)), note: 'Triple tax advantage'});
  const rothAmount = Math.min(50000, income * 0.1);
  const rothTaxNow = Math.round(rothAmount * marginalRate);
  const rothFuture = Math.round(rothAmount * Math.pow(1.07, 20));
  const rothTaxFree = Math.round(rothFuture * marginalRate);
  strategies.push({name:'Roth Conversion', saving: Math.round(rothTaxFree - rothTaxNow), note: `Convert ${fmt(rothAmount)} now, save ${fmt(rothTaxFree - rothTaxNow)} in taxes over 20yr`});
  if (charitableGiving > 0) strategies.push({name:'Charitable Deduction', saving: Math.round(charitableGiving * marginalRate), note: `${fmt(charitableGiving)} giving × ${pct(marginalRate)} rate`});
  if (isSelfEmployed) strategies.push({name:'QBI Deduction (§199A)', saving: Math.round(Math.min(income * 0.2, 182100) * marginalRate), note: '20% of qualified business income'});
  const stdDeduction = getConfig('standardDeduction')[filing as keyof typeof CONFIGURABLE_DEFAULTS.standardDeduction] ?? getConfig('standardDeduction').single;
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
  const estateTax = Math.round(taxable * getConfig('estateTaxRate'));
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
  const safeChildren = Math.max(1, children); // guard: prevent division by zero
  const yrs = Math.max(1, 18 - avgAge);
  const futureCostPerChild = Math.round(targetCost * Math.pow(1 + infRate, yrs));
  const totalFutureCost = futureCostPerChild * safeChildren;
  const projectedPer529 = Math.round(fv(currentBal / safeChildren, monthlyContrib / safeChildren, returnRate, yrs));
  const totalProjected = projectedPer529 * safeChildren;
  const gapPerChild = Math.max(0, futureCostPerChild - projectedPer529);
  const totalGap = gapPerChild * safeChildren;
  const rm = returnRate / 12;
  const additionalMonthlyNeeded = gapPerChild > 0 && yrs > 0
    ? (rm > 0 ? Math.round(gapPerChild / ((Math.pow(1 + rm, yrs * 12) - 1) / rm)) : Math.round(gapPerChild / (yrs * 12)))
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
  { domain: 'Retirement', method: 'SS claiming age comparison + 4% withdrawal rule', source: 'SSA 2025, Trinity Study (Bengen)' },
  { domain: 'Tax', method: 'Marginal bracket analysis + deduction optimization', source: 'IRS Rev Proc 2024-40 (updated 2025), IRC §199A/§408A' },
  { domain: 'Estate', method: 'Gross estate minus exemption, 40% federal rate', source: 'IRC §2010, 2025 exemption $13.99M' },
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


/* ═══ ADVANCED STRATEGIES ENGINE ═══ */
export interface AdvResult {
  pf: { face: number; premium: number; cashOutlay: number; loanRate: number; creditRate: number; years: number;
    totalCashOutlay: number; totalLoanInterest: number; totalCashValue: number; netBenefit: number; leverage: string;
    yearByYear: { yr: number; cashOutlay: number; loanBal: number; cashValue: number; net: number }[] };
  ilit: { deathBenefit: number; premium: number; crummey: number; estateTaxRate: number;
    estateTaxSaved: number; annualGiftExclusion: number; netToHeirs: number; withoutILIT: number };
  exec: { baseSalary: number; bonus162: number; serp: number; splitDollar: number;
    totalComp: number; taxBenefit: number; retentionValue: number };
  cv: { crtContrib: number; crtPayout: number; dafContrib: number; liReplacement: number;
    annualIncome: number; taxDeduction: number; totalCharitable: number; netBenefit: number };
  taxSavingsGoal: number; totalTaxSavings: number; goalMet: boolean;
}
export function calcAdvanced(
  pfFace: number, pfPrem: number, pfCash: number, pfLoan: number, pfCred: number, pfYrs: number,
  ilDB: number, ilPr: number, ilCr: number, ilTx: number,
  exSal: number, ex162: number, exSERP: number, exSD: number,
  cvCRT: number, cvPO: number, cvDAF: number, cvLI: number,
  taxGoal: number
): AdvResult {
  /* Premium Financing */
  const yearByYear: AdvResult['pf']['yearByYear'] = [];
  let loanBal = 0, totalCashOutlay = 0, cashValue = 0;
  for (let yr = 1; yr <= pfYrs; yr++) {
    totalCashOutlay += pfCash;
    loanBal = (loanBal + pfPrem - pfCash) * (1 + pfLoan / 100);
    cashValue = (cashValue + pfPrem) * (1 + pfCred / 100);
    yearByYear.push({ yr, cashOutlay: totalCashOutlay, loanBal: Math.round(loanBal), cashValue: Math.round(cashValue), net: Math.round(cashValue - loanBal) });
  }
  const totalLoanInterest = Math.round(loanBal - (pfPrem - pfCash) * pfYrs);
  const pf = {
    face: pfFace, premium: pfPrem, cashOutlay: pfCash, loanRate: pfLoan, creditRate: pfCred, years: pfYrs,
    totalCashOutlay: Math.round(totalCashOutlay), totalLoanInterest, totalCashValue: Math.round(cashValue),
    netBenefit: Math.round(cashValue - loanBal), leverage: pfCash > 0 ? (pfFace / totalCashOutlay).toFixed(1) + 'x' : '—',
    yearByYear,
  };

  /* ILIT */
  const annualGiftExclusion = ilCr * 19000; // 2025 annual exclusion per beneficiary
  const estateTaxSaved = Math.round(ilDB * (ilTx / 100));
  const ilit = {
    deathBenefit: ilDB, premium: ilPr, crummey: ilCr, estateTaxRate: ilTx,
    estateTaxSaved, annualGiftExclusion,
    netToHeirs: ilDB, // ILIT: full DB passes estate-tax-free
    withoutILIT: Math.round(ilDB * (1 - ilTx / 100)),
  };

  /* Executive Compensation */
  const totalComp = exSal + ex162 + exSERP + exSD;
  const taxBenefit = Math.round((ex162 + exSERP) * 0.37); // top marginal rate deduction for employer
  const retentionValue = Math.round(exSERP * 5); // 5-year vesting value
  const exec = { baseSalary: exSal, bonus162: ex162, serp: exSERP, splitDollar: exSD, totalComp, taxBenefit, retentionValue };

  /* Charitable Vehicles */
  const annualIncome = Math.round(cvCRT * (cvPO / 100));
  const taxDeduction = Math.round(cvCRT * 0.35 + cvDAF * 0.37); // approximate deduction
  const totalCharitable = cvCRT + cvDAF;
  const cv = {
    crtContrib: cvCRT, crtPayout: cvPO, dafContrib: cvDAF, liReplacement: cvLI,
    annualIncome, taxDeduction, totalCharitable,
    netBenefit: Math.round(annualIncome * 20 + taxDeduction - cvLI * 0.02 * 20), // 20yr net
  };

  /* Tax Savings Goal */
  const totalTaxSavings = Math.round(
    (pf.netBenefit > 0 ? pf.netBenefit * 0.15 : 0) + // PF tax efficiency
    ilit.estateTaxSaved * 0.04 + // annualized estate tax savings
    exec.taxBenefit +
    cv.taxDeduction
  );
  const goalMet = taxGoal > 0 ? totalTaxSavings >= taxGoal : true;

  return { pf, ilit, exec, cv, taxSavingsGoal: taxGoal, totalTaxSavings, goalMet };
}

/* ═══ BUSINESS CLIENT ENGINE ═══ */
export interface BizClientResult {
  bizValue: number; keyPersonSalary: number; keyPersonMultiplier: number; owners: number; employees: number;
  keyPersonNeed: number; keyPersonPrem: number;
  buySellNeed: number; buySellPremPerOwner: number; buySellTotalPrem: number;
  groupBenefitsCost: number;
  totalAnnualCost: number;
  products: { need: string; coverage: number; product: string; premium: number; monthly: number; carrier: string }[];
}
export function calcBizClient(bizValue: number, keyPersonSalary: number, keyPersonMultiplier: number,
  owners: number, employees: number, age: number): BizClientResult {
  const keyPersonNeed = keyPersonSalary * keyPersonMultiplier;
  const keyPersonPrem = estPrem('term', age, keyPersonNeed);
  const buySellNeed = Math.round(bizValue / Math.max(1, owners));
  const buySellPremPerOwner = estPrem('term', age, buySellNeed);
  const buySellTotalPrem = buySellPremPerOwner * Math.max(0, owners - 1); // cross-purchase
  const groupBenefitsCost = RATES.groupPerEmp * employees;
  const totalAnnualCost = keyPersonPrem + buySellTotalPrem + groupBenefitsCost;

  const products: BizClientResult['products'] = [];
  if (keyPersonNeed > 0) products.push({ need: 'Key Person', coverage: keyPersonNeed, product: 'NLG Term 20yr', premium: keyPersonPrem, monthly: Math.round(keyPersonPrem / 12), carrier: 'National Life Group' });
  if (buySellNeed > 0 && owners > 1) products.push({ need: 'Buy-Sell', coverage: buySellNeed, product: 'Cross-Purchase Term', premium: buySellTotalPrem, monthly: Math.round(buySellTotalPrem / 12), carrier: 'National Life Group' });
  if (employees > 0) products.push({ need: 'Group Benefits', coverage: employees, product: `Group Health (${employees} emp)`, premium: groupBenefitsCost, monthly: Math.round(groupBenefitsCost / 12), carrier: 'Multiple Carriers' });

  return { bizValue, keyPersonSalary, keyPersonMultiplier, owners, employees,
    keyPersonNeed, keyPersonPrem, buySellNeed, buySellPremPerOwner, buySellTotalPrem,
    groupBenefitsCost, totalAnnualCost, products };
}

/* ═══ PARTNER / AFFILIATE EARNINGS ENGINE ═══ */
export interface PartnerResult {
  lowIntros: number; midIntros: number; highIntros: number;
  lowEarnings: number; midEarnings: number; highEarnings: number;
  totalIntros: number; totalMonthly: number; totalAnnual: number;
}
export function calcPartner(lowIntros: number, midIntros: number, highIntros: number): PartnerResult {
  const lowEarnings = lowIntros * 250;
  const midEarnings = midIntros * 500;
  const highEarnings = highIntros * 1000;
  const totalMonthly = lowEarnings + midEarnings + highEarnings;
  return {
    lowIntros, midIntros, highIntros,
    lowEarnings, midEarnings, highEarnings,
    totalIntros: lowIntros + midIntros + highIntros,
    totalMonthly, totalAnnual: totalMonthly * 12,
  };
}

/* ═══ INCOME STREAMS ENGINE ═══ */
export interface IncomeStream {
  id: string;
  source: string;
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'annual' | 'one-time';
  taxTreatment: 'w2' | '1099' | 'passive' | 'tax-free';
  growthRate: number;
  category: 'earned' | 'business' | 'investment' | 'passive' | 'retirement';
}

export interface IncomeStreamResult {
  streams: IncomeStream[];
  totalMonthly: number;
  totalAnnual: number;
  byCategory: { category: string; monthly: number; annual: number; pct: number }[];
  byTax: { treatment: string; monthly: number; annual: number; effectiveRate: number }[];
  diversificationScore: number; // 0-100
  projectedYear5: number;
  projectedYear10: number;
  pillarContributions: { plan: number; protect: number; grow: number };
}

const TAX_RATES: Record<string, number> = {
  w2: 0.30, '1099': 0.35, passive: 0.20, 'tax-free': 0.0,
};

const FREQ_MULTIPLIER: Record<string, number> = {
  monthly: 12, quarterly: 4, annual: 1, 'one-time': 0,
};

export function calcIncomeStreams(streams: IncomeStream[]): IncomeStreamResult {
  const activeStreams = streams.filter(s => s.amount > 0);
  
  // Annualize each stream
  const annualized = activeStreams.map(s => ({
    ...s,
    annual: s.amount * (FREQ_MULTIPLIER[s.frequency] || 1),
    monthly: s.amount * (FREQ_MULTIPLIER[s.frequency] || 1) / 12,
  }));
  
  const totalAnnual = annualized.reduce((sum, s) => sum + s.annual, 0);
  const totalMonthly = Math.round(totalAnnual / 12);

  // By category
  const catMap = new Map<string, number>();
  for (const s of annualized) catMap.set(s.category, (catMap.get(s.category) || 0) + s.annual);
  const byCategory = Array.from(catMap.entries()).map(([category, annual]) => ({
    category,
    monthly: Math.round(annual / 12),
    annual: Math.round(annual),
    pct: totalAnnual > 0 ? annual / totalAnnual : 0,
  })).sort((a, b) => b.annual - a.annual);

  // By tax treatment
  const taxMap = new Map<string, number>();
  for (const s of annualized) taxMap.set(s.taxTreatment, (taxMap.get(s.taxTreatment) || 0) + s.annual);
  const byTax = Array.from(taxMap.entries()).map(([treatment, annual]) => ({
    treatment,
    monthly: Math.round(annual / 12),
    annual: Math.round(annual),
    effectiveRate: TAX_RATES[treatment] || 0.25,
  })).sort((a, b) => b.annual - a.annual);

  // Diversification score (0-100): more categories + more even distribution = higher
  const catCount = byCategory.length;
  const maxCat = 5;
  const catDiversity = Math.min(catCount / maxCat, 1) * 50;
  const hhi = byCategory.reduce((sum, c) => sum + Math.pow(c.pct, 2), 0);
  const evenness = (1 - hhi) * 50;
  const diversificationScore = Math.round(catDiversity + evenness);

  // Projections
  const avgGrowth = activeStreams.length > 0
    ? annualized.reduce((sum, s) => sum + s.growthRate * s.annual, 0) / Math.max(totalAnnual, 1)
    : 0;
  const projectedYear5 = Math.round(totalAnnual * Math.pow(1 + avgGrowth, 5));
  const projectedYear10 = Math.round(totalAnnual * Math.pow(1 + avgGrowth, 10));

  // Pillar contributions
  const planIncome = annualized.filter(s => ['earned', 'business'].includes(s.category)).reduce((sum, s) => sum + s.annual, 0);
  const protectIncome = annualized.filter(s => ['passive', 'retirement'].includes(s.category)).reduce((sum, s) => sum + s.annual, 0);
  const growIncome = annualized.filter(s => ['investment'].includes(s.category)).reduce((sum, s) => sum + s.annual, 0);
  const pillarTotal = Math.max(planIncome + protectIncome + growIncome, 1);
  const pillarContributions = {
    plan: Math.round(planIncome / pillarTotal * 100),
    protect: Math.round(protectIncome / pillarTotal * 100),
    grow: Math.round(growIncome / pillarTotal * 100),
  };

  return {
    streams: activeStreams,
    totalMonthly,
    totalAnnual: Math.round(totalAnnual),
    byCategory,
    byTax,
    diversificationScore,
    projectedYear5,
    projectedYear10,
    pillarContributions,
  };
}

/* ═══════════════════════════════════════════════════════════════
   RETIREMENT INCOME ENGINEERING — Pass 100
   Three methods: Bucket Strategy, Floor-Upside, Guyton-Klinger
   ═══════════════════════════════════════════════════════════════ */

export interface BucketAllocation {
  bucket: string;
  label: string;
  years: number;
  allocation: number;
  assetClass: string;
  expectedReturn: number;
  risk: 'low' | 'medium' | 'high';
}

export interface BucketResult {
  buckets: BucketAllocation[];
  totalNeeded: number;
  annualIncome: number;
  sustainabilityYears: number;
  refillSchedule: { year: number; from: string; to: string; amount: number }[];
}

/** Bucket Strategy: segment portfolio into time-based buckets */
export function calcBucketStrategy(
  portfolio: number, annualSpend: number, ssAnnual: number, pensionAnnual: number
): BucketResult {
  const netSpend = Math.max(0, annualSpend - ssAnnual - pensionAnnual);
  const buckets: BucketAllocation[] = [
    { bucket: '1', label: 'Near-Term (0-3 yr)', years: 3, allocation: 0, assetClass: 'Cash / Short-Term Bonds', expectedReturn: 0.04, risk: 'low' },
    { bucket: '2', label: 'Mid-Term (3-10 yr)', years: 7, allocation: 0, assetClass: 'Intermediate Bonds / Balanced', expectedReturn: 0.055, risk: 'medium' },
    { bucket: '3', label: 'Long-Term (10+ yr)', years: 20, allocation: 0, assetClass: 'Equities / Growth', expectedReturn: 0.08, risk: 'high' },
  ];
  // Allocate: bucket 1 = 3 years of spending, bucket 2 = 7 years, rest in bucket 3
  buckets[0].allocation = Math.min(portfolio, netSpend * 3);
  buckets[1].allocation = Math.min(portfolio - buckets[0].allocation, netSpend * 7);
  buckets[2].allocation = Math.max(0, portfolio - buckets[0].allocation - buckets[1].allocation);
  
  // Refill schedule: annually move from bucket 3 → 2 → 1
  const refillSchedule: BucketResult['refillSchedule'] = [];
  for (let y = 1; y <= 5; y++) {
    refillSchedule.push({ year: y, from: 'Long-Term', to: 'Near-Term', amount: Math.round(netSpend) });
  }
  
  const sustainabilityYears = portfolio > 0 ? Math.round(portfolio / Math.max(netSpend, 1)) : 99;
  return { buckets, totalNeeded: Math.round(netSpend * 30), annualIncome: Math.round(annualSpend), sustainabilityYears: Math.min(sustainabilityYears, 50), refillSchedule };
}

export interface FloorUpsideResult {
  floor: { source: string; annual: number; monthly: number; guaranteed: boolean }[];
  upside: { source: string; annual: number; monthly: number; growthRate: number }[];
  totalFloor: number;
  totalUpside: number;
  totalIncome: number;
  floorCoversPct: number;
  essentialExpenses: number;
}

/** Floor-Upside: guaranteed income floor + growth upside */
export function calcFloorUpside(
  ssAnnual: number, pensionAnnual: number, annuityAnnual: number,
  portfolio: number, withdrawalRate: number, essentialExpenses: number
): FloorUpsideResult {
  const floor = [
    { source: 'Social Security', annual: ssAnnual, monthly: Math.round(ssAnnual / 12), guaranteed: true },
    { source: 'Pension', annual: pensionAnnual, monthly: Math.round(pensionAnnual / 12), guaranteed: true },
    { source: 'Annuity Income', annual: annuityAnnual, monthly: Math.round(annuityAnnual / 12), guaranteed: true },
  ].filter(f => f.annual > 0);
  
  const portfolioWithdrawal = Math.round(portfolio * withdrawalRate);
  const upside = [
    { source: 'Portfolio Withdrawal', annual: portfolioWithdrawal, monthly: Math.round(portfolioWithdrawal / 12), growthRate: 0.07 },
  ];
  
  const totalFloor = floor.reduce((s, f) => s + f.annual, 0);
  const totalUpside = upside.reduce((s, u) => s + u.annual, 0);
  const floorCoversPct = essentialExpenses > 0 ? Math.min(1, totalFloor / essentialExpenses) : 1;
  
  return { floor, upside, totalFloor, totalUpside, totalIncome: totalFloor + totalUpside, floorCoversPct, essentialExpenses };
}

export interface GuytonKlingerResult {
  initialWithdrawal: number;
  currentWithdrawal: number;
  guardrails: { name: string; description: string; triggered: boolean; adjustment: string }[];
  projectedYears: { year: number; portfolio: number; withdrawal: number; rate: number }[];
  ceilingRate: number;
  floorRate: number;
  prosperityRule: boolean;
  capitalPreservation: boolean;
}

/** Guyton-Klinger Decision Rules with guardrails */
export function calcGuytonKlinger(
  portfolio: number, initialRate: number, inflationRate: number, years: number
): GuytonKlingerResult {
  const ceilingRate = initialRate * 1.2; // 20% above initial
  const floorRate = initialRate * 0.8;   // 20% below initial
  let currentPortfolio = portfolio;
  let currentWithdrawal = Math.round(portfolio * initialRate);
  const projectedYears: GuytonKlingerResult['projectedYears'] = [];
  
  for (let y = 0; y < Math.min(years, 30); y++) {
    const rate = currentPortfolio > 0 ? currentWithdrawal / currentPortfolio : 0;
    projectedYears.push({
      year: y + 1,
      portfolio: Math.round(currentPortfolio),
      withdrawal: Math.round(currentWithdrawal),
      rate: Math.round(rate * 10000) / 10000,
    });
    // Simulate market return (7% avg with some variance)
    const marketReturn = 0.07;
    currentPortfolio = Math.round((currentPortfolio - currentWithdrawal) * (1 + marketReturn));
    // Apply inflation adjustment
    currentWithdrawal = Math.round(currentWithdrawal * (1 + inflationRate));
    // Guardrail checks
    const newRate = currentPortfolio > 0 ? currentWithdrawal / currentPortfolio : 0;
    if (newRate > ceilingRate) {
      currentWithdrawal = Math.round(currentWithdrawal * 0.9); // Cut 10%
    } else if (newRate < floorRate) {
      currentWithdrawal = Math.round(currentWithdrawal * 1.1); // Raise 10%
    }
  }
  
  const currentRate = currentPortfolio > 0 ? currentWithdrawal / currentPortfolio : 0;
  const guardrails = [
    { name: 'Prosperity Rule', description: 'If withdrawal rate drops below floor, increase withdrawal by 10%', triggered: currentRate < floorRate, adjustment: '+10%' },
    { name: 'Capital Preservation', description: 'If withdrawal rate exceeds ceiling, reduce withdrawal by 10%', triggered: currentRate > ceilingRate, adjustment: '-10%' },
    { name: 'Withdrawal Rule', description: 'Skip inflation adjustment in years with negative portfolio return', triggered: false, adjustment: 'No COLA' },
    { name: 'Portfolio Management', description: 'Rebalance when any asset class deviates >5% from target', triggered: false, adjustment: 'Rebalance' },
  ];
  
  return {
    initialWithdrawal: Math.round(portfolio * initialRate),
    currentWithdrawal: Math.round(currentWithdrawal),
    guardrails,
    projectedYears,
    ceilingRate,
    floorRate,
    prosperityRule: currentRate < floorRate,
    capitalPreservation: currentRate > ceilingRate,
  };
}

/* ═══════════════════════════════════════════════════════════════
   TAX-BRACKET ENGINEERING — Roth Conversion Ladder
   ═══════════════════════════════════════════════════════════════ */

export interface RothLadderYear {
  year: number;
  age: number;
  convertAmount: number;
  taxCost: number;
  cumulativeConverted: number;
  traditionalBalance: number;
  rothBalance: number;
  marginalRate: number;
  bracketHeadroom: number;
}

export interface RothLadderResult {
  years: RothLadderYear[];
  totalConverted: number;
  totalTaxPaid: number;
  projectedTaxSaved: number;
  breakEvenYear: number;
  rmdReduction: number;
}

/** Multi-year Roth conversion ladder optimizer */
export function calcRothLadder(
  age: number, retireAge: number, traditionalBalance: number,
  currentIncome: number, filing: string, stateRate: number,
  targetBracketFill: number // 0-1, how much of the bracket headroom to fill
): RothLadderResult {
  const brackets = filing === 'mfj' ? RATES.bracketsMFJ : RATES.bracketsSingle;
  const stdDeduction = getConfig('standardDeduction')[filing as keyof typeof CONFIGURABLE_DEFAULTS.standardDeduction] ?? getConfig('standardDeduction').single;
  const years: RothLadderYear[] = [];
  let tradBal = traditionalBalance;
  let rothBal = 0;
  let cumConverted = 0;
  
  for (let y = 0; y < Math.min(retireAge - age, 20); y++) {
    const currentAge = age + y;
    // Find the current marginal bracket
    const taxableIncome = Math.max(0, currentIncome - stdDeduction);
    let bracketTop = 0;
    let marginalRate = 0.10;
    for (const [limit, rate] of brackets) {
      if (taxableIncome < limit) {
        bracketTop = limit;
        marginalRate = rate;
        break;
      }
    }
    // Headroom = space left in current bracket
    const headroom = Math.max(0, bracketTop - taxableIncome);
    const convertAmount = Math.min(
      Math.round(headroom * targetBracketFill),
      tradBal
    );
    const taxCost = Math.round(convertAmount * (marginalRate + stateRate));
    
    cumConverted += convertAmount;
    tradBal = Math.round((tradBal - convertAmount) * 1.07); // Growth
    rothBal = Math.round((rothBal + convertAmount) * 1.07); // Growth
    
    years.push({
      year: y + 1,
      age: currentAge,
      convertAmount,
      taxCost,
      cumulativeConverted: cumConverted,
      traditionalBalance: tradBal,
      rothBalance: rothBal,
      marginalRate,
      bracketHeadroom: headroom,
    });
  }
  
  const totalTaxPaid = years.reduce((s, y) => s + y.taxCost, 0);
  // Projected tax saved = what you'd pay on RMDs at future (likely higher) rates
  const futureRate = 0.32; // Assume higher future rates
  const projectedTaxSaved = Math.round(cumConverted * futureRate) - totalTaxPaid;
  const rmdReduction = Math.round(cumConverted / 27.4); // Annual RMD reduction
  const breakEvenYear = projectedTaxSaved > 0 ? Math.max(1, Math.round(totalTaxPaid / Math.max(1, projectedTaxSaved / 20))) : 99;
  
  return { years, totalConverted: cumConverted, totalTaxPaid, projectedTaxSaved, breakEvenYear, rmdReduction };
}

/* ═══════════════════════════════════════════════════════════════
   CONFIGURABLE DATA LAYER — Pass 100 Continuous Improvement
   No hardcoded defaults; all via configurable data layer
   ═══════════════════════════════════════════════════════════════ */

export interface ConfigurableDefaults {
  // Tax
  federalBrackets: [number, number][];
  standardDeduction: Record<string, number>;
  max401k: number;
  maxHSA: Record<string, number>;
  maxIRA: number;
  catchUp401k: number;
  catchUpIRA: number;
  // Estate
  federalExemption: number;
  estateTaxRate: number;
  annualGiftExclusion: number;
  // Retirement
  ssColaRate: number;
  rmdDivisor: number;
  defaultWithdrawalRate: number;
  // Market
  equityReturn: number;
  bondReturn: number;
  inflationRate: number;
  // Practice
  defaultGDCRetained: number;
  defaultOverrideRate: number;
}

export const CONFIGURABLE_DEFAULTS: ConfigurableDefaults = {
  federalBrackets: RATES.bracketsMFJ,
  standardDeduction: { single: 15000, mfj: 30000, hoh: 22500 },
  max401k: 23500,
  maxHSA: { single: 4300, family: 8550 },
  maxIRA: 7000,
  catchUp401k: 7500,
  catchUpIRA: 1000,
  federalExemption: 13990000,
  estateTaxRate: 0.40,
  annualGiftExclusion: 19000,
  ssColaRate: 0.032,
  rmdDivisor: 27.4,
  defaultWithdrawalRate: 0.04,
  equityReturn: 0.07,
  bondReturn: 0.04,
  inflationRate: 0.03,
  defaultGDCRetained: 0.80,
  defaultOverrideRate: 0.26375,
};

/** Get a configurable default, allowing user overrides */
export function getConfig<K extends keyof ConfigurableDefaults>(
  key: K, userOverrides?: Partial<ConfigurableDefaults>
): ConfigurableDefaults[K] {
  if (userOverrides && key in userOverrides) return userOverrides[key] as ConfigurableDefaults[K];
  return CONFIGURABLE_DEFAULTS[key];
}


/* ═══ UNIFIED CLIENT WEALTH PLANNING ENGINE ═══
   Mirrors the Practice Management's calcUnifiedIncomePlan pattern:
   - Target-driven: set a retirement income goal, cascade to all domains
   - Back-solve: given a goal, what inputs are needed?
   - Sensitivity: what-if on key variables
   - Time-phased: multi-year forward projection
   ═══════════════════════════════════════════════ */

export interface ClientDomainAllocation {
  protection: number;  // % of total premium budget
  growth: number;      // % of savings allocated to growth
  retirement: number;  // % of savings allocated to retirement
  tax: number;         // % effort on tax optimization
  estate: number;      // % effort on estate planning
  education: number;   // % of savings allocated to education
}

export interface UnifiedClientPlan {
  // Targets
  retirementIncomeGoal: number;
  totalWealthTarget: number;
  // Domain roll-ups
  domains: {
    cashFlow: { surplus: number; saveRate: number; monthlyAvailable: number };
    protection: { gap: number; totalPremium: number; coverageRatio: number };
    growth: { projectedWealth: number; yearsToGoal: number; monthlyNeeded: number };
    retirement: { portfolioAtRetire: number; withdrawalIncome: number; ssIncome: number; totalRetireIncome: number; incomeGap: number };
    tax: { totalSavings: number; effectiveRate: number; optimizedRate: number };
    estate: { netToHeirs: number; estateTax: number; withPlanning: number };
    education: { totalGap: number; monthlyNeeded: number };
  };
  // Aggregate metrics
  totalProjectedWealth: number;
  totalAnnualCost: number;  // premiums + savings + contributions
  costAsPercentOfIncome: number;
  wealthGapToGoal: number;
  onTrackScore: number;  // 0-100
  // Back-solve results
  backSolve: {
    requiredSaveRate: number;
    requiredMonthly: number;
    requiredReturn: number;
    yearsToGoal: number;
  };
}

export function calcUnifiedClientPlan(
  income: number, age: number, retireAge: number,
  retirementIncomeGoal: number,
  cf: CFResult, pr: PRResult, gr: GRResult, rt: RTResult, tx: TXResult, es: ESResult, ed: EDResult,
  monthlySav: number, savings: number, retirement401k: number,
  allocation: ClientDomainAllocation,
): UnifiedClientPlan {
  const yrs = Math.max(1, retireAge - age);
  const totalWealth = gr.vehicles.reduce((max, v) => Math.max(max, v.value), 0);
  const totalWealthTarget = Math.round(retirementIncomeGoal / 0.04); // 4% rule
  const wealthGap = Math.max(0, totalWealthTarget - totalWealth);

  // Back-solve: what monthly savings needed to hit goal?
  const requiredReturn = 0.07;
  const rm = requiredReturn / 12;
  const n = yrs * 12;
  const existingFV = savings * Math.pow(1 + rm, n) + retirement401k * Math.pow(1 + rm, n);
  const remainingNeeded = Math.max(0, totalWealthTarget - existingFV);
  const requiredMonthly = rm > 0 && n > 0
    ? Math.round(remainingNeeded / ((Math.pow(1 + rm, n) - 1) / rm))
    : Math.round(remainingNeeded / Math.max(1, n));
  const requiredSaveRate = income > 0 ? (requiredMonthly * 12) / income : 0;

  // Years to goal at current savings rate
  let yearsToGoal = yrs;
  if (monthlySav > 0 && rm > 0) {
    const currentMonthly = monthlySav;
    let bal = savings + retirement401k;
    for (let y = 1; y <= 60; y++) {
      bal = bal * (1 + requiredReturn) + currentMonthly * 12;
      if (bal >= totalWealthTarget) { yearsToGoal = y; break; }
    }
  }

  // On-track score (0-100)
  const protectionScore = pr.gap === 0 ? 100 : Math.max(0, 100 - Math.round(pr.gap / (pr.dimeNeed || 1) * 100));
  const growthScore = totalWealthTarget > 0 ? Math.min(100, Math.round(totalWealth / totalWealthTarget * 100)) : 50;
  const cashFlowScore = cf.saveRate >= 0.20 ? 100 : cf.saveRate >= 0.10 ? 70 : cf.saveRate >= 0 ? 40 : 0;
  const retireScore = rt.incomeGap === 0 ? 100 : Math.max(0, 100 - Math.round(rt.incomeGap / Math.max(1, retirementIncomeGoal / 12) * 100));
  const taxScore = tx.totalSaving > 0 ? Math.min(100, 50 + Math.round(tx.totalSaving / Math.max(1, income) * 200)) : 30;
  const estateScore = es.estateTax === 0 ? 100 : Math.max(0, 100 - Math.round(es.estateTax / Math.max(1, es.grossEstate) * 100));
  const eduScore = ed.totalGap === 0 ? 100 : Math.max(0, 100 - Math.round(ed.totalGap / Math.max(1, ed.totalFutureCost) * 100));
  const onTrackScore = Math.round(
    (protectionScore * 0.20 + growthScore * 0.25 + cashFlowScore * 0.15 +
     retireScore * 0.20 + taxScore * 0.08 + estateScore * 0.07 + eduScore * 0.05)
  );

  const totalAnnualCost = pr.totalPremium + monthlySav * 12;

  return {
    retirementIncomeGoal,
    totalWealthTarget,
    domains: {
      cashFlow: { surplus: cf.surplus, saveRate: cf.saveRate, monthlyAvailable: Math.max(0, cf.surplus) },
      protection: { gap: pr.gap, totalPremium: pr.totalPremium, coverageRatio: pr.dimeNeed > 0 ? (pr.dimeNeed - pr.gap) / pr.dimeNeed : 1 },
      growth: { projectedWealth: totalWealth, yearsToGoal, monthlyNeeded: requiredMonthly },
      retirement: {
        portfolioAtRetire: rt.portfolioAtRetire, withdrawalIncome: rt.withdrawal,
        ssIncome: rt.ssComparison.find(s => s.age === rt.bestAge)?.annual || 0,
        totalRetireIncome: rt.monthlyIncome * 12, incomeGap: rt.incomeGap * 12,
      },
      tax: { totalSavings: tx.totalSaving, effectiveRate: tx.effectiveRate, optimizedRate: Math.max(0, tx.effectiveRate - tx.totalSaving / Math.max(1, income)) },
      estate: { netToHeirs: es.netToHeirs, estateTax: es.estateTax, withPlanning: es.withPlanning },
      education: { totalGap: ed.totalGap, monthlyNeeded: ed.additionalMonthlyNeeded },
    },
    totalProjectedWealth: totalWealth,
    totalAnnualCost,
    costAsPercentOfIncome: income > 0 ? totalAnnualCost / income : 0,
    wealthGapToGoal: wealthGap,
    onTrackScore,
    backSolve: { requiredSaveRate, requiredMonthly, requiredReturn, yearsToGoal },
  };
}

export interface ClientSensitivityResult {
  scenarios: {
    label: string;
    variable: string;
    baseValue: number;
    adjustedValue: number;
    impactOnWealth: number;
    impactOnRetireIncome: number;
    impactPct: number;
  }[];
}

export function calcClientSensitivity(
  income: number, age: number, retireAge: number,
  monthlySav: number, savings: number, retirement401k: number,
  baseReturn: number, inflationRate: number, taxRate: number,
): ClientSensitivityResult {
  const yrs = Math.max(1, retireAge - age);
  const baseWealth = fv(savings + retirement401k, monthlySav, baseReturn, yrs);

  const scenarios = [
    { label: 'Return +2%', variable: 'Investment Return', baseValue: baseReturn, adjustedValue: baseReturn + 0.02 },
    { label: 'Return -2%', variable: 'Investment Return', baseValue: baseReturn, adjustedValue: Math.max(0.01, baseReturn - 0.02) },
    { label: 'Savings +$500/mo', variable: 'Monthly Savings', baseValue: monthlySav, adjustedValue: monthlySav + 500 },
    { label: 'Savings -$500/mo', variable: 'Monthly Savings', baseValue: monthlySav, adjustedValue: Math.max(0, monthlySav - 500) },
    { label: 'Retire 3yr earlier', variable: 'Retirement Age', baseValue: retireAge, adjustedValue: Math.max(age + 5, retireAge - 3) },
    { label: 'Retire 3yr later', variable: 'Retirement Age', baseValue: retireAge, adjustedValue: Math.min(80, retireAge + 3) },
    { label: 'Inflation +1%', variable: 'Inflation Rate', baseValue: inflationRate, adjustedValue: inflationRate + 0.01 },
    { label: 'Tax rate -5%', variable: 'Effective Tax Rate', baseValue: taxRate, adjustedValue: Math.max(0, taxRate - 0.05) },
  ];

  return {
    scenarios: scenarios.map(s => {
      let adjustedWealth: number;
      if (s.variable === 'Investment Return') {
        adjustedWealth = fv(savings + retirement401k, monthlySav, s.adjustedValue, yrs);
      } else if (s.variable === 'Monthly Savings') {
        adjustedWealth = fv(savings + retirement401k, s.adjustedValue, baseReturn, yrs);
      } else if (s.variable === 'Retirement Age') {
        const adjYrs = Math.max(1, s.adjustedValue - age);
        adjustedWealth = fv(savings + retirement401k, monthlySav, baseReturn, adjYrs);
      } else if (s.variable === 'Inflation Rate') {
        // Higher inflation reduces real returns
        const realReturn = Math.max(0.005, baseReturn - s.adjustedValue + inflationRate);
        adjustedWealth = fv(savings + retirement401k, monthlySav, realReturn, yrs);
      } else if (s.variable === 'Effective Tax Rate') {
        // Lower tax = more savings available
        const extraMonthly = Math.round(income * (taxRate - s.adjustedValue) / 12);
        adjustedWealth = fv(savings + retirement401k, monthlySav + extraMonthly, baseReturn, yrs);
      } else {
        adjustedWealth = baseWealth;
      }
      const impact = adjustedWealth - baseWealth;
      return {
        label: s.label,
        variable: s.variable,
        baseValue: s.baseValue,
        adjustedValue: s.adjustedValue,
        impactOnWealth: Math.round(impact),
        impactOnRetireIncome: Math.round(impact * 0.04), // 4% rule
        impactPct: baseWealth > 0 ? impact / baseWealth : 0,
      };
    }),
  };
}

export interface ClientTimeProjection {
  year: number;
  age: number;
  savings: number;
  retirement: number;
  protection: number;
  totalWealth: number;
  annualIncome: number;
  cumulativeCost: number;
}

export function calcClientTimePhasedProjections(
  age: number, retireAge: number, income: number,
  monthlySav: number, savings: number, retirement401k: number,
  baseReturn: number, inflationRate: number,
  prTotalPremium: number,
): ClientTimeProjection[] {
  const projections: ClientTimeProjection[] = [];
  let savBal = savings;
  let retBal = retirement401k;
  let cumCost = 0;

  for (let y = 0; y <= Math.min(40, retireAge - age + 10); y++) {
    const currentAge = age + y;
    const isRetired = currentAge >= retireAge;
    const annualSav = isRetired ? 0 : monthlySav * 12;
    const withdrawal = isRetired ? Math.round((savBal + retBal) * 0.04) : 0;

    if (y > 0) {
      savBal = Math.round(savBal * (1 + baseReturn) + (isRetired ? -withdrawal * 0.4 : annualSav * 0.4));
      retBal = Math.round(retBal * (1 + baseReturn) + (isRetired ? -withdrawal * 0.6 : annualSav * 0.6));
    }

    cumCost += prTotalPremium + annualSav;
    const realIncome = isRetired ? withdrawal : income;

    projections.push({
      year: y,
      age: currentAge,
      savings: Math.max(0, savBal),
      retirement: Math.max(0, retBal),
      protection: Math.round(prTotalPremium * Math.max(0, Math.min(retireAge - age, 30) - y)),
      totalWealth: Math.max(0, savBal + retBal),
      annualIncome: realIncome,
      cumulativeCost: cumCost,
    });
  }

  return projections;
}


/* ═══ UNIFIED ADVANCED STRATEGIES PLANNING ENGINE ═══
   Mirrors ClientWealthHub pattern but for advanced strategies:
   - Target-driven: set a total strategy benefit goal, cascade to all strategies
   - Strategy allocation sliders: Premium Finance, ILIT, ExecComp, Charitable, Business
   - Cross-strategy cascade: ILIT estate savings → reduces estate burden → improves net to heirs
   - Back-solve: given a tax savings target, what strategy mix achieves it
   - Sensitivity: what-if on interest rates, tax rates, business value
   - Time-phased: strategy benefit over time
   ═══════════════════════════════════════════════════════════════ */

export interface StrategyAllocation {
  premiumFinance: number;  // % of total strategy effort
  ilit: number;
  execComp: number;
  charitable: number;
  business: number;
}

export interface UnifiedAdvancedPlan {
  // Targets
  totalBenefitGoal: number;
  // Strategy roll-ups
  strategies: {
    premiumFinance: {
      netBenefit: number;
      leverage: string;
      totalOutlay: number;
      cashValue: number;
      loanBalance: number;
      taxEfficiency: number;
    };
    ilit: {
      estateTaxSaved: number;
      netToHeirs: number;
      withoutILIT: number;
      annualGiftUsed: number;
      leverageRatio: number;
    };
    execComp: {
      totalComp: number;
      employerTaxBenefit: number;
      retentionValue: number;
      goldenHandcuffs: number;
    };
    charitable: {
      taxDeduction: number;
      annualIncome: number;
      totalCharitable: number;
      netBenefit20yr: number;
      effectiveGivingRate: number;
    };
    business: {
      keyPersonCoverage: number;
      buySellFunding: number;
      groupBenefitsCost: number;
      totalProtection: number;
      continuityScore: number;
    };
  };
  // Aggregate metrics
  totalProjectedBenefit: number;
  totalAnnualCost: number;
  benefitToClientPlanCascade: {
    estateTaxReduction: number;
    taxSavingsBoost: number;
    protectionEnhancement: number;
    retirementBoost: number;
    netWorthImpact: number;
  };
  onTrackScore: number;  // 0-100
  goalMet: boolean;
  // Back-solve
  backSolve: {
    requiredPFAllocation: number;
    requiredILITAllocation: number;
    requiredExecAllocation: number;
    requiredCharitableAllocation: number;
    requiredBusinessAllocation: number;
    gapToGoal: number;
    achievable: boolean;
  };
}

export function calcUnifiedAdvancedPlan(
  advResult: AdvResult,
  bizResult: BizClientResult,
  totalBenefitGoal: number,
  allocation: StrategyAllocation,
  income: number,
  age: number,
  grossEstate: number,
): UnifiedAdvancedPlan {
  // Strategy roll-ups from existing calcAdvanced and calcBizClient results
  const pfBenefit = advResult.pf.netBenefit;
  const pfTaxEff = pfBenefit > 0 ? pfBenefit * 0.15 : 0;
  const ilitSaved = advResult.ilit.estateTaxSaved;
  const execTaxBen = advResult.exec.taxBenefit;
  const charDeduction = advResult.cv.taxDeduction;
  const charIncome = advResult.cv.annualIncome;
  const charNetBenefit = advResult.cv.netBenefit;
  const bizTotalCost = bizResult.totalAnnualCost;

  const strategies: UnifiedAdvancedPlan['strategies'] = {
    premiumFinance: {
      netBenefit: pfBenefit,
      leverage: advResult.pf.leverage,
      totalOutlay: advResult.pf.totalCashOutlay,
      cashValue: advResult.pf.totalCashValue,
      loanBalance: advResult.pf.yearByYear.length > 0
        ? advResult.pf.yearByYear[advResult.pf.yearByYear.length - 1].loanBal
        : 0,
      taxEfficiency: Math.round(pfTaxEff),
    },
    ilit: {
      estateTaxSaved: ilitSaved,
      netToHeirs: advResult.ilit.netToHeirs,
      withoutILIT: advResult.ilit.withoutILIT,
      annualGiftUsed: advResult.ilit.annualGiftExclusion,
      leverageRatio: advResult.ilit.premium > 0
        ? Math.round(advResult.ilit.netToHeirs / (advResult.ilit.premium * 20))
        : 0,
    },
    execComp: {
      totalComp: advResult.exec.totalComp,
      employerTaxBenefit: execTaxBen,
      retentionValue: advResult.exec.retentionValue,
      goldenHandcuffs: Math.round(advResult.exec.retentionValue * 0.6),
    },
    charitable: {
      taxDeduction: charDeduction,
      annualIncome: charIncome,
      totalCharitable: advResult.cv.totalCharitable,
      netBenefit20yr: charNetBenefit,
      effectiveGivingRate: income > 0
        ? advResult.cv.totalCharitable / income
        : 0,
    },
    business: {
      keyPersonCoverage: bizResult.keyPersonNeed,
      buySellFunding: bizResult.buySellNeed,
      groupBenefitsCost: bizResult.groupBenefitsCost,
      totalProtection: bizResult.keyPersonNeed + bizResult.buySellNeed,
      continuityScore: Math.min(100, Math.round(
        (bizResult.keyPersonNeed > 0 ? 30 : 0) +
        (bizResult.buySellNeed > 0 ? 40 : 0) +
        (bizResult.groupBenefitsCost > 0 ? 30 : 0)
      )),
    },
  };

  // Total projected benefit (annual)
  const totalProjectedBenefit = Math.round(
    pfTaxEff +
    ilitSaved * 0.04 + // annualized estate tax savings
    execTaxBen +
    charDeduction +
    charIncome
  );

  const totalAnnualCost = Math.round(
    advResult.pf.totalCashOutlay / Math.max(1, advResult.pf.years) +
    advResult.ilit.premium +
    bizTotalCost
  );

  // Cascade to client planning domains
  const benefitToClientPlanCascade = {
    estateTaxReduction: ilitSaved,
    taxSavingsBoost: Math.round(pfTaxEff + execTaxBen + charDeduction),
    protectionEnhancement: bizResult.keyPersonNeed + bizResult.buySellNeed,
    retirementBoost: Math.round(charIncome * 20), // 20yr CRT income
    netWorthImpact: Math.round(pfBenefit + ilitSaved + charNetBenefit),
  };

  // On-track score
  const pfScore = pfBenefit > 0 ? Math.min(100, 50 + Math.round(pfBenefit / 50000)) : 0;
  const ilitScore = ilitSaved > 0 ? Math.min(100, 50 + Math.round(ilitSaved / 100000)) : 0;
  const execScore = execTaxBen > 0 ? Math.min(100, 50 + Math.round(execTaxBen / 20000)) : 0;
  const charScore = charDeduction > 0 ? Math.min(100, 50 + Math.round(charDeduction / 30000)) : 0;
  const bizScore = strategies.business.continuityScore;

  const onTrackScore = Math.round(
    pfScore * (allocation.premiumFinance / 100) +
    ilitScore * (allocation.ilit / 100) +
    execScore * (allocation.execComp / 100) +
    charScore * (allocation.charitable / 100) +
    bizScore * (allocation.business / 100)
  );

  const goalMet = totalBenefitGoal > 0 ? totalProjectedBenefit >= totalBenefitGoal : true;

  // Back-solve: what allocation would meet the goal?
  const gapToGoal = Math.max(0, totalBenefitGoal - totalProjectedBenefit);
  const totalPossible = pfTaxEff + ilitSaved * 0.04 + execTaxBen + charDeduction + charIncome;
  const scaleFactor = totalPossible > 0 && gapToGoal > 0
    ? Math.min(3, totalBenefitGoal / totalPossible)
    : 1;

  return {
    totalBenefitGoal,
    strategies,
    totalProjectedBenefit,
    totalAnnualCost,
    benefitToClientPlanCascade,
    onTrackScore,
    goalMet,
    backSolve: {
      requiredPFAllocation: Math.round(allocation.premiumFinance * scaleFactor),
      requiredILITAllocation: Math.round(allocation.ilit * scaleFactor),
      requiredExecAllocation: Math.round(allocation.execComp * scaleFactor),
      requiredCharitableAllocation: Math.round(allocation.charitable * scaleFactor),
      requiredBusinessAllocation: Math.round(allocation.business * scaleFactor),
      gapToGoal,
      achievable: scaleFactor <= 2,
    },
  };
}

export interface AdvancedSensitivityResult {
  scenarios: {
    label: string;
    variable: string;
    baseValue: number;
    adjustedValue: number;
    impactOnBenefit: number;
    impactOnCost: number;
    impactPct: number;
  }[];
}

export function calcAdvancedSensitivity(
  advResult: AdvResult,
  bizResult: BizClientResult,
  pfLoanRate: number,
  pfCredRate: number,
  estateTaxRate: number,
  bizValue: number,
  income: number,
): AdvancedSensitivityResult {
  const baseBenefit = advResult.totalTaxSavings;
  const baseCost = advResult.pf.totalCashOutlay / Math.max(1, advResult.pf.years) +
    advResult.ilit.premium + bizResult.totalAnnualCost;

  const scenarios = [
    {
      label: 'Loan Rate +1%',
      variable: 'PF Loan Rate',
      baseValue: pfLoanRate,
      adjustedValue: pfLoanRate + 1,
      impactOnBenefit: Math.round(-advResult.pf.totalCashOutlay * 0.01 * 0.15),
      impactOnCost: Math.round(advResult.pf.totalCashOutlay * 0.01),
    },
    {
      label: 'Loan Rate -1%',
      variable: 'PF Loan Rate',
      baseValue: pfLoanRate,
      adjustedValue: Math.max(1, pfLoanRate - 1),
      impactOnBenefit: Math.round(advResult.pf.totalCashOutlay * 0.01 * 0.15),
      impactOnCost: Math.round(-advResult.pf.totalCashOutlay * 0.01),
    },
    {
      label: 'Crediting Rate +1%',
      variable: 'PF Crediting Rate',
      baseValue: pfCredRate,
      adjustedValue: pfCredRate + 1,
      impactOnBenefit: Math.round(advResult.pf.totalCashValue * 0.01 * 0.15),
      impactOnCost: 0,
    },
    {
      label: 'Estate Tax Rate +5%',
      variable: 'Estate Tax Rate',
      baseValue: estateTaxRate,
      adjustedValue: Math.min(55, estateTaxRate + 5),
      impactOnBenefit: Math.round(advResult.ilit.deathBenefit * 0.05 * 0.04),
      impactOnCost: 0,
    },
    {
      label: 'Estate Tax Rate -5%',
      variable: 'Estate Tax Rate',
      baseValue: estateTaxRate,
      adjustedValue: Math.max(0, estateTaxRate - 5),
      impactOnBenefit: Math.round(-advResult.ilit.deathBenefit * 0.05 * 0.04),
      impactOnCost: 0,
    },
    {
      label: 'Business Value +20%',
      variable: 'Business Value',
      baseValue: bizValue,
      adjustedValue: Math.round(bizValue * 1.2),
      impactOnBenefit: Math.round(bizResult.keyPersonNeed * 0.2 * 0.01),
      impactOnCost: Math.round(bizResult.totalAnnualCost * 0.15),
    },
    {
      label: 'Income +$50K',
      variable: 'Income',
      baseValue: income,
      adjustedValue: income + 50000,
      impactOnBenefit: Math.round(50000 * 0.37 * 0.3), // higher bracket → more tax savings
      impactOnCost: Math.round(50000 * 0.05), // slightly higher premiums
    },
    {
      label: 'Income -$50K',
      variable: 'Income',
      baseValue: income,
      adjustedValue: Math.max(50000, income - 50000),
      impactOnBenefit: Math.round(-50000 * 0.37 * 0.3),
      impactOnCost: Math.round(-50000 * 0.05),
    },
  ];

  return {
    scenarios: scenarios.map(s => ({
      ...s,
      impactPct: baseBenefit > 0 ? s.impactOnBenefit / baseBenefit : 0,
    })),
  };
}

export interface AdvancedTimeProjection {
  year: number;
  pfCashValue: number;
  pfLoanBalance: number;
  pfNetBenefit: number;
  ilitEstateSavings: number;
  execRetentionValue: number;
  charitableIncome: number;
  totalBenefit: number;
  cumulativeCost: number;
}

export function calcAdvancedTimePhasedProjections(
  advResult: AdvResult,
  bizResult: BizClientResult,
  years: number,
): AdvancedTimeProjection[] {
  const projections: AdvancedTimeProjection[] = [];
  const pfYBY = advResult.pf.yearByYear;
  let cumCost = 0;
  const annualBizCost = bizResult.totalAnnualCost;
  const annualILITPrem = advResult.ilit.premium;
  const annualCharIncome = advResult.cv.annualIncome;
  const annualExecRetention = advResult.exec.retentionValue / 5; // 5yr vesting

  for (let yr = 1; yr <= Math.min(years, 30); yr++) {
    const pfData = yr <= pfYBY.length ? pfYBY[yr - 1] : pfYBY[pfYBY.length - 1] || { cashValue: 0, loanBal: 0, net: 0, cashOutlay: 0 };
    cumCost += (advResult.pf.cashOutlay || 0) + annualILITPrem + annualBizCost;

    const ilitCumSavings = Math.round(advResult.ilit.estateTaxSaved * (yr / 20)); // amortized
    const execCumRetention = Math.round(annualExecRetention * Math.min(yr, 5));
    const charCumIncome = annualCharIncome * yr;

    projections.push({
      year: yr,
      pfCashValue: pfData.cashValue,
      pfLoanBalance: pfData.loanBal,
      pfNetBenefit: pfData.net || pfData.cashValue - pfData.loanBal,
      ilitEstateSavings: ilitCumSavings,
      execRetentionValue: execCumRetention,
      charitableIncome: charCumIncome,
      totalBenefit: Math.round(
        (pfData.net || pfData.cashValue - pfData.loanBal) +
        ilitCumSavings + execCumRetention + charCumIncome
      ),
      cumulativeCost: Math.round(cumCost),
    });
  }

  return projections;
}
