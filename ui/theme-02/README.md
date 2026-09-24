# ui/theme-02 — Theme 2 `light-editorial` (toggle in V1.1, tokens in release 1)

1. `light-editorial.md` — complete token value sheet, mood, what changes vs Theme 1, background treatments, per-component look, sample CSS for `[data-theme="light-editorial"]`, contrast table.
2. Same token names and components as Theme 1; only values differ (D-011). Toggle hidden behind `theme_light_editorial` until V1.1 (D-1602); no dark variant (X-013).
3. Canvas `#FAF8F3` · surface `#FFFFFF` · ink `#17181C` · accent `#3F35D6` · secondary `#0B7A76` · tertiary terracotta `#B4502E`.
4. Type: Fraunces (display 500, optical sizing, italics for chapter numbers/pull quotes) · Inter (body) · JetBrains Mono.
5. Signature: ink rules and running heads instead of glow and rail, paper-like shadows, no grain, glass on header only, larger section spacing.
6. Motion: 180/280/480/800 ms, `cubic-bezier(0.25,0.1,0.25,1)`, GSAP `power2.out`, spring 300/34, parallax ≤ 6 %, hover lift 2 px.
7. Radius 2/4/6/8/12/16 px; chips are 2 px-radius rectangles.
8. 3D hero: indigo key light, teal rim, white backdrop, poster `hero-poster-light.avif`.
9. Every text pair ≥ 4.5:1 and every boundary ≥ 3:1 — see §7 of the sheet; CI parity test checks every Theme 1 key exists here.
10. Implementation target: `src/styles/themes/light-editorial.css` (copy §6 block verbatim).
