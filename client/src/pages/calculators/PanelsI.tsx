import { fmt, pct } from './format';
/* ═══ PanelsI — Domain B: Client Planning P0 Surfaces ═══ */
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, Wallet, CreditCard, Gavel, FileCheck, Dices, Percent, Plus, Trash2, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import SensitivityAnalysis from './SensitivityAnalysis';

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
   Balance Sheet Panel — Aggregated Net Worth View
   ═══════════════════════════════════════════════════════════════ */
interface BalanceSheetProps { nw: number; savings: number; retirement401k: number; mortgage: number; debt: number; }

export function BalanceSheetPanel({ nw, savings, retirement401k, mortgage, debt }: BalanceSheetProps) {
  const [realEstate, setRealEstate] = useState(350000);
  const [vehicles, setVehicles] = useState(35000);
  const [otherAssets, setOtherAssets] = useState(20000);
  const [brokerageAcct, setBrokerageAcct] = useState(75000);
  const [rothIRA, setRothIRA] = useState(45000);
  const [hsa, setHsa] = useState(15000);
  const [lifeInsCV, setLifeInsCV] = useState(0);
  const [studentLoans, setStudentLoans] = useState(0);
  const [autoLoans, setAutoLoans] = useState(0);
  const [creditCards, setCreditCards] = useState(0);
  const [otherLiabilities, setOtherLiabilities] = useState(0);

  const totalAssets = savings + retirement401k + brokerageAcct + rothIRA + hsa + lifeInsCV + realEstate + vehicles + otherAssets;
  const totalLiabilities = mortgage + debt + studentLoans + autoLoans + creditCards + otherLiabilities;
  const netWorth = totalAssets - totalLiabilities;
  const debtToAssetRatio = totalAssets > 0 ? totalLiabilities / totalAssets : 0;
  const liquidAssets = savings + brokerageAcct + rothIRA + hsa;
  const liquidityRatio = totalLiabilities > 0 ? liquidAssets / totalLiabilities : Infinity;

  const assets = [
    { category: 'Liquid', items: [
      { name: 'Cash / Savings', value: savings },
      { name: 'Brokerage Account', value: brokerageAcct },
      { name: 'Roth IRA', value: rothIRA },
      { name: 'HSA', value: hsa },
    ]},
    { category: 'Retirement', items: [
      { name: '401(k) / 403(b)', value: retirement401k },
      { name: 'Life Insurance CV', value: lifeInsCV },
    ]},
    { category: 'Real Assets', items: [
      { name: 'Real Estate', value: realEstate },
      { name: 'Vehicles', value: vehicles },
      { name: 'Other Assets', value: otherAssets },
    ]},
  ];

  const liabilities = [
    { name: 'Mortgage', value: mortgage },
    { name: 'Consumer Debt', value: debt },
    { name: 'Student Loans', value: studentLoans },
    { name: 'Auto Loans', value: autoLoans },
    { name: 'Credit Cards', value: creditCards },
    { name: 'Other Liabilities', value: otherLiabilities },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="w-5 h-5 text-blue-400" /> Balance Sheet — Net Worth View
            <Tooltip><TooltipTrigger><Info className="w-4 h-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs">Aggregated view of all assets vs. liabilities. Net worth is the foundation of financial health — track it over time to measure progress toward your goals.</TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Total Assets</div>
              <div className="text-lg font-bold text-emerald-400">{fmt(totalAssets)}</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Total Liabilities</div>
              <div className="text-lg font-bold text-red-400">{fmt(totalLiabilities)}</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Net Worth</div>
              <div className={`text-lg font-bold ${netWorth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(netWorth)}</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Debt-to-Asset</div>
              <div className={`text-lg font-bold ${debtToAssetRatio < 0.3 ? 'text-emerald-400' : debtToAssetRatio < 0.5 ? 'text-amber-400' : 'text-red-400'}`}>
                {(debtToAssetRatio * 100).toFixed(1)}%
              </div>
            </CardContent></Card>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Assets */}
            <div>
              <h4 className="text-sm font-semibold mb-3 text-emerald-400">Assets</h4>
              {assets.map(cat => (
                <div key={cat.category} className="mb-4">
                  <div className="text-xs font-medium text-muted-foreground mb-2">{cat.category}</div>
                  {cat.items.map(item => (
                    <div key={item.name} className="flex items-center justify-between py-1 border-b border-border/30">
                      <span className="text-sm">{item.name}</span>
                      <span className="font-mono text-sm text-emerald-400">{fmt(item.value)}</span>
                    </div>
                  ))}
                </div>
              ))}
              <div className="flex items-center justify-between py-2 border-t-2 border-emerald-500/30 font-semibold">
                <span>Total Assets</span>
                <span className="font-mono text-emerald-400">{fmt(totalAssets)}</span>
              </div>
            </div>

            {/* Liabilities */}
            <div>
              <h4 className="text-sm font-semibold mb-3 text-red-400">Liabilities</h4>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <N label="Student Loans" value={studentLoans} onChange={setStudentLoans} prefix="$" />
                <N label="Auto Loans" value={autoLoans} onChange={setAutoLoans} prefix="$" />
                <N label="Credit Cards" value={creditCards} onChange={setCreditCards} prefix="$" />
                <N label="Other" value={otherLiabilities} onChange={setOtherLiabilities} prefix="$" />
              </div>
              {liabilities.filter(l => l.value > 0).map(l => (
                <div key={l.name} className="flex items-center justify-between py-1 border-b border-border/30">
                  <span className="text-sm">{l.name}</span>
                  <span className="font-mono text-sm text-red-400">({fmt(l.value)})</span>
                </div>
              ))}
              <div className="flex items-center justify-between py-2 border-t-2 border-red-500/30 font-semibold">
                <span>Total Liabilities</span>
                <span className="font-mono text-red-400">({fmt(totalLiabilities)})</span>
              </div>
            </div>
          </div>

          {/* Additional Inputs */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Additional Asset Details</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <N label="Real Estate" value={realEstate} onChange={setRealEstate} prefix="$" />
              <N label="Vehicles" value={vehicles} onChange={setVehicles} prefix="$" />
              <N label="Brokerage" value={brokerageAcct} onChange={setBrokerageAcct} prefix="$" />
              <N label="Roth IRA" value={rothIRA} onChange={setRothIRA} prefix="$" />
              <N label="HSA" value={hsa} onChange={setHsa} prefix="$" />
              <N label="Life Ins. CV" value={lifeInsCV} onChange={setLifeInsCV} prefix="$" />
              <N label="Other Assets" value={otherAssets} onChange={setOtherAssets} prefix="$" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Debt Management Panel
   ═══════════════════════════════════════════════════════════════ */
interface DebtProps { mortgage: number; debt: number; income: number; }

interface DebtItem { name: string; balance: number; rate: number; minPayment: number; }

export function DebtManagementPanel({ mortgage, debt, income }: DebtProps) {
  const [debts, setDebts] = useState<DebtItem[]>([
    { name: 'Mortgage', balance: mortgage, rate: 6.5, minPayment: 2200 },
    { name: 'Student Loans', balance: 35000, rate: 5.5, minPayment: 400 },
    { name: 'Auto Loan', balance: 18000, rate: 7.0, minPayment: 350 },
    { name: 'Credit Card', balance: debt, rate: 22.0, minPayment: 150 },
  ]);
  const [extraMonthly, setExtraMonthly] = useState(500);
  const [strategy, setStrategy] = useState<'avalanche' | 'snowball'>('avalanche');

  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
  const totalMinPayment = debts.reduce((s, d) => s + d.minPayment, 0);
  const dti = income > 0 ? (totalMinPayment * 12) / income : 0;
  const weightedRate = totalDebt > 0 ? debts.reduce((s, d) => s + d.balance * d.rate, 0) / totalDebt : 0;

  // Sort by strategy
  const sorted = [...debts].filter(d => d.balance > 0).sort((a, b) =>
    strategy === 'avalanche' ? b.rate - a.rate : a.balance - b.balance
  );

  const addDebt = () => setDebts(prev => [...prev, { name: 'New Debt', balance: 0, rate: 0, minPayment: 0 }]);
  const removeDebt = (i: number) => setDebts(prev => prev.filter((_, idx) => idx !== i));
  const updateDebt = (i: number, field: keyof DebtItem, value: string | number) => {
    setDebts(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: value } : d));
  };

  // Payoff timeline estimate (simplified)
  const monthsToPayoff = useMemo(() => {
    if (totalDebt <= 0) return 0;
    const monthlyPayment = totalMinPayment + extraMonthly;
    const avgRate = weightedRate / 100 / 12;
    if (monthlyPayment <= totalDebt * avgRate) return 999; // can't pay off
    return Math.ceil(Math.log(monthlyPayment / (monthlyPayment - totalDebt * avgRate)) / Math.log(1 + avgRate));
  }, [totalDebt, totalMinPayment, extraMonthly, weightedRate]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="w-5 h-5 text-amber-400" /> Debt Management
            <Tooltip><TooltipTrigger><Info className="w-4 h-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs">Analyze your debt structure, interest costs, and payoff strategies. Compare avalanche vs. snowball methods to find the optimal repayment plan.</TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Total Debt</div>
              <div className="text-lg font-bold text-red-400">{fmt(totalDebt)}</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Weighted Rate</div>
              <div className="text-lg font-bold text-amber-400">{weightedRate.toFixed(1)}%</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">DTI Ratio</div>
              <div className={`text-lg font-bold ${dti < 0.36 ? 'text-emerald-400' : dti < 0.43 ? 'text-amber-400' : 'text-red-400'}`}>
                {(dti * 100).toFixed(1)}%
              </div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Payoff Timeline</div>
              <div className="text-lg font-bold text-blue-400">{monthsToPayoff < 999 ? `${monthsToPayoff} mo` : '∞'}</div>
            </CardContent></Card>
          </div>

          {/* Strategy Selection */}
          <div className="flex items-center gap-4">
            <Label className="text-sm">Payoff Strategy:</Label>
            <Select value={strategy} onValueChange={v => setStrategy(v as 'avalanche' | 'snowball')}>
              <SelectTrigger className="w-48 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="avalanche">Avalanche (Highest Rate First)</SelectItem>
                <SelectItem value="snowball">Snowball (Smallest Balance First)</SelectItem>
              </SelectContent>
            </Select>
            <N label="Extra Monthly" value={extraMonthly} onChange={setExtraMonthly} prefix="$" />
          </div>

          {/* Debt Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                <th className="text-left py-2 text-muted-foreground font-medium">Debt</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Balance</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Rate</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Min Payment</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Priority</th>
                <th className="w-8"></th>
              </tr></thead>
              <tbody>
                {debts.map((d, i) => {
                  const priority = sorted.findIndex(s => s.name === d.name);
                  return (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2"><Input className="h-7 text-sm w-32" value={d.name} onChange={e => updateDebt(i, 'name', e.target.value)} /></td>
                      <td className="text-right"><Input type="number" className="h-7 text-sm w-24 text-right ml-auto" value={d.balance} onChange={e => updateDebt(i, 'balance', Number(e.target.value) || 0)} /></td>
                      <td className="text-right"><Input type="number" className="h-7 text-sm w-16 text-right ml-auto" value={d.rate} step={0.1} onChange={e => updateDebt(i, 'rate', Number(e.target.value) || 0)} /></td>
                      <td className="text-right"><Input type="number" className="h-7 text-sm w-20 text-right ml-auto" value={d.minPayment} onChange={e => updateDebt(i, 'minPayment', Number(e.target.value) || 0)} /></td>
                      <td className="text-right">{d.balance > 0 ? <Badge className={priority === 0 ? 'bg-red-500/20 text-red-400' : 'bg-muted text-muted-foreground'}>#{priority + 1}</Badge> : '—'}</td>
                      <td><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeDebt(i)} aria-label="Remove debt"><Trash2 className="w-3 h-3" /></Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Button variant="outline" size="sm" onClick={addDebt} className="gap-1"><Plus className="w-3 h-3" /> Add Debt</Button>

          {/* Payoff Order */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <h4 className="text-sm font-semibold text-blue-400 mb-2">Recommended Payoff Order ({strategy === 'avalanche' ? 'Highest Rate First' : 'Smallest Balance First'})</h4>
            <ol className="space-y-1">
              {sorted.map((d, i) => (
                <li key={d.name} className="text-sm flex items-center gap-2">
                  <Badge className="bg-muted text-xs w-6 justify-center">{i + 1}</Badge>
                  <span>{d.name}</span>
                  <span className="text-muted-foreground">— {fmt(d.balance)} @ {d.rate}%</span>
                </li>
              ))}
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Trust Engineering Panel
   ═══════════════════════════════════════════════════════════════ */
interface TrustProps { grossEstate: number; exemption: number; }

const TRUST_TYPES = [
  { id: 'slat', name: 'SLAT', full: 'Spousal Lifetime Access Trust', whenToUse: 'Married couples wanting to use exemption while retaining indirect access', taxBenefit: 'Removes assets from taxable estate while spouse can access', risk: 'Divorce risk, reciprocal trust doctrine', minEstate: 5000000 },
  { id: 'idgt', name: 'IDGT', full: 'Intentionally Defective Grantor Trust', whenToUse: 'High-net-worth individuals wanting to freeze estate value', taxBenefit: 'Assets grow outside estate; grantor pays income tax (further reducing estate)', risk: 'Complexity, IRS scrutiny on valuation', minEstate: 3000000 },
  { id: 'grat', name: 'GRAT', full: 'Grantor Retained Annuity Trust', whenToUse: 'Transferring appreciating assets with minimal gift tax', taxBenefit: 'Excess growth over 7520 rate passes tax-free', risk: 'Mortality risk during term; low-rate environment reduces benefit', minEstate: 2000000 },
  { id: 'crt', name: 'CRT', full: 'Charitable Remainder Trust', whenToUse: 'Clients with highly appreciated assets wanting income + charitable deduction', taxBenefit: 'Partial charitable deduction, capital gains deferral, income stream', risk: 'Irrevocable; charity gets remainder', minEstate: 1000000 },
  { id: 'qprt', name: 'QPRT', full: 'Qualified Personal Residence Trust', whenToUse: 'Transferring primary residence at discounted gift tax value', taxBenefit: 'Residence transferred at discounted value; appreciation excluded from estate', risk: 'Must survive term; lose residence rights after term', minEstate: 2000000 },
  { id: 'dynasty', name: 'Dynasty', full: 'Dynasty Trust', whenToUse: 'Multi-generational wealth transfer in GST-exempt states', taxBenefit: 'Assets grow free of estate/gift/GST tax for multiple generations', risk: 'State law variations; very long-term commitment', minEstate: 10000000 },
  { id: 'ilit', name: 'ILIT', full: 'Irrevocable Life Insurance Trust', whenToUse: 'Keeping life insurance proceeds out of taxable estate', taxBenefit: 'Death benefit excluded from estate; provides estate liquidity', risk: 'Irrevocable; Crummey notice requirements', minEstate: 1000000 },
];

export function TrustEngineeringPanel({ grossEstate, exemption }: TrustProps) {
  const [selectedTrust, setSelectedTrust] = useState('slat');
  const taxableEstate = Math.max(0, grossEstate - exemption);
  const estateTaxRate = 0.40;
  const potentialTax = taxableEstate * estateTaxRate;

  const applicable = TRUST_TYPES.filter(t => grossEstate >= t.minEstate);
  const selected = TRUST_TYPES.find(t => t.id === selectedTrust);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gavel className="w-5 h-5 text-purple-400" /> Trust Engineering
            <Tooltip><TooltipTrigger><Info className="w-4 h-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs">Evaluate trust structures for estate planning. Each trust type has specific use cases, tax benefits, and risks. Consult with an estate planning attorney before implementation.</TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Gross Estate</div>
              <div className="text-lg font-bold">{fmt(grossEstate)}</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Taxable Estate</div>
              <div className={`text-lg font-bold ${taxableEstate > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{fmt(taxableEstate)}</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Potential Estate Tax</div>
              <div className="text-lg font-bold text-red-400">{fmt(potentialTax)}</div>
            </CardContent></Card>
          </div>

          {/* Trust Type Cards */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Applicable Trust Structures ({applicable.length} of {TRUST_TYPES.length})</h4>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {TRUST_TYPES.map(t => (
                <Card key={t.id} className={`cursor-pointer transition-all ${selectedTrust === t.id ? 'ring-2 ring-purple-500' : ''} ${grossEstate < t.minEstate ? 'opacity-40' : ''}`}
                  onClick={() => setSelectedTrust(t.id)}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <Badge className="bg-purple-500/20 text-purple-400">{t.name}</Badge>
                      {grossEstate < t.minEstate && <Badge variant="outline" className="text-xs">Min {fmt(t.minEstate)}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{t.full}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Selected Trust Detail */}
          {selected && (
            <Card className="bg-purple-500/5 border-purple-500/30">
              <CardContent className="p-4 space-y-3">
                <h4 className="font-semibold">{selected.full} ({selected.name})</h4>
                <div className="grid gap-2 text-sm">
                  <div><span className="font-medium text-purple-400">When to Use:</span> {selected.whenToUse}</div>
                  <div><span className="font-medium text-emerald-400">Tax Benefit:</span> {selected.taxBenefit}</div>
                  <div><span className="font-medium text-amber-400">Key Risks:</span> {selected.risk}</div>
                  <div><span className="font-medium text-muted-foreground">Minimum Estate:</span> {fmt(selected.minEstate)}</div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Governance / IPS Panel
   ═══════════════════════════════════════════════════════════════ */
interface GovernanceProps { riskTolerance: string; }

export function GovernanceIPSPanel({ riskTolerance }: GovernanceProps) {
  const [investmentObjective, setInvestmentObjective] = useState('growth');
  const [timeHorizon, setTimeHorizon] = useState(20);
  const [maxDrawdown, setMaxDrawdown] = useState(25);
  const [rebalanceFreq, setRebalanceFreq] = useState('quarterly');
  const [equityMax, setEquityMax] = useState(80);
  const [fixedIncomeMin, setFixedIncomeMin] = useState(15);
  const [altMax, setAltMax] = useState(10);
  const [cashMin, setCashMin] = useState(5);

  const totalAllocation = equityMax + fixedIncomeMin + altMax + cashMin;
  const isBalanced = totalAllocation === 100;

  const riskProfiles: Record<string, { equity: number; fixed: number; alt: number; cash: number }> = {
    conservative: { equity: 30, fixed: 50, alt: 5, cash: 15 },
    moderate: { equity: 60, fixed: 30, alt: 5, cash: 5 },
    aggressive: { equity: 80, fixed: 10, alt: 8, cash: 2 },
  };

  const suggestedAlloc = riskProfiles[riskTolerance] || riskProfiles.moderate;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileCheck className="w-5 h-5 text-blue-400" /> Investment Policy Statement (IPS) Generator
            <Tooltip><TooltipTrigger><Info className="w-4 h-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs">Generate a formal Investment Policy Statement based on your risk profile, goals, and constraints. IPS documents are best practice for fiduciary compliance and client governance.</TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Investment Objective</Label>
              <Select value={investmentObjective} onValueChange={setInvestmentObjective}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="preservation">Capital Preservation</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="balanced">Balanced</SelectItem>
                  <SelectItem value="growth">Growth</SelectItem>
                  <SelectItem value="aggressive_growth">Aggressive Growth</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <N label="Time Horizon (years)" value={timeHorizon} onChange={setTimeHorizon} suffix="yrs" min={1} max={50} />
            <N label="Max Drawdown Tolerance" value={maxDrawdown} onChange={setMaxDrawdown} suffix="%" min={5} max={50} />
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Rebalance Frequency</Label>
              <Select value={rebalanceFreq} onValueChange={setRebalanceFreq}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="semiannual">Semi-Annual</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                  <SelectItem value="threshold">Threshold-Based (5%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Asset Allocation */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold">Target Asset Allocation</h4>
              {!isBalanced && <Badge className="bg-red-500/20 text-red-400">Total: {totalAllocation}% (must = 100%)</Badge>}
              {isBalanced && <Badge className="bg-emerald-500/20 text-emerald-400">Balanced ✓</Badge>}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <N label="Equity Max" value={equityMax} onChange={setEquityMax} suffix="%" min={0} max={100} />
              <N label="Fixed Income Min" value={fixedIncomeMin} onChange={setFixedIncomeMin} suffix="%" min={0} max={100} />
              <N label="Alternatives Max" value={altMax} onChange={setAltMax} suffix="%" min={0} max={100} />
              <N label="Cash Min" value={cashMin} onChange={setCashMin} suffix="%" min={0} max={100} />
            </div>
            {/* Visual bar */}
            <div className="mt-3 h-6 rounded-full overflow-hidden flex bg-muted">
              <div className="bg-blue-500 transition-all" style={{ width: `${equityMax}%` }} />
              <div className="bg-emerald-500 transition-all" style={{ width: `${fixedIncomeMin}%` }} />
              <div className="bg-purple-500 transition-all" style={{ width: `${altMax}%` }} />
              <div className="bg-amber-500 transition-all" style={{ width: `${cashMin}%` }} />
            </div>
            <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />Equity {equityMax}%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Fixed Income {fixedIncomeMin}%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500" />Alternatives {altMax}%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />Cash {cashMin}%</span>
            </div>
          </div>

          {/* Suggested vs Current */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <h4 className="text-sm font-semibold text-blue-400 mb-2">Suggested Allocation for "{riskTolerance}" Risk Profile</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <div>Equity: {suggestedAlloc.equity}%</div>
              <div>Fixed: {suggestedAlloc.fixed}%</div>
              <div>Alt: {suggestedAlloc.alt}%</div>
              <div>Cash: {suggestedAlloc.cash}%</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Monte Carlo Panel
   ═══════════════════════════════════════════════════════════════ */
interface MonteCarloProps { savings: number; retirement401k: number; monthlySav: number; retireAge: number; age: number; }

export function MonteCarloPanel({ savings, retirement401k, monthlySav, retireAge, age }: MonteCarloProps) {
  const [simulations, setSimulations] = useState(1000);
  const [meanReturn, setMeanReturn] = useState(7.0);
  const [stdDev, setStdDev] = useState(15.0);
  const [withdrawalRate, setWithdrawalRate] = useState(4.0);
  const [inflationRate, setInflationRate] = useState(3.0);

  const results = useMemo(() => {
    const startingBalance = savings + retirement401k;
    const yearsToRetire = Math.max(1, retireAge - age);
    const yearsInRetirement = 30;
    const monthlyContrib = monthlySav;
    const mu = meanReturn / 100;
    const sigma = stdDev / 100;
    const wr = withdrawalRate / 100;
    const inf = inflationRate / 100;

    // Simplified Monte Carlo with deterministic percentile estimation
    // Use normal distribution approximation for speed
    const scenarios: number[] = [];
    const rng = (seed: number) => {
      let s = seed;
      return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    };

    for (let i = 0; i < Math.min(simulations, 2000); i++) {
      const rand = rng(i + 42);
      let balance = startingBalance;

      // Accumulation phase
      for (let y = 0; y < yearsToRetire; y++) {
        const u1 = rand(), u2 = rand();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const annualReturn = mu + sigma * z;
        balance = balance * (1 + annualReturn) + monthlyContrib * 12;
      }

      // Withdrawal phase
      let survived = true;
      for (let y = 0; y < yearsInRetirement; y++) {
        const u1 = rand(), u2 = rand();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const annualReturn = mu + sigma * z;
        const withdrawal = balance * wr * Math.pow(1 + inf, y);
        balance = balance * (1 + annualReturn) - withdrawal;
        if (balance <= 0) { survived = false; break; }
      }

      scenarios.push(survived ? balance : 0);
    }

    scenarios.sort((a, b) => a - b);
    const successCount = scenarios.filter(s => s > 0).length;
    const successRate = successCount / scenarios.length;
    const p10 = scenarios[Math.floor(scenarios.length * 0.10)];
    const p25 = scenarios[Math.floor(scenarios.length * 0.25)];
    const p50 = scenarios[Math.floor(scenarios.length * 0.50)];
    const p75 = scenarios[Math.floor(scenarios.length * 0.75)];
    const p90 = scenarios[Math.floor(scenarios.length * 0.90)];

    return { successRate, p10, p25, p50, p75, p90, total: scenarios.length };
  }, [savings, retirement401k, monthlySav, retireAge, age, simulations, meanReturn, stdDev, withdrawalRate, inflationRate]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Dices className="w-5 h-5 text-purple-400" /> Monte Carlo Simulation
            <Tooltip><TooltipTrigger><Info className="w-4 h-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs">Run probability-weighted scenario analysis for retirement outcomes. Simulates thousands of market scenarios to estimate success probability.</TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <N label="Simulations" value={simulations} onChange={setSimulations} min={100} max={5000} step={100} />
            <N label="Mean Return" value={meanReturn} onChange={setMeanReturn} suffix="%" step={0.5} />
            <N label="Std Deviation" value={stdDev} onChange={setStdDev} suffix="%" step={0.5} />
            <N label="Withdrawal Rate" value={withdrawalRate} onChange={setWithdrawalRate} suffix="%" step={0.25} />
            <N label="Inflation" value={inflationRate} onChange={setInflationRate} suffix="%" step={0.25} />
          </div>

          {/* Success Rate */}
          <div className="text-center">
            <div className="text-4xl font-bold mb-1" style={{ color: results.successRate >= 0.9 ? '#22c55e' : results.successRate >= 0.75 ? '#f59e0b' : '#ef4444' }}>
              {(results.successRate * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">Probability of Success ({results.total} simulations)</div>
            <div className="h-3 rounded-full bg-muted mt-3 overflow-hidden max-w-md mx-auto">
              <div className="h-full transition-all rounded-full" style={{
                width: `${results.successRate * 100}%`,
                backgroundColor: results.successRate >= 0.9 ? '#22c55e' : results.successRate >= 0.75 ? '#f59e0b' : '#ef4444'
              }} />
            </div>
          </div>

          {/* Percentile Distribution */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Portfolio Value Distribution at End of Retirement</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {[
                { label: '10th %ile', value: results.p10, color: 'text-red-400' },
                { label: '25th %ile', value: results.p25, color: 'text-amber-400' },
                { label: 'Median', value: results.p50, color: 'text-blue-400' },
                { label: '75th %ile', value: results.p75, color: 'text-emerald-400' },
                { label: '90th %ile', value: results.p90, color: 'text-emerald-400' },
              ].map(p => (
                <Card key={p.label} className="bg-muted/50"><CardContent className="p-2 text-center">
                  <div className="text-xs text-muted-foreground">{p.label}</div>
                  <div className={`text-sm font-bold ${p.color}`}>{fmt(p.value)}</div>
                </CardContent></Card>
              ))}
            </div>
          </div>

          {/* Guidance */}
          <div className={`rounded-lg p-3 border ${results.successRate >= 0.9 ? 'bg-emerald-500/10 border-emerald-500/30' : results.successRate >= 0.75 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            <h4 className={`text-sm font-semibold mb-1 ${results.successRate >= 0.9 ? 'text-emerald-400' : results.successRate >= 0.75 ? 'text-amber-400' : 'text-red-400'}`}>
              {results.successRate >= 0.9 ? 'Strong Position' : results.successRate >= 0.75 ? 'Moderate Risk' : 'High Risk — Action Needed'}
            </h4>
            <p className="text-sm text-muted-foreground">
              {results.successRate >= 0.9
                ? 'Your plan has a high probability of success. Consider whether you can afford to take slightly less risk or increase spending.'
                : results.successRate >= 0.75
                ? 'Your plan has moderate success probability. Consider increasing savings, reducing withdrawal rate, or extending your working years.'
                : 'Your plan has significant risk of failure. Strongly consider increasing savings, reducing planned spending, delaying retirement, or adjusting investment strategy.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Sensitivity Analysis — Wealth Engine 4.0+ */}
      <SensitivityAnalysis
        savings={savings + retirement401k}
        income={monthlySav * 12 * 10}
        age={age}
        retireAge={retireAge}
        investReturn={meanReturn / 100}
        volatility={stdDev / 100}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Stock-Based Compensation Panel
   ═══════════════════════════════════════════════════════════════ */
interface StockCompProps { income: number; }

export function StockCompPanel({ income }: StockCompProps) {
  const [compType, setCompType] = useState<'rsu' | 'iso' | 'nso' | 'espp'>('rsu');
  const [sharesGranted, setSharesGranted] = useState(1000);
  const [grantPrice, setGrantPrice] = useState(50);
  const [currentPrice, setCurrentPrice] = useState(75);
  const [vestingYears, setVestingYears] = useState(4);
  const [vestedShares, setVestedShares] = useState(250);
  const [esppDiscount, setEsppDiscount] = useState(15);
  const [marginalTaxRate, setMarginalTaxRate] = useState(32);
  const [ltcgRate, setLtcgRate] = useState(15);

  const totalValue = sharesGranted * currentPrice;
  const vestedValue = vestedShares * currentPrice;
  const unvestedValue = (sharesGranted - vestedShares) * currentPrice;
  const gain = (currentPrice - grantPrice) * vestedShares;
  const concentrationPct = totalValue / Math.max(income, 1);

  const taxEstimate = useMemo(() => {
    switch (compType) {
      case 'rsu': return gain * (marginalTaxRate / 100); // RSUs taxed as ordinary income at vest
      case 'iso': return gain > 0 ? gain * (ltcgRate / 100) : 0; // ISOs: LTCG if qualifying disposition
      case 'nso': return gain * (marginalTaxRate / 100); // NSOs: ordinary income on spread
      case 'espp': return vestedShares * currentPrice * (esppDiscount / 100) * (marginalTaxRate / 100); // ESPP discount taxed
      default: return 0;
    }
  }, [compType, gain, marginalTaxRate, ltcgRate, vestedShares, currentPrice, esppDiscount]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Percent className="w-5 h-5 text-blue-400" /> Stock-Based Compensation Analysis
            <Tooltip><TooltipTrigger><Info className="w-4 h-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs">Model RSU, ISO, and NQSO vesting schedules with tax implications. Optimize exercise timing and diversification strategies to maximize after-tax value.</TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Compensation Type</Label>
              <Select value={compType} onValueChange={v => setCompType(v as 'rsu' | 'iso' | 'nso' | 'espp')}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rsu">RSU (Restricted Stock Units)</SelectItem>
                  <SelectItem value="iso">ISO (Incentive Stock Options)</SelectItem>
                  <SelectItem value="nso">NSO (Non-Qualified Stock Options)</SelectItem>
                  <SelectItem value="espp">ESPP (Employee Stock Purchase Plan)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <N label="Shares Granted" value={sharesGranted} onChange={setSharesGranted} />
            <N label="Grant Price" value={grantPrice} onChange={setGrantPrice} prefix="$" step={0.01} />
            <N label="Current Price" value={currentPrice} onChange={setCurrentPrice} prefix="$" step={0.01} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <N label="Vesting Period" value={vestingYears} onChange={setVestingYears} suffix="yrs" />
            <N label="Vested Shares" value={vestedShares} onChange={setVestedShares} />
            <N label="Marginal Tax Rate" value={marginalTaxRate} onChange={setMarginalTaxRate} suffix="%" />
            <N label="LTCG Rate" value={ltcgRate} onChange={setLtcgRate} suffix="%" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Total Grant Value</div>
              <div className="text-lg font-bold text-blue-400">{fmt(totalValue)}</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Vested Value</div>
              <div className="text-lg font-bold text-emerald-400">{fmt(vestedValue)}</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Unrealized Gain</div>
              <div className={`text-lg font-bold ${gain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(gain)}</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Est. Tax on Exercise</div>
              <div className="text-lg font-bold text-amber-400">{fmt(taxEstimate)}</div>
            </CardContent></Card>
          </div>

          {/* Concentration Warning */}
          {concentrationPct > 1 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-amber-400">Concentration Risk</h4>
                <p className="text-sm text-muted-foreground">
                  Stock compensation represents {(concentrationPct * 100).toFixed(0)}% of annual income.
                  Consider a diversification strategy such as a 10b5-1 trading plan to systematically reduce concentration.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
