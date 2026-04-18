# Seminar Funnel Spec — "Advanced Planning for Arizona Business Owners"

**Target:** T1 (Pima/Mohave/Santa Cruz) Commercial segment, A+B tier
**Format:** 75-minute in-person workshop + 15-minute Q&A, followed by individual discovery meetings
**Expected economics:** $800–1,500 venue+F&B, 20–35 attendees, 25–40% conversion to discovery, 30–45% of those to case opening. Blended CAC ~$150–300 per qualified conversation, $600–1,500 per case.

---

## 1 · Core Hypothesis

Commercial owners in southern AZ have three planning gaps that AZ-licensed premium-financed permanent life + buy-sell funded with life insurance addresses:
1. **No buy-sell structure** (or stale one >5 years old)
2. **No key-person coverage** on second-in-command
3. **Business succession = "sell to competitor someday"** instead of structured exit

Workshop leads with tax + succession pain, not with product.

---

## 2 · Audience Sourcing

Pull directly from the scoring pipeline:

```
Smart list filter:
  tag `seg:com` AND tag `prop:A` OR tag `prop:B`
  AND tag `geo:T1`
  AND entity_age_years >= 5
  AND (owner_age BETWEEN 45 AND 70 OR owner_age IS NULL)

Target invite list: 400–600 contacts
Expected RSVP rate: 4–8% → 20–40 registrants
Expected attendance: 60–75% of RSVPs → 15–30 attendees
```

**Invitation channels (in order of efficiency):**
1. Direct letter with hand-addressed envelope (highest open rate for this demographic) — via Lob, ~$2.50/piece, expect 2–4% RSVP
2. Follow-up email 5 days later to non-responders — ~1% additional RSVP
3. Personal phone call 10 days before to highest-decile non-RSVPs — 15–25% convert with direct call

---

## 3 · Landing Page

**URL:** `https://wealthbridge.[domain]/workshops/az-business-owners`
**Platform:** GHL native landing page (tied to form → workflow)

**Above the fold:**
- Headline: "Three Planning Gaps That Cost Arizona Business Owners 7-Figures at Exit"
- Subhead: "A 75-minute workshop for owners of established Arizona businesses ($2M+ revenue, 5+ years). Small-group format. Complimentary lunch."
- Primary CTA button: "Reserve your seat" (scrolls to form)

**Body sections:**
- "What you'll leave with" — 4 bullets (buy-sell checklist, key-person coverage ranges, AZ-specific tax considerations, owner-financing exit structures)
- Who should attend — single paragraph: owners, co-owners, CFOs of AZ businesses
- Format + logistics — date, time, location, parking, lunch
- Speaker credentials — Mike's bio, WealthBridge/NLG-ESI affiliation, credentials. **Include compliance disclosure block below.**

**Registration form fields** (write directly to GHL contact):
- First name, last name (required)
- Email (required)
- Phone (required)
- Business name (required)
- Years in business (dropdown: <5 / 5–10 / 11–20 / 20+)
- Annual revenue band (dropdown: <$1M / $1–5M / $5–25M / $25M+) — **used to filter walk-ins**
- Number of co-owners (dropdown: 1 / 2 / 3+)
- "What's your single biggest business concern for the next 5 years?" (open text) — best conversation opener at the event

---

## 4 · Pre-Event Sequence (GHL Workflow "Workshop_PreEvent")

```
Trigger: Form submission on workshop landing page
Day 0:  Confirmation email (calendar invite, directions, parking details)
Day 0:  SMS confirmation
Day +1: "What to expect" email (speaker bio, brief pre-read — 1 page PDF)
Day 0–7: Wait
Day -3: Reminder email with venue details
Day -1: Reminder SMS
Day 0 morning: Final SMS with parking + arrival instructions
```

---

## 5 · At-Event Mechanics

**Room setup:** rounds of 6 (not theater) — drives peer conversation, raises close rate.

**Opening 2 minutes:** thank, disclose (licensing, compliance — ESI-approved language), explain format.

**Content arc (60 min):**
- 10 min: The three gaps (case studies, no product)
- 15 min: Gap 1 — buy-sell structure (cost of doing nothing = specific numbers)
- 15 min: Gap 2 — key-person coverage (AZ-specific workers' comp + revenue interruption)
- 15 min: Gap 3 — structured exits (owner-financing, ESOP, family transitions)
- 5 min: How WealthBridge evaluates a situation (intro to discovery meeting)

**Q&A 15 min:** pre-plant 2 easy questions with staff for cold-starts.

**Close (5 min):** "Two things — first, use the worksheet on your table. Second, if you'd like a no-cost 45-minute look at your specific situation, tear off the card and drop it in the bowl, or grab a time on my calendar at the back table." Two commitment mechanisms = higher conversion than one.

---

## 6 · Post-Event Sequence (GHL Workflow "Workshop_PostEvent")

```
Trigger: Workshop date passed OR "attended" field marked true

+24h: Thank-you email with 1-page recap + calendar link for discovery meeting
+24h: SMS — "Here's the calendar link if you'd like to find a time: [link]"
+3 days: Personal call from Mike to all attendees who didn't book
+7 days: Second email — "Here's the full whitepaper on structured exits"
+14 days: Final email — "Different approach: here's our self-assessment calculator"
         (link to Stewardly calculator)
+30 days: Move unqualified to long-term nurture; qualified into discovery pipeline
```

---

## 7 · Measurement / Attribution

**Track per event, update after every workshop:**

| KPI | Target | Notes |
|---|---|---|
| Invites sent | 500 | Baseline |
| RSVPs | 25 (5%) | Below this, invitation is weak |
| Attendance rate | 70% of RSVPs | Below this, reminder sequence is weak |
| Discovery meetings booked at event | 40% of attendees | The #1 metric |
| Discovery meetings booked within 30 days (incl. follow-up) | 60% of attendees | Full funnel |
| Cases opened | 35% of discovery meetings | |
| Revenue per attendee | $1,500–4,000 blended | Tracks LTV |

Feed `outcome_status` progression back to Engagement Database for Phase 1 labeling — workshop attendees who become `qualified` or `closed_won` are especially high-quality training labels because the intent signal (attended a 75-min workshop) is stronger than cold prospects.

---

## 8 · Compliance Notes

**Non-negotiable (ESI/FINRA):**
- All marketing materials (landing page, invitation letter, email sequences, slides) require ESI compliance review before first use. Allow 5–10 business days.
- No product-specific illustrations during the public workshop. Generic education only. Product discussions are 1:1 in discovery meetings.
- Speaker disclosure block on all materials: broker-dealer, registered rep, licensing states.
- Record retention: keep event attendee list and all marketing materials for 5 years per FINRA 4511.

**AZ-specific:**
- No implied advisory relationship without a written agreement.
- Business-entity suitability follows individual-suitability rules when business owner is the decision-maker.

---

## 9 · First Event Checklist (T-30 days to T-0)

- **T-30:** Compliance review submission for all materials
- **T-28:** Book venue + catering (deposit)
- **T-21:** Compliance approval received → launch landing page
- **T-21:** First invitation letter drop
- **T-14:** Reminder email #1 to letter recipients
- **T-10:** Personal phone outreach to top 30 non-responders
- **T-7:** Email + SMS reminders to RSVPs
- **T-3:** Final confirmations, staff briefing, print handouts
- **T-1:** Venue walkthrough, A/V check, name-tag prep
- **T-0:** Event
- **T+1 to T+30:** Post-event sequence above
