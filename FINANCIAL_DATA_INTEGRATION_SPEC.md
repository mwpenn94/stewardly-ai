# Financial Data & Tools Integration Specification

This document captures the user's specification for the financial data integration layer.
See `/home/ubuntu/upload/pasted_content_3.txt` for the full original spec.

## Key Points for WealthBridge AI Adaptation

The spec describes a financial data adapter architecture for an external codebase (Stewardly AI on GitHub with Clerk auth, Railway infra, R2 storage). Our platform (WealthBridge AI on Manus) uses a different stack (Manus OAuth, TiDB, S3 storage, tRPC). We will adapt the concepts to our existing architecture:

1. **Adapter Registry Pattern** — Modular financial data adapters (FRED, EDGAR, Treasury, BEA, BLS, OpenFIGI, GLEIF, CoinGecko, FMP, Polygon, Tiingo, Plaid)
2. **PFM Ingestion Pipeline** — CSV import from Mint, Empower, Monarch, EveryDollar, YNAB, Quicken with LLM-assisted column mapping
3. **Compliance Layer** — Reg S-P/GLBA data authorization, audit trail, data minimization
4. **MCP Server Integration** — EDGAR, FRED, Market Data MCP servers for AI agent tools
5. **Client UI** — Financial Data Dashboard, PFM Import Wizard, Client Financial Overview, Data Authorization Manager

## Environment Variables Already Configured
- FRED_API_KEY, BEA_API_KEY, BLS_API_KEY, CENSUS_API_KEY (government data APIs)
- PLAID_CLIENT_ID, PLAID_SECRET (banking aggregation)
- SNAPTRADE_CLIENT_ID, SNAPTRADE_CONSUMER_KEY (brokerage aggregation)
- DEEPGRAM_API_KEY, DAILY_API_KEY (voice/video)

## Implementation Notes
- Adapt to our existing tRPC + Drizzle + Manus Auth patterns
- Use `getDb()` async pattern for database access
- Use `rawInvokeLLM` from stewardlyWiring for LLM calls
- Follow existing service patterns in server/services/planningHierarchy/
- All new tables go in drizzle/schema.ts
