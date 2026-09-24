/**
 * Typed motion tokens — docs/08 §5.10, §7 (D-904, D-907, D-1303).
 *
 * The CSS custom properties in src/styles/themes/*.css are the source of truth at runtime;
 * this module mirrors them so Motion (framer) and GSAP read the same values with types.
 * `readMotionTokens()` resolves the live values from the active `[data-theme]` (springs are
 * stored as JSON strings and parsed), falling back to the static table when no DOM exists.
 * Components never branch on the theme name: they call `readMotionTokens()` (runtime) and let
 * the attribute decide; the static table is keyed by theme only so tests can diff it against
 * the CSS sheets.
 */

export const THEME_NAMES = ["dark-cinematic", "light-editorial"] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

export type DurationKey = "xs" | "sm" | "md" | "lg" | "xl" | "hero";
export type EaseKey = "standard" | "emphasized" | "exit";
export type StaggerKey = "sm" | "md" | "lg";

/** Framer Motion spring transition (subset of `Transition`). */
export interface SpringToken {
  readonly type: "spring";
  readonly stiffness: number;
  readonly damping: number;
  readonly mass: number;
}

/** Cubic-bezier control points as Motion / GSAP CustomEase expect them. */
export type CubicBezier = readonly [number, number, number, number];

export interface MotionTokens {
  /** Milliseconds. */
  readonly duration: Readonly<Record<DurationKey, number>>;
  /** Cubic-bezier control points (`ease-*` utilities carry the same values in CSS). */
  readonly ease: Readonly<Record<EaseKey, CubicBezier>>;
  /** GSAP ease name for scroll-chapter tweens. */
  readonly easeGsap: string;
  readonly spring: { readonly ui: SpringToken; readonly hero: SpringToken };
  /** Milliseconds between staggered children. */
  readonly stagger: Readonly<Record<StaggerKey, number>>;
  /** CSS transform applied on card hover. */
  readonly hoverLift: string;
  /** Maximum parallax travel of any layer as a fraction of its own height (0–1). */
  readonly parallaxMax: number;
  /** Reveal translate distance in px (already halved below `lg` by the theme sheet). */
  readonly revealY: number;
  /** Hero poster slow zoom duration in ms (0 = none). */
  readonly posterZoom: number;
}

const DARK_CINEMATIC: MotionTokens = {
  duration: { xs: 100, sm: 160, md: 240, lg: 400, xl: 700, hero: 1200 },
  ease: {
    standard: [0.2, 0, 0, 1],
    emphasized: [0.05, 0.7, 0.1, 1],
    exit: [0.3, 0, 0.8, 0.15],
  },
  easeGsap: "expo.out",
  spring: {
    ui: { type: "spring", stiffness: 420, damping: 32, mass: 1 },
    hero: { type: "spring", stiffness: 170, damping: 26, mass: 1.2 },
  },
  stagger: { sm: 40, md: 70, lg: 110 },
  hoverLift: "translateY(-4px) scale(1.01)",
  parallaxMax: 0.12,
  revealY: 24,
  posterZoom: 20_000,
};

const LIGHT_EDITORIAL: MotionTokens = {
  duration: { xs: 100, sm: 180, md: 280, lg: 480, xl: 800, hero: 1400 },
  ease: {
    standard: [0.25, 0.1, 0.25, 1],
    emphasized: [0.16, 1, 0.3, 1],
    exit: [0.4, 0, 1, 1],
  },
  easeGsap: "power2.out",
  spring: {
    ui: { type: "spring", stiffness: 300, damping: 34, mass: 1 },
    hero: { type: "spring", stiffness: 140, damping: 28, mass: 1.2 },
  },
  stagger: { sm: 50, md: 90, lg: 130 },
  hoverLift: "translateY(-2px)",
  parallaxMax: 0.06,
  revealY: 16,
  posterZoom: 0,
};

/** Static mirror of the CSS `--ck-motion-*` tokens, keyed by theme name. */
export const MOTION: Readonly<Record<ThemeName, MotionTokens>> = {
  "dark-cinematic": DARK_CINEMATIC,
  "light-editorial": LIGHT_EDITORIAL,
};

export const DEFAULT_THEME: ThemeName = "dark-cinematic";

/** Reduced-motion ceiling for opacity crossfades (docs/08 §7.4). */
export const REDUCED_MOTION_CROSSFADE_MAX_MS = 200;

/** Convert a duration token to seconds, as Motion's `transition.duration` expects. */
export function seconds(ms: number): number {
  return ms / 1000;
}

const SPRING_KEYS = ["stiffness", "damping", "mass"] as const;

