# Theme 1 — `dark-cinematic`

**Implements:** D-902 (deep dark backgrounds, gradient glows, glass panels, light text), D-011, D-905, D-907; `docs/08-DESIGN-SYSTEM.md` token contract §4–§5. Ships in **release 1** as the launch theme and the default unless an admin changes `site_settings.default_theme`.
**File:** `src/styles/themes/dark-cinematic.css` — the CSS block in §6 is the source of truth for values; this document explains them.

---

## 1. Mood

A studio at night. The canvas is a cool, almost-black blue (`#0A0B10`) rather than pure black so that glows and glass have something to sit in. Light comes from two sources: the brand violet (`#9D8FFF`) and an ion cyan (`#4FE3E0`), used as a single gradient and as ambient radial glow behind the hero and behind the one primary action on each page. Surfaces are barely lighter than the canvas and are separated by hairlines and 1 px inner highlights, not by heavy shadows. Type is Space Grotesk for display (geometric, slightly technical) and Inter for body. A 6 % film grain over everything stops flat areas from banding and gives the "cinematic" feel. The result should read as premium and futuristic without ever being neon: at rest, only one glowing element is visible per viewport.

Reference points (for the founders, not to copy): Linear's marketing site (restraint), Vercel's dark surfaces (hairlines), Apple's product pages (one hero object, big type).

---

## 2. Primitive tokens used (from `:root`)

`ink-950…100`, `violet-100…950 + tint-dark`, `cyan-300 + tint-dark`, `amber-300/400 + tint-dark`, `green-300 + tint-dark`, `rose-300/600 + tint-dark`, `blue-300 + tint-dark`, `magenta-300` — values in `docs/08` §5.1. This sheet assigns them to semantic roles; components never reference primitives.

---

## 3. Semantic token value sheet (complete)

### 3.1 Colour

| Token | Value | Notes |
|-------|-------|-------|
| `--ck-color-canvas` | `#0A0B10` | Page background |
| `--ck-color-surface` | `#12141C` | Cards, inputs, sidebar |
| `--ck-color-elevated` | `#1A1D27` | Popovers, dropdowns, sheets, tooltips-inverse base |
| `--ck-color-glass` | `rgba(30, 33, 48, 0.72)` | Header, hero panel, drawer, modal (with `--ck-blur-glass`) |
| `--ck-color-overlay` | `rgba(5, 6, 10, 0.72)` | Modal scrim |
| `--ck-color-border` | `#262A38` | Hairlines |
| `--ck-color-border-strong` | `#626A8A` | Input borders (3.46:1 on surface) |
| `--ck-color-fg` | `#F2F4F8` | Primary text |
| `--ck-color-fg-muted` | `#A3A9B8` | Secondary text |
| `--ck-color-fg-subtle` | `#7C8294` | Placeholders, captions |
| `--ck-color-accent` | `#9D8FFF` | Primary fill |
| `--ck-color-accent-fg` | `#0A0B10` | Text on accent |
| `--ck-color-accent-hover` | `#B5ABFF` | |
| `--ck-color-accent-active` | `#8B7CFF` | Pressed |
| `--ck-color-accent-soft` | `#1C1838` | Tinted fill |
| `--ck-color-accent-text` | `#9D8FFF` | Links |
| `--ck-color-accent-solid` | `#5E4EE6` | Saturated fill when white text is needed (banners with white text 5.66:1) |
| `--ck-color-secondary` | `#4FE3E0` | Gradient stop 2, secondary marks |
| `--ck-color-secondary-fg` | `#0A0B10` | |
| `--ck-color-secondary-soft` | `#0E2A2C` | |
| `--ck-color-success` | `#4ADE80` | |
| `--ck-color-success-fg` | `#0A0B10` | |
| `--ck-color-success-soft` | `#10241A` | |
| `--ck-color-warning` | `#FBBF24` | |
| `--ck-color-warning-fg` | `#0A0B10` | |
| `--ck-color-warning-soft` | `#2A2210` | |
| `--ck-color-danger` | `#FB7185` | |
| `--ck-color-danger-fg` | `#0A0B10` | |
| `--ck-color-danger-soft` | `#2A1219` | |
| `--ck-color-danger-solid` | `#E11D48` | Destructive button hover with white text (4.70:1) |
| `--ck-color-info` | `#60A5FA` | |
| `--ck-color-info-fg` | `#0A0B10` | |
| `--ck-color-info-soft` | `#101C2E` | |
| `--ck-color-ring` | `#9D8FFF` | Focus ring |
| `--ck-color-tertiary` | `#F5B83D` | Amber: playful accent, chart-3, pull-quote rule (11.05:1 on canvas) |
| `--ck-color-fg-serif-muted` | `#A3A9B8` | Parity token (Theme 2 uses it for serif muted); same as `fg-muted` here |
| `--ck-color-inverse` | `#F2F4F8` | Inverse block fill (tooltips) |
| `--ck-color-inverse-fg` | `#0A0B10` | |
| `--ck-color-inverse-fg-muted` | `#3A3F52` | Secondary text on inverse blocks (9.48:1 on `#F2F4F8`) |
| `--ck-color-grain` | `0.06` | Grain overlay opacity |
| `--ck-color-scrollbar` | `#3A3F52` | Thin scrollbar thumb |
| `--ck-gradient-brand` | `linear-gradient(135deg, #9D8FFF 0%, #4FE3E0 100%)` | Gradient text/buttons |
| `--ck-gradient-brand-muted` | `linear-gradient(135deg, rgba(157,143,255,0.18) 0%, rgba(79,227,224,0.10) 100%)` | Card hover wash |
| `--ck-gradient-glow` | `radial-gradient(60% 60% at 50% 40%, rgba(124,108,255,0.35) 0%, rgba(124,108,255,0) 70%)` | Hero ambient |
| `--ck-gradient-glow-cyan` | `radial-gradient(40% 40% at 80% 60%, rgba(79,227,224,0.18) 0%, rgba(79,227,224,0) 70%)` | Hero secondary ambient |
| `--ck-gradient-fade-canvas` | `linear-gradient(90deg, #0A0B10 0%, rgba(10,11,16,0.85) 40%, rgba(10,11,16,0) 100%)` | Text column over hero canvas |
| `--ck-gradient-section` | `linear-gradient(180deg, #0A0B10 0%, #0D0F16 50%, #0A0B10 100%)` | Alternating chapter backgrounds |
| `--ck-chart-1…7` | `#9D8FFF` `#4FE3E0` `#F5B83D` `#FB7185` `#4ADE80` `#60A5FA` `#E879F9` | Categorical |
| `--ck-chart-seq-1…5` | `#2A2560` `#4B3FA8` `#6F60E0` `#9D8FFF` `#C4BBFF` | Sequential |
| `--ck-chart-grid` | `#262A38` | |
| `--ck-chart-axis` | `#A3A9B8` | |

