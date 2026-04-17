# Pass 97 Design Notes

## 1. AUM Override Rate Fix
- Current: Override section has `overrideRate` but AUM section only has `aumTrailPct`
- Missing: AUM override rate (the % of AUM fee the advisor keeps vs platform)
- Fix: Add `aumOverrideRate` to engine params and UI
- Industry default: 85-100% payout on advisory fees (ESI ~90%, independent RIA ~100%)
- Calculation: projectedIncome = (existingBook * trailPct/100 * aumOverrideRate/100) + (newAUM * trailPct/100 * 0.5 * aumOverrideRate/100)

## 2. Flexible Affiliate Income Modes
### Mode A: Recruiter (current behavior)
- User recruits affiliates who bring in revenue
- Income = count × avgProduction × incomeRate
- Tracks: A (Fee-Based), B (Referral), C (Co-Broker), D (Wholesale)

### Mode B: Producer  
- User IS the affiliate, earning from their own deals
- Income types:
  1. Fixed $ bonuses per deal/milestone (e.g., $500 per case placed)
  2. Co-brokered deals with % split on commission (e.g., 50/50 split)
  3. Flat referral fees per introduction
- Inputs: # deals/month, avg commission per deal, split %, fixed bonuses
- Calculation: (deals × avgCommission × splitPct) + (deals × fixedBonus)

## 3. Progressive Disclosure
- Three levels: Simple | Detailed | Expert
- Simple: Target income, role, auto-splits, summary KPIs only
- Detailed: All channel sections, editable splits, funnel data
- Expert: Full cross-cascade, sensitivity, time-phased, scenarios, economics
- Implementation: complexity state + conditional rendering
