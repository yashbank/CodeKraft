# SCR-ADM-26 — Content: testimonials & client logos

**Route:** `admin.<domain>/content/testimonials` and `/content/logos` · **Render:** Client · **App:** Admin

## Purpose
Curate site-level testimonials (D-312 — there are no public reviews) and the client logo strip (D-117) used in the landing Proof chapter and case studies list. Product testimonials are edited in the product editor; this screen filters to `context='site'` by default with a toggle to see product ones.

## User/role
Admin, Super Admin (`content.write`).

## Entry points
Sidebar "Content › Testimonials" / "Logos", landing editor Proof block.

## Layout
- **Testimonials (desktop):** h1 "Testimonials", context `Tabs` (Site / Product), "Add testimonial".
- Sortable card grid: quote (clamp 3), author name, title, company, avatar, published `Switch`, product chip (product context), ⋯ (Edit, Delete).
- Editor `Sheet`: Quote* (500 chars), Author name*, Author title, Company, Avatar (media picker, alt), Context (Site / Product → product `Combobox`), Published.
- Preview of the public card.
- **Logos (desktop):** h1 "Client logos", "Add logo".
- Sortable grid of logo tiles (image on both theme backgrounds preview, name, URL, published `Switch`), ⋯ (Edit, Delete).
- Editor `Sheet`: Name*, Logo image* (SVG/PNG, transparent recommended; alt = name), Link URL (optional), Published.
- Warning if logo lacks contrast on dark theme (simple luminance check).
- **Phone / tablet (< lg):** not a supported layout — the admin app is designed for ≥ 1024 px (MASTER_SPEC §7 "Admin minimum width"). Below `lg` this screen renders the read-only "Open on a laptop" notice (docs/07 §3.4): page title, a one-line summary where cheap, links to Approvals and Notifications; no forms, tables or actions.

## Components
- shadcn/ui: `Tabs`, `Button`, `Switch`, `Sheet`, `Form`, `Input`, `Textarea`, `Combobox`, `Avatar`, `Card`, `DropdownMenu`, `AlertDialog`, `Skeleton`
- custom: `SortableGrid`, `MediaPicker`, `TestimonialPreview`, `LogoTile`.

## Content & copy notes
- Hint: "Testimonials are curated by admins; there are no public reviews or ratings (X-007)." Consent reminder: "Only publish quotes you have permission to use."

## Interactions
- `upsertTestimonial`/`delete`/`reorder` (API-CONT-05); `upsertClientLogo`/`delete`/`reorder` (API-CONT-06); revalidate `content`.

## States
- **Default:** site testimonials / all logos.
- **Loading:** skeleton grid.
- **Empty:** "No testimonials yet" / "No logos yet".
- **Error:** validation; image type/size rejected.
- **Success:** toasts.
- **Permission-denied:** read-only.

## Responsive behaviour
- **< lg (phone, tablet):** read-only "Open on a laptop" notice (admin minimum width 1024 px, MASTER_SPEC §7; founder may override).
- **lg+:** lg+ 3; tv 4.

## Accessibility
- Sortable grids with keyboard moves; alt text on avatars/logos; published switch labelled with item name.

## Motion
- Reorder settle 150 ms.
- Reduced motion: instant.

## Navigation
→ `/content/landing`, `/products/[id]?tab=testimonials`.

## Data dependencies
Tables: `T-testimonials`, `T-client_logos`, `T-media`, `T-products`, `T-audit_logs`.
Queries: `listTestimonials(context)`, `listClientLogos` (API-CONT-09). Actions: API-CONT-05, API-CONT-06, API-CAT-21.

## Requirement IDs
D-312, D-117, D-1106, X-007, D-902/D-903 (logo contrast on both themes).
