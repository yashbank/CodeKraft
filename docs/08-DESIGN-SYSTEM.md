# 08 — DESIGN SYSTEM

**Implements:** MASTER_SPEC §3 (terminology), §4 rule 6 (themes are tokens); baseline §12 (responsive, themes, motion, accessibility); D-011, D-012, D-801, D-802, D-901–D-907, D-1303, D-1304, D-1605; R-901, R-801; docs/04 §4 stack (Tailwind v4, shadcn/ui, Motion, GSAP ScrollTrigger, Lenis, react-three-fiber), §5 `styles/` layout, ADR-11.
**Feeds:** `docs/07-UX-UI-SPECIFICATION.md` (screens consume these components), `docs/11-SEO-PERFORMANCE.md` (font and motion budgets), `ui/theme-01/dark-cinematic.md`, `ui/theme-02/light-editorial.md`, `implementation/PHASE-xx.md` (UI tasks).
**Status:** Proposed for founder approval (D-906 — no brand assets existed; logo, palettes and type pairings below are proposals).

---

## 0. How to read this document

- **Tokens** are CSS custom properties. Theme 1 (`dark-cinematic`) and Theme 2 (`light-editorial`) are two complete value sheets for the *same* token names. The full sheets live in `ui/theme-01/dark-cinematic.md` and `ui/theme-02/light-editorial.md`; this document defines the contract (names, categories, semantics) and gives the values inline where a reader needs them to judge the design.
- **Components** are specified once. They never know which theme is active. A component spec says which tokens it consumes, not which colours it has.
- All contrast ratios are computed with the WCAG 2.1 relative-luminance formula against the exact hex values stated. Every text/background pair used by a component meets **≥ 4.5:1** (normal text) and every non-text UI boundary (input borders, focus rings, chart marks) meets **≥ 3:1** (WCAG 1.4.11).
- Units: colours are hex (sRGB); sizes are `rem` with the px equivalent at the 16px root; motion in `ms`; easings as `cubic-bezier()` or GSAP ease names.

---

## 1. Principles

| # | Principle | What it means in practice |
|---|-----------|---------------------------|
| P1 | **Premium first** (R-901 resolution) | Generous whitespace, few colours, one accent, large type, restrained decoration. Nothing is "busy". Every screen could be a portfolio shot. |
| P2 | **Bold, futuristic accents** | The accent hue (violet → cyan gradient in Theme 1; deep indigo in Theme 2), the 3D hero, glow and glass are used as *punctuation*, never as wallpaper. At most one glowing element per viewport. |
| P3 | **Restrained playfulness** | Motion has personality (spring overshoot on hover, staggered reveals, a hero that reacts to the pointer) but never blocks the user. No mascots, no emoji in UI copy, no confetti. |
| P4 | **Trustworthy structure** | Commerce, checkout, payment instructions, invoices and every admin screen use a strict 8-pt grid, tabular numbers, explicit status chips and no decorative motion. Money is always displayed with currency code and integer-minor-unit formatting from `lib/money`. |
| P5 | **Themes are tokens** (MASTER_SPEC §4.6, D-011) | Two full design systems (not modes) share one component library. Switching theme changes only CSS variables. |
| P6 | **Deliberately responsive** (D-012) | Six breakpoints from phone to TV are *designed*, not merely fluid. Type, container width, grid density and motion complexity change at each. |
| P7 | **Motion is progressive enhancement** (D-904, D-907, D-1303) | The page is complete and readable with every animation removed. Scroll effects animate only `transform` and `opacity`. Reduced motion, mobile and low-power paths are first-class. |
| P8 | **Accessible by default** (D-907) | WCAG 2.1 AA on every pair, keyboard-complete, screen-reader labelled, honours system preferences. Radix primitives via shadcn/ui give focus management and ARIA for free; we do not fork them. |

---

## 2. Brand resolution (R-901)

D-901 selected all four personalities. Resolution, for founder confirmation:

| Personality | Weight | Where it shows | Where it must not show |
|-------------|--------|----------------|------------------------|
| Minimal / premium | **Anchor (60%)** | Layout, spacing, type scale, colour restraint, photography, copy tone | — |
| Bold / futuristic | Accent (20%) | Hero 3D scene, gradient glows, display typeface, chapter transitions, product cards on hover | Admin app, invoices, legal pages |
| Playful / vibrant | Seasoning (10%) | Micro-interactions, empty states, success toasts, chatbot quick replies, 404 | Checkout, payment, finance |
| Corporate / trustworthy | Structure (10%) | Checkout, payment panel, invoice, admin, case-study "Results" blocks, legal | Landing hero |

**Voice:** confident, concise, first-person plural ("We build…"). Sentence case everywhere except the overline style. No exclamation marks in UI. Numbers use tabular figures.

**Tagline direction (proposal):** "Software, crafted." — short, doubles as the hero sub-line; alternatives for founder pick: "Built to ship.", "Studio-grade software products."

---

## 3. Logo direction (D-906 proposal)

No assets exist; the following is a specification an illustrator or the founders can execute in Figma in under a day. Two candidates are described; **Candidate A is recommended.**

### 3.1 Candidate A — "Kraft Bracket" wordmark (recommended)

- **Wordmark:** `CodeKraft` set in **Space Grotesk Bold (700)**, tracking −0.035em, custom-kerned. The capital **K** is redrawn: its two diagonal arms are replaced by a **right-pointing chevron `>`** whose apex sits on the K stem's mid-height. The chevron reads as both a code prompt and a "cut/craft" mark. All other glyphs are stock.
- **Case:** "Code" in ink colour, "Kraft" in ink colour; only the K chevron takes the accent (Theme 1: `#9D8FFF`; Theme 2: `#3F35D6`). One accent element = premium restraint.
- **Monogram:** the redrawn K alone inside a **rounded square (radius 22% of side)**. Used for favicon, app icon, avatar, loading state, 3D hero centrepiece (see §12).
- **Clear space:** on every side ≥ the cap height of the "C" (call it `x`). Nothing — text, edges, other logos — enters the `x` zone.
- **Minimum sizes:** wordmark **112 px wide** on screen / **28 mm** print; monogram **16 px** (favicon) / **6 mm**. Below 112 px use the monogram.
- **Variants (all delivered as SVG with `currentColor` so they follow tokens):**
  1. `logo-wordmark.svg` — ink + accent K (default).
  2. `logo-wordmark-mono.svg` — single colour, `fill: currentColor` (footers, invoices, print).
  3. `logo-wordmark-inverse.svg` — for use on accent or photographic backgrounds: all white (Theme 1) / all `#FAF8F3` (Theme 2); chevron gets a 1 px inner keyline for separation on busy imagery.
  4. `logo-mark.svg` — monogram, accent fill, ink chevron; `logo-mark-mono.svg`.
- **Don't:** rotate, outline, add drop shadow, apply the full gradient to the wordmark, place on mid-tone backgrounds where contrast < 4.5:1, use "CodeCraft" (MASTER_SPEC §3).

### 3.2 Candidate B — "Forge" monogram-led

A `CK` ligature inside a hexagon; wordmark in Inter Semibold set small beneath. More corporate, less distinctive; kept as fallback if the founders want a symbol-first mark.

### 3.3 Invoice and email usage

Invoices (`pdf/`) and emails (`emails/`) use `logo-wordmark-mono.svg` at 140 px wide in ink `#17181C` on white regardless of theme (PDF and email are not themed).

---

## 4. Token architecture

### 4.1 Layers

```
┌───────────────────────────────────────────────────────────────────┐
│ 3. Component styles (shadcn/ui + custom)                          │
│    consume ONLY semantic tokens via Tailwind utilities            │
├───────────────────────────────────────────────────────────────────┤
│ 2. Semantic tokens  --ck-color-canvas, --ck-radius-md, ...        │
│    defined per theme under [data-theme="dark-cinematic"] and      │
│    [data-theme="light-editorial"]                                 │
├───────────────────────────────────────────────────────────────────┤
│ 1. Primitive tokens  --ck-p-violet-400, --ck-p-ink-900, ...       │
│    defined once on :root, never used by components directly       │
└───────────────────────────────────────────────────────────────────┘
```

Files (docs/04 §5): `src/styles/tokens.css` (primitives on `:root` + the `@theme inline` bridge + shadcn aliases), `src/styles/themes/dark-cinematic.css`, `src/styles/themes/light-editorial.css` (semantic values per theme). All three are imported by `app/globals.css`; both theme files ship in release 1 even though the Theme 2 toggle is behind the `theme_light_editorial` flag (docs/04 §7.9) — tokens are ~6 KB gzipped and the CI contrast test runs against both.

### 4.2 Naming scheme

`--ck-<layer>-<category>-<role>[-<variant>][-<state>]`

| Segment | Values |
|---------|--------|
| layer | `p` primitive; omitted for semantic |
| category | `color`, `font`, `text` (size/line-height pairs), `space`, `radius`, `border`, `shadow`, `blur`, `z`, `motion`, `bp` (breakpoint), `container`, `chart` |
| role | e.g. `canvas`, `surface`, `elevated`, `border`, `fg`, `accent` |
| variant | `muted`, `subtle`, `soft`, `strong`, `fg` (foreground-on) |
| state | `hover`, `active`, `disabled` |

Examples: `--ck-color-accent`, `--ck-color-accent-fg`, `--ck-color-accent-hover`, `--ck-color-accent-soft`, `--ck-shadow-2`, `--ck-motion-duration-md`, `--ck-text-h2-size`.

### 4.3 Tailwind v4 bridge

Tailwind v4 generates utilities from `@theme` variables. We use `@theme inline` so utilities reference the semantic variable at runtime (the value is resolved by the active `[data-theme]`), not at build time.