### 3.2 Typography

| Token | Value |
|-------|-------|
| `--ck-font-display` | `"Space Grotesk", ui-sans-serif, system-ui, sans-serif` |
| `--ck-font-body` | `"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` |
| `--ck-font-mono` | `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace` |
| `--ck-font-features-body` | `"cv11", "ss01", "tnum"` |
| `--ck-text-display-xl` | `clamp(3rem, 2rem + 5vw, 6rem) / 1 ` weight 700, tracking `-0.03em` |
| `--ck-text-display-lg` | `clamp(2.5rem, 1.75rem + 3.5vw, 4.5rem) / 1.05`, 700, `-0.025em` |
| `--ck-text-h1` | `clamp(2.25rem, 1.75rem + 2vw, 3rem) / 1.1`, 700, `-0.02em` |
| `--ck-text-h2` | `clamp(1.75rem, 1.4rem + 1.25vw, 2.25rem) / 1.15`, 600, `-0.015em` |
| `--ck-text-h3` | `1.5rem / 1.25`, 600, `-0.01em` |
| `--ck-text-h4` | `1.25rem / 1.3`, 600, `0` (body family) |
| `--ck-text-body-lg` | `1.125rem / 1.6`, 400 |
| `--ck-text-body` | `1rem / 1.6`, 400 |
| `--ck-text-body-sm` | `0.875rem / 1.5`, 400 |
| `--ck-text-caption` | `0.75rem / 1.4`, 500, `0.01em` |
| `--ck-text-overline` | `0.75rem / 1.2`, 600, `0.08em`, uppercase |
| `--ck-text-mono` | `0.875rem / 1.5`, 400 |
| `--ck-text-price` | `1.5rem / 1.2`, 600, `-0.01em`, tabular |
| `--ck-text-pullquote` | `clamp(1.5rem, 1.2rem + 1.5vw, 2rem) / 1.3`, Space Grotesk 500 (Theme 2 renders it serif italic) |
| `--ck-display-weight` | `700` |
| `--ck-display-style` | `normal` |
| `--ck-root-size` | `16px` (`17px` ≥ 1536, `18px` ≥ 1920) |

### 3.3 Spacing, radius, borders

