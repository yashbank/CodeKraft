# Theme 2 — `light-editorial`

**Implements:** D-903 (off-white canvas, large serif headlines + clean sans body, generous spacing, subtle motion), D-011, D-905, D-907; `docs/08-DESIGN-SYSTEM.md` token contract §4–§5. Toggle ships in **V1.1** (D-1602) behind `theme_light_editorial`; the token sheet ships in release 1 so the contract is complete and tested from day one. No dark variant of this theme exists (X-013).
**File:** `src/styles/themes/light-editorial.css` — the CSS block in §6 is the source of truth.

---

## 1. Mood

A well-set magazine. The canvas is a warm off-white (`#FAF8F3`), surfaces are pure white lifted by soft warm shadows, and the ink is a near-black (`#17181C`) rather than grey. Headlines are Fraunces — a soft, high-contrast serif with optical sizing — set large and light (weight 500), with generous leading and margins. Body stays Inter so reading and forms feel identical to Theme 1. The single accent is a deep indigo (`#3F35D6`) with a muted teal (`#0B7A76`) as its gradient partner; a terracotta (`#B4502E`) appears only in charts and pull-quote rules for editorial warmth. Motion is slower and travels less: things settle rather than snap. There is no glow, almost no glass, no grain; depth comes from paper-like shadows and rules. The result should read as premium, calm and confident — the "print" counterpart to Theme 1's "screen".

Reference points: Stripe Press (serif + whitespace), The Browser Company's site (warm off-white), Pentagram case-study pages (large type, rules).

---

## 2. What changes vs Theme 1 and what stays identical

| Stays identical (by contract) | Changes (tokens only) |
|-------------------------------|-----------------------|
| Every layout, grid, breakpoint, container width | All colour tokens |
| Component anatomy, sizes, states, behaviour, ARIA | Display family Space Grotesk → **Fraunces** (weight 700 → 500, tighter tracking relaxed, italics for chapter numbers/pull quotes) |
| Spacing base (4px), stack/inline tokens, admin density | `--ck-space-section-y` larger (`clamp(5rem,10vw,10rem)`), card padding +4px at `md+` |
| Z-index scale | Radius scale smaller (10 → 6px buttons, 14 → 8px cards) |
| Iconography (lucide), icon sizes | Icon `strokeWidth` 1.75 → 1.5 |
| Status → tone mapping (`lib/status-tone.ts`) | Chip shape pill → 2px-radius rectangle; tone colours darker for light backgrounds |
| Motion choreography (which elements animate, in what order) | Durations +15–20 %, easings softer, parallax max 12 % → 6 %, hover lift 4px → 2px, no glow transitions |
| 3D hero scene geometry and gates | Light colours (indigo key, teal rim), brighter environment, poster `hero-poster-light.avif` |
| Invoice/PDF/email (always ink on white) | — |
| Reduced-motion, mobile downgrade paths | — |
| Chart series semantics (chart-1 = revenue, etc.) | Chart colour values |
| Copy, terminology, status labels | — |

---

## 3. Semantic token value sheet (complete)

### 3.1 Colour

