# Stewardly Phase 5 — Command Center + Campaign Lifecycle + Recruiting/ATS

> **Target repo:** `mwpenn94/stewardly-ai`
> **Additional repo:** `mwpenn94/stewardly-command-center`
> **Phase:** 5 of 8
> **Scope:** CRM/marketing command layer (GHL/Dripify/LinkedIn/SMS-iT/Workable), end-to-end campaign lifecycle (ideation → AI content → deployment → bidirectional sync → analytics), LinkedIn profile/page management, Workable ATS, candidate/prospect/partner lifecycle management, dynamic segmentation, marketing asset library import, multitenancy
> **Prior phases:** Phase 1 (UI, sharing kit), Phase 3 (client data), Phase 4 (AI agent drives campaigns). Read prior `PHASE_*_EXIT.md` files.
> **Reference docs needed:** `MANUS_PROMPT_COMMAND_CENTER.md`, 6 marketing asset zips
> **Google Drive context:** `WealthBridge Shared Drive` — Spreadsheets folder (Combined Pipeline, Engagement Database, Event Schedule, Executive Summary), Documents folder (Inbound Assessments, Outbound Prospects)

---

## CORE RULES

1. **Run continuously.** Assess → optimize/build → validate → ship, repeated.
2. **Every pass ships observable work.**
3. **Self-score honestly.** Exit at all must-have ≥8 × 3 consecutive.
4. **Anti-regression absolute.** Phases 1-4 must not regress.
5. **Build-from-zero:** score 1-3 = construct, not polish.

**Termination:** (1) User stop. (2) Platform limit → `HANDOFF.md`. (3) Merge-gate → `BLOCKED_ON.md`. (4) 1-hour active stall with ≥6 novel attempts → `STALLED.md`.

---

## KNOWN EXECUTION FAILURE — COMMAND CENTER ENTIRELY NON-EXISTENT

In prior Manus runs, **NOTHING from the stewardly-command-center repo was incorporated into the app.** No CRM surface, no campaign management, no contact database, no marketing automation — the entire phase was skipped. This is a complete Phase 5 failure. Every criterion starts at 1 (absent).

**The fix:** Actually clone `mwpenn94/stewardly-command-center`, read its code, understand its architecture, and build the CRM/campaign surfaces into stewardly-ai. If the repo is inaccessible, build CRM/campaign capabilities from scratch per Rule 14. Do NOT skip this phase.

---

## WHAT PHASE 5 BUILDS

Phase 5 adds a complete marketing/CRM/recruiting command layer with 6 major capabilities:

1. **Contact lifecycle management** — unified contact DB with role-specific lifecycle stages
2. **Campaign lifecycle** — end-to-end from ideation through bidirectional sync
3. **Marketing asset library** — import of 6 production-ready content zips
4. **LinkedIn profile/page management** — beyond outreach
5. **Workable ATS integration** — recruiting pipeline management
6. **Dynamic user-defined segmentation** — compound filter logic with persistence and sharing

---

## 1. CONTACT LIFECYCLE MANAGEMENT

### Canonical lifecycle stages (from live v4 spreadsheets — preserve exactly)

**Outbound / prospect (8 stages):**
Prospect Identified → Initial Outreach → Confidential Exploration → Deal Structure Discussion → Licensing & Transition → Converted / Declined / On Hold

**Inbound / candidate (12 stages):**
Lead Identified → Initial Outreach → Discovery Meeting → WB Overview Presented → Senior Leadership Intro → Business Plan Review → Offer Extended → Offer Accepted → Licensing & Onboarding → Active Advisor / Declined / On Hold

**Partner / referral network (7 stages):**
Partner Identified → Initial Outreach → Meeting Scheduled → Active Referrals → Strategic Alliance / Inactive / Declined

Canonical partner segments (baseline from Engagement Database v4):
- CPAs & Tax Advisors (~329, ~27%)
- Agricultural Clients (~302, ~25%)
- Nonprofits & Foundations (~204, ~17%)
- Estate & Trust Attorneys (~177, ~15%)
- Referring Agencies (~128, ~11%)
- HR & Benefits Consultants (~74, ~6%)

**Event journey (8 stages):**
Event Identified → Planning → Outreach Sent → Confirmed → Completed → Follow-Up → Closed / Cancelled

**Client lifecycle:**
prospect → lead → qualified → consultation → planning → client → retained → reactivation/lost

**Affiliate lifecycle:**
identified → outreach → exploratory → MOU/agreement → active partnership → review/renewal → terminated

