/* ═══════════════════════════════════════════════════════════════
   exportPlan — Export unified income plan to PDF / Excel
   ═══════════════════════════════════════════════════════════════ */
import * as XLSX from 'xlsx';
import {
  calcUnifiedIncomePlan, calcChannelEconomics, calcSensitivity,
  type IncomeSplits, type EnabledChannels, type RoleId,
  type ChannelEconomics, type SensitivityResult,
} from './practiceEngine';
import { fmt, fmtSm, pct } from './format';

export interface ExportPlanData {
  /* Identity */
  role: RoleId;
  targetIncome: number;
  incomeSplits: IncomeSplits;
  enabledChannels: EnabledChannels;
  /* Plan results */
  plan: ReturnType<typeof calcUnifiedIncomePlan>;
  economics: ChannelEconomics[];
  sensitivity: SensitivityResult[];
  /* Scenarios */
  scenarios?: { name: string; targetIncome: number; totalProjected: number; totalGap: number }[];
}

/** Helper to extract per-channel target/projected/gap from the nested plan structure */
function getChannelData(data: ExportPlanData) {
  const p = data.plan;
  return [
    {
      key: 'gdc', name: 'GDC Production',
      target: p.channels.gdc.target,
      projected: p.channels.gdc.projected,
      gap: p.channels.gdc.gap,
    },
    {
      key: 'aum', name: 'AUM/Advisory',
      target: p.channels.aum.target,
      projected: p.channels.aum.detail.projectedIncome,
      gap: p.channels.aum.detail.gap,
    },
    {
      key: 'affiliate', name: 'Affiliates',
      target: p.channels.affiliate.target,
      projected: p.channels.affiliate.totalProjected,
      gap: p.channels.affiliate.gap,
    },
    {
      key: 'override', name: 'Team Override',
      target: p.channels.override.target,
      projected: p.channels.override.detail.projectedIncome,
      gap: p.channels.override.detail.gap,
    },
    {
      key: 'channel', name: 'Marketing Channels',
      target: p.channels.channel.target,
      projected: p.channels.channel.detail.projectedAnnualRevenue,
      gap: p.channels.channel.detail.gap,
    },
  ];
}

