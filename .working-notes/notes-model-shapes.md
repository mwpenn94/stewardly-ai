# Model Input/Output Reference

## 8 Statistical Models:
1. monte-carlo-retirement → RetirementInput → RetirementOutput (yearByYearMedian[], successRate, percentiles)
2. debt-optimization → DebtOptimizationInput → DebtOptimizationOutput (avalanche/snowball/hybrid schedules)
3. tax-optimization → TaxOptimizationInput → TaxOptimizationOutput (bracketAnalysis[], rothConversion)
4. cash-flow-projection → CashFlowInput → CashFlowOutput (monthlyProjections[], alerts[])
5. insurance-gap-analysis → InsuranceGapInput → InsuranceGapOutput (gaps[], overallScore)
6. estate-planning → EstatePlanningInput → EstatePlanningOutput (strategies[], beneficiaryAnalysis[])
7. education-funding → EducationFundingInput → EducationFundingOutput (yearByYear[], fundingGap)
8. risk-tolerance-assessment → RiskToleranceInput → RiskToleranceOutput (dimensions{}, recommendedAllocation{})

## tRPC endpoints already exist:
- modelEngine.list → lists all models
- modelEngine.execute → runs a model with inputData
- modelEngine.getRunHistory → gets past runs

## Chart types needed:
1. Retirement: Area chart (yearByYearMedian), gauge (successRate)
2. Debt: Grouped bar (strategies comparison), line (payoff timeline)
3. Tax: Stacked bar (bracket analysis), comparison cards
4. Cash Flow: Area chart (monthly projections), alerts timeline
5. Insurance: Radar/bar chart (gaps by type), score gauge
6. Estate: Treemap/bar (beneficiary analysis), strategy cards
7. Education: Area chart (yearByYear balance), funding gap bar
8. Risk: Radar chart (5 dimensions), pie chart (allocation)
