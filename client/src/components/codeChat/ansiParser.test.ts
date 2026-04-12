/**
 * Tests for the ANSI parser — Pass 250.
 */

import { describe, it, expect } from "vitest";
import {
  parseAnsi,
  stripAnsi,
  hasAnsi,
  applySgrParams,
  paletteToHex,
  colorToCss,
  styleToCss,
  type AnsiStyle,
} from "./ansiParser";

const ESC = "\x1b[";

describe("stripAnsi", () => {
  it("returns empty for empty input", () => {
    expect(stripAnsi("")).toBe("");
  });

  it("strips a basic color code", () => {
    expect(stripAnsi(`${ESC}31mred${ESC}0m`)).toBe("red");
  });

  it("leaves plain text untouched", () => {
    expect(stripAnsi("hello world")).toBe("hello world");
  });

  it("strips compound codes", () => {
    expect(stripAnsi(`${ESC}1;31;42mhi${ESC}0m`)).toBe("hi");
  });

  it("strips cursor movement sequences", () => {
    expect(stripAnsi(`${ESC}2K${ESC}G`)).toBe("");
  });
});

describe("hasAnsi", () => {
  it("returns false for empty input", () => {
    expect(hasAnsi("")).toBe(false);
  });

  it("returns false for plain text", () => {
    expect(hasAnsi("no escapes")).toBe(false);
  });

  it("returns true for an SGR sequence", () => {
    expect(hasAnsi(`${ESC}31mred${ESC}0m`)).toBe(true);
  });
});

describe("parseAnsi", () => {
  it("returns empty array for empty input", () => {
    expect(parseAnsi("")).toEqual([]);
  });

  it("returns a single unstyled segment for plain text", () => {
    const out = parseAnsi("hello");
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("hello");
    expect(out[0].style).toEqual({
      bold: undefined,
      dim: undefined,
      italic: undefined,
      underline: undefined,
      inverse: undefined,
      fg: undefined,
      bg: undefined,
    });
  });

  it("parses a basic red-colored segment", () => {
    const out = parseAnsi(`${ESC}31mred${ESC}0m`);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("red");
    expect(out[0].style.fg).toEqual({ kind: "standard", index: 1 });
  });

  it("parses bold + color combo", () => {
    const out = parseAnsi(`${ESC}1;32mok${ESC}0m`);
    expect(out[0].style.bold).toBe(true);
    expect(out[0].style.fg).toEqual({ kind: "standard", index: 2 });
  });

  it("resets style after 0m", () => {
    const out = parseAnsi(`${ESC}31mred${ESC}0mplain`);
    expect(out).toHaveLength(2);
    expect(out[0].style.fg).toEqual({ kind: "standard", index: 1 });
    expect(out[1].text).toBe("plain");
    expect(out[1].style.fg).toBeUndefined();
  });

  it("handles bright foreground colors 90-97", () => {
    const out = parseAnsi(`${ESC}91mbright red${ESC}0m`);
    expect(out[0].style.fg).toEqual({ kind: "standard", index: 9 });
  });

  it("parses 256-color palette foreground", () => {
    const out = parseAnsi(`${ESC}38;5;123mpurple${ESC}0m`);
    expect(out[0].style.fg).toEqual({ kind: "palette", index: 123 });
  });

  it("parses truecolor foreground", () => {
    const out = parseAnsi(`${ESC}38;2;255;100;50morange${ESC}0m`);
    expect(out[0].style.fg).toEqual({ kind: "truecolor", r: 255, g: 100, b: 50 });
  });

  it("parses background colors", () => {
    const out = parseAnsi(`${ESC}42mon green${ESC}0m`);
    expect(out[0].style.bg).toEqual({ kind: "standard", index: 2 });
  });

  it("handles 39 (default fg) and 49 (default bg)", () => {
    const out = parseAnsi(`${ESC}31;42mcolored${ESC}39;49mreset`);
    expect(out[0].style.fg).toEqual({ kind: "standard", index: 1 });
    expect(out[0].style.bg).toEqual({ kind: "standard", index: 2 });
    expect(out[1].style.fg).toBeUndefined();
    expect(out[1].style.bg).toBeUndefined();
  });

  it("splits into multiple segments at style boundaries", () => {
    const out = parseAnsi(`${ESC}31mred${ESC}32mgreen${ESC}0m`);
    expect(out).toHaveLength(2);
    expect(out[0].text).toBe("red");
    expect(out[1].text).toBe("green");
  });

  it("persists style across multiple text chunks", () => {
    const out = parseAnsi(`plain${ESC}1mbold${ESC}22mnormal`);
    expect(out).toHaveLength(3);
    expect(out[0].style.bold).toBeFalsy();
    expect(out[1].style.bold).toBe(true);
    expect(out[2].style.bold).toBe(false);
  });

  it("strips non-SGR CSI sequences silently", () => {
    const out = parseAnsi(`${ESC}2K${ESC}31mred${ESC}0m`);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("red");
  });

  it("empty CSI 'm' resets style", () => {
    const out = parseAnsi(`${ESC}31mred${ESC}mplain`);
    expect(out).toHaveLength(2);
    expect(out[1].style.fg).toBeUndefined();
  });

  it("handles newlines across styled segments", () => {
    const out = parseAnsi(`${ESC}31mline1\nline2${ESC}0m`);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("line1\nline2");
  });

  it("multi-digit params with lots of attributes", () => {
    const out = parseAnsi(`${ESC}1;2;4;38;5;10;48;2;100;100;100mtext${ESC}0m`);
    const s = out[0].style;
    expect(s.bold).toBe(true);
    expect(s.dim).toBe(true);
    expect(s.underline).toBe(true);
    expect(s.fg).toEqual({ kind: "palette", index: 10 });
    expect(s.bg).toEqual({ kind: "truecolor", r: 100, g: 100, b: 100 });
  });
});

