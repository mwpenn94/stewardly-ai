/**
 * ANSI escape sequence parser — Pass 250.
 *
 * Parses text containing ANSI SGR (Select Graphic Rendition) escape
 * sequences into a list of styled segments that can be rendered as
 * React <span> elements. This is what makes `run_bash` output look
 * like a real terminal: green success messages, red errors, bold
 * headings, dim hints, ANSI-colored diff output, pytest/vitest
 * status stamps, etc.
 *
 * Supported SGR codes:
 *   - 0: reset
 *   - 1: bold, 2: dim, 3: italic, 4: underline
 *   - 7: inverse
 *   - 22: not bold, 23: not italic, 24: not underline, 27: not inverse
 *   - 30-37: standard foreground colors (black..white)
 *   - 90-97: bright foreground colors
 *   - 40-47: standard background colors
 *   - 100-107: bright background colors
 *   - 38;5;N: 256-color foreground (palette index 0-255)
 *   - 48;5;N: 256-color background
 *   - 38;2;R;G;B: 24-bit truecolor foreground
 *   - 48;2;R;G;B: 24-bit truecolor background
 *   - 39: default foreground
 *   - 49: default background
 *
 * Unsupported sequences (cursor movement, screen clear, etc.) are
 * silently stripped so the output stays clean.
 *
 * Pure, no DOM. Integration lives in AnsiOutput.tsx which renders
 * parsed segments into React elements.
 */

export type AnsiColor =
  | { kind: "standard"; index: number } // 0-15 (0-7 standard, 8-15 bright)
  | { kind: "palette"; index: number } // 0-255 256-color
  | { kind: "truecolor"; r: number; g: number; b: number };

export interface AnsiStyle {
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  inverse?: boolean;
  fg?: AnsiColor;
  bg?: AnsiColor;
}

export interface AnsiSegment {
  text: string;
  style: AnsiStyle;
}

/** Canonical 16-color ANSI palette (foreground, as #rrggbb). */
export const STANDARD_COLORS_16: Readonly<string[]> = [
  "#000000", // black
  "#cd3131", // red
  "#0dbc79", // green
  "#e5e510", // yellow
  "#2472c8", // blue
  "#bc3fbc", // magenta
  "#11a8cd", // cyan
  "#e5e5e5", // white
  // bright variants
  "#666666",
  "#f14c4c",
  "#23d18b",
  "#f5f543",
  "#3b8eea",
  "#d670d6",
  "#29b8db",
  "#ffffff",
];

/**
 * Expand a 256-color palette index to a hex color.
 *   0-15   : standard (same as STANDARD_COLORS_16)
 *   16-231 : 6x6x6 color cube
 *   232-255: 24-step grayscale
 */
