# WealthBridge AI — Integration Setup Guide

This guide covers the remaining integrations that require manual account creation due to reCAPTCHA/Cloudflare protection on their signup pages. Each integration has a **failover workaround** already active — the platform functions with demo data until live credentials are added.

---

## 1. Redtail CRM (30-Day Free Trial)

**Signup URL:** https://accounts.redtailtechnology.com/new_user/1?Product=leapfrog

**Pre-filled values (Steps 1-2 already validated):**

| Field | Value |
|---|---|
| First Name | Michael |
| Last Name | Penn |
| Company | WealthBridge Financial Group |
| Address | 7255 E Snyder Rd, Unit 6206 |
| City | Tucson |
| State | Arizona |
| Zip | 85750 |
| Phone | 5023869016 |
| Email | mwpenn94@gmail.com |
| Institution | (none) |
| Master Rep ID | WBFG |
| How did you hear | Internet Search |
| Current Database | Excel Spreadsheet |
| Sample Data | Yes |

**Step 3 (Username/Password):**
- Username: `mpenn_wbfg` (or your preference)
- Password: Must be 8+ chars, only special chars allowed: `!@#$%^&*`
- Complete the reCAPTCHA

**Step 4:** Accept Terms of Use

**After signup — Get API Key:**
1. Log into https://crm.redtailtechnology.com
2. Go to Settings → API → Generate API Key
3. In WealthBridge AI, navigate to Integrations → Redtail CRM → Connect
4. Enter your API Key and User Key (your username)

---

## 2. Wealthbox CRM (14-Day Free Trial)

**Signup URL:** https://app.crmworkspace.com/signup

**Steps:**
1. Navigate to the signup URL
2. Enter your name, email (mwpenn94@gmail.com), and create a password
3. Verify your email
4. Complete the onboarding wizard

**After signup — Get API Token:**
1. Log into https://app.crmworkspace.com
2. Go to Settings → API Access → Generate Token
3. In WealthBridge AI, navigate to Integrations → Wealthbox CRM → Connect
4. Enter your Bearer Token

---

## 3. SMS-iT (7-14 Day Free Trial)

**Signup URL:** https://app.smsit.ai/register

**Steps:**
1. Navigate to the signup URL
2. Enter your name, email (mwpenn94@gmail.com), and create a password
3. Verify your email
4. Complete the onboarding wizard

**After signup — Get API Token:**
1. Log into https://app.smsit.ai
2. Go to Settings → API → Copy API Token
3. In WealthBridge AI, navigate to Integrations → SMS-iT → Connect
4. Enter your Bearer Token

---

## Already Connected Integrations

These integrations are fully verified and operational:

| Integration | Status | Verification |
|---|---|---|
| **Plaid** | ✅ Live (Sandbox) | Full E2E: 12 accounts, $213K balance, 13 holdings |
| **SnapTrade** | ✅ Configured | Platform credentials set, API reachable |
| **Stripe** | ✅ Live (Test) | Full E2E: checkout, payment, subscription, portal |
| **Deepgram** | ✅ Live | API key valid, projects accessible |
| **Daily.co** | ✅ Live | API key valid, rooms listable |
| **Google OAuth** | ✅ Configured | Client ID + Secret set |
| **LinkedIn OAuth** | ✅ Configured | Client ID + Secret set |
| **FRED/BLS/BEA/Census** | ✅ Live | All API keys validated |
| **GHL** | ⏳ Separate component | User has existing account to import |
| **GLEIF/OpenFIGI** | ✅ Free | No credentials needed |
| **SEC EDGAR/FINRA** | ✅ Free | No credentials needed |

---

## Failover Workarounds

All paid integrations (GHL, Wealthbox, Redtail, SMS-iT) have failover workarounds active:

- **Demo mode**: Generates realistic sample data when no credentials are available
- **Graceful degradation**: Adapters detect missing credentials and return demo data with `[DEMO]` markers
- **Automatic upgrade**: When real credentials are added via the Integrations page, the system seamlessly switches to live mode
- **Status endpoint**: `trpc.integrations.failoverStatus` returns the current mode for each integration

---

## Estimated Setup Time

| Integration | Time | Difficulty |
|---|---|---|
| Redtail CRM | ~5 minutes | Easy (form + reCAPTCHA) |
| Wealthbox CRM | ~3 minutes | Easy (email + password) |
| SMS-iT | ~3 minutes | Easy (email + password) |
| **Total** | **~11 minutes** | |

All three can be done in parallel by opening each signup URL in a separate tab.