### Contact record architecture
- Single unified contact record carries through all lifecycles
- Role-specific stages are VIEWS on the same record (a contact can be both a prospect AND a partner)
- **Tier classification** (Tier 1/2/3/4) and **region classification** (R1-R7, NM, OOS, TBD) are first-class attributes
- Stage transitions trigger downstream actions (onboarding workflow, learning path, welcome campaign, manager notification)
- Stage regressions trigger retention/recovery sequences
- Reviews/notes per stage (searchable, attributable, shareable per Rule 15)
- Cross-team handoffs are explicit (receiving party acknowledges)

### Cross-file reference integrity
The 6 v4 spreadsheets are cross-linked. Preserve as database foreign keys:
- Engagement_Database ↔ partner contacts who may attend/host events
- Prospect_Database ↔ outbound prospects targeted for event invitations
- Candidate_Database ↔ inbound candidates who may attend events
- Combined_Pipeline ↔ unified pipeline for event-driven conversions
- Executive_Summary ↔ org-level KPIs
- Event_Schedule ↔ event calendar referencing all contact types

---

## 2. CAMPAIGN LIFECYCLE (end-to-end)

### Stage 1 — Ideation
Advisor (or AI agent via Phase 4 Mode 3) defines a campaign goal:
- "Recruit 5 candidates in NM Region 3 over 60 days"
- "Convert webinar attendees into discovery calls"
- "Reactivate dormant clients with quarterly review offer"

System suggests: campaign approaches, available templates (from asset library), target segment (predefined or user-defined), channels, and historical performance data.

### Stage 2 — AI-assisted content generation
Phase 4 AI generates personalized content from base templates:
- Adapts tone, segment-appropriate language, regional references, advisor's voice
- Can compose entirely new content where templates don't fit
- Compliance checks flag regulated language

### Stage 3 — Multi-platform deployment
System schedules and deploys across all selected channels simultaneously:
- GHL (email drip sequences)
- Dripify (LinkedIn outreach sequences)
- SMS-iT (text campaigns)
- Direct LinkedIn/FB/IG posts
- Workable (recruiting job postings + candidate communication)

Cross-channel timing coordinated — no contact gets simultaneous email + SMS + LinkedIn outreach within configurable cooldown window.

### Stage 4 — Live monitoring + bidirectional sync

**This is the most critical capability.** Every platform reports back. Every update propagates.

| Sync pair | What syncs | Direction |
|---|---|---|
| GHL ↔ Stewardly | Lifecycle stage, contact data | Bidirectional |
| LinkedIn engagement ↔ GHL | Post engagement (likes, comments, messages, profile visits) → lifecycle advance; connection accepted → GHL contact created | LinkedIn → GHL |
| LinkedIn profile/page ↔ Stewardly | Profile edits push to LinkedIn; page post engagement metrics flow back | Bidirectional |
| Workable ↔ GHL ↔ Stewardly | Applicant created → Stewardly candidate + GHL contact at "sourced"; stage progression propagates both ways; hire triggers onboarding | Bidirectional |
| Email ↔ GHL ↔ all | Open/click/reply → lifecycle advance + downstream actions; booking → drop from sequence | GHL → Stewardly + channels |
| SMS ↔ GHL | Delivery/read/reply → GHL; reply → advisor notification + auto-pause outbound | Bidirectional |
| Calendar/event ↔ GHL | Booking → remove from drips + add to "active conversation"; event attendance → engagement logged | Bidirectional |
| Wealth engine ↔ Command center | Plan opened → "active engagement"; plan shared → touch logged | Stewardly → GHL |
| Google Sheets ↔ Contact DB | Live v4 spreadsheets as sync source; changes flow both ways | Bidirectional |

**Sync infrastructure requirements:**
- Webhook/event subscription for each platform
- Idempotency (same event 2x → 1 update)
- Conflict resolution (same contact, 2 channels, conflicting state in same minute → defined rule)
- Sync status user-visible on contact card ("Last GHL sync: 2 min ago")
- Sync failures surface as actionable alerts

### Stage 5 — Analytics + iteration
Per-campaign dashboards: sends / delivered / opens / clicks / replies / conversions — per channel, per template, per segment, per region. AI-suggested optimizations.

---

## 3. MARKETING ASSET LIBRARY IMPORT

Import from 6 zips (see full inventory in master orchestration doc):
- **180 HTML drip emails** organized by segment (residential, commercial, etc.) with A/B/R sequences. Adapt to GHL merge fields. Do NOT re-author.
- **Production-ready scripts** (Call, SMS, LinkedIn, FB/IG, Dripify templates, GHL specs, digital ads, engagement guides)
- **CRM-ready spreadsheets** (Prospect/Candidate/Combined Pipeline/Engagement/Event Schedule databases)
- **Visual assets** (LinkedIn carousels, social graphics, event materials)
- **Strategy docs** (Campaign Playbook, Content Calendar, Master Content Strategy, Webinar/Roundtable/Community Event outlines)
- **Year-long social content** (LinkedIn + FB/IG, 12 months)

