/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Stripe Invoice Integration
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Connects the substrate pricing engine to Stripe invoicing.
 * Generates Stripe invoices from calculateInvoice() output.
 *
 * Flow:
 *   1. At billing period end, materialize M&V period summary
 *   2. Calculate invoice using pricing engine
 *   3. Create Stripe invoice with line items matching the breakdown
 *   4. Apply savings credit as a discount/credit note
 *   5. Finalize and send
 */
import Stripe from "stripe";
import { ENV } from "../_core/env";
import { logger } from "../_core/logger";
import {
  calculateInvoice,
  type BillingProfile,
  type UsageSummary,
  type InvoiceCalculation,
} from "../services/substrate/pricingEngine";
import {
  materializePeriodSummary,
  getLatestPeriodSummary,
} from "../services/substrate/mvPersistence";
import { requireDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const log = logger.child({ module: "stripe:invoice-integration" });

function getStripe() {
  if (!ENV.stripeSecretKey) {
    throw new Error("Stripe is not configured");
  }
  return new Stripe(ENV.stripeSecretKey, { apiVersion: "2025-03-31.basil" as any });
}

// ─── Generate a Stripe invoice from the pricing engine output ────────────────
export async function generateStripeInvoice(params: {
  userId: number;
  billingProfile: BillingProfile;
  usageSummary: UsageSummary;
  periodStart: number;
  periodEnd: number;
}): Promise<{ invoiceId: string; amountDue: number; hostedUrl?: string } | null> {
  const { userId, billingProfile, usageSummary, periodStart, periodEnd } = params;

  // 1. Materialize M&V savings for the period
  await materializePeriodSummary(
    userId,
    new Date(periodStart),
    new Date(periodEnd),
    billingProfile.customSavingsShare ?? 0.3
  );

  // 2. Calculate invoice using the pricing engine
  const calculation = calculateInvoice({
    profile: billingProfile,
    usage: usageSummary,
    periodStart,
    periodEnd,
  });

  // Skip if nothing to charge
  if (calculation.netInvoice <= 0) {
    log.info({ userId }, "No invoice generated — net amount is zero or negative");
    return null;
  }

  // 3. Get or create Stripe customer
  const db = await requireDb();
  const [user] = await db
    .select({ stripeCustomerId: users.stripeCustomerId, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, userId));

  if (!user) {
    log.error({ userId }, "User not found for invoice generation");
    return null;
  }

  const stripe = getStripe();
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: user.name ?? undefined,
      metadata: { userId: String(userId) },
    });
    customerId = customer.id;
    await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, userId));
  }

  // 4. Create Stripe invoice with line items from breakdown
  const invoice = await stripe.invoices.create({
    customer: customerId,
    collection_method: "send_invoice",
    days_until_due: 7,
    metadata: {
      userId: String(userId),
      periodStart: new Date(periodStart).toISOString(),
      periodEnd: new Date(periodEnd).toISOString(),
      pricingEngine: "substrate-v1",
      ceilingApplied: String(calculation.ceilingApplied),
    },
  });

  // Add line items for each charge in the breakdown
  for (const item of calculation.breakdown) {
    if (item.type === "charge" && item.amount > 0) {
      await stripe.invoiceItems.create({
        customer: customerId,
        invoice: invoice.id,
        amount: item.amount, // Already in cents
        currency: "usd",
        description: item.label,
      });
    }
  }

  // 5. Apply savings credit as a negative line item
  if (calculation.savingsCredit > 0) {
    await stripe.invoiceItems.create({
      customer: customerId,
      invoice: invoice.id,
      amount: -calculation.savingsCredit,
      currency: "usd",
      description: `M&V Savings Credit (${Math.round((billingProfile.customSavingsShare ?? 0.3) * 100)}% share of $${(calculation.measuredSavings).toFixed(2)} measured savings)`,
    });
  }

  // 6. If ceiling was applied, add ceiling adjustment
  if (calculation.ceilingApplied) {
    const ceilingAdjustment = calculation.netInvoice - calculation.grossTotal + calculation.savingsCredit;
    if (ceilingAdjustment < 0) {
      await stripe.invoiceItems.create({
        customer: customerId,
        invoice: invoice.id,
        amount: ceilingAdjustment,
        currency: "usd",
        description: `Cost-Plus Ceiling Adjustment (cap: $${(calculation.ceilingAmount / 100).toFixed(2)})`,
      });
    }
  }

  // 7. Finalize the invoice
  const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);

  log.info({
    userId,
    invoiceId: finalizedInvoice.id,
    amountDue: finalizedInvoice.amount_due,
    netInvoice: calculation.netInvoice,
    savingsCredit: calculation.savingsCredit,
    ceilingApplied: calculation.ceilingApplied,
  }, "Stripe invoice generated from pricing engine");

  return {
    invoiceId: finalizedInvoice.id,
    amountDue: finalizedInvoice.amount_due,
    hostedUrl: finalizedInvoice.hosted_invoice_url ?? undefined,
  };
}

// ─── Get invoice preview (without creating in Stripe) ────────────────────────
export function previewInvoice(params: {
  billingProfile: BillingProfile;
  usageSummary: UsageSummary;
  periodStart: number;
  periodEnd: number;
}): InvoiceCalculation {
  return calculateInvoice(params);
}

// ─── Get user's M&V savings summary for the current billing period ───────────
export async function getCurrentPeriodSavings(userId: number) {
  return getLatestPeriodSummary(userId);
}
