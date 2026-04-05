/**
 * XML Parser — Parse XML files for data import (lightweight, no external deps)
 */
import { logger } from "../../_core/logger";

const log = logger.child({ module: "xmlParser" });

export interface XmlParseResult {
  records: Record<string, string>[];
  headers: string[];
  rootElement: string;
  totalCount: number;
  errors: string[];
}

/** Simple XML to object parser — handles flat record structures */
function parseXmlRecords(xml: string, recordTag?: string): { records: Record<string, string>[]; rootElement: string } {
  const records: Record<string, string>[] = [];

  // Detect record tag if not specified
  const tagMatch = xml.match(/<(\w+)[^>]*>/g);
  const tagCounts = new Map<string, number>();
  for (const t of tagMatch || []) {
    const name = t.match(/<(\w+)/)?.[1] || "";
    tagCounts.set(name, (tagCounts.get(name) || 0) + 1);
  }

  // Most repeated tag is likely the record element
  let detectedTag = recordTag || "";
  if (!detectedTag) {
    let maxCount = 0;
    for (const [tag, count] of Array.from(tagCounts.entries())) {
      if (count > maxCount && count > 1 && !["xml", "root", "data", "records"].includes(tag.toLowerCase())) {
        maxCount = count;
        detectedTag = tag;
      }
    }
  }

  if (!detectedTag) {
    return { records: [], rootElement: "unknown" };
  }

  // Extract records
  const regex = new RegExp(`<${detectedTag}[^>]*>([\\s\\S]*?)<\\/${detectedTag}>`, "g");
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const content = match[1];
    const record: Record<string, string> = {};
    const fieldRegex = /<(\w+)[^>]*>([^<]*)<\/\1>/g;
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(content)) !== null) {
      record[fieldMatch[1]] = fieldMatch[2].trim();
    }
    if (Object.keys(record).length > 0) records.push(record);
  }

  return { records, rootElement: detectedTag };
}

export function parseBuffer(buffer: Buffer, options?: { maxRecords?: number; recordTag?: string }): XmlParseResult {
  const maxRecords = options?.maxRecords ?? 50000;
  const errors: string[] = [];

  try {
    const xml = buffer.toString("utf-8");
    const { records, rootElement } = parseXmlRecords(xml, options?.recordTag);
    const limited = records.slice(0, maxRecords);

    if (records.length > maxRecords) {
      errors.push(`Truncated: ${records.length} records → ${maxRecords}`);
    }

    const headers = limited.length > 0 ? Object.keys(limited[0]) : [];
    log.info({ records: limited.length, rootElement }, "XML parsed");
    return { records: limited, headers, rootElement, totalCount: limited.length, errors };
  } catch (e: any) {
    log.error({ error: e.message }, "XML parse failed");
    return { records: [], headers: [], rootElement: "", totalCount: 0, errors: [e.message] };
  }
}
