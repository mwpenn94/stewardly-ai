/**
 * Multi-Modal Processing Service
 * - Visual OCR for image/screenshot text extraction
 * - Document processing (PDF tables, forms, structured data)
 * - Video transcript indexing
 * - Unified cross-format search
 * - Data highlighting and annotation storage
 */
import { invokeLLM } from "../shared/intelligence/sovereignWiring"
import { contextualLLM } from "./contextualLLM";
import { transcribeAudio } from "../_core/voiceTranscription";
import { getDb } from "../db";
import { documents, documentChunks } from "../../drizzle/schema";
import { eq, sql, and, like } from "drizzle-orm";
import { storagePut } from "../storage";
import crypto from "crypto";

// ─── Visual OCR Service ────────────────────────────────────────────────────
export class VisualOCRService {
  /**
   * Extract text from an image using LLM vision capabilities
   */
  async extractText(imageUrl: string): Promise<{
    text: string;
    tables: Array<{ headers: string[]; rows: string[][] }>;
    keyValues: Record<string, string>;
    confidence: number;
  }> {
    const result = await contextualLLM({ userId: 0, contextType: "chat",
      messages: [
        {
          role: "system",
          content: `You are an expert OCR and document analysis system. Extract ALL text from the image. Also identify:
1. Any tables (with headers and rows)
2. Key-value pairs (form fields, labels with values)
3. Your confidence level (0-1)
Return as JSON.`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract all text, tables, and key-value pairs from this image:" },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "ocr_result",
          strict: true,
          schema: {
            type: "object",
            properties: {
              text: { type: "string", description: "All extracted text" },
              tables: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    headers: { type: "array", items: { type: "string" } },
                    rows: { type: "array", items: { type: "array", items: { type: "string" } } },
                  },
                  required: ["headers", "rows"],
                  additionalProperties: false,
                },
              },
              keyValues: {
                type: "object",
                additionalProperties: { type: "string" },
                description: "Key-value pairs found in the image",
              },
              confidence: { type: "number", description: "Confidence score 0-1" },
            },
            required: ["text", "tables", "keyValues", "confidence"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = String(result.choices[0]?.message?.content || "{}");
    try {
      return JSON.parse(content);
    } catch {
      return { text: content, tables: [], keyValues: {}, confidence: 0.5 };
    }
  }

  /**
   * Explain a visual element in an image
   */
  async explainVisual(imageUrl: string, query?: string): Promise<string> {
    const result = await contextualLLM({ userId: 0, contextType: "chat",
      messages: [
        {
          role: "system",
          content: "You are a financial document analyst. Explain what you see in the image clearly and concisely. If it's a chart, describe trends. If it's a form, summarize the content.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: query || "Explain what you see in this image:" },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
          ],
        },
      ],
    });
    return String(result.choices[0]?.message?.content || "Unable to analyze image");
  }
}

// ─── Document Processing Service ───────────────────────────────────────────
export class DocumentProcessingService {
  /**
   * Extract tables from a PDF/image URL
   */
  async extractTables(fileUrl: string, mimeType: string): Promise<{
    tables: Array<{ title: string; headers: string[]; rows: string[][] }>;
    summary: string;
  }> {
    const contentParts: any[] = [
      { type: "text", text: "Extract all tables from this document. For each table, provide a title, headers, and all rows. Also provide a brief summary of the document." },
    ];

    if (mimeType.startsWith("image/")) {
      contentParts.push({ type: "image_url", image_url: { url: fileUrl, detail: "high" } });
    } else {
      contentParts.push({ type: "file_url", file_url: { url: fileUrl, mime_type: mimeType as any } });
    }

    const result = await contextualLLM({ userId: 0, contextType: "chat",
      messages: [
        { role: "system", content: "You are a document table extraction specialist. Extract all tabular data accurately." },
        { role: "user", content: contentParts },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "table_extraction",
          strict: true,
          schema: {
            type: "object",
            properties: {
              tables: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    headers: { type: "array", items: { type: "string" } },
                    rows: { type: "array", items: { type: "array", items: { type: "string" } } },
                  },
                  required: ["title", "headers", "rows"],
                  additionalProperties: false,
                },
              },
              summary: { type: "string" },
            },
            required: ["tables", "summary"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = String(result.choices[0]?.message?.content || "{}");
    try {
      return JSON.parse(content);
    } catch {
      return { tables: [], summary: content };
    }
  }

  /**
   * Parse forms and structured data from documents
   */
  async parseForm(fileUrl: string, mimeType: string): Promise<{
    fields: Array<{ label: string; value: string; type: string }>;
    formType: string;
    confidence: number;
  }> {
    const contentParts: any[] = [
      { type: "text", text: "Parse this form/document. Extract all form fields with their labels, values, and field types (text, number, date, checkbox, etc.). Identify the form type." },
    ];

    if (mimeType.startsWith("image/")) {
      contentParts.push({ type: "image_url", image_url: { url: fileUrl, detail: "high" } });
    } else {
      contentParts.push({ type: "file_url", file_url: { url: fileUrl, mime_type: mimeType as any } });
    }

    const result = await contextualLLM({ userId: 0, contextType: "chat",
      messages: [
        { role: "system", content: "You are a form parsing specialist. Extract all fields accurately." },
        { role: "user", content: contentParts },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "form_parse",
          strict: true,
          schema: {
            type: "object",
            properties: {
              fields: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    value: { type: "string" },
                    type: { type: "string" },
                  },
                  required: ["label", "value", "type"],
                  additionalProperties: false,
                },
              },
              formType: { type: "string" },
              confidence: { type: "number" },
            },
            required: ["fields", "formType", "confidence"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = String(result.choices[0]?.message?.content || "{}");
    try {
      return JSON.parse(content);
    } catch {
      return { fields: [], formType: "unknown", confidence: 0 };
    }
  }

  /**
   * Extract key information and create a summary/outline
   */
  async extractKeyInfo(fileUrl: string, mimeType: string): Promise<{
    title: string;
    summary: string;
    keyPoints: string[];
    entities: Array<{ name: string; type: string; context: string }>;
    outline: Array<{ section: string; content: string }>;
  }> {
    const contentParts: any[] = [
      { type: "text", text: "Analyze this document thoroughly. Extract the title, a comprehensive summary, key points, named entities (people, organizations, amounts, dates), and create a structured outline." },
    ];

    if (mimeType.startsWith("image/")) {
      contentParts.push({ type: "image_url", image_url: { url: fileUrl, detail: "high" } });
    } else {
      contentParts.push({ type: "file_url", file_url: { url: fileUrl, mime_type: mimeType as any } });
    }

    const result = await contextualLLM({ userId: 0, contextType: "chat",
      messages: [
        { role: "system", content: "You are a document analysis specialist. Extract comprehensive information." },
        { role: "user", content: contentParts },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "key_info",
          strict: true,
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              summary: { type: "string" },
              keyPoints: { type: "array", items: { type: "string" } },
              entities: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    type: { type: "string" },
                    context: { type: "string" },
                  },
                  required: ["name", "type", "context"],
                  additionalProperties: false,
                },
              },
              outline: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    section: { type: "string" },
                    content: { type: "string" },
                  },
                  required: ["section", "content"],
                  additionalProperties: false,
                },
              },
            },
            required: ["title", "summary", "keyPoints", "entities", "outline"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = String(result.choices[0]?.message?.content || "{}");
    try {
      return JSON.parse(content);
    } catch {
      return { title: "", summary: content, keyPoints: [], entities: [], outline: [] };
    }
  }
}

// ─── Video Transcript Indexing ─────────────────────────────────────────────
export class VideoTranscriptService {
  /**
   * Transcribe and index a video/audio file
   */
  async transcribeAndIndex(userId: number, audioUrl: string, title: string): Promise<{
    text: string;
    segments: Array<{ start: number; end: number; text: string }>;
    documentId: number | null;
  }> {
    // Transcribe using Whisper
    const result = await transcribeAudio({ audioUrl }) as any;
    const text = result?.text || "";
    const segments = (result?.segments || []).map((s: any) => ({
      start: s.start || 0,
      end: s.end || 0,
      text: s.text || "",
    }));

    // Index in document store for unified search
    const db = await getDb();
    let documentId: number | null = null;
    if (db && text.length > 0) {
      const [doc] = await db.insert(documents).values({
        userId,
        filename: title || "Video Transcript",
        fileUrl: audioUrl,
        fileKey: `transcripts/${userId}/${Date.now()}.webm`,
        mimeType: "audio/webm",
        status: "ready",
        chunkCount: Math.ceil(text.length / 500),
        extractedText: text.slice(0, 65000),
      }).$returningId();
      documentId = doc?.id || null;

      // Chunk the transcript for search
      if (documentId) {
        const chunkSize = 500;
        const chunks: string[] = [];
        for (let i = 0; i < text.length; i += chunkSize) {
          chunks.push(text.slice(i, i + chunkSize));
        }
        for (let i = 0; i < chunks.length; i++) {
          await db.insert(documentChunks).values({
            documentId,
            userId,
            chunkIndex: i,
            content: chunks[i],
          });
        }
      }
    }

    return { text, segments, documentId };
  }
}

// ─── Unified Cross-Format Search ───────────────────────────────────────────
export class UnifiedSearchService {
  /**
   * Search across all document types (text, PDF, images, video transcripts)
   */
  async search(userId: number, query: string, options?: {
    types?: string[];
    limit?: number;
  }): Promise<Array<{
    documentId: number;
    title: string;
    fileType: string;
    snippet: string;
    relevance: number;
  }>> {
    const db = await getDb();
    if (!db) return [];

    const limit = options?.limit || 20;
    const searchTerm = `%${query}%`;

    // Search across document chunks
    const results = await db
      .select({
        documentId: documentChunks.documentId,
        title: documents.filename,
        fileType: documents.mimeType,
        content: documentChunks.content,
      })
      .from(documentChunks)
      .innerJoin(documents, eq(documentChunks.documentId, documents.id))
      .where(
        and(
          eq(documents.userId, userId),
          like(documentChunks.content, searchTerm),
        )
      )
      .limit(limit);

    return results.map((r, i) => ({
      documentId: r.documentId,
      title: r.title || "Untitled",
      fileType: r.fileType || "unknown",
      snippet: highlightMatch(r.content || "", query),
      relevance: 1 - (i * 0.05),
    }));
  }
}

// ─── Annotation Service ────────────────────────────────────────────────────
export class AnnotationService {
  /**
   * Store an annotation on a document/image
   */
  async createAnnotation(userId: number, data: {
    documentId?: number;
    imageUrl?: string;
    annotationType: "highlight" | "circle" | "arrow" | "text" | "rectangle";
    coordinates: { x: number; y: number; width?: number; height?: number };
    color: string;
    note?: string;
    pageNumber?: number;
  }): Promise<{ id: string; createdAt: number }> {
    const id = crypto.randomUUID();
    // Store annotation as a document chunk with special metadata
    const db = await getDb();
    if (db && data.documentId) {
      await db.insert(documentChunks).values({
        documentId: data.documentId,
        userId,
        chunkIndex: -1, // Special index for annotations
        content: JSON.stringify({
          id,
          userId,
          type: data.annotationType,
          coordinates: data.coordinates,
          color: data.color,
          note: data.note,
          pageNumber: data.pageNumber,
          imageUrl: data.imageUrl,
        }),
      });
    }
    return { id, createdAt: Date.now() };
  }

  /**
   * Get annotations for a document
   */
  async getAnnotations(documentId: number): Promise<any[]> {
    const db = await getDb();
    if (!db) return [];

    const chunks = await db.select().from(documentChunks)
      .where(and(
        eq(documentChunks.documentId, documentId),
        eq(documentChunks.chunkIndex, -1),
      ));

    return chunks.map(c => {
      try { return JSON.parse(c.content || "{}"); } catch { return null; }
    }).filter(Boolean);
  }
}

// ─── Helper ────────────────────────────────────────────────────────────────
function highlightMatch(text: string, query: string): string {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, 200);
  const start = Math.max(0, idx - 80);
  const end = Math.min(text.length, idx + query.length + 80);
  return (start > 0 ? "..." : "") + text.slice(start, end) + (end < text.length ? "..." : "");
}

// Export singleton instances
export const visualOCR = new VisualOCRService();
export const documentProcessor = new DocumentProcessingService();
export const videoTranscript = new VideoTranscriptService();
export const unifiedSearch = new UnifiedSearchService();
export const annotationService = new AnnotationService();
