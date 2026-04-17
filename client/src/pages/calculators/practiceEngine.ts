/* ═══════════════════════════════════════════════════════════════
   WealthBridge Business Income Engine (BIE) — Practice Planning
   Ported from WealthBridge-Business-Calculator-v7
   ═══════════════════════════════════════════════════════════════ */

import { fmt, fmtSm, pct } from './format';

/* ═══ PRODUCTS ═══ */
export interface Product {
  id: string; n: string; gdc: number; s: 'core' | 'exp';
  fyc: number; wb: string; wbRate: number; best: string; bestRate: number;
  ind: string; renew: string; src: string;
}

export const PRODUCTS: Product[] = [
  {id:'term',n:'Term Life (20yr)',gdc:500,s:'core',fyc:80,wb:'NLG LSW Term',wbRate:80,best:'Lincoln 20-30yr',bestRate:90,ind:'65–90',renew:'0',src:'TBA 2025 Commission Schedule'},
  {id:'iul',n:'IUL',gdc:3000,s:'core',fyc:80,wb:'NLG FlexLife / SummitLife',wbRate:80,best:'Allianz Pro+ Advantage',bestRate:95,ind:'75–95',renew:'3–5',src:'TBA 2025 Commission Schedule'},
  {id:'rapid',n:'RapidProtect IUL',gdc:1600,s:'core',fyc:80,wb:'NLG RapidProtect',wbRate:80,best:'Allianz Pro+',bestRate:95,ind:'75–95',renew:'3–5',src:'NLG Product Guide 2025'},
  {id:'wl',n:'Whole Life',gdc:1800,s:'core',fyc:80,wb:'NLG Total Secure',wbRate:80,best:'NLG Total Secure',bestRate:80,ind:'55–80',renew:'3–5',src:'TBA 2025 Commission Schedule'},
  {id:'wl_mm',n:'WL (MassMutual)',gdc:1800,s:'core',fyc:55,wb:'MassMutual Legacy 100',wbRate:55,best:'NLG Total Secure',bestRate:80,ind:'55–80',renew:'3–5 + dividends',src:'TBA 2025; MM mutual dividends offset lower FYC'},
  {id:'fia',n:'FIA',gdc:3500,s:'core',fyc:7,wb:'NLG/Athene FIA',wbRate:7,best:'Equitrust tiered',bestRate:8,ind:'3–8',renew:'Trail 0.25–0.50',src:'Sonant AI 2026; % of premium not FYC'},
  {id:'va',n:'Variable Annuity',gdc:4000,s:'core',fyc:5,wb:'ESI/Carrier VA',wbRate:5,best:'Top-tier VA',bestRate:7,ind:'4–7',renew:'Trail 0.25–1.0',src:'Sonant AI 2026; % of premium'},
  {id:'pf',n:'Premium Finance',gdc:40000,s:'core',fyc:80,wb:'NLG IUL (financed)',wbRate:80,best:'Allianz Pro+',bestRate:95,ind:'75–95',renew:'Varies',src:'Same as IUL FYC; premium 10–50x larger'},
  {id:'exec',n:'Exec Benefits',gdc:8000,s:'core',fyc:80,wb:'NLG IUL/WL (exec)',wbRate:80,best:'Carrier-dependent',bestRate:95,ind:'55–95',renew:'3–5',src:'Exec comp uses same product FYC rates'},
  {id:'group',n:'Group Benefits',gdc:800,s:'core',fyc:15,wb:'Guardian/NLG Group',wbRate:15,best:'Top group carrier',bestRate:20,ind:'10–20',renew:'5–10',src:'Sonant AI 2026; % of annual premium'},
  {id:'sec',n:'Advisory/AUM',gdc:2000,s:'core',fyc:100,wb:'ESI Financial',wbRate:100,best:'Independent RIA',bestRate:100,ind:'35–100',renew:'Ongoing AUM fee',src:'SmartAsset 2025; payout = % of advisory fee kept'},
  {id:'pc',n:'P&C',gdc:400,s:'exp',fyc:15,wb:'P&C Partner',wbRate:15,best:'Captive P&C',bestRate:20,ind:'10–20',renew:'10–15',src:'Sonant AI 2026; new + renewal'},
  {id:'med',n:'Medicare',gdc:694,s:'exp',fyc:100,wb:'Medicare Partner',wbRate:100,best:'FMO direct',bestRate:100,ind:'$600–$900 flat',renew:'$300–$400/yr',src:'CMS max initial $694 (2025); flat per enrollment'},
  {id:'ethos',n:'GFI/Ethos',gdc:500,s:'exp',fyc:70,wb:'Ethos/GFI simplified',wbRate:70,best:'Direct carrier',bestRate:80,ind:'50–80',renew:'0–3',src:'Simplified issue; lower face amounts'},
  {id:'di',n:'DI',gdc:1500,s:'exp',fyc:55,wb:'Guardian DI',wbRate:55,best:'Principal DI',bestRate:60,ind:'40–60',renew:'5–10',src:'TBA 2025; Guardian industry-leading DI product'},
  {id:'ltc',n:'Hybrid LTC',gdc:5000,s:'exp',fyc:8,wb:'Lincoln MoneyGuard',wbRate:8,best:'John Hancock hybrid',bestRate:10,ind:'6–10',renew:'0',src:'TBA 2025; % of single premium (large cases)'},
];

/* ═══ GDC BRACKETS ═══ */
export interface GDCBracket { mn: number; mx: number; r: number; l: string; }
export const GDC_BRACKETS: GDCBracket[] = [
  {mn:0,mx:64999,r:.55,l:'<$65K'},
  {mn:65000,mx:94999,r:.65,l:'$65–95K'},
  {mn:95000,mx:149999,r:.70,l:'$95–150K'},
  {mn:150000,mx:199999,r:.75,l:'$150–200K'},
  {mn:200000,mx:239999,r:.80,l:'$200–240K'},
  {mn:240000,mx:274999,r:.825,l:'$240–275K'},
  {mn:275000,mx:299999,r:.84,l:'$275–300K'},
  {mn:300000,mx:9000000,r:.85,l:'$300K+'},
];

export function getBracket(gdc: number): GDCBracket {
  for (const b of GDC_BRACKETS) {
    if (gdc >= b.mn && gdc <= b.mx) return b;
  }
  return GDC_BRACKETS[GDC_BRACKETS.length - 1];
}

/* ═══ CHANNELS ═══ */
export interface Channel {
  id: string; n: string; cpl: number; cv: number; rev: number;
  ltv: number; attr: number; segs: string; def: number;
}
export const CHANNELS: Channel[] = [
  {id:'ref',n:'Referral Program',cpl:50,cv:.25,rev:30000,ltv:273342,attr:.60,segs:'All 10',def:100},
  {id:'web',n:'Webinars',cpl:90,cv:.12,rev:12500,ltv:83678,attr:.85,segs:'Res,Com,CPA,HR',def:75},
  {id:'rnd',n:'Roundtable Events',cpl:120,cv:.15,rev:30000,ltv:212439,attr:.70,segs:'Res,Com',def:75},
  {id:'dig',n:'Digital (Meta+Google)',cpl:85,cv:.08,rev:15000,ltv:89123,attr:.95,segs:'Res,Com',def:150},
  {id:'com',n:'Community Events',cpl:75,cv:.10,rev:10000,ltv:53189,attr:.80,segs:'Res,Nonprof',def:100},
  {id:'cpa',n:'CPA/Attorney Partners',cpl:180,cv:.20,rev:30000,ltv:240318,attr:.40,segs:'CPA,Estate Atty',def:50},
  {id:'ptr',n:'Basic Partnerships',cpl:150,cv:.12,rev:20000,ltv:136381,attr:.45,segs:'Affiliates,CPA',def:50},
  {id:'li',n:'LinkedIn B2B',cpl:130,cv:.10,rev:35000,ltv:280000,attr:.50,segs:'Com,CPA,Atty,HR',def:100},
  {id:'eml',n:'Email Drip Campaigns',cpl:8,cv:.15,rev:12000,ltv:95000,attr:.90,segs:'All — nurture',def:50},
  {id:'sms',n:'SMS/Text Campaigns',cpl:12,cv:.18,rev:10000,ltv:78000,attr:.92,segs:'All — re-engage',def:30},
  {id:'ems',n:'Email+SMS Combined',cpl:15,cv:.22,rev:14000,ltv:115000,attr:.90,segs:'All — compound',def:0},
  {id:'dm',n:'Direct Mail / Print',cpl:250,cv:.06,rev:25000,ltv:180000,attr:.30,segs:'HNW, Retirees',def:0},
];

/* ═══ HIERARCHY ═══ */
export type RoleId = 'new' | 'exp' | 'sa' | 'dir' | 'md' | 'rvp';
export const HIER_ORDER: RoleId[] = ['new','exp','sa','dir','md','rvp'];
export const HIER_NAMES: Record<RoleId, string> = {
  new:'New Associate', exp:'Experienced Professional', sa:'Senior Associate',
  dir:'Director', md:'Managing Director', rvp:'Regional Vice President',
};
export const HIER_SHORT: Record<RoleId, string> = {
  new:'New Assoc', exp:'Exp Pro', sa:'Sr Assoc', dir:'Director', md:'MD', rvp:'RVP',
};
export const HIER_DOWN: Record<RoleId, RoleId[]> = {
  rvp:['md'], md:['dir'], dir:['sa'], sa:['new','exp'], new:[], exp:[],
};
export const HIER_UP: Record<RoleId, RoleId[]> = {
  new:['sa','dir','md','rvp'], exp:['sa','dir','md','rvp'],
  sa:['dir','md','rvp'], dir:['md','rvp'], md:['rvp'], rvp:[],
};

/* ═══ ROLE DEFAULTS ═══ */
export interface RoleDefaults {
  p: number; wb: number; mo: number; ap: number; sh: number; cl: number; pl: number;
  mix: Record<string, number>;
  /* Unified income channel splits (%) — must sum to 100 */
  incomeSplits: { gdc: number; aum: number; affiliate: number; override: number; channel: number };
  /* Default target income for role */
  defaultTargetIncome: number;
  /* Default AUM book size for role */
  defaultAUM: number;
  /* Default affiliate counts per type */
  defaultAffiliates: { a: number; b: number; c: number; d: number };
  /* Default avg affiliate production per type */
  defaultAffProd: { a: number; b: number; c: number; d: number };
}
export const ROLE_DEFAULTS: Record<string, RoleDefaults> = {
  new: {p:1,wb:70,mo:10,ap:.15,sh:.75,cl:.30,pl:.80,mix:{term:30,iul:20,rapid:15,wl:10,fia:10,group:15},
    incomeSplits:{gdc:80,aum:10,affiliate:5,override:0,channel:5},defaultTargetIncome:75000,defaultAUM:0,
    defaultAffiliates:{a:0,b:1,c:0,d:0},defaultAffProd:{a:0,b:5000,c:0,d:0}},
  exp: {p:1,wb:60,mo:11,ap:.20,sh:.85,cl:.45,pl:.85,mix:{iul:30,fia:20,wl:15,term:10,pf:5,exec:10,group:10},
    incomeSplits:{gdc:55,aum:20,affiliate:10,override:10,channel:5},defaultTargetIncome:150000,defaultAUM:5000000,
    defaultAffiliates:{a:1,b:2,c:1,d:0},defaultAffProd:{a:8000,b:6000,c:10000,d:0}},
  sa:  {p:1,wb:65,mo:11,ap:.18,sh:.82,cl:.40,pl:.83,mix:{iul:28,fia:18,wl:12,term:12,rapid:10,group:12,exec:8},
    incomeSplits:{gdc:50,aum:20,affiliate:10,override:15,channel:5},defaultTargetIncome:200000,defaultAUM:8000000,
    defaultAffiliates:{a:2,b:3,c:1,d:1},defaultAffProd:{a:10000,b:8000,c:12000,d:15000}},
  dir: {p:1,wb:60,mo:12,ap:.22,sh:.85,cl:.45,pl:.85,mix:{iul:30,fia:20,wl:15,pf:8,exec:12,group:15},
    incomeSplits:{gdc:35,aum:25,affiliate:10,override:25,channel:5},defaultTargetIncome:350000,defaultAUM:15000000,
    defaultAffiliates:{a:3,b:4,c:2,d:2},defaultAffProd:{a:12000,b:10000,c:15000,d:20000}},
  md:  {p:1,wb:60,mo:12,ap:.22,sh:.85,cl:.45,pl:.85,mix:{iul:30,fia:20,wl:15,pf:8,exec:12,group:15},
    incomeSplits:{gdc:25,aum:30,affiliate:10,override:30,channel:5},defaultTargetIncome:500000,defaultAUM:25000000,
    defaultAffiliates:{a:5,b:6,c:3,d:3},defaultAffProd:{a:15000,b:12000,c:18000,d:25000}},
  rvp: {p:1,wb:50,mo:12,ap:.25,sh:.90,cl:.50,pl:.85,mix:{iul:25,fia:20,pf:15,exec:20,wl:10,group:10},
    incomeSplits:{gdc:15,aum:30,affiliate:10,override:40,channel:5},defaultTargetIncome:750000,defaultAUM:50000000,
    defaultAffiliates:{a:8,b:10,c:5,d:5},defaultAffProd:{a:20000,b:15000,c:25000,d:35000}},
};

