/**
 * Student Loan Optimizer (D6) — Repayment Strategy Engine
 * 
 * Compares IDR plans, PSLF eligibility, refinancing scenarios,
 * and tax implications of forgiveness.
 */
import { getDb } from "./db";
import { studentLoans } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";

// ─── CRUD ───────────────────────────────────────────────────────
export async function addLoan(data: typeof studentLoans.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(studentLoans).values(data).$returningId();
  return result;
}

export async function getLoans(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(studentLoans).where(eq(studentLoans.userId, userId)).orderBy(desc(studentLoans.balance));
}

export async function updateLoan(id: number, userId: number, data: Partial<typeof studentLoans.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  const { userId: _, ...rest } = data;
  await db.update(studentLoans).set(rest).where(
    eq(studentLoans.id, id)
  );
}

export async function deleteLoan(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(studentLoans).where(eq(studentLoans.id, id));
}

// ─── REPAYMENT CALCULATORS ──────────────────────────────────────
interface RepaymentScenario {
  name: string;
  monthlyPayment: number;
  totalPaid: number;
  totalInterest: number;
  payoffMonths: number;
  forgivenessAmount: number;
  taxOnForgiveness: number;
}

export function calculateStandardRepayment(balance: number, rate: number, termMonths = 120): RepaymentScenario {
  const monthlyRate = rate / 100 / 12;
  const payment = monthlyRate > 0
    ? (balance * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1)
    : balance / termMonths;
  const totalPaid = payment * termMonths;
  return {
    name: "Standard 10-Year",
    monthlyPayment: Math.round(payment * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    totalInterest: Math.round((totalPaid - balance) * 100) / 100,
    payoffMonths: termMonths,
    forgivenessAmount: 0,
    taxOnForgiveness: 0,
  };
}

export function calculateIDRPayment(
  agi: number,
  familySize: number,
  balance: number,
  rate: number,
  plan: "SAVE" | "PAYE" | "IBR" | "ICR" = "SAVE",
): RepaymentScenario {
  // 2024 Federal Poverty Level (continental US)
  const fpl = 15060 + (familySize - 1) * 5380;
  let discretionaryIncome: number;
  let paymentPct: number;
  let forgivenessYears: number;

  switch (plan) {
    case "SAVE":
      discretionaryIncome = Math.max(0, agi - 2.25 * fpl);
      paymentPct = balance <= 12000 ? 0.05 : 0.10; // 5% for undergrad, 10% for grad
      forgivenessYears = balance <= 12000 ? 10 : 20;
      break;
    case "PAYE":
      discretionaryIncome = Math.max(0, agi - 1.5 * fpl);
      paymentPct = 0.10;
      forgivenessYears = 20;
      break;
    case "IBR":
      discretionaryIncome = Math.max(0, agi - 1.5 * fpl);
      paymentPct = 0.15;
      forgivenessYears = 25;
      break;
    case "ICR":
      discretionaryIncome = Math.max(0, agi - fpl);
      paymentPct = 0.20;
      forgivenessYears = 25;
      break;
  }

  const monthlyPayment = Math.round((discretionaryIncome * paymentPct) / 12 * 100) / 100;
  const termMonths = forgivenessYears * 12;
  
  // Simulate repayment
  let remaining = balance;
  let totalPaid = 0;
  const monthlyRate = rate / 100 / 12;
  
  for (let m = 0; m < termMonths && remaining > 0; m++) {
    const interest = remaining * monthlyRate;
    const actualPayment = Math.min(monthlyPayment, remaining + interest);
    remaining = remaining + interest - actualPayment;
    totalPaid += actualPayment;
  }

  const forgiven = Math.max(0, remaining);
  // IDR forgiveness is taxable (except PSLF)
  const taxRate = 0.22; // Estimate marginal rate
  const taxOnForgiveness = Math.round(forgiven * taxRate * 100) / 100;

  return {
    name: `${plan} Plan`,
    monthlyPayment,
    totalPaid: Math.round(totalPaid * 100) / 100,
    totalInterest: Math.round((totalPaid - balance + forgiven) * 100) / 100,
    payoffMonths: termMonths,
    forgivenessAmount: Math.round(forgiven * 100) / 100,
    taxOnForgiveness,
  };
}

export function calculatePSLF(balance: number, rate: number, monthlyPayment: number): RepaymentScenario {
  const termMonths = 120; // 10 years / 120 qualifying payments
  const monthlyRate = rate / 100 / 12;
  let remaining = balance;
  let totalPaid = 0;

  for (let m = 0; m < termMonths && remaining > 0; m++) {
    const interest = remaining * monthlyRate;
    const actualPayment = Math.min(monthlyPayment, remaining + interest);
    remaining = remaining + interest - actualPayment;
    totalPaid += actualPayment;
  }

  const forgiven = Math.max(0, remaining);
  return {
    name: "PSLF (Tax-Free Forgiveness)",
    monthlyPayment,
    totalPaid: Math.round(totalPaid * 100) / 100,
    totalInterest: Math.round((totalPaid - balance + forgiven) * 100) / 100,
    payoffMonths: termMonths,
    forgivenessAmount: Math.round(forgiven * 100) / 100,
    taxOnForgiveness: 0, // PSLF forgiveness is tax-free
  };
}

export function calculateRefinance(balance: number, newRate: number, termMonths: number): RepaymentScenario {
  return {
    ...calculateStandardRepayment(balance, newRate, termMonths),
    name: `Refinance at ${newRate}% / ${termMonths / 12}yr`,
  };
}

export function compareAllScenarios(
  balance: number,
  rate: number,
  agi: number,
  familySize: number,
  pslfEligible: boolean,
): RepaymentScenario[] {
  const scenarios: RepaymentScenario[] = [
    calculateStandardRepayment(balance, rate),
    calculateIDRPayment(agi, familySize, balance, rate, "SAVE"),
    calculateIDRPayment(agi, familySize, balance, rate, "PAYE"),
    calculateIDRPayment(agi, familySize, balance, rate, "IBR"),
  ];
  if (pslfEligible) {
    const savePayment = calculateIDRPayment(agi, familySize, balance, rate, "SAVE");
    scenarios.push(calculatePSLF(balance, rate, savePayment.monthlyPayment));
  }
  // Add refinance scenarios at common rates
  for (const newRate of [4.0, 5.0, 6.0]) {
    if (newRate < rate) {
      scenarios.push(calculateRefinance(balance, newRate, 120));
      scenarios.push(calculateRefinance(balance, newRate, 180));
    }
  }
  return scenarios.sort((a, b) => a.totalPaid - b.totalPaid);
}