```css
/* src/styles/tokens.css */
@import "tailwindcss";

:root { /* primitives, see ui/theme-0x sheets §2 */ }

@theme inline {
  /* colours → bg-*, text-*, border-*, ring-*, fill-* */
  --color-canvas:        var(--ck-color-canvas);
  --color-surface:       var(--ck-color-surface);
  --color-elevated:      var(--ck-color-elevated);
  --color-overlay:       var(--ck-color-overlay);
  --color-border:        var(--ck-color-border);
  --color-border-strong: var(--ck-color-border-strong);
  --color-fg:            var(--ck-color-fg);
  --color-fg-muted:      var(--ck-color-fg-muted);
  --color-fg-subtle:     var(--ck-color-fg-subtle);
  --color-accent:        var(--ck-color-accent);
  --color-accent-fg:     var(--ck-color-accent-fg);
  --color-accent-hover:  var(--ck-color-accent-hover);
  --color-accent-soft:   var(--ck-color-accent-soft);
  --color-accent-text:   var(--ck-color-accent-text);
  --color-secondary:     var(--ck-color-secondary);
  --color-secondary-fg:  var(--ck-color-secondary-fg);
  --color-success:       var(--ck-color-success);
  --color-success-fg:    var(--ck-color-success-fg);
  --color-success-soft:  var(--ck-color-success-soft);
  --color-warning:       var(--ck-color-warning);
  --color-warning-fg:    var(--ck-color-warning-fg);
  --color-warning-soft:  var(--ck-color-warning-soft);
  --color-danger:        var(--ck-color-danger);
  --color-danger-fg:     var(--ck-color-danger-fg);
  --color-danger-soft:   var(--ck-color-danger-soft);
  --color-info:          var(--ck-color-info);
  --color-info-fg:       var(--ck-color-info-fg);
  --color-info-soft:     var(--ck-color-info-soft);
  --color-ring:          var(--ck-color-ring);
  --color-chart-1: var(--ck-chart-1); /* … through --color-chart-7 */

  /* typography → font-display, font-body, font-mono */
  --font-display: var(--ck-font-display);
  --font-body:    var(--ck-font-body);
  --font-mono:    var(--ck-font-mono);

  /* radius → rounded-xs … rounded-2xl */
  --radius-xs: var(--ck-radius-xs);  --radius-sm: var(--ck-radius-sm);
  --radius-md: var(--ck-radius-md);  --radius-lg: var(--ck-radius-lg);
  --radius-xl: var(--ck-radius-xl);  --radius-2xl: var(--ck-radius-2xl);

  /* shadows → shadow-1 … shadow-4, shadow-glow */
  --shadow-1: var(--ck-shadow-1); --shadow-2: var(--ck-shadow-2);
  --shadow-3: var(--ck-shadow-3); --shadow-4: var(--ck-shadow-4);
  --shadow-glow: var(--ck-shadow-glow);

  /* motion → duration-*, ease-* */
  --ease-standard:   var(--ck-motion-ease-standard);
  --ease-emphasized: var(--ck-motion-ease-emphasized);
  --ease-exit:       var(--ck-motion-ease-exit);
}

@theme {
  /* static (theme-independent) */
  --spacing: 0.25rem;                    /* 4 px base; p-4 = 1rem */
  --breakpoint-sm: 40rem;   /* 640  phone-landscape / small tablet */
  --breakpoint-md: 48rem;   /* 768  tablet */
  --breakpoint-lg: 64rem;   /* 1024 laptop */
  --breakpoint-xl: 80rem;   /* 1280 desktop */
  --breakpoint-2xl: 96rem;  /* 1536 large */
  --breakpoint-tv: 120rem;  /* 1920 TV / wall */
  --container-*: initial;   /* containers defined by --ck-container-* below */
}
```

Usage in components: `bg-surface text-fg border-border rounded-lg shadow-2 font-display`. **Never** `bg-[#12141C]`, `dark:bg-…`, or `theme === 'dark-cinematic' ? … : …` in JSX. ESLint rule `no-restricted-syntax` blocks the string `data-theme` and the `dark:` variant prefix in `components/**`. Tailwind's `dark` variant is redefined as unused: `@custom-variant dark (&:where([data-theme="__never__"] *));` so any stray `dark:` is inert.

### 4.4 shadcn/ui bridge

shadcn components read their own variable names. `tokens.css` aliases them to semantic tokens so copied-in components need no edits:

```css
:root, [data-theme] {
  --background: var(--ck-color-canvas);      --foreground: var(--ck-color-fg);
  --card: var(--ck-color-surface);           --card-foreground: var(--ck-color-fg);
  --popover: var(--ck-color-elevated);       --popover-foreground: var(--ck-color-fg);
  --primary: var(--ck-color-accent);         --primary-foreground: var(--ck-color-accent-fg);
  --secondary: var(--ck-color-elevated);     --secondary-foreground: var(--ck-color-fg);
  --muted: var(--ck-color-surface);          --muted-foreground: var(--ck-color-fg-muted);
  --accent: var(--ck-color-accent-soft);     --accent-foreground: var(--ck-color-accent-text);
  --destructive: var(--ck-color-danger);     --destructive-foreground: var(--ck-color-danger-fg);
  --border: var(--ck-color-border);          --input: var(--ck-color-border-strong);
  --ring: var(--ck-color-ring);              --radius: var(--ck-radius-md);
  --chart-1: var(--ck-chart-1); /* … --chart-5 */
  --sidebar: var(--ck-color-surface);        --sidebar-foreground: var(--ck-color-fg);
  --sidebar-primary: var(--ck-color-accent); --sidebar-primary-foreground: var(--ck-color-accent-fg);
  --sidebar-accent: var(--ck-color-accent-soft); --sidebar-accent-foreground: var(--ck-color-accent-text);
  --sidebar-border: var(--ck-color-border);  --sidebar-ring: var(--ck-color-ring);
}
```

### 4.5 Rules

1. Components consume semantic tokens only; primitives are for theme sheets.
2. No component, hook, or Server Component reads `data-theme` to branch rendering. The only code that touches the attribute is `components/site/ThemeToggle.tsx`, `app/layout.tsx` and the ≤ 300-byte inline head script (§10).
3. A theme may override **any** semantic token, including typography and motion tokens — that is how Theme 2 gets serif display type and slower easing without a component change.
4. New tokens are added to both theme sheets in the same PR; CI (`tests/unit/tokens.test.ts`) parses both files and fails on a missing key or a text/background pair below 4.5:1 (pairs listed in §5.2).
5. Images, 3D materials and Recharts colours read tokens at runtime (`getComputedStyle(document.documentElement).getPropertyValue('--ck-chart-1')`), never hardcoded.

---

## 5. Token categories

### 5.1 Colour — primitive palette (`:root`, theme-independent)

| Family | Steps (hex) | Use |
|--------|-------------|-----|
| `ink` (cool near-black) | 950 `#0A0B10` · 900 `#12141C` · 850 `#1A1D27` · 800 `#1E2130` · 700 `#262A38` · 600 `#3A3F52` · 500 `#626A8A` · 400 `#7C8294` · 300 `#A3A9B8` · 200 `#D5D9E2` · 100 `#F2F4F8` | Theme 1 backgrounds and text |
| `paper` (warm off-white) | 50 `#FFFFFF` · 100 `#FAF8F3` · 200 `#F3F0E8` · 300 `#E4E0D6` · 400 `#C9C4B8` · 500 `#86827A` · 600 `#676A72` · 700 `#5D6068` · 800 `#4A4D55` · 900 `#2A2C33` · 950 `#17181C` | Theme 2 backgrounds and text |
| `violet` (brand accent) | 100 `#E9E7FB` · 200 `#C4BBFF` · 300 `#B5ABFF` · 400 `#9D8FFF` · 500 `#8B7CFF` · 600 `#7C6CFF` · 700 `#5E4EE6` · 800 `#4E3ED4` · 850 `#3F35D6` · 900 `#3128B8` · 950 `#241C8F` · tint-dark `#1C1838` | Accent in both themes |
| `cyan` (secondary accent) | 300 `#4FE3E0` · 600 `#0B7A76` · 700 `#0A6E6A` · tint-dark `#0E2A2C` | Gradients, secondary marks |
| `amber` | 300 `#FBBF24` · 400 `#F5B83D` · 700 `#9A5B00` · tint-dark `#2A2210` · tint-light `#FCF0DC` | Warning, playful accent |
| `terracotta` | 600 `#B4502E` | Theme 2 editorial accent (chart, pull quotes) |
| `green` | 300 `#4ADE80` · 700 `#176F42` · tint-dark `#10241A` · tint-light `#E4F3EA` | Success |
| `rose` | 300 `#FB7185` · 600 `#E11D48` · 700 `#C8203A` · 800 `#A81A30` · tint-dark `#2A1219` · tint-light `#FBE7EA` | Danger |
| `blue` | 300 `#60A5FA` · 700 `#1D5FBF` · tint-dark `#101C2E` · tint-light `#E3ECFA` | Info |
| `magenta` | 300 `#E879F9` · 700 `#8A2BA8` | Chart series only |

### 5.2 Colour — semantic roles (contract; values per theme)

| Token | Role | Theme 1 | Theme 2 | Required pairs (ratio T1 / T2) |
|-------|------|---------|---------|-------------------------------|
| `--ck-color-canvas` | Page background | `#0A0B10` | `#FAF8F3` | — |
| `--ck-color-surface` | Cards, panels, inputs | `#12141C` | `#FFFFFF` | — |
| `--ck-color-elevated` | Popovers, dropdowns, sheets | `#1A1D27` | `#FFFFFF` (+ shadow) | — |
| `--ck-color-glass` | Translucent panel fill | `rgba(30,33,48,0.72)` | `rgba(255,255,255,0.78)` | text on glass over canvas ≥ 14.5 / 15.5 |
| `--ck-color-overlay` | Modal scrim | `rgba(5,6,10,0.72)` | `rgba(23,24,28,0.48)` | — |
| `--ck-color-border` | Hairlines, dividers | `#262A38` | `#E4E0D6` | decorative only |
| `--ck-color-border-strong` | Input borders, table rules | `#626A8A` | `#86827A` | vs surface **3.46 / 3.83** (≥3:1 ✓) |
| `--ck-color-fg` | Primary text | `#F2F4F8` | `#17181C` | vs canvas **17.85 / 16.71**; vs surface **16.69 / 17.74**; vs elevated **15.27 / 17.74** |
| `--ck-color-fg-muted` | Secondary text, labels | `#A3A9B8` | `#5D6068` | vs canvas **8.35 / 5.93**; vs surface **7.81 / 6.29**; vs elevated **7.15 / 6.29** |
| `--ck-color-fg-subtle` | Placeholders, captions, disabled-looking-but-readable | `#7C8294` | `#676A72` | vs canvas **5.13 / 5.10**; vs surface **4.79 / 5.41** |
| `--ck-color-accent` | Primary buttons, active states | `#9D8FFF` | `#3F35D6` | — |
| `--ck-color-accent-fg` | Text on accent | `#0A0B10` | `#FFFFFF` | on accent **7.31 / 7.80** |
| `--ck-color-accent-hover` | Hover fill | `#B5ABFF` | `#3128B8` | fg on hover **9.58 / 9.88** |
| `--ck-color-accent-soft` | Tinted backgrounds (selected row, chip) | `#1C1838` | `#E9E7FB` | accent-text on soft **6.31 / 6.42** |
| `--ck-color-accent-text` | Links, accent-coloured text | `#9D8FFF` | `#3F35D6` | vs canvas **7.31 / 7.35**; vs surface **6.83 / 7.80** |
| `--ck-color-secondary` | Second gradient stop, secondary marks | `#4FE3E0` | `#0B7A76` | vs canvas 12.54 / 5.17 (T2 vs surface) |
| `--ck-color-secondary-fg` | Text on secondary | `#0A0B10` | `#FFFFFF` | 12.54 / 5.17 |
| `--ck-color-success` / `-fg` / `-soft` | Positive status | `#4ADE80` / `#0A0B10` / `#10241A` | `#176F42` / `#FFFFFF` / `#E4F3EA` | fg-on-solid **11.28 / 6.20**; success-on-canvas **11.28 / 5.84**; success-on-soft **9.35 / 5.40** |
| `--ck-color-warning` / `-fg` / `-soft` | Attention, pending | `#FBBF24` / `#0A0B10` / `#2A2210` | `#9A5B00` / `#FFFFFF` / `#FCF0DC` | **11.78 / 5.43**; on-canvas **11.78 / 5.11**; on-soft **9.42 / 4.82** |
| `--ck-color-danger` / `-fg` / `-soft` | Destructive, failed | `#FB7185` / `#0A0B10` / `#2A1219` | `#C8203A` / `#FFFFFF` / `#FBE7EA` | **7.30 / 5.64**; on-canvas **7.30 / 5.31**; on-soft **6.51 / 4.76** |
| `--ck-color-info` / `-fg` / `-soft` | Neutral-informative | `#60A5FA` / `#0A0B10` / `#101C2E` | `#1D5FBF` / `#FFFFFF` / `#E3ECFA` | **7.73 / 6.10**; on-canvas **7.73 / 5.75**; on-soft **6.73 / 5.13** |
| `--ck-color-ring` | Focus ring | `#9D8FFF` | `#3F35D6` | vs canvas **7.31 / 7.35** (≥3:1 ✓) |
| `--ck-color-inverse` / `-inverse-fg` | Inverted blocks (Theme 2 footer, T1 light callout) | `#F2F4F8` / `#0A0B10` | `#17181C` / `#FAF8F3` | 17.85 / 16.71 |
| `--ck-gradient-brand` | Hero text, CTA glow | `linear-gradient(135deg,#9D8FFF 0%,#4FE3E0 100%)` | `linear-gradient(135deg,#3F35D6 0%,#0B7A76 100%)` | text over gradient is never body text; display text ≥ 3:1 at both stops (T1 stops vs canvas 7.31 & 12.54; T2 white-on-stops 7.80 & 5.17) |
| `--ck-gradient-glow` | Radial ambient glow | `radial-gradient(60% 60% at 50% 40%, rgba(124,108,255,0.35) 0%, rgba(124,108,255,0) 70%)` | `radial-gradient(60% 60% at 50% 40%, rgba(63,53,214,0.10) 0%, rgba(63,53,214,0) 70%)` | decorative |
| `--ck-color-grain` | Film-grain overlay opacity | `0.06` | `0.03` | decorative |