| Token | Value |
|-------|-------|
| `--ck-space-gutter` | `1rem` / `1.5rem` (≥768) / `2rem` (≥1024) |
| `--ck-space-section-y` | `clamp(4rem, 8vw, 8rem)` |
| `--ck-space-chapter-y` | `100svh` min-height ≥1024; `auto` + `4rem` below |
| `--ck-space-card` | `1.25rem` / `1.5rem` (≥768) |
| `--ck-space-stack-xs/sm/md/lg/xl` | `0.25rem` `0.5rem` `1rem` `1.5rem` `2.5rem` |
| `--ck-space-inline-sm/md/lg` | `0.5rem` `0.75rem` `1rem` |
| `--ck-space-admin-page` | `1.5rem` |
| `--ck-radius-xs/sm/md/lg/xl/2xl/full` | `4px` `6px` `10px` `14px` `20px` `28px` `9999px` |
| `--ck-border-hairline` | `1px solid #262A38` |
| `--ck-border-input` | `1px solid #626A8A` |
| `--ck-border-focus` | `2px solid #9D8FFF` (+ `outline-offset: 2px`) |
| `--ck-border-glass` | `1px solid rgba(255,255,255,0.10)` |
| `--ck-border-accent` | `1px solid #9D8FFF` |
| `--ck-border-rule` | `1px solid #262A38` | Parity token (Theme 2 draws ink rules); a hairline here |
| `--ck-border-highlight` | `inset 0 1px 0 rgba(255,255,255,0.05)` | top-edge highlight on cards |

### 3.4 Shadows, blur

| Token | Value |
|-------|-------|
| `--ck-shadow-1` | `0 1px 2px rgba(0,0,0,0.6)` |
| `--ck-shadow-2` | `0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)` |
| `--ck-shadow-3` | `0 12px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)` |
| `--ck-shadow-4` | `0 24px 64px rgba(0,0,0,0.6)` |
| `--ck-shadow-glow` | `0 0 0 1px rgba(157,143,255,0.35), 0 0 24px rgba(124,108,255,0.45), 0 0 64px rgba(79,227,224,0.18)` |
| `--ck-shadow-glow-hover` | `0 0 0 1px rgba(157,143,255,0.6), 0 0 32px rgba(124,108,255,0.6), 0 0 96px rgba(79,227,224,0.25)` |
| `--ck-shadow-glow-soft` | `0 0 0 1px rgba(157,143,255,0.18), 0 0 16px rgba(124,108,255,0.22)` (cards on hover, offering panel at rest) |
| `--ck-blur-glass` | `16px` |
| `--ck-blur-header` | `20px` |
| `--ck-blur-overlay` | `4px` |
| `--ck-glass-saturate` | `140%` |

### 3.5 Z-index (identical in both themes)

`--ck-z-below: -1; --ck-z-base: 0; --ck-z-raised: 10; --ck-z-sticky: 100; --ck-z-header: 200; --ck-z-dropdown: 300; --ck-z-drawer: 400; --ck-z-overlay: 500; --ck-z-modal: 600; --ck-z-toast: 700; --ck-z-tooltip: 800; --ck-z-skip: 900;`

### 3.6 Motion

| Token | Value |
|-------|-------|
| `--ck-motion-duration-xs/sm/md/lg/xl/hero` | `100ms` `160ms` `240ms` `400ms` `700ms` `1200ms` |
| `--ck-motion-ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` |
| `--ck-motion-ease-emphasized` | `cubic-bezier(0.05, 0.7, 0.1, 1)` |
| `--ck-motion-ease-exit` | `cubic-bezier(0.3, 0, 0.8, 0.15)` |
| `--ck-motion-ease-gsap` | `expo.out` |
| `--ck-motion-spring-ui` | `{"type":"spring","stiffness":420,"damping":32,"mass":1}` |
| `--ck-motion-spring-hero` | `{"type":"spring","stiffness":170,"damping":26,"mass":1.2}` |
| `--ck-motion-stagger-sm/md/lg` | `40ms` `70ms` `110ms` |
| `--ck-motion-hover-lift` | `translateY(-4px) scale(1.01)` |
| `--ck-motion-parallax-max` | `12%` |
| `--ck-motion-reveal-y` | `24px` (`12px` below 1024) |
| `--ck-motion-poster-zoom` | `20s` (1.0 → 1.04) |

### 3.7 Breakpoints / containers (static, shared)

`sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536 · tv 1920`; containers `100%−2rem · 720 · 960 · 1200 · 1400 · 1600`.

---

## 4. Background treatments

1. **Canvas base:** `#0A0B10` on `html` and `body`; `color-scheme: dark`.
2. **Grain:** `body::before { content:""; position:fixed; inset:0; background:url(/noise.png) repeat; background-size:256px; opacity:var(--ck-color-grain); mix-blend-mode:overlay; pointer-events:none; z-index:var(--ck-z-below); }` — removed below 768px (`display:none`) and under `prefers-reduced-transparency`.
3. **Hero ambient glow:** an absolutely positioned 1200×900 div behind the hero using `--ck-gradient-glow` plus a second 700×700 layer using `--ck-gradient-glow-cyan`; both move with ScrollTrigger scrub ≤ 8 % of their height and fade to 0 by the end of the hero. On mobile a single static glow at 60 % strength.
4. **Chapter alternation:** chapters 01/03/05 sit on `canvas`; 02/04 on `--ck-gradient-section` (peak `#0D0F16`, +1.1 % luminance) so the eye registers a change without a hard edge. The Proof chapter (04) adds a faint 1 px grid (`repeating-linear-gradient` at 64px, `rgba(255,255,255,0.025)`) behind the case-study scroller.
5. **Glass:** header (after 8px scroll), hero text panel at `md` (when the canvas bleeds behind text), mobile drawer, dialogs: `background: var(--ck-color-glass); backdrop-filter: blur(var(--ck-blur-glass)) saturate(140%); border: var(--ck-border-glass)`. Fallback without `backdrop-filter`: `background: #1A1D27`.
6. **Section dividers:** never solid rules across the page; use `--ck-space-section-y` and a 1 px `border` line limited to the container width, with a 240 px centred `accent` 30 % highlight (`mask-image: linear-gradient(90deg, transparent, #000 40%, #000 60%, transparent)`).
7. **Footer:** `surface` with a top hairline and the glow at 20 % behind the monogram.
8. **Admin app:** canvas `#0A0B10`, content areas `surface`, no grain, no glow, no glass (docs/08 P4).

