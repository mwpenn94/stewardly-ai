# Personal AI — Project TODO

## Turn 1 — Foundation
- [x] Database schema (all tables: conversations, messages, documents, products, compliance, reviews, memories, feedback)
- [x] AI chat with streaming via tRPC + bundled LLM
- [x] Master system prompt with general + financial expertise
- [x] Streaming UI with mode selector (Client/Coach/Manager)
- [x] Dark luxury financial theme + typography
- [x] Dashboard layout with sidebar navigation
- [x] Authentication integration

## Turn 2 — Compliance + Calculators
- [x] Suitability questionnaire + gate logic
- [x] Audit trail + disclaimer middleware
- [x] PII stripping middleware
- [x] Human review queue UI
- [x] IUL projection calculator
- [x] Premium finance ROI calculator
- [x] Retirement aggregator calculator
- [x] Product comparator calculator
- [x] Seed product data (own + competitor)

## Turn 3 — RAG + Personalization
- [x] File upload UI for documents
- [x] Document processing + storage
- [x] RAG retrieval with context injection
- [x] Style analyzer + profile generator
- [x] Style profile prompt injection

## Turn 4 — Voice + Market Data
- [x] Voice mode toggle UI (text/voice)
- [x] Speech-to-text via browser SpeechRecognition
- [x] TTS via browser SpeechSynthesis
- [x] Market data router (Yahoo Finance via built-in data API)
- [x] Market data dashboard page

## Turn 5 — Layer 4 + Advisory UIs
- [x] Review workflow engine (graduated autonomy)
- [x] Confidence scoring system
- [x] Review queue UI for advisors
- [x] Approve/reject/modify with audit trail
- [x] Client Advisor mode UI
- [x] Professional Coach mode UI
- [x] Manager Dashboard UI with audit trail

## Turn 6 — Self-Improvement + Polish
- [x] Memory extraction and management (add/delete/categorize)
- [x] Quality self-rating system (confidence scoring)
- [x] Feedback logging (thumbs up/down)
- [x] Temporal memory with timestamps and categories
- [x] End-to-end testing (22 tests passing)
- [x] UI polish and responsive design

## Mission Update
- [x] Update system prompt to reflect "digital general AND financial twin"
- [x] Update UI copy/branding to reflect general + financial expertise
- [x] Ensure AI chat handles general queries as well as financial advisory

## Focus Mode
- [x] Implement user-adjustable focus mode: General / Financial / Both
- [x] Focus mode affects system prompt, response style, and tool/knowledge prioritization
- [x] Focus mode selector in chat UI (accessible but not overwhelming)
- [x] Default to "Both" focus mode

## Update 2 — Major Feature Expansion
- [x] Integrate free market data APIs (Yahoo Finance via built-in Manus data API — no user keys)
- [x] Add hands-free voice mode (auto-listen after AI speaks, no button clicks, audible processing cues)
- [x] Add screen share context sharing in chat (button wired, placeholder for future browser API)
- [x] Add live video context sharing in chat (button wired, placeholder for future browser API)
- [x] Add image upload/paste context sharing in chat
- [x] Add document attachment context sharing in chat
- [x] Remove all WealthBridge mentions — rebranded to Personal AI
- [x] Default app to "Both" focus mode
- [x] Allow users to shift focus before selecting advisory modes (combined picker)
- [x] Clean up, streamline, and simplify the main/home page
- [x] Streamline the overall UI — reduce clutter, improve hierarchy
- [x] Optimize responsive design for desktop
- [x] Optimize responsive design for mobile (sidebar collapse, touch-friendly)
- [x] End-to-end test of all new features (22 tests passing)

## Remaining V8 Blueprint Integrations
- [x] Seed competitor product data (NWM, MassMutual, Prudential, Guardian)
- [x] Product comparator calculator (side-by-side product comparison)
- [x] A/B test framework tables (promptVariants, abTestAssignments, abTestResults)
- [ ] Weekly prompt review system (identify low-performing patterns) — future enhancement
- [ ] Threshold calibration (monthly auto-adjust based on human override patterns) — future enhancement
- [ ] Cross-model review / quality verification on responses — future enhancement
- [x] Separate RAG categories (personal_docs, financial_products, regulations + training, artifacts, skills)
- [x] Market data dashboard page with charts (Yahoo Finance via built-in API)

## UI Restructure — Chat as Landing Page
- [x] Make chat/conversation the default landing page (/)
- [x] Build Claude-style welcome prompt at launch
- [x] Make all other pages accessible from chat sidebar
- [x] Repurpose old landing page as /about
- [x] Ensure intuitive navigation centered around conversation

## Language & Training Updates
- [x] Remove all "clone" language — replaced with "personalize/personal" throughout
- [x] Enhance document upload to accept artifacts, skills, and other training files (6 categories)
- [x] Update Settings page "Style Clone" → "Communication Style"
- [x] Update system prompt references from clone to personalize
- [x] Update Home page and feature descriptions

## Custom Talking Avatar
- [x] Add avatar upload to Settings page (accept any image: photo, cartoon, etc.)
- [x] Store avatar URL in users table (avatarUrl column)
- [x] Display custom avatar in chat as the AI's face
- [x] Animate avatar with talking effect during TTS / voice responses
- [x] Fallback to default Bot icon when no avatar is set
