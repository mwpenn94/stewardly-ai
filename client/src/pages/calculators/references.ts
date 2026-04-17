/* ═══════════════════════════════════════════════════════════════
   References & Due Diligence Data
   Comprehensive citation library from WealthBridge Calculator v7.6
   17 categories, 88+ citations, product references, benchmarks
   ═══════════════════════════════════════════════════════════════ */

export interface RefEntry {
  title: string;
  year?: string;
  finding: string;
  url?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
}

export interface RefCategory {
  id: string;
  name: string;
  entries: RefEntry[];
}

/** Per-category RefTip tooltip text — shown on every category header */
export const REF_CATEGORY_TIPS: Record<string, string> = {
  funnel: 'Conversion rates from LIMRA, Legacy Agent, EverQuote, and Granum OCS research. Industry averages vary by channel, market, and lead source quality.',
  commission: 'GDC brackets, FYC rates, and override structures sourced from NLG, TBA, and LIMRA compensation studies. Rates vary by carrier and hierarchy level.',
  marketing: 'Cost-per-lead and ROI data from FirstPageSage, HubSpot, and AllCalls. Channel effectiveness varies significantly by market and targeting.',
  planning: 'Capital market assumptions from Morningstar, Vanguard, and Dalbar. All projections are forward-looking estimates, not guarantees.',
  trends: 'Industry trend data from LIMRA, McKinsey, and Deloitte. Trends reflect macro-level shifts and may not apply to all markets.',
  premiums: 'Premium benchmarks from NerdWallet, Kitces, and Genworth. Actual premiums depend on age, health, state, and carrier.',
  products: 'Carrier product details from NLG, LSW, and partner carriers. Product features, caps, and rates are subject to change.',
  recruiting: 'Retention and compensation data from LIMRA, McKinsey, and NAIFA. Results vary by firm culture, training, and market.',
  costbenefit: 'Cost-benefit framework based on total premium cost vs. death benefit, cash value, tax savings, and living benefits over multiple horizons.',
  duediligence: 'Independent verification resources including FINRA BrokerCheck, NAIC, SEC EDGAR, and AM Best. Always verify before engaging.',
  regulatory: 'Regulatory data from FINRA, NAIC, SEC, and AM Best. Compliance requirements vary by state and product type.',
  methodology: 'Engine methodology follows NAIC model regulation guidelines, LIMRA needs analysis standards, CFP Board planning practices, and actuarial science.',
  productcitations: 'Product-level citations with specific carrier data, IRC code references, and benchmark comparisons for each product type.',
  benchmarks: 'Industry benchmarks aggregated from BEA, Dalbar, LIMRA, Vanguard, Kitces, and Morningstar for quick reference comparison.',
  aumadvisory: 'AUM and advisory management data from Cerulli, Kitces, Schwab, and Morningstar. Fee structures and growth rates vary by practice size.',
  techdigital: 'Technology adoption data from Kitces Tech Survey, InvestmentNews, and J.D. Power. Digital tools are evolving rapidly.',
  estatetrust: 'Estate and trust planning references from IRC code, ACTEC, and Nolo. Tax law changes (e.g., 2025 sunset) may significantly impact strategies.',
};

