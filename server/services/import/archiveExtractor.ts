/**
 * Archive Extractor — Extract files from ZIP/TAR archives for import
 */
import { logger } from "../../_core/logger";
import AdmZip from "adm-zip";

const log = logger.child({ module: "archiveExtractor" });

export interface ExtractedFile {
  name: string;
  path: string;
  size: number;
  extension: string;
  buffer: Buffer;
}

export interface ArchiveResult {
  files: ExtractedFile[];
  totalSize: number;
  errors: string[];
}

const SUPPORTED_EXTENSIONS = new Set([".csv", ".xlsx", ".xls", ".json", ".xml", ".vcf", ".pdf", ".docx", ".txt", ".tsv"]);
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file
const MAX_TOTAL_SIZE = 200 * 1024 * 1024; // 200MB total

export function extractZip(buffer: Buffer, options?: { filterExtensions?: string[] }): ArchiveResult {
  const errors: string[] = [];
  const files: ExtractedFile[] = [];
  let totalSize = 0;
  const allowedExts = options?.filterExtensions ? new Set(options.filterExtensions) : SUPPORTED_EXTENSIONS;

  try {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      const ext = "." + (entry.entryName.split(".").pop()?.toLowerCase() || "");
      if (!allowedExts.has(ext)) continue;

      if (entry.header.size > MAX_FILE_SIZE) {
        errors.push(`Skipped ${entry.entryName}: exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
        continue;
      }

      if (totalSize + entry.header.size > MAX_TOTAL_SIZE) {
        errors.push(`Archive extraction stopped: total size exceeds ${MAX_TOTAL_SIZE / 1024 / 1024}MB`);
        break;
      }

      try {
        const fileBuffer = entry.getData();
        files.push({
          name: entry.entryName.split("/").pop() || entry.entryName,
          path: entry.entryName,
          size: entry.header.size,
          extension: ext,
          buffer: fileBuffer,
        });
        totalSize += entry.header.size;
      } catch (e: any) {
        errors.push(`Failed to extract ${entry.entryName}: ${e.message}`);
      }
    }

    log.info({ files: files.length, totalSize }, "Archive extracted");
    return { files, totalSize, errors };
  } catch (e: any) {
    log.error({ error: e.message }, "Archive extraction failed");
    return { files: [], totalSize: 0, errors: [e.message] };
  }
}
