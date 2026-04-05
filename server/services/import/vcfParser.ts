/**
 * VCF Parser — Parse vCard (.vcf) files for contact import
 */
import { logger } from "../../_core/logger";

const log = logger.child({ module: "vcfParser" });

export interface VcfContact {
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  organization: string | null;
  title: string | null;
  address: string | null;
}

export interface VcfParseResult {
  contacts: VcfContact[];
  totalCount: number;
  errors: string[];
}

function parseVcard(block: string): VcfContact {
  const get = (prop: string): string | null => {
    const regex = new RegExp(`^${prop}[;:](.*)$`, "im");
    const match = block.match(regex);
    return match ? match[1].replace(/^.*:/, "").trim() : null;
  };

  const fn = get("FN");
  const n = get("N");
  let firstName: string | null = null;
  let lastName: string | null = null;
  if (n) {
    const parts = n.split(";");
    lastName = parts[0] || null;
    firstName = parts[1] || null;
  }

  return {
    fullName: fn,
    firstName,
    lastName,
    email: get("EMAIL"),
    phone: get("TEL"),
    organization: get("ORG"),
    title: get("TITLE"),
    address: get("ADR"),
  };
}

export function parseBuffer(buffer: Buffer, options?: { maxContacts?: number }): VcfParseResult {
  const maxContacts = options?.maxContacts ?? 10000;
  const errors: string[] = [];

  try {
    const text = buffer.toString("utf-8");
    const blocks = text.split("BEGIN:VCARD").filter((b) => b.includes("END:VCARD"));
    const contacts: VcfContact[] = [];

    for (const block of blocks.slice(0, maxContacts)) {
      try {
        contacts.push(parseVcard(block));
      } catch (e: any) {
        errors.push(`Failed to parse vCard entry: ${e.message}`);
      }
    }

    if (blocks.length > maxContacts) {
      errors.push(`Truncated: ${blocks.length} contacts → ${maxContacts}`);
    }

    log.info({ contacts: contacts.length }, "VCF parsed");
    return { contacts, totalCount: contacts.length, errors };
  } catch (e: any) {
    log.error({ error: e.message }, "VCF parse failed");
    return { contacts: [], totalCount: 0, errors: [e.message] };
  }
}