### 5.3 Typography

**Families (Google Fonts, self-hosted via `next/font/google`, `display: swap`, subsets `latin`, `latin-ext`):**

| Token | Theme 1 | Theme 2 | Fallback stack |
|-------|---------|---------|----------------|
| `--ck-font-display` | **Space Grotesk** (variable 300–700) | **Fraunces** (variable, `opsz` 9–144, `wght` 300–700, `SOFT` 0) | `ui-sans-serif, system-ui` / `ui-serif, Georgia, serif` |
| `--ck-font-body` | **Inter** (variable, `cv11`, `ss01`, `tnum` on for numbers) | **Inter** (same) | `system-ui, -apple-system, Segoe UI, Roboto, sans-serif` |
| `--ck-font-mono` | **JetBrains Mono** (400, 500) | JetBrains Mono | `ui-monospace, SFMono-Regular, Menlo, monospace` |

Font budget: ≤ 3 families, ≤ 5 files, ≤ 180 KB woff2 total per theme; `size-adjust`/`ascent-override` on fallbacks tuned so CLS < 0.02 during swap (docs/11).

**Scale (root 16px phone/tablet/laptop/desktop; 17px at `2xl`; 18px at `tv`). Sizes use `clamp()` so they are fluid between `md` and `xl`.**

| Token | Size | Line-height | Weight (T1 / T2) | Letter-spacing (T1 / T2) | Family | Use |
|-------|------|-------------|------------------|--------------------------|--------|-----|
| `display-xl` | `clamp(3rem, 2rem + 5vw, 6rem)` (48→96px) | 1.0 | 700 / 500 | −0.03em / −0.015em | display | Hero headline only |
| `display-lg` | `clamp(2.5rem, 1.75rem + 3.5vw, 4.5rem)` (40→72px) | 1.05 | 700 / 500 | −0.025em / −0.012em | display | Chapter titles |
| `h1` | `clamp(2.25rem, 1.75rem + 2vw, 3rem)` (36→48px) | 1.1 | 700 / 500 | −0.02em / −0.01em | display | Page titles |
| `h2` | `clamp(1.75rem, 1.4rem + 1.25vw, 2.25rem)` (28→36px) | 1.15 | 600 / 500 | −0.015em / −0.008em | display | Section titles |
| `h3` | `1.5rem` (24px) | 1.25 | 600 / 500 | −0.01em / 0 | display | Card titles, admin page titles |
| `h4` | `1.25rem` (20px) | 1.3 | 600 / 600 | 0 | body | Sub-sections, widget titles |
| `body-lg` | `1.125rem` (18px) | 1.6 | 400 | 0 | body | Lede paragraphs, product long description |
| `body` | `1rem` (16px) | 1.6 | 400 | 0 | body | Default |
| `body-sm` | `0.875rem` (14px) | 1.5 | 400 | 0 | body | Tables, admin density, meta |
| `caption` | `0.75rem` (12px) | 1.4 | 500 | 0.01em | body | Timestamps, helper text |
| `overline` | `0.75rem` (12px) | 1.2 | 600 | 0.08em, uppercase | body | Chapter numbers, eyebrow labels |
| `mono` | `0.875rem` (14px) | 1.5 | 400 | 0 | mono | Order numbers, UTR, license keys, code |
| `price` | `1.5rem` (24px) | 1.2 | 600 | −0.01em, `font-variant-numeric: tabular-nums` | body | Offering price |

Measure: body paragraphs max `65ch`; lede `55ch`; display `18ch`. Minimum text size anywhere: 12px. Admin tables default to `body-sm`.

### 5.4 Spacing

Base 4px (`--spacing: 0.25rem`). Named tokens for layout rhythm (identical in both themes unless noted):

| Token | Value | Use |
|-------|-------|-----|
| `--ck-space-gutter` | `1rem` (phone) · `1.5rem` (md) · `2rem` (lg+) | Page side padding |
| `--ck-space-section-y` | `clamp(4rem, 8vw, 8rem)` T1 · `clamp(5rem, 10vw, 10rem)` T2 | Vertical rhythm between site sections |
| `--ck-space-chapter-y` | `100svh` min-height per story chapter (lg+); `auto` with `4rem` padding below `lg` | Story chapters (D-801) |
| `--ck-space-card` | `1.25rem` (20px) phone · `1.5rem` (24px) md+ | Card padding |
| `--ck-space-stack-xs/sm/md/lg/xl` | 4 / 8 / 16 / 24 / 40px | Vertical stacks in forms and lists |
| `--ck-space-inline-sm/md/lg` | 8 / 12 / 16px | Horizontal gaps in button groups, chips |
| `--ck-space-admin-page` | `1.5rem` | Admin content padding |

### 5.5 Radius

| Token | Theme 1 | Theme 2 | Applied to |
|-------|---------|---------|------------|
| `--ck-radius-xs` | 4px | 2px | Chips, checkbox |
| `--ck-radius-sm` | 6px | 4px | Inputs (admin), table cells, tags |
| `--ck-radius-md` | 10px | 6px | Buttons, inputs (site), shadcn `--radius` |
| `--ck-radius-lg` | 14px | 8px | Cards, popovers |
| `--ck-radius-xl` | 20px | 12px | Modals, sheets, hero panels |
| `--ck-radius-2xl` | 28px | 16px | Product hero media, glass panels |
| `--ck-radius-full` | 9999px | 9999px | Avatars, pill badges, toggles |

### 5.6 Borders

| Token | Value | Use |
|-------|-------|-----|
| `--ck-border-hairline` | `1px solid var(--ck-color-border)` | Dividers, card edges |
| `--ck-border-input` | `1px solid var(--ck-color-border-strong)` | Inputs (3:1 boundary) |
| `--ck-border-focus` | `2px solid var(--ck-color-ring)` with `outline-offset: 2px` | Focus-visible everywhere |
| `--ck-border-glass` | `1px solid rgba(255,255,255,0.10)` T1 · `1px solid rgba(23,24,28,0.08)` T2 | Glass panel edge |
| `--ck-border-accent` | `1px solid var(--ck-color-accent)` | Selected offering, active tab (Theme 2 uses 2px bottom rule instead) |

### 5.7 Shadows and glows

| Token | Theme 1 | Theme 2 |
|-------|---------|---------|
| `--ck-shadow-1` | `0 1px 2px rgba(0,0,0,0.6)` | `0 1px 2px rgba(23,24,28,0.06)` |
| `--ck-shadow-2` | `0 4px 12px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.04) inset` | `0 2px 8px rgba(23,24,28,0.08), 0 1px 2px rgba(23,24,28,0.04)` |
| `--ck-shadow-3` | `0 12px 32px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.05) inset` | `0 8px 24px rgba(23,24,28,0.10), 0 2px 6px rgba(23,24,28,0.05)` |
| `--ck-shadow-4` | `0 24px 64px rgba(0,0,0,0.6)` | `0 20px 48px rgba(23,24,28,0.14)` |
| `--ck-shadow-glow` | `0 0 0 1px rgba(157,143,255,0.35), 0 0 24px rgba(124,108,255,0.45), 0 0 64px rgba(79,227,224,0.18)` | `0 0 0 1px rgba(63,53,214,0.18), 0 6px 20px rgba(63,53,214,0.16)` |
| `--ck-shadow-glow-hover` | `0 0 0 1px rgba(157,143,255,0.6), 0 0 32px rgba(124,108,255,0.6), 0 0 96px rgba(79,227,224,0.25)` | `0 0 0 1px rgba(63,53,214,0.3), 0 10px 28px rgba(63,53,214,0.22)` |

Rule: at most one `shadow-glow` element in the viewport at rest (primary CTA or the hero panel). Cards get glow only on hover.

### 5.8 Blur / glass

| Token | Theme 1 | Theme 2 |
|-------|---------|---------|
| `--ck-blur-glass` | `16px` | `12px` |
| `--ck-blur-header` | `20px` | `12px` |
| `--ck-blur-overlay` | `4px` | `2px` |
| `--ck-glass-saturate` | `140%` | `110%` |

Glass = `background: var(--ck-color-glass); backdrop-filter: blur(var(--ck-blur-glass)) saturate(var(--ck-glass-saturate)); border: var(--ck-border-glass)`. Fallback when `backdrop-filter` unsupported: `background: var(--ck-color-elevated)`. Glass is limited to header, hero panel, mobile drawer and modal — never on scrolling lists (INP budget).

### 5.9 Z-index

| Token | Value | Layer |
|-------|-------|-------|
| `--ck-z-below` | −1 | Grain, glow, 3D canvas behind hero content |
| `--ck-z-base` | 0 | Content |
| `--ck-z-raised` | 10 | Cards on hover, sticky table header |
| `--ck-z-sticky` | 100 | Sticky offering selector, chapter progress rail |
| `--ck-z-header` | 200 | Site header, admin top bar |
| `--ck-z-dropdown` | 300 | Menus, popovers, selects |
| `--ck-z-drawer` | 400 | Mobile drawer, admin sidebar (mobile) |
| `--ck-z-overlay` | 500 | Scrims |
| `--ck-z-modal` | 600 | Dialogs, sheets |
| `--ck-z-toast` | 700 | Toasts |
| `--ck-z-tooltip` | 800 | Tooltips |
| `--ck-z-skip` | 900 | Skip-to-content link |

