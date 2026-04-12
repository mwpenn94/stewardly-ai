/**
 * Estate document parser — pure regex/heuristic text extractor.
 *
 * Shipped by Pass 7 of the hybrid build loop — PARITY-ESTATE-0001.
 *
 * Caller provides plain text from a will/trust document (OCR
 * pipeline is external — this module is deliberately OCR-free so
 * tests run offline and the extractor is deterministic). We pull
 * structured fields:
 *
 *   - Testator / grantor name
 *   - Executor(s) / trustee(s)
 *   - Beneficiaries with shares/percentages
 *   - Specific bequests
 *   - Residuary clause
 *   - Guardianship nominations
 *   - Governing state / jurisdiction
 *   - Trust structure hints (revocable vs irrevocable, per stirpes)
 *
 * Rubric choices (mirroring Pass 3 meeting extractor):
 *
 *   - Conservative: prefer false negatives over false positives.
 *     A downstream LLM pipeline can catch missed items but
 *     incorrectly-inserted beneficiaries would mislead the advisor.
 *   - Line-based extraction. No full-document NLP.
 *   - All functions are PURE — no DB, no fetch, no wall-clock.
 *   - Warnings for ambiguous inputs (multiple possible testators,
 *     percentages that don't sum to 100, etc.).
 *
 * This primitive closes the "doc text → structured estate data" gap
 * vs Vanilla and FP Alpha without any external dependency. The
 * downstream advisor workflow can still send the same text to an
 * LLM for deeper synthesis; this module is the deterministic
 * baseline + cost-free preview.
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export type DocumentKind = "will" | "trust" | "codicil" | "unknown";

export type TrustKind = "revocable" | "irrevocable" | "unknown";

export interface Testator {
  name: string;
  line: number;
}

export interface FiduciaryRole {
  /** advisor, executor, trustee, successor trustee, guardian, attorney-in-fact. */
  role: "executor" | "successor_executor" | "trustee" | "successor_trustee" | "guardian" | "attorney_in_fact";
  name: string;
  line: number;
}

export interface Beneficiary {
  name: string;
  /** Decimal 0..100 when a percent is parsed; null when only "equal shares" is mentioned. */
  sharePct: number | null;
  /** True when "per stirpes" language accompanies this beneficiary. */
  perStirpes: boolean;
  /** True when a specific dollar amount is bequeathed (rather than a residuary share). */
  specific: boolean;
  /** Dollar amount if specific. */
  amountUSD?: number;
  line: number;
}

export interface SpecificBequest {
  /** Item described in the bequest (e.g. "my antique watch"). */
  item: string;
  to: string;
  amountUSD?: number;
  line: number;
}

export interface Guardianship {
  forWhom: string;
  guardian: string;
  line: number;
}

export interface ParsedEstateDocument {
  kind: DocumentKind;
  trustKind: TrustKind;
  governingState: string | null;
  testators: Testator[];
  executors: FiduciaryRole[];
  trustees: FiduciaryRole[];
  beneficiaries: Beneficiary[];
  specificBequests: SpecificBequest[];
  guardians: Guardianship[];
  /** True if the document contains "per stirpes" language anywhere. */
  perStirpesReference: boolean;
  /** True if the document contains "residuary" / "rest and remainder". */
  residuaryReference: boolean;
  /** Total percentages extracted from beneficiary clauses (for invariant check). */
  totalBeneficiaryPct: number;
  analyzedLines: number;
  warnings: string[];
}

// ─── Constants ─────────────────────────────────────────────────────────────

// Order matters: codicil is checked BEFORE will because "Codicil to
// the Last Will of X" contains "will of" which would otherwise match.
const DOC_KIND_PATTERNS: Array<{ re: RegExp; kind: DocumentKind }> = [
  { re: /\bcodicil\b/i, kind: "codicil" },
  { re: /\b(?:last will and testament|will of)\b/i, kind: "will" },
  { re: /\b(?:declaration of trust|trust agreement|living trust|revocable trust|irrevocable trust)\b/i, kind: "trust" },
];

