import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import {
  User, DollarSign, Shield, TrendingUp, Clock, Building2, GraduationCap,
  Scale, BarChart3, GitCompare, FileText, ListChecks, BookOpen, ChevronRight,
  Calculator, Briefcase, Target, AlertTriangle, CheckCircle2, XCircle,
  Info, ArrowRight, Minus, Plus, Zap
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   RATES — Age-based premium rate tables from industry data (2025-2026)
   Sources: Ramsey Solutions, Guardian Life, LocalLifeAgents, LIMRA, NerdWallet
   ═══════════════════════════════════════════════════════════════ */
const RATES = {
  termPer100K: [{age:20,rate:31},{age:25,rate:33},{age:30,rate:35},{age:35,rate:42},{age:40,rate:56},{age:45,rate:78},{age:50,rate:135},{age:55,rate:195},{age:60,rate:377},{age:65,rate:620},{age:70,rate:1557}],
  iulPer100K: [{age:20,rate:480},{age:25,rate:540},{age:30,rate:660},{age:35,rate:840},{age:40,rate:1080},{age:45,rate:1380},{age:50,rate:1800},{age:55,rate:2400},{age:60,rate:3240},{age:65,rate:4500}],
  wlPer100K: [{age:20,rate:603},{age:25,rate:720},{age:30,rate:862},{age:35,rate:1020},{age:40,rate:1277},{age:45,rate:1620},{age:50,rate:2014},{age:55,rate:2580},{age:60,rate:3360},{age:65,rate:4500}],
  diPctBenefit: [{age:25,rate:.020},{age:30,rate:.022},{age:35,rate:.025},{age:40,rate:.030},{age:45,rate:.038},{age:50,rate:.048},{age:55,rate:.060},{age:60,rate:.080}],
  ltcAnnual: [{age:40,rate:2400},{age:45,rate:3200},{age:50,rate:4200},{age:55,rate:5600},{age:60,rate:7800},{age:65,rate:10800},{age:70,rate:15600}],
  aumFee: (aum: number) => { if(aum>=5e6) return .006; if(aum>=1e6) return .0085; if(aum>=5e5) return .01; return .0125; },
  fiaRiderFee: .01,
  groupPerEmp: 7911,
  // Federal tax brackets 2024 (MFJ)
  bracketsMFJ: [[23200,.10],[94300,.12],[201050,.22],[383900,.24],[487450,.32],[731200,.35],[1e9,.37]] as [number,number][],
  bracketsSingle: [[11600,.10],[47150,.12],[100525,.22],[191950,.24],[243725,.32],[609350,.35],[1e9,.37]] as [number,number][],
};

/* ═══ HELPER FUNCTIONS (faithful port from v7 HTML) ═══ */
function fmt(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return '—';
  if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  return '$' + Math.round(n).toLocaleString();
}
function fmtSm(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return '—';
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e9) return s + '$' + (a / 1e9).toFixed(1) + 'B';
  if (a >= 1e6) { const m = a / 1e6; return s + '$' + (m >= 10 ? Math.round(m) : m.toFixed(1)) + 'M'; }
  if (a >= 10000) { const k = Math.round(a / 1e3); return s + '$' + k + 'K'; }
  if (a >= 1000) { const k = a / 1e3; return s + '$' + (k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)) + 'K'; }
  return s + '$' + Math.round(a);
}
function pct(n: number): string { if (!isFinite(n)) return '—'; return (n * 100).toFixed(1) + '%'; }
function fv(p: number, m: number, r: number, y: number): number {
  const rm = r / 12;
  if (rm === 0) return p + m * y * 12;
  return p * Math.pow(1 + rm, y * 12) + m * (Math.pow(1 + rm, y * 12) - 1) / rm;
}
function interpRate(table: {age:number,rate:number}[], age: number): number {
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
function estPrem(type: string, age: number, amount: number): number {
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
function sc(val: number): { label: string; color: string; icon: string } {
  if (val >= 3) return { label: 'Strong', color: 'text-green-600', icon: '✓' };
  if (val >= 2) return { label: 'Moderate', color: 'text-yellow-600', icon: '⚠' };
  return { label: 'Needs Attention', color: 'text-red-600', icon: '✗' };
}
function getBracketRate(income: number, brackets: [number, number][]): number {
  let tax = 0, prev = 0;
  for (const [limit, rate] of brackets) {
    if (income <= limit) { tax += (income - prev) * rate; break; }
    tax += (limit - prev) * rate; prev = limit;
  }
  return income > 0 ? tax / income : 0;
}

/* ═══ PRODUCT MODEL FUNCTIONS (faithful port from v7 HTML) ═══ */
interface ProductResult {
  cashValue: number; deathBenefit: number; taxSaving: number;
  livingBenefit: number; legacyValue: number; annualCost: number;
  label: string; carrier: string; expectedValue?: number;
  incomeValue?: number;
}
function modelTerm(age: number, face: number, termLen = 20): ProductResult {
  const annPrem = estPrem('term', age, face);
  return { cashValue: 0, deathBenefit: face, taxSaving: 0, livingBenefit: 0,
    legacyValue: face, annualCost: annPrem, label: `Term ${termLen}yr`, carrier: 'NLG' };
}
function modelIUL(age: number, face: number, annPrem?: number): ProductResult {
  const prem = annPrem || estPrem('iul', age, face);
  const cashValue = Math.round(prem * 10 * 0.6); // ~yr10 approx
  return { cashValue, deathBenefit: face, taxSaving: Math.round(cashValue * 0.25),
    livingBenefit: Math.round(face * 0.5), legacyValue: face, annualCost: prem,
    label: 'IUL', carrier: 'NLG FlexLife' };
}
function modelWL(age: number, face: number, annPrem?: number): ProductResult {
  const prem = annPrem || estPrem('wl', age, face);
  const cashValue = Math.round(prem * 10 * 0.45);
  return { cashValue, deathBenefit: face, taxSaving: Math.round(cashValue * 0.25),
    livingBenefit: 0, legacyValue: face, annualCost: prem,
    label: 'Whole Life', carrier: 'NLG/MassMutual' };
}
function modelDI(age: number, annBenefit: number): ProductResult {
  const prem = estPrem('di', age, annBenefit);
  return { cashValue: 0, deathBenefit: 0, taxSaving: 0,
    livingBenefit: annBenefit, legacyValue: 0, annualCost: prem,
    expectedValue: Math.round(annBenefit * 0.012 * 2.88),
    label: 'Disability Insurance', carrier: 'Guardian' };
}
function modelLTC(age: number, benefitPool = 150000): ProductResult {
  const prem = estPrem('ltc', age, benefitPool);
  return { cashValue: 0, deathBenefit: Math.round(prem * 10 * 0.8), taxSaving: Math.round(prem * 0.15),
    livingBenefit: benefitPool, legacyValue: Math.round(prem * 10 * 0.8), annualCost: prem,
    label: 'Hybrid LTC', carrier: 'Lincoln MoneyGuard' };
}
function modelFIA(deposit: number, annContrib = 0): ProductResult {
  const value = Math.round((deposit + annContrib * 10) * Math.pow(1.055, 10));
  const income = Math.round(value * 0.055);
  return { cashValue: value, deathBenefit: Math.round(value * 1.1), taxSaving: Math.round(value * 0.15),
    livingBenefit: 0, legacyValue: Math.round(value * 1.1), annualCost: Math.round(deposit * RATES.fiaRiderFee),
    incomeValue: income, label: 'FIA', carrier: 'NLG/Athene' };
}

/* ═══ SCORING ENGINE — 7 domains + 3 pillars (faithful port from v7 cA/calcCProf) ═══ */
interface DomainScore { name: string; score: number; maxScore: number; }
interface Pillar { name: string; domains: string[]; score: number; maxScore: number; }
interface Recommendation { product: string; coverage: string; premium: number; monthly: number; carrier: string; priority: string; }

function computeScorecard(s: Record<string, number>): {
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

function buildRecommendations(age: number, income: number, dep: number, nw: number,
  existIns: number, mortgage: number, debt: number, isBiz: boolean, scores: Record<string, number>): Recommendation[] {
  const recs: Recommendation[] = [];
  // DIME life insurance need
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
  // DI
  if (income > 30000) {
    const diBen = Math.round(income * 0.6);
    const p = estPrem('di', age, diBen);
    recs.push({ product: 'Guardian DI', coverage: fmt(diBen) + '/yr', premium: p, monthly: Math.round(p / 12), carrier: 'Guardian', priority: scores.protect < 2 ? 'High' : 'Medium' });
  }
  // LTC
  if (age >= 35) {
    const p = estPrem('ltc', age, 150000);
    recs.push({ product: 'Lincoln MoneyGuard LTC', coverage: '$150K pool', premium: p, monthly: Math.round(p / 12), carrier: 'Lincoln Financial', priority: age >= 50 ? 'High' : 'Low' });
  }
  // FIA for retirement income
  if (scores.retire < 3 && nw > 50000) {
    const deposit = Math.round(Math.min(nw * 0.2, 200000));
    const p = Math.round(deposit * RATES.fiaRiderFee);
    recs.push({ product: 'NLG FIA + Income Rider', coverage: fmtSm(deposit) + ' deposit', premium: p, monthly: Math.round(p / 12), carrier: 'NLG/Athene', priority: 'Medium' });
  }
  // Business insurance
  if (isBiz) {
    const keyPrem = estPrem('term', age, income * 3);
    recs.push({ product: 'Key Person (Term)', coverage: fmtSm(income * 3), premium: keyPrem, monthly: Math.round(keyPrem / 12), carrier: 'NLG', priority: 'High' });
  }
  return recs;
}

/* ═══ CALCULATION ENGINES — faithful port from v7 calc functions ═══ */

// Cash Flow (calcCF)
interface CFResult {
  gross: number; taxRate: number; net: number; expenses: {label:string;amount:number}[];
  totalExp: number; surplus: number; saveRate: number; dti: number;
  emTarget: number; emGap: number; goalTarget?: number;
}
function calcCashFlow(gross: number, taxRate: number, housing: number, transport: number,
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

// Protection (calcPR) — DIME method
interface PRResult {
  dimeNeed: number; components: {label:string;amount:number}[];
  existingCoverage: number; gap: number; products: {need:string;coverage:number;product:string;premium:number;monthly:number;carrier:string}[];
  totalPremium: number; diNeed: number; diPrem: number; ltcPool: number; ltcPrem: number;
}
function calcProtection(income: number, dep: number, mortgage: number, debt: number,
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
  // Split: 60% term, 40% IUL
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

// Growth (calcGR) — multi-vehicle comparison
interface GRResult {
  yrs: number; vehicles: {name:string;value:number;taxFree:boolean;note:string}[];
  taxEdge: number;
}
function calcGrowth(age: number, retireAge: number, monthlySav: number, existing: number,
  infRate: number, taxReturn: number, iul_return: number, fia_return: number): GRResult {
  const yrs = Math.max(1, retireAge - age);
  const taxable = Math.round(fv(existing, monthlySav, taxReturn * 0.75, yrs)); // after-tax
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

// Retirement (calcRT) — SS claiming comparison + portfolio withdrawal
interface RTResult {
  ssComparison: {age:number;monthly:number;annual:number;cumAt80:number;cumAt85:number;cumAt90:number}[];
  bestAge: number; portfolioAtRetire: number; withdrawal: number; monthlyIncome: number;
  incomeGap: number; rmd72: number;
}
function calcRetirement(age: number, retireAge: number, ss62: number, ss67: number, ss70: number,
  pension: number, withdrawalRate: number, savings: number, monthlySav: number): RTResult {
  const yrs = Math.max(1, retireAge - age);
  const portfolio = Math.round(fv(savings, monthlySav, 0.07, yrs));
  const withdrawal = Math.round(portfolio * withdrawalRate);
  const ssOptions = [
    {age:62,monthly:ss62},{age:67,monthly:ss67},{age:70,monthly:ss70}
  ];
  const ssComparison = ssOptions.map(o => {
    const annual = o.monthly * 12;
    const cumAt = (targetAge: number) => {
      if (o.age > targetAge) return 0;
      return annual * (targetAge - o.age);
    };
    return { age: o.age, monthly: o.monthly, annual, cumAt80: cumAt(80), cumAt85: cumAt(85), cumAt90: cumAt(90) };
  });
  const bestAge = ssComparison.reduce((a,b) => b.cumAt85 > a.cumAt85 ? b : a).age;
  const bestSS = ssComparison.find(s => s.age === bestAge)!;
  const monthlyIncome = Math.round(withdrawal / 12 + bestSS.monthly + pension);
  const incomeGap = Math.max(0, Math.round(savings * 0.04 / 12) - monthlyIncome); // rough
  const rmd72 = Math.round(portfolio / 27.4); // IRS Uniform Table divisor at 72
  return { ssComparison, bestAge, portfolioAtRetire: portfolio, withdrawal, monthlyIncome, incomeGap, rmd72 };
}

// Tax Planning (calcTX)
interface TXResult {
  strategies: {name:string;saving:number;note:string}[];
  totalSaving: number; effectiveRate: number; marginalRate: number;
  rothConversion: {amount:number;taxNow:number;taxFreeFuture:number;netBenefit:number};
}
function calcTax(income: number, stateRate: number, isSelfEmployed: boolean,
  filing: string, retirement401k: number, hsaContrib: number, charitableGiving: number): TXResult {
  const brackets = filing === 'mfj' ? RATES.bracketsMFJ : RATES.bracketsSingle;
  const fedTax = income > 0 ? (() => { let t=0,p=0; for(const[l,r]of brackets){if(income<=l){t+=(income-p)*r;break;}t+=(l-p)*r;p=l;} return t; })() : 0;
  const marginalRate = brackets.find(([l]) => income <= l)?.[1] ?? 0.37;
  const effectiveRate = income > 0 ? (fedTax + income * stateRate) / income : 0;
  const strategies: TXResult['strategies'] = [];
  // 401k/IRA
  const max401k = 23500;
  const gap401k = Math.max(0, max401k - retirement401k);
  if (gap401k > 0) strategies.push({name:'Max 401(k)', saving: Math.round(gap401k * marginalRate), note: `Contribute additional ${fmt(gap401k)}/yr`});
  // HSA
  const maxHSA = filing === 'mfj' ? 8300 : 4150;
  const gapHSA = Math.max(0, maxHSA - hsaContrib);
  if (gapHSA > 0) strategies.push({name:'Max HSA', saving: Math.round(gapHSA * (marginalRate + 0.0765)), note: 'Triple tax advantage'});
  // Roth conversion
  const rothAmount = Math.min(50000, income * 0.1);
  const rothTaxNow = Math.round(rothAmount * marginalRate);
  const rothFuture = Math.round(rothAmount * Math.pow(1.07, 20));
  const rothTaxFree = Math.round(rothFuture * marginalRate);
  strategies.push({name:'Roth Conversion', saving: Math.round(rothTaxFree - rothTaxNow), note: `Convert ${fmt(rothAmount)} now, save ${fmt(rothTaxFree - rothTaxNow)} in taxes over 20yr`});
  // Charitable
  if (charitableGiving > 0) strategies.push({name:'Charitable Deduction', saving: Math.round(charitableGiving * marginalRate), note: `${fmt(charitableGiving)} giving × ${pct(marginalRate)} rate`});
  // Self-employment
  if (isSelfEmployed) strategies.push({name:'QBI Deduction (§199A)', saving: Math.round(Math.min(income * 0.2, 182100) * marginalRate), note: '20% of qualified business income'});
  // Deductions only
  const stdDeduction = filing === 'mfj' ? 29200 : 14600;
  strategies.push({name:'Standard Deduction', saving: Math.round(stdDeduction * marginalRate), note: `${fmt(stdDeduction)} (${filing === 'mfj' ? 'MFJ' : 'Single'})`});
  const totalSaving = strategies.reduce((a,s) => a + s.saving, 0);
  return { strategies, totalSaving, effectiveRate, marginalRate,
    rothConversion: { amount: rothAmount, taxNow: rothTaxNow, taxFreeFuture: rothFuture, netBenefit: rothTaxFree - rothTaxNow }};
}

// Estate (calcES)
interface ESResult {
  grossEstate: number; exemption: number; taxable: number; estateTax: number;
  ilitSaving: number; netToHeirs: number; withPlanning: number;
  documents: {name:string;status:string;priority:string}[];
}
function calcEstate(grossEstate: number, exemption: number, growthRate: number,
  giftingAnnual: number, willStatus: string): ESResult {
  const taxable = Math.max(0, grossEstate - exemption);
  const estateTax = Math.round(taxable * 0.40);
  const ilitFace = Math.round(estateTax * 1.2);
  const ilitPrem = estPrem('iul', 50, ilitFace); // approximate
  const ilitSaving = estateTax; // ILIT pays estate tax
  const netToHeirs = grossEstate - estateTax;
  const withPlanning = grossEstate - Math.round(estateTax * 0.1); // ILIT + gifting reduces tax ~90%
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

// Education (calcED)
interface EDResult {
  children: number; avgAge: number; yrsToCollege: number;
  futureCostPerChild: number; totalFutureCost: number;
  projectedPer529: number; totalProjected: number;
  gapPerChild: number; totalGap: number;
  additionalMonthlyNeeded: number;
}
function calcEducation(children: number, avgAge: number, targetCost: number,
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

/* ═══ COST-BENEFIT ANALYSIS ENGINE (faithful port from v7 buildCostBenDash) ═══ */
interface HorizonData { yr: number; cost: number; benefit: number; net: number; roi: string; }
function buildHorizonData(recs: Recommendation[], age: number, income: number, horizons: number[]): HorizonData[] {
  return horizons.map(yr => {
    let totalCost = 0, totalBenefit = 0;
    recs.forEach(r => {
      const annCost = r.premium;
      // Simplified product-at-year calculation
      const isIUL = r.product.includes('IUL');
      const isTerm = r.product.includes('Term');
      const isDI = r.product.includes('DI') || r.product.includes('Disability');
      const isLTC = r.product.includes('LTC') || r.product.includes('MoneyGuard');
      const isFIA = r.product.includes('FIA');
      const termLen = isTerm ? 20 : 99;
      const payYrs = isIUL ? Math.min(yr, 20) : isTerm ? Math.min(yr, termLen) : isDI ? Math.min(yr, Math.max(0, 65 - age)) : yr;
      totalCost += annCost * payYrs;
      // Benefits
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

/* ═══ STRATEGY COMPARISON DATA (faithful port from v7 calcCompare) ═══ */
const STRATEGIES = [
  { name: 'Conservative', color: '#3B82F6', annualCost: '$3K-8K',
    bestFor: 'Risk-averse, near retirement',
    description: 'Focus on guaranteed products: whole life, FIA with income rider, term for gap coverage. Minimal market exposure.',
    products: ['Whole Life', 'FIA + Income Rider', 'Term 20yr', 'DI'],
    scores: { Protection: 5, Growth: 2, 'Tax Efficiency': 3, Liquidity: 2, Legacy: 4, Complexity: 1 } },
  { name: 'Balanced', color: '#10B981', annualCost: '$5K-15K',
    bestFor: 'Most families, mid-career',
    description: 'Blend of term + IUL for protection and growth, 401(k)/Roth for retirement, DI + LTC for income protection.',
    products: ['Term 20yr', 'IUL', 'DI', 'LTC Hybrid', '401(k)', 'Roth IRA'],
    scores: { Protection: 4, Growth: 4, 'Tax Efficiency': 4, Liquidity: 3, Legacy: 4, Complexity: 3 } },
  { name: 'Growth', color: '#F59E0B', annualCost: '$8K-25K',
    bestFor: 'High earners, long horizon',
    description: 'Maximize IUL cash value + Roth conversions + FIA for tax-free retirement income. Aggressive accumulation.',
    products: ['IUL (max-funded)', 'Roth IRA', 'FIA', 'Term (gap)', 'DI'],
    scores: { Protection: 3, Growth: 5, 'Tax Efficiency': 5, Liquidity: 4, Legacy: 3, Complexity: 4 } },
  { name: 'Legacy', color: '#8B5CF6', annualCost: '$15K-50K+',
    bestFor: 'HNW, estate planning focus',
    description: 'ILIT with survivorship life, premium finance for leverage, charitable strategies, dynasty trust funding.',
    products: ['Survivorship IUL', 'ILIT', 'Premium Finance', 'Charitable Trust', 'FIA'],
    scores: { Protection: 5, Growth: 4, 'Tax Efficiency': 5, Liquidity: 2, Legacy: 5, Complexity: 5 } },
];

/* ═══ CALCULATION METHODS REFERENCE ═══ */
const CALC_METHODS = [
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
const DUE_DILIGENCE = [
  { text: 'Verify client identity and suitability (KYC/AML)', category: 'Compliance' },
  { text: 'Document risk tolerance assessment', category: 'Suitability' },
  { text: 'Review existing coverage and avoid replacement issues', category: 'Compliance' },
  { text: 'Confirm all income and asset figures with documentation', category: 'Data' },
  { text: 'Run carrier-specific illustrations for recommended products', category: 'Products' },
  { text: 'Obtain medical records for underwriting (life/DI)', category: 'Underwriting' },
  { text: 'Review beneficiary designations on all accounts', category: 'Estate' },
  { text: 'Confirm tax filing status and state of residence', category: 'Tax' },
  { text: 'Document all recommendations and client decisions', category: 'Compliance' },
  { text: 'Schedule follow-up review within 12 months', category: 'Service' },
  { text: 'Provide client with policy delivery receipt and free-look notice', category: 'Compliance' },
  { text: 'Verify carrier financial strength ratings (AM Best A- or better)', category: 'Products' },
];

/* ═══ ACTION PLAN BUILDER (faithful port from v7 calcTimeline) ═══ */
interface ActionPhase { name: string; timeline: string; actions: string[]; priority: string; }
function buildActionPlan(pace: 'standard'|'aggressive'|'gradual', recs: Recommendation[],
  scores: Record<string,number>, pr: PRResult, cf: CFResult, ed: EDResult): ActionPhase[] {
  const mult = pace === 'aggressive' ? 0.5 : pace === 'gradual' ? 1.5 : 1;
  const phases: ActionPhase[] = [];
  // Phase 1: Foundation
  const p1Actions = ['Complete financial profile and risk assessment'];
  if (cf.emGap > 0) p1Actions.push(`Build emergency fund: ${fmtSm(cf.emGap)} gap`);
  if (scores.protect < 2) p1Actions.push('Apply for life insurance (DIME gap: ' + fmtSm(pr.gap) + ')');
  p1Actions.push('Review and update beneficiary designations');
  phases.push({ name: 'Foundation', timeline: `Month 1-${Math.round(2 * mult)}`, actions: p1Actions, priority: 'Critical' });
  // Phase 2: Protection
  const p2Actions: string[] = [];
  if (pr.gap > 0) p2Actions.push(`Finalize life insurance: ${fmtSm(pr.gap)} coverage`);
  p2Actions.push('Set up disability insurance');
  if (scores.estate < 2) p2Actions.push('Schedule estate attorney consultation');
  p2Actions.push('Automate savings transfers');
  phases.push({ name: 'Protection', timeline: `Month ${Math.round(2*mult)+1}-${Math.round(4*mult)}`, actions: p2Actions, priority: 'High' });
  // Phase 3: Growth
  const p3Actions = ['Maximize 401(k) contributions', 'Open/fund Roth IRA', 'Review IUL illustration and apply'];
  if (ed.totalGap > 0) p3Actions.push(`Increase 529 contributions (+${fmt(ed.additionalMonthlyNeeded)}/mo)`);
  phases.push({ name: 'Growth & Tax', timeline: `Month ${Math.round(4*mult)+1}-${Math.round(8*mult)}`, actions: p3Actions, priority: 'High' });
  // Phase 4: Optimization
  const p4Actions = ['Review Roth conversion opportunity', 'Evaluate FIA for retirement income', 'Consider LTC hybrid coverage'];
  if (scores.estate < 3) p4Actions.push('Finalize estate documents (will/trust/POA)');
  phases.push({ name: 'Optimization', timeline: `Month ${Math.round(8*mult)+1}-${Math.round(12*mult)}`, actions: p4Actions, priority: 'Medium' });
  return phases;
}

/* ═══ PANEL TYPE DEFINITIONS ═══ */
type PanelId = 'profile' | 'cash' | 'protect' | 'grow' | 'retire' | 'tax' | 'estate' | 'edu' |
  'costben' | 'compare' | 'summary' | 'timeline' | 'refs';

const NAV_SECTIONS: { group: string; items: { id: PanelId; label: string; icon: React.ReactNode }[] }[] = [
  { group: 'Your Profile', items: [
    { id: 'profile', label: 'Client Profile', icon: <User className="w-4 h-4" /> },
  ]},
  { group: 'Planning Domains', items: [
    { id: 'cash', label: 'Cash Flow', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'protect', label: 'Protection', icon: <Shield className="w-4 h-4" /> },
    { id: 'grow', label: 'Growth', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'retire', label: 'Retirement', icon: <Clock className="w-4 h-4" /> },
    { id: 'tax', label: 'Tax Planning', icon: <Building2 className="w-4 h-4" /> },
    { id: 'estate', label: 'Estate', icon: <Scale className="w-4 h-4" /> },
    { id: 'edu', label: 'Education', icon: <GraduationCap className="w-4 h-4" /> },
  ]},
  { group: 'Analysis', items: [
    { id: 'costben', label: 'Cost-Benefit', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'compare', label: 'Strategy Compare', icon: <GitCompare className="w-4 h-4" /> },
    { id: 'summary', label: 'Summary', icon: <FileText className="w-4 h-4" /> },
    { id: 'timeline', label: 'Action Plan', icon: <ListChecks className="w-4 h-4" /> },
  ]},
  { group: 'Resources', items: [
    { id: 'refs', label: 'References', icon: <BookOpen className="w-4 h-4" /> },
  ]},
];

/* ═══ SMALL REUSABLE COMPONENTS ═══ */
function FormInput({ id, label, value, onChange, type = 'number', prefix, suffix, min, max, step }: {
  id: string; label: string; value: number | string; onChange: (v: string) => void;
  type?: string; prefix?: string; suffix?: string; min?: number; max?: number; step?: number;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-medium text-slate-600">{label}</Label>
      <div className="relative">
        {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">{prefix}</span>}
        <Input id={id} type={type} value={value} onChange={e => onChange(e.target.value)}
          className={`h-8 text-sm ${prefix ? 'pl-6' : ''} ${suffix ? 'pr-8' : ''}`}
          min={min} max={max} step={step} />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">{suffix}</span>}
      </div>
    </div>
  );
}

function ScoreBadge({ score, max = 3 }: { score: number; max?: number }) {
  const s = sc(score);
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${s.color}`}>
      {s.icon} {s.label}
    </span>
  );
}

function ResultBadge({ label, value, variant }: { label: string; value: string; variant?: string }) {
  const colorMap: Record<string, string> = {
    grn: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    gld: 'bg-amber-50 text-amber-700 border-amber-200',
    blu: 'bg-blue-50 text-blue-700 border-blue-200',
    '': 'bg-slate-50 text-slate-700 border-slate-200',
  };
  const cls = colorMap[variant || ''] || colorMap[''];
  return (
    <div className={`flex flex-col items-center rounded-lg border px-3 py-2 ${cls}`}>
      <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">{label}</span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  );
}

function ScoreGauge({ pct: pctVal, total, max }: { pct: number; total: number; max: number }) {
  const r = 40, stk = 10, circ = Math.PI * 2 * r;
  const dash = circ * pctVal / 100;
  const color = pctVal >= 80 ? '#16A34A' : pctVal >= 60 ? '#CA8A04' : '#DC2626';
  return (
    <div className="flex items-center gap-3">
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={r} fill="none" stroke="#E2E8F0" strokeWidth={stk} />
        <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth={stk}
          strokeDasharray={`${dash.toFixed(1)} ${(circ - dash).toFixed(1)}`}
          strokeDashoffset="0" transform="rotate(-90 55 55)" strokeLinecap="round"
          style={{ transition: 'stroke-dasharray .5s' }} />
        <text x="55" y="52" textAnchor="middle" fontSize="22" fontWeight="700" fill={color}>{pctVal}%</text>
        <text x="55" y="67" textAnchor="middle" fontSize="8" fill="#64748B">{total}/{max} points</text>
      </svg>
      <div className="text-sm text-slate-500 leading-relaxed">
        <b className="text-slate-900">{pctVal >= 80 ? 'Strong' : 'Opportunities exist'}</b><br />
        {pctVal >= 80 ? 'All domains well-positioned' : 'Some domains below target'}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function Calculators() {
  const { user } = useAuth();
  const [activePanel, setActivePanel] = useState<PanelId>('profile');

  /* ─── CLIENT PROFILE INPUTS ─── */
  const [clientName, setClientName] = useState('');
  const [age, setAge] = useState(40);
  const [spouseAge, setSpouseAge] = useState(38);
  const [dep, setDep] = useState(2);
  const [income, setIncome] = useState(150000);
  const [spouseIncome, setSpouseIncome] = useState(0);
  const [nw, setNw] = useState(500000);
  const [savings, setSavings] = useState(200000);
  const [retirement401k, setRetirement401k] = useState(350000);
  const [mortgage, setMortgage] = useState(300000);
  const [debt, setDebt] = useState(25000);
  const [existIns, setExistIns] = useState(250000);
  const [filing, setFiling] = useState('mfj');
  const [stateRate, setStateRate] = useState(0.05);
  const [riskTolerance, setRiskTolerance] = useState('moderate');
  const [isBiz, setIsBiz] = useState(false);

  /* ─── CASH FLOW INPUTS ─── */
  const [housing, setHousing] = useState(2500);
  const [transport, setTransport] = useState(800);
  const [food, setFood] = useState(600);
  const [insurancePmt, setInsurancePmt] = useState(300);
  const [debtPmt, setDebtPmt] = useState(500);
  const [otherExp, setOtherExp] = useState(400);
  const [emMonths, setEmMonths] = useState(6);

  /* ─── PROTECTION INPUTS ─── */
  const [replaceYrs, setReplaceYrs] = useState(10);
  const [payoffRate, setPayoffRate] = useState(0);
  const [eduPerChild, setEduPerChild] = useState(50000);
  const [finalExp, setFinalExp] = useState(25000);
  const [ssBenefit, setSsBenefit] = useState(2500);
  const [diPct, setDiPct] = useState(0.6);

  /* ─── GROWTH INPUTS ─── */
  const [retireAge, setRetireAge] = useState(65);
  const [monthlySav, setMonthlySav] = useState(1500);
  const [infRate, setInfRate] = useState(0.03);
  const [taxReturn, setTaxReturn] = useState(0.07);
  const [iulReturn, setIulReturn] = useState(0.065);
  const [fiaReturn, setFiaReturn] = useState(0.055);

  /* ─── RETIREMENT INPUTS ─── */
  const [ss62, setSs62] = useState(1800);
  const [ss67, setSs67] = useState(2800);
  const [ss70, setSs70] = useState(3500);
  const [pension, setPension] = useState(0);
  const [withdrawalRate, setWithdrawalRate] = useState(0.04);

  /* ─── TAX INPUTS ─── */
  const [hsaContrib, setHsaContrib] = useState(0);
  const [charitableGiving, setCharitableGiving] = useState(0);

  /* ─── ESTATE INPUTS ─── */
  const [grossEstate, setGrossEstate] = useState(2000000);
  const [exemption, setExemption] = useState(13610000);
  const [estateGrowth, setEstateGrowth] = useState(0.05);
  const [giftingAnnual, setGiftingAnnual] = useState(0);
  const [willStatus, setWillStatus] = useState('none');

  /* ─── EDUCATION INPUTS ─── */
  const [numChildren, setNumChildren] = useState(2);
  const [avgChildAge, setAvgChildAge] = useState(8);
  const [targetCost, setTargetCost] = useState(120000);
  const [eduReturn, setEduReturn] = useState(0.06);
  const [current529, setCurrent529] = useState(30000);
  const [monthly529, setMonthly529] = useState(300);

  /* ─── COST-BENEFIT INPUTS ─── */
  const [cbHorizons, setCbHorizons] = useState<number[]>([5, 10, 15, 20, 30]);
  const [cbCustomYr, setCbCustomYr] = useState('');

  /* ─── ACTION PLAN INPUTS ─── */
  const [pace, setPace] = useState<'standard'|'aggressive'|'gradual'>('standard');

  /* ═══ COMPUTED RESULTS ═══ */
  const totalIncome = income + spouseIncome;
  const grossMonthly = Math.round(totalIncome / 12);
  const taxRate = useMemo(() => getBracketRate(totalIncome, filing === 'mfj' ? RATES.bracketsMFJ : RATES.bracketsSingle) + stateRate, [totalIncome, filing, stateRate]);

  // Domain scores (faithful port of v7 cA scoring)
  const scores = useMemo(() => {
    const s: Record<string, number> = {};
    const sr = totalIncome > 0 ? (grossMonthly - housing - transport - food - insurancePmt - debtPmt - otherExp) / grossMonthly : 0;
    s.cash = sr >= 0.2 ? 3 : sr >= 0.1 ? 2 : sr > 0 ? 1 : 0;
    const dimeNeed = dep > 0 ? income * 10 + mortgage + debt + dep * 50000 + 25000 : income * 6 + debt;
    s.protect = existIns >= dimeNeed ? 3 : existIns >= dimeNeed * 0.5 ? 2 : existIns > 0 ? 1 : 0;
    s.growth = monthlySav >= grossMonthly * 0.15 ? 3 : monthlySav >= grossMonthly * 0.1 ? 2 : monthlySav > 0 ? 1 : 0;
    s.retire = retirement401k >= totalIncome * 3 ? 3 : retirement401k >= totalIncome ? 2 : retirement401k > 0 ? 1 : 0;
    const maxContrib = 23500 + (hsaContrib > 0 ? 1 : 0) * 8300;
    s.tax = retirement401k >= 23500 && hsaContrib > 0 ? 3 : retirement401k >= 10000 ? 2 : 1;
    s.estate = willStatus === 'trust' ? 3 : willStatus === 'will' ? 2 : 1;
    s.edu = dep === 0 ? 3 : current529 >= targetCost * dep * 0.5 ? 3 : current529 > 0 ? 2 : 1;
    return s;
  }, [totalIncome, grossMonthly, housing, transport, food, insurancePmt, debtPmt, otherExp,
    dep, income, mortgage, debt, existIns, monthlySav, retirement401k, hsaContrib, willStatus, current529, targetCost]);

  const scorecard = useMemo(() => computeScorecard(scores), [scores]);
  const recommendations = useMemo(() => buildRecommendations(age, totalIncome, dep, nw, existIns, mortgage, debt, isBiz, scores), [age, totalIncome, dep, nw, existIns, mortgage, debt, isBiz, scores]);
  const totalAnnualPremium = recommendations.reduce((a, r) => a + r.premium, 0);

  // Panel results
  const cfResult = useMemo(() => calcCashFlow(grossMonthly, taxRate, housing, transport, food, insurancePmt, debtPmt, otherExp, emMonths, savings), [grossMonthly, taxRate, housing, transport, food, insurancePmt, debtPmt, otherExp, emMonths, savings]);
  const prResult = useMemo(() => calcProtection(totalIncome, dep, mortgage, debt, existIns, age, replaceYrs, payoffRate, eduPerChild, finalExp, ssBenefit, diPct), [totalIncome, dep, mortgage, debt, existIns, age, replaceYrs, payoffRate, eduPerChild, finalExp, ssBenefit, diPct]);
  const grResult = useMemo(() => calcGrowth(age, retireAge, monthlySav, savings, infRate, taxReturn, iulReturn, fiaReturn), [age, retireAge, monthlySav, savings, infRate, taxReturn, iulReturn, fiaReturn]);
  const rtResult = useMemo(() => calcRetirement(age, retireAge, ss62, ss67, ss70, pension, withdrawalRate, savings, monthlySav), [age, retireAge, ss62, ss67, ss70, pension, withdrawalRate, savings, monthlySav]);
  const txResult = useMemo(() => calcTax(totalIncome, stateRate, isBiz, filing, retirement401k, hsaContrib, charitableGiving), [totalIncome, stateRate, isBiz, filing, retirement401k, hsaContrib, charitableGiving]);
  const esResult = useMemo(() => calcEstate(grossEstate, exemption, estateGrowth, giftingAnnual, willStatus), [grossEstate, exemption, estateGrowth, giftingAnnual, willStatus]);
  const edResult = useMemo(() => calcEducation(numChildren, avgChildAge, targetCost, infRate, eduReturn, current529, monthly529), [numChildren, avgChildAge, targetCost, infRate, eduReturn, current529, monthly529]);
  const horizonData = useMemo(() => buildHorizonData(recommendations, age, totalIncome, cbHorizons), [recommendations, age, totalIncome, cbHorizons]);

  /* ═══ RENDER ═══ */
  return (
    <div className="flex h-[calc(100vh-56px)] bg-slate-50">
      {/* ─── SIDEBAR ─── */}
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-amber-600" />
            <span className="text-sm font-bold text-slate-900">WealthBridge</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Unified Wealth Engine v7</p>
        </div>
        <ScrollArea className="flex-1">
          <nav className="p-2 space-y-3">
            {NAV_SECTIONS.map(section => (
              <div key={section.group}>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1">{section.group}</p>
                {section.items.map(item => (
                  <button key={item.id} onClick={() => setActivePanel(item.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      activePanel === item.id
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                    }`}>
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </ScrollArea>
        {/* Score footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Health Score</span>
            <span className={`font-bold ${scorecard.pctScore >= 80 ? 'text-green-600' : scorecard.pctScore >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
              {scorecard.pctScore}%
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${scorecard.pctScore >= 80 ? 'bg-green-500' : scorecard.pctScore >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${scorecard.pctScore}%` }} />
          </div>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ─── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6">

          {/* ═══ PANEL 1: CLIENT PROFILE ═══ */}
          {activePanel === 'profile' && (
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                <User className="w-5 h-5 text-amber-600" /> Client Profile
              </h2>
              <p className="text-sm text-slate-500 mb-4">Enter client information. All fields auto-calculate across every panel.</p>

              {/* Input Grid */}
              <Card className="mb-4">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <FormInput id="name" label="Client Name" value={clientName} onChange={setClientName} type="text" />
                    <FormInput id="age" label="Age" value={age} onChange={v => setAge(+v)} min={18} max={85} />
                    <FormInput id="spouseAge" label="Spouse Age" value={spouseAge} onChange={v => setSpouseAge(+v)} min={0} max={85} />
                    <FormInput id="dep" label="Dependents" value={dep} onChange={v => setDep(+v)} min={0} max={10} />
                    <FormInput id="income" label="Annual Income" value={income} onChange={v => setIncome(+v)} prefix="$" />
                    <FormInput id="spouseIncome" label="Spouse Income" value={spouseIncome} onChange={v => setSpouseIncome(+v)} prefix="$" />
                    <FormInput id="nw" label="Net Worth" value={nw} onChange={v => setNw(+v)} prefix="$" />
                    <FormInput id="savings" label="Liquid Savings" value={savings} onChange={v => setSavings(+v)} prefix="$" />
                    <FormInput id="retirement401k" label="401(k)/IRA Balance" value={retirement401k} onChange={v => setRetirement401k(+v)} prefix="$" />
                    <FormInput id="mortgage" label="Mortgage Balance" value={mortgage} onChange={v => setMortgage(+v)} prefix="$" />
                    <FormInput id="debt" label="Other Debt" value={debt} onChange={v => setDebt(+v)} prefix="$" />
                    <FormInput id="existIns" label="Existing Life Insurance" value={existIns} onChange={v => setExistIns(+v)} prefix="$" />
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-slate-600">Filing Status</Label>
                      <Select value={filing} onValueChange={setFiling}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mfj">Married Filing Jointly</SelectItem>
                          <SelectItem value="single">Single</SelectItem>
                          <SelectItem value="hoh">Head of Household</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <FormInput id="stateRate" label="State Tax Rate" value={(stateRate * 100).toFixed(1)} onChange={v => setStateRate(+v / 100)} suffix="%" />
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-slate-600">Risk Tolerance</Label>
                      <Select value={riskTolerance} onValueChange={setRiskTolerance}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="conservative">Conservative</SelectItem>
                          <SelectItem value="moderate">Moderate</SelectItem>
                          <SelectItem value="aggressive">Aggressive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-xs">
                        <input type="checkbox" checked={isBiz} onChange={e => setIsBiz(e.target.checked)} className="rounded" />
                        Business Owner
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Financial Health Scorecard */}
              <Card className="mb-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Financial Health Scorecard</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col md:flex-row gap-6">
                    <ScoreGauge pct={scorecard.pctScore} total={scorecard.overall} max={scorecard.maxScore} />
                    <div className="flex-1">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left py-1 text-xs font-semibold text-slate-500">Domain</th>
                            <th className="text-center py-1 text-xs font-semibold text-slate-500">Score</th>
                            <th className="text-left py-1 text-xs font-semibold text-slate-500">Status</th>
                            <th className="text-left py-1 text-xs font-semibold text-slate-500">Key Metric</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scorecard.domains.map(d => {
                            const keyMetrics: Record<string, string> = {
                              'Cash Flow': `Save rate ${pct(cfResult.saveRate)}`,
                              'Protection': `Gap ${fmtSm(prResult.gap)}`,
                              'Growth': `${grResult.yrs}yr to retire`,
                              'Retirement': `SS best at ${rtResult.bestAge}`,
                              'Tax': `Eff rate ${pct(txResult.effectiveRate)}`,
                              'Estate': `Tax ${fmtSm(esResult.estateTax)}`,
                              'Education': `Gap ${fmtSm(edResult.totalGap)}`,
                            };
                            return (
                              <tr key={d.name} className="border-b border-slate-100">
                                <td className="py-1.5 font-medium text-slate-700">{d.name}</td>
                                <td className="text-center">
                                  <span className="inline-flex gap-0.5">
                                    {[1,2,3].map(i => (
                                      <span key={i} className={`w-2 h-2 rounded-full ${i <= d.score ? 'bg-green-500' : 'bg-slate-200'}`} />
                                    ))}
                                  </span>
                                </td>
                                <td><ScoreBadge score={d.score} /></td>
                                <td className="text-xs text-slate-500">{keyMetrics[d.name] || '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {/* Pillar Summary */}
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {scorecard.pillars.map(p => (
                      <div key={p.name} className="bg-slate-50 rounded-lg p-3 text-center">
                        <div className="text-xs font-semibold text-slate-500 uppercase">{p.name}</div>
                        <div className="mt-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                          <div className={`h-full rounded-full ${p.score / p.maxScore >= 0.8 ? 'bg-green-500' : p.score / p.maxScore >= 0.5 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${(p.score / p.maxScore * 100).toFixed(0)}%` }} />
                        </div>
                        <div className="text-xs mt-1 text-slate-600">{p.score}/{p.maxScore} — {p.domains.join(', ')}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recommended Products */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Recommended Products</CardTitle>
                </CardHeader>
                <CardContent>
                  {recommendations.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">No recommendations — all domains scoring well.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Product</th>
                            <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Coverage</th>
                            <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Annual</th>
                            <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Monthly</th>
                            <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Carrier</th>
                            <th className="text-center py-2 px-2 text-xs font-semibold text-slate-500">Priority</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recommendations.map((r, i) => (
                            <tr key={i} className="border-b border-slate-100">
                              <td className="py-1.5 px-2 font-medium text-slate-700">{r.product}</td>
                              <td className="text-right px-2 text-slate-600">{r.coverage}</td>
                              <td className="text-right px-2 font-medium">{fmt(r.premium)}</td>
                              <td className="text-right px-2 text-slate-600">{fmt(r.monthly)}</td>
                              <td className="px-2 text-slate-500">{r.carrier}</td>
                              <td className="text-center px-2">
                                <Badge variant={r.priority === 'High' ? 'destructive' : r.priority === 'Medium' ? 'default' : 'secondary'}
                                  className="text-[10px]">{r.priority}</Badge>
                              </td>
                            </tr>
                          ))}
                          <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                            <td className="py-2 px-2">TOTAL</td>
                            <td className="text-right px-2">{recommendations.length} products</td>
                            <td className="text-right px-2">{fmt(totalAnnualPremium)}</td>
                            <td className="text-right px-2">{fmt(Math.round(totalAnnualPremium / 12))}</td>
                            <td colSpan={2} className="px-2 text-xs text-slate-500">
                              {pct(totalIncome > 0 ? totalAnnualPremium / totalIncome : 0)} of income
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          )}

          {/* ═══ PANEL 2: CASH FLOW ═══ */}
          {activePanel === 'cash' && (
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-600" /> Monthly Cash Flow
              </h2>
              <p className="text-sm text-slate-500 mb-4">Budget analysis with emergency fund tracking. Sources: BLS Consumer Expenditure Survey 2024.</p>

              <Card className="mb-4">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <FormInput id="housing" label="Housing" value={housing} onChange={v => setHousing(+v)} prefix="$" suffix="/mo" />
                    <FormInput id="transport" label="Transport" value={transport} onChange={v => setTransport(+v)} prefix="$" suffix="/mo" />
                    <FormInput id="food" label="Food" value={food} onChange={v => setFood(+v)} prefix="$" suffix="/mo" />
                    <FormInput id="insurancePmt" label="Insurance" value={insurancePmt} onChange={v => setInsurancePmt(+v)} prefix="$" suffix="/mo" />
                    <FormInput id="debtPmt" label="Debt Payments" value={debtPmt} onChange={v => setDebtPmt(+v)} prefix="$" suffix="/mo" />
                    <FormInput id="otherExp" label="Other" value={otherExp} onChange={v => setOtherExp(+v)} prefix="$" suffix="/mo" />
                    <FormInput id="emMonths" label="Emergency Fund Target (months)" value={emMonths} onChange={v => setEmMonths(+v)} min={3} max={12} />
                  </div>
                </CardContent>
              </Card>

              {/* Cash Flow Results Table */}
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Budget Breakdown</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Item</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Monthly</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">% Gross</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-100 bg-green-50">
                        <td className="py-1.5 px-2 font-medium text-green-700">Gross Income</td>
                        <td className="text-right px-2 font-bold text-green-700">{fmt(cfResult.gross)}</td>
                        <td className="text-right px-2 text-green-600">100%</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 px-2 text-slate-600">− Taxes ({pct(cfResult.taxRate)})</td>
                        <td className="text-right px-2 text-red-600">−{fmt(cfResult.gross - cfResult.net)}</td>
                        <td className="text-right px-2 text-slate-500">{pct(cfResult.taxRate)}</td>
                      </tr>
                      <tr className="border-b border-slate-200 bg-blue-50">
                        <td className="py-1.5 px-2 font-medium text-blue-700">Net Income</td>
                        <td className="text-right px-2 font-bold text-blue-700">{fmt(cfResult.net)}</td>
                        <td className="text-right px-2 text-blue-600">{pct(1 - cfResult.taxRate)}</td>
                      </tr>
                      {cfResult.expenses.map(e => (
                        <tr key={e.label} className="border-b border-slate-100">
                          <td className="py-1.5 px-2 text-slate-600">− {e.label}</td>
                          <td className="text-right px-2 text-slate-700">{fmt(e.amount)}</td>
                          <td className="text-right px-2 text-slate-500">{cfResult.gross > 0 ? pct(e.amount / cfResult.gross) : '—'}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                        <td className="py-2 px-2">Monthly Surplus</td>
                        <td className={`text-right px-2 ${cfResult.surplus >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(cfResult.surplus)}</td>
                        <td className="text-right px-2 text-slate-600">{cfResult.gross > 0 ? pct(cfResult.surplus / cfResult.gross) : '—'}</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Result Badges */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <ResultBadge label="Save Rate" value={pct(cfResult.saveRate)} variant={cfResult.saveRate >= 0.2 ? 'grn' : cfResult.saveRate >= 0.1 ? 'gld' : 'red'} />
                <ResultBadge label="DTI Ratio" value={pct(cfResult.dti)} variant={cfResult.dti <= 0.36 ? 'grn' : cfResult.dti <= 0.43 ? 'gld' : 'red'} />
                <ResultBadge label="Emergency Target" value={fmt(cfResult.emTarget)} variant="blu" />
                <ResultBadge label="Emergency Gap" value={fmt(cfResult.emGap)} variant={cfResult.emGap === 0 ? 'grn' : 'red'} />
              </div>
            </section>
          )}

          {/* ═══ PANEL 3: PROTECTION ═══ */}
          {activePanel === 'protect' && (
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-600" /> Protection Analysis
              </h2>
              <p className="text-sm text-slate-500 mb-4">DIME method life insurance + disability income + long-term care. Sources: LIMRA 2024, SSA disability statistics.</p>

              <Card className="mb-4">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <FormInput id="replaceYrs" label="Income Replace Years" value={replaceYrs} onChange={v => setReplaceYrs(+v)} min={5} max={30} />
                    <FormInput id="eduPerChild" label="Education/Child" value={eduPerChild} onChange={v => setEduPerChild(+v)} prefix="$" />
                    <FormInput id="finalExp" label="Final Expenses" value={finalExp} onChange={v => setFinalExp(+v)} prefix="$" />
                    <FormInput id="diPct" label="DI Benefit %" value={(diPct * 100).toFixed(0)} onChange={v => setDiPct(+v / 100)} suffix="%" />
                  </div>
                </CardContent>
              </Card>

              {/* DIME Analysis */}
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">DIME Need Analysis</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Component</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prResult.components.map(c => (
                        <tr key={c.label} className="border-b border-slate-100">
                          <td className="py-1.5 px-2 text-slate-700">{c.label}</td>
                          <td className="text-right px-2 font-medium">{fmt(c.amount)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-slate-300 bg-amber-50 font-bold">
                        <td className="py-2 px-2">Total DIME Need</td>
                        <td className="text-right px-2">{fmt(prResult.dimeNeed)}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 px-2 text-green-700">− Existing Coverage</td>
                        <td className="text-right px-2 text-green-700">−{fmt(prResult.existingCoverage)}</td>
                      </tr>
                      <tr className="bg-red-50 font-bold">
                        <td className="py-2 px-2 text-red-700">Coverage Gap</td>
                        <td className="text-right px-2 text-red-700">{fmt(prResult.gap)}</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Recommended Coverage */}
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Recommended Coverage</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Need</th>
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Product</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Coverage</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Annual</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Monthly</th>
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Carrier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prResult.products.map((p, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="py-1.5 px-2 text-slate-600">{p.need}</td>
                          <td className="px-2 font-medium text-slate-700">{p.product}</td>
                          <td className="text-right px-2">{fmtSm(p.coverage)}</td>
                          <td className="text-right px-2 font-medium">{fmt(p.premium)}</td>
                          <td className="text-right px-2 text-slate-600">{fmt(p.monthly)}</td>
                          <td className="px-2 text-slate-500">{p.carrier}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                        <td colSpan={3} className="py-2 px-2">TOTAL</td>
                        <td className="text-right px-2">{fmt(prResult.totalPremium)}</td>
                        <td className="text-right px-2">{fmt(Math.round(prResult.totalPremium / 12))}</td>
                        <td className="px-2 text-xs text-slate-500">{pct(totalIncome > 0 ? prResult.totalPremium / totalIncome : 0)} of income</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Result Badges */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <ResultBadge label="DIME Need" value={fmtSm(prResult.dimeNeed)} variant="gld" />
                <ResultBadge label="Coverage Gap" value={fmtSm(prResult.gap)} variant={prResult.gap === 0 ? 'grn' : 'red'} />
                <ResultBadge label="DI Benefit" value={fmt(prResult.diNeed) + '/yr'} variant="blu" />
                <ResultBadge label="Total Premium" value={fmt(prResult.totalPremium) + '/yr'} variant="gld" />
              </div>
            </section>
          )}

          {/* ═══ PANEL 4: GROWTH ═══ */}
          {activePanel === 'grow' && (
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-600" /> Growth & Accumulation
              </h2>
              <p className="text-sm text-slate-500 mb-4">Multi-vehicle comparison: Taxable vs 401(k) vs Roth vs IUL vs FIA. Sources: Morningstar, Vanguard 2024.</p>

              <Card className="mb-4">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <FormInput id="retireAge" label="Target Retire Age" value={retireAge} onChange={v => setRetireAge(+v)} min={50} max={80} />
                    <FormInput id="monthlySav" label="Monthly Savings" value={monthlySav} onChange={v => setMonthlySav(+v)} prefix="$" />
                    <FormInput id="taxReturn" label="Taxable/401k Return" value={(taxReturn * 100).toFixed(1)} onChange={v => setTaxReturn(+v / 100)} suffix="%" />
                    <FormInput id="iulReturn" label="IUL Net Return" value={(iulReturn * 100).toFixed(1)} onChange={v => setIulReturn(+v / 100)} suffix="%" />
                    <FormInput id="fiaReturn" label="FIA Return" value={(fiaReturn * 100).toFixed(1)} onChange={v => setFiaReturn(+v / 100)} suffix="%" />
                    <FormInput id="infRate" label="Inflation Rate" value={(infRate * 100).toFixed(1)} onChange={v => setInfRate(+v / 100)} suffix="%" />
                  </div>
                </CardContent>
              </Card>

              {/* Vehicle Comparison Table */}
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Vehicle Comparison ({grResult.yrs} years to retirement)</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Vehicle</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Projected Value</th>
                        <th className="text-center py-2 px-2 text-xs font-semibold text-slate-500">Tax-Free?</th>
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grResult.vehicles.map(v => (
                        <tr key={v.name} className="border-b border-slate-100">
                          <td className="py-1.5 px-2 font-medium text-slate-700">{v.name}</td>
                          <td className="text-right px-2 font-bold">{fmtSm(v.value)}</td>
                          <td className="text-center px-2">
                            {v.taxFree ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-slate-300 mx-auto" />}
                          </td>
                          <td className="px-2 text-xs text-slate-500">{v.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Tax-Free Edge */}
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Tax-Free Edge Analysis</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">
                    By using Roth + IUL instead of taxable + traditional 401(k), the projected tax-free advantage over {grResult.yrs} years is:
                  </p>
                  <div className="mt-2 text-2xl font-bold text-green-700">{fmtSm(grResult.taxEdge)}</div>
                  <p className="text-xs text-slate-500 mt-1">This represents the additional after-tax wealth from tax-free growth vehicles (IRC §7702, §408A).</p>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <ResultBadge label="Years to Retire" value={String(grResult.yrs)} variant="blu" />
                <ResultBadge label="Best Vehicle" value="Roth/IUL" variant="grn" />
                <ResultBadge label="Tax-Free Edge" value={fmtSm(grResult.taxEdge)} variant="grn" />
                <ResultBadge label="Monthly Saving" value={fmt(monthlySav)} variant="gld" />
              </div>
            </section>
          )}


          {/* ═══ PANEL 5: RETIREMENT ═══ */}
          {activePanel === 'retire' && (
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" /> Retirement Readiness
              </h2>
              <p className="text-sm text-slate-500 mb-4">Social Security claiming comparison + portfolio withdrawal analysis. Sources: SSA 2024, Trinity Study, Bengen Rule.</p>

              <Card className="mb-4">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <FormInput id="ss62" label="SS at 62 (monthly)" value={ss62} onChange={v => setSs62(+v)} prefix="$" />
                    <FormInput id="ss67" label="SS at 67 (monthly)" value={ss67} onChange={v => setSs67(+v)} prefix="$" />
                    <FormInput id="ss70" label="SS at 70 (monthly)" value={ss70} onChange={v => setSs70(+v)} prefix="$" />
                    <FormInput id="pension" label="Pension (monthly)" value={pension} onChange={v => setPension(+v)} prefix="$" />
                    <FormInput id="withdrawalRate" label="Withdrawal Rate" value={(withdrawalRate * 100).toFixed(1)} onChange={v => setWithdrawalRate(+v / 100)} suffix="%" />
                  </div>
                </CardContent>
              </Card>

              {/* SS Claiming Comparison */}
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Social Security Claiming Comparison</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Claim Age</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Monthly</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Annual</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Cum. at 80</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Cum. at 85</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Cum. at 90</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rtResult.ssComparison.map(s => (
                        <tr key={s.age} className={`border-b border-slate-100 ${s.age === rtResult.bestAge ? 'bg-green-50' : ''}`}>
                          <td className="py-1.5 px-2 font-medium text-slate-700">
                            Age {s.age} {s.age === rtResult.bestAge && <Badge className="ml-1 text-[10px]" variant="default">Best</Badge>}
                          </td>
                          <td className="text-right px-2">{fmt(s.monthly)}</td>
                          <td className="text-right px-2">{fmt(s.annual)}</td>
                          <td className="text-right px-2">{fmtSm(s.cumAt80)}</td>
                          <td className="text-right px-2 font-medium">{fmtSm(s.cumAt85)}</td>
                          <td className="text-right px-2">{fmtSm(s.cumAt90)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-xs text-slate-500 mt-2">
                    <strong>Optimal claiming age: {rtResult.bestAge}</strong> — maximizes cumulative benefits to age 85 (average life expectancy).
                    Delaying from 62 to 70 increases monthly benefit by ~77%.
                  </p>
                </CardContent>
              </Card>

              {/* Portfolio Withdrawal */}
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Portfolio Withdrawal Analysis</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 text-slate-600">Portfolio at Retirement</td>
                        <td className="text-right font-bold">{fmtSm(rtResult.portfolioAtRetire)}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 text-slate-600">Annual Withdrawal ({pct(withdrawalRate)})</td>
                        <td className="text-right font-medium">{fmt(rtResult.withdrawal)}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 text-slate-600">+ SS (age {rtResult.bestAge})</td>
                        <td className="text-right font-medium">{fmt((rtResult.ssComparison.find(s => s.age === rtResult.bestAge)?.annual ?? 0))}/yr</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 text-slate-600">+ Pension</td>
                        <td className="text-right font-medium">{fmt(pension * 12)}/yr</td>
                      </tr>
                      <tr className="border-t-2 border-slate-300 bg-green-50 font-bold">
                        <td className="py-2 text-green-700">Total Monthly Income</td>
                        <td className="text-right text-green-700">{fmt(rtResult.monthlyIncome)}/mo</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 text-slate-600">RMD at 72 (est.)</td>
                        <td className="text-right">{fmt(rtResult.rmd72)}/yr</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <ResultBadge label="Best SS Age" value={String(rtResult.bestAge)} variant="grn" />
                <ResultBadge label="Portfolio" value={fmtSm(rtResult.portfolioAtRetire)} variant="blu" />
                <ResultBadge label="Monthly Income" value={fmt(rtResult.monthlyIncome)} variant="grn" />
                <ResultBadge label="RMD at 72" value={fmtSm(rtResult.rmd72)} variant="gld" />
              </div>
            </section>
          )}

          {/* ═══ PANEL 6: TAX PLANNING ═══ */}
          {activePanel === 'tax' && (
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-600" /> Tax Planning
              </h2>
              <p className="text-sm text-slate-500 mb-4">Tax optimization strategies + Roth conversion explorer. Sources: IRS 2024 brackets, IRC §199A, §408A.</p>

              <Card className="mb-4">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <FormInput id="hsaContrib" label="HSA Contribution" value={hsaContrib} onChange={v => setHsaContrib(+v)} prefix="$" suffix="/yr" />
                    <FormInput id="charitableGiving" label="Charitable Giving" value={charitableGiving} onChange={v => setCharitableGiving(+v)} prefix="$" suffix="/yr" />
                  </div>
                </CardContent>
              </Card>

              {/* Tax Strategies Table */}
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Tax Savings Strategies</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Strategy</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Annual Saving</th>
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txResult.strategies.map((s, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="py-1.5 px-2 font-medium text-slate-700">{s.name}</td>
                          <td className="text-right px-2 font-bold text-green-700">{fmt(s.saving)}</td>
                          <td className="px-2 text-xs text-slate-500">{s.note}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-slate-300 bg-green-50 font-bold">
                        <td className="py-2 px-2 text-green-700">Total Potential Savings</td>
                        <td className="text-right px-2 text-green-700">{fmt(txResult.totalSaving)}</td>
                        <td className="px-2 text-xs text-green-600">per year</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Roth Conversion Explorer */}
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Roth Conversion Explorer</CardTitle></CardHeader>
                <CardContent>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800 mb-2">
                      <strong>Convert {fmt(txResult.rothConversion.amount)} from Traditional to Roth</strong>
                    </p>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-xs text-blue-600 font-medium">Tax Now</div>
                        <div className="text-lg font-bold text-red-600">{fmt(txResult.rothConversion.taxNow)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-blue-600 font-medium">Tax-Free at 20yr</div>
                        <div className="text-lg font-bold text-green-600">{fmt(txResult.rothConversion.taxFreeFuture)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-blue-600 font-medium">Net Benefit</div>
                        <div className="text-lg font-bold text-green-700">{fmt(txResult.rothConversion.netBenefit)}</div>
                      </div>
                    </div>
                    <p className="text-xs text-blue-600 mt-2">
                      Sweet spot: Convert in low-income years (sabbatical, early retirement) to stay in lower brackets.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <ResultBadge label="Effective Rate" value={pct(txResult.effectiveRate)} variant="gld" />
                <ResultBadge label="Marginal Rate" value={pct(txResult.marginalRate)} variant="red" />
                <ResultBadge label="Total Savings" value={fmtSm(txResult.totalSaving)} variant="grn" />
                <ResultBadge label="Roth Benefit" value={fmtSm(txResult.rothConversion.netBenefit)} variant="grn" />
              </div>
            </section>
          )}

          {/* ═══ PANEL 7: ESTATE ═══ */}
          {activePanel === 'estate' && (
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-600" /> Estate Planning
              </h2>
              <p className="text-sm text-slate-500 mb-4">Estate tax analysis + ILIT strategy + document checklist. Sources: IRS 2024 exemption, IRC §2010.</p>

              <Card className="mb-4">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <FormInput id="grossEstate" label="Gross Estate Value" value={grossEstate} onChange={v => setGrossEstate(+v)} prefix="$" />
                    <FormInput id="exemption" label="Federal Exemption" value={exemption} onChange={v => setExemption(+v)} prefix="$" />
                    <FormInput id="estateGrowth" label="Growth Rate" value={(estateGrowth * 100).toFixed(1)} onChange={v => setEstateGrowth(+v / 100)} suffix="%" />
                    <FormInput id="giftingAnnual" label="Annual Gifting" value={giftingAnnual} onChange={v => setGiftingAnnual(+v)} prefix="$" />
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-slate-600">Estate Documents</Label>
                      <Select value={willStatus} onValueChange={setWillStatus}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Will/Trust</SelectItem>
                          <SelectItem value="will">Will Only</SelectItem>
                          <SelectItem value="trust">Revocable Trust</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Estate Analysis */}
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Estate Tax Analysis</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 text-slate-600">Gross Estate</td>
                        <td className="text-right font-medium">{fmt(esResult.grossEstate)}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 text-slate-600">Federal Exemption (2024)</td>
                        <td className="text-right text-green-600">−{fmt(esResult.exemption)}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 text-slate-600">Taxable Estate</td>
                        <td className="text-right font-medium">{fmt(esResult.taxable)}</td>
                      </tr>
                      <tr className="border-b border-slate-200 bg-red-50">
                        <td className="py-1.5 font-medium text-red-700">Estate Tax (40%)</td>
                        <td className="text-right font-bold text-red-700">{fmt(esResult.estateTax)}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 text-slate-600">Net to Heirs (without planning)</td>
                        <td className="text-right">{fmt(esResult.netToHeirs)}</td>
                      </tr>
                      <tr className="bg-green-50">
                        <td className="py-1.5 font-medium text-green-700">Net to Heirs (with ILIT + gifting)</td>
                        <td className="text-right font-bold text-green-700">{fmt(esResult.withPlanning)}</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Document Checklist */}
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Estate Document Checklist</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Document</th>
                        <th className="text-center py-2 px-2 text-xs font-semibold text-slate-500">Status</th>
                        <th className="text-center py-2 px-2 text-xs font-semibold text-slate-500">Priority</th>
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {esResult.documents.map((d, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="py-1.5 px-2 font-medium text-slate-700">{d.name}</td>
                          <td className="text-center px-2">
                            <Badge variant={d.status === 'Complete' ? 'default' : d.status === 'Missing' ? 'destructive' : 'secondary'}
                              className="text-[10px]">{d.status}</Badge>
                          </td>
                          <td className="text-center px-2">
                            <Badge variant={d.priority === 'High' ? 'destructive' : d.priority === 'Medium' ? 'default' : 'secondary'}
                              className="text-[10px]">{d.priority}</Badge>
                          </td>
                          <td className="px-2 text-xs text-slate-500">
                            {d.status === 'Missing' ? 'Schedule with estate attorney' : d.status === 'Complete' ? 'Review annually' : 'Verify status'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <ResultBadge label="Estate Tax" value={fmtSm(esResult.estateTax)} variant={esResult.estateTax === 0 ? 'grn' : 'red'} />
                <ResultBadge label="ILIT Saving" value={fmtSm(esResult.ilitSaving)} variant="grn" />
                <ResultBadge label="Net to Heirs" value={fmtSm(esResult.withPlanning)} variant="grn" />
                <ResultBadge label="Documents" value={`${esResult.documents.filter(d => d.status === 'Complete').length}/${esResult.documents.length}`} variant="gld" />
              </div>
            </section>
          )}

          {/* ═══ PANEL 8: EDUCATION ═══ */}
          {activePanel === 'edu' && (
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-amber-600" /> Education Planning
              </h2>
              <p className="text-sm text-slate-500 mb-4">529 plan projections + funding gap analysis. Sources: College Board 2024, Vanguard 529.</p>

              <Card className="mb-4">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <FormInput id="numChildren" label="Number of Children" value={numChildren} onChange={v => setNumChildren(+v)} min={0} max={8} />
                    <FormInput id="avgChildAge" label="Avg Child Age" value={avgChildAge} onChange={v => setAvgChildAge(+v)} min={0} max={17} />
                    <FormInput id="targetCost" label="Target Cost (4yr)" value={targetCost} onChange={v => setTargetCost(+v)} prefix="$" />
                    <FormInput id="eduReturn" label="529 Return Rate" value={(eduReturn * 100).toFixed(1)} onChange={v => setEduReturn(+v / 100)} suffix="%" />
                    <FormInput id="current529" label="Current 529 Balance" value={current529} onChange={v => setCurrent529(+v)} prefix="$" />
                    <FormInput id="monthly529" label="Monthly 529 Contrib" value={monthly529} onChange={v => setMonthly529(+v)} prefix="$" suffix="/mo" />
                  </div>
                </CardContent>
              </Card>

              {/* Education Projection */}
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">529 Projection ({edResult.yrsToCollege} years to college)</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Metric</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Per Child</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Total ({numChildren} children)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 px-2 text-slate-600">Future Cost (inflation-adjusted)</td>
                        <td className="text-right px-2 font-medium">{fmtSm(edResult.futureCostPerChild)}</td>
                        <td className="text-right px-2 font-bold">{fmtSm(edResult.totalFutureCost)}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 px-2 text-slate-600">Projected 529 Value</td>
                        <td className="text-right px-2 font-medium text-green-700">{fmtSm(edResult.projectedPer529)}</td>
                        <td className="text-right px-2 font-bold text-green-700">{fmtSm(edResult.totalProjected)}</td>
                      </tr>
                      <tr className="border-t-2 border-slate-300 bg-red-50 font-bold">
                        <td className="py-2 px-2 text-red-700">Funding Gap</td>
                        <td className="text-right px-2 text-red-700">{fmtSm(edResult.gapPerChild)}</td>
                        <td className="text-right px-2 text-red-700">{fmtSm(edResult.totalGap)}</td>
                      </tr>
                    </tbody>
                  </table>
                  {edResult.additionalMonthlyNeeded > 0 && (
                    <p className="text-sm text-amber-700 mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <strong>To close the gap:</strong> Increase monthly 529 contribution by {fmt(edResult.additionalMonthlyNeeded)}/mo per child.
                    </p>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <ResultBadge label="Future Cost" value={fmtSm(edResult.totalFutureCost)} variant="gld" />
                <ResultBadge label="Projected 529" value={fmtSm(edResult.totalProjected)} variant="grn" />
                <ResultBadge label="Gap" value={fmtSm(edResult.totalGap)} variant={edResult.totalGap === 0 ? 'grn' : 'red'} />
                <ResultBadge label="Add'l Needed" value={fmt(edResult.additionalMonthlyNeeded) + '/mo'} variant="gld" />
              </div>
            </section>
          )}

          {/* ═══ PANEL 9: COST-BENEFIT ANALYSIS ═══ */}
          {activePanel === 'costben' && (
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-amber-600" /> Comprehensive Cost vs. Benefit Analysis
              </h2>
              <p className="text-sm text-slate-500 mb-4">Complete financial picture — what your client invests and what they receive across all recommended products, all 5 benefit dimensions, and any planning horizon.</p>

              {/* Horizon Selector */}
              <Card className="mb-4">
                <CardContent className="pt-4">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-slate-700">📅 Planning Horizon:</span>
                    {[5, 10, 15, 20, 25, 30, 40].map(yr => (
                      <Button key={yr} size="sm" variant={cbHorizons.includes(yr) ? 'default' : 'outline'}
                        className="h-7 px-2.5 text-xs"
                        onClick={() => setCbHorizons(prev => prev.includes(yr) ? prev.filter(h => h !== yr) : [...prev, yr].sort((a,b) => a - b))}>
                        {yr}yr
                      </Button>
                    ))}
                    <Button size="sm" variant={cbHorizons.includes(Math.max(1, 65 - age)) ? 'default' : 'outline'}
                      className="h-7 px-2.5 text-xs"
                      onClick={() => {
                        const retYr = Math.max(1, 65 - age);
                        setCbHorizons(prev => prev.includes(retYr) ? prev.filter(h => h !== retYr) : [...prev, retYr].sort((a,b) => a - b));
                      }}>
                      🎯 Retire ({Math.max(1, 65 - age)}yr)
                    </Button>
                    <div className="flex items-center gap-1">
                      <Input className="h-7 w-16 text-xs text-center" type="number" min={1} max={60}
                        placeholder="Custom" value={cbCustomYr} onChange={e => setCbCustomYr(e.target.value)} />
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                        onClick={() => {
                          const yr = parseInt(cbCustomYr);
                          if (yr >= 1 && yr <= 60 && !cbHorizons.includes(yr)) {
                            setCbHorizons(prev => [...prev, yr].sort((a,b) => a - b));
                            setCbCustomYr('');
                          }
                        }}>+ Add</Button>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400">Click year buttons to add/remove columns. Type any year (1-60) and click + Add.</p>
                </CardContent>
              </Card>

              {/* Summary Cards */}
              {horizonData.length > 0 && (() => {
                const headline = horizonData[horizonData.length - 1];
                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className="bg-gradient-to-br from-red-50 to-white border border-red-200 rounded-xl p-3 text-center">
                      <div className="text-[10px] font-bold uppercase text-red-500 tracking-wide">{headline.yr}-Year Total Cost</div>
                      <div className="text-xl font-extrabold text-red-700">{fmtSm(headline.cost)}</div>
                      <div className="text-[11px] text-slate-500">{fmtSm(totalAnnualPremium)}/yr · {pct(totalIncome > 0 ? totalAnnualPremium / totalIncome : 0)} of income</div>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-white border border-green-200 rounded-xl p-3 text-center">
                      <div className="text-[10px] font-bold uppercase text-green-500 tracking-wide">{headline.yr}-Year Total Benefit</div>
                      <div className="text-xl font-extrabold text-green-700">{fmtSm(headline.benefit)}</div>
                      <div className="text-[11px] text-slate-500">across all {recommendations.length} products</div>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-200 rounded-xl p-3 text-center">
                      <div className="text-[10px] font-bold uppercase text-blue-500 tracking-wide">{headline.yr}-Year Net Value</div>
                      <div className={`text-xl font-extrabold ${headline.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmtSm(headline.net)}</div>
                      <div className="text-[11px] text-slate-500">benefit minus cost</div>
                    </div>
                    <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-200 rounded-xl p-3 text-center">
                      <div className="text-[10px] font-bold uppercase text-amber-500 tracking-wide">{headline.yr}-Year ROI</div>
                      <div className="text-xl font-extrabold text-amber-700">{headline.roi}:1</div>
                      <div className="text-[11px] text-slate-500">for every $1 invested</div>
                    </div>
                  </div>
                );
              })()}

              {/* Horizon Projection Table */}
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Total Value Over Planning Horizons</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-500 mb-3">Actual dollar values at each milestone. Costs reflect paid-up status. Benefits include all dimensions: death benefit, cash value, income protection, tax savings, and legacy value.</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Metric</th>
                          {horizonData.map(h => (
                            <th key={h.yr} className="text-right py-2 px-2 text-xs font-semibold text-slate-500">{h.yr}yr</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-100">
                          <td className="py-1.5 px-2 text-red-600 font-medium">Total Cost</td>
                          {horizonData.map(h => <td key={h.yr} className="text-right px-2 text-red-600">{fmtSm(h.cost)}</td>)}
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="py-1.5 px-2 text-green-600 font-medium">Total Benefit</td>
                          {horizonData.map(h => <td key={h.yr} className="text-right px-2 text-green-600">{fmtSm(h.benefit)}</td>)}
                        </tr>
                        <tr className="border-b border-slate-100 bg-slate-50 font-bold">
                          <td className="py-1.5 px-2">Net Value</td>
                          {horizonData.map(h => <td key={h.yr} className={`text-right px-2 ${h.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmtSm(h.net)}</td>)}
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="py-1.5 px-2 text-amber-600 font-medium">ROI</td>
                          {horizonData.map(h => <td key={h.yr} className="text-right px-2 text-amber-600 font-bold">{h.roi}:1</td>)}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Sparkline Bar Chart */}
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Cost vs. Benefit Over Time</CardTitle></CardHeader>
                <CardContent>
                  {horizonData.length > 0 && (() => {
                    const maxVal = Math.max(...horizonData.map(h => Math.max(h.cost, h.benefit)));
                    return (
                      <div className="space-y-2">
                        {horizonData.map(h => (
                          <div key={h.yr} className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 w-10 text-right">{h.yr}yr</span>
                            <div className="flex-1 flex gap-1">
                              <div className="h-4 rounded bg-red-400" style={{ width: `${maxVal > 0 ? (h.cost / maxVal * 100) : 0}%` }}
                                title={`Cost: ${fmtSm(h.cost)}`} />
                              <div className="h-4 rounded bg-green-400" style={{ width: `${maxVal > 0 ? (h.benefit / maxVal * 100) : 0}%` }}
                                title={`Benefit: ${fmtSm(h.benefit)}`} />
                            </div>
                            <span className="text-xs font-bold text-slate-600 w-12 text-right">{h.roi}:1</span>
                          </div>
                        ))}
                        <div className="flex gap-4 mt-2 text-xs text-slate-500">
                          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400" /> Cost</span>
                          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-400" /> Benefit</span>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Bottom Line */}
              {horizonData.length > 0 && (() => {
                const h = horizonData[horizonData.length - 1];
                return (
                  <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-xl p-4 mb-4">
                    <h3 className="text-sm font-bold mb-1">📊 Bottom Line</h3>
                    <p className="text-sm leading-relaxed">
                      Over a {h.yr}-year planning horizon, {clientName || 'the client'} invests {fmtSm(h.cost)} in comprehensive financial protection
                      and receives {fmtSm(h.benefit)} in total value — a {h.roi}:1 return on every dollar invested.
                      {h.net > 0 ? ` That's a net gain of ${fmtSm(h.net)}.` : ''}
                      {' '}This includes death benefit protection, cash value accumulation, tax savings, disability income replacement, and legacy value.
                    </p>
                  </div>
                );
              })()}
            </section>
          )}

          {/* ═══ PANEL 10: STRATEGY COMPARISON ═══ */}
          {activePanel === 'compare' && (
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-amber-600" /> Strategy Comparison
              </h2>
              <p className="text-sm text-slate-500 mb-4">Compare preset strategies across all financial dimensions. Sources: Morningstar, Kitces Research 2024.</p>

              <Card className="mb-4">
                <CardContent className="pt-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Dimension</th>
                          {STRATEGIES.map(s => (
                            <th key={s.name} className="text-center py-2 px-2 text-xs font-semibold text-slate-500">{s.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {['Protection', 'Growth', 'Tax Efficiency', 'Liquidity', 'Legacy', 'Complexity'].map(dim => (
                          <tr key={dim} className="border-b border-slate-100">
                            <td className="py-1.5 px-2 font-medium text-slate-700">{dim}</td>
                            {STRATEGIES.map(s => {
                              const val = s.scores[dim as keyof typeof s.scores] ?? 0;
                              return (
                                <td key={s.name} className="text-center px-2">
                                  <div className="flex items-center justify-center gap-0.5">
                                    {[1,2,3,4,5].map(i => (
                                      <span key={i} className={`w-1.5 h-4 rounded-sm ${i <= val ? 'bg-amber-500' : 'bg-slate-200'}`} />
                                    ))}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                        <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                          <td className="py-2 px-2">Total Score</td>
                          {STRATEGIES.map(s => {
                            const total = Object.values(s.scores).reduce((a, b) => a + b, 0);
                            return <td key={s.name} className="text-center px-2 text-amber-700 font-bold">{total}/30</td>;
                          })}
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="py-1.5 px-2 font-medium text-slate-700">Annual Cost</td>
                          {STRATEGIES.map(s => (
                            <td key={s.name} className="text-center px-2 text-slate-600">{s.annualCost}</td>
                          ))}
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="py-1.5 px-2 font-medium text-slate-700">Best For</td>
                          {STRATEGIES.map(s => (
                            <td key={s.name} className="text-center px-2 text-xs text-slate-500">{s.bestFor}</td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Strategy Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {STRATEGIES.map(s => (
                  <Card key={s.name} className="border-l-4" style={{ borderLeftColor: s.color }}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{s.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-slate-600 mb-2">{s.description}</p>
                      <div className="text-xs text-slate-500">
                        <strong>Products:</strong> {s.products.join(', ')}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* ═══ PANEL 11: SUMMARY ═══ */}
          {activePanel === 'summary' && (
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-600" /> Executive Summary
              </h2>
              <p className="text-sm text-slate-500 mb-4">Complete financial snapshot for {clientName || 'Client'}.</p>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <ResultBadge label="Health Score" value={`${scorecard.pctScore}%`} variant={scorecard.pctScore >= 80 ? 'grn' : scorecard.pctScore >= 60 ? 'gld' : 'red'} />
                <ResultBadge label="Save Rate" value={pct(cfResult.saveRate)} variant={cfResult.saveRate >= 0.2 ? 'grn' : 'gld'} />
                <ResultBadge label="Protection Gap" value={fmtSm(prResult.gap)} variant={prResult.gap === 0 ? 'grn' : 'red'} />
                <ResultBadge label="Retire Income" value={fmt(rtResult.monthlyIncome) + '/mo'} variant="grn" />
              </div>

              {/* Summary Table */}
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Financial Summary</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Domain</th>
                        <th className="text-center py-2 px-2 text-xs font-semibold text-slate-500">Score</th>
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Key Finding</th>
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Recommendation</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 px-2 font-medium">Cash Flow</td>
                        <td className="text-center px-2"><ScoreBadge score={scores.cash} /></td>
                        <td className="px-2 text-xs text-slate-600">Save rate {pct(cfResult.saveRate)}, DTI {pct(cfResult.dti)}</td>
                        <td className="px-2 text-xs text-slate-500">{cfResult.saveRate < 0.15 ? 'Increase savings to 15%+' : 'On track'}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 px-2 font-medium">Protection</td>
                        <td className="text-center px-2"><ScoreBadge score={scores.protect} /></td>
                        <td className="px-2 text-xs text-slate-600">DIME gap {fmtSm(prResult.gap)}</td>
                        <td className="px-2 text-xs text-slate-500">{prResult.gap > 0 ? `Add ${fmtSm(prResult.gap)} coverage` : 'Fully covered'}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 px-2 font-medium">Growth</td>
                        <td className="text-center px-2"><ScoreBadge score={scores.growth} /></td>
                        <td className="px-2 text-xs text-slate-600">Tax-free edge {fmtSm(grResult.taxEdge)}</td>
                        <td className="px-2 text-xs text-slate-500">Consider IUL/Roth for tax-free growth</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 px-2 font-medium">Retirement</td>
                        <td className="text-center px-2"><ScoreBadge score={scores.retire} /></td>
                        <td className="px-2 text-xs text-slate-600">Best SS at {rtResult.bestAge}, {fmt(rtResult.monthlyIncome)}/mo</td>
                        <td className="px-2 text-xs text-slate-500">Delay SS to {rtResult.bestAge} for max benefit</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 px-2 font-medium">Tax</td>
                        <td className="text-center px-2"><ScoreBadge score={scores.tax} /></td>
                        <td className="px-2 text-xs text-slate-600">Eff rate {pct(txResult.effectiveRate)}, saving {fmtSm(txResult.totalSaving)}/yr</td>
                        <td className="px-2 text-xs text-slate-500">Maximize HSA + 401(k) + Roth</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 px-2 font-medium">Estate</td>
                        <td className="text-center px-2"><ScoreBadge score={scores.estate} /></td>
                        <td className="px-2 text-xs text-slate-600">Tax {fmtSm(esResult.estateTax)}, ILIT saves {fmtSm(esResult.ilitSaving)}</td>
                        <td className="px-2 text-xs text-slate-500">{willStatus === 'none' ? 'Create estate documents' : 'Review annually'}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 px-2 font-medium">Education</td>
                        <td className="text-center px-2"><ScoreBadge score={scores.edu} /></td>
                        <td className="px-2 text-xs text-slate-600">529 gap {fmtSm(edResult.totalGap)}</td>
                        <td className="px-2 text-xs text-slate-500">{edResult.totalGap > 0 ? `Increase 529 by ${fmt(edResult.additionalMonthlyNeeded)}/mo` : 'On track'}</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Total Investment Summary */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Total Investment Summary</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-red-50 rounded-lg p-3">
                      <div className="text-xs font-bold text-red-500 uppercase">Annual Cost</div>
                      <div className="text-xl font-extrabold text-red-700">{fmt(totalAnnualPremium)}</div>
                      <div className="text-xs text-slate-500">{fmt(Math.round(totalAnnualPremium / 12))}/mo</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3">
                      <div className="text-xs font-bold text-green-500 uppercase">Products</div>
                      <div className="text-xl font-extrabold text-green-700">{recommendations.length}</div>
                      <div className="text-xs text-slate-500">recommended</div>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3">
                      <div className="text-xs font-bold text-amber-500 uppercase">% of Income</div>
                      <div className="text-xl font-extrabold text-amber-700">{pct(totalIncome > 0 ? totalAnnualPremium / totalIncome : 0)}</div>
                      <div className="text-xs text-slate-500">target &lt; 15%</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          )}

          {/* ═══ PANEL 12: ACTION PLAN ═══ */}
          {activePanel === 'timeline' && (
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-amber-600" /> 12-Month Action Plan
              </h2>
              <p className="text-sm text-slate-500 mb-4">Prioritized implementation timeline with pace options.</p>

              {/* Pace Selector */}
              <Card className="mb-4">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-700">Implementation Pace:</span>
                    {(['standard', 'aggressive', 'gradual'] as const).map(p => (
                      <Button key={p} size="sm" variant={pace === p ? 'default' : 'outline'}
                        className="h-7 px-3 text-xs capitalize"
                        onClick={() => setPace(p)}>
                        {p === 'standard' ? 'Standard (12mo)' : p === 'aggressive' ? 'Aggressive (6mo)' : 'Gradual (18mo)'}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Action Timeline */}
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Implementation Timeline — {pace.charAt(0).toUpperCase() + pace.slice(1)} Pace</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Phase</th>
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Timeline</th>
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Actions</th>
                        <th className="text-center py-2 px-2 text-xs font-semibold text-slate-500">Priority</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buildActionPlan(pace, recommendations, scores, prResult, cfResult, edResult).map((phase, i) => (
                        <tr key={i} className="border-b border-slate-100 align-top">
                          <td className="py-2 px-2 font-medium text-slate-700">{phase.name}</td>
                          <td className="py-2 px-2 text-slate-600 whitespace-nowrap">{phase.timeline}</td>
                          <td className="py-2 px-2">
                            <ul className="space-y-1">
                              {phase.actions.map((a, j) => (
                                <li key={j} className="text-xs text-slate-600 flex items-start gap-1">
                                  <span className="text-amber-500 mt-0.5">•</span> {a}
                                </li>
                              ))}
                            </ul>
                          </td>
                          <td className="text-center py-2 px-2">
                            <Badge variant={phase.priority === 'Critical' ? 'destructive' : phase.priority === 'High' ? 'default' : 'secondary'}
                              className="text-[10px]">{phase.priority}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Next Steps */}
              <div className="bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200 rounded-xl p-4">
                <h3 className="text-sm font-bold text-amber-800 mb-2">Immediate Next Steps</h3>
                <ol className="space-y-1 text-xs text-amber-700">
                  <li>1. Schedule follow-up meeting within 7 days to finalize product selection</li>
                  <li>2. Gather medical records for underwriting (if life/DI insurance recommended)</li>
                  <li>3. Review beneficiary designations on all existing accounts</li>
                  <li>4. Set up automatic savings transfers for recommended monthly contributions</li>
                  <li>5. Schedule estate attorney consultation (if estate documents needed)</li>
                </ol>
              </div>
            </section>
          )}

          {/* ═══ PANEL 13: REFERENCES ═══ */}
          {activePanel === 'refs' && (
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-600" /> References & Due Diligence
              </h2>
              <p className="text-sm text-slate-500 mb-4">Calculation methodology, data sources, and compliance checklist.</p>

              {/* Calculation Methods */}
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Calculation Methods</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Domain</th>
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Method</th>
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CALC_METHODS.map((m, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="py-1.5 px-2 font-medium text-slate-700">{m.domain}</td>
                          <td className="px-2 text-slate-600">{m.method}</td>
                          <td className="px-2 text-xs text-slate-500">{m.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Due Diligence Checklist */}
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Due Diligence Checklist</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-center py-2 px-2 text-xs font-semibold text-slate-500">#</th>
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Item</th>
                        <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {DUE_DILIGENCE.map((item, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="text-center py-1.5 px-2 text-slate-400">{i + 1}</td>
                          <td className="py-1.5 px-2 text-slate-700">{item.text}</td>
                          <td className="px-2"><Badge variant="secondary" className="text-[10px]">{item.category}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Data Sources */}
              <Card className="mb-4">
                <CardHeader className="pb-2"><CardTitle className="text-base">Data Sources</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-1 text-xs text-slate-600">
                    <li>• <strong>Tax Brackets:</strong> IRS Revenue Procedure 2024-40 (2024 brackets, standard deductions)</li>
                    <li>• <strong>Social Security:</strong> SSA 2024 COLA adjustment, PIA bend points, claiming age factors</li>
                    <li>• <strong>Life Insurance:</strong> LIMRA 2024 U.S. Life Insurance Survey, SOA mortality tables</li>
                    <li>• <strong>Investment Returns:</strong> Morningstar 2024 long-term capital market assumptions</li>
                    <li>• <strong>Inflation:</strong> BLS CPI-U 12-month average, Federal Reserve 2% target</li>
                    <li>• <strong>Estate Tax:</strong> IRC §2010 unified credit, 2024 exemption $13.61M</li>
                    <li>• <strong>Education Costs:</strong> College Board Trends in College Pricing 2024</li>
                    <li>• <strong>Disability Statistics:</strong> Council for Disability Awareness 2024</li>
                    <li>• <strong>LTC Costs:</strong> Genworth Cost of Care Survey 2024</li>
                    <li>• <strong>Withdrawal Rates:</strong> Trinity Study (Cooley, Hubbard, Walz), Bengen 4% Rule</li>
                  </ul>
                </CardContent>
              </Card>

              {/* Disclaimer */}
              <div className="bg-slate-100 border border-slate-200 rounded-lg p-4 text-xs text-slate-500">
                <p className="font-bold text-slate-600 mb-1">Important Disclosures</p>
                <p>
                  This analysis is for educational and illustrative purposes only. It does not constitute financial, tax, legal, or investment advice.
                  All projections are hypothetical and based on assumptions that may not reflect actual market conditions.
                  Past performance does not guarantee future results. Consult with qualified professionals before making financial decisions.
                  Insurance products are subject to underwriting approval. Premium estimates are illustrative and may vary by carrier, health class, and state.
                  Tax information is based on current law and may change. Individual results will vary.
                </p>
              </div>
            </section>
          )}

        </div>
      </main>
    </div>
  );
}
