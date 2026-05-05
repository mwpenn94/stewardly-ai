# Input Area Structure

## Current Layout (lines 2692-3376)
- Container: `p-3 sm:p-4 shrink-0 border-t border-border bg-background`
- Inner: `max-w-3xl mx-auto`
- Voice support banner (conditional)
- Caption strip (conditional during streaming/TTS)
- Attachment chips (conditional)
- Hidden file inputs
- **Textarea wrapper**: `bg-card border border-border rounded-full shadow-md shadow-black/20 focus-within:border-primary/40 focus-within:ring-3 focus-within:ring-primary/10 transition-all px-4 py-2`
- **Action bar below**: `flex items-center gap-1 mt-1.5`
  - [+] Add context button
  - Mode dropdown (Focus/Advisory/Processing)
  - Advanced toggle (More/Less)
  - Advanced controls (model picker, processing mode, loop config)
  - flex-1 spacer
  - Mic button
  - Audio mute (conditional)
  - Send/hands-free button (rightmost)

## What manus-next-app does differently:
- Input is inside the pill (textarea + send button together in one rounded container)
- No separate action bar below — controls are minimal and inside the pill
- Send button is INSIDE the pill on the right side
- Much simpler — just the input + send, with a small attachment button

## Plan:
The current structure is functional and has many features (voice, modes, models, etc.)
The key visual change needed: move the send button INSIDE the pill, and make the action bar less visually heavy.
The pill should contain: textarea + send button. The action bar should be more subtle.