/* ═══ RECRUITING DEFAULTS ═══ */
export interface RecruitDefaults {
  i: number; v: number; o: number; a: number; p: number;
  f: number; bk: number; ramp: number; rP: number;
}
export const RECRUIT_DEFAULTS: Record<string, RecruitDefaults> = {
  newAssoc: {i:20,v:50,o:40,a:60,p:70,f:65000,bk:0,ramp:6,rP:30},
  expPro:   {i:12,v:40,o:50,a:50,p:85,f:150000,bk:5000000,ramp:3,rP:50},
  affiliate:{i:25,v:60,o:50,a:70,p:80,f:50000,bk:0,ramp:2,rP:60},
  md:       {i:8,v:35,o:45,a:55,p:90,f:200000,bk:2000000,ramp:4,rP:40},
};

export const RECRUIT_LABELS: Record<string, string> = {
  newAssoc:'New Associates', expPro:'Exp Professionals', affiliate:'Affiliates', md:'Managing Directors',
};

/* ═══ RECRUITING SOURCES ═══ */
export interface RecruitSource {
  label: string; closeRate: number; cpa: number; yr1Ret: number; yr2Ret: number; note: string;
}
export const RECRUIT_SOURCES: Record<string, RecruitSource> = {
  inbound:  {label:'Inbound (Referral/COI/Warm)',closeRate:.25,cpa:100,yr1Ret:.78,yr2Ret:.55,note:'Agent referral, warm market, COI intros. Highest quality, lowest cost.'},
  outbound: {label:'Outbound (Recruiter/Cold)',closeRate:.05,cpa:1500,yr1Ret:.50,yr2Ret:.30,note:'LinkedIn recruiter, career fairs, cold outreach. Higher volume, lower retention.'},
  digital:  {label:'Digital (Indeed/Social/Ads)',closeRate:.04,cpa:200,yr1Ret:.45,yr2Ret:.25,note:'Job boards, social media ads, Indeed/ZipRecruiter. High volume, variable quality.'},
  campus:   {label:'Campus/Internship Pipeline',closeRate:.12,cpa:800,yr1Ret:.55,yr2Ret:.35,note:'University recruiting, internship-to-hire. Good for new associates.'},
  poach:    {label:'Industry Poach (Experienced)',closeRate:.18,cpa:2000,yr1Ret:.65,yr2Ret:.45,note:'Recruiting from competitors. High cost but brings book of business.'},
};

/* ═══ TEAM MEMBER ═══ */
export interface TeamMember { n: string; f: number; role: RoleId; }

/* ═══ RECRUIT TRACK ═══ */
export interface RecruitTrack {
  type: string; n: number; i: number; vw: number; o: number; a: number; p: number;
  f: number; bk: number; ramp: number; rP: number; startMo: number;
  src: Record<string, number>;
}

/* ═══ CALCULATION FUNCTIONS ═══ */

/** Compute weighted average GDC per case from product mix */
export function calcWeightedGDC(mix: Record<string, number>, products: Product[]): number {
  let total = 0;
  for (const [pid, pct] of Object.entries(mix)) {
    const prod = products.find(p => p.id === pid);
    if (prod && pct > 0) total += (pct / 100) * prod.gdc;
  }
  return Math.round(total);
}

/** Calculate production funnel from target GDC */
export function calcProductionFunnel(
  targetGDC: number, wbPct: number, bracketOverride: string,
  avgGDC: number, ap: number, sh: number, cl: number, pl: number, months: number
) {
  const wbTarget = Math.round(targetGDC * (wbPct / 100));
  const expTarget = Math.round(targetGDC * (1 - wbPct / 100));

  let bracketRate: number;
  let gdcNeeded: number;
  if (bracketOverride !== 'auto') {
    bracketRate = parseFloat(bracketOverride) / 100;
    gdcNeeded = bracketRate > 0 ? Math.round(wbTarget / bracketRate) : 0;
  } else {
    const b1 = getBracket(Math.round(wbTarget / 0.6));
    gdcNeeded = b1.r > 0 ? Math.round(wbTarget / b1.r) : 0;
    const b2 = getBracket(gdcNeeded);
    gdcNeeded = Math.round(wbTarget / b2.r);
    bracketRate = b2.r;
  }

  const placed = avgGDC > 0 ? Math.round(gdcNeeded / avgGDC) : 0;
  const apps = pl > 0 ? Math.round(placed / pl) : 0;
  const held = cl > 0 ? Math.round(apps / cl) : 0;
  const set = sh > 0 ? Math.round(held / sh) : 0;
  const approaches = ap > 0 ? Math.round(set / ap) : 0;
  const monthlyApproaches = months > 0 ? Math.round(approaches / months) : 0;
  const dailyApproaches = Math.round(monthlyApproaches / 21.5);
  const monthlyApps = months > 0 ? Math.round(apps / months) : 0;
  const monthlyGDC = months > 0 ? Math.round(gdcNeeded / months) : 0;

  return {
    wbTarget, expTarget, gdcNeeded, bracketRate,
    placed, apps, held, set, approaches,
    dailyApproaches, monthlyApproaches, monthlyApps, monthlyGDC,
  };
}

/** Calculate team override */
export function calcTeamOverride(
  teamMembers: TeamMember[], overrideRate: number, bonusRate: number, gen2Rate: number
) {
  let totalFYC = 0;
  teamMembers.forEach(m => { totalFYC += m.f; });
  const rate = overrideRate + bonusRate;
  const gen1 = Math.round(totalFYC * rate);
  const gen2FYC = Math.round(totalFYC * 0.7 * 2);
  const gen2 = Math.round(gen2FYC * gen2Rate);
  return { totalFYC, gen1, gen2, total: gen1 + gen2, rate, memberCount: teamMembers.length };
}

/** Blend recruiting sources */
export function blendSources(mix: Record<string, number>): RecruitSource {
  let tw = 0;
  const r: RecruitSource = { yr1Ret: 0, yr2Ret: 0, closeRate: 0, cpa: 0, label: '', note: '' };
  const labels: string[] = [];
  for (const [k, w] of Object.entries(mix)) {
    if (w > 0 && RECRUIT_SOURCES[k]) {
      tw += w;
      const s = RECRUIT_SOURCES[k];
      r.yr1Ret += s.yr1Ret * w;
      r.yr2Ret += s.yr2Ret * w;
      r.closeRate += s.closeRate * w;
      r.cpa += s.cpa * w;
      labels.push(s.label.split('(')[0].trim() + ' ' + w + '%');
    }
  }
  if (tw > 0) {
    r.yr1Ret /= tw; r.yr2Ret /= tw; r.closeRate /= tw; r.cpa = Math.round(r.cpa / tw);
  }
  r.label = labels.join(' + ');
  r.note = `Blended from ${labels.length} source channels (weighted average).`;
  return r;
}

/** Calculate recruiting track funnel */
export function calcTrackFunnel(track: RecruitTrack) {
  const d = RECRUIT_DEFAULTS[track.type] || RECRUIT_DEFAULTS.newAssoc;
  const prod = track.n;
  const acc = Math.round(prod / ((track.p || d.p) / 100));
  const off = Math.round(acc / ((track.a || d.a) / 100));
  const intv = Math.round(off / ((track.o || d.o) / 100));
  const intr = Math.round(intv / ((track.vw || d.v) / 100));
  const cont = Math.round(intr / ((track.i || d.i) / 100));
  const yld = cont > 0 ? (prod / cont * 100).toFixed(1) : '0';
  return { prod, acc, off, intv, intr, cont, yld };
}

/** Calculate all recruiting tracks summary */
export function calcAllTracksSummary(tracks: RecruitTrack[], overrideRate: number) {
  let tHires = 0, tContact = 0, tFYC = 0, tOvr = 0, tBooks = 0;
  const details: { type: string; n: number; f: number; ramp: number; rP: number; startMo: number;
    adjFYC: number; trackFYC: number; trackOvr: number; srcBlend: RecruitSource; }[] = [];

  tracks.forEach(t => {
    const d = RECRUIT_DEFAULTS[t.type] || RECRUIT_DEFAULTS.newAssoc;
    const funnel = calcTrackFunnel(t);
    const rampMo = t.ramp || d.ramp;
    const rampPct = (t.rP || d.rP) / 100;
    const fullMo = Math.max(0, 12 - rampMo);
    const adjFYC = Math.round(t.f / 12 * rampMo * rampPct + t.f / 12 * fullMo);
    const trackFYC = t.n * adjFYC;
    const trackOvr = Math.round(trackFYC * overrideRate);
    const trackBooks = t.n * (t.bk || 0);
    const srcBlend = blendSources(t.src);

    tHires += t.n; tContact += funnel.cont; tFYC += trackFYC; tOvr += trackOvr; tBooks += trackBooks;
    details.push({ type: t.type, n: t.n, f: t.f, ramp: rampMo, rP: rampPct, startMo: t.startMo || 1,
      adjFYC, trackFYC, trackOvr, srcBlend });
  });

  // Year 2 (no ramp)
  let yr2FYC = 0;
  details.forEach(d => { yr2FYC += d.n * d.f; });
  const yr2Ovr = Math.round(yr2FYC * overrideRate);
  const recOpEx = Math.round(tHires * 2000); // ~$2K direct recruiting cost per hire
  const recEBITDA = tOvr - recOpEx;
  // ARR: ~15% of team FYC as renewal income + ~1% trail on transferred books
  const recARR = Math.round(tFYC * 0.15 + tBooks * 0.01);

  return { tHires, tContact, tFYC, tOvr, tBooks, yr2FYC, yr2Ovr, recOpEx, recEBITDA, recARR, details };
}

/** Calculate channel metrics */
export function calcChannelMetrics(channelSpend: Record<string, number>, ltvYears = 5, retentionPct = 0.85) {
  let tSpend = 0, tLeads = 0, tClients = 0, tRevMo = 0;
  const channelResults: { id: string; name: string; spend: number; annLeads: number; annClients: number; annRev: number; roi: number }[] = [];

  CHANNELS.forEach(c => {
    const sp = channelSpend[c.id] || 0;
    if (sp <= 0) return;
    const annSp = sp * 12;
    const annL = Math.round(annSp / c.cpl);
    const annC = Math.round(annL * c.cv);
    const annRv = annC * c.rev;
    const roi = annSp > 0 ? Math.round((annRv - annSp) / annSp * 100) : 0;
    tSpend += sp; tLeads += annL; tClients += annC; tRevMo += annRv / 12;
    channelResults.push({ id: c.id, name: c.n, spend: sp, annLeads: annL, annClients: annC, annRev: annRv, roi });
  });

  const cac = tClients > 0 ? Math.round(tSpend * 12 / tClients) : 0;
  const avgRevClient = tClients > 0 ? Math.round(tRevMo / tClients * 12) : 0;
  const ltv = Math.round(avgRevClient * ltvYears * retentionPct);
  const ltvCac = cac > 0 ? parseFloat((ltv / cac).toFixed(1)) : 0;
  const annualRev = Math.round(tRevMo * 12);
  const annualSpend = tSpend * 12;
  const arr = Math.round(annualRev * retentionPct);
  const margin = annualRev > 0 ? Math.round((annualRev - annualSpend) / annualRev * 100) : 0;
  const roiPct = annualSpend > 0 ? Math.round((annualRev - annualSpend) / annualSpend * 100) : 0;

  return {
    tSpend, tLeads, tClients, tRevMo, channelResults,
    cac, avgRevClient, ltv, ltvCac, annualRev, annualSpend, arr, margin, roiPct,
  };
}

/** Calculate P&L */
export function calcPnL(
  level: 'ind' | 'team', numProducers: number, avgGDC: number,
  payoutRate: number, opEx: number, taxRate: number,
  ebitGoal?: number, netGoal?: number
) {
  const safeProducers = Math.max(1, numProducers); // guard: prevent division by zero
  let g = avgGDC;
  if (netGoal && netGoal > 0) {
    const effPayout = Math.min(payoutRate, 0.99); // guard: prevent division by zero
    const revNeeded = Math.round(netGoal / (1 - taxRate)) + opEx + Math.round(netGoal / (1 - taxRate) * effPayout / (1 - effPayout));
    g = level === 'ind' ? revNeeded : Math.round(revNeeded / safeProducers);
  } else if (ebitGoal && ebitGoal > 0) {
    const effPayout2 = Math.min(payoutRate, 0.99);
    const revNeeded = Math.round((ebitGoal + opEx) / (1 - effPayout2));
    g = level === 'ind' ? revNeeded : Math.round(revNeeded / safeProducers);
  }

  const rev = level === 'ind' ? g : numProducers * g;
  const cogs = Math.round(rev * payoutRate);
  const gm = rev - cogs;
  const actualOpEx = level === 'ind' ? opEx : Math.round(opEx * Math.sqrt(numProducers));
  const ebit = gm - actualOpEx;
  const tax = Math.round(Math.max(0, ebit) * taxRate);
  const ni = ebit - tax;

  return {
    revenue: rev, cogs, grossMargin: gm,
    gmPct: rev > 0 ? Math.round(gm / rev * 100) : 0,
    opEx: actualOpEx, ebitda: ebit,
    marginPct: rev > 0 ? Math.round(ebit / rev * 100) : 0,
    tax, netIncome: ni, avgGDC: g,
    backPlanned: !!((ebitGoal && ebitGoal > 0) || (netGoal && netGoal > 0)),
  };
}

