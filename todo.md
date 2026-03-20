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
- [x] Client book list view
- [x] Client profile view with context injection panel (via View-As)
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
- [ ] Implement Manus Browser Operator integration scaffolding
- [x] Build workflow UI: step tracker, current step display, next step guidance (/workflows page)
- [x] Add cross-platform handoff support (FINRA, Prometric, state DOI, E&O, broker-dealer) — workflow categories
- [x] Implement confirmation number capture and step completion tracking — workflow step completion

### Phase 7: Polish & Testing
- [x] Run all tests (67 existing tests passing)
- [ ] Verify multi-tenant data isolation
- [ ] Test role-based access control across all views
- [x] Test view-as system and audit logging (portal tests)
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
- [x] Add "Study Mode" toggle in chat UI (Study & Learn focus mode in multi-select)
- [x] Create study buddy system prompt variant (study mode in buildSystemPrompt)
- [x] Support asking questions about any shared/uploaded data (document RAG + chat context)
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
- [ ] Upload WealthBridge AZ logo (gold/navy Arizona silhouette) to CDN
- [ ] Upload WealthBridge logo (navy bridge icon) to CDN
- [ ] Seed "WealthBridge AZ" organization with gold+navy color scheme
- [ ] Seed "WealthBridge" organization with navy+white color scheme
- [ ] Wire current user (Michael Penn) with all permission levels in both orgs

### Organizations Management UI
- [x] Build /organizations page in sidebar nav
- [x] Organization list view (cards with name, industry, size, role)
- [x] Create organization form (name, slug, description, website, EIN, industry, size)
- [x] Edit organization form (all fields editable)
- [x] Organization detail view with member list
- [ ] Color scheme auto-detection from logo/materials
- [ ] Manual color override with revert-to-default option
- [ ] Member invitation system (email-based)
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
- [ ] Best-fit user-professional matching algorithm
- [ ] Best-fit org-org matching recommendations
- [ ] Invite system (on-platform and off-platform)
- [ ] Professional can elect to connect with best-fit users
- [ ] Users can elect to connect with best-fit professionals
- [ ] Org-level recommendation generation


### Fix Video/Screen Capture + Live Hands-Free Mode
- [ ] Fix video capture hook — proper getUserMedia for camera
- [ ] Fix screen capture hook — graceful fallback for iframe restrictions
- [ ] Build LiveChat mode — continuous visual + verbal AI conversation
- [ ] Camera feed preview in chat area during live mode
- [ ] Periodic frame capture → send to LLM as image context
- [ ] Continuous speech recognition → auto-send to AI
- [ ] AI responds with voice (TTS) in hands-free mode
- [ ] Audible cues for processing status (listening, thinking, speaking)
- [ ] Toggle between live video/screen modes
- [ ] Graceful error messages when permissions denied


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
- [ ] Calculator result sharing/export — future enhancement


## V3 Continuation — Layer 1: Intelligent Advisor Copilot

### 1A. Meeting Intelligence (/MEETING_INTELLIGENCE)
- [x] Pre-meeting brief generator (client context, agenda, compliance reminders, preparation checklist)
- [ ] Structured brief output as downloadable PDF — future enhancement
- [x] Post-meeting summary generator (key decisions, action items, follow-up date, compliance notes)
- [x] Auto-draft follow-up email in advisor's voice/tone
- [x] Action items auto-extracted with assignees, priorities, due dates
- [ ] Push follow-up date to Google Calendar via MCP — future enhancement
- [x] Store transcript + summary in meetings table
- [ ] Meeting audit logging ([MEETING_PREP], [MEETING_COMPLETE]) — future enhancement
- [ ] Integration: pulls from /MY_CLIENTS, updates /MY_DASHBOARD, feeds /COMPLIANCE_REVIEW — future enhancement

