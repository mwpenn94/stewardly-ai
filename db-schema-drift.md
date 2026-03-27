# Database Schema Drift Analysis

## Date: March 26, 2026
## Source: Manus DB query logs vs Drizzle schema (drizzle/schema.ts)

---

## Summary

| Metric | Count |
|--------|-------|
| Drizzle schema tables | 262 |
| Live DB tables | 131 |
| Tables in both | 131 |
| Tables NOT deployed to live DB | 131 |
| Orphaned tables (live only) | 0 |

**Exactly half of the Drizzle schema is not deployed to the live database.**

---

## Tables NOT Deployed to Live DB (131)

These tables are defined in `drizzle/schema.ts` but do NOT exist in the TiDB Cloud instance.

### Security & Auth (12 tables)
- `access_policies` - ABAC policy definitions
- `auth_enrichment_log` - OAuth enrichment tracking
- `auth_provider_tokens` - Multi-provider token storage
- `consent_tracking` - GDPR consent records
- `delegations` - User delegation workflows
- `encrypted_fields_registry` - PII field tracking
- `encryption_keys` - Key rotation tracking
- `mfa_backup_codes` - MFA backup codes
- `mfa_secrets` - MFA TOTP secrets
- `role_elevations` - Temporary role elevation (used by auto-revoke scheduler)
- `user_ai_boundaries` - Per-user AI limits
- `user_guardrails` - User safety guardrails

### Compliance & Disclaimers (11 tables)
- `compliance_predictions` - Dry-run compliance
- `compliance_prescreening` - 5-point fast check results
- `compliance_weekly_briefs` - Weekly summaries
- `coi_disclosures` - Conflict of interest tracking
- `coi_verification_badges` - COI verification
- `conversation_compliance_scores` - Per-conversation scores
- `disclaimer_audit` - Disclaimer history
- `disclaimer_interactions` - User engagement tracking
- `disclaimer_translations` - Multi-language disclaimers
- `disclaimer_versions` - Disclaimer version control
- `regulatory_alerts`, `regulatory_impact_analyses`, `regulatory_updates`

### AI & Knowledge Base (19 tables)
- `ai_tools`, `ai_tool_calls` - Tool registry and tracking
- `capability_modes` - 7 capability modes
- `knowledge_articles`, `knowledge_article_versions`, `knowledge_article_feedback`
- `knowledge_gaps`, `knowledge_ingestion_jobs`
- `knowledge_graph_edges`, `knowledge_graph_entities`
- `context_assembly_log` - Deep context assembly
- `model_cards`, `model_runs`, `model_output_records`, `model_scenarios`, `model_backtests`, `model_schedules`
- `analytical_models`
- `platform_learnings`

### Integrations (9 tables)
- `integration_providers` - Provider definitions
- `integration_connections` - User connections
- `integration_sync_logs`, `integration_sync_config`
- `integration_field_mappings`
- `integration_webhook_events`
- `carrier_import_templates`, `carrier_submissions`
- `enrichment_cache`

### Agent/Workflow (5 tables)
- `agent_templates`, `agent_autonomy_levels`, `agent_performance`
- `coaching_messages`
- `propagation_events`, `propagation_actions`

### Financial Domain (20+ tables)
- `calculator_scenarios` - Saved calculator inputs
- `suitability_profiles`, `suitability_dimensions`, `suitability_questions_queue`, `suitability_change_events`, `suitability_household_links`
- `plaid_holdings`, `plaid_webhook_log`
- `market_data_subscriptions`, `market_events`, `market_index_history`
- `tax_parameters`, `medicare_parameters`, `ssa_parameters`, `ssa_life_tables`
- `insurance_carriers`, `insurance_products`, `premium_finance_rates`
- `ltc_analyses`, `iul_crediting_history`
- `business_exit_plans`, `credit_profiles`
- `paper_trades`, `nitrogen_risk_profiles`

### Users & Core (5 tables)
- `users` - **NOTE: live DB has `users` table created via earlier migration, but Drizzle schema may define a newer version with additional columns**
- `browser_sessions`
- `onboarding_progress`
- `study_progress`
- `conversation_topics`

### Operations & Infrastructure (15+ tables)
- `deployment_history`, `deployment_checks`
- `feature_flags` (may exist via different migration)
- `health_scores`, `performance_metrics`, `load_test_results`
- `server_errors`
- `report_templates`, `report_jobs`, `export_jobs`
- `file_uploads`, `file_chunks`, `file_derived_enrichments`
- `generated_documents`, `document_templates`
- `portal_engagement`

---

## Impact Assessment

### Critical: Schema features won't work without deployment
1. **Role elevations auto-revoke** (added in audit v4) - needs `role_elevations` table
2. **Compliance pre-screening** - needs `compliance_prescreening`, `conversation_compliance_scores`
3. **Integration providers** - needs `integration_providers`, `integration_connections`
4. **Knowledge base** - needs `knowledge_articles`, `knowledge_article_versions`
5. **Agent workflows** - needs `agent_templates`, `propagation_events`
6. **Audit hash chain** (added in audit v4) - needs `entryHash`/`previousHash` columns on `audit_trail`
7. **DSAR fulfillment** (added in audit v4) - needs `consent_tracking`

### Medium: Features partially work without these tables
- Calculator persistence, suitability dimensions, market subscriptions
- Financial model result storage
- Regulatory monitoring

### Low: Nice-to-have tables
- Infrastructure monitoring, load testing, browser sessions

---

## Recommended Action

A migration file and deploy script have been prepared:

1. **Migration SQL:** `drizzle/0007_deploy_missing_tables.sql` (1,754 lines, 131 statements)
   - All `CREATE TABLE IF NOT EXISTS` (idempotent — safe to run multiple times)
   - Includes `ALTER TABLE audit_trail ADD COLUMN IF NOT EXISTS` for hash chain columns

2. **Deploy script:** `scripts/deploy-missing-tables.mjs`
   - Executes migration against `DATABASE_URL`
   - Reports progress, success/skipped/failed counts

3. **Run deployment:**
   ```bash
   DATABASE_URL="mysql://..." pnpm run db:deploy-missing
   ```

**Note:** TiDB Cloud is IP-whitelisted to Manus infrastructure. Deploy from a whitelisted environment.
