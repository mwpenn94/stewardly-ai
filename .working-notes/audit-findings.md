# WealthBridge AI v2 Build Prompt — Audit Reference

## Key Spec Requirements vs Current State

### HIERARCHY & ROLES
- Spec: global_admin | firm_admin | manager | professional | user
- Spec: Users belong to firms, firms have members with roles
- Spec: Unaffiliated users get Layer 1 + Layer 5 only
- Current: Role column was dropped from users table. No role enforcement.

### PHASE 1: LANDING PAGES
- Spec: Global landing at / with specific hero text, cards, trust signals
- Spec: Firm landing at /firm/[slug] with admin-configurable branding
- Current: Landing page exists but auto-redirects immediately (user never sees it)
- Current: FirmLanding exists but uses placeholder data (no DB query)
- Issue: "Personal AI" branding still in welcome message text

### PHASE 2: AUTH & PROGRESSIVE ACCESS
- Spec: 4-tier progressive auth (Anonymous → Email → Full → Advisor-connected)
- Spec: Anonymous gets 5 conversations in localStorage, subtle sign-up prompt after 3 messages
- Spec: Browse-wrap consent banner (not blocking gate)
- Current: ConsentGate removed (good), but no browse-wrap banner
- Current: No email-only tier, no progressive prompting after 3 messages
- Current: Email/password auth procedures not yet implemented
- Issue: Password utility created but not wired to any tRPC procedure

### PHASE 3: CHAT INTERFACE
- Spec: Auto-scroll with IntersectionObserver anchor pattern
- Spec: Conversational response design (max 2-3 sentences voice, 3-5 text)
- Spec: Inline chart generation (lightweight-charts, recharts, mermaid)
- Spec: Voice mode with waveform animation
- Spec: Pinned conversations section
- Current: Chat works but needs audit of auto-scroll, response length enforcement

### PHASE 4: SETTINGS
- Spec: 5 tabs (Profile, AI Preferences, Financial Setup, Notifications, Appearance)
- Current: Settings page exists but needs audit against spec

### PHASE 5: HIERARCHICAL AI PERSONALIZATION
- Spec: 5-layer cascading system prompt
- Spec: Runtime assembly function
- Current: Prompts exist but no layer assembly from DB

### DATABASE SCHEMA ISSUES
- firms table: exists in schema but NOT in database
- firm_members table: exists in schema but NOT in database  
- firm_landing_page_config: exists in schema but NOT in database
- firm_ai_settings: exists in schema but NOT in database
- manager_ai_settings: exists in schema but NOT in database
- professional_ai_settings: exists in schema but NOT in database
- user_preferences: exists in schema but NOT in database
- view_as_audit_log: exists in schema but NOT in database
- workflow_checklist: exists in schema but NOT in database
- users.passwordHash: exists in both schema and DB (confirmed)
- users.role: was dropped from DB, removed from schema
- conversations.firmId: removed from schema (not in DB)

### ORGANIZATIONS ROUTER
- Created but references firms table which doesn't exist in DB
- Will fail at runtime

### DESIGN DIRECTION
- Spec: Satoshi for headings, DM Sans for body
- Spec: Deep navy (#0F172A), sky blue (#0EA5E9), emerald (#10B981), rose (#F43F5E)
- Current: Need to verify fonts and color palette

### MULTI-MODAL SECRETARY/STUDY BUDDY
- Screen capture hook created
- Video capture hook created  
- CaptureModal component created
- Study and learn focus mode added
- Study mode system prompt added
- Not yet wired to actual LLM vision calls
