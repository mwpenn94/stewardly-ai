/**
 * Practice Plan PDF Generator — Server-side PDF generation using PDFKit
 * Generates a branded multi-page PDF from practice plan data
 */
import PDFDocument from 'pdfkit';

interface PlanPdfData {
  // Header
  planName: string;
  role: string;
  generatedAt: string;
  // Summary
  targetIncome: number;
  totalProjected: number;
  totalGap: number;
  // Channel breakdown
  channels: {
    name: string;
    enabled: boolean;
    splitPct: number;
    target: number;
    projected: number;
    gap: number;
  }[];
  // P&L
  pnl?: {
    totalRevenue: number;
    totalCOGS: number;
    grossProfit: number;
    grossMarginPct: number;
    opEx: number;
    ebitda: number;
    ebitdaMarginPct: number;
    estimatedTax: number;
    netIncome: number;
    netMarginPct: number;
  };
  // Sensitivity top variables
  sensitivity?: {
    variable: string;
    baseValue: number;
    impact: number;
  }[];
  // Funnel metrics
  funnel?: {
    approaches: number;
    factFinds: number;
    proposals: number;
    closes: number;
    avgCaseSize: number;
  };
}

const COLORS = {
  primary: '#0F172A',
  accent: '#0EA5E9',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  muted: '#64748B',
  bg: '#F8FAFC',
  white: '#FFFFFF',
};

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

