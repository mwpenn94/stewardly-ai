# Key Differences: Manus CSS vs Stewardly CSS

## Color Palette (Dark Mode)
| Token | Manus | Stewardly |
|-------|-------|-----------|
| background | oklch(0.2178 0 0) #1a1a1a pure neutral | oklch(0.135 0.018 260) navy with blue hue |
| foreground | oklch(0.8884 0 0) #dadada neutral grey | oklch(0.95 0.008 75) warm cream |
| card | oklch(0.2264 0 0) #1c1c1c | oklch(0.175 0.02 258) navy |
| popover | oklch(0.2603 0 0) #242424 | oklch(0.18 0.024 255) navy |
| primary | oklch(0.6565 0.1863 251.8) #1a93fe BLUE | oklch(0.76 0.14 80) GOLD |
| secondary | oklch(0.2393 0 0) #1f1f1f | oklch(0.22 0.024 255) navy |
| muted-fg | oklch(0.7984 0 0) #bdbdbd | oklch(0.68 0.014 80) warm |
| accent | oklch(0.2520 0 0) #222222 hover surface | oklch(0.76 0.14 80) GOLD (same as primary!) |
| border | oklch(0.2768 0 0) #282828 | oklch(0.26 0.02 265) navy |
| sidebar | oklch(0.2393 0 0) #1f1f1f | oklch(0.11 0.016 262) very dark navy |

## Key Design Differences
1. Manus: accent = hover surface color (subtle bg change). Stewardly: accent = gold (same as primary)
2. Manus: ALL neutrals are pure grey (chroma 0). Stewardly: everything has blue/gold hue
3. Manus: focus-visible = simple 2px outline. Stewardly: 3-layer box-shadow with glow
4. Manus: scrollbar-thumb on hover = slightly lighter grey. Stewardly: gold on hover
5. Manus: card-hover = just background-color change. Stewardly: translateY lift + gold shadow
6. Manus: selection = blue tint. Stewardly: gold tint
7. Manus: no glass-surface, no depth-*, no sovereign-active, no tier-glow, no pulse-glow
8. Manus: 667 lines total. Stewardly: 1106 lines (40% bloat from unused utilities)

## What to Keep from Stewardly
- Font scale system (accessibility)
- Reduced motion support
- Color-blind mode
- RTL support
- Chat density scale
- Prose-chat (but update colors)
- Print styles

## What to REMOVE from Stewardly
- glass-surface, glass-surface-elevated (unused)
- depth-base, depth-raised, depth-floating, depth-overlay (unused)
- sovereign-active, animate-tier-glow (over-decorated)
- animate-pulse-glow (gold glow)
- card-lift (manus doesn't lift cards)
- The elaborate focus-visible with 3 box-shadows + glow
- Gold scrollbar-thumb:hover
- avatar-talking animation (too flashy)
- workspace-slide-in, action-pulse, disclosure-reveal (unused)

## The Transformation
Replace ALL oklch values with hue 0 (pure neutral grey) except primary/ring which become blue.
Accent becomes a hover surface color, NOT the brand color.
