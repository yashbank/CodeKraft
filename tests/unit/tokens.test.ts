import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Design-token contract (docs/08 §5.2, §9; P1.2 acceptance):
 *  - both theme sheets define the same set of `--ck-*` semantic tokens (parity);
 *  - every documented text/background pair meets WCAG 2.1 AA (4.5:1) in both themes;
 *  - UI boundaries and the focus ring meet WCAG 1.4.11 (3:1).
 * Colour maths (relative luminance, contrast ratio) is implemented here on purpose so the
 * test has no dependency on a colour library.
 */

const ROOT = process.cwd();
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const read = (p: string) => stripComments(readFileSync(path.join(ROOT, p), "utf8"));

const THEME_FILES = {
  "dark-cinematic": "src/styles/themes/dark-cinematic.css",
  "light-editorial": "src/styles/themes/light-editorial.css",
} as const;
type ThemeName = keyof typeof THEME_FILES;
const THEME_NAMES = Object.keys(THEME_FILES) as ThemeName[];

// ---------------------------------------------------------------------------
// CSS extraction
// ---------------------------------------------------------------------------

/** `--ck-…: value;` declarations inside one rule body. Values may span lines (gradients). */
function declarations(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const [, name = "", value = ""] of body.matchAll(/(--ck-[\w-]+)\s*:\s*([^;]+);/g)) {
    out.set(name, value.replace(/\s+/g, " ").trim());
  }
  return out;
}

/** Every `[data-theme="…"] { … }` rule in a sheet (top level or inside @media), in source order. */
function themeRules(css: string): { name: string; body: string }[] {
  return [...css.matchAll(/\[data-theme="([^"]+)"\]\s*\{([^}]*)\}/g)].map(
    ([, name = "", body = ""]) => ({ name, body }),
  );
}

/** Merged tokens for a theme: base rule first, media-query overrides after (same names). */
function themeTokens(css: string, name: string): Map<string, string> {
  const merged = new Map<string, string>();
  for (const rule of themeRules(css)) {
    if (rule.name !== name) continue;
    for (const [k, v] of declarations(rule.body)) if (!merged.has(k)) merged.set(k, v);
  }
  return merged;
}

const tokensCss = read("src/styles/tokens.css");
const primitives = declarations(tokensCss.match(/:root\s*\{([^}]*)\}/)?.[1] ?? "");

const sheets = Object.fromEntries(
  THEME_NAMES.map((name) => [name, read(THEME_FILES[name])]),
) as Record<ThemeName, string>;
const themes = Object.fromEntries(
  THEME_NAMES.map((name) => [name, themeTokens(sheets[name], name)]),
) as Record<ThemeName, Map<string, string>>;

// ---------------------------------------------------------------------------
// Colour maths — WCAG 2.1 §1.4.3 / §1.4.11 (relative luminance, contrast ratio)
// ---------------------------------------------------------------------------

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

type Resolver = (name: string) => string | undefined;

/** Parses #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba(), or var(--ck-…) resolved through `resolve`. */
function parseColor(value: string, resolve: Resolver, depth = 0): Rgba {
  const v = value.trim();
  if (depth > 8) throw new Error(`Circular colour reference at ${v}`);

  const ref = v.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/);
  if (ref) {
    const [, name = "", fallback] = ref;
    const resolved = resolve(name) ?? fallback;
    if (resolved === undefined) throw new Error(`Unresolvable variable ${name}`);
    return parseColor(resolved, resolve, depth + 1);
  }

  const hex = v.match(/^#([0-9a-f]{3,8})$/i)?.[1];
  if (hex) {
    if (hex.length === 3 || hex.length === 4) {
      const [r = 0, g = 0, b = 0, a] = [...hex].map((c) => parseInt(c + c, 16));
      return { r, g, b, a: a === undefined ? 1 : a / 255 };
    }
    if (hex.length === 6 || hex.length === 8) {
      const n = (i: number) => parseInt(hex.slice(i, i + 2), 16);
      return { r: n(0), g: n(2), b: n(4), a: hex.length === 8 ? n(6) / 255 : 1 };
    }
  }

  const fn = v.match(/^rgba?\(\s*([^)]+)\)$/);
  if (fn) {
    const parts = (fn[1] ?? "")
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number);
    const [r = 0, g = 0, b = 0, a = 1] = parts;
    if (parts.length >= 3 && parts.every((n) => Number.isFinite(n))) {
      return { r, g, b, a };
    }
  }

  throw new Error(`Unsupported colour value: ${value}`);
}