/** Calculate multi-stream roll-up */
export function calcRollUp(params: {
  role: RoleId;
  hasPersonal: boolean;
  wbTarget: number;
  expTarget: number;
  overrideIncome: number;
  overrideRate: number;
  aumIncome: number;
  affAIncome: number;
  affBIncome: number;
  affCIncome: number;
  affDIncome: number;
  channelRevAnnual: number;
  streams: Record<string, boolean>;
}) {
  const { role, hasPersonal, wbTarget, expTarget, overrideIncome, aumIncome,
    affAIncome, affBIncome, affCIncome, affDIncome, channelRevAnnual, streams } = params;

  let gt = 0;
  const items: { name: string; value: number; source: string }[] = [];

  if (streams.personal && hasPersonal && wbTarget > 0) {
    gt += wbTarget;
    items.push({ name: 'Personal WB Core', value: wbTarget, source: 'Personal production' });
  }
  if (streams.expanded && hasPersonal && expTarget > 0) {
    gt += expTarget;
    items.push({ name: 'Expanded Platform', value: expTarget, source: 'P&C, Medicare, GFI, DI, LTC' });
  }
  if (streams.aum && aumIncome > 0) {
    gt += aumIncome;
    items.push({ name: 'AUM / Advisory Trail', value: aumIncome, source: 'ESI advisory trail' });
  }
  if (streams.override && overrideIncome > 0) {
    gt += overrideIncome;
    items.push({ name: 'Team Override', value: overrideIncome, source: 'Team override income' });
  }
  if (streams.affA && affAIncome > 0) {
    gt += affAIncome;
    items.push({ name: 'Affiliate Track A', value: affAIncome, source: 'Fee-based intros' });
  }
  if (streams.affB && affBIncome > 0) {
    gt += affBIncome;
    items.push({ name: 'Affiliate Track B', value: affBIncome, source: 'Referral commission' });
  }
  if (streams.affC && affCIncome > 0) {
    gt += affCIncome;
    items.push({ name: 'Affiliate Track C', value: affCIncome, source: 'Co-broker split' });
  }
  if (streams.affD && affDIncome > 0) {
    gt += affDIncome;
    items.push({ name: 'Affiliate Track D', value: affDIncome, source: 'Wholesale override' });
  }
  if (streams.channels && channelRevAnnual > 0) {
    gt += channelRevAnnual;
    items.push({ name: 'Channel-Sourced Revenue', value: channelRevAnnual, source: 'Marketing channels' });
  }

  return { grandTotal: gt, items, streamCount: items.length };
}

/** Calculate Dashboard financial metrics */
export function calcDashboard(params: {
  monthlyGDC: number; aumIncome: number; expIncome: number; overrideIncome: number;
  opEx: number; taxRate: number; recOvr: number; recYr2Ovr: number; recARR: number;
  recBooks: number; recHires: number; aumTotal: number;
  mktgSpend: number; mktgRev: number;
}) {
  const { monthlyGDC, aumIncome, expIncome, overrideIncome, opEx, taxRate,
    recOvr, recYr2Ovr, recARR, recBooks, recHires, aumTotal, mktgSpend, mktgRev } = params;

  const totalRev = monthlyGDC * 12 + (aumIncome || 0) + (expIncome || 0) * 12 + (overrideIncome || 0);
  const ebitda = totalRev - opEx;
  const netInc = Math.round(ebitda * (1 - taxRate));
  const arr = Math.round(monthlyGDC * 12 * 0.15 + (aumIncome || 0) + recARR);

  return { totalRev, ebitda, netInc, arr, aumTotal, recHires, recOvr, recYr2Ovr, recARR, recBooks,
    mktgSpend, mktgRev, marginPct: totalRev > 0 ? Math.round(ebitda / totalRev * 100) : 0 };
}

/* ═══ BACK-PLAN FUNCTIONS ═══ */
export function calcCumOvrPerHire(type: string, overrideRate: number): number {
  const d = RECRUIT_DEFAULTS[type] || RECRUIT_DEFAULTS.newAssoc;
  let cum = 0;
  for (let m = 1; m <= 12; m++) {
    const moFYC = m <= d.ramp ? Math.round(d.f / 12 * (d.rP / 100)) : Math.round(d.f / 12);
    cum += Math.round(moFYC * overrideRate);
  }
  return cum;
}

export function calcYr2OvrPerHire(type: string, overrideRate: number): number {
  return Math.round(RECRUIT_DEFAULTS[type].f * overrideRate);
}

export function calcFunnelYield(type: string): number {
  const d = RECRUIT_DEFAULTS[type] || RECRUIT_DEFAULTS.newAssoc;
  return (d.i / 100) * (d.v / 100) * (d.o / 100) * (d.a / 100) * (d.p / 100);
}

/* ═══ SEASONALITY PROFILES ═══ */
export const SEASON_PROFILES: Record<string, number[]> = {
  flat:    [1,1,1,1,1,1,1,1,1,1,1,1],
  q4Heavy: [0.80,0.80,0.90,0.90,1.00,0.80,0.70,0.80,1.00,1.30,1.50,1.50],
  summer:  [1.00,1.00,1.10,1.00,0.80,0.70,0.60,0.70,0.90,1.10,1.20,1.30],
  eventDriven: [0.60,0.80,1.50,0.80,0.60,0.80,1.50,0.80,0.60,0.80,1.50,0.80],
  ramp:    [0.30,0.50,0.70,0.80,0.90,1.00,1.00,1.10,1.10,1.20,1.20,1.30],
};

export const SEASON_LABELS: Record<string, string> = {
  flat: 'Flat (Even)',
  q4Heavy: 'Q4 Push',
  summer: 'Summer Light',
  eventDriven: 'Event-Driven',
  ramp: 'New Start Ramp',
};

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** Build monthly production detail with seasonality */
export function buildMonthlyProduction(params: {
  annualGDC: number;
  seasonProfile: string;
  customSeason?: number[];
  horizonYears: number;
  growthRate: number;
  bracketRate: number;
  rampMonths?: number;
  rampPct?: number;
}) {
  const { annualGDC, seasonProfile, customSeason, horizonYears, growthRate, bracketRate, rampMonths = 0, rampPct = 0.3 } = params;
  const mults = (seasonProfile === 'custom' && customSeason?.length === 12)
    ? customSeason
    : (SEASON_PROFILES[seasonProfile] || SEASON_PROFILES.flat);

  const years: {
    year: number; annGDC: number; annIncome: number;
    months: { mo: number; name: string; mult: number; gdc: number; income: number }[];
  }[] = [];

  for (let yr = 1; yr <= horizonYears; yr++) {
    const yrGDC = yr === 1 ? annualGDC : Math.round(annualGDC * Math.pow(1 + growthRate, yr - 1));
    const moGDC = yrGDC / 12;
    let yrTotalGDC = 0;
    const months: { mo: number; name: string; mult: number; gdc: number; income: number }[] = [];

    for (let m = 0; m < 12; m++) {
      let mult = mults[m] || 1;
      let mGDC = Math.round(moGDC * mult);
      // Year 1 ramp adjustment
      if (yr === 1 && m < rampMonths) {
        mGDC = Math.round(mGDC * rampPct);
      }
      yrTotalGDC += mGDC;
      months.push({ mo: m + 1, name: MONTH_NAMES[m], mult, gdc: mGDC, income: Math.round(mGDC * bracketRate) });
    }

    years.push({ year: yr, annGDC: yrTotalGDC, annIncome: Math.round(yrTotalGDC * bracketRate), months });
  }

  return { years, profileName: SEASON_LABELS[seasonProfile] || 'Custom' };
}

/** Calculate goal progress metrics */
export function calcGoalProgress(params: {
  incomeGoal: number; currentIncome: number;
  aumGoal: number; currentAUM: number;
  recruitGoal: number; currentRecruits: number;
  gdcGoal: number; currentGDC: number;
  casesGoal: number; currentCases: number;
}) {
  const { incomeGoal, currentIncome, aumGoal, currentAUM, recruitGoal, currentRecruits, gdcGoal, currentGDC, casesGoal, currentCases } = params;

  const goals: { id: string; label: string; goal: number; current: number; pct: number; remaining: number; format: 'dollar' | 'number' }[] = [];

  if (incomeGoal > 0) {
    goals.push({ id: 'income', label: 'Total Income', goal: incomeGoal, current: currentIncome, pct: Math.min(100, Math.round(currentIncome / incomeGoal * 100)), remaining: Math.max(0, incomeGoal - currentIncome), format: 'dollar' });
  }
  if (aumGoal > 0) {
    goals.push({ id: 'aum', label: 'AUM Under Management', goal: aumGoal, current: currentAUM, pct: Math.min(100, Math.round(currentAUM / aumGoal * 100)), remaining: Math.max(0, aumGoal - currentAUM), format: 'dollar' });
  }
  if (recruitGoal > 0) {
    goals.push({ id: 'recruits', label: 'Team Hires', goal: recruitGoal, current: currentRecruits, pct: Math.min(100, Math.round(currentRecruits / recruitGoal * 100)), remaining: Math.max(0, recruitGoal - currentRecruits), format: 'number' });
  }
  if (gdcGoal > 0) {
    goals.push({ id: 'gdc', label: 'Gross Dealer Concession', goal: gdcGoal, current: currentGDC, pct: Math.min(100, Math.round(currentGDC / gdcGoal * 100)), remaining: Math.max(0, gdcGoal - currentGDC), format: 'dollar' });
  }
  if (casesGoal > 0) {
    goals.push({ id: 'cases', label: 'Cases Placed', goal: casesGoal, current: currentCases, pct: Math.min(100, Math.round(currentCases / casesGoal * 100)), remaining: Math.max(0, casesGoal - currentCases), format: 'number' });
  }

  const overallPct = goals.length > 0 ? Math.round(goals.reduce((s, g) => s + g.pct, 0) / goals.length) : 0;
  return { goals, overallPct };
}

/* ═══ UNIFIED INCOME PLANNING ═══ */

/** Income split configuration */
export interface IncomeSplits {
  gdc: number; aum: number; affiliate: number; override: number; channel: number;
}

/** Affiliate planning detail per type */
export interface AffiliatePlanDetail {
  type: 'a' | 'b' | 'c' | 'd';
  label: string;
  count: number;
  avgProduction: number;
  incomeRate: number; // % of their production you earn
  projectedIncome: number;
}

/** AUM planning detail */
export interface AUMPlanDetail {
  existingBook: number;
  newAnnual: number;
  trailPct: number;
  projectedIncome: number;
  requiredBookForTarget: number;
  gap: number;
}

/** Override planning detail */
export interface OverridePlanDetail {
  teamSize: number;
  avgGDCPerMember: number;
  overrideRate: number;
  projectedIncome: number;
  requiredTeamSizeForTarget: number;
  gap: number;
}

/** Channel planning detail */
export interface ChannelPlanDetail {
  totalMonthlySpend: number;
  projectedAnnualRevenue: number;
  requiredSpendForTarget: number;
  gap: number;
}

/** Full unified income plan result */
export interface UnifiedIncomePlan {
  targetIncome: number;
  splits: IncomeSplits;
  channels: {
    gdc: { target: number; projected: number; gap: number };
    aum: { target: number; detail: AUMPlanDetail };
    affiliate: { target: number; details: AffiliatePlanDetail[]; totalProjected: number; gap: number };
    override: { target: number; detail: OverridePlanDetail };
    channel: { target: number; detail: ChannelPlanDetail };
  };
  totalProjected: number;
  totalGap: number;
  onTrack: boolean;
}

const AFF_LABELS: Record<string, string> = {
  a: 'Affiliate A (Fee-Based)', b: 'Affiliate B (Referral)',
  c: 'Affiliate C (Co-Broker)', d: 'Affiliate D (Wholesale)',
};
export const AFF_RATES: Record<string, number> = { a: 0.15, b: 0.10, c: 0.20, d: 0.08 };

/* ═══ AUM OVERRIDE RATES (payout % of advisory fee kept by advisor) ═══ */
export const AUM_OVERRIDE_DEFAULTS: Record<RoleId, number> = {
  new: 85, exp: 90, sa: 90, dir: 92, md: 95, rvp: 97,
};

/* ═══ AFFILIATE INCOME MODES ═══ */
export type AffiliateMode = 'recruiter' | 'producer';

/** Producer mode: user IS the affiliate earning from their own deals */
export interface ProducerModeInputs {
  dealsPerMonth: number;       // # deals closed per month
  avgCommissionPerDeal: number; // avg commission earned per deal
  splitPct: number;            // % of commission user keeps (co-broker split)
  fixedBonusPerDeal: number;   // flat bonus per deal (milestone/referral)
  monthlyRetainer: number;     // any monthly retainer/base from affiliate arrangement
}

