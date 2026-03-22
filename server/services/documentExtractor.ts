/**
 * Document Text Extraction Service
 * Comprehensive extraction for PDFs, DOCX, DOC, XLSX, XLS, CSV, PPTX,
 * and 30+ text-based formats. Maximises first-time upload success by
 * cascading through multiple extraction strategies with graceful fallbacks.
 */

import * as pdfParseModule from "pdf-parse";
const pdfParse = (pdfParseModule as any).default || pdfParseModule;
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import AdmZip from "adm-zip";

// ─── Supported file type taxonomy ──────────────────────────────────

type FileCategory = "pdf" | "docx" | "xlsx" | "pptx" | "text" | "rtf" | "epub" | "unknown";

const TEXT_MIME_TYPES = new Set([
  "text/plain", "text/csv", "text/html", "text/markdown",
  "text/xml", "application/json", "application/xml",
  "text/tab-separated-values", "text/yaml", "text/x-yaml",
  "application/x-yaml", "application/yaml",
  "text/x-log", "text/x-ini", "text/x-properties",
  "text/css", "text/javascript", "application/javascript",
  "text/x-python", "text/x-java-source", "text/x-c",
  "text/x-sql", "text/x-shellscript",
  "application/ld+json", "application/x-ndjson",
  "text/calendar", "text/vcard",
]);

const PDF_MIME_TYPES = new Set([
  "application/pdf",
]);

const DOCX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.oasis.opendocument.text", // ODT — mammoth can handle some
]);

const XLSX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.oasis.opendocument.spreadsheet", // ODS
]);

const PPTX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "application/vnd.oasis.opendocument.presentation", // ODP
]);

const RTF_MIME_TYPES = new Set([
  "text/rtf", "application/rtf",
]);

const EPUB_MIME_TYPES = new Set([
  "application/epub+zip",
]);

// ─── Filename-based classification ─────────────────────────────────

const TEXT_EXTENSIONS = new Set([
  "txt", "md", "markdown", "json", "jsonl", "ndjson",
  "xml", "html", "htm", "css", "js", "ts", "jsx", "tsx",
  "csv", "tsv", "log", "yaml", "yml", "ini", "cfg", "conf",
  "toml", "env", "sh", "bash", "zsh", "bat", "ps1",
  "py", "rb", "java", "c", "cpp", "h", "hpp", "cs", "go",
  "rs", "swift", "kt", "scala", "r", "sql", "graphql",
  "tex", "latex", "bib", "ics", "vcf", "vcard",
  "properties", "gitignore", "dockerignore", "editorconfig",
  "makefile", "cmake", "gradle",
]);

function guessTypeFromFilename(filename: string): FileCategory {
  const ext = filename.toLowerCase().split(".").pop() || "";
  if (ext === "pdf") return "pdf";
  if (["docx", "doc", "odt"].includes(ext)) return "docx";
  if (["xlsx", "xls", "ods"].includes(ext)) return "xlsx";
  if (["pptx", "ppt", "odp"].includes(ext)) return "pptx";
  if (ext === "rtf") return "rtf";
  if (ext === "epub") return "epub";
  if (TEXT_EXTENSIONS.has(ext)) return "text";
  // Some files without extensions (Makefile, Dockerfile, etc.)
  const baseName = filename.toLowerCase().split("/").pop() || "";
  if (["makefile", "dockerfile", "vagrantfile", "gemfile", "rakefile", "procfile"].includes(baseName)) return "text";
  return "unknown";
}

function classifyMime(mimeType: string | undefined, filename: string): FileCategory {
  if (mimeType) {
    if (PDF_MIME_TYPES.has(mimeType)) return "pdf";
    if (DOCX_MIME_TYPES.has(mimeType)) return "docx";
    if (XLSX_MIME_TYPES.has(mimeType)) return "xlsx";
    if (PPTX_MIME_TYPES.has(mimeType)) return "pptx";
    if (RTF_MIME_TYPES.has(mimeType)) return "rtf";
    if (EPUB_MIME_TYPES.has(mimeType)) return "epub";
    if (TEXT_MIME_TYPES.has(mimeType)) return "text";
    // Catch-all for text/* MIME types we haven't listed
    if (mimeType.startsWith("text/")) return "text";
  }
  return guessTypeFromFilename(filename);
}

// ─── PDF extraction ──────────────────────────────────────────────

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    return data.text || "";
  } catch (err) {
    console.error("[DocumentExtractor] PDF parse error:", err);
    return "";
  }
}

