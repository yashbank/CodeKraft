# ui/theme-01 — Theme 1 `dark-cinematic` (release 1, default)

1. `dark-cinematic.md` — complete token value sheet, mood, background treatments, per-component look, sample CSS for `[data-theme="dark-cinematic"]`, contrast table.
2. Contract and component specs live in `docs/08-DESIGN-SYSTEM.md`; this folder only assigns values (D-011, MASTER_SPEC §4.6).
3. Canvas `#0A0B10` · surface `#12141C` · text `#F2F4F8` · accent `#9D8FFF` · secondary `#4FE3E0` · focus ring `#9D8FFF`.
4. Type: Space Grotesk (display 700) · Inter (body) · JetBrains Mono.
5. Signature: one violet→cyan glow per viewport, glass header/drawer/dialog, 6 % film grain (≥ 768px), inset 1 px card highlights.
6. Motion: 160/240/400/700 ms, `cubic-bezier(0.2,0,0,1)`, GSAP `expo.out`, spring 420/32, parallax ≤ 12 %.
7. Radius 4/6/10/14/20/28 px; shadows are dark drops plus `--ck-shadow-glow`.
8. 3D hero: violet key light, cyan rim, poster `hero-poster-dark.avif`.
9. Every text pair ≥ 4.5:1 and every boundary ≥ 3:1 — see §7 of the sheet; CI test `tests/unit/tokens.test.ts` asserts them.
10. Implementation target: `src/styles/themes/dark-cinematic.css` (copy §6 block verbatim).