/* ─── EXCEL EXPORT ─── */
export function exportToExcel(data: ExportPlanData) {
  const wb = XLSX.utils.book_new();
  const channels = getChannelData(data);

  // Sheet 1: Summary
  const summaryRows: (string | number | boolean)[][] = [
    ['WealthBridge AI — Unified Income Plan'],
    ['Generated', new Date().toLocaleDateString()],
    ['Role', data.role.toUpperCase()],
    [],
    ['Target Income', data.targetIncome],
    ['Total Projected', data.plan.totalProjected],
    ['Gap', data.plan.totalGap],
    ['On Track', data.plan.onTrack ? 'Yes' : 'No'],
    [],
    ['Channel', 'Enabled', 'Split %', 'Target', 'Projected', 'Gap'],
    ...channels.map(c => [
      c.name,
      data.enabledChannels[c.key as keyof EnabledChannels] ? 'Yes' : 'No',
      data.incomeSplits[c.key as keyof IncomeSplits],
      c.target,
      c.projected,
      c.gap,
    ]),
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws1['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Income Plan');

  // Sheet 2: Channel Economics
  if (data.economics.length > 0) {
    const econRows: (string | number)[][] = [
      ['Channel Economics — CAC / ROI / LTV'],
      [],
      ['Channel', 'Revenue', 'CAC', 'COGS $', 'COGS %', 'Margin $', 'Margin %', 'ROI %', 'Client LTV', 'Network LTV', 'LTV:CAC', 'Payback Mo.', 'Efficiency'],
      ...data.economics.map(e => [
        e.label, e.annualRevenue, e.cac, e.cogsDollar, e.cogsPct,
        e.grossMarginDollar, e.grossMarginPct, e.roiPct,
        e.clientLTV, e.extendedNetworkLTV, e.ltvCacRatio,
        e.paybackMonths, e.cacEfficiency,
      ]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(econRows);
    ws2['!cols'] = Array(13).fill({ wch: 14 });
    XLSX.utils.book_append_sheet(wb, ws2, 'Channel Economics');
  }

  // Sheet 3: Sensitivity Analysis
  if (data.sensitivity.length > 0) {
    const sensRows: (string | number)[][] = [
      ['Sensitivity Analysis — What-If Impact'],
      [],
      ['Variable', 'Base Value', '-50%', '-25%', '-10%', '+10%', '+25%', '+50%', 'Impact Range'],
      ...data.sensitivity.filter(s => s.impactRange > 0).map(s => [
        s.variable.label,
        s.variable.baseValue,
        ...s.variations.map(v => v.delta),
        s.impactRange,
      ]),
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(sensRows);
    ws3['!cols'] = Array(9).fill({ wch: 14 });
    XLSX.utils.book_append_sheet(wb, ws3, 'Sensitivity');
  }

  // Sheet 4: Scenarios
  if (data.scenarios && data.scenarios.length > 0) {
    const scenRows: (string | number)[][] = [
      ['Scenario Comparison'],
      [],
      ['Scenario', 'Target Income', 'Projected', 'Gap'],
      ...data.scenarios.map(s => [s.name, s.targetIncome, s.totalProjected, s.totalGap]),
    ];
    const ws4 = XLSX.utils.aoa_to_sheet(scenRows);
    ws4['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws4, 'Scenarios');
  }

  // Download
  XLSX.writeFile(wb, `WealthBridge-Income-Plan-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/* ─── PDF EXPORT (via print) ─── */
export function exportToPDF(data: ExportPlanData) {
  const channels = getChannelData(data)
    .filter(c => data.enabledChannels[c.key as keyof EnabledChannels]);

  const econHTML = data.economics.length > 0 ? `
    <h2>Channel Economics</h2>
    <table>
      <thead><tr><th>Channel</th><th>Revenue</th><th>CAC</th><th>COGS</th><th>Margin</th><th>ROI%</th><th>LTV</th><th>LTV:CAC</th><th>Payback</th></tr></thead>
      <tbody>${data.economics.map(e => `
        <tr><td>${e.label}</td><td>${fmt(e.annualRevenue)}</td><td>${fmt(e.cac)}</td><td>${fmt(e.cogsDollar)}</td><td>${fmt(e.grossMarginDollar)} (${e.grossMarginPct}%)</td><td>${e.roiPct}%</td><td>${fmt(e.clientLTV)}</td><td>${e.ltvCacRatio}x</td><td>${e.paybackMonths}mo</td></tr>
      `).join('')}</tbody>
    </table>
  ` : '';

  const sensHTML = data.sensitivity.filter(s => s.impactRange > 0).length > 0 ? `
    <h2>Sensitivity Analysis</h2>
    <table>
      <thead><tr><th>Variable</th><th>Base</th><th>-25%</th><th>+25%</th><th>Impact Range</th></tr></thead>
      <tbody>${data.sensitivity.filter(s => s.impactRange > 0).slice(0, 8).map(s => {
        const down = s.variations.find(v => v.pctChange === -25);
        const up = s.variations.find(v => v.pctChange === 25);
        return `<tr><td>${s.variable.label}</td><td>${s.variable.unit === '$' ? fmt(s.variable.baseValue) : s.variable.baseValue + s.variable.unit}</td><td style="color:#dc2626">${down ? fmt(down.delta) : '-'}</td><td style="color:#16a34a">${up ? '+' + fmt(up.delta) : '-'}</td><td><strong>${fmt(s.impactRange)}</strong></td></tr>`;
      }).join('')}</tbody>
    </table>
  ` : '';

  const html = `<!DOCTYPE html>
<html><head><title>WealthBridge AI — Income Plan Report</title>
<style>
  body { font-family: 'Segoe UI', system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1a1a1a; }
  h1 { color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 8px; }
  h2 { color: #374151; margin-top: 32px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
  th { background: #f3f4f6; padding: 8px 12px; text-align: left; border: 1px solid #e5e7eb; font-weight: 600; }
  td { padding: 6px 12px; border: 1px solid #e5e7eb; }
  tr:nth-child(even) { background: #f9fafb; }
  .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 16px 0; }
  .summary-card { background: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center; }
  .summary-card .label { font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px; }
  .summary-card .value { font-size: 24px; font-weight: 700; margin: 4px 0; }
  .on-track { color: #16a34a; }
  .off-track { color: #dc2626; }
  .meta { color: #6b7280; font-size: 12px; margin-top: 4px; }
  @media print { body { padding: 20px; } }
</style></head><body>
  <h1>WealthBridge AI — Unified Income Plan</h1>
  <div class="meta">Role: ${data.role.toUpperCase()} | Generated: ${new Date().toLocaleDateString()}</div>

  <div class="summary-grid">
    <div class="summary-card"><div class="label">Target Income</div><div class="value">${fmt(data.targetIncome)}</div></div>
    <div class="summary-card"><div class="label">Projected Income</div><div class="value ${data.plan.onTrack ? 'on-track' : 'off-track'}">${fmt(data.plan.totalProjected)}</div></div>
    <div class="summary-card"><div class="label">Gap</div><div class="value ${data.plan.totalGap > 0 ? 'off-track' : 'on-track'}">${fmt(data.plan.totalGap)}</div></div>
  </div>

  <h2>Channel Breakdown</h2>
  <table>
    <thead><tr><th>Channel</th><th>Split</th><th>Target</th><th>Projected</th><th>Gap</th></tr></thead>
    <tbody>${channels.map(c => `
      <tr><td>${c.name}</td><td>${data.incomeSplits[c.key as keyof IncomeSplits]}%</td><td>${fmt(c.target)}</td><td>${fmt(c.projected)}</td><td style="color:${c.gap > 0 ? '#dc2626' : '#16a34a'}">${fmt(c.gap)}</td></tr>
    `).join('')}</tbody>
  </table>

  ${econHTML}
  ${sensHTML}

  <div class="meta" style="margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 12px;">
    This report was generated by WealthBridge AI (Stewardly). Data is based on user inputs and industry benchmarks from LIMRA, Cerulli, McKinsey, and Kitces Research.
    For professional financial planning, consult a licensed financial advisor.
  </div>
</body></html>`;

  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    // Auto-trigger print dialog after a short delay
    setTimeout(() => printWindow.print(), 500);
  }
}