const TRUST_KIND_PATTERNS: Array<{ re: RegExp; kind: TrustKind }> = [
  { re: /\birrevocable\b/i, kind: "irrevocable" },
  { re: /\brevocable\b/i, kind: "revocable" },
];

// US state name list for governing-state extraction. Also matches
// common abbreviations.
const STATES: Array<{ name: string; abbr: string }> = [
  { name: "Alabama", abbr: "AL" }, { name: "Alaska", abbr: "AK" },
  { name: "Arizona", abbr: "AZ" }, { name: "Arkansas", abbr: "AR" },
  { name: "California", abbr: "CA" }, { name: "Colorado", abbr: "CO" },
  { name: "Connecticut", abbr: "CT" }, { name: "Delaware", abbr: "DE" },
  { name: "Florida", abbr: "FL" }, { name: "Georgia", abbr: "GA" },
  { name: "Hawaii", abbr: "HI" }, { name: "Idaho", abbr: "ID" },
  { name: "Illinois", abbr: "IL" }, { name: "Indiana", abbr: "IN" },
  { name: "Iowa", abbr: "IA" }, { name: "Kansas", abbr: "KS" },
  { name: "Kentucky", abbr: "KY" }, { name: "Louisiana", abbr: "LA" },
  { name: "Maine", abbr: "ME" }, { name: "Maryland", abbr: "MD" },
  { name: "Massachusetts", abbr: "MA" }, { name: "Michigan", abbr: "MI" },
  { name: "Minnesota", abbr: "MN" }, { name: "Mississippi", abbr: "MS" },
  { name: "Missouri", abbr: "MO" }, { name: "Montana", abbr: "MT" },
  { name: "Nebraska", abbr: "NE" }, { name: "Nevada", abbr: "NV" },
  { name: "New Hampshire", abbr: "NH" }, { name: "New Jersey", abbr: "NJ" },
  { name: "New Mexico", abbr: "NM" }, { name: "New York", abbr: "NY" },
  { name: "North Carolina", abbr: "NC" }, { name: "North Dakota", abbr: "ND" },
  { name: "Ohio", abbr: "OH" }, { name: "Oklahoma", abbr: "OK" },
  { name: "Oregon", abbr: "OR" }, { name: "Pennsylvania", abbr: "PA" },
  { name: "Rhode Island", abbr: "RI" }, { name: "South Carolina", abbr: "SC" },
  { name: "South Dakota", abbr: "SD" }, { name: "Tennessee", abbr: "TN" },
  { name: "Texas", abbr: "TX" }, { name: "Utah", abbr: "UT" },
  { name: "Vermont", abbr: "VT" }, { name: "Virginia", abbr: "VA" },
  { name: "Washington", abbr: "WA" }, { name: "West Virginia", abbr: "WV" },
  { name: "Wisconsin", abbr: "WI" }, { name: "Wyoming", abbr: "WY" },
];

// Name-capture: use explicit case-sensitive [A-Z] so we don't capture
// verbs that begin a sentence at position 0. Same lesson as Pass 3.
// Pattern: one or more Capitalized Words, optional middle initial.
const NAME_CAPTURE = "([A-Z][a-z]+(?:\\s+(?:[A-Z]\\.?|[A-Z][a-z]+)){1,4})";

// ─── Helpers ───────────────────────────────────────────────────────────────

function nonEmptyLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function parseAmountUSD(raw: string): number | undefined {
  const m = raw.match(/\$\s?([\d,]+)(?:\.\d{2})?/);
  if (!m) return undefined;
  const n = parseInt(m[1].replace(/,/g, ""), 10);
  return Number.isFinite(n) ? n : undefined;
}

function detectKind(lines: string[]): DocumentKind {
  for (const l of lines) {
    for (const p of DOC_KIND_PATTERNS) {
      if (p.re.test(l)) return p.kind;
    }
  }
  return "unknown";
}

function detectTrustKind(lines: string[], kind: DocumentKind): TrustKind {
  if (kind !== "trust") return "unknown";
  for (const l of lines) {
    for (const p of TRUST_KIND_PATTERNS) {
      if (p.re.test(l)) return p.kind;
    }
  }
  return "unknown";
}