### 5.10 Motion tokens

| Token | Theme 1 | Theme 2 | Use |
|-------|---------|---------|-----|
| `--ck-motion-duration-xs` | 100ms | 100ms | Colour/opacity on hover |
| `--ck-motion-duration-sm` | 160ms | 180ms | Buttons, chips, toggles |
| `--ck-motion-duration-md` | 240ms | 280ms | Menus, popovers, tabs |
| `--ck-motion-duration-lg` | 400ms | 480ms | Modals, sheets, drawers |
| `--ck-motion-duration-xl` | 700ms | 800ms | Page transitions, chapter reveals |
| `--ck-motion-duration-hero` | 1200ms | 1400ms | Hero intro |
| `--ck-motion-ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | `cubic-bezier(0.25, 0.1, 0.25, 1)` | Default |
| `--ck-motion-ease-emphasized` | `cubic-bezier(0.05, 0.7, 0.1, 1)` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entrances |
| `--ck-motion-ease-exit` | `cubic-bezier(0.3, 0, 0.8, 0.15)` | `cubic-bezier(0.4, 0, 1, 1)` | Exits |
| `--ck-motion-ease-gsap` | `expo.out` | `power2.out` | GSAP tweens |
| `--ck-motion-spring-ui` | `{ type:'spring', stiffness: 420, damping: 32, mass: 1 }` | `{ type:'spring', stiffness: 300, damping: 34, mass: 1 }` | Motion (framer) hover/press |
| `--ck-motion-spring-hero` | `{ stiffness: 170, damping: 26, mass: 1.2 }` | `{ stiffness: 140, damping: 28, mass: 1.2 }` | Hero pointer parallax |
| `--ck-motion-stagger-sm` | 40ms | 50ms | List items, chips |
| `--ck-motion-stagger-md` | 70ms | 90ms | Cards in a grid |
| `--ck-motion-stagger-lg` | 110ms | 130ms | Chapter elements |
| `--ck-motion-hover-lift` | `translateY(-4px) scale(1.01)` | `translateY(-2px)` | Card hover |
| `--ck-motion-parallax-max` | 12% | 6% | Max parallax travel of any layer |

Spring tokens are exported from `styles/motion.ts` (typed object keyed by theme name read from CSS `--ck-motion-*` strings with `JSON.parse`) so Motion and GSAP read the same source.

### 5.11 Breakpoints and containers (D-012)

| Name | Min width | Tailwind | Root font | `--ck-container` | Grid columns | Type scaling | Motion / 3D |
|------|-----------|----------|-----------|------------------|--------------|--------------|-------------|
| phone | 0 | (default) | 16px | `100% − 2rem` | 4 | scale min values | 2D simplified: opacity + ≤ 24px translate; no pin; **no 3D** (poster) |
| tablet | 640 / 768 | `sm` / `md` | 16px | `100% − 3rem` (max 720px at `md`) | 8 | fluid | 2D full; no pin; no 3D (poster) |
| laptop | 1024 | `lg` | 16px | 960px | 12 | fluid | pin + scrub chapters; 3D if `deviceMemory ≥ 4` and not `saveData` |
| desktop | 1280 | `xl` | 16px | 1200px | 12 | scale max values reached | full |
| large | 1536 | `2xl` | 17px | 1400px | 12 | ×1.0625 via root | full; hero canvas DPR capped 1.5 |
| TV | 1920 | `tv` | 18px | 1600px (content never exceeds; hero media may bleed) | 12 | ×1.125 via root; measure stays 65ch | full; hero canvas DPR capped 1.0; hover states also exposed on focus (remote-control navigation) |

Touch targets ≥ 44×44px on phone/tablet; ≥ 32×32px pointer-only admin density. **Admin app minimum supported width is 1024px (`lg`)** (MASTER_SPEC §7 "Admin minimum width"): below `lg` only the Approvals inbox, payment confirmation (orders queue + confirm dialog) and the Notification inbox render a read-mostly layout; every other admin screen renders the read-only "Open on a laptop" notice (docs/07 §3.4). Narrows D-012 for admin; founder may override.

---

## 6. Component specifications

Every component lives in `components/ui` (shadcn primitive) or `components/{site,account,admin}` (composed). Each spec lists: anatomy, variants, sizes, states, tokens, a11y. Motion is referenced from §7.

### 6.1 Buttons

| Variant | Fill | Text | Border | Hover | Active | Notes |
|---------|------|------|--------|-------|--------|-------|
| `primary` | `accent` | `accent-fg` | none | `accent-hover` + `shadow-glow` (T1) / `shadow-2` (T2) | scale 0.98 | One per view section. Hero primary CTA ("Start a project", D-802) uses `size="xl"`. |
| `secondary` | `elevated` | `fg` | `border-strong` | `border: accent`, text `accent-text` | scale 0.98 | Hero secondary CTA ("Explore products"). |
| `outline` | transparent | `fg` | `border-strong` | fill `accent-soft` | — | Admin default |
| `ghost` | transparent | `fg-muted` | none | fill `accent-soft`, text `fg` | — | Toolbars, table row actions |
| `link` | none | `accent-text`, underline on hover | none | `accent-hover` | — | Inline |
| `destructive` | `danger` | `danger-fg` | none | darker: T1 `#E11D48` with white text (4.70:1) / T2 `#A81A30` white (7.35:1) | — | Always behind confirm dialog |
| `gradient` | `gradient-brand` | `#0A0B10` (T1, 5.10:1 at darkest stop) / `#FFFFFF` (T2, 5.17:1 at lightest stop) | none | glow-hover | — | Landing only, max one per page |

Sizes: `sm` 32px h / 12px x-pad / body-sm · `md` 40 / 16 / body · `lg` 48 / 20 / body · `xl` 56 / 28 / body-lg (landing only) · `icon-sm/md/lg` 32/40/48 square. Radius `radius-md`; `xl` uses `radius-lg`. Font weight 600. Icon gap 8px; leading icon 16px (`sm`), 20px otherwise.

States: `disabled` opacity 0.5 + `cursor: not-allowed` (text still ≥ 4.5:1 at full opacity, so disabled state is exempt per WCAG 1.4.3). `loading`: label kept, 16px spinner replaces leading icon, `aria-busy="true"`, width locked. `focus-visible`: `border-focus`. Press: Motion `whileTap={{ scale: 0.98 }}` with `spring-ui`.

### 6.2 Inputs and forms

- **Text / email / number / password / textarea:** height 40px (44px on touch), `surface` fill, `border-input`, `radius-md`, padding 12px, `body` text `fg`, placeholder `fg-subtle` (4.79 / 5.41). Hover: `border-color: fg-subtle`. Focus: border `accent` + `border-focus` ring. Error: border `danger`, helper text `danger` (7.30 / 5.31) with `lucide:circle-alert` 16px, `aria-invalid`, `aria-describedby`. Disabled: fill `canvas`, text `fg-subtle`. Read-only: no border, `fg-muted`.
- **Label:** `body-sm` 600 `fg`, 6px above. Required = `*` in `danger` plus `aria-required`. Optional fields say "(optional)" — checkout (D-410): company, billing address, GST number.
- **Helper text:** `caption` `fg-muted`, 6px below.
- **Select / Combobox:** shadcn Select (Radix); popover `elevated` + `shadow-3`, item height 36px, selected item `accent-soft` + `accent-text` + check icon.
- **Checkbox / Radio / Switch:** 20px; unchecked `border-strong`; checked `accent` fill with `accent-fg` check. Switch 44×24 track, knob 20px, motion `spring-ui`. Radio cards (offering selector §6.13, payment method choice) 100% width, `border-hairline`, selected `border-accent` + `accent-soft` fill.
- **File upload (admin media, receipts):** dashed `border-strong` 2px, `radius-lg`, drop-state fill `accent-soft`; shows accepted types and size cap from `files_upload_intents` rules.
- **Currency / money input:** `mono` numerals, currency code prefix chip, right-aligned, stores integer minor units (MASTER_SPEC §4.8).
- **OTP input (flag):** 6 boxes 48×56, `mono` 24px.
- **Form layout:** single column ≤ `md`; 2-column 24px gap at `lg+` for checkout and admin forms. Submit row sticky at bottom on phone. Zod messages rendered under fields; summary `role="alert"` at top listing errors with anchor links.

### 6.3 Cards

Shared anatomy: `surface` fill, `border-hairline`, `radius-lg`, `shadow-1` (T1: plus `1px` inset highlight from `shadow-2`), padding `space-card`. Hover (pointer devices): `shadow-3` + `hover-lift`; T1 adds `shadow-glow` at 40% strength. Whole card is a single link (`<a>` wraps, inner buttons use `stopPropagation`).

| Card | Media | Content | Footer | Notes |
|------|-------|---------|--------|-------|
| **Product card** (`/products` grid, landing "What we sell") | 16:10 cover, `radius-md` inner, `object-cover`; "Coming soon" ribbon (`warning-soft`/`warning`) when `is_coming_soon`; "Featured" `overline` chip when `is_featured` | Category `overline` `fg-muted` · Name `h4` · Short description 2-line clamp `body-sm fg-muted` · Tags ≤ 3 chips | "From" price `price`-style 18px with strike-through original in `fg-subtle` when discount; purchase model chip (`one_time` "One-time" / `subscription` "Monthly|Quarterly|Annual" / `custom_quote` "Quote"); wishlist heart `icon-sm ghost` (Customer only) | Never shows partner (BR-02). Coming soon: no price, CTA "Notify me" disabled state → "Request customisation" link. |
| **Case-study card** (`/projects`) | 4:3 cover with client industry chip | Client name `overline` · Title `h3` · One-line result stat (e.g. "−38% checkout drop-off") in `accent-text` `price` style · Tech stack chips ≤ 4 | "Read case study →" `link` | Landing "Proof" chapter reuses in a horizontal scroller. |
| **Blog card** (`/blog` index, product page tease) | 16:9 cover optional | Product name `overline` · Title `h4` · Excerpt 3-line clamp · Reading time `caption` | Author avatar 24px + date | Theme 2 gives title `display` serif. |
| **Widget card** (admin dashboard, react-grid-layout) | — | Header 44px: title `h4`, `fg-muted` subtitle, right: refresh `ghost icon-sm`, drag handle `lucide:grip-vertical` (visible on hover/focus), menu | Body padding 16px; charts fill; empty state `fg-subtle` + icon | Loading: skeleton bars; error: `danger-soft` band with retry; `requiredPermission` failing hides the widget. Min size 2×2 grid units (unit = 120×80px). |
| **Stat card** | — | Label `overline` · Value 28px 600 `tnum` · Delta chip (success/danger) | — | Used inside widgets and account overview. |

### 6.4 Navigation

