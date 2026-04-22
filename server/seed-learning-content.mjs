/**
 * seed-learning-content.mjs — Seed comprehensive financial planning learning content
 * 
 * Populates: learning_disciplines, learning_definitions, learning_tracks,
 * learning_chapters, learning_practice_questions, learning_flashcards, learning_cases
 */
import mysql from "mysql2/promise";
import { config } from "dotenv";
config();

const pool = mysql.createPool(process.env.DATABASE_URL);

async function run() {
  const conn = await pool.getConnection();
  try {
    // ═══ 1. DISCIPLINES ═══
    const disciplines = [
      { slug: "financial-planning", name: "Financial Planning Fundamentals", description: "Core principles of comprehensive financial planning including goal setting, budgeting, and the financial planning process.", color: "#2563eb", icon: "Target", sortOrder: 1 },
      { slug: "investment-management", name: "Investment Management", description: "Portfolio theory, asset allocation, security analysis, and investment strategies for wealth accumulation.", color: "#059669", icon: "TrendingUp", sortOrder: 2 },
      { slug: "tax-planning", name: "Tax Planning & Strategy", description: "Federal and state tax law, tax-efficient investing, deductions, credits, and strategic tax minimization.", color: "#d97706", icon: "Receipt", sortOrder: 3 },
      { slug: "retirement-planning", name: "Retirement Planning", description: "Qualified and non-qualified plans, Social Security, distribution strategies, and retirement income planning.", color: "#7c3aed", icon: "Sunset", sortOrder: 4 },
      { slug: "estate-planning", name: "Estate Planning", description: "Wills, trusts, estate tax, gifting strategies, and wealth transfer techniques.", color: "#dc2626", icon: "Shield", sortOrder: 5 },
      { slug: "insurance-planning", name: "Insurance & Risk Management", description: "Life, health, disability, property, and liability insurance analysis and planning.", color: "#0891b2", icon: "Umbrella", sortOrder: 6 },
      { slug: "behavioral-finance", name: "Behavioral Finance", description: "Cognitive biases, heuristics, prospect theory, and their impact on financial decision-making.", color: "#be185d", icon: "Brain", sortOrder: 7 },
      { slug: "ethics-regulations", name: "Ethics & Regulations", description: "Fiduciary duty, compliance, regulatory frameworks, and professional standards in financial planning.", color: "#4338ca", icon: "Scale", sortOrder: 8 },
      { slug: "debt-management", name: "Debt Management", description: "Consumer and business debt strategies, credit analysis, refinancing, and debt reduction methods.", color: "#b91c1c", icon: "CreditCard", sortOrder: 9 },
      { slug: "business-planning", name: "Business Planning & Succession", description: "Business valuation, buy-sell agreements, succession planning, and entity selection.", color: "#0d9488", icon: "Building2", sortOrder: 10 },
      { slug: "education-planning", name: "Education Planning", description: "529 plans, Coverdell ESAs, financial aid strategies, and education funding vehicles.", color: "#6366f1", icon: "GraduationCap", sortOrder: 11 },
      { slug: "real-estate", name: "Real Estate & Alternative Investments", description: "REITs, direct ownership, alternative investments, and real estate tax strategies.", color: "#ca8a04", icon: "Home", sortOrder: 12 },
    ];

    for (const d of disciplines) {
      await conn.execute(
        `INSERT IGNORE INTO learning_disciplines (slug, name, description, color, icon, sort_order, is_core, visibility, status) VALUES (?, ?, ?, ?, ?, ?, 1, 'public', 'active')`,
        [d.slug, d.name, d.description, d.color, d.icon, d.sortOrder]
      );
    }
    console.log(`Seeded ${disciplines.length} disciplines`);

    // Get discipline IDs
    const [discRows] = await conn.execute("SELECT id, slug FROM learning_disciplines");
    const discMap = {};
    for (const r of discRows) discMap[r.slug] = r.id;

    // ═══ 2. DEFINITIONS (Terms) ═══
    const definitions = [
      // Financial Planning
      { disc: "financial-planning", term: "Net Worth", definition: "The difference between total assets and total liabilities. A fundamental measure of financial health that provides a snapshot of an individual's or household's financial position at a point in time." },
      { disc: "financial-planning", term: "Emergency Fund", definition: "A liquid reserve of 3-6 months of essential expenses held in accessible accounts to cover unexpected financial needs without disrupting long-term investment strategies." },
      { disc: "financial-planning", term: "Cash Flow Statement", definition: "A financial document tracking all income sources and expenditures over a period, essential for budgeting, identifying savings potential, and monitoring spending patterns." },
      { disc: "financial-planning", term: "Financial Planning Process", definition: "The six-step systematic approach: (1) establish relationship, (2) gather data, (3) analyze, (4) develop recommendations, (5) implement, (6) monitor. Defined by CFP Board standards." },
      { disc: "financial-planning", term: "Time Value of Money", definition: "The concept that money available today is worth more than the same amount in the future due to its potential earning capacity. Foundation of all financial calculations including PV, FV, NPV, and IRR." },
      { disc: "financial-planning", term: "SMART Goals", definition: "Goal-setting framework requiring objectives to be Specific, Measurable, Achievable, Relevant, and Time-bound. Applied in financial planning to create actionable savings and investment targets." },
      { disc: "financial-planning", term: "Debt-to-Income Ratio", definition: "Total monthly debt payments divided by gross monthly income. Lenders typically prefer ratios below 36% for mortgage qualification. A key metric for assessing borrowing capacity." },
      { disc: "financial-planning", term: "Liquidity", definition: "The ease with which an asset can be converted to cash without significant loss of value. Cash and money market funds are highly liquid; real estate and private equity are illiquid." },
      // Investment Management
      { disc: "investment-management", term: "Modern Portfolio Theory (MPT)", definition: "Framework developed by Harry Markowitz showing that portfolio risk can be reduced through diversification. Investors should evaluate investments based on their contribution to overall portfolio risk and return, not in isolation." },
      { disc: "investment-management", term: "Efficient Frontier", definition: "The set of optimal portfolios offering the highest expected return for a given level of risk. Portfolios below the frontier are suboptimal; those above are unattainable." },
      { disc: "investment-management", term: "Alpha", definition: "The excess return of an investment relative to its benchmark index. Positive alpha indicates outperformance; negative alpha indicates underperformance after adjusting for risk." },
      { disc: "investment-management", term: "Beta", definition: "A measure of systematic risk representing the sensitivity of a security's returns to market movements. Beta of 1.0 means the security moves with the market; >1.0 is more volatile; <1.0 is less volatile." },
      { disc: "investment-management", term: "Sharpe Ratio", definition: "Risk-adjusted return metric calculated as (Portfolio Return - Risk-Free Rate) / Portfolio Standard Deviation. Higher values indicate better risk-adjusted performance." },
      { disc: "investment-management", term: "Asset Allocation", definition: "The strategic distribution of investments across asset classes (stocks, bonds, cash, alternatives) based on an investor's goals, risk tolerance, and time horizon. The primary driver of portfolio returns." },
      { disc: "investment-management", term: "Dollar-Cost Averaging", definition: "Investment strategy of regularly investing a fixed dollar amount regardless of market conditions. Reduces the impact of volatility by purchasing more shares when prices are low and fewer when high." },
      { disc: "investment-management", term: "Rebalancing", definition: "The process of realigning portfolio weights to target allocation by selling overweight positions and buying underweight ones. Maintains risk profile and can improve risk-adjusted returns." },
      // Tax Planning
      { disc: "tax-planning", term: "Marginal Tax Rate", definition: "The tax rate applied to the last dollar of taxable income. Under the progressive U.S. tax system, income is taxed at increasing rates across brackets (10%, 12%, 22%, 24%, 32%, 35%, 37%)." },
      { disc: "tax-planning", term: "Effective Tax Rate", definition: "Total tax paid divided by total taxable income. Always lower than the marginal rate under a progressive system because lower brackets are taxed at lower rates." },
      { disc: "tax-planning", term: "Tax-Loss Harvesting", definition: "Strategy of selling investments at a loss to offset capital gains, reducing tax liability. Up to $3,000 of net losses can offset ordinary income annually, with excess carried forward." },
      { disc: "tax-planning", term: "Qualified Dividend", definition: "Dividend from a domestic or qualifying foreign corporation held for the required period, taxed at preferential long-term capital gains rates (0%, 15%, or 20%) rather than ordinary income rates." },
      { disc: "tax-planning", term: "Capital Gains", definition: "Profit from selling an asset for more than its cost basis. Short-term gains (held <1 year) taxed as ordinary income; long-term gains (held >1 year) taxed at preferential rates of 0%, 15%, or 20%." },
      { disc: "tax-planning", term: "AMT (Alternative Minimum Tax)", definition: "A parallel tax system designed to ensure high-income taxpayers pay a minimum amount of tax. Requires recalculation of taxable income by adding back certain deductions and preferences." },
      // Retirement Planning
      { disc: "retirement-planning", term: "401(k) Plan", definition: "Employer-sponsored defined contribution plan allowing pre-tax or Roth contributions up to annual limits ($23,500 in 2025, plus $7,500 catch-up for age 50+). Often includes employer matching." },
      { disc: "retirement-planning", term: "Roth IRA", definition: "Individual retirement account funded with after-tax dollars. Qualified distributions are tax-free. Income limits apply for direct contributions. No RMDs during owner's lifetime." },
      { disc: "retirement-planning", term: "Required Minimum Distribution (RMD)", definition: "Mandatory annual withdrawals from tax-deferred retirement accounts beginning at age 73 (SECURE 2.0 Act). Calculated by dividing account balance by IRS life expectancy factor." },
      { disc: "retirement-planning", term: "Social Security Full Retirement Age", definition: "The age at which a worker receives 100% of their Primary Insurance Amount. Currently 67 for those born in 1960 or later. Claiming early reduces benefits; delaying increases them up to age 70." },
      { disc: "retirement-planning", term: "4% Rule", definition: "Guideline suggesting retirees can withdraw 4% of their portfolio in the first year of retirement, adjusting for inflation annually, with a high probability of not outliving their savings over 30 years." },
      { disc: "retirement-planning", term: "Roth Conversion", definition: "Moving funds from a traditional IRA or 401(k) to a Roth IRA, paying income tax on the converted amount. Strategic in low-income years or when expecting higher future tax rates." },
      // Estate Planning
      { disc: "estate-planning", term: "Revocable Living Trust", definition: "A trust created during the grantor's lifetime that can be modified or revoked. Avoids probate, provides privacy, and allows seamless management during incapacity. Does not provide estate tax benefits." },
      { disc: "estate-planning", term: "Irrevocable Life Insurance Trust (ILIT)", definition: "A trust that owns a life insurance policy, removing the death benefit from the insured's taxable estate. Requires Crummey notices for gift tax annual exclusion treatment of premium payments." },
      { disc: "estate-planning", term: "Annual Gift Tax Exclusion", definition: "The amount an individual can gift to any number of recipients per year without filing a gift tax return or using lifetime exemption. $18,000 per recipient in 2024 ($19,000 in 2025)." },
      { disc: "estate-planning", term: "Unified Credit", definition: "The federal estate and gift tax exemption amount ($13.61 million per individual in 2024). Amounts transferred above this threshold are taxed at 40%. Scheduled to sunset to approximately $7 million in 2026." },
      { disc: "estate-planning", term: "Step-Up in Basis", definition: "At death, inherited assets receive a new cost basis equal to fair market value, eliminating unrealized capital gains. A powerful estate planning tool that reduces income tax for heirs." },
      // Insurance Planning
      { disc: "insurance-planning", term: "Term Life Insurance", definition: "Pure death benefit coverage for a specified period (10, 20, or 30 years). No cash value accumulation. Most cost-effective form of life insurance for income replacement needs." },
      { disc: "insurance-planning", term: "Whole Life Insurance", definition: "Permanent life insurance with guaranteed death benefit, fixed premiums, and cash value that grows at a guaranteed rate. Offers tax-deferred growth and potential dividends from mutual companies." },
      { disc: "insurance-planning", term: "Disability Insurance", definition: "Income replacement coverage paying a percentage of earnings (typically 60-70%) if the insured cannot work due to illness or injury. Own-occupation policies are most favorable for professionals." },
      { disc: "insurance-planning", term: "Umbrella Liability Policy", definition: "Excess liability coverage above underlying auto and homeowner's policy limits. Typically provides $1-5 million in additional protection at relatively low cost. Essential for high-net-worth individuals." },
      { disc: "insurance-planning", term: "Long-Term Care Insurance", definition: "Coverage for extended care services (nursing home, assisted living, home health) not covered by Medicare. Benefit triggers typically require inability to perform 2 of 6 ADLs or cognitive impairment." },
      // Behavioral Finance
      { disc: "behavioral-finance", term: "Loss Aversion", definition: "The tendency for losses to feel approximately twice as painful as equivalent gains feel pleasurable. Identified by Kahneman and Tversky. Causes investors to hold losing positions too long and sell winners too early." },
      { disc: "behavioral-finance", term: "Confirmation Bias", definition: "The tendency to seek, interpret, and remember information that confirms pre-existing beliefs while ignoring contradictory evidence. Leads to overconfidence in investment decisions." },
      { disc: "behavioral-finance", term: "Anchoring", definition: "Cognitive bias where individuals rely too heavily on the first piece of information encountered. In investing, anchoring to purchase price can prevent rational sell decisions." },
      { disc: "behavioral-finance", term: "Herd Behavior", definition: "The tendency to follow the crowd in investment decisions rather than conducting independent analysis. Contributes to market bubbles and crashes. Contrarian strategies exploit this bias." },
      { disc: "behavioral-finance", term: "Recency Bias", definition: "Overweighting recent events when making decisions. Investors experiencing recent gains become overconfident; those experiencing losses become overly risk-averse. Distorts asset allocation decisions." },
      // Ethics & Regulations
      { disc: "ethics-regulations", term: "Fiduciary Duty", definition: "The legal obligation to act in the client's best interest, placing their needs above the advisor's own. Applies to RIAs, CFP professionals, and ERISA plan fiduciaries. Higher standard than suitability." },
      { disc: "ethics-regulations", term: "Suitability Standard", definition: "Requirement that recommendations be appropriate for the client based on their financial situation and needs. A lower standard than fiduciary duty, historically applied to broker-dealers under FINRA rules." },
      { disc: "ethics-regulations", term: "Regulation Best Interest (Reg BI)", definition: "SEC rule requiring broker-dealers to act in the retail customer's best interest when making recommendations. Requires disclosure, care, conflict mitigation, and compliance obligations." },
      { disc: "ethics-regulations", term: "Form ADV", definition: "SEC registration document for investment advisers. Part 1 contains firm information; Part 2 (the brochure) discloses services, fees, conflicts, and disciplinary history. Must be delivered to clients." },
      // Debt Management
      { disc: "debt-management", term: "Debt Avalanche Method", definition: "Debt repayment strategy prioritizing the highest-interest-rate debt first while making minimum payments on others. Mathematically optimal for minimizing total interest paid." },
      { disc: "debt-management", term: "Debt Snowball Method", definition: "Debt repayment strategy prioritizing the smallest balance first for psychological wins. While not mathematically optimal, behavioral research shows higher completion rates due to motivation from quick wins." },
      // Business Planning
      { disc: "business-planning", term: "Buy-Sell Agreement", definition: "Legal contract governing the transfer of business ownership upon triggering events (death, disability, retirement, divorce). Funded by life insurance, installment notes, or sinking funds." },
      { disc: "business-planning", term: "Business Valuation Methods", definition: "Three primary approaches: (1) Income approach (DCF, capitalization of earnings), (2) Market approach (comparable transactions), (3) Asset approach (adjusted book value). Selection depends on business type and purpose." },
      // Education Planning
      { disc: "education-planning", term: "529 Plan", definition: "Tax-advantaged savings plan for education expenses. Contributions grow tax-free; qualified withdrawals are tax-free. State tax deductions may apply. Can now roll over to Roth IRA under SECURE 2.0 (up to $35,000 lifetime)." },
      { disc: "education-planning", term: "FAFSA (Free Application for Federal Student Aid)", definition: "Federal form determining eligibility for grants, loans, and work-study. Uses Student Aid Index (SAI) replacing Expected Family Contribution. Filed annually starting October 1." },
      // Real Estate
      { disc: "real-estate", term: "REIT (Real Estate Investment Trust)", definition: "Company owning income-producing real estate that must distribute 90%+ of taxable income as dividends. Provides real estate exposure with stock-market liquidity. Dividends generally taxed as ordinary income." },
      { disc: "real-estate", term: "1031 Exchange", definition: "Tax-deferred exchange of like-kind investment properties under IRC Section 1031. Must identify replacement property within 45 days and close within 180 days. Defers capital gains tax indefinitely." },
    ];

    let defCount = 0;
    for (const d of definitions) {
      const discId = discMap[d.disc];
      if (!discId) continue;
      const [existing] = await conn.execute(
        "SELECT id FROM learning_definitions WHERE discipline_id = ? AND term = ?",
        [discId, d.term]
      );
      if (existing.length === 0) {
        await conn.execute(
          `INSERT INTO learning_definitions (discipline_id, term, definition, visibility, status, version) VALUES (?, ?, ?, 'public', 'published', 1)`,
          [discId, d.term, d.definition]
        );
        defCount++;
      }
    }
    console.log(`Seeded ${defCount} definitions (${definitions.length} total, skipped existing)`);

    // ═══ 3. EXAM TRACKS ═══
    const tracks = [
      { slug: "cfp-fundamentals", name: "CFP Fundamentals", category: "planning", title: "CFP Exam Preparation — Fundamentals", subtitle: "Core financial planning principles for CFP certification", color: "#2563eb", emoji: "📋", tagline: "Master the six-step financial planning process" },
      { slug: "series-65", name: "Series 65", category: "securities", title: "Series 65 — Investment Adviser Law", subtitle: "Uniform Investment Adviser Law Examination", color: "#059669", emoji: "📊", tagline: "Securities regulation and fiduciary standards" },
      { slug: "series-7", name: "Series 7", category: "securities", title: "Series 7 — General Securities Representative", subtitle: "FINRA General Securities Representative Exam", color: "#7c3aed", emoji: "📈", tagline: "Comprehensive securities licensing preparation" },
      { slug: "wealth-management", name: "Wealth Management Essentials", category: "planning", title: "Wealth Management — Core Competencies", subtitle: "Comprehensive wealth advisory skills", color: "#d97706", emoji: "💎", tagline: "Holistic wealth management for HNW clients" },
      { slug: "retirement-specialist", name: "Retirement Planning Specialist", category: "planning", title: "Retirement Planning — Advanced Strategies", subtitle: "Distribution planning, Social Security optimization, and ERISA", color: "#dc2626", emoji: "🏖️", tagline: "Expert-level retirement income strategies" },
      { slug: "estate-tax", name: "Estate & Tax Planning", category: "planning", title: "Estate & Tax — Advanced Planning", subtitle: "Trust structures, gifting strategies, and tax optimization", color: "#4338ca", emoji: "🏛️", tagline: "Sophisticated estate and tax planning techniques" },
      { slug: "insurance-fundamentals", name: "Insurance Fundamentals", category: "insurance", title: "Insurance — Risk Management Principles", subtitle: "Life, health, disability, and property insurance analysis", color: "#0891b2", emoji: "🛡️", tagline: "Comprehensive insurance and risk management" },
      { slug: "behavioral-advisor", name: "Behavioral Finance for Advisors", category: "custom", title: "Behavioral Finance — Client Psychology", subtitle: "Understanding and managing client behavioral biases", color: "#be185d", emoji: "🧠", tagline: "Apply behavioral insights to improve client outcomes" },
    ];

    for (const t of tracks) {
      await conn.execute(
        `INSERT IGNORE INTO learning_tracks (slug, name, category, title, subtitle, color, emoji, tagline, visibility, status, version, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'public', 'published', 1, ?)`,
        [t.slug, t.name, t.category, t.title, t.subtitle, t.color, t.emoji, t.tagline, tracks.indexOf(t) + 1]
      );
    }
    console.log(`Seeded ${tracks.length} exam tracks`);

    // Get track IDs
    const [trackRows] = await conn.execute("SELECT id, slug FROM learning_tracks");
    const trackMap = {};
    for (const r of trackRows) trackMap[r.slug] = r.id;

    // ═══ 4. CHAPTERS ═══
    const chapters = [
      // CFP Fundamentals
      { track: "cfp-fundamentals", title: "The Financial Planning Process", intro: "Understanding the six-step financial planning process as defined by the CFP Board.", sortOrder: 1 },
      { track: "cfp-fundamentals", title: "Time Value of Money", intro: "Mastering present value, future value, annuities, and their applications in financial planning.", sortOrder: 2 },
      { track: "cfp-fundamentals", title: "Client Communication & Ethics", intro: "Building client relationships, understanding behavioral biases, and maintaining ethical standards.", sortOrder: 3 },
      { track: "cfp-fundamentals", title: "Budgeting & Cash Flow Management", intro: "Analyzing income, expenses, and creating sustainable financial plans.", sortOrder: 4 },
      // Series 65
      { track: "series-65", title: "Economic Factors & Business Information", intro: "Understanding economic indicators, business cycles, and their impact on investment decisions.", sortOrder: 1 },
      { track: "series-65", title: "Investment Vehicle Characteristics", intro: "Stocks, bonds, options, mutual funds, ETFs, and alternative investments.", sortOrder: 2 },
      { track: "series-65", title: "Client Investment Recommendations", intro: "Suitability, asset allocation, portfolio management, and performance measurement.", sortOrder: 3 },
      { track: "series-65", title: "Laws, Regulations, and Guidelines", intro: "Uniform Securities Act, SEC regulations, and ethical practices.", sortOrder: 4 },
      // Wealth Management
      { track: "wealth-management", title: "Wealth Accumulation Strategies", intro: "Tax-efficient investing, asset location, and systematic wealth building approaches.", sortOrder: 1 },
      { track: "wealth-management", title: "Risk Management & Insurance", intro: "Identifying, analyzing, and mitigating financial risks through insurance and other tools.", sortOrder: 2 },
      { track: "wealth-management", title: "Tax Planning Integration", intro: "Coordinating tax strategies across income, investments, retirement, and estate planning.", sortOrder: 3 },
      { track: "wealth-management", title: "Client Relationship Management", intro: "Building trust, managing expectations, and delivering comprehensive wealth advisory services.", sortOrder: 4 },
      // Retirement Specialist
      { track: "retirement-specialist", title: "Qualified Retirement Plans", intro: "401(k), 403(b), pension plans, and ERISA requirements.", sortOrder: 1 },
      { track: "retirement-specialist", title: "IRA Strategies", intro: "Traditional IRA, Roth IRA, conversions, and contribution strategies.", sortOrder: 2 },
      { track: "retirement-specialist", title: "Social Security Optimization", intro: "Claiming strategies, spousal benefits, and integration with retirement income.", sortOrder: 3 },
      { track: "retirement-specialist", title: "Distribution Planning", intro: "RMDs, withdrawal sequencing, and tax-efficient distribution strategies.", sortOrder: 4 },
      // Estate & Tax
      { track: "estate-tax", title: "Estate Planning Fundamentals", intro: "Wills, trusts, powers of attorney, and healthcare directives.", sortOrder: 1 },
      { track: "estate-tax", title: "Trust Structures", intro: "Revocable trusts, irrevocable trusts, GRATs, QPRTs, and charitable trusts.", sortOrder: 2 },
      { track: "estate-tax", title: "Gift & Estate Tax Strategies", intro: "Annual exclusions, lifetime exemptions, and tax minimization techniques.", sortOrder: 3 },
      { track: "estate-tax", title: "Business Succession Planning", intro: "Buy-sell agreements, family limited partnerships, and ownership transfer.", sortOrder: 4 },
      // Insurance
      { track: "insurance-fundamentals", title: "Life Insurance Analysis", intro: "Term, whole life, universal life, and variable life insurance comparison and selection.", sortOrder: 1 },
      { track: "insurance-fundamentals", title: "Health & Disability Insurance", intro: "Health insurance options, disability income protection, and long-term care planning.", sortOrder: 2 },
      { track: "insurance-fundamentals", title: "Property & Casualty Insurance", intro: "Homeowner's, auto, umbrella, and professional liability coverage.", sortOrder: 3 },
      // Behavioral Finance
      { track: "behavioral-advisor", title: "Cognitive Biases in Investing", intro: "Understanding how mental shortcuts lead to systematic errors in financial decision-making.", sortOrder: 1 },
      { track: "behavioral-advisor", title: "Prospect Theory & Loss Aversion", intro: "How people evaluate gains and losses asymmetrically and its impact on portfolio decisions.", sortOrder: 2 },
      { track: "behavioral-advisor", title: "Advisor-Client Communication", intro: "Techniques for recognizing and mitigating client biases through effective communication.", sortOrder: 3 },
    ];

    let chapCount = 0;
    for (const c of chapters) {
      const trackId = trackMap[c.track];
      if (!trackId) continue;
      const [existing] = await conn.execute(
        "SELECT id FROM learning_chapters WHERE track_id = ? AND title = ?",
        [trackId, c.title]
      );
      if (existing.length === 0) {
        await conn.execute(
          `INSERT INTO learning_chapters (track_id, title, intro, sort_order, status) VALUES (?, ?, ?, ?, 'published')`,
          [trackId, c.title, c.intro, c.sortOrder]
        );
        chapCount++;
      }
    }
    console.log(`Seeded ${chapCount} chapters`);

    // Get chapter IDs
    const [chapRows] = await conn.execute("SELECT id, track_id, title FROM learning_chapters");
    const chapMap = {};
    for (const r of chapRows) chapMap[`${r.track_id}-${r.title}`] = r.id;

    // ═══ 5. PRACTICE QUESTIONS ═══
    const questions = [
      // CFP Fundamentals
      { track: "cfp-fundamentals", chapTitle: "The Financial Planning Process", prompt: "Which of the following is the FIRST step in the financial planning process as defined by the CFP Board?", options: ["Gathering client data", "Establishing the client-planner relationship", "Analyzing the client's current situation", "Developing recommendations"], correctIndex: 1, explanation: "The CFP Board defines the first step as establishing and defining the client-planner relationship, including scope of engagement, responsibilities, and compensation.", difficulty: "easy" },
      { track: "cfp-fundamentals", chapTitle: "The Financial Planning Process", prompt: "A financial planner discovers that implementing a recommendation would benefit the planner more than the client. Under CFP Board standards, the planner should:", options: ["Proceed if the recommendation is still suitable", "Disclose the conflict and let the client decide", "Decline to make the recommendation entirely", "Refer the client to another planner"], correctIndex: 1, explanation: "CFP Board standards require disclosure of material conflicts of interest. The planner must disclose the conflict and allow the client to make an informed decision.", difficulty: "medium" },
      { track: "cfp-fundamentals", chapTitle: "Time Value of Money", prompt: "An investor deposits $10,000 today earning 6% compounded annually. What is the approximate value after 12 years using the Rule of 72?", options: ["$15,000", "$17,500", "$20,000", "$22,500"], correctIndex: 2, explanation: "The Rule of 72 estimates doubling time: 72/6 = 12 years. So $10,000 doubles to approximately $20,000 in 12 years at 6% annual return.", difficulty: "easy" },
      { track: "cfp-fundamentals", chapTitle: "Time Value of Money", prompt: "Which of the following increases the present value of a future cash flow?", options: ["Increasing the discount rate", "Increasing the number of periods", "Decreasing the discount rate", "Decreasing the future value"], correctIndex: 2, explanation: "Present value is inversely related to the discount rate. A lower discount rate means future cash flows are worth more today.", difficulty: "medium" },
      // Series 65
      { track: "series-65", chapTitle: "Laws, Regulations, and Guidelines", prompt: "Under the Uniform Securities Act, which of the following is EXEMPT from state registration as a security?", options: ["Common stock of a new tech startup", "U.S. Treasury bonds", "Corporate bonds rated BBB", "Shares of a private REIT"], correctIndex: 1, explanation: "U.S. government securities are exempt from state registration under the Uniform Securities Act. Federal government securities are considered among the safest investments.", difficulty: "medium" },
      { track: "series-65", chapTitle: "Investment Vehicle Characteristics", prompt: "An investor holds a bond with a 5% coupon rate. If market interest rates rise to 7%, what happens to the bond's market price?", options: ["It increases above par", "It remains at par", "It decreases below par", "It depends on the bond's maturity"], correctIndex: 2, explanation: "Bond prices and interest rates have an inverse relationship. When market rates rise above the coupon rate, the bond's price falls below par to make its yield competitive.", difficulty: "easy" },
      { track: "series-65", chapTitle: "Client Investment Recommendations", prompt: "Which portfolio metric best measures risk-adjusted return?", options: ["Total return", "Standard deviation", "Sharpe ratio", "Beta"], correctIndex: 2, explanation: "The Sharpe ratio measures excess return per unit of total risk (standard deviation). It allows comparison of portfolios with different risk levels on a risk-adjusted basis.", difficulty: "medium" },
      // Wealth Management
      { track: "wealth-management", chapTitle: "Tax Planning Integration", prompt: "A high-income client holds both taxable and tax-deferred accounts. Which asset class should generally be placed in the tax-deferred account?", options: ["Municipal bonds", "Growth stocks", "REITs and high-yield bonds", "Index funds with low turnover"], correctIndex: 2, explanation: "Asset location strategy places tax-inefficient assets (REITs, high-yield bonds generating ordinary income) in tax-deferred accounts and tax-efficient assets (index funds, growth stocks) in taxable accounts.", difficulty: "hard" },
      { track: "wealth-management", chapTitle: "Wealth Accumulation Strategies", prompt: "Dollar-cost averaging is MOST beneficial when:", options: ["Markets are consistently rising", "Markets are consistently falling", "Markets are volatile with no clear trend", "The investor has a large lump sum to invest"], correctIndex: 2, explanation: "Dollar-cost averaging works best in volatile markets because the fixed investment amount buys more shares when prices are low and fewer when high, resulting in a lower average cost per share.", difficulty: "medium" },
      // Retirement
      { track: "retirement-specialist", chapTitle: "Social Security Optimization", prompt: "A worker born in 1960 claims Social Security at age 62. By what percentage are benefits permanently reduced compared to full retirement age?", options: ["20%", "25%", "30%", "35%"], correctIndex: 2, explanation: "For workers born in 1960 or later, FRA is 67. Claiming at 62 (60 months early) results in a 30% permanent reduction in benefits (5/9 of 1% per month for first 36 months + 5/12 of 1% per month for remaining 24 months).", difficulty: "hard" },
      { track: "retirement-specialist", chapTitle: "Distribution Planning", prompt: "Under SECURE 2.0 Act, at what age must most retirement account holders begin taking Required Minimum Distributions (RMDs)?", options: ["70½", "72", "73", "75"], correctIndex: 2, explanation: "SECURE 2.0 Act raised the RMD age to 73 for those turning 72 after 2022. It will increase to 75 starting in 2033.", difficulty: "easy" },
      { track: "retirement-specialist", chapTitle: "IRA Strategies", prompt: "Which of the following is a key advantage of a Roth conversion in a low-income year?", options: ["It reduces current year RMDs", "The conversion amount is tax-free", "Lower marginal tax rate on the converted amount", "It increases the annual contribution limit"], correctIndex: 2, explanation: "Converting in a low-income year means the converted amount is taxed at a lower marginal rate, maximizing the benefit of future tax-free growth and distributions.", difficulty: "medium" },
      // Estate & Tax
      { track: "estate-tax", chapTitle: "Gift & Estate Tax Strategies", prompt: "In 2024, what is the annual gift tax exclusion per recipient?", options: ["$15,000", "$16,000", "$17,000", "$18,000"], correctIndex: 3, explanation: "The 2024 annual gift tax exclusion is $18,000 per recipient ($19,000 in 2025). Married couples can gift $36,000 per recipient through gift splitting.", difficulty: "easy" },
      { track: "estate-tax", chapTitle: "Trust Structures", prompt: "Which type of trust removes assets from the grantor's taxable estate while potentially providing income to the grantor?", options: ["Revocable living trust", "Grantor Retained Annuity Trust (GRAT)", "Testamentary trust", "Totten trust"], correctIndex: 1, explanation: "A GRAT allows the grantor to transfer assets to an irrevocable trust while retaining an annuity payment for a specified term. Appreciation above the Section 7520 rate passes to beneficiaries estate-tax-free.", difficulty: "hard" },
      // Insurance
      { track: "insurance-fundamentals", chapTitle: "Life Insurance Analysis", prompt: "Which type of life insurance provides the LOWEST initial premium for the highest death benefit?", options: ["Whole life", "Universal life", "Variable life", "Term life"], correctIndex: 3, explanation: "Term life insurance provides pure death benefit protection without cash value accumulation, resulting in the lowest premiums per dollar of coverage. Ideal for temporary needs like income replacement during working years.", difficulty: "easy" },
      // Behavioral Finance
      { track: "behavioral-advisor", chapTitle: "Cognitive Biases in Investing", prompt: "An investor refuses to sell a stock that has declined 40% because they 'don't want to take a loss.' This is an example of:", options: ["Anchoring bias", "Confirmation bias", "Loss aversion / disposition effect", "Availability bias"], correctIndex: 2, explanation: "Loss aversion causes investors to feel losses more intensely than gains. The disposition effect specifically describes the tendency to hold losers too long (avoiding the pain of realizing a loss) and sell winners too early.", difficulty: "medium" },
      { track: "behavioral-advisor", chapTitle: "Prospect Theory & Loss Aversion", prompt: "According to prospect theory, which of the following best describes how people evaluate outcomes?", options: ["People evaluate outcomes in absolute terms", "People are risk-neutral for all decisions", "People evaluate outcomes relative to a reference point", "People always maximize expected utility"], correctIndex: 2, explanation: "Prospect theory, developed by Kahneman and Tversky, shows that people evaluate outcomes relative to a reference point (usually the status quo), not in absolute terms. This leads to risk-seeking behavior for losses and risk-averse behavior for gains.", difficulty: "medium" },
    ];

    let qCount = 0;
    for (const q of questions) {
      const trackId = trackMap[q.track];
      if (!trackId) continue;
      const chapId = chapMap[`${trackId}-${q.chapTitle}`];
      const [existing] = await conn.execute(
        "SELECT id FROM learning_practice_questions WHERE track_id = ? AND prompt = ?",
        [trackId, q.prompt]
      );
      if (existing.length === 0) {
        await conn.execute(
          `INSERT INTO learning_practice_questions (track_id, chapter_id, prompt, options, correct_index, explanation, difficulty, source, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', 'published')`,
          [trackId, chapId || null, q.prompt, JSON.stringify(q.options), q.correctIndex, q.explanation, q.difficulty]
        );
        qCount++;
      }
    }
    console.log(`Seeded ${qCount} practice questions`);

    // ═══ 6. FLASHCARDS ═══
    const flashcards = [
      // CFP Fundamentals
      { track: "cfp-fundamentals", chapTitle: "The Financial Planning Process", term: "Financial Planning Process", definition: "Six steps: (1) Establish relationship, (2) Gather data, (3) Analyze, (4) Develop recommendations, (5) Implement, (6) Monitor and update." },
      { track: "cfp-fundamentals", chapTitle: "Time Value of Money", term: "Rule of 72", definition: "Quick estimation: Years to double = 72 / Annual Rate. Example: At 8%, money doubles in ~9 years." },
      { track: "cfp-fundamentals", chapTitle: "Time Value of Money", term: "Present Value Formula", definition: "PV = FV / (1 + r)^n. The current worth of a future sum discounted at rate r over n periods." },
      { track: "cfp-fundamentals", chapTitle: "Time Value of Money", term: "Future Value Formula", definition: "FV = PV x (1 + r)^n. The value of a current sum grown at rate r over n periods." },
      { track: "cfp-fundamentals", chapTitle: "Client Communication & Ethics", term: "Fiduciary Standard", definition: "Legal obligation to act in client's best interest. Higher than suitability. Required of RIAs, CFP professionals, and ERISA fiduciaries." },
      // Series 65
      { track: "series-65", chapTitle: "Investment Vehicle Characteristics", term: "Bond Price vs Interest Rate", definition: "Inverse relationship: when rates rise, bond prices fall. Longer duration = greater price sensitivity." },
      { track: "series-65", chapTitle: "Investment Vehicle Characteristics", term: "Mutual Fund NAV", definition: "Net Asset Value = (Total Assets - Total Liabilities) / Shares Outstanding. Calculated daily at market close." },
      { track: "series-65", chapTitle: "Client Investment Recommendations", term: "Sharpe Ratio", definition: "(Portfolio Return - Risk-Free Rate) / Standard Deviation. Measures excess return per unit of total risk. Higher = better." },
      { track: "series-65", chapTitle: "Client Investment Recommendations", term: "Alpha", definition: "Excess return vs benchmark after adjusting for risk. Positive alpha = outperformance. Negative = underperformance." },
      { track: "series-65", chapTitle: "Laws, Regulations, and Guidelines", term: "Investment Adviser Definition", definition: "Under USA: person who (1) provides advice about securities, (2) as a regular business, (3) for compensation. All three prongs required." },
      // Wealth Management
      { track: "wealth-management", chapTitle: "Tax Planning Integration", term: "Asset Location Strategy", definition: "Place tax-inefficient assets (bonds, REITs) in tax-deferred accounts; tax-efficient assets (index funds, growth stocks) in taxable accounts." },
      { track: "wealth-management", chapTitle: "Wealth Accumulation Strategies", term: "Dollar-Cost Averaging", definition: "Investing fixed amounts at regular intervals regardless of price. Reduces impact of volatility. Buys more shares when prices are low." },
      { track: "wealth-management", chapTitle: "Risk Management & Insurance", term: "Human Life Value", definition: "Method to calculate life insurance needs based on present value of future earnings, adjusted for taxes, benefits, and personal consumption." },
      // Retirement
      { track: "retirement-specialist", chapTitle: "Qualified Retirement Plans", term: "401(k) Contribution Limits (2025)", definition: "Employee: $23,500. Catch-up (50+): additional $7,500. Total (employer + employee): $70,000." },
      { track: "retirement-specialist", chapTitle: "IRA Strategies", term: "Roth IRA Advantages", definition: "Tax-free growth, tax-free qualified distributions, no RMDs during owner's lifetime, tax-free inheritance for beneficiaries." },
      { track: "retirement-specialist", chapTitle: "Social Security Optimization", term: "Delayed Retirement Credits", definition: "8% increase per year for each year benefits are delayed past FRA up to age 70. Maximum benefit at 70 is 124% of PIA for those with FRA of 67." },
      { track: "retirement-specialist", chapTitle: "Distribution Planning", term: "Withdrawal Sequencing", definition: "General order: (1) Taxable accounts, (2) Tax-deferred (Traditional IRA/401k), (3) Tax-free (Roth). Optimize by filling lower tax brackets." },
      // Estate & Tax
      { track: "estate-tax", chapTitle: "Estate Planning Fundamentals", term: "Probate", definition: "Court-supervised process of validating a will and distributing assets. Can be avoided with revocable trusts, beneficiary designations, and joint ownership." },
      { track: "estate-tax", chapTitle: "Gift & Estate Tax Strategies", term: "Unified Credit (2024)", definition: "$13.61 million per individual ($27.22 million per couple). Amounts above taxed at 40%. Scheduled to sunset to ~$7M in 2026." },
      { track: "estate-tax", chapTitle: "Trust Structures", term: "GRAT (Grantor Retained Annuity Trust)", definition: "Irrevocable trust paying grantor an annuity for a term. Appreciation above 7520 rate passes to beneficiaries estate-tax-free. Zeroed-out GRATs minimize gift tax." },
      // Insurance
      { track: "insurance-fundamentals", chapTitle: "Life Insurance Analysis", term: "Term vs Permanent Insurance", definition: "Term: pure death benefit, lowest cost, temporary. Permanent: death benefit + cash value, higher cost, lifetime coverage. Choose based on need duration." },
      { track: "insurance-fundamentals", chapTitle: "Health & Disability Insurance", term: "Own-Occupation Disability", definition: "Pays benefits if unable to perform duties of YOUR specific occupation. More favorable than any-occupation. Critical for specialists and high earners." },
      // Behavioral Finance
      { track: "behavioral-advisor", chapTitle: "Cognitive Biases in Investing", term: "Anchoring Bias", definition: "Over-relying on first information received. Example: anchoring to a stock's purchase price when deciding to sell, ignoring current fundamentals." },
      { track: "behavioral-advisor", chapTitle: "Prospect Theory & Loss Aversion", term: "Loss Aversion Ratio", definition: "Losses feel ~2x as painful as equivalent gains feel pleasurable. Leads to disposition effect: holding losers too long, selling winners too early." },
      { track: "behavioral-advisor", chapTitle: "Advisor-Client Communication", term: "Framing Effect", definition: "How information is presented affects decisions. '90% survival rate' feels different from '10% mortality rate.' Advisors should frame options carefully." },
    ];

    let fcCount = 0;
    for (const f of flashcards) {
      const trackId = trackMap[f.track];
      if (!trackId) continue;
      const chapId = chapMap[`${trackId}-${f.chapTitle}`];
      const [existing] = await conn.execute(
        "SELECT id FROM learning_flashcards WHERE track_id = ? AND term = ?",
        [trackId, f.term]
      );
      if (existing.length === 0) {
        await conn.execute(
          `INSERT INTO learning_flashcards (track_id, chapter_id, term, definition, source, status) VALUES (?, ?, ?, ?, 'manual', 'published')`,
          [trackId, chapId || null, f.term, f.definition]
        );
        fcCount++;
      }
    }
    console.log(`Seeded ${fcCount} flashcards`);

    // ═══ 7. CASE STUDIES ═══
    const cases = [
      { disc: "financial-planning", title: "Young Professional: First Financial Plan", content: JSON.stringify({ scenario: "Sarah, age 28, earns $85,000/year as a software engineer. She has $15,000 in student loans at 5.5%, $8,000 in credit card debt at 19.99%, $5,000 in savings, and her employer offers a 401(k) with 4% match. She wants to buy a home in 3 years.", questions: [{ q: "What should Sarah prioritize first?", options: ["Max out 401(k)", "Pay off credit card debt", "Save for down payment", "Pay off student loans"], answer: 1, explanation: "The credit card debt at 19.99% is the highest-cost liability. After securing the employer match (free money), aggressively paying off high-interest debt provides the highest guaranteed return." }, { q: "How much should Sarah contribute to her 401(k) at minimum?", options: ["Nothing until debt is paid", "4% to get full employer match", "The maximum $23,500", "10% of salary"], answer: 1, explanation: "The employer match is a 100% return on investment. Sarah should contribute at least 4% to capture the full match, then direct remaining cash flow to high-interest debt." }] }) },
      { disc: "retirement-planning", title: "Pre-Retiree: Social Security Timing", content: JSON.stringify({ scenario: "Tom and Linda, both age 62, are considering retirement. Tom earned $120,000/year (PIA: $2,800/month). Linda earned $45,000/year (PIA: $1,200/month). They have $1.2M in retirement accounts and $400K in taxable investments. Monthly expenses are $6,500.", questions: [{ q: "What Social Security claiming strategy should they consider?", options: ["Both claim at 62", "Both wait until 70", "Tom delays to 70, Linda claims at 62", "Tom claims at 62, Linda delays to 70"], answer: 2, explanation: "The higher earner (Tom) should delay to maximize the larger benefit (and potential survivor benefit). Linda can claim earlier to provide bridge income. Tom's benefit at 70 would be ~$3,472/month vs $1,960 at 62." }, { q: "What is the primary risk of both claiming at 62?", options: ["They lose Medicare eligibility", "Permanently reduced benefits by 30%", "They cannot work part-time", "Benefits are fully taxable"], answer: 1, explanation: "Claiming at 62 (5 years before FRA of 67) permanently reduces benefits by 30%. This also reduces the survivor benefit, which could impact the surviving spouse for decades." }] }) },
      { disc: "estate-planning", title: "High Net Worth: Estate Tax Mitigation", content: JSON.stringify({ scenario: "The Johnsons have a combined estate of $28 million. They have 3 adult children and 5 grandchildren. They want to minimize estate taxes while maintaining control of their assets during their lifetime.", questions: [{ q: "Which strategy should they implement FIRST?", options: ["Create an ILIT for life insurance", "Maximize annual gift exclusions", "Establish a family limited partnership", "Create a charitable remainder trust"], answer: 1, explanation: "Maximizing annual gift exclusions ($18,000 per recipient in 2024) is the simplest, most immediate strategy. With 8 recipients and gift splitting, they can transfer $288,000/year tax-free." }, { q: "Why might a GRAT be particularly effective for the Johnsons?", options: ["It provides immediate tax deduction", "It transfers appreciation above the 7520 rate tax-free", "It allows them to avoid all estate taxes", "It provides income to their children immediately"], answer: 1, explanation: "A GRAT transfers appreciation above the Section 7520 hurdle rate to beneficiaries estate-tax-free. With a $28M estate, even modest outperformance can transfer significant wealth without using lifetime exemption." }] }) },
      { disc: "investment-management", title: "Portfolio Rebalancing Decision", content: JSON.stringify({ scenario: "Alex, age 45, has a $500,000 portfolio with target allocation of 60% stocks / 30% bonds / 10% alternatives. After a strong bull market, his actual allocation is now 72% stocks / 22% bonds / 6% alternatives. He is concerned about selling stocks in a rising market.", questions: [{ q: "What is the primary argument FOR rebalancing now?", options: ["Lock in profits before a crash", "Maintain the risk level appropriate for his goals", "Reduce tax liability", "Increase expected returns"], answer: 1, explanation: "Rebalancing maintains the risk profile aligned with Alex's goals and risk tolerance. At 72% stocks, his portfolio carries significantly more risk than intended, which could be devastating in a downturn." }, { q: "How can Alex rebalance tax-efficiently?", options: ["Sell all stocks and rebuy at target weights", "Direct new contributions to underweight asset classes", "Convert stocks to bonds within the same account", "Wait for a market correction to rebalance"], answer: 1, explanation: "Directing new contributions (and dividends) to underweight classes (bonds, alternatives) gradually rebalances without triggering capital gains. This is the most tax-efficient approach." }] }) },
    ];

    let caseCount = 0;
    for (const c of cases) {
      const discId = discMap[c.disc];
      if (!discId) continue;
      const [existing] = await conn.execute(
        "SELECT id FROM learning_cases WHERE discipline_id = ? AND title = ?",
        [discId, c.title]
      );
      if (existing.length === 0) {
        await conn.execute(
          `INSERT INTO learning_cases (discipline_id, title, content, visibility, status, version) VALUES (?, ?, ?, 'public', 'published', 1)`,
          [discId, c.title, c.content]
        );
        caseCount++;
      }
    }
    console.log(`Seeded ${caseCount} case studies`);

    console.log("\n=== SEED COMPLETE ===");
    console.log(`Disciplines: ${disciplines.length}`);
    console.log(`Definitions: ${defCount}`);
    console.log(`Tracks: ${tracks.length}`);
    console.log(`Chapters: ${chapCount}`);
    console.log(`Questions: ${qCount}`);
    console.log(`Flashcards: ${fcCount}`);
    console.log(`Cases: ${caseCount}`);
    console.log(`Formulas: (already seeded in Pass 37)`);

  } finally {
    conn.release();
    await pool.end();
  }
}

run().catch(console.error);