// ─── DOCX / DOC extraction ──────────────────────────────────────

async function extractDocxText(buffer: Buffer, filename: string): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    if (result.value && result.value.trim().length > 0) {
      return result.value;
    }
  } catch (err) {
    console.error("[DocumentExtractor] mammoth DOCX parse error:", err);
  }

  // Fallback: try extracting XML directly from the ZIP structure
  try {
    const zip = new AdmZip(buffer);
    const docXml = zip.getEntry("word/document.xml");
    if (docXml) {
      const xmlText = docXml.getData().toString("utf-8");
      // Strip XML tags, keep text content
      const stripped = xmlText
        .replace(/<w:br[^>]*\/>/g, "\n")
        .replace(/<w:tab[^>]*\/>/g, "\t")
        .replace(/<[^>]+>/g, " ")
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&").replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/ {2,}/g, " ")
        .trim();
      if (stripped.length > 10) return stripped;
    }
  } catch (zipErr) {
    console.error("[DocumentExtractor] DOCX ZIP fallback error:", zipErr);
  }

  return "";
}

// ─── XLSX / XLS / ODS extraction ────────────────────────────────

function extractXlsxText(buffer: Buffer): string {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const parts: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      parts.push(`--- Sheet: ${sheetName} ---`);
      // Convert to CSV for readable text
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      if (csv.trim()) parts.push(csv);
    }
    return parts.join("\n\n");
  } catch (err) {
    console.error("[DocumentExtractor] XLSX parse error:", err);
    return "";
  }
}

// ─── PPTX / ODP extraction ─────────────────────────────────────