describe("applySgrParams", () => {
  it("mutates and returns the passed style", () => {
    const style: AnsiStyle = {};
    const out = applySgrParams(style, [1, 31]);
    expect(out).toBe(style);
    expect(style.bold).toBe(true);
    expect(style.fg).toEqual({ kind: "standard", index: 1 });
  });

  it("reset clears all attributes", () => {
    const style: AnsiStyle = {
      bold: true,
      italic: true,
      fg: { kind: "standard", index: 5 },
    };
    applySgrParams(style, [0]);
    expect(style.bold).toBe(false);
    expect(style.italic).toBe(false);
    expect(style.fg).toBeUndefined();
  });

  it("22 clears bold but not italic", () => {
    const style: AnsiStyle = { bold: true, italic: true };
    applySgrParams(style, [22]);
    expect(style.bold).toBe(false);
    expect(style.italic).toBe(true);
  });

  it("silently ignores unknown codes", () => {
    const style: AnsiStyle = {};
    applySgrParams(style, [999, 31]);
    expect(style.fg).toEqual({ kind: "standard", index: 1 });
  });
});

describe("paletteToHex", () => {
  it("maps 0 to black", () => {
    expect(paletteToHex(0)).toBe("#000000");
  });

  it("maps 255 to white gray ramp", () => {
    expect(paletteToHex(255)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("produces a valid hex string", () => {
    for (let i = 16; i < 232; i++) {
      expect(paletteToHex(i)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("out-of-range indices return white fallback", () => {
    expect(paletteToHex(-1)).toBe("#ffffff");
    expect(paletteToHex(999)).toBe("#ffffff");
  });
});

describe("colorToCss", () => {
  it("standard", () => {
    expect(colorToCss({ kind: "standard", index: 1 })).toBe("#cd3131");
  });
  it("palette", () => {
    expect(colorToCss({ kind: "palette", index: 0 })).toBe("#000000");
  });
  it("truecolor", () => {
    expect(colorToCss({ kind: "truecolor", r: 255, g: 0, b: 0 })).toBe("#ff0000");
  });
  it("undefined", () => {
    expect(colorToCss(undefined)).toBeUndefined();
  });
});

describe("styleToCss", () => {
  it("empty style returns empty object", () => {
    expect(styleToCss({})).toEqual({});
  });

  it("bold sets fontWeight", () => {
    expect(styleToCss({ bold: true })).toEqual({ fontWeight: "bold" });
  });

  it("dim sets opacity", () => {
    expect(styleToCss({ dim: true }).opacity).toBe("0.65");
  });

  it("italic sets fontStyle", () => {
    expect(styleToCss({ italic: true }).fontStyle).toBe("italic");
  });

  it("underline sets textDecoration", () => {
    expect(styleToCss({ underline: true }).textDecoration).toBe("underline");
  });

  it("fg emits color", () => {
    expect(
      styleToCss({ fg: { kind: "standard", index: 1 } }).color,
    ).toBe("#cd3131");
  });

  it("bg emits backgroundColor", () => {
    expect(
      styleToCss({ bg: { kind: "standard", index: 2 } }).backgroundColor,
    ).toBe("#0dbc79");
  });

  it("inverse swaps fg and bg", () => {
    const out = styleToCss({
      fg: { kind: "standard", index: 1 }, // red
      bg: { kind: "standard", index: 2 }, // green
      inverse: true,
    });
    expect(out.color).toBe("#0dbc79");
    expect(out.backgroundColor).toBe("#cd3131");
  });

  it("inverse with no fg/bg falls back to sensible defaults", () => {
    const out = styleToCss({ inverse: true });
    expect(out.color).toBeDefined();
    expect(out.backgroundColor).toBeDefined();
  });
});
