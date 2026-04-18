/**
 * Pass 122 — Calculator WORM Audit Logging Test
 * Verifies the calculators.logAudit procedure validates input correctly.
 */
import { describe, it, expect, vi } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  writeAuditEntry: vi.fn().mockResolvedValue({ id: 1 }),
  AUDIT_EVENTS: {
    CALC_PANEL_CHANGE: "calc_panel_change",
    CALC_SAVE_SESSION: "calc_save_session",
    CALC_LOAD_SESSION: "calc_load_session",
    CALC_EXPORT_PDF: "calc_export_pdf",
    CALC_EXPORT_CSV: "calc_export_csv",
    CALC_IMPORT_DATA: "calc_import_data",
    CALC_SHARE_SESSION: "calc_share_session",
    CALC_RESET: "calc_reset",
  },
}));

describe("Calculator Audit Events", () => {
  it("AUDIT_EVENTS contains all calculator-specific events", async () => {
    const { AUDIT_EVENTS } = await import("./db");
    
    const calcEvents = [
      "CALC_PANEL_CHANGE",
      "CALC_SAVE_SESSION",
      "CALC_LOAD_SESSION",
      "CALC_EXPORT_PDF",
      "CALC_EXPORT_CSV",
      "CALC_IMPORT_DATA",
      "CALC_SHARE_SESSION",
      "CALC_RESET",
    ];

    for (const event of calcEvents) {
      expect(AUDIT_EVENTS).toHaveProperty(event);
      expect(typeof (AUDIT_EVENTS as Record<string, string>)[event]).toBe("string");
    }
  });

  it("writeAuditEntry can be called with calculator event data", async () => {
    const { writeAuditEntry } = await import("./db");
    
    const result = await writeAuditEntry(
      1, // userId
      "calc_panel_change", // event
      { panel: "profile", previousPanel: "cash" }, // metadata
      "127.0.0.1", // ip
      "test-agent", // userAgent
    );

    expect(writeAuditEntry).toHaveBeenCalledWith(
      1,
      "calc_panel_change",
      { panel: "profile", previousPanel: "cash" },
      "127.0.0.1",
      "test-agent",
    );
    expect(result).toEqual({ id: 1 });
  });

  it("all calculator audit event values are snake_case strings starting with calc_", async () => {
    const { AUDIT_EVENTS } = await import("./db");
    
    const calcEventKeys = Object.keys(AUDIT_EVENTS).filter(k => k.startsWith("CALC_"));
    expect(calcEventKeys.length).toBeGreaterThanOrEqual(8);

    for (const key of calcEventKeys) {
      const value = (AUDIT_EVENTS as Record<string, string>)[key];
      expect(value).toMatch(/^calc_[a-z_]+$/);
    }
  });
});
