/* ═══════════════════════════════════════════════════════════════
   WealthBridge Business Income Engine (BIE) — Practice Planning
   Ported from WealthBridge-Business-Calculator-v7
   ═══════════════════════════════════════════════════════════════ */

import { fmt, fmtSm, pct } from './engine';

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
}
export const ROLE_DEFAULTS: Record<string, RoleDefaults> = {
  new: {p:1,wb:70,mo:10,ap:.15,sh:.75,cl:.30,pl:.80,mix:{term:30,iul:20,rapid:15,wl:10,fia:10,group:15}},
  exp: {p:1,wb:60,mo:11,ap:.20,sh:.85,cl:.45,pl:.85,mix:{iul:30,fia:20,wl:15,term:10,pf:5,exec:10,group:10}},
  sa:  {p:1,wb:65,mo:11,ap:.18,sh:.82,cl:.40,pl:.83,mix:{iul:28,fia:18,wl:12,term:12,rapid:10,group:12,exec:8}},
  dir: {p:1,wb:60,mo:12,ap:.22,sh:.85,cl:.45,pl:.85,mix:{iul:30,fia:20,wl:15,pf:8,exec:12,group:15}},
  md:  {p:1,wb:60,mo:12,ap:.22,sh:.85,cl:.45,pl:.85,mix:{iul:30,fia:20,wl:15,pf:8,exec:12,group:15}},
  rvp: {p:1,wb:50,mo:12,ap:.25,sh:.90,cl:.50,pl:.85,mix:{iul:25,fia:20,pf:15,exec:20,wl:10,group:10}},
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
  const recOpEx = Math.round(tHires * 2000);
  const recEBITDA = tOvr - recOpEx;
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
  let g = avgGDC;
  if (netGoal && netGoal > 0) {
    const revNeeded = Math.round(netGoal / (1 - taxRate)) + opEx + Math.round(netGoal / (1 - taxRate) * payoutRate / (1 - payoutRate));
    g = level === 'ind' ? revNeeded : Math.round(revNeeded / numProducers);
  } else if (ebitGoal && ebitGoal > 0) {
    const revNeeded = Math.round((ebitGoal + opEx) / (1 - payoutRate));
    g = level === 'ind' ? revNeeded : Math.round(revNeeded / numProducers);
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
  mktgSpend: number; mktgRev: number; mktgLeads: number; mktgClients: number;
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

export { fmt, fmtSm, pct };