- **Site header:** 64px (56px phone), sticky, glass (`blur-header`) once `scrollY > 8` else transparent. Left logo (wordmark ≥ `md`, monogram below). Centre: Services · Products · Projects · Blog · Contact (`body` 500 `fg-muted`, hover/active `fg` with 2px `accent` underline animated width 0→100% `duration-sm`). Right: currency select (`ghost sm`), theme toggle (§10, hidden while `theme_light_editorial` is off), then **Visitor:** "Sign in" `ghost` + "Start a project" `primary sm` (opens the inquiry sheet §6.10); **Customer:** notification bell (§6.14) + avatar menu (Dashboard, Purchases, Queries, Settings, Sign out). Header hides on scroll-down > 80px and reappears on scroll-up (Motion `y: -100%`, `duration-md`); disabled with reduced motion (stays visible).
- **Mega vs compact:** Products item opens a **compact panel** (not a mega menu; catalogue < 50 and two-level categories, D-303): 2-column popover 560px — left: top-level categories with counts; right: 4 featured products as mini cards. On phone this becomes an accordion in the drawer. No mega menu anywhere.
- **Mobile drawer:** full-height right sheet 88vw max 360px, glass fill, `z-drawer`, Radix Dialog semantics (focus trap, `Esc`, scroll lock), staggered link entrance `stagger-sm`. Footer of drawer: theme toggle + currency + auth CTA.
- **Account sidebar** (`/account/*`): 240px, `surface`, `border-hairline` right. Items 40px, `lucide` 18px icon + `body-sm` 500; active `accent-soft` fill + `accent-text` + 3px left rule `accent`. Items (docs/07 §3.3): Overview · Purchases & access · Invoices & payments · Queries · Chat · Wishlist · Notifications (badge) · Settings. Below `lg` the sidebar is not rendered; the account shell uses a bottom tab bar (Overview, Purchases, Queries, Chat, More). `/checkout/[offeringId]` and `/quote/[token]` use the minimal account shell (sidebar collapsed).
- **Admin sidebar** (`admin.<domain>`): 256px collapsible to 64px icon rail (state in `localStorage`), `surface`, shadcn Sidebar. Groups (docs/07 §3.4): Overview (Dashboard, Approvals [badge `danger` pill], Notifications [badge]) · Catalog (Products, Categories, Coupons) · Commerce (Orders, Quotes, Customers, Entitlements, Delivery tasks) · Growth (Leads, Queries, Chatbot) · Finance (Ledger, Allocations, Partners & payouts, Expenses, Adjustments, Reports, Statements) · Content (Landing, Services, Case studies, Testimonials, Logos, FAQs, Legal) · System (Settings, Audit log, Admin users). Admin top bar 56px: breadcrumb, global search (`⌘K`), "Create" menu, environment badge, notification bell, avatar. Below `lg` the sidebar becomes a `Sheet` listing only Approvals, Orders (payment confirmation) and Notifications (§5.11). Admin app never uses glass or glow (P4).
- **Breadcrumbs:** `body-sm fg-muted`, `lucide:chevron-right` 14px separators, last item `fg`. Emits `BreadcrumbList` JSON-LD on public pages.
- **Footer:** 4 columns at `lg` (docs/07 §3.2: wordmark + positioning line + theme toggle · Explore · Company · Legal), no email/phone/social (D-808, X-rejections), no newsletter box. Theme 2 footer is inverse (`inverse` fill).
- **Skip link:** first focusable, `z-skip`, appears at top-left on focus.

### 6.5 Hero (landing chapter 0)

Anatomy (grid 12): overline "CodeKraft — software studio" · `display-xl` headline (gradient text on ≤ 2 words only, rest `fg`) · lede `body-lg fg-muted` max 55ch · CTA row: `primary xl` "Start a project" (opens the project inquiry sheet §6.10, which posts to the same `createLead` action as `/contact` — MASTER_SPEC §7) + `secondary xl` "Explore products" (→ `/products`) · trust row: client logos (`client_logos`, greyscale `fg-subtle` opacity 0.7, colour on hover) · scroll cue (`lucide:arrow-down` bouncing, hidden with reduced motion).

3D canvas (§12) occupies columns 7–12 at `lg+` (right 50%), full-bleed behind text at `md`, and is replaced by the **poster** (`hero-poster.webp`, 1600×1000, ≤ 120 KB, AVIF preferred) below `lg` or when the device/preference checks fail. Poster is the LCP element on mobile and is `priority` + `fetchpriority="high"`. Text column always sits on solid `canvas` with a 0→canvas gradient over the canvas edge so contrast never depends on the scene.

### 6.6 Story chapter section (D-801)

Five chapters from `landing_chapters` (`who`, `build`, `sell`, `proof`, `talk`), each `min-height: 100svh` at `lg+`. Anatomy: chapter number `overline` ("01 / Who we are") · `display-lg` title · body (`body-lg`, max 55ch) · chapter media (image, product cards, case-study scroller, testimonial, or inquiry form for `talk`) · optional CTA. A vertical **progress rail** (fixed right, 4px, `border` track, `accent` fill, chapter dots with tooltips) appears at `lg+`; it is `nav` with `aria-label="Story chapters"` and links jump with native anchor scroll (`scroll-margin-top: 64px`). Chapter transitions per §7.2. Theme 2 renders chapter numbers in serif italic and replaces the rail with a left-margin running head.

### 6.7 Tables

TanStack Table + shadcn Table. Row height 44px (admin `body-sm`), 52px (account). Header `overline` `fg-muted` sticky (`z-raised`), `border-hairline` rows, zebra none; hover row `accent-soft` at 50% opacity. Numeric columns right-aligned `tnum`; money via `lib/money.format()` with currency code. Row actions: `ghost icon-sm` kebab → Dropdown. Selection: leading checkbox column (bulk actions bar slides in `duration-md`). Sorting: header click, `lucide:arrow-up-down` 14px. Pagination: 25/50/100, `body-sm`. Empty: 160px centred `fg-subtle` icon + text + optional primary action. Loading: 5 skeleton rows. Mobile (< `md`): account tables become stacked cards; admin tables scroll horizontally with first column pinned. Ledger table: `mono` for amounts, negative amounts in `danger`, immutable rows show `lucide:lock` 14px `fg-subtle` (BR-17).

### 6.8 Badges and status chips

Chip: height 24px (20px `sm`), padding 0 10px, `radius-full` (T1) / `radius-xs` (T2), `caption` 600, leading 6px dot. Tones and tokens:

| Tone | Fill | Text | Dot |
|------|------|------|-----|
| `neutral` | `elevated` | `fg-muted` | `fg-subtle` |
| `accent` | `accent-soft` | `accent-text` | `accent` |
| `info` | `info-soft` | `info` | `info` |
| `success` | `success-soft` | `success` | `success` |
| `warning` | `warning-soft` | `warning` | `warning` |
| `danger` | `danger-soft` | `danger` | `danger` |
| `ghost` | transparent + `border-hairline` | `fg-subtle` | none |

**Mapping of every status enum in docs/05** (`lib/status-tone.ts` is the single source; chips call `tone(enumName, value)`):

| Enum (table) | Value → tone / label |
|--------------|---------------------|
| `users.status` | active → success "Active" · suspended → warning "Suspended" · deleted → ghost "Deleted" |
| `products.status` | draft → neutral "Draft" · pending_approval → warning "Pending approval" · scheduled → info "Scheduled" · published → success "Published" · unpublished → neutral "Unpublished" · archived → ghost "Archived" |
| `product_blogs.status` | draft → neutral · published → success |
| `offerings.status` | active → success · inactive → ghost |
| `offerings.purchase_model` | one_time → accent "One-time" · subscription → info "Subscription" · custom_quote → neutral "Quote" |
| `offerings.delivery_type` / `entitlements.delivery_type` | saas → info "SaaS" · hosted → info "Hosted" · download → accent "Download" · license → accent "License" · service → warning "Service" · custom → neutral "Custom" |
| `product_ownerships.status` | pending → warning · active → success · superseded → ghost |
| `custom_quotes.status` | draft → neutral · sent → info · accepted → accent · paid → success · expired → ghost · cancelled → danger |
| `orders.status` | pending_payment → warning "Pending payment" · paid → success "Paid" · fulfilled → success "Fulfilled" (with `lucide:package-check`) · failed → danger "Failed" · cancelled → ghost "Cancelled" · refunded → danger "Refunded" · partially_refunded → warning "Partially refunded" |
| `orders.type` | product → accent "Product" · project → info "Project" |
| `payments.status` | initiated → neutral "Awaiting reference" · submitted → warning "Reference submitted" · confirmed → success "Confirmed" · failed → danger "Failed" · refunded → danger "Refunded" |
| `payments.provider` | manual_upi → neutral "UPI" · manual_bank → neutral "Bank transfer" · razorpay/stripe/paypal → neutral (flag) |
| `entitlements.status` | pending → warning "Pending" · active → success "Active" · suspended → warning "Suspended" · expired → ghost "Expired" · revoked → danger "Revoked" |
| `entitlements.provisioning_state` | n/a → ghost "—" · pending → warning "Provisioning" · done → success "Provisioned" |
| `subscriptions.status` | trialing → info "Trial" · active → success "Active" · past_due → warning "Past due" (grace, D-521) · suspended → danger "Suspended" · cancelled → ghost "Cancelled" |
| `delivery_tasks.status` | open → warning "Open" · done → success "Done" |
| `delivery_tasks.kind` | provision → info "Provision" · revoke_external → danger "Revoke external" |
| `approval_requests.status` | pending → warning "Awaiting approval" · approved → info "Approved" · rejected → danger "Rejected" · applied → success "Applied" · cancelled → ghost "Cancelled" |
| `approval_requests.type` | product.publish → accent "Publish" · ownership.change → accent "Ownership change" · project_order.split → accent "Project order split" · ledger.adjustment → warning "Ledger adjustment" · refund.issue → danger "Refund" · payout.record → info "Payout" · product.archive → ghost "Archive" · product.delete → danger "Delete" · admin.user_change → warning "Admin user change" |
| `approval_decisions.decision` | approve → success · reject → danger |
| `leads.status` | new → accent "New" · contacted → info "Contacted" · qualified → info "Qualified" · proposal → warning "Proposal" · won → success "Won" · lost → ghost "Lost" |
| `leads.priority` | low → ghost · normal → neutral · high → danger |
| `leads.source` | inquiry_form → neutral "Form" · product_cta → accent "Product CTA" · chatbot → info "Chatbot" · manual → neutral "Manual" |
| `lead_activities.kind` | note → neutral · status_change → info · assignment → accent · follow_up_set → warning · email → neutral · call → neutral (timeline icons `lucide:sticky-note`, `arrow-right-left`, `user-plus`, `alarm-clock`, `mail`, `phone`, not chips) |
| `queries.status` | open → warning "Open" · waiting_customer → info "Waiting on customer" · resolved → success "Resolved" · closed → ghost "Closed" |
| `queries.source` | form → neutral "Form" · chatbot → info "Chatbot" · order → accent "Order" · dashboard → neutral "Dashboard" · email → neutral "Email" (admin-logged) · manual → neutral "Manual" |
| `query_messages.author_kind` | customer → accent · admin → info · system → ghost (rendered as bubble colour, not chip) |
| `chat_messages.role` | user → accent bubble · assistant → surface bubble · menu → accent-soft quick-reply buttons · system → hidden |
| `ledger_entries.entry_type` | sale → success · discount → warning · tax_collected → info · gateway_fee → neutral · bank_charge → warning · company_cut → accent · partner_allocation → accent · refund_sale / refund_discount / refund_tax / refund_company_cut / refund_partner_allocation → danger (labels "Refund: sale / discount / tax / company cut / partner allocation") · payout → info · expense → warning · adjustment → danger (with `lucide:shield-check` when approved) |
| `ledger_entries.party_type` | customer/company/partner/tax_authority/gateway/bank → neutral text, no chip |
| `email_outbox.status` | queued → warning · sent → success · failed → danger |
| `job_runs.status` | ok → success · error → danger |
| `media.visibility` | public → neutral "Public" · private → accent "Private" |
| `offerings.billing_interval` | monthly → info "Monthly" · quarterly → info "Quarterly" · annual → info "Annual" |
| `entitlements.update_policy` | all_free → success "All updates" · during_access → info "Updates during access" · major_paid → neutral "Major versions paid" |
| `coupons.kind` | percent → accent "%" · fixed → accent "Fixed" (plus derived coupon state: active → success · scheduled → info · expired → ghost · exhausted → warning · inactive → ghost) |
| `faqs.scope` | site → neutral "Site" · chatbot → info "Chatbot only" · product → accent "Product" |
| `testimonials.context` | site → neutral "Site" · product → accent "Product" |
| `slug_redirects.entity` | product / case_study / blog → neutral labels (admin slug-history list) |
| `users.theme_pref` | dark-cinematic → "Dark cinematic" · light-editorial → "Light editorial" · null → "Site default" (text, not chip; never "dark/light mode") |
| `product_media.kind` | image/screenshot/gallery/video_embed/video_file/presentation/attachment/og → neutral labels |
| Overdue follow-up (`leads.next_follow_up_at < now`, D-706) | danger chip "Overdue" + row left rule `danger` |
| Product flags | is_featured → accent "Featured" · is_unlisted → ghost "Unlisted" · is_coming_soon → warning "Coming soon" · is_refundable → success "Refundable" · tax_enabled → neutral "Tax" |

