/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Substrate Primitive: Document Intelligence
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Advanced document understanding, extraction, and analysis.
 * Builds on the existing documentExtractor but adds:
 *   - Structured data extraction (tables, key-value pairs)
 *   - Financial document classification
 *   - Multi-document comparison
 *   - Summarization with confidence scoring
 *   - Chunk-level semantic indexing for RAG
 *
 * @substrate-primitive: document-intel
 * @absorbed-from: manus-next-app/server/services/documentEngine.ts
 */
import { invokeLLM } from "../../_core/llm";
import { classify } from "./classifier";
import { generateEmbedding } from "./embedding";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "substrate:documentIntel" });

// ─── Types ───────────────────────────────────────────────────────────────────

export type DocumentType =
  | "financial_statement"
  | "tax_return"
  | "insurance_policy"
  | "investment_statement"
  | "estate_document"
  | "contract"
  | "correspondence"
  | "regulatory_filing"
  | "general";

export interface DocumentMetadata {
  type: DocumentType;
  title: string;
  pages?: number;
  language: string;
  confidence: number;
  entities: ExtractedEntity[];
  keyValues: Array<{ key: string; value: string; confidence: number }>;
  dates: Array<{ label: string; date: string }>;
  amounts: Array<{ label: string; amount: number; currency: string }>;
}

export interface ExtractedEntity {
  type: "person" | "organization" | "account" | "address" | "date" | "amount" | "percentage";
  value: string;
  context: string;
  confidence: number;
}

export interface DocumentChunk {
  id: string;
  content: string;
  startOffset: number;
  endOffset: number;
  embedding?: number[];
  metadata: {
    section?: string;
    pageNumber?: number;
    hasTable?: boolean;
    hasAmount?: boolean;
  };
}

export interface DocumentSummary {
  brief: string;
  detailed: string;
  keyFindings: string[];
  actionItems: string[];
  confidence: number;
}

export interface ComparisonResult {
  similarities: string[];
  differences: string[];
  conflicts: string[];
  recommendations: string[];
}

// ─── Document Classification ─────────────────────────────────────────────────

const DOCUMENT_PATTERNS: Record<DocumentType, RegExp[]> = {
  financial_statement: [/balance sheet/i, /income statement/i, /cash flow/i, /profit.?loss/i, /revenue/i, /assets.*liabilities/i],
  tax_return: [/form 1040/i, /tax return/i, /w-2/i, /1099/i, /schedule [a-z]/i, /adjusted gross income/i],
  insurance_policy: [/policy number/i, /coverage/i, /premium/i, /deductible/i, /beneficiary/i, /insured/i],
  investment_statement: [/portfolio/i, /holdings/i, /market value/i, /unrealized gain/i, /dividend/i, /brokerage/i],
  estate_document: [/trust/i, /will/i, /estate/i, /beneficiary/i, /executor/i, /power of attorney/i],
  contract: [/agreement/i, /parties/i, /whereas/i, /hereby/i, /terms and conditions/i],
  correspondence: [/dear/i, /sincerely/i, /regards/i, /re:/i],
  regulatory_filing: [/sec filing/i, /form [0-9]/i, /disclosure/i, /registration/i],
  general: [],
};

/**
 * Classify a document based on its content.
 */
export function classifyDocument(text: string): { type: DocumentType; confidence: number } {
  const scores: Array<{ type: DocumentType; score: number }> = [];

  for (const [docType, patterns] of Object.entries(DOCUMENT_PATTERNS)) {
    if (docType === "general") continue;
    const matches = patterns.filter((p) => p.test(text)).length;
    if (matches > 0) {
      scores.push({ type: docType as DocumentType, score: matches / patterns.length });
    }
  }

  scores.sort((a, b) => b.score - a.score);

  if (scores.length === 0 || scores[0].score < 0.2) {
    return { type: "general", confidence: 0.5 };
  }

  return { type: scores[0].type, confidence: Math.min(scores[0].score * 1.5, 0.95) };
}

// ─── Entity Extraction ───────────────────────────────────────────────────────

const ENTITY_PATTERNS: Array<{ type: ExtractedEntity["type"]; pattern: RegExp; extractor: (match: RegExpMatchArray) => string }> = [
  { type: "amount", pattern: /\$[\d,]+(?:\.\d{2})?/g, extractor: (m) => m[0] },
  { type: "percentage", pattern: /\d+\.?\d*%/g, extractor: (m) => m[0] },
  { type: "date", pattern: /\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+ \d{1,2},? \d{4})\b/g, extractor: (m) => m[0] },
  { type: "account", pattern: /(?:account|acct)[\s#:]*[\dX\-]+/gi, extractor: (m) => m[0] },
];

/**
 * Extract entities from document text using pattern matching.
 */
export function extractEntities(text: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const maxEntities = 50;

  for (const { type, pattern, extractor } of ENTITY_PATTERNS) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (entities.length >= maxEntities) break;
      const value = extractor(match);
      const start = Math.max(0, (match.index ?? 0) - 30);
      const end = Math.min(text.length, (match.index ?? 0) + value.length + 30);
      entities.push({
        type,
        value,
        context: text.slice(start, end).trim(),
        confidence: 0.85,
      });
    }
  }

  return entities;
}

// ─── Chunking ────────────────────────────────────────────────────────────────

/**
 * Split document text into semantic chunks for RAG indexing.
 */
