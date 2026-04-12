import { describe, it, expect, vi } from "vitest";
import { executeBlueprintTool, BLUEPRINT_TOOL_NAMES } from "./agentTools";

// aiBlueprintDrafter calls contextualLLM — stub it so the test doesn't require
// a deployed LLM. The fallback draft still gets produced.
vi.mock("../../shared/stewardlyWiring", () => ({
  contextualLLM: async () => ({ choices: [] }),
}));

describe("BLUEPRINT_TOOL_NAMES", () => {
  it("lists every public blueprint tool name", () => {
    expect(BLUEPRINT_TOOL_NAMES.has("blueprint_probe")).toBe(true);
    expect(BLUEPRINT_TOOL_NAMES.has("blueprint_draft")).toBe(true);
    expect(BLUEPRINT_TOOL_NAMES.has("blueprint_list")).toBe(true);
    expect(BLUEPRINT_TOOL_NAMES.has("blueprint_run")).toBe(true);
    expect(BLUEPRINT_TOOL_NAMES.size).toBe(4);
  });
});

const ctx = { userId: 1, role: "advisor" };

describe("executeBlueprintTool — probe", () => {
  it("errors when both url and inlineSample are missing", async () => {
    const out = await executeBlueprintTool("blueprint_probe", {}, ctx);
    const parsed = JSON.parse(out);
    expect(parsed.error).toMatch(/requires url or inlineSample/);
  });

  it("probes an inline JSON sample", async () => {
    const out = await executeBlueprintTool(
      "blueprint_probe",
      { inlineSample: '{"data":[{"id":1,"name":"a"},{"id":2,"name":"b"}]}' },
      ctx,
    );
    const parsed = JSON.parse(out);
    expect(parsed.format).toBe("json");
    expect(parsed.recordCount).toBe(2);
    expect(Array.isArray(parsed.sample)).toBe(true);
    expect(parsed.schemaPreview.fields.length).toBe(2);
  });

  it("probes an inline CSV sample", async () => {
    const out = await executeBlueprintTool(
      "blueprint_probe",
      { inlineSample: "name,age\nAlice,30\nBob,25" },
      ctx,
    );
    const parsed = JSON.parse(out);
    expect(parsed.format).toBe("csv");
    expect(parsed.recordCount).toBe(2);
  });
});

describe("executeBlueprintTool — draft", () => {
  it("errors on missing description", async () => {
    const out = await executeBlueprintTool("blueprint_draft", {}, ctx);
    const parsed = JSON.parse(out);
    expect(parsed.error).toMatch(/requires a description/);
  });

  it("produces a fallback draft from inline sample", async () => {
    const out = await executeBlueprintTool(
      "blueprint_draft",
      {
        description: "Import a daily JSON feed of entities into ingested_records",
        inlineSample: '{"data":[{"id":1,"title":"Hello"}]}',
        preferSink: "ingested_records",
      },
      ctx,
    );
    const parsed = JSON.parse(out);
    expect(parsed.draft).toBeDefined();
    expect(parsed.draft.sinkConfig?.kind).toBe("ingested_records");
    expect(parsed.detectedFormat).toBe("json");
  });
});

describe("executeBlueprintTool — unknown tool", () => {
  it("returns an error on unknown tool name", async () => {
    const out = await executeBlueprintTool("blueprint_bogus", {}, ctx);
    const parsed = JSON.parse(out);
    expect(parsed.error).toMatch(/Unknown blueprint tool/);
  });
});