---

## 5. Component transformations in this theme

| Component | Appearance in `dark-cinematic` |
|-----------|-------------------------------|
| **Primary button** | `#9D8FFF` fill, `#0A0B10` text, radius 10px; hover `#B5ABFF` + `shadow-glow` fades in 240ms; active `#8B7CFF` scale 0.98. `gradient` variant: brand gradient fill, `#0A0B10` text, glow at rest (landing only). |
| **Secondary button** | `#1A1D27` fill, `#F2F4F8` text, `#626A8A` border; hover border `#9D8FFF`, text `#9D8FFF`. |
| **Outline / ghost** | Transparent; hover `#1C1838`. |
| **Destructive** | `#FB7185` fill, `#0A0B10` text; hover `#E11D48` with `#FFFFFF` text. |
| **Inputs** | `#12141C` fill, `#626A8A` border, `#F2F4F8` text, `#7C8294` placeholder; focus border `#9D8FFF` + 2px ring offset 2px; error border `#FB7185`. Autofill background forced to `#12141C` via `-webkit-box-shadow: 0 0 0 1000px #12141C inset`. |
| **Cards** | `#12141C`, hairline `#262A38`, inset top highlight; hover lifts 4px, `shadow-3` + `shadow-glow-soft`, cover image scales 1.03; product card cover gets `--ck-gradient-brand-muted` wash on hover. |
| **Widget cards (admin)** | Same fill, no glow, no lift; drag handle appears on hover; chart colours `chart-1…7`. |
| **Site header** | Transparent over hero → glass (`rgba(30,33,48,0.72)`, blur 20px) after 8px; bottom hairline `rgba(255,255,255,0.06)`; nav underline `#9D8FFF`. |
| **Mobile drawer** | Glass, right-anchored, links stagger in 40ms; theme toggle at the bottom. |
| **Account sidebar** | `#12141C`, active item `#1C1838` + `#9D8FFF` text + 3px left rule. |
| **Admin sidebar** | `#12141C`, active `#1C1838`, approvals badge `#FB7185` pill with `#0A0B10` text. |
| **Hero** | Canvas `#0A0B10`, glow layers, canvas/poster on the right 50 % at ≥1024, `--ck-gradient-fade-canvas` guarantees text sits on solid dark; headline gradient text on ≤ 2 words; scroll cue arrow bounces 1.6s. |
| **Story chapters** | 100svh, alternating `canvas`/`gradient-section`; chapter number overline `#7C8294`; titles `#F2F4F8` Space Grotesk 700 with line-mask reveal; progress rail track `#262A38`, fill `#9D8FFF`, dots 8px with glow on active. |
| **Tables** | Header `#7C8294` overline on `#12141C`; rows hairline; hover `rgba(28,24,56,0.5)`; ledger negatives `#FB7185`; lock icon `#7C8294`. |
| **Chips** | Pill 24px; tones per docs/08 §6.8 with soft fills (`#1C1838`, `#101C2E`, `#10241A`, `#2A2210`, `#2A1219`) and 300-step text. |
| **Toasts** | `#1A1D27`, `shadow-3`, 4px tone rule, slide up 16px. |
| **Dialog / Sheet** | `#1A1D27` with glass edge (`rgba(255,255,255,0.10)`), scrim `rgba(5,6,10,0.72)` blur 4px, radius 20px, scale 0.96→1 in 400ms. |
| **Tabs** | Underline style, indicator `#9D8FFF` sliding; admin segmented track `#12141C`, active `#1A1D27`. |
| **Offering selector** | Sticky panel `#12141C`, radius 20px, `shadow-glow-soft` at rest; selected radio card `#1C1838` + `#9D8FFF` border; price `#F2F4F8` 24px; strike-through `#7C8294`. |
| **Stepper / checklist** | Done/current circles `#9D8FFF` with `#0A0B10` numerals; connector fills `#9D8FFF`; in-progress spinner `#60A5FA`; done `#4ADE80`. |
| **Notification bell** | Badge `#FB7185`/`#0A0B10`; popover `#1A1D27`; unread dot `#9D8FFF`. |
| **Payment panel** | Panel `#12141C`; QR tile stays `#FFFFFF` (scanner reliability) with 16px padding; VPA/bank rows `mono` `#F2F4F8` on `#0A0B10` code blocks; "Reference submitted" chip warning; expiry countdown `#FBBF24`. |
| **Invoice preview** | Unthemed white A4 sheet on a `#12141C` frame with `shadow-3`. |
| **Charts** | Grid `#262A38`, axis text `#A3A9B8`, tooltip `#1A1D27`; area fills at 18 %; active mark outlined `#F2F4F8`. |
| **Chat** | User bubble `#9D8FFF`/`#0A0B10`; assistant `#12141C`/`#F2F4F8`; quick replies outline chips; streaming caret `#4FE3E0`. |
| **Tooltip** | Inverse: `#F2F4F8` fill, `#0A0B10` text. |
| **Skeleton** | `#1A1D27` with shimmer `rgba(255,255,255,0.06)`. |
| **Scrollbar** | `scrollbar-color: #3A3F52 #0A0B10`, width thin. |
| **Selection** | `::selection { background:#9D8FFF; color:#0A0B10 }`. |
| **3D hero lights** | key `#9D8FFF`, rim `#4FE3E0`, environment intensity 0.8, grid plane `rgba(157,143,255,0.12)`. Poster `hero-poster-dark.avif`. |

