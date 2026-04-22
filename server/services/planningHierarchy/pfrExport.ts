/**
 * pfrExport.ts — Personal Financial Review PDF Export
 * 
 * Wires the PFR generator output to the PDF export service
 * to produce polished, client-facing financial review documents.
 */
import { generatePFR, getPFR } from "./pfrGenerator";
import { storagePut } from "../../storage";
import crypto from "crypto";

interface PFRExportOptions {
  pfrId?: number;
  clientId?: number;
  advisorId?: number;
  advisorName?: string;
  firmName?: string;
  format?: "html" | "markdown";
}

/**
 * Export a PFR as a formatted HTML document suitable for PDF rendering.
 * Returns a URL to the stored document.
 */
export async function exportPFR(options: PFRExportOptions): Promise<{
  url: string;
  format: string;
  generatedAt: number;
}> {
  let pfrContent: string;
  let clientName = "Client";

  if (options.pfrId) {
    const pfr = await getPFR(options.pfrId);
    if (!pfr) throw new Error("PFR not found");
    // @ts-expect-error — property access on loosely typed object
    pfrContent = typeof pfr.contentJson === "string"
      // @ts-expect-error — strict mode fix
      ? pfr.contentJson
      // @ts-expect-error — property access on loosely typed object
      : JSON.stringify(pfr.contentJson);
    clientName = `Client #${pfr.clientId}`;
  } else if (options.clientId && options.advisorId) {
    // @ts-expect-error — strict mode fix
    const result = await generatePFR(options.clientId, options.advisorId);
    pfrContent = typeof result === "string" ? result : JSON.stringify(result);
  } else {
    throw new Error("Either pfrId or both clientId and advisorId required");
  }

  const format = options.format ?? "html";
  const generatedAt = Date.now();

  let document: string;
  if (format === "html") {
    document = renderPFRAsHTML({
      content: pfrContent,
      clientName,
      advisorName: options.advisorName ?? "Financial Advisor",
      firmName: options.firmName ?? "WealthBridge AI",
      generatedAt,
    });
  } else {
    document = renderPFRAsMarkdown({
      content: pfrContent,
      clientName,
      advisorName: options.advisorName ?? "Financial Advisor",
      firmName: options.firmName ?? "WealthBridge AI",
      generatedAt,
    });
  }

  const ext = format === "html" ? "html" : "md";
  const fileKey = `pfr-exports/${options.clientId ?? "unknown"}-${crypto.randomUUID()}.${ext}`;
  const { url } = await storagePut(fileKey, Buffer.from(document, "utf-8"), `text/${ext === "html" ? "html" : "markdown"}`);

  return { url, format: ext, generatedAt };
}

function renderPFRAsHTML(opts: {
  content: string;
  clientName: string;
  advisorName: string;
  firmName: string;
  generatedAt: number;
}): string {
  const date = new Date(opts.generatedAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  // Parse the PFR content — it may be JSON or markdown
  let sections: Array<{ title: string; content: string }> = [];
  try {
    const parsed = JSON.parse(opts.content);
    if (Array.isArray(parsed)) {
      sections = parsed.map((s: any) => ({
        title: s.title ?? s.heading ?? "Section",
        content: s.content ?? s.body ?? s.text ?? JSON.stringify(s),
      }));
    } else if (parsed.sections) {
      sections = parsed.sections;
    } else {
      sections = [{ title: "Financial Review", content: opts.content }];
    }
  } catch {
    // Treat as markdown/text
    sections = [{ title: "Personal Financial Review", content: opts.content }];
  }

  const sectionHTML = sections.map(s => `
    <div class="section">
      <h2>${escapeHtml(s.title)}</h2>
      <div class="section-content">${formatContent(s.content)}</div>
    </div>
  `).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Personal Financial Review — ${escapeHtml(opts.clientName)}</title>
  <style>
    @page { margin: 1in; size: letter; }
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      color: #1a1a2e;
      line-height: 1.6;
      max-width: 8.5in;
      margin: 0 auto;
      padding: 0.5in;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #1e4078;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      font-size: 28px;
      color: #1e4078;
      margin: 0 0 8px 0;
      letter-spacing: 1px;
    }
    .header .subtitle {
      font-size: 16px;
      color: #555;
    }
    .header .meta {
      font-size: 12px;
      color: #888;
      margin-top: 10px;
    }
    .section {
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    .section h2 {
      font-size: 20px;
      color: #1e4078;
      border-bottom: 1px solid #ddd;
      padding-bottom: 8px;
      margin-bottom: 15px;
    }
    .section-content {
      font-size: 14px;
    }
    .section-content p { margin: 0 0 12px 0; }
    .section-content ul { margin: 8px 0; padding-left: 24px; }
    .section-content li { margin-bottom: 6px; }
    .section-content table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
    }
    .section-content th, .section-content td {
      border: 1px solid #ddd;
      padding: 8px 12px;
      text-align: left;
      font-size: 13px;
    }
    .section-content th {
      background: #f0f4f8;
      font-weight: bold;
      color: #1e4078;
    }
    .disclaimer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 11px;
      color: #888;
      font-style: italic;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      font-size: 11px;
      color: #aaa;
    }
    @media print {
      body { padding: 0; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Personal Financial Review</h1>
    <div class="subtitle">Prepared for ${escapeHtml(opts.clientName)}</div>
    <div class="meta">
      Prepared by ${escapeHtml(opts.advisorName)} | ${escapeHtml(opts.firmName)}<br>
      ${date}
    </div>
  </div>

  ${sectionHTML}

  <div class="disclaimer">
    <p><strong>Important Disclosure:</strong> This Personal Financial Review is prepared for informational purposes only and does not constitute investment advice, tax advice, or a recommendation to purchase any financial product. All projections and analyses are based on information provided and assumptions that may change. Past performance does not guarantee future results. Please consult with qualified professionals before making financial decisions.</p>
    <p>Securities and insurance products are not deposits, are not FDIC insured, are not insured by any federal government agency, are not guaranteed by the firm, and may lose value.</p>
  </div>

  <div class="footer">
    <p>Generated by ${escapeHtml(opts.firmName)} | Confidential</p>
  </div>
</body>
</html>`;
}

function renderPFRAsMarkdown(opts: {
  content: string;
  clientName: string;
  advisorName: string;
  firmName: string;
  generatedAt: number;
}): string {
  const date = new Date(opts.generatedAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  return `# Personal Financial Review

**Prepared for:** ${opts.clientName}  
**Prepared by:** ${opts.advisorName} | ${opts.firmName}  
**Date:** ${date}

---

${opts.content}

---

*Important Disclosure: This Personal Financial Review is prepared for informational purposes only and does not constitute investment advice, tax advice, or a recommendation to purchase any financial product. All projections and analyses are based on information provided and assumptions that may change.*

*Generated by ${opts.firmName} | Confidential*
`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatContent(content: string): string {
  // If it looks like markdown, do basic conversion
  if (content.includes("##") || content.includes("- ") || content.includes("* ")) {
    return content
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/^## (.+)$/gm, "<h3>$1</h3>")
      .replace(/^\- (.+)$/gm, "<li>$1</li>")
      .replace(/^\* (.+)$/gm, "<li>$1</li>")
      .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n\n/g, "</p><p>")
      .replace(/^(?!<)(.+)$/gm, "<p>$1</p>");
  }
  // Plain text — wrap in paragraphs
  return content.split("\n\n").map(p => `<p>${p.trim()}</p>`).join("\n");
}
