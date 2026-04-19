/* ═══════════════════════════════════════════════════════════════
   exportUnifiedPlan — Comprehensive PDF export combining:
   - ClientWealthHub data (protection, tax, retirement, growth, estate, education)
   - AdvancedStrategiesHub data (PF, ILIT, Exec Comp, Charitable, Business)
   - Holistic Cascade Bridge scores and cascade data
   - Recommendations and action items
   ═══════════════════════════════════════════════════════════════ */
import type { WealthEngineData } from '@/contexts/WealthEngineContext';
import { fmt, fmtSm, pct } from './format';

/* ─── Helper: score color ─── */
function scoreColor(score: number): string {
  if (score >= 70) return '#16a34a';
  if (score >= 40) return '#ca8a04';
  return '#dc2626';
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Needs Attention';
  return 'Critical';
}

/* ─── Safe accessor: returns 0 for undefined/NaN ─── */
function safe(v: unknown): number {
  return typeof v === 'number' && !isNaN(v) ? v : 0;
}

/* ─── Build HTML for the unified report ─── */
export function exportUnifiedPlanPDF(we: WealthEngineData) {
  const c = we.client;
  const sc = we.scorecard;
  const hb = we.holisticBridge;
  const ac = we.advancedCascade;
  const pr = we.prResult;
  const tx = we.txResult;
  const rt = we.rtResult;
  const es = we.esResult;
  const ed = we.edResult;
  const cf = we.cfResult;
  const gr = we.grResult;
  const recs = we.recommendations;
  const now = new Date();

  /* ─── Domain scores from scorecard ─── */
  const domainRows = sc.domains.map(d => {
    const pctScore = Math.round((d.score / 3) * 100);
    const status = d.score >= 3 ? 'Strong' : d.score >= 2 ? 'Moderate' : 'Needs Attention';
    return `<tr>
      <td>${d.name}</td>
      <td style="text-align:center"><strong style="color:${scoreColor(pctScore)}">${d.score}/3</strong></td>
      <td style="text-align:center">${pctScore}%</td>
      <td>${d.score >= 3 ? '<span style="color:#16a34a">On Track</span>' : `<span style="color:${d.score >= 2 ? '#ca8a04' : '#dc2626'}">${status}</span>`}</td>
    </tr>`;
  }).join('');

  /* ─── Client Financial Summary ─── */
  const clientSummaryHTML = `
    <h2>Client Financial Profile</h2>
    <div class="profile-grid">
      <div class="profile-item"><span class="label">Client</span><span class="value">${c.clientName || 'Not specified'}</span></div>
      <div class="profile-item"><span class="label">Age</span><span class="value">${c.age}</span></div>
      <div class="profile-item"><span class="label">Spouse Age</span><span class="value">${c.spouseAge}</span></div>
      <div class="profile-item"><span class="label">Filing Status</span><span class="value">${c.filing}</span></div>
      <div class="profile-item"><span class="label">Annual Income</span><span class="value">${fmt(c.income)}</span></div>
      <div class="profile-item"><span class="label">Spouse Income</span><span class="value">${fmt(c.spouseIncome)}</span></div>
      <div class="profile-item"><span class="label">Total Income</span><span class="value">${fmt(c.totalIncome)}</span></div>
      <div class="profile-item"><span class="label">Net Worth</span><span class="value">${fmt(c.nw)}</span></div>
      <div class="profile-item"><span class="label">Savings</span><span class="value">${fmt(c.savings)}</span></div>
      <div class="profile-item"><span class="label">401(k) Balance</span><span class="value">${fmt(c.retirement401k)}</span></div>
      <div class="profile-item"><span class="label">Existing Insurance</span><span class="value">${fmt(c.existIns)}</span></div>
      <div class="profile-item"><span class="label">Mortgage</span><span class="value">${fmt(c.mortgage)}</span></div>
      <div class="profile-item"><span class="label">Other Debt</span><span class="value">${fmt(c.debt)}</span></div>
      <div class="profile-item"><span class="label">Dependents</span><span class="value">${c.dep}</span></div>
      <div class="profile-item"><span class="label">State Tax Rate</span><span class="value">${(c.stateRate * 100).toFixed(1)}%</span></div>
      <div class="profile-item"><span class="label">Risk Tolerance</span><span class="value">${c.riskTolerance}</span></div>
      ${c.isBiz ? `
      <div class="profile-item"><span class="label">Business Revenue</span><span class="value">${fmt(c.bizRevenue)}</span></div>
      <div class="profile-item"><span class="label">Employees</span><span class="value">${c.bizEmployees}</span></div>
      <div class="profile-item"><span class="label">Entity Type</span><span class="value">${c.bizEntityType.toUpperCase()}</span></div>
      ` : ''}
    </div>
  `;

  /* ─── Protection Analysis ─── */
  const protectionHTML = `
    <h2>Protection Analysis</h2>
    <div class="summary-grid">
      <div class="summary-card"><div class="label">Total Need</div><div class="value">${fmt(pr.totalNeed)}</div></div>
      <div class="summary-card"><div class="label">Protection Gap</div><div class="value ${pr.gap > 0 ? 'off-track' : 'on-track'}">${fmt(pr.gap)}</div></div>
      <div class="summary-card"><div class="label">DI Need</div><div class="value">${fmt(pr.diNeed)}</div></div>
    </div>
    <table>
      <thead><tr><th>Component</th><th>Amount</th></tr></thead>
      <tbody>
        <tr><td>Total Protection Need</td><td>${fmt(pr.totalNeed)}</td></tr>
        <tr><td>Existing Coverage</td><td>${fmt(c.existIns)}</td></tr>
        <tr><td><strong>Net Gap</strong></td><td><strong style="color:${pr.gap > 0 ? '#dc2626' : '#16a34a'}">${fmt(pr.gap)}</strong></td></tr>
        <tr><td>Disability Income Need</td><td>${fmt(pr.diNeed)}</td></tr>
        <tr><td>DI Premium (est.)</td><td>${fmt(pr.diPremium)}/yr</td></tr>
        <tr><td>LTC Need</td><td>${fmt(pr.ltcNeed)}</td></tr>
        <tr><td>LTC Premium (est.)</td><td>${fmt(pr.ltcPremium)}/yr</td></tr>
      </tbody>
    </table>
  `;

  /* ─── Tax Analysis ─── */
  const taxHTML = `
    <h2>Tax Analysis</h2>
    <div class="summary-grid">
      <div class="summary-card"><div class="label">Total Tax</div><div class="value">${fmt(tx.totalTax)}</div></div>
      <div class="summary-card"><div class="label">Effective Rate</div><div class="value">${tx.effectiveRate.toFixed(1)}%</div></div>
      <div class="summary-card"><div class="label">Marginal Rate</div><div class="value">${tx.marginalRate}%</div></div>
    </div>
    <table>
      <thead><tr><th>Item</th><th>Amount</th></tr></thead>
      <tbody>
        <tr><td>Total Income</td><td>${fmt(c.totalIncome)}</td></tr>
        <tr><td>Effective Rate</td><td>${tx.effectiveRate.toFixed(1)}%</td></tr>
        <tr><td>Marginal Rate</td><td>${tx.marginalRate}%</td></tr>
        <tr><td><strong>Total Tax</strong></td><td><strong>${fmt(tx.totalTax)}</strong></td></tr>
        <tr><td>Potential Savings</td><td style="color:#16a34a">${fmt(tx.totalSavings)}</td></tr>
        ${tx.strategies.map(s => `<tr><td style="padding-left:24px">${s.name}</td><td style="color:#16a34a">${fmt(s.saving)}</td></tr>`).join('')}
      </tbody>
    </table>
  `;

  /* ─── Retirement Analysis ─── */
  const retirementHTML = `
    <h2>Retirement Analysis</h2>
    <div class="summary-grid">
      <div class="summary-card"><div class="label">Projected Nest Egg</div><div class="value">${fmt(rt.projectedNest)}</div></div>
      <div class="summary-card"><div class="label">Monthly Income</div><div class="value">${fmt(rt.monthlyIncome)}</div></div>
      <div class="summary-card"><div class="label">Gap</div><div class="value ${rt.gap > 0 ? 'off-track' : 'on-track'}">${fmt(rt.gap)}</div></div>
    </div>
    <table>
      <thead><tr><th>Parameter</th><th>Value</th></tr></thead>
      <tbody>
        <tr><td>Projected Nest Egg at Retirement</td><td>${fmt(rt.projectedNest)}</td></tr>
        <tr><td>Estimated Monthly Retirement Income</td><td>${fmt(rt.monthlyIncome)}</td></tr>
        <tr><td>Optimal SS Claiming Age</td><td>${rt.ssOptimal || 'N/A'}</td></tr>
        <tr><td>Replacement Rate</td><td>${rt.replacementRate}%</td></tr>
        <tr><td>Retirement Gap</td><td style="color:${rt.gap > 0 ? '#dc2626' : '#16a34a'}">${fmt(rt.gap)}</td></tr>
      </tbody>
    </table>
  `;

  /* ─── Estate Analysis ─── */
  const estateHTML = `
    <h2>Estate Analysis</h2>
    <div class="summary-grid">
      <div class="summary-card"><div class="label">Taxable Estate</div><div class="value">${fmt(es.taxableEstate)}</div></div>
      <div class="summary-card"><div class="label">Estate Tax</div><div class="value ${es.estateTax > 0 ? 'off-track' : 'on-track'}">${fmt(es.estateTax)}</div></div>
      <div class="summary-card"><div class="label">Effective Rate</div><div class="value">${es.effectiveRate.toFixed(1)}%</div></div>
    </div>
    <table>
      <thead><tr><th>Component</th><th>Amount</th></tr></thead>
      <tbody>
        <tr><td>Taxable Estate</td><td>${fmt(es.taxableEstate)}</td></tr>
        <tr><td>Estimated Estate Tax</td><td>${fmt(es.estateTax)}</td></tr>
        <tr><td>Gifting Impact</td><td style="color:#16a34a">-${fmt(es.giftingImpact)}</td></tr>
        <tr><td>Trust Benefit</td><td style="color:#16a34a">-${fmt(es.trustBenefit)}</td></tr>
      </tbody>
    </table>
  `;

  /* ─── Cash Flow ─── */
  const cashFlowHTML = `
    <h2>Cash Flow Analysis</h2>
    <div class="summary-grid">
      <div class="summary-card"><div class="label">Monthly Gross</div><div class="value">${fmt(cf.grossMonthly)}</div></div>
      <div class="summary-card"><div class="label">Net Cash Flow</div><div class="value ${cf.netCashFlow >= 0 ? 'on-track' : 'off-track'}">${fmt(cf.netCashFlow)}</div></div>
      <div class="summary-card"><div class="label">Savings Rate</div><div class="value">${cf.savingsRate.toFixed(1)}%</div></div>
    </div>
    <table>
      <thead><tr><th>Metric</th><th>Value</th></tr></thead>
      <tbody>
        <tr><td>Monthly Gross Income</td><td>${fmt(cf.grossMonthly)}</td></tr>
        <tr><td>Total Monthly Expenses</td><td>${fmt(cf.totalExpenses)}</td></tr>
        <tr><td>Net Cash Flow</td><td style="color:${cf.netCashFlow >= 0 ? '#16a34a' : '#dc2626'}">${fmt(cf.netCashFlow)}</td></tr>
        <tr><td>Emergency Fund Target</td><td>${fmt(cf.emergencyTarget)}</td></tr>
        <tr><td>Current Emergency Months</td><td>${cf.emergencyMonths.toFixed(1)} months</td></tr>
        <tr><td>Emergency Fund Gap</td><td style="color:${cf.emergencyGap > 0 ? '#dc2626' : '#16a34a'}">${fmt(cf.emergencyGap)}</td></tr>
      </tbody>
    </table>
  `;

  /* ─── Growth Analysis ─── */
  const growthHTML = `
    <h2>Growth & Investment Analysis</h2>
    <div class="summary-grid">
      <div class="summary-card"><div class="label">Taxable Projected</div><div class="value">${fmt(gr.taxableProjected)}</div></div>
      <div class="summary-card"><div class="label">IUL Projected</div><div class="value">${fmt(gr.iulProjected)}</div></div>
      <div class="summary-card"><div class="label">Total Projected</div><div class="value">${fmt(gr.totalProjected)}</div></div>
    </div>
    <table>
      <thead><tr><th>Vehicle</th><th>Projected Value</th></tr></thead>
      <tbody>
        <tr><td>Taxable Accounts</td><td>${fmt(gr.taxableProjected)}</td></tr>
        <tr><td>Indexed Universal Life (IUL)</td><td>${fmt(gr.iulProjected)}</td></tr>
        <tr><td>Fixed Indexed Annuity (FIA)</td><td>${fmt(gr.fiaProjected)}</td></tr>
        <tr><td><strong>Total Projected</strong></td><td><strong>${fmt(gr.totalProjected)}</strong></td></tr>
        <tr><td>Monthly Savings Needed</td><td>${fmt(gr.monthlyNeeded)}</td></tr>
        <tr><td>On Track?</td><td style="color:${gr.onTrack ? '#16a34a' : '#dc2626'}">${gr.onTrack ? 'Yes' : 'No'}</td></tr>
      </tbody>
    </table>
  `;

  /* ─── Education Analysis ─── */
  const educationHTML = ed.totalCost > 0 ? `
    <h2>Education Planning</h2>
    <div class="summary-grid">
      <div class="summary-card"><div class="label">Total Cost</div><div class="value">${fmt(ed.totalCost)}</div></div>
      <div class="summary-card"><div class="label">Projected 529</div><div class="value">${fmt(ed.projected529)}</div></div>
      <div class="summary-card"><div class="label">Gap</div><div class="value ${ed.gap > 0 ? 'off-track' : 'on-track'}">${fmt(ed.gap)}</div></div>
    </div>
    <table>
      <thead><tr><th>Item</th><th>Amount</th></tr></thead>
      <tbody>
        <tr><td>Total Education Cost</td><td>${fmt(ed.totalCost)}</td></tr>
        <tr><td>Projected 529 Value</td><td>${fmt(ed.projected529)}</td></tr>
        <tr><td>Education Gap</td><td style="color:${ed.gap > 0 ? '#dc2626' : '#16a34a'}">${fmt(ed.gap)}</td></tr>
        <tr><td>Monthly Savings Needed</td><td>${fmt(ed.monthlyNeeded)}</td></tr>
      </tbody>
    </table>
  ` : '';

  /* ─── Advanced Strategies ─── */
  const hasAdvanced = ac.totalAnnualBenefit > 0 || ac.totalAnnualCost > 0;
  const advancedHTML = hasAdvanced ? `
    <div class="page-break"></div>
    <h2>Advanced Strategies Analysis</h2>
    <div class="summary-grid">
      <div class="summary-card"><div class="label">Total Annual Benefit</div><div class="value on-track">${fmt(ac.totalAnnualBenefit)}</div></div>
      <div class="summary-card"><div class="label">Total Annual Cost</div><div class="value">${fmt(ac.totalAnnualCost)}</div></div>
      <div class="summary-card"><div class="label">Net Impact</div><div class="value ${ac.netWorthImpact >= 0 ? 'on-track' : 'off-track'}">${fmt(ac.netWorthImpact)}</div></div>
    </div>

    <h3>Strategy Breakdown</h3>
    <table>
      <thead><tr><th>Strategy</th><th>Key Benefit</th><th>Amount</th></tr></thead>
      <tbody>
        <tr><td>Premium Finance</td><td>Net Benefit</td><td>${fmt(ac.pfNetBenefit)}</td></tr>
        <tr><td>ILIT</td><td>Estate Tax Saved</td><td>${fmt(ac.ilitEstateTaxSaved)}</td></tr>
        <tr><td>Executive Compensation</td><td>Tax Benefit</td><td>${fmt(ac.execTaxBenefit)}</td></tr>
        <tr><td>Charitable Strategies</td><td>Tax Deduction</td><td>${fmt(ac.charitableTaxDeduction)}</td></tr>
        <tr><td>Business Strategies</td><td>Total Protection</td><td>${fmt(ac.businessTotalProtection)}</td></tr>
      </tbody>
    </table>

    <h3>Cascade Impact on Client Planning</h3>
    <table>
      <thead><tr><th>Impact Area</th><th>Enhancement</th></tr></thead>
      <tbody>
        ${ac.protectionEnhancement > 0 ? `<tr><td>Additional Protection</td><td style="color:#16a34a">+${fmt(ac.protectionEnhancement)}</td></tr>` : ''}
        ${ac.taxSavingsBoost > 0 ? `<tr><td>Annual Tax Savings</td><td style="color:#16a34a">+${fmt(ac.taxSavingsBoost)}/yr</td></tr>` : ''}
        ${ac.estateTaxReduction > 0 ? `<tr><td>Estate Tax Reduction</td><td style="color:#16a34a">-${fmt(ac.estateTaxReduction)}</td></tr>` : ''}
        ${ac.retirementBoost > 0 ? `<tr><td>Retirement Income Boost</td><td style="color:#16a34a">+${fmt(ac.retirementBoost)}/yr</td></tr>` : ''}
        ${ac.netWorthImpact !== 0 ? `<tr><td>Net Worth Impact</td><td style="color:${ac.netWorthImpact > 0 ? '#16a34a' : '#dc2626'}">${ac.netWorthImpact > 0 ? '+' : ''}${fmt(ac.netWorthImpact)}</td></tr>` : ''}
      </tbody>
    </table>
  ` : '';

  /* ─── Holistic Score ─── */
  const holisticHTML = `
    <h2>Holistic Wealth Score</h2>
    <div class="holistic-score-container">
      <div class="holistic-main">
        <div class="score-circle" style="border-color: ${scoreColor(hb.holisticScore)}">
          <span class="score-number" style="color: ${scoreColor(hb.holisticScore)}">${hb.holisticScore}</span>
          <span class="score-max">/100</span>
        </div>
        <div class="score-label">${scoreLabel(hb.holisticScore)}</div>
      </div>
      <div class="score-breakdown">
        <div class="score-item">
          <span class="label">Client Hub Score</span>
          <span class="value" style="color: ${scoreColor(hb.clientHubScore)}">${hb.clientHubScore}%</span>
        </div>
        <div class="score-item">
          <span class="label">Advanced Hub Score</span>
          <span class="value" style="color: ${scoreColor(hb.advancedHubScore)}">${hb.advancedHubScore}%</span>
        </div>
        ${hb.practiceHubScore > 0 ? `<div class="score-item">
          <span class="label">Practice Hub Score</span>
          <span class="value" style="color: ${scoreColor(hb.practiceHubScore)}">${hb.practiceHubScore}%</span>
        </div>` : ''}
        <div class="score-item">
          <span class="label">Cascade Direction</span>
          <span class="value">${hb.cascadeDirection}</span>
        </div>
      </div>
    </div>
  `;

  /* ─── Domain Scorecard ─── */
  const scorecardHTML = `
    <h2>Financial Health Scorecard</h2>
    <div class="summary-grid">
      <div class="summary-card"><div class="label">Overall Score</div><div class="value" style="color:${scoreColor(sc.pctScore)}">${sc.overall}/${sc.maxScore}</div></div>
      <div class="summary-card"><div class="label">Percentage</div><div class="value" style="color:${scoreColor(sc.pctScore)}">${sc.pctScore}%</div></div>
      <div class="summary-card"><div class="label">Rating</div><div class="value" style="color:${scoreColor(sc.pctScore)}">${scoreLabel(sc.pctScore)}</div></div>
    </div>
    <table>
      <thead><tr><th>Domain</th><th>Score</th><th>%</th><th>Issues / Notes</th></tr></thead>
      <tbody>${domainRows}</tbody>
    </table>
  `;

  /* ─── Recommendations ─── */
  const recsHTML = recs.length > 0 ? `
    <div class="page-break"></div>
    <h2>Recommendations & Action Items</h2>
    <table>
      <thead><tr><th>#</th><th>Priority</th><th>Recommendation</th></tr></thead>
      <tbody>${recs.slice(0, 15).map((r, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><span style="color:${r.priority === 'high' ? '#dc2626' : r.priority === 'medium' ? '#ca8a04' : '#16a34a'}">${r.priority.toUpperCase()}</span></td>
          <td>${r.product}: ${r.coverage} — ${r.carrier} ($${r.premium.toLocaleString()}/yr)</td>
        </tr>
      `).join('')}</tbody>
    </table>
  ` : '';

  /* ─── Full HTML Document ─── */
  const html = `<!DOCTYPE html>
