# Integrations Matrix (Scope #7)

> Tracks scope #7. Every integration connector (SnapTrade, Plaid, CRM, email, calendar, etc.) has a row with status `absent | partial | match | superior` + commit SHA + evidence. Connectors must be tested end-to-end with real or sandbox credentials.

## Active Integrations

| Integration | Type | Status | Auth Method | Evidence |
|---|---|---|---|---|
| SnapTrade | Brokerage aggregation | partial | OAuth2 + client_id/consumer_key | Server routes exist; needs end-to-end testing |
| Plaid | Banking aggregation | partial | API key + secret | Server routes exist; needs end-to-end testing |
| Stripe | Payments | partial | API key + webhook secret | Checkout sessions + webhook handler implemented |
| Google OAuth | Authentication | match | OAuth2 client_id/secret | Login flow working |
| LinkedIn OAuth | Authentication | partial | OAuth2 client_id/secret | Configured but needs testing |
| Daily.co | Video conferencing | partial | API key | Configured; needs UI integration |
| Deepgram | Speech-to-text | partial | API key | Configured; needs UI integration |

## Dynamic Integration Framework

| Capability | Status | Evidence |
|---|---|---|
| Schema inference from API responses | partial | `schemaInference.ts` — infers field types, PK, semantic hints |
| CRM canonical mapping | partial | `crmCanonicalMap.ts` — maps arbitrary fields to CRM canonical |
| Schema drift detection | partial | `schemaDrift.ts` — detects field additions, removals, type changes |
| Adapter code generation | partial | `adapterGenerator.ts` — generates field mappings with direction |
| Personalization hints | partial | `personalizationHints.ts` — derives display/filter/sort hints |

## Planned Integrations

| Integration | Type | Priority | Notes |
|---|---|---|---|
| Redtail CRM | CRM | high | Common advisor CRM |
| Wealthbox CRM | CRM | high | Common advisor CRM |
| Salesforce | CRM | medium | Enterprise advisor CRM |
| Google Calendar | Scheduling | medium | Meeting scheduling |
| Outlook/Exchange | Email + Calendar | medium | Enterprise email |
| DocuSign | Document signing | low | E-signatures |
| Riskalyze | Risk assessment | low | Portfolio risk scoring |

---

## Row-Update-Log

## Row-Current-State
