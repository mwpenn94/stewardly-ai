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
- [ ] Build org admin branding editor (Settings → Branding)
- [x] Implement browse-wrap consent banner for anonymous users

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
- [ ] Tag anonymous/new users with org_id from URL
- [ ] Auto-affiliate new sign-ups to org

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
- [ ] Create organizations management UI page
- [ ] Add organization creation form
- [ ] Add organization edit form
- [ ] Add organization deletion confirmation
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
- [ ] Build /organizations page in sidebar nav
- [ ] Organization list view (cards with logo, name, role)
- [ ] Create organization form (name, slug, description, logo, colors)
- [ ] Edit organization form (branding, colors, language customization)
- [ ] Organization detail view with member list
- [ ] Color scheme auto-detection from logo/materials
- [ ] Manual color override with revert-to-default option
- [ ] Member invitation system (email-based)
- [ ] Role management within organization (admin, manager, professional, user)

### 5-Layer AI Personalization Editor
- [ ] Layer 1 (Platform Base) editor — global admin only
- [ ] Layer 2 (Organization Overlay) editor — org admin
- [ ] Layer 3 (Manager Overlay) editor — manager
- [ ] Layer 4 (Professional Overlay) editor — professional
- [ ] Layer 5 (User Context) editor — auto-populated + editable
- [ ] Cascading prompt assembly function
- [ ] Preview assembled prompt
- [ ] Inheritance validation (lower layers can't contradict higher)

### Professional Portal (/portal)
- [ ] Portal route with role-based views
- [ ] Professional view: client book, summary cards, filters
- [ ] Manager view: team section, advisor cards, team summary
- [ ] Org Admin view: org dashboard, manager list, branding editor
- [ ] Global Admin view: all-orgs dashboard, org management, Layer 1 editor
- [ ] View-as system: sessionStorage context, banner, read-only mode
- [ ] View-as audit logging
- [ ] Client book: name, AUM, risk profile, life stage, last contact

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
- [ ] Replace "Both" focus mode with multi-select (user picks any combination of Financial, General, Study and learn)
- [ ] Rename "Study and learn" description to "Guided study & learning"
- [ ] Update Chat UI focus picker to use toggleable chips/buttons instead of radio
- [ ] Update server-side prompt builder to handle multiple selected modes

### Chat Welcome & Prompt Buttons Update
- [ ] Fix all TS errors from multi-select focus migration in prompts.ts
- [ ] Replace lengthy welcome text with brief animated salutation + CTA
- [ ] Make prompt buttons dynamic based on focus modes, user context, tenant, progression
- [ ] Remove crowding text from welcome screen
- [ ] Add typing animation for salutation


## 5-Layer AI Personalization System (with Ensemble & Model Weighting)

### Database & Schema
- [x] Create platform_ai_settings table (Layer 1 — global admin only)
- [x] Add model/ensemble fields to all 5 layer tables (modelPreferences, ensembleWeights, toneStyle, responseFormat)
- [x] Run migrations for new tables/columns

### Cascading Prompt Resolution Engine
- [x] Build resolveAIConfig() — merges all 5 layers with hierarchy rules
- [x] Implement merge strategies: APPEND for prompts, OVERRIDE for style/weights, UNION for guardrails
- [x] Wire resolved config into chat.send mutation (augments current buildSystemPrompt)
- [ ] Add model ensemble weighting to LLM invocation

### API Endpoints (Role-Gated)
- [x] Layer 1 CRUD: platform settings (global_admin only)
- [x] Layer 3 CRUD: manager AI settings (manager+ in org)
- [x] Layer 4 CRUD: professional AI settings (professional+ in org)
- [x] Layer 5 CRUD: user preferences (own user only)
- [x] Preview endpoint: show assembled prompt for any user (admin/manager can preview)

### AI Personalization Editor UI
- [x] Build /ai-settings page with tabbed layer editors
- [x] Layer 1 editor: platform base prompt, default tone, model weights, global guardrails
- [ ] Layer 2 editor: org brand voice, approved/prohibited topics, compliance, prompt overlay
- [x] Layer 3 editor: team focus, client segments, reporting, prompt overlay
- [x] Layer 4 editor: specialization, methodology, communication style, per-client overrides
- [x] Layer 5 editor: user communication style, response length/format, focus defaults, ensemble weights, custom prompt additions
- [x] Prompt preview panel: show assembled prompt with layer indicators
- [x] Role-gated tab visibility (each user sees only layers they can edit)

### Chat Welcome & Prompt Buttons
- [ ] Replace lengthy welcome with brief animated salutation + CTA
- [ ] Dynamic prompt buttons based on focus modes, user context, tenant, progression
- [ ] Typing animation for welcome message

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
