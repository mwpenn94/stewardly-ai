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

## UI Fixes
- [x] Fix sidebar layout: make conversation list scrollable, keep nav options always visible and accessible

## WealthBridge AI v2 — Multi-Tenant Enterprise Platform

### Phase 1: Database Schema
- [ ] Create firms table (id, name, slug, branding config)
- [ ] Extend users table: firm_id, role (global_admin/firm_admin/manager/professional/user), manager_id, professional_id
- [ ] Create firm_ai_settings table (Layer 2 prompts)
- [ ] Create manager_ai_settings table (Layer 3 prompts)
- [ ] Create professional_ai_settings table (Layer 4 prompts)
- [ ] Create user_preferences table (Layer 5 context, TTS voice, communication style)
- [ ] Create view_as_audit_log table (actor, target, actions, timestamps)
- [ ] Create firm_landing_page_config table (headline, colors, logo, etc.)
- [ ] Create workflow_checklist table (onboarding steps, platform integrations)

### Phase 2: Landing Pages & Auth
- [ ] Build global landing page (/): hero, cards, trust signals, CTA
- [ ] Build firm landing page (/firm/[slug]): brandable, customizable
- [ ] Implement progressive auth: anonymous → email → OAuth → advisor-linked
- [ ] Build sign-in page with Google OAuth + email/password
- [ ] Build firm admin branding editor (Settings → Branding)
- [ ] Implement browse-wrap consent for anonymous users

### Phase 3: Chat Interface & Voice
- [ ] Rebuild Chat.tsx: desktop sidebar, tablet drawer, mobile bottom nav
- [ ] Implement auto-scroll with IntersectionObserver anchor pattern
- [ ] Add voice input (Web Speech API, 1.5s silence auto-send)
- [ ] Add voice output: Edge TTS proxy + fallback SpeechSynthesis
- [ ] Implement waveform/orb animation for voice mode
- [ ] Add inline chart generation (lightweight-charts, recharts, mermaid)
- [ ] Add ChartRenderer component to detect and render `<!-- chart: {...} -->` tags
- [ ] Implement progressive disclosure (>300 words → summary + collapsible details)
- [ ] Add [🎨 Generate Infographic] button for image generation