/** Alpha-composites `top` over an opaque `under` (source-over). */
function composite(top: Rgba, under: Rgba): Rgba {
  const a = top.a;
  return {
    r: top.r * a + under.r * (1 - a),
    g: top.g * a + under.g * (1 - a),
    b: top.b * a + under.b * (1 - a),
    a: 1,
  };
}

function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance({ r, g, b }: Rgba): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatio(fg: Rgba, bg: Rgba): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** Resolves a theme token to an opaque colour; `layers` are stacked bottom-up (canvas first). */
function resolveColor(theme: ThemeName, ...layers: string[]): Rgba {
  const resolve: Resolver = (name) => themes[theme].get(name) ?? primitives.get(name);
  let out: Rgba | undefined;
  for (const token of layers) {
    const raw = themes[theme].get(token);
    if (raw === undefined) throw new Error(`${theme}: missing token ${token}`);
    const color = parseColor(raw, resolve);
    out = out ? composite(color, out) : color;
  }
  if (!out) throw new Error("resolveColor needs at least one layer");
  return { ...out, a: 1 };
}

// ---------------------------------------------------------------------------
// Required pairs (docs/08 §5.2 "Required pairs", §9)
// ---------------------------------------------------------------------------

interface Pair {
  label: string;
  fg: string;
  /** Background stack, bottom-up (last entry sits directly under the text). */
  bg: string[];
  min: number;
}

const TEXT = 4.5; // WCAG 1.4.3 AA, body text
const NON_TEXT = 3; // WCAG 1.4.11, UI component boundaries and focus indicators