| Token | Value | Notes |
|-------|-------|-------|
| `--ck-color-canvas` | `#FAF8F3` | Warm off-white page |
| `--ck-color-surface` | `#FFFFFF` | Cards, inputs |
| `--ck-color-elevated` | `#FFFFFF` | Popovers (distinguished by `shadow-3`, not colour) |
| `--ck-color-glass` | `rgba(255, 255, 255, 0.78)` | Header only |
| `--ck-color-overlay` | `rgba(23, 24, 28, 0.48)` | Modal scrim |
| `--ck-color-border` | `#E4E0D6` | Hairlines |
| `--ck-color-border-strong` | `#86827A` | Input borders (3.83:1 on white) |
| `--ck-color-fg` | `#17181C` | Ink |
| `--ck-color-fg-muted` | `#5D6068` | Secondary text |
| `--ck-color-fg-subtle` | `#676A72` | Placeholders, captions (5.41:1 on white) |
| `--ck-color-fg-serif-muted` | `#4A4D55` | Muted serif (pull quotes, chapter numbers) |
| `--ck-color-accent` | `#3F35D6` | Primary fill |
| `--ck-color-accent-fg` | `#FFFFFF` | Text on accent |
| `--ck-color-accent-hover` | `#3128B8` | |
| `--ck-color-accent-active` | `#241C8F` | Pressed |
| `--ck-color-accent-soft` | `#E9E7FB` | Tinted fill |
| `--ck-color-accent-text` | `#3F35D6` | Links |
| `--ck-color-accent-solid` | `#3F35D6` | Same as accent (white text already passes) |
| `--ck-color-secondary` | `#0B7A76` | Gradient stop 2 |
| `--ck-color-secondary-fg` | `#FFFFFF` | |
| `--ck-color-secondary-soft` | `#E1F1F0` | |
| `--ck-color-tertiary` | `#B4502E` | Terracotta: pull-quote rule, chart-3, editorial highlights |
| `--ck-color-success` | `#176F42` | |
| `--ck-color-success-fg` | `#FFFFFF` | |
| `--ck-color-success-soft` | `#E4F3EA` | |
| `--ck-color-warning` | `#9A5B00` | |
| `--ck-color-warning-fg` | `#FFFFFF` | |
| `--ck-color-warning-soft` | `#FCF0DC` | |
| `--ck-color-danger` | `#C8203A` | |
| `--ck-color-danger-fg` | `#FFFFFF` | |
| `--ck-color-danger-soft` | `#FBE7EA` | |
| `--ck-color-danger-solid` | `#A81A30` | Destructive hover |
| `--ck-color-info` | `#1D5FBF` | |
| `--ck-color-info-fg` | `#FFFFFF` | |
| `--ck-color-info-soft` | `#E3ECFA` | |
| `--ck-color-ring` | `#3F35D6` | Focus ring |
| `--ck-color-inverse` | `#17181C` | Footer, tooltips, inverted callouts |
| `--ck-color-inverse-fg` | `#FAF8F3` | |
| `--ck-color-inverse-fg-muted` | `#B5B8C0` | Footer secondary text (8.94:1) |
| `--ck-color-grain` | `0` | No grain |
| `--ck-color-scrollbar` | `#C9C4B8` | |
| `--ck-gradient-brand` | `linear-gradient(135deg, #3F35D6 0%, #0B7A76 100%)` | Gradient text/buttons (white text ≥ 5.17:1 at every stop) |
| `--ck-gradient-brand-muted` | `linear-gradient(135deg, rgba(63,53,214,0.08) 0%, rgba(11,122,118,0.06) 100%)` | Card hover wash |
| `--ck-gradient-glow` | `radial-gradient(60% 60% at 50% 40%, rgba(63,53,214,0.10) 0%, rgba(63,53,214,0) 70%)` | Hero ambient, very faint |
| `--ck-gradient-glow-cyan` | `radial-gradient(40% 40% at 80% 60%, rgba(11,122,118,0.08) 0%, rgba(11,122,118,0) 70%)` | |
| `--ck-gradient-fade-canvas` | `linear-gradient(90deg, #FAF8F3 0%, rgba(250,248,243,0.85) 40%, rgba(250,248,243,0) 100%)` | |
| `--ck-gradient-section` | `linear-gradient(180deg, #FAF8F3 0%, #F3F0E8 50%, #FAF8F3 100%)` | Alternate chapter background |
| `--ck-chart-1…7` | `#3F35D6` `#0B7A76` `#B4502E` `#C8203A` `#176F42` `#1D5FBF` `#8A2BA8` | Categorical |
| `--ck-chart-seq-1…5` | `#DCD9F8` `#B3ABF2` `#8478E6` `#5A50E8` `#241C8F` | Sequential |
| `--ck-chart-grid` | `#E4E0D6` | |
| `--ck-chart-axis` | `#676A72` | (5.41:1 on white) |

### 3.2 Typography

| Token | Value |
|-------|-------|
| `--ck-font-display` | `"Fraunces", ui-serif, Georgia, "Times New Roman", serif` — variable axes `opsz 9–144`, `wght 300–700`, `SOFT 0`, `WONK 0` |
| `--ck-font-body` | `"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` |
| `--ck-font-mono` | `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace` |
| `--ck-font-features-body` | `"cv11", "ss01", "tnum"` |
| `--ck-font-features-display` | `"opsz" auto` via `font-optical-sizing: auto` |
| `--ck-text-display-xl` | `clamp(3rem, 2rem + 5vw, 6rem) / 1.02`, weight **500**, tracking `-0.015em` |
| `--ck-text-display-lg` | `clamp(2.5rem, 1.75rem + 3.5vw, 4.5rem) / 1.08`, 500, `-0.012em` |
| `--ck-text-h1` | `clamp(2.25rem, 1.75rem + 2vw, 3rem) / 1.12`, 500, `-0.01em` |
| `--ck-text-h2` | `clamp(1.75rem, 1.4rem + 1.25vw, 2.25rem) / 1.18`, 500, `-0.008em` |
| `--ck-text-h3` | `1.5rem / 1.3`, 500, `0` |
| `--ck-text-h4` | `1.25rem / 1.3`, 600, `0` (Inter) |
| `--ck-text-body-lg` | `1.125rem / 1.65`, 400 |
| `--ck-text-body` | `1rem / 1.65`, 400 |
| `--ck-text-body-sm` | `0.875rem / 1.5`, 400 |
| `--ck-text-caption` | `0.75rem / 1.4`, 500, `0.01em` |
| `--ck-text-overline` | `0.75rem / 1.2`, 600, `0.08em`, uppercase (Inter) |
| `--ck-text-mono` | `0.875rem / 1.5`, 400 |
| `--ck-text-price` | `1.5rem / 1.2`, 600, `-0.01em`, tabular (Inter) |
| `--ck-text-pullquote` | `clamp(1.5rem, 1.2rem + 1.5vw, 2rem) / 1.3`, Fraunces 400 italic |
| `--ck-display-weight` | `500` |
| `--ck-display-style` | `normal` (chapter numbers and pull quotes use `italic`) |
| `--ck-root-size` | `16px` (`17px` ≥ 1536, `18px` ≥ 1920) |