---

## 6. Sample CSS block (`src/styles/themes/dark-cinematic.css`)

```css
[data-theme="dark-cinematic"] {
  color-scheme: dark;

  /* colour */
  --ck-color-canvas: #0A0B10;
  --ck-color-surface: #12141C;
  --ck-color-elevated: #1A1D27;
  --ck-color-glass: rgba(30, 33, 48, 0.72);
  --ck-color-overlay: rgba(5, 6, 10, 0.72);
  --ck-color-border: #262A38;
  --ck-color-border-strong: #626A8A;
  --ck-color-fg: #F2F4F8;
  --ck-color-fg-muted: #A3A9B8;
  --ck-color-fg-subtle: #7C8294;
  --ck-color-accent: #9D8FFF;
  --ck-color-accent-fg: #0A0B10;
  --ck-color-accent-hover: #B5ABFF;
  --ck-color-accent-active: #8B7CFF;
  --ck-color-accent-soft: #1C1838;
  --ck-color-accent-text: #9D8FFF;
  --ck-color-accent-solid: #5E4EE6;
  --ck-color-secondary: #4FE3E0;
  --ck-color-secondary-fg: #0A0B10;
  --ck-color-secondary-soft: #0E2A2C;
  --ck-color-success: #4ADE80;  --ck-color-success-fg: #0A0B10;  --ck-color-success-soft: #10241A;
  --ck-color-warning: #FBBF24;  --ck-color-warning-fg: #0A0B10;  --ck-color-warning-soft: #2A2210;
  --ck-color-danger: #FB7185;   --ck-color-danger-fg: #0A0B10;   --ck-color-danger-soft: #2A1219;
  --ck-color-danger-solid: #E11D48;
  --ck-color-info: #60A5FA;     --ck-color-info-fg: #0A0B10;     --ck-color-info-soft: #101C2E;
  --ck-color-ring: #9D8FFF;
  --ck-color-tertiary: #F5B83D;
  --ck-color-fg-serif-muted: #A3A9B8;
  --ck-color-inverse: #F2F4F8;  --ck-color-inverse-fg: #0A0B10;  --ck-color-inverse-fg-muted: #3A3F52;
  --ck-color-grain: 0.06;
  --ck-color-scrollbar: #3A3F52;

  --ck-gradient-brand: linear-gradient(135deg, #9D8FFF 0%, #4FE3E0 100%);
  --ck-gradient-brand-muted: linear-gradient(135deg, rgba(157,143,255,0.18) 0%, rgba(79,227,224,0.10) 100%);
  --ck-gradient-glow: radial-gradient(60% 60% at 50% 40%, rgba(124,108,255,0.35) 0%, rgba(124,108,255,0) 70%);
  --ck-gradient-glow-cyan: radial-gradient(40% 40% at 80% 60%, rgba(79,227,224,0.18) 0%, rgba(79,227,224,0) 70%);
  --ck-gradient-fade-canvas: linear-gradient(90deg, #0A0B10 0%, rgba(10,11,16,0.85) 40%, rgba(10,11,16,0) 100%);
  --ck-gradient-section: linear-gradient(180deg, #0A0B10 0%, #0D0F16 50%, #0A0B10 100%);

  --ck-chart-1: #9D8FFF; --ck-chart-2: #4FE3E0; --ck-chart-3: #F5B83D; --ck-chart-4: #FB7185;
  --ck-chart-5: #4ADE80; --ck-chart-6: #60A5FA; --ck-chart-7: #E879F9;
  --ck-chart-seq-1: #2A2560; --ck-chart-seq-2: #4B3FA8; --ck-chart-seq-3: #6F60E0;
  --ck-chart-seq-4: #9D8FFF; --ck-chart-seq-5: #C4BBFF;
  --ck-chart-grid: #262A38; --ck-chart-axis: #A3A9B8;

  /* typography */
  --ck-font-display: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
  --ck-font-body: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --ck-font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --ck-font-features-body: "cv11", "ss01", "tnum";
  --ck-display-weight: 700;
  --ck-display-style: normal;
  --ck-text-display-xl-size: clamp(3rem, 2rem + 5vw, 6rem);     --ck-text-display-xl-lh: 1;    --ck-text-display-xl-ls: -0.03em;
  --ck-text-display-lg-size: clamp(2.5rem, 1.75rem + 3.5vw, 4.5rem); --ck-text-display-lg-lh: 1.05; --ck-text-display-lg-ls: -0.025em;
  --ck-text-h1-size: clamp(2.25rem, 1.75rem + 2vw, 3rem);      --ck-text-h1-lh: 1.1;  --ck-text-h1-ls: -0.02em;
  --ck-text-h2-size: clamp(1.75rem, 1.4rem + 1.25vw, 2.25rem); --ck-text-h2-lh: 1.15; --ck-text-h2-ls: -0.015em;
  --ck-text-h3-size: 1.5rem;  --ck-text-h3-lh: 1.25; --ck-text-h3-ls: -0.01em;
  --ck-text-h4-size: 1.25rem; --ck-text-h4-lh: 1.3;  --ck-text-h4-ls: 0;
  --ck-text-body-lg-size: 1.125rem; --ck-text-body-lg-lh: 1.6;
  --ck-text-body-size: 1rem;        --ck-text-body-lh: 1.6;
  --ck-text-body-sm-size: 0.875rem; --ck-text-body-sm-lh: 1.5;
  --ck-text-caption-size: 0.75rem;  --ck-text-caption-lh: 1.4;  --ck-text-caption-ls: 0.01em;
  --ck-text-overline-size: 0.75rem; --ck-text-overline-lh: 1.2; --ck-text-overline-ls: 0.08em;
  --ck-text-mono-size: 0.875rem;    --ck-text-mono-lh: 1.5;
  --ck-text-price-size: 1.5rem;     --ck-text-price-lh: 1.2;    --ck-text-price-ls: -0.01em;
  --ck-text-pullquote-size: clamp(1.5rem, 1.2rem + 1.5vw, 2rem); --ck-text-pullquote-lh: 1.3;

  /* spacing */
  --ck-space-gutter: 1rem;
  --ck-space-section-y: clamp(4rem, 8vw, 8rem);
  --ck-space-card: 1.25rem;
  --ck-space-stack-xs: 0.25rem; --ck-space-stack-sm: 0.5rem; --ck-space-stack-md: 1rem;
  --ck-space-stack-lg: 1.5rem;  --ck-space-stack-xl: 2.5rem;
  --ck-space-inline-sm: 0.5rem; --ck-space-inline-md: 0.75rem; --ck-space-inline-lg: 1rem;
  --ck-space-admin-page: 1.5rem;

  /* radius, borders */
  --ck-radius-xs: 4px; --ck-radius-sm: 6px; --ck-radius-md: 10px; --ck-radius-lg: 14px;
  --ck-radius-xl: 20px; --ck-radius-2xl: 28px; --ck-radius-full: 9999px;
  --ck-border-hairline: 1px solid var(--ck-color-border);
  --ck-border-input: 1px solid var(--ck-color-border-strong);
  --ck-border-focus: 2px solid var(--ck-color-ring);
  --ck-border-glass: 1px solid rgba(255, 255, 255, 0.10);
  --ck-border-accent: 1px solid var(--ck-color-accent);
  --ck-border-rule: 1px solid var(--ck-color-border);
  --ck-border-highlight: inset 0 1px 0 rgba(255, 255, 255, 0.05);

  /* shadows, blur */
  --ck-shadow-1: 0 1px 2px rgba(0,0,0,0.6);
  --ck-shadow-2: 0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04);
  --ck-shadow-3: 0 12px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05);
  --ck-shadow-4: 0 24px 64px rgba(0,0,0,0.6);
  --ck-shadow-glow: 0 0 0 1px rgba(157,143,255,0.35), 0 0 24px rgba(124,108,255,0.45), 0 0 64px rgba(79,227,224,0.18);
  --ck-shadow-glow-hover: 0 0 0 1px rgba(157,143,255,0.6), 0 0 32px rgba(124,108,255,0.6), 0 0 96px rgba(79,227,224,0.25);
  --ck-shadow-glow-soft: 0 0 0 1px rgba(157,143,255,0.18), 0 0 16px rgba(124,108,255,0.22);
  --ck-blur-glass: 16px; --ck-blur-header: 20px; --ck-blur-overlay: 4px; --ck-glass-saturate: 140%;

  /* z-index */
  --ck-z-below: -1; --ck-z-base: 0; --ck-z-raised: 10; --ck-z-sticky: 100; --ck-z-header: 200;
  --ck-z-dropdown: 300; --ck-z-drawer: 400; --ck-z-overlay: 500; --ck-z-modal: 600;
  --ck-z-toast: 700; --ck-z-tooltip: 800; --ck-z-skip: 900;

  /* motion */
  --ck-motion-duration-xs: 100ms; --ck-motion-duration-sm: 160ms; --ck-motion-duration-md: 240ms;
  --ck-motion-duration-lg: 400ms; --ck-motion-duration-xl: 700ms; --ck-motion-duration-hero: 1200ms;
  --ck-motion-ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ck-motion-ease-emphasized: cubic-bezier(0.05, 0.7, 0.1, 1);
  --ck-motion-ease-exit: cubic-bezier(0.3, 0, 0.8, 0.15);
  --ck-motion-ease-gsap: "expo.out";
  --ck-motion-spring-ui: '{"type":"spring","stiffness":420,"damping":32,"mass":1}';
  --ck-motion-spring-hero: '{"type":"spring","stiffness":170,"damping":26,"mass":1.2}';
  --ck-motion-stagger-sm: 40ms; --ck-motion-stagger-md: 70ms; --ck-motion-stagger-lg: 110ms;
  --ck-motion-hover-lift: translateY(-4px) scale(1.01);
  --ck-motion-parallax-max: 12%;
  --ck-motion-reveal-y: 24px;
  --ck-motion-poster-zoom: 20s;
}

@media (min-width: 48rem) { [data-theme="dark-cinematic"] { --ck-space-gutter: 1.5rem; --ck-space-card: 1.5rem; } }
@media (min-width: 64rem) { [data-theme="dark-cinematic"] { --ck-space-gutter: 2rem; } }
@media (max-width: 63.98rem) { [data-theme="dark-cinematic"] { --ck-motion-reveal-y: 12px; --ck-motion-stagger-md: 35ms; --ck-motion-stagger-lg: 55ms; } }

[data-theme="dark-cinematic"] body { background: var(--ck-color-canvas); color: var(--ck-color-fg); font-feature-settings: var(--ck-font-features-body); }
[data-theme="dark-cinematic"] ::selection { background: var(--ck-color-accent); color: var(--ck-color-accent-fg); }
[data-theme="dark-cinematic"] body::before {
  content: ""; position: fixed; inset: 0; z-index: var(--ck-z-below); pointer-events: none;
  background: url("/noise.png") repeat; background-size: 256px; opacity: var(--ck-color-grain); mix-blend-mode: overlay;
}
@media (max-width: 47.98rem), (prefers-reduced-transparency: reduce) { [data-theme="dark-cinematic"] body::before { display: none; } }
```