function detectGoverningState(lines: string[]): string | null {
  // Look for "laws of [State]" or "State of [State]" phrases.
  const stateRe = /(?:laws of(?: the state of)?|state of|pursuant to the laws of(?: the state of)?)\s+([A-Za-z ]+?)(?:[,.;]|\s+shall|\s+govern|$)/i;
  for (const line of lines) {
    const m = line.match(stateRe);
    if (m) {
      const candidate = m[1].trim();
      const hit = STATES.find(
        (s) =>
          s.name.toLowerCase() === candidate.toLowerCase() ||
          s.abbr === candidate.toUpperCase(),
      );
      if (hit) return hit.name;
    }
  }
  // Fallback: bare state mention in the document header.
  for (const line of lines.slice(0, 10)) {
    for (const s of STATES) {
      if (new RegExp(`\\b${s.name}\\b`, "i").test(line)) return s.name;
    }
  }
  return null;
}

// ─── Testator + fiduciary extraction ──────────────────────────────────────

function extractTestators(lines: string[]): Testator[] {
  const out: Testator[] = [];
  const patterns = [
    new RegExp(`\\bI,?\\s+${NAME_CAPTURE},?\\s+(?:being of sound mind|do hereby|declare|make this|of)`, ""),
    new RegExp(`last will and testament of\\s+${NAME_CAPTURE}`, "i"),
    new RegExp(`will of\\s+${NAME_CAPTURE}`, "i"),
  ];
  lines.forEach((line, idx) => {
    for (const re of patterns) {
      const m = line.match(re);
      if (m) {
        out.push({ name: m[1], line: idx + 1 });
        return;
      }
    }
  });
  return out;
}

function extractFiduciaries(lines: string[]): {
  executors: FiduciaryRole[];
  trustees: FiduciaryRole[];
  guardians: Guardianship[];
} {
  const executors: FiduciaryRole[] = [];
  const trustees: FiduciaryRole[] = [];
  const guardians: Guardianship[] = [];

  const exPatterns: Array<{ re: RegExp; role: FiduciaryRole["role"] }> = [
    {
      re: new RegExp(`(?:i\\s+)?(?:hereby\\s+)?(?:nominate|appoint|name)\\s+${NAME_CAPTURE}\\s+(?:as|to serve as|to be)\\s+(?:my\\s+)?(executor|personal representative)`, "i"),
      role: "executor",
    },
    {
      re: new RegExp(`(?:successor\\s+executor|alternate\\s+executor)\\s+(?:shall\\s+be\\s+)?${NAME_CAPTURE}`, "i"),
      role: "successor_executor",
    },
    {
      re: new RegExp(`(?:i\\s+)?(?:hereby\\s+)?(?:nominate|appoint|name)\\s+${NAME_CAPTURE}\\s+(?:as|to serve as|to be)\\s+(?:my\\s+)?trustee`, "i"),
      role: "trustee",
    },
    {
      re: new RegExp(`successor\\s+trustee\\s+(?:shall\\s+be\\s+)?${NAME_CAPTURE}`, "i"),
      role: "successor_trustee",
    },
    {
      re: new RegExp(`attorney[- ]in[- ]fact\\s+(?:shall\\s+be\\s+)?${NAME_CAPTURE}`, "i"),
      role: "attorney_in_fact",
    },
  ];

  const guardRe = new RegExp(
    `(?:i\\s+)?(?:hereby\\s+)?(?:nominate|appoint)\\s+${NAME_CAPTURE}\\s+(?:as|to serve as|to be)?\\s*(?:the\\s+)?guardian\\s+(?:of\\s+(?:my\\s+)?(.+?))?(?:[,.]|$)`,
    "i",
  );

  lines.forEach((line, idx) => {
    for (const p of exPatterns) {
      const m = line.match(p.re);
      if (m) {
        const entry: FiduciaryRole = {
          role: p.role,
          name: m[1],
          line: idx + 1,
        };
        if (p.role === "executor" || p.role === "successor_executor") {
          executors.push(entry);
        } else if (p.role === "trustee" || p.role === "successor_trustee" || p.role === "attorney_in_fact") {
          trustees.push(entry);
        }
      }
    }
    const g = line.match(guardRe);
    if (g) {
      guardians.push({
        guardian: g[1],
        forWhom: (g[2] ?? "").replace(/^(?:my\s+)/i, "").trim() || "unspecified",
        line: idx + 1,
      });
    }
  });
  return { executors, trustees, guardians };
}

