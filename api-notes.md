# practiceEngine.ts API Signatures (ACTUAL)

## GDCBracket
- Properties: `mn`, `mx`, `r`, `l` (NOT `rate`, `label`)

## calcProductionFunnel(targetGDC, wbPct, bracketOverride, avgGDC, ap, sh, cl, pl, months)
- 9 positional args
- Returns: { wbTarget, expTarget, gdcNeeded, bracketRate, placed, apps, held, set, approaches, dailyApproaches, monthlyApproaches, monthlyApps, monthlyGDC }
- NO `apMo`, `apWk`, `apDay`, `shows`, `closes`, `shMo`, `clMo`, `plMo`

## calcRollUp(params)
- params: { role, hasPersonal, wbTarget, expTarget, overrideIncome, overrideRate, aumIncome, affAIncome, affBIncome, affCIncome, affDIncome, channelRevAnnual, streams }
- NO `targetGDC`, `wbPct`, `months`, `payoutRate`, `bonusRate`, `gen2Rate`, `teamMembers`, `aumExisting`, `aumNew`, `aumTrailPct`
- Returns: { grandTotal, items, streamCount } (NOT `personalGDC`, `expandedIncome`, `aumTrail`, `overrideIncome`, `channelRevenue`, `totalIncome`)

## calcAllTracksSummary(tracks, overrideRate)
- 2 args (NOT 1)
- Returns: { tHires, tContact, tFYC, tOvr, tBooks, yr2FYC, yr2Ovr, recOpEx, recEBITDA, recARR, details }
- NO `tEBITDA` (use `recEBITDA`)

## calcChannelMetrics(channelSpend, ltvYears?, retentionPct?)
- Returns: { tSpend, tLeads, tClients, tRevMo, channelResults, cac, avgRevClient, ltv, ltvCac, annualRev, annualSpend, arr, margin, roiPct }
- channelResults items: { id, name, spend, annLeads, annClients, annRev, roi }
- NO `totalSpend`, `totalLeads`, `totalClients`, `totalRevenue`, `blendedROI`
- NO `leads`, `clients` on items (use `annLeads`, `annClients`)

## calcPnL(level, numProducers, avgGDC, payoutRate, opEx, taxRate, ebitGoal?, netGoal?)
- 6-8 positional args (NOT object)
- Returns: { revenue, cogs, grossMargin, gmPct, opEx, ebitda, marginPct, tax, netIncome, avgGDC, backPlanned }
- NO `payout`, `ebitdaMargin`, `netMargin`

## TeamMember
- { n: string; f: number; role: RoleId } (NO `ramp` property)
