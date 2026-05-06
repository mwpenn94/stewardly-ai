# Exhaustive Audit: Current State vs Target

## Current Screenshot (What's Actually Rendering)

Dark mode. Sidebar on left, main chat on right.

### Sidebar (What I Built)
- "Stewardly" brand header (blue) with dot + "+" and collapse icons ✅
- ⌘K search bar ✅
- "Chat" with blue active pill ✅
- WEALTH → Wealth Engine ✅
- PROFESSIONAL → People, Intelligence ✅
- LEADERSHIP → Team, Organizations ✅
- **PLATFORM → Settings, Help** ❌ (should NOT have PLATFORM header — Settings/Help should be pinned bottom items without a section header)
- Bottom: Notification bell (10 badge), changelog, theme toggle, user profile ✅
- Conversation list stuffed below nav items ❌ (screenshots don't show this)

### Main Content Area (What I Did NOT Touch)
- "Good morning, Michael." in italic serif font ❌ (should be clean sans-serif)
- 4 dark gradient engine cards (Wealth, Learning, People, Data) ❌ (should be removed or restyled)
- "CONTINUE WHERE YOU LEFT OFF" with recent conversations ❌ (should be removed)
- Quick suggestion pills at bottom ⚠️ (style OK but placement wrong)
- Input pill at very bottom with +, mic, send ✅ (matches manus-next)

---

## Your Stewardly Screenshots (The Target)

Light mode. Clean white glass aesthetic.

### Sidebar
- "Stewardly" brand (blue) + dot + "+" and collapse icons
- Search bar with ⌘K badge (rounded, glass)
- Chat (no active state shown — it's on Settings page in screenshot)
- **WEALTH** → Wealth Engine
- **PROFESSIONAL** → People, Intelligence
- **LEADERSHIP** → Team, Organizations
- Learn (standalone, with blue badge "1")
- **Settings** — ACTIVE: light blue pill background, blue text, rounded corners
- **Help** — below Settings, no section header above them
- **NO conversation list visible**
- **NO "PLATFORM" section header**

### Key Differences I Missed
1. **No PLATFORM header** — Settings and Help are just pinned at the bottom
2. **No conversation list** in the sidebar at all
3. **Much more generous spacing** — each row is ~48-56px with breathing room
4. **Active pill is more pronounced** — full light-blue background pill (not just text color)
5. **Light mode** is the primary aesthetic
6. **Learn item** sits between Leadership and Settings (with a notification badge)

---

## What's DONE ✅

| Item | Status |
|------|--------|
| Sidebar brand header (Stewardly + dot + buttons) | ✅ Done |
| ⌘K search bar | ✅ Done |
| Nav sections with uppercase headers (WEALTH, PROFESSIONAL, LEADERSHIP) | ✅ Done |
| Blue active pill states | ✅ Done (but needs more pronounced bg) |
| Learn item (standalone) | ✅ Done |
| Settings + Help in bottom area | ✅ Done |
| Theme toggle (light/dark/system) | ✅ Done |
| Notifications + Changelog bells | ✅ Done |
| User profile + auth controls | ✅ Done |
| Collapsed sidebar mode with tooltips | ✅ Done |
| Glass CSS variables (light + dark) | ✅ Done |
| Dead code removal | ✅ Done |
| ConsentBanner removal | ✅ Done |
| Input pill (manus-next style) | ✅ Done |

## What's NOT DONE ❌

| Item | Impact | Effort |
|------|--------|--------|
| **Replace ChatGreetingV2** — remove engine cards, italic serif, "Continue where you left off" → simple sans-serif greeting | HIGH (most visible) | Medium |
| **Remove PLATFORM section header** — Settings/Help should be bottom-pinned without a section header | Medium | Tiny |
| **Remove conversation list from sidebar** — screenshots don't show it | Medium | Small |
| **Increase sidebar spacing** — rows need ~48px height, more breathing room | Medium | Small |
| **Make active pill more pronounced** — full light-blue background pill matching screenshots | Low | Tiny |
| **Set default theme to light** — glass aesthetic is designed for light mode | Low | Tiny |
| **Add suggestion cards** (manus-next horizontal scroll style) | Medium | Small |
| **Mobile bottom nav** — manus-next has one, Stewardly doesn't yet | Low | Medium |

---

## What I Failed At

1. **Spent 100+ grep commands on dead code analysis** — should have been a single-pass script
2. **Never touched the main content area** — the most visible part of the UI
3. **Didn't validate visually** until called out
4. **Treated the sidebar as the whole task** when it was only half the job
5. **Didn't compare my output to the screenshots** before delivering

---

## What I Need to Close the Gap (One Pass)

### Decisions Needed From You:
1. **Conversations in sidebar** — Remove entirely? Collapse by default? Keep?
2. **Engine cards** — Remove? Convert to manus-next suggestion cards? Keep restyled?
3. **"Continue where you left off"** — Remove? Keep below suggestions?
4. **Quick action chips** — What text? Financial-focused ("Run a calculation", "Analyze portfolio")?
5. **Mobile bottom nav** — Want one? What items?

### No Decision Needed (I'll Just Do):
- Remove PLATFORM section header
- Increase sidebar spacing to match screenshots
- Make active pill more pronounced
- Set default theme to light
- Clean up the greeting to sans-serif