export const PRODUCER_DEFAULTS: ProducerModeInputs = {
  dealsPerMonth: 2,
  avgCommissionPerDeal: 3000,
  splitPct: 50,
  fixedBonusPerDeal: 500,
  monthlyRetainer: 0,
};

/** Calculate producer-mode affiliate income */
export function calcProducerAffiliateIncome(inputs: ProducerModeInputs): {
  annualIncome: number;
  monthlyIncome: number;
  commissionIncome: number;
  bonusIncome: number;
  retainerIncome: number;
} {
  const monthlyCommission = inputs.dealsPerMonth * inputs.avgCommissionPerDeal * (inputs.splitPct / 100);
  const monthlyBonus = inputs.dealsPerMonth * inputs.fixedBonusPerDeal;
  const monthlyTotal = monthlyCommission + monthlyBonus + inputs.monthlyRetainer;
  return {
    annualIncome: Math.round(monthlyTotal * 12),
    monthlyIncome: Math.round(monthlyTotal),
    commissionIncome: Math.round(monthlyCommission * 12),
    bonusIncome: Math.round(monthlyBonus * 12),
    retainerIncome: Math.round(inputs.monthlyRetainer * 12),
  };
}

/* ═══ PROGRESSIVE DISCLOSURE LEVELS ═══ */
export type ComplexityLevel = 'simple' | 'detailed' | 'expert';

/** Sections visible at each complexity level */
export const COMPLEXITY_SECTIONS: Record<ComplexityLevel, Set<string>> = {
  simple: new Set(['target', 'role', 'summary', 'splits-pie']),
  detailed: new Set(['target', 'role', 'summary', 'splits-pie', 'splits-sliders', 'channel-details', 'roll-up-table', 'economics']),
  expert: new Set(['target', 'role', 'summary', 'splits-pie', 'splits-sliders', 'channel-details', 'roll-up-table', 'economics', 'cross-cascade', 'audit-trail', 'sensitivity', 'time-phased', 'scenarios', 'export']),
};

export function isSectionVisible(section: string, level: ComplexityLevel): boolean {
  return COMPLEXITY_SECTIONS[level].has(section);
}

/** Enabled channels configuration */
export interface EnabledChannels {
  gdc: boolean; aum: boolean; affiliate: boolean; override: boolean; channel: boolean;
}

/** Calculate unified income plan from target income + splits */
export function calcUnifiedIncomePlan(params: {
  targetIncome: number;
  splits: IncomeSplits;
  role: RoleId;
  enabledChannels: EnabledChannels;
  /* GDC channel */
  targetGDC: number;
  wbPct: number;
  bracketOverride: string;
  avgGDC: number;
  funnelRates: { ap: number; sh: number; cl: number; pl: number };
  months: number;
  /* AUM channel */
  aumExisting: number;
  aumNew: number;
  aumTrailPct: number;
  aumOverrideRate: number; // payout % of advisory fee kept by advisor (default 90)
  /* Affiliate channel */
  affiliateMode: AffiliateMode;
  affCounts: { a: number; b: number; c: number; d: number };
  affAvgProd: { a: number; b: number; c: number; d: number };
  producerInputs: ProducerModeInputs;
  /* Override channel */
  teamSize: number;
  teamAvgGDC: number;
  overrideRate: number;
  /* Channel/marketing */
  channelSpend: Record<string, number>;
}): UnifiedIncomePlan {
  const { targetIncome, splits, role, enabledChannels } = params;
  const rd = ROLE_DEFAULTS[role] || ROLE_DEFAULTS.new;

  // Channel targets from splits (zero if channel disabled)
  const gdcTarget = enabledChannels.gdc ? Math.round(targetIncome * splits.gdc / 100) : 0;
  const aumTarget = enabledChannels.aum ? Math.round(targetIncome * splits.aum / 100) : 0;
  const affTarget = enabledChannels.affiliate ? Math.round(targetIncome * splits.affiliate / 100) : 0;
  const ovrTarget = enabledChannels.override ? Math.round(targetIncome * splits.override / 100) : 0;
  const chTarget = enabledChannels.channel ? Math.round(targetIncome * splits.channel / 100) : 0;

  // GDC projected
  const funnel = calcProductionFunnel(
    params.targetGDC, params.wbPct, params.bracketOverride, params.avgGDC,
    params.funnelRates.ap, params.funnelRates.sh, params.funnelRates.cl, params.funnelRates.pl, params.months
  );
  const gdcProjected = enabledChannels.gdc ? (funnel.wbTarget + funnel.expTarget) : 0;
  const gdcGap = Math.max(0, gdcTarget - gdcProjected);

  // AUM projected (with override/payout rate)
  const aumPayoutRate = (params.aumOverrideRate ?? 90) / 100;
  const aumIncome = enabledChannels.aum
    ? Math.round(((params.aumExisting * (params.aumTrailPct / 100)) + (params.aumNew * (params.aumTrailPct / 100) * 0.5)) * aumPayoutRate)
    : 0;
  const requiredAUM = enabledChannels.aum && params.aumTrailPct > 0 ? Math.round(aumTarget / (params.aumTrailPct / 100)) : 0;
  const aumGap = Math.max(0, aumTarget - aumIncome);
  const aumDetail: AUMPlanDetail = {
    existingBook: params.aumExisting, newAnnual: params.aumNew, trailPct: params.aumTrailPct,
    projectedIncome: aumIncome, requiredBookForTarget: requiredAUM, gap: aumGap,
  };

  // Affiliate projected — dual mode
  let affDetails: AffiliatePlanDetail[];
  let affTotalProjected: number;
  let producerResult: ReturnType<typeof calcProducerAffiliateIncome> | null = null;

  if (params.affiliateMode === 'producer' && enabledChannels.affiliate) {
    // Producer mode: user IS the affiliate
    producerResult = calcProducerAffiliateIncome(params.producerInputs);
    affTotalProjected = producerResult.annualIncome;
    affDetails = [{
      type: 'a', label: 'Commission Income', count: params.producerInputs.dealsPerMonth * 12,
      avgProduction: params.producerInputs.avgCommissionPerDeal, incomeRate: params.producerInputs.splitPct / 100,
      projectedIncome: producerResult.commissionIncome,
    }, {
      type: 'b', label: 'Deal Bonuses', count: params.producerInputs.dealsPerMonth * 12,
      avgProduction: params.producerInputs.fixedBonusPerDeal, incomeRate: 1,
      projectedIncome: producerResult.bonusIncome,
    }, {
      type: 'c', label: 'Monthly Retainer', count: 12,
      avgProduction: params.producerInputs.monthlyRetainer, incomeRate: 1,
      projectedIncome: producerResult.retainerIncome,
    }, {
      type: 'd', label: 'Total Producer Income', count: 0,
      avgProduction: 0, incomeRate: 0,
      projectedIncome: 0, // placeholder row
    }];
  } else {
    // Recruiter mode: recruiting affiliates who bring in revenue
    affDetails = (['a','b','c','d'] as const).map(t => {
      const count = enabledChannels.affiliate ? params.affCounts[t] : 0;
      const avgProd = params.affAvgProd[t];
      const rate = AFF_RATES[t];
      const projected = Math.round(count * avgProd * rate);
      return { type: t, label: AFF_LABELS[t], count, avgProduction: avgProd, incomeRate: rate, projectedIncome: projected };
    });
    affTotalProjected = affDetails.reduce((s, d) => s + d.projectedIncome, 0);
  }
  const affGap = Math.max(0, affTarget - affTotalProjected);

  // Override projected
  const ovrProjected = enabledChannels.override
    ? Math.round(params.teamSize * params.teamAvgGDC * (params.overrideRate / 100))
    : 0;
  const requiredTeam = enabledChannels.override && params.teamAvgGDC > 0 && params.overrideRate > 0
    ? Math.ceil(ovrTarget / (params.teamAvgGDC * (params.overrideRate / 100)))
    : 0;
  const ovrGap = Math.max(0, ovrTarget - ovrProjected);
  const ovrDetail: OverridePlanDetail = {
    teamSize: params.teamSize, avgGDCPerMember: params.teamAvgGDC, overrideRate: params.overrideRate,
    projectedIncome: ovrProjected, requiredTeamSizeForTarget: requiredTeam, gap: ovrGap,
  };

  // Channel/marketing projected
  const chMetrics = calcChannelMetrics(params.channelSpend);
  const chProjected = enabledChannels.channel ? chMetrics.annualRev : 0;
  const chGap = Math.max(0, chTarget - chProjected);
  const revPerSpend = chMetrics.annualSpend > 0 ? chMetrics.annualRev / chMetrics.annualSpend : 3;
  const requiredSpend = enabledChannels.channel ? Math.round(chTarget / revPerSpend / 12) : 0;
  const chDetail: ChannelPlanDetail = {
    totalMonthlySpend: chMetrics.tSpend, projectedAnnualRevenue: chProjected,
    requiredSpendForTarget: requiredSpend, gap: chGap,
  };

  const totalProjected = gdcProjected + aumIncome + affTotalProjected + ovrProjected + chProjected;
  const totalGap = Math.max(0, targetIncome - totalProjected);

  return {
    targetIncome, splits,
    channels: {
      gdc: { target: gdcTarget, projected: gdcProjected, gap: gdcGap },
      aum: { target: aumTarget, detail: aumDetail },
      affiliate: { target: affTarget, details: affDetails, totalProjected: affTotalProjected, gap: affGap },
      override: { target: ovrTarget, detail: ovrDetail },
      channel: { target: chTarget, detail: chDetail },
    },
    totalProjected, totalGap, onTrack: totalProjected >= targetIncome,
  };
}

/** Back-calculate: given channel projections, compute what target income they support */
export function calcBackFromChannels(params: {
  gdcProjected: number; aumProjected: number; affProjected: number;
  ovrProjected: number; chProjected: number;
}): number {
  return params.gdcProjected + params.aumProjected + params.affProjected + params.ovrProjected + params.chProjected;
}

/* ═══ CHANNEL ECONOMICS — CAC / ROI / LTV ═══ */

/** Industry benchmark data per income channel.
 *  Sources: LIMRA, Cerulli, McKinsey Insurance Practice, Kitces Research.
 *  Values represent reasonable mid-market benchmarks for financial services. */
export interface ChannelBenchmark {
  label: string;
  /** Avg cost to acquire one client/relationship in this channel */
  cac: number;
  /** COGS as % of revenue (commissions, platform fees, compliance, etc.) */
  cogsPct: number;
  /** Average annual revenue per client/relationship */
  avgRevenuePerClient: number;
  /** Client retention rate year-over-year */
  retentionRate: number;
  /** Average client lifetime in years */
  avgLifetimeYears: number;
  /** Industry best-in-class CAC for comparison */
  bestInClassCAC: number;
  /** Reference note for due diligence */
  ref: string;
}

export const CHANNEL_BENCHMARKS: Record<string, ChannelBenchmark> = {
  gdc: {
    label: 'GDC Production',
    cac: 1200, cogsPct: 35, avgRevenuePerClient: 3500, retentionRate: 0.82,
    avgLifetimeYears: 8, bestInClassCAC: 600,
    ref: 'LIMRA 2024 Distribution Economics; avg advisor client acquisition cost $800–$1,500. COGS includes carrier splits, E&O, compliance.',
  },
  aum: {
    label: 'AUM/Advisory',
    cac: 3500, cogsPct: 25, avgRevenuePerClient: 5000, retentionRate: 0.93,
    avgLifetimeYears: 12, bestInClassCAC: 1500,
    ref: 'Cerulli 2024 RIA Benchmarking; avg AUM client CAC $2,500–$5,000. Higher retention = higher LTV. COGS: custodian fees, tech stack, compliance.',
  },
  affiliate: {
    label: 'Affiliates',
    cac: 2000, cogsPct: 40, avgRevenuePerClient: 2500, retentionRate: 0.70,
    avgLifetimeYears: 5, bestInClassCAC: 800,
    ref: 'McKinsey Insurance Distribution 2024; affiliate onboarding cost $1,500–$3,000. Higher COGS due to split arrangements. Retention varies by affiliate tier.',
  },
  override: {
    label: 'Team Override',
    cac: 5000, cogsPct: 15, avgRevenuePerClient: 8000, retentionRate: 0.75,
    avgLifetimeYears: 6, bestInClassCAC: 2500,
    ref: 'GAMA International 2024; team member recruitment cost $3,000–$8,000 including training. Low COGS (override is margin). Retention = agent retention rate.',
  },
  channel: {
    label: 'Marketing Channels',
    cac: 800, cogsPct: 45, avgRevenuePerClient: 2000, retentionRate: 0.65,
    avgLifetimeYears: 4, bestInClassCAC: 300,
    ref: 'Kitces Research 2024; digital marketing CAC $400–$1,200 for financial services. Higher COGS due to ad spend, content creation, tech. Lower retention than referral channels.',
  },
};

/** Per-channel economics result */
export interface ChannelEconomics {
  channel: string;
  label: string;
  /* Revenue & costs */
  annualRevenue: number;
  cac: number;
  cogsDollar: number;
  cogsPct: number;
  grossMarginDollar: number;
  grossMarginPct: number;
  /* ROI */
  roi: number; // (revenue - COGS) / CAC as ratio
  roiPct: number; // as percentage
  /* LTV */
  clientLTV: number; // single client lifetime value
  extendedNetworkLTV: number; // LTV including referral multiplier
  ltvCacRatio: number; // LTV / CAC
  /* Payback */
  paybackMonths: number; // months to recover CAC
  /* Benchmarks */
  bestInClassCAC: number;
  cacEfficiency: string; // 'Above Avg' | 'Average' | 'Below Avg'
  ref: string;
}

