# Platform API Research — Connection Capabilities

## GHL (GoHighLevel)
- **Status**: CONNECTED (PIT token active, 493K contacts)
- **Pull sync**: Working via REST API (contacts, opportunities)
- **Push sync**: Working via REST API (create/update contacts)
- **Webhook registration**: PIT token doesn't support webhook management scope (404)
- **Webhook fallback**: ghlPolling.ts polls every 5 minutes
- **Action**: GHL webhook must be registered manually in GHL UI, or polling serves as fallback

## Dripify
- **Status**: NOT CONNECTED (0 connections)
- **API**: NO public REST API — confirmed by multiple sources
- **Webhook**: Outbound webhooks only (Dripify → external), set up in campaign settings
- **Integration path**: Zapier/Make.com webhooks only — Dripify sends data OUT via webhooks
- **Pull sync**: NOT POSSIBLE without API
- **Push sync**: NOT POSSIBLE without API
- **Action**: Can only receive inbound webhooks from Dripify campaigns. User must configure webhook URL in Dripify campaign settings.

## SMS-iT
- **Status**: NOT CONNECTED (0 connections)
- **API**: YES — full REST API at https://tool-it.smsit.ai/api-documentation
- **Auth**: Bearer token via API key
- **Contacts**: GET/POST/PUT contacts endpoints available
- **Webhook**: Supports webhook integration via Albato/n8n
- **Pull sync**: POSSIBLE with API key
- **Push sync**: POSSIBLE with API key
- **Action**: Need user's SMS-iT API key to connect

## Workable
- **Status**: NOT CONNECTED (0 connections)
- **API**: YES — full REST API (well-documented)
- **Auth**: Bearer token via API key
- **Candidates**: GET/POST candidates endpoints
- **Webhook**: Supports webhook subscriptions via API
- **Pull sync**: POSSIBLE with API key
- **Push sync**: POSSIBLE with API key
- **Action**: Need user's Workable API key and subdomain

## LinkedIn / Sales Navigator
- **Status**: NOT CONNECTED (0 connections)
- **API**: Manus Data API Hub has LinkedIn profile/search/company APIs available
- **Auth**: Via callDataApi — no user credentials needed
- **Pull sync**: POSSIBLE via Data API (search people, get profiles)
- **Push sync**: NOT POSSIBLE (LinkedIn doesn't allow programmatic connection requests)
- **Webhook**: NOT AVAILABLE
- **Action**: Can pull LinkedIn data via Data API without user credentials. Build enrichment pipeline.

## Summary
| Platform | Pull | Push | Webhook | Needs User Creds |
|----------|------|------|---------|-------------------|
| GHL | ✅ | ✅ | ⚠️ Manual | Already connected |
| Dripify | ❌ | ❌ | ✅ Inbound only | Campaign webhook URL |
| SMS-iT | ✅ | ✅ | ✅ | API key |
| Workable | ✅ | ✅ | ✅ | API key + subdomain |
| LinkedIn | ✅ | ❌ | ❌ | None (Data API) |