Fraunces is loaded with `next/font/google` `axes: ['opsz','SOFT','WONK']`, weights 300–700 as one variable file (≈ 95 KB woff2 latin); Inter and JetBrains Mono are shared with Theme 1 (already cached). Fallback `Georgia` gets `size-adjust: 104%; ascent-override: 92%` to keep CLS < 0.02.

### 3.3 Spacing, radius, borders

| Token | Value |
|-------|-------|
| `--ck-space-gutter` | `1rem` / `1.5rem` (≥768) / `2.5rem` (≥1024) |
| `--ck-space-section-y` | `clamp(5rem, 10vw, 10rem)` |
| `--ck-space-chapter-y` | `100svh` min-height ≥1024; `auto` + `5rem` below |
| `--ck-space-card` | `1.25rem` / `1.75rem` (≥768) |
| `--ck-space-stack-xs/sm/md/lg/xl` | `0.25rem` `0.5rem` `1rem` `1.5rem` `2.5rem` |
| `--ck-space-inline-sm/md/lg` | `0.5rem` `0.75rem` `1rem` |
| `--ck-space-admin-page` | `1.5rem` |
| `--ck-radius-xs/sm/md/lg/xl/2xl/full` | `2px` `4px` `6px` `8px` `12px` `16px` `9999px` |
| `--ck-border-hairline` | `1px solid #E4E0D6` |
| `--ck-border-input` | `1px solid #86827A` |
| `--ck-border-focus` | `2px solid #3F35D6` (+ `outline-offset: 2px`) |
| `--ck-border-glass` | `1px solid rgba(23,24,28,0.08)` |
| `--ck-border-accent` | `2px solid #3F35D6` (bottom rule on active tabs; 1px on selected radio cards) |
| `--ck-border-rule` | `1px solid #17181C` | Editorial full-width rules above section titles |
| `--ck-border-highlight` | `none` |

### 3.4 Shadows, blur

| Token | Value |
|-------|-------|
| `--ck-shadow-1` | `0 1px 2px rgba(23,24,28,0.06)` |
| `--ck-shadow-2` | `0 2px 8px rgba(23,24,28,0.08), 0 1px 2px rgba(23,24,28,0.04)` |
| `--ck-shadow-3` | `0 8px 24px rgba(23,24,28,0.10), 0 2px 6px rgba(23,24,28,0.05)` |
| `--ck-shadow-4` | `0 20px 48px rgba(23,24,28,0.14)` |
| `--ck-shadow-glow` | `0 0 0 1px rgba(63,53,214,0.18), 0 6px 20px rgba(63,53,214,0.16)` (primary CTA hover only) |
| `--ck-shadow-glow-hover` | `0 0 0 1px rgba(63,53,214,0.30), 0 10px 28px rgba(63,53,214,0.22)` |
| `--ck-shadow-glow-soft` | `0 0 0 1px rgba(63,53,214,0.10), 0 4px 14px rgba(63,53,214,0.10)` |
| `--ck-blur-glass` | `12px` |
| `--ck-blur-header` | `12px` |
| `--ck-blur-overlay` | `2px` |
| `--ck-glass-saturate` | `110%` |

### 3.5 Z-index

Identical to Theme 1 (`--ck-z-below: -1 … --ck-z-skip: 900`).

### 3.6 Motion

| Token | Value |
|-------|-------|
| `--ck-motion-duration-xs/sm/md/lg/xl/hero` | `100ms` `180ms` `280ms` `480ms` `800ms` `1400ms` |
| `--ck-motion-ease-standard` | `cubic-bezier(0.25, 0.1, 0.25, 1)` |
| `--ck-motion-ease-emphasized` | `cubic-bezier(0.16, 1, 0.3, 1)` |
| `--ck-motion-ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` |
| `--ck-motion-ease-gsap` | `power2.out` |
| `--ck-motion-spring-ui` | `{"type":"spring","stiffness":300,"damping":34,"mass":1}` |
| `--ck-motion-spring-hero` | `{"type":"spring","stiffness":140,"damping":28,"mass":1.2}` |
| `--ck-motion-stagger-sm/md/lg` | `50ms` `90ms` `130ms` |
| `--ck-motion-hover-lift` | `translateY(-2px)` |
| `--ck-motion-parallax-max` | `6%` |
| `--ck-motion-reveal-y` | `16px` (`8px` below 1024) |
| `--ck-motion-poster-zoom` | `0s` (no poster zoom) |

### 3.7 Breakpoints / containers

Identical to Theme 1 (`sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536 · tv 1920`; containers `100%−2rem · 720 · 960 · 1200 · 1400 · 1600`).

