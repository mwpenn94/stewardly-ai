# Database Table Inventory (Actual DB)

## Tables that EXIST in the database (33 total):
1. __drizzle_migrations
2. affiliated_resources
3. audit_trail
4. client_associations
5. conversations
6. document_chunks
7. documents
8. enrichment_cohorts
9. enrichment_datasets
10. enrichment_matches
11. feedback
12. manager_ai_settings
13. memories
14. messages
15. organization_ai_settings
16. organization_landing_page_config
17. organization_relationships
18. organizations
19. products
20. professional_ai_settings
21. professional_context
22. prompt_experiments
23. prompt_variants
24. quality_ratings
25. review_queue
26. suitability_assessments
27. user_organization_roles
28. user_preferences
29. user_profiles
30. user_relationships
31. users
32. view_as_audit_log
33. workflow_checklist

## KEY FINDING: DB uses "organizations" NOT "firms"!
- organizations (NOT firms)
- organization_ai_settings (NOT firm_ai_settings)
- organization_landing_page_config (NOT firm_landing_page_config)
- organization_relationships (NOT firm_relationships)
- user_organization_roles (NOT user_firm_roles)
- user_relationships (exists in DB)

## Schema file uses "firms" — MISMATCH!
The drizzle schema.ts references firms, firm_members, firm_ai_settings, etc.
But the actual DB has organizations, organization_ai_settings, etc.
This is the root cause of many runtime errors.
