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
import { Info, Landmark, Gavel, Briefcase, Gift, FileCheck, ExternalLink, CheckCircle2, AlertTriangle, BookOpen } from 'lucide-react';
import { fmt, pct } from './engine';

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
   Premium Financing Panel
   ═══════════════════════════════════════════════════════════════ */
export function PremiumFinancingPanel() {
  const [deathBenefit, setDeathBenefit] = useState(5000000);
  const [annualPremium, setAnnualPremium] = useState(100000);
  const [premiumYears, setPremiumYears] = useState(10);
  const [loanRate, setLoanRate] = useState(5.5);
  const [policyCrediting, setPolicyCrediting] = useState(6.5);
  const [collateralPct, setCollateralPct] = useState(10);

  const totalPremiums = annualPremium * premiumYears;
  const spread = policyCrediting - loanRate;
  const collateralRequired = totalPremiums * (collateralPct / 100);
  const leverageRatio = deathBenefit / collateralRequired;

  // Year-by-year projection (simplified)
  const projection = useMemo(() => {
    const rows: { year: number; premiumPaid: number; loanBalance: number; cashValue: number; netEquity: number }[] = [];
    let loanBalance = 0;
    let cashValue = 0;
    for (let y = 1; y <= premiumYears + 10; y++) {
      if (y <= premiumYears) {
        loanBalance += annualPremium;
        cashValue += annualPremium;
      }
      loanBalance *= (1 + loanRate / 100);
      cashValue *= (1 + policyCrediting / 100);
      rows.push({
        year: y,
        premiumPaid: Math.min(y, premiumYears) * annualPremium,
        loanBalance: Math.round(loanBalance),
        cashValue: Math.round(cashValue),
        netEquity: Math.round(cashValue - loanBalance),
      });
    }
    return rows;
  }, [annualPremium, premiumYears, loanRate, policyCrediting]);

  const crossoverYear = projection.find(r => r.netEquity > 0)?.year;

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
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <N label="Death Benefit" value={deathBenefit} onChange={setDeathBenefit} prefix="$" step={100000} />
            <N label="Annual Premium" value={annualPremium} onChange={setAnnualPremium} prefix="$" step={10000} />
            <N label="Premium Years" value={premiumYears} onChange={setPremiumYears} suffix="yrs" min={5} max={20} />
            <N label="Loan Rate" value={loanRate} onChange={setLoanRate} suffix="%" step={0.25} />
            <N label="Policy Crediting Rate" value={policyCrediting} onChange={setPolicyCrediting} suffix="%" step={0.25} />
            <N label="Collateral %" value={collateralPct} onChange={setCollateralPct} suffix="%" min={5} max={30} />
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

          {/* Projection Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                <th className="text-left py-2 text-muted-foreground font-medium">Year</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Premiums Paid</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Loan Balance</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Cash Value</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Net Equity</th>
              </tr></thead>
              <tbody>
                {projection.filter((_, i) => i % 2 === 0 || i === projection.length - 1).map(r => (
                  <tr key={r.year} className="border-b border-border/30">
                    <td className="py-1.5">{r.year}</td>
                    <td className="text-right font-mono">{fmt(r.premiumPaid)}</td>
                    <td className="text-right font-mono text-red-400">({fmt(r.loanBalance)})</td>
                    <td className="text-right font-mono text-emerald-400">{fmt(r.cashValue)}</td>
                    <td className={`text-right font-mono ${r.netEquity >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(r.netEquity)}</td>
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
   ILIT / Trust Structuring Panel
   ═══════════════════════════════════════════════════════════════ */
interface ILITProps { grossEstate: number; exemption: number; }

export function ILITTrustPanel({ grossEstate, exemption }: ILITProps) {
  const [deathBenefit, setDeathBenefit] = useState(3000000);
  const [annualPremium, setAnnualPremium] = useState(25000);
  const [beneficiaries, setBeneficiaries] = useState(3);
  const [crummeyAmount, setCrummeyAmount] = useState(18000);

  const taxableEstate = Math.max(0, grossEstate - exemption);
  const estateTaxRate = 0.40;
  const estateWithInsurance = taxableEstate + deathBenefit;
  const taxWithoutILIT = estateWithInsurance * estateTaxRate;
  const taxWithILIT = taxableEstate * estateTaxRate;
  const taxSavings = taxWithoutILIT - taxWithILIT;
  const maxAnnualGift = beneficiaries * crummeyAmount;
  const giftTaxFree = annualPremium <= maxAnnualGift;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gavel className="w-5 h-5 text-purple-400" /> ILIT / Trust Structuring
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

          {!giftTaxFree && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div className="text-sm text-muted-foreground">
                <strong className="text-amber-400">Gift Tax Exposure:</strong> Annual premium ({fmt(annualPremium)}) exceeds Crummey withdrawal capacity ({fmt(maxAnnualGift)}). The excess {fmt(annualPremium - maxAnnualGift)} will count against lifetime gift tax exemption. Consider adding beneficiaries or reducing premium.
              </div>
            </div>
          )}

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
   Executive Compensation Panel
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

  const totalComp = baseSalary + bonus + rsuValue + optionValue + pensionValue + benefitsValue;
  const cashComp = baseSalary + bonus;
  const equityComp = rsuValue + optionValue;
  const deferralAmount = cashComp * (deferralPct / 100);
  const currentTaxable = cashComp - deferralAmount + equityComp;
  const marginalRate = currentTaxable > 578125 ? 37 : currentTaxable > 231250 ? 35 : currentTaxable > 182100 ? 32 : 24;
  const taxSavingsFromDeferral = deferralAmount * (marginalRate / 100);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Briefcase className="w-5 h-5 text-blue-400" /> Executive Compensation Analysis
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
            <N label="Deferred Comp" value={deferredComp} onChange={setDeferredComp} prefix="$" />
            <N label="Deferral %" value={deferralPct} onChange={setDeferralPct} suffix="%" max={80} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Total Compensation</div>
              <div className="text-lg font-bold text-blue-400">{fmt(totalComp)}</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Cash vs Equity Split</div>
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

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <h4 className="text-sm font-semibold text-blue-400 mb-2">Optimization Strategies</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• <strong>NQDC Deferral:</strong> Defer {fmt(deferralAmount)}/yr to reduce current taxable income by {marginalRate}% marginal rate</li>
              <li>• <strong>RSU Diversification:</strong> Implement 10b5-1 plan to systematically sell vested shares</li>
              <li>• <strong>ISO Exercise Timing:</strong> Exercise early in year to manage AMT exposure</li>
              <li>• <strong>Charitable Giving:</strong> Donate appreciated stock directly to avoid capital gains</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Charitable Planning Panel
   ═══════════════════════════════════════════════════════════════ */
interface CharitableProps { income: number; }

export function CharitablePlanningPanel({ income }: CharitableProps) {
  const [strategy, setStrategy] = useState<'direct' | 'daf' | 'crt' | 'clat' | 'pf'>('daf');
  const [annualGiving, setAnnualGiving] = useState(10000);
  const [appreciatedAssetValue, setAppreciatedAssetValue] = useState(50000);
  const [costBasis, setCostBasis] = useState(20000);
  const [marginalRate, setMarginalRate] = useState(32);
  const [ltcgRate, setLtcgRate] = useState(15);

  const unrealizedGain = appreciatedAssetValue - costBasis;
  const directDeduction = annualGiving * (marginalRate / 100);
  const avoidedCapGains = unrealizedGain * (ltcgRate / 100);
  const totalBenefit = directDeduction + avoidedCapGains;
  const effectiveCost = annualGiving - directDeduction;

  const strategies = [
    { id: 'direct', name: 'Direct Giving', desc: 'Simple cash or asset donations to qualified charities', deduction: 'Up to 60% AGI for cash, 30% for appreciated assets', best: 'Small to moderate giving, immediate impact' },
    { id: 'daf', name: 'Donor-Advised Fund', desc: 'Contribute to fund for immediate deduction, grant to charities over time', deduction: 'Same as direct; bunching strategy for itemization', best: 'Bunching deductions, appreciated stock, legacy giving' },
    { id: 'crt', name: 'Charitable Remainder Trust', desc: 'Irrevocable trust providing income stream with remainder to charity', deduction: 'Partial deduction based on remainder interest', best: 'Highly appreciated assets, income need, estate reduction' },
    { id: 'clat', name: 'Charitable Lead Trust', desc: 'Trust pays charity first, remainder passes to heirs at reduced transfer tax', deduction: 'Reduces gift/estate tax on assets passing to heirs', best: 'Wealth transfer, low-interest-rate environment' },
    { id: 'pf', name: 'Private Foundation', desc: 'Family-controlled entity for charitable giving with maximum control', deduction: 'Up to 30% AGI for cash, 20% for appreciated assets', best: 'Large-scale giving ($1M+), family involvement, legacy' },
  ];

  const selected = strategies.find(s => s.id === strategy);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gift className="w-5 h-5 text-rose-400" /> Charitable Planning
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <N label="Annual Giving" value={annualGiving} onChange={setAnnualGiving} prefix="$" />
            <N label="Appreciated Asset Value" value={appreciatedAssetValue} onChange={setAppreciatedAssetValue} prefix="$" />
            <N label="Cost Basis" value={costBasis} onChange={setCostBasis} prefix="$" />
            <N label="Marginal Tax Rate" value={marginalRate} onChange={setMarginalRate} suffix="%" />
            <N label="LTCG Rate" value={ltcgRate} onChange={setLtcgRate} suffix="%" />
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
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Due Diligence Panel — Domain D
   ═══════════════════════════════════════════════════════════════ */
const DUE_DILIGENCE_ITEMS = [
  {
    category: 'Carrier Financial Strength',
    items: [
      { title: 'AM Best Rating', desc: 'Check carrier AM Best rating (A+ or better preferred). AM Best evaluates insurer financial strength and creditworthiness.', source: 'ambest.com', importance: 'critical' },
      { title: 'Comdex Ranking', desc: 'Composite index averaging ratings from AM Best, Fitch, Moody\'s, and S&P. Score of 90+ indicates top-tier financial strength.', source: 'Multiple rating agencies', importance: 'critical' },
      { title: 'Statutory Surplus', desc: 'Review carrier\'s statutory surplus (assets minus liabilities). Higher surplus = greater ability to pay claims.', source: 'NAIC filings', importance: 'high' },
      { title: 'Claims-Paying History', desc: 'Research carrier\'s history of paying claims, especially during market downturns (2008, 2020).', source: 'State insurance departments', importance: 'high' },
    ]
  },
  {
    category: 'Product Suitability',
    items: [
      { title: 'Policy Illustration Review', desc: 'Analyze guaranteed vs. non-guaranteed elements. Focus on guaranteed minimum crediting rates and maximum charges.', source: 'Policy illustration software', importance: 'critical' },
      { title: 'Surrender Schedule', desc: 'Review surrender charge schedule and free withdrawal provisions. Typical IUL surrender periods are 10-15 years.', source: 'Policy contract', importance: 'high' },
      { title: 'Cap/Participation Rate History', desc: 'Track historical cap rates and participation rates over 10+ years. Look for consistency and competitiveness.', source: 'Carrier annual statements', importance: 'high' },
      { title: 'Cost of Insurance Charges', desc: 'Compare COI charges across carriers. Higher COI erodes cash value growth. Request current and maximum COI schedules.', source: 'Policy illustration', importance: 'critical' },
    ]
  },
  {
    category: 'Regulatory & Compliance',
    items: [
      { title: 'State Insurance Department', desc: 'Verify carrier is licensed in client\'s state. Check complaint ratios and regulatory actions.', source: 'NAIC Consumer Information Source', importance: 'critical' },
      { title: 'FINRA BrokerCheck', desc: 'For variable products and securities, verify advisor registration and disciplinary history.', source: 'brokercheck.finra.org', importance: 'high' },
      { title: 'SEC EDGAR Filings', desc: 'For variable products, review fund prospectuses and annual reports filed with the SEC.', source: 'sec.gov/edgar', importance: 'medium' },
      { title: 'State Guaranty Association', desc: 'Understand state guaranty fund limits (typically $300K-$500K per policy). Not a substitute for carrier strength.', source: 'NOLHGA', importance: 'medium' },
    ]
  },
  {
    category: 'Tax & Legal',
    items: [
      { title: 'MEC Testing', desc: 'Ensure policy does not become a Modified Endowment Contract (7-pay test). MEC status changes tax treatment of distributions.', source: 'IRC §7702A', importance: 'critical' },
      { title: 'IRC §7702 Compliance', desc: 'Verify policy meets definition of life insurance under IRC §7702 (CVAT or GPT test).', source: 'IRC §7702', importance: 'critical' },
      { title: 'Transfer for Value', desc: 'Review any policy transfers to ensure they don\'t trigger transfer-for-value rules (IRC §101(a)(2)).', source: 'IRC §101', importance: 'high' },
      { title: 'Insurable Interest', desc: 'Confirm insurable interest exists at policy inception. Required in all states.', source: 'State insurance law', importance: 'critical' },
    ]
  },
  {
    category: 'Platform & Technology',
    items: [
      { title: 'WealthBridge Platform Audit', desc: 'Review platform fee structure (70% WB / 30% advisor split at base tier). Compare with industry averages.', source: 'WealthBridge compensation grid', importance: 'high' },
      { title: 'Integration Capabilities', desc: 'Verify CRM integration (Redtail, Wealthbox), financial planning tool compatibility, and data portability.', source: 'Platform documentation', importance: 'medium' },
      { title: 'E&O Coverage', desc: 'Confirm errors and omissions insurance coverage limits and exclusions for the advisory practice.', source: 'E&O carrier', importance: 'high' },
      { title: 'Cybersecurity Standards', desc: 'Review platform security (SOC 2, encryption, MFA). Client data protection is a fiduciary obligation.', source: 'Platform security documentation', importance: 'high' },
    ]
  },
];

export function DueDiligencePanel() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const importanceColor = (imp: string) => {
    switch (imp) {
      case 'critical': return 'bg-red-500/20 text-red-400';
      case 'high': return 'bg-amber-500/20 text-amber-400';
      case 'medium': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileCheck className="w-5 h-5 text-emerald-400" /> Due Diligence Checklist
            <Tooltip><TooltipTrigger><Info className="w-4 h-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs">Comprehensive due diligence framework for evaluating carriers, products, and platforms. Each item includes source references for independent verification.</TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
            <span className="flex items-center gap-1"><Badge className="bg-red-500/20 text-red-400 text-[10px]">Critical</Badge></span>
            <span className="flex items-center gap-1"><Badge className="bg-amber-500/20 text-amber-400 text-[10px]">High</Badge></span>
            <span className="flex items-center gap-1"><Badge className="bg-blue-500/20 text-blue-400 text-[10px]">Medium</Badge></span>
          </div>

          <Accordion type="single" collapsible className="space-y-2">
            {DUE_DILIGENCE_ITEMS.map((cat, ci) => (
              <AccordionItem key={ci} value={cat.category} className="border border-border/50 rounded-lg px-4">
                <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-emerald-400" />
                    {cat.category}
                    <Badge variant="outline" className="text-xs ml-2">{cat.items.length} items</Badge>
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
                      <div className="text-xs text-muted-foreground/60 flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> Source: {item.source}
                      </div>
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-sm text-muted-foreground">
            <strong className="text-emerald-400">Disclaimer:</strong> This checklist is for educational purposes and does not constitute legal, tax, or investment advice. Always consult with qualified professionals before making financial decisions. Independent verification of all claims and representations is the responsibility of the advisor and client.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