### Phase 4: Settings & AI Personalization
- [ ] Build Settings panel with 5 tabs (Profile, AI Preferences, Financial Setup, Notifications, Appearance)
- [ ] Implement AI Preferences tab: communication style slider, response length, TTS voice, hands-free toggle
- [ ] Implement Financial Setup tab: risk tolerance, goals, life stage, tax status
- [ ] Build 5-layer cascading system prompt builder
- [ ] Implement Layer 1 (Platform Base) editor for Global Admin
- [ ] Implement Layer 2 (Firm Overlay) editor for Firm Admin
- [ ] Implement Layer 3 (Manager Overlay) editor for Manager
- [ ] Implement Layer 4 (Professional Overlay) editor for Professional
- [ ] Implement Layer 5 (User Context) auto-population + editing
- [ ] Add inheritance validation (lower layers can't contradict higher)
- [ ] Cache all user settings for subsequent use

### Phase 5: Professional Portal & View-As
- [ ] Build /portal route (visible to Professional+ roles)
- [ ] Build Professional view: summary cards, client book table, filters, card/table toggle
- [ ] Build Manager view: "My Team" section, advisor cards, team summary
- [ ] Build Firm Admin view: firm dashboard, manager list, branding editor
- [ ] Build Global Admin view (/admin): all-firms dashboard, firm management, Layer 1 editor, feature flags
- [ ] Implement view-as system: sessionStorage context, view-as banner, read-only mode
- [ ] Implement view-as audit logging (actor, target, actions, timestamps)
- [ ] Add 30-minute auto-expiry for view-as sessions
- [ ] Build client book: name, AUM, risk profile, life stage, last contact, suitability status, next review

### Phase 6: Workflow Orchestration
- [ ] Build workflow orchestration engine (PREPARE → BRIEF → NAVIGATE → ASSIST → HANDOFF → CONFIRM → RETURN)
- [ ] Create master onboarding checklist (database-backed, not memory-based)
- [ ] Implement Manus Browser Operator integration scaffolding
- [ ] Build workflow UI: step tracker, current step display, next step guidance
- [ ] Add cross-platform handoff support (FINRA, Prometric, state DOI, E&O, broker-dealer)
- [ ] Implement confirmation number capture and step completion tracking

### Phase 7: Polish & Testing
- [ ] Run all tests (22+ existing + new multi-tenant tests)
- [ ] Verify multi-tenant data isolation
- [ ] Test role-based access control across all views
- [ ] Test view-as system and audit logging
- [ ] Test cascading AI layer assembly
- [ ] Test progressive auth flow
- [ ] Test voice mode (input + output)
- [ ] Test inline chart generation
- [ ] Checkpoint and deliver


## Phase 1 Completion: Multi-Tenant Schema ✓
- [x] Created organizations table (id, name, slug, description, website, ein, industry, size)
- [x] Created organization_landing_page_config (headline, colors, logo, branding)
- [x] Created organization_relationships (partner, subsidiary, affiliate, referral, vendor, client)
- [x] Created user_organization_roles (many-to-many with globalRole, organizationRole)
- [x] Created user_relationships (manager, team_member, mentor, mentee, peer, client, advisor, colleague)
- [x] Created organization_ai_settings (Layer 2 prompts)
- [x] Created manager_ai_settings (Layer 3 prompts)
- [x] Created professional_ai_settings (Layer 4 prompts)
- [x] Created user_preferences (Layer 5 context)
- [x] Created view_as_audit_log (role switching audit)
- [x] Created workflow_checklist (onboarding)
- [x] Applied all migrations via SQL

## Phase 2: Landing Pages & Progressive Authentication

### Global Landing Page
- [ ] Create /landing.tsx component with hero section
- [ ] Hero: "Your finances. Your way. Understood." headline with subtitle
- [ ] Primary CTA: "Get Started" → sign-in
- [ ] Secondary CTA: "Explore as a guest" → anonymous chat
- [ ] Trust signals row: lock, shield, chart icons
- [ ] 3 feature cards: "It learns you", "It knows finance", "It grows with you"
- [ ] Footer with disclaimer, Privacy, Terms, About links
- [ ] Gradient mesh background (navy/teal), fade-in animations

### Firm Landing Page
- [ ] Create /firm/[slug].tsx component
- [ ] Query organization_landing_page_config for branding
- [ ] Display customizable headline, subtitle, CTA, logo, colors
- [ ] Tag anonymous/new users with firm_id from URL
- [ ] Auto-affiliate new sign-ups to firm

### Progressive Authentication
- [ ] Tier 0 (Anonymous): Browse-wrap consent banner, localStorage conversations
- [ ] Tier 1 (Email): Email capture modal, creates unaffiliated user
- [ ] Tier 2 (Full account): Google OAuth + email/password
- [ ] Tier 3 (Advisor-connected): Link to professional in firm
- [ ] Sign-in page: centered card, logo, OAuth + email/password, "Continue as guest"
- [ ] Post-sign-in: welcome animation → /chat

### Auth Flow Updates
- [ ] Update auth context to handle firm_id tagging
- [ ] Update sign-up to auto-affiliate if firm_id present
- [ ] Update sign-in to redirect to /chat
- [ ] Add "Continue as guest" flow to localStorage
- [ ] Implement browse-wrap consent for anonymous users
- [ ] Fixed all 13 TypeScript errors from schema changes (user.role → user.globalRole)

## Phase 2 Continued: Multi-Modal Secretary/Study Buddy

### Screen Capture & Sharing
- [ ] Implement Screen Capture API for real-time screen sharing
- [ ] Add screen capture button to context sharing UI
- [ ] Stream screen frames to AI for analysis
- [ ] Support pause/resume screen capture
- [ ] Show captured region preview before sending

### Live Video Analysis
- [ ] Implement WebRTC or getUserMedia for live video capture
- [ ] Add video button to context sharing UI
- [ ] Process video frames for visual understanding
- [ ] Support pause/resume video capture
- [ ] Show video preview before sending

### Multi-Modal RAG Enhancement
- [ ] Extend document indexing to support all formats (PDF, images, video, audio)
- [ ] Add visual OCR for image/screenshot text extraction
- [ ] Index video transcripts via speech-to-text
- [ ] Create unified search across all data modalities
- [ ] Support cross-format queries (e.g., "find this chart in my documents")

### Conversational Data Review
- [ ] Add "Study Mode" toggle in chat UI (vs. Financial/General modes)
- [ ] Create study buddy system prompt variant
- [ ] Support asking questions about any shared/uploaded data
- [ ] Implement data highlighting and annotation
- [ ] Add "Explain this" quick action for visual elements

### Data Extraction & Parsing
- [ ] Extract tables from PDFs and images
- [ ] Parse forms and structured data
- [ ] Support CSV/Excel import and analysis
- [ ] Extract key information from documents
- [ ] Create data summaries and outlines

### Visual Annotation & Markup
- [ ] Add canvas overlay for marking up images/screenshots
- [ ] Support highlighting, circling, and pointing
- [ ] Store annotations with context
- [ ] Share annotated views in conversation

### Study Buddy Features
- [ ] Summarization: Create concise summaries of any document
- [ ] Outlining: Generate outlines and key points
- [ ] Q&A: Generate practice questions from materials
- [ ] Comparison: Compare multiple documents/datasets
- [ ] Timeline: Extract and visualize timelines from text
- [ ] Glossary: Build glossaries from documents
- [ ] Citation tracking: Track sources and references
