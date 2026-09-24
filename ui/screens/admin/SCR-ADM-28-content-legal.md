# SCR-ADM-28 — Content: legal pages

**Route:** `admin.<domain>/content/legal?page=privacy|terms|refunds|license` · **Render:** Client · **App:** Admin

## Purpose
Edit and version the four legal documents (D-807): Privacy policy, Terms of service, Refund & cancellation policy, Product license terms. Publishing creates a new version with a date shown publicly; previous versions remain viewable. Copy must reflect BR-09 (refunds never self-service; gateway payments non-refundable), BR-18 retention, Indian governing law (D-1504) and the cookie notice (A-1501).

## User/role
Super Admin only (`content.write` + `content.publish`; restricted by policy to Super Admin in `docs/09`).

## Entry points
Sidebar "Content › Legal", settings › tax ("Update terms after GST registration"), refund dialog link "Policy text".

## Layout
- **Desktop:** h1 "Legal pages".
- Left rail: four pages with "v3 · published 24 Sep 2026" and draft indicator.
- Right: editor — Title*, Body (Tiptap with headings, lists, tables, links), "Effective date" (`DatePicker`, default today), Change summary* (internal, 200 chars), buttons "Save draft", "Publish new version" (`AlertDialog`: "Publish Terms v4? Customers see the new effective date; checkout consent references the current version."), "Preview".
- Right side panel: **Checklist** of required clauses per page (e.g. refunds page: "States refunds are reviewed by admins", "States gateway payments are non-refundable", "Links to product refundability") as switches the editor ticks manually; **Version history** list (version, published at/by, change summary, "View", "Restore as draft").
- **Phone / tablet (< lg):** not a supported layout — the admin app is designed for ≥ 1024 px (MASTER_SPEC §7 "Admin minimum width"). Below `lg` this screen renders the read-only "Open on a laptop" notice (docs/07 §3.4): page title, a one-line summary where cheap, links to Approvals and Notifications; no forms, tables or actions.

## Components
- shadcn/ui: `Tabs`/rail, `Form`, `Input`, Tiptap (full), `DatePicker`, `Textarea`, `Checkbox`, `Button`, `AlertDialog`, `Card`, `Skeleton`
- custom: `VersionHistory`, `ClauseChecklist`.

## Content & copy notes
- Reminder banner: "No public contact details on the site; the privacy page may reference the inquiry form and dashboard queries only (D-808). Invoice contact numbers are separate (D-406)." Checklist for privacy: AI transcript handling and 12-month retention; analytics without cookies.

## Interactions
- Save draft → `updateLegalPage` (API-CONT-08); Publish → `publishLegalPage` (version+1, `published_at`); revalidates `legal` and knowledge index.
- Restore → loads old body into draft.

## States
- **Default:** privacy page current draft/version.
- **Loading:** skeleton.
- **Empty:** unseeded page → template body with placeholders highlighted.
- **Error:** publish blocked if change summary empty.
- **Success:** toast "Terms v4 published".
- **Permission-denied:** Admin-role → 403.

## Responsive behaviour
- **< lg (phone, tablet):** read-only "Open on a laptop" notice (admin minimum width 1024 px, MASTER_SPEC §7; founder may override).
- **lg+:** lg–xl: three columns 2/7/3 (rail, editor, panel); 2xl–tv: editor measure capped at 880 px for readability; panel 360 px.

## Accessibility
- Editor toolbar labelled; version list as table; publish dialog explicit; checklist switches labelled.

## Motion
- Standard.
- Reduced motion: none.

## Navigation
→ site `/legal/[key]` preview, `/settings/tax`, `/audit?subject=legal_pages`.

## Data dependencies
Tables: `T-legal_pages`, `knowledge_chunks`, `T-audit_logs`.
Queries: `getLegalPage` (API-CONT-09). Actions: `updateLegalPage`/`publishLegalPage` (API-CONT-08), API-CHAT-13.

## Requirement IDs
D-807, D-1504, D-808, D-406, BR-09, BR-18, R-502, A-1501, D-1106, D-1503.