### 1B. Proactive Insights (/PROACTIVE_INSIGHTS)
- [x] AI insight generation engine (compliance, portfolio, tax, engagement, spending, life_event categories)
- [x] Priority sorting (critical > high > medium > low) with category filters
- [x] Engagement scoring table (login frequency, meeting cadence, response time, portal activity)
- [x] At-risk client flagging via engagement scores (healthy/at_risk/critical)
- [x] Insights dashboard with stats cards, category filters, expandable detail cards
- [x] Insight action buttons: [Act] [Snooze 7d] [Dismiss]
- [x] Status tracking (new → viewed → acted/dismissed/snoozed)
- [x] Sidebar integration: Insights link in Tools section
- [ ] Portfolio drift detection (requires portfolio data integration) — future enhancement
- [ ] Tax-loss harvesting window scanner — future enhancement
- [ ] Spending anomaly detection (requires Plaid) — future enhancement
- [ ] Life event trigger engine (age milestones) — future enhancement
- [ ] Manager aggregated insights view across team — future enhancement
- [ ] Insight audit trail (generated, advisor response, action taken) — future enhancement

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
- [ ] Large purchase observation (requires Plaid) — future enhancement

### 1E. Compliance Automation (/COMPLIANCE_AUTOMATION)
- [x] Pre-delivery content review: LLM-powered compliance filter with FINRA 2210, SEC, Reg BI rules
- [x] Auto-check for: missing disclaimers, performance guarantees, misleading comparisons (8 rule engine)
- [x] Auto-fix: corrected content generation with per-flag suggested fixes
- [x] Compliance review audit log (review history with status, severity, flags, timestamps)
- [ ] Communication surveillance: NLP sentiment analysis — future enhancement
- [x] FINRA Rule 2210 compliance checking (fair, balanced, not misleading)
- [x] Suitability documentation: Reg BI Best Interest doc generator (profile, recommendation, alternatives, cost/benefit, conflicts)
- [ ] Immutable timestamp storage in document vault — future enhancement
- [ ] Regulatory filing tracking — future enhancement
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
- [ ] Suitability match scoring against client profile — future enhancement
- [ ] Exportable comparison PDFs — future enhancement

### 2E. Conversational Response Improvements
- [x] Voice mode: max 2-3 sentences (~75 words), key insight first, end with follow-up question (tone rules in system prompt)
- [x] Text mode: max 150 words (simple), 300 words (complex), summary first, details on demand (tone rules in system prompt)
- [x] Progressive disclosure: >300 words → 2-3 sentence summary + collapsible "Show full response" section (ProgressiveMessage component)
- [x] Tone rules: contractions, rounded numbers, first person, never start with "Great question!" (system prompt guidelines)
- [x] Financial context: auto-append disclaimer on investment topics (existing needsFinancialDisclaimer)
- [x] Auto-scroll: IntersectionObserver anchor pattern (only scrolls when user is near bottom)
- [ ] Inline charts: auto-generate when response contains numerical data (lightweight-charts, recharts, mermaid) — future enhancement
- [ ] Chart action buttons: [Copy] [Save Image] [Full Screen] — future enhancement

### 2F. Voice Mode Enhancements
- [x] Voice input: Web Speech API with continuous=true, interimResults=true, 1.5s silence auto-send
- [x] Financial term dictionary for speech recognition (EBITDA, 401(k), Roth, basis points, IUL, etc.)
- [ ] Voice output primary: Edge TTS via Cloudflare Worker proxy (en-US-GuyNeural, en-US-JennyNeural) — needs EDGE_TTS_PROXY_URL secret
- [x] Streaming TTS: buffer tokens, split on sentence boundaries, play immediately
- [x] Voice output fallback: browser SpeechSynthesis (chunk 200-word segments)
- [x] UI: VoiceOrb waveform visualization (idle/listening/processing/speaking), interim text display, mic toggle

## V3 Continuation — Layer 3: Stress-Test & Validation Playbook

### 3A. Core Functional Tests
- [ ] TEST-FUNC-001: Chat streaming (tokens stream, auto-scroll, disclaimer present)
- [ ] TEST-FUNC-002: Conversation CRUD (create, send, rename, search, pin, delete, persist)
- [ ] TEST-FUNC-003: Hand-off flow (7-step PREPARE→RETURN)
- [ ] TEST-FUNC-004: Progressive auth tiers (anonymous → email → full → advisor-connected)
- [ ] TEST-FUNC-005: Inline chart generation (Plaid data, interactive, action buttons)
- [ ] TEST-FUNC-006: Voice mode loop (5-turn voice conversation hands-free)
- [ ] TEST-FUNC-007: PDF export (messages, charts, header, disclaimer, metadata)
- [ ] TEST-FUNC-008: Meeting intelligence cycle (brief → meeting → summary → email → calendar)
- [ ] TEST-FUNC-009: Proactive insights (drift, tax, engagement, compliance per client)
- [ ] TEST-FUNC-010: Financial planning tools (Monte Carlo, scenarios, export)

