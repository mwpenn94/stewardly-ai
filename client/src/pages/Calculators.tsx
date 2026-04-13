import{useState,useMemo,useCallback}from"react";
import{useAuth}from"@/_core/hooks/useAuth";

/* ═══════════════════════════════════════════════════════════════════
   WealthBridge Client Calculator Suite v7 — Faithful React Translation
   13 panels, in-page sidebar navigation, same inputs/calcs/tables
   ═══════════════════════════════════════════════════════════════════ */

type PanelId="profile"|"cash"|"protect"|"grow"|"retire"|"tax"|"estate"|"edu"|"costben"|"compare"|"summary"|"timeline"|"refs";
interface Rec{c:string;p:string;cv:string;pr:number;wb:string;pri:string}

// ── RATES (v7 HTML) ──
const RATES={
  termPer100K:[{age:20,rate:31},{age:25,rate:33},{age:30,rate:35},{age:35,rate:42},{age:40,rate:56},{age:45,rate:78},{age:50,rate:135},{age:55,rate:195},{age:60,rate:377},{age:65,rate:620},{age:70,rate:1557}],
  iulPer100K:[{age:20,rate:480},{age:25,rate:540},{age:30,rate:660},{age:35,rate:840},{age:40,rate:1080},{age:45,rate:1380},{age:50,rate:1800},{age:55,rate:2400},{age:60,rate:3240},{age:65,rate:4500}],
  wlPer100K:[{age:20,rate:603},{age:25,rate:720},{age:30,rate:862},{age:35,rate:1020},{age:40,rate:1277},{age:45,rate:1620},{age:50,rate:2014},{age:55,rate:2580},{age:60,rate:3360},{age:65,rate:4500}],
  diPctBenefit:[{age:25,rate:.020},{age:30,rate:.022},{age:35,rate:.025},{age:40,rate:.030},{age:45,rate:.038},{age:50,rate:.048},{age:55,rate:.060},{age:60,rate:.080}],
  ltcAnnual:[{age:40,rate:2400},{age:45,rate:3200},{age:50,rate:4200},{age:55,rate:5600},{age:60,rate:7800},{age:65,rate:10800},{age:70,rate:15600}],
};
function interpRate(t:{age:number;rate:number}[],age:number):number{
  if(age<=t[0].age)return t[0].rate;if(age>=t[t.length-1].age)return t[t.length-1].rate;
  for(let i=0;i<t.length-1;i++){if(age>=t[i].age&&age<=t[i+1].age){const p=(age-t[i].age)/(t[i+1].age-t[i].age);const r=t[i].rate+(t[i+1].rate-t[i].rate)*p;return r>=1?Math.round(r):r;}}
  return t[t.length-1].rate;
}
function estPrem(type:string,age:number,amt:number):number{
  if(amt<=0)return 0;
  switch(type){case"term":return Math.round(interpRate(RATES.termPer100K,age)*(amt/100000));case"iul":return Math.round(interpRate(RATES.iulPer100K,age)*(amt/100000));case"wl":return Math.round(interpRate(RATES.wlPer100K,age)*(amt/100000));case"di":return Math.round(interpRate(RATES.diPctBenefit,age)*amt);case"ltc":return Math.round(interpRate(RATES.ltcAnnual,age)*(amt/150000));default:return 0;}
}
function fmt(n:number|null|undefined):string{if(n==null||!isFinite(n))return"\u2014";if(Math.abs(n)>=1e6)return"$"+(n/1e6).toFixed(1)+"M";return"$"+Math.round(n).toLocaleString();}
function fmtSm(n:number|null|undefined):string{if(n==null||!isFinite(n))return"\u2014";const a=Math.abs(n),s=n<0?"-":"";if(a>=1e9)return s+"$"+(a/1e9).toFixed(1)+"B";if(a>=1e6){const m=a/1e6;return s+"$"+(m>=10?Math.round(m):m.toFixed(1))+"M";}if(a>=10000)return s+"$"+Math.round(a/1e3)+"K";if(a>=1000){const k=a/1e3;return s+"$"+(k%1===0?k.toFixed(0):k.toFixed(1))+"K";}return s+"$"+Math.round(a);}
function pct(n:number):string{if(!isFinite(n))return"\u2014";return(n*100).toFixed(1)+"%";}
function fv(p:number,m:number,r:number,y:number):number{const rm=r/12;if(rm===0)return p+m*y*12;return p*Math.pow(1+rm,y*12)+m*(Math.pow(1+rm,y*12)-1)/rm;}
function sc(v:number):string{return v>=3?"Strong":v>=2?"Moderate":"Needs Attention";}
function scCls(v:number):string{return v>=3?"text-green-600":v>=2?"text-yellow-600":"text-red-600";}
function scBg(v:number):string{return v>=3?"bg-green-100 text-green-800":v>=2?"bg-yellow-100 text-yellow-800":"bg-red-100 text-red-800";}

// ── NAV ──
const NAV_SECTIONS=[
  {label:"Your Profile",items:[{id:"profile" as PanelId,icon:"\uD83D\uDC64",label:"Client Profile"}]},
  {label:"Planning Domains",items:[{id:"cash" as PanelId,icon:"\uD83D\uDCB5",label:"Cash Flow"},{id:"protect" as PanelId,icon:"\uD83D\uDEE1\uFE0F",label:"Protection"},{id:"grow" as PanelId,icon:"\uD83D\uDCC8",label:"Growth"},{id:"retire" as PanelId,icon:"\uD83C\uDFD6\uFE0F",label:"Retirement"},{id:"tax" as PanelId,icon:"\uD83D\uDCB0",label:"Tax Planning"},{id:"estate" as PanelId,icon:"\uD83C\uDFDB\uFE0F",label:"Estate"},{id:"edu" as PanelId,icon:"\uD83C\uDF93",label:"Education"}]},
  {label:"Analysis",items:[{id:"costben" as PanelId,icon:"\uD83D\uDCCA",label:"Cost-Benefit"},{id:"compare" as PanelId,icon:"\uD83D\uDD00",label:"Strategy Compare"},{id:"summary" as PanelId,icon:"\uD83D\uDCCB",label:"Summary"},{id:"timeline" as PanelId,icon:"\uD83D\uDCC5",label:"Action Plan"}]},
  {label:"Resources",items:[{id:"refs" as PanelId,icon:"\uD83D\uDCDA",label:"References"}]},
];

