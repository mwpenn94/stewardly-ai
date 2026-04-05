# UI Review Notes

## Landing Page (/)
- Landing page loads correctly as chat interface
- Sidebar navigation visible with all expected items
- User is logged in (shows "Useruser")
- Notification bell, changelog bell visible
- Tools section visible with collapse
- Help & Support, Settings links present

## Routes to check:
- /passive-actions (new)
- /market-data (newly added route)
- /integrations (SOFR dashboard, CRM sync, Client connections)
- /integration-health
- /relationships (professional directory with badges)
- /admin/intelligence (5-tab dashboard)

## Issues found:
- Landing page: None
- Integrations page: Shows "Sign in to connect" for guest users (correct behavior). SOFR dashboard shows "No rate data yet" with refresh button. CRM sync shows "No CRM connections" with helpful message. Client Account Connections section needs scroll to verify.
- Passive Actions page: Shows title and description, needs auth to see toggle cards (correct behavior)