### 3B. Security Tests
- [ ] TEST-SEC-001: Vertical privilege escalation (user → professional endpoints → 403)
- [ ] TEST-SEC-002: Horizontal privilege escalation / IDOR (user A → user B data → 403)
- [ ] TEST-SEC-003: Cross-firm data isolation (firm A → firm B data → 403)
- [ ] TEST-SEC-004: XSS in chat messages (script tags rendered as plain text)
- [ ] TEST-SEC-005: API key protection (zero secrets in client-side code)
- [ ] TEST-SEC-006: View-as permission enforcement (unauthorized view-as → 403)
- [ ] TEST-SEC-007: Prompt layer isolation (no cross-firm prompt leakage)
- [ ] TEST-SEC-008: Session fixation (session ID regenerated post-auth)
- [ ] TEST-SEC-009: Audit log immutability (append-only, no modification API)
- [ ] TEST-SEC-010: Browser operator domain allowlist

### 3C. Role Hierarchy Tests
- [ ] TEST-ROLE-001: Global Admin sees all firms
- [ ] TEST-ROLE-002: Firm Admin sees only their firm
- [ ] TEST-ROLE-003: Manager sees only their team
- [ ] TEST-ROLE-004: Professional sees only their clients
- [ ] TEST-ROLE-005: Unaffiliated user gets platform defaults only (Layer 1 + Layer 5)
- [ ] TEST-ROLE-006: Firm affiliation transition (response changes after joining firm)
- [ ] TEST-ROLE-007: View-as audit trail completeness
- [ ] TEST-ROLE-008: 5-layer prompt inheritance (compliance guardrails survive all layers)

### 3D. Performance Tests
- [ ] TEST-PERF-001: First load (LCP < 2.5s, FID < 100ms, CLS < 0.1)
- [ ] TEST-PERF-002: Chat streaming latency (P50 < 300ms, P95 < 500ms to first token)
- [ ] TEST-PERF-003: Chart render with 1000+ data points (< 3s, no frame drops)
- [ ] TEST-PERF-004: Search at scale (1000 conversations, results < 500ms)
- [ ] TEST-PERF-005: Mobile performance (low-end Android, >30fps, no crashes)
- [ ] TEST-PERF-006: Memory leak detection (heap stabilizes, <10% growth)

### 3E. Responsive & Accessibility Tests
- [ ] TEST-RESP-001: Mobile layout (375-412px, touch targets ≥44×44px)
- [ ] TEST-RESP-002: Tablet layout (768-1024px, sidebar as drawer)
- [ ] TEST-A11Y-001: Color contrast (text 4.5:1, UI 3:1, zero violations)
- [ ] TEST-A11Y-002: Screen reader (VoiceOver/NVDA full workflow)
- [ ] TEST-A11Y-003: Reduced motion (prefers-reduced-motion respected)
- [ ] TEST-A11Y-004: Font scaling 400% (no horizontal scroll)

### 3F. Compliance Tests
- [ ] TEST-COMP-001: AI disclaimer presence (100% coverage on financial topics)
- [ ] TEST-COMP-002: Regulated conversation detection (enhanced retention on regulated)
- [ ] TEST-COMP-003: Retention lock enforcement (cannot delete within 6-year window)
- [ ] TEST-COMP-004: GDPR data export / DSAR (all data as JSON within 30 days)
- [ ] TEST-COMP-005: Human escalation path (button visible, context preserved)
- [ ] TEST-COMP-006: Audit trail completeness (100% coverage, no gaps)

