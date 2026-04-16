# Pass 89 — Unified Income Planning Hub

## Current State
- MyPlanPanel has: Role selector, Target GDC, WB%, AUM Existing/New/Trail%, stream toggles, affiliate income inputs (flat $), roll-up table
- Missing: Target Income as master input, channel split percentages, forward/back cascade, AUM planning depth, affiliate planning depth

## What Needs to Change

### 1. Add Target Income as Master Input
- New field: `ppTargetIncome` — the total desired annual income
- When set, auto-calculates channel targets based on role-specific splits

### 2. Role-Based Default Channel Splits
Add to ROLE_DEFAULTS:
- new: { gdcSplit: 80, aumSplit: 10, affSplit: 5, overrideSplit: 0, channelSplit: 5 }
- exp: { gdcSplit: 60, aumSplit: 20, affSplit: 10, overrideSplit: 5, channelSplit: 5 }
- sa:  { gdcSplit: 55, aumSplit: 20, affSplit: 10, overrideSplit: 10, channelSplit: 5 }
- dir: { gdcSplit: 35, aumSplit: 25, affSplit: 10, overrideSplit: 25, channelSplit: 5 }
- md:  { gdcSplit: 25, aumSplit: 30, affSplit: 10, overrideSplit: 30, channelSplit: 5 }
- rvp: { gdcSplit: 15, aumSplit: 30, affSplit: 10, overrideSplit: 40, channelSplit: 5 }

### 3. Forward Cascade (Target Income → Channel Targets)
- targetIncome × gdcSplit% → targetGDC (already exists, just needs to be driven from targetIncome)
- targetIncome × aumSplit% → targetAUMIncome → back-calculate required AUM book
- targetIncome × affSplit% → split across affiliates A-D based on sub-splits
- targetIncome × overrideSplit% → targetOverrideIncome → back-calculate team size needed
- targetIncome × channelSplit% → targetChannelRevenue → back-calculate marketing spend

### 4. Back Cascade (Channel Target → Target Income)
- When user changes any individual channel target, recalculate total Target Income

### 5. AUM Planning Depth
- Target AUM Income → required AUM book at trail %
- AUM existing + AUM new pipeline → projected AUM income
- Gap analysis: required vs projected

### 6. Affiliate Planning Depth
- Each affiliate type (A-D) gets: # affiliates, avg production per affiliate, income rate → projected income
- Affiliates also get their own production planning (from user's clarification)

### 7. Override Planning Depth
- Team size × avg GDC per member × override rate → projected override income
- Gap analysis vs target

## Implementation Plan
1. Update practiceEngine.ts: add INCOME_SPLITS to ROLE_DEFAULTS, add calcUnifiedIncome function
2. Update Calculators.tsx: add ppTargetIncome state, ppIncomeSplits state
3. Restructure MyPlanPanel: Target Income first, then channel breakdown with sliders