---

## 7. Contrast-ratio table (WCAG 2.1, computed)

| Pair | Foreground | Background | Ratio | Requirement | Result |
|------|-----------|------------|-------|-------------|--------|
| Body text on canvas | `#F2F4F8` | `#0A0B10` | 17.85:1 | 4.5 | Pass |
| Body text on surface | `#F2F4F8` | `#12141C` | 16.69:1 | 4.5 | Pass |
| Body text on elevated | `#F2F4F8` | `#1A1D27` | 15.27:1 | 4.5 | Pass |
| Body text on glass (over canvas, ≈ `#1E2130`) | `#F2F4F8` | `#1E2130` | 14.50:1 | 4.5 | Pass |
| Muted text on canvas | `#A3A9B8` | `#0A0B10` | 8.35:1 | 4.5 | Pass |
| Muted text on surface | `#A3A9B8` | `#12141C` | 7.81:1 | 4.5 | Pass |
| Muted text on elevated | `#A3A9B8` | `#1A1D27` | 7.15:1 | 4.5 | Pass |
| Muted text on glass | `#A3A9B8` | `#1E2130` | 6.78:1 | 4.5 | Pass |
| Subtle / placeholder on canvas | `#7C8294` | `#0A0B10` | 5.13:1 | 4.5 | Pass |
| Placeholder on surface (input) | `#7C8294` | `#12141C` | 4.79:1 | 4.5 | Pass |
| Link / accent text on canvas | `#9D8FFF` | `#0A0B10` | 7.31:1 | 4.5 | Pass |
| Accent text on surface | `#9D8FFF` | `#12141C` | 6.83:1 | 4.5 | Pass |
| Accent text on elevated | `#9D8FFF` | `#1A1D27` | 6.25:1 | 4.5 | Pass |
| Accent text on accent-soft | `#9D8FFF` | `#1C1838` | 6.31:1 | 4.5 | Pass |
| Primary button text | `#0A0B10` | `#9D8FFF` | 7.31:1 | 4.5 | Pass |
| Primary button hover text | `#0A0B10` | `#B5ABFF` | 9.58:1 | 4.5 | Pass |
| Primary button active text | `#0A0B10` | `#8B7CFF` | 6.01:1 | 4.5 | Pass |
| Gradient button text (darkest stop) | `#0A0B10` | `#7C6CFF` | 5.10:1 | 4.5 | Pass |
| White text on accent-solid | `#FFFFFF` | `#5E4EE6` | 5.66:1 | 4.5 | Pass |
| Secondary text on secondary | `#0A0B10` | `#4FE3E0` | 12.54:1 | 4.5 | Pass |
| Secondary on canvas | `#4FE3E0` | `#0A0B10` | 12.54:1 | 4.5 | Pass |
| Success on canvas | `#4ADE80` | `#0A0B10` | 11.28:1 | 4.5 | Pass |
| Success on elevated | `#4ADE80` | `#1A1D27` | 9.65:1 | 4.5 | Pass |
| Success chip text on success-soft | `#4ADE80` | `#10241A` | 9.35:1 | 4.5 | Pass |
| Text on success solid | `#0A0B10` | `#4ADE80` | 11.28:1 | 4.5 | Pass |
| Warning on canvas | `#FBBF24` | `#0A0B10` | 11.78:1 | 4.5 | Pass |
| Warning on elevated | `#FBBF24` | `#1A1D27` | 10.07:1 | 4.5 | Pass |
| Warning chip text on warning-soft | `#FBBF24` | `#2A2210` | 9.42:1 | 4.5 | Pass |
| Text on warning solid | `#0A0B10` | `#FBBF24` | 11.78:1 | 4.5 | Pass |
| Danger on canvas | `#FB7185` | `#0A0B10` | 7.30:1 | 4.5 | Pass |
| Danger on elevated | `#FB7185` | `#1A1D27` | 6.25:1 | 4.5 | Pass |
| Danger chip text on danger-soft | `#FB7185` | `#2A1219` | 6.51:1 | 4.5 | Pass |
| Text on danger solid | `#0A0B10` | `#FB7185` | 7.30:1 | 4.5 | Pass |
| White on danger-solid (destructive hover) | `#FFFFFF` | `#E11D48` | 4.70:1 | 4.5 | Pass |
| Info on canvas | `#60A5FA` | `#0A0B10` | 7.73:1 | 4.5 | Pass |
| Info on elevated | `#60A5FA` | `#1A1D27` | 6.61:1 | 4.5 | Pass |
| Info chip text on info-soft | `#60A5FA` | `#101C2E` | 6.73:1 | 4.5 | Pass |
| Text on info solid | `#0A0B10` | `#60A5FA` | 7.73:1 | 4.5 | Pass |
| Amber accent on canvas | `#F5B83D` | `#0A0B10` | 11.05:1 | 4.5 | Pass |
| Tooltip text (inverse) | `#0A0B10` | `#F2F4F8` | 17.85:1 | 4.5 | Pass |
| Input border vs surface | `#626A8A` | `#12141C` | 3.46:1 | 3.0 (1.4.11) | Pass |
| Input border vs canvas | `#626A8A` | `#0A0B10` | 3.70:1 | 3.0 | Pass |
| Focus ring vs canvas | `#9D8FFF` | `#0A0B10` | 7.31:1 | 3.0 | Pass |
| Focus ring vs surface | `#9D8FFF` | `#12141C` | 6.83:1 | 3.0 | Pass |
| Chart-1…7 vs surface | see docs/08 §6.17 | `#12141C` | 6.83 · 11.73 · 10.33 · 6.83 · 10.55 · 7.23 · 7.47 | 3.0 | Pass |
| Chart seq-5 (lightest used for text labels) | `#C4BBFF` | `#12141C` | 10.41:1 | 4.5 | Pass |
| Hairline `#262A38` vs canvas | — | — | 1.38:1 | none (decorative) | n/a |
| Chart grid `#262A38` vs surface | — | — | 1.29:1 | none (decorative) | n/a |

Chart `seq-1` (`#2A2560`, 1.34:1) is used only as a heat-map cell colour with a numeric label in `fg`; never as a mark that must be distinguished from the background alone.

---

## 8. QA notes specific to this theme

- Verify glow does not exceed one element per viewport at rest on `/`, `/products/[slug]`, `/account`.
- Check the grain overlay is absent below 768px and with reduced transparency.
- Autofill and native `<select>` must not flash white (`color-scheme: dark` + autofill override).
- Screenshot the hero poster against the live scene at 1280 and 1920 widths; colour drift ≤ ΔE 3.
- Run the token contrast test; the pairs in §7 are the expected output.
