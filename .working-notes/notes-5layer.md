# 5-Layer AI Personalization System — Design Notes

## Current State
- Schema already has: organization_ai_settings (L2), manager_ai_settings (L3), professional_ai_settings (L4), user_preferences (L5)
- Missing: platform_ai_settings (L1) table for global admin
- Missing: model ensemble weighting, tone/style enums, response format preferences at each layer
- Missing: cascading resolution engine that merges all 5 layers
- Missing: UI editors for each layer
- Missing: API endpoints for L1, L3, L4, L5 CRUD (L2 exists in orgBranding.ts)

## Hierarchy Rules (from user_organization_roles)
- global_admin → can edit Layer 1 (Platform) + all lower layers
- org_admin → can edit Layer 2 (Organization) + lower within their org
- manager → can edit Layer 3 (Manager) + lower within their team
- professional → can edit Layer 4 (Professional) + see Layer 5 for their clients
- user → can edit Layer 5 (User preferences) only

## Layer Design

### Layer 1: Platform Base (global_admin)
- Base system prompt template
- Default tone/style
- Default model preferences & ensemble weights
- Global guardrails (what AI can never do)
- Default focus mode behavior
- Platform-wide compliance rules

### Layer 2: Organization Overlay (org_admin)
- Brand voice & tone override
- Approved/prohibited topics
- Compliance language
- Custom disclaimers
- Prompt overlay (appended to base)
- Model preference overrides
- Ensemble weight adjustments

### Layer 3: Manager Overlay (manager)
- Team focus areas
- Client segment targeting
- Reporting requirements
- Prompt overlay
- Model preference for team
- Ensemble weight adjustments

### Layer 4: Professional Overlay (professional)
- Specialization context
- Methodology preferences
- Communication style
- Per-client overrides
- Prompt overlay
- Model preferences

### Layer 5: User Context (user)
- Communication style (simple/detailed/expert)
- Response length (concise/standard/comprehensive)
- Response format (bullets/prose/mixed)
- TTS preferences
- Financial goals/risk tolerance
- Focus mode defaults
- Personal prompt additions

## Cascade Logic
1. Start with Layer 1 (Platform Base)
2. Merge Layer 2 (if user is in an org)
3. Merge Layer 3 (if user has a manager)
4. Merge Layer 4 (if user has a professional)
5. Merge Layer 5 (user's own preferences)

Merge rules:
- promptOverlay: APPEND (each layer adds, doesn't replace)
- tone/style: OVERRIDE (lower layer wins)
- guardrails/prohibited: UNION (accumulate restrictions)
- approved topics: INTERSECT (narrow down)
- model weights: OVERRIDE (lower layer wins)
- response format: OVERRIDE (lower layer wins)
