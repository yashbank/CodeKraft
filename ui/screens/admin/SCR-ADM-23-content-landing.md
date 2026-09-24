# SCR-ADM-23 — Content: landing chapters

**Route:** `admin.<domain>/content/landing?chapter=who|build|sell|proof|talk` · **Render:** Client · **App:** Admin

## Purpose
Edit the five story chapters of the landing page (copy, media, CTA) and pick the featured products shown in "What we sell" and the blog teasers — without a developer (D-1106, D-801, D-314). Changes revalidate the landing page on save.

## User/role
Admin, Super Admin (`content.write`; `content.publish` to toggle published).

## Entry points
Sidebar "Content › Landing", dashboard catalog widget "Featured products", product editor "Feature on landing".

## Layout
- **Desktop:** h1 "Landing page".
- Left rail: the five chapters in order (Who we are, What we build, What we sell, Proof, Talk to us) with published toggles and a "Preview landing" button (opens site in new tab with draft cookie).
- Right: chapter editor form — Title*, Subtitle, Body (Tiptap, short), Media (`MediaPicker`: hero poster image* for "who" with alt text; 3D scene toggle info "Scene is code-driven; poster is the fallback and the mobile hero"), CTA fields (primary label + target, secondary label + target — targets from a `Select` of site routes or a URL), Position (read-only), Published `Switch`.
- Chapter-specific blocks: "What we build" → pick services to highlight (max 8, ordered); "What we sell" → **Featured products** `MultiSelect` with drag order (max 8, published only) and "Fallback: latest published" note; "Proof" → choose logos (all published by default), case studies (latest 3 or pick), site testimonials (pick up to 3), stat tiles (label + value up to 3); "Talk to us" → form intro copy and success copy.
- Save bar sticky at bottom ("Saved 20 s ago", "Save", "Discard").
- **Phone / tablet (< lg):** not a supported layout — the admin app is designed for ≥ 1024 px (MASTER_SPEC §7 "Admin minimum width"). Below `lg` this screen renders the read-only "Open on a laptop" notice (docs/07 §3.4): page title, a one-line summary where cheap, links to Approvals and Notifications; no forms, tables or actions.

## Components
- shadcn/ui: `Tabs`/rail, `Form`, `Input`, `Textarea`, Tiptap, `Switch`, `Select`, `Combobox`/`MultiSelect`, `Sheet` (media library), `Card`, `Button`, `Alert`, `Skeleton`
- custom: `MediaPicker`, `SortableList`, `CtaFields`, `StatTileFields`.

## Content & copy notes
- Guardrails shown as hints: "Keep hero title under 60 characters for the 3D scene layout"; "Alt text is required — it also serves as the poster description for screen readers"; "No founder names or photos" (D-103).
- CTA defaults "Start a project" / "Explore products" (D-802).
- Featured products must be published; unlisted products are excluded from the picker (D-314).

## Interactions
- Save → `upsertLandingChapter` (API-CONT-01) per chapter; featured → `setFeaturedProducts` (API-CONT-02); revalidates tag `content`.
- Media picker → library `Sheet` (upload via API-CAT-21 or pick existing media).
- Autosave 30 s; unsaved guard.

## States
- **Default:** chapter "who".
- **Loading:** skeleton form.
- **Empty:** unseeded chapter shows defaults with "Using default copy" banner.
- **Error:** validation (title required, poster required for hero); save failure.
- **Success:** toast "Chapter saved — landing page updated".
- **Permission-denied:** Published toggle disabled without `content.publish`.

## Responsive behaviour
- **< lg (phone, tablet):** read-only "Open on a laptop" notice (admin minimum width 1024 px, MASTER_SPEC §7; founder may override).
- **lg+:** lg+ rail + 800 px form; tv wider.

## Accessibility
- Rail with `aria-current`; sortable lists with keyboard move buttons; alt-text required validation; preview link announces new tab.

## Motion
- None beyond standard.
- Reduced motion: none.

## Navigation
→ site `/` preview, `/products/[id]`, `/content/services`, `/content/case-studies`, `/content/testimonials`, `/content/logos`.

## Data dependencies
Tables: `T-landing_chapters`, `T-featured_products`, `T-products`, `T-services`, `T-case_studies`, `T-testimonials`, `T-client_logos`, `T-media`, `T-audit_logs`.
Queries: `getLandingContent` (API-CONT-09), `listProductsAdmin` (API-CAT-18). Actions: `upsertLandingChapter` (API-CONT-01), `setFeaturedProducts` (API-CONT-02), `createUploadIntent` (API-CAT-21).

## Requirement IDs
D-801, D-802, D-1106, D-314, D-103, D-904, D-1605, D-121 (teasers), D-1104.