Never use colour alone: every chip has a text label; overdue rows also get the `lucide:alarm-clock` icon.

### 6.9 Toasts

shadcn `sonner` at bottom-right (`lg+`) / top-centre (phone), width 360px, `elevated` + `shadow-3` + `border-hairline`, `radius-lg`, 4px left rule in tone colour, icon 20px, title `body-sm` 600, body `body-sm fg-muted`, optional action `link`. Duration 5s (success/info), 8s (warning), persistent with close for danger. Enter: `y: 16→0, opacity 0→1` `duration-md` `ease-emphasized`; max 3 stacked. `aria-live="polite"` (danger: `assertive`). Admin real-time notifications (docs/04 §7.5) reuse the toast with the bell badge increment.

### 6.10 Modals and sheets

- **Dialog:** Radix Dialog, `elevated`, `radius-xl`, `shadow-4`, max-width 480 (`sm`), 640 (`md`), 880 (`lg`); padding 24px; header `h3` + close `ghost icon-sm`; footer right-aligned actions (secondary then primary). Scrim `overlay` + `blur-overlay`. Enter: scale 0.96→1, opacity, `duration-lg` `ease-emphasized`; exit `duration-md` `ease-exit`. Below `md` dialogs become bottom sheets (drag-to-dismiss via Motion, 24px handle).
- **Confirm dialog (destructive / approval):** title states the consequence ("Revoke access for order CK-ORD-000123?"), body lists effects, primary is `destructive`. For dual-approval actions (BR-13) the dialog explains "This creates an approval request for the other admin" and the primary is `primary` "Request approval".
- **Sheet:** side panel 480px (`lg+`), full width below; used for project inquiry from hero (D-802), quick view of an order in admin, lead detail, notification inbox. Same tokens as dialog with `radius-xl` on the inner edge.

### 6.11 Tabs

Radix Tabs. Site/account: underline style — list `border-hairline` bottom, trigger `body` 500 `fg-muted` 40px, active `fg` with 2px `accent` indicator that slides (Motion `layoutId`, `spring-ui`). Admin: segmented style — `surface` track, `radius-md`, active `elevated` + `shadow-1`. Product page tabs (SCR-SITE-04): Overview · Features · Testimonials · FAQs · Changelog · Presentation; the product blog is not a tab but a teaser card section linking to `/blog/[slug]` (MASTER_SPEC §7 "Blog on product page"). Keyboard: arrow keys, `Home`/`End`.

### 6.12 Pricing / offering selector (A-301)

On the product page, a sticky (at `lg+`, `z-sticky`, top 80px) panel 360px wide, `surface`, `radius-xl`, `border-hairline`, T1 `shadow-glow` at 50%. Anatomy: product name `h4` · offering radio cards (one per active offering): name `body` 600, `price` in display currency (converted via `fx_rates` with "≈" prefix when not a configured price — D-502), strike-through discount, billing interval chip, trial line `caption`, delivery type chip, license type `caption`, access period `caption` ("Lifetime" / "12 months") · selected card expands to show included features · payment method icons enabled for the offering (UPI, Bank) · CTA `primary lg` full width: "Buy now" (`one_time`), "Subscribe" (`subscription`), "Request a quote" (`custom_quote`) · secondary `link` "Request customisation" (→ lead, D-315) · below: refund policy line (`is_refundable`), tax note ("+ tax" when `tax_enabled`, BR-08). Coming soon (`is_coming_soon`): panel shows "Coming soon" chip, CTA replaced by "Notify me" `secondary` (creates lead). Already-owned one-time (BR-10): CTA disabled "Owned — open in dashboard" `link`. Single-offering product shows one pre-selected card, no radio.

### 6.13 Steps / checklist

- **Checkout stepper** (Details → Payment → Confirm): horizontal at `md+`, numbered 28px circles (`accent` for done/current with `accent-fg`, `border-strong` outline for upcoming), connector 2px `border` / `accent` fill animates `duration-lg`. Labels `body-sm`. `aria-current="step"`.
- **Service checklist** (D-608, product-plus-service): vertical list; each step 44px row with 20px state icon (`lucide:circle` `fg-subtle` open · `lucide:loader-circle` `info` spinning in progress (static with reduced motion) · `lucide:circle-check` `success` done), title `body`, admin note `caption fg-muted`, completed timestamp. Progress bar above: 6px `border` track, `accent` fill, `role="progressbar"` with `aria-valuenow`. Fulfilled when all done → order chip turns "Fulfilled".
- **Delivery timeline** (order detail): pending_payment → paid → provisioning/delivered → fulfilled with timestamps; same visual language.

### 6.14 Notification bell and inbox

Bell `ghost icon-md`, badge `danger` 16px pill with count (99+), `aria-label="Notifications, 3 unread"`. Click opens popover (`lg+`, 400×520, `elevated`, `shadow-3`) or sheet (phone). Items 64px: 8px unread dot `accent`, title `body-sm` 600, body 1-line clamp `fg-muted`, relative time `caption`; click navigates to `link` and marks read. Header: "Notifications" + "Mark all read" `link`. Tabs: All · Unread. Empty: `lucide:bell-off` + "You're up to date". Polling per docs/04 §7.5 (10s admin, 30s customer); new item → badge bump animation (scale 1→1.25→1, `duration-sm`) and toast. Admin inbox page `/notifications` on the admin host (SCR-ADM-33) lists all with filters (persisted inbox, D-707); polling uses `GET /api/notifications?since=` on both hosts (docs/06 §3.8).

### 6.15 QR / payment instruction panel (D-501, D-516)

Shown on the order page while `orders.status = pending_payment`. Panel `surface`, `radius-xl`, `border-hairline`, two columns at `md+`:
- **Left — method tabs** (only enabled methods for the offering): **UPI**: QR 224×224px on white tile (`#FFFFFF` fill, 16px padding, `radius-md` — QR always renders on white in both themes for scanner reliability), VPA in `mono` with copy button, amount `price` with currency code, order number `mono`, "Open in UPI app" `secondary` button on mobile (`upi://` intent). **Bank transfer**: account name, account number, IFSC, bank, amount — each row label `caption fg-muted` / value `mono` + copy `ghost icon-sm`; "Copied" toast.
- **Right — reference form:** "After paying, enter the UTR / transaction reference" `body`; input `mono`; optional note; `primary` "Submit reference". On submit → `payments.status = submitted` chip "Reference submitted" + info banner "We confirm payments manually within one business day" (R-401). Expiry countdown `caption warning` "Order expires in 6 days 23 h" (BR-10). Failed payment → `danger-soft` banner with "Retry payment" (D-416).
- Amount received / shortfall / overpayment are admin-only fields (order detail in admin): `warning` chip "Shortfall ₹40" when `bank_shortfall_minor > 0`; `info` chip "Overpaid ₹120 · customer credit" when `customer_credit_minor > 0` (MASTER_SPEC §7 "Overpayment"; never allocated to partners).

### 6.16 Invoice preview (BR-16, D-414)

Web preview mirrors the PDF from `pdf/invoice.tsx`: A4 ratio white sheet (`#FFFFFF` always, ink `#17181C`, accent rule `#3F35D6` — invoices are not themed) inside a `surface` frame with `shadow-3`; header: mono logo left, "TAX INVOICE"/"INVOICE" + `CK/2026-27/0001` `mono` right; seller/buyer snapshot blocks; line table (description, qty, unit, discount, tax %, amount) with `tnum`; totals block; GST breakdown (CGST/SGST/IGST) only when `gst_breakdown` present (D-1501); footer legal line and "Paid via UPI · ref …". Actions: "Download PDF" `primary sm`, "Email me a copy" `ghost sm`. Credit notes use the same layout with `danger` accent rule and "CREDIT NOTE".

### 6.17 Data-visualisation palette (Recharts)

Tokens `--ck-chart-1..7` (categorical, in series order) and `--ck-chart-seq-1..5` (sequential, light→dark for heat/intensity). All categorical marks ≥ 3:1 against `surface` (they are drawn on cards).

| Series | Theme 1 (on `#12141C`) | Theme 2 (on `#FFFFFF`) | Semantic assignment (fixed so colours mean the same thing across widgets) |
|--------|------------------------|------------------------|----------------------------------------------------------------------------|
| chart-1 | `#9D8FFF` (6.83:1) | `#3F35D6` (7.80:1) | Revenue / primary series / company |
| chart-2 | `#4FE3E0` (11.73:1) | `#0B7A76` (5.17:1) | Partner A (CEO) share |
| chart-3 | `#F5B83D` (10.33:1) | `#B4502E` (5.09:1) | Partner B (CFO) share / expenses |
| chart-4 | `#FB7185` (6.83:1) | `#C8203A` (5.64:1) | Refunds / lost / errors |
| chart-5 | `#4ADE80` (10.55:1) | `#176F42` (5.84:1) | Won / fulfilled / paid |
| chart-6 | `#60A5FA` (7.23:1) | `#1D5FBF` (6.10:1) | Leads / traffic |
| chart-7 | `#E879F9` (7.47:1) | `#8A2BA8` (7.02:1) | Chatbot usage |
| seq-1…5 | `#2A2560` · `#4B3FA8` · `#6F60E0` · `#9D8FFF` · `#C4BBFF` | `#DCD9F8` · `#B3ABF2` · `#8478E6` · `#5A50E8` · `#241C8F` | Heatmaps (visits by hour), funnel intensity |

