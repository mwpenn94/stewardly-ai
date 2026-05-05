# audit/04 — Preservation Targets

**Generated:** 2026-05-05 | **Pass:** Phase 0 Audit

---

## 1. Purpose

Per §III.8 Anchor 13 and v2.0.3 §1.1, this document enumerates every preservation target across seven categories. Each item must survive Phase A absorption intact.

---

## 2. Category 1 — Existing Functionality

| Item | Location | Dependencies | Modification Risk | Preservation Strategy |
|------|----------|-------------|-------------------|----------------------|
| Wealth Engine (UWE/BIE/HE/SCUI) | `server/shared/calculators/`, `server/engines/` | 656 tests, 30+ tRPC procedures | Low — absorption is additive | Untouched |
| WealthChat (5 tools + safety) | `server/services/wealthChat/` | contextualLLM, deep context assembler | Medium — context assembly may change | Version-tracked; test coverage gates |
| Learning Engine (FSRS-5 SRS) | `server/services/learning/`, `server/routers/learning.ts` | 15+ test files, assessment sessions | Low — absorption is additive | Untouched |
| People Engine (CRM + Cadence) | `server/routers/ghlWebhook.ts`, `server/services/cadenceEngine.ts` | GHL webhook, lead pipeline | Low — absorption is additive | Untouched |
| Compliance Engine (FINRA/SEC) | `server/routers/compliance.ts` | contextualLLM, compliance rules | Medium — LLM routing may change | Test coverage gates |
| COI Network | `server/coiNetwork.ts` | GHL outbound sync | Low | Untouched |
| Agentic Execution (G1-G8) | `server/routers/agenticExecution.ts` | contextualLLM, gate reviews | Medium — may wire to AEGIS | Additive-extended |
| Improvement Engine | `server/shared/engine/improvementEngine.ts` | signals, hypotheses, test results | Low | Untouched |
| Edge TTS | `server/edgeTTS.ts` | msedge-tts package | Low | Untouched |
| MCP Server | `server/mcp/stewardlyServer.ts` | Financial advisory tools | Low | Untouched |
| PersonaSidebar5 | `client/src/components/PersonaSidebar5.tsx` | Navigation config, role system | Medium — may add new items | Additive-extended |
| AppShell | `client/src/components/AppShell.tsx` | PersonaSidebar5, keyboard shortcuts | Low | Untouched |
| 222 client pages | `client/src/pages/` | Various tRPC hooks | Low — absorption adds pages | Untouched |
| 194 client components | `client/src/components/` | UI library | Low | Untouched |

---

## 3. Category 2 — User-Facing Routes and URLs

| Route Pattern | Purpose | Preservation Strategy |
|---------------|---------|----------------------|
| `/chat` | Primary chat interface | Untouched |
| `/wealth-engine` | Wealth Engine hub | Untouched |
| `/people/clients` | People hub | Untouched |
| `/intelligence-hub` | Intelligence hub | Untouched |
| `/learning/*` (20+ routes) | Learning engine | Untouched |
| `/admin/*` (15+ routes) | Admin surfaces | Untouched |
| `/settings` | User settings | Additive-extended (BYO tab) |
| `/api/trpc/*` | All tRPC endpoints | Untouched |
| `/api/stripe/webhook` | Stripe webhook | Untouched |
| `/api/oauth/callback` | Auth callback | Untouched |

---

## 4. Category 3 — Environment Variables and Secrets

