# Research: Recently Visited Pages in Command Palette

## Verdict: YES — Implement

## Evidence

### 1. UX Patterns Dev (uxpatterns.dev)
- Lists "Grouped results" as a **required component** that "Separates commands, pages, or **recent items** into understandable buckets"
- Defines a **"Recent-first palette"** variation: "Promotes recent commands and workspaces before long-tail search matches. Use when repeat use and speed matter more than exhaustive discovery."
- The overview explicitly says command palettes help "find and run commands, destinations, and **recent items** from a single keyboard-first surface"

### 2. Superhuman Blog (blog.superhuman.com)
- Recommends **recency scoring**: "First, give a default score to all commands. This is a great opportunity to highlight your product's most important, relevant, and enticing features."
- Superhuman uses frequency and recency to rank commands in the palette

### 3. VS Code
- VS Code's command palette shows "recently used" commands at the top
- Users actively discuss and manage their "recently used" section (StackOverflow questions about clearing it)

### 4. Streak CRM
- "Access recent work" is a key feature of their command palette

### 5. World Monitor (Mintlify)
- "Recent Searches: The palette remembers your recent searches: Max 8 entries - Most recent searches shown first; Stored in localStorage"

## Conclusion
Recently visited/used items in a command palette is **established best practice** across:
- Developer tools (VS Code, GitHub)
- Productivity apps (Superhuman, Linear)
- SaaS products (Streak, Salesloft)
- UX pattern libraries (uxpatterns.dev)

It is specifically called out as a **required component** in the anatomy of a command palette. The "Recent-first palette" is a recognized variation. Implementation should use localStorage for persistence and show max 5-8 items.
