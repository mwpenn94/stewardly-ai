/**
 * Adaptive Education Engine (B9) — Personalized Financial Literacy
 * 
 * Generates micro-learning modules based on user's knowledge gaps.
 * Tracks progress and adapts difficulty.
 */
import { getDb } from "./db";
import { educationModules, educationProgress } from "../drizzle/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import { contextualLLM } from "./shared/intelligence/sovereignWiring"

// ─── SEED MODULES ───────────────────────────────────────────────
const SEED_MODULES = [
  { title: "Understanding Compound Interest", category: "investing" as const, difficulty: "beginner" as const, estimatedMinutes: 5,
    description: "Learn how compound interest works and why starting early matters.",
    content: `# Understanding Compound Interest\n\nCompound interest is often called the "eighth wonder of the world." It's the process where interest earns interest, creating exponential growth over time.\n\n## Key Concepts\n\n**Simple vs Compound Interest:**\n- Simple interest: calculated only on the principal\n- Compound interest: calculated on principal + accumulated interest\n\n**The Rule of 72:**\nDivide 72 by your annual return rate to estimate how many years it takes to double your money.\n- At 6% → 72/6 = 12 years to double\n- At 8% → 72/8 = 9 years to double\n\n## Why It Matters\n\nStarting to invest at age 25 vs 35, with $200/month at 7% annual return:\n- Starting at 25: ~$525,000 by age 65\n- Starting at 35: ~$244,000 by age 65\n\nThat 10-year head start more than doubles the outcome.` },
  { title: "Emergency Fund Basics", category: "budgeting" as const, difficulty: "beginner" as const, estimatedMinutes: 4,
    description: "Why you need an emergency fund and how to build one.",
    content: `# Emergency Fund Basics\n\nAn emergency fund is your financial safety net — money set aside for unexpected expenses.\n\n## How Much Do You Need?\n\n**General guidelines:**\n- Minimum: $1,000 starter fund\n- Target: 3-6 months of essential expenses\n- If self-employed or single income: 6-12 months\n\n## Where to Keep It\n\n- High-yield savings account (HYSA)\n- Money market account\n- NOT in investments (too volatile for emergencies)\n\n## Building Strategy\n\n1. Start with $1,000 goal\n2. Automate transfers ($50-200/month)\n3. Direct windfalls here (tax refunds, bonuses)\n4. Replenish after use` },
  { title: "Introduction to Index Funds", category: "investing" as const, difficulty: "beginner" as const, estimatedMinutes: 6,
    description: "What index funds are and why they're popular for long-term investing.",
    content: `# Introduction to Index Funds\n\nIndex funds are investment funds that track a specific market index, like the S&P 500.\n\n## Why Index Funds?\n\n**Low costs:** Average expense ratio of 0.03-0.20% vs 1-2% for actively managed funds\n**Diversification:** Own hundreds or thousands of stocks in one fund\n**Performance:** Over 15+ year periods, ~90% of actively managed funds underperform their benchmark index\n\n## Common Index Funds\n\n| Index | What It Tracks | Example Fund |\n|-------|---------------|-------------|\n| S&P 500 | 500 largest US companies | VOO, SPY, FXAIX |\n| Total Stock Market | All US stocks | VTI, SWTSX |\n| Total International | Non-US stocks | VXUS, IXUS |\n| Total Bond Market | US bonds | BND, AGG |\n\n## Getting Started\n\nMost retirement accounts (401k, IRA) offer index fund options. Look for the lowest expense ratio available.` },
  { title: "Understanding Your Credit Score", category: "credit" as const, difficulty: "beginner" as const, estimatedMinutes: 5,
    description: "What makes up your credit score and how to improve it.",
    content: `# Understanding Your Credit Score\n\nYour credit score (FICO) ranges from 300-850 and affects loan rates, rental applications, and even job prospects.\n\n## Score Breakdown\n\n| Factor | Weight | How to Optimize |\n|--------|--------|-----------------|\n| Payment History | 35% | Never miss a payment |\n| Credit Utilization | 30% | Keep below 30% (ideally 10%) |\n| Length of History | 15% | Keep old accounts open |\n| Credit Mix | 10% | Have different account types |\n| New Credit | 10% | Limit hard inquiries |\n\n## Score Ranges\n\n- 800-850: Exceptional\n- 740-799: Very Good\n- 670-739: Good\n- 580-669: Fair\n- Below 580: Poor\n\n## Quick Wins\n\n1. Set up autopay for all bills\n2. Request credit limit increases (lowers utilization)\n3. Become an authorized user on a family member's old card\n4. Check reports annually at annualcreditreport.com` },
  { title: "Tax-Advantaged Accounts Overview", category: "tax" as const, difficulty: "intermediate" as const, estimatedMinutes: 7,
    description: "Compare 401(k), IRA, Roth IRA, HSA, and 529 plans.",
    content: `# Tax-Advantaged Accounts\n\nUsing the right accounts can save thousands in taxes over your lifetime.\n\n## Account Comparison\n\n| Account | Tax Benefit | 2024 Limit | Best For |\n|---------|------------|------------|----------|\n| 401(k) | Pre-tax contributions | $23,000 | Employer match |\n| Roth IRA | Tax-free growth | $7,000 | Young/lower income |\n| Traditional IRA | Tax deduction | $7,000 | No employer plan |\n| HSA | Triple tax advantage | $4,150 (ind) | Health expenses |\n| 529 | Tax-free for education | Varies by state | College savings |\n\n## Priority Order\n\n1. 401(k) up to employer match (free money)\n2. HSA if eligible (triple tax benefit)\n3. Roth IRA to max\n4. 401(k) to max\n5. Taxable brokerage\n\n## The HSA Secret\n\nHSAs are the only account with a triple tax advantage:\n- Tax-deductible contributions\n- Tax-free growth\n- Tax-free withdrawals for medical expenses\n\nAfter age 65, HSA funds can be used for anything (taxed like a traditional IRA).` },
  { title: "Life Insurance Fundamentals", category: "insurance" as const, difficulty: "beginner" as const, estimatedMinutes: 6,
    description: "Term vs whole life, how much you need, and when to get it.",
    content: `# Life Insurance Fundamentals\n\n## Do You Need Life Insurance?\n\nYes, if anyone depends on your income:\n- Spouse/partner\n- Children\n- Co-signed debts\n- Business partners\n\n## Term vs Permanent\n\n| Feature | Term Life | Whole Life |\n|---------|-----------|------------|\n| Duration | 10-30 years | Lifetime |\n| Cost | $20-50/month | $200-500/month |\n| Cash Value | No | Yes |\n| Best For | Most people | Estate planning |\n\n## How Much Coverage?\n\n**Quick formula:** 10-12x your annual income\n\n**Detailed approach (DIME):**\n- **D**ebt: Total outstanding debts\n- **I**ncome: Years of income to replace × annual salary\n- **M**ortgage: Remaining mortgage balance\n- **E**ducation: College costs for children\n\n## When to Buy\n\n- Younger = cheaper (rates increase with age)\n- Get it before health issues arise\n- Review coverage at major life events` },
  { title: "Estate Planning Essentials", category: "estate" as const, difficulty: "intermediate" as const, estimatedMinutes: 8,
    description: "Wills, trusts, POA, and healthcare directives — what everyone needs.",
    content: `# Estate Planning Essentials\n\nEstate planning isn't just for the wealthy — everyone needs basic documents.\n\n## The Core Four Documents\n\n1. **Last Will & Testament** — Who gets what, guardian for minor children\n2. **Durable Power of Attorney** — Who manages finances if you're incapacitated\n3. **Healthcare Power of Attorney** — Who makes medical decisions\n4. **Living Will / Advance Directive** — Your end-of-life care wishes\n\n## Beneficiary Designations\n\nThese OVERRIDE your will:\n- Retirement accounts (401k, IRA)\n- Life insurance policies\n- Bank accounts (POD/TOD)\n- Brokerage accounts\n\n**Action item:** Review all beneficiary designations annually.\n\n## When to Consider a Trust\n\n- Assets over $1M\n- Minor children\n- Blended families\n- Privacy concerns (wills are public record)\n- Special needs dependents\n\n## Digital Estate\n\nDon't forget digital assets:\n- Password manager access\n- Crypto wallet keys\n- Social media accounts\n- Online banking credentials` },
  { title: "Debt Payoff Strategies", category: "debt" as const, difficulty: "beginner" as const, estimatedMinutes: 5,
    description: "Avalanche vs snowball method and when to use each.",
    content: `# Debt Payoff Strategies\n\n## Two Popular Methods\n\n### Avalanche Method (Mathematically Optimal)\n1. Pay minimums on all debts\n2. Put extra money toward highest interest rate debt\n3. When paid off, roll that payment to next highest rate\n\n**Best for:** Saving the most money on interest\n\n### Snowball Method (Psychologically Effective)\n1. Pay minimums on all debts\n2. Put extra money toward smallest balance\n3. When paid off, roll that payment to next smallest\n\n**Best for:** Motivation from quick wins\n\n## Which to Choose?\n\nResearch shows the snowball method has higher completion rates because of the psychological boost from eliminating debts quickly.\n\n## When to Consolidate\n\nConsider consolidation if:\n- You can get a lower interest rate\n- You have multiple high-interest debts\n- You want one simple payment\n\n**Warning:** Don't consolidate and then rack up new debt on freed-up credit cards.` },
];

