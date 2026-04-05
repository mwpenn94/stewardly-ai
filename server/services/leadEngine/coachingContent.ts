/**
 * Coaching Content — Serve calculator v3 conversation starters and action recommendations
 * Powers MD coaching insights and professional activity prompts
 */

export interface CoachingItem {
  domain: string;
  conversationStarter: string;
  actionStep: string;
  product: string;
  cadence: "14-day" | "90-day" | "annual";
}

const COACHING_CONTENT: CoachingItem[] = [
  // Protection domain
  { domain: "protection", conversationStarter: "Have you reviewed your life insurance coverage recently? Many families are underinsured by 3-5x.", actionStep: "Run protection back-plan calculator to identify gap", product: "Term Life + IUL (NLG)", cadence: "90-day" },
  { domain: "protection", conversationStarter: "What would happen to your family's income if you couldn't work for 6 months?", actionStep: "Quote disability insurance based on income", product: "DI (Guardian/MassMutual)", cadence: "14-day" },

  // Retirement domain
  { domain: "retirement", conversationStarter: "At your current savings rate, do you know when you'll be able to retire comfortably?", actionStep: "Run retirement back-plan from target annual income", product: "IUL/FIA for tax-advantaged growth", cadence: "90-day" },
  { domain: "retirement", conversationStarter: "Have you considered how Social Security timing affects your total lifetime benefit?", actionStep: "Run SS optimization analysis", product: "Advisory/AUM (ESI)", cadence: "annual" },

  // Estate domain
  { domain: "estate", conversationStarter: "Do you have a plan to minimize estate taxes for your heirs?", actionStep: "Run estate back-plan from $0 estate tax target", product: "ILIT + Estate Documents (EncorEstate)", cadence: "annual" },
  { domain: "estate", conversationStarter: "Have you considered how your charitable giving could provide tax benefits AND a legacy?", actionStep: "Model CRT + DAF + life insurance replacement", product: "CRT + DAF (Fidelity Charitable)", cadence: "annual" },

  // Tax domain
  { domain: "tax", conversationStarter: "Are you maximizing all available tax deductions for your situation?", actionStep: "Run tax back-plan from target effective rate", product: "Holistiplan tax analysis", cadence: "annual" },

  // Growth domain
  { domain: "growth", conversationStarter: "How is your current portfolio positioned for the next market downturn?", actionStep: "Compare IUL vs direct market growth path", product: "IUL (NLG) with downside protection", cadence: "90-day" },

  // Premium Finance (highest value)
  { domain: "premium_finance", conversationStarter: "For high-net-worth clients: have you explored how premium financing can fund large insurance policies with minimal cash outlay?", actionStep: "Run premium finance calculator with current SOFR", product: "Premium Finance (NLG + Advanced Markets)", cadence: "90-day" },

  // Education
  { domain: "education", conversationStarter: "With college costs rising 5-7% annually, do you have a plan to fully fund your children's education?", actionStep: "Run education back-plan from fully-funded target", product: "529 Plan + IUL supplemental", cadence: "annual" },
];

export function getCoachingForDomain(domain: string): CoachingItem[] {
  return COACHING_CONTENT.filter(c => c.domain === domain);
}

export function getCoachingForScore(domain: string, score: number): CoachingItem | null {
  const items = getCoachingForDomain(domain);
  if (items.length === 0) return null;
  // Lower score = higher urgency = first item
  if (score <= 3) return items[0];
  if (score <= 6 && items.length > 1) return items[1];
  return items[items.length - 1];
}

export function getAllCoachingContent(): CoachingItem[] {
  return COACHING_CONTENT;
}