export const REFERENCE_CATEGORIES: RefCategory[] = [
  {
    id: 'funnel',
    name: 'Funnel & Conversion Metrics',
    entries: [
      { title: 'LIMRA — U.S. Individual Life Insurance Sales', year: '2025', finding: 'Record individual life premium of $17.5B in 2024, up 12% YoY. Term life sales grew 8%, whole life 6%, IUL 22%. The market is expanding — more prospects are buying.', url: 'https://www.limra.com', trend: 'up', trendLabel: '+12% YoY' },
      { title: 'Granum One Card System (OCS)', year: '1978–present', finding: 'The classic "10-3-1" rule: 10 approaches → 3 fact-finding meetings → 1 sale. Overall conversion ~10%. Still the industry benchmark for activity-based selling.', url: 'https://www.amazon.com/dp/0135282659' },
      { title: 'Legacy Agent — Insurance Sales Funnel', year: '2025', finding: 'Approach-to-appointment set rate: 15-40% (cold vs warm). Appointment held rate: 65-85%. Application rate: 25-70% depending on qualification. Placement rate: 60-85%.', url: 'https://www.legacyagent.com' },
      { title: 'Decerto — Insurance Sales Conversion', year: '2024', finding: 'Quote-to-bind ratio across all insurance lines: 15-25% industry average. Top performers achieve 35%+. Digital-first agencies see 20% higher conversion than traditional.', url: 'https://decerto.com/blog/insurance-sales-conversion-rate/' },
      { title: 'EverQuote — Insurance Lead Conversion', year: '2024', finding: 'Internet lead to quote: 8-12%. Quote to bind: 15-25%. Overall lead-to-sale: 1.2-3%. Speed-to-lead is the #1 factor — responding within 5 minutes increases conversion 8×.', url: 'https://www.everquote.com' },
      { title: 'The Patel Group (TPG) — Life Insurance Close Rates', year: '2025', finding: 'Industry average close rate (app to placed): 60-65%. Top producers: 80-85%. Decline/withdrawal rate: 15-20%. Proper field underwriting reduces declines by 40%.', url: 'https://www.thepatelgroup.com' },
      { title: 'Modern Life — Digital Insurance Platform', year: '2025', finding: 'Digital application completion rate: 75-85% (vs 60% paper). E-signature reduces cycle time by 5-7 days. Instant decision rates improving to 40%+ for simplified issue.', url: 'https://www.modernlife.com' },
      { title: 'MoEngage — Email Benchmarks by Industry', year: '2025', finding: 'Financial services email open rate: 27.3% (highest among major industries). Unsubscribe rate: 0.23% (lowest). Optimal frequency: 2-4×/month.', url: 'https://www.moengage.com/blog/email-marketing-benchmarks/', trend: 'up', trendLabel: 'Best Open Rate' },
      { title: 'NIH — SMS Reminder Meta-Analysis', year: '2016', finding: 'SMS reminders reduce no-show rate by 34% (meta-analysis, Tier 1 evidence). Applicable to financial services appointment scheduling.', url: 'https://pubmed.ncbi.nlm.nih.gov/', trend: 'up', trendLabel: '-34% No-Shows' },
      { title: 'Agency Performance Partners', year: '2025', finding: 'Strong agencies retain 90-95% of total written premium year over year. Retention is the "hidden funnel step" — losing clients means your funnel must work harder just to stay flat.', url: 'https://www.agencyperformancepartners.com/blog/insurance-agency-performance-metrics-what-is-normal-natural/', trend: 'up', trendLabel: 'Retention Key' },
      { title: 'Zoe Financial / Morningstar', year: 'Mar 2026', finding: 'Prospect-to-client conversion is a function of buyer readiness stage, not marketing channel. Advisors who qualify by readiness stage convert 2-4× higher than those who qualify by demographics alone.', url: 'https://www.morningstar.com/news/accesswire/1148311msn/how-prospects-actually-become-clients-new-white-paper-by-zoe-financial-relates-conversion-rate-to-stages-of-buyer-readiness-not-marketing-channels', trend: 'up', trendLabel: 'New Research' },
    ],
  },
  {
    id: 'commission',
    name: 'Commission & GDC Structures',
    entries: [
      { title: 'National Life Group — Agent Compensation', year: '2026', finding: 'GDC brackets range from 55% (<$65K) to 85% ($300K+). First-year commission (FYC) on IUL: 90-110% of target premium. Whole Life: 55-80%. Term: 80-100%.', url: 'https://www.nationallife.com' },
      { title: 'TBA — Commission Schedules', year: '2025', finding: 'Comprehensive FYC rates for 40+ carriers. Industry average FYC: 80-100% for term, 90-110% for IUL, 55-80% for whole life. Override rates: 5-15% for first-gen, 2-5% for second-gen.', url: 'https://www.tba.com' },
      { title: 'LIMRA — Agent Compensation Study', year: '2024', finding: 'Median first-year agent income: $48,000. Median 5-year agent income: $95,000. Top quartile 10-year: $250,000+. Income heavily correlated with activity levels and persistency.', url: 'https://www.limra.com' },
      { title: 'NAIFA — Compensation Benchmarks', year: '2025', finding: 'Median total compensation by channel: captive agent $72K, independent $95K, hybrid $110K. Top decile exceeds $350K across all channels. Persistency bonuses add 5-15%.', url: 'https://www.naifa.org' },
      { title: 'Cerulli — Advisor Compensation Trends', year: '2025', finding: 'Average payout ratio: wirehouse 40-45%, independent BD 85-92%, RIA 100% (minus platform fees). Trend toward fee-based compensation accelerating.', url: 'https://www.cerulli.com', trend: 'up', trendLabel: 'Fee Shift' },
    ],
  },
  {
    id: 'marketing',
    name: 'Marketing & Lead Generation',
    entries: [
      { title: 'FirstPageSage — Cost Per Lead by Channel', year: '2025', finding: 'Financial services CPL: LinkedIn $75-180, Google Ads $85-120, Facebook $50-90, SEO $45-75, Referrals $15-30. Organic/referral channels have 3-5× higher close rates.', url: 'https://firstpagesage.com/reports/cost-per-lead-by-industry/' },
      { title: 'AllCalls — Insurance Lead Costs', year: '2025', finding: 'Exclusive life insurance leads: $25-75. Shared leads: $8-20. Transfer leads: $35-85. Real-time leads convert 3× better than aged leads. Quality varies dramatically by vendor.', url: 'https://www.allcalls.io' },
      { title: 'HubSpot — Marketing Benchmarks', year: '2025', finding: 'Financial services: 3.1% website visitor-to-lead conversion. 2.4% lead-to-customer conversion. Content marketing generates 3× more leads than paid search at 62% lower cost.', url: 'https://www.hubspot.com' },
      { title: 'Kitces — Advisor Marketing Spend', year: '2025', finding: 'Average advisor marketing budget: 2-5% of revenue. Top growers spend 5-8%. Client events ROI: 4-6× return. Seminar marketing declining, digital/content rising 25% YoY.', url: 'https://www.kitces.com', trend: 'up', trendLabel: 'Digital Rising' },
      { title: 'J.D. Power — Financial Advisor Satisfaction', year: '2025', finding: 'Client satisfaction strongly correlated with proactive communication (r=0.82). Advisors who contact clients 4+ times/year score 150 points higher on satisfaction index.', url: 'https://www.jdpower.com' },
    ],
  },
  {
    id: 'planning',
    name: 'Client Financial Planning & Market Returns',
    entries: [
      { title: 'Morningstar — Capital Market Assumptions', year: '2025', finding: 'Expected 10-year returns: US Large Cap 7.5-9.5%, US Bonds 4.5-5.5%, Balanced 6.0-7.5%. Inflation assumption: 2.5%. Real return expectation: 5-7% for diversified portfolios.', url: 'https://www.morningstar.com' },
      { title: 'Vanguard — Advisor Alpha', year: '2025', finding: 'Advisors add approximately 3% per year in net returns through behavioral coaching (1.5%), asset allocation (0.75%), tax-loss harvesting (0.5%), and rebalancing (0.25%).', url: 'https://advisors.vanguard.com', trend: 'up', trendLabel: '~3%/yr Alpha' },
      { title: 'BEA — Personal Savings Rate', year: '2025', finding: 'U.S. personal savings rate: 6.2% (down from pandemic peak of 33%). Historical average: 7-8%. Clients saving less than 15% of gross income are likely under-saving for retirement.', url: 'https://fred.stlouisfed.org/series/PSAVERT' },
      { title: 'Dalbar — QAIB Study', year: '2025', finding: 'Average investor underperforms the S&P 500 by 3.5% annually due to behavioral mistakes (panic selling, performance chasing). 20-year investor return: 5.5% vs 9.0% index.', url: 'https://www.dalbar.com', trend: 'down', trendLabel: '-3.5%/yr Gap' },
      { title: 'CFP Board — Financial Planning Standards', year: '2025', finding: 'Comprehensive financial planning covers 7 domains: financial management, risk management, investments, tax, retirement, estate, and psychology of financial planning.', url: 'https://www.cfp.net' },
      { title: 'Bengen — Safe Withdrawal Rate', year: '1994–2025', finding: 'Original 4% rule based on 30-year rolling periods. Updated research suggests 3.3-4.5% depending on asset allocation and market conditions. Morningstar 2025 estimate: 3.7%.', url: 'https://www.morningstar.com' },
    ],
  },
  {
    id: 'trends',
    name: 'Industry Trends (2024-2026)',
    entries: [
      { title: 'LIMRA — Life Insurance Awareness', year: '2025', finding: '41% of Americans say they need more life insurance. 44% of households would face financial hardship within 6 months if primary earner died. Coverage gap is $12 trillion.', url: 'https://lifehappens.org', trend: 'up', trendLabel: '$12T Gap' },
      { title: 'McKinsey — Insurance Distribution', year: '2024', finding: 'Digital-first distribution growing 25% annually. Hybrid models (digital + advisor) outperform pure digital by 40% in complex product sales. AI-assisted underwriting reducing cycle times 60%.', url: 'https://www.mckinsey.com' },
      { title: 'Deloitte — Insurance Outlook', year: '2025', finding: 'Embedded insurance growing 30% annually. Personalized pricing via IoT data. ESG-linked products emerging. Carrier consolidation continuing — top 10 carriers hold 55% market share.', url: 'https://www.deloitte.com' },
      { title: 'PwC — Wealth Management Trends', year: '2025', finding: 'AI adoption in wealth management up 40% YoY. Personalization is top client demand. ESG assets projected to reach $53T by 2025. Fee compression continues at -2bp/year.', url: 'https://www.pwc.com', trend: 'up', trendLabel: 'AI +40%' },
      { title: 'Capgemini — World Wealth Report', year: '2025', finding: 'Global HNWI population grew 5.1% to 22.8M. Wealth grew 4.7% to $86.8T. North America leads with 7.2M HNWIs. Demand for holistic planning increasing across all segments.', url: 'https://www.capgemini.com', trend: 'up', trendLabel: '+5.1% HNWIs' },
    ],
  },
  {
    id: 'premiums',
    name: 'Premium & Fee Benchmarks',
    entries: [
      { title: 'NerdWallet — Life Insurance Costs', year: '2025', finding: 'Average term premium age 40: $30-50/mo per $500K (20-year term, nonsmoker). IUL target premium: $300-500/mo per $500K face. Whole life: $400-600/mo per $500K.', url: 'https://www.nerdwallet.com' },
      { title: 'Kitces — Advisory Fee Study', year: '2025', finding: 'Average advisory fee: 1.02% of AUM. Median: 1.00%. Range: 0.50-1.50%. Fee compression trend: -2bp/year. Breakpoints common at $500K, $1M, $5M.', url: 'https://www.kitces.com' },
      { title: 'Genworth — Cost of Care', year: '2025', finding: 'Median nursing home (private): $116,800/yr. Assisted living: $64,200/yr. Home health aide: $75,504/yr. Costs rising 3-5% annually. 70% of 65+ will need some form of LTC.', url: 'https://www.genworth.com/aging-and-you/finances/cost-of-care.html' },
      { title: 'AALTCI — Long-Term Care Insurance', year: '2025', finding: 'Average LTC insurance premium (couple, age 55): $3,050/yr. Hybrid life/LTC policies growing 25% annually. Traditional LTC sales declining. Asset-based LTC now 70% of new sales.', url: 'https://www.aaltci.org', trend: 'up', trendLabel: 'Hybrid +25%' },
    ],
  },
  {
    id: 'products',
    name: 'Carrier Products',
    entries: [
      { title: 'National Life Group — Product Suite', year: '2026', finding: 'FlexLife IUL (10.5% cap, 0% floor), PeakLife IUL (11% cap, bonus crediting), Living Benefit Term (chronic illness rider), Whole Life (2.5% guaranteed + dividends). AM Best A rating.', url: 'https://www.nationallife.com' },
      { title: 'LSW (Life of the Southwest)', year: '2026', finding: 'FlexLife IUL product guide. Target premium funding, 85% first-year cash value ratio for MEC-limit funded policies. Bonus crediting in years 1-10.', url: 'https://www.nationallife.com' },
      { title: 'NLG Premium Finance Director', year: '2026', finding: 'Dedicated premium finance program. Minimum case: $1M+ face, $250K+ net worth. SOFR + spread lending. Designed for high-net-worth estate planning and business succession.', url: 'https://www.nationallife.com' },
      { title: 'Athene — Fixed Indexed Annuities', year: '2026', finding: 'Accumulation-focused FIA with 6-8% cap rates. Income rider options with 5-7% rollup. Strong for tax-deferred accumulation and guaranteed lifetime income.', url: 'https://www.athene.com' },
      { title: 'Lincoln Financial — MoneyGuard', year: '2026', finding: 'Hybrid life/LTC product. $100K-$500K single premium. 2-3× LTC benefit multiplier. Guaranteed death benefit if LTC not used. Popular for LTC planning.', url: 'https://www.lincolnfinancial.com' },
    ],
  },
  {
    id: 'recruiting',
    name: 'Recruiting, Retention & Talent',
    entries: [
      { title: 'LIMRA — New Agent Retention', year: '2024', finding: 'First-year retention: 15-20% (industry-wide). Four-year retention: 11-15%. Top firms achieve 30%+ first-year retention through structured onboarding and mentorship programs.', url: 'https://www.limra.com', trend: 'down', trendLabel: '15-20% Yr1' },
      { title: 'McKinsey — Insurance Talent', year: '2024', finding: 'Average age of insurance agent: 59. 50% of workforce eligible for retirement by 2030. Industry needs 400,000 new agents in next 5 years. Diversity hiring improving but still lagging.', url: 'https://www.mckinsey.com' },
      { title: 'NAIFA — Agent Compensation Survey', year: '2025', finding: 'Median agent income by experience: Year 1: $35K, Year 3: $65K, Year 5: $95K, Year 10+: $150K+. Top 10% earn $300K+. Income strongly correlated with client retention and referral rates.', url: 'https://www.naifa.org' },
      { title: 'GAMA International — Manager Effectiveness', year: '2025', finding: 'Top-performing managers recruit 8-12 agents/year with 35%+ first-year retention. Key factors: structured 90-day onboarding, weekly coaching, joint fieldwork in first 6 months.', url: 'https://www.gamaweb.com' },
    ],
  },
  {
    id: 'costbenefit',
    name: 'Cost vs. Benefit Due Diligence',
    entries: [
      { title: 'Total Premium Cost', finding: 'Sum of all annual premiums × holding period. Term: level premium × term length. IUL/WL: target premium × funding years. Advisory: AUM × fee % × years. Always compare total cost to total benefit.', year: '2026' },
      { title: 'Death Benefit Value', finding: 'Face amount × probability of claim within term. Term: decreasing probability over time. Permanent: guaranteed if premiums paid. Tax-free under IRC §101 (income tax) and §2042 (estate tax if ILIT-owned).', year: '2026' },
      { title: 'Cash Value Accumulation', finding: 'IUL: cap/floor mechanics with current crediting rates. Whole Life: guaranteed rate + estimated dividends. Advisory: market returns minus fees. Compare net-of-fee growth across all vehicles.', year: '2026' },
      { title: 'Tax Savings', finding: 'Qualified plans: immediate deduction at marginal rate. Roth: tax-free growth. Life insurance: tax-deferred growth + tax-free loans (IRC §7702). Advisory: tax-loss harvesting (0.5%/yr value). Quantify the tax alpha.', year: '2026' },
      { title: 'Living Benefits', finding: 'DI: stated benefit amount. LTC: $150K pool (lower bound). FIA: 5% income rider × 20yr. Chronic illness riders on life policies. Quantify the "insurance within insurance."', year: '2026' },
      { title: 'Opportunity Cost Analysis', finding: 'Compare insurance premiums vs. investing the same amount in taxable accounts. Factor in: mortality credit, tax advantages, guarantees, and behavioral benefits of forced savings.', year: '2026' },
    ],
  },
  {
    id: 'duediligence',
    name: 'Your Due Diligence Checklist',
    entries: [
      { title: 'Check your advisor', finding: 'Free, public tool to verify credentials, disciplinary history, and registrations.', url: 'https://brokercheck.finra.org' },
      { title: 'Check your carrier', finding: 'Consumer complaint ratios, financial strength ratings by carrier.', url: 'https://www.naic.org' },
      { title: 'Compare premiums', finding: 'Instant multi-carrier quotes for comparison shopping.', url: 'https://www.policygenius.com' },
      { title: 'Verify tax rules', finding: 'IRC §101 (death benefit), §7702 (cash value), §213(d) (LTC deductions).', url: 'https://www.irs.gov' },
      { title: 'Check retirement math', finding: 'Latest safe withdrawal rate research and retirement planning tools.', url: 'https://www.morningstar.com' },
      { title: 'Validate growth rates', finding: 'S&P 500: 10.56% nominal since 1957. Use this as your benchmark for equity return assumptions.', url: 'https://www.macrotrends.net/2526/sp-500-historical-annual-returns' },
      { title: 'Check LTC costs', finding: 'Nursing home, assisted living, and home health costs by state and metro area.', url: 'https://www.genworth.com/aging-and-you/finances/cost-of-care.html' },
      { title: 'Verify commission rates', finding: 'FYC rates for 40+ carriers. Compare what your agent earns vs industry standard.', url: 'https://www.tba.com' },
      { title: 'Carrier strength', finding: 'AM Best financial strength ratings (A++ to F). Only buy from A-rated or better carriers.', url: 'https://www.ambest.com' },
      { title: 'Review your state', finding: 'Contact your state insurance department for local regulations and consumer protections.', url: 'https://www.naic.org/state_web_map.htm' },
    ],
  },
  {
    id: 'regulatory',
    name: 'Regulatory & Compliance',
    entries: [
      { title: 'FINRA BrokerCheck', year: 'Current', finding: 'Verify advisor credentials, disciplinary history, and registrations. Free public tool — every investor should check their advisor here before engaging.', url: 'https://brokercheck.finra.org/' },
      { title: 'NAIC', year: '2024', finding: 'U.S. Life and A&H Insurance Industry analysis and regulatory data. State-by-state consumer complaint ratios by carrier.', url: 'https://content.naic.org/sites/default/files/2024-annual-life-industry-commentary.pdf' },
      { title: 'SEC EDGAR', year: 'Current', finding: 'Public company filings, investment advisor registrations (Form ADV), and fund prospectuses. Verify any investment product or advisory firm.', url: 'https://www.sec.gov/cgi-bin/browse-edgar' },
      { title: 'AM Best', year: '2025', finding: 'Insurance company financial strength ratings. A++ to F scale. Check your carrier\'s claims-paying ability and financial stability before purchasing any policy.', url: 'https://www.ambest.com' },
      { title: 'DOL Fiduciary Rule', year: '2024', finding: 'Department of Labor fiduciary rule requires advisors to act in client\'s best interest for retirement accounts. Applies to rollovers, IRA recommendations, and plan distributions.', url: 'https://www.dol.gov' },
    ],
  },
  {
    id: 'methodology',
    name: 'Engine Methodology',
    entries: [
      { title: 'Unified Wealth Engine (UWE)', finding: 'Runs a year-by-year compounding simulation for each financial product. Tax savings are reinvested. Advisory alpha compounds on the growing portfolio. IUL cash value uses cap/floor mechanics. Whole Life includes guaranteed rates plus estimated dividends. 14 product models including Premium Finance, Split Dollar, and Deferred Compensation.' },
      { title: 'Business Income Engine (BIE)', finding: 'Models personal production (GDC × bracket rate), team overrides (Gen1 + Gen2 cascade), affiliate income (Tracks A-D), AUM trail, channel marketing ROI, partner streams, renewal/trail income, and bonuses with configurable monthly seasonality patterns across 7 hierarchy roles.' },
      { title: 'Holistic Integration Engine (HE)', finding: 'Combines BIE and UWE simulations. Business income feeds savings contributions (net income × savings rate), which feed product growth, which compounds with tax savings reinvestment. All value channels flow forward/back, roll-up/roll-down across all hierarchy levels.' },
      { title: 'Monte Carlo Simulation', finding: '1,000-trial simulation with randomized annual returns using normal distribution (Box-Muller transform). Default 15% annual standard deviation consistent with US equity markets. Returns capped -40% to +60%/yr. Produces p10/p25/p50/p75/p90 confidence bands.', url: 'https://www.morningstar.com' },
      { title: 'Premium Finance Modeling', finding: 'Year-by-year loan balance tracking (SOFR + spread) versus IUL cash value accumulation (crediting rate - COI). Net equity = CSV - loan balance. 85% first-year cash value ratio for MEC-limit funded policies with bonus crediting in years 1-10.', url: 'https://www.newyorkfed.org/markets/reference-rates/sofr' },
      { title: 'Cross-Cascade Engine', finding: 'Bidirectional cascade: forward (target → channel targets via splits) and backward (channel inputs → projected totals). Back-solve any variable. Auto-balance splits to match actual projections. Audit trail logs every cascade action.' },
    ],
  },
  {
    id: 'productcitations',
    name: 'Product-Level Source Citations',
    entries: [
      { title: 'Term Life', finding: 'LIMRA 2025 ($17.5B record individual life premium), NLG Rate Sheet April 2026, IRC §101 (income tax-free death benefit). Benchmark: Avg term premium age 40: $30-50/mo per $500K (NerdWallet 2025).', url: 'https://www.limra.com' },
      { title: 'IUL', finding: 'NLG LSW FlexLife Product Guide 2026, AG 49-A (illustrated rate caps), IRC §7702 (tax-free policy loans). Benchmark: IUL cap rates 8-12% current, historical S&P avg 10.3% (Morningstar).', url: 'https://www.nationallife.com' },
      { title: 'Whole Life', finding: 'WSJ Best Whole Life Rankings 2026 (#2 NLG), MassMutual Dividend History, AM Best A++ ratings. Benchmark: NLG WL dividend ~2-3%, NWM ~5%.', url: 'https://www.ambest.com' },
      { title: 'Advisory/AUM', finding: 'Kitces 2025 Advisory Fee Study (avg 1.02%), ESI Fee Schedule, Morningstar Fund Flows 2025. Benchmark: Industry avg fee 1.02% (Kitces). Vanguard 0.30%. Wirehouse 1.35%.', url: 'https://adviserinfo.sec.gov' },
      { title: 'Premium Finance', finding: 'NY Fed SOFR (~4.3%), NLG Premium Finance Director, IRC §7702, JFSP Jan 2025 premium finance risk study. Benchmark: Typical spread 1-2% (crediting vs loan). Min case $1M+ face, $250K+ NW.', url: 'https://www.newyorkfed.org/markets/reference-rates/sofr' },
      { title: 'Disability Insurance', finding: 'Council for Disability Awareness: 1 in 4 workers will be disabled before retirement. Average group DI replaces 60% of income. Individual DI: 65-70% with own-occupation definition.', url: 'https://disabilitycanhappen.org' },
    ],
  },
  {
    id: 'benchmarks',
    name: 'Industry Benchmarks for Comparison',
    entries: [
      { title: 'National Savings Rate', finding: '6.2%', url: 'https://fred.stlouisfed.org/series/PSAVERT', year: 'BEA 2025' },
      { title: 'Investor Behavior Gap', finding: '3.5%/yr underperformance', url: 'https://www.dalbar.com', year: 'Dalbar QAIB 2025' },
      { title: 'Life Insurance Gap', finding: '41% of Americans underinsured', url: 'https://lifehappens.org', year: 'Life Happens 2025' },
      { title: 'Advisor Alpha', finding: '~3%/yr added value', url: 'https://advisors.vanguard.com', year: 'Vanguard 2025' },
      { title: 'Avg Advisory Fee', finding: '1.02%', url: 'https://www.kitces.com', year: 'Kitces 2025' },
      { title: 'S&P 500 Avg Return', finding: '10.3% nominal', url: 'https://www.morningstar.com', year: 'Morningstar SBBI' },
      { title: 'Estate Planning Gap', finding: '67% lack a will', url: 'https://www.caring.com', year: 'Caring.com 2025' },
      { title: 'Retirement Readiness', finding: '56% on track', url: 'https://www.fidelity.com', year: 'Fidelity 2025' },
    ],
  },
  /* ═══ NEW CATEGORY 15: AUM & Advisory Management ═══ */
  {
    id: 'aumadvisory',
    name: 'AUM & Advisory Management',
    entries: [
      { title: 'Cerulli — U.S. Advisor Metrics', year: '2025', finding: 'Average AUM per advisor: $120M (RIA), $85M (IBD), $150M (wirehouse). Organic growth rate: 4-6% for top quartile. Client acquisition cost: $3,000-$8,000 per HNW client.', url: 'https://www.cerulli.com', trend: 'up', trendLabel: '+4-6% Organic' },
      { title: 'Schwab — RIA Benchmarking Study', year: '2025', finding: 'Top-performing RIAs grow AUM 15%+ annually. Key drivers: referral programs (45% of new clients), COI partnerships (25%), digital marketing (15%), seminars (15%).', url: 'https://www.schwab.com', trend: 'up', trendLabel: '15%+ Growth' },
      { title: 'Kitces — Practice Management', year: '2025', finding: 'Revenue per client: $4,200 average. Profit margin: 25-35% for solo, 15-25% for ensemble. Staff-to-advisor ratio: 2.5:1 optimal. Technology spend: 3-5% of revenue.', url: 'https://www.kitces.com' },
      { title: 'Morningstar — Fund Flows', year: '2025', finding: 'Passive fund AUM surpassed active in 2024. ETF inflows: $900B. Index fund market share: 55%+. Advisors increasingly using model portfolios (40% adoption).', url: 'https://www.morningstar.com', trend: 'up', trendLabel: 'Passive >50%' },
      { title: 'InvestmentNews — Fee Study', year: '2025', finding: 'Median all-in cost to client: 1.5% (advisory fee + fund expenses). Trend toward flat fees for planning ($2,500-$7,500/yr). Subscription model adoption growing 20% YoY.', url: 'https://www.investmentnews.com' },
    ],
  },
  /* ═══ NEW CATEGORY 16: Technology & Digital Tools ═══ */
  {
    id: 'techdigital',
    name: 'Technology & Digital Tools',
    entries: [
      { title: 'Kitces — Advisor Technology Survey', year: '2025', finding: 'Top tech tools by adoption: CRM (89%), financial planning software (85%), portfolio management (82%), e-signature (78%), client portal (72%). Average tech spend: $15K/advisor/year.', url: 'https://www.kitces.com' },
      { title: 'InvestmentNews — AI in Wealth Management', year: '2025', finding: 'AI adoption: 35% of advisors use AI tools (up from 12% in 2023). Top uses: meeting notes (45%), content creation (38%), portfolio analysis (25%), client communication (20%).', url: 'https://www.investmentnews.com', trend: 'up', trendLabel: 'AI 35%' },
      { title: 'J.D. Power — Digital Experience', year: '2025', finding: 'Client satisfaction 22% higher when digital tools are integrated. Mobile app usage up 40%. Self-service portal reduces service calls by 30%. Video meeting preference: 60% of clients under 50.', url: 'https://www.jdpower.com', trend: 'up', trendLabel: '+22% Satisfaction' },
      { title: 'Riskalyze — Risk Assessment Technology', year: '2025', finding: 'Advisors using quantitative risk assessment tools have 25% higher client retention. Risk number alignment reduces portfolio changes by 40% during market volatility.', url: 'https://www.riskalyze.com' },
      { title: 'Orion — Portfolio Management Trends', year: '2025', finding: 'Model marketplace adoption: 45% of advisors. Direct indexing growing 30% annually. Tax-loss harvesting automation saves clients 0.5-1.5% annually. UMA adoption: 35%.', url: 'https://www.orion.com', trend: 'up', trendLabel: 'Models +45%' },
    ],
  },
  /* ═══ NEW CATEGORY 17: Estate & Trust Planning ═══ */
  {
    id: 'estatetrust',
    name: 'Estate & Trust Planning',
    entries: [
      { title: 'IRC §2010 — Unified Credit', year: '2025', finding: 'Federal estate tax exemption: $13.61M per person ($27.22M per couple). Scheduled to sunset to ~$7M in 2026 under TCJA provisions. 40% top estate tax rate.', url: 'https://www.irs.gov' },
      { title: 'ACTEC — Trust Planning Strategies', year: '2025', finding: 'Key trust types: SLAT (spousal lifetime access), IDGT (intentionally defective grantor), GRAT (grantor retained annuity), CRT (charitable remainder), QPRT (qualified personal residence). Each serves different planning objectives.', url: 'https://www.actec.org' },
      { title: 'Caring.com — Estate Planning Survey', year: '2025', finding: '67% of Americans lack a will. 72% of parents with minor children lack guardianship designations. Estate planning adoption highest among 65+ (46%) and lowest among 18-34 (18%).', url: 'https://www.caring.com' },
      { title: 'Nolo — Trust Administration', year: '2025', finding: 'Average revocable living trust cost: $1,500-$3,000. Irrevocable trust: $3,000-$7,500. Annual trust administration: $1,000-$3,000. Corporate trustee fees: 0.5-1.5% of trust assets.', url: 'https://www.nolo.com' },
      { title: 'IRS — Generation-Skipping Transfer Tax', year: '2025', finding: 'GST exemption mirrors estate tax exemption ($13.61M). Flat 40% rate on transfers to skip persons. Dynasty trusts can leverage GST exemption for multi-generational wealth transfer.', url: 'https://www.irs.gov' },
    ],
  },
];