export function chunkDocument(
  text: string,
  options: { maxChunkSize?: number; overlap?: number } = {}
): DocumentChunk[] {
  const maxSize = options.maxChunkSize ?? 1000;
  const overlap = options.overlap ?? 100;
  const chunks: DocumentChunk[] = [];

  // Split by paragraphs first
  const paragraphs = text.split(/\n{2,}/);
  let currentChunk = "";
  let startOffset = 0;
  let chunkId = 0;

  for (const para of paragraphs) {
    if (currentChunk.length + para.length > maxSize && currentChunk.length > 0) {
      chunks.push({
        id: `chunk_${chunkId++}`,
        content: currentChunk.trim(),
        startOffset,
        endOffset: startOffset + currentChunk.length,
        metadata: {
          hasTable: /\|.*\|/.test(currentChunk),
          hasAmount: /\$[\d,]+/.test(currentChunk),
        },
      });
      // Keep overlap
      const overlapText = currentChunk.slice(-overlap);
      startOffset += currentChunk.length - overlap;
      currentChunk = overlapText;
    }
    currentChunk += (currentChunk ? "\n\n" : "") + para;
  }

  // Last chunk
  if (currentChunk.trim()) {
    chunks.push({
      id: `chunk_${chunkId}`,
      content: currentChunk.trim(),
      startOffset,
      endOffset: startOffset + currentChunk.length,
      metadata: {
        hasTable: /\|.*\|/.test(currentChunk),
        hasAmount: /\$[\d,]+/.test(currentChunk),
      },
    });
  }

  return chunks;
}

// ─── Summarization ───────────────────────────────────────────────────────────

/**
 * Generate a multi-level summary of a document.
 */
export async function summarizeDocument(text: string, title?: string): Promise<DocumentSummary> {
  const truncated = text.slice(0, 8000); // Limit for LLM context

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Summarize this document. Return JSON with:
{
  "brief": "1-2 sentence summary",
  "detailed": "3-5 sentence detailed summary",
  "keyFindings": ["finding 1", "finding 2", ...],
  "actionItems": ["action 1", "action 2", ...]
}
Return ONLY valid JSON.`,
        },
        { role: "user", content: `${title ? `Document: ${title}\n\n` : ""}${truncated}` },
      ],
      response_format: { type: "json_object" as any },
    });

    const content = response?.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);

    return {
      brief: parsed.brief ?? "Document summary unavailable",
      detailed: parsed.detailed ?? "",
      keyFindings: parsed.keyFindings ?? [],
      actionItems: parsed.actionItems ?? [],
      confidence: 0.8,
    };
  } catch (err) {
    log.error({ err }, "Document summarization failed");
    return {
      brief: "Unable to summarize document",
      detailed: "",
      keyFindings: [],
      actionItems: [],
      confidence: 0,
    };
  }
}

// ─── Document Comparison ─────────────────────────────────────────────────────

/**
 * Compare two documents and identify similarities, differences, and conflicts.
 */
export async function compareDocuments(
  doc1: { title: string; text: string },
  doc2: { title: string; text: string }
): Promise<ComparisonResult> {
  const text1 = doc1.text.slice(0, 4000);
  const text2 = doc2.text.slice(0, 4000);

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Compare these two documents and return JSON with:
{
  "similarities": ["similarity 1", ...],
  "differences": ["difference 1", ...],
  "conflicts": ["conflict 1", ...],
  "recommendations": ["recommendation 1", ...]
}
Return ONLY valid JSON.`,
        },
        { role: "user", content: `Document 1 (${doc1.title}):\n${text1}\n\nDocument 2 (${doc2.title}):\n${text2}` },
      ],
      response_format: { type: "json_object" as any },
    });

    const content = response?.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);

    return {
      similarities: parsed.similarities ?? [],
      differences: parsed.differences ?? [],
      conflicts: parsed.conflicts ?? [],
      recommendations: parsed.recommendations ?? [],
    };
  } catch (err) {
    log.error({ err }, "Document comparison failed");
    return { similarities: [], differences: [], conflicts: [], recommendations: [] };
  }
}

// ─── Full Analysis Pipeline ──────────────────────────────────────────────────

/**
 * Run the full document intelligence pipeline:
 *   1. Classify document type
 *   2. Extract entities
 *   3. Generate chunks for RAG
 *   4. Summarize
 */
export async function analyzeDocument(
  text: string,
  title?: string
): Promise<{
  metadata: DocumentMetadata;
  chunks: DocumentChunk[];
  summary: DocumentSummary;
}> {
  // 1. Classify
  const { type, confidence: classConfidence } = classifyDocument(text);

  // 2. Extract entities
  const entities = extractEntities(text);

  // 3. Extract key-value pairs (amounts and dates)
  const amounts = entities
    .filter((e) => e.type === "amount")
    .map((e) => ({
      label: e.context.replace(e.value, "").trim().slice(0, 50),
      amount: parseFloat(e.value.replace(/[$,]/g, "")),
      currency: "USD",
    }));

  const dates = entities
    .filter((e) => e.type === "date")
    .map((e) => ({
      label: e.context.replace(e.value, "").trim().slice(0, 50),
      date: e.value,
    }));

  // 4. Chunk
  const chunks = chunkDocument(text);

  // 5. Summarize
  const summary = await summarizeDocument(text, title);

  const metadata: DocumentMetadata = {
    type,
    title: title ?? "Untitled Document",
    language: "en",
    confidence: classConfidence,
    entities,
    keyValues: entities
      .filter((e) => e.type === "account")
      .map((e) => ({ key: "Account", value: e.value, confidence: e.confidence })),
    dates,
    amounts,
  };

  log.info({ type, entities: entities.length, chunks: chunks.length }, "Document analyzed");

  return { metadata, chunks, summary };
}
