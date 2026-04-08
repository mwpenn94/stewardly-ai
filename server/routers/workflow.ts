import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc } from "drizzle-orm";
import { workflowChecklist, workflowInstances } from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";

// ─── WORKFLOW STEP DEFINITIONS ──────────────────────────────────────
const ONBOARDING_STEPS = {
  professional_onboarding: [
    { key: "profile", label: "Complete your profile", description: "Add your name, credentials, and bio" },
    { key: "suitability", label: "Complete suitability assessment", description: "Answer questions about your risk tolerance and financial goals" },
    { key: "org_join", label: "Join or create an organization", description: "Connect with your firm or create a new one" },
    { key: "ai_settings", label: "Configure AI preferences", description: "Set your preferred tone, response format, and focus areas" },
    { key: "first_chat", label: "Have your first conversation", description: "Ask the AI a financial question to see it in action" },
    { key: "knowledge_base", label: "Upload to knowledge base", description: "Add documents, notes, or study materials" },
    { key: "explore_tools", label: "Explore financial tools", description: "Try calculators, compliance review, or market data" },
  ],
  client_onboarding: [
    { key: "profile", label: "Complete your profile", description: "Add your basic information" },
    { key: "suitability", label: "Complete suitability assessment", description: "Help us understand your financial situation" },
    { key: "connect_advisor", label: "Connect with an advisor", description: "Link with your financial professional" },
    { key: "first_chat", label: "Have your first conversation", description: "Ask the AI about your financial goals" },
    { key: "explore_planning", label: "Explore financial planning", description: "Try the financial planning tools" },
  ],
  licensing: [
    { key: "verify_license", label: "Verify professional license", description: "Upload your Series 6/7/63/65/66 documentation" },
    { key: "compliance_agreement", label: "Sign compliance agreement", description: "Review and accept compliance terms" },
    { key: "background_check", label: "Background verification", description: "Complete background check process" },
    { key: "supervisor_approval", label: "Supervisor approval", description: "Get approval from your supervising manager" },
  ],
  registration: [
    { key: "basic_info", label: "Basic information", description: "Name, email, and contact details" },
    { key: "verify_email", label: "Verify email address", description: "Confirm your email address" },
    { key: "accept_terms", label: "Accept terms of service", description: "Review and accept the terms" },
    { key: "choose_plan", label: "Choose your plan", description: "Select the plan that fits your needs" },
  ],
};