const PAIRS: Pair[] = [
  { label: "fg on canvas", fg: "--ck-color-fg", bg: ["--ck-color-canvas"], min: TEXT },
  { label: "fg on surface", fg: "--ck-color-fg", bg: ["--ck-color-surface"], min: TEXT },
  { label: "fg on elevated", fg: "--ck-color-fg", bg: ["--ck-color-elevated"], min: TEXT },
  {
    label: "fg on glass over canvas",
    fg: "--ck-color-fg",
    bg: ["--ck-color-canvas", "--ck-color-glass"],
    min: TEXT,
  },
  { label: "fg-muted on canvas", fg: "--ck-color-fg-muted", bg: ["--ck-color-canvas"], min: TEXT },
  {
    label: "fg-muted on surface",
    fg: "--ck-color-fg-muted",
    bg: ["--ck-color-surface"],
    min: TEXT,
  },
  {
    label: "fg-muted on elevated",
    fg: "--ck-color-fg-muted",
    bg: ["--ck-color-elevated"],
    min: TEXT,
  },
  {
    label: "fg-subtle on canvas",
    fg: "--ck-color-fg-subtle",
    bg: ["--ck-color-canvas"],
    min: TEXT,
  },
  {
    label: "fg-subtle on surface",
    fg: "--ck-color-fg-subtle",
    bg: ["--ck-color-surface"],
    min: TEXT,
  },
  {
    label: "accent-fg on accent",
    fg: "--ck-color-accent-fg",
    bg: ["--ck-color-accent"],
    min: TEXT,
  },
  {
    label: "accent-fg on accent-hover",
    fg: "--ck-color-accent-fg",
    bg: ["--ck-color-accent-hover"],
    min: TEXT,
  },
  {
    label: "accent-text on canvas",
    fg: "--ck-color-accent-text",
    bg: ["--ck-color-canvas"],
    min: TEXT,
  },
  {
    label: "accent-text on surface",
    fg: "--ck-color-accent-text",
    bg: ["--ck-color-surface"],
    min: TEXT,
  },
  {
    label: "accent-text on accent-soft",
    fg: "--ck-color-accent-text",
    bg: ["--ck-color-accent-soft"],
    min: TEXT,
  },
  {
    label: "secondary-fg on secondary",
    fg: "--ck-color-secondary-fg",
    bg: ["--ck-color-secondary"],
    min: TEXT,
  },
  {
    label: "success-fg on success",
    fg: "--ck-color-success-fg",
    bg: ["--ck-color-success"],
    min: TEXT,
  },
  { label: "success on canvas", fg: "--ck-color-success", bg: ["--ck-color-canvas"], min: TEXT },
  {
    label: "success on success-soft",
    fg: "--ck-color-success",
    bg: ["--ck-color-success-soft"],
    min: TEXT,
  },
  {
    label: "warning-fg on warning",
    fg: "--ck-color-warning-fg",
    bg: ["--ck-color-warning"],
    min: TEXT,
  },
  { label: "warning on canvas", fg: "--ck-color-warning", bg: ["--ck-color-canvas"], min: TEXT },
  {
    label: "warning on warning-soft",
    fg: "--ck-color-warning",
    bg: ["--ck-color-warning-soft"],
    min: TEXT,
  },
  {
    label: "danger-fg on danger",
    fg: "--ck-color-danger-fg",
    bg: ["--ck-color-danger"],
    min: TEXT,
  },
  { label: "danger on canvas", fg: "--ck-color-danger", bg: ["--ck-color-canvas"], min: TEXT },
  {
    label: "danger on danger-soft",
    fg: "--ck-color-danger",
    bg: ["--ck-color-danger-soft"],
    min: TEXT,
  },
  { label: "info-fg on info", fg: "--ck-color-info-fg", bg: ["--ck-color-info"], min: TEXT },
  { label: "info on canvas", fg: "--ck-color-info", bg: ["--ck-color-canvas"], min: TEXT },
  { label: "info on info-soft", fg: "--ck-color-info", bg: ["--ck-color-info-soft"], min: TEXT },
  {
    label: "inverse-fg on inverse",
    fg: "--ck-color-inverse-fg",
    bg: ["--ck-color-inverse"],
    min: TEXT,
  },
  // Non-text (1.4.11). `--ck-color-border` is the decorative hairline (docs/08 §5.2: "decorative
  // only"); the token that carries input/table boundaries is `--ck-color-border-strong`.
  {
    label: "border-strong on canvas",
    fg: "--ck-color-border-strong",
    bg: ["--ck-color-canvas"],
    min: NON_TEXT,
  },
  {
    label: "border-strong on surface",
    fg: "--ck-color-border-strong",
    bg: ["--ck-color-surface"],
    min: NON_TEXT,
  },
  { label: "ring on canvas", fg: "--ck-color-ring", bg: ["--ck-color-canvas"], min: NON_TEXT },
  { label: "ring on surface", fg: "--ck-color-ring", bg: ["--ck-color-surface"], min: NON_TEXT },
];

interface Row {
  label: string;
  min: number;
  ratios: Record<ThemeName, number>;
  failing: ThemeName[];
}

function contrastRows(): Row[] {
  return PAIRS.map((pair) => {
    const ratios = Object.fromEntries(
      THEME_NAMES.map((theme) => {
        const fg = resolveColor(theme, ...pair.bg, pair.fg);
        const bg = resolveColor(theme, ...pair.bg);
        return [theme, contrastRatio(fg, bg)];
      }),
    ) as Record<ThemeName, number>;
    const failing = THEME_NAMES.filter((t) => ratios[t] < pair.min);
    return { label: pair.label, min: pair.min, ratios, failing };
  });
}