### 3G. Integration Tests
- [ ] TEST-INT-PLAID-001: Account linking (Plaid Link flow, correct balances)
- [ ] TEST-INT-PLAID-002: Token expiration recovery (re-auth, historical data preserved)
- [ ] TEST-INT-DAILY-001: Video call flow (room created, screen sharing, metadata saved)
- [ ] TEST-INT-TTS-001: Edge TTS streaming (audio < 500ms, financial terms correct)
- [ ] TEST-INT-TTS-002: TTS fallback (browser SpeechSynthesis when Edge TTS down)
- [ ] TEST-INT-OPENAI-001: Streaming error recovery (partial response preserved, reconnect)
- [ ] TEST-INT-OPENAI-002: Rate limit handling (429 → friendly message, auto-retry with backoff)

## Secrets Needed for V3
- [ ] Add DEEPGRAM_API_KEY secret (meeting transcription)
- [ ] Add EDGE_TTS_PROXY_URL secret (Cloudflare Worker for TTS)
- [ ] Add PLAID_CLIENT_ID secret (account aggregation)
- [ ] Add PLAID_SECRET secret (account aggregation)
- [ ] Add DAILY_API_KEY secret (video calls / screen sharing)

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
- [ ] Add search-augmented responses with cited sources
- [ ] Product research mode — AI proactively researches and compares financial products
- [ ] Search result caching to avoid redundant lookups

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
- [ ] Reasoning chains: "How I got here" collapsible section on AI responses — future enhancement
- [ ] Graph visualization (D3.js force-directed layout) on "My Financial Picture" page — future enhancement

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
- [ ] Plan adherence monitoring (savings, spending, investment, debt)
- [ ] Intervention tiers (gentle nudge → contextualized insight → advisor alert → plan revision)
- [ ] Adherence score (0-100) on dashboard
- [ ] Positive reinforcement for strong adherence

### D4. Client Segmentation & Service Tier
- [ ] Scoring model (Value, Growth, Engagement, Relationship — 0-25 each)
- [ ] Auto-tier assignment (Platinum/Gold/Silver/Bronze)
- [ ] Service creep detection alerts
- [ ] client_segments table with scoring and tier history

### D3. Practice Intelligence
- [ ] Growth, profitability, engagement, operational metrics
- [ ] Attrition prediction scoring
- [ ] Practice Intelligence tab on professional dashboard
- [ ] practice_metrics table

### D6. Student Loan Optimizer
- [x] Loan inventory (manual entry)
- [x] Repayment plan comparison (Standard, SAVE, PAYE, IBR, ICR, PSLF, refinancing)
- [x] Integrated financial impact modeling
- [x] student_loans table

### D7. LTC Planner
- [ ] Care cost projector (probability, duration, cost by geography)
- [ ] Funding strategy comparison (traditional LTC, hybrid, self-fund, Medicaid)
- [ ] Retirement integration via simulation
- [ ] ltc_analyses table

### D8. Equity Compensation Planner
- [x] Grant inventory (ISO/NSO/RSU/ESPP tracking)
- [x] Tax scenario modeling (AMT analysis, exercise strategy)
- [ ] Concentration risk monitoring — future enhancement
- [x] equity_grants table

### B8. COI Network — Center of Influence
- [x] COI contact management (CPA, attorney, agent, broker)
- [x] Referral tracking (sent/received, reciprocity)
- [ ] COI matching when needs identified outside advisor scope — future enhancement
- [x] coi_contacts and referrals tables

### D13. Digital Asset Estate Planning
- [x] Digital asset inventory (crypto, financial accounts, social media, loyalty programs)
- [x] Access planning guidance (seed phrase backup, hardware wallet docs)
- [ ] Legal framework checklist (state digital asset laws) — future enhancement
- [x] digital_asset_inventory table

### C4. Ambient Finance — Smart Notifications
- [ ] Channel selection (in-app, email digest, push)
- [ ] Intelligent suppression (batch similar, quiet hours, defer during travel)
- [ ] Morning briefing generation
- [ ] notification_log table

### D14. Client Portal Optimizer — Plan-First Experience
- [ ] Plan-first home screen (goals progress → action items → health score → portfolio)
- [ ] Engagement tracking (login frequency, time spent, features used)
- [ ] Personalized portal based on preferences
- [ ] portal_engagement table