/** Calculate economics for all enabled channels */
export function calcChannelEconomics(params: {
  enabledChannels: EnabledChannels;
  projections: {
    gdc: number; aum: number; affiliate: number; override: number; channel: number;
  };
  /** Optional user overrides for CAC per channel */
  cacOverrides?: Partial<Record<string, number>>;
  /** Optional user overrides for COGS% per channel */
  cogsOverrides?: Partial<Record<string, number>>;
  /** Referral multiplier for extended network LTV (default 1.3) */
  referralMultiplier?: number;
}): ChannelEconomics[] {
  const { enabledChannels, projections, cacOverrides = {}, cogsOverrides = {}, referralMultiplier = 1.3 } = params;
  const keys: (keyof EnabledChannels)[] = ['gdc', 'aum', 'affiliate', 'override', 'channel'];

  return keys.filter(k => enabledChannels[k]).map(k => {
    const bm = CHANNEL_BENCHMARKS[k];
    const revenue = projections[k];
    const cac = cacOverrides[k] ?? bm.cac;
    const effectiveCogsPct = cogsOverrides[k] ?? bm.cogsPct;
    const cogsDollar = Math.round(revenue * effectiveCogsPct / 100);
    const grossMargin = revenue - cogsDollar;
    const grossMarginPct = revenue > 0 ? Math.round(grossMargin / revenue * 100) : 0;

    // Estimate number of clients from revenue / avg revenue per client
    const estClients = bm.avgRevenuePerClient > 0 ? Math.max(1, Math.round(revenue / bm.avgRevenuePerClient)) : 1;
    const totalCAC = cac * estClients;

    // ROI = (Revenue - COGS - Total CAC) / Total CAC
    const roiDollar = revenue - cogsDollar - totalCAC;
    const roi = totalCAC > 0 ? roiDollar / totalCAC : 0;
    const roiPct = Math.round(roi * 100);

    // LTV = avg revenue per client × avg lifetime × retention factor
    // Geometric series: sum = r * (1 - ret^years) / (1 - ret)
    const ret = bm.retentionRate;
    const years = bm.avgLifetimeYears;
    const retentionFactor = ret < 1 ? (1 - Math.pow(ret, years)) / (1 - ret) : years;
    const clientLTV = Math.round(bm.avgRevenuePerClient * retentionFactor * (1 - effectiveCogsPct / 100));
    const extendedNetworkLTV = Math.round(clientLTV * referralMultiplier);
    const ltvCacRatio = cac > 0 ? Math.round(clientLTV / cac * 10) / 10 : 0;

    // Payback: months to recover CAC from monthly net margin
    const monthlyNet = grossMargin / 12;
    const paybackMonths = monthlyNet > 0 ? Math.round(cac / monthlyNet * estClients) : 999;

    // CAC efficiency vs benchmark
    const cacEfficiency = cac <= bm.bestInClassCAC ? 'Above Avg' : cac <= bm.cac ? 'Average' : 'Below Avg';

    return {
      channel: k, label: bm.label,
      annualRevenue: revenue, cac, cogsDollar, cogsPct: effectiveCogsPct,
      grossMarginDollar: grossMargin, grossMarginPct,
      roi, roiPct, clientLTV, extendedNetworkLTV, ltvCacRatio,
      paybackMonths: Math.min(paybackMonths, 999),
      bestInClassCAC: bm.bestInClassCAC, cacEfficiency, ref: bm.ref,
    };
  });
}

/* ═══ SENSITIVITY ANALYSIS ═══ */

export interface SensitivityVariable {
  key: string;
  label: string;
  baseValue: number;
  unit: string; // '$', '%', '#'
}

export interface SensitivityResult {
  variable: SensitivityVariable;
  /** Projected income at each variation level */
  variations: { pctChange: number; newValue: number; projected: number; delta: number }[];
  /** Absolute range of impact (max projected - min projected) */
  impactRange: number;
}

/** Run sensitivity analysis: vary each key variable ±10/25/50% and compute projected income */
export function calcSensitivity(baseParams: Parameters<typeof calcUnifiedIncomePlan>[0]): SensitivityResult[] {
  const baseResult = calcUnifiedIncomePlan(baseParams);
  const baseProjected = baseResult.totalProjected;
  const pctLevels = [-50, -25, -10, 10, 25, 50];

  // Define variables to test
  const variables: { key: string; label: string; getValue: () => number; unit: string;
    apply: (params: typeof baseParams, newVal: number) => typeof baseParams }[] = [
    {
      key: 'closeRate', label: 'Close Rate (pl%)', unit: '%',
      getValue: () => baseParams.funnelRates.pl,
      apply: (p, v) => ({ ...p, funnelRates: { ...p.funnelRates, pl: Math.max(1, Math.min(100, v)) } }),
    },
    {
      key: 'showRate', label: 'Show Rate (sh%)', unit: '%',
      getValue: () => baseParams.funnelRates.sh,
      apply: (p, v) => ({ ...p, funnelRates: { ...p.funnelRates, sh: Math.max(1, Math.min(100, v)) } }),
    },
    {
      key: 'avgGDC', label: 'Avg Case Size ($)', unit: '$',
      getValue: () => baseParams.avgGDC,
      apply: (p, v) => ({ ...p, avgGDC: Math.max(100, v) }),
    },
    {
      key: 'aumTrailPct', label: 'AUM Trail %', unit: '%',
      getValue: () => baseParams.aumTrailPct,
      apply: (p, v) => ({ ...p, aumTrailPct: Math.max(0.01, v) }),
    },
    {
      key: 'aumExisting', label: 'AUM Book ($)', unit: '$',
      getValue: () => baseParams.aumExisting,
      apply: (p, v) => ({ ...p, aumExisting: Math.max(0, v) }),
    },
    {
      key: 'affAvgProdA', label: 'Affiliate Avg Prod (A)', unit: '$',
      getValue: () => baseParams.affAvgProd.a,
      apply: (p, v) => ({ ...p, affAvgProd: { ...p.affAvgProd, a: Math.max(0, v) } }),
    },
    {
      key: 'overrideRate', label: 'Override Rate %', unit: '%',
      getValue: () => baseParams.overrideRate,
      apply: (p, v) => ({ ...p, overrideRate: Math.max(0, Math.min(100, v)) }),
    },
    {
      key: 'teamAvgGDC', label: 'Team Avg GDC ($)', unit: '$',
      getValue: () => baseParams.teamAvgGDC,
      apply: (p, v) => ({ ...p, teamAvgGDC: Math.max(0, v) }),
    },
  ];

  return variables.map(v => {
    const baseVal = v.getValue();
    if (baseVal === 0) {
      return {
        variable: { key: v.key, label: v.label, baseValue: baseVal, unit: v.unit },
        variations: pctLevels.map(pct => ({ pctChange: pct, newValue: 0, projected: baseProjected, delta: 0 })),
        impactRange: 0,
      };
    }
    const variations = pctLevels.map(pctChange => {
      const newValue = Math.round(baseVal * (1 + pctChange / 100) * 100) / 100;
      const modParams = v.apply({ ...baseParams }, newValue);
      const result = calcUnifiedIncomePlan(modParams);
      return { pctChange, newValue, projected: result.totalProjected, delta: result.totalProjected - baseProjected };
    });
    const projections = variations.map(vr => vr.projected);
    const impactRange = Math.max(...projections) - Math.min(...projections);
    return {
      variable: { key: v.key, label: v.label, baseValue: baseVal, unit: v.unit },
      variations,
      impactRange,
    };
  }).sort((a, b) => b.impactRange - a.impactRange); // Sort by most impactful first
}

/* ═══ TIME-PHASED PROJECTIONS ═══ */

// Industry seasonal factors for insurance/financial services (monthly, Jan=0)
// Source: LIMRA annual sales surveys, Cerulli quarterly flow data
const SEASONAL_FACTORS = [
  0.85, 0.80, 0.95, 1.05, 1.00, 0.90,  // Jan-Jun: slow start, spring push
  0.85, 0.80, 1.10, 1.15, 1.20, 1.35,  // Jul-Dec: summer lull, Q4 surge
];

// Ramp curves by role (multiplier for month 1-12, representing how quickly production ramps)
const RAMP_CURVES: Record<string, number[]> = {
  new:  [0.10, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.80, 0.85, 0.90, 1.00],
  mid:  [0.50, 0.55, 0.65, 0.75, 0.80, 0.85, 0.90, 0.95, 1.00, 1.00, 1.00, 1.00],
  snr:  [0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00],
  mgr:  [0.80, 0.85, 0.90, 0.95, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00],
  rvp:  [0.85, 0.90, 0.95, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00],
  svp:  [0.90, 0.95, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00],
  ceo:  [0.95, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00],
};

export interface MonthlyProjection {
  month: number;        // 1-12
  label: string;        // "Jan", "Feb", etc.
  /** Per-channel monthly income */
  gdc: number;
  aum: number;
  affiliate: number;
  override: number;
  channel: number;
  /** Totals */
  monthlyTotal: number;
  cumulativeTotal: number;
  /** Target pacing */
  linearTarget: number;       // Where you should be if income were even
  cumulativeTarget: number;
  onPace: boolean;
  /** Factors applied */
  seasonalFactor: number;
  rampFactor: number;
}

export interface TimePhasedResult {
  monthly: MonthlyProjection[];
  quarterly: { q: number; label: string; total: number; target: number; gap: number }[];
  milestones: { label: string; amount: number; expectedMonth: number | null; monthLabel: string }[];
  annualTotal: number;
  annualTarget: number;
}

export function calcTimePhasedProjections(params: {
  targetIncome: number;
  plan: ReturnType<typeof calcUnifiedIncomePlan>;
  role: RoleId;
  enabledChannels: EnabledChannels;
  startMonth?: number; // 0=Jan, 1=Feb, ... 11=Dec. Default: current month
}): TimePhasedResult {
  const { targetIncome, plan, role, enabledChannels } = params;
  const startMonth = params.startMonth ?? new Date().getMonth();
  const ramp = RAMP_CURVES[role] || RAMP_CURVES.mid;
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Annual projections per channel
  const annGDC = enabledChannels.gdc ? plan.channels.gdc.projected : 0;
  const annAUM = enabledChannels.aum ? plan.channels.aum.detail.projectedIncome : 0;
  const annAff = enabledChannels.affiliate ? plan.channels.affiliate.totalProjected : 0;
  const annOvr = enabledChannels.override ? plan.channels.override.detail.projectedIncome : 0;
  const annCh = enabledChannels.channel ? plan.channels.channel.detail.projectedAnnualRevenue : 0;
  const annTotal = annGDC + annAUM + annAff + annOvr + annCh;

  // Build monthly projections
  let cumulative = 0;
  const monthly: MonthlyProjection[] = [];
  for (let i = 0; i < 12; i++) {
    const calMonth = (startMonth + i) % 12;
    const sf = SEASONAL_FACTORS[calMonth];
    const rf = ramp[i];
    const combined = sf * rf;

    // Distribute annual income across months using combined factor
    // Normalize so factors sum to 12 (one year)
    const gdcMo = Math.round(annGDC / 12 * combined);
    const aumMo = Math.round(annAUM / 12 * combined);
    const affMo = Math.round(annAff / 12 * combined);
    const ovrMo = Math.round(annOvr / 12 * combined);
    const chMo = Math.round(annCh / 12 * combined);
    const moTotal = gdcMo + aumMo + affMo + ovrMo + chMo;
    cumulative += moTotal;

    const linearTarget = Math.round(targetIncome / 12);
    const cumulativeTarget = Math.round(targetIncome * (i + 1) / 12);

    monthly.push({
      month: i + 1,
      label: monthNames[calMonth],
      gdc: gdcMo, aum: aumMo, affiliate: affMo, override: ovrMo, channel: chMo,
      monthlyTotal: moTotal,
      cumulativeTotal: cumulative,
      linearTarget,
      cumulativeTarget,
      onPace: cumulative >= cumulativeTarget,
      seasonalFactor: sf,
      rampFactor: rf,
    });
  }

  // Quarterly roll-up
  const quarterly = [0, 1, 2, 3].map(q => {
    const qMonths = monthly.slice(q * 3, q * 3 + 3);
    const total = qMonths.reduce((s, m) => s + m.monthlyTotal, 0);
    const target = Math.round(targetIncome / 4);
    return { q: q + 1, label: `Q${q + 1}`, total, target, gap: Math.max(0, target - total) };
  });

  // Milestones
  const milestoneAmounts = [
    { label: '25% of Target', amount: Math.round(targetIncome * 0.25) },
    { label: '50% of Target', amount: Math.round(targetIncome * 0.50) },
    { label: '75% of Target', amount: Math.round(targetIncome * 0.75) },
    { label: '100% of Target', amount: targetIncome },
    { label: 'Break Even (COGS)', amount: Math.round(targetIncome * 0.3) }, // Approximate break-even
  ];
  const milestones = milestoneAmounts.map(m => {
    const hitMonth = monthly.find(mo => mo.cumulativeTotal >= m.amount);
    return {
      label: m.label,
      amount: m.amount,
      expectedMonth: hitMonth ? hitMonth.month : null,
      monthLabel: hitMonth ? hitMonth.label : 'Beyond 12mo',
    };
  });

  return {
    monthly,
    quarterly,
    milestones,
    annualTotal: cumulative,
    annualTarget: targetIncome,
  };
}