export const workflowRouter = router({
  // Get or create a workflow checklist for the user
  getChecklist: protectedProcedure
    .input(z.object({
      workflowType: z.enum(["professional_onboarding", "client_onboarding", "licensing", "registration"]),
    }))
    .query(async ({ ctx, input }) => {
      const db = await (await import("../db")).getDb();
      if (!db) return null;

      const existing = await db.select().from(workflowChecklist)
        .where(and(
          eq(workflowChecklist.userId, ctx.user.id),
          eq(workflowChecklist.workflowType, input.workflowType),
        ))
        .limit(1);

      if (existing.length > 0) {
        const wf = existing[0];
        const steps = typeof wf.steps === "string" ? JSON.parse(wf.steps) : wf.steps;
        return { ...wf, steps };
      }

      // Create new checklist
      const templateSteps = ONBOARDING_STEPS[input.workflowType] || [];
      const steps = templateSteps.map(s => ({ ...s, completed: false, completedAt: null }));

      await db.insert(workflowChecklist).values({
        userId: ctx.user.id,
        workflowType: input.workflowType,
        steps: JSON.stringify(steps),
        currentStep: 0,
        status: "not_started",
      });

      const created = await db.select().from(workflowChecklist)
        .where(and(
          eq(workflowChecklist.userId, ctx.user.id),
          eq(workflowChecklist.workflowType, input.workflowType),
        ))
        .limit(1);

      return created[0] ? { ...created[0], steps } : null;
    }),

  // Complete a step in the workflow
  completeStep: protectedProcedure
    .input(z.object({
      workflowType: z.enum(["professional_onboarding", "client_onboarding", "licensing", "registration"]),
      stepKey: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const existing = await db.select().from(workflowChecklist)
        .where(and(
          eq(workflowChecklist.userId, ctx.user.id),
          eq(workflowChecklist.workflowType, input.workflowType),
        ))
        .limit(1);

      if (!existing.length) throw new TRPCError({ code: "NOT_FOUND", message: "Workflow not found" });

      const wf = existing[0];
      const steps = typeof wf.steps === "string" ? JSON.parse(wf.steps) : wf.steps;
      const stepIndex = steps.findIndex((s: any) => s.key === input.stepKey);
      if (stepIndex === -1) throw new TRPCError({ code: "NOT_FOUND", message: "Step not found" });

      steps[stepIndex].completed = true;
      steps[stepIndex].completedAt = Date.now();

      const allCompleted = steps.every((s: any) => s.completed);
      const nextIncomplete = steps.findIndex((s: any) => !s.completed);

      await db.update(workflowChecklist)
        .set({
          steps: JSON.stringify(steps),
          currentStep: nextIncomplete >= 0 ? nextIncomplete : steps.length,
          status: allCompleted ? "completed" : "in_progress",
          completedAt: allCompleted ? new Date() : null,
        })
        .where(eq(workflowChecklist.id, wf.id));

      return { success: true, allCompleted, nextStep: nextIncomplete >= 0 ? steps[nextIncomplete] : null };
    }),

  // Reset a workflow
  reset: protectedProcedure
    .input(z.object({
      workflowType: z.enum(["professional_onboarding", "client_onboarding", "licensing", "registration"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const templateSteps = ONBOARDING_STEPS[input.workflowType] || [];
      const steps = templateSteps.map(s => ({ ...s, completed: false, completedAt: null }));

      await db.update(workflowChecklist)
        .set({
          steps: JSON.stringify(steps),
          currentStep: 0,
          status: "not_started",
          completedAt: null,
        })
        .where(and(
          eq(workflowChecklist.userId, ctx.user.id),
          eq(workflowChecklist.workflowType, input.workflowType),
        ));

      return { success: true };
    }),

  // List all user workflows
  listAll: protectedProcedure.query(async ({ ctx }) => {
    const db = await (await import("../db")).getDb();
    if (!db) return [];
    const workflows = await db.select().from(workflowChecklist)
      .where(eq(workflowChecklist.userId, ctx.user.id))
      .orderBy(desc(workflowChecklist.createdAt));
    return workflows.map(wf => ({
      ...wf,
      steps: typeof wf.steps === "string" ? JSON.parse(wf.steps) : wf.steps,
    }));
  }),

  // Get step templates for a workflow type
  getTemplate: protectedProcedure
    .input(z.object({
      workflowType: z.enum(["professional_onboarding", "client_onboarding", "licensing", "registration"]),
    }))
    .query(({ input }) => {
      return ONBOARDING_STEPS[input.workflowType] || [];
    }),

  // ─── Generic workflow instance persistence (pass 61) ────────────
  //
  // These procedures back the Workflows.tsx page's in-progress runs
  // across sessions/devices. Before pass 61 the page wrote to
  // localStorage, so 30 minutes of FINRA registration paperwork
  // vanished on a cache clear. Each instance has a `templateId` +
  // `templateName` (the 5 UI templates — finra_registration,
  // state_insurance, eo_insurance, client_onboarding,
  // prospect_qualification — or any future additions) and a
  // free-form `stateJson` blob matching the UI's `WorkflowInstance`
  // shape. All reads/writes are owner-gated on `user_id`.
  //
  // Graceful degradation: if the DB is unavailable (e.g. test env),
  // the procedures return empty/noop so the UI can fall back to
  // localStorage transparently.

  listInstances: protectedProcedure.query(async ({ ctx }) => {
    const db = await (await import("../db")).getDb();
    if (!db) return [];
    const rows = await db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.userId, ctx.user.id))
      .orderBy(desc(workflowInstances.updatedAt));
    return rows.map((r) => ({
      id: r.id,
      templateId: r.templateId,
      templateName: r.templateName,
      state: r.stateJson,
      currentStep: r.currentStep,
      status: r.status,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      updatedAt: r.updatedAt,
    }));
  }),

  saveInstance: protectedProcedure
    .input(
      z.object({
        id: z.number().int().optional(),
        templateId: z.string().min(1).max(128),
        templateName: z.string().max(255).optional(),
        state: z.any(),
        currentStep: z.number().int().min(0).max(100).default(0),
        status: z.enum(["in_progress", "completed", "abandoned"]).default("in_progress"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await (await import("../db")).getDb();
      if (!db) return { id: null, persisted: false as const };

      if (input.id != null) {
        // Update path — owner check first so we don't leak updates
        // across users.
        const [existing] = await db
          .select({ userId: workflowInstances.userId })
          .from(workflowInstances)
          .where(eq(workflowInstances.id, input.id))
          .limit(1);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Workflow instance not found" });
        if (existing.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not your workflow instance" });
        }
        await db
          .update(workflowInstances)
          .set({
            stateJson: input.state,
            currentStep: input.currentStep,
            status: input.status,
            completedAt: input.status === "completed" ? new Date() : null,
          })
          .where(eq(workflowInstances.id, input.id));
        return { id: input.id, persisted: true as const };
      }

      // Insert path
      await db.insert(workflowInstances).values({
        userId: ctx.user.id,
        templateId: input.templateId,
        templateName: input.templateName ?? null,
        stateJson: input.state,
        currentStep: input.currentStep,
        status: input.status,
      });
      // Return the most-recent row for this user+template as the id
      // (MySQL's auto-increment insertId isn't exposed by Drizzle's
      // mysql2 driver for all row types).
      const [latest] = await db
        .select({ id: workflowInstances.id })
        .from(workflowInstances)
        .where(
          and(
            eq(workflowInstances.userId, ctx.user.id),
            eq(workflowInstances.templateId, input.templateId),
          ),
        )
        .orderBy(desc(workflowInstances.id))
        .limit(1);
      return { id: latest?.id ?? null, persisted: true as const };
    }),

  deleteInstance: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await (await import("../db")).getDb();
      if (!db) return { deleted: false };
      const [existing] = await db
        .select({ userId: workflowInstances.userId })
        .from(workflowInstances)
        .where(eq(workflowInstances.id, input.id))
        .limit(1);
      if (!existing) return { deleted: false };
      if (existing.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your workflow instance" });
      }
      await db.delete(workflowInstances).where(eq(workflowInstances.id, input.id));
      return { deleted: true };
    }),
});
