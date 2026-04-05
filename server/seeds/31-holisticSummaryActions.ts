export const ACTIONS = [
  { domain: "protection", score: 1, action: "Term + DI quotes within 14 days", products: "NLG Term, Guardian DI", cadence: "14-day" },
  { domain: "protection", score: 2, action: "Review coverage amounts vs income replacement needs", products: "NLG IUL, RapidProtect", cadence: "90-day" },
  { domain: "protection", score: 3, action: "Annual coverage audit — ensure alignment with life changes", products: "Existing policies", cadence: "annual" },
  { domain: "retirement", score: 1, action: "Start retirement savings immediately — IUL or FIA for tax-advantaged growth", products: "NLG IUL, Athene FIA", cadence: "14-day" },
  { domain: "retirement", score: 2, action: "Increase contribution rate, review asset allocation", products: "ESI Advisory/AUM", cadence: "90-day" },
  { domain: "retirement", score: 3, action: "Annual retirement projection review with SS optimization", products: "Advisory/AUM", cadence: "annual" },
  { domain: "estate", score: 1, action: "Get will/trust (EncorEstate/Trust&Will), ILIT for estate tax exposure", products: "EncorEstate, NLG ILIT", cadence: "14-day" },
  { domain: "estate", score: 2, action: "Review beneficiary designations and titling", products: "Trust&Will", cadence: "90-day" },
  { domain: "estate", score: 3, action: "Annual estate plan review", products: "Existing documents", cadence: "annual" },
  { domain: "tax", score: 1, action: "Holistiplan tax analysis — identify deduction opportunities", products: "Holistiplan", cadence: "14-day" },
  { domain: "tax", score: 2, action: "Evaluate Roth conversion and tax-loss harvesting", products: "Advisory/AUM", cadence: "90-day" },
  { domain: "tax", score: 3, action: "Pre-year-end tax planning review", products: "Holistiplan", cadence: "annual" },
  { domain: "education", score: 1, action: "Open 529 plan and set up automatic contributions", products: "AZ 529 Plan", cadence: "14-day" },
  { domain: "education", score: 2, action: "Review 529 balance vs projected costs, adjust contributions", products: "AZ 529 + IUL supplement", cadence: "90-day" },
  { domain: "education", score: 3, action: "Annual education funding review", products: "Existing 529", cadence: "annual" },
  { domain: "growth", score: 1, action: "Compare IUL vs taxable growth — start monthly contributions", products: "NLG IUL", cadence: "14-day" },
  { domain: "growth", score: 2, action: "Diversify investment mix, review risk tolerance alignment", products: "ESI Advisory/AUM", cadence: "90-day" },
  { domain: "growth", score: 3, action: "Annual portfolio rebalancing review", products: "Advisory/AUM", cadence: "annual" },
  { domain: "debt", score: 1, action: "Debt snowball/avalanche plan — prioritize high-interest debt", products: "Cash flow analysis", cadence: "14-day" },
  { domain: "debt", score: 2, action: "Consolidation analysis, review progress", products: "Advisory", cadence: "90-day" },
  { domain: "debt", score: 3, action: "Annual debt review and payoff timeline update", products: "Financial review", cadence: "annual" },
  { domain: "business", score: 1, action: "Buy-sell agreement and key person insurance review", products: "NLG Business Insurance", cadence: "14-day" },
  { domain: "business", score: 2, action: "Succession planning and exec comp strategy", products: "NLG §162/SERP", cadence: "90-day" },
  { domain: "business", score: 3, action: "Annual business valuation and exit planning review", products: "Advisory", cadence: "annual" },
  { domain: "cash_flow", score: 1, action: "Emergency fund to 6 months, automate savings", products: "Cash management", cadence: "14-day" },
  { domain: "cash_flow", score: 2, action: "Review spending vs budget, optimize savings rate", products: "Financial planning", cadence: "90-day" },
  { domain: "cash_flow", score: 3, action: "Annual cash flow optimization review", products: "Advisory", cadence: "annual" },
];
export async function seed() {
  console.log(`[seed:31] Holistic summary actions: ${ACTIONS.length} action items defined (9 domains × 3 score levels)`);
}
if (import.meta.url === `file://${process.argv[1]}`) seed();