export async function seedEducationModules() {
  const db = await getDb();
  if (!db) return;
  // Check if already seeded
  const existing = await db.select().from(educationModules).limit(1);
  if (existing.length > 0) return;
  await db.insert(educationModules).values(SEED_MODULES);
}

// ─── MODULE QUERIES ─────────────────────────────────────────────
export async function getModules(category?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(educationModules.isActive, true)];
  if (category) conditions.push(eq(educationModules.category, category as any));
  return db.select().from(educationModules).where(and(...conditions));
}

export async function getModuleById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [mod] = await db.select().from(educationModules).where(eq(educationModules.id, id));
  return mod || null;
}

// ─── PROGRESS TRACKING ─────────────────────────────────────────
export async function getUserProgress(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(educationProgress)
    .where(eq(educationProgress.userId, userId))
    .orderBy(desc(educationProgress.createdAt));
}

export async function startModule(userId: number, moduleId: number) {
  const db = await getDb();
  if (!db) return;
  // Check if already started
  const existing = await db.select().from(educationProgress)
    .where(and(eq(educationProgress.userId, userId), eq(educationProgress.moduleId, moduleId)));
  if (existing.length > 0) return existing[0];
  const [result] = await db.insert(educationProgress).values({
    userId,
    moduleId,
    startedAt: new Date(),
  }).$returningId();
  return result;
}

export async function completeModule(userId: number, moduleId: number, score?: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(educationProgress).set({
    completedAt: new Date(),
    score: score ?? 1.0,
  }).where(
    and(eq(educationProgress.userId, userId), eq(educationProgress.moduleId, moduleId))
  );
}

// ─── RECOMMENDATION ENGINE ──────────────────────────────────────
export async function recommendModules(userId: number, limit = 3) {
  const db = await getDb();
  if (!db) return [];
  // Get completed modules
  const progress = await getUserProgress(userId);
  const completedIds = new Set(progress.filter(p => p.completedAt).map(p => p.moduleId));
  // Get all active modules
  const allModules = await getModules();
  // Filter out completed, prioritize by difficulty progression
  const available = allModules.filter(m => !completedIds.has(m.id));
  // Sort: beginner first, then intermediate, then advanced
  const diffOrder = { beginner: 0, intermediate: 1, advanced: 2 };
  available.sort((a, b) => (diffOrder[a.difficulty || "beginner"] || 0) - (diffOrder[b.difficulty || "beginner"] || 0));
  return available.slice(0, limit);
}
