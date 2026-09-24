# SCR-ADM-24 — Content: services

**Route:** `admin.<domain>/content/services` · **Render:** Client · **App:** Admin

## Purpose
Maintain the admin-editable list of services shown on `/services` and in the landing "What we build" chapter (D-302, D-806): title, summary, deliverables, body, icon, order and published state. Services never carry prices (BR-01).

## User/role
Admin, Super Admin (`content.write`).

## Entry points
Sidebar "Content › Services", landing editor "Edit services".

## Layout
- **Desktop:** h1 "Services" with count and "Add service".
- Sortable list (drag handle) of rows: icon, title, slug, summary (clamp 1), published `Switch`, ⋯ (Edit, Duplicate, Delete).
- Editing opens a right `Sheet` (640 px): Title*, Slug* (auto), Icon (`IconPicker` from a curated set), Summary* (200 chars), Deliverables (`ListEditor`, up to 10 short lines), Body (Tiptap), Published `Switch`, "Save".
- Live preview card at the bottom of the sheet rendering the public section.
- **Phone / tablet (< lg):** not a supported layout — the admin app is designed for ≥ 1024 px (MASTER_SPEC §7 "Admin minimum width"). Below `lg` this screen renders the read-only "Open on a laptop" notice (docs/07 §3.4): page title, a one-line summary where cheap, links to Approvals and Notifications; no forms, tables or actions.

## Components
- shadcn/ui: `Button`, `Switch`, `Sheet`, `Form`, `Input`, `Textarea`, Tiptap, `DropdownMenu`, `AlertDialog`, `Skeleton`
- custom: `SortableList`, `IconPicker`, `ListEditor`, `ServicePreview`.

## Content & copy notes
- Hint under Summary: "No pricing — services are inquiry-only (BR-01)".
- Delete confirmation notes leads referencing this service keep their `service_interest` text.

## Interactions
- `upsertService`, `deleteService`, `reorderServices` (API-CONT-03); reorder saves on drop; revalidates `content` and chatbot knowledge index.

## States
- **Default:** ordered list.
- **Loading:** skeleton rows.
- **Empty:** "No services — add your first" (seed provides 8).
- **Error:** slug conflict; save failure.
- **Success:** toasts.
- **Permission-denied:** read-only list.

## Responsive behaviour
- **< lg (phone, tablet):** read-only "Open on a laptop" notice (admin minimum width 1024 px, MASTER_SPEC §7; founder may override).
- **lg+:** lg–xl sortable list with drag handles, sheet 640 px; tv sheet 760 px, 56 px controls, preview card at full width.

## Accessibility
- Sortable list with keyboard alternative; sheet focus trap; icon picker with names; preview `aria-hidden` duplicate content?
- No — preview is labelled "Preview" and not focusable.

## Motion
- Row reorder settle 150 ms.
- Reduced motion: instant.

## Navigation
→ site `/services` preview, `/content/landing`.

## Data dependencies
Tables: `T-services`, `knowledge_chunks` (reindex), `T-audit_logs`.
Queries: `listServices` (API-CONT-09). Actions: API-CONT-03, `reindexKnowledge` (API-CHAT-13, triggered).

## Requirement IDs
D-302, D-806, D-1106, BR-01, D-105, D-701.