---

## 4. Background treatments

1. **Canvas base:** `#FAF8F3` on `html`/`body`; `color-scheme: light`. No grain (`--ck-color-grain: 0`; the `body::before` rule is not emitted for this theme).
2. **Hero:** flat canvas with the faint indigo glow (10 % alpha) behind the 3D object only; the text column sits on solid `#FAF8F3` through `--ck-gradient-fade-canvas`. A 1 px `#17181C` rule (`--ck-border-rule`) spans the container above the overline — the editorial "masthead" line.
3. **Chapter alternation:** 01/03/05 on canvas; 02/04 on `--ck-gradient-section` (peak `#F3F0E8`). Each chapter opens with a full-width `--ck-border-rule` and a running head at the left margin (`overline` "01 — Who we are") replacing Theme 1's vertical progress rail at `lg+` (the rail component still mounts; its tokens make it a 1 px ink line with serif numerals).
4. **Glass:** header only (`rgba(255,255,255,0.78)`, blur 12px, bottom hairline `#E4E0D6`). Drawer, dialogs and sheets are solid `#FFFFFF` with `shadow-4`.
5. **Section dividers:** full-container 1 px ink rules (`--ck-border-rule`) above `h2` titles; no gradient highlights.
6. **Pull quotes / testimonials:** Fraunces italic `--ck-text-pullquote`, 3 px left rule in `--ck-color-tertiary` (`#B4502E`), author in `overline`.
7. **Footer:** inverse block `#17181C` with `#FAF8F3` text and `#B5B8C0` secondary; monogram in `#FAF8F3`.
8. **Admin app:** canvas `#FAF8F3`, content `#FFFFFF`, shadows `shadow-1/2` only; identical structure to Theme 1 admin.

---

## 5. Component transformations in this theme

| Component | Appearance in `light-editorial` |
|-----------|--------------------------------|
| **Primary button** | `#3F35D6` fill, white text, radius 6px; hover `#3128B8` + `shadow-glow` (soft indigo shadow, no bloom); active `#241C8F` scale 0.98. `gradient` variant: indigo→teal, white text. |
| **Secondary button** | `#FFFFFF` fill, `#17181C` text, `#86827A` border; hover border `#3F35D6`, text `#3F35D6`. |
| **Outline / ghost** | Transparent; hover `#E9E7FB`. |
| **Destructive** | `#C8203A` fill, white text; hover `#A81A30`. |
| **Inputs** | White fill, `#86827A` border, ink text, `#676A72` placeholder; focus border `#3F35D6` + ring; error `#C8203A`. Radius 6px (site) / 4px (admin). |
| **Cards** | White, hairline `#E4E0D6`, `shadow-1`; hover lifts 2px to `shadow-3`; cover image scales 1.02; product card gets `--ck-gradient-brand-muted` wash on hover. Case-study and blog card titles in Fraunces 500. |
| **Widget cards (admin)** | White, `shadow-1`, no lift; charts use indigo/teal/terracotta series. |
| **Site header** | Transparent → white glass after 8px; nav underline `#3F35D6` 2px; logo ink `#17181C` with indigo K. |
| **Mobile drawer** | Solid white, `shadow-4`, links stagger 50ms; theme toggle bottom. |
| **Account sidebar** | `#FFFFFF` with right hairline; active `#E9E7FB` + `#3F35D6` text + 3px left rule. |
| **Admin sidebar** | `#FFFFFF`, active `#E9E7FB`; approvals badge `#C8203A` with white text. |
| **Hero** | Masthead rule, overline, Fraunces `display-xl` 500 (gradient text on ≤ 2 words, indigo→teal), lede `#5D6068`; canvas/poster right at ≥1024 in a bright environment; scroll cue is a thin ink arrow, slower bounce (2.2s). |
| **Story chapters** | Rules + running heads; chapter numbers in Fraunces italic `#4A4D55`; reveals travel 16px over 800ms `power2.out`; no line-mask reveal (words fade up as whole lines). |
| **Tables** | Header overline `#676A72` on white; rows hairline `#E4E0D6`; hover `rgba(233,231,251,0.6)`; ledger negatives `#C8203A`; lock icon `#676A72`. |
| **Chips** | 24px, radius 2px, tone soft fills (`#E9E7FB` `#E3ECFA` `#E4F3EA` `#FCF0DC` `#FBE7EA`) with 700-step text; `ghost` chip has `#C9C4B8` border. |
| **Toasts** | White, `shadow-3`, 4px tone rule, slide up 12px over 280ms. |
| **Dialog / Sheet** | White, radius 12px, `shadow-4`, scrim `rgba(23,24,28,0.48)` blur 2px, scale 0.97→1 in 480ms; phone bottom sheet. |
| **Tabs** | Underline style with 2px ink bottom rule on the list and `#3F35D6` indicator; admin segmented track `#F3F0E8`, active white + `shadow-1`. |
| **Offering selector** | Sticky white panel, radius 12px, `shadow-2`, 1px ink top rule; selected card `#E9E7FB` + 1px `#3F35D6` border; price ink 24px Inter 600. |
| **Stepper / checklist** | Done/current circles `#3F35D6` white numerals; connector `#E4E0D6` → `#3F35D6`; in-progress `#1D5FBF`; done `#176F42`. |
| **Notification bell** | Badge `#C8203A` white text; popover white `shadow-3`; unread dot `#3F35D6`. |
| **Payment panel** | White panel with ink top rule; QR tile white with `#E4E0D6` border; VPA/bank rows mono ink on `#F3F0E8` code blocks; expiry countdown `#9A5B00`. |
| **Invoice preview** | Unthemed white sheet on `#F3F0E8` frame with `shadow-2` (nearly flush with the page — intentional, print-like). |
| **Charts** | Grid `#E4E0D6`, axis `#676A72`, tooltip white `shadow-3`; area fills 14 %; active mark outlined `#17181C`. |
| **Chat** | User bubble `#3F35D6` white text; assistant `#FFFFFF` with hairline; quick replies outline chips; streaming caret `#0B7A76`. |
| **Tooltip** | Inverse: `#17181C` fill, `#FAF8F3` text. |
| **Skeleton** | `#F3F0E8` with shimmer `rgba(255,255,255,0.7)`. |
| **Scrollbar** | `scrollbar-color: #C9C4B8 #FAF8F3`. |
| **Selection** | `::selection { background:#3F35D6; color:#FFFFFF }`. |
| **3D hero lights** | key `#3F35D6`, rim `#0B7A76`, environment intensity 1.4 with a white backdrop plane; glass material `transmission 0.75` so the K reads as clear glass on paper; grid plane `rgba(23,24,28,0.06)`. Poster `hero-poster-light.avif`. |
| **Blockquote in rich text** | Fraunces italic, terracotta 3px rule. |

