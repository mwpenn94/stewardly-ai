/**
 * Stripe Billing Router
 *
 * Handles subscription checkout, customer portal, and billing queries.
 * Webhook handling is in webhookHandler.ts (registered as Express route).
 */
import { z } from "zod";
import Stripe from "stripe";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { ENV } from "../_core/env";
import { requireDb } from "../db";
import { users, billingEvents } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { PLANS, PLAN_ORDER, getPlan, getPlanPrice } from "./products";

function getStripe() {
  if (!ENV.stripeSecretKey) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Stripe is not configured. Please add your Stripe keys in Settings → Payment.",
    });
  }
  return new Stripe(ENV.stripeSecretKey, { apiVersion: "2025-03-31.basil" as any });
}

/** Ensure user has a Stripe customer ID, creating one if needed */
async function ensureStripeCustomer(userId: number, email: string, name?: string): Promise<string> {
  const db = await requireDb();
  const [user] = await db.select({ stripeCustomerId: users.stripeCustomerId }).from(users).where(eq(users.id, userId));

  if (user?.stripeCustomerId) return user.stripeCustomerId;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email,
    name: name ?? undefined,
    metadata: { userId: String(userId) },
  });

  await db.update(users).set({ stripeCustomerId: customer.id }).where(eq(users.id, userId));
  return customer.id;
}

export const billingRouter = router({
  /** Get available plans */
  getPlans: protectedProcedure.query(() => {
    return PLAN_ORDER.map((id) => {
      const plan = PLANS[id];
      return {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        features: plan.features,
        limits: plan.limits,
        popular: plan.popular ?? false,
      };
    });
  }),

  /** Get current subscription status */
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    const [user] = await db
      .select({
        stripeCustomerId: users.stripeCustomerId,
        stripeSubscriptionId: users.stripeSubscriptionId,
        stripePlanId: users.stripePlanId,
        stripeSubscriptionStatus: users.stripeSubscriptionStatus,
        stripeCurrentPeriodEnd: users.stripeCurrentPeriodEnd,
      })
      .from(users)
      .where(eq(users.id, ctx.user!.id));

    if (!user?.stripeSubscriptionId) {
      return { active: false, plan: null, status: null, currentPeriodEnd: null };
    }

    const plan = user.stripePlanId ? getPlan(user.stripePlanId) : null;
    return {
      active: user.stripeSubscriptionStatus === "active" || user.stripeSubscriptionStatus === "trialing",
      plan: plan ? { id: plan.id, name: plan.name } : null,
      status: user.stripeSubscriptionStatus,
      currentPeriodEnd: user.stripeCurrentPeriodEnd,
    };
  }),

  /** Create a Stripe Checkout session for a new subscription */
  createCheckout: protectedProcedure
    .input(z.object({
      planId: z.enum(["starter", "professional", "enterprise"]),
      interval: z.enum(["month", "year"]).default("month"),
    }))
    .mutation(async ({ ctx, input }) => {
      const stripe = getStripe();
      const plan = getPlan(input.planId);
      if (!plan) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid plan" });

      const customerId = await ensureStripeCustomer(
        ctx.user!.id,
        ctx.user!.email ?? "",
        ctx.user!.name ?? undefined,
      );

      const priceCents = getPlanPrice(input.planId, input.interval);
      const origin = ctx.req?.headers.origin ?? "https://localhost:3000";

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        client_reference_id: String(ctx.user!.id),
        customer_email: undefined, // already set via customer
        allow_promotion_codes: true,
        metadata: {
          user_id: String(ctx.user!.id),
          plan_id: input.planId,
          interval: input.interval,
        },
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `WealthBridge AI — ${plan.name}`,
                description: plan.description,
              },
              unit_amount: priceCents,
              recurring: { interval: input.interval },
            },
            quantity: 1,
          },
        ],
        success_url: `${origin}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/billing?canceled=true`,
      });

      return { url: session.url };
    }),

  /** Create a Stripe Customer Portal session for managing billing */
  createPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
    const stripe = getStripe();
    const db = await requireDb();
    const [user] = await db
      .select({ stripeCustomerId: users.stripeCustomerId })
      .from(users)
      .where(eq(users.id, ctx.user!.id));

    if (!user?.stripeCustomerId) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No billing account found. Please subscribe first." });
    }

    const origin = ctx.req?.headers.origin ?? "https://localhost:3000";
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${origin}/billing`,
    });

    return { url: session.url };
  }),

  /** Get billing history (from local event log) */
  getHistory: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      const db = await requireDb();
      return db
        .select()
        .from(billingEvents)
        .where(eq(billingEvents.userId, ctx.user!.id))
        .orderBy(desc(billingEvents.createdAt))
        .limit(input?.limit ?? 20);
    }),
});