Grid lines `border`; axis text `fg-muted` `caption`; tooltip = `elevated` card with `shadow-3`; active bar/dot gets 2px `fg` outline (not just colour). Line stroke 2px, area fill at 18% opacity, bar radius `radius-xs`. Pies limited to ≤ 5 slices with labels; partner-share pie uses chart-1/2/3 fixed. Charts respect reduced motion (`isAnimationActive={false}`). Recharts reads colours via a `useChartTokens()` hook that resolves CSS variables once per theme change.

### 6.18 Other primitives (brief)

Avatar (32/40 circle, initials on `accent-soft`), Tooltip (`inverse` fill `inverse-fg`, `caption`, 6px radius, 300ms delay), Skeleton (`elevated` shimmer 1.4s; static with reduced motion), Accordion (FAQs; chevron rotates `duration-sm`), Pagination, Progress, Separator, Command palette (admin `⌘K`, `elevated`, `shadow-4`), Empty state (icon 40px `fg-subtle`, title `h4`, body `fg-muted`, action), Banner/Alert (tone `-soft` fill + tone text + 4px left rule; used for grace-period, order expiry, GSTIN-not-set warnings), Code block (`mono` on `canvas`, copy button — license keys, instructions), Rich text (`prose` styles: `body-lg` at site, `body` in admin; Tiptap output sanitised; links `accent-text`; blockquote 3px `accent` left rule — Theme 2 uses serif italic), Chat bubble (user `accent` fill/`accent-fg` right; assistant `surface` left; quick replies as `outline sm` chips wrap; streaming caret 1px blink).

---

## 7. Motion system (D-904, D-907, D-1303)

### 7.1 Page transitions

- Next.js App Router with a `components/motion/PageTransition.tsx` wrapper (Motion `AnimatePresence` `mode="wait"` keyed on pathname): exit `opacity 1→0` `duration-sm`; enter `opacity 0→1, y 12→0` `duration-md` `ease-emphasized`. No shared-element transitions in release 1. Admin app: no page transition (instant), only content fade `duration-xs`.
- Lenis smooth scroll on public pages only (`lerp: 0.1`, `wheelMultiplier: 1`, `smoothTouch: false`); disabled below `lg`, with reduced motion, and on account/admin routes. Lenis is registered as the GSAP ticker source so ScrollTrigger and Lenis share one RAF.

### 7.2 Scroll chapters (GSAP ScrollTrigger)

Rules, enforced by code review and the Lighthouse CI budget (docs/11):

1. **Only `transform` and `opacity` are animated.** Never `top/left/width/height/filter/backdrop-filter/box-shadow` in a scrub. (docs/04 §13.)
2. **Pinning is allowed only at `lg+`** and only for the chapter's media column, with `pinSpacing: true` (no layout jump), `anticipatePin: 1`. Chapters are **never scroll-jacked**: no `scroll-snap-type: mandatory`, no wheel hijacking; the user's scroll position always maps 1:1 to document position. (R-801 mitigation.)
3. **Scrub** = `scrub: 0.6` (slight smoothing) for media parallax; text reveals use one-shot `toggleActions: "play none none reverse"` at `start: "top 75%"`.
4. **Parallax limits:** any layer's total travel ≤ `--ck-motion-parallax-max` of its own height (12% T1, 6% T2). Background glow travel ≤ 8%. No horizontal parallax on text.
5. **Reveal recipe:** children `opacity 0→1, y 24→0` (T1) / `y 16→0` (T2), stagger `stagger-lg`, `duration-xl`, `ease-gsap`. Display titles additionally use a `clip-path: inset(0 0 100% 0) → inset(0)` line-mask reveal (SplitType lines) at `lg+` only.
6. **Chapter enter/exit:** previous chapter media fades to 0.35 opacity and scales 0.98 as the next enters (`scrub`), giving depth without pinning text.
7. **Progress rail** driven by `ScrollTrigger.create({ onUpdate })` writing a CSS variable `--chapter-progress` (no React state per frame).
8. **`will-change: transform`** is applied by GSAP only while a trigger is active; `matchMedia` (`gsap.matchMedia()`) defines three contexts: `(min-width: 1024px) and (prefers-reduced-motion: no-preference)` full; `(max-width: 1023px) and (prefers-reduced-motion: no-preference)` simplified; `(prefers-reduced-motion: reduce)` static.
9. Every trigger is killed on route change; `ScrollTrigger.refresh()` runs after fonts load and after the hero canvas mounts.
10. **INP guard:** no scroll handler does DOM reads; `ScrollTrigger.config({ limitCallbacks: true, ignoreMobileResize: true })`.

### 7.3 Micro-interactions (Motion)

| Element | Interaction | Spec |
|---------|-------------|------|
| Buttons | hover / tap | background `duration-sm`; `whileTap scale 0.98` `spring-ui`; T1 primary glow fades in `duration-md` |
| Cards | hover | `hover-lift` `spring-ui`; image inside scales 1.03 `duration-lg` |
| Nav underline | hover / active | width 0→100% `duration-sm` `ease-standard` |
| Chips / toggles | change | `spring-ui` |
| Inputs | focus | border colour `duration-xs`; ring appears instantly (no animation on focus indicators) |
| Accordion | open | height auto via Radix + `duration-md` |
| Tabs indicator | change | `layoutId` `spring-ui` |
| Toasts | enter/exit | §6.9 |
| Numbers (stats, prices in hero) | in view | count-up 900ms `expo.out`, once; static with reduced motion |
| Wishlist heart | toggle | scale 1→1.3→1 `duration-sm` + fill |
| Copy button | click | icon swap `lucide:copy` → `lucide:check` 1.5s |
| Skeleton | loading | shimmer 1.4s linear |
| Hero pointer parallax | mousemove | layers translate ≤ 8px, `spring-hero`; disabled on touch |

Hover effects apply only under `@media (hover: hover) and (pointer: fine)`; touch devices get the active/press state instead.

### 7.4 Reduced motion (`prefers-reduced-motion: reduce`, D-907)

Interpretation of "animations off": **all motion-based animation is removed** (transforms, parallax, pinning, scrub, smooth scroll, count-ups, shimmer, hover lift, page-transition translate, 3D scene). **Opacity-only crossfades ≤ 200 ms are retained** for state changes (toast appear, tab content, dialog) because they are not vestibular triggers and removing them harms comprehension. Implementation: global CSS `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; } }` plus `useReducedMotion()` (Motion) and `gsap.matchMedia()` contexts; the hero mounts the poster. An in-app "Reduce motion" switch in account Settings (and in the site footer for visitors, stored in cookie `ck_motion=reduce`) forces the same path for users who cannot change the OS setting.

### 7.5 Mobile downgrade (< `lg`)

No pin, no Lenis, no 3D, no pointer parallax, no glass on scrolling content, reveal translate ≤ 24px, stagger halved, no line-mask reveals. Total JS for landing on phone ≤ 170 KB gzipped (GSAP core + ScrollTrigger ≈ 30 KB; three.js chunk is never requested).

---

## 8. 3D hero guidelines (D-904, D-1605)

**Scene concept — "The Kraft Mark":** the logo monogram K extruded as a faceted glass-metal object (bevelled, `MeshPhysicalMaterial` with `transmission 0.6`, `roughness 0.25`, `ior 1.4`, `thickness 1.2`) floating over a subtle wireframe grid plane, lit by one key light (`#9D8FFF`) and one rim light (`#4FE3E0`) whose colours are read from tokens (`--ck-color-accent`, `--ck-color-secondary`) so Theme 2 gets indigo/teal automatically against a bright environment. Around it, 120 instanced particles (`InstancedMesh`) drift slowly on a sine field. Pointer moves the camera ≤ 6° (`spring-hero`); scroll (0→1 over the hero height) rotates the K 25° and pulls the camera back 15% (`transform`-equivalent camera changes only). Idle rotation 0.15 rad/s. No post-processing passes in release 1 (bloom is faked with the CSS `gradient-glow` behind the canvas). Environment: `drei <Environment preset="city" />` replaced by a 64×32 HDR (≤ 40 KB) shipped in `public/hdr/studio-small.hdr`.

**Performance budget:** three + r3f + drei chunk ≤ 190 KB gzipped, loaded via `next/dynamic({ ssr: false })` only when `IntersectionObserver` sees the hero, after `requestIdleCallback`, and only if all gates pass: viewport ≥ `lg`, `prefers-reduced-motion: no-preference`, `navigator.deviceMemory ≥ 4` (undefined counts as pass), `navigator.connection.saveData !== true`, WebGL2 available, `feature flag three_hero` on. DPR = `min(devicePixelRatio, 1.5)` (1.0 at `tv`). Target 60 fps on M1/Intel Iris; auto-degrade: if `drei <PerformanceMonitor>` reports < 40 fps for 2 s, particles drop to 40 then the canvas is frozen to a single frame (still image). Canvas paused when tab hidden or hero out of view (`frameloop="demand"` + `invalidate()` on interaction). Total main-thread work on mount ≤ 150 ms (measured via Long Tasks in CI Lighthouse).

**Load strategy:** poster is painted first in all cases (LCP element); the canvas fades in over it (`opacity duration-xl`) once the first frame is rendered (`onCreated` → `gl.render` → state), so LCP never depends on WebGL and CLS is 0 (canvas is absolutely positioned inside the same box).

**Fallback:** `hero-poster.{avif,webp}` rendered from the same scene at 1600×1000 per theme (`hero-poster-dark.avif`, `hero-poster-light.avif`, both ≤ 120 KB). Poster gets a CSS-only slow zoom (1.0→1.04 over 20 s) — removed with reduced motion. On WebGL context loss the poster returns.

**Accessibility:** canvas has `role="img"` `aria-label="Abstract 3D CodeKraft monogram"`, is not focusable, and all hero text lives outside it in DOM.

---

## 9. Accessibility checklist (WCAG 2.1 AA, D-907)

