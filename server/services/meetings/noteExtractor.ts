/**
 * Meeting note extractor — pure heuristic transcript parser.
 *
 * Shipped by Pass 3 of the hybrid build loop — first half of
 * PARITY-MEET-0001. Goal: give Stewardly a deterministic, zero-cost,
 * zero-latency baseline for structured note extraction that runs in
 * the same process as the LLM summary pipeline but doesn't require
 * a model call. This is the offline fallback + preview tier that
 * makes the meeting router useful even when LLM credits are out.
 *
 * Everything here is a PURE FUNCTION. No DB, no LLM, no network.
 * Tests run offline. The existing LLM-based
 * `meetings.generateSummary` still runs for deep synthesis — this
 * module just provides the primary action-item / decision / date
 * skeleton that the downstream tooling can merge with the LLM output.
 *
 * Rubric:
 *
 *   - Action items: any line that starts with a canonical bullet
 *     ("- [ ]", "- []", "- ", "* ", "1. ", "1) ", "TODO:", "Action:",
 *     "Follow up:") OR contains a strong action verb phrase ("we will
 *     ...", "I will ...", "let's ...", "need to ...", "has to ...")
 *   - Decisions: lines that start with "Decision:", "Decided:",
 *     "We agreed...", "Consensus:", "Resolved:"
 *   - Concerns: lines with "concerned about", "worried about",
 *     "risk:", "issue:", "problem:", "flag:", or ending in "?" that
 *     mention a known finance-domain term
 *   - Follow-up dates: regex-extracted ISO (2026-04-15), US
 *     (04/15/2026), "next Tuesday", "in 2 weeks", "by EOM",
 *     "by end of quarter", "before tax season"
 *   - Participants: "Present:" or "Attendees:" line OR mentions of
 *     canonical roles ("advisor", "client", "attorney", "CPA") with
 *     names
 *   - Compliance flags: mentions of "recommendation", "advice",
 *     "tax", "guarantee", "promise", "insurance", "securities" —
 *     flagged for downstream FINRA review
 *
 * The extractor is conservative: when in doubt, prefer false
 * negatives over false positives. The downstream LLM summary can
 * catch missed items; incorrectly-inserted action items are harder
 * to retract without confusing the advisor.
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ExtractedActionItem {
  /** The original line after prefix stripping. */
  text: string;
  /** Line number (1-indexed) in the source transcript. */
  line: number;
  /** Priority inferred from signal words. */
  priority: "low" | "medium" | "high";
  /** Assignee guessed from "I will", "advisor will", explicit mention. */
  assignee: string | null;
  /** ISO-formatted due date when a parseable date was found. */
  dueDate: string | null;
  /** Raw due-date phrase (e.g. "by end of quarter") if normalized. */
  dueDateRaw: string | null;
  /** Why the extractor flagged this line (for audit). */
  reason: string;
}

export interface ExtractedDecision {
  text: string;
  line: number;
}

export interface ExtractedConcern {
  text: string;
  line: number;
  category: "risk" | "tax" | "planning" | "compliance" | "general";
}

export interface ExtractedDate {
  phrase: string;
  line: number;
  /** ISO string when resolvable; otherwise null. */
  iso: string | null;
  kind: "absolute" | "relative" | "phrase";
}

export interface ExtractedParticipant {
  role: string | null;
  name: string;
  line: number;
}

export interface ComplianceFlag {
  line: number;
  text: string;
  trigger: string;
  severity: "info" | "warn" | "block";
}

export interface ExtractedNotes {
  actionItems: ExtractedActionItem[];
  decisions: ExtractedDecision[];
  concerns: ExtractedConcern[];
  dates: ExtractedDate[];
  participants: ExtractedParticipant[];
  complianceFlags: ComplianceFlag[];
  /** Total characters of the source transcript. */
  transcriptLength: number;
  /** Total lines (non-empty) analyzed. */
  analyzedLines: number;
  /** Warnings from the extractor (e.g. "transcript too short"). */
  warnings: string[];
}

// ─── Constants ─────────────────────────────────────────────────────────────

