# Virtual User Testing Notes

## Test 1: Chat Page — Load Existing Conversation
- URL: /chat/750011 (Explain premium financing...)
- The API call `conversations.messages` returns `{"json":[]}` — an empty array
- This means conversation 750011 has NO messages in the database (it was one of the empty conversations)
- The conversation title was set but no messages were ever sent
- This is NOT a bug — the conversation just has no content
- The UI should show an empty state or prompt rather than a blank area

## Test 2: Chat Page — Welcome State
- URL: /chat (no conversation selected)
- Welcome screen shows correctly with greeting, suggestion cards, and input area
- PASS

## Test 3: Sidebar
- 16 named conversations displayed (empty ones filtered correctly)
- Note: Some of these 16 "named" conversations may also have 0 messages (title was set but user never sent anything)
- The filter only removes "New Conversation" titled ones — named but empty ones still show

## Test 4: Consent Banner
- Shows at bottom, "Got it" button works
- PASS

## Test 5: Conversation with Messages (id=690001)
- URL: /chat/690001 (based on data pipelines...)
- Messages load correctly with full markdown rendering
- Multiple user/assistant exchanges visible with tool calls, reasoning badges, and infographic buttons
- Scrolling through long conversation works well
- PASS

## Test 6: Sidebar messageCount Filter
- 16 conversations with messages shown, 8 empty ones (including 1 named) correctly hidden
- Fix: Added messageCount subquery to getUserConversations, removed focusMode (column doesn't exist in DB)
- PASS

## Test 7: Post-Schema Fix — All Hub Pages (2026-04-01)

After fixing 185 Drizzle schema column names (snake_case → camelCase) and adding 7 missing columns:

| Page | Status | Notes |
|------|--------|-------|
| Chat | PASS | Sidebar shows 16 conversations with messages |
| Intelligence Hub | PASS | Was blank before fix. Now shows models, data sources, insights feed |
| Advisory Hub | PASS | Was blank before fix. Now shows products, cases, recommendations |
| Operations Hub | PASS | Shows workflows, agents, compliance, history tabs |
| Relationships Hub | PASS | Shows network, meetings, outreach, client book |
| Market Data | PASS | Renders correctly |
| Help | PASS | Renders correctly |
| Settings | PASS | Renders correctly |

### Remaining Items
- TypeScript check shows 1 error (needs investigation — may be OOM crash)
- Some stat cards show "—" instead of numbers (may need data or API fixes)
- Consent banner reappears on every page load (localStorage persistence issue)
