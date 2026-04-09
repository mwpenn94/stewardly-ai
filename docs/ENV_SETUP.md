# Environment Variables Setup Guide

This document describes all optional environment variables that enhance Stewardly AI's functionality. The platform operates without these keys (graceful degradation), but enabling them unlocks additional data sources.

---

## Already Configured (System-Managed)

The following variables are automatically injected by the Manus platform and require no manual setup:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | MySQL/TiDB connection string |
| `JWT_SECRET` | Session cookie signing |
| `VITE_APP_ID` | Manus OAuth application ID |
| `OAUTH_SERVER_URL` | Manus OAuth backend base URL |
| `BUILT_IN_FORGE_API_URL` | Manus built-in APIs (LLM, storage, etc.) |
| `BUILT_IN_FORGE_API_KEY` | Bearer token for built-in APIs |
| `INTEGRATION_ENCRYPTION_KEY` | Encryption key for sensitive data (64 chars, already set) |
| `STRIPE_SECRET_KEY` | Stripe payment processing |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe frontend key |
| `PLAID_CLIENT_ID` / `PLAID_SECRET` | Plaid financial data aggregation |
| `SNAPTRADE_CLIENT_ID` / `SNAPTRADE_CONSUMER_KEY` | SnapTrade brokerage integration |
| `DEEPGRAM_API_KEY` | Voice transcription |
| `DAILY_API_KEY` | Video conferencing |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | LinkedIn OAuth |

---

## Optional: FRED API Key

**Purpose:** Powers real-time SOFR (Secured Overnight Financing Rate) data for premium finance calculations and market history charts.

**Impact when missing:** Premium finance rate calculations fall back to static defaults. Market history charts for interest rates return empty data with a console warning.

**Used by:**
- `server/services/premiumFinance/premiumFinanceRates.ts` — SOFR rate lookups
- `server/services/marketHistory/marketHistory.ts` — Historical rate data
- `server/services/verification.ts` — Data source verification

### Setup Steps

