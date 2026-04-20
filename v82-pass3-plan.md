# v8.3 Pass 3 — Signal Assessment & Pillar Focus

## Signal Assessment
- **Fundamental Redesign**: Absent — core architecture sound
- **Landscape**: Present — 29 open/in_progress PARITY rows; multiple pillars with gaps
- **Depth**: Present — several in_progress items need deepening
- **Adversarial**: Absent — not triggered this pass
- **Future-State**: Absent — premature

→ Executing **Landscape pass** (highest priority with signals present)

## Pillar Score Computation

Using v8.3 formula: `pillar_score = open_rows × pillar_multiplier × starvation_factor`

Prior passes touched: Pass 1 = PLATFORM, Pass 2 = PLATFORM
→ passes_since_last_touch: PLANS=2, LEARNING=2, PEOPLE=2, PLATFORM=0

| Pillar   | Open rows | Multiplier | Starvation factor (1 + passes×0.5, cap 4.0) | Score |
|----------|-----------|------------|----------------------------------------------|-------|
| PLANS    | ~5        | 1.5        | 1 + 2×0.5 = 2.0                             | 15.0  |
| LEARNING | ~3        | 1.5        | 1 + 2×0.5 = 2.0                             | 9.0   |
| PEOPLE   | ~4        | 1.5        | 1 + 2×0.5 = 2.0                             | 12.0  |
| PLATFORM | ~17       | 1.0        | 1 + 0×0.5 = 1.0                             | 17.0  |

**Winner: PLATFORM (17.0)** — but 3-pass invariant check: PLANS/LEARNING/PEOPLE all at 0 weight across last 2 passes. Must include ≥1 item from each Tier 1 pillar.

**Adjusted focus: MULTI (PLANS + PEOPLE + PLATFORM)** — hitting all three Tier 1 pillars + PLATFORM to satisfy balance.

## Angle / Lens
- **Angle**: Novel feature + DX (rotating from Pass 1 correctness, Pass 2 robustness)
- **Lens**: B-Surface (UI/UX polish) → rotating to A-Surface (core feature)

## Work Queue (priority-ordered)

### R1: G18 — Universal focus trap for modals [PLATFORM, P1, M]
Hook exists but only 3 of ~15 dialogs use it. Wire useFocusTrap into KeyboardShortcuts overlay + codeChat popovers + learning overlays.

### R2: G20 — Icon-only button aria-label audit [PLATFORM, P2, S]
Audit and add missing aria-labels on icon-only buttons in Calculators toolbar + codeChat + learning.

### R3: PARITY-DATA-0007 — RelationshipsHub stats hardcoded "0" [PEOPLE, P1, M]
Wire real backend queries for meeting counts and campaign counts.

### R4: PARITY-NAV-0006 — PersonaSidebar5 coverage gap [PLATFORM, P1, M]
Add missing wealth-engine sub-routes to sidebar nav.

### R5: G27 — Shortcut hints in tooltips [PLATFORM, P2, M]
Add keyboard shortcut hints to toolbar button tooltips.

### R6: PARITY-MOBILE-0008 — CodeChat sidebars desktop-only [PEOPLE+PLATFORM, P2, M]
Add mobile bottom-sheet alternative for CodeChat outline + files panels.

### R7: G45 — Font-scale 200% zoom verification [PLATFORM, P2, S]
Add CSS fixes for 200% zoom breakage.