| Variable | Purpose | Referenced In | Preservation Strategy |
|----------|---------|--------------|----------------------|
| `DATABASE_URL` | TiDB connection | `server/_core/`, drizzle config | Untouched |
| `JWT_SECRET` | Session signing | `server/_core/` | Untouched |
| `VITE_APP_ID` | OAuth app ID | Client const | Untouched |
| `OAUTH_SERVER_URL` | OAuth backend | `server/_core/oauth.ts` | Untouched |
| `OWNER_OPEN_ID` | Owner identification | Auth middleware | Untouched |
| `BUILT_IN_FORGE_API_URL` | LLM API | `server/_core/llm.ts` | Untouched |
| `BUILT_IN_FORGE_API_KEY` | LLM auth | `server/_core/llm.ts` | Untouched |
| `GHL_API_KEY` | GoHighLevel | GHL services | Untouched |
| `GHL_LOCATION_ID` | GHL location | GHL services | Untouched |
| `GHL_WEBHOOK_SECRET` | GHL webhook verification | `server/routers/ghlWebhook.ts` | Untouched |
| `PLAID_CLIENT_ID` | Plaid integration | Plaid service | Untouched |
| `PLAID_SECRET` | Plaid auth | Plaid service | Untouched |
| `SNAPTRADE_CLIENT_ID` | SnapTrade | SnapTrade service | Untouched |
| `SNAPTRADE_CONSUMER_KEY` | SnapTrade auth | SnapTrade service | Untouched |
| `STRIPE_SECRET_KEY` | Payments | Stripe router | Untouched |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhooks | Webhook handler | Untouched |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Client Stripe | Checkout UI | Untouched |
| `FRED_API_KEY` | Economic data | FRED adapter | Untouched |
| `BLS_API_KEY` | Labor data | BLS adapter | Untouched |
| `BEA_API_KEY` | Economic analysis | BEA adapter | Untouched |
| `CENSUS_API_KEY` | Demographics | Census client | Untouched |
| `DAILY_API_KEY` | Video meetings | Daily.co service | Untouched |
| `DEEPGRAM_API_KEY` | Voice transcription | Deepgram service | Untouched |
| `RESEND_API_KEY` | Email delivery | Email service | Untouched |
| `LINKEDIN_CLIENT_ID` | LinkedIn OAuth | Social OAuth | Untouched |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn auth | Social OAuth | Untouched |
| `GOOGLE_CLIENT_ID` | Google OAuth | Social OAuth | Untouched |
| `GOOGLE_CLIENT_SECRET` | Google auth | Social OAuth | Untouched |
| `INTEGRATION_ENCRYPTION_KEY` | Integration secrets | Integration storage | Untouched |
| `ALLOWED_ORIGINS` | CORS | Express middleware | Untouched |

---

## 5. Category 4 — Build and Deploy Configuration

| Item | Location | Preservation Strategy |
|------|----------|----------------------|
| `package.json` | Root | Additive-extended (new deps only) |
| `vite.config.ts` | Root | Untouched |
| `vitest.config.ts` | Root | Untouched |
| `tsconfig.json` | Root | Untouched |
| `drizzle.config.ts` | Root | Untouched |
| Manus hosting config | Platform-managed | Untouched |
| GitHub Actions (if any) | `.github/` | Untouched |

---

## 6. Category 5 — Customer Data

| Item | State | Preservation Strategy |
|------|-------|----------------------|
| Production tenants | Unknown — likely test/demo only | Schema migrations must be additive |
| User accounts | Exist (OAuth-based) | Never delete columns |
| Conversation history | Stored in messages table | Untouched |
| Financial profiles | Stored in DB | Untouched |
| Learning progress | Stored in DB (SRS cards, streaks, achievements) | Untouched |
| Lead pipeline data | Stored in DB | Untouched |
| Audit logs | Stored in DB | Untouched |

---

## 7. Category 6 — Institutional Documentation

| File | Purpose | Preservation Strategy |
|------|---------|----------------------|
| `recursive-optimization-spec.md` | Canonical optimization methodology | Untouched |
| `todo.md` (9,479 lines) | Pass history and feature tracking | Append-only |
| `audit/` directory | This audit | Append-only |
| `CHANGELOG` (if exists) | Version history | Append-only |

---

## 8. Category 7 — Feature Flags and Runtime Configuration

| Item | Location | Preservation Strategy |
|------|----------|----------------------|
| Progressive disclosure levels (1-4) | DisclosureContext | Untouched |
| Role-based access (guest/user/advisor/manager/admin) | PersonaSidebar5, routers | Untouched |
| Theme preference (dark/light/system) | localStorage `wb_theme` | Untouched |
| Sidebar collapsed state | localStorage `appshell-collapsed` | Untouched |
| i18n language preference | i18next-browser-languagedetector | Untouched |
| AI config layers (5-layer system) | `server/shared/config/` | Untouched |

---

## 9. Verification Methods

For each preservation target, verification after absorption:

1. **Untouched items:** `git diff` shows zero changes to the file
2. **Additive-extended items:** `git diff` shows only additions (no deletions, no modifications to existing lines)
3. **Version-tracked items:** Test suite passes with identical assertions
4. **Schema items:** Migration is purely additive (new tables/columns only, no ALTER/DROP on existing)
5. **Environment variables:** All existing variables still referenced and functional
6. **Routes:** All existing routes still resolve to their original handlers