export function paletteToHex(index: number): string {
  if (index < 0 || index > 255) return "#ffffff";
  if (index < 16) return STANDARD_COLORS_16[index];
  if (index < 232) {
    const n = index - 16;
    const r = Math.floor(n / 36);
    const g = Math.floor((n % 36) / 6);
    const b = n % 6;
    const toHex = (v: number) => (v === 0 ? 0 : 55 + v * 40);
    return rgbToHex(toHex(r), toHex(g), toHex(b));
  }
  const gray = 8 + (index - 232) * 10;
  return rgbToHex(gray, gray, gray);
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Resolve an AnsiColor into a CSS color string. */
export function colorToCss(color: AnsiColor | undefined): string | undefined {
  if (!color) return undefined;
  if (color.kind === "standard") return STANDARD_COLORS_16[color.index] ?? undefined;
  if (color.kind === "palette") return paletteToHex(color.index);
  if (color.kind === "truecolor") return rgbToHex(color.r, color.g, color.b);
  return undefined;
}

/** Regex matching any CSI sequence (ANSI escape starting with ESC + [). */
// eslint-disable-next-line no-control-regex
const CSI_REGEX = /\x1b\[([0-9;]*)([A-Za-z])/g;

/**
 * Apply a single SGR parameter list to a style object. Mutates `style`
 * in place. Returns the input style so callers can chain.
 *
 * Handles multi-parameter sequences like `38;5;N` or `38;2;R;G;B` by
 * consuming extra parameters from the array as a cursor.
 */
export function applySgrParams(style: AnsiStyle, params: number[]): AnsiStyle {
  let i = 0;
  while (i < params.length) {
    const p = params[i];
    if (p === 0) {
      // Reset
      style.bold = false;
      style.dim = false;
      style.italic = false;
      style.underline = false;
      style.inverse = false;
      style.fg = undefined;
      style.bg = undefined;
    } else if (p === 1) style.bold = true;
    else if (p === 2) style.dim = true;
    else if (p === 3) style.italic = true;
    else if (p === 4) style.underline = true;
    else if (p === 7) style.inverse = true;
    else if (p === 22) {
      style.bold = false;
      style.dim = false;
    } else if (p === 23) style.italic = false;
    else if (p === 24) style.underline = false;
    else if (p === 27) style.inverse = false;
    else if (p >= 30 && p <= 37) style.fg = { kind: "standard", index: p - 30 };
    else if (p === 38) {
      // 38;5;N  or  38;2;R;G;B
      const mode = params[i + 1];
      if (mode === 5 && params.length > i + 2) {
        style.fg = { kind: "palette", index: params[i + 2] };
        i += 2;
      } else if (mode === 2 && params.length > i + 4) {
        style.fg = { kind: "truecolor", r: params[i + 2], g: params[i + 3], b: params[i + 4] };
        i += 4;
      }
    } else if (p === 39) {
      style.fg = undefined;
    } else if (p >= 40 && p <= 47) {
      style.bg = { kind: "standard", index: p - 40 };
    } else if (p === 48) {
      const mode = params[i + 1];
      if (mode === 5 && params.length > i + 2) {
        style.bg = { kind: "palette", index: params[i + 2] };
        i += 2;
      } else if (mode === 2 && params.length > i + 4) {
        style.bg = { kind: "truecolor", r: params[i + 2], g: params[i + 3], b: params[i + 4] };
        i += 4;
      }
    } else if (p === 49) {
      style.bg = undefined;
    } else if (p >= 90 && p <= 97) {
      style.fg = { kind: "standard", index: p - 90 + 8 };
    } else if (p >= 100 && p <= 107) {
      style.bg = { kind: "standard", index: p - 100 + 8 };
    }
    // All other SGR codes silently ignored.
    i++;
  }
  return style;
}

/**
 * Parse a raw string into styled segments. Empty text contributes no
 * segment. Zero-length style changes emit no segment either — they
 * just update the active style for subsequent text.
 */
export function parseAnsi(input: string): AnsiSegment[] {
  if (!input) return [];
  const segments: AnsiSegment[] = [];
  let activeStyle: AnsiStyle = {};
  let lastIndex = 0;

  // Reset regex state
  CSI_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CSI_REGEX.exec(input)) !== null) {
    // Text between lastIndex and match.index keeps the current style
    if (match.index > lastIndex) {
      const text = input.slice(lastIndex, match.index);
      if (text.length > 0) {
        segments.push({ text, style: cloneStyle(activeStyle) });
      }
    }
    // Apply the SGR parameters if this is an `m` terminator. Other
    // CSI sequences (e.g. cursor movement) are simply consumed.
    const terminator = match[2];
    if (terminator === "m") {
      const rawParams = match[1];
      const parts = rawParams.length > 0 ? rawParams.split(";") : ["0"];
      const nums = parts.map((p) => {
        const n = Number(p);
        return Number.isFinite(n) ? n : 0;
      });
      // An empty `\x1b[m` is equivalent to `\x1b[0m`
      applySgrParams(activeStyle, nums.length === 0 ? [0] : nums);
    }
    lastIndex = match.index + match[0].length;
  }

  // Trailing text with the current style
  if (lastIndex < input.length) {
    const text = input.slice(lastIndex);
    if (text.length > 0) {
      segments.push({ text, style: cloneStyle(activeStyle) });
    }
  }

  return segments;
}

function cloneStyle(s: AnsiStyle): AnsiStyle {
  return {
    bold: s.bold,
    dim: s.dim,
    italic: s.italic,
    underline: s.underline,
    inverse: s.inverse,
    fg: s.fg ? { ...s.fg } as AnsiColor : undefined,
    bg: s.bg ? { ...s.bg } as AnsiColor : undefined,
  };
}

/**
 * Strip every ANSI escape from a string. Useful for computing text
 * length, searching, or exporting raw text without color.
 */
export function stripAnsi(input: string): string {
  if (!input) return "";
  return input.replace(CSI_REGEX, "");
}

/**
 * Convert an AnsiStyle into a CSS property bag suitable for React
 * inline styles. Handles the `inverse` flag by swapping fg/bg.
 */
export function styleToCss(style: AnsiStyle): Record<string, string> {
  const out: Record<string, string> = {};
  let fg = colorToCss(style.fg);
  let bg = colorToCss(style.bg);
  if (style.inverse) {
    const tmp = fg;
    fg = bg ?? "#e5e5e5";
    bg = tmp ?? "#000000";
  }
  if (fg) out.color = fg;
  if (bg) out.backgroundColor = bg;
  if (style.bold) out.fontWeight = "bold";
  if (style.dim) out.opacity = "0.65";
  if (style.italic) out.fontStyle = "italic";
  if (style.underline) out.textDecoration = "underline";
  return out;
}

/**
 * Detect whether a string contains any ANSI escape sequence. Used by
 * the trace view to decide whether to render a plain <pre> or the
 * full AnsiOutput component.
 */
export function hasAnsi(input: string): boolean {
  if (!input) return false;
  CSI_REGEX.lastIndex = 0;
  return CSI_REGEX.test(input);
}
