# SCR-ADM-25 — Content: case studies

**Route:** `admin.<domain>/content/case-studies` and `/content/case-studies/[id]` · **Render:** Client · **App:** Admin

## Purpose
Author the project case studies (problem, solution, results, tech stack, images) that render at `/projects/[slug]` and in the Proof chapter (D-803, D-117). Published/unpublished lifecycle with SEO fields.

## User/role
Admin, Super Admin (`content.write`, `content.publish`).

## Entry points
Sidebar "Content › Case studies", landing editor Proof block, lead detail "Turn into case study" (prefills client name), "Create › Case study".

## Layout
- **List (desktop):** h1 "Case studies", status chips (Draft, Published), search, "New case study".
- `DataTable`: Cover thumb, Title, Client, Industry, Tech chips, Status, Published at, Updated, ⋯ (Edit, Preview, Publish/Unpublish, Duplicate, Delete).
- **Editor:** header (title inline, status, "Preview", "Publish"/"Unpublish", Save status).
- `Tabs`: **Story** (Title*, Slug* (changing a published slug writes `slug_redirects`, 301), Client name (blank → "Confidential client"), Industry (`Combobox` free), Tech stack (`TagInput`), Problem* (Tiptap), Solution* (Tiptap), Results* (Tiptap) + Metrics `ListEditor` (label + value, max 4, e.g. "Load time −60%")), **Media** (Cover* with alt, Gallery sortable with captions/alt), **SEO** (title, description, OG preview).
- Sticky save bar.
- **Phone / tablet (< lg):** not a supported layout — the admin app is designed for ≥ 1024 px (MASTER_SPEC §7 "Admin minimum width"). Below `lg` this screen renders the read-only "Open on a laptop" notice (docs/07 §3.4): page title, a one-line summary where cheap, links to Approvals and Notifications; no forms, tables or actions.

## Components
- shadcn/ui: `DataTable`, `Tabs`, `Form`, `Input`, `Combobox`, Tiptap, `Switch`, `Button`, `DropdownMenu`, `AlertDialog`, `Sheet` (media library), `Skeleton`
- custom: `TagInput`, `MediaPicker`, `SortableGallery`, `ListEditor`, `SeoPreview`.

## Content & copy notes
- Hint: "Don't name partners or team members; company-brand only (D-103)".
- Publish requires cover + all three story sections.

## Interactions
- `upsertCaseStudy` (autosave), `publishCaseStudy`/`unpublishCaseStudy`, `deleteCaseStudy` (API-CONT-04); revalidates `content`; knowledge reindex.
- Preview via draft cookie.

## States
- **Default:** list.
- **Loading:** skeleton.
- **Empty:** "No case studies yet".
- **Error:** validation; slug conflict.
- **Success:** toasts "Published — live at /projects/<slug>".
- **Permission-denied:** publish disabled without `content.publish`.

## Responsive behaviour
- **< lg (phone, tablet):** read-only "Open on a laptop" notice (admin minimum width 1024 px, MASTER_SPEC §7; founder may override).
- **lg+:** lg+ 960 px editor; tv wider.

## Accessibility
- Alt text required for cover and gallery; sortable gallery keyboard moves; Tiptap toolbar labelled; status announced on publish.

## Motion
- Standard.
- Reduced motion: none.

## Navigation
→ site `/projects/[slug]`, `/content/landing`, `/leads/[id]`.

## Data dependencies
Tables: `T-case_studies`, `T-slug_redirects` (write on slug change), `T-media`, `knowledge_chunks`, `T-audit_logs`.
Queries: `listCaseStudies`/`getCaseStudyBySlug` (API-CONT-09). Actions: API-CONT-04, API-CAT-21, API-CHAT-13.

## Requirement IDs
D-803, D-117, D-103, D-1106, A-1301, D-701.
