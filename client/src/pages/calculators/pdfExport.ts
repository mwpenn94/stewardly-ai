/**
 * PDF Export Utility for Calculator Results
 * Uses html2canvas to capture panel content and jsPDF to generate PDF
 */
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const BRAND_COLOR: [number, number, number] = [30, 58, 95]; // dark navy
const ACCENT_COLOR: [number, number, number] = [218, 165, 32]; // gold
const TEXT_COLOR: [number, number, number] = [51, 51, 51];
const LIGHT_GRAY: [number, number, number] = [245, 245, 245];

interface ExportOptions {
  title: string;
  subtitle?: string;
  panelId: string;
  clientName?: string;
  timestamp?: string;
}

/**
 * Export a calculator panel to PDF by capturing its DOM content
 */
export async function exportPanelToPDF(options: ExportOptions): Promise<void> {
  const { title, subtitle, panelId, clientName, timestamp } = options;

  // Find the panel section element
  const panelEl = document.querySelector(`[aria-label="${title}"]`) as HTMLElement
    || document.querySelector(`section[role="region"]`) as HTMLElement;

  if (!panelEl) {
    throw new Error(`Could not find panel element for "${title}"`);
  }

  // Create PDF (letter size)
  const pdf = new jsPDF('p', 'mm', 'letter');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;

  // ─── HEADER ───
  addHeader(pdf, pageWidth, margin, title, subtitle, clientName, timestamp);

  let yPos = 52; // after header

  // ─── CAPTURE PANEL CONTENT ───
  try {
    // Temporarily make the panel white background for better PDF rendering
    const originalBg = panelEl.style.backgroundColor;
    const originalColor = panelEl.style.color;
    panelEl.style.backgroundColor = '#ffffff';
    panelEl.style.color = '#333333';

    // Apply white background to all child cards
    const cards = panelEl.querySelectorAll('.bg-card, [class*="Card"]');
    const originalCardStyles: { el: HTMLElement; bg: string; color: string }[] = [];
    cards.forEach((card) => {
      const el = card as HTMLElement;
      originalCardStyles.push({ el, bg: el.style.backgroundColor, color: el.style.color });
      el.style.backgroundColor = '#ffffff';
      el.style.color = '#333333';
    });

    const canvas = await html2canvas(panelEl, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
      allowTaint: true,
      windowWidth: 1200,
    });

    // Restore original styles
    panelEl.style.backgroundColor = originalBg;
    panelEl.style.color = originalColor;
    originalCardStyles.forEach(({ el, bg, color }) => {
      el.style.backgroundColor = bg;
      el.style.color = color;
    });

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = contentWidth;
    const imgHeight = (canvas.height / canvas.width) * imgWidth;

    // If image fits on one page
    if (imgHeight + yPos <= pageHeight - 30) {
      pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
      yPos += imgHeight + 10;
    } else {
      // Multi-page: slice the image
      const totalPages = Math.ceil((imgHeight + yPos - 30) / (pageHeight - 50));
      let srcY = 0;
      const availableFirstPage = pageHeight - yPos - 25;
      const availableSubsequent = pageHeight - 40;

      // First page
      const firstPageHeight = Math.min(imgHeight, availableFirstPage);
      const firstPageSrcHeight = (firstPageHeight / imgHeight) * canvas.height;

      // Create a temp canvas for the first slice
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = firstPageSrcHeight;
      const ctx = tempCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(canvas, 0, 0, canvas.width, firstPageSrcHeight, 0, 0, canvas.width, firstPageSrcHeight);
        pdf.addImage(tempCanvas.toDataURL('image/png'), 'PNG', margin, yPos, imgWidth, firstPageHeight);
      }
      srcY = firstPageSrcHeight;

      // Subsequent pages
      while (srcY < canvas.height) {
        pdf.addPage();
        addPageHeader(pdf, pageWidth, margin, title);

        const remainingHeight = canvas.height - srcY;
        const sliceHeight = Math.min(remainingHeight, (availableSubsequent / imgHeight) * canvas.height);
        const renderHeight = (sliceHeight / canvas.height) * imgHeight;

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const pCtx = pageCanvas.getContext('2d');
        if (pCtx) {
          pCtx.drawImage(canvas, 0, srcY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
          pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', margin, 25, imgWidth, renderHeight);
        }
        srcY += sliceHeight;
      }
    }
  } catch (err) {
    // Fallback: add text-only content
    pdf.setFontSize(10);
    pdf.setTextColor(...TEXT_COLOR);
    pdf.text('Unable to capture panel content. Please use browser Print (Ctrl+P) as an alternative.', margin, yPos);
    yPos += 10;
  }

  // ─── FOOTER ───
  addFooter(pdf, pageWidth, pageHeight, margin);

  // ─── SAVE ───
  const fileName = `Stewardly_${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  pdf.save(fileName);
}

/**
 * Quick export using browser print dialog (simpler, preserves CSS)
 */
export function exportViaPrint(): void {
  window.print();
}

// ─── HELPER FUNCTIONS ───

function addHeader(
  pdf: jsPDF,
  pageWidth: number,
  margin: number,
  title: string,
  subtitle?: string,
  clientName?: string,
  timestamp?: string,
) {
  // Brand bar
  pdf.setFillColor(...BRAND_COLOR);
  pdf.rect(0, 0, pageWidth, 8, 'F');

  // Gold accent line
  pdf.setFillColor(...ACCENT_COLOR);
  pdf.rect(0, 8, pageWidth, 1.5, 'F');

  // Title
  pdf.setFontSize(18);
  pdf.setTextColor(...BRAND_COLOR);
  pdf.text(title, margin, 20);

  // Subtitle
  if (subtitle) {
    pdf.setFontSize(10);
    pdf.setTextColor(120, 120, 120);
    pdf.text(subtitle, margin, 26);
  }

  // Client info line
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  const infoLine = [
    clientName ? `Client: ${clientName}` : null,
    `Generated: ${timestamp || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
    'Stewardly AI — Wealth Engine v7.6',
  ].filter(Boolean).join('  |  ');
  pdf.text(infoLine, margin, 32);

  // Separator
  pdf.setDrawColor(220, 220, 220);
  pdf.line(margin, 35, pageWidth - margin, 35);
}

function addPageHeader(pdf: jsPDF, pageWidth: number, margin: number, title: string) {
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  pdf.text(`${title} — Stewardly AI`, margin, 12);
  pdf.setDrawColor(220, 220, 220);
  pdf.line(margin, 14, pageWidth - margin, 14);
}

function addFooter(pdf: jsPDF, pageWidth: number, pageHeight: number, margin: number) {
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);

    // Separator line
    pdf.setDrawColor(220, 220, 220);
    pdf.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);

    // Disclaimer
    pdf.setFontSize(6);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      'This report is for informational purposes only and does not constitute financial advice. Securities offered through properly licensed representatives. ' +
      'Not FDIC insured. Not bank guaranteed. May lose value. FINRA/SIPC member.',
      margin,
      pageHeight - 14,
      { maxWidth: pageWidth - 2 * margin },
    );

    // Page number
    pdf.setFontSize(7);
    pdf.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 20, pageHeight - 8);
  }
}