1. **Create a FRED account** at [https://fred.stlouisfed.org/](https://fred.stlouisfed.org/) (free, no credit card required)
2. **Request an API key** at [https://fred.stlouisfed.org/docs/api/api_key.html](https://fred.stlouisfed.org/docs/api/api_key.html)
3. You will receive a 32-character alphanumeric key via email (e.g., `abcdef1234567890abcdef1234567890`)
4. **Add the key to Stewardly:**
   - Open the Manus Management UI
   - Navigate to **Settings > Secrets**
   - Add a new secret with key `FRED_API_KEY` and paste your API key as the value
   - Click Save
5. **Restart the server** (the key takes effect on next server start)

### Verification

After setting the key, you can verify it works by checking the server logs for:
```
FRED API key validated successfully
```

If the key is invalid, you will see:
```
FRED_API_KEY not set — SOFR rates unavailable
```

---

## Optional: Census API Key

**Purpose:** Powers demographic data enrichment for financial planning — provides income distribution, population, and economic data by ZIP code for more accurate client profiling.

**Impact when missing:** Census-based demographic enrichment returns empty data. Financial planning recommendations still work but without localized demographic context.

**Used by:**
- `server/services/planning/censusApiClient.ts` — ZIP code demographic lookups

### Setup Steps

1. **Request a Census API key** at [https://api.census.gov/data/key_signup.html](https://api.census.gov/data/key_signup.html) (free, no credit card required)
2. Fill in your name, email, and organization
3. You will receive a 40-character key via email (e.g., `abcdef1234567890abcdef1234567890abcdef12`)
4. **Add the key to Stewardly:**
   - Open the Manus Management UI
   - Navigate to **Settings > Secrets**
   - Add a new secret with key `CENSUS_API_KEY` and paste your API key as the value
   - Click Save
5. **Restart the server** (the key takes effect on next server start)

### Verification

After setting the key, test by navigating to a client profile with a ZIP code. The demographic enrichment panel should populate with local income and population data.

If the key is invalid, you will see in server logs:
```
CENSUS_API_KEY not set — returning empty demographics
```

---

## Optional: GitHub Personal Access Token (admin Code Chat)

**Purpose:** Enables the "GitHub" tab on the admin **Code Chat** page (`/code-chat`) so operators can see integration status, list open pull requests on the configured repo, and — as follow-on iterations ship — trigger self-update commits and PRs from within the running app.

**Impact when missing:** The GitHub tab shows a "Not configured" notice with a link back to this doc. All other Code Chat tabs (Files, Roadmap, Diff) keep working. No server endpoints fail; reads and writes simply degrade to disabled.

**Used by:**
- `server/services/codeChat/githubClient.ts` — REST wrapper around api.github.com
- `server/routers/codeChat.ts` — `githubStatus` and `githubListOpenPRs` admin procedures
- `client/src/pages/CodeChat.tsx` — "GitHub" tab

**Setup:**

1. Create a GitHub Personal Access Token at [https://github.com/settings/tokens](https://github.com/settings/tokens) (or a fine-grained token scoped to your repo):
   - **Classic PAT:** check the `repo` scope (grants full repo access).
   - **Fine-grained PAT:** give it Contents (read/write) + Pull requests (read/write) on the target repo only.
2. Copy the token value (starts with `ghp_…` for classic, `github_pat_…` for fine-grained).
3. **Add to Stewardly secrets:**
   - Open the Manus Management UI → **Settings > Secrets**
   - Add a secret `GITHUB_TOKEN` with your token as the value.
   - (Optional) Add `GITHUB_REPO` with the target repo, e.g. `mwpenn94/stewardly-ai`. Defaults to `mwpenn94/stewardly-ai` if unset.
4. **Restart the server.**

### Verification

After setting the token, sign in as an admin and visit `/code-chat`. The **GitHub** tab should show:
- A green check with `<owner>/<repo>`
- Default branch name, visibility (public/private), description
- Any open pull requests on that repo

If the probe fails you'll see an inline error explaining whether the token is missing, lacks scope, or the API returned a non-2xx status.

---

## Optional: EMBA Learning content import

**Purpose:** Pulls the full EMBA content payload (definitions, chapters, subsections, practice questions, flashcards) from the public [`mwpenn94/emba_modules`](https://github.com/mwpenn94/emba_modules) repo into the `learning_*` tables.

**Impact when missing:** The `/learning` tracks render the structural skeleton (12 tracks + 8 disciplines from `seed.ts`) but have no chapters or questions until an admin runs the import manually from Content Studio.

**Used by:**
- `server/services/learning/embaImport.ts` — pure-fetch importer (no auth required; source repo is public)
- `server/services/learning/bootstrap.ts` — gated by `EMBA_IMPORT_ON_BOOT=true`
- `server/routers/learning.ts` — `learning.importFromGitHub` admin mutation
- `client/src/pages/learning/ContentStudio.tsx` — "Import from emba_modules" button (admin only)

**Setup (no token required):**

Option A — **Ad-hoc import via Content Studio (recommended):**
1. Sign in as an admin and open `/learning/studio`.
2. Click **Import from GitHub** under the "Import from emba_modules" card.
3. Watch the toast — it reports counts of definitions, chapters, subsections, questions, and flashcards added.
4. Navigate to `/learning` to verify the content now renders inside each track.

Option B — **Import at every server boot:**
- Set `EMBA_IMPORT_ON_BOOT=true` in the secrets panel. The server will call `importEMBAFromGitHub()` during `bootstrapLearning()` on every start (idempotent — every insert is dedup-gated).
- (Optional) Set `EMBA_DATA_URL` or `EMBA_TRACKS_URL` to override the default raw GitHub URLs if you fork the content repo.

### Verification

After the first import the `/learning` home should show non-zero chapter / flashcard / question counts on each track card. Hover each track for the breakdown. If content is still empty, check the server logs for `learning/embaImport` entries with the failure reason.

---

## Troubleshooting

If any environment variable is not being recognized after adding it:

1. **Check the Secrets panel** — ensure the key name matches exactly (case-sensitive)
2. **Restart the server** — environment variables are read at startup
3. **Check server logs** — look for validation messages in the startup output
4. **Verify the key format** — FRED keys are 32 chars, Census keys are 40 chars, GitHub classic PATs are 40 chars prefixed with `ghp_`

For Stripe-related issues, see **Settings > Payment** in the Management UI.

For all other secrets, contact support at [https://help.manus.im](https://help.manus.im).
