/**
 * Accessibility helpers — pure utilities the financial-profile
 * components (and every other calculator) use to meet WCAG 2.1
 * AA targets without repeating the same glue code.
 *
 * Scope (pass 16):
 *
 *   - focusFirstInteractive(container) — focus the first
 *     tabbable element inside a container, used by modals
 *     after they mount.
 *   - getTabbableElements(container) — the list of tabbable
 *     elements inside a container. Pure; used by the focus
 *     trap + focus-first utilities.
 *   - nextTabbable / prevTabbable — step through a tabbable
 *     list with wrap-around.
 *   - isTouchTargetLarge(rect) — returns true iff the
 *     supplied DOMRect meets the 44×44 px WCAG 2.5.5 minimum.
 *   - announcePolite(message) / announceAssertive(message) —
 *     shove text into a visually-hidden aria-live region so
 *     screen readers narrate events (e.g., "Strategy
 *     comparison complete. WealthBridge Plan wins.").
 *   - relativeLuminance + contrastRatio — color-contrast
 *     math for the Stewardship Gold palette when a hardcoded
 *     tone needs verification.
 *
 * Every helper is pure or scoped to a single DOM mount so
 * they can be exercised in vitest without spinning a jsdom
 * environment for every caller.
 *
 * Pass 16 history: ships gap G20 (new — accessibility helpers).
 */

// ─── Tabbable element detection ─────────────────────────────────

const TABBABLE_SELECTORS = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(",");

/** Returns every element inside `root` that the browser will tab-focus. */
export function getTabbableElements(root: Element | null | undefined): HTMLElement[] {
  if (!root) return [];
  const nodes = Array.from(root.querySelectorAll<HTMLElement>(TABBABLE_SELECTORS));
  return nodes.filter((el) => {
    // exclude aria-hidden subtrees + invisible elements
    if (el.getAttribute("aria-hidden") === "true") return false;
    if (el.hasAttribute("inert")) return false;
    return true;
  });
}

/** Focus the first tabbable element inside `root`. Returns true on success. */
export function focusFirstInteractive(root: Element | null | undefined): boolean {
  const els = getTabbableElements(root);
  const first = els[0];
  if (!first) return false;
  try {
    first.focus();
    return document.activeElement === first;
  } catch {
    return false;
  }
}

/** Return the next tabbable element, wrapping to the start when at the end. */
export function nextTabbable(
  current: HTMLElement,
  tabbables: HTMLElement[],
): HTMLElement | null {
  if (tabbables.length === 0) return null;
  const idx = tabbables.indexOf(current);
  if (idx === -1) return tabbables[0];
  return tabbables[(idx + 1) % tabbables.length];
}

/** Return the previous tabbable element, wrapping to the end when at the start. */
export function prevTabbable(
  current: HTMLElement,
  tabbables: HTMLElement[],
): HTMLElement | null {
  if (tabbables.length === 0) return null;
  const idx = tabbables.indexOf(current);
  if (idx === -1) return tabbables[tabbables.length - 1];
  return tabbables[(idx - 1 + tabbables.length) % tabbables.length];
}

// ─── Touch target sizing (WCAG 2.5.5) ────────────────────────────

/** Minimum square side length per WCAG 2.5.5 Level AAA (matches ADA). */
export const MIN_TOUCH_TARGET_PX = 44;

/**
 * Returns true when a rect meets the 44×44 px minimum. Accepts any
 * `{width, height}` shape — no need to pass a full DOMRect.
 */
export function isTouchTargetLarge(rect: { width: number; height: number }): boolean {
  return rect.width >= MIN_TOUCH_TARGET_PX && rect.height >= MIN_TOUCH_TARGET_PX;
}

// ─── Screen reader announcements ────────────────────────────────

const ANNOUNCE_REGION_ID = "stewardly-a11y-announcer";

function ensureAnnounceRegion(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  let region = document.getElementById(ANNOUNCE_REGION_ID);
  if (region) return region;
  region = document.createElement("div");
  region.id = ANNOUNCE_REGION_ID;
  region.setAttribute("aria-live", "polite");
  region.setAttribute("aria-atomic", "true");
  region.style.position = "absolute";
  region.style.width = "1px";
  region.style.height = "1px";
  region.style.margin = "-1px";
  region.style.border = "0";
  region.style.padding = "0";
  region.style.overflow = "hidden";
  region.style.clip = "rect(0,0,0,0)";
  region.style.whiteSpace = "nowrap";
  document.body.appendChild(region);
  return region;
}

/** Announce a message to assistive tech via the polite live region. */
export function announcePolite(message: string): void {
  const region = ensureAnnounceRegion();
  if (!region) return;
  region.setAttribute("aria-live", "polite");
  region.textContent = "";
  // Force a microtask delay so SR picks up the change
  setTimeout(() => {
    if (region) region.textContent = message;
  }, 50);
}

/** Announce a message more urgently via aria-live=assertive. */
export function announceAssertive(message: string): void {
  const region = ensureAnnounceRegion();
  if (!region) return;
  region.setAttribute("aria-live", "assertive");
  region.textContent = "";
  setTimeout(() => {
    if (region) region.textContent = message;
  }, 50);
}

// ─── Color contrast math (WCAG 1.4.3) ────────────────────────────

/**
 * sRGB channel → relative luminance per WCAG 2.1 §1.4.3.
 * Input channel is 0..1 (i.e., `r / 255`).
 */
function channelLuminance(channel: number): number {
  if (channel <= 0.03928) return channel / 12.92;
  return Math.pow((channel + 0.055) / 1.055, 2.4);
}

/**
 * Relative luminance of an (r, g, b) triple in 0..255.
 * Returns a 0..1 number; 0 is black, 1 is white.
 */
export function relativeLuminance(r: number, g: number, b: number): number {
  const [rl, gl, bl] = [r, g, b].map((c) => {
    const clamped = Math.max(0, Math.min(255, c));
    return channelLuminance(clamped / 255);
  });
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

/**
 * Contrast ratio between two colors (0..255 triples). Returns a
 * number in [1, 21]. WCAG AA text needs ≥4.5; AA large text and
 * UI components need ≥3.
 */
export function contrastRatio(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
): number {
  const la = relativeLuminance(a.r, a.g, a.b);
  const lb = relativeLuminance(b.r, b.g, b.b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Parse a #RRGGBB hex color into an {r, g, b} triple. Returns null on bad input. */
export function parseHexColor(
  hex: string,
): { r: number; g: number; b: number } | null {
  if (!hex || typeof hex !== "string") return null;
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let body = m[1];
  if (body.length === 3) {
    body = body
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const n = parseInt(body, 16);
  return {
    r: (n >> 16) & 0xff,
    g: (n >> 8) & 0xff,
    b: n & 0xff,
  };
}

/** WCAG AA threshold for normal body text. */
export const WCAG_AA_TEXT = 4.5;
/** WCAG AA threshold for large text (18pt / 14pt bold) + UI components. */
export const WCAG_AA_LARGE = 3;

/** Convenience: true iff a fg/bg pair meets AA for normal text. */
export function meetsAATextContrast(fgHex: string, bgHex: string): boolean {
  const fg = parseHexColor(fgHex);
  const bg = parseHexColor(bgHex);
  if (!fg || !bg) return false;
  return contrastRatio(fg, bg) >= WCAG_AA_TEXT;
}
