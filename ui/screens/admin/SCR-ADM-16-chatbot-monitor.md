# SCR-ADM-16 — Chatbot monitor

**Route:** `admin.<domain>/chatbot?tab=conversations|usage|prompts&id=` · **Render:** Client · **App:** Admin

## Purpose
Observe and control the hybrid assistant: browse transcripts (retained 12 months, D-1503), watch usage against the platform-wide and per-user daily caps (D-708), review escalations and captured leads, and manage system prompt versions with activation and rollback (docs/04 §9). Model selection and caps are edited in Settings › AI; this screen links to them.

## User/role
Admin, Super Admin (`chat.transcripts.read`, `chat.prompts.write`).

## Entry points
Sidebar "Chatbot", dashboard "Chatbot usage vs limits", notification "Daily chat cap reached", lead/query detail "View transcript".

## Layout
- **Desktop:** h1 "Chatbot".
- `Tabs`:
- **Conversations:** filters (date range, customer, outcome: Escalated / Lead captured / Fallback hit / Cap hit), search in messages. Two-pane: list (started, customer, turns, tokens, outcome chips, model, prompt version) + transcript viewer (messages with role labels User / Assistant / Menu / System, retrieved chunks per assistant turn in a `Collapsible` "Sources (8)" listing titles and rank, token counts, latency, stop reason; buttons "Open escalated query", "Open lead", "Purge now" (Super Admin, audited)).
- **Usage:** stat tiles: Today platform messages / cap (gauge), Users at cap today, 30-day messages, Estimated cost (tokens × configured model price), Fallback rate, Escalation rate. Charts: daily messages (bar, 30 d) with cap line; top users by messages (table, with "at cap" flag); model breakdown. Link "Adjust caps in Settings › AI".
- **Prompts:** table of `prompt_versions` (name, version, active badge, created by/at, notes) + editor pane: system prompt `Textarea` (monospace, 10k chars), version notes, "Save as new version", "Activate" (`AlertDialog` "Activate v4? All new conversations will use it."), "Roll back to this version", diff view vs active (side-by-side `DiffView`). Test panel: "Try a message" runs a dry-run against the selected version (counts toward platform cap; flagged in usage as test) and shows the answer + sources. "Rebuild knowledge index" button with last run time (`reindexKnowledge`).
- **Phone / tablet (< lg):** not a supported layout — the admin app is designed for ≥ 1024 px (MASTER_SPEC §7 "Admin minimum width"). Below `lg` this screen renders the read-only "Open on a laptop" notice (docs/07 §3.4): page title, a one-line summary where cheap, links to Approvals and Notifications; no forms, tables or actions.

## Components
- shadcn/ui: `Tabs`, `DataTable`, `DatePicker`, `Select`, `Input`, `Badge`, `Card`, `Collapsible`, `ScrollArea`, `Textarea`, `Button`, `AlertDialog`, `Progress`/gauge, Recharts, `Skeleton`
- custom: `TranscriptViewer`, `SourceList`, `DiffView`, `UsageGauge`, `PromptTester`.

## Content & copy notes
- Cap tiles: "1,240 / 2,000 messages today".
- Refusal/fallback reasons labelled (limit, refusal, timeout, unavailable).
- Prompt editor guard text: "The system prompt must keep the bot grounded on site content; the retrieval context is appended automatically." Cost estimate disclaimer "Estimate based on configured model pricing".

## Interactions
- Conversations via `listConversationsAdmin`/`getTranscript` (API-CHAT-11).
- Prompts via `listPromptVersions`/`createPromptVersion`/`activatePromptVersion` (API-CHAT-12); `reindexKnowledge` (API-CHAT-13) with job status polling (`listJobRuns`, API-OPS-02).
- Usage via `loadWidgetData('chatbot_usage')` (API-ADM-14) + analytics events.
- Purge → deletes conversation now (audited) with confirm.

## States
- **Default:** conversations, last 7 days.
- **Loading:** skeletons per tab.
- **Empty:** "No conversations in this range"; "No prompt versions — create the first".
- **Error:** provider unavailable banner on Usage ("Anthropic API unreachable since 10:02 — bot is in menu-only mode").
- **Success:** toasts "v4 activated", "Index rebuilt (412 chunks)".
- **Permission-denied:** prompts tab hidden without `chat.prompts.write`.

## Responsive behaviour
- **< lg (phone, tablet):** read-only "Open on a laptop" notice (admin minimum width 1024 px, MASTER_SPEC §7; founder may override).
- **lg+:** lg+ two-pane; tv wider transcript.

## Accessibility
- Transcript as `role="log"` static (not live); charts with hidden tables; diff view with per-line labels ("added/removed"); gauges with text values; activation dialog explicit.

## Motion
- Gauge fill 400 ms; chart entry. **Reduced motion:** static.

## Navigation
→ `/queries/[id]`, `/leads/[id]`, `/customers/[id]`, `/settings/ai`, `/audit?subject=prompt_versions`.

## Data dependencies
Tables: `T-conversations`, `T-chat_messages`, `chat_usage_daily`, `knowledge_chunks`, `prompt_versions`, `T-queries`, `T-leads`, `T-analytics_events`, `job_runs`, `T-site_settings` (model, caps), `T-audit_logs`.
Queries/actions: API-CHAT-11, API-CHAT-12, API-CHAT-13, API-ADM-14 (`chatbot_usage`), API-OPS-02.

## Requirement IDs
D-701, D-708, D-1503, D-1302, D-013, D-1104, docs/04 §9 (prompt management), A-304.