---

## 6. Sample CSS block (`src/styles/themes/light-editorial.css`)

```css
[data-theme="light-editorial"] {
  color-scheme: light;

  /* colour */
  --ck-color-canvas: #FAF8F3;
  --ck-color-surface: #FFFFFF;
  --ck-color-elevated: #FFFFFF;
  --ck-color-glass: rgba(255, 255, 255, 0.78);
  --ck-color-overlay: rgba(23, 24, 28, 0.48);
  --ck-color-border: #E4E0D6;
  --ck-color-border-strong: #86827A;
  --ck-color-fg: #17181C;
  --ck-color-fg-muted: #5D6068;
  --ck-color-fg-subtle: #676A72;
  --ck-color-fg-serif-muted: #4A4D55;
  --ck-color-accent: #3F35D6;
  --ck-color-accent-fg: #FFFFFF;
  --ck-color-accent-hover: #3128B8;
  --ck-color-accent-active: #241C8F;
  --ck-color-accent-soft: #E9E7FB;
  --ck-color-accent-text: #3F35D6;
  --ck-color-accent-solid: #3F35D6;
  --ck-color-secondary: #0B7A76;
  --ck-color-secondary-fg: #FFFFFF;
  --ck-color-secondary-soft: #E1F1F0;
  --ck-color-tertiary: #B4502E;
  --ck-color-success: #176F42;  --ck-color-success-fg: #FFFFFF;  --ck-color-success-soft: #E4F3EA;
  --ck-color-warning: #9A5B00;  --ck-color-warning-fg: #FFFFFF;  --ck-color-warning-soft: #FCF0DC;
  --ck-color-danger: #C8203A;   --ck-color-danger-fg: #FFFFFF;   --ck-color-danger-soft: #FBE7EA;
  --ck-color-danger-solid: #A81A30;
  --ck-color-info: #1D5FBF;     --ck-color-info-fg: #FFFFFF;     --ck-color-info-soft: #E3ECFA;
  --ck-color-ring: #3F35D6;
  --ck-color-inverse: #17181C;  --ck-color-inverse-fg: #FAF8F3;  --ck-color-inverse-fg-muted: #B5B8C0;
  --ck-color-grain: 0;
  --ck-color-scrollbar: #C9C4B8;

  --ck-gradient-brand: linear-gradient(135deg, #3F35D6 0%, #0B7A76 100%);
  --ck-gradient-brand-muted: linear-gradient(135deg, rgba(63,53,214,0.08) 0%, rgba(11,122,118,0.06) 100%);
  --ck-gradient-glow: radial-gradient(60% 60% at 50% 40%, rgba(63,53,214,0.10) 0%, rgba(63,53,214,0) 70%);
  --ck-gradient-glow-cyan: radial-gradient(40% 40% at 80% 60%, rgba(11,122,118,0.08) 0%, rgba(11,122,118,0) 70%);
  --ck-gradient-fade-canvas: linear-gradient(90deg, #FAF8F3 0%, rgba(250,248,243,0.85) 40%, rgba(250,248,243,0) 100%);
  --ck-gradient-section: linear-gradient(180deg, #FAF8F3 0%, #F3F0E8 50%, #FAF8F3 100%);

  --ck-chart-1: #3F35D6; --ck-chart-2: #0B7A76; --ck-chart-3: #B4502E; --ck-chart-4: #C8203A;
  --ck-chart-5: #176F42; --ck-chart-6: #1D5FBF; --ck-chart-7: #8A2BA8;
  --ck-chart-seq-1: #DCD9F8; --ck-chart-seq-2: #B3ABF2; --ck-chart-seq-3: #8478E6;
  --ck-chart-seq-4: #5A50E8; --ck-chart-seq-5: #241C8F;
  --ck-chart-grid: #E4E0D6; --ck-chart-axis: #676A72;

  /* typography */
  --ck-font-display: "Fraunces", ui-serif, Georgia, "Times New Roman", serif;
  --ck-font-body: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --ck-font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --ck-font-features-body: "cv11", "ss01", "tnum";
  --ck-display-weight: 500;
  --ck-display-style: normal;
  --ck-text-display-xl-size: clamp(3rem, 2rem + 5vw, 6rem);     --ck-text-display-xl-lh: 1.02; --ck-text-display-xl-ls: -0.015em;
  --ck-text-display-lg-size: clamp(2.5rem, 1.75rem + 3.5vw, 4.5rem); --ck-text-display-lg-lh: 1.08; --ck-text-display-lg-ls: -0.012em;
  --ck-text-h1-size: clamp(2.25rem, 1.75rem + 2vw, 3rem);      --ck-text-h1-lh: 1.12; --ck-text-h1-ls: -0.01em;
  --ck-text-h2-size: clamp(1.75rem, 1.4rem + 1.25vw, 2.25rem); --ck-text-h2-lh: 1.18; --ck-text-h2-ls: -0.008em;
  --ck-text-h3-size: 1.5rem;  --ck-text-h3-lh: 1.3;  --ck-text-h3-ls: 0;
  --ck-text-h4-size: 1.25rem; --ck-text-h4-lh: 1.3;  --ck-text-h4-ls: 0;
  --ck-text-body-lg-size: 1.125rem; --ck-text-body-lg-lh: 1.65;
  --ck-text-body-size: 1rem;        --ck-text-body-lh: 1.65;
  --ck-text-body-sm-size: 0.875rem; --ck-text-body-sm-lh: 1.5;
  --ck-text-caption-size: 0.75rem;  --ck-text-caption-lh: 1.4;  --ck-text-caption-ls: 0.01em;
  --ck-text-overline-size: 0.75rem; --ck-text-overline-lh: 1.2; --ck-text-overline-ls: 0.08em;
  --ck-text-mono-size: 0.875rem;    --ck-text-mono-lh: 1.5;
  --ck-text-price-size: 1.5rem;     --ck-text-price-lh: 1.2;    --ck-text-price-ls: -0.01em;
  --ck-text-pullquote-size: clamp(1.5rem, 1.2rem + 1.5vw, 2rem); --ck-text-pullquote-lh: 1.3;

  /* spacing */
  --ck-space-gutter: 1rem;
  --ck-space-section-y: clamp(5rem, 10vw, 10rem);
  --ck-space-card: 1.25rem;
  --ck-space-stack-xs: 0.25rem; --ck-space-stack-sm: 0.5rem; --ck-space-stack-md: 1rem;
  --ck-space-stack-lg: 1.5rem;  --ck-space-stack-xl: 2.5rem;
  --ck-space-inline-sm: 0.5rem; --ck-space-inline-md: 0.75rem; --ck-space-inline-lg: 1rem;
  --ck-space-admin-page: 1.5rem;

  /* radius, borders */
  --ck-radius-xs: 2px; --ck-radius-sm: 4px; --ck-radius-md: 6px; --ck-radius-lg: 8px;
  --ck-radius-xl: 12px; --ck-radius-2xl: 16px; --ck-radius-full: 9999px;
  --ck-border-hairline: 1px solid var(--ck-color-border);
  --ck-border-input: 1px solid var(--ck-color-border-strong);
  --ck-border-focus: 2px solid var(--ck-color-ring);
  --ck-border-glass: 1px solid rgba(23, 24, 28, 0.08);
  --ck-border-accent: 2px solid var(--ck-color-accent);
  --ck-border-rule: 1px solid var(--ck-color-fg);
  --ck-border-highlight: none;

  /* shadows, blur */
  --ck-shadow-1: 0 1px 2px rgba(23,24,28,0.06);
  --ck-shadow-2: 0 2px 8px rgba(23,24,28,0.08), 0 1px 2px rgba(23,24,28,0.04);
  --ck-shadow-3: 0 8px 24px rgba(23,24,28,0.10), 0 2px 6px rgba(23,24,28,0.05);
  --ck-shadow-4: 0 20px 48px rgba(23,24,28,0.14);
  --ck-shadow-glow: 0 0 0 1px rgba(63,53,214,0.18), 0 6px 20px rgba(63,53,214,0.16);
  --ck-shadow-glow-hover: 0 0 0 1px rgba(63,53,214,0.30), 0 10px 28px rgba(63,53,214,0.22);
  --ck-shadow-glow-soft: 0 0 0 1px rgba(63,53,214,0.10), 0 4px 14px rgba(63,53,214,0.10);
  --ck-blur-glass: 12px; --ck-blur-header: 12px; --ck-blur-overlay: 2px; --ck-glass-saturate: 110%;

  /* z-index */
  --ck-z-below: -1; --ck-z-base: 0; --ck-z-raised: 10; --ck-z-sticky: 100; --ck-z-header: 200;
  --ck-z-dropdown: 300; --ck-z-drawer: 400; --ck-z-overlay: 500; --ck-z-modal: 600;
  --ck-z-toast: 700; --ck-z-tooltip: 800; --ck-z-skip: 900;

  /* motion */
  --ck-motion-duration-xs: 100ms; --ck-motion-duration-sm: 180ms; --ck-motion-duration-md: 280ms;
  --ck-motion-duration-lg: 480ms; --ck-motion-duration-xl: 800ms; --ck-motion-duration-hero: 1400ms;
  --ck-motion-ease-standard: cubic-bezier(0.25, 0.1, 0.25, 1);
  --ck-motion-ease-emphasized: cubic-bezier(0.16, 1, 0.3, 1);
  --ck-motion-ease-exit: cubic-bezier(0.4, 0, 1, 1);
  --ck-motion-ease-gsap: "power2.out";
  --ck-motion-spring-ui: '{"type":"spring","stiffness":300,"damping":34,"mass":1}';
  --ck-motion-spring-hero: '{"type":"spring","stiffness":140,"damping":28,"mass":1.2}';
  --ck-motion-stagger-sm: 50ms; --ck-motion-stagger-md: 90ms; --ck-motion-stagger-lg: 130ms;
  --ck-motion-hover-lift: translateY(-2px);
  --ck-motion-parallax-max: 6%;
  --ck-motion-reveal-y: 16px;
  --ck-motion-poster-zoom: 0s;
}

@media (min-width: 48rem) { [data-theme="light-editorial"] { --ck-space-gutter: 1.5rem; --ck-space-card: 1.75rem; } }
@media (min-width: 64rem) { [data-theme="light-editorial"] { --ck-space-gutter: 2.5rem; } }
@media (max-width: 63.98rem) { [data-theme="light-editorial"] { --ck-motion-reveal-y: 8px; --ck-motion-stagger-md: 45ms; --ck-motion-stagger-lg: 65ms; } }

[data-theme="light-editorial"] body { background: var(--ck-color-canvas); color: var(--ck-color-fg); font-feature-settings: var(--ck-font-features-body); }
[data-theme="light-editorial"] ::selection { background: var(--ck-color-accent); color: var(--ck-color-accent-fg); }
[data-theme="light-editorial"] .font-display { font-optical-sizing: auto; font-variation-settings: "SOFT" 0, "WONK" 0; }
[data-theme="light-editorial"] .chapter-number, [data-theme="light-editorial"] blockquote { font-style: italic; }
```