function extractPptxText(buffer: Buffer): string {
  try {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    const slideEntries = entries
      .filter(e => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
      .sort((a, b) => {
        const numA = parseInt(a.entryName.match(/slide(\d+)/)?.[1] || "0");
        const numB = parseInt(b.entryName.match(/slide(\d+)/)?.[1] || "0");
        return numA - numB;
      });

    if (slideEntries.length === 0) {
      // Try ODP format (content.xml)
      const contentXml = zip.getEntry("content.xml");
      if (contentXml) {
        const xml = contentXml.getData().toString("utf-8");
        return xml.replace(/<[^>]+>/g, " ").replace(/ {2,}/g, " ").trim();
      }
      return "";
    }

    const parts: string[] = [];
    for (let i = 0; i < slideEntries.length; i++) {
      const xml = slideEntries[i].getData().toString("utf-8");
      const text = xml
        .replace(/<a:br[^>]*\/>/g, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&").replace(/&quot;/g, '"')
        .replace(/ {2,}/g, " ")
        .trim();
      if (text) {
        parts.push(`--- Slide ${i + 1} ---\n${text}`);
      }
    }
    return parts.join("\n\n");
  } catch (err) {
    console.error("[DocumentExtractor] PPTX parse error:", err);
    return "";
  }
}

// ─── RTF extraction ─────────────────────────────────────────────

function extractRtfText(buffer: Buffer): string {
  try {
    const raw = buffer.toString("utf-8");
    // Strip RTF control words and groups, keep text
    let text = raw
      .replace(/\\par\b/g, "\n")
      .replace(/\\tab\b/g, "\t")
      .replace(/\\line\b/g, "\n")
      .replace(/\{\\[^{}]*\}/g, "")       // Remove groups like {\fonttbl...}
      .replace(/\\[a-z]+\d*\s?/gi, "")    // Remove control words
      .replace(/[{}]/g, "")               // Remove remaining braces
      .replace(/\\'([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .trim();
    return text;
  } catch (err) {
    console.error("[DocumentExtractor] RTF parse error:", err);
    return "";
  }
}

// ─── EPUB extraction ────────────────────────────────────────────

function extractEpubText(buffer: Buffer): string {
  try {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    // Find XHTML/HTML content files
    const contentEntries = entries
      .filter(e => /\.(xhtml|html|htm)$/i.test(e.entryName) && !e.entryName.includes("toc"))
      .sort((a, b) => a.entryName.localeCompare(b.entryName));

    const parts: string[] = [];
    for (const entry of contentEntries) {
      const html = entry.getData().toString("utf-8");
      const text = html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<\/h[1-6]>/gi, "\n\n")
        .replace(/<\/li>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&").replace(/&quot;/g, '"')
        .replace(/ {2,}/g, " ")
        .trim();
      if (text.length > 20) parts.push(text);
    }
    return parts.join("\n\n");
  } catch (err) {
    console.error("[DocumentExtractor] EPUB parse error:", err);
    return "";
  }
}

// ─── Plain text extraction ──────────────────────────────────────

function extractPlainText(buffer: Buffer): string {
  return buffer.toString("utf-8");
}

// ─── Binary heuristic check ────────────────────────────────────

function looksLikeText(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, 8192);
  let nullCount = 0;
  let controlCount = 0;
  for (let i = 0; i < sample.length; i++) {
    const byte = sample[i];
    if (byte === 0) nullCount++;
    if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) controlCount++;
  }
  const ratio = sample.length > 0 ? nullCount / sample.length : 0;
  const controlRatio = sample.length > 0 ? controlCount / sample.length : 0;
  return ratio < 0.05 && controlRatio < 0.10;
}

// ─── Main extraction function ──────────────────────────────────

export interface ExtractionResult {
  text: string;
  method: "pdf" | "docx" | "xlsx" | "pptx" | "rtf" | "epub" | "text" | "binary_fallback" | "unsupported";
  charCount: number;
  truncated: boolean;
}

/**
 * Extract readable text from a document buffer.
 * Supports 30+ file formats with cascading fallback strategies.
 *
 * @param buffer - Raw file buffer
 * @param filename - Original filename (used for type detection)
 * @param mimeType - MIME type if known
 * @param maxChars - Maximum characters to return (default 100,000)
 */
export async function extractDocumentText(
  buffer: Buffer,
  filename: string,
  mimeType?: string,
  maxChars: number = 100000,
): Promise<ExtractionResult> {
  const fileType = classifyMime(mimeType, filename);
  let text = "";
  let method: ExtractionResult["method"] = "unsupported";

  switch (fileType) {
    case "pdf":
      text = await extractPdfText(buffer);
      method = "pdf";
      break;

    case "docx":
      text = await extractDocxText(buffer, filename);
      method = "docx";
      break;

    case "xlsx":
      text = extractXlsxText(buffer);
      method = "xlsx";
      break;

    case "pptx":
      text = extractPptxText(buffer);
      method = "pptx";
      break;

    case "rtf":
      text = extractRtfText(buffer);
      method = "rtf";
      break;

    case "epub":
      text = extractEpubText(buffer);
      method = "epub";
      break;

    case "text":
      text = extractPlainText(buffer);
      method = "text";
      break;

    case "unknown":
    default:
      // Try text extraction if it looks like text
      if (looksLikeText(buffer)) {
        text = extractPlainText(buffer);
        method = "binary_fallback";
      } else {
        // Last resort: try as ZIP-based format (some custom formats use ZIP)
        try {
          const zip = new AdmZip(buffer);
          const entries = zip.getEntries();
          const textParts: string[] = [];
          for (const entry of entries) {
            if (/\.(xml|html|xhtml|txt|json|csv)$/i.test(entry.entryName)) {
              const content = entry.getData().toString("utf-8");
              const stripped = content.replace(/<[^>]+>/g, " ").replace(/ {2,}/g, " ").trim();
              if (stripped.length > 20) textParts.push(stripped);
            }
          }
          if (textParts.length > 0) {
            text = textParts.join("\n\n");
            method = "binary_fallback";
          }
        } catch {
          // Not a ZIP file
        }

        if (!text) {
          text = `[${filename}: Binary file — text extraction not available]`;
          method = "unsupported";
        }
      }
      break;
  }

  // Clean up extracted text
  text = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .replace(/[ \t]+$/gm, "")
    .trim();

  const truncated = text.length > maxChars;
  if (truncated) {
    text = text.substring(0, maxChars);
  }

  return { text, method, charCount: text.length, truncated };
}

/**
 * Get a human-readable list of supported file extensions.
 */
export function getSupportedExtensions(): string[] {
  return [
    // Documents
    "pdf", "docx", "doc", "odt", "rtf", "epub",
    // Spreadsheets
    "xlsx", "xls", "ods", "csv", "tsv",
    // Presentations
    "pptx", "ppt", "odp",
    // Text & code
    "txt", "md", "json", "jsonl", "xml", "html", "htm",
    "yaml", "yml", "toml", "ini", "cfg", "conf", "env",
    "log", "sql", "graphql",
    // Programming
    "py", "js", "ts", "jsx", "tsx", "css",
    "java", "c", "cpp", "h", "cs", "go", "rs", "rb",
    "swift", "kt", "scala", "r", "sh", "bash",
    // Other
    "tex", "latex", "bib", "ics", "vcf",
  ];
}
