/**
 * workflow_instances persistence test — pass 61.
 *
 * Before pass 61 the Workflows.tsx page stored in-progress workflows
 * in `localStorage`, so a browser refresh / cache clear / cross-device
 * switch wiped 30-minute FINRA registration runs. Pass 61 added:
 *   1. `workflow_instances` table (migration 0011)
 *   2. `workflow.listInstances` + `saveInstance` + `deleteInstance`
 *      tRPC procedures in `server/routers/workflow.ts`
 *   3. Wired Workflows.tsx to fire persistInstance() on every edit
 *      while keeping localStorage as an offline cache
 *
 * This test exercises the new procedures at the router/service level
 * by asserting:
 *   - The `workflowInstances` drizzle table is defined with the
 *     expected columns (schema contract)
 *   - The `workflowRouter` exports the three new procedures
 *     (integration sanity — catches deletion regressions)
 *   - The input zod schemas accept the Workflows.tsx template IDs
 *     (finra_registration, state_insurance, eo_insurance,
 *     client_onboarding, prospect_qualification) — the old
 *     `workflow_checklist` enum rejected all five of these
 *
 * We don't spin up a full tRPC context — we import the router object
 * and assert its shape, which is enough to regression-guard against
 * accidental removal or enum-narrowing of the new procedures.
 */
import { describe, it, expect } from "vitest";
import { workflowInstances } from "../drizzle/schema";
import { workflowRouter } from "./routers/workflow";

describe("workflow_instances persistence (pass 61)", () => {
  it("exports the workflowInstances drizzle table with the expected columns", () => {
    // Drizzle mysqlTable exposes columns via a Symbol — we use the
    // public-ish $inferSelect shape via runtime column inspection.
    // The easiest stable assertion is that the table object has a
    // `userId`, `templateId`, `stateJson`, and `status` column.
    const table = workflowInstances as any;
    expect(table).toBeTruthy();
    // Drizzle column keys are available via table[Symbol.for("drizzle:Columns")]
    // or simpler: the table proxy exposes the columns as own props.
    expect(table.userId).toBeTruthy();
    expect(table.templateId).toBeTruthy();
    expect(table.stateJson).toBeTruthy();
    expect(table.status).toBeTruthy();
    expect(table.currentStep).toBeTruthy();
  });

  it("exposes listInstances, saveInstance, and deleteInstance on workflowRouter", () => {
    // The router object exposes procedures as top-level keys.
    const r = workflowRouter._def.procedures as Record<string, unknown>;
    expect(r.listInstances).toBeTruthy();
    expect(r.saveInstance).toBeTruthy();
    expect(r.deleteInstance).toBeTruthy();
  });

  it("saveInstance accepts each of the 5 Workflows.tsx template IDs", async () => {
    // The zod input schema lives on saveInstance. Fetch it via the
    // tRPC internal def and try parsing each template ID. If the
    // schema narrows templateId back to an enum, this test breaks
    // loudly — which is exactly the regression we want to catch.
    const proc = (workflowRouter._def.procedures as any).saveInstance;
    const schema = proc._def?.inputs?.[0];
    expect(schema).toBeTruthy();
    const templates = [
      "finra_registration",
      "state_insurance",
      "eo_insurance",
      "client_onboarding",
      "prospect_qualification",
    ];
    for (const templateId of templates) {
      const result = schema.safeParse({
        templateId,
        state: { dummy: true },
        currentStep: 0,
        status: "in_progress",
      });
      expect(result.success, `templateId ${templateId} rejected: ${result.error?.message}`).toBe(true);
    }
  });

  it("saveInstance rejects an obviously invalid status", () => {
    const proc = (workflowRouter._def.procedures as any).saveInstance;
    const schema = proc._def?.inputs?.[0];
    const result = schema.safeParse({
      templateId: "finra_registration",
      state: {},
      currentStep: 0,
      status: "on-fire", // bogus
    });
    expect(result.success).toBe(false);
  });

  it("deleteInstance requires a numeric id", () => {
    const proc = (workflowRouter._def.procedures as any).deleteInstance;
    const schema = proc._def?.inputs?.[0];
    expect(schema.safeParse({ id: 42 }).success).toBe(true);
    expect(schema.safeParse({ id: "abc" }).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(false);
  });
});
