# Full Audit & Gap Analysis: Stewardly UI/UX Overhaul

## Executive Summary

The task is to **completely port manus-next's UI/UX/task architecture** as the foundation, then build Stewardly's content (engines, financial tools) within it using glass-styled components and progressive disclosure.

---

## What Was Actually Completed (Sidebar Only — Partial)

| Item | Status | Quality |
|------|--------|---------|
| ConsentBanner removed from App.tsx | Done | Clean |
| Dead code removed from Chat.tsx (unused imports, state, constants) | Done | Clean |
| Sidebar CSS variables updated for glass aesthetic (light + dark) | Done | Correct |
| Sidebar header (Stewardly brand + collapse + new chat buttons) | Done | Matches screenshots |
| ⌘K search bar in sidebar | Done | Matches screenshots |
| Uppercase section headers (WEALTH, PROFESSIONAL, LEADERSHIP) | Done | Matches screenshots |
| Blue active pill states on nav items | Done | Matches screenshots |
| Theme toggle (light/dark/system) in bottom bar | Done | Working |
| Settings/Help in bottom section | Done | Present |

## What Was NOT Done (The Actual Work)

### 1. Main Content Area — UNTOUCHED
- `ChatGreetingV2` still renders the OLD engine cards, italic serif greeting, "Continue where you left off"
- Should be: manus-next clean greeting ("Good evening, [Name]") + pill input + horizontal suggestion cards
- The input area still has the old multi-row action bar with voice/attachment/focus buttons

### 2. Manus-Next Task Architecture — NOT PORTED
- No TaskContext (task creation, task list, active task tracking)
- No task status indicators (running/completed/error/queued)
- No task view page (step-by-step execution display)
- No project folders with nested tasks
- No task favorites/pinning

### 3. Manus-Next AppLayout — NOT PORTED
- Should be: fixed sidebar + main content area + mobile bottom nav
- Currently: Chat.tsx is a 2878-line monolith handling everything
- No proper AppLayout wrapper component
- No MobileBottomNav (Home, Tasks, Billing, More)

### 4. Engine Architecture (Progressive Disclosure via 4-Square Grid) — NOT DONE
- The 4-square (LayoutGrid) button should open a drawer/dropdown with the 4 engines:
  - **Missional Engine** → contains Wealth (calculators, portfolio, tax)
  - **Relational Engine** → contains People (CRM, clients, outreach)
  - **Formational Engine** → contains Learning (courses, exams, study)
  - **Contextual Engine** → contains Data (intelligence, pipelines, analytics)
- Currently: engines are flat nav items in the sidebar (old Stewardly pattern)

### 5. Task Status Filter — NOT UPDATED
- Should be: icon-based filter (filter icon click) — no horizontal bar
- Currently: old conversation list with time-based grouping

### 6. "From Meta" — NOT REMOVED
- Should be omitted entirely

### 7. Admin Items — NOT NESTED
- Should be nested within Settings or appropriate engine
- Currently: flat "PLATFORM" section in sidebar (admin-only)

---

## What I Need to Execute This Properly

### Architecture Decisions (Already Answered by User)
1. ✅ Port manus-next entirely as foundation
2. ✅ 4 engines nested in grid menu drawer (Missional/Relational/Formational/Contextual)
3. ✅ Task status filter = icon-based, no bar
4. ✅ "From Meta" = omitted
5. ✅ Universal search in nav = kept
6. ✅ Admin nested within Settings/engines
7. ✅ Glass components as surface layer

### Technical Approach Required

**Phase 1: Create proper AppLayout (port from manus-next)**
- New `client/src/components/AppLayout.tsx` — the outer shell
- Fixed sidebar (collapsible) + main content area
- Mobile drawer + MobileBottomNav
- Bottom icon bar: Settings gear, 4-square grid (engines), Theme toggle, Help

**Phase 2: Create TaskContext (port from manus-next)**
- Task creation, listing, status tracking
- Replace "conversations" concept with "tasks"
- Task view page for execution display

**Phase 3: Rebuild Home page (port from manus-next)**
- Clean greeting: "Good evening, [Name]"
- Pill input: [+] [textarea] [mic] [send]
- Horizontal scroll suggestion cards (Stewardly-themed)
- Quick action chips

**Phase 4: Engine Grid Drawer**
- 4-square button opens dropdown/drawer
- 4 engines with their nested items
- Progressive disclosure within each engine

**Phase 5: Migrate Chat.tsx → TaskView**
- Port manus-next TaskView patterns
- Step-by-step execution display
- Streaming message rendering
- Keep voice/attachment capabilities

**Phase 6: Clean up routing**
- Remove redundant routes (redirects to dead pages)
- Map Stewardly routes into engine structure
- Settings page absorbs admin items

---

## File-Level Changes Required

| File | Action |
|------|--------|
| `client/src/components/AppLayout.tsx` | CREATE — port from manus-next |
| `client/src/components/MobileBottomNav.tsx` | CREATE — port from manus-next |
| `client/src/components/EngineGridMenu.tsx` | CREATE — 4 engines in grid dropdown |
| `client/src/contexts/TaskContext.tsx` | CREATE — port from manus-next |
| `client/src/pages/Home.tsx` | REWRITE — manus-next greeting + input |
| `client/src/pages/TaskView.tsx` | CREATE — port from manus-next |
| `client/src/App.tsx` | REWRITE — new routing with AppLayout wrapper |
| `client/src/pages/Chat.tsx` | DEPRECATE — functionality moves to TaskView |
| `client/src/components/PersonaSidebar5.tsx` | DEPRECATE — replaced by AppLayout sidebar |
| `client/src/components/ChatGreeting.tsx` | DEPRECATE — replaced by Home.tsx greeting |
| `client/src/index.css` | UPDATE — glass tokens already done, may need motion vars |

---

## Mapping: Manus-Next → Stewardly

| Manus-Next | Stewardly Equivalent |
|------------|---------------------|
| New task | New task (same) |
| Agent | Stewardly AI |
| Search (Ctrl+K) | Universal Search (same) |
| Library | Knowledge Base / Learning |
| Projects | Projects (same concept) |
| Tasks list | Tasks list (replaces conversations) |
| Billing | Billing (same) |
| Settings | Settings + Admin items nested |
| Help | Help (same) |
| Connectors | Integrations |
| Memory | Context/Memory |
| Skills | Skills/Capabilities |
| AppsGridMenu | **Engine Grid Menu** (4 engines) |

---

## Risk Assessment

- **Chat.tsx is 2878 lines** — cannot be incrementally patched, needs architectural replacement
- **Many lazy-loaded pages** reference old patterns — need route migration
- **PersonaSidebar5** is used in AppShell for non-chat pages — need to replace AppShell too
- **Server-side routes** (tRPC procedures) remain unchanged — only frontend restructuring

---

## Conclusion

The work done so far is ~10% of the total overhaul. The sidebar CSS/structure is correct but the entire application architecture needs to be rebuilt around manus-next's patterns. This is not a "fix the sidebar" task — it's a full frontend rewrite using manus-next as the source of truth.