/* ═══ CROSS-CASCADE ENGINE — Roll-Up / Roll-Down ═══ */

/** Channel keys for iteration */
export const CHANNEL_KEYS: (keyof EnabledChannels)[] = ['gdc', 'aum', 'affiliate', 'override', 'channel'];

/**
 * Back-solve: given a desired channel TARGET amount, compute the new split %
 * and return the adjusted splits (preserving 100% sum by proportionally adjusting others).
 */
export function backSolveChannelTarget(
  ch: keyof EnabledChannels,
  newChannelTarget: number,
  targetIncome: number,
  currentSplits: IncomeSplits,
  enabledChannels: EnabledChannels,
): IncomeSplits {
  if (targetIncome <= 0) return currentSplits;
  const newPct = Math.max(0, Math.min(100, Math.round(newChannelTarget / targetIncome * 100)));
  return redistributeSplits(ch, newPct, currentSplits, enabledChannels);
}

/**
 * Back-solve: given a desired channel PROJECTED amount, compute what sub-inputs
 * would produce it. Returns an object describing which state setters to call.
 */
export interface BackSolveResult {
  channel: keyof EnabledChannels;
  newSplitPct: number;
  newSplits: IncomeSplits;
  gdcTarget?: number;
  aumExisting?: number;
  affCountScale?: number;
  teamAvgGDC?: number;
  channelSpendScale?: number;
}

export function backSolveChannelProjected(
  ch: keyof EnabledChannels,
  newProjected: number,
  targetIncome: number,
  currentSplits: IncomeSplits,
  enabledChannels: EnabledChannels,
  current: {
    aumTrailPct: number;
    affCounts: { a: number; b: number; c: number; d: number };
    affAvgProd: { a: number; b: number; c: number; d: number };
    teamSize: number;
    overrideRate: number;
    channelAnnualRev: number;
    channelSpend: Record<string, number>;
  },
): BackSolveResult {
  const newPct = targetIncome > 0 ? Math.max(0, Math.min(100, Math.round(newProjected / targetIncome * 100))) : 0;
  const newSplits = redistributeSplits(ch, newPct, currentSplits, enabledChannels);
  const result: BackSolveResult = { channel: ch, newSplitPct: newPct, newSplits };

  switch (ch) {
    case 'gdc':
      result.gdcTarget = Math.round(newProjected);
      break;
    case 'aum':
      if (current.aumTrailPct > 0) {
        result.aumExisting = Math.round(newProjected / (current.aumTrailPct / 100));
      }
      break;
    case 'affiliate': {
      const currentAffProjected = (['a','b','c','d'] as const).reduce((sum, t) =>
        sum + Math.round(current.affCounts[t] * current.affAvgProd[t] * (AFF_RATES[t] || 0.1)), 0);
      result.affCountScale = currentAffProjected > 0 ? newProjected / currentAffProjected : 1;
      break;
    }
    case 'override': {
      const teamSz = Math.max(1, current.teamSize);
      const ovrRate = current.overrideRate > 0 ? current.overrideRate / 100 : 0.08;
      result.teamAvgGDC = Math.round(newProjected / (teamSz * ovrRate));
      break;
    }
    case 'channel': {
      result.channelSpendScale = current.channelAnnualRev > 0 ? newProjected / current.channelAnnualRev : 1;
      break;
    }
  }
  return result;
}

/**
 * Redistribute splits: set one channel to a new %, adjust others proportionally to maintain 100% sum.
 */
export function redistributeSplits(
  ch: keyof EnabledChannels,
  newPct: number,
  currentSplits: IncomeSplits,
  enabledChannels: EnabledChannels,
): IncomeSplits {
  const next = { ...currentSplits };
  const oldPct = next[ch];
  const delta = newPct - oldPct;
  next[ch] = newPct;
  if (delta === 0) return next;

  const otherKeys = CHANNEL_KEYS.filter(k => k !== ch && enabledChannels[k]);
  const otherSum = otherKeys.reduce((s, k) => s + next[k], 0);
  if (otherKeys.length === 0) return next;

  if (otherSum > 0) {
    const targetOtherSum = Math.max(0, otherSum - delta);
    const scale = targetOtherSum / otherSum;
    let distributed = 0;
    otherKeys.forEach((k, i) => {
      if (i === otherKeys.length - 1) {
        next[k] = Math.max(0, 100 - newPct - distributed);
      } else {
        const adjusted = Math.max(0, Math.round(next[k] * scale));
        next[k] = adjusted;
        distributed += adjusted;
      }
    });
  } else {
    const remaining = Math.max(0, 100 - newPct);
    const even = Math.floor(remaining / otherKeys.length);
    otherKeys.forEach((k, i) => {
      next[k] = i === otherKeys.length - 1 ? remaining - even * (otherKeys.length - 1) : even;
    });
  }
  return next;
}

/**
 * Auto-balance: redistribute splits based on actual projected proportions.
 */
export function autoBalanceSplits(
  plan: UnifiedIncomePlan,
  enabledChannels: EnabledChannels,
  currentSplits: IncomeSplits,
  targetIncome: number,
): IncomeSplits {
  if (targetIncome <= 0) return currentSplits;
  const projected: Record<keyof EnabledChannels, number> = {
    gdc: plan.channels.gdc.projected,
    aum: plan.channels.aum.detail.projectedIncome,
    affiliate: plan.channels.affiliate.totalProjected,
    override: plan.channels.override.detail.projectedIncome,
    channel: plan.channels.channel.detail.projectedAnnualRevenue,
  };
  const totalProjected = CHANNEL_KEYS.filter(k => enabledChannels[k]).reduce((s, k) => s + projected[k], 0);
  if (totalProjected <= 0) return currentSplits;

  const next = { ...currentSplits };
  let sum = 0;
  const enabledKeys = CHANNEL_KEYS.filter(k => enabledChannels[k]);
  enabledKeys.forEach((k, i) => {
    if (i === enabledKeys.length - 1) {
      next[k] = 100 - sum;
    } else {
      const p = Math.round(projected[k] / totalProjected * 100);
      next[k] = p;
      sum += p;
    }
  });
  CHANNEL_KEYS.filter(k => !enabledChannels[k]).forEach(k => { next[k] = 0; });
  return next;
}

/**
 * Per-channel surplus/deficit for cross-cascade visibility.
 */
export interface ChannelBalance {
  channel: keyof EnabledChannels;
  target: number;
  projected: number;
  surplus: number;
  surplusPct: number;
}

export function calcChannelBalances(plan: UnifiedIncomePlan, enabledChannels: EnabledChannels): ChannelBalance[] {
  const channels: { key: keyof EnabledChannels; target: number; projected: number }[] = [
    { key: 'gdc', target: plan.channels.gdc.target, projected: plan.channels.gdc.projected },
    { key: 'aum', target: plan.channels.aum.target, projected: plan.channels.aum.detail.projectedIncome },
    { key: 'affiliate', target: plan.channels.affiliate.target, projected: plan.channels.affiliate.totalProjected },
    { key: 'override', target: plan.channels.override.target, projected: plan.channels.override.detail.projectedIncome },
    { key: 'channel', target: plan.channels.channel.target, projected: plan.channels.channel.detail.projectedAnnualRevenue },
  ];
  return channels.filter(c => enabledChannels[c.key]).map(c => ({
    channel: c.key,
    target: c.target,
    projected: c.projected,
    surplus: c.projected - c.target,
    surplusPct: c.target > 0 ? Math.round((c.projected - c.target) / c.target * 100) : 0,
  }));
}

/* ═══════════════════════════════════════════════════════════════
   PASS 96 — CROSS-CASCADE AUDIT TRAIL
   ═══════════════════════════════════════════════════════════════ */

export type CascadeDirection = 'roll-down' | 'roll-up' | 'auto-balance' | 'sync' | 'toggle' | 'split-drag';

export interface CascadeAuditEntry {
  id: number;
  timestamp: number;
  direction: CascadeDirection;
  trigger: string;          // human-readable description of what the user did
  channel: keyof EnabledChannels | 'all';
  changes: CascadeChange[];
  /** Snapshot of splits before this action (for undo) */
  prevSplits: IncomeSplits;
  /** Snapshot of key inputs before this action (for undo) */
  prevInputs: CascadeInputSnapshot;
}

export interface CascadeChange {
  field: string;
  from: number | string;
  to: number | string;
  channel?: keyof EnabledChannels;
}

export interface CascadeInputSnapshot {
  targetIncome: number;
  incomeSplits: IncomeSplits;
  enabledChannels: EnabledChannels;
  targetGDC: number;
  aumExisting: number;
  aumNew: number;
  affCounts: { a: number; b: number; c: number; d: number };
  teamAvgGDC: number;
  channelSpend: Record<string, number>;
}

let _auditIdCounter = 0;

export function createAuditEntry(
  direction: CascadeDirection,
  trigger: string,
  channel: keyof EnabledChannels | 'all',
  changes: CascadeChange[],
  prevSplits: IncomeSplits,
  prevInputs: CascadeInputSnapshot,
): CascadeAuditEntry {
  return {
    id: ++_auditIdCounter,
    timestamp: Date.now(),
    direction,
    trigger,
    channel,
    changes,
    prevSplits,
    prevInputs,
  };
}

export function resetAuditCounter(): void {
  _auditIdCounter = 0;
}

/* ═══════════════════════════════════════════════════════════════
   PASS 96 — SCENARIO DIFF WITH CROSS-CASCADE HIGHLIGHTING
   ═══════════════════════════════════════════════════════════════ */

export interface ScenarioDiffField {
  field: string;
  label: string;
  channel?: keyof EnabledChannels;
  values: (number | string)[];
  /** true if values diverge across scenarios */
  divergent: boolean;
  /** magnitude of divergence as % of max value (0-100) */
  divergenceMagnitude: number;
  /** 'cascade' if the divergence is likely caused by different cascade paths */
  divergenceType: 'input' | 'cascade' | 'identical';
}

export interface ScenarioDiffResult {
  fields: ScenarioDiffField[];
  /** Number of fields that diverge */
  divergentCount: number;
  /** Number of fields where divergence is cascade-driven */
  cascadeDrivenCount: number;
  /** Overall similarity score 0-100 */
  similarityScore: number;
}

/** Input fields that the user directly controls */
const INPUT_FIELDS = new Set([
  'targetIncome', 'role', 'targetGDC', 'aumExisting', 'aumNew', 'aumTrailPct', 'overrideRate',
]);

/** Fields that are computed via cascade from inputs */
const CASCADE_FIELDS = new Set([
  'gdc_split', 'aum_split', 'affiliate_split', 'override_split', 'channel_split',
  'gdc_projected', 'aum_projected', 'affiliate_projected', 'override_projected', 'channel_projected',
  'totalProjected', 'totalGap',
]);

