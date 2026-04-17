# Sidebar Audit — Pass 111

## Current PERSONA_LAYERS Structure (PersonaSidebar5.tsx)

### Layer 1: "People" (guest+)
- Chat, Documents
- Sub: Studio (AI Studio, Code Chat, Audio) dl2
- Sub: Progress (My Progress) dl2

### Layer 2: "Clients" (user+)
- My Financial Twin, Wealth Engine dl2, Products dl2
- Sub: Intelligence (Insights, Suitability, Operations) dl2
- Sub: Automation (Workflows, Passive Actions, Client Onboarding) dl3
- Sub: Connect (Integrations, Community) dl2

### Layer 3: "Professionals" (advisor+)
- My Work, Advisory, Clients
- Sub: Insurance (Insurance & Apps, Lead Pipeline, Compliance) dl3
- Sub: Marketing (Email Campaigns, Marketing Assets, Outreach) dl3
- Sub: Data & CRM (CRM Sync, Import Data, Data Pipelines) dl3
- Sub: Analytics (Market Data, Product Intelligence, Rebalancing) dl2
- Sub: Integrations (Dynamic Integrations, Integration Health) dl3

### Layer 4: "Leaders" (manager+)
- Team Dashboard, Organizations

### Layer 5: "Stewards" (admin)
- Platform Admin dl4
- Sub: AI & Agents (AI Agents, Consensus, AI Intelligence) dl4
- Sub: Platform Ops (Improvement, Improvement Engine, System Health, Data Freshness, BCP, Fairness) dl4
- Sub: Config (Rate Management, Billing, API Keys, Webhooks, Team, Lead Sources) dl4
- Sub: Knowledge (Comparables, Platform Reports, Knowledge Base, Platform Guide, API Docs, Audit Trail) dl3

### Footer
- Learn (always visible for user+)
- Settings
- Help

## Target Simplified Structure

### Top-level sidebar items (8-10 max):
1. Chat (existing)
2. Financial Twin (existing)
3. Wealth Engine (existing, has internal sidebar)
4. People (NEW HUB → Clients, Leads, CRM, Compliance, Marketing, Onboarding)
5. Intelligence (NEW HUB → Market Data, Insights, Analytics, Data Pipelines)
6. Learning (existing)
7. Admin (existing, convert to internal sidebar)
8. Settings (existing, already has internal sidebar)
9. Help (existing)

### Role-based visibility:
- Guest: Chat, Settings, Help
- User: + Financial Twin, Wealth Engine, Learning
- Advisor: + People, Intelligence
- Manager: + Team/Orgs (inside People or Admin)
- Admin: + Admin