/**
 * Parse a `--ck-motion-spring-*` value. The CSS stores the JSON inside single quotes so it
 * survives as one token; `getComputedStyle` returns it with the quotes intact.
 */
export function parseSpring(raw: string): SpringToken | undefined {
  const trimmed = raw.trim().replace(/^'|'$/g, "");
  if (!trimmed) return undefined;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed !== "object" || parsed === null) return undefined;
    const rec = parsed as Record<string, unknown>;
    for (const key of SPRING_KEYS) {
      if (typeof rec[key] !== "number") return undefined;
    }
    return {
      type: "spring",
      stiffness: rec.stiffness as number,
      damping: rec.damping as number,
      mass: rec.mass as number,
    };
  } catch {
    return undefined;
  }
}

const BEZIER_RE = /cubic-bezier\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/;

/** Parse `cubic-bezier(a, b, c, d)` into control points. */
export function parseCubicBezier(raw: string): CubicBezier | undefined {
  const m = BEZIER_RE.exec(raw);
  if (!m) return undefined;
  const [a, b, c, d] = m.slice(1, 5).map((s) => Number.parseFloat(s));
  if (a === undefined || b === undefined || c === undefined || d === undefined) return undefined;
  if ([a, b, c, d].some((n) => Number.isNaN(n))) return undefined;
  return [a, b, c, d];
}

/** Parse `240ms` / `0.4s` / `20s` into milliseconds. */
export function parseDuration(raw: string): number | undefined {
  const m = /^\s*(-?[\d.]+)\s*(ms|s)\s*$/.exec(raw);
  if (!m) return undefined;
  const value = m[1];
  if (value === undefined) return undefined;
  const n = Number.parseFloat(value);
  if (Number.isNaN(n)) return undefined;
  return m[2] === "s" ? n * 1000 : n;
}

type StyleReader = (property: string) => string;

function pickDurations(read: StyleReader, base: MotionTokens["duration"]) {
  const out = { ...base };
  for (const key of Object.keys(base) as DurationKey[]) {
    const v = parseDuration(read(`--ck-motion-duration-${key}`));
    if (v !== undefined) out[key] = v;
  }
  return out;
}

function pickStagger(read: StyleReader, base: MotionTokens["stagger"]) {
  const out = { ...base };
  for (const key of Object.keys(base) as StaggerKey[]) {
    const v = parseDuration(read(`--ck-motion-stagger-${key}`));
    if (v !== undefined) out[key] = v;
  }
  return out;
}

function pickEases(read: StyleReader, base: MotionTokens["ease"]) {
  const out = { ...base };
  for (const key of Object.keys(base) as EaseKey[]) {
    const v = parseCubicBezier(read(`--ck-motion-ease-${key}`));
    if (v !== undefined) out[key] = v;
  }
  return out;
}

/**
 * Read the motion tokens of the active theme from computed styles (docs/08 §4.5 rule 5).
 * Server-side or without a DOM, returns the static table for `fallback` (default theme).
 */
export function readMotionTokens(
  element?: Element | null,
  fallback: ThemeName = DEFAULT_THEME,
): MotionTokens {
  const base = MOTION[fallback];
  if (typeof window === "undefined" || typeof getComputedStyle !== "function") return base;
  const el = element ?? document.documentElement;
  const style = getComputedStyle(el);
  const read: StyleReader = (property) => style.getPropertyValue(property);

  const easeGsap = read("--ck-motion-ease-gsap").trim().replace(/^"|"$/g, "");
  const parallax = Number.parseFloat(read("--ck-motion-parallax-max"));
  const revealY = parseDuration(read("--ck-motion-reveal-y"));
  const revealPx = Number.parseFloat(read("--ck-motion-reveal-y"));
  const posterZoom = parseDuration(read("--ck-motion-poster-zoom"));
  const hoverLift = read("--ck-motion-hover-lift").trim();

  return {
    duration: pickDurations(read, base.duration),
    ease: pickEases(read, base.ease),
    easeGsap: easeGsap || base.easeGsap,
    spring: {
      ui: parseSpring(read("--ck-motion-spring-ui")) ?? base.spring.ui,
      hero: parseSpring(read("--ck-motion-spring-hero")) ?? base.spring.hero,
    },
    stagger: pickStagger(read, base.stagger),
    hoverLift: hoverLift || base.hoverLift,
    parallaxMax: Number.isNaN(parallax) ? base.parallaxMax : parallax / 100,
    revealY: revealY ?? (Number.isNaN(revealPx) ? base.revealY : revealPx),
    posterZoom: posterZoom ?? base.posterZoom,
  };
}