- [ ] Every text/background pair in both theme sheets ≥ 4.5:1; large text (≥ 24px or ≥ 19px bold) ≥ 3:1; UI boundaries and focus indicators ≥ 3:1 (`tests/unit/tokens.test.ts`).
- [ ] Colour never the sole carrier of meaning: chips have labels, charts have direct labels or legend + pattern on hover, form errors have icon + text.
- [ ] Focus visible everywhere (`:focus-visible` ring 2px `ring` + 2px offset); no `outline: none` without replacement; focus order follows reading order; focus trapped in dialogs/drawers and returned on close (Radix).
- [ ] Keyboard: all interactions reachable; `Esc` closes overlays; arrow keys in tabs/menus/radio-cards; skip link; `⌘K` palette has a button alternative.
- [ ] Semantics: one `h1` per page; landmarks (`header`, `nav`, `main`, `aside`, `footer`); tables with `<th scope>`; icon-only buttons have `aria-label`; live regions for toasts, chat streaming (`aria-live="polite"`), payment status changes.
- [ ] Forms: visible labels (no placeholder-as-label), `autocomplete` attributes at checkout, errors linked via `aria-describedby`, error summary focus on submit.
- [ ] Motion: reduced-motion path (§7.4) + in-app switch; nothing flashes > 3 times/s; autoplaying hero canvas has no audio and can be paused via the "Reduce motion" switch (WCAG 2.2.2).
- [ ] Zoom: layouts work at 200% zoom and 320px width (reflow, 1.4.10); text spacing override (1.4.12) does not clip chips or buttons (`min-height`, no fixed heights on text containers).
- [ ] Touch targets ≥ 44px on touch breakpoints; 24px minimum spacing between adjacent small targets.
- [ ] Media: images have `alt` from `product_media.alt` (admin-required field); video embeds have captions or a transcript link; presentation PDFs have a text summary.
- [ ] Language: `<html lang="en">`; currency and dates formatted with `Intl` in the user's locale; `dir` supported (no RTL content in release 1 but layout uses logical properties).
- [ ] Timeouts: admin 30-min idle logout warns 2 minutes before with an extend button (2.2.1).
- [ ] Automated: `eslint-plugin-jsx-a11y`, `@axe-core/playwright` on every e2e page in both themes, Lighthouse a11y ≥ 95 gate.
- [ ] Manual: screen-reader pass (VoiceOver Safari, NVDA Firefox) on landing, product, checkout, payment panel, dashboard, admin order confirm — recorded in `docs/10`.

---

## 10. Theme-switch mechanics (D-905, D-011)

- **Attribute:** `<html data-theme="dark-cinematic" | "light-editorial">`. Also `color-scheme: dark | light` set in each theme sheet so native controls and scrollbars match. `<meta name="theme-color">` is updated by the toggle (`#0A0B10` / `#FAF8F3`).
- **Resolution order (server):** (1) authenticated `users.theme_pref` if not null → (2) cookie `ck_theme` → (3) `site_settings.default_theme` (admin-set, D-905) → (4) `dark-cinematic`. If the resolved value is `light-editorial` but flag `theme_light_editorial` is off, fall back to (3)/(4) and hide the toggle.
- **Persistence:** cookie `ck_theme=<value>; Path=/; Max-Age=31536000; SameSite=Lax; Secure` set by a Server Action on toggle (so it is available to SSR); for logged-in users the same action also writes `users.theme_pref` (per device **and** per account, D-905). Account setting page exposes the same control. On login, if `theme_pref` is set it overrides the device cookie and the cookie is refreshed to match.
- **No flash of wrong theme:**
  - Dynamic routes (`(account)`, `(admin)`, `(auth)`): `app/layout.tsx` reads cookies/session on the server and renders the attribute — zero flash, no script.
  - Cached public routes (`(site)`, ISR): the HTML is shared across visitors, so the server renders the **admin default** and a **≤ 300-byte inline script in `<head>`** (before any stylesheet paint, `nonce`d for CSP) reads `document.cookie` for `ck_theme` and sets `document.documentElement.dataset.theme` synchronously. Because both theme sheets are in the same CSS file, no additional request is needed and paint happens once. The toggle component hydrates from the attribute, not from props, to avoid hydration mismatch (`suppressHydrationWarning` on `<html>`).
  - The hero poster `<picture>` uses two `<source>` elements selected by CSS variable is impossible, so the poster is swapped by the toggle client-side; both posters are `preload`ed only for the active theme (the inline script also injects the matching `<link rel=preload>`).
- **Toggle component:** `components/site/ThemeToggle.tsx` — a 2-option segmented control (icons `lucide:moon-star` / `lucide:sun`, labels "Cinematic" / "Editorial", `role="radiogroup"`), in the header and in the mobile drawer; hidden entirely when the flag is off. Switching animates a 400 ms crossfade of `canvas` via `transition: background-color` on `html` and `body` (skipped with reduced motion); components do not animate their own colour change.
- **Testing:** Playwright runs every public and account e2e in both themes; Storybook (if used) has a theme toolbar switching the attribute on the preview `html`.

---

## 11. Iconography

**Library:** `lucide-react` only (tree-shaken, `strokeWidth 1.75`, `absoluteStrokeWidth`), sizes 14 (table meta), 16 (inline/chips/buttons `sm`), 20 (buttons, nav), 24 (empty states, feature lists), 40 (empty-state hero). Colour inherits `currentColor`. Decorative icons `aria-hidden`; standalone icons have `aria-label` or are inside a labelled button. Custom icons (UPI, bank, the K monogram) are SVG components in `components/ui/icons/` matching lucide's 24-grid and 1.75 stroke. Payment method glyphs: `lucide:qr-code` (UPI), `lucide:landmark` (bank). Delivery types: `cloud` (saas), `server` (hosted), `download` (download), `key-round` (license), `list-checks` (service), `wand-sparkles` (custom). No emoji as icons. Theme 2 uses the same icons at `strokeWidth 1.5`.

---

## 12. Imagery and illustration guidance

- **Photography:** none of people in release 1 (X-006 no founder showcase). Product imagery = real UI screenshots captured at 2× on the product's own dark/light UI, framed in a device-less browser chrome (`components/site/ScreenFrame`, `radius-2xl`, `border-glass`). Case-study covers = abstract renders or client-approved screenshots.
- **Abstract art:** generated from the 3D scene (stills of the K, particle fields) and CSS gradients — a consistent "material" language. Theme 1 stills on `#0A0B10`; Theme 2 stills on `#FAF8F3` with the indigo/teal lighting.
- **Illustration:** line illustrations only (1.75 stroke, `fg-subtle`, single `accent` highlight) for empty states, 404, chatbot avatar, "coming soon". No flat-vector people scenes.
- **Grain:** Theme 1 applies a 256×256 tiled noise PNG (≤ 6 KB) at `--ck-color-grain` opacity via `body::before` (`pointer-events: none`, `mix-blend-mode: overlay`, `z-below`); disabled below `md` for paint cost.
- **Image delivery:** `next/image`, AVIF → WebP, `sizes` per breakpoint table, LQIP blur placeholder from `media.blur_hash`, `alt` from `product_media.alt` (mandatory in admin uploads), aspect ratio reserved (CLS 0). Product gallery max 1600px wide. OG images 1200×630 generated by `app/api/og` in the theme the admin set as default.
- **Video:** embed-first (A-1402) inside `ScreenFrame`, poster required, no autoplay with sound, `loading="lazy"` iframe.

---

## 13. Do / Don't

| Do | Don't |
|----|-------|
| Use semantic tokens via Tailwind utilities (`bg-surface`) | Hardcode hex or use arbitrary values in components |
| Put one glowing/gradient element per viewport | Stack glows, gradients and glass on the same panel |
| Animate `transform`/`opacity` only | Animate layout properties, `filter` or `box-shadow` on scroll |
| Keep text on solid `canvas`/`surface` | Place body text over the 3D canvas, gradients or imagery |
| Use status chips from `lib/status-tone.ts` | Invent ad-hoc colours for a status |
| Show currency code with every amount (`INR 4,999`, `₹` optional prefix) | Show bare numbers or floats |
| Say "Product", "Offering", "Entitlement", "Query" (MASTER_SPEC §3) | Say "plan", "SKU", "license" (for entitlement), "ticket" in UI copy |
| Design admin screens dense, flat and fast | Bring glass, glow or page transitions into admin |
| Provide reduced-motion and mobile paths for every scroll effect | Ship a chapter that only works at desktop with motion on |
| Test both themes in CI | Assume Theme 2 can be "added later" without token discipline |
| Use lucide icons with labels | Use emoji, icon fonts or colour-only indicators |
| Let the K monogram be the only brand symbol | Add badges, ribbons, stickers or mascots |

---

## 14. Deliverables checklist for implementation

- `src/styles/tokens.css` (primitives, `@theme inline` bridge, shadcn aliases, reduced-motion global rule).
- `src/styles/themes/dark-cinematic.css`, `src/styles/themes/light-editorial.css` — exact blocks in `ui/theme-01/dark-cinematic.md` §6 and `ui/theme-02/light-editorial.md` §6.
- `src/styles/motion.ts` — typed motion tokens for Motion/GSAP.
- `lib/status-tone.ts` — enum → tone map from §6.8.
- `components/ui/*` shadcn set (button, input, textarea, select, checkbox, radio-group, switch, dialog, sheet, tabs, table, badge, toast/sonner, tooltip, popover, dropdown-menu, command, accordion, progress, skeleton, avatar, separator, sidebar, breadcrumb, pagination) — installed unmodified except for size/variant additions listed here.
- `components/site/*` (Header, Footer, ThemeToggle, Hero, StoryChapter, ProgressRail, ProductCard, CaseStudyCard, BlogCard, OfferingSelector, PaymentPanel, InquirySheet, ScreenFrame), `components/motion/*` (PageTransition, Reveal, CountUp, useChapter), `components/three/*` (HeroScene, HeroPoster, gates).
- `public/brand/` logo SVG set (§3), `public/hero/hero-poster-{dark,light}.{avif,webp}`, `public/noise.png`, `public/hdr/studio-small.hdr`.
- `tests/unit/tokens.test.ts` (token parity + contrast), `tests/e2e/*` run in both themes, Lighthouse CI budgets (docs/11).

---

## 15. Open inconsistencies

All items previously listed here are resolved by `MASTER_SPEC.md` §7 or the spine documents:

1. Resolved: reduced motion = no motion-based animation, opacity crossfades ≤ 200 ms retained (§7.4; MASTER_SPEC §7 "Reduced motion").
2. Resolved: ISR public pages set `data-theme` with a ≤ 300-byte nonce'd inline head script; the theme-saving Server Action refreshes the cookie (§10; MASTER_SPEC §7 "Theme attribute on ISR pages", docs/04 §7.9, docs/06 API-AUTH-04).
3. Resolved: shadcn's `dark:` variant is neutralised and lint-blocked in `components/**` (§4.3); no spine change needed.
4. Resolved: widgets use ≤ 7 categorical series (`--ck-chart-1..7`); SCR-ADM-02 states the cap.
5. Resolved: "Start a project" opens an inquiry sheet posting to the same lead action as `/contact`; `/contact` keeps the full-page form (§6.5; docs/07 §9, SCR-SITE-01; MASTER_SPEC §7).
6. Resolved: no scroll-jacking; pin-with-spacing at `lg+` only (§7.2; MASTER_SPEC §7 "Scroll behaviour" rewords R-801).
7. Resolved: Theme 2 token CSS ships in release 1; the V1.1 item is the toggle, posters and QA (§4.1; MASTER_SPEC §7 "Theme 2 in release 1").
8. Resolved: admin minimum width 1024 px with read-mostly phone layouts for approvals, payment confirmation and notifications only (§5.11; docs/07 §3.4; MASTER_SPEC §7 "Admin minimum width").
9. Resolved: account `users.theme_pref` beats the device cookie once set and the cookie is refreshed by API-AUTH-04 (§10).
10. Resolved: invoices, credit notes, statements and emails are always ink-on-white (§3.3, §6.16; docs/07 §4.16; MASTER_SPEC §7 "Print/PDF/email theming").