export function calcScenarioDiff(scenarios: {
  name: string;
  targetIncome: number;
  incomeSplits: IncomeSplits;
  enabledChannels: EnabledChannels;
  role: RoleId;
  targetGDC: number;
  aumExisting: number;
  aumNew: number;
  aumTrailPct: number;
  overrideRate: number;
  totalProjected: number;
  totalGap: number;
  channelProjections: { gdc: number; aum: number; affiliate: number; override: number; channel: number };
}[]): ScenarioDiffResult {
  if (scenarios.length < 2) {
    return { fields: [], divergentCount: 0, cascadeDrivenCount: 0, similarityScore: 100 };
  }

  const fieldDefs: { field: string; label: string; channel?: keyof EnabledChannels; extract: (s: typeof scenarios[0]) => number | string }[] = [
    { field: 'targetIncome', label: 'Target Income', extract: s => s.targetIncome },
    { field: 'role', label: 'Role', extract: s => s.role },
    { field: 'targetGDC', label: 'GDC Target', extract: s => s.targetGDC },
    { field: 'aumExisting', label: 'AUM Book', extract: s => s.aumExisting },
    { field: 'aumNew', label: 'New AUM/Year', extract: s => s.aumNew },
    { field: 'aumTrailPct', label: 'Trail %', extract: s => s.aumTrailPct },
    { field: 'overrideRate', label: 'Override Rate', extract: s => s.overrideRate },
    { field: 'gdc_split', label: 'GDC Split %', channel: 'gdc', extract: s => s.incomeSplits.gdc },
    { field: 'aum_split', label: 'AUM Split %', channel: 'aum', extract: s => s.incomeSplits.aum },
    { field: 'affiliate_split', label: 'Affiliate Split %', channel: 'affiliate', extract: s => s.incomeSplits.affiliate },
    { field: 'override_split', label: 'Override Split %', channel: 'override', extract: s => s.incomeSplits.override },
    { field: 'channel_split', label: 'Marketing Split %', channel: 'channel', extract: s => s.incomeSplits.channel },
    { field: 'gdc_projected', label: 'GDC Projected', channel: 'gdc', extract: s => s.channelProjections.gdc },
    { field: 'aum_projected', label: 'AUM Projected', channel: 'aum', extract: s => s.channelProjections.aum },
    { field: 'affiliate_projected', label: 'Affiliate Projected', channel: 'affiliate', extract: s => s.channelProjections.affiliate },
    { field: 'override_projected', label: 'Override Projected', channel: 'override', extract: s => s.channelProjections.override },
    { field: 'channel_projected', label: 'Marketing Projected', channel: 'channel', extract: s => s.channelProjections.channel },
    { field: 'totalProjected', label: 'Total Projected', extract: s => s.totalProjected },
    { field: 'totalGap', label: 'Total Gap', extract: s => s.totalGap },
  ];

  const fields: ScenarioDiffField[] = fieldDefs.map(fd => {
    const values = scenarios.map(s => fd.extract(s));
    const allSame = values.every(v => v === values[0]);
    let divergenceMagnitude = 0;
    if (!allSame) {
      const nums = values.filter(v => typeof v === 'number') as number[];
      if (nums.length >= 2) {
        const maxVal = Math.max(...nums.map(Math.abs));
        const range = Math.max(...nums) - Math.min(...nums);
        divergenceMagnitude = maxVal > 0 ? Math.round(range / maxVal * 100) : 0;
      } else {
        divergenceMagnitude = 100; // string values that differ
      }
    }

    // Determine if divergence is input-driven or cascade-driven
    let divergenceType: 'input' | 'cascade' | 'identical' = 'identical';
    if (!allSame) {
      divergenceType = INPUT_FIELDS.has(fd.field) ? 'input' : CASCADE_FIELDS.has(fd.field) ? 'cascade' : 'input';
    }

    return {
      field: fd.field,
      label: fd.label,
      channel: fd.channel,
      values,
      divergent: !allSame,
      divergenceMagnitude,
      divergenceType,
    };
  });

  const divergentCount = fields.filter(f => f.divergent).length;
  const cascadeDrivenCount = fields.filter(f => f.divergenceType === 'cascade').length;
  const similarityScore = Math.round((1 - divergentCount / fields.length) * 100);

  return { fields, divergentCount, cascadeDrivenCount, similarityScore };
}

/* ═══════════════════════════════════════════════════════════════
   PASS 96 — DRAG-TO-REBALANCE HELPERS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Calculate new splits when dragging a channel's split bar.
 * Redistributes the delta proportionally among other enabled channels.
 * Returns new splits that always sum to 100.
 */
export function dragRebalanceSplit(
  ch: keyof EnabledChannels,
  newPct: number,
  currentSplits: IncomeSplits,
  enabledChannels: EnabledChannels,
): IncomeSplits {
  const clamped = Math.max(0, Math.min(100, Math.round(newPct)));
  return redistributeSplits(ch, clamped, currentSplits, enabledChannels);
}

/* ═══════════════════════════════════════════════════════════════
   PASS 98 — CLIENT-PRACTICE CROSS-CASCADE ("Also My Client")
   ═══════════════════════════════════════════════════════════════ */

/**
 * When a user toggles "Also My Client", the client profile data cascades
 * INTO the practice planning engine to recognize holistic benefits.
 * This function calculates the practice-relevant metrics from client data.
 */
export interface ClientPracticeInputs {
  clientIncome: number;
  clientNetWorth: number;
  clientSavings: number;
  clientRetirement401k: number;
  clientAge: number;
  clientDep: number;
  clientMortgage: number;
  clientDebt: number;
  clientExistingInsurance: number;
  clientIsBiz: boolean;
  clientBizRevenue: number;
  clientBizEmployees: number;
  clientRiskTolerance: string;
}

export interface ClientPracticeOpportunity {
  /** Estimated AUM opportunity from client's investable assets */
  aumOpportunity: number;
  /** Estimated annual advisory fee from client AUM */
  advisoryFeeAnnual: number;
  /** Estimated insurance gap (protection need - existing) */
  insuranceGap: number;
  /** Estimated GDC from insurance gap */
  insuranceGDC: number;
  /** Business insurance opportunity (key person, buy-sell) */
  bizInsuranceGDC: number;
  /** Total estimated first-year GDC from this client */
  totalFirstYearGDC: number;
  /** Estimated recurring annual revenue from this client */
  recurringAnnual: number;
  /** Client lifetime value (10-year horizon) */
  clientLTV: number;
  /** Recommended channels based on client profile */
  recommendedChannels: string[];
  /** Opportunity score 0-100 */
  opportunityScore: number;
}

export function calcClientPracticeOpportunity(inputs: ClientPracticeInputs): ClientPracticeOpportunity {
  // AUM opportunity: investable assets = savings + 401k + (net worth - mortgage - debt) * 0.3
  const investableAssets = Math.max(0, inputs.clientSavings + inputs.clientRetirement401k +
    Math.max(0, (inputs.clientNetWorth - inputs.clientMortgage - inputs.clientDebt) * 0.3));
  const aumOpportunity = investableAssets;
  const advisoryFeeAnnual = Math.round(aumOpportunity * 0.01); // 1% advisory fee

  // Insurance gap: DIME method simplified
  const incomeReplacement = inputs.clientIncome * 10;
  const mortgagePayoff = inputs.clientMortgage;
  const debtPayoff = inputs.clientDebt;
  const education = inputs.clientDep * 50000;
  const totalNeed = incomeReplacement + mortgagePayoff + debtPayoff + education;
  const insuranceGap = Math.max(0, totalNeed - inputs.clientExistingInsurance);
  // Average GDC per $1000 of coverage: ~$15 for term, ~$50 for perm
  const avgGDCPer1000 = inputs.clientAge < 45 ? 20 : 35;
  const insuranceGDC = Math.round((insuranceGap / 1000) * avgGDCPer1000);

  // Business insurance opportunity
  let bizInsuranceGDC = 0;
  if (inputs.clientIsBiz) {
    // Key person insurance: 5-10x salary for key employees
    const keyPersonNeed = inputs.clientBizRevenue * 2;
    bizInsuranceGDC += Math.round((keyPersonNeed / 1000) * 30);
    // Group benefits: $800 GDC per employee
    bizInsuranceGDC += inputs.clientBizEmployees * 800;
  }

  const totalFirstYearGDC = insuranceGDC + bizInsuranceGDC;
  const recurringAnnual = advisoryFeeAnnual + Math.round(totalFirstYearGDC * 0.05); // 5% renewal
  const clientLTV = Math.round(totalFirstYearGDC + recurringAnnual * 10); // 10-year horizon

  // Recommended channels
  const recommendedChannels: string[] = [];
  if (insuranceGDC > 0) recommendedChannels.push('gdc');
  if (aumOpportunity > 100000) recommendedChannels.push('aum');
  if (inputs.clientIsBiz) recommendedChannels.push('override'); // team building opportunity
  if (inputs.clientIsBiz && inputs.clientBizEmployees > 5) recommendedChannels.push('channel');

  // Opportunity score
  let score = 0;
  if (inputs.clientIncome > 100000) score += 20;
  if (inputs.clientIncome > 250000) score += 10;
  if (investableAssets > 500000) score += 20;
  if (investableAssets > 1000000) score += 10;
  if (insuranceGap > 500000) score += 15;
  if (inputs.clientIsBiz) score += 15;
  if (inputs.clientDep > 0) score += 10;
  score = Math.min(100, score);

  return {
    aumOpportunity, advisoryFeeAnnual, insuranceGap, insuranceGDC,
    bizInsuranceGDC, totalFirstYearGDC, recurringAnnual, clientLTV,
    recommendedChannels, opportunityScore: score,
  };
}

/* ═══════════════════════════════════════════════════════════════
   PASS 98 — CASCADE CHAIN VISUALIZATION DATA
   ═══════════════════════════════════════════════════════════════ */

export interface CascadeNode {
  id: string;
  label: string;
  value: number;
  level: number; // 0 = root, 1 = channel, 2 = sub-input
  type: 'target' | 'split' | 'channel' | 'input' | 'output';
  color: string;
}

export interface CascadeEdge {
  from: string;
  to: string;
  label: string;
  direction: 'down' | 'up';
  active: boolean;
}

export interface CascadeChainData {
  nodes: CascadeNode[];
  edges: CascadeEdge[];
}

export function buildCascadeChain(
  plan: UnifiedIncomePlan,
  enabledChannels: EnabledChannels,
  splits: IncomeSplits,
  targetIncome: number,
): CascadeChainData {
  const nodes: CascadeNode[] = [];
  const edges: CascadeEdge[] = [];

  // Root node
  nodes.push({ id: 'target', label: 'Target Income', value: targetIncome, level: 0, type: 'target', color: '#f59e0b' });

  // Channel nodes
  const channelConfigs: { key: keyof EnabledChannels; label: string; color: string; subInputs: { id: string; label: string }[] }[] = [
    { key: 'gdc', label: 'GDC Production', color: '#22c55e', subInputs: [
      { id: 'targetGDC', label: 'Target GDC' },
      { id: 'approaches', label: 'Daily Approaches' },
      { id: 'bracketRate', label: 'Bracket Rate' },
    ]},
    { key: 'aum', label: 'AUM/Advisory', color: '#3b82f6', subInputs: [
      { id: 'aumBook', label: 'AUM Book' },
      { id: 'trailPct', label: 'Trail %' },
      { id: 'overrideRate', label: 'Override Rate' },
    ]},
    { key: 'affiliate', label: 'Affiliate Income', color: '#a855f7', subInputs: [
      { id: 'affCounts', label: 'Affiliate Counts' },
      { id: 'affProduction', label: 'Avg Production' },
    ]},
    { key: 'override', label: 'Team Override', color: '#f97316', subInputs: [
      { id: 'teamSize', label: 'Team Size' },
      { id: 'teamAvgGDC', label: 'Team Avg GDC' },
      { id: 'ovrRate', label: 'Override Rate' },
    ]},
    { key: 'channel', label: 'Marketing', color: '#06b6d4', subInputs: [
      { id: 'channelSpend', label: 'Monthly Spend' },
      { id: 'channelROI', label: 'Channel ROI' },
    ]},
  ];

  for (const cfg of channelConfigs) {
    if (!enabledChannels[cfg.key]) continue;
    const splitPct = splits[cfg.key];
    const chTarget = Math.round(targetIncome * splitPct / 100);
    const chId = `ch_${cfg.key}`;

    nodes.push({ id: chId, label: cfg.label, value: chTarget, level: 1, type: 'channel', color: cfg.color });
    edges.push({ from: 'target', to: chId, label: `${splitPct}%`, direction: 'down', active: splitPct > 0 });

    // Sub-input nodes
    for (const sub of cfg.subInputs) {
      const subId = `${cfg.key}_${sub.id}`;
      nodes.push({ id: subId, label: sub.label, value: 0, level: 2, type: 'input', color: cfg.color });
      edges.push({ from: chId, to: subId, label: '', direction: 'down', active: true });
    }

    // Output node (projected)
    const projId = `${cfg.key}_projected`;
    let projected = 0;
    if (cfg.key === 'gdc') projected = plan.channels.gdc.projected;
    else if (cfg.key === 'aum') projected = plan.channels.aum.detail.projectedIncome;
    else if (cfg.key === 'affiliate') projected = plan.channels.affiliate.totalProjected;
    else if (cfg.key === 'override') projected = plan.channels.override.detail.projectedIncome;
    else if (cfg.key === 'channel') projected = plan.channels.channel.detail.projectedAnnualRevenue;
    nodes.push({ id: projId, label: 'Projected', value: projected, level: 2, type: 'output', color: cfg.color });
    edges.push({ from: projId, to: chId, label: '', direction: 'up', active: true });
  }

  // Total projected node
  nodes.push({ id: 'totalProjected', label: 'Total Projected', value: plan.totalProjected, level: 0, type: 'output', color: '#22c55e' });
  for (const cfg of channelConfigs) {
    if (!enabledChannels[cfg.key]) continue;
    edges.push({ from: `${cfg.key}_projected`, to: 'totalProjected', label: '', direction: 'up', active: true });
  }

  return { nodes, edges };
}

/* ═══════════════════════════════════════════════════════════════
   PASS 98 — INTERACTIVE PLANNING HORIZON HELPERS
   ═══════════════════════════════════════════════════════════════ */

export interface PlanningHorizonPoint {
  month: number;
  label: string;
  cumulativeIncome: number;
  cumulativeTarget: number;
  gdc: number;
  aum: number;
  affiliate: number;
  override: number;
  channel: number;
  milestone: string | null;
  onTrack: boolean;
}