function formatTable(rows: Row[]): string {
  const w = Math.max(...rows.map((r) => r.label.length));
  const head = `${"pair".padEnd(w)} | ${THEME_NAMES.map((t) => t.padStart(15)).join(" | ")} |  min | status`;
  const line = "-".repeat(head.length);
  const body = rows.map((r) => {
    const cells = THEME_NAMES.map((t) => `${r.ratios[t].toFixed(2)}:1`.padStart(15)).join(" | ");
    const status = r.failing.length ? `FAIL (${r.failing.join(", ")})` : "ok";
    return `${r.label.padEnd(w)} | ${cells} | ${`${r.min}:1`.padStart(4)} | ${status}`;
  });
  return [head, line, ...body].join("\n");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("theme token parity", () => {
  it("each theme sheet declares exactly its own [data-theme] name", () => {
    for (const name of THEME_NAMES) {
      const declared = new Set(themeRules(sheets[name]).map((r) => r.name));
      expect([...declared]).toEqual([name]);
      expect(themes[name].size).toBeGreaterThan(50);
    }
  });

  it("defines the same set of --ck-* semantic tokens in both themes", () => {
    const [a, b] = THEME_NAMES as [ThemeName, ThemeName];
    const namesA = new Set(themes[a].keys());
    const namesB = new Set(themes[b].keys());
    const onlyA = [...namesA].filter((n) => !namesB.has(n)).sort();
    const onlyB = [...namesB].filter((n) => !namesA.has(n)).sort();
    expect({ [`only in ${a}`]: onlyA, [`only in ${b}`]: onlyB }).toEqual({
      [`only in ${a}`]: [],
      [`only in ${b}`]: [],
    });
  });

  it("only references --ck-* variables that exist (theme tokens or tokens.css primitives)", () => {
    const dangling: string[] = [];
    for (const name of THEME_NAMES) {
      for (const [token, value] of themes[name]) {
        for (const m of value.matchAll(/var\(\s*(--ck-[\w-]+)/g)) {
          const ref = m[1] ?? "";
          if (!themes[name].has(ref) && !primitives.has(ref))
            dangling.push(`${name}: ${token} -> ${ref}`);
        }
      }
    }
    expect(dangling).toEqual([]);
  });
});

describe("WCAG colour maths", () => {
  const none: Resolver = () => undefined;

  it("parses every supported hex and functional notation", () => {
    expect(parseColor("#fff", none)).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor("#0a0b10", none)).toEqual({ r: 10, g: 11, b: 16, a: 1 });
    expect(parseColor("#0a0b1080", none).a).toBeCloseTo(128 / 255, 5);
    expect(parseColor("rgba(30, 33, 48, 0.72)", none)).toEqual({ r: 30, g: 33, b: 48, a: 0.72 });
    expect(parseColor("var(--ck-p-ink-950)", (n) => primitives.get(n))).toEqual({
      r: 10,
      g: 11,
      b: 16,
      a: 1,
    });
    expect(() => parseColor("var(--ck-nope)", none)).toThrow(/Unresolvable/);
    expect(() => parseColor("hsl(0 0% 0%)", none)).toThrow(/Unsupported/);
  });

  it("matches the WCAG reference values", () => {
    const black = parseColor("#000", none);
    const white = parseColor("#fff", none);
    expect(contrastRatio(black, white)).toBeCloseTo(21, 5);
    expect(contrastRatio(white, black)).toBeCloseTo(21, 5);
    expect(relativeLuminance(parseColor("#808080", none))).toBeCloseTo(0.2159, 3);
    // Transparent over black is black; half-white over black is mid grey.
    expect(composite({ r: 255, g: 255, b: 255, a: 0 }, black)).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    expect(composite({ r: 255, g: 255, b: 255, a: 0.5 }, black).r).toBeCloseTo(127.5, 5);
  });
});

describe("WCAG 2.1 AA contrast (docs/08 §5.2 required pairs)", () => {
  const rows = contrastRows();

  if (process.env.CK_PRINT_CONTRAST) {
    console.log(`\n${formatTable(rows)}\n`);
  }

  it("meets 4.5:1 for text pairs and 3:1 for UI boundaries in both themes", () => {
    const failures = rows.filter((r) => r.failing.length > 0).map((r) => r.label);
    expect(failures, `\n${formatTable(rows)}\n`).toEqual([]);
  });

  it("covers every status colour, both themes", () => {
    for (const status of ["success", "warning", "danger", "info"]) {
      expect(rows.some((r) => r.label === `${status}-fg on ${status}`)).toBe(true);
    }
    expect(Object.keys(rows[0]?.ratios ?? {}).sort()).toEqual([...THEME_NAMES].sort());
  });
});