---

## 7. Contrast-ratio table (WCAG 2.1, computed)

| Pair | Foreground | Background | Ratio | Requirement | Result |
|------|-----------|------------|-------|-------------|--------|
| Ink on canvas | `#17181C` | `#FAF8F3` | 16.71:1 | 4.5 | Pass |
| Ink on surface | `#17181C` | `#FFFFFF` | 17.74:1 | 4.5 | Pass |
| Ink on section/cream | `#17181C` | `#F3F0E8` | 15.58:1 | 4.5 | Pass |
| Muted on canvas | `#5D6068` | `#FAF8F3` | 5.93:1 | 4.5 | Pass |
| Muted on surface | `#5D6068` | `#FFFFFF` | 6.29:1 | 4.5 | Pass |
| Muted on cream | `#5D6068` | `#F3F0E8` | 5.52:1 | 4.5 | Pass |
| Subtle / placeholder on canvas | `#676A72` | `#FAF8F3` | 5.10:1 | 4.5 | Pass |
| Placeholder on surface (input) | `#676A72` | `#FFFFFF` | 5.41:1 | 4.5 | Pass |
| Serif-muted on canvas | `#4A4D55` | `#FAF8F3` | 7.97:1 | 4.5 | Pass |
| Link / accent text on canvas | `#3F35D6` | `#FAF8F3` | 7.35:1 | 4.5 | Pass |
| Accent text on surface | `#3F35D6` | `#FFFFFF` | 7.80:1 | 4.5 | Pass |
| Accent text on cream | `#3F35D6` | `#F3F0E8` | 6.85:1 | 4.5 | Pass |
| Accent text on accent-soft | `#3F35D6` | `#E9E7FB` | 6.42:1 | 4.5 | Pass |
| Primary button text | `#FFFFFF` | `#3F35D6` | 7.80:1 | 4.5 | Pass |
| Primary button hover text | `#FFFFFF` | `#3128B8` | 9.88:1 | 4.5 | Pass |
| Primary button active text | `#FFFFFF` | `#241C8F` | 12.82:1 | 4.5 | Pass |
| Gradient button text (lightest stop) | `#FFFFFF` | `#0B7A76` | 5.17:1 | 4.5 | Pass |
| Secondary on surface | `#0B7A76` | `#FFFFFF` | 5.17:1 | 4.5 | Pass |
| Tertiary (terracotta) on canvas | `#B4502E` | `#FAF8F3` | 4.79:1 | 4.5 | Pass |
| Success on canvas | `#176F42` | `#FAF8F3` | 5.84:1 | 4.5 | Pass |
| Success chip text on success-soft | `#176F42` | `#E4F3EA` | 5.40:1 | 4.5 | Pass |
| Text on success solid | `#FFFFFF` | `#176F42` | 6.20:1 | 4.5 | Pass |
| Warning on canvas | `#9A5B00` | `#FAF8F3` | 5.11:1 | 4.5 | Pass |
| Warning chip text on warning-soft | `#9A5B00` | `#FCF0DC` | 4.82:1 | 4.5 | Pass |
| Text on warning solid | `#FFFFFF` | `#9A5B00` | 5.43:1 | 4.5 | Pass |
| Danger on canvas | `#C8203A` | `#FAF8F3` | 5.31:1 | 4.5 | Pass |
| Danger chip text on danger-soft | `#C8203A` | `#FBE7EA` | 4.76:1 | 4.5 | Pass |
| Text on danger solid | `#FFFFFF` | `#C8203A` | 5.64:1 | 4.5 | Pass |
| Text on danger-solid (hover) | `#FFFFFF` | `#A81A30` | 7.35:1 | 4.5 | Pass |
| Info on canvas | `#1D5FBF` | `#FAF8F3` | 5.75:1 | 4.5 | Pass |
| Info chip text on info-soft | `#1D5FBF` | `#E3ECFA` | 5.13:1 | 4.5 | Pass |
| Text on info solid | `#FFFFFF` | `#1D5FBF` | 6.10:1 | 4.5 | Pass |
| Inverse footer text | `#FAF8F3` | `#17181C` | 16.71:1 | 4.5 | Pass |
| Inverse footer muted | `#B5B8C0` | `#17181C` | 8.94:1 | 4.5 | Pass |
| Tooltip text | `#FAF8F3` | `#17181C` | 16.71:1 | 4.5 | Pass |
| Ink on amber highlight (rare callout) | `#17181C` | `#F5B83D` | 9.97:1 | 4.5 | Pass |
| Input border vs surface | `#86827A` | `#FFFFFF` | 3.83:1 | 3.0 (1.4.11) | Pass |
| Input border vs canvas | `#86827A` | `#FAF8F3` | 3.61:1 | 3.0 | Pass |
| Focus ring vs canvas | `#3F35D6` | `#FAF8F3` | 7.35:1 | 3.0 | Pass |
| Focus ring vs surface | `#3F35D6` | `#FFFFFF` | 7.80:1 | 3.0 | Pass |
| Chart-1…7 vs surface | — | `#FFFFFF` | 7.80 · 5.17 · 5.09 · 5.64 · 5.84 · 6.10 · 7.02 | 3.0 | Pass |
| Chart axis text | `#676A72` | `#FFFFFF` | 5.41:1 | 4.5 | Pass |
| Chart seq-5 (darkest, used for labels) | `#241C8F` | `#FFFFFF` | 12.82:1 | 4.5 | Pass |
| Hairline `#E4E0D6` vs canvas | — | — | 1.24:1 | none (decorative) | n/a |
| Ghost chip border `#C9C4B8` vs canvas | — | — | 1.64:1 | none (decorative, chip has text) | n/a |

Chart `seq-1` (`#DCD9F8`, 1.37:1 on white) is a heat-map cell colour paired with an ink label; never a standalone mark.

---

## 8. QA notes specific to this theme

- Fraunces optical size must be `auto` — at `display-xl` the high-contrast hairlines are correct; at `h3` the `opsz` should have fattened them. Check at 24px on a 1× display.
- Confirm no `shadow-glow` appears at rest anywhere (only on primary hover).
- Confirm `body::before` grain is not emitted and `--ck-color-grain` is `0`.
- Photograph the hero poster vs live scene at 1280 and 1920; the white backdrop plane must match `#FAF8F3` within ΔE 2.
- Run the token parity test: every key in `dark-cinematic.css` exists here and vice versa. The editorial-specific keys (`--ck-color-tertiary`, `--ck-color-fg-serif-muted`, `--ck-color-inverse-fg-muted`, `--ck-border-rule`, `--ck-text-pullquote-*`) are defined in Theme 1 too (`#F5B83D`, `#A3A9B8`, `#3A3F52`, `1px solid #262A38`, same pull-quote sizes) so no component ever hits an undefined variable.
