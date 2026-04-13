# BIE Data Structures Reference

## Products (P array)
- term: Term Life 20yr, GDC $500, FYC 80%, WB NLG LSW Term
- iul: IUL, GDC $3000, FYC 80%, WB NLG FlexLife/SummitLife
- rapid: RapidProtect IUL, GDC $1600, FYC 80%, WB NLG RapidProtect
- wl: Whole Life, GDC $1800, FYC 80%, WB NLG Total Secure
- wl_mm: WL MassMutual, GDC $1800, FYC 55%
- fia: FIA, GDC $3500, FYC 7%
- va: Variable Annuity, GDC $4000, FYC 5%
- pf: Premium Finance, GDC $40000, FYC 80%
- exec: Exec Benefits, GDC $8000, FYC 80%
- group: Group Benefits, GDC $800, FYC 15%
- sec: Advisory/AUM, GDC $2000, FYC 100%
- pc: P&C, GDC $400, FYC 15% (expanded)
- med: Medicare, GDC $694, FYC 100% (expanded)
- ethos: GFI/Ethos, GDC $500, FYC 70% (expanded)
- di: DI, GDC $1500, FYC 55% (expanded)
- ltc: Hybrid LTC, GDC $5000, FYC 8% (expanded)

## GDC Brackets (G array)
- <$65K: 55%
- $65-95K: 65%
- $95-150K: 70%
- $150-200K: 75%
- $200-240K: 80%
- $240-275K: 82.5%
- $275-300K: 84%
- $300K+: 85%

## Channels (CH array)
- ref: Referral Program, CPL $50, Conv 25%, Rev $30K, LTV $273K, default $100/mo
- web: Webinars, CPL $90, Conv 12%, Rev $12.5K, LTV $84K, default $75/mo
- rnd: Roundtable Events, CPL $120, Conv 15%, Rev $30K, LTV $212K, default $75/mo
- dig: Digital Meta+Google, CPL $85, Conv 8%, Rev $15K, LTV $89K, default $150/mo
- com: Community Events, CPL $75, Conv 10%, Rev $10K, LTV $53K, default $100/mo
- cpa: CPA/Attorney Partners, CPL $180, Conv 20%, Rev $30K, LTV $240K, default $50/mo
- ptr: Basic Partnerships, CPL $150, Conv 12%, Rev $20K, LTV $136K, default $50/mo
- li: LinkedIn B2B, CPL $130, Conv 10%, Rev $35K, LTV $280K, default $100/mo
- eml: Email Drip, CPL $8, Conv 15%, Rev $12K, LTV $95K, default $50/mo
- sms: SMS/Text, CPL $12, Conv 18%, Rev $10K, LTV $78K, default $30/mo
- ems: Email+SMS Combined, CPL $15, Conv 22%, Rev $14K, LTV $115K, default $0/mo

## Hierarchy
- Roles: new, exp, sa, dir, md, rvp
- Names: New Associate, Experienced Professional, Senior Associate, Director, Managing Director, Regional Vice President

## Recruiting Defaults (RD)
- newAssoc: interest 20%, interview 50%, offer 40%, accept 60%, produce 70%, FYC $65K, ramp 6mo, rampProd 30%
- expPro: interest 12%, interview 40%, offer 50%, accept 50%, produce 85%, FYC $150K, book $5M, ramp 3mo, rampProd 50%
- affiliate: interest 25%, interview 60%, offer 50%, accept 70%, produce 80%, FYC $50K, ramp 2mo, rampProd 60%
- md: interest 8%, interview 35%, offer 45%, accept 55%, produce 90%, FYC $200K, book $2M, ramp 4mo, rampProd 40%

## Recruiting Sources (RSRC)
- inbound: close 25%, CPA $100, yr1Ret 78%, yr2Ret 55%
- outbound: close 5%, CPA $1500, yr1Ret 50%, yr2Ret 30%
- digital: close 4%, CPA $200, yr1Ret 45%, yr2Ret 25%
- campus: close 12%, CPA $800, yr1Ret 55%, yr2Ret 35%
- poach: close 18%, CPA $2000, yr1Ret 65%, yr2Ret 45%

## Role Defaults (SD)
Each role has: production flag (p), WB payout % (wb), months active (mo), approach rate (ap), show rate (sh), close rate (cl), place rate (pl), product mix
