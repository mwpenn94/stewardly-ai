# Command 2: Data Pipeline Resource Allocation Strategy

## Summary
- 3-tier data pipeline architecture: Platform (Tier A), Organization (Tier B), Professional (Tier C)
- 20 integration providers to seed
- 7 carrier import templates
- Platform pipelines: Census, BLS, FRED, BEA, EDGAR, FINRA BrokerCheck (all free)
- Org-level: GHL, SMS-iT, BridgeFT, Plaid, COMPULIFE, Canopy, ACORD/DTCC, ATTOM
- Professional-level: NLG, MassMutual, ESI, PDL, FullContact, SnapTrade
- Cron manager for scheduled jobs
- Context assembly integration (5-layer prompt builder enhancement)
- Frontend: Platform admin integrations dashboard, Org admin integration settings, Advisor personal integrations, Client account connections

## Implementation Order
1. Schema + Seed (tables already exist for many; need integration_providers, carrier_import_templates, integration_connections)
2. Encryption (already exists)
3. tRPC routers
4. Platform pipelines (already partially built - Census/BLS/FRED/BEA/EDGAR/FINRA)
5. Frontend UI
6. Org services (GHL, SMS-iT, BridgeFT, Plaid)
7. Professional services (PDL, carrier import)
8. Context assembly integration
9. Cron manager
10. Testing

## What Already Exists
- enrichment_cache, enrichment_datasets tables
- Platform pipelines for BLS, FRED, BEA, Census, SEC EDGAR, FINRA BrokerCheck (running on cron)
- Plaid service (basic)
- Credit bureau service
- Integration providers table exists but may need more providers seeded
- Encryption service exists