export function generatePracticePlanPdf(data: PlanPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `Practice Plan: ${data.planName}`,
        Author: 'WealthBridge AI — Stewardly',
        Subject: 'Unified Income Plan Report',
        Creator: 'WealthBridge AI Practice Planning Engine',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageW = 612 - 100; // letter width minus margins

    // ─── COVER / HEADER ────────────────────────────────────────
    doc.rect(0, 0, 612, 120).fill(COLORS.primary);
    doc.fontSize(28).fillColor(COLORS.white).text('Practice Income Plan', 50, 40);
    doc.fontSize(12).fillColor(COLORS.accent).text(data.planName, 50, 75);
    doc.fontSize(9).fillColor(COLORS.muted).text(`Generated: ${data.generatedAt} | Role: ${data.role}`, 50, 95);

    doc.moveDown(3);

    // ─── EXECUTIVE SUMMARY ─────────────────────────────────────
    doc.fillColor(COLORS.primary).fontSize(16).text('Executive Summary', 50);
    doc.moveDown(0.5);

    const gapColor = data.totalGap <= 0 ? COLORS.success : COLORS.danger;
    const gapLabel = data.totalGap <= 0 ? 'SURPLUS' : 'GAP';

    // Summary boxes
    const boxW = pageW / 3 - 10;
    const boxY = doc.y;
    
    // Target box
    doc.rect(50, boxY, boxW, 50).fill(COLORS.bg).stroke(COLORS.accent);
    doc.fillColor(COLORS.muted).fontSize(8).text('TARGET INCOME', 55, boxY + 8, { width: boxW - 10 });
    doc.fillColor(COLORS.primary).fontSize(16).text(fmt(data.targetIncome), 55, boxY + 22, { width: boxW - 10 });

    // Projected box
    doc.rect(50 + boxW + 10, boxY, boxW, 50).fill(COLORS.bg).stroke(COLORS.accent);
    doc.fillColor(COLORS.muted).fontSize(8).text('PROJECTED INCOME', 55 + boxW + 10, boxY + 8, { width: boxW - 10 });
    doc.fillColor(COLORS.primary).fontSize(16).text(fmt(data.totalProjected), 55 + boxW + 10, boxY + 22, { width: boxW - 10 });

    // Gap box
    doc.rect(50 + (boxW + 10) * 2, boxY, boxW, 50).fill(COLORS.bg).stroke(gapColor);
    doc.fillColor(COLORS.muted).fontSize(8).text(gapLabel, 55 + (boxW + 10) * 2, boxY + 8, { width: boxW - 10 });
    doc.fillColor(gapColor).fontSize(16).text(fmt(Math.abs(data.totalGap)), 55 + (boxW + 10) * 2, boxY + 22, { width: boxW - 10 });

    doc.y = boxY + 70;

    // ─── CHANNEL BREAKDOWN ─────────────────────────────────────
    doc.fillColor(COLORS.primary).fontSize(16).text('Channel Breakdown', 50);
    doc.moveDown(0.5);

    // Table header
    const colWidths = [120, 60, 80, 80, 80, 80];
    const tableX = 50;
    let tableY = doc.y;

    doc.rect(tableX, tableY, pageW, 18).fill(COLORS.primary);
    doc.fillColor(COLORS.white).fontSize(8);
    const headers = ['Channel', 'Split %', 'Target', 'Projected', 'Gap', 'Status'];
    let cx = tableX + 5;
    headers.forEach((h, i) => {
      doc.text(h, cx, tableY + 5, { width: colWidths[i] - 10, align: i === 0 ? 'left' : 'right' });
      cx += colWidths[i];
    });
    tableY += 18;

    // Table rows
    data.channels.forEach((ch, idx) => {
      const rowColor = idx % 2 === 0 ? COLORS.white : COLORS.bg;
      doc.rect(tableX, tableY, pageW, 16).fill(rowColor);
      
      cx = tableX + 5;
      doc.fillColor(ch.enabled ? COLORS.primary : COLORS.muted).fontSize(8);
      doc.text(ch.name + (ch.enabled ? '' : ' (off)'), cx, tableY + 4, { width: colWidths[0] - 10 });
      cx += colWidths[0];
      
      doc.text(pct(ch.splitPct), cx, tableY + 4, { width: colWidths[1] - 10, align: 'right' });
      cx += colWidths[1];
      
      doc.text(fmt(ch.target), cx, tableY + 4, { width: colWidths[2] - 10, align: 'right' });
      cx += colWidths[2];
      
      doc.fillColor(ch.projected >= ch.target ? COLORS.success : COLORS.warning);
      doc.text(fmt(ch.projected), cx, tableY + 4, { width: colWidths[3] - 10, align: 'right' });
      cx += colWidths[3];
      
      doc.fillColor(ch.gap <= 0 ? COLORS.success : COLORS.danger);
      doc.text(ch.gap <= 0 ? 'Met' : fmt(ch.gap), cx, tableY + 4, { width: colWidths[4] - 10, align: 'right' });
      cx += colWidths[4];
      
      const statusColor = ch.gap <= 0 ? COLORS.success : ch.gap < ch.target * 0.1 ? COLORS.warning : COLORS.danger;
      const statusLabel = ch.gap <= 0 ? '● On Track' : ch.gap < ch.target * 0.1 ? '◐ Close' : '○ Gap';
      doc.fillColor(statusColor).text(statusLabel, cx, tableY + 4, { width: colWidths[5] - 10, align: 'right' });
      
      tableY += 16;
    });

    doc.y = tableY + 15;

    // ─── P&L STATEMENT ─────────────────────────────────────────
    if (data.pnl) {
      doc.fillColor(COLORS.primary).fontSize(16).text('Practice P&L Statement', 50);
      doc.moveDown(0.5);

      const pnlRows: [string, number, string?][] = [
        ['Total Revenue', data.pnl.totalRevenue],
        ['Cost of Revenue (COGS)', -data.pnl.totalCOGS],
        ['Gross Profit', data.pnl.grossProfit, data.pnl.grossProfit >= 0 ? COLORS.success : COLORS.danger],
        ['Gross Margin', data.pnl.grossMarginPct],
        ['Operating Expenses', -data.pnl.opEx],
        ['EBITDA', data.pnl.ebitda, data.pnl.ebitda >= 0 ? COLORS.success : COLORS.danger],
        ['EBITDA Margin', data.pnl.ebitdaMarginPct],
        ['Estimated Tax', -data.pnl.estimatedTax],
        ['Net Income', data.pnl.netIncome, data.pnl.netIncome >= 0 ? COLORS.success : COLORS.danger],
        ['Net Margin', data.pnl.netMarginPct],
      ];

      let pnlY = doc.y;
      pnlRows.forEach(([label, value, color], idx) => {
        const isMargin = label.includes('Margin');
        const isBold = ['Total Revenue', 'Gross Profit', 'EBITDA', 'Net Income'].includes(label);
        const rowBg = isBold ? COLORS.bg : (idx % 2 === 0 ? COLORS.white : '#FAFAFA');
        
        doc.rect(50, pnlY, pageW, 16).fill(rowBg);
        doc.fillColor(color || COLORS.primary).fontSize(isBold ? 9 : 8);
        doc.text(label, 55, pnlY + 4, { width: pageW / 2 });
        doc.text(isMargin ? pct(value) : fmt(value), pageW / 2 + 50, pnlY + 4, { width: pageW / 2 - 10, align: 'right' });
        pnlY += 16;
      });

      doc.y = pnlY + 15;
    }

    // ─── PRODUCTION FUNNEL ─────────────────────────────────────
    if (data.funnel) {
      if (doc.y > 600) doc.addPage();
      doc.fillColor(COLORS.primary).fontSize(16).text('Production Funnel', 50);
      doc.moveDown(0.5);

      const funnelData = [
        ['Approaches/Month', data.funnel.approaches.toString()],
        ['Fact-Finds/Month', data.funnel.factFinds.toString()],
        ['Proposals/Month', data.funnel.proposals.toString()],
        ['Closes/Month', data.funnel.closes.toString()],
        ['Avg Case Size', fmt(data.funnel.avgCaseSize)],
      ];

      let fY = doc.y;
      funnelData.forEach(([label, value], idx) => {
        const w = (pageW * (1 - idx * 0.15));
        doc.rect(50, fY, w, 18).fill(COLORS.accent).fillOpacity(0.1 + idx * 0.15);
        doc.fillOpacity(1).fillColor(COLORS.primary).fontSize(9);
        doc.text(`${label}: ${value}`, 55, fY + 4, { width: w - 10 });
        fY += 22;
      });

      doc.y = fY + 15;
    }

    // ─── SENSITIVITY ANALYSIS ──────────────────────────────────
    if (data.sensitivity && data.sensitivity.length > 0) {
      if (doc.y > 550) doc.addPage();
      doc.fillColor(COLORS.primary).fontSize(16).text('Top Sensitivity Drivers', 50);
      doc.moveDown(0.5);

      data.sensitivity.slice(0, 8).forEach((s, idx) => {
        const barW = Math.min(Math.abs(s.impact) / (data.targetIncome * 0.5) * pageW, pageW);
        const barColor = s.impact >= 0 ? COLORS.success : COLORS.danger;
        
        doc.fillColor(COLORS.primary).fontSize(8).text(s.variable, 55, doc.y, { width: 120 });
        doc.rect(180, doc.y - 2, barW, 12).fill(barColor).fillOpacity(0.3);
        doc.fillOpacity(1).fillColor(COLORS.primary).fontSize(8);
        doc.text(`${s.impact >= 0 ? '+' : ''}${fmt(s.impact)}`, 180 + barW + 5, doc.y - 12);
        doc.moveDown(0.3);
      });
    }

    // ─── FOOTER ────────────────────────────────────────────────
    const addFooter = () => {
      doc.fillColor(COLORS.muted).fontSize(7);
      doc.text(
        'Generated by WealthBridge AI — Stewardly | For planning purposes only. Not financial advice.',
        50, 730, { width: pageW, align: 'center' }
      );
    };
    
    // Add footer to all pages
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      addFooter();
    }

    doc.end();
  });
}

export type { PlanPdfData };
