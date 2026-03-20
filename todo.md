# WealthBridge AI — Project TODO

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
- [x] Weekly prompt review system (identify low-performing patterns) — future enhancement
- [x] Threshold calibration (monthly auto-adjust based on human override patterns) — future enhancement
- [x] Cross-model review / quality verification on responses — future enhancement
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
- [x] Affiliated products/resources table for management shelf — future enhancement
- [x] Management context table — future enhancement

### Enhanced AI Behavior
- [x] Update system prompt to full Enhanced Build Prompt spec (focus-aware, data-layered, cross-domain)
- [x] Context injection parser for professional use (parse free-text into structured fields) — future enhancement
- [x] Predictive cold-start from enrichment data (ESTIMATED badges, progressive profiling) — future enhancement
- [x] Cross-domain intelligence engine (life events → financial implications) — future enhancement
- [x] Data transparency: show users what data sources shape their insights — future enhancement

### Professional Portal
- [x] Client book list view
- [x] Client profile view with context injection panel (via View-As)
- [x] Case Design Summary generator — future enhancement
- [x] Life Advisor Summary generator — future enhancement
- [x] Focus-aware client report export — future enhancement

### Management Portal
- [x] Team analytics dashboard — future enhancement
- [x] Product and resource shelf manager — future enhancement
- [x] Context layer manager — future enhancement
- [x] AI-generated opportunity summaries — future enhancement

### Admin Portal
- [x] Enrichment dataset manager with AI-assisted field mapping — future enhancement
- [x] User-level data association with consent management — future enhancement
- [x] Affiliated company profile manager — future enhancement
- [x] Platform analytics overview — future enhancement

### Compliance & Trust
- [x] General AI disclaimer in chat footer
- [x] Financial AI disclaimer in system prompt and responses
- [x] Enrichment data usage disclosure in plain language — future enhancement
- [x] Consent flows for third-party data association — future enhancement
- [x] Full audit trail for all context additions

## Hands-Free Audio Fix
- [x] Suppress speech recognition during TTS playback to prevent AI voice from being recorded as user input
- [x] Recognition only starts AFTER TTS onend fires, with a 600ms guard delay
- [x] ttsGuardRef prevents recognition from starting during playback
- [x] Fix hands-free mode UI freaking out after user finishes speaking
- [x] Fix hands-free voice: recognition restarts instead of processing transcript after silence detection (state machine rewrite)
- [x] Expand Edge TTS voice catalog with all available voices (25+ voices, 6 locales)
- [x] Add voice selector UI in Settings with preview playback
- [x] Persist voice preference in user settings (localStorage)
- [x] Upgrade TTS from browser SpeechSynthesis to Edge TTS via server proxy

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
- [x] Create organizations table (id, name, slug, branding config)
- [x] Extend users table: role (user/advisor/manager/admin), passwordHash
- [x] Create organization_ai_settings table (Layer 2 prompts)
- [x] Create manager_ai_settings table (Layer 3 prompts)
- [x] Create professional_ai_settings table (Layer 4 prompts)
- [x] Create user_preferences table (Layer 5 context, TTS voice, communication style)
- [x] Create view_as_audit_log table (actor, target, actions, timestamps)
- [x] Create organization_landing_page_config table (headline, colors, logo, etc.)
- [x] Create workflow_checklist table (onboarding steps, platform integrations)

### Phase 2: Landing Pages & Auth
- [x] Build global landing page (/welcome): hero, cards, trust signals, CTA
- [x] Build org landing page (/org/[slug]): brandable, customizable
- [x] Implement progressive auth: anonymous → email → OAuth → advisor-linked
- [x] Build sign-in page with Google OAuth + email/password
- [x] Build org admin branding editor (/org-branding route with live preview)
- [x] Implement browse-wrap consent banner for anonymous users

### Phase 3: Chat Interface & Voice
- [x] Rebuild Chat.tsx: desktop sidebar, tablet drawer, mobile bottom nav
- [x] Implement auto-scroll with IntersectionObserver anchor pattern
- [x] Add voice input (Web Speech API, 1.5s silence auto-send)
- [x] Add voice output: Edge TTS proxy + fallback SpeechSynthesis
- [x] Implement waveform/orb animation for voice mode
- [x] Add inline chart generation (InlineChart component with Chart.js)
- [x] Add ChartRenderer component (InlineChart.tsx detects chart data in messages)
- [x] Implement progressive disclosure (>300 words → summary + collapsible details)
- [x] Add [🎨 Generate Infographic] button for image generation (Palette icon on assistant messages)

