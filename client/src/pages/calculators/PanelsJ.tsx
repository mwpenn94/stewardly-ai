import { fmt, pct } from './format';
/* ═══ PanelsJ — Domain C: Advanced Strategy Surfaces + Domain D: Due Diligence ═══ */
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Info, Landmark, Gavel, Briefcase, Gift, FileCheck, ExternalLink, CheckCircle2, AlertTriangle, BookOpen, Search, Shield, TrendingUp, Scale, Clock, Filter } from 'lucide-react';
;

/* ─── Shared input helper ─── */
const N = (props: { label: string; value: number; onChange: (v: number) => void; prefix?: string; suffix?: string; min?: number; max?: number; step?: number }) => (
  <div className="space-y-1">
    <Label className="text-xs text-muted-foreground">{props.label}</Label>
    <div className="relative">
      {props.prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{props.prefix}</span>}
      <Input type="number" className={`h-8 text-sm ${props.prefix ? 'pl-6' : ''} ${props.suffix ? 'pr-8' : ''}`}
        value={props.value} min={props.min ?? 0} max={props.max} step={props.step ?? 1}
        onChange={e => props.onChange(Number(e.target.value) || 0)} />
      {props.suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{props.suffix}</span>}
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   Premium Financing Panel — Enriched with risk, suitability, regulatory
   ═══════════════════════════════════════════════════════════════ */
const SUITABILITY_CRITERIA = [
  { label: 'Net Worth > $5M', check: (nw: number) => nw >= 5000000, weight: 3 },
  { label: 'Liquid Assets > $1M', check: (liq: number) => liq >= 1000000, weight: 2 },
  { label: 'Positive Rate Spread', check: (spread: number) => spread > 0, weight: 3 },
  { label: 'Leverage Ratio < 20x', check: (lr: number) => lr < 20, weight: 2 },
  { label: 'Premium Period ≤ 10yr', check: (yrs: number) => yrs <= 10, weight: 1 },
];

const RISK_FACTORS = [
  { name: 'Interest Rate Risk', desc: 'Loan rate may increase while policy crediting stays flat or decreases', severity: 'high' },
  { name: 'Collateral Call Risk', desc: 'If policy cash value drops, lender may require additional collateral', severity: 'high' },
  { name: 'Policy Lapse Risk', desc: 'Insufficient cash value to cover COI charges could lapse the policy', severity: 'critical' },
  { name: 'Carrier Credit Risk', desc: 'Lending bank or insurance carrier financial deterioration', severity: 'medium' },
  { name: 'Regulatory Risk', desc: 'Changes to IRC §7702 or state insurance regulations', severity: 'medium' },
  { name: 'Exit Strategy Risk', desc: 'Limited options if arrangement underperforms — surrender charges, loan payoff', severity: 'high' },
];

interface PremiumFinancingProps { income?: number; grossEstate?: number; savings?: number; }
export function PremiumFinancingPanel({ income = 0, grossEstate = 0, savings = 0 }: PremiumFinancingProps) {
  const [deathBenefit, setDeathBenefit] = useState(() => grossEstate > 0 ? Math.max(5000000, Math.round(grossEstate * 0.5)) : 5000000);
  const [annualPremium, setAnnualPremium] = useState(() => income > 0 ? Math.round(income * 0.1) : 100000);
  const [premiumYears, setPremiumYears] = useState(10);
  const [loanRate, setLoanRate] = useState(5.5);
  const [policyCrediting, setPolicyCrediting] = useState(6.5);
  const [collateralPct, setCollateralPct] = useState(10);
  const [clientNetWorth, setClientNetWorth] = useState(() => grossEstate > 0 ? grossEstate : 10000000);
  const [clientLiquid, setClientLiquid] = useState(() => savings > 0 ? savings : 2000000);

  const totalPremiums = annualPremium * premiumYears;
  const spread = policyCrediting - loanRate;
  const collateralRequired = totalPremiums * (collateralPct / 100);
  const leverageRatio = deathBenefit / (collateralRequired || 1);

  const projection = useMemo(() => {
    const rows: { year: number; premiumPaid: number; loanBalance: number; cashValue: number; netEquity: number; deathBenefitNet: number }[] = [];
    let loanBalance = 0;
    let cashValue = 0;
    for (let y = 1; y <= premiumYears + 10; y++) {
      if (y <= premiumYears) { loanBalance += annualPremium; cashValue += annualPremium; }
      loanBalance *= (1 + loanRate / 100);
      cashValue *= (1 + policyCrediting / 100);
      rows.push({
        year: y, premiumPaid: Math.min(y, premiumYears) * annualPremium,
        loanBalance: Math.round(loanBalance), cashValue: Math.round(cashValue),
        netEquity: Math.round(cashValue - loanBalance),
        deathBenefitNet: Math.round(deathBenefit - loanBalance),
      });
    }
    return rows;
  }, [annualPremium, premiumYears, loanRate, policyCrediting, deathBenefit]);

  const crossoverYear = projection.find(r => r.netEquity > 0)?.year;

  // Suitability scoring
  const suitabilityChecks = SUITABILITY_CRITERIA.map(c => ({
    ...c,
    passed: c.label.includes('Net Worth') ? c.check(clientNetWorth) :
            c.label.includes('Liquid') ? c.check(clientLiquid) :
            c.label.includes('Spread') ? c.check(spread) :
            c.label.includes('Leverage') ? c.check(leverageRatio) :
            c.check(premiumYears),
  }));
  const suitabilityScore = suitabilityChecks.reduce((s, c) => s + (c.passed ? c.weight : 0), 0);
  const maxScore = SUITABILITY_CRITERIA.reduce((s, c) => s + c.weight, 0);
  const suitabilityPct = Math.round(suitabilityScore / maxScore * 100);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark className="w-5 h-5 text-amber-400" /> Premium Financing Analysis
            <Tooltip><TooltipTrigger><Info className="w-4 h-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs">Premium financing uses borrowed funds to pay life insurance premiums. The policy's cash value serves as collateral. Suitable for high-net-worth clients who want large death benefits without liquidating assets.</TooltipContent>
            </Tooltip>
          </CardTitle>
          <p className="text-[10px] text-muted-foreground">For live rate data and history, see <a href="/people/premium-finance" className="text-primary hover:underline">Command Center → Operations → Premium Finance</a></p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <N label="Death Benefit" value={deathBenefit} onChange={setDeathBenefit} prefix="$" step={100000} />
            <N label="Annual Premium" value={annualPremium} onChange={setAnnualPremium} prefix="$" step={10000} />
            <N label="Premium Years" value={premiumYears} onChange={setPremiumYears} suffix="yrs" min={5} max={20} />
            <N label="Loan Rate" value={loanRate} onChange={setLoanRate} suffix="%" step={0.25} />
            <N label="Policy Crediting Rate" value={policyCrediting} onChange={setPolicyCrediting} suffix="%" step={0.25} />
            <N label="Collateral %" value={collateralPct} onChange={setCollateralPct} suffix="%" min={5} max={30} />
            <N label="Client Net Worth" value={clientNetWorth} onChange={setClientNetWorth} prefix="$" step={500000} />
            <N label="Liquid Assets" value={clientLiquid} onChange={setClientLiquid} prefix="$" step={100000} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Total Premiums</div>
              <div className="text-lg font-bold">{fmt(totalPremiums)}</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Rate Spread</div>
              <div className={`text-lg font-bold ${spread > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{spread.toFixed(2)}%</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Collateral Required</div>
              <div className="text-lg font-bold text-amber-400">{fmt(collateralRequired)}</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Leverage Ratio</div>
              <div className="text-lg font-bold text-blue-400">{leverageRatio.toFixed(1)}x</div>
            </CardContent></Card>
          </div>

          {crossoverYear && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
              <span className="text-sm font-semibold text-emerald-400">Crossover Point: Year {crossoverYear}</span>
              <span className="text-sm text-muted-foreground ml-2">— Cash value exceeds loan balance</span>
            </div>
          )}

          {spread <= 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <div className="text-sm text-muted-foreground">
                <strong className="text-red-400">Negative Spread Warning:</strong> The loan rate exceeds the policy crediting rate. This arrangement will lose money over time. Consider alternative strategies.
              </div>
            </div>
          )}

          {/* Suitability Matrix */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-2"><Shield className="w-4 h-4 text-amber-400" /> Suitability Assessment</h4>
              <Badge className={suitabilityPct >= 80 ? 'bg-emerald-500/20 text-emerald-400' : suitabilityPct >= 50 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}>
                {suitabilityPct}% — {suitabilityPct >= 80 ? 'Suitable' : suitabilityPct >= 50 ? 'Conditional' : 'Not Recommended'}
              </Badge>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {suitabilityChecks.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${c.passed ? 'text-emerald-400' : 'text-red-400'}`} />
                  <span className={c.passed ? 'text-foreground' : 'text-muted-foreground line-through'}>{c.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Risk Factor Matrix */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-400" /> Risk Factor Analysis</h4>
            <div className="space-y-2">
              {RISK_FACTORS.map((r, i) => (
                <div key={i} className="flex items-start gap-3 text-xs">
                  <Badge className={`text-[10px] shrink-0 ${r.severity === 'critical' ? 'bg-red-500/20 text-red-400' : r.severity === 'high' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                    {r.severity}
                  </Badge>
                  <div><strong>{r.name}:</strong> <span className="text-muted-foreground">{r.desc}</span></div>
                </div>
              ))}
            </div>
          </div>

          {/* Exit Strategy Analysis */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-semibold text-amber-400 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Exit Strategy Options</h4>
            <div className="grid sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
              <div className="space-y-1">
                <strong className="text-foreground">Option 1: Policy Surrender</strong>
                <p>Surrender policy, use cash value to repay loan. Net: {fmt(projection[projection.length - 1]?.netEquity ?? 0)} at year {premiumYears + 10}.</p>
              </div>
              <div className="space-y-1">
                <strong className="text-foreground">Option 2: Death Benefit Offset</strong>
                <p>Maintain policy; loan repaid from death benefit. Net to beneficiaries: {fmt(projection[projection.length - 1]?.deathBenefitNet ?? 0)}.</p>
              </div>
              <div className="space-y-1">
                <strong className="text-foreground">Option 3: Refinance</strong>
                <p>Refinance loan at lower rate if market conditions improve. Reduces annual interest burden.</p>
              </div>
              <div className="space-y-1">
                <strong className="text-foreground">Option 4: Partial Withdrawal</strong>
                <p>Take tax-free withdrawals (up to basis) to reduce loan balance while maintaining coverage.</p>
              </div>
            </div>
          </div>

          {/* Regulatory Notes */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
            <h4 className="text-sm font-semibold text-blue-400">Regulatory Considerations</h4>
            <p>• <strong>IRC §7702:</strong> Policy must meet cash value accumulation test (CVAT) or guideline premium test (GPT)</p>
            <p>• <strong>IRC §264:</strong> Interest on policy loans may not be deductible for policies covering key employees</p>
            <p>• <strong>Sarbanes-Oxley §402:</strong> Restrictions on company loans to executives may affect corporate-owned arrangements</p>
            <p>• <strong>State Insurance Regs:</strong> Premium financing disclosure requirements vary by state — verify local compliance</p>
          </div>

          {/* Projection Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                <th className="text-left py-2 text-muted-foreground font-medium">Year</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Premiums Paid</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Loan Balance</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Cash Value</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Net Equity</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Net DB</th>
              </tr></thead>
              <tbody>
                {projection.filter((_, i) => i % 2 === 0 || i === projection.length - 1).map(r => (
                  <tr key={r.year} className="border-b border-border/30">
                    <td className="py-1.5">{r.year}</td>
                    <td className="text-right font-mono">{fmt(r.premiumPaid)}</td>
                    <td className="text-right font-mono text-red-400">({fmt(r.loanBalance)})</td>
                    <td className="text-right font-mono text-emerald-400">{fmt(r.cashValue)}</td>
                    <td className={`text-right font-mono ${r.netEquity >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(r.netEquity)}</td>
                    <td className={`text-right font-mono ${r.deathBenefitNet >= 0 ? 'text-blue-400' : 'text-red-400'}`}>{fmt(r.deathBenefitNet)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ILIT / Trust Structuring Panel — Enriched with trust comparison
   ═══════════════════════════════════════════════════════════════ */
interface ILITProps { grossEstate: number; exemption: number; }

const TRUST_COMPARISON = [
  { type: 'ILIT', purpose: 'Remove life insurance from taxable estate', taxBenefit: 'Estate tax exclusion on death benefit', control: 'Irrevocable — no changes after creation', bestFor: 'Estate tax reduction, wealth transfer', timeframe: 'Permanent', annualCost: '$2K–$5K' },
  { type: 'SLAT', purpose: 'Spousal access to trust assets while removing from estate', taxBenefit: 'Estate tax exclusion + spousal access', control: 'Irrevocable — spouse can access as beneficiary', bestFor: 'Couples wanting estate reduction + access', timeframe: 'Permanent', annualCost: '$3K–$8K' },
  { type: 'GRAT', purpose: 'Transfer appreciation to heirs at reduced gift tax cost', taxBenefit: 'Freeze asset value; appreciation passes tax-free', control: 'Irrevocable — grantor receives annuity payments', bestFor: 'Rapidly appreciating assets, low interest rates', timeframe: '2–10 years', annualCost: '$5K–$15K' },
  { type: 'QPRT', purpose: 'Transfer residence at reduced gift tax value', taxBenefit: 'Discounted gift value based on retained interest', control: 'Irrevocable — must outlive retained interest period', bestFor: 'Primary/vacation home transfer', timeframe: '10–15 years', annualCost: '$2K–$5K' },
  { type: 'CRT', purpose: 'Income stream to donor, remainder to charity', taxBenefit: 'Partial income tax deduction + bypass capital gains', control: 'Irrevocable — income stream fixed at creation', bestFor: 'Charitable intent + income need', timeframe: 'Lifetime or term', annualCost: '$3K–$10K' },
];

export function ILITTrustPanel({ grossEstate, exemption }: ILITProps) {
  const [deathBenefit, setDeathBenefit] = useState(3000000);
  const [annualPremium, setAnnualPremium] = useState(25000);
  const [beneficiaries, setBeneficiaries] = useState(3);
  const [crummeyAmount, setCrummeyAmount] = useState(18000);
  const [showComparison, setShowComparison] = useState(false);

  const taxableEstate = Math.max(0, grossEstate - exemption);
  const estateTaxRate = 0.40;
  const estateWithInsurance = taxableEstate + deathBenefit;
  const taxWithoutILIT = estateWithInsurance * estateTaxRate;
  const taxWithILIT = taxableEstate * estateTaxRate;
  const taxSavings = taxWithoutILIT - taxWithILIT;
  const maxAnnualGift = beneficiaries * crummeyAmount;
  const giftTaxFree = annualPremium <= maxAnnualGift;

  // Estate tax savings visualization data
  const savingsPct = taxWithoutILIT > 0 ? Math.round(taxSavings / taxWithoutILIT * 100) : 0;
  const effectiveRate = grossEstate > 0 ? ((taxWithILIT / grossEstate) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gavel className="w-5 h-5 text-purple-400" /> ILIT / Trust Structuring
            <Tooltip><TooltipTrigger><Info className="w-4 h-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs">Irrevocable Life Insurance Trusts remove life insurance proceeds from the taxable estate. Compare with other trust structures for optimal estate planning.</TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <N label="Death Benefit" value={deathBenefit} onChange={setDeathBenefit} prefix="$" step={100000} />
            <N label="Annual Premium" value={annualPremium} onChange={setAnnualPremium} prefix="$" />
            <N label="Beneficiaries" value={beneficiaries} onChange={setBeneficiaries} min={1} max={10} />
            <N label="Annual Exclusion" value={crummeyAmount} onChange={setCrummeyAmount} prefix="$" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Estate Tax Without ILIT</div>
              <div className="text-lg font-bold text-red-400">{fmt(taxWithoutILIT)}</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Estate Tax With ILIT</div>
              <div className="text-lg font-bold text-emerald-400">{fmt(taxWithILIT)}</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Tax Savings</div>
              <div className="text-lg font-bold text-emerald-400">{fmt(taxSavings)}</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Crummey Capacity</div>
              <div className={`text-lg font-bold ${giftTaxFree ? 'text-emerald-400' : 'text-amber-400'}`}>{fmt(maxAnnualGift)}/yr</div>
            </CardContent></Card>
          </div>

          {/* Estate Tax Savings Visualization */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-semibold">Estate Tax Impact Visualization</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-24 shrink-0">Without ILIT</span>
                <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-red-500/60 rounded-full transition-all" style={{ width: '100%' }} />
                </div>
                <span className="text-xs font-mono w-20 text-right text-red-400">{fmt(taxWithoutILIT)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-24 shrink-0">With ILIT</span>
                <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500/60 rounded-full transition-all" style={{ width: `${taxWithoutILIT > 0 ? (taxWithILIT / taxWithoutILIT * 100) : 0}%` }} />
                </div>
                <span className="text-xs font-mono w-20 text-right text-emerald-400">{fmt(taxWithILIT)}</span>
              </div>
              <div className="text-center text-sm mt-2">
                <Badge className="bg-emerald-500/20 text-emerald-400">{savingsPct}% reduction</Badge>
                <span className="text-xs text-muted-foreground ml-2">Effective estate tax rate: {effectiveRate}%</span>
              </div>
            </div>
          </div>

          {!giftTaxFree && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div className="text-sm text-muted-foreground">
                <strong className="text-amber-400">Gift Tax Exposure:</strong> Annual premium ({fmt(annualPremium)}) exceeds Crummey withdrawal capacity ({fmt(maxAnnualGift)}). The excess {fmt(annualPremium - maxAnnualGift)} will count against lifetime gift tax exemption. Consider adding beneficiaries or reducing premium.
              </div>
            </div>
          )}

          {/* Trust Type Comparison Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold flex items-center gap-2"><Scale className="w-4 h-4 text-purple-400" /> Trust Structure Comparison</h4>
              <Button variant="outline" size="sm" onClick={() => setShowComparison(!showComparison)}>
                {showComparison ? 'Hide' : 'Show'} Comparison
              </Button>
            </div>
            {showComparison && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-border">
                    <th className="text-left py-2 font-medium">Trust Type</th>
                    <th className="text-left py-2 font-medium">Purpose</th>
                    <th className="text-left py-2 font-medium">Tax Benefit</th>
                    <th className="text-left py-2 font-medium">Best For</th>
                    <th className="text-left py-2 font-medium">Timeframe</th>
                    <th className="text-right py-2 font-medium">Annual Cost</th>
                  </tr></thead>
                  <tbody>
                    {TRUST_COMPARISON.map(t => (
                      <tr key={t.type} className={`border-b border-border/30 ${t.type === 'ILIT' ? 'bg-purple-500/5' : ''}`}>
                        <td className="py-2 font-semibold">{t.type}</td>
                        <td className="py-2 text-muted-foreground">{t.purpose}</td>
                        <td className="py-2 text-muted-foreground">{t.taxBenefit}</td>
                        <td className="py-2 text-muted-foreground">{t.bestFor}</td>
                        <td className="py-2">{t.timeframe}</td>
                        <td className="py-2 text-right font-mono">{t.annualCost}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-semibold text-purple-400">ILIT Implementation Checklist</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {[
                'Draft ILIT agreement with qualified estate planning attorney',
                'Obtain separate EIN for the trust',
                'Name ILIT as owner and beneficiary of life insurance policy',
                'Establish Crummey notice procedures for each beneficiary',
                'Fund trust annually with premium payments',
                'Send Crummey withdrawal notices within required timeframe',
                'Maintain trust records and annual accounting',
                'Review 3-year lookback rule for existing policies (IRC §2035)',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3 h-3 text-purple-400 mt-1 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Executive Compensation Panel — Enriched with golden parachute, 280G
   ═══════════════════════════════════════════════════════════════ */
interface ExecCompProps { income: number; }

export function ExecCompPanel({ income }: ExecCompProps) {
  const [baseSalary, setBaseSalary] = useState(200000);
  const [bonus, setBonus] = useState(50000);
  const [deferredComp, setDeferredComp] = useState(0);
  const [rsuValue, setRsuValue] = useState(100000);
  const [optionValue, setOptionValue] = useState(0);
  const [pensionValue, setPensionValue] = useState(0);
  const [benefitsValue, setBenefitsValue] = useState(25000);
  const [deferralPct, setDeferralPct] = useState(0);
  const [severanceMultiple, setSeveranceMultiple] = useState(2);
  const [yearsOfService, setYearsOfService] = useState(5);

  const totalComp = baseSalary + bonus + rsuValue + optionValue + pensionValue + benefitsValue;
  const cashComp = baseSalary + bonus;
  const equityComp = rsuValue + optionValue;
  const deferralAmount = cashComp * (deferralPct / 100);
  const currentTaxable = cashComp - deferralAmount + equityComp;
  const marginalRate = currentTaxable > 578125 ? 37 : currentTaxable > 231250 ? 35 : currentTaxable > 182100 ? 32 : 24;
  const taxSavingsFromDeferral = deferralAmount * (marginalRate / 100);

  // Golden Parachute / 280G Analysis
  const baseAmount = useMemo(() => {
    // IRC §280G: base amount = avg W-2 comp over prior 5 years (simplified)
    return totalComp; // Using current as proxy
  }, [totalComp]);
  const parachutePayment = baseSalary * severanceMultiple + rsuValue + optionValue;
  const parachuteThreshold = baseAmount * 3; // 3x base amount triggers 280G
  const excessParachute = Math.max(0, parachutePayment - baseAmount);
  const exciseTax = parachutePayment > parachuteThreshold ? excessParachute * 0.20 : 0;
  const is280GTriggered = parachutePayment > parachuteThreshold;

  // Deferred Comp NPV
  const deferralYears = 10;
  const discountRate = 0.05;
  const deferredCompNPV = useMemo(() => {
    if (deferralAmount <= 0) return 0;
    let npv = 0;
    for (let y = 1; y <= deferralYears; y++) {
      npv += deferralAmount / Math.pow(1 + discountRate, y);
    }
    return Math.round(npv);
  }, [deferralAmount]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Briefcase className="w-5 h-5 text-blue-400" /> Executive Compensation Analysis
            <Tooltip><TooltipTrigger><Info className="w-4 h-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs">Comprehensive executive compensation analysis including deferred comp NPV, golden parachute §280G analysis, and optimization strategies.</TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <N label="Base Salary" value={baseSalary} onChange={setBaseSalary} prefix="$" />
            <N label="Annual Bonus" value={bonus} onChange={setBonus} prefix="$" />
            <N label="RSU Value" value={rsuValue} onChange={setRsuValue} prefix="$" />
            <N label="Option Value" value={optionValue} onChange={setOptionValue} prefix="$" />
            <N label="Pension Value" value={pensionValue} onChange={setPensionValue} prefix="$" />
            <N label="Benefits Value" value={benefitsValue} onChange={setBenefitsValue} prefix="$" />
            <N label="Deferral %" value={deferralPct} onChange={setDeferralPct} suffix="%" max={80} />
            <N label="Severance Multiple" value={severanceMultiple} onChange={setSeveranceMultiple} suffix="x" min={1} max={5} step={0.5} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Total Compensation</div>
              <div className="text-lg font-bold text-blue-400">{fmt(totalComp)}</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Cash vs Equity</div>
              <div className="text-lg font-bold">{totalComp > 0 ? Math.round(cashComp / totalComp * 100) : 0}% / {totalComp > 0 ? Math.round(equityComp / totalComp * 100) : 0}%</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Deferral Tax Savings</div>
              <div className="text-lg font-bold text-emerald-400">{fmt(taxSavingsFromDeferral)}</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Marginal Rate</div>
              <div className="text-lg font-bold text-amber-400">{marginalRate}%</div>
            </CardContent></Card>
          </div>

          {/* Comp Breakdown Visual */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Compensation Breakdown</h4>
            <div className="h-6 rounded-full overflow-hidden flex bg-muted">
              {totalComp > 0 && <>
                <div className="bg-blue-500 transition-all" style={{ width: `${baseSalary / totalComp * 100}%` }} title="Base" />
                <div className="bg-emerald-500 transition-all" style={{ width: `${bonus / totalComp * 100}%` }} title="Bonus" />
                <div className="bg-purple-500 transition-all" style={{ width: `${rsuValue / totalComp * 100}%` }} title="RSU" />
                <div className="bg-amber-500 transition-all" style={{ width: `${optionValue / totalComp * 100}%` }} title="Options" />
                <div className="bg-red-400 transition-all" style={{ width: `${pensionValue / totalComp * 100}%` }} title="Pension" />
                <div className="bg-cyan-500 transition-all" style={{ width: `${benefitsValue / totalComp * 100}%` }} title="Benefits" />
              </>}
            </div>
            <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />Base</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Bonus</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500" />RSU</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />Options</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" />Pension</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-500" />Benefits</span>
            </div>
          </div>

          {/* Golden Parachute / 280G Analysis */}
          <div className={`rounded-lg p-4 space-y-3 border ${is280GTriggered ? 'bg-red-500/10 border-red-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4" /> IRC §280G Golden Parachute Analysis
            </h4>
            <div className="grid sm:grid-cols-2 gap-3 text-xs">
              <div><strong>Base Amount (5-yr avg):</strong> <span className="font-mono">{fmt(baseAmount)}</span></div>
              <div><strong>3x Threshold:</strong> <span className="font-mono">{fmt(parachuteThreshold)}</span></div>
              <div><strong>Parachute Payment:</strong> <span className="font-mono">{fmt(parachutePayment)}</span></div>
              <div><strong>Excess Amount:</strong> <span className="font-mono">{fmt(excessParachute)}</span></div>
            </div>
            {is280GTriggered ? (
              <div className="flex items-start gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <div className="text-muted-foreground">
                  <strong className="text-red-400">§280G Triggered:</strong> Parachute payment exceeds 3x base amount. Company loses deduction on excess ({fmt(excessParachute)}). Executive faces 20% excise tax of {fmt(exciseTax)} in addition to regular income tax. Consider gross-up provision or modified cap.
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-emerald-400">
                <CheckCircle2 className="w-4 h-4" /> Below §280G threshold — no excise tax exposure
              </div>
            )}
          </div>

          {/* Deferred Comp NPV */}
          {deferralPct > 0 && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-semibold text-blue-400 flex items-center gap-2"><Clock className="w-4 h-4" /> Deferred Compensation NPV Analysis</h4>
              <div className="grid sm:grid-cols-3 gap-3 text-xs">
                <div><strong>Annual Deferral:</strong> <span className="font-mono">{fmt(deferralAmount)}</span></div>
                <div><strong>NPV ({deferralYears}yr @ {(discountRate * 100).toFixed(0)}%):</strong> <span className="font-mono text-blue-400">{fmt(deferredCompNPV)}</span></div>
                <div><strong>Tax Savings/yr:</strong> <span className="font-mono text-emerald-400">{fmt(taxSavingsFromDeferral)}</span></div>
              </div>
              <p className="text-xs text-muted-foreground">NQDC plans carry employer credit risk — deferred amounts are unsecured creditor claims. Consider rabbi trust for added protection.</p>
            </div>
          )}

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <h4 className="text-sm font-semibold text-blue-400 mb-2">Optimization Strategies</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• <strong>NQDC Deferral:</strong> Defer {fmt(deferralAmount)}/yr to reduce current taxable income by {marginalRate}% marginal rate</li>
              <li>• <strong>RSU Diversification:</strong> Implement 10b5-1 plan to systematically sell vested shares</li>
              <li>• <strong>ISO Exercise Timing:</strong> Exercise early in year to manage AMT exposure</li>
              <li>• <strong>Charitable Giving:</strong> Donate appreciated stock directly to avoid capital gains</li>
              <li>• <strong>§280G Mitigation:</strong> {is280GTriggered ? 'Consider modified cap or shareholder vote (75% approval exempts from §280G)' : 'Currently below threshold — monitor with future comp changes'}</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Charitable Planning Panel — Enriched with CRT/CLT comparison
   ═══════════════════════════════════════════════════════════════ */
interface CharitableProps { income: number; }

export function CharitablePlanningPanel({ income }: CharitableProps) {
  const [strategy, setStrategy] = useState<'direct' | 'daf' | 'crt' | 'clat' | 'pf'>('daf');
  const [annualGiving, setAnnualGiving] = useState(10000);
  const [appreciatedAssetValue, setAppreciatedAssetValue] = useState(50000);
  const [costBasis, setCostBasis] = useState(20000);
  const [marginalRate, setMarginalRate] = useState(32);
  const [ltcgRate, setLtcgRate] = useState(15);
  const [crtPayoutRate, setCrtPayoutRate] = useState(5);
  const [crtTermYears, setCrtTermYears] = useState(20);

  const unrealizedGain = appreciatedAssetValue - costBasis;
  const directDeduction = annualGiving * (marginalRate / 100);
  const avoidedCapGains = unrealizedGain * (ltcgRate / 100);
  const totalBenefit = directDeduction + avoidedCapGains;
  const effectiveCost = annualGiving - directDeduction;

  // CRT vs CLT comparison
  const crtAnnualIncome = appreciatedAssetValue * (crtPayoutRate / 100);
  const crtTotalIncome = crtAnnualIncome * crtTermYears;
  const crtRemainderToCharity = appreciatedAssetValue * Math.pow(1.05, crtTermYears) - crtTotalIncome; // Simplified
  const crtDeduction = Math.max(0, appreciatedAssetValue * 0.30); // Simplified ~30% for 5% payout

  const clatAnnualToCharity = appreciatedAssetValue * (crtPayoutRate / 100);
  const clatTotalToCharity = clatAnnualToCharity * crtTermYears;
  const clatRemainderToHeirs = Math.max(0, appreciatedAssetValue * Math.pow(1.06, crtTermYears) - clatTotalToCharity);
  const clatGiftTaxReduction = clatTotalToCharity * 0.40; // Simplified

  // AGI Limits
  const agiLimit60 = income * 0.60;
  const agiLimit30 = income * 0.30;
  const agiLimit20 = income * 0.20;

  const strategies = [
    { id: 'direct', name: 'Direct Giving', desc: 'Simple cash or asset donations to qualified charities', deduction: 'Up to 60% AGI for cash, 30% for appreciated assets', best: 'Small to moderate giving, immediate impact', agiLimit: agiLimit60 },
    { id: 'daf', name: 'Donor-Advised Fund', desc: 'Contribute to fund for immediate deduction, grant to charities over time', deduction: 'Same as direct; bunching strategy for itemization', best: 'Bunching deductions, appreciated stock, legacy giving', agiLimit: agiLimit60 },
    { id: 'crt', name: 'Charitable Remainder Trust', desc: 'Irrevocable trust providing income stream with remainder to charity', deduction: 'Partial deduction based on remainder interest', best: 'Highly appreciated assets, income need, estate reduction', agiLimit: agiLimit30 },
    { id: 'clat', name: 'Charitable Lead Trust', desc: 'Trust pays charity first, remainder passes to heirs at reduced transfer tax', deduction: 'Reduces gift/estate tax on assets passing to heirs', best: 'Wealth transfer, low-interest-rate environment', agiLimit: agiLimit30 },
    { id: 'pf', name: 'Private Foundation', desc: 'Family-controlled entity for charitable giving with maximum control', deduction: 'Up to 30% AGI for cash, 20% for appreciated assets', best: 'Large-scale giving ($1M+), family involvement, legacy', agiLimit: agiLimit20 },
  ];

  const selected = strategies.find(s => s.id === strategy);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gift className="w-5 h-5 text-rose-400" /> Charitable Planning
            <Tooltip><TooltipTrigger><Info className="w-4 h-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs">Compare charitable giving vehicles including direct gifts, DAFs, CRTs, CLATs, and private foundations. Includes AGI deduction limits and CRT/CLT side-by-side analysis.</TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <N label="Annual Giving" value={annualGiving} onChange={setAnnualGiving} prefix="$" />
            <N label="Appreciated Asset" value={appreciatedAssetValue} onChange={setAppreciatedAssetValue} prefix="$" />
            <N label="Cost Basis" value={costBasis} onChange={setCostBasis} prefix="$" />
            <N label="Marginal Tax Rate" value={marginalRate} onChange={setMarginalRate} suffix="%" />
            <N label="LTCG Rate" value={ltcgRate} onChange={setLtcgRate} suffix="%" />
            <N label="CRT Payout Rate" value={crtPayoutRate} onChange={setCrtPayoutRate} suffix="%" min={5} max={50} step={0.5} />
            <N label="Trust Term (years)" value={crtTermYears} onChange={setCrtTermYears} min={5} max={30} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Tax Deduction</div>
              <div className="text-lg font-bold text-emerald-400">{fmt(directDeduction)}</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Avoided Cap Gains</div>
              <div className="text-lg font-bold text-emerald-400">{fmt(avoidedCapGains)}</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Total Tax Benefit</div>
              <div className="text-lg font-bold text-blue-400">{fmt(totalBenefit)}</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Effective Cost</div>
              <div className="text-lg font-bold text-amber-400">{fmt(effectiveCost)}</div>
            </CardContent></Card>
          </div>

          {/* AGI Deduction Limits */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-semibold">AGI Deduction Limits (Income: {fmt(income)})</h4>
            <div className="grid sm:grid-cols-3 gap-3 text-xs">
              <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                <span>60% AGI (Cash)</span>
                <span className="font-mono font-bold">{fmt(agiLimit60)}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                <span>30% AGI (Appreciated)</span>
                <span className="font-mono font-bold">{fmt(agiLimit30)}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                <span>20% AGI (PF)</span>
                <span className="font-mono font-bold">{fmt(agiLimit20)}</span>
              </div>
            </div>
            {annualGiving > (selected?.agiLimit ?? agiLimit60) && (
              <div className="flex items-start gap-2 text-xs text-amber-400 mt-2">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>Annual giving exceeds AGI limit for selected strategy. Excess carries forward up to 5 years.</span>
              </div>
            )}
          </div>

          {/* Strategy Selection */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Charitable Vehicle Comparison</h4>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {strategies.map(s => (
                <Card key={s.id} className={`cursor-pointer transition-all ${strategy === s.id ? 'ring-2 ring-rose-500' : ''}`}
                  onClick={() => setStrategy(s.id as typeof strategy)}>
                  <CardContent className="p-3">
                    <Badge className="bg-rose-500/20 text-rose-400 mb-1">{s.name}</Badge>
                    <div className="text-xs text-muted-foreground">{s.desc}</div>
                    <div className="text-xs mt-1"><strong>AGI Limit:</strong> {fmt(s.agiLimit)}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {selected && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-4 space-y-2">
              <h4 className="font-semibold text-rose-400">{selected.name}</h4>
              <div className="text-sm"><strong>Deduction:</strong> {selected.deduction}</div>
              <div className="text-sm"><strong>Best For:</strong> {selected.best}</div>
            </div>
          )}

          {/* CRT vs CLT Side-by-Side */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2"><Scale className="w-4 h-4 text-rose-400" /> CRT vs CLT Side-by-Side ({crtTermYears}-Year Term)</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-border">
                  <th className="text-left py-2 font-medium">Feature</th>
                  <th className="text-center py-2 font-medium text-emerald-400">CRT (Remainder Trust)</th>
                  <th className="text-center py-2 font-medium text-blue-400">CLAT (Lead Trust)</th>
                </tr></thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-border/30">
                    <td className="py-1.5 font-medium text-foreground">Income To</td>
                    <td className="py-1.5 text-center">Donor/Beneficiary</td>
                    <td className="py-1.5 text-center">Charity</td>
                  </tr>
                  <tr className="border-b border-border/30">
                    <td className="py-1.5 font-medium text-foreground">Remainder To</td>
                    <td className="py-1.5 text-center">Charity</td>
                    <td className="py-1.5 text-center">Heirs</td>
                  </tr>
                  <tr className="border-b border-border/30">
                    <td className="py-1.5 font-medium text-foreground">Annual Payout</td>
                    <td className="py-1.5 text-center font-mono">{fmt(crtAnnualIncome)}</td>
                    <td className="py-1.5 text-center font-mono">{fmt(clatAnnualToCharity)}</td>
                  </tr>
                  <tr className="border-b border-border/30">
                    <td className="py-1.5 font-medium text-foreground">Total Payouts</td>
                    <td className="py-1.5 text-center font-mono">{fmt(crtTotalIncome)}</td>
                    <td className="py-1.5 text-center font-mono">{fmt(clatTotalToCharity)}</td>
                  </tr>
                  <tr className="border-b border-border/30">
                    <td className="py-1.5 font-medium text-foreground">Remainder Value</td>
                    <td className="py-1.5 text-center font-mono">{fmt(Math.max(0, crtRemainderToCharity))}</td>
                    <td className="py-1.5 text-center font-mono">{fmt(clatRemainderToHeirs)}</td>
                  </tr>
                  <tr className="border-b border-border/30">
                    <td className="py-1.5 font-medium text-foreground">Tax Benefit</td>
                    <td className="py-1.5 text-center font-mono text-emerald-400">{fmt(crtDeduction)} deduction</td>
                    <td className="py-1.5 text-center font-mono text-blue-400">{fmt(clatGiftTaxReduction)} gift tax reduction</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 font-medium text-foreground">Best For</td>
                    <td className="py-1.5 text-center">Income need + charitable intent</td>
                    <td className="py-1.5 text-center">Wealth transfer + charitable intent</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Due Diligence Panel — Domain D — Enriched with search/filter
   ═══════════════════════════════════════════════════════════════ */
const DUE_DILIGENCE_ITEMS = [
  {
    category: 'Carrier Financial Strength',
    lastUpdated: '2025-12-15',
    items: [
      { title: 'AM Best Rating', desc: 'Check carrier AM Best rating (A+ or better preferred). AM Best evaluates insurer financial strength and creditworthiness.', source: 'ambest.com', importance: 'critical' as const, keywords: ['rating', 'financial', 'carrier', 'insurance'] },
      { title: 'Comdex Ranking', desc: 'Composite index averaging ratings from AM Best, Fitch, Moody\'s, and S&P. Score of 90+ indicates top-tier financial strength.', source: 'Multiple rating agencies', importance: 'critical' as const, keywords: ['ranking', 'composite', 'rating'] },
      { title: 'Statutory Surplus', desc: 'Review carrier\'s statutory surplus (assets minus liabilities). Higher surplus = greater ability to pay claims.', source: 'NAIC filings', importance: 'high' as const, keywords: ['surplus', 'assets', 'liabilities', 'claims'] },
      { title: 'Claims-Paying History', desc: 'Research carrier\'s history of paying claims, especially during market downturns (2008, 2020).', source: 'State insurance departments', importance: 'high' as const, keywords: ['claims', 'history', 'downturn'] },
    ]
  },
  {
    category: 'Product Suitability',
    lastUpdated: '2025-11-20',
    items: [
      { title: 'Policy Illustration Review', desc: 'Analyze guaranteed vs. non-guaranteed elements. Focus on guaranteed minimum crediting rates and maximum charges.', source: 'Policy illustration software', importance: 'critical' as const, keywords: ['illustration', 'guaranteed', 'crediting', 'charges'] },
      { title: 'Surrender Schedule', desc: 'Review surrender charge schedule and free withdrawal provisions. Typical IUL surrender periods are 10-15 years.', source: 'Policy contract', importance: 'high' as const, keywords: ['surrender', 'withdrawal', 'charges'] },
      { title: 'Cap/Participation Rate History', desc: 'Track historical cap rates and participation rates over 10+ years. Look for consistency and competitiveness.', source: 'Carrier annual statements', importance: 'high' as const, keywords: ['cap', 'participation', 'rate', 'history'] },
      { title: 'Cost of Insurance Charges', desc: 'Compare COI charges across carriers. Higher COI erodes cash value growth. Request current and maximum COI schedules.', source: 'Policy illustration', importance: 'critical' as const, keywords: ['COI', 'cost', 'insurance', 'charges'] },
    ]
  },
  {
    category: 'Regulatory & Compliance',
    lastUpdated: '2026-01-10',
    items: [
      { title: 'State Insurance Department', desc: 'Verify carrier is licensed in client\'s state. Check complaint ratios and regulatory actions.', source: 'NAIC Consumer Information Source', importance: 'critical' as const, keywords: ['state', 'license', 'complaint', 'regulatory'] },
      { title: 'FINRA BrokerCheck', desc: 'For variable products and securities, verify advisor registration and disciplinary history.', source: 'brokercheck.finra.org', importance: 'high' as const, keywords: ['FINRA', 'broker', 'registration', 'disciplinary'] },
      { title: 'SEC EDGAR Filings', desc: 'For variable products, review fund prospectuses and annual reports filed with the SEC.', source: 'sec.gov/edgar', importance: 'medium' as const, keywords: ['SEC', 'EDGAR', 'prospectus', 'filings'] },
      { title: 'State Guaranty Association', desc: 'Understand state guaranty fund limits (typically $300K-$500K per policy). Not a substitute for carrier strength.', source: 'NOLHGA', importance: 'medium' as const, keywords: ['guaranty', 'fund', 'limits', 'state'] },
    ]
  },
  {
    category: 'Tax & Legal',
    lastUpdated: '2026-02-05',
    items: [
      { title: 'MEC Testing', desc: 'Ensure policy does not become a Modified Endowment Contract (7-pay test). MEC status changes tax treatment of distributions.', source: 'IRC §7702A', importance: 'critical' as const, keywords: ['MEC', 'modified', 'endowment', '7-pay'] },
      { title: 'IRC §7702 Compliance', desc: 'Verify policy meets definition of life insurance under IRC §7702 (CVAT or GPT test).', source: 'IRC §7702', importance: 'critical' as const, keywords: ['IRC', '7702', 'CVAT', 'GPT', 'compliance'] },
      { title: 'Transfer for Value', desc: 'Review any policy transfers to ensure they don\'t trigger transfer-for-value rules (IRC §101(a)(2)).', source: 'IRC §101', importance: 'high' as const, keywords: ['transfer', 'value', 'IRC', '101'] },
      { title: 'Insurable Interest', desc: 'Confirm insurable interest exists at policy inception. Required in all states.', source: 'State insurance law', importance: 'critical' as const, keywords: ['insurable', 'interest', 'inception'] },
    ]
  },
  {
    category: 'Platform & Technology',
    lastUpdated: '2026-03-01',
    items: [
      { title: 'WealthBridge Platform Audit', desc: 'Review platform fee structure (70% WB / 30% advisor split at base tier). Compare with industry averages.', source: 'WealthBridge compensation grid', importance: 'high' as const, keywords: ['platform', 'fees', 'compensation', 'audit'] },
      { title: 'Integration Capabilities', desc: 'Verify CRM integration (Redtail, Wealthbox), financial planning tool compatibility, and data portability.', source: 'Platform documentation', importance: 'medium' as const, keywords: ['integration', 'CRM', 'Redtail', 'compatibility'] },
      { title: 'E&O Coverage', desc: 'Confirm errors and omissions insurance coverage limits and exclusions for the advisory practice.', source: 'E&O carrier', importance: 'high' as const, keywords: ['E&O', 'errors', 'omissions', 'coverage'] },
      { title: 'Cybersecurity Standards', desc: 'Review platform security (SOC 2, encryption, MFA). Client data protection is a fiduciary obligation.', source: 'Platform security documentation', importance: 'high' as const, keywords: ['cybersecurity', 'SOC', 'encryption', 'MFA', 'security'] },
    ]
  },
];

export function DueDiligencePanel() {
  const [searchQuery, setSearchQuery] = useState('');
  const [importanceFilter, setImportanceFilter] = useState<'all' | 'critical' | 'high' | 'medium'>('all');

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return DUE_DILIGENCE_ITEMS.map(cat => ({
      ...cat,
      items: cat.items.filter(item => {
        const matchesImportance = importanceFilter === 'all' || item.importance === importanceFilter;
        const matchesSearch = !q || item.title.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q) || item.keywords.some(k => k.toLowerCase().includes(q)) || cat.category.toLowerCase().includes(q);
        return matchesImportance && matchesSearch;
      }),
    })).filter(cat => cat.items.length > 0);
  }, [searchQuery, importanceFilter]);

  const totalItems = DUE_DILIGENCE_ITEMS.reduce((s, c) => s + c.items.length, 0);
  const filteredCount = filteredItems.reduce((s, c) => s + c.items.length, 0);

  const importanceColor = (imp: string) => {
    switch (imp) {
      case 'critical': return 'bg-red-500/20 text-red-400';
      case 'high': return 'bg-amber-500/20 text-amber-400';
      case 'medium': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const daysSince = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  };

  const freshnessColor = (days: number) => days < 90 ? 'text-emerald-400' : days < 180 ? 'text-amber-400' : 'text-red-400';
  const freshnessLabel = (days: number) => days < 90 ? 'Current' : days < 180 ? 'Review Soon' : 'Stale';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileCheck className="w-5 h-5 text-emerald-400" /> Due Diligence Checklist
            <Tooltip><TooltipTrigger><Info className="w-4 h-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs">Comprehensive due diligence framework with search, filter, and freshness tracking. Each item includes source references for independent verification.</TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search by keyword, category, or topic..." className="pl-9 h-9 text-sm"
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
              <Select value={importanceFilter} onValueChange={(v) => setImportanceFilter(v as typeof importanceFilter)}>
                <SelectTrigger className="h-9 w-36 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Showing {filteredCount} of {totalItems} items</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><Badge className="bg-red-500/20 text-red-400 text-[10px]">Critical</Badge></span>
              <span className="flex items-center gap-1"><Badge className="bg-amber-500/20 text-amber-400 text-[10px]">High</Badge></span>
              <span className="flex items-center gap-1"><Badge className="bg-blue-500/20 text-blue-400 text-[10px]">Medium</Badge></span>
            </div>
          </div>

          <Accordion type="multiple" defaultValue={filteredItems.map(c => c.category)} className="space-y-2">
            {filteredItems.map((cat, ci) => {
              const days = daysSince(cat.lastUpdated);
              return (
                <AccordionItem key={ci} value={cat.category} className="border border-border/50 rounded-lg px-4">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                    <div className="flex items-center gap-2 flex-wrap">
                      <BookOpen className="w-4 h-4 text-emerald-400" />
                      {cat.category}
                      <Badge variant="outline" className="text-xs">{cat.items.length} items</Badge>
                      <Badge className={`text-[10px] ${freshnessColor(days)} bg-transparent`}>
                        <Clock className="w-3 h-3 mr-1" />{freshnessLabel(days)} ({days}d ago)
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pt-2">
                    {cat.items.map((item, ii) => (
                      <div key={ii} className="bg-muted/30 rounded-lg p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <h5 className="text-sm font-medium">{item.title}</h5>
                          <Badge className={`text-[10px] ${importanceColor(item.importance)}`}>{item.importance}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-muted-foreground/60 flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> Source: {item.source}
                          </div>
                          <div className="flex gap-1">
                            {item.keywords.slice(0, 3).map(k => (
                              <Badge key={k} variant="outline" className="text-[9px] px-1">{k}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>

          {filteredCount === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No items match your search criteria</p>
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setSearchQuery(''); setImportanceFilter('all'); }}>Clear Filters</Button>
            </div>
          )}

          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-sm text-muted-foreground">
            <strong className="text-emerald-400">Disclaimer:</strong> This checklist is for educational purposes and does not constitute legal, tax, or investment advice. Always consult with qualified professionals before making financial decisions. Independent verification of all claims and representations is the responsibility of the advisor and client.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