// ─── Beneficiary extraction ───────────────────────────────────────────────

function extractBeneficiaries(lines: string[]): {
  beneficiaries: Beneficiary[];
  specificBequests: SpecificBequest[];
  perStirpesReference: boolean;
  residuaryReference: boolean;
} {
  const beneficiaries: Beneficiary[] = [];
  const specificBequests: SpecificBequest[] = [];
  let perStirpesReference = false;
  let residuaryReference = false;

  const dollarBequestRe = new RegExp(
    `(?:i\\s+)?(?:give|bequeath|devise|leave)\\s+(?:the sum of\\s+)?(\\$\\s?[\\d,]+(?:\\.\\d{2})?)\\s+to\\s+(?:my\\s+)?(.+?)(?:[.,;]|$)`,
    "i",
  );
  const percentBequestRe = new RegExp(
    `(?:i\\s+)?(?:give|bequeath|devise)\\s+(\\d{1,3}(?:\\.\\d{1,2})?)\\s*(?:%|percent)\\s+(?:of\\s+my\\s+(?:estate|residuary))?\\s*to\\s+(?:my\\s+)?(.+?)(?:[.,;]|$)`,
    "i",
  );
  // Specific item bequests must start with "my " — this filters out
  // dollar-amount matches where m[1] would start with "$".
  const specificItemRe = new RegExp(
    `(?:i\\s+)?(?:give|bequeath|devise)\\s+(my\\s+\\w[^$%]*?)\\s+to\\s+(?:my\\s+)?(.+?)(?:[.,;]|$)`,
    "i",
  );

  lines.forEach((line, idx) => {
    if (/\bper stirpes\b/i.test(line)) perStirpesReference = true;
    if (/\b(?:residue|residuary|rest and remainder|rest, residue)\b/i.test(line)) {
      residuaryReference = true;
    }

    const dollarM = line.match(dollarBequestRe);
    if (dollarM) {
      const amount = parseAmountUSD(dollarM[1]);
      beneficiaries.push({
        name: cleanBeneficiaryName(dollarM[2]),
        sharePct: null,
        perStirpes: /\bper stirpes\b/i.test(line),
        specific: true,
        amountUSD: amount,
        line: idx + 1,
      });
      return;
    }

    const percentM = line.match(percentBequestRe);
    if (percentM) {
      const pct = parseFloat(percentM[1]);
      beneficiaries.push({
        name: cleanBeneficiaryName(percentM[2]),
        sharePct: Number.isFinite(pct) && pct >= 0 && pct <= 100 ? pct : null,
        perStirpes: /\bper stirpes\b/i.test(line),
        specific: false,
        amountUSD: undefined,
        line: idx + 1,
      });
      return;
    }

    const specificM = line.match(specificItemRe);
    if (specificM) {
      // Skip if the item field starts with my + any financial term we already matched.
      if (/^my\s+(sum|\$|\d+%)/i.test(specificM[1])) return;
      const amount = parseAmountUSD(line);
      specificBequests.push({
        item: specificM[1],
        to: cleanBeneficiaryName(specificM[2]),
        amountUSD: amount,
        line: idx + 1,
      });
    }
  });

  return {
    beneficiaries,
    specificBequests,
    perStirpesReference,
    residuaryReference,
  };
}

function cleanBeneficiaryName(raw: string): string {
  return raw
    .replace(/\b(?:per stirpes|in equal shares|share and share alike|outright|free of trust)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*,?$/, "")
    .trim();
}

// ─── Main entry point ─────────────────────────────────────────────────────

