# Remaining TODO Items — WealthBridge AI

## Implementable Now (no external dependencies)

### Chat & UX Improvements
- Focus mode multi-select (replace "Both" with toggleable Financial/General/Study chips)
- Chat welcome redesign (brief animated salutation, dynamic prompt buttons based on context)
- Typing animation for welcome message
- Layer 2 AI editor (org brand voice, compliance, prompt overlay)
- Model ensemble weighting in LLM invocation
- Inline chart generation (recharts/mermaid when response has numerical data)
- Progressive disclosure ChartRenderer component
- Generate Infographic button for image generation

### Organizations & Auth Enhancements
- Color scheme auto-detection from logo/materials
- Manual color override with revert-to-default
- Role management within organization (admin, manager, professional, user)
- Member invitation system (email-based)
- Tag anonymous users with org_id from URL
- Auto-affiliate new sign-ups to org
- Tier 1 email-only auth (quick email capture, unaffiliated user)
- Tier 3 advisor-connected auth (linked to professional, shared dashboard)
- "Publish" button with confirmation for landing page changes

### Seed Data
- Upload WealthBridge AZ logo to CDN
- Upload WealthBridge logo to CDN
- Seed "WealthBridge AZ" and "WealthBridge" organizations
- Wire current user with all permission levels

### Portal & Admin Enhancements
- Case Design Summary generator
- Life Advisor Summary generator
- Focus-aware client report export
- Team analytics dashboard (management portal)
- Product and resource shelf manager
- Context layer manager
- AI-generated opportunity summaries
- Feature flags (toggle features platform-wide)
- Global compliance dashboard (audit log viewer across all firms)
- Platform billing and usage analytics
- Credit consumption monitoring
- Global Admin can view-as any role in any firm

### Financial Planning & Compliance
- Calculator result sharing/export
- Planning outputs auto-save to client profile
- Interactive Recharts chart inline in chat + export/save/share
- Structured meeting brief output as downloadable PDF
- Meeting audit logging
- Communication surveillance (NLP sentiment analysis)
- Immutable timestamp storage in document vault
- Regulatory filing tracking

### Workflow Orchestration
- Build workflow orchestration engine (PREPARE → BRIEF → NAVIGATE → ASSIST → HANDOFF → CONFIRM → RETURN)
- Master onboarding checklist (database-backed)
- Manus Browser Operator integration scaffolding
- Workflow UI: step tracker, current step, next step guidance
- Cross-platform handoff support (FINRA, Prometric, state DOI, E&O, broker-dealer)
- Confirmation number capture and step completion tracking

### 5-Layer AI Personalization (remaining)
- Cascading prompt assembly function (UI-level)
- Preview assembled prompt (UI-level)
- Inheritance validation (lower layers can't contradict higher)

### Recommendation & Matching
- Best-fit user-professional matching algorithm
- Best-fit org-org matching recommendations
- Invite system (on-platform and off-platform)
- Suitability match scoring against client profile

---

## Requires External APIs / Secrets

### Plaid Integration
- Portfolio drift detection
- Tax-loss harvesting window scanner
- Spending anomaly detection
- Large purchase observation
- Account linking flow
- Secrets: PLAID_CLIENT_ID, PLAID_SECRET

### Edge TTS
- Voice output primary: Edge TTS via Cloudflare Worker proxy
- Secret: EDGE_TTS_PROXY_URL

### Meeting Transcription
- Secret: DEEPGRAM_API_KEY

### Video Calls
- Video call flow (room creation, screen sharing)
- Secret: DAILY_API_KEY

### Screen/Video Capture
- Screen Capture API for real-time sharing
- WebRTC/getUserMedia for live video
- LiveChat mode (continuous visual + verbal AI)

---

## Multi-Modal Study Buddy (large feature set)
- Multi-modal RAG (PDF, images, video, audio indexing)
- Visual OCR for image/screenshot text extraction
- Video transcript indexing
- Unified cross-format search
- Study Mode toggle
- Data highlighting and annotation
- Table extraction from PDFs/images
- CSV/Excel import and analysis
- Canvas overlay for markup
- Summarization, outlining, Q&A generation, comparison, timeline, glossary, citation tracking

---

## Test Playbook (Layer 3 — 46 tests)
- 10 core functional tests (chat, CRUD, auth, voice, PDF, meetings, insights, planning)
- 10 security tests (privilege escalation, IDOR, XSS, API key protection, view-as)
- 8 role hierarchy tests (admin/firm/manager/professional isolation)
- 6 performance tests (LCP, streaming latency, chart render, search, mobile, memory)
- 6 responsive & accessibility tests (mobile, tablet, contrast, screen reader, motion, font scaling)
- 6 compliance tests (disclaimers, retention, GDPR, escalation, audit trail)
- 7 integration tests (Plaid, Daily, Edge TTS, OpenAI error handling)

---

**Summary:** ~130 unchecked items total. Roughly 40 are implementable now without external dependencies, ~25 require external API keys, ~30 are the study buddy feature set, and ~46 are the test playbook.
