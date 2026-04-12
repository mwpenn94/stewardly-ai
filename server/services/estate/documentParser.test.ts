/**
 * Unit tests for the pure estate document parser.
 * Pass 7 of the hybrid build loop — PARITY-ESTATE-0001.
 */
import { describe, it, expect } from "vitest";
import {
  parseEstateDocument,
  renderEstateMarkdown,
} from "./documentParser";

// ─── Document kind detection ──────────────────────────────────────────────

describe("estate/documentParser — kind detection", () => {
  it("detects a will", () => {
    const doc = parseEstateDocument("LAST WILL AND TESTAMENT of John Doe");
    expect(doc.kind).toBe("will");
  });
  it("detects a trust", () => {
    const doc = parseEstateDocument(
      "DECLARATION OF TRUST — The John Doe Revocable Trust",
    );
    expect(doc.kind).toBe("trust");
  });
  it("detects a codicil", () => {
    const doc = parseEstateDocument("CODICIL to the Last Will of Jane Doe");
    expect(doc.kind).toBe("codicil");
  });
  it("falls back to unknown", () => {
    const doc = parseEstateDocument("Some random legal text.");
    expect(doc.kind).toBe("unknown");
  });
});

// ─── Trust kind ──────────────────────────────────────────────────────────

describe("estate/documentParser — trust kind", () => {
  it("detects irrevocable trust", () => {
    const doc = parseEstateDocument(
      "THE SMITH IRREVOCABLE LIFE INSURANCE TRUST\nDECLARATION OF TRUST\n",
    );
    expect(doc.trustKind).toBe("irrevocable");
  });
  it("detects revocable trust", () => {
    const doc = parseEstateDocument(
      "DECLARATION OF TRUST — The Smith Revocable Living Trust",
    );
    expect(doc.trustKind).toBe("revocable");
  });
  it("returns unknown when not a trust document", () => {
    const doc = parseEstateDocument("LAST WILL AND TESTAMENT of John Doe");
    expect(doc.trustKind).toBe("unknown");
  });
});

// ─── Governing state ──────────────────────────────────────────────────────

describe("estate/documentParser — governing state", () => {
  it("detects 'laws of the State of X'", () => {
    const doc = parseEstateDocument(
      "LAST WILL AND TESTAMENT of John Doe\nThis will shall be governed by the laws of the State of California.",
    );
    expect(doc.governingState).toBe("California");
  });
  it("detects 'pursuant to the laws of Texas'", () => {
    const doc = parseEstateDocument(
      "LAST WILL AND TESTAMENT of Jane Doe\nPursuant to the laws of Texas.",
    );
    expect(doc.governingState).toBe("Texas");
  });
  it("falls back to header state mention", () => {
    const doc = parseEstateDocument(
      "LAST WILL AND TESTAMENT of Jane Doe\nState of New York\n",
    );
    expect(doc.governingState).toBe("New York");
  });
  it("returns null when no state is mentioned", () => {
    const doc = parseEstateDocument("LAST WILL AND TESTAMENT of John Doe");
    expect(doc.governingState).toBeNull();
    expect(doc.warnings.some((w) => /Governing state/i.test(w))).toBe(true);
  });
});

// ─── Testators ────────────────────────────────────────────────────────────

describe("estate/documentParser — testators", () => {
  it("catches 'I, Name, being of sound mind'", () => {
    const doc = parseEstateDocument(
      "LAST WILL AND TESTAMENT\nI, John Michael Doe, being of sound mind, declare this to be my Will.",
    );
    expect(doc.testators.length).toBeGreaterThan(0);
    expect(doc.testators[0].name).toContain("John Michael Doe");
  });
  it("catches 'LAST WILL AND TESTAMENT OF Name'", () => {
    const doc = parseEstateDocument("LAST WILL AND TESTAMENT of Jane Marie Doe");
    expect(doc.testators.length).toBeGreaterThan(0);
    expect(doc.testators[0].name).toContain("Jane");
  });
});

// ─── Executors ────────────────────────────────────────────────────────────