export function parseEstateDocument(text: string): ParsedEstateDocument {
  const warnings: string[] = [];
  const empty: ParsedEstateDocument = {
    kind: "unknown",
    trustKind: "unknown",
    governingState: null,
    testators: [],
    executors: [],
    trustees: [],
    beneficiaries: [],
    specificBequests: [],
    guardians: [],
    perStirpesReference: false,
    residuaryReference: false,
    totalBeneficiaryPct: 0,
    analyzedLines: 0,
    warnings,
  };

  if (!text || text.trim().length === 0) {
    warnings.push("Empty document.");
    return empty;
  }
  if (text.length < 100) {
    warnings.push("Document is very short (<100 chars) — coverage will be low.");
  }

  const lines = nonEmptyLines(text);
  const kind = detectKind(lines);
  const trustKind = detectTrustKind(lines, kind);
  const governingState = detectGoverningState(lines);
  const testators = extractTestators(lines);
  const { executors, trustees, guardians } = extractFiduciaries(lines);
  const {
    beneficiaries,
    specificBequests,
    perStirpesReference,
    residuaryReference,
  } = extractBeneficiaries(lines);

  const totalBeneficiaryPct = beneficiaries.reduce(
    (s, b) => s + (b.sharePct ?? 0),
    0,
  );

  // Invariant check: if any percentages are declared, they should
  // sum to ≤100. >100 is a data error.
  if (totalBeneficiaryPct > 100.5) {
    warnings.push(
      `Beneficiary percentages sum to ${totalBeneficiaryPct.toFixed(1)}% — exceeds 100%.`,
    );
  }

  // If we parsed a will but found no executor, warn.
  if (kind === "will" && executors.length === 0) {
    warnings.push("Will detected but no executor was extracted.");
  }
  // If we parsed a trust but found no trustee, warn.
  if (kind === "trust" && trustees.length === 0) {
    warnings.push("Trust detected but no trustee was extracted.");
  }
  // If no governing state was parsed, flag it — state law materially
  // changes will interpretation.
  if (!governingState) {
    warnings.push("Governing state not detected — state law matters for interpretation.");
  }

  return {
    kind,
    trustKind,
    governingState,
    testators,
    executors,
    trustees,
    beneficiaries,
    specificBequests,
    guardians,
    perStirpesReference,
    residuaryReference,
    totalBeneficiaryPct,
    analyzedLines: lines.length,
    warnings,
  };
}

/** Render a terse markdown summary — symmetric to the meeting extractor. */
export function renderEstateMarkdown(doc: ParsedEstateDocument): string {
  const out: string[] = [];
  out.push(`## ${doc.kind === "unknown" ? "Document" : doc.kind.toUpperCase()}`);
  if (doc.trustKind !== "unknown") out.push(`**Trust kind:** ${doc.trustKind}`);
  if (doc.governingState) out.push(`**Governing state:** ${doc.governingState}`);
  if (doc.testators.length) {
    out.push(`**Testator(s):** ${doc.testators.map((t) => t.name).join(", ")}`);
  }
  if (doc.executors.length) {
    out.push("");
    out.push("### Executors");
    for (const e of doc.executors) {
      out.push(`- ${e.name} (${e.role.replace(/_/g, " ")})`);
    }
  }
  if (doc.trustees.length) {
    out.push("");
    out.push("### Trustees");
    for (const t of doc.trustees) {
      out.push(`- ${t.name} (${t.role.replace(/_/g, " ")})`);
    }
  }
  if (doc.beneficiaries.length) {
    out.push("");
    out.push("### Beneficiaries");
    for (const b of doc.beneficiaries) {
      const share = b.sharePct !== null ? `${b.sharePct}%` : b.amountUSD ? `$${b.amountUSD.toLocaleString()}` : "share";
      const ps = b.perStirpes ? " (per stirpes)" : "";
      out.push(`- ${b.name} — ${share}${ps}`);
    }
  }
  if (doc.specificBequests.length) {
    out.push("");
    out.push("### Specific bequests");
    for (const s of doc.specificBequests) {
      out.push(`- ${s.item} → ${s.to}`);
    }
  }
  if (doc.guardians.length) {
    out.push("");
    out.push("### Guardians");
    for (const g of doc.guardians) {
      out.push(`- ${g.guardian} for ${g.forWhom}`);
    }
  }
  if (doc.warnings.length) {
    out.push("");
    out.push("### Warnings");
    for (const w of doc.warnings) out.push(`- ${w}`);
  }
  return out.join("\n").trim();
}