<html><head><title>WealthBridge AI — Unified Financial Plan</title>
<style>
  @page { margin: 1in 0.75in; size: letter; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1a1a1a; line-height: 1.5; }
  h1 { color: #1e40af; border-bottom: 3px solid #1e40af; padding-bottom: 10px; font-size: 28px; }
  h2 { color: #374151; margin-top: 36px; border-bottom: 1px solid #d1d5db; padding-bottom: 6px; font-size: 20px; }
  h3 { color: #4b5563; margin-top: 20px; font-size: 16px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
  th { background: #f3f4f6; padding: 8px 12px; text-align: left; border: 1px solid #e5e7eb; font-weight: 600; }
  td { padding: 6px 12px; border: 1px solid #e5e7eb; }
  tr:nth-child(even) { background: #f9fafb; }
  .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 16px 0; }
  .summary-card { background: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center; }
  .summary-card .label { font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px; }
  .summary-card .value { font-size: 22px; font-weight: 700; margin: 4px 0; }
  .on-track { color: #16a34a; }
  .off-track { color: #dc2626; }
  .meta { color: #6b7280; font-size: 12px; margin-top: 4px; }
  .profile-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 16px; margin: 12px 0; }
  .profile-item { display: flex; flex-direction: column; padding: 8px; background: #f9fafb; border-radius: 4px; }
  .profile-item .label { font-size: 10px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px; }
  .profile-item .value { font-size: 14px; font-weight: 600; color: #1a1a1a; }
  .holistic-score-container { display: flex; align-items: center; gap: 40px; margin: 20px 0; padding: 24px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; }
  .holistic-main { text-align: center; }
  .score-circle { width: 100px; height: 100px; border-radius: 50%; border: 4px solid; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 0 auto 8px; }
  .score-number { font-size: 36px; font-weight: 800; line-height: 1; }
  .score-max { font-size: 14px; color: #6b7280; }
  .score-label { font-size: 14px; font-weight: 600; color: #374151; }
  .score-breakdown { flex: 1; }
  .score-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
  .score-item .label { color: #6b7280; font-size: 13px; }
  .score-item .value { font-weight: 600; font-size: 14px; }
  .page-break { page-break-before: always; }
  @media print { body { padding: 0; } .page-break { page-break-before: always; } }
</style></head><body>
  <h1>WealthBridge AI — Unified Financial Plan</h1>
  <div class="meta">Generated: ${now.toLocaleDateString()} at ${now.toLocaleTimeString()} | Powered by Stewardly AI</div>

  ${holisticHTML}
  ${scorecardHTML}
  ${clientSummaryHTML}

  <div class="page-break"></div>
  ${protectionHTML}
  ${taxHTML}

  <div class="page-break"></div>
  ${retirementHTML}
  ${growthHTML}
  ${estateHTML}
  ${cashFlowHTML}
  ${educationHTML}

  ${advancedHTML}
  ${recsHTML}

  <div class="meta" style="margin-top: 40px; border-top: 2px solid #e5e7eb; padding-top: 16px;">
    <strong>Disclaimer:</strong> This report was generated by WealthBridge AI (Stewardly). All data is based on user inputs and industry benchmarks
    from LIMRA, Cerulli, McKinsey, Kitces Research, and IRS publications. This report is for informational purposes only and does not constitute
    financial, tax, or legal advice. For professional financial planning, consult a licensed financial advisor, CPA, or attorney.
  </div>
</body></html>`;

  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  }
}

/* ─── Excel export for unified plan ─── */
export async function exportUnifiedPlanExcel(we: WealthEngineData) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const c = we.client;
  const hb = we.holisticBridge;
  const ac = we.advancedCascade;
  const pr = we.prResult;
  const tx = we.txResult;
  const rt = we.rtResult;
  const es = we.esResult;
  const ed = we.edResult;
  const cf = we.cfResult;
  const gr = we.grResult;
  const sc = we.scorecard;

  // Sheet 1: Executive Summary
  const summaryRows = [
    ['WealthBridge AI — Unified Financial Plan'],
    ['Generated', new Date().toLocaleDateString()],
    [],
    ['HOLISTIC SCORES'],
    ['Holistic Score', hb.holisticScore],
    ['Client Hub Score', hb.clientHubScore],
    ['Advanced Hub Score', hb.advancedHubScore],
    ['Practice Hub Score', hb.practiceHubScore],
    ['Cascade Direction', hb.cascadeDirection],
    [],
    ['SCORECARD'],
    ['Overall', `${sc.overall}/${sc.maxScore}`],
    ['Percentage', `${sc.pctScore}%`],
    [],
    ...sc.domains.map(d => [d.name, `${d.score}/3`, d.score >= 3 ? 'On Track' : d.score >= 2 ? 'Moderate' : 'Needs Attention']),
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, ws1, 'Executive Summary');

  // Sheet 2: Client Profile
  const profileRows = [
    ['CLIENT PROFILE'],
    ['Name', c.clientName || 'Not specified'],
    ['Age', c.age],
    ['Spouse Age', c.spouseAge],
    ['Filing Status', c.filing],
    ['Annual Income', c.income],
    ['Spouse Income', c.spouseIncome],
    ['Total Income', c.totalIncome],
    ['Net Worth', c.nw],
    ['Savings', c.savings],
    ['401(k)', c.retirement401k],
    ['Existing Insurance', c.existIns],
    ['Mortgage', c.mortgage],
    ['Debt', c.debt],
    ['Dependents', c.dep],
    ['State Tax Rate', `${(c.stateRate * 100).toFixed(1)}%`],
    ['Risk Tolerance', c.riskTolerance],
    ...(c.isBiz ? [
      [],
      ['BUSINESS PROFILE'],
      ['Business Revenue', c.bizRevenue],
      ['Employees', c.bizEmployees],
      ['Entity Type', c.bizEntityType.toUpperCase()],
    ] : []),
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(profileRows);
  XLSX.utils.book_append_sheet(wb, ws2, 'Client Profile');

  // Sheet 3: Analysis
  const analysisRows: (string | number)[][] = [
    ['PROTECTION ANALYSIS'],
    ['Total Need', pr.totalNeed],
    ['Protection Gap', pr.gap],
    ['DI Need', pr.diNeed],
    ['DI Premium', pr.diPremium],
    ['LTC Need', pr.ltcNeed],
    ['LTC Premium', pr.ltcPremium],
    [],
    ['TAX ANALYSIS'],
    ['Total Tax', tx.totalTax],
    ['Effective Rate', `${tx.effectiveRate.toFixed(1)}%`],
    ['Marginal Rate', `${tx.marginalRate}%`],
    ['Potential Savings', tx.totalSavings],
    ...tx.strategies.map(s => [`  ${s.name}`, s.saving]),
    [],
    ['RETIREMENT ANALYSIS'],
    ['Projected Nest Egg', rt.projectedNest],
    ['Monthly Income', rt.monthlyIncome],
    ['Optimal SS Age', rt.ssOptimal || 'N/A'],
    ['Replacement Rate', `${rt.replacementRate}%`],
    ['Gap', rt.gap],
    [],
    ['GROWTH ANALYSIS'],
    ['Taxable Projected', gr.taxableProjected],
    ['IUL Projected', gr.iulProjected],
    ['FIA Projected', gr.fiaProjected],
    ['Total Projected', gr.totalProjected],
    ['Monthly Needed', gr.monthlyNeeded],
    ['On Track', gr.onTrack ? 'Yes' : 'No'],
    [],
    ['ESTATE ANALYSIS'],
    ['Taxable Estate', es.taxableEstate],
    ['Estate Tax', es.estateTax],
    ['Effective Rate', `${es.effectiveRate.toFixed(1)}%`],
    ['Gifting Impact', es.giftingImpact],
    ['Trust Benefit', es.trustBenefit],
    [],
    ['CASH FLOW'],
    ['Monthly Gross', cf.grossMonthly],
    ['Total Expenses', cf.totalExpenses],
    ['Net Cash Flow', cf.netCashFlow],
    ['Savings Rate', `${cf.savingsRate.toFixed(1)}%`],
    ['Emergency Months', cf.emergencyMonths.toFixed(1)],
    ['Emergency Target', cf.emergencyTarget],
    ['Emergency Gap', cf.emergencyGap],
    [],
    ['EDUCATION'],
    ['Total Cost', ed.totalCost],
    ['Projected 529', ed.projected529],
    ['Education Gap', ed.gap],
    ['Monthly Needed', ed.monthlyNeeded],
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(analysisRows);
  XLSX.utils.book_append_sheet(wb, ws3, 'Analysis');

  // Sheet 4: Advanced Strategies
  if (ac.totalAnnualBenefit > 0 || ac.totalAnnualCost > 0) {
    const advRows = [
      ['ADVANCED STRATEGIES'],
      ['Total Annual Benefit', ac.totalAnnualBenefit],
      ['Total Annual Cost', ac.totalAnnualCost],
      ['Net Worth Impact', ac.netWorthImpact],
      [],
      ['Strategy', 'Key Metric', 'Amount'],
      ['Premium Finance', 'Net Benefit', ac.pfNetBenefit],
      ['ILIT', 'Estate Tax Saved', ac.ilitEstateTaxSaved],
      ['Executive Comp', 'Tax Benefit', ac.execTaxBenefit],
      ['Charitable', 'Tax Deduction', ac.charitableTaxDeduction],
      ['Business', 'Total Protection', ac.businessTotalProtection],
      [],
      ['CASCADE IMPACT'],
      ['Additional Protection', ac.protectionEnhancement],
      ['Tax Savings Boost', ac.taxSavingsBoost],
      ['Estate Tax Reduction', ac.estateTaxReduction],
      ['Retirement Boost', ac.retirementBoost],
    ];
    const ws4 = XLSX.utils.aoa_to_sheet(advRows);
    XLSX.utils.book_append_sheet(wb, ws4, 'Advanced Strategies');
  }

  // Sheet 5: Recommendations
  if (we.recommendations.length > 0) {
    const recRows = [
      ['#', 'Priority', 'Recommendation'],
      ...we.recommendations.map((r, i) => [i + 1, r.priority.toUpperCase(), `${r.product}: ${r.coverage} — ${r.carrier} ($${r.premium.toLocaleString()}/yr)`]),
    ];
    const ws5 = XLSX.utils.aoa_to_sheet(recRows);
    XLSX.utils.book_append_sheet(wb, ws5, 'Recommendations');
  }

  XLSX.writeFile(wb, `WealthBridge-UnifiedPlan-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