/* ═══ FUNNEL STEP BENCHMARKS TABLE ═══ */
export const FUNNEL_BENCHMARKS = [
  { step: 'Approach → Set', calcDefault: '40%', industryLow: '15%', industryAvg: '25%', topPerformer: '60%', source: 'Legacy Agent, Granum OCS' },
  { step: 'Set → Held', calcDefault: '65%', industryLow: '50%', industryAvg: '70%', topPerformer: '85%', source: 'LIMRA, Industry avg' },
  { step: 'Held → App', calcDefault: '70%', industryLow: '25%', industryAvg: '45%', topPerformer: '70%', source: 'Decerto, EverQuote, TPG' },
  { step: 'App → Placed', calcDefault: '80%', industryLow: '40%', industryAvg: '60%', topPerformer: '85%', source: 'Modern Life, SFG Life' },
  { step: 'Overall (approach → placed)', calcDefault: '14.6%', industryLow: '0.8%', industryAvg: '4.7%', topPerformer: '30.4%', source: 'Granum 10-3-1 = 10%' },
];

/* ═══ METHODOLOGY DISCLOSURE ═══ */
export const METHODOLOGY_DISCLOSURE = {
  uwe: 'The Unified Wealth Engine runs a year-by-year compounding simulation for each financial product. Tax savings are reinvested. Advisory alpha compounds on the growing portfolio. IUL cash value uses cap/floor mechanics. Whole Life includes guaranteed rates plus estimated dividends.',
  bie: 'The Business Income Engine models personal production (GDC × bracket rate), team overrides (Gen1 + Gen2 cascade), affiliate income (Tracks A-D), AUM trail, channel marketing ROI, and partner streams with configurable seasonality patterns.',
  he: 'The Holistic Engine combines BIE and UWE simulations. Business income feeds savings contributions (net income × savings rate), which feed product growth, which compounds with tax savings reinvestment.',
  mc: 'Monte Carlo simulation runs 1,000 trials with randomized annual returns using a normal distribution (Box-Muller transform) around the expected return with configurable volatility (default: 15% annual standard deviation).',
  pf: 'Premium Finance modeling uses year-by-year loan balance tracking (SOFR + spread) versus IUL cash value accumulation (crediting rate - COI). Net equity = CSV - loan balance.',
  disclaimer: 'All projections are hypothetical illustrations for educational purposes. Actual results will vary based on market conditions, policy performance, tax law changes, and individual circumstances. This tool does not constitute investment, tax, or legal advice. Consult qualified professionals before making financial decisions.',
};
