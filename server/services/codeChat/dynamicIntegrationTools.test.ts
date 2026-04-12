/**
 * Tests for Pass 7 — dynamic integrations exposed as Code Chat tools.
 * Verifies dispatchCodeTool correctly routes the four new tool names
 * (infer_schema, generate_adapter, detect_schema_drift, map_to_crm_contact)
 * through to the dynamicIntegrations service modules.
 */

import { describe, it, expect } from "vitest";
import { dispatchCodeTool } from "./codeChatExecutor";

const SANDBOX = {
  workspaceRoot: process.cwd(),
  allowMutations: false,
};

describe("dispatchCodeTool — infer_schema", () => {
  it("returns schema_inference kind with primary key + field count", async () => {
    const result = await dispatchCodeTool(
      {
        name: "infer_schema",
        args: {
          records: [
            { id: "u1", email: "a@x.com", name: "Alice" },
            { id: "u2", email: "b@y.com", name: "Bob" },
          ],
        },
      },
      SANDBOX,
    );
    expect(result.kind).toBe("schema_inference");
    if (result.kind === "schema_inference") {
      expect(result.result.fieldCount).toBe(3);
      expect(result.result.primaryKey).toBe("id");
      expect(result.result.confidence).toBeGreaterThan(0.5);
    }
  });

  it("returns BAD_ARGS error when records is missing", async () => {
    const result = await dispatchCodeTool(
      { name: "infer_schema", args: {} },
      SANDBOX,
    );
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.code).toBe("BAD_ARGS");
    }
  });

  it("ignores non-object entries in records array", async () => {
    const result = await dispatchCodeTool(
      {
        name: "infer_schema",
        args: {
          records: [
            { id: 1, name: "A" },
            null,
            "string",
            42,
            { id: 2, name: "B" },
          ],
        },
      },
      SANDBOX,
    );
    expect(result.kind).toBe("schema_inference");
    if (result.kind === "schema_inference") {
      expect(result.result.fieldCount).toBe(2);
    }
  });
});

describe("dispatchCodeTool — generate_adapter", () => {
  it("returns adapter_spec kind with summary", async () => {
    const result = await dispatchCodeTool(
      {
        name: "generate_adapter",
        args: {
          records: [
            { id: "u1", email: "a@x.com" },
            { id: "u2", email: "b@y.com" },
          ],
          name: "TestApi",
          baseUrl: "https://api.example.com",
          authType: "bearer",
          listEndpoint: "/users",
        },
      },
      SANDBOX,
    );
    expect(result.kind).toBe("adapter_spec");
    if (result.kind === "adapter_spec") {
      expect(result.result.summary).toContain("TestApi");
      expect(result.result.summary).toContain("auth=bearer");
      expect(result.result.ready).toBe(true);
    }
  });

  it("returns ready=false without baseUrl", async () => {
    const result = await dispatchCodeTool(
      {
        name: "generate_adapter",
        args: {
          records: [
            { id: "u1", email: "a@x.com" },
            { id: "u2", email: "b@y.com" },
          ],
          name: "NoBase",
        },
      },
      SANDBOX,
    );
    expect(result.kind).toBe("adapter_spec");
    if (result.kind === "adapter_spec") {
      expect(result.result.ready).toBe(false);
    }
  });
});

describe("dispatchCodeTool — detect_schema_drift", () => {
  it("returns schema_drift kind with summary", async () => {
    const result = await dispatchCodeTool(
      {
        name: "detect_schema_drift",
        args: {
          baselineRecords: [
            { id: 1, name: "A" },
            { id: 2, name: "B" },
          ],
          currentRecords: [
            { id: 1, name: "A", email: "a@x.com" },
            { id: 2, name: "B", email: "b@y.com" },
          ],
        },
      },
      SANDBOX,
    );
    expect(result.kind).toBe("schema_drift");
    if (result.kind === "schema_drift") {
      expect(result.result.compatible).toBe(true);
      expect(result.result.warning).toBeGreaterThanOrEqual(1);
    }
  });

  it("returns BAD_ARGS when either side is empty", async () => {
    const result = await dispatchCodeTool(
      {
        name: "detect_schema_drift",
        args: { baselineRecords: [], currentRecords: [{ id: 1 }] },
      },
      SANDBOX,
    );
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.code).toBe("BAD_ARGS");
    }
  });
});

describe("dispatchCodeTool — map_to_crm_contact", () => {
  it("returns crm_mapping kind with match count", async () => {
    const result = await dispatchCodeTool(
      {
        name: "map_to_crm_contact",
        args: {
          records: [
            { id: "u1", email_address: "a@x.com", first_name: "Alice", phone_number: "+1 415-555-1234" },
            { id: "u2", email_address: "b@y.com", first_name: "Bob", phone_number: "+1 212-555-5678" },
          ],
        },
      },
      SANDBOX,
    );
    expect(result.kind).toBe("crm_mapping");
    if (result.kind === "crm_mapping") {
      expect(result.result.entityType).toBe("contact");
      expect(result.result.matchedCount).toBeGreaterThanOrEqual(3);
    }
  });

  it("returns BAD_ARGS when records is missing", async () => {
    const result = await dispatchCodeTool(
      { name: "map_to_crm_contact", args: {} },
      SANDBOX,
    );
    expect(result.kind).toBe("error");
  });
});