// ── SMALL COMPONENTS ──
function FI({label,value,onChange,step,hint,type="number",options}:{label:string;value:number|string;onChange:(v:any)=>void;step?:string;hint?:string;type?:string;options?:{value:string;label:string}[]}){
  if(type==="select"&&options)return(<div className="space-y-1"><label className="text-xs font-semibold text-slate-600">{label}</label><select value={value} onChange={e=>onChange(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400">{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>{hint&&<div className="text-[10px] text-slate-400">{hint}</div>}</div>);
  if(type==="checkbox")return(<div className="flex items-center gap-2"><input type="checkbox" checked={!!value} onChange={e=>onChange(e.target.checked)} className="accent-amber-500"/><label className="text-xs font-semibold text-slate-600">{label}</label></div>);
  return(<div className="space-y-1"><label className="text-xs font-semibold text-slate-600">{label}</label><input type="number" value={value} step={step||"1"} onChange={e=>onChange(parseFloat(e.target.value)||0)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400"/>{hint&&<div className="text-[10px] text-slate-400">{hint}</div>}</div>);
}
function RS({label,value,onChange,min,max,step,display,hint}:{label:string;value:number;onChange:(v:number)=>void;min:number;max:number;step:number;display:string;hint?:string}){
  return(<div className="space-y-1"><label className="text-xs font-semibold text-slate-600">{label}</label><input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(parseFloat(e.target.value))} className="w-full accent-amber-500"/><div className="flex justify-between text-[10px] text-slate-400"><span>{min}</span><span className="font-bold text-slate-800 text-sm">{display}</span><span>{max}</span></div>{hint&&<div className="text-[10px] text-slate-400">{hint}</div>}</div>);
}
function RB({items}:{items:[string,string,string][]}){
  return(<div className="flex flex-wrap gap-2 mt-3">{items.map(([l,v,c],i)=>(<div key={i} className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-100 text-center min-w-[80px]"><div className="text-[10px] text-slate-500 uppercase tracking-wide">{l}</div><div className={`text-sm font-bold ${c==="grn"?"text-green-600":c==="red"?"text-red-600":c==="gld"?"text-amber-600":c==="blu"?"text-blue-600":"text-slate-800"}`}>{v}</div></div>))}</div>);
}
function RefTip({text,src}:{text:string;src:string}){
  const[o,setO]=useState(false);
  return(<span className="relative inline-block ml-1"><button onClick={()=>setO(!o)} className="w-4 h-4 rounded-full bg-slate-200 text-[10px] font-bold text-slate-600 hover:bg-amber-200">i</button>{o&&<div className="absolute z-50 left-0 top-6 w-64 p-3 bg-white border border-slate-200 rounded-lg shadow-lg text-xs text-slate-600 leading-relaxed">{text}<div className="mt-1 text-[10px] text-amber-600 font-medium">{src}</div><button onClick={()=>setO(false)} className="absolute top-1 right-2 text-slate-400 hover:text-slate-600">&times;</button></div>}</span>);
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function Calculators(){
  const{user}=useAuth();
  const[activePanel,setActivePanel]=useState<PanelId>("profile");
  const[sidebarOpen,setSidebarOpen]=useState(false);

  // ── PROFILE (v7: cAge, cSpA, cInc, cNW, cSav, cMS, cME, cDep, cHm, cMort, cDebt, cBiz, c401, cExI, cFil) ──
  const[cAge,setCAge]=useState(40);const[cSpA,setCSpA]=useState(38);
  const[cInc,setCInc]=useState(120000);const[cNW,setCNW]=useState(500000);
  const[cDep,setCDep]=useState(2);const[cSav,setCSav]=useState(80000);const[cMS,setCMS]=useState(1500);
  const[cME,setCME]=useState(6000);const[cExI,setCExI]=useState(250000);const[cMort,setCMort]=useState(300000);
  const[cDebt,setCDebt]=useState(500);const[cHm,setCHm]=useState("yes");const[cBiz,setCBiz]=useState("no");
  const[c401,setC401]=useState("yes");const[cFil,setCFil]=useState("mfj");

  // ── CASH FLOW ──
  const[cfG,setCfG]=useState(10000);const[cfT,setCfT]=useState(25);const[cfH,setCfH]=useState(2500);
  const[cfTr,setCfTr]=useState(600);const[cfFd,setCfFd]=useState(800);const[cfIs,setCfIs]=useState(400);
  const[cfDp,setCfDp]=useState(500);const[cfOt,setCfOt]=useState(700);const[cfEm,setCfEm]=useState(6);

  // ── PROTECTION ──
  const[prY,setPrY]=useState(20);const[prP,setPrP]=useState(80);const[prE,setPrE]=useState(50000);
  const[prF,setPrF]=useState(15000);const[prSS,setPrSS]=useState(24000);const[prDI,setPrDI]=useState(60);
  const[prL,setPrL]=useState(300);const[prLY,setPrLY]=useState(3);const[prLI,setPrLI]=useState(4);

  // ── GROWTH ──
  const[grR,setGrR]=useState(65);const[grM,setGrM]=useState(1200);const[grE,setGrE]=useState(180000);
  const[grI,setGrI]=useState(3);const[grTx,setGrTx]=useState(7);const[gr4,setGr4]=useState(7);
  const[grRo,setGrRo]=useState(7);const[grIU,setGrIU]=useState(6);const[grFA,setGrFA]=useState(4.5);
  const[grTN,setGrTN]=useState(24);const[grTR,setGrTR]=useState(22);

  // ── RETIREMENT ──
  const[rtA,setRtA]=useState(65);const[rtI,setRtI]=useState(96000);const[rtW,setRtW]=useState(3.9);
  const[rtS62,setRtS62]=useState(21000);const[rtS67,setRtS67]=useState(30000);const[rtS70,setRtS70]=useState(37200);
  const[rtP,setRtP]=useState(0);const[rtMode,setRtMode]=useState<"goal"|"smooth"|"guard">("goal");
  const[rtRisk,setRtRisk]=useState(50);

  // ── TAX ──
  const[txM,setTxM]=useState(24);const[txS,setTxS]=useState(4);const[tx4,setTx4]=useState(20000);
  const[txR,setTxR]=useState(7000);const[txH,setTxH]=useState(3850);const[txC,setTxC]=useState(2000);

  // ── ESTATE ──
  const[esV,setEsV]=useState(500000);const[esL,setEsL]=useState(500000);
  const[esW,setEsW]=useState("no");const[esI,setEsI]=useState("no");

  // ── EDUCATION ──
  const[edK,setEdK]=useState(2);const[edA,setEdA]=useState(8);const[ed5,setEd5]=useState(20000);
  const[edMo,setEdMo]=useState(300);const[edT,setEdT]=useState(120000);const[edG,setEdG]=useState(6);const[edI,setEdI]=useState(5);

  // ── COST-BENEFIT ──
  const[cbHorizon,setCbHorizon]=useState(30);

  // ── WHAT-IF ──
  const[wiRetAge,setWiRetAge]=useState(65);const[wiSavRate,setWiSavRate]=useState(15);
  const[wiReturn,setWiReturn]=useState(7);const[wiInflation,setWiInflation]=useState(3);
  const[wiSSAge,setWiSSAge]=useState(70);const[wiMoSav,setWiMoSav]=useState(1500);
  const[wiPracGrowth,setWiPracGrowth]=useState(8);const[wiRecruits,setWiRecruits]=useState(2);const[wiRetention,setWiRetention]=useState(85);

  // ── STRATEGY COMPARE ──
  const[pReturnRate,setPReturnRate]=useState(7);const[pSavingsRate,setPSavingsRate]=useState(15);
  const[pInflation,setPInflation]=useState(3);const[pHorizon,setPHorizon]=useState(30);
  const[pTargetIncome,setPTargetIncome]=useState(0);
  // Income Streams & Business
  const[scRole,setScRole]=useState("advisor");const[scSeason,setScSeason]=useState("none");
  const[scGDC,setScGDC]=useState(250000);const[scTeam,setScTeam]=useState(3);const[scOverride,setScOverride]=useState(5);
  const[scAffiliate,setScAffiliate]=useState(0);const[scPartner,setScPartner]=useState(0);const[scAUM,setScAUM]=useState(0);

  // ── ACTION PLAN ──
  const[tlPace,setTlPace]=useState<"standard"|"aggressive"|"gradual">("standard");

  // ═══ ALL CALCULATIONS (v7-faithful) ═══
  const R=useMemo(()=>{
    const ss={cash:0,protect:0,growth:0,retire:0,tax:0,estate:0,edu:0};
    const age=cAge,inc=cInc,nw=cNW,dep=cDep,sav=cSav,moSav=cMS;
    const isHm=cHm==="yes",isBiz=cBiz==="yes",has401=c401==="yes",hasWill=esW==="yes",hasILIT=esI==="yes";

    // ── CASH FLOW (calcCF) ──
    const cfNet=Math.round(cfG*(1-cfT/100));
    const cfExp=cfH+cfTr+cfFd+cfIs+cfDp+cfOt;
    const cfSurplus=cfNet-cfExp;
    const cfSaveRate=cfG>0?cfSurplus/cfG:0;
    const cfDti=cfG>0?(cfH+cfDp)/cfG:0;
    const cfEmTarget=cfEm*cME;
    const cfEmGap=Math.max(0,cfEmTarget-Math.min(sav,cfEmTarget));
    ss.cash=cfSaveRate>=.15?3:cfSaveRate>=.10?2:1;

    // ── PROTECTION (calcPR) ──
    const dime=cMort+cDebt*12+Math.round(inc*(prP/100)*prY-prSS*prY)+dep*prE+prF;
    const lifeGap=Math.max(0,dime-cExI);
    const diNeed=Math.round(inc*(prDI/100)),diGap=Math.max(0,diNeed);
    const ltcFuture=Math.round(prL*Math.pow(1+prLI/100,Math.max(0,65-age)));
    const ltcTotal=ltcFuture*365*prLY;
    ss.protect=lifeGap<=0&&diGap<=0?3:lifeGap<inc*5?2:1;
    const termAmt=lifeGap>0?Math.round(lifeGap*.6):0;
    const iulAmt=lifeGap>0?Math.round(lifeGap*.4):0;
    const termPrem=estPrem("term",age,termAmt);
    const iulPrem=estPrem("iul",age,iulAmt);
    const diPrem=estPrem("di",age,diGap);
    const ltcPrem=ltcTotal>0?estPrem("ltc",age,ltcTotal):0;
    const totalProtPrem=termPrem+iulPrem+diPrem+ltcPrem;
    const protPctInc=inc>0?totalProtPrem/inc:0;

    // ── GROWTH (calcGR) ──
    const grYrs=Math.max(1,grR-age);
    const grRates={tx:grTx/100,k:gr4/100,ro:grRo/100,iu:grIU/100,fa:grFA/100};
    const grIF=Math.pow(1+grI/100,grYrs);
    type VC={name:string;rate:number;fv:number;at:number;real:number;taxEdge:number};
    const vehicles:VC[]=[];
    const vd:[string,number,number,number,(f:number,c:number)=>number][]=[
      ["Taxable",grRates.tx,grE,grM,(f,c)=>c+(f-c)*(1-.15)],
      ["401k",grRates.k,grE,grM,(f)=>f*(1-grTR/100)],
      ["Roth",grRates.ro,grE*.3,grM*.3,(f)=>f],
      ["IUL",grRates.iu,0,grM*.4,(f)=>f],
      ["FIA",grRates.fa,grE*.2,0,(f)=>f*(1-grTR/100*.5)],
    ];
    let taxableAT=0;
    vd.forEach(([name,rate,ex2,mo2,taxFn],idx)=>{
      const futVal=fv(ex2,mo2,rate,grYrs);
      const at=taxFn(futVal,ex2+mo2*12*grYrs);
      if(idx===0)taxableAT=at;
      vehicles.push({name,rate,fv:futVal,at,real:at/grIF,taxEdge:idx>0?Math.round(at-taxableAT):0});
    });
    const bestGrowth=vehicles.reduce((b,v)=>v.at>b.at?v:b,vehicles[0]);
    ss.growth=bestGrowth.real>inc*10?3:bestGrowth.real>inc*5?2:1;

    // ── RETIREMENT (calcRT) ──
    const retAge=rtA,retWant=rtI,retWR=rtW/100;
    const retYrsToRet=Math.max(1,retAge-age);
    const retPort=Math.round(fv(sav,moSav,.06,retYrsToRet));
    const retPortInc=Math.round(retPort*retWR);
    const retLifeExp=90,retYrsInRet=Math.max(1,retLifeExp-retAge);
    const retRMD73=Math.round(retPort/26.5); // RMD at 73 using Uniform Lifetime Table divisor
    const retSSRows:[string,number,number,number,number,number][]=[
      ["62",rtS62,rtP,retPortInc,rtS62+rtP+retPortInc,retWant-(rtS62+rtP+retPortInc)],
      ["67",rtS67,rtP,retPortInc,rtS67+rtP+retPortInc,retWant-(rtS67+rtP+retPortInc)],
      ["70",rtS70,rtP,retPortInc,rtS70+rtP+retPortInc,retWant-(rtS70+rtP+retPortInc)],
    ];
    const retBest=rtS70+rtP+retPortInc;
    ss.retire=retBest>=retWant?3:retBest>=retWant*.8?2:1;
    // Smooth spending
    let smoothSpend=0;
    if(rtMode==="smooth"){
      function canSustain(ann:number):boolean{let bal=retPort;for(let y=0;y<retYrsInRet;y++){const ssI=y>=Math.max(0,70-retAge)?rtS70:0;const need=ann*Math.pow(1.03,y)-ssI-rtP;bal=bal*1.05-Math.max(0,need);if(bal<0)return false;}return true;}
      let lo=0,hi=retWant*3;for(let i=0;i<50;i++){const mid=(lo+hi)/2;if(canSustain(mid)){smoothSpend=mid;lo=mid;}else hi=mid;if(hi-lo<100)break;}
      smoothSpend=Math.round(smoothSpend);
    }
    // Guardrails
    let guardCap=0,guardLoBal=0,guardHiBal=0,guardLoSpend=0,guardHiSpend=0;
    if(rtMode==="guard"){
      const riskFactor=rtRisk/100;
      guardCap=Math.round(retPort*(retWR||.04));
      guardLoBal=Math.round(retPort*(0.7+riskFactor*0.2));
      guardHiBal=Math.round(retPort*(1.1+riskFactor*0.2));
      guardLoSpend=Math.round(guardCap*(0.8+riskFactor*0.1));
      guardHiSpend=Math.round(guardCap*(1.1+riskFactor*0.1));
    }

    // ── TAX (calcTX) ──
    const txMarg=txM/100,txSt=txS/100;
    const fedTax=Math.round(inc*txMarg*.7),stTax=Math.round(inc*txSt),totTax=fedTax+stTax;
    const save401k=Math.round(tx4*txMarg),saveIRA=Math.round(txR*txMarg),saveHSA=Math.round(txH*(txMarg+.0765)),saveChar=Math.round(txC*txMarg);
    const totalTaxSave=save401k+saveIRA+saveHSA+saveChar;
    ss.tax=inc>0?(totTax/inc<.25?3:totTax/inc<.32?2:1):2;
    // Roth Explorer
    const brackets=[{name:"10%",top:23200,rate:.10},{name:"12%",top:94300,rate:.12},{name:"22%",top:201050,rate:.22},{name:"24%",top:383900,rate:.24},{name:"32%",top:487450,rate:.32},{name:"35%",top:731200,rate:.35},{name:"37%",top:Infinity,rate:.37}];
    const stdDed=cFil==="mfj"?29200:cFil==="hoh"?21900:14600;
    const taxableInc=Math.max(0,inc-tx4-txH-stdDed);
    let curBracket=brackets[0];for(const bk of brackets){if(taxableInc<=bk.top){curBracket=bk;break;}}
    const roomInBracket=curBracket.top===Infinity?0:curBracket.top-taxableInc;
    const rothStrats=[
      {name:"No Conversion",amount:0},
      {name:"Deductions Only",amount:Math.max(0,stdDed+tx4+txH-inc*.3)},
      {name:"Fill "+curBracket.name+" Bracket",amount:Math.max(0,roomInBracket)},
      {name:"Fill 22% Bracket",amount:Math.max(0,201050-taxableInc)},
      {name:"Fill 24% Bracket",amount:Math.max(0,383900-taxableInc)},
      {name:"$25K Fixed",amount:25000},
      {name:"$50K Fixed",amount:50000},
      {name:"$100K Fixed",amount:100000},
    ];
    const rothResults=rothStrats.map(s=>{
      const ca=Math.max(0,s.amount);let convTax=0;const nt=taxableInc+ca;
      for(const bk of brackets){const inB=Math.min(nt,bk.top)-Math.min(taxableInc,bk.top);if(inB>0)convTax+=inB*bk.rate;}
      convTax=Math.round(convTax);const effR=ca>0?convTax/ca:0;
      let rBal=0;const totalYrs=90-age,workYrs=retAge-age;
      for(let y=0;y<totalYrs;y++){if(y<workYrs)rBal+=ca;rBal=rBal*1.07;}
      rBal=Math.round(rBal);const netB=rBal-Math.round(convTax*workYrs);
      return{...s,convTax,effR,rBal,netB};
    });
    // Sweet spot
    const rothSweet=rothResults.filter(r=>r.amount>0&&r.netB>0).sort((a,b)=>b.netB-a.netB)[0];

    // ── ESTATE (calcES) ──
    const esGross=esV,esLife2=esL;
    const esExempt=13990000,esSunsetExempt=7000000,esRate2=.40;
    const esTax1=Math.round(Math.max(0,esGross+esLife2-esExempt)*esRate2);
    const esTax2=Math.round(Math.max(0,esGross+esLife2-esSunsetExempt)*esRate2);
    const esILITSave=hasILIT?Math.round(esLife2*esRate2):0;
    ss.estate=hasWill?3:(esGross>500000?1:2);

    // ── EDUCATION (calcED) ──
    const edYrs2=Math.max(1,18-edA);
    const edFutureCost=Math.round(edT*Math.pow(1+edI/100,edYrs2));
    const edProj=Math.round(fv(ed5/Math.max(edK,1),edMo/Math.max(edK,1),edG/100,edYrs2));
    const edGap=Math.max(0,edFutureCost-edProj);
    const edTotalCost=edFutureCost*Math.max(edK,1);
    const edTotalProj=edProj*Math.max(edK,1);
    const edTotalGap=edGap*Math.max(edK,1);
    ss.edu=edK===0?3:edGap<=0?3:edGap<edFutureCost*.3?2:1;

    // ── SCORECARD (calcCProf) ──
    const stg=age<30?"Young Professional":age<40?(dep>0?"Young Family":"Building"):age<55?"Mid-Career":age<65?"Pre-Retirement":"Retired";
    const domains:[string,number,string][]=[
      ["Cash Flow",ss.cash,cfSaveRate>=.15?"Save "+pct(cfSaveRate):"Save rate "+pct(cfSaveRate)],
      ["Protection",ss.protect,lifeGap>0?"Gap "+fmtSm(lifeGap):"Covered"],
      ["Growth",ss.growth,"Best: "+bestGrowth.name+" "+fmtSm(bestGrowth.at)],
      ["Retirement",ss.retire,retBest>=retWant?"On track":"Gap "+fmt(retWant-retBest)+"/yr"],
      ["Tax",ss.tax,"Saving "+fmtSm(totalTaxSave)+"/yr"],
      ["Estate",ss.estate,hasWill?"Docs in place":"Needs planning"],
      ["Education",ss.edu,edK===0?"N/A":edGap<=0?"Funded":"Gap "+fmtSm(edGap)+"/child"],
    ];
    const totScore=domains.reduce((a,d)=>a+d[1],0);
    const totMax=domains.length*3;
    const healthPct=Math.round(totScore/totMax*100);
    // Pillar summaries
    const pillarPlan=Math.round((ss.cash+ss.tax+ss.estate)/9*100);
    const pillarProtect=Math.round(ss.protect/3*100);
    const pillarGrow=Math.round((ss.growth+ss.retire+ss.edu)/9*100);

    // ── RECOMMENDED PRODUCTS (calcCProf) ──
    const recs:Rec[]=[];let recTotal=0;
    function addR(c:string,p:string,cv:string,prm:number,wb:string,pri:string){recs.push({c,p,cv,pr:prm,wb,pri});recTotal+=prm||0;}
    const lm=dep>0?(age<40?15:age<55?12:8):(age<40?10:6);const lc=inc*lm;
    if(cExI<lc*.5)addR("Life","Term "+lm+"\u00D7",fmt(lc),Math.round(lc/1000*(age<45?.8:2)),"NLG","High");
    addR("Life","IUL",fmt(Math.round(inc*.08*15)),Math.round(inc*.08),"NLG FlexLife","Rec");
    addR("Life","Whole Life 20-Pay",fmt(Math.round(inc*3)),Math.round(inc*3/1000*(age<40?4:8)),"NLG/MassMutual","Consider");
    if(age<65)addR("DI","Disability",fmt(Math.round(inc*.6))+"/yr",Math.round(inc*.6*.025),"Guardian","High");
    if(age>=30)addR("LTC","Hybrid LTC","$150-350K",Math.max(1500,Math.round(nw*(age<45?.003:age<55?.005:.008))),"Lincoln",age>=45?"Rec":"Consider");
    if(age>=35||nw>100000)addR("Retire","FIA",fmt(Math.max(25000,Math.round(nw*.1))),0,"NLG/Athene",age>=50?"Rec":"Consider");
    if(has401)addR("Growth","401k/Roth Optimization",fmt(Math.round(Math.min(inc*.15,23000))),0,"WB Planning","Rec");
    if(nw>50000)addR("Growth","Advisory/AUM",fmt(Math.round(nw*.3)),Math.round(nw*.3*.01),"WB Wealth","Rec");
    if(dep>0)addR("Education","529 Plan",fmt(Math.round(dep*250000)),Math.round(Math.min(dep*500,dep*6000)),"WB Education","Rec");
    if(nw>2e6&&inc>250000)addR("Advanced","Premium Finance","$5M+ face",0,"WB PF Director","Evaluate");
    if(isBiz){addR("Biz","Key Person",fmt(inc*5),Math.round(inc*5/1000*1.2),"NLG","High");addR("Biz","Buy-Sell",fmt(nw),0,"NLG/Adv Mkts","High");addR("Biz","Group Benefits",fmt(Math.round(inc*2)),Math.round(inc*.03),"WB Group","Rec");}
    addR("Estate","Estate Plan","Review",nw>500000?2500:1500,"WB Adv Markets",nw>500000?"High":(age>=30?"Consider":"Plan"));
    if(isHm)addR("P&C","Home/Auto Bundle",fmt(Math.round(nw*.4)),Math.round(nw*.4/1000*5),"WB P&C","Rec");

    // ── ACTION PLAN (calcTimeline) ──
    const paceMap={standard:{label:"Standard (3-month)",mult:1},aggressive:{label:"Aggressive (6-week)",mult:0.5},gradual:{label:"Gradual (6-month)",mult:2}};
    const pm=paceMap[tlPace].mult;
    const actions:{area:string;action:string;priority:number;when:string;cost?:number}[]=[];
    if(ss.cash<3)actions.push({area:"Cash Flow",action:"Set up auto-savings + emergency fund",priority:1,when:pm<=0.5?"Week 1":"Week 1-2"});
    else actions.push({area:"Cash Flow",action:"Maintain: review budget quarterly",priority:3,when:"Quarterly"});
    if(ss.protect<3)actions.push({area:"Protection",action:"Term life + DI quotes and application",priority:1,when:pm<=0.5?"Week 1-2":"Week 1-4",cost:Math.round(inc*.04)});
    else actions.push({area:"Protection",action:"Review beneficiaries; evaluate IUL",priority:3,when:"Annually"});
    if(ss.growth<3)actions.push({area:"Growth",action:"Open/max 401k + Roth; IUL evaluation",priority:1,when:pm<=0.5?"Week 2-3":pm>=2?"Month 2-4":"Month 1-2",cost:Math.round(inc*.15)});
    else actions.push({area:"Growth",action:"Rebalance; tax-loss harvest",priority:3,when:"Semi-annual"});
    if(ss.tax<3)actions.push({area:"Tax",action:"Implement top 2 tax strategies",priority:2,when:pm<=0.5?"Week 3-4":pm>=2?"Month 3-6":"Month 2-3"});
    else actions.push({area:"Tax",action:"Annual tax projection; review withholding",priority:3,when:"Annually"});
    if(ss.retire<3)actions.push({area:"Retirement",action:"SS optimization + FIA analysis",priority:2,when:pm<=0.5?"Week 4-5":pm>=2?"Month 4-8":"Month 3-6"});
    else actions.push({area:"Retirement",action:"Stress-test portfolio; update income plan",priority:3,when:"Annually"});
    if(ss.estate<3)actions.push({area:"Estate",action:"Will/trust + beneficiary review",priority:2,when:pm<=0.5?"Week 2-3":pm>=2?"Month 2-6":"Month 1-3",cost:2500});
    else actions.push({area:"Estate",action:"Annual trust review; update beneficiaries",priority:3,when:"Annually"});
    if(dep>0&&ss.edu<3)actions.push({area:"Education",action:"Open/increase 529 contributions",priority:2,when:pm<=0.5?"Week 3-4":pm>=2?"Month 3-6":"Month 1-2"});
    actions.sort((a,b)=>a.priority-b.priority);

    // ── COST-BENEFIT (buildCostBenDash) ──
    const annualCost=recTotal;
    const simYears=cbHorizon;
    let cbSavBal=sav,cbCumCost=0,cbCumTaxSave=0;
    const cbMilestones:{yr:number;sav:number;cv:number;db:number;taxSav:number;totalVal:number;totalCost:number;net:number}[]=[];
    const projYears=[1,5,10,15,20,30,50,75,100].filter(y=>y<=simYears);
    for(let y=1;y<=simYears;y++){
      cbSavBal=cbSavBal*(1+.07)+moSav*12;cbCumCost+=annualCost;cbCumTaxSave+=totalTaxSave;
      const cv2=Math.round(annualCost*.3*y);const db=lifeGap>0?dime:cExI;
      const totalVal=cbSavBal+cv2+db+cbCumTaxSave;
      if(projYears.includes(y))cbMilestones.push({yr:y,sav:Math.round(cbSavBal),cv:cv2,db,taxSav:Math.round(cbCumTaxSave),totalVal:Math.round(totalVal),totalCost:Math.round(cbCumCost),net:Math.round(totalVal-cbCumCost)});
    }
    const cbSnap=cbMilestones[cbMilestones.length-1]||{sav:0,cv:0,db:0,taxSav:0,totalVal:0,totalCost:0,net:0,yr:0};
    const cbROI=cbSnap.totalCost>0?cbSnap.totalVal/cbSnap.totalCost:0;
    // Monte Carlo bands (simplified 3-percentile)
    const mcBands=projYears.map(y=>{
      const base=fv(sav,moSav,.07,y);
      return{yr:y,p10:Math.round(base*.6),p50:Math.round(base),p90:Math.round(base*1.5)};
    });
    // Bottom line
    const cbBottomLine=cbROI>=5?`Over ${cbHorizon} years, every $1 in premiums and contributions generates ${cbROI.toFixed(1)}x in total value. This plan is strongly positive.`:cbROI>=2?`Your plan generates ${cbROI.toFixed(1)}x return over ${cbHorizon} years. Consider increasing savings rate to improve further.`:`ROI of ${cbROI.toFixed(1)}x suggests reviewing product mix and increasing savings rate.`;

    // ── STRATEGY COMPARE (calcCompare) ──
    const compYrs=pHorizon;const compRet=pReturnRate/100;const compInfl=pInflation/100;const compSavR=pSavingsRate/100;
    const compMoSav2=Math.round(inc*compSavR/12);
    type CompVeh={name:string;fv:number;at:number;taxFree:boolean;notes:string};
    const compVehs:CompVeh[]=[
      {name:"Taxable Brokerage",fv:Math.round(fv(nw*.3,compMoSav2,compRet,compYrs)),at:0,taxFree:false,notes:"15% LTCG on gains"},
      {name:"401k/403b",fv:Math.round(fv(nw*.3,Math.min(compMoSav2,1917),compRet,compYrs)),at:0,taxFree:false,notes:"Tax-deferred; RMDs at 73"},
      {name:"Roth IRA",fv:Math.round(fv(nw*.1,Math.min(compMoSav2*.3,583),compRet,compYrs)),at:0,taxFree:true,notes:"Tax-free growth & withdrawal"},
      {name:"IUL (6% cap)",fv:Math.round(fv(0,Math.round(inc*.08/12),.06,compYrs)),at:0,taxFree:true,notes:"Tax-free loans; death benefit"},
      {name:"FIA (4.5% avg)",fv:Math.round(fv(nw*.2,0,.045,compYrs)),at:0,taxFree:false,notes:"Principal protection; income rider"},
    ];
    compVehs.forEach(v=>{v.at=v.taxFree?v.fv:Math.round(v.fv*(1-.22));});
    // Business income calc
    const bizIncome=scGDC+scTeam*scGDC*(scOverride/100)+scAffiliate+scPartner+Math.round(scAUM*.01);
    // Back-planning
    let backPlanResult="";
    if(pTargetIncome>0){
      const neededPort=Math.round(pTargetIncome/(retWR||.04));
      const neededMoSav2=neededPort>nw?Math.round((neededPort-nw)*(compRet/12)/(Math.pow(1+compRet/12,compYrs*12)-1)):0;
      backPlanResult=`Need ${fmt(neededPort)} portfolio \u2192 save ${fmt(neededMoSav2)}/mo for ${compYrs} yrs at ${pReturnRate}%`;
    }

    return{ss,stg,domains,totScore,totMax,healthPct,pillarPlan,pillarProtect,pillarGrow,
      recs,recTotal,
      cfNet,cfExp,cfSurplus,cfSaveRate,cfDti,cfEmTarget,cfEmGap,
      dime,lifeGap,diNeed,diGap,ltcTotal,totalProtPrem,termAmt,iulAmt,termPrem,iulPrem,diPrem,ltcPrem,protPctInc,
      vehicles,bestGrowth,grYrs:Math.max(1,grR-cAge),
      retPort,retPortInc,retSSRows,retBest,retLifeExp,retYrsInRet,retRMD73,smoothSpend,
      guardCap,guardLoBal,guardHiBal,guardLoSpend,guardHiSpend,
      totTax,totalTaxSave,save401k,saveIRA,saveHSA,saveChar,fedTax,stTax,
      taxableInc,curBracket,roomInBracket,rothResults,rothSweet,stdDed,
      esTax1,esTax2,esILITSave,
      edYrs:edYrs2,edFutureCost,edProj,edGap,edTotalCost,edTotalProj,edTotalGap,
      actions,cbSnap,cbROI,cbMilestones,mcBands,cbBottomLine,
      compVehs,backPlanResult,bizIncome,
    };
  },[cAge,cSpA,cInc,cNW,cDep,cSav,cMS,cME,cExI,cMort,cDebt,cHm,cBiz,c401,cFil,cfG,cfT,cfH,cfTr,cfFd,cfIs,cfDp,cfOt,cfEm,prY,prP,prE,prF,prSS,prDI,prL,prLY,prLI,grR,grM,grE,grI,grTx,gr4,grRo,grIU,grFA,grTN,grTR,rtA,rtI,rtW,rtS62,rtS67,rtS70,rtP,rtMode,rtRisk,txM,txS,tx4,txR,txH,txC,esV,esL,esW,esI,edK,edA,ed5,edMo,edT,edG,edI,cbHorizon,pReturnRate,pSavingsRate,pInflation,pHorizon,pTargetIncome,scGDC,scTeam,scOverride,scAffiliate,scPartner,scAUM,tlPace]);

  const navigate=useCallback((id:PanelId)=>{setActivePanel(id);setSidebarOpen(false);window.scrollTo(0,0);},[]);
  const PT:Record<PanelId,string>={profile:"Client Profile",cash:"Cash Flow",protect:"Protection",grow:"Growth & Accumulation",retire:"Retirement Readiness",tax:"Tax Planning",estate:"Estate Planning",edu:"Education Planning",costben:"Cost-Benefit Analysis",compare:"Strategy Comparison",summary:"Financial Summary",timeline:"12-Month Action Plan",refs:"Sources & Due Diligence"};

  // ═══ RENDER ═══
  return(
    <div className="flex h-full bg-slate-50">
      <button onClick={()=>setSidebarOpen(!sidebarOpen)} className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md border border-slate-200">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
      </button>
      {sidebarOpen&&<div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={()=>setSidebarOpen(false)}/>}
      <aside className={`${sidebarOpen?"translate-x-0":"-translate-x-full"} lg:translate-x-0 fixed lg:sticky top-0 left-0 z-40 w-64 h-screen bg-[#0B1D3A] text-white overflow-y-auto transition-transform duration-200 flex-shrink-0`}>
        <div className="p-4 border-b border-white/10">
          <div className="text-lg font-bold text-amber-400">WealthBridge</div>
          <div className="text-xs text-slate-400">Client Calculator Suite</div>
        </div>
        <nav className="p-3 space-y-4">
          {NAV_SECTIONS.map(s=>(<div key={s.label}><div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1 px-2">{s.label}</div>{s.items.map(it=>(<button key={it.id} onClick={()=>navigate(it.id)} className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${activePanel===it.id?"bg-amber-500/20 text-amber-400 font-semibold":"text-slate-300 hover:bg-white/5 hover:text-white"}`}><span>{it.icon}</span><span>{it.label}</span></button>))}</div>))}
        </nav>
      </aside>
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <div><h1 className="text-lg font-bold text-slate-800">{PT[activePanel]}</h1><div className="text-xs text-slate-500">Score: {R.healthPct}% &middot; {R.stg} &middot; Age {cAge}</div></div>
          <div className="flex items-center gap-2"><button onClick={()=>window.print()} className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 rounded-lg">Print</button></div>
        </div>
        <div className="p-4 max-w-5xl mx-auto space-y-6">

{/* ═══ PANEL 1: CLIENT PROFILE ═══ */}
{activePanel==="profile"&&(<>
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    <h2 className="text-base font-bold text-slate-800 mb-1">Client Information <RefTip text="All calculations update instantly as you change inputs. Data stays in your browser." src="WealthBridge v7"/></h2>
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-3">
      <FI label="Age" value={cAge} onChange={setCAge}/>
      <FI label="Spouse Age" value={cSpA} onChange={setCSpA}/>
      <FI label="Annual Income ($)" value={cInc} onChange={setCInc}/>
      <FI label="Net Worth ($)" value={cNW} onChange={setCNW}/>
      <FI label="Savings ($)" value={cSav} onChange={setCSav}/>
      <FI label="Monthly Savings ($)" value={cMS} onChange={setCMS}/>
      <FI label="Monthly Expenses ($)" value={cME} onChange={setCME}/>
      <FI label="Dependents" value={cDep} onChange={setCDep}/>
      <FI label="Homeowner" value={cHm} onChange={setCHm} type="select" options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
      <FI label="Mortgage ($)" value={cMort} onChange={setCMort}/>
      <FI label="Monthly Debt ($)" value={cDebt} onChange={setCDebt}/>
      <FI label="Business Owner" value={cBiz} onChange={setCBiz} type="select" options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
      <FI label="Has 401k" value={c401} onChange={setC401} type="select" options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
      <FI label="Existing Life Ins ($)" value={cExI} onChange={setCExI}/>
      <FI label="Filing Status" value={cFil} onChange={setCFil} type="select" options={[{value:"mfj",label:"Married Filing Jointly"},{value:"single",label:"Single"},{value:"hoh",label:"Head of Household"}]}/>
    </div>
  </div>
  {/* FINANCIAL HEALTH SCORECARD */}
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    <h2 className="text-base font-bold text-slate-800 mb-3">Financial Health Scorecard</h2>
    <div className="flex flex-wrap gap-3 mb-4">
      <div className="px-4 py-3 bg-slate-50 rounded-lg border text-center"><div className="text-[10px] text-slate-500 uppercase">Health</div><div className={`text-xl font-bold ${R.healthPct>=80?"text-green-600":R.healthPct>=60?"text-amber-600":"text-red-600"}`}>{R.healthPct}%</div></div>
      <div className="px-4 py-3 bg-slate-50 rounded-lg border text-center"><div className="text-[10px] text-slate-500 uppercase">Domains</div><div className="text-xl font-bold text-slate-800">{R.domains.length}</div></div>
      <div className="px-4 py-3 bg-slate-50 rounded-lg border text-center"><div className="text-[10px] text-slate-500 uppercase">Score</div><div className="text-xl font-bold text-amber-600">{R.totScore}/{R.totMax}</div></div>
      <div className="px-4 py-3 bg-slate-50 rounded-lg border text-center"><div className="text-[10px] text-slate-500 uppercase">Stage</div><div className="text-sm font-bold text-slate-800">{R.stg}</div></div>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead><tr className="bg-slate-50"><th className="text-left p-2 font-semibold">Domain</th><th className="text-right p-2 font-semibold">Score</th><th className="text-left p-2 font-semibold">Status</th><th className="text-left p-2 font-semibold">Key Metric</th></tr></thead>
        <tbody>{R.domains.map(([name,score,metric])=>(<tr key={name} className="border-t border-slate-100"><td className="p-2 font-medium">{name}</td><td className="p-2 text-right">{score}/3</td><td className="p-2"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${scBg(score)}`}>{sc(score)}</span></td><td className="p-2 text-xs text-slate-500">{metric}</td></tr>))}</tbody>
      </table>
    </div>
    {/* Pillar Summary Bars */}
    <div className="mt-4 space-y-2">
      <div className="text-xs font-semibold text-slate-600 mb-1">Pillar Summary</div>
      {([["Plan",R.pillarPlan],["Protect",R.pillarProtect],["Grow",R.pillarGrow]] as [string,number][]).map(([name,pctVal])=>(<div key={name} className="flex items-center gap-2"><span className="text-xs w-16 text-slate-600 font-medium">{name}</span><div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden"><div className={`h-full rounded-full transition-all ${pctVal>=80?"bg-green-500":pctVal>=60?"bg-amber-500":"bg-red-500"}`} style={{width:pctVal+"%"}}/></div><span className="text-xs font-bold w-10 text-right">{pctVal}%</span></div>))}
    </div>
  </div>
  {/* RECOMMENDED PRODUCTS */}
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    <h2 className="text-base font-bold text-slate-800 mb-3">Recommended Products & Services</h2>
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead><tr className="bg-slate-50"><th className="text-left p-2">Category</th><th className="text-left p-2">Product</th><th className="text-right p-2">Coverage/Value</th><th className="text-right p-2">Est. Premium</th><th className="text-left p-2">Carrier</th><th className="text-left p-2">Priority</th></tr></thead>
        <tbody>
          {R.recs.map((r,i)=>(<tr key={i} className="border-t border-slate-100"><td className="p-2 font-medium">{r.c}</td><td className="p-2">{r.p}</td><td className="p-2 text-right">{r.cv}</td><td className="p-2 text-right">{r.pr>0?fmt(r.pr)+"/yr":"\u2014"}</td><td className="p-2 text-xs text-slate-500">{r.wb}</td><td className={`p-2 font-semibold ${r.pri==="High"?"text-red-600":r.pri==="Rec"?"text-amber-600":"text-slate-500"}`}>{r.pri}</td></tr>))}
          <tr className="border-t-2 border-slate-300 bg-amber-50/50"><td className="p-2 font-bold" colSpan={3}>TOTAL ESTIMATED ANNUAL COST</td><td className="p-2 text-right font-bold text-amber-700">{fmt(R.recTotal)}/yr</td><td colSpan={2}></td></tr>
        </tbody>
      </table>
    </div>
  </div>
</>)}

{/* ═══ PANEL 2: CASH FLOW ═══ */}
{activePanel==="cash"&&(<>
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    <h2 className="text-base font-bold text-slate-800 mb-1">Monthly Cash Flow <RefTip text="50/30/20 rule: 50% needs, 30% wants, 20% savings. Emergency fund: 3-6 months expenses." src="Consumer Financial Protection Bureau"/></h2>
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-3">
      <FI label="Gross Monthly ($)" value={cfG} onChange={setCfG}/>
      <FI label="Tax Rate %" value={cfT} onChange={setCfT}/>
      <FI label="Housing ($)" value={cfH} onChange={setCfH}/>
      <FI label="Transport ($)" value={cfTr} onChange={setCfTr}/>
      <FI label="Food ($)" value={cfFd} onChange={setCfFd}/>
      <FI label="Insurance ($)" value={cfIs} onChange={setCfIs}/>
      <FI label="Debt Payments ($)" value={cfDp} onChange={setCfDp}/>
      <FI label="Other ($)" value={cfOt} onChange={setCfOt}/>
      <FI label="Emergency Fund (months)" value={cfEm} onChange={setCfEm}/>
    </div>
  </div>
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead><tr className="bg-slate-50"><th className="text-left p-2">Item</th><th className="text-right p-2">Monthly</th><th className="text-right p-2">% Gross</th></tr></thead>
        <tbody>
          <tr className="border-t border-slate-100"><td className="p-2 font-medium">Gross Income</td><td className="p-2 text-right">{fmt(cfG)}</td><td className="p-2 text-right">100%</td></tr>
          <tr className="border-t border-slate-100"><td className="p-2 font-medium text-red-600">Tax ({cfT}%)</td><td className="p-2 text-right text-red-600">{fmt(Math.round(cfG*cfT/100))}</td><td className="p-2 text-right">{cfT}%</td></tr>
          <tr className="border-t border-slate-100 bg-blue-50"><td className="p-2 font-bold">Net Income</td><td className="p-2 text-right font-bold">{fmt(R.cfNet)}</td><td className="p-2 text-right">{cfG>0?pct(R.cfNet/cfG):"\u2014"}</td></tr>
          {([["Housing",cfH],["Transport",cfTr],["Food",cfFd],["Insurance",cfIs],["Debt Pmts",cfDp],["Other",cfOt]] as [string,number][]).map(([n,v])=>(<tr key={n} className="border-t border-slate-100"><td className="p-2">{n}</td><td className="p-2 text-right">{fmt(v)}</td><td className="p-2 text-right">{cfG>0?pct(v/cfG):"\u2014"}</td></tr>))}
          <tr className="border-t-2 border-slate-300"><td className="p-2 font-bold">Total Expenses</td><td className="p-2 text-right font-bold">{fmt(R.cfExp)}</td><td className="p-2 text-right">{cfG>0?pct(R.cfExp/cfG):"\u2014"}</td></tr>
          <tr className={`border-t-2 border-slate-300 ${R.cfSurplus>=0?"bg-green-50":"bg-red-50"}`}><td className="p-2 font-bold">Monthly Surplus</td><td className={`p-2 text-right font-bold ${R.cfSurplus>=0?"text-green-600":"text-red-600"}`}>{fmt(R.cfSurplus)}</td><td className="p-2 text-right">{cfG>0?pct(R.cfSurplus/cfG):"\u2014"}</td></tr>
          <tr className="border-t border-slate-100"><td className="p-2 font-medium">Emergency Fund Target</td><td className="p-2 text-right">{fmt(R.cfEmTarget)}</td><td className="p-2 text-right">{cfEm} months</td></tr>
          <tr className={`border-t border-slate-100 ${R.cfEmGap<=0?"bg-green-50":"bg-red-50"}`}><td className="p-2 font-medium">Emergency Fund Gap</td><td className={`p-2 text-right font-bold ${R.cfEmGap<=0?"text-green-600":"text-red-600"}`}>{R.cfEmGap<=0?"Funded":fmt(R.cfEmGap)}</td><td></td></tr>
          <tr className="border-t border-slate-100"><td className="p-2 font-medium">DTI Ratio</td><td className={`p-2 text-right font-bold ${R.cfDti<=.28?"text-green-600":R.cfDti<=.36?"text-amber-600":"text-red-600"}`}>{cfG>0?pct(R.cfDti):"\u2014"}</td><td className="p-2 text-right text-xs text-slate-400">{R.cfDti<=.28?"Good":R.cfDti<=.36?"Caution":"High"}</td></tr>
        </tbody>
      </table>
    </div>
    <RB items={[["Savings Rate",cfG>0?pct(R.cfSaveRate):"0%",R.cfSaveRate>=.15?"grn":R.cfSaveRate>=.10?"gld":"red"],["DTI",cfG>0?pct(R.cfDti):"0%",R.cfDti<=.28?"grn":R.cfDti<=.36?"gld":"red"],["Emergency Gap",R.cfEmGap<=0?"Funded":fmt(R.cfEmGap),R.cfEmGap<=0?"grn":"red"],["Surplus",fmt(R.cfSurplus),R.cfSurplus>=0?"grn":"red"]]}/>
  </div>
</>)}

{/* ═══ PANEL 3: PROTECTION ═══ */}
{activePanel==="protect"&&(<>
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    <h2 className="text-base font-bold text-slate-800 mb-1">Protection Analysis <RefTip text="DIME method: Debt + Income replacement + Mortgage + Education. Industry standard for life insurance needs." src="LIMRA 2025, NAIC"/></h2>
    <h3 className="text-sm font-semibold text-slate-700 mt-3 mb-2">Life Insurance (DIME Method)</h3>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <FI label="Income Replace Years" value={prY} onChange={setPrY}/>
      <FI label="Replace % of Income" value={prP} onChange={setPrP}/>
      <FI label="Education/Child ($)" value={prE} onChange={setPrE}/>
      <FI label="Final Expenses ($)" value={prF} onChange={setPrF}/>
      <FI label="Survivor SS ($/yr)" value={prSS} onChange={setPrSS}/>
    </div>
    <h3 className="text-sm font-semibold text-slate-700 mt-4 mb-2">Disability Insurance</h3>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <FI label="Replace % of Income" value={prDI} onChange={setPrDI}/>
    </div>
    <h3 className="text-sm font-semibold text-slate-700 mt-4 mb-2">Long-Term Care</h3>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <FI label="Daily Cost ($)" value={prL} onChange={setPrL}/>
      <FI label="Care Years" value={prLY} onChange={setPrLY}/>
      <FI label="LTC Inflation %" value={prLI} onChange={setPrLI}/>
    </div>
  </div>
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead><tr className="bg-slate-50"><th className="text-left p-2">Area</th><th className="text-right p-2">Need</th><th className="text-right p-2">Have</th><th className="text-right p-2">Gap</th><th className="text-left p-2">Product</th><th className="text-right p-2">Est. Premium</th><th className="text-left p-2">Carrier</th></tr></thead>
        <tbody>
          <tr className="border-t border-slate-100"><td className="p-2 font-medium">Life - Term</td><td className="p-2 text-right" rowSpan={2}>{fmt(R.dime)}</td><td className="p-2 text-right" rowSpan={2}>{fmt(cExI)}</td><td className={`p-2 text-right font-bold ${R.lifeGap>0?"text-red-600":"text-green-600"}`} rowSpan={2}>{R.lifeGap>0?fmt(R.lifeGap):"Covered"}</td><td className="p-2">Term {prY}yr ({fmt(R.termAmt)})</td><td className="p-2 text-right">{fmt(R.termPrem)}/yr</td><td className="p-2 text-xs text-slate-500">NLG/Prudential</td></tr>
          <tr className="border-t border-slate-100"><td className="p-2 font-medium">Life - IUL</td><td className="p-2">IUL ({fmt(R.iulAmt)})</td><td className="p-2 text-right">{fmt(R.iulPrem)}/yr</td><td className="p-2 text-xs text-slate-500">NLG FlexLife</td></tr>
          <tr className="border-t border-slate-100"><td className="p-2 font-medium">Disability ({prDI}%)</td><td className="p-2 text-right">{fmt(R.diNeed)}/yr</td><td className="p-2 text-right">\u2014</td><td className="p-2 text-right font-bold text-red-600">{fmt(R.diGap)}/yr</td><td className="p-2">Own-Occ DI</td><td className="p-2 text-right">{fmt(R.diPrem)}/yr</td><td className="p-2 text-xs text-slate-500">Guardian</td></tr>
          <tr className="border-t border-slate-100"><td className="p-2 font-medium">LTC Hybrid</td><td className="p-2 text-right">{fmt(R.ltcTotal)}</td><td className="p-2 text-right">\u2014</td><td className="p-2 text-right font-bold text-amber-600">{fmt(R.ltcTotal)}</td><td className="p-2">Hybrid LTC</td><td className="p-2 text-right">{fmt(R.ltcPrem)}/yr</td><td className="p-2 text-xs text-slate-500">Lincoln</td></tr>
          <tr className="border-t-2 border-slate-300 bg-amber-50/50"><td className="p-2 font-bold" colSpan={5}>TOTAL ANNUAL PREMIUMS</td><td className="p-2 text-right font-bold text-amber-700">{fmt(R.totalProtPrem)}/yr</td><td className="p-2 text-xs text-slate-500">{cInc>0?pct(R.protPctInc)+" of income":""}</td></tr>
        </tbody>
      </table>
    </div>
    <RB items={[["Life Gap",R.lifeGap>0?fmt(R.lifeGap):"Covered",R.lifeGap<=0?"grn":"red"],["DI Gap",fmt(R.diGap)+"/yr","gld"],["LTC Need",fmtSm(R.ltcTotal),"gld"],["Annual Prem",fmt(R.totalProtPrem)+"/yr",""]]}/>
  </div>
</>)}

{/* ═══ PANEL 4: GROWTH ═══ */}
{activePanel==="grow"&&(<>
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    <h2 className="text-base font-bold text-slate-800 mb-1">Growth & Accumulation <RefTip text="Multi-vehicle comparison: Taxable vs 401k vs Roth vs IUL vs FIA. Each has different tax treatment, contribution limits, and risk profiles." src="Morningstar SBBI, Kitces Research"/></h2>
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-3">
      <FI label="Target Retirement Age" value={grR} onChange={setGrR}/>
      <FI label="Monthly Contribution ($)" value={grM} onChange={setGrM}/>
      <FI label="Existing Portfolio ($)" value={grE} onChange={setGrE}/>
      <FI label="Inflation %" value={grI} onChange={setGrI} step="0.1"/>
      <FI label="Taxable Return %" value={grTx} onChange={setGrTx} step="0.1"/>
      <FI label="401k Return %" value={gr4} onChange={setGr4} step="0.1"/>
      <FI label="Roth Return %" value={grRo} onChange={setGrRo} step="0.1"/>
      <FI label="IUL Cap %" value={grIU} onChange={setGrIU} step="0.1"/>
      <FI label="FIA Avg %" value={grFA} onChange={setGrFA} step="0.1"/>
      <FI label="Tax Now %" value={grTN} onChange={setGrTN}/>
      <FI label="Tax Retirement %" value={grTR} onChange={setGrTR}/>
    </div>
  </div>
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead><tr className="bg-slate-50"><th className="text-left p-2">Vehicle</th><th className="text-right p-2">Return</th><th className="text-right p-2">Future Value</th><th className="text-right p-2">After-Tax</th><th className="text-right p-2">Real Value</th><th className="text-right p-2">Tax Edge</th></tr></thead>
        <tbody>
          {R.vehicles.map((v,i)=>(<tr key={i} className={`border-t border-slate-100 ${v.name===R.bestGrowth.name?"bg-green-50":""}`}><td className="p-2 font-medium">{v.name}</td><td className="p-2 text-right">{(v.rate*100).toFixed(1)}%</td><td className="p-2 text-right">{fmtSm(v.fv)}</td><td className="p-2 text-right font-bold">{fmtSm(v.at)}</td><td className="p-2 text-right">{fmtSm(v.real)}</td><td className={`p-2 text-right ${v.taxEdge>0?"text-green-600 font-bold":""}`}>{v.taxEdge>0?"+"+fmtSm(v.taxEdge):"\u2014"}</td></tr>))}
        </tbody>
      </table>
    </div>
    <RB items={[["Years",R.grYrs+"",""],["Best Vehicle",R.bestGrowth.name,"grn"],["After-Tax",fmtSm(R.bestGrowth.at),"gld"],["Tax-Free Edge",R.bestGrowth.taxEdge>0?"+"+fmtSm(R.bestGrowth.taxEdge):"\u2014","blu"]]}/>
  </div>
</>)}

{/* ═══ PANEL 5: RETIREMENT ═══ */}
{activePanel==="retire"&&(<>
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    <h2 className="text-base font-bold text-slate-800 mb-1">Retirement Readiness <RefTip text="SS claiming age comparison: 62 (reduced), 67 (full), 70 (max +24%). Portfolio withdrawal rate: 3.5-4% safe." src="SSA 2025, Bengen Rule, Trinity Study"/></h2>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
      <FI label="Retirement Age" value={rtA} onChange={setRtA}/>
      <FI label="Desired Income ($/yr)" value={rtI} onChange={setRtI}/>
      <FI label="Withdrawal Rate %" value={rtW} onChange={setRtW} step="0.1"/>
      <FI label="SS at 62 ($/yr)" value={rtS62} onChange={setRtS62}/>
      <FI label="SS at 67 ($/yr)" value={rtS67} onChange={setRtS67}/>
      <FI label="SS at 70 ($/yr)" value={rtS70} onChange={setRtS70}/>
      <FI label="Pension ($/yr)" value={rtP} onChange={setRtP}/>
    </div>
    <div className="flex gap-1 mt-3">
      {(["goal","smooth","guard"] as const).map(m=>(<button key={m} onClick={()=>setRtMode(m)} className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${rtMode===m?"bg-blue-600 text-white border-blue-600":"bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>{m==="goal"?"Goal-Based":m==="smooth"?"\u2696 Smooth Spending":"\uD83D\uDEE1 Guardrails"}</button>))}
    </div>
  </div>
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    {rtMode==="goal"&&(<>
      <h3 className="text-sm font-semibold mb-2">SS Claiming Age Comparison</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead><tr className="bg-slate-50"><th className="text-left p-2">Claim Age</th><th className="text-right p-2">SS/yr</th><th className="text-right p-2">Pension</th><th className="text-right p-2">Portfolio Inc</th><th className="text-right p-2">Total</th><th className="text-right p-2">Gap</th></tr></thead>
          <tbody>
            {R.retSSRows.map(([age2,ss2,pen,port,total,gap])=>(<tr key={age2} className="border-t border-slate-100"><td className="p-2 font-medium">{age2}</td><td className="p-2 text-right">{fmt(ss2)}</td><td className="p-2 text-right">{fmt(pen)}</td><td className="p-2 text-right">{fmt(port)}</td><td className="p-2 text-right font-bold">{fmt(total)}</td><td className={`p-2 text-right font-bold ${gap<=0?"text-green-600":"text-red-600"}`}>{gap<=0?"Surplus "+fmt(Math.abs(gap)):fmt(gap)+" short"}</td></tr>))}
            <tr className="border-t border-slate-100 bg-slate-50"><td className="p-2 font-medium">RMD @73</td><td colSpan={3} className="p-2 text-right text-xs text-slate-500">Required Minimum Distribution</td><td className="p-2 text-right font-bold">{fmt(R.retRMD73)}/yr</td><td></td></tr>
          </tbody>
        </table>
      </div>
    </>)}
    {rtMode==="smooth"&&(<div className="p-4 bg-purple-50 rounded-lg border border-purple-100"><h3 className="text-sm font-semibold text-purple-800 mb-2">\u2696 Consumption Smoothing</h3><p className="text-sm text-purple-700">Sustainable annual spending: <span className="font-bold text-lg">{fmt(R.smoothSpend)}</span>/yr</p><p className="text-xs text-purple-600 mt-1">Based on {fmt(R.retPort)} portfolio, SS at 70 ({fmt(rtS70)}), pension {fmt(rtP)}, life expectancy {R.retLifeExp}.</p></div>)}
    {rtMode==="guard"&&(<div className="p-4 bg-amber-50 rounded-lg border border-amber-100"><h3 className="text-sm font-semibold text-amber-800 mb-2">\uD83D\uDEE1 Spending Guardrails</h3>
      <div className="mb-3"><RS label="Risk Tolerance" value={rtRisk} onChange={setRtRisk} min={0} max={100} step={5} display={rtRisk+"%"} hint="0% = conservative, 100% = aggressive"/></div>
      <div className="grid grid-cols-2 gap-3 text-sm"><div><div className="text-xs text-amber-600">Initial Capacity</div><div className="font-bold">{fmt(R.guardCap)}/yr</div></div><div><div className="text-xs text-amber-600">Spending Range</div><div className="font-bold">{fmt(R.guardLoSpend)} \u2013 {fmt(R.guardHiSpend)}</div></div><div><div className="text-xs text-amber-600">Portfolio Floor</div><div className="font-bold">{fmt(R.guardLoBal)}</div></div><div><div className="text-xs text-amber-600">Portfolio Ceiling</div><div className="font-bold">{fmt(R.guardHiBal)}</div></div></div></div>)}
    <RB items={[["Portfolio @Ret",fmtSm(R.retPort),"gld"],["Port. Income",fmt(R.retPortInc)+"/yr",""],["Best Total",fmt(R.retBest)+"/yr","grn"],["Gap",R.retBest>=rtI?"None":""+fmt(rtI-R.retBest),R.retBest>=rtI?"grn":"red"]]}/>
  </div>
</>)}

{/* ═══ PANEL 6: TAX PLANNING ═══ */}
{activePanel==="tax"&&(<>
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    <h2 className="text-base font-bold text-slate-800 mb-1">Tax Planning <RefTip text="TCJA estate exemption sunsets after 2025. Roth conversions, charitable strategies, and IUL tax-free access are key tools." src="Tax Foundation 2025"/></h2>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
      <FI label="Marginal Rate %" value={txM} onChange={setTxM}/>
      <FI label="State Rate %" value={txS} onChange={setTxS}/>
      <FI label="401k Contrib ($/yr)" value={tx4} onChange={setTx4}/>
      <FI label="IRA/Roth ($/yr)" value={txR} onChange={setTxR}/>
      <FI label="HSA ($/yr)" value={txH} onChange={setTxH}/>
      <FI label="Charitable ($/yr)" value={txC} onChange={setTxC}/>
    </div>
  </div>
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead><tr className="bg-slate-50"><th className="text-left p-2">Strategy</th><th className="text-right p-2">Contribution</th><th className="text-right p-2">Tax Saved</th><th className="text-left p-2">Vehicle</th></tr></thead>
        <tbody>
          <tr className="border-t border-slate-100"><td className="p-2 font-medium">401k Deduction</td><td className="p-2 text-right">{fmt(tx4)}</td><td className="p-2 text-right text-green-600">{fmt(R.save401k)}</td><td className="p-2 text-xs text-slate-500">ESI</td></tr>
          <tr className="border-t border-slate-100"><td className="p-2 font-medium">IRA/Roth</td><td className="p-2 text-right">{fmt(txR)}</td><td className="p-2 text-right text-green-600">{fmt(R.saveIRA)}</td><td className="p-2 text-xs text-slate-500">ESI</td></tr>
          <tr className="border-t border-slate-100"><td className="p-2 font-medium">HSA</td><td className="p-2 text-right">{fmt(txH)}</td><td className="p-2 text-right text-green-600">{fmt(R.saveHSA)}</td><td className="p-2 text-xs text-slate-500">Triple tax-free</td></tr>
          <tr className="border-t border-slate-100"><td className="p-2 font-medium">Charitable</td><td className="p-2 text-right">{fmt(txC)}</td><td className="p-2 text-right text-green-600">{fmt(R.saveChar)}</td><td className="p-2 text-xs text-slate-500">DAF/CRT</td></tr>
          <tr className="border-t-2 border-slate-300 bg-amber-50/50"><td className="p-2 font-bold" colSpan={2}>TOTAL SAVINGS</td><td className="p-2 text-right font-bold text-green-600">{fmt(R.totalTaxSave)}</td><td></td></tr>
        </tbody>
      </table>
    </div>
    <RB items={[["Marginal",pct(txM/100),"gld"],["Effective",cInc>0?pct(R.totTax/cInc):"\u2014",""],["Tax Saved",fmtSm(R.totalTaxSave),"grn"],["Std Deduction",fmt(R.stdDed),""]]}/>
  </div>
  {/* ROTH CONVERSION EXPLORER */}
  <div className="bg-white rounded-xl border-l-4 border-purple-500 p-5">
    <h3 className="text-sm font-bold text-slate-800 mb-2">\uD83D\uDC8E Roth Conversion Explorer</h3>
    <p className="text-xs text-slate-500 mb-2">Taxable income: {fmt(R.taxableInc)} ({R.curBracket.name} bracket). Room in bracket: {fmt(R.roomInBracket)}</p>
    {cInc>150000&&<p className="text-xs text-amber-600 mb-2">\u26A0 Practice income of {fmt(cInc)} fills through {R.curBracket.name} bracket. Conversion space is limited.</p>}
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead><tr className="bg-purple-50"><th className="text-left p-1.5">Strategy</th><th className="text-right p-1.5">Convert/yr</th><th className="text-right p-1.5">Tax on Conv</th><th className="text-right p-1.5">Tax Rate</th><th className="text-right p-1.5">Roth Value @90</th><th className="text-right p-1.5">Net Benefit</th></tr></thead>
        <tbody>{R.rothResults.map((s,i)=>(<tr key={i} className={`border-t border-slate-100 ${s.netB>0&&i>0?"bg-green-50":""}`}><td className="p-1.5 font-medium">{s.name}</td><td className="p-1.5 text-right">{fmt(s.amount)}</td><td className="p-1.5 text-right">{fmt(s.convTax)}</td><td className="p-1.5 text-right">{pct(s.effR)}</td><td className="p-1.5 text-right font-bold">{fmtSm(s.rBal)}</td><td className={`p-1.5 text-right font-bold ${s.netB>0?"text-green-600":"text-red-600"}`}>{fmtSm(s.netB)}</td></tr>))}</tbody>
      </table>
    </div>
    {R.rothSweet&&<div className="mt-2 p-2 bg-green-50 rounded-lg border border-green-200 text-xs text-green-800"><b>\uD83C\uDFAF Sweet Spot:</b> {R.rothSweet.name} \u2014 convert {fmt(R.rothSweet.amount)}/yr at {pct(R.rothSweet.effR)} effective rate for {fmtSm(R.rothSweet.netB)} net benefit by age 90.</div>}
  </div>
</>)}

{/* ═══ PANEL 7: ESTATE ═══ */}
{activePanel==="estate"&&(<>
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    <h2 className="text-base font-bold text-slate-800 mb-1">Estate Planning <RefTip text="Federal exemption: $13.99M (2025). TCJA sunset risk: could drop to ~$7M. ILIT removes life insurance from taxable estate." src="IRS 2025, Tax Foundation"/></h2>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
      <FI label="Estate Value ($)" value={esV} onChange={setEsV}/>
      <FI label="Life Insurance ($)" value={esL} onChange={setEsL}/>
      <FI label="Has Will/Trust" value={esW} onChange={setEsW} type="select" options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
      <FI label="ILIT in Place" value={esI} onChange={setEsI} type="select" options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
    </div>
  </div>
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead><tr className="bg-slate-50"><th className="text-left p-2">Scenario</th><th className="text-right p-2">Taxable Estate</th><th className="text-right p-2">Est. Tax</th><th className="text-left p-2">Action</th></tr></thead>
        <tbody>
          <tr className="border-t border-slate-100"><td className="p-2 font-medium">Current Law ($13.99M)</td><td className="p-2 text-right">{fmt(esV+esL)}</td><td className={`p-2 text-right font-bold ${R.esTax1>0?"text-red-600":"text-green-600"}`}>{R.esTax1>0?fmt(R.esTax1):"$0"}</td><td className="p-2 text-xs">{R.esTax1>0?"Consider ILIT + gifting":"Below exemption"}</td></tr>
          <tr className="border-t border-slate-100"><td className="p-2 font-medium">2026 Sunset (~$7M)</td><td className="p-2 text-right">{fmt(esV+esL)}</td><td className={`p-2 text-right font-bold ${R.esTax2>0?"text-red-600":"text-green-600"}`}>{R.esTax2>0?fmt(R.esTax2):"$0"}</td><td className="p-2 text-xs">{R.esTax2>0?"Act before sunset: ILIT, SLAT, GRAT":"Monitor legislation"}</td></tr>
          {esI==="yes"&&<tr className="border-t border-slate-100 bg-green-50"><td className="p-2 font-medium">ILIT Savings</td><td className="p-2 text-right" colSpan={1}>Removes insurance from estate</td><td className="p-2 text-right font-bold text-green-600">{fmt(R.esILITSave)}</td><td className="p-2 text-xs text-green-700">ILIT active</td></tr>}
          <tr className="border-t border-slate-100"><td className="p-2 font-medium">Documents</td><td colSpan={2}></td><td className={`p-2 font-semibold ${esW==="yes"?"text-green-600":"text-red-600"}`}>{esW==="yes"?"Will/Trust in place":"Needs will/trust"}</td></tr>
        </tbody>
      </table>
    </div>
    <RB items={[["Estate",fmt(esV+esL),""],["Tax (Current)",fmt(R.esTax1),R.esTax1>0?"red":"grn"],["Tax (Sunset)",fmt(R.esTax2),R.esTax2>0?"red":"grn"],["Will/Trust",esW==="yes"?"Yes":"No",esW==="yes"?"grn":"red"]]}/>
  </div>
</>)}


{/* ═══ PANEL 8: EDUCATION ═══ */}
{activePanel==="edu"&&(<>
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    <h2 className="text-base font-bold text-slate-800 mb-1">Education Planning <RefTip text="529 plans grow tax-free for qualified education expenses. Average 4-year public university: ~$110K (2025). 5% annual inflation." src="College Board 2025"/></h2>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
      <FI label="Children" value={edK} onChange={setEdK}/>
      <FI label="Avg Child Age" value={edA} onChange={setEdA}/>
      <FI label="529 Balance ($)" value={ed5} onChange={setEd5}/>
      <FI label="Monthly Contrib ($)" value={edMo} onChange={setEdMo}/>
      <FI label="Target/Child ($)" value={edT} onChange={setEdT}/>
      <FI label="Growth %" value={edG} onChange={setEdG} step="0.1"/>
      <FI label="Inflation %" value={edI} onChange={setEdI} step="0.1"/>
    </div>
  </div>
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead><tr className="bg-slate-50"><th className="text-left p-2"></th><th className="text-right p-2">Per Child</th><th className="text-right p-2">Total ({edK} children)</th></tr></thead>
        <tbody>
          <tr className="border-t border-slate-100"><td className="p-2 font-medium">Future Cost (inflated)</td><td className="p-2 text-right">{fmt(R.edFutureCost)}</td><td className="p-2 text-right">{fmt(R.edTotalCost)}</td></tr>
          <tr className="border-t border-slate-100"><td className="p-2 font-medium">529 Projected</td><td className="p-2 text-right">{fmt(R.edProj)}</td><td className="p-2 text-right">{fmt(R.edTotalProj)}</td></tr>
          <tr className={`border-t-2 border-slate-300 ${R.edGap<=0?"bg-green-50":"bg-red-50"}`}><td className="p-2 font-bold">Gap</td><td className={`p-2 text-right font-bold ${R.edGap<=0?"text-green-600":"text-red-600"}`}>{R.edGap<=0?"Funded":fmt(R.edGap)}</td><td className={`p-2 text-right font-bold ${R.edTotalGap<=0?"text-green-600":"text-red-600"}`}>{R.edTotalGap<=0?"Funded":fmt(R.edTotalGap)}</td></tr>
        </tbody>
      </table>
    </div>
    <RB items={[["Years to College",R.edYrs+"",""],["Per Child Cost",fmtSm(R.edFutureCost),"gld"],["529 Projected",fmtSm(R.edProj),"grn"],["Gap/Child",R.edGap<=0?"Funded":fmtSm(R.edGap),R.edGap<=0?"grn":"red"]]}/>
  </div>
</>)}

{/* ═══ PANEL 9: COST-BENEFIT ANALYSIS ═══ */}
{activePanel==="costben"&&(<>
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    <h2 className="text-base font-bold text-slate-800 mb-3">Cost-Benefit Analysis</h2>
    <div className="flex flex-wrap gap-1 mb-4">
      {[5,10,15,20,30].map(y=>(<button key={y} onClick={()=>setCbHorizon(y)} className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${cbHorizon===y?"bg-blue-600 text-white border-blue-600":"bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>{y}yr</button>))}
      <div className="flex items-center gap-1 ml-2"><span className="text-xs text-slate-500">Custom:</span><input type="number" value={cbHorizon} min={1} max={100} onChange={e=>setCbHorizon(parseInt(e.target.value)||30)} className="w-16 px-2 py-1 text-xs border border-slate-200 rounded-lg"/></div>
    </div>
    {/* What-If Explorer */}
    <details className="border border-slate-200 rounded-lg">
      <summary className="px-4 py-2 cursor-pointer text-sm font-semibold text-slate-700 bg-slate-50 rounded-t-lg hover:bg-slate-100">What-If Explorer</summary>
      <div className="p-4 space-y-3">
        <RS label="Return Rate %" value={wiReturn} onChange={setWiReturn} min={0} max={15} step={0.5} display={wiReturn+"%"}/>
        <RS label="Retirement Age" value={wiRetAge} onChange={setWiRetAge} min={55} max={80} step={1} display={wiRetAge+""}/>
        <RS label="Inflation %" value={wiInflation} onChange={setWiInflation} min={0} max={10} step={0.5} display={wiInflation+"%"}/>
        <RS label="SS Start Age" value={wiSSAge} onChange={setWiSSAge} min={62} max={70} step={1} display={wiSSAge+""}/>
        <RS label="Monthly Savings ($)" value={wiMoSav} onChange={setWiMoSav} min={0} max={10000} step={100} display={fmt(wiMoSav)}/>
        <div className="border-t border-slate-200 pt-3 mt-3"><div className="text-xs font-semibold text-slate-600 mb-2">Practice-Exclusive</div>
          <RS label="Practice Income Growth %" value={wiPracGrowth} onChange={setWiPracGrowth} min={0} max={20} step={1} display={wiPracGrowth+"%"}/>
          <RS label="New Recruits/Year" value={wiRecruits} onChange={setWiRecruits} min={0} max={10} step={1} display={wiRecruits+""}/>
          <RS label="Retention Rate %" value={wiRetention} onChange={setWiRetention} min={50} max={100} step={5} display={wiRetention+"%"}/>
        </div>
        {/* Fear Scenarios */}
        <div className="border-t border-slate-200 pt-3 mt-3"><div className="text-xs font-semibold text-slate-600 mb-2">Fear Scenarios</div>
          <div className="flex flex-wrap gap-1">
            <button onClick={()=>{setWiReturn(Math.max(0,wiReturn-3));}} className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded border border-red-200 hover:bg-red-100">Market Crash</button>
            <button onClick={()=>{setWiInflation(Math.min(10,wiInflation+3));}} className="px-2 py-1 text-xs bg-orange-50 text-orange-700 rounded border border-orange-200 hover:bg-orange-100">Inflation Spike</button>
            <button onClick={()=>{setWiMoSav(Math.round(wiMoSav*.5));}} className="px-2 py-1 text-xs bg-amber-50 text-amber-700 rounded border border-amber-200 hover:bg-amber-100">Job Loss</button>
            <button onClick={()=>{setWiPracGrowth(0);setWiRecruits(0);}} className="px-2 py-1 text-xs bg-purple-50 text-purple-700 rounded border border-purple-200 hover:bg-purple-100">Practice Disruption</button>
            <button onClick={()=>{setWiReturn(7);setWiInflation(3);setWiMoSav(1500);setWiPracGrowth(8);setWiRecruits(2);setWiRetention(85);}} className="px-2 py-1 text-xs bg-slate-50 text-slate-700 rounded border border-slate-200 hover:bg-slate-100">Reset</button>
          </div>
        </div>
      </div>
    </details>
  </div>
  {/* DASHBOARD */}
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    <div className="flex flex-wrap gap-3 mb-4">
      <div className="px-4 py-3 bg-red-50 rounded-lg border border-red-100 text-center min-w-[100px]"><div className="text-[10px] text-red-500 uppercase">Total Cost</div><div className="text-lg font-bold text-red-700">{fmtSm(R.cbSnap.totalCost)}</div></div>
      <div className="px-4 py-3 bg-green-50 rounded-lg border border-green-100 text-center min-w-[100px]"><div className="text-[10px] text-green-500 uppercase">Total Value</div><div className="text-lg font-bold text-green-700">{fmtSm(R.cbSnap.totalVal)}</div></div>
      <div className="px-4 py-3 bg-blue-50 rounded-lg border border-blue-100 text-center min-w-[100px]"><div className="text-[10px] text-blue-500 uppercase">Net Value</div><div className="text-lg font-bold text-blue-700">{fmtSm(R.cbSnap.net)}</div></div>
      <div className="px-4 py-3 bg-amber-50 rounded-lg border border-amber-100 text-center min-w-[100px]"><div className="text-[10px] text-amber-500 uppercase">ROI</div><div className="text-lg font-bold text-amber-700">{R.cbROI.toFixed(1)}x</div></div>
    </div>
    {/* Year-by-year sparkline (simple bar chart) */}
    <div className="mb-4"><div className="text-xs font-semibold text-slate-600 mb-1">Projection ({cbHorizon} years)</div>
      <div className="flex items-end gap-px h-24 bg-slate-50 rounded-lg p-2">
        {R.cbMilestones.map((m,i)=>{const maxVal=Math.max(...R.cbMilestones.map(x=>x.totalVal));const h=maxVal>0?Math.round(m.totalVal/maxVal*80):0;return(<div key={i} className="flex-1 flex flex-col items-center gap-0.5"><div className="w-full bg-green-400 rounded-t" style={{height:h+"px"}} title={`Year ${m.yr}: ${fmtSm(m.totalVal)}`}/><div className="text-[8px] text-slate-400">{m.yr}</div></div>);})}
      </div>
    </div>
    {/* Monte Carlo Confidence Bands */}
    <div className="mb-4"><div className="text-xs font-semibold text-slate-600 mb-1">Monte Carlo Confidence Bands</div>
      <div className="overflow-x-auto"><table className="w-full text-xs border-collapse">
        <thead><tr className="bg-slate-50"><th className="p-1.5 text-left">Year</th><th className="p-1.5 text-right">10th Pctl</th><th className="p-1.5 text-right">50th Pctl</th><th className="p-1.5 text-right">90th Pctl</th></tr></thead>
        <tbody>{R.mcBands.map(b=>(<tr key={b.yr} className="border-t border-slate-100"><td className="p-1.5">{b.yr}</td><td className="p-1.5 text-right text-red-600">{fmtSm(b.p10)}</td><td className="p-1.5 text-right">{fmtSm(b.p50)}</td><td className="p-1.5 text-right text-green-600">{fmtSm(b.p90)}</td></tr>))}</tbody>
      </table></div>
    </div>
    {/* Milestone Values Table */}
    <div className="mb-4"><div className="text-xs font-semibold text-slate-600 mb-1">Milestone Values</div>
      <div className="overflow-x-auto"><table className="w-full text-xs border-collapse">
        <thead><tr className="bg-slate-50"><th className="p-1.5 text-left">Year</th><th className="p-1.5 text-right">Savings</th><th className="p-1.5 text-right">Product CV</th><th className="p-1.5 text-right">Death Ben</th><th className="p-1.5 text-right">Tax Savings</th><th className="p-1.5 text-right">Total Value</th><th className="p-1.5 text-right">Total Cost</th><th className="p-1.5 text-right">Net Value</th></tr></thead>
        <tbody>{R.cbMilestones.map(m=>(<tr key={m.yr} className="border-t border-slate-100"><td className="p-1.5">{m.yr}</td><td className="p-1.5 text-right">{fmtSm(m.sav)}</td><td className="p-1.5 text-right">{fmtSm(m.cv)}</td><td className="p-1.5 text-right">{fmtSm(m.db)}</td><td className="p-1.5 text-right">{fmtSm(m.taxSav)}</td><td className="p-1.5 text-right font-bold">{fmtSm(m.totalVal)}</td><td className="p-1.5 text-right text-red-600">{fmtSm(m.totalCost)}</td><td className={`p-1.5 text-right font-bold ${m.net>=0?"text-green-600":"text-red-600"}`}>{fmtSm(m.net)}</td></tr>))}</tbody>
      </table></div>
    </div>
    {/* Bottom Line */}
    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm text-blue-800">{R.cbBottomLine}</div>
  </div>
</>)}

{/* ═══ PANEL 10: STRATEGY COMPARISON ═══ */}
{activePanel==="compare"&&(<>
  <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg">
    <p className="text-xs text-amber-800"><b>Compliance Notice:</b> This comparison is for educational purposes only and does not constitute investment advice. Past performance does not guarantee future results. Consult a licensed financial professional before making investment decisions. Insurance products are not FDIC insured.</p>
  </div>
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    <h2 className="text-base font-bold text-slate-800 mb-3">Planning Assumptions</h2>
    <div className="space-y-3">
      <RS label="Return Rate %" value={pReturnRate} onChange={setPReturnRate} min={0} max={15} step={0.5} display={pReturnRate+"%"}/>
      <RS label="Savings Rate %" value={pSavingsRate} onChange={setPSavingsRate} min={0} max={50} step={1} display={pSavingsRate+"%"}/>
      <RS label="Inflation %" value={pInflation} onChange={setPInflation} min={0} max={10} step={0.5} display={pInflation+"%"}/>
      <RS label="Planning Horizon (Years)" value={pHorizon} onChange={setPHorizon} min={5} max={50} step={1} display={pHorizon+" yrs"}/>
    </div>
  </div>
  {/* Income Streams & Business Planning */}
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    <h3 className="text-sm font-bold text-slate-800 mb-3">Income Streams & Business Planning</h3>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <FI label="Role" value={scRole} onChange={setScRole} type="select" options={[{value:"advisor",label:"Financial Advisor"},{value:"agent",label:"Insurance Agent"},{value:"hybrid",label:"Hybrid"},{value:"other",label:"Other"}]}/>
      <FI label="Seasonality" value={scSeason} onChange={setScSeason} type="select" options={[{value:"none",label:"None"},{value:"q4heavy",label:"Q4 Heavy"},{value:"even",label:"Even"}]}/>
      <FI label="GDC ($)" value={scGDC} onChange={setScGDC}/>
      <FI label="Team Size" value={scTeam} onChange={setScTeam}/>
      <FI label="Override Rate %" value={scOverride} onChange={setScOverride}/>
      <FI label="Affiliate Income ($)" value={scAffiliate} onChange={setScAffiliate}/>
      <FI label="Partner Income ($)" value={scPartner} onChange={setScPartner}/>
      <FI label="AUM ($)" value={scAUM} onChange={setScAUM}/>
    </div>
    <div className="mt-3 p-2 bg-slate-50 rounded-lg text-xs text-slate-600">Estimated Business Income: <span className="font-bold text-amber-700">{fmt(R.bizIncome)}/yr</span></div>
  </div>
  {/* Back-Planning */}
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    <h3 className="text-sm font-bold text-slate-800 mb-3">Back-Planning</h3>
    <FI label="Target Annual Income ($)" value={pTargetIncome} onChange={setPTargetIncome} hint="Enter desired retirement income to reverse-engineer savings needed"/>
    {R.backPlanResult&&<div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm text-blue-800">{R.backPlanResult}</div>}
  </div>
  {/* Strategy Comparison Table */}
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    <h3 className="text-sm font-bold text-slate-800 mb-3">Vehicle Comparison ({pHorizon}-Year Projection)</h3>
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead><tr className="bg-slate-50"><th className="text-left p-2">Vehicle</th><th className="text-right p-2">Future Value</th><th className="text-right p-2">After-Tax</th><th className="text-left p-2">Tax-Free?</th><th className="text-left p-2">Notes</th></tr></thead>
        <tbody>{R.compVehs.map((v,i)=>(<tr key={i} className="border-t border-slate-100"><td className="p-2 font-medium">{v.name}</td><td className="p-2 text-right">{fmtSm(v.fv)}</td><td className="p-2 text-right font-bold">{fmtSm(v.at)}</td><td className="p-2">{v.taxFree?<span className="text-green-600 font-semibold">Yes</span>:<span className="text-slate-500">No</span>}</td><td className="p-2 text-xs text-slate-500">{v.notes}</td></tr>))}</tbody>
      </table>
    </div>
  </div>
</>)}

{/* ═══ PANEL 11: SUMMARY ═══ */}
{activePanel==="summary"&&(<>
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    <h2 className="text-base font-bold text-slate-800 mb-3">Financial Dashboard Summary</h2>
    <div className="flex flex-wrap gap-3 mb-4">
      <div className="px-4 py-3 bg-slate-50 rounded-lg border text-center"><div className="text-[10px] text-slate-500 uppercase">Financial Health</div><div className={`text-2xl font-bold ${R.healthPct>=80?"text-green-600":R.healthPct>=60?"text-amber-600":"text-red-600"}`}>{R.healthPct}%</div></div>
      <div className="px-4 py-3 bg-slate-50 rounded-lg border text-center"><div className="text-[10px] text-slate-500 uppercase">Domains</div><div className="text-2xl font-bold text-slate-800">{R.domains.length}</div></div>
      <div className="px-4 py-3 bg-slate-50 rounded-lg border text-center"><div className="text-[10px] text-slate-500 uppercase">Score</div><div className="text-2xl font-bold text-amber-600">{R.totScore}/{R.totMax}</div></div>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead><tr className="bg-slate-50"><th className="text-left p-2">Domain</th><th className="text-right p-2">Score</th><th className="text-left p-2">Status</th></tr></thead>
        <tbody>{R.domains.map(([name,score])=>(<tr key={name} className="border-t border-slate-100"><td className="p-2 font-medium">{name}</td><td className="p-2 text-right">{score}/3</td><td className="p-2"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${scBg(score)}`}>{sc(score)}</span></td></tr>))}</tbody>
      </table>
    </div>
  </div>
</>)}

{/* ═══ PANEL 12: ACTION PLAN ═══ */}
{activePanel==="timeline"&&(<>
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    <h2 className="text-base font-bold text-slate-800 mb-3">12-Month Action Plan</h2>
    <div className="flex gap-1 mb-4">
      {(["standard","aggressive","gradual"] as const).map(p=>(<button key={p} onClick={()=>setTlPace(p)} className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${tlPace===p?"bg-blue-600 text-white border-blue-600":"bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>{p==="standard"?"Standard (3-month)":p==="aggressive"?"Aggressive (6-week)":"Gradual (6-month)"}</button>))}
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead><tr className="bg-slate-50"><th className="text-left p-2">Priority</th><th className="text-left p-2">Area</th><th className="text-left p-2">Action</th><th className="text-left p-2">Timeline</th><th className="text-right p-2">Est. Cost</th></tr></thead>
        <tbody>{R.actions.map((a,i)=>(<tr key={i} className="border-t border-slate-100"><td className="p-2"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${a.priority===1?"bg-red-100 text-red-800":a.priority===2?"bg-yellow-100 text-yellow-800":"bg-green-100 text-green-800"}`}>{a.priority===1?"URGENT":a.priority===2?"Important":"Maintain"}</span></td><td className="p-2 font-medium">{a.area}</td><td className="p-2">{a.action}</td><td className="p-2 text-xs text-slate-500">{a.when}</td><td className="p-2 text-right">{a.cost?fmt(a.cost)+"/yr":"\u2014"}</td></tr>))}</tbody>
      </table>
    </div>
  </div>
</>)}

{/* ═══ PANEL 13: REFERENCES ═══ */}
{activePanel==="refs"&&(<>
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    <h2 className="text-base font-bold text-slate-800 mb-3">Sources & Due Diligence</h2>
    <details className="border border-slate-200 rounded-lg mb-4">
      <summary className="px-4 py-2 cursor-pointer text-sm font-semibold text-slate-700 bg-slate-50 rounded-t-lg hover:bg-slate-100">Due Diligence Checklist</summary>
      <div className="p-4 space-y-2 text-xs">
        {[
          {label:"IRS Tax Tables",url:"https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-2025",desc:"2025 brackets, deductions, exemptions"},
          {label:"Tax Foundation",url:"https://taxfoundation.org/data/all/federal/2025-tax-brackets/",desc:"Independent tax policy analysis"},
          {label:"AM Best Carrier Ratings",url:"https://web.ambest.com/ratings-insurance",desc:"Insurance company financial strength"},
          {label:"NY Fed SOFR Rate",url:"https://www.newyorkfed.org/markets/reference-rates/sofr",desc:"Secured Overnight Financing Rate"},
          {label:"SSA Benefit Estimator",url:"https://www.ssa.gov/benefits/retirement/estimator.html",desc:"Social Security benefit calculator"},
          {label:"LIMRA Insurance Research",url:"https://www.limra.com/en/research/",desc:"Life insurance industry data"},
          {label:"Morningstar SBBI",url:"https://www.morningstar.com/",desc:"Stocks, Bonds, Bills, and Inflation yearbook"},
          {label:"College Board Trends",url:"https://research.collegeboard.org/trends",desc:"College cost and financial aid data"},
          {label:"NAIC Consumer Info",url:"https://content.naic.org/consumer",desc:"Insurance regulation and consumer protection"},
          {label:"SEC EDGAR Filings",url:"https://www.sec.gov/cgi-bin/browse-edgar",desc:"Company financial disclosures"},
        ].map((ref,i)=>(<div key={i} className="flex items-start gap-2 p-2 bg-slate-50 rounded"><span className="text-green-600 mt-0.5">&#10003;</span><div><a href={ref.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">{ref.label}</a><div className="text-slate-500">{ref.desc}</div></div></div>))}
      </div>
    </details>
    <div className="space-y-3">
      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Calculation Methods</h3>
        <div className="overflow-x-auto"><table className="w-full text-xs border-collapse">
          <thead><tr className="bg-slate-100"><th className="text-left p-1.5">Domain</th><th className="text-left p-1.5">Method</th><th className="text-left p-1.5">Source</th></tr></thead>
          <tbody>
            <tr className="border-t border-slate-100"><td className="p-1.5 font-medium">Life Insurance</td><td className="p-1.5">DIME Method (Debt + Income + Mortgage + Education)</td><td className="p-1.5">LIMRA, NAIC</td></tr>
            <tr className="border-t border-slate-100"><td className="p-1.5 font-medium">Growth</td><td className="p-1.5">Future Value with monthly compounding</td><td className="p-1.5">Morningstar SBBI</td></tr>
            <tr className="border-t border-slate-100"><td className="p-1.5 font-medium">Retirement</td><td className="p-1.5">SS claiming comparison + safe withdrawal rate</td><td className="p-1.5">SSA, Bengen Rule</td></tr>
            <tr className="border-t border-slate-100"><td className="p-1.5 font-medium">Tax</td><td className="p-1.5">Marginal bracket analysis + Roth conversion modeling</td><td className="p-1.5">IRS 2025, Tax Foundation</td></tr>
            <tr className="border-t border-slate-100"><td className="p-1.5 font-medium">Estate</td><td className="p-1.5">Federal exemption + TCJA sunset analysis</td><td className="p-1.5">IRS, Tax Foundation</td></tr>
            <tr className="border-t border-slate-100"><td className="p-1.5 font-medium">Education</td><td className="p-1.5">529 projection with inflation-adjusted future cost</td><td className="p-1.5">College Board 2025</td></tr>
            <tr className="border-t border-slate-100"><td className="p-1.5 font-medium">Premiums</td><td className="p-1.5">Age-interpolated rate tables (Term, IUL, WL, DI, LTC)</td><td className="p-1.5">AM Best, carrier filings</td></tr>
          </tbody>
        </table></div>
      </div>
      <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800">
        <b>Disclaimer:</b> All calculations are estimates for educational and planning purposes only. Actual premiums, returns, and tax impacts will vary based on individual circumstances, carrier underwriting, and market conditions. Consult licensed professionals for personalized advice.
      </div>
    </div>
  </div>
</>)}

        </div>{/* end max-w-5xl */}
      </main>
    </div>
  );
}
