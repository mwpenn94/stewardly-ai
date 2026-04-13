# Stewardly AI

5-layer financial advisory AI platform with comprehensive intelligence, learning, and wealth management capabilities.

## Quick Start

```bash
npm install
npm run dev        # Start development server
npm run build      # Production build
npm test           # Run test suite
```

## Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS, Radix UI
- **Backend:** tRPC, Drizzle ORM, TiDB
- **AI:** Multi-model (Claude, GPT, Gemini, Llama, Mistral) via contextualLLM
- **Design:** Stewardship Gold (deep navy + warm gold, DM Serif Display + Plus Jakarta Sans)

## Architecture

```
client/src/
  pages/          # 128 pages (route components)
  components/     # 142 components (shared UI)
  lib/            # Utilities, navigation, hooks
  hooks/          # Custom React hooks

server/
  _core/          # Server bootstrap, tRPC context
  routers/        # 78 tRPC routers
  services/       # 260 services (business logic)
  shared/         # Shared utilities, calculators

drizzle/
  schema.ts       # 356 database tables
  migrations/     # SQL migrations (0001-0013)
```

## Key Features

### Intelligence
- Multi-model AI with 23 models and task routing
- Chat modes: Single, Loop (autonomous), Consensus (multi-model)
- RAG-enabled contextualLLM with PII + injection guardrails
- Voice I/O with Edge TTS (25+ neural voices)

### Code Chat
- Claude Code-style interface with ReAct loop
- SSE streaming with live tool visualization
- 44 inspector tabs (diagnostics, git, tests, imports, etc.)
- Plan mode, session management, workspace checkpoints

### Wealth Engine
- 8 calculator engines (retirement, strategy comparison, etc.)
- PDF report generation with audio narration
- Multi-model consensus for high-stakes recommendations

### Learning (EMBA)
- SRS-based mastery tracking
- Exam simulator, flashcard study, quiz runner
- Content from 8 core financial disciplines

### CRM & Marketing
- GoHighLevel, Wealthbox, Redtail integrations
- Lead pipeline with propensity scoring
- Email campaigns with AI content generation
- Dynamic integrations for any data source

### Accessibility
- WCAG 2.1 Level A compliant
- Keyboard navigation with chord shortcuts (g+key)
- Screen reader support with aria-live regions
- Cross-browser STT with capability detection
- Mobile-first responsive design with bottom tab bar

## Environment Variables

See `docs/ENV_SETUP.md` for the full list. Key variables:

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | TiDB connection string |
| `ANTHROPIC_API_KEY` | Yes | Claude API access |
| `OPENAI_API_KEY` | No | GPT model access |
| `GOOGLE_AI_API_KEY` | No | Gemini model access |
| `GITHUB_TOKEN` | No | Code Chat GitHub integration |

## Testing

```bash
npm test                    # All tests
npm test -- --run path/to   # Specific file
```

- 7,337+ tests passing across 294 files in local dev
- 18 pre-existing env-dependent test files require DB connection

## Documentation

| Doc | Purpose |
|-----|---------|
| `CLAUDE.md` | AI assistant project instructions |
| `CHANGELOG.md` | Release history |
| `docs/PARITY.md` | Build loop work queue + pass log |
| `docs/ENV_SETUP.md` | Environment variable setup |
| `docs/WEALTH_ENGINE.md` | Calculator engine docs |
| `docs/EMBA_INTEGRATION.md` | Learning system docs |
| `docs/AUTOMATION.md` | Browser automation docs |

## License

Proprietary. See LICENSE for details.
