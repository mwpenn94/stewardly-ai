/**
 * Stripe Webhook Handler
 *
 * Registered as Express route at /api/stripe/webhook BEFORE express.json().
 * Verifies signatures and processes subscription lifecycle events.
 */
import type { Request, Response } from "express";
import Stripe from "stripe";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { users, billingEvents } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { logger } from "../_core/logger";

function getStripe() {
  return new Stripe(ENV.stripeSecretKey, { apiVersion: "2025-03-31.basil" as any });
}

export async function stripeWebhookHandler(req: Request, res: Response) {
  const stripe = getStripe();
  const sig = req.headers["stripe-signature"];

  if (!sig) {
    logger.warn({ operation: "stripe-webhook" }, "Missing stripe-signature header");
    return res.status(400).json({ error: "Missing signature" });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body, // raw body buffer
      sig as string,
      ENV.stripeWebhookSecret,
    );
  } catch (err: any) {
    logger.error({ operation: "stripe-webhook", error: err.message }, "Signature verification failed");
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  logger.info({ operation: "stripe-webhook", eventType: event.type, eventId: event.id }, "Webhook received");

  // Handle test events
  if (event.id.startsWith("evt_test_")) {
    logger.info({ operation: "stripe-webhook" }, "Test event detected, returning verification response");
    return res.json({ verified: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, event);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, event);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, event);
        break;
      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice, event);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice, event);
        break;
      default:
        logger.info({ operation: "stripe-webhook", eventType: event.type }, "Unhandled event type");
    }
  } catch (err: any) {
    logger.error({ operation: "stripe-webhook", eventType: event.type, error: err.message }, "Error processing webhook event");
    // Still return 200 to prevent Stripe from retrying
  }

  return res.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, event: Stripe.Event) {
  const db = await getDb();
  if (!db) return;

  const userId = session.client_reference_id ? parseInt(session.client_reference_id, 10) : null;
  if (!userId) {
    logger.warn({ operation: "stripe-webhook" }, "checkout.session.completed without client_reference_id");
    return;
  }

  const planId = session.metadata?.plan_id ?? null;
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

  // Update user with subscription info
  await db.update(users).set({
    stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
    stripeSubscriptionId: subscriptionId ?? null,
    stripePlanId: planId,
    stripeSubscriptionStatus: "active",
  }).where(eq(users.id, userId));

  // Log event
  await logBillingEvent(db, {
    userId,
    stripeEventId: event.id,
    eventType: event.type,
    stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
    stripeSubscriptionId: subscriptionId ?? null,
    amountCents: session.amount_total ?? null,
    currency: session.currency ?? "usd",
    status: "completed",
    metadata: { planId },
  });

  logger.info({ operation: "stripe-webhook", userId, planId }, "User subscribed");
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription, event: Stripe.Event) {
  const db = await getDb();
  if (!db) return;

  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  if (!customerId) return;

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.stripeCustomerId, customerId));
  if (!user) return;

  await db.update(users).set({
    stripeSubscriptionStatus: subscription.status,
    stripeCurrentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
  }).where(eq(users.id, user.id));

  await logBillingEvent(db, {
    userId: user.id,
    stripeEventId: event.id,
    eventType: event.type,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription, event: Stripe.Event) {
  const db = await getDb();
  if (!db) return;

  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  if (!customerId) return;

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.stripeCustomerId, customerId));
  if (!user) return;

  await db.update(users).set({
    stripeSubscriptionStatus: "canceled",
    stripeSubscriptionId: null,
    stripePlanId: null,
  }).where(eq(users.id, user.id));

  await logBillingEvent(db, {
    userId: user.id,
    stripeEventId: event.id,
    eventType: event.type,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    status: "canceled",
  });

  logger.info({ operation: "stripe-webhook", userId: user.id }, "User subscription canceled");
}

async function handleInvoicePaid(invoice: Stripe.Invoice, event: Stripe.Event) {
  const db = await getDb();
  if (!db) return;

  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;
  if (!customerId) return;

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.stripeCustomerId, customerId));
  if (!user) return;

  await logBillingEvent(db, {
    userId: user.id,
    stripeEventId: event.id,
    eventType: event.type,
    stripeCustomerId: customerId,
    stripeInvoiceId: invoice.id,
    amountCents: invoice.amount_paid ?? null,
    currency: invoice.currency ?? "usd",
    status: "paid",
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice, event: Stripe.Event) {
  const db = await getDb();
  if (!db) return;

  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;
  if (!customerId) return;

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.stripeCustomerId, customerId));
  if (!user) return;

  // Update subscription status
  await db.update(users).set({
    stripeSubscriptionStatus: "past_due",
  }).where(eq(users.id, user.id));

  await logBillingEvent(db, {
    userId: user.id,
    stripeEventId: event.id,
    eventType: event.type,
    stripeCustomerId: customerId,
    stripeInvoiceId: invoice.id,
    amountCents: invoice.amount_due ?? null,
    currency: invoice.currency ?? "usd",
    status: "failed",
  });

  logger.warn({ operation: "stripe-webhook", userId: user.id }, "Payment failed");
}

async function logBillingEvent(db: any, data: {
  userId: number;
  stripeEventId: string;
  eventType: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeInvoiceId?: string | null;
  amountCents?: number | null;
  currency?: string;
  status?: string | null;
  metadata?: any;
}) {
  try {
    await db.insert(billingEvents).values({
      userId: data.userId,
      stripeEventId: data.stripeEventId,
      eventType: data.eventType,
      stripeCustomerId: data.stripeCustomerId ?? null,
      stripeSubscriptionId: data.stripeSubscriptionId ?? null,
      stripePaymentIntentId: data.stripePaymentIntentId ?? null,
      stripeInvoiceId: data.stripeInvoiceId ?? null,
      amountCents: data.amountCents ?? null,
      currency: data.currency ?? "usd",
      status: data.status ?? null,
      metadata: data.metadata ?? null,
    });
  } catch (err: any) {
    logger.error({ operation: "stripe-webhook", error: err.message }, "Failed to log billing event");
  }
}
