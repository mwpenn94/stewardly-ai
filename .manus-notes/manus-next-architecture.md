# Manus-Next Architecture Key Patterns

## Layout Structure
- `AppLayout` wraps everything: `h-screen flex overflow-hidden bg-background`
- Left sidebar: `hidden md:flex flex-col border-r border-sidebar-border bg-sidebar w-[260px]`
- Mobile drawer: `fixed inset-y-0 left-0 z-50 w-[300px] max-w-[85vw] bg-sidebar`
- Main content: `flex-1 flex flex-col min-w-0 min-h-0`
- Mobile bottom nav: separate component outside main

## Sidebar Structure (4 sections)
1. Fixed header: Logo + collapse button (h-14, border-b)
2. Top nav: New task, Agent, Search (Ctrl+K), Library (px-2 pt-2 pb-1)
3. Scrollable middle: Projects tree + All tasks + Share banner (flex-1 overflow-y-auto with mask-image fade)
4. Bottom icon bar: Settings, Apps grid, Connectors, Help, Theme toggle + "from ∞ Meta" (border-t, shrink-0)

## Home/Greeting Page
- Centered layout: `flex flex-col items-center justify-start md:justify-center min-h-[calc(100%-60px)]`
- Greeting: `text-3xl md:text-4xl font-semibold tracking-tight` with `font-heading` (serif)
- Subtitle: `text-sm text-muted-foreground`
- Input: pill-shaped, `max-w-[640px]`, `bg-card border border-border shadow-md shadow-black/20`
  - Focus: `focus-within:border-primary/40 focus-within:ring-3 focus-within:ring-primary/10`
  - Rounded: `rounded-full` (or `rounded-2xl` with files)
  - Left: + button (PlusMenu)
  - Right: mic + sparkles (recursive opt) + send (ArrowUp)
  - Placeholder: "Assign a task or ask anything"
- Quick action chips: horizontal scroll, `rounded-full border border-border bg-transparent text-xs`
- Suggestion cards: horizontal scroll, `bg-card border border-border rounded-xl w-[260px] min-h-[80px]`
  - Icon in `w-8 h-8 rounded-lg bg-muted` box
  - Title: `text-sm font-medium`
  - Description: `text-xs text-muted-foreground`

## Key CSS Patterns
- No gradients, no glows, no gold
- Cards: bg-card with border-border, no heavy shadows
- Hover: bg-accent (which is #222222 dark / #f5f5f5 light)
- Active sidebar item: bg-sidebar-accent text-sidebar-accent-foreground
- Buttons: rounded-md p-2 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent
- Animations: framer-motion with y:16→0, duration 0.35, ease [0.25,0.46,0.45,0.94]
- No card-lift, no translateY on hover
- Thinking: shimmer gradient on text (neutral greys cycling)
- Progress: fixed top 2px blue bar

## Typography
- --font-sans: system stack (-apple-system, etc.)
- --font-heading: "Instrument Serif", "Libre Baskerville", Georgia, serif
- Body: 14px, line-height 22px, letter-spacing -0.154px
- Headings: letter-spacing -0.3px

## Mobile
- Bottom nav (MobileBottomNav component)
- Safe area padding: `env(safe-area-inset-bottom)`
- Touch targets: 44px min on [data-chat-input] buttons
- Hamburger menu dispatches 'open-mobile-drawer' custom event
