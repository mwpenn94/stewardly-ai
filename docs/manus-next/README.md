# Manus-Next: Platform Evolution Roadmap

## What Is Manus-Next?

Manus-Next is the architectural evolution plan for Stewardly AI, transforming the current monolithic application into a modular platform of reusable packages. This directory contains the planning documents, package specifications, and migration guides needed to execute the transition.

## Directory Structure

```
docs/manus-next/
├── README.md                    ← This file
├── BUILD_MANIFEST.json          ← Current build state snapshot
├── build-log.md                 ← Historical build timeline
├── refactor-log.md              ← Extraction candidates + priority
├── monorepo-plan.md             ← pnpm workspaces + turborepo config
├── extraction-roadmap.md        ← @platform/* package extraction plan
├── package-shells.md            ← @manus-next/* package specifications
├── sovereign-study-notes.md     ← SOVEREIGN_PORT_MODE=study design
├── ci-config.md                 ← Path-based CI configuration
├── regression-baseline.md       ← Test baseline for migration safety
├── adr/                         ← Architecture Decision Records
├── prior-art/                   ← Reference implementations
└── scripts/                     ← Migration helper scripts
```

## Phase Timeline

| Phase | Name | Status | Description |
|-------|------|--------|-------------|
| -1 | Provenance | Complete | BUILD_MANIFEST, build-log, refactor-log |
| 0 | Foundation | Complete | Monorepo plan, extraction roadmap, package shells, CI config |
| 0.5 | Validation UI | Complete | ManusNextDashboard at /manus-next for capability validation |
| 1 | Extraction | Planned | Extract @platform/* packages from monolith |
| 2 | Integration | Planned | Wire extracted packages back into Stewardly |
| 3 | Sovereign | Planned | SOVEREIGN_PORT_MODE=study for offline learning |

## Key Principles

1. **No regressions**: Every extraction must maintain the 9,671-test baseline
2. **Incremental migration**: Extract one package at a time, verify, proceed
3. **Type safety preserved**: tRPC contracts and Drizzle types flow through packages
4. **Build time budget**: Total build must stay under 60 seconds
5. **Test suite budget**: Full test suite must stay under 120 seconds

## Getting Started

Read `BUILD_MANIFEST.json` for the current state snapshot, then `refactor-log.md` for extraction candidates, then `monorepo-plan.md` for the migration strategy.

## Validation Dashboard

The ManusNextDashboard is accessible at `/manus-next` (admin role required). It provides:
- Live capability inventory with extraction status (live/planned/extracting)
- One-click endpoint validation for each capability
- Package mapping showing which @manus-next/* package each capability belongs to
- Progress metrics for the overall extraction effort
