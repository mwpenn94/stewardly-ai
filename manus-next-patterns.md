# Manus-Next AppLayout Patterns (Reference Notes)

## Sidebar Structure
1. **Fixed Header**: Logo + brand name + collapse button (PanelLeftClose)
2. **Top Nav Items** (4 buttons): New task, Agent, Search (Ctrl+K), Library
3. **Scrollable Middle**: Projects tree (collapsible folders with nested tasks) + All Tasks section + Share banner
4. **Bottom Icon Bar**: Settings, Apps/Grid menu, Connectors, Help, Theme toggle + "from ∞ Meta" text

## Key Design Principles
- Sidebar width: 260px desktop, 300px mobile drawer (max 85vw)
- Collapsed state: 48px (w-12) with just icon buttons
- Mobile: overlay drawer with backdrop-blur
- All items use `text-[13px]` for task items, `text-sm` for nav items
- Active state: `bg-sidebar-accent text-sidebar-accent-foreground`
- Hover state: `hover:bg-sidebar-accent/40` or `hover:bg-sidebar-accent/50`
- Section headers: `text-[11px] font-medium text-muted-foreground uppercase tracking-wider`
- Border: `border-sidebar-border`
- Background: `bg-sidebar`

## Home Page (Greeting State)
- Time-based greeting: "Good morning/afternoon/evening, {name}."
- Font: `text-3xl md:text-4xl font-semibold tracking-tight` with `var(--font-heading)`
- Subtitle: "What can I do for you?" in `text-sm text-muted-foreground`
- Pill input: `max-w-[640px]`, rounded-full, bg-card, border, shadow-md
  - Left: [+] button (PlusMenu)
  - Center: textarea with placeholder "Assign a task or ask anything"
  - Right: mic + sparkles (recursive opt) + send (ArrowUp)
- Quick action chips: horizontal scroll, rounded-full border buttons
- Suggestion cards: horizontal scroll, 260px wide, bg-card border rounded-xl

## Bottom Bar (Authenticated)
- `border-t border-sidebar-border`
- Left: Settings, AppsGrid, Connectors, Help, Theme icons
- Right: "from ∞ Meta" text

## For Stewardly Adaptation
- Replace "Projects" tree → "Conversations" tree (already have conversations)
- Replace "All Tasks" → Engine sections (Wealth, People, Learning, Data, Intelligence)
- Top nav: New chat, Engines, Search (Ctrl+K), Knowledge
- Bottom bar: Settings, Apps/Tools grid, Help, Theme toggle
- Brand: "Stewardly" instead of "Manus Next"