export function calcPlanningHorizon(
  plan: UnifiedIncomePlan,
  targetIncome: number,
  enabledChannels: EnabledChannels,
  horizonMonths: number = 36,
  role: RoleId = 'new',
): PlanningHorizonPoint[] {
  const ramp = RAMP_CURVES[role] || RAMP_CURVES.new;
  const points: PlanningHorizonPoint[] = [];
  let cumIncome = 0;
  let cumTarget = 0;
  const monthlyTarget = targetIncome / 12;

  for (let m = 1; m <= horizonMonths; m++) {
    const rampIdx = Math.min(m - 1, ramp.length - 1);
    const rampFactor = ramp[rampIdx];
    const seasonIdx = (m - 1) % 12;
    const seasonFactor = SEASONAL_FACTORS[seasonIdx];
    const factor = rampFactor * seasonFactor;

    const gdc = enabledChannels.gdc ? Math.round(plan.channels.gdc.projected / 12 * factor) : 0;
    const aum = enabledChannels.aum ? Math.round(plan.channels.aum.detail.projectedIncome / 12 * Math.min(1, rampFactor * 1.2)) : 0;
    const affiliate = enabledChannels.affiliate ? Math.round(plan.channels.affiliate.totalProjected / 12 * factor) : 0;
    const override = enabledChannels.override ? Math.round(plan.channels.override.detail.projectedIncome / 12 * factor) : 0;
    const channel = enabledChannels.channel ? Math.round(plan.channels.channel.detail.projectedAnnualRevenue / 12 * factor) : 0;
    const monthTotal = gdc + aum + affiliate + override + channel;

    cumIncome += monthTotal;
    cumTarget += monthlyTarget;

    // Milestones
    let milestone: string | null = null;
    if (m === 3) milestone = 'Q1 Review';
    else if (m === 6) milestone = 'Mid-Year';
    else if (m === 12) milestone = 'Year 1';
    else if (m === 24) milestone = 'Year 2';
    else if (m === 36) milestone = 'Year 3';
    else if (cumIncome >= cumTarget && m > 1 && points[m - 2] && points[m - 2].cumulativeIncome < points[m - 2].cumulativeTarget) {
      milestone = 'Breakeven';
    }

    points.push({
      month: m,
      label: `M${m}`,
      cumulativeIncome: cumIncome,
      cumulativeTarget: cumTarget,
      gdc, aum, affiliate, override, channel,
      milestone,
      onTrack: cumIncome >= cumTarget * 0.9,
    });
  }

  return points;
}

/* ═══ PASS 100: ROLL-UP UNIFICATION & P&L ═══ */

/** Unified P&L statement combining all income channels */
export interface UnifiedPnL {
  /* Revenue lines */
  gdcRevenue: number;
  aumRevenue: number;
  affiliateRevenue: number;
  overrideRevenue: number;
  channelRevenue: number;
  totalRevenue: number;
  /* Cost lines */
  gdcCOGS: number;
  aumCOGS: number;
  affiliateCOGS: number;
  overrideCOGS: number;
  channelCOGS: number;
  totalCOGS: number;
  /* Margins */
  grossProfit: number;
  grossMarginPct: number;
  /* Operating expenses */
  opEx: number;
  ebitda: number;
  ebitdaMarginPct: number;
  /* Tax & net */
  estimatedTax: number;
  netIncome: number;
  netMarginPct: number;
  /* Per-channel breakdown */
  channelBreakdown: { channel: string; revenue: number; cogs: number; margin: number; marginPct: number; pctOfTotal: number }[];
  /* GDC bracket analysis */
  currentBracket: GDCBracket;
  nextBracket: GDCBracket | null;
  gdcToNextBracket: number;
  bracketLift: number; // additional income from reaching next bracket
}

/** Calculate unified P&L from a completed income plan */
export function calcUnifiedPnL(plan: UnifiedIncomePlan, economics: ChannelEconomics[], taxRate: number = 0.25, opExPct: number = 0.15): UnifiedPnL {
  const gdcRev = plan.channels.gdc.projected;
  const aumRev = plan.channels.aum.detail.projectedIncome;
  const affRev = plan.channels.affiliate.totalProjected;
  const ovrRev = plan.channels.override.detail.projectedIncome;
  const chRev = plan.channels.channel.detail.projectedAnnualRevenue;
  const totalRev = gdcRev + aumRev + affRev + ovrRev + chRev;

  // COGS from economics or defaults
  const ecoMap = new Map(economics.map(e => [e.channel, e]));
  const gdcCOGS = ecoMap.get('gdc')?.cogsDollar ?? Math.round(gdcRev * 0.35);
  const aumCOGS = ecoMap.get('aum')?.cogsDollar ?? Math.round(aumRev * 0.25);
  const affCOGS = ecoMap.get('affiliate')?.cogsDollar ?? Math.round(affRev * 0.40);
  const ovrCOGS = ecoMap.get('override')?.cogsDollar ?? Math.round(ovrRev * 0.15);
  const chCOGS = ecoMap.get('channel')?.cogsDollar ?? Math.round(chRev * 0.45);
  const totalCOGS = gdcCOGS + aumCOGS + affCOGS + ovrCOGS + chCOGS;

  const grossProfit = totalRev - totalCOGS;
  const grossMarginPct = totalRev > 0 ? Math.round(grossProfit / totalRev * 100) : 0;

  const opEx = Math.round(totalRev * opExPct);
  const ebitda = grossProfit - opEx;
  const ebitdaMarginPct = totalRev > 0 ? Math.round(ebitda / totalRev * 100) : 0;

  const estimatedTax = Math.round(Math.max(0, ebitda) * taxRate);
  const netIncome = ebitda - estimatedTax;
  const netMarginPct = totalRev > 0 ? Math.round(netIncome / totalRev * 100) : 0;

  const channels = [
    { channel: 'GDC', revenue: gdcRev, cogs: gdcCOGS },
    { channel: 'AUM', revenue: aumRev, cogs: aumCOGS },
    { channel: 'Affiliate', revenue: affRev, cogs: affCOGS },
    { channel: 'Override', revenue: ovrRev, cogs: ovrCOGS },
    { channel: 'Channel', revenue: chRev, cogs: chCOGS },
  ];

  const channelBreakdown = channels.map(c => ({
    channel: c.channel,
    revenue: c.revenue,
    cogs: c.cogs,
    margin: c.revenue - c.cogs,
    marginPct: c.revenue > 0 ? Math.round((c.revenue - c.cogs) / c.revenue * 100) : 0,
    pctOfTotal: totalRev > 0 ? Math.round(c.revenue / totalRev * 100) : 0,
  }));

  // GDC bracket analysis
  const totalGDC = gdcRev; // GDC production is the bracket determinant
  const currentBracket = getBracket(totalGDC);
  const currentIdx = GDC_BRACKETS.indexOf(currentBracket);
  const nextBracket = currentIdx < GDC_BRACKETS.length - 1 ? GDC_BRACKETS[currentIdx + 1] : null;
  const gdcToNextBracket = nextBracket ? Math.max(0, nextBracket.mn - totalGDC) : 0;
  const bracketLift = nextBracket ? Math.round(totalGDC * (nextBracket.r - currentBracket.r)) : 0;

  return {
    gdcRevenue: gdcRev, aumRevenue: aumRev, affiliateRevenue: affRev,
    overrideRevenue: ovrRev, channelRevenue: chRev, totalRevenue: totalRev,
    gdcCOGS, aumCOGS, affiliateCOGS: affCOGS, overrideCOGS: ovrCOGS, channelCOGS: chCOGS, totalCOGS,
    grossProfit, grossMarginPct,
    opEx, ebitda, ebitdaMarginPct,
    estimatedTax, netIncome, netMarginPct,
    channelBreakdown,
    currentBracket, nextBracket, gdcToNextBracket, bracketLift,
  };
}

/** Combined chart data for roll-up visualization */
export interface RollUpChartData {
  labels: string[];
  datasets: { label: string; data: number[]; color: string }[];
  totals: number[];
  targetLine: number[];
}

/** Generate combined chart data from time-phased projections */
export function calcRollUpChartData(
  points: MonthlyProjection[],
  targetIncome: number,
  viewMode: 'monthly' | 'quarterly' | 'annual' = 'monthly'
): RollUpChartData {
  if (!points || points.length === 0) {
    return { labels: [], datasets: [], totals: [], targetLine: [] };
  }
  if (viewMode === 'quarterly') {
    const quarters: { label: string; gdc: number; aum: number; affiliate: number; override: number; channel: number }[] = [];
    for (let q = 0; q < Math.ceil(points.length / 3); q++) {
      const slice = points.slice(q * 3, q * 3 + 3);
      quarters.push({
        label: `Q${q + 1}`,
        gdc: slice.reduce((s, p) => s + p.gdc, 0),
        aum: slice.reduce((s, p) => s + p.aum, 0),
        affiliate: slice.reduce((s, p) => s + p.affiliate, 0),
        override: slice.reduce((s, p) => s + p.override, 0),
        channel: slice.reduce((s, p) => s + p.channel, 0),
      });
    }
    return {
      labels: quarters.map(q => q.label),
      datasets: [
        { label: 'GDC', data: quarters.map(q => q.gdc), color: '#3b82f6' },
        { label: 'AUM', data: quarters.map(q => q.aum), color: '#10b981' },
        { label: 'Affiliate', data: quarters.map(q => q.affiliate), color: '#f59e0b' },
        { label: 'Override', data: quarters.map(q => q.override), color: '#8b5cf6' },
        { label: 'Channel', data: quarters.map(q => q.channel), color: '#ec4899' },
      ],
      totals: quarters.map(q => q.gdc + q.aum + q.affiliate + q.override + q.channel),
      targetLine: quarters.map(() => Math.round(targetIncome / 4)),
    };
  }

  if (viewMode === 'annual') {
    const years: { label: string; gdc: number; aum: number; affiliate: number; override: number; channel: number }[] = [];
    for (let y = 0; y < Math.ceil(points.length / 12); y++) {
      const slice = points.slice(y * 12, y * 12 + 12);
      years.push({
        label: `Year ${y + 1}`,
        gdc: slice.reduce((s, p) => s + p.gdc, 0),
        aum: slice.reduce((s, p) => s + p.aum, 0),
        affiliate: slice.reduce((s, p) => s + p.affiliate, 0),
        override: slice.reduce((s, p) => s + p.override, 0),
        channel: slice.reduce((s, p) => s + p.channel, 0),
      });
    }
    return {
      labels: years.map(y => y.label),
      datasets: [
        { label: 'GDC', data: years.map(y => y.gdc), color: '#3b82f6' },
        { label: 'AUM', data: years.map(y => y.aum), color: '#10b981' },
        { label: 'Affiliate', data: years.map(y => y.affiliate), color: '#f59e0b' },
        { label: 'Override', data: years.map(y => y.override), color: '#8b5cf6' },
        { label: 'Channel', data: years.map(y => y.channel), color: '#ec4899' },
      ],
      totals: years.map(y => y.gdc + y.aum + y.affiliate + y.override + y.channel),
      targetLine: years.map(() => targetIncome),
    };
  }

  // Monthly (default)
  return {
    labels: points.map(p => p.label),
    datasets: [
      { label: 'GDC', data: points.map(p => p.gdc), color: '#3b82f6' },
      { label: 'AUM', data: points.map(p => p.aum), color: '#10b981' },
      { label: 'Affiliate', data: points.map(p => p.affiliate), color: '#f59e0b' },
      { label: 'Override', data: points.map(p => p.override), color: '#8b5cf6' },
      { label: 'Channel', data: points.map(p => p.channel), color: '#ec4899' },
    ],
    totals: points.map(p => p.gdc + p.aum + p.affiliate + p.override + p.channel),
    targetLine: points.map(() => Math.round(targetIncome / 12)),
  };
}

/* ═══ CONFIGURABLE DEFAULTS (Continuous Improvement Architecture) ═══ */

/** All engine defaults in one place — no hardcoded values scattered in UI */
export interface EngineConfig {
  /* Funnel defaults */
  defaultFunnelRates: { ap: number; sh: number; cl: number; pl: number };
  /* AUM defaults */
  defaultAumTrailPct: number;
  defaultAumOverrideRate: number;
  /* Affiliate defaults */
  defaultAffMode: AffiliateMode;
  /* Override defaults */
  defaultOverrideRate: number;
  /* Channel spend defaults */
  defaultChannelSpend: Record<string, number>;
  /* P&L defaults */
  defaultTaxRate: number;
  defaultOpExPct: number;
  /* Planning horizon */
  defaultHorizonMonths: number;
  /* Progressive disclosure */
  defaultComplexity: 'simple' | 'intermediate' | 'comprehensive';
}

/** Default engine configuration — override per-org or per-user */
export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  defaultFunnelRates: { ap: 20, sh: 60, cl: 50, pl: 40 },
  defaultAumTrailPct: 1.0,
  defaultAumOverrideRate: 90,
  defaultAffMode: 'recruiter',
  defaultOverrideRate: 10,
  defaultChannelSpend: {
    'Social Media': 500, 'SEO/Content': 300, 'Paid Ads': 800,
    'Email Marketing': 200, 'Events/Seminars': 1000, 'Referral Program': 400,
  },
  defaultTaxRate: 0.25,
  defaultOpExPct: 0.15,
  defaultHorizonMonths: 36,
  defaultComplexity: 'intermediate',
};

/** Merge user overrides with defaults */
export function mergeEngineConfig(overrides: Partial<EngineConfig>): EngineConfig {
  return { ...DEFAULT_ENGINE_CONFIG, ...overrides };
}

// Re-export removed — consumers import directly from './format' to avoid TDZ
