# Blocked On

> Items that cannot proceed without external input, credentials, or decisions. Each item has a clear owner and unblock condition.

| ID | Blocked Item | Reason | Owner | Unblock Condition | Added Pass | Resolved Pass |
|---|---|---|---|---|---|---|
| B-1 | Stripe live mode | Sandbox not claimed; test keys only | User | Claim sandbox at Stripe dashboard before 2026-06-05 | 1 | — |
| B-2 | SnapTrade end-to-end | Needs real brokerage account for integration testing | User | Connect a test brokerage account via SnapTrade | 1 | — |
| B-3 | Plaid end-to-end | Needs Plaid sandbox or development credentials testing | User | Verify Plaid sandbox credentials work | 1 | — |
| B-4 | LinkedIn OAuth | Needs LinkedIn app approval for login flow | User | Complete LinkedIn developer app review | 1 | — |
| B-5 | EMBA content import | Requires network access to mwpenn94/emba_modules GitHub | Automated | Run embaImport seed after confirming repo accessibility | 1 | — |
