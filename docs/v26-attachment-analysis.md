# v2.6 Attachment Analysis — Key Findings

## Summary

The user provided three reference documents:

1. **WealthBridge-Business-Calculator-v7.6.html** — The foundational HTML business calculator that Stewardly's Wealth Engine must match/inherit structurally.
2. **HTML_STRUCTURAL_INVENTORY_STARTER.md** — A starter inventory of ~40 structural categories with sub-elements from the HTML. Expected to expand to 500+ rows.
3. **MANUS_PROMPT_STEWARDLY_v2.6-foundational.md** — The v2.6 build loop methodology with foundational-inheritance-first gate for scope #4.

## Key Items to Address This Turn

### Priority Bug Fixes (from screenshot)
- Chat "Message limit reached" error for logged-in users
- Duplicate message sending
- Auth loop on Passive Actions page

### From v2.6 Methodology — Practical Items for This Turn
The full v2.6 methodology describes a multi-hundred-pass continuous build loop. For this turn, the practical items are:

1. **Place reference files** in the project at `docs/reference/`
2. **Fix the identified bugs** (chat limits, auth loops)
3. **Implement CI/CD, authenticated E2E, visual regression** (from previous next steps)
4. **Audit structural parity** — check which of the 40 structural categories from the HTML are already implemented in Stewardly's Wealth Engine
5. **Run convergence passes** until 20 consecutive clean

### Structural Categories Already Likely Implemented
Based on existing Wealth Engine pages: calculators, income streams, financial twin, products, passive actions, insights, suitability, client onboarding, operations hub.

### Structural Categories Potentially Missing or Partial
Based on the HTML inventory: GDC Brackets, Sales Funnel, Recruiting, Marketing Channels, Dashboard (monthly tracking), P&L, Client Back-Planner, Advanced Strategies (Premium Financing, ILIT, Exec Comp, Charitable), Strategy Compare (scuiContainer), Save/Load/Export/Import slots, Walk-me-through narration (CalcNarrator), ref-tip tooltip system (27 inline tooltips).
