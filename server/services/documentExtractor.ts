/**
 * Document Text Extraction Service
 * Properly extracts text from PDFs, DOCXs, and text-based files.
 * Replaces the naive buffer.toString("utf-8") approach that produced
 * garbled binary data for non-text files.
 */

import * as pdfParseModule from "pdf-parse";
const pdfParse = (pdfParseModule as any).default || pdfParseModule;
import mammoth from "mammoth";

// ─── MIME type detection helpers ─────────────────────────────────

const TEXT_MIME_TYPES = new Set([
  "text/plain", "text/csv", "text/html", "text/markdown",
  "text/xml", "application/json", "application/xml",
  "text/tab-separated-values", "text/rtf",
]);

const PDF_MIME_TYPES = new Set([
  "application/pdf",
]);

const DOCX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);

const XLSX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

const PPTX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
]);

function guessTypeFromFilename(filename: string): "pdf" | "docx" | "xlsx" | "pptx" | "text" | "unknown" {
  const ext = filename.toLowerCase().split(".").pop() || "";
  if (ext === "pdf") return "pdf";
  if (["docx", "doc"].includes(ext)) return "docx";
  if (["xlsx", "xls", "csv", "tsv"].includes(ext)) return "text"; // CSV/TSV are text
  if (["pptx", "ppt"].includes(ext)) return "pptx";
  if (["txt", "md", "json", "xml", "html", "htm", "rtf", "log", "yaml", "yml", "ini", "cfg", "conf"].includes(ext)) return "text";
  return "unknown";
}

function classifyMime(mimeType: string | undefined, filename: string): "pdf" | "docx" | "xlsx" | "pptx" | "text" | "unknown" {
  if (mimeType) {
    if (PDF_MIME_TYPES.has(mimeType)) return "pdf";
    if (DOCX_MIME_TYPES.has(mimeType)) return "docx";
    if (XLSX_MIME_TYPES.has(mimeType)) return "xlsx";
    if (PPTX_MIME_TYPES.has(mimeType)) return "pptx";
    if (TEXT_MIME_TYPES.has(mimeType)) return "text";
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

// ─── DOCX extraction ─────────────────────────────────────────────

async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  } catch (err) {
    console.error("[DocumentExtractor] DOCX parse error:", err);
    return "";
  }
}

// ─── Text extraction (plain text, CSV, JSON, etc.) ───────────────

function extractPlainText(buffer: Buffer): string {
  return buffer.toString("utf-8");
}

// ─── Binary heuristic check ─────────────────────────────────────
// If we can't determine the type, check if the buffer looks like text

function looksLikeText(buffer: Buffer): boolean {
  // Check first 8KB for binary characters
  const sample = buffer.subarray(0, 8192);
  let nullCount = 0;
  let controlCount = 0;
  for (let i = 0; i < sample.length; i++) {
    const byte = sample[i];
    if (byte === 0) nullCount++;
    // Control chars except \t, \n, \r
    if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) controlCount++;
  }
  // If more than 5% null bytes or 10% control chars, it's binary
  const ratio = sample.length > 0 ? nullCount / sample.length : 0;
  const controlRatio = sample.length > 0 ? controlCount / sample.length : 0;
  return ratio < 0.05 && controlRatio < 0.10;
}

// ─── Main extraction function ────────────────────────────────────

export interface ExtractionResult {
  text: string;
  method: "pdf" | "docx" | "text" | "binary_fallback" | "unsupported";
  charCount: number;
  truncated: boolean;
}

/**
 * Extract readable text from a document buffer.
 * Handles PDFs, DOCXs, and text-based files properly.
 * Returns empty text for truly unsupported binary formats.
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
      text = await extractDocxText(buffer);
      method = "docx";
      break;

    case "text":
      text = extractPlainText(buffer);
      method = "text";
      break;

    case "xlsx":
    case "pptx":
      // For spreadsheets and presentations, try text extraction as fallback
      if (looksLikeText(buffer)) {
        text = extractPlainText(buffer);
        method = "binary_fallback";
      } else {
        // These are ZIP-based formats; we could extract XML but for now
        // just note that they're unsupported for direct text extraction
        text = `[${filename}: ${fileType.toUpperCase()} file — text extraction not available for this format]`;
        method = "unsupported";
      }
      break;

    case "unknown":
    default:
      // Try text extraction if it looks like text
      if (looksLikeText(buffer)) {
        text = extractPlainText(buffer);
        method = "binary_fallback";
      } else {
        text = `[${filename}: Binary file — text extraction not available]`;
        method = "unsupported";
      }
      break;
  }

  // Clean up extracted text
  text = text
    .replace(/\r\n/g, "\n")           // Normalize line endings
    .replace(/\n{4,}/g, "\n\n\n")     // Collapse excessive blank lines
    .replace(/[ \t]+$/gm, "")         // Trim trailing whitespace per line
    .trim();

  const truncated = text.length > maxChars;
  if (truncated) {
    text = text.substring(0, maxChars);
  }

  return { text, method, charCount: text.length, truncated };
}
