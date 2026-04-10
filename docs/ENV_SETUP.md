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

## GitHub (Code Chat read + multi-repo write)

**Purpose:** Gives Code Chat full read + write access to any GitHub repository the caller's token has access to — not just the Stewardly app repo. This includes:

- **Read:** repository metadata, open pull requests, file contents at any ref (the "GitHub" read tab)
- **Write (Pass 201):** list-my-repos, create/delete branches, atomic multi-file commits via the Git Data API, create/update/merge pull requests (merge, squash, rebase) — all exposed through the "Git Write" tab in Code Chat and the `codeChat.github*` tRPC procedures
- **Background:** queue "GitHub push" jobs that commit + optionally open a PR in the background so long-running changesets don't block the UI

**Impact when missing:** Both the "GitHub" read tab and the "Git Write" tab show a "Not connected" notice with direct links to `/integrations`. Local Code Chat tools (Files, Roadmap, Diff, Chat) keep working against the in-process workspace. No server endpoints fail; the GitHub surface simply degrades to disabled.

**Used by:**
- `server/services/codeChat/githubClient.ts` — REST wrapper around api.github.com
- `server/routers/codeChat.ts` — `githubStatus` and `githubListOpenPRs` admin procedures
- `client/src/pages/CodeChat.tsx` — "GitHub" tab

### Pass 77: two credential paths

Pass 77 split the GitHub credential loader into two paths that the Code Chat UI resolves in order:

**Path A — User-connected account (preferred)** ✅
The `github` provider is seeded into `integration_providers` (category: `middleware`, ownership tier: `professional`, auth method: `bearer_token`). Any authenticated user — including admins — can visit `/integrations`, find **GitHub** in the provider list, and paste a Personal Access Token. The credential is encrypted through the same `encryptCredentials()` helper that protects every other integration in the table, and `loadGitHubCredentialsForUser(userId)` reads it back with `decryptCredentials()` on every `codeChat.githubStatus` query.

**Pros:** per-user identities (self-update commits land under the admin's GitHub identity, not a shared bot), can be rotated from the UI, encrypted at rest, survives restarts.

**Path B — Deployment env var (fallback)** 🛠
If no user-connected account exists, the resolver falls through to the `GITHUB_TOKEN` process env var. This is the right choice for single-operator deployments where the same account drives every admin action.

**Pros:** zero-setup for solo deployments, works in tests / CI.
**Cons:** one identity for all admins; no UI rotation; requires server restart to change.

The Code Chat → GitHub tab now displays which path was resolved under the "Credential source" line so admins know whether they're acting as themselves or as the shared deployment bot.

### Setup (Path A — user-connected, recommended)

1. Create a GitHub Personal Access Token at [https://github.com/settings/tokens](https://github.com/settings/tokens):
   - **Classic PAT:** check the `repo` scope (full repo access, including write to any repo you can push to).
   - **Fine-grained PAT:** give it Contents (read/write) + Pull requests (read/write) + Metadata (read) on every repo you want the Git Write tab to reach. The Git Write tab enumerates whatever the token can see.
2. Copy the token value.
3. Sign in to Stewardly and visit `/integrations`.
4. Find **GitHub** in the provider list (category: Middleware) and click **Connect**.
5. Paste your PAT in the `token` field and save.
6. Visit `/code-chat` → **GitHub** tab. You should see a green check with the repo metadata and `Credential source: your connected account`.
7. Open the **Git Write** tab. You should see "Connected as @your-handle" and a dropdown of every repo your token can push to. Pick one and you'll get branches, a commit-&-push form (with load-from-repo), open PRs (with merge/squash buttons), and an open-PR form.

**Important:** Every write goes through **your** GitHub identity, not a shared bot. The `Git Write` tab is available to any authenticated user — their token's own scope is the hard access boundary. Admins using the local-workspace `write_file`/`edit_file`/`run_bash` path still need the server's admin role.

### Setup (Path B — env var fallback)

1. Create a PAT as above.
2. Add the secret `GITHUB_TOKEN` via the Manus Management UI → **Settings > Secrets**.
3. (Optional) Add `GITHUB_REPO` with the target repo, e.g. `mwpenn94/stewardly-ai`. Defaults to `mwpenn94/stewardly-ai` if unset.
4. Restart the server.
5. Visit `/code-chat` → GitHub tab. You should see `Credential source: deployment env var`.

### Verification

The **GitHub** tab should show:
- A green check with `<owner>/<repo>`
- Default branch name, visibility (public/private), description
- A "Credential source" line telling you whether you're on Path A or Path B
- Any open pull requests on that repo

The **Git Write** tab should show:
- "Connected as @your-handle" with the credential source
- A repo dropdown populated with every pushable repository your token can see
- Branches, commit form, open PRs, and create-PR cards for the selected repo

The **Jobs** tab should show any running/completed background jobs (autonomous sessions, GitHub push jobs) with their event log.

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
