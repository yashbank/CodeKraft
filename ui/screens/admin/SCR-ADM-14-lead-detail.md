# SCR-ADM-14 — Lead detail

**Route:** `admin.<domain>/leads/[leadId]` · **Render:** Client · **App:** Admin

## Purpose
Everything about one lead: contact and context (source, product, service interest, message, chatbot transcript if escalated), status, assignment, priority, notes and activity log, follow-up scheduling, and conversion to Won with an optional project order or custom quote (D-703–D-706, D-1107).

## User/role
Admin (assigned or pool), Super Admin.

## Entry points
Leads table/board, notifications, dashboard widgets, customer detail (leads by this user), query thread ("Related lead").

## Layout
- **Desktop:** Breadcrumb (Leads › Name).
- Header: name + company, source chip (+ product link), status `Select` (inline pipeline stepper: New › Contacted › Qualified › Proposal › Won/Lost), priority `Select`, assignee `Combobox` ("Claim" if pool), "Set follow-up" button with current date chip (overdue in red), ⋯ (Mark lost, Merge duplicate, Delete — only Super Admin, only if no activities).
- Left (8/12): **Original message** card (form fields as submitted: service interest chips, budget hint, message, product, submitted at, Turnstile verified tick, IP country); **Activity** timeline with composer at top — tabs Note / Call / Email (logged manually, no sending) — entries: notes (rich-lite), status changes, assignments, follow-up sets, system events ("Escalated from chatbot"); each with actor and time. **Chat transcript** card (if `source='chatbot'`): read-only last 20 turns with link to full transcript in chatbot monitor.
- Right (4/12): **Contact** card (email, phone, company, linked customer account link or "Not a customer"), **Follow-up** card (next date, note, "Done → set next" quick action), **Convert** card: "Create project order" (→ SCR-ADM-08 prefilled, marks Won on success), "Send custom quote" (→ SCR-ADM-09 prefilled; requires customer account), "Mark Won" (dialog: optional order link), "Mark Lost" (reason). **Related**: other leads with same email.
- **Phone / tablet (< lg):** not a supported layout — the admin app is designed for ≥ 1024 px (MASTER_SPEC §7 "Admin minimum width"). Below `lg` this screen renders the read-only "Open on a laptop" notice (docs/07 §3.4): page title, a one-line summary where cheap, links to Approvals and Notifications; no forms, tables or actions.

## Components
- shadcn/ui: `Breadcrumb`, `Badge`, `Select`, `Combobox`, `Popover`, `DatePicker`, `Textarea`, `Tabs`, `Card`, `Button`, `Dialog`, `AlertDialog`, `Avatar`, `Skeleton`
- custom: `PipelineStepper`, `ActivityTimeline`, `FollowUpCard`, `TranscriptExcerpt`.

## Content & copy notes
- Follow-up note placeholder: "What will you do next?" Overdue banner at top: "Follow-up was due 3 days ago".
- Lost reason list as SCR-ADM-13.
- No emails are sent from here (no email integration in release 1; "Email" activity is a log entry).
- Duplicate hint: "2 other leads share this email".

## Interactions
- Status change → `updateLeadStatus` (API-LEAD-05) (Won/Lost dialogs).
- Assign/claim → API-LEAD-04; priority → `updateLead` fields via API-LEAD-05 payload.
- Note/activity → `addLeadNote`/`logLeadActivity` (API-LEAD-06).
- Follow-up → `setFollowUp` (API-LEAD-07); "Done" clears and prompts next.
- Convert buttons navigate with `?lead=` prefill.

## States
- **Default:** loaded lead.
- **Loading:** skeleton.
- **Empty:** no activities → "No activity yet — add a note".
- **Error:** `Alert`; concurrent update conflict → "Updated by Priya just now — refresh".
- **Success:** toasts; timeline appends optimistically.
- **Permission-denied:** Admin-role not assigned and not pool → 403.

## Responsive behaviour
- **< lg (phone, tablet):** read-only "Open on a laptop" notice (admin minimum width 1024 px, MASTER_SPEC §7; founder may override).
- **lg+:** lg+ 8/4; tv 8/4.

## Accessibility
- Stepper is a `radiogroup`-like control with labels; timeline ordered list; composer tabs Radix; overdue banner `role="status"`; dialogs with required reason.

## Motion
- Timeline append fade 150 ms.
- Reduced motion: none.

## Navigation
→ `/leads`, `/orders/new?lead=`, `/quotes/new?lead=`, `/customers/[id]`, `/chatbot?tab=conversations&id=`, `/products/[id]`.

## Data dependencies
Tables: `T-leads`, `lead_activities`, `T-users`, `T-customer_profiles`, `T-products`, `T-conversations`/`T-chat_messages`, `T-orders`, `T-custom_quotes`, `T-audit_logs`.
Queries: `getLead` (API-LEAD-03), `getTranscript` (API-CHAT-11). Actions: API-LEAD-04, 05, 06, 07.

## Requirement IDs
D-703, D-704, D-705, D-706, D-1107, D-520, D-701, D-1503, D-512, D-1104.
