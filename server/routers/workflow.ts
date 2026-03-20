import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc } from "drizzle-orm";
import { workflowChecklist } from "../../drizzle/schema";
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
});