const ACTION_BULLET_RE = /^\s*(?:[-*]\s*\[\s*[x ]?\s*\]|[-*]|\d+[.)])\s+(.+)$/i;
const ACTION_LABEL_RE = /^\s*(?:todo|action item|action|follow\s?up|next step|task):\s*(.+)$/i;
const ACTION_VERB_RE =
  /\b(?:i will|we will|i'll|we'll|i am going to|we are going to|let's|lets|we need to|i need to|need to|has to|have to|must|should)\b\s+(.+)$/i;

const DECISION_RE =
  /^\s*(?:decision|decided|resolved|consensus|we agreed(?: that)?|we have agreed|agreement):\s*(.+)$/i;
const DECISION_INLINE_RE = /\b(?:we decided|we agreed|decision made|it was decided)\b\s*(?:that\s+)?(.+)$/i;

const CONCERN_LABEL_RE = /^\s*(?:concern|issue|problem|flag|risk|worry):\s*(.+)$/i;
const CONCERN_PHRASE_RE = /\b(?:concerned about|worried about|nervous about|anxious about|afraid of|risk of|risk with)\b\s+(.+)$/i;

const DATE_ISO_RE = /\b(\d{4})-(\d{2})-(\d{2})\b/;
const DATE_US_RE = /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/;
const DATE_WORD_RE =
  /\b(?:by\s+)?(?:next\s+(?:week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(?:end of|eo)\s+(?:day|week|month|quarter|year|q[1-4])|(?:in\s+)?\d+\s+(?:days?|weeks?|months?|quarters?))\b/i;

const PARTICIPANT_LABEL_RE = /^\s*(?:present|attendees|participants):\s*(.+)$/i;
// Explicit case-sensitive uppercase letter ranges so the `i` flag doesn't
// fold them. We need case-insensitive matching on the role word but case-
// SENSITIVE matching on the name so "began" can't be captured as a surname.
const ROLE_NAME_RE =
  /(?:[Aa]dvisor|[Cc]lient|[Ss]pouse|[Aa]ttorney|[Cc]pa|CPA|[Aa]ccountant|[Pp]lanner|[Mm]anager)\b[:\s,]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g;

const COMPLIANCE_TRIGGERS = [
  { re: /\b(?:guarantee[ds]?|promised?|guaranteed return)\b/i, severity: "block" as const, trigger: "guarantee" },
  { re: /\b(?:insider|non-public information|material non-public)\b/i, severity: "block" as const, trigger: "insider" },
  { re: /\b(?:recommend|recommendation|i advise|i suggest you)\b/i, severity: "warn" as const, trigger: "recommendation" },
  { re: /\b(?:specific security|buy [A-Z]{2,5}|sell [A-Z]{2,5})\b/, severity: "warn" as const, trigger: "security_specific" },
  { re: /\b(?:tax advice|tax strategy|tax shelter)\b/i, severity: "warn" as const, trigger: "tax_advice" },
  { re: /\b(?:insurance|life insurance|annuity|policy)\b/i, severity: "info" as const, trigger: "insurance" },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

function normalizeLine(line: string): string {
  return line.trim();
}

function nonEmptyLines(transcript: string): string[] {
  return transcript.split(/\r?\n/).map(normalizeLine).filter((l) => l.length > 0);
}

function inferPriority(text: string): "low" | "medium" | "high" {
  const t = text.toLowerCase();
  if (/\b(urgent|asap|critical|immediately|today|emergency)\b/.test(t)) return "high";
  if (/\b(soon|this week|by friday|priority)\b/.test(t)) return "high";
  if (/\b(when you get a chance|eventually|nice to have|low priority)\b/.test(t)) return "low";
  return "medium";
}

function inferAssignee(text: string): string | null {
  // "I will", "we will" → null (ambiguous, caller decides)
  const direct = text.match(/\b(advisor|client|cpa|attorney|planner|manager)\b\s+will/i);
  if (direct) return direct[1].toLowerCase();
  const namedWill = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+will\b/);
  if (namedWill) return namedWill[1];
  return null;
}

/** Parse a date phrase into an ISO string relative to `today` when resolvable. */
export function parseDatePhrase(phrase: string, today: Date = new Date()): string | null {
  const iso = phrase.match(DATE_ISO_RE);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const us = phrase.match(DATE_US_RE);
  if (us) {
    let [, mm, dd, yy] = us;
    let year = parseInt(yy, 10);
    if (year < 100) year += 2000;
    const m = parseInt(mm, 10);
    const d = parseInt(dd, 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  const lower = phrase.toLowerCase();
  const base = new Date(today.getTime());
  base.setHours(0, 0, 0, 0);

  if (/\bin (\d+) day/.test(lower)) {
    const n = parseInt(lower.match(/in (\d+) day/)![1], 10);
    base.setDate(base.getDate() + n);
    return base.toISOString().slice(0, 10);
  }
  if (/\bin (\d+) week/.test(lower)) {
    const n = parseInt(lower.match(/in (\d+) week/)![1], 10);
    base.setDate(base.getDate() + n * 7);
    return base.toISOString().slice(0, 10);
  }
  if (/\bin (\d+) month/.test(lower)) {
    const n = parseInt(lower.match(/in (\d+) month/)![1], 10);
    base.setMonth(base.getMonth() + n);
    return base.toISOString().slice(0, 10);
  }
  if (/\bnext week\b/.test(lower)) {
    base.setDate(base.getDate() + 7);
    return base.toISOString().slice(0, 10);
  }
  if (/\bnext month\b/.test(lower)) {
    base.setMonth(base.getMonth() + 1);
    return base.toISOString().slice(0, 10);
  }
  // Relative phrases we don't resolve → return null but caller keeps the raw phrase.
  return null;
}

function categorizeConcern(text: string): ExtractedConcern["category"] {
  const lower = text.toLowerCase();
  if (/\b(market|volatility|sequence of returns|crash|downturn|recession)\b/.test(lower))
    return "risk";
  if (/\b(tax|irs|capital gains|1040)\b/.test(lower)) return "tax";
  if (/\b(retirement|savings|goal|plan)\b/.test(lower)) return "planning";
  if (/\b(finra|sec|compliance|regulation|regulatory|fiduciary)\b/.test(lower))
    return "compliance";
  return "general";
}

// ─── Main extractor ────────────────────────────────────────────────────────

export function extractNotes(
  transcript: string,
  today: Date = new Date(),
): ExtractedNotes {
  const warnings: string[] = [];
  const notes: ExtractedNotes = {
    actionItems: [],
    decisions: [],
    concerns: [],
    dates: [],
    participants: [],
    complianceFlags: [],
    transcriptLength: transcript.length,
    analyzedLines: 0,
    warnings,
  };

  if (!transcript || transcript.trim().length === 0) {
    warnings.push("Empty transcript.");
    return notes;
  }
  if (transcript.length < 40) {
    warnings.push("Transcript is very short (<40 chars) — coverage will be low.");
  }

  const lines = nonEmptyLines(transcript);
  notes.analyzedLines = lines.length;

  lines.forEach((line, idx) => {
    const lineNo = idx + 1;

    // ── Participants
    const partMatch = line.match(PARTICIPANT_LABEL_RE);
    if (partMatch) {
      const names = partMatch[1].split(/,|;|\sand\s/).map((s) => s.trim()).filter(Boolean);
      for (const raw of names) {
        const [name, role] = raw.split(/\s*[-(]\s*/);
        notes.participants.push({
          role: role ? role.replace(/\)$/, "").toLowerCase() : null,
          name: (name ?? raw).trim(),
          line: lineNo,
        });
      }
    } else {
      // Inline role-name mentions — "Advisor: Jane Smith", "CPA: Dr Jones"
      // Role word is parsed case-insensitively from the matched text; the
      // regex itself uses explicit [Aa] classes so name capture stays case-
      // sensitive (prevents "began" from being treated as a surname).
      let m: RegExpExecArray | null;
      const re = new RegExp(ROLE_NAME_RE.source, "g");
      while ((m = re.exec(line)) !== null) {
        const whole = m[0];
        const roleWord = whole.split(/[:\s,]/)[0];
        notes.participants.push({
          role: roleWord.toLowerCase(),
          name: m[1],
          line: lineNo,
        });
      }
    }

    // ── Dates (collect ALL, even on non-action lines)
    const isoM = line.match(DATE_ISO_RE);
    if (isoM) {
      notes.dates.push({
        phrase: isoM[0],
        line: lineNo,
        iso: parseDatePhrase(isoM[0], today),
        kind: "absolute",
      });
    }
    const usM = line.match(DATE_US_RE);
    if (usM) {
      notes.dates.push({
        phrase: usM[0],
        line: lineNo,
        iso: parseDatePhrase(usM[0], today),
        kind: "absolute",
      });
    }
    const wordM = line.match(DATE_WORD_RE);
    if (wordM) {
      notes.dates.push({
        phrase: wordM[0],
        line: lineNo,
        iso: parseDatePhrase(wordM[0], today),
        kind: "relative",
      });
    }

    // ── Compliance flags
    for (const rule of COMPLIANCE_TRIGGERS) {
      if (rule.re.test(line)) {
        notes.complianceFlags.push({
          line: lineNo,
          text: line,
          trigger: rule.trigger,
          severity: rule.severity,
        });
      }
    }

    // ── Decisions (check before action items — "we decided to X" would also
    // match an action verb phrase, but it's a decision, not a todo)
    const decLabelM = line.match(DECISION_RE);
    if (decLabelM) {
      notes.decisions.push({ text: decLabelM[1].trim(), line: lineNo });
      return;
    }
    const decInlineM = line.match(DECISION_INLINE_RE);
    if (decInlineM) {
      notes.decisions.push({ text: decInlineM[1].trim(), line: lineNo });
      return;
    }

    // ── Concerns
    const concernLabelM = line.match(CONCERN_LABEL_RE);
    if (concernLabelM) {
      const text = concernLabelM[1].trim();
      notes.concerns.push({
        text,
        line: lineNo,
        category: categorizeConcern(text),
      });
      return;
    }
    const concernPhraseM = line.match(CONCERN_PHRASE_RE);
    if (concernPhraseM) {
      const text = concernPhraseM[1].trim();
      notes.concerns.push({
        text,
        line: lineNo,
        category: categorizeConcern(text),
      });
      return;
    }

    // ── Action items
    let actionText: string | null = null;
    let reason = "";
    const bulletM = line.match(ACTION_BULLET_RE);
    if (bulletM) {
      actionText = bulletM[1].trim();
      reason = "bullet-list";
    } else {
      const labelM = line.match(ACTION_LABEL_RE);
      if (labelM) {
        actionText = labelM[1].trim();
        reason = "labeled";
      } else {
        const verbM = line.match(ACTION_VERB_RE);
        if (verbM) {
          actionText = verbM[0].replace(/^\s*/, "").trim();
          reason = "verb-phrase";
        }
      }
    }
    if (actionText && actionText.length > 3) {
      // Find a date phrase inside the action for the dueDate field.
      const datePhrase =
        actionText.match(DATE_ISO_RE)?.[0] ??
        actionText.match(DATE_US_RE)?.[0] ??
        actionText.match(DATE_WORD_RE)?.[0] ??
        null;
      const iso = datePhrase ? parseDatePhrase(datePhrase, today) : null;
      notes.actionItems.push({
        text: actionText,
        line: lineNo,
        priority: inferPriority(actionText),
        assignee: inferAssignee(actionText),
        dueDate: iso,
        dueDateRaw: datePhrase,
        reason,
      });
    }
  });

  // Dedup participants by name+line — guards against the same participant
  // appearing twice when "Present: ..." and inline mentions both match.
  const seen = new Set<string>();
  notes.participants = notes.participants.filter((p) => {
    const k = `${p.name.toLowerCase()}|${p.line}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return notes;
}

/**
 * Produce a terse markdown summary from extracted notes. Useful when
 * the caller wants a single string to paste into a meeting record.
 */
export function renderNotesMarkdown(notes: ExtractedNotes): string {
  const lines: string[] = [];
  if (notes.participants.length) {
    lines.push("## Attendees");
    for (const p of notes.participants) {
      lines.push(`- ${p.name}${p.role ? ` (${p.role})` : ""}`);
    }
    lines.push("");
  }
  if (notes.actionItems.length) {
    lines.push("## Action items");
    for (const a of notes.actionItems) {
      const due = a.dueDate ? ` — due ${a.dueDate}` : a.dueDateRaw ? ` — ${a.dueDateRaw}` : "";
      const owner = a.assignee ? ` — ${a.assignee}` : "";
      lines.push(`- [ ] ${a.text}${owner}${due}`);
    }
    lines.push("");
  }
  if (notes.decisions.length) {
    lines.push("## Decisions");
    for (const d of notes.decisions) lines.push(`- ${d.text}`);
    lines.push("");
  }
  if (notes.concerns.length) {
    lines.push("## Concerns");
    for (const c of notes.concerns) lines.push(`- [${c.category}] ${c.text}`);
    lines.push("");
  }
  if (notes.complianceFlags.length) {
    lines.push("## Compliance flags");
    for (const f of notes.complianceFlags) {
      lines.push(`- [${f.severity}] ${f.trigger}: ${f.text}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}
