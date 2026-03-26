# Stewardly — Environment Variables Reference

Generated: March 26, 2026

This document lists every environment variable used by the Stewardly platform, organized by category. Variables marked **System (auto-injected)** are managed by the Manus hosting platform and do not need manual configuration. Variables marked **User-provided** require you to supply credentials.

---

## 1. System Variables (Auto-Injected by Manus Platform)

These are automatically available in both dev and production. Do not hardcode or commit these.

| Variable | Used By | Purpose |
|---|---|---|
| `DATABASE_URL` | Server | MySQL/TiDB connection string |
| `JWT_SECRET` | Server | Session cookie signing secret |
| `VITE_APP_ID` | Server + Client | Manus OAuth application ID |
| `OAUTH_SERVER_URL` | Server | Manus OAuth backend base URL |
| `VITE_OAUTH_PORTAL_URL` | Client | Manus login portal URL (frontend redirect) |
| `OWNER_OPEN_ID` | Server | Project owner's Manus Open ID |
| `OWNER_NAME` | Server | Project owner's display name |
| `BUILT_IN_FORGE_API_URL` | Server | Manus built-in APIs (LLM, storage, notifications) |
| `BUILT_IN_FORGE_API_KEY` | Server | Bearer token for Manus built-in APIs (server-side) |
| `VITE_FRONTEND_FORGE_API_URL` | Client | Manus built-in APIs URL (frontend) |
| `VITE_FRONTEND_FORGE_API_KEY` | Client | Bearer token for Manus built-in APIs (frontend) |
| `VITE_ANALYTICS_ENDPOINT` | Client | Analytics endpoint URL |
| `VITE_ANALYTICS_WEBSITE_ID` | Client | Analytics website identifier |
| `NODE_ENV` | Server | Runtime environment (`development` or `production`) |
| `PORT` | Server | Server port (auto-assigned, do not hardcode) |
| `INTEGRATION_ENCRYPTION_KEY` | Server | Encryption key for integration credential storage |

---

## 2. Branding Variables

| Variable | Used By | Purpose | How to Set |
|---|---|---|---|
| `VITE_APP_TITLE` | Client | Application title displayed in browser tab and UI | Management UI > Settings > General |
| `VITE_APP_LOGO` | Client | Application logo URL | Management UI > Settings > General |

---

## 3. External Integration Credentials (User-Provided)

These require you to sign up with the respective service and provide API keys via Management UI > Settings > Secrets.

### Financial Data — SnapTrade (Portfolio Aggregation)

| Variable | Purpose | How to Obtain |
|---|---|---|
| `SNAPTRADE_CLIENT_ID` | SnapTrade API client identifier | [snaptrade.com/dashboard](https://snaptrade.com) — sign up for API access |
| `SNAPTRADE_CONSUMER_KEY` | SnapTrade API consumer key | Same dashboard, under API Keys |

**Status:** Secrets are configured in the platform. SnapTrade powers the brokerage account linking, portfolio positions, and holdings sync features.

### Financial Data — Plaid (Bank Account Linking)

| Variable | Purpose | How to Obtain |
|---|---|---|
| `PLAID_CLIENT_ID` | Plaid API client identifier | [dashboard.plaid.com](https://dashboard.plaid.com) — free sandbox keys available |
| `PLAID_SECRET` | Plaid API secret key | Same dashboard, under Keys |

**Status:** Secrets are configured in the platform. Plaid powers bank account linking, transaction categorization, and cash flow analysis. Currently referenced in integration test stubs — requires Plaid Link frontend integration for full production use.

### Authentication — Google OAuth

| Variable | Purpose | How to Obtain |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID | [console.cloud.google.com](https://console.cloud.google.com) > APIs & Services > Credentials |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret | Same page, under OAuth 2.0 Client IDs |

**Status:** Secrets are configured. Powers "Sign in with Google" authentication flow.

### Authentication — LinkedIn OAuth

| Variable | Purpose | How to Obtain |
|---|---|---|
| `LINKEDIN_CLIENT_ID` | LinkedIn OAuth client ID | [linkedin.com/developers](https://www.linkedin.com/developers/) > My Apps |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn OAuth client secret | Same page, under Auth tab |

**Status:** Secrets are configured. Powers "Sign in with LinkedIn" authentication flow.

### Video Conferencing — Daily.co

| Variable | Purpose | How to Obtain |
|---|---|---|
| `DAILY_API_KEY` | Daily.co API key for video rooms | [dashboard.daily.co](https://dashboard.daily.co) > Developers |

**Status:** Secret is configured. Powers the video meeting room creation and management features.

### Voice Transcription — Deepgram

| Variable | Purpose | How to Obtain |
|---|---|---|
| `DEEPGRAM_API_KEY` | Deepgram API key for speech-to-text | [console.deepgram.com](https://console.deepgram.com) > API Keys |

**Status:** Secret is configured. Powers real-time meeting transcription and voice note processing.

### Economic Data — FRED

| Variable | Purpose | How to Obtain |
|---|---|---|
| `FRED_API_KEY` | Federal Reserve Economic Data API key | [fred.stlouisfed.org/docs/api](https://fred.stlouisfed.org/docs/api/api_key.html) — free registration |

**Status:** Referenced in the economic data pipeline (`scheduledIngestion.ts`). Currently the pipeline runs successfully using public endpoints; the API key enables higher rate limits and additional series access.

---

## 4. Variables Summary by Status

| Category | Count | Status |
|---|---|---|
| System (auto-injected) | 16 | Fully configured, no action needed |
| Branding | 2 | Set via Management UI |
| SnapTrade | 2 | Configured in Secrets |
| Plaid | 2 | Configured in Secrets |
| Google OAuth | 2 | Configured in Secrets |
| LinkedIn OAuth | 2 | Configured in Secrets |
| Daily.co | 1 | Configured in Secrets |
| Deepgram | 1 | Configured in Secrets |
| FRED | 1 | Optional — public endpoints work without it |
| **Total** | **29** | |

---

## 5. Where to Manage Secrets

- **During development:** Secrets are injected automatically by the Manus platform
- **In production:** Management UI > Settings > Secrets
- **Database connection:** Management UI > Database panel > bottom-left settings icon (remember to enable SSL)
- **Never commit** `.env` files or hardcode secrets in source code
