# Schema Mismatch: lead_pipeline

## Actual DB Columns
| Column | Type | Notes |
|--------|------|-------|
| id | int | PK, auto-increment |
| firmId | int | camelCase! |
| professionalId | int | camelCase! |
| firstName | varchar(255) | camelCase! |
| lastName | varchar(255) | camelCase! |
| email | varchar(255) | NOT email_hash |
| phone | varchar(50) | NOT phone_hash |
| source | varchar(100) | NOT lead_source_id |
| status | enum(...) | Different enum values |
| propensityScore | decimal(5,2) | camelCase! |
| primaryInterest | varchar(100) | NOT in schema |
| estimatedIncome | decimal(15,2) | NOT in schema |
| protectionScore | decimal(5,2) | NOT in schema |
| notesJson | json | NOT in schema |
| crmExternalId | varchar(255) | NOT ghl_contact_id |
| created_at | bigint | Unix timestamp, NOT timestamp type |
| updated_at | bigint | Unix timestamp, NOT timestamp type |
| location_id | int | NOT in schema |
| enrichment_data | json | Added in ext6 migration |
| segment_data | json | Added in ext6 migration |

## Drizzle Schema Columns (schema.ts)
| Column | DB Name | Notes |
|--------|---------|-------|
| id | id | OK |
| leadSourceId | lead_source_id | DB has `source` (varchar) instead |
| firstName | first_name | DB has `firstName` (camelCase) |
| lastName | last_name | DB has `lastName` (camelCase) |
| emailHash | email_hash | DB has `email` (plain varchar) |
| phoneHash | phone_hash | DB has `phone` (plain varchar) |
| linkedinUrl | linkedin_url | NOT IN DB |
| company | company | NOT IN DB |
| title | title | NOT IN DB |
| city | city | NOT IN DB |
| state | state | NOT IN DB |
| zip | zip | NOT IN DB |
| targetSegment | target_segment | NOT IN DB |
| segmentData | segment_data | OK (added in ext6) |
| enrichmentData | enrichment_data | OK (added in ext6) |
| propensityScore | propensity_score | DB has `propensityScore` (camelCase, decimal(5,2)) |
| propensityTier | propensity_tier | NOT IN DB |
| status | status | Different enum values |
| assignedAdvisorId | assigned_advisor_id | NOT IN DB |
| assignedAt | assigned_at | NOT IN DB |
| isControlGroup | is_control_group | NOT IN DB |
| emailConsentGranted | email_consent_granted | NOT IN DB |
| unsubscribed | unsubscribed | NOT IN DB |
| piiDeletionRequested | pii_deletion_requested | NOT IN DB |
| ghlContactId | ghl_contact_id | DB has `crmExternalId` instead |
| ghlOpportunityId | ghl_opportunity_id | NOT IN DB |
| createdAt | created_at | DB uses bigint, schema uses timestamp |
| updatedAt | updated_at | DB uses bigint, schema uses timestamp |

## Key Issues
1. DB uses camelCase column names; schema uses snake_case
2. DB has columns not in schema: firmId, professionalId, primaryInterest, estimatedIncome, protectionScore, notesJson, crmExternalId, location_id
3. Schema has columns not in DB: linkedinUrl, company, title, city, state, zip, targetSegment, propensityTier, assignedAdvisorId, assignedAt, isControlGroup, emailConsentGranted, unsubscribed, piiDeletionRequested, ghlContactId, ghlOpportunityId, leadSourceId
4. Timestamp types differ: DB uses bigint (unix ms), schema uses timestamp
5. Status enum values differ
6. 210 rows exist with real data

## Strategy: Update schema.ts to match actual DB
- Keep all existing data intact
- Update Drizzle schema to reflect actual column names and types
- Add missing DB columns to schema
- Remove schema-only columns OR add them via ALTER TABLE
