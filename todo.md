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

## Enhanced Build Prompt — Major Platform Upgrade

### Role System & Access Tiers
- [x] Extend user roles from (user/admin) to (user/advisor/manager/admin)
- [x] Role-based mode visibility: general users see no advisory modes; advisors see Client Advisor + Professional Coach; managers/admins see all modes
- [x] Hands-free mode defaults to audio playback for responses; user can toggle on/off
- [x] Role-based sidebar nav filtering (Manager Dashboard only visible to manager/admin)

### Database Schema Extensions
- [x] User profiles table (age, zipCode, jobTitle, incomeRange, savingsRange, familySituation, lifeStage, goals)
- [x] Professional context table (rawInput, parsedDomains, addedBy, visibleToClient)
- [x] Client-professional associations table
- [x] Enrichment datasets table (datasetId, name, applicableDomains, matchDimensions)
- [x] Enrichment cohorts table (cohortId, matchCriteria, enrichmentFields)
- [x] Enrichment matches table (userId, datasetId, cohortId, matchFields, confidenceScore)
- [ ] Affiliated products/resources table for management shelf — future enhancement
- [ ] Management context table — future enhancement

### Enhanced AI Behavior
- [x] Update system prompt to full Enhanced Build Prompt spec (focus-aware, data-layered, cross-domain)
- [ ] Context injection parser for professional use (parse free-text into structured fields) — future enhancement
- [ ] Predictive cold-start from enrichment data (ESTIMATED badges, progressive profiling) — future enhancement
- [ ] Cross-domain intelligence engine (life events → financial implications) — future enhancement
- [ ] Data transparency: show users what data sources shape their insights — future enhancement

### Professional Portal
- [ ] Client book list view — future enhancement
- [ ] Client profile view with context injection panel — future enhancement
- [ ] Case Design Summary generator — future enhancement
- [ ] Life Advisor Summary generator — future enhancement
- [ ] Focus-aware client report export — future enhancement

### Management Portal
- [ ] Team analytics dashboard — future enhancement
- [ ] Product and resource shelf manager — future enhancement
- [ ] Context layer manager — future enhancement
- [ ] AI-generated opportunity summaries — future enhancement

### Admin Portal
- [ ] Enrichment dataset manager with AI-assisted field mapping — future enhancement
- [ ] User-level data association with consent management — future enhancement
- [ ] Affiliated company profile manager — future enhancement
- [ ] Platform analytics overview — future enhancement

### Compliance & Trust
- [x] General AI disclaimer in chat footer
- [x] Financial AI disclaimer in system prompt and responses
- [ ] Enrichment data usage disclosure in plain language — future enhancement
- [ ] Consent flows for third-party data association — future enhancement
- [x] Full audit trail for all context additions

## Hands-Free Audio Fix
- [x] Suppress speech recognition during TTS playback to prevent AI voice from being recorded as user input
- [x] Recognition only starts AFTER TTS onend fires, with a 600ms guard delay
- [x] ttsGuardRef prevents recognition from starting during playback

## Update 4 — Document Access, Suitability, Products, AI Visuals
- [x] Add visibility column to documents table (private/professional/management/admin) with default=professional
- [x] Document insights/view access for financial professional, management, admin based on visibility
- [x] User toggle to control document visibility per document
- [x] Document management views for professionals, managers, admins
- [x] Improve suitability to allow flexible detail (free-text + optional structured fields)
- [x] Remove number counts from Products page
- [x] Enable AI chart/illustration/visual generation in chat responses (image generation endpoint)
- [x] AI can create diagrams and visualizations to explain concepts and strategies

## Products Badge Cleanup
- [x] Remove feature key-value badges from product cards for users

## Conversational Suitability
- [x] Replace form-based suitability with conversational AI flow
- [x] AI asks questions one at a time, adapting based on answers
- [x] Quick-reply preset buttons under each question for fast tapping
- [x] Freeform text always available as alternative to buttons
- [x] Progressive flow — user can stop at any point
- [x] Results saved to suitability profile in database

## Data Governance & Terms of Service
- [x] Conversation uploads inform insights across access tiers (user → professional → management → admin)
- [x] User controls visibility per upload (private/professional/management/admin)
- [x] Terms of Service page modeled after Claude/OpenAI best practices
- [x] Privacy Policy page with data usage transparency
- [x] First-time consent flow (must accept ToS before using app)
- [x] Consent stored in DB with timestamp
- [x] Right to delete / data export provisions in ToS
- [x] Data usage disclosure in plain language

## Suitability Access Chain
- [x] Suitability assessment data flows through access chain (user → professional → management → admin)
- [x] Professionals can view their clients' suitability profiles
- [x] Managers can view their team's clients' suitability profiles
- [x] Admins can view all suitability profiles