describe("estate/documentParser — executors", () => {
  it("catches 'I nominate Name as Executor'", () => {
    const doc = parseEstateDocument(
      "LAST WILL AND TESTAMENT of John Doe\nI nominate Jane Doe as Executor of this Will.",
    );
    expect(doc.executors.some((e) => e.name === "Jane Doe")).toBe(true);
  });
  it("catches successor executor", () => {
    const doc = parseEstateDocument(
      "LAST WILL AND TESTAMENT of John Doe\nI appoint Jane Doe as Executor.\nSuccessor Executor shall be Robert Doe.",
    );
    expect(doc.executors.some((e) => e.role === "successor_executor")).toBe(true);
  });
  it("warns on will with no executor", () => {
    const doc = parseEstateDocument(
      "LAST WILL AND TESTAMENT of John Doe\nI leave $100 to the dog.",
    );
    expect(doc.warnings.some((w) => /no executor/i.test(w))).toBe(true);
  });
});

// ─── Trustees ─────────────────────────────────────────────────────────────

describe("estate/documentParser — trustees", () => {
  it("catches 'I nominate Name as Trustee'", () => {
    const doc = parseEstateDocument(
      "DECLARATION OF TRUST — The Smith Revocable Trust\nI nominate Jane Smith as Trustee of this trust.",
    );
    expect(doc.trustees.some((t) => t.name === "Jane Smith")).toBe(true);
  });
  it("catches successor trustee", () => {
    const doc = parseEstateDocument(
      "DECLARATION OF TRUST — The Smith Revocable Trust\nI appoint Jane Smith as Trustee.\nSuccessor Trustee shall be Robert Smith.",
    );
    expect(doc.trustees.some((t) => t.role === "successor_trustee")).toBe(true);
  });
  it("warns on trust with no trustee", () => {
    const doc = parseEstateDocument(
      "DECLARATION OF TRUST — The Smith Trust\nMy assets shall be held for the benefit of my children.",
    );
    expect(doc.warnings.some((w) => /no trustee/i.test(w))).toBe(true);
  });
});

// ─── Beneficiaries ────────────────────────────────────────────────────────

describe("estate/documentParser — beneficiaries", () => {
  it("catches dollar bequest", () => {
    const doc = parseEstateDocument(
      "LAST WILL AND TESTAMENT of John Doe\nI nominate Jane Doe as Executor.\nI give the sum of $10,000 to my niece Sarah Doe.",
    );
    const sarah = doc.beneficiaries.find((b) => b.name.includes("Sarah"));
    expect(sarah).toBeDefined();
    expect(sarah?.amountUSD).toBe(10000);
    expect(sarah?.specific).toBe(true);
  });

  it("catches percentage bequest", () => {
    const doc = parseEstateDocument(
      "LAST WILL AND TESTAMENT of John Doe\nI appoint Jane Doe as Executor.\nI give 25% of my estate to my son Tom Doe.",
    );
    const tom = doc.beneficiaries.find((b) => b.name.includes("Tom"));
    expect(tom?.sharePct).toBe(25);
  });

  it("detects per stirpes annotation", () => {
    const doc = parseEstateDocument(
      "LAST WILL AND TESTAMENT of John Doe\nI nominate Jane Doe as Executor.\nI give 50% of my estate to my son Tom Doe, per stirpes.",
    );
    const tom = doc.beneficiaries.find((b) => b.name.includes("Tom"));
    expect(tom?.perStirpes).toBe(true);
    expect(doc.perStirpesReference).toBe(true);
  });

  it("warns when total pct > 100%", () => {
    const doc = parseEstateDocument(
      "LAST WILL AND TESTAMENT of John Doe\nI nominate Jane Doe as Executor.\nI give 60% of my estate to Tom Doe.\nI give 50% of my estate to Sarah Doe.",
    );
    expect(doc.warnings.some((w) => /exceeds 100%/i.test(w))).toBe(true);
  });

  it("detects residuary language", () => {
    const doc = parseEstateDocument(
      "LAST WILL AND TESTAMENT of John Doe\nI appoint Jane Doe as Executor.\nI give the rest, residue and remainder of my estate to my spouse.",
    );
    expect(doc.residuaryReference).toBe(true);
  });
});

// ─── Specific bequests ────────────────────────────────────────────────────