Templates organized by: channel, segment, sequence stage, purpose. Shareable per Rule 15 with fork-and-customize lineage tracking.

---

## 4. LINKEDIN PROFILE/PAGE MANAGEMENT

Beyond Dripify outreach:
- Edit advisor profile sections (about, experience, skills, featured content) from Stewardly
- Manage company page content (banner, about, posts, articles, employee advocacy)
- Schedule and publish LinkedIn posts/articles directly
- Employee advocacy coordination (MD posts → system suggests team re-share → tracks adoption)
- AI-powered profile optimization recommendations
- Profile/page change history and rollback

**API constraints:** LinkedIn API restricts some profile operations. For restricted actions: use Phase 4 agent browser-operator OR fall back to "draft and copy-paste" workflow. Document which actions are automated vs assisted vs manual.

---

## 5. WORKABLE ATS INTEGRATION

- Create and publish job postings from Stewardly → Workable → downstream boards (Indeed, LinkedIn Jobs, ZipRecruiter)
- Candidate pipeline: sourced → screened → interview → offer → hired/declined
- Bidirectional sync with GHL and Stewardly contacts
- Interview scheduling integrated with calendar
- Candidate communication (email, SMS, LinkedIn) launchable from candidate record
- **Hire triggers downstream:** Phase 2 onboarding workflow assignment, learning path enrollment, Rule 15 feature permission grants, manager notification

---

## 6. DYNAMIC USER-DEFINED SEGMENTATION

- **Predefined segments preserved:** residential, commercial, recruiting, affiliates, regions, partner types
- **User-defined segments:** compound conditions (AND/OR) across contact attributes, engagement behavior, pipeline stage, tags
- **Dynamic vs static:** dynamic recomputes on reference; static snapshots at creation
- **Visual query builder** (no SQL) with preview and test runs
- **Segment sharing** per Rule 15; segments applicable to any campaign, template, workflow, dashboard
- **AI-suggested segments:** "you frequently filter for AZ + pre-retiree + email-engaged — save as segment?"

---

## EVENT SCHEDULE SURFACE

The command center includes a first-class event management surface with 7 tabs (from Event Schedule v4):
- Event Summary (dashboard)
- Master Event Schedule (~646 events)
- Opportunity Organizations (~159)
- Recruiting Pipeline (~142)
- Region Summary
- Organizations Directory (~171)
- Limitations & Gaps (~19)

Tracking columns per event: Event Journey Stage, Assigned MD, Assigned RVP, Event Lead, Last Update Date, Next Action Date, Event Notes.

---

## MULTITENANCY

Per Rule 15. Every database query, API route, UI surface is tenant-scoped. Row-level security or equivalent. Test with ≥2 simulated tenants. Same permission model as rest of platform. Reuse Phase 1's sharing components.

---

## EXIT CRITERIA

- [ ] All must-have criteria ≥8 × 3 consecutive passes
- [ ] Command center structure inherited from stewardly-command-center repo (or built from scratch if inaccessible)
- [ ] Multitenancy with ≥2 simulated tenants
- [ ] Content asset library imported ≥95% completeness
- [ ] Canonical lifecycle stages (Outbound 8, Inbound 12, Partner 7, Event 8) implemented exactly
- [ ] Tier/region taxonomy (4 tiers, 9 regions) preserved as first-class attributes
- [ ] Cross-file reference relationships enforced as DB foreign keys
- [ ] Event Schedule surface operational with all 7 tabs
- [ ] End-to-end campaign lifecycle demonstrated on ≥1 complete campaign (ideation → content → deployment → sync → analytics)
- [ ] Bidirectional sync demonstrated for ≥6 platform pairs
- [ ] LinkedIn profile/page management demonstrated (≥1 edit + ≥1 post + ≥1 advocacy)
- [ ] Workable integration end-to-end (posting → sourcing → pipeline → hire → Phase 2 onboarding auto-trigger)
- [ ] ≥3 user-defined custom segments demonstrated
- [ ] Cross-channel cooldown demonstrated (no over-contact)
- [ ] Phases 1-4 have not regressed

**Emit `PHASE_5_EXIT.md`.**

---

Begin. Clone `mwpenn94/stewardly-command-center`. Read `MANUS_PROMPT_COMMAND_CENTER.md`. Extract the 6 marketing asset zips. Inventory everything. Assess current state (likely score 1 on most criteria). Build from zero. Ship observable work every pass. Continue.
