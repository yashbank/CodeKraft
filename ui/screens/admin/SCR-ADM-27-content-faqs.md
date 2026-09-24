# SCR-ADM-27 — Content: FAQs

**Route:** `admin.<domain>/content/faqs?scope=site|chatbot|product` · **Render:** Client · **App:** Admin

## Purpose
Maintain FAQs with three scopes: **site** (shown on public pages such as the contact and legal pages' help blocks), **chatbot** (knowledge only; never rendered publicly), and **product** (edited per product in the product editor, listed here read-only for overview). FAQs feed the chatbot's knowledge index (D-701).

## User/role
Admin, Super Admin (`content.write`).

## Entry points
Sidebar "Content › FAQs", chatbot monitor "Improve answers → add FAQ", product editor link.

## Layout
- **Desktop:** h1 "FAQs", scope `Tabs` (Site / Chatbot-only / Product), search, "Add FAQ".
- Sortable list of rows: question (bold), answer preview (clamp 2), scope chip, product chip (product scope), published `Switch`, ⋯ (Edit, Duplicate to another scope, Delete).
- Editor `Sheet`: Question* (200 chars), Answer* (Tiptap-lite: paragraphs, lists, links), Scope `RadioGroup`, Product `Combobox` (product scope), Published.
- "Test with assistant" button runs a dry-run question through the chatbot test panel showing whether this FAQ is retrieved.
- **Phone / tablet (< lg):** not a supported layout — the admin app is designed for ≥ 1024 px (MASTER_SPEC §7 "Admin minimum width"). Below `lg` this screen renders the read-only "Open on a laptop" notice (docs/07 §3.4): page title, a one-line summary where cheap, links to Approvals and Notifications; no forms, tables or actions.

## Components
- shadcn/ui: `Tabs`, `Input`, `Button`, `Switch`, `Sheet`, `Form`, `Textarea`, Tiptap, `RadioGroup`, `Combobox`, `DropdownMenu`, `AlertDialog`, `Skeleton`
- custom: `SortableList`, `RetrievalTest`.

## Content & copy notes
- Scope hints: "Site FAQs appear publicly; Chatbot-only FAQs are used to answer questions but never shown as a list." Answers must not include contact details (D-808) — a lint warns when an email/phone pattern is detected.

## Interactions
- `upsertFaq`/`delete`/`reorder` (API-CONT-07); saves trigger `reindexKnowledge` (API-CHAT-13) debounced.
- Retrieval test uses the prompt tester from SCR-ADM-16 (counts as test usage).

## States
- **Default:** site scope.
- **Loading:** skeleton.
- **Empty:** "No FAQs in this scope".
- **Error:** validation; contact-detail lint warning (non-blocking).
- **Success:** toasts "FAQ saved — assistant index updating".
- **Permission-denied:** read-only.

## Responsive behaviour
- **< lg (phone, tablet):** read-only "Open on a laptop" notice (admin minimum width 1024 px, MASTER_SPEC §7; founder may override).
- **lg+:** lg–xl sortable list with drag handles, sheet 640 px; tv sheet 760 px, retrieval test panel stacks below the form.

## Accessibility
- Sortable keyboard alternative; sheet trap; lint warning `role="status"`.

## Motion
- Standard.
- Reduced motion: none.

## Navigation
→ `/chatbot?tab=prompts`, `/products/[id]?tab=faqs`.

## Data dependencies
Tables: `T-faqs`, `T-product_faqs` (read-only view), `T-products`, `knowledge_chunks`, `T-audit_logs`.
Queries: `listFaqs(scope)` (API-CONT-09). Actions: API-CONT-07, API-CHAT-13.

## Requirement IDs
D-701, D-1106, D-808, D-312 (product FAQs), A-304.