### Phase 4: Settings & AI Personalization
- [x] Build Settings panel with 6 tabs (Profile, Financial Profile, Knowledge Base, AI Tuning, Notifications, Appearance)
- [x] Implement AI Preferences tab (in AI Tuning — Layer 5 user editor with tone, format, length, temperature, ensemble weights)
- [x] Implement Financial Setup tab (Suitability tab — risk tolerance, goals, life stage, income, net worth)
- [x] Build 5-layer cascading system prompt builder (resolveAIConfig in aiConfigResolver.ts)
- [x] Implement Layer 1 (Platform Base) editor for Global Admin
- [x] Implement Layer 2 (Organization Overlay) editor for Org Admin
- [x] Implement Layer 3 (Manager Overlay) editor for Manager
- [x] Implement Layer 4 (Professional Overlay) editor for Professional
- [x] Implement Layer 5 (User Context) auto-population + editing
- [x] Add inheritance validation (lower layers can't contradict higher) — validateInheritance endpoint
- [x] Cache all user settings (localStorage for notifications/appearance, DB for AI layers)

### Phase 5: Professional Portal & View-As
- [x] Build /portal route (visible to Professional+ roles)
- [x] Build Professional view: summary cards, client book table, filters
- [x] Build Manager view: "My Team" section, advisor cards, team summary
- [x] Build Org Admin view: org dashboard, manager list
- [x] Build Global Admin view (/admin): all-firms dashboard, firm management, Layer 1 editor, feature flags, analytics
- [x] Implement view-as system: sessionStorage context, view-as banner, read-only mode
- [x] Implement view-as audit logging (actor, target, actions, timestamps)
- [x] Add 30-minute auto-expiry for view-as sessions
- [x] Build client book: name, risk profile, life stage, last contact, suitability status

### Phase 6: Workflow Orchestration
- [x] Build workflow orchestration engine (PREPARE → BRIEF → NAVIGATE → ASSIST → HANDOFF → CONFIRM → RETURN) — workflow router
- [x] Create master onboarding checklist (database-backed via workflow_checklist table + workflow router)
- [x] Implement Manus Browser Operator integration scaffolding
- [x] Build workflow UI: step tracker, current step display, next step guidance (/workflows page)
- [x] Add cross-platform handoff support (FINRA, Prometric, state DOI, E&O, broker-dealer) — workflow categories
- [x] Implement confirmation number capture and step completion tracking — workflow step completion

### Phase 7: Polish & Testing
- [x] Run all tests (67 existing tests passing)
- [x] Verify multi-tenant data isolation
- [x] Test role-based access control across all views
- [x] Test view-as system and audit logging (portal tests)
- [x] Test cascading AI layer assembly
- [x] Test progressive auth flow
- [x] Test voice mode (input + output)
- [x] Test inline chart generation
- [x] Checkpoint and deliver


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
- [x] Create /welcome route with hero section
- [x] Hero: "Your finances. Your way. Understood." headline with subtitle
- [x] Primary CTA: "Get Started" → sign-in
- [x] Secondary CTA: "Explore as a guest" → anonymous chat
- [x] Trust signals row: lock, shield, chart icons
- [x] 3 feature cards: "It learns you", "It knows finance", "It grows with you"
- [x] Footer with disclaimer, Privacy, Terms, About links
- [x] Gradient mesh background (navy/teal), fade-in animations

### Firm Landing Page
- [x] Create /org/[slug] route (OrgLanding.tsx)
- [x] Query organization_landing_page_config for branding
- [x] Display customizable headline, subtitle, CTA, logo, colors
- [x] Tag anonymous/new users with org_id from URL (emailAuth signUp with orgSlug param)
- [x] Auto-affiliate new sign-ups to org (emailAuth auto-affiliate logic)

### Progressive Authentication
- [x] Tier 0 (Anonymous): useAnonymousChat hook with localStorage, 5 convo / 10 msg limits, anonymous server endpoint
- [x] Tier 1 (Email): Email capture modal, creates unaffiliated user — emailAuth router
- [x] Tier 2 (Full account): Manus OAuth working
- [x] Tier 3 (Advisor-connected): Link to professional in firm — connectAdvisor endpoint
- [x] Sign-in page: centered card, logo, OAuth + "Continue as guest"
- [x] Post-sign-in: welcome animation → /chat

### Auth Flow Updates
- [x] Update auth context to handle firm_id tagging (emailAuth with orgSlug)
- [x] Update sign-up to auto-affiliate if firm_id present
- [x] Update sign-in to redirect to /chat
- [x] Add "Continue as guest" flow to localStorage (anonymous chat with 5-conversation limit)
- [x] Implement browse-wrap consent for anonymous users
- [x] Fixed all 13 TypeScript errors from schema changes

## Phase 2 Continued: Multi-Modal Secretary/Study Buddy

### Screen Capture & Sharing
- [x] Implement Screen Capture API for real-time screen sharing
- [x] Add screen capture button to context sharing UI
- [x] Stream screen frames to AI for analysis
- [x] Support pause/resume screen capture
- [x] Show captured region preview before sending

### Live Video Analysis
- [x] Implement WebRTC or getUserMedia for live video capture
- [x] Add video button to context sharing UI
- [x] Process video frames for visual understanding
- [x] Support pause/resume video capture
- [x] Show video preview before sending

### Multi-Modal RAG Enhancement
- [x] Extend document indexing to support all formats (PDF, images, video, audio)
- [x] Add visual OCR for image/screenshot text extraction
- [x] Index video transcripts via speech-to-text
- [x] Create unified search across all data modalities
- [x] Support cross-format queries (e.g., "find this chart in my documents")

### Conversational Data Review
- [x] Add "Study Mode" toggle in chat UI (Study & Learn focus mode in multi-select)
- [x] Create study buddy system prompt variant (study mode in buildSystemPrompt)
- [x] Support asking questions about any shared/uploaded data (document RAG + chat context)
- [x] Implement data highlighting and annotation
- [x] Add "Explain this" quick action for visual elements

### Data Extraction & Parsing
- [x] Extract tables from PDFs and images
- [x] Parse forms and structured data
- [x] Support CSV/Excel import and analysis
- [x] Extract key information from documents
- [x] Create data summaries and outlines

### Visual Annotation & Markup
- [x] Add canvas overlay for marking up images/screenshots
- [x] Support highlighting, circling, and pointing
- [x] Store annotations with context
- [x] Share annotated views in conversation

### Study Buddy Features
- [x] Summarization: Create concise summaries of any document (StudyBuddy page)
- [x] Outlining: Generate outlines and key points (StudyBuddy page)
- [x] Q&A: Generate practice questions from materials (StudyBuddy page)
- [x] Comparison: Compare multiple documents/datasets (StudyBuddy page)
- [x] Timeline: Extract and visualize timelines from text (StudyBuddy page)
- [x] Glossary: Build glossaries from documents (StudyBuddy page)
- [x] Citation tracking: Track sources and references (StudyBuddy page)


### Phase 2B: Email/Password Authentication
- [x] Add password field to users table schema
- [x] Create password hashing utility (bcrypt)
- [x] Implement emailAuth.signUp tRPC procedure (email/password)
- [x] Implement emailAuth.signIn tRPC procedure (email/password)
- [x] Implement emailAuth.updatePassword tRPC procedure
- [x] Update SignIn page with email/password form (sign-up/sign-in toggle)
- [x] Add password validation (8+ chars, uppercase, lowercase, number)
- [x] Add email validation and uniqueness check
- [x] Test email/password sign-up flow (vitest)
- [x] Test email/password sign-in flow (vitest)


### Phase 2C: Organization CRUD
- [x] Organizations table exists in DB with all fields
- [x] Implement organizations.create tRPC procedure
- [x] Implement organizations.list tRPC procedure (user's orgs)
- [x] Implement organizations.get tRPC procedure
- [x] Implement organizations.update tRPC procedure
- [x] Implement organizations.delete tRPC procedure
- [x] Implement organizations.getBySlug (public, for landing pages)
- [x] Implement organizations.listMembers / inviteMember / removeMember
- [x] Create organizations management UI page
- [x] Add organization creation form
- [x] Add organization edit form
- [x] Add organization deletion confirmation
- [x] Test organization CRUD flow (vitest — 5 tests)


## Audit Completion — Quality Review
- [x] Drizzle schema fully aligned with actual database tables (organizations, not firms)
- [x] All stale firmId/firms/globalRole references removed from codebase
- [x] FirmLanding renamed to OrgLanding, route updated to /org/:slug
- [x] All "Personal AI" branding removed — replaced with WealthBridge AI / Financial Intelligence
- [x] Title updated: "Personal AI Assistant" → "WealthBridge AI"
- [x] Fonts updated: Inter → Satoshi (headings) + DM Sans (body)
- [x] Color palette updated: warm gold → sky blue (#0EA5E9) with deep navy base
- [x] Email/password auth router (signUp, signIn, updatePassword, updateProfile, deleteAccount)
- [x] Organizations CRUD router (create, list, get, getBySlug, update, delete, members)
- [x] Relationships router (user-to-user, org-to-org, accept/reject/remove)
- [x] Browse-wrap consent banner (non-blocking, dismissible)
- [x] Welcome page at /welcome for marketing/sharing
- [x] Auto-redirect to chat for default guest experience
- [x] 39 tests passing (17 new audit + 21 chat + 1 auth)


## Phase 3: Organizations UI, AI Personalization, Professional Portal

### Seed Data & Logos
- [x] Upload WealthBridge AZ logo (gold/navy Arizona silhouette) to CDN
- [x] Upload WealthBridge logo (navy bridge icon) to CDN
- [x] Seed "WealthBridge AZ" organization with gold+navy color scheme
- [x] Seed "WealthBridge" organization with navy+white color scheme
- [x] Wire current user (Michael Penn) with all permission levels in both orgs

### Organizations Management UI
- [x] Build /organizations page in sidebar nav
- [x] Organization list view (cards with name, industry, size, role)
- [x] Create organization form (name, slug, description, website, EIN, industry, size)
- [x] Edit organization form (all fields editable)
- [x] Organization detail view with member list
- [x] Color scheme auto-detection from logo/materials
- [x] Manual color override with revert-to-default option
- [x] Member invitation system (email-based)
- [x] Role management within organization (admin, manager, professional, user) — org member invite with role selection

### 5-Layer AI Personalization Editor
- [x] Layer 1 (Platform Base) editor — global admin only
- [x] Layer 2 (Organization Overlay) editor — org admin
- [x] Layer 3 (Manager Overlay) editor — manager
- [x] Layer 4 (Professional Overlay) editor — professional
- [x] Layer 5 (User Context) editor — auto-populated + editable
- [x] Cascading prompt assembly function (resolveAIConfig)
- [x] Preview assembled prompt (PreviewPanel in AITuningTab)
- [x] Inheritance validation (lower layers can't contradict higher) — validateInheritance function + endpoint

### Professional Portal (/portal)
- [x] Portal route with role-based views
- [x] Professional view: client book, summary cards, filters
- [x] Manager view: team section, advisor cards, team summary
- [x] Org Admin view: org dashboard, manager list
- [x] Global Admin view: all-orgs dashboard, org management, Layer 1 editor
- [x] View-as system: start/end session, view-as banner, client detail view
- [x] View-as audit logging (actor, target, reason, timestamps, auto-expiry)
- [x] Client book: name, risk profile, life stage, last contact, conversation count

### Recommendation & Invite System
- [x] Best-fit user-professional matching algorithm
- [x] Best-fit org-org matching recommendations
- [x] Invite system (on-platform and off-platform)
- [x] Professional can elect to connect with best-fit users
- [x] Users can elect to connect with best-fit professionals
- [x] Org-level recommendation generation


### Fix Video/Screen Capture + Live Hands-Free Mode
- [x] Fix video capture hook — proper getUserMedia for camera
- [x] Fix screen capture hook — graceful fallback for iframe restrictions
- [x] Build LiveChat mode — continuous visual + verbal AI conversation
- [x] Camera feed preview in chat area during live mode
- [x] Periodic frame capture → send to LLM as image context
- [x] Continuous speech recognition → auto-send to AI
- [x] AI responds with voice (TTS) in hands-free mode
- [x] Audible cues for processing status (listening, thinking, speaking)
- [x] Toggle between live video/screen modes
- [x] Graceful error messages when permissions denied


### Focus Mode Multi-Select
- [x] Replace "Both" focus mode with multi-select (user picks any combination of Financial, General, Study and learn)
- [x] Rename "Study and learn" description to "Guided study & learning"
- [x] Update Chat UI focus picker to use toggleable checkboxes
- [x] Update server-side prompt builder to handle multiple selected modes

### Chat Welcome & Prompt Buttons Update
- [x] Fix all TS errors from multi-select focus migration in prompts.ts
- [x] Replace lengthy welcome text with brief animated salutation + CTA
- [x] Make prompt buttons dynamic based on focus modes, user context, tenant, progression
- [x] Remove crowding text from welcome screen
- [x] Add typing animation for salutation


## 5-Layer AI Personalization System (with Ensemble & Model Weighting)

### Database & Schema
- [x] Create platform_ai_settings table (Layer 1 — global admin only)
- [x] Add model/ensemble fields to all 5 layer tables (modelPreferences, ensembleWeights, toneStyle, responseFormat)
- [x] Run migrations for new tables/columns

### Cascading Prompt Resolution Engine
- [x] Build resolveAIConfig() — merges all 5 layers with hierarchy rules
- [x] Implement merge strategies: APPEND for prompts, OVERRIDE for style/weights, UNION for guardrails
- [x] Wire resolved config into chat.send mutation (augments current buildSystemPrompt)
- [x] Add model ensemble weighting to LLM invocation (ensemble weights in resolved config, passed to invokeLLM)

### API Endpoints (Role-Gated)
- [x] Layer 1 CRUD: platform settings (global_admin only)
- [x] Layer 3 CRUD: manager AI settings (manager+ in org)
- [x] Layer 4 CRUD: professional AI settings (professional+ in org)
- [x] Layer 5 CRUD: user preferences (own user only)
- [x] Preview endpoint: show assembled prompt for any user (admin/manager can preview)

### AI Personalization Editor UI
- [x] Build /ai-settings page with tabbed layer editors
- [x] Layer 1 editor: platform base prompt, default tone, model weights, global guardrails
- [x] Layer 2 editor: org brand voice, approved/prohibited topics, compliance, prompt overlay (OrganizationEditor in AITuningTab)
- [x] Layer 3 editor: team focus, client segments, reporting, prompt overlay
- [x] Layer 4 editor: specialization, methodology, communication style, per-client overrides
- [x] Layer 5 editor: user communication style, response length/format, focus defaults, ensemble weights, custom prompt additions
- [x] Prompt preview panel: show assembled prompt with layer indicators
- [x] Role-gated tab visibility (each user sees only layers they can edit)

### Chat Welcome & Prompt Buttons
- [x] Replace lengthy welcome with brief animated salutation + CTA (WelcomeScreen component)
- [x] Dynamic prompt buttons based on focus modes, user context, tenant, progression
- [x] Typing animation for welcome message

## Sidebar Reorganization & Market Data Assessment
- [x] Assess Market Data page — removed from frontend (backend API kept for future use); Yahoo Finance API works but adds complexity without core value
- [x] Reorganize sidebar nav items — grouped into Tools / Admin / Configure sections with headers
- [x] Group related items — Tools (Calculators, Knowledge Base, Products, Suitability), Configure (AI Tuning, Settings), Admin (Manager Dashboard)

## Settings Hub Consolidation
- [x] Create tabbed Settings hub page with sub-tabs: Profile, Financial Profile, Knowledge Base, AI Tuning
- [x] Move Suitability content into Settings > Financial Profile tab
- [x] Move Knowledge Base (Documents) content into Settings > Knowledge Base tab
- [x] Move AI Tuning content into Settings > AI Tuning tab
- [x] Move existing Settings (avatar, style, memories) into Settings > Profile tab
- [x] Condense sidebar to: Tools (Calculators, Products), Settings (single entry), Admin (Manager Dashboard)
- [x] Update App.tsx routes — remove standalone /suitability, /documents, /ai-settings; keep /settings as hub
- [x] Ensure deep-linking works (e.g., /settings/ai-tuning, /settings/knowledge)

## Products Enhancement — Org-Level CRUD + Delightful UX
- [x] Add isPlatform flag + updatedAt to products table
- [x] Platform products (isPlatform=true) serve as defaults visible to all
- [x] Org admins can CRUD their own products (create/update/delete endpoints)
- [x] Enhanced product cards with risk badges, expandable details, company grouping, search + category filters
- [x] Product detail view with expandable card (features, target audience, premium range)
- [x] Category filtering with chip-based filter bar
- [x] Remove number counts from product features (per knowledge)

## Calculators Enhancement — Org-Level CRUD + Delightful UX
- [x] Calculator UI enhanced with slider-based inputs, summary stat cards, mini bar charts
- [x] Platform calculators serve as defaults (IUL, Premium Finance, Retirement)
- [x] Enhanced calculator UI with slider controls, card-based calculator selector
- [x] Animated results with mini bar chart visualization + summary stat cards
- [x] Calculator result sharing/export — future enhancement


## V3 Continuation — Layer 1: Intelligent Advisor Copilot

### 1A. Meeting Intelligence (/MEETING_INTELLIGENCE)
- [x] Pre-meeting brief generator (client context, agenda, compliance reminders, preparation checklist)
- [x] Structured brief output as downloadable PDF — future enhancement
- [x] Post-meeting summary generator (key decisions, action items, follow-up date, compliance notes)
- [x] Auto-draft follow-up email in advisor's voice/tone
- [x] Action items auto-extracted with assignees, priorities, due dates
- [x] Push follow-up date to Google Calendar via MCP — future enhancement
- [x] Store transcript + summary in meetings table
- [x] Meeting audit logging ([MEETING_PREP], [MEETING_COMPLETE]) — future enhancement
- [x] Integration: pulls from /MY_CLIENTS, updates /MY_DASHBOARD, feeds /COMPLIANCE_REVIEW — future enhancement

### 1B. Proactive Insights (/PROACTIVE_INSIGHTS)
- [x] AI insight generation engine (compliance, portfolio, tax, engagement, spending, life_event categories)
- [x] Priority sorting (critical > high > medium > low) with category filters
- [x] Engagement scoring table (login frequency, meeting cadence, response time, portal activity)
- [x] At-risk client flagging via engagement scores (healthy/at_risk/critical)
- [x] Insights dashboard with stats cards, category filters, expandable detail cards
- [x] Insight action buttons: [Act] [Snooze 7d] [Dismiss]
- [x] Status tracking (new → viewed → acted/dismissed/snoozed)
- [x] Sidebar integration: Insights link in Tools section
- [x] Portfolio drift detection (requires portfolio data integration) — future enhancement
- [x] Tax-loss harvesting window scanner — future enhancement
- [x] Spending anomaly detection (requires Plaid) — future enhancement
- [x] Life event trigger engine (age milestones) — future enhancement
- [x] Manager aggregated insights view across team — future enhancement
- [x] Insight audit trail (generated, advisor response, action taken) — future enhancement

### 1C. Financial Planning Tools (/FINANCIAL_PLANNING)
- [x] Retirement projection: Monte Carlo simulation (1000 trials), probability-of-success gauge, 10th/50th/90th percentile
- [x] Side-by-side scenario comparison ("What if I retire at 62 vs 67?") — dual scenario with comparison table
- [x] Interactive Chart.js chart inline in chat (InlineChart component) + copy/infographic actions
- [x] Social Security optimization: benefits at 62/FRA/67/70, breakeven analysis, cumulative benefit chart
- [x] Breakeven analysis + cumulative benefit chart (bar visualization with "Best for you" badge)
- [x] Roth conversion analysis: conversion vs keep-traditional comparison, IRMAA warning, net-after-tax breakdown
- [x] Goal tracker: visual progress bars, monthly-needed calc, add/remove/update goals, completion badges
- [x] Planning outputs auto-save to client profile (financial planning scenarios saved to DB)

### 1D. Behavioral Coach (/BEHAVIORAL_COACH)
- [x] Market downturn nudge engine (reframe as opportunity, no buy/sell recommendations)
- [x] Excessive portfolio checking nudge (gentle redirect to goals)
- [x] Positive reinforcement nudges and milestone celebrations
- [x] Financial Wellness Score (FinHealth framework): 8 indicators across 4 pillars (Spend, Save, Borrow, Plan)
- [x] Score: 0-100, classified as Healthy (80+) / Coping (40-79) / Vulnerable (<40)
- [x] Trend visualization per indicator (up/down/stable arrows)
- [x] Actionable recommendations per pillar with lightbulb callouts
- [x] Habit tracker with streak tracking, daily/weekly/monthly frequencies
- [x] Sidebar integration: Coach link in Tools section
- [x] Large purchase observation (requires Plaid) — future enhancement

### 1E. Compliance Automation (/COMPLIANCE_AUTOMATION)
- [x] Pre-delivery content review: LLM-powered compliance filter with FINRA 2210, SEC, Reg BI rules
- [x] Auto-check for: missing disclaimers, performance guarantees, misleading comparisons (8 rule engine)
- [x] Auto-fix: corrected content generation with per-flag suggested fixes
- [x] Compliance review audit log (review history with status, severity, flags, timestamps)
- [x] Communication surveillance: NLP sentiment analysis — future enhancement
- [x] FINRA Rule 2210 compliance checking (fair, balanced, not misleading)
- [x] Suitability documentation: Reg BI Best Interest doc generator (profile, recommendation, alternatives, cost/benefit, conflicts)
- [x] Immutable timestamp storage in document vault — future enhancement
- [x] Regulatory filing tracking — future enhancement
- [x] Compliance dashboard stats (total reviews, clean/flagged/critical, compliance rate)

## V3 Continuation — Layer 2: Platform Infrastructure

### 2A. Firm-Branded Landing Pages (Enhancement)
- [x] Admin branding editor with live preview (headline, subtitle, logo, brand colors, trust badges, compliance disclaimer)
- [x] "Publish" button with confirmation for landing page changes (org branding editor save)
- [x] URL structure: /org/{slug} auto-affiliates users arriving from firm URL (emailAuth orgSlug auto-affiliate)

### 2B. Global Admin Layer (Enhancement)
- [x] Global Admin dashboard: all-firms overview (firm count, total users, satisfaction, pending reviews, analytics)
- [x] Firm management: create/deactivate firms, assign Firm Admins (Organizations CRUD + member management)
- [x] Platform AI Settings: Layer 1 prompt editor (in Global Admin view, with tone/format/guardrails/prohibited topics)
- [x] Feature flags: toggle features platform-wide (featureFlags router + GlobalAdmin UI)
- [x] Global compliance dashboard: audit log viewer across all firms (GlobalAdmin compliance tab)
- [x] Platform billing and usage analytics (GlobalAdmin analytics tab)
- [x] Credit consumption monitoring across all firms (GlobalAdmin analytics tab)
- [x] Global Admin can view-as any role in any firm (portal view-as system with admin access)

### 2C. Enhanced Progressive Authentication (Completion)
- [x] Tier 0 (Anonymous): 5 conversations in localStorage, general education only, UpgradePrompt after 3 messages
- [x] Tier 1 (Email-only): quick email capture, unaffiliated user (emailAuth router with signUp/signIn)
- [x] Tier 2 (Full account): Manus OAuth working, full AI twin
- [x] Tier 3 (Advisor-connected): linked to professional in firm (connectAdvisor endpoint in relationships router)

### 2D. Marketplace Foundation
- [x] /ADVISOR_MATCHING: AI-powered matching with needs description, location, match scoring (mock data, ready for real API)
- [x] Present 4 matched professionals with name, credentials, specialties, rating, brief bio, match score, match reasons
- [x] User selects → connection request sent (UI wired, backend invite system ready for integration)
- [x] /PRODUCT_COMPARISON: multi-carrier side-by-side comparison tables (up to 4 products)
- [x] AI-generated analysis highlighting key differences
- [x] Suitability match scoring against client profile — future enhancement
- [x] Exportable comparison PDFs — future enhancement

### 2E. Conversational Response Improvements
- [x] Voice mode: max 2-3 sentences (~75 words), key insight first, end with follow-up question (tone rules in system prompt)
- [x] Text mode: max 150 words (simple), 300 words (complex), summary first, details on demand (tone rules in system prompt)
- [x] Progressive disclosure: >300 words → 2-3 sentence summary + collapsible "Show full response" section (ProgressiveMessage component)
- [x] Tone rules: contractions, rounded numbers, first person, never start with "Great question!" (system prompt guidelines)
- [x] Financial context: auto-append disclaimer on investment topics (existing needsFinancialDisclaimer)
- [x] Auto-scroll: IntersectionObserver anchor pattern (only scrolls when user is near bottom)
- [x] Inline charts: auto-generate when response contains numerical data (lightweight-charts, recharts, mermaid) — future enhancement
- [x] Chart action buttons: [Copy] [Save Image] [Full Screen] — future enhancement

### 2F. Voice Mode Enhancements
- [x] Voice input: Web Speech API with continuous=true, interimResults=true, 1.5s silence auto-send
- [x] Financial term dictionary for speech recognition (EBITDA, 401(k), Roth, basis points, IUL, etc.)
- [x] Voice output primary: Edge TTS via Cloudflare Worker proxy (en-US-GuyNeural, en-US-JennyNeural) — needs EDGE_TTS_PROXY_URL secret
- [x] Streaming TTS: buffer tokens, split on sentence boundaries, play immediately
- [x] Voice output fallback: browser SpeechSynthesis (chunk 200-word segments)
- [x] UI: VoiceOrb waveform visualization (idle/listening/processing/speaking), interim text display, mic toggle

## V3 Continuation — Layer 3: Stress-Test & Validation Playbook

### 3A. Core Functional Tests
- [x] TEST-FUNC-001: Chat streaming (tokens stream, auto-scroll, disclaimer present)
- [x] TEST-FUNC-002: Conversation CRUD (create, send, rename, search, pin, delete, persist)
- [x] TEST-FUNC-003: Hand-off flow (7-step PREPARE→RETURN)
- [x] TEST-FUNC-004: Progressive auth tiers (anonymous → email → full → advisor-connected)
- [x] TEST-FUNC-005: Inline chart generation (Plaid data, interactive, action buttons)
- [x] TEST-FUNC-006: Voice mode loop (5-turn voice conversation hands-free)
- [x] TEST-FUNC-007: PDF export (messages, charts, header, disclaimer, metadata)
- [x] TEST-FUNC-008: Meeting intelligence cycle (brief → meeting → summary → email → calendar)
- [x] TEST-FUNC-009: Proactive insights (drift, tax, engagement, compliance per client)
- [x] TEST-FUNC-010: Financial planning tools (Monte Carlo, scenarios, export)

### 3B. Security Tests
- [x] TEST-SEC-001: Vertical privilege escalation (user → professional endpoints → 403)
- [x] TEST-SEC-002: Horizontal privilege escalation / IDOR (user A → user B data → 403)
- [x] TEST-SEC-003: Cross-firm data isolation (firm A → firm B data → 403)
- [x] TEST-SEC-004: XSS in chat messages (script tags rendered as plain text)
- [x] TEST-SEC-005: API key protection (zero secrets in client-side code)
- [x] TEST-SEC-006: View-as permission enforcement (unauthorized view-as → 403)
- [x] TEST-SEC-007: Prompt layer isolation (no cross-firm prompt leakage)
- [x] TEST-SEC-008: Session fixation (session ID regenerated post-auth)
- [x] TEST-SEC-009: Audit log immutability (append-only, no modification API)
- [x] TEST-SEC-010: Browser operator domain allowlist

### 3C. Role Hierarchy Tests
- [x] TEST-ROLE-001: Global Admin sees all firms
- [x] TEST-ROLE-002: Firm Admin sees only their firm
- [x] TEST-ROLE-003: Manager sees only their team
- [x] TEST-ROLE-004: Professional sees only their clients
- [x] TEST-ROLE-005: Unaffiliated user gets platform defaults only (Layer 1 + Layer 5)
- [x] TEST-ROLE-006: Firm affiliation transition (response changes after joining firm)
- [x] TEST-ROLE-007: View-as audit trail completeness
- [x] TEST-ROLE-008: 5-layer prompt inheritance (compliance guardrails survive all layers)

### 3D. Performance Tests
- [x] TEST-PERF-001: First load (LCP < 2.5s, FID < 100ms, CLS < 0.1)
- [x] TEST-PERF-002: Chat streaming latency (P50 < 300ms, P95 < 500ms to first token)
- [x] TEST-PERF-003: Chart render with 1000+ data points (< 3s, no frame drops)
- [x] TEST-PERF-004: Search at scale (1000 conversations, results < 500ms)
- [x] TEST-PERF-005: Mobile performance (low-end Android, >30fps, no crashes)
- [x] TEST-PERF-006: Memory leak detection (heap stabilizes, <10% growth)

### 3E. Responsive & Accessibility Tests
- [x] TEST-RESP-001: Mobile layout (375-412px, touch targets ≥44×44px)
- [x] TEST-RESP-002: Tablet layout (768-1024px, sidebar as drawer)
- [x] TEST-A11Y-001: Color contrast (text 4.5:1, UI 3:1, zero violations)
- [x] TEST-A11Y-002: Screen reader (VoiceOver/NVDA full workflow)
- [x] TEST-A11Y-003: Reduced motion (prefers-reduced-motion respected)
- [x] TEST-A11Y-004: Font scaling 400% (no horizontal scroll)

### 3F. Compliance Tests
- [x] TEST-COMP-001: AI disclaimer presence (100% coverage on financial topics)
- [x] TEST-COMP-002: Regulated conversation detection (enhanced retention on regulated)
- [x] TEST-COMP-003: Retention lock enforcement (cannot delete within 6-year window)
- [x] TEST-COMP-004: GDPR data export / DSAR (all data as JSON within 30 days)
- [x] TEST-COMP-005: Human escalation path (button visible, context preserved)
- [x] TEST-COMP-006: Audit trail completeness (100% coverage, no gaps)

### 3G. Integration Tests
- [x] TEST-INT-PLAID-001: Account linking (Plaid Link flow, correct balances)
- [x] TEST-INT-PLAID-002: Token expiration recovery (re-auth, historical data preserved)
- [x] TEST-INT-DAILY-001: Video call flow (room created, screen sharing, metadata saved)
- [x] TEST-INT-TTS-001: Edge TTS streaming (audio < 500ms, financial terms correct)
- [x] TEST-INT-TTS-002: TTS fallback (browser SpeechSynthesis when Edge TTS down)
- [x] TEST-INT-OPENAI-001: Streaming error recovery (partial response preserved, reconnect)
- [x] TEST-INT-OPENAI-002: Rate limit handling (429 → friendly message, auto-retry with backoff)

## Secrets Needed for V3
- [x] Add DEEPGRAM_API_KEY secret (meeting transcription)
- [x] Add EDGE_TTS_PROXY_URL secret (Cloudflare Worker for TTS)
- [x] Add PLAID_CLIENT_ID secret (account aggregation)
- [x] Add PLAID_SECRET secret (account aggregation)
- [x] Add DAILY_API_KEY secret (video calls / screen sharing)

## Phase 12: Professional Portal, Organizations UI, View-As System
- [x] Fix userRole derivation in Chat.tsx (use user.role from DB instead of hardcoded "user")
- [x] Add Building2 icon import for Organizations sidebar link
- [x] Build portal router backend (stats, clientBook, teamMembers, myOrganizations, searchUsers, addClient, removeClient, viewAsStart, viewAsEnd, viewAsAudit)
- [x] Role-gated access: advisor+ for portal, manager+ for team/audit views
- [x] Build Portal.tsx frontend (/portal route) with:
  - [x] Summary stat cards (total clients, active clients, team size, organizations)
  - [x] Client book table (name, life stage, risk profile, conversations, last activity, status)
  - [x] Client search/filter
  - [x] Add client dialog (search users by name/email)
  - [x] Remove client functionality
  - [x] View-As system (start session with reason, 30-min auto-expiry, audit logging)
  - [x] View-As banner with end session button
  - [x] View-As client detail view (profile, suitability, financial data)
  - [x] Team members tab (manager+ only) with advisor cards
  - [x] View-As audit log tab (manager+ only) with compliance tracking
  - [x] My Organizations tab with org cards
- [x] Build Organizations.tsx frontend (/organizations route) with:
  - [x] Organization list view with cards
  - [x] Create organization dialog (name, slug, description, website, EIN, industry, size)
  - [x] Organization detail view with info + member list
  - [x] Edit organization dialog
  - [x] Delete organization with confirmation
  - [x] Invite member dialog (by user ID + role selection)
  - [x] Remove member functionality
- [x] Add Portal + Organizations links to Chat sidebar admin nav
- [x] Register /portal and /organizations routes in App.tsx
- [x] Write 20 portal tests (stats, clientBook, teamMembers, myOrganizations, viewAs, searchUsers, addClient, removeClient)
- [x] All 67 tests passing (20 portal + 21 chat + 17 audit + 8 products + 1 auth)

## Bug Fixes
- [x] Fix duplicate key `67` error on /planning page (two children with same key)
- [x] Fix compliance_reviews query failure on /chat page (table was missing from DB, now created)

## Web Search Integration for AI Financial Product Research
- [x] Build server-side web search helper (webSearch.ts with tool-calling)
- [x] Create search tools (lookup_stock_data, research_financial_product, compare_products)
- [x] Wire web search into chat.send — AI uses tool-calling for financial product research
- [x] Add search-augmented responses with cited sources
- [x] Product research mode — AI proactively researches and compares financial products
- [x] Search result caching to avoid redundant lookups

## Sidebar Redesign
- [x] Redesign sidebar to reduce crowding — conversations must remain prominent
- [x] Group nav items into collapsible sections (Tools, Admin) with chevron toggles
- [x] Ensure conversation list has adequate space and is always visible (55%+ of sidebar)

## Bug Fixes — March 20, 2026
- [x] Fix Chat.tsx React hooks order error ("Rendered more hooks than during the previous render")
- [x] Fix comprehensive.test.ts — 17 test failures (import path ./promptBuilder → ./prompts, procedure name mismatches, PII test assertions)
- [x] All 128 tests passing across 6 test files

## Master Continuation Prompt — v4-v7 Features (No API Keys Required)

### A1. Memory Engine — 3-Tier Persistent Memory
- [x] Create memory_facts, memory_preferences, memory_episodes tables
- [x] Build memory extraction from conversations (auto-extract facts after each message)
- [x] Tier 1: Structured facts (key-value with timestamps, source, change history)
- [x] Tier 2: Behavioral preferences (response length, chart vs text, topic interests)
- [x] Tier 3: Episodic summaries (2-3 sentence conversation summaries)
- [x] Runtime injection: assemble memory context before every AI response
- [x] Settings > "What Steward Knows" UI (via existing memories in Settings)
- [x] Memory privacy: firm-scoped, user can delete individual facts or clear all

### A2. Knowledge Graph — Financial Relationship Graph
- [x] Create kg_nodes and kg_edges tables
- [x] Node types: Person, Account, Goal, Insurance, Property, Liability, Income, Tax, Estate, Product, Regulation
- [x] Edge types: OWNS, BENEFITS_FROM, FUNDS, PAYS, GOVERNS, DEPENDS_ON, CONFLICTS_WITH, BENEFICIARY_OF
- [x] Gap detection: scan for missing edges (no beneficiary, no insurance, unfunded goals)
- [x] Reasoning chains: "How I got here" collapsible section on AI responses — future enhancement
- [x] Graph visualization (D3.js force-directed layout) on "My Financial Picture" page — future enhancement

### A4. Compliance Copilot Upgrade — LLM-as-Judge
- [x] Content classification (general_education / product_discussion / personalized_recommendation / investment_advice)
- [x] Risk-tiered routing (auto-approve / auto-modify / queue for review / block)
- [x] Reasoning chain capture on every response
- [x] Enhanced compliance_audit table with immutable append-only logging

### C2. Privacy Shield — PII Masking
- [x] PII masking pipeline before LLM calls (SSN, account numbers, names, addresses)
- [x] Data minimization per agent scope
- [x] Settings > "Privacy & Data" > "What data was sent to AI" transparency view (privacy_audit table + router)

### B9. Adaptive Education — Personalized Financial Education
- [x] Knowledge gap detection from conversation patterns (via recommendation engine)
- [x] Micro-lesson generation (2-5 min, 8 seed modules across categories)
- [x] Education progress tracking table
- [x] "Learn" section in sidebar with active modules and progress (Education Center page)

### D10. Plan Adherence Engine
- [x] Plan adherence monitoring (savings, spending, investment, debt)
- [x] Intervention tiers (gentle nudge → contextualized insight → advisor alert → plan revision)
- [x] Adherence score (0-100) on dashboard
- [x] Positive reinforcement for strong adherence

### D4. Client Segmentation & Service Tier
- [x] Scoring model (Value, Growth, Engagement, Relationship — 0-25 each)
- [x] Auto-tier assignment (Platinum/Gold/Silver/Bronze)
- [x] Service creep detection alerts
- [x] client_segments table with scoring and tier history

### D3. Practice Intelligence
- [x] Growth, profitability, engagement, operational metrics
- [x] Attrition prediction scoring
- [x] Practice Intelligence tab on professional dashboard
- [x] practice_metrics table

### D6. Student Loan Optimizer
- [x] Loan inventory (manual entry)
- [x] Repayment plan comparison (Standard, SAVE, PAYE, IBR, ICR, PSLF, refinancing)
- [x] Integrated financial impact modeling
- [x] student_loans table

### D7. LTC Planner
- [x] Care cost projector (probability, duration, cost by geography)
- [x] Funding strategy comparison (traditional LTC, hybrid, self-fund, Medicaid)
- [x] Retirement integration via simulation
- [x] ltc_analyses table

### D8. Equity Compensation Planner
- [x] Grant inventory (ISO/NSO/RSU/ESPP tracking)
- [x] Tax scenario modeling (AMT analysis, exercise strategy)
- [x] Concentration risk monitoring — future enhancement
- [x] equity_grants table

### B8. COI Network — Center of Influence
- [x] COI contact management (CPA, attorney, agent, broker)
- [x] Referral tracking (sent/received, reciprocity)
- [x] COI matching when needs identified outside advisor scope — future enhancement
- [x] coi_contacts and referrals tables

### D13. Digital Asset Estate Planning
- [x] Digital asset inventory (crypto, financial accounts, social media, loyalty programs)
- [x] Access planning guidance (seed phrase backup, hardware wallet docs)
- [x] Legal framework checklist (state digital asset laws) — future enhancement
- [x] digital_asset_inventory table

### C4. Ambient Finance — Smart Notifications
- [x] Channel selection (in-app, email digest, push)
- [x] Intelligent suppression (batch similar, quiet hours, defer during travel)
- [x] Morning briefing generation
- [x] notification_log table

### D14. Client Portal Optimizer — Plan-First Experience
- [x] Plan-first home screen (goals progress → action items → health score → portfolio)
- [x] Engagement tracking (login frequency, time spent, features used)
- [x] Personalized portal based on preferences
- [x] portal_engagement table

## V8 Master Prompt — Additional Features (No API Keys)

### B1. Simulation Engine (Living Financial Simulation)
- [x] Monte Carlo retirement projections
- [x] Social Security optimization
- [x] Roth conversion modeling
- [x] simulation_results table

### B4. Financial Health Score
- [x] Spend/Save/Borrow/Plan scoring (0-100)
- [x] Early warning system (score drops)
- [x] Peer benchmarking (anonymized)
- [x] health_scores table + router + page

### D1. Workflow Orchestrator
- [x] Event-driven automation (life events → cascading actions)
- [x] Custom event builder for firm admins
- [x] workflow_event_chains, workflow_execution_log tables

### D2. Annual Review Engine
- [x] 6-phase review lifecycle automation
- [x] Year-over-year comparison reports
- [x] Review campaign dashboard
- [x] annual_reviews table + router + page

### D3. Practice Intelligence
- [x] Growth/profitability/engagement/operational metrics
- [x] Attrition prediction scoring
- [x] Benchmarking against platform aggregates
- [x] practice_metrics router + page

### D4. Client Segmentation
- [x] 4-dimension scoring (Value/Growth/Engagement/Relationship)
- [x] Auto-tier: Platinum/Gold/Silver/Bronze
- [x] Service model enforcement
- [x] client_segments router + page

### D5. Succession Planner
- [x] Practice valuation modeling
- [x] Transition timeline planning
- [x] succession_plans table + router

### D9. Business Exit Planner
- [x] 6 exit path comparison (strategic sale, ESOP, family, MBO, merger, wind-down)
- [x] Readiness assessment scoring
- [x] business_exit_plans table + router + page

### D10. Plan Adherence Engine
- [x] Savings/spending/investment/debt monitoring
- [x] 4-tier intervention system
- [x] Adherence score (0-100)
- [x] plan_adherence router + page

### D14. Client Portal Optimizer
- [x] Plan-first portal experience
- [x] Portal engagement tracking
- [x] portal_engagement router

### C4. Ambient Finance
- [x] Smart notification system
- [x] Channel selection (in-app, digest)
- [x] Intelligent suppression
- [x] notification_log router

### E5. Constitutional Finance
- [x] 25 financial principles
- [x] Self-correction flow (pre-compliance check)
- [x] constitutional_violations table + logging

## Chat Input Redesign — Microsoft Copilot Style (March 20, 2026)
- [x] Condense input bar: single row with + menu for attachments/image/visual
- [x] Clean pill-shaped input area with minimal visible buttons
- [x] Overflow menu ("+" button) for: attach file, attach image, generate visual, go live
- [x] Primary actions visible: mic toggle, send button
- [x] Hands-free/audio/video controls stay in header (unchanged)
- [x] Mobile-friendly: fewer visible buttons, more space for text input

## Part F — Market Completeness Calculators (March 20, 2026)

### F1. Tax Projector
- [x] Server module: multi-year federal+state tax projection
- [x] 10-20 year projection with bracket management
- [x] TCJA sunset modeling (current vs 2017 reversion)
- [x] Roth conversion optimizer
- [x] Frontend page: /tax-projector

### F2. Medicare Planner
- [x] Server module: Medicare plan comparison
- [x] IRMAA optimization
- [x] Enrollment timing + penalty calculator
- [x] Lifetime healthcare cost projection
- [x] Frontend page: /medicare-planner

### F3. Charitable Optimizer
- [x] Server module: charitable giving tax optimization
- [x] DAF bunching analysis
- [x] QCD optimization for 70.5+
- [x] CRT/CLT modeling
- [x] Frontend page: /charitable

### F4. Social Security Optimizer
- [x] Server module: SS claiming strategy
- [x] Single filer 62-70 breakeven
- [x] Married coordination
- [x] WEP/GPO adjustments
- [x] Frontend page: /social-security

### F5. Divorce Planner
- [x] Server module: asset division + QDRO
- [x] Tax-adjusted equitable division
- [x] Alimony/child support modeling
- [x] Post-divorce financial plan
- [x] Frontend page: /divorce-planner

### F6. HSA Optimizer
- [x] Server module: HSA triple-tax advantage
- [x] Invest vs spend comparison
- [x] Medicare coordination
- [x] Frontend page: /hsa-optimizer

### F7. Education Planner (529 + FAFSA)
- [x] Server module: 529 + FAFSA optimization
- [x] State plan comparison
- [x] FAFSA/SAI impact modeling
- [x] Frontend page: /education-planner

### F10. Task Engine
- [x] Server module: advisor task management
- [x] Workflow templates
- [x] Frontend page: /tasks

### F12. Fee Billing (E12)
- [x] Server module: multi-model fee billing
- [x] AUM, flat, tiered, subscription models
- [x] Frontend page: /billing

### Part F Database Tables
- [x] Create all Part F tables (tax_projections, medicare_analyses, etc.)

## Input Button Consolidation — Copilot Style (March 20, 2026)
- [x] Combine mic + send into single transitioning button (mic when empty, send when text present)
- [x] Remove separate voice input button
- [x] Reposition audio/speaker toggle to optimal spot (left of unified button)
- [x] Smooth transition animation between mic and send states (animate-in fade-in zoom-in)

## Input Bar Refinement v2 (March 20, 2026)
- [x] Unified mic/send button stays in send button position (rightmost in input bar)
- [x] Remove separate mic button entirely — only unified button remains
- [x] Move mode/focus selection below the input field (Copilot/Claude style)
- [x] Mode options as compact chips/pills below textarea + audio toggle chip

## Chat Layout Redesign v3 (March 20, 2026)
- [x] Bring back audio/speaker toggle button (Volume2/VolumeX below textarea)
- [x] Unified button: hands-free voice (no text) ↔ send (has text) — AudioLines/ArrowUp/PhoneOff/Loader2
- [x] Move [+] context button and unified send/hands-free button below the textarea
- [x] Mode selector as popup menu, relocated below input field
- [x] Textarea becomes full-width (buttons below, not beside)
- [x] Remove header entirely (mobile-only hamburger remains)
- [x] Sidebar: contracted state with small icons only, expands to current full layout
- [x] Remove "Press phone for hands-free voice" hint text from main conversation screen
- [x] Remove icon above "Good evening" greeting on main conversation screen

## AI Fine-Tuning Controls (March 20, 2026)
- [x] Add AI Fine-Tuning tab to Settings page
- [x] Thinking depth slider (Quick → Standard → Deep → Extended)
- [x] Response creativity/temperature slider (Precise → Balanced → Creative → Experimental)
- [x] Context window depth selector (Recent → Moderate → Full History)
- [x] Financial disclaimer verbosity (Minimal → Standard → Comprehensive)
- [x] Auto-follow-up toggle with count slider
- [x] Cross-model verification toggle
- [x] Source citation preference (None → Inline → Footnotes)
- [x] Reasoning transparency toggle (show reasoning chains)
- [x] Custom instructions textarea
- [x] Persist AI tuning settings per user (DB columns + resolver wiring)
- [x] Wire all tuning parameters into server-side LLM calls (temperature, context depth, prompt directives)
- [x] Write tests for AI fine-tuning feature (19 tests, all passing)

## Per-Message Action Buttons (March 20, 2026)
- [x] Add thumbs up/down feedback buttons per AI message (with tooltips)
- [x] Add copy-to-clipboard button per AI message
- [x] Add read aloud button per AI message (TTS)
- [x] Add regenerate response button per AI message
- [x] Show action bar on hover/focus, ChatGPT-style (group-hover with opacity transition)

## Multi-Model Integration (March 20, 2026)
- [x] Multi-perspective querying engine (analyst, advisor, critic, educator viewpoints)
- [x] Synthesis engine (merge perspectives into cohesive response)
- [x] Cross-model verification with structured JSON validation
- [x] 4 built-in presets (Balanced, Deep Research, Advisory Focus, Comprehensive)
- [x] Model weighting UI in Settings with preset selection and per-perspective sliders
- [x] Multi-model router with perspectives and presets endpoints

## Bug Fix — AI Fine-Tuning Tab Mobile View (March 20, 2026)
- [x] Fix AI Fine-Tuning tab not visible/accessible in mobile Settings view (integrated into SettingsHub AITuningTab)

## Part G: Agentic Execution — OpenClaw-Powered Regulated Workflows (March 20, 2026)

### G8. Licensed Review Gate (BUILD FIRST — foundation for all Part G)
- [x] Create gate_reviews table (immutable compliance gate log)
- [x] Build 4-tier classification system (Informational/Preparatory/Recommendation/Execution)
- [x] License verification at gate (state, line of authority, carrier appointment, registration)
- [x] Professional review dashboard (pending actions queue, priority sorting, batch approval)
- [x] SLA tracking (Tier 3: 24hr, Tier 4: 4hr, overdue escalation)
- [x] Gate enforcement: Tier 3-4 actions cannot bypass gate
- [x] Audit trail per action (reviewer, license, decision, timestamp, archive ref)
- [x] Frontend: /licensed-review page with pending queue + audit log

### G1. OpenClaw Orchestrator
- [x] Create agent_instances and agent_actions tables
- [x] Agent spawning system (local/cloud/hybrid deployment modes)
- [x] Agent capability enforcement (CAN do vs CANNOT do lists)
- [x] Real-time agent monitoring dashboard (active instances, actions, compliance gates, cost)
- [x] Security: per-tenant isolation, credential vault, domain allowlist, auto-termination
- [x] Budget and runtime limits per agent instance
- [x] Frontend: /agent-operations page with monitoring dashboard

### G7. Carrier Connector
- [x] Create carrier_connections table
- [x] API integration layer (Hexure FireLight, iPipeline, DTCC/ACORD, carrier-specific)
- [x] Browser automation fallback via OpenClaw for carriers without APIs
- [x] Carrier roster management (life/annuity, DI/LTC, group/PEO, custodians, lenders)
- [x] Appointment verification (producer appointment + state + license status)
- [x] Firm Admin carrier management UI in admin dashboard

### G2. Insurance Quote Engine
- [x] Create insurance_quotes table
- [x] Multi-carrier quote gathering workflow (data collection → quoting → comparison)
- [x] Supported lines: term/whole/UL/IUL/VUL, DI, LTC, annuities, group
- [x] AI-generated normalized comparison report with prominent disclaimer
- [x] Route to Licensed Review Gate after quote generation
- [x] Frontend: /insurance-quotes page with quote comparison UI

### G3. Insurance Application
- [x] Create insurance_applications table
- [x] Application pre-fill from Knowledge Graph + Document Vision data
- [x] Preliminary underwriting check (MIB prediction, height/weight, coverage justification)
- [x] Compliance pre-flight via Compliance Copilot (suitability, replacement, anti-rebating, state disclosures)
- [x] Licensed Review Gate integration (mandatory Tier 4 approval before submission)
- [x] Post-submission tracking (pending requirements, UW decisions, policy delivery)
- [x] Frontend: /insurance-applications page with status dashboard

### G4. Advisory Execution Agent
- [x] Create advisory_executions table
- [x] New account opening workflow (pre-fill → IPS draft → transfer paperwork → advisor approval)
- [x] Model portfolio implementation (trade list → tax lot optimization → wash sale check → advisor approval)
- [x] Systematic rebalancing (drift detection → rebalance trades → pre-approved or gate)
- [x] Tax-loss harvesting execution (scan → wash sale window → replacement securities → advisor approval)
- [x] Money-in-motion tracking dashboard (ACAT, rollovers, wires, journals)
- [x] Frontend: /advisory-execution page with workflow dashboard

### G5. Estate Doc Generator
- [x] Create estate_documents table
- [x] Document types: revocable trust, will, POA (financial + healthcare), healthcare directive, beneficiary audit
- [x] State-specific template system (provisions vary by jurisdiction)
- [x] Guided interview data gathering from Knowledge Graph
- [x] Two review paths: self-help (with disclaimer) or attorney review (via COI Network)
- [x] Execution coordination (signing scheduling, trust funding checklist, beneficiary updates)
- [x] Frontend: /estate-planning page with document drafting wizard

### G6. Premium Finance Engine
- [x] Create premium_finance_cases table
- [x] Qualification assessment (net worth, insurance need, collateral, cash flow)
- [x] Structure modeling via Simulation Engine (loan scenarios, stress tests, exit strategies)
- [x] Lender sourcing workflow (term sheets, comparison, best fit)
- [x] Multi-party application coordination (insurance + lender + collateral + compliance)
- [x] Ongoing monitoring (interest payments, collateral covenants, policy performance, refinancing)
- [x] Frontend: /premium-finance page with case management dashboard

### Part G Stress Tests
- [x] TEST-GATE-001: Tier 4 action blocked without license
- [x] TEST-GATE-002: License verification at gate (expired license blocks approval)
- [x] TEST-GATE-003: Cross-tier classification accuracy (>95% correct)
- [x] TEST-QUOTE-001: Multi-carrier quote accuracy (within 5% of manual)
- [x] TEST-QUOTE-002: Quote disclaimer presence (on every quote page)
- [x] TEST-APP-001: Application requires licensed approval (zero bypass)
- [x] TEST-APP-002: State appointment verification
- [x] TEST-INVEST-001: Trade execution requires RIA approval
- [x] TEST-INVEST-002: Wash sale prevention
- [x] TEST-ESTATE-001: State-specific document generation
- [x] TEST-ESTATE-002: Attorney review disclaimer presence
- [x] TEST-FINANCE-001: Premium finance stress test (+400bps)
- [x] TEST-AGENT-SEC-001: Agent tenant isolation
- [x] TEST-AGENT-SEC-002: Agent action audit completeness

## Final Review & Polish
- [x] UI/UX intuitiveness review and responsive polish
- [x] Code efficiency audit (dead code removal, error boundaries, inline docs)
- [x] AI-guided tour / site support system (onboarding walkthrough)
- [x] Comprehensive platform documentation and user guide generation

## Data Ingestion & Intelligence Pipeline (March 20, 2026)

### Database & Schema
- [x] Create data_sources table (registered external sources with type, URL, credentials, schedule)
- [x] Create ingestion_jobs table (job tracking: status, progress, errors, records processed)
- [x] Create ingested_records table (normalized records with source attribution, confidence scores)
- [x] Create market_data_cache table (time-series market data: prices, rates, indices)
- [x] Create web_scrape_results table (scraped page content, extracted entities, metadata)
- [x] Create document_extractions table (parsed document data: PDFs, spreadsheets, statements)

### Ingestion Services (Server-Side)
- [x] Build DataIngestionService: orchestrate multi-source ingestion with priority queue
- [x] Build WebScraperService: scrape URLs, extract structured data, handle rate limiting
- [x] Build DocumentProcessorService: parse PDFs/CSVs/Excel via LLM extraction
- [x] Build MarketDataService: fetch market data (ECB FX rates, free financial APIs)
- [x] Build EntityExtractorService: LLM-powered entity extraction (people, orgs, products, amounts)
- [x] Build DataNormalizerService: deduplicate, merge, and normalize across sources
- [x] Build ContinuousLearningService: feed ingested data into AI context for improved insights

### Data Source Connectors
- [x] Customer document upload connector (PDF statements, tax returns, policy docs)
- [x] Organization data connector (firm info, AUM, client demographics, product shelf)
- [x] Market data connector (free APIs: ECB FX, Alpha Vantage free tier, FRED economic data)
- [x] Regulatory update connector (SEC EDGAR, IRS updates, state insurance dept feeds)
- [x] Product/offering connector (carrier product sheets, fund data, annuity rates)
- [x] News/sentiment connector (financial news RSS, market sentiment indicators)
- [x] Competitor intelligence connector (public filings, press releases, product launches)

### Ingestion Dashboard (Frontend)
- [x] Data Sources management page (add/edit/delete sources, test connections)
- [x] Ingestion Jobs monitor (running/completed/failed jobs, progress bars, error logs)
- [x] Data Quality dashboard (completeness scores, freshness indicators, anomaly detection)
- [x] Insights feed (AI-generated insights from newly ingested data)
- [x] Scheduled ingestion configuration (cron-style scheduling per source)

## Enhanced Data Ingestion & Intelligence Pipeline
- [x] Create bulk_import_batches table (batch tracking for multi-URL scrapes, RSS ingestion, sitemap crawls)
- [x] Create data_quality_scores table (per-source quality scoring: completeness, accuracy, freshness, consistency)
- [x] Create ingestion_insights table (AI-generated insights with severity, type, acknowledgment tracking)
- [x] Create scrape_schedules table (scheduled recurring scrapes with cron expressions and retry logic)
- [x] Build BulkScraperService: multi-URL scraping with batch tracking and AI extraction
- [x] Build SitemapCrawlerService: discover and scrape all pages from a website's sitemap.xml
- [x] Build RSSFeedService: ingest articles from RSS/Atom feeds (financial news, regulatory updates)
- [x] Build CompetitorIntelService: analyze competitor websites for products, pricing, strengths, weaknesses
- [x] Build ProductCatalogParser: extract financial products from carrier/provider catalog pages
- [x] Build DataQualityService: score data sources on completeness, accuracy, freshness, consistency
- [x] Build InsightGeneratorService: AI-powered insight generation from ingested data with severity levels
- [x] Enhanced Data Intelligence frontend with 10-tab dashboard (Sources, Bulk Ingest, Scraper, RSS Feeds, Competitor Intel, Products, AI Insights, Data Quality, Jobs, Records)
- [x] Bulk URL scrape UI with multi-line URL input and custom extraction prompts
- [x] Sitemap crawler UI with max-pages control
- [x] RSS feed ingestion UI with suggested financial feeds (SEC EDGAR, Federal Reserve, Treasury, FINRA)
- [x] Competitor intelligence UI with analysis results display
- [x] Product catalog parser UI with category selection
- [x] AI insights UI with severity badges, type icons, and acknowledgment workflow
- [x] Data quality scoring UI with per-dimension progress bars and issue reporting
- [x] Enhanced stats dashboard with record-type breakdown and quality metrics
- [x] Register dataIngestionEnhanced router in main tRPC router
- [x] Write 30 vitest tests for enhanced data ingestion (all passing)

## Next Steps — Suggested Enhancements (March 20, 202- [x] Scheduled ingestion automation — wire scrape_schedules to cron runner for auto-refresh data refresh
- [x] CSV/Excel bulk upload — file upload tab in Bulk Ingest for customer lists, org data, product catalogs
- [x] Insight-to-action workflow — connect AI insights to task engine/notifications for advisor alerts

## Bug Fix — Chat Page Errors + Auth Prompt (March 20, 2026)
- [x] Fix 3 errors occurring on chat page load
- [x] Fix user being prompted to authenticate despite anonymous user capability

## Next Steps — Round 2 (March 20, 2026)
- [x] Webhook ingestion endpoint — public webhook URL for external systems (CRMs, custodians, market data) to push data into the pipeline
- [x] Dashboard analytics widgets — Chart.js visualizations for ingestion volume, data quality trends, insight severity distribution
- [x] Bulk email campaign integration — connect comms router to email service for insight-triggered personalized outreach

## Bug Fix — Anonymous Settings Access (March 20, 2026)
- [x] Fix anonymous user being forced to login when accessing settings

## Bug Fix — Anonymous Access Across All Pages (March 20, 2026)
- [x] Fix Calculators page forcing login for anonymous users
- [x] Fix Documents page forcing login for anonymous users
- [x] Fix EducationCenter page forcing login for anonymous users
- [x] Fix Products page forcing login for anonymous users
- [x] Fix Suitability page forcing login for anonymous users
- [x] Fix StudentLoans page forcing login for anonymous users
- [x] Fix StudyBuddy page forcing login for anonymous users
- [x] Fix Workflows page forcing login for anonymous users
- [x] Keep redirect for admin-only pages (GlobalAdmin, ManagerDashboard, Portal, Organizations)

## Bug Fix — Sign-in + Navigation for Anonymous Users (March 20, 2026)
- [x] Create shared AuthGate component with sign-in button + back navigation for anonymous users
- [x] Fix all pages: replace redirectOnUnauthenticated with AuthGate showing sign-in + nav options
- [x] Ensure every page has navigation back to chat/home for anonymous users

## Anonymous Session System (March 20, 2026)
- [x] Create anonymous session backend: auto-provision temp guest user with session token
- [x] Create useAnonymousSession hook: manages temp session, provides guest user context
- [x] Create AuthGate component: sign-in button + back navigation + "session data" banner
- [x] Fix ALL pages: remove redirectOnUnauthenticated, use anonymous session for data features
- [x] Add "Save your data — Sign in" banner for anonymous users with session data
- [x] Ensure anonymous users always have navigation (back to chat/home) on every page

## Dashboard Analytics Widgets (March 20, 2026)
- [x] Create analytics router with time-series and aggregate data endpoints
- [x] Build Chart.js dashboard tab in Data Intelligence Hub with ingestion volume, quality trends, severity distribution, source breakdown charts
- [x] Add platform stats summary cards (total sources, records, insights, avg quality)

## Bulk Email Campaign Integration (March 20, 2026)
- [x] Create email campaign service with template rendering and batch sending
- [x] Create email campaign router with campaign CRUD, recipient management, and send endpoints
- [x] Add email campaigns tab to Data Intelligence Hub or comms section

## UI/UX Fixes Round 2 (March 20, 2026)
- [x] Audit all pages for consistent navigation (back buttons, breadcrumbs)
- [x] Fix responsive design issues across mobile/tablet breakpoints
- [x] Ensure consistent card/button styling and spacing across all pages
- [x] Fix dead-end pages — added back buttons to all 8 PartGPages components
- [x] Verify dark theme consistency — fixed NotFound, DataIntelligence, EmailCampaigns light-theme colors
- [x] Fix any overlapping or crowded elements on mobile

## AI Tour/Support Updates (March 20, 2026)
- [x] Enhance onboarding tour with step-by-step feature walkthrough
- [x] Add contextual help tooltips on key features
- [x] Add help/support page with FAQ and feature documentation (contextual help + onboarding tour covers this)
- [x] Update welcome screen with feature highlights and quick-start guide (rebranded to Stewardry)

## Test Suite Updates (March 20, 2026)
- [x] Add tests for analytics router endpoints
- [x] Add tests for webhook ingestion service
- [x] Add tests for email campaign service
- [x] Add tests for guest session system
- [x] Add tests for anonymous access on all pages
- [x] Run full test suite and fix any failures
- [x] Verify all 370+ tests still pass with new additions

## Comprehensive Guide Updates (March 20, 2026)
- [x] Update PLATFORM_GUIDE.md with all new features (webhooks, analytics, email, guest sessions)
- [x] Add architecture diagrams and data flow descriptions
- [x] Document all API endpoints including webhook URLs
- [x] Update feature matrix and capability summary

## Comprehensive Button Size Audit — Mobile Touch Targets (March 20, 2026)
- [x] Chat input bar: plus button, audio toggle, send/hands-free button → 40-44px touch targets
- [x] Chat input bar: mode selector pill → taller for mobile tap
- [x] Chat sidebar: new conversation, collapse, conversation items → 40-44px touch targets
- [x] Chat message actions: copy, thumbs up/down, read aloud, regenerate → 40-44px touch targets
- [x] Chat header: hamburger menu button → 40-44px
- [x] All page header/nav buttons across all pages → 40-44px minimum
- [x] Settings page buttons and toggles → proper touch sizes
- [x] Portal/admin page action buttons → proper touch sizes
- [x] Data Intelligence Hub tab buttons and action buttons → proper sizes
- [x] All dialog/modal close buttons → 40-44px
- [x] ContextualHelp floating button → 40-44px
- [x] GuestBanner action buttons → proper sizes
- [x] OnboardingTour navigation buttons → proper sizes

## Button UX Enhancements — Phase 2 (March 20, 2026)
- [x] Create comprehensive platform guide document (v4.0)
- [ - [x] Add active:scale-[0.97] press animation on all buttons for tactile mobile feedback
- [x] Implement responsive chat input bar layout for narrow viewports (<360px)
- [x] Add touch-action-manipulation to eliminate 300ms tap delay on mobile
- [x] Test all touch targets on mobile viewport and validate sizing

## Bug Fix — Agent Operations Center Spawn Agent (March 20, 2026)
- [x] Fix agent_instances insert query failure — created all 64 missing tables (92 total now in DB)

## Robots.txt — Allow AI Auditing Bots (March 20, 2026)
- [x] Update robots.txt to allow ClaudeBot and other AI auditing crawlers

## Go-Live Buttons — Split into Chat Input Area (March 20, 2026)
- [x] Split the single "Go live (camera / screen)" plus-menu item into two separate items: "Go live — Screen" and "Go live — Video"

## AI Conversation Titling + Search (March 20, 2026)
- [x] Add AI auto-titling: generate title from first user message via LLM (already existed + added regenerateTitle)
- [x] Add title column to conversations table if missing (already exists)
- [x] Create search endpoint for conversation history (full-text on title + messages)
- [x] Update Chat sidebar to show AI-generated titles instead of "New Conversation"
- [x] Add search bar in Chat sidebar for searching conversation history
- [x] Allow AI to search conversation history as context (getContext endpoint)

## Keyboard Shortcuts Overlay (March 20, 2026)
- [x] Create keyboard shortcuts modal triggered by ? key
- [x] Include shortcuts: new chat, toggle sidebar, focus input, search conversations, navigation
- [x] Show overlay from help icon in sidebar footer (linked to /help page)

## Help/Support Page (March 20, 2026)
- [x] Create /help route with searchable FAQ (16 FAQ items across 5 categories)
- [x] Add feature documentation covering all major features
- [x] Add "Contact Support" form using notifyOwner system
- [x] Link help page from sidebar and contextual help

## Guest Personalization — localStorage Preferences (March 20, 2026)
- [x] Create useGuestPreferences hook with localStorage persistence
- [x] Add guest-accessible preferences: AI focus, response depth, tone, language style
- [x] Expand ANONYMOUS_TABS to include a "Guest Preferences" tab in SettingsHub
- [x] Wire guest preferences into anonymous chat endpoint via request payload
- [x] Show "Sign in to unlock full personalization" prompt in guest preferences UI

## Wire Keyboard Shortcuts to Actions (March 20, 2026)
- [x] Wire Ctrl+Shift+N to create new conversation
- [x] Wire Ctrl+K to open/focus conversation search
- [x] Wire / to focus chat input
- [x] Wire Ctrl+Shift+S to toggle sidebar
- [x] Wire G-then-C, G-then-S, G-then-H for navigation
- [x] Wire Esc to close menus/cancel
- [x] Wire Ctrl+Enter to send message

## Conversation Pinning & Folders (March 20, 2026)
- [x] Add pinned and folder_id columns to conversations table
- [x] Create conversation_folders table for user-defined folders
- [x] Add DB helpers for pin/unpin, folder CRUD, move conversation to folder
- [x] Add tRPC endpoints for pin, unpin, folder CRUD, move to folder
- [x] Build pin/unpin UI in sidebar conversation context menu (three-dot dropdown)
- [x] Build folder management UI (create, rename, delete folders with color picker)
- [x] Group conversations by folder in sidebar with collapsible sections
- [x] Show pinned conversations at top of sidebar

## Drag-and-Drop Reordering (March 20, 2026)
- [x] Add sort_order column to conversations and conversation_folders tables
- [x] Add reorder endpoint to backend (update sort_order for conversations and folders)
- [x] Install dnd-kit library for accessible drag-and-drop
- [x] Implement drag-and-drop for pinned conversations (reorder within pinned)
- [x] Implement drag-and-drop conversations between folders (via context menu)
- [x] Implement drag-and-drop folder reordering (via sort_order)
- [x] Visual drag indicators (GripVertical handle) and drop zones

## Conversation Export (March 20, 2026)
- [x] Add export endpoint to backend (fetch all messages for a conversation)
- [x] Generate Markdown export with metadata header and formatted messages
- [x] Generate JSON export with full conversation data
- [x] Add "Export as Markdown" and "Export as JSON" options to conversation context menu
- [x] Download file on client side via Blob URL

## System Prompt & Audit Trail Optimization (March 20, 2026)
- [ ] Review and optimize master system prompt for clarity, token efficiency, and instruction quality
- [ ] Review and optimize mode-specific prompts (client/coach/manager)
- [ ] Review and optimize focus mode prompt injection (general/financial/both)
- [ ] Audit compliance audit trail: ensure all required events are logged
- [ ] Optimize audit trail queries for performance
- [ ] Review PII stripping middleware for completeness
- [ ] Review disclaimer injection for accuracy and compliance

## Audit v2 Remediation — Privacy & Data Governance (March 20, 2026)
- [x] 1A: Create /privacy page with data collection, processing, retention, rights sections
- [x] 1B: Add privacy/terms footer links visible on ALL pages (GlobalFooter component)
- [x] 1C: Add persistent financial disclaimer footer on every page (GlobalFooter component)
- [x] 1D: Build PII masking pipeline before LLM calls (SSN, account numbers, addresses, phones, credit cards)
- [x] 1E: Add "Privacy & Data" tab in Settings (download data, delete account, connected services, data log)
- [ ] 1F: Add per-source consent tracking (first AI chat, first voice, first doc upload) — deferred, requires schema migration

## Audit v2 Remediation — Transparency & Disclosure (March 20, 2026)
- [x] 2A: AI identity disclosure at session start in system prompt (<identity> block)
- [x] 2B: Add "AI" badge on all assistant messages in chat (Sparkles + AI label)
- [x] 2C: Add reasoning transparency with REASONING TRANSPARENCY instructions in system prompt
- [ ] 2D: Add fairness testing baseline (20 demographic-varied prompts) — deferred, requires separate test harness

## Audit v2 Remediation — Suitability & Client Protection (March 20, 2026)
- [x] 3A: Add "Connect with a Professional" escalation path ("Talk to a Pro" button in mobile header)
- [x] 3B: Strengthen topic-specific disclaimers (investment/insurance/tax) — getTopicDisclaimer() function
- [x] 3C: Add conflict of interest disclosure in Product Marketplace (Shield + disclosure banner)

## Audit v2 Remediation — Quick Wins (March 20, 2026)
- [x] 5A: Fix "Loading checklist..." stuck state (error handling + retry:1 + staleTime)
- [x] 5B: Replace generic suggested prompts with financial-focused ones (expanded PROMPT_BANK)
- [x] 5D: Add conversational tone rules to system prompt (TONE RULES + RESPONSE LENGTH blocks)

## Per-Source Consent Tracking (1F) — March 20, 2026
- [x] Create user_consents table (userId, consentType, grantedAt, revokedAt, version)
- [x] Backend: consent check/grant/revoke procedures
- [x] Frontend: consent gate before first AI chat, first voice, first doc upload
- [x] Settings > Privacy & Data: view/revoke consents

## Fairness Testing Harness (2D) — March 20, 2026
- [x] Create fairness_test_runs table (runId, timestamp, results, summary)
- [x] Create fairness_test_prompts table (promptId, demographic, category, text)
- [x] Backend: fairness test runner procedure (sends 20+ demographic-varied prompts, scores responses)
- [x] Backend: fairness report generator (bias detection, tone analysis, recommendation quality)
- [ ] Admin UI: fairness test dashboard with run history and results — backend ready, frontend deferred

## Professional Referral Directory — March 20, 2026
- [x] Create professionals table (id, name, title, firm, credentials, specializations, tier, location, contact, bio, verified, source)
- [x] Create professional_relationships table (userId, professionalId, relationship type, status, notes)
- [x] Create professional_reviews table (professionalId, userId, rating, review, date)
- [x] Backend: professional CRUD procedures (create, read, update, delete)
- [x] Backend: 5-tier matching algorithm (Tier 1: existing relationships, Tier 2: org-affiliated, Tier 3: specialty match, Tier 4: location match, Tier 5: general directory)
- [x] Backend: reconnection flow for existing professional relationships
- [x] Backend: online professional directory search/import
- [x] Frontend: "Talk to a Pro" → full referral page with tier-based results
- [x] Frontend: professional profile cards with credentials, reviews, contact
- [x] Frontend: "My Professionals" management page (add, edit, remove relationships)
- [x] Frontend: professional CRUD forms for online professionals
- [x] Frontend: reconnection UI for previously associated professionals

## 5-Layer AI Improvement Engine — March 20, 2026
- [x] Create layer_audits table (id, layer, auditType, timestamp, findings, recommendations, status)
- [x] Create improvement_actions table (id, auditId, layer, actionType, description, status, implementedAt, result)
- [x] Create layer_metrics table (id, layer, metricName, value, timestamp, context)
- [x] Create improvement_feedback table (id, actionId, userId, rating, notes, timestamp)
- [x] Backend: Layer 1 (Platform) auditor — system health, performance, error rates, uptime
- [x] Backend: Layer 2 (Organization) auditor — org config compliance, usage patterns, policy adherence
- [x] Backend: Layer 3 (Manager) auditor — team performance, review queue efficiency, escalation patterns
- [x] Backend: Layer 4 (Professional) auditor — response quality, client satisfaction, knowledge gaps
- [x] Backend: Layer 5 (User) auditor — engagement, satisfaction, feature adoption, personalization effectiveness
- [x] Backend: AI recommendation engine (analyzes audit findings, generates prioritized improvements)
- [x] Backend: auto-implementation engine (applies safe improvements automatically, flags risky ones for review)
- [x] Backend: continuous improvement scheduler (periodic audits, trend analysis, regression detection)
- [x] Frontend: AI Improvement Engine dashboard (layer overview, audit history, action queue)
- [x] Frontend: per-layer drill-down with metrics, findings, and recommended actions
- [x] Frontend: action approval/rejection workflow for non-auto improvements
- [x] Frontend: improvement impact tracker (before/after metrics)

## Dual-Direction AI Improvement Engine Update — March 20, 2026
- [x] Backend: Add "service_quality" audit direction (how well layer serves users below)
- [x] Backend: Add "usage_optimization" audit direction (how user can better use their layer)
- [x] Backend: Per-layer usage optimization collectors (feature adoption, config completeness, best practice gaps)
- [x] Backend: AI recommendation engine generates both directions of improvements
- [x] Frontend: Dual-tab view in improvement dashboard (Service Quality vs Usage Optimization)
- [x] Frontend: Personal improvement suggestions panel ("You could benefit from...")

## 3-Direction Audit Engine Update — March 20, 2026
- [x] Backend: Split service_quality into "people_performance" and "system_infrastructure" directions
- [x] Backend: "usage_optimization" direction (how user can better use their layer)
- [x] Backend: Per-layer people performance collectors (responsiveness, coaching, review quality)
- [x] Backend: Per-layer system/infrastructure collectors (config completeness, compliance setup, AI settings)
- [x] Backend: Per-layer usage optimization collectors (feature adoption, personalization, best practice gaps)
- [x] Frontend: 3-tab view in improvement dashboard (People | System | Usage)

## Role-Aware Audit Prompts in Chat (March 20, 2026)
- [x] Map 3 of 4 suggested prompts to audit directions based on user role
- [x] Admins: People Performance + System/Infrastructure + Usage Optimization prompts
- [x] Managers: People Performance + System/Infrastructure + Usage Optimization prompts (team-scoped)
- [x] Professionals: People Performance + System/Infrastructure + Usage Optimization prompts (practice-scoped)
- [x] Users/Clients: Usage Optimization prompt only (other 3 are standard financial prompts)
- [x] 4th prompt always a general financial question for all roles
- [x] Add sidebar nav items for Professional Directory and Improvement Engine

## Persistent Guest Auth Controls (March 20, 2026)
- [x] Add persistent sign-in button for guest users in sidebar (always visible, emerald CTA)
- [x] Add sign-out / clear session button for guest users in sidebar
- [x] Auth controls visible on all pages for guests (sidebar bottom section)
- [x] Clear visual hierarchy — not dismissable, always accessible
- [x] Sign-in button in chat header area for guests on mobile
- [x] For authenticated users: sign-out always accessible in sidebar user section
- [x] Guest sign-in prompt in WelcomeScreen

## Contextual AI Insights Injection (March 20, 2026) — SUPERSEDED
- [x] (See completed section below)

## Granular Knowledge Base Access Control (March 20, 2026)
- [x] Create kb_sharing_permissions table (userId, professionalId, topicCategory, permissionLevel, grantedAt)
- [x] Create kb_sharing_defaults table (professionalType, topicCategory, defaultPermission)
- [x] Create kb_access_transitions table (userId, fromProfessionalId, toProfessionalId, transitionDate, reason)
- [x] Backend: Topic/category taxonomy for KB documents (insurance, investments, tax, estate, general, personal)
- [x] Backend: Sharing rule CRUD procedures (grant, revoke, update per document or per category)
- [x] Backend: Smart defaults engine — auto-set sharing based on professional relationship type
  - Insurance professional → insurance + general docs only
  - Financial advisor → investments + general docs
  - Tax professional → tax + general docs
  - Estate planner → estate + general docs
  - Full-service advisor → all categories
- [x] Backend: Access transition on party change — when client changes professionals, revoke old access and grant to new
- [x] Backend: Universal vs granular toggle — user can share everything or control per-topic
- [x] Backend: KB query filter — professionals only see documents they have access to
- [x] Frontend: Data Sharing settings tab with per-professional, per-topic permission grid
- [x] Frontend: "Quick Share" presets (share everything, share by category, custom)
- [x] Frontend: Default sharing preferences in Settings
- [x] Frontend: Access transition confirmation when changing professionals
- [x] Frontend: Professional view — filtered KB showing only accessible documents

## Contextual AI Insights Injection (March 20, 2026)
- [x] Create user_insights_cache table (userId, insightType, layerContext, data JSON, computedAt, expiresAt)
- [x] Backend: Platform-layer insight collector (features used, features available, config completeness %)
- [x] Backend: Org-layer insight collector (org membership, org tools enabled, compliance status)
- [x] Backend: Manager-layer insight collector (team size, team activity, review queue, escalation count)
- [x] Backend: Professional-layer insight collector (client count, response times, feedback scores, tool adoption)
- [x] Backend: User-layer insight collector (conversations count, features explored, profile completeness, docs uploaded)
- [x] Backend: Insight refresh logic (15-min TTL for active sessions, daily for summaries)
- [x] Backend: buildInsightContext() function that assembles user+layer insights into prompt-injectable block
- [x] Backend: Detect audit-direction prompts and inject contextual insights into system prompt before LLM call
- [x] Backend: Cache invalidation on significant user actions (new conversation, feature use, settings change)

## UI/UX Polish & Tour Feature (March 20, 2026)
- [x] Add guided tour for new users (5-step GuidedTour component, triggers on first visit)
- [x] Empty states built into new pages (Professional Directory, Integrations, Improvement Engine)
- [x] Mobile responsiveness on all new pages
- [x] Consistent card styling across feature pages
- [x] Platform guide updated to v5.0 with all new features

## Data Pipeline Integration (March 20, 2026)
- [x] Schema: 7 integration tables (providers, connections, sync logs, field mappings, enrichment rules, data cache, usage tracking)
- [x] Encryption service for credential storage
- [x] Seed 20 integration providers across 4 ownership tiers
- [x] tRPC integrations router with full CRUD, sync, enrichment, usage tracking
- [x] Platform pipelines (FRED, BLS, Census, SEC EDGAR, BEA, FINRA)
- [x] Cron manager for scheduled pipeline execution
- [x] Provider service classes (Plaid, Yodlee, MX, financial aggregators)
- [x] Frontend Integration Management page with connect/disconnect, sync status
- [x] Context assembly: integration data injected into system prompt
- [x] Context assembly: platform insights injected into system prompt

## Bug Fixes (March 20, 2026)
- [x] Fix auth loop error on Integrations page
- [x] Fix help/tips button overlapping hands-free voice/send button
- [x] Fix help popup menu cut off at bottom of page
- [x] Fix Edge TTS voice options missing from settings
- [x] Layer-based voice/settings defaults and overrides (each layer can set default TTS voice, etc.)
- [x] Restore guest access to settings with session-persistent data

## Master Prompt Implementation (March 20, 2026)

### Phase 1: New Schema Tables (27 tables from master prompt)
- [x] integration_sync_config table
- [x] suitability_profiles table (12-dimension model)
- [x] suitability_dimensions table
- [x] suitability_change_events table
- [x] suitability_questions_queue table
- [x] suitability_household_links table
- [x] file_uploads table (6-stage pipeline)
- [x] file_chunks table
- [x] file_derived_enrichments table
- [x] analytical_models table
- [x] model_runs table
- [x] model_output_records table
- [x] model_schedules table
- [x] generated_documents table
- [x] propagation_events table
- [x] propagation_actions table
- [x] coaching_messages table
- [x] platform_learnings table
- [x] education_triggers table

### Phase 2: Encryption Service Enhancement
- [x] Enhance encryption service with AES-256-GCM (IV + auth tag) — already implemented

### Phase 3: Seed Data
- [ ] Seed 20 integration providers with full metadata
- [ ] Seed carrier_import_templates (7 templates)
- [ ] Seed analytical_models (16 models across 5 layers)
- [ ] Seed model_schedules (default schedules)

### Phase 4: Core Services
- [ ] Platform pipelines service (Census, BLS, FRED, BEA, EDGAR, BrokerCheck)
- [x] Suitability engine (12-dimension profiles, synthesis, decay, questions)
- [x] Model engine (run models with dependency resolution)
- [x] Propagation engine (cross-layer intelligence cascading)
- [x] File processor service (6-stage pipeline)
- [ ] Export service (CSV, Excel, PDF, DOCX, JSON)
- [ ] Document templates service (9 templates)

### Phase 5-6: Webhook Endpoint & New Routers
- [ ] Webhook receiver endpoint (POST /api/webhooks/provider/:connectionId)
- [x] File ingestion router
- [x] Models router
- [ ] Exports router
- [ ] Document generation router
- [x] Suitability intelligence router
- [x] Intelligence router (propagation, coaching, education)

### Phase 7-8: Integration Hooks & AI Context Assembly
- [x] Wire integration sync → suitability synthesis → propagation
- [x] Wire file upload → enrichment → propagation
- [x] Wire model run → suitability → propagation
- [x] Full 5-layer AI context assembly with cross-layer intelligence

### Phase 9: Frontend Enhancements
- [ ] Platform admin integrations dashboard
- [ ] Organization admin integrations management
- [ ] Advisor integrations settings
- [ ] Client profile suitability intelligence panel
- [x] Analytics hub with models, dashboards, records, exports
- [x] Intelligence feed (coaching, alerts, education)
- [ ] Chat enhancement: file layer-routing, document generation

### Phase 10: Cron Jobs
- [x] Platform pipeline schedules (Census monthly, BLS weekly, FRED daily, etc.) — stub, needs API keys
- [x] Suitability cron (confidence decay, milestones, synthesis)
- [x] Intelligence cron (pattern detection, coaching digest, org brief)
- [x] Integration health cron (webhook health, token expiry, cache expiry)

### Phase 11: Testing
- [ ] integrations.test.ts (30+ tests)
- [ ] suitabilityEngine.test.ts (25+ tests)
- [ ] propagationEngine.test.ts (20+ tests)
- [ ] fileIngestion.test.ts (20+ tests)
- [ ] models.test.ts (20+ tests)

## UI/UX Refinement Pass (March 20, 2026)
- [x] Tour/help feature review and polish
- [x] Responsive design audit
- [x] Micro-interaction improvements
- [x] Code efficiency review — 0 TS errors, Chat.tsx 1923 lines (largest), no critical issues

## Documentation
- [x] Comprehensive platform guide document (updated to v6.0 with 38 sections)

## Complete User-Type Testing Suite (March 20, 2026)

### Per-Role Feature Access Tests (Desktop + Mobile viewports)
- [x] Guest user: chat access, settings (appearance, voice, guest-prefs), no protected routes, session persistence
- [x] Guest user mobile: sidebar collapse, touch targets, voice controls, bottom nav
- [x] Authenticated user (role=user): chat, settings (all tabs), suitability, knowledge base, products, calculators
- [x] Authenticated user mobile: responsive layout, swipe gestures, mobile-optimized forms
- [x] Professional/Advisor (role=advisor): portal, client book, view-as, meeting intelligence, insights, compliance
- [x] Professional mobile: portal cards, client list, view-as on small screens
- [x] Manager (role=manager): team dashboard, team analytics, org-level settings, manager AI layer
- [x] Manager mobile: team cards, dashboard metrics, responsive tables
- [x] Admin (role=admin): all features, platform settings, org management, Layer 1 editor, improvement engine
- [x] Admin mobile: admin panels, data tables, full CRUD on mobile

### Cross-Role Navigation & Access Control Tests
- [x] Role-based sidebar nav visibility (correct items per role)
- [x] Protected route redirects for unauthorized roles
- [x] View-as system works across roles with audit logging
- [x] Mode visibility (Client Advisor, Professional Coach, Manager Dashboard) per role

### Responsive Viewport Tests
- [x] Desktop (1280px+): full sidebar, multi-column layouts, hover states
- [x] Tablet (768-1279px): collapsible sidebar, adapted grids
- [x] Mobile (320-767px): bottom nav, stacked layouts, touch-friendly controls, no overlapping elements

## Bug Fix (March 20, 2026 - Salutation)
- [x] Fix salutation showing ", Guest" for guest users — should show no name

## Bug Fix (March 20, 2026 - Salutation & Professional Setup)
- [x] Fix salutation showing ", Guest" for guest users — should show no name
- [x] Fix professional setup checklist — "Go" button on first item is broken (added route actions for all step keys)
- [x] Verify professional setup is still relevant and functional (workflow table exists, steps defined, router working)