describe("estate/documentParser — specific bequests", () => {
  it("catches 'I give my antique watch to'", () => {
    const doc = parseEstateDocument(
      "LAST WILL AND TESTAMENT of John Doe\nI appoint Jane Doe as Executor.\nI give my antique watch to my grandson Alex.",
    );
    expect(doc.specificBequests.length).toBeGreaterThan(0);
    expect(doc.specificBequests[0].item).toMatch(/antique watch/);
  });
});

// ─── Guardians ────────────────────────────────────────────────────────────

describe("estate/documentParser — guardians", () => {
  it("catches guardian nomination", () => {
    const doc = parseEstateDocument(
      "LAST WILL AND TESTAMENT of John Doe\nI nominate Jane Doe as Executor.\nI nominate my sister Sarah Smith as Guardian of my minor children.",
    );
    expect(doc.guardians.length).toBeGreaterThan(0);
    const g = doc.guardians[0];
    expect(g.guardian).toContain("Sarah");
  });
});

// ─── Defensive handling ──────────────────────────────────────────────────

describe("estate/documentParser — defensive handling", () => {
  it("returns empty output on empty input", () => {
    const doc = parseEstateDocument("");
    expect(doc.kind).toBe("unknown");
    expect(doc.warnings.some((w) => /Empty/i.test(w))).toBe(true);
  });

  it("warns on short documents", () => {
    const doc = parseEstateDocument("Short.");
    expect(doc.warnings.some((w) => /short/i.test(w))).toBe(true);
  });

  it("handles null-safely — returns empty parse on whitespace-only input", () => {
    const doc = parseEstateDocument("   \n\n   ");
    expect(doc.analyzedLines).toBe(0);
  });
});

// ─── renderEstateMarkdown ────────────────────────────────────────────────

describe("estate/documentParser — renderEstateMarkdown", () => {
  it("emits sections only when populated", () => {
    const doc = parseEstateDocument(
      "LAST WILL AND TESTAMENT of John Doe\nI nominate Jane Doe as Executor.",
    );
    const md = renderEstateMarkdown(doc);
    expect(md).toMatch(/## WILL/i);
    expect(md).toMatch(/### Executors/);
    expect(md).not.toMatch(/### Guardians/);
  });

  it("includes warnings section when present", () => {
    const doc = parseEstateDocument("LAST WILL AND TESTAMENT of John Doe");
    const md = renderEstateMarkdown(doc);
    expect(md).toMatch(/### Warnings/);
  });
});

// ─── End-to-end realistic will ───────────────────────────────────────────

describe("estate/documentParser — realistic will", () => {
  const WILL = `LAST WILL AND TESTAMENT OF JOHN MICHAEL DOE

I, John Michael Doe, being of sound mind and memory, do hereby declare this to be my Last Will and Testament.

This will shall be governed by the laws of the State of California.

FIRST: I hereby nominate Jane Marie Doe as Executor of this Will. Successor Executor shall be Robert James Doe.

SECOND: I give the sum of $25,000 to my niece Sarah Lynn Doe.

THIRD: I give 50% of my estate to my daughter Emily Rose Doe, per stirpes.

FOURTH: I give 50% of my estate to my son Michael James Doe, per stirpes.

FIFTH: I give my antique Patek Philippe watch to my grandson Alexander Doe.

SIXTH: I nominate my sister Susan Elizabeth Doe as Guardian of my minor children.

SEVENTH: The rest, residue and remainder of my estate shall pass to my spouse.
`;

  it("extracts everything", () => {
    const doc = parseEstateDocument(WILL);
    expect(doc.kind).toBe("will");
    expect(doc.governingState).toBe("California");
    expect(doc.testators.length).toBeGreaterThan(0);
    expect(doc.executors.length).toBeGreaterThanOrEqual(2); // primary + successor
    expect(doc.beneficiaries.length).toBeGreaterThanOrEqual(3);
    expect(doc.perStirpesReference).toBe(true);
    expect(doc.residuaryReference).toBe(true);
    expect(doc.specificBequests.length).toBeGreaterThan(0);
    expect(doc.guardians.length).toBeGreaterThan(0);
    // Total pct should be exactly 100 (two 50% bequests)
    expect(doc.totalBeneficiaryPct).toBe(100);
  });
});
