# Two-Mac coordination

Two machines, one repo. Never both on the same task. Never push `main`. Never put secrets in any file here.

| | Mac A (planner / ops) | Mac B (builder) |
|---|---|---|
| Claude plan | Pro (low tokens) | Pro Max (heavy work) |
| Owns | Neon migrations, Vercel deploys, env/Resend, merging, full gate, live click-testing | Writing code + tests for tasks below, on feature branches |
| Never does | Heavy feature coding | Migrations on Neon, deploys, prod credentials, pushing `main`/`fix/autopilot` |

## Files and who writes them
- `docs/COORDINATION.md` (this file, plan + rules): Mac A edits only.
- `docs/coord/A.md`: Mac A edits only (status, requests to B, test results).
- `docs/coord/B.md`: Mac B edits only (status, requests to A, branch names, "ready for A" list).
- Everything above lives on branch `coord`. Use the `/sync` skill; it reads/writes via a worktree at `.coord/`.
- Per-file ownership means no merge conflicts. Do not edit the other machine's file; use `/sync task`.

## Code flow
1. B branches from `origin/fix/autopilot`: `feat/<task-id>-<slug>` (one branch per task, small).
2. B runs only: `pnpm typecheck`, `pnpm lint` on touched files, and `pnpm exec vitest run <touched test files>`. Not the full suite, not `next build`.
3. B pushes the branch, then `/sync push` marks the task `ready` with branch name + a 1-line test note.
4. A merges into `fix/autopilot`, runs the full gate (typecheck, lint, full vitest, build), applies migrations, deploys, click-tests live, marks `verified` or `bug:<what>`.
5. Schema change: B edits `src/**/schema` and runs `pnpm drizzle-kit generate` (no DB needed) on its branch. A never generates a migration while B has one pending. A applies it (user runs the Neon script manually).
6. Large file uploads (.exe/.dmg) must use direct-to-storage presigned upload. Vercel function bodies are limited to 4.5 MB.

## Token rules (both Macs)
- Caveman mode on. Read only needed ranges (Grep, Read offset+limit), never whole specs.
- Delegate search/impl to Sonnet or Haiku agents in worktrees (`isolation: worktree`); agents report at most 8 lines.
- Cheap deterministic checks first; one task, one commit, update `docs/coord/<X>.md`.
- No functionality changes beyond the task. Add a test for every fix.

## Status values
`todo` -> `doing` -> `ready` (B pushed) -> `merged` (A) -> `verified` (A live) | `blocked:<why>`

## Task table (Mac A maintains; status lives in A.md/B.md)
| ID | Phase | Task | Builder |
|---|---|---|---|
| P1-01 | 1 | Ledger: positive debit and credit in separate columns (no "-40,000"); totals reconcile with finance screens | B |
| P1-02 | 1 | Dashboard widgets match dashboard numbers; "My share" widget wired to the admin's real share | B |
| P1-03 | 1 | Notifications: one read-state source for bell, sidebar page, badge; queries/leads update live | B |
| P1-04 | 1 | Approvals card: requester, what, admin summary, other admin's note; no raw IDs/codes | B |
| P1-05 | 1 | Email: failures visible (logged + admin banner when sender/domain not configured); verification, invite, quote, invoice, magic link use one working path. Real delivery blocked until a domain exists | B (code), A (Resend/Vercel env) |
| P2-01 | 2 | Product versions: upload .exe/.dmg/etc. when delivery = download (presigned direct upload) | B |
| P2-02 | 2 | Licence: admin enters key while confirming payment; customer sees it after | B |
| P2-03 | 2 | After payment confirmed, customer can download version / see licence | B |
| P2-04 | 2 | PDF inline preview in product media | B |
| P3-01 | 3 | Content: legal editable, save, publish (no stuck "draft") | B |
| P3-02 | 3 | Client logos upload + landing strip with Dock-style magnify/scroll animation | B |
| P3-03 | 3 | Case studies add/edit/publish + Playwright test | B |
| P3-04 | 3 | Landing content fields labelled with where each shows (build / sell / proof / talk to us) | B |
| P3-05 | 3 | CTA label + target in content = what landing shows and works; target picker with an "Other URL" free-text option | B |
| P4-01 | 4 | Theme setting enabled + site-wide colour palette picker | B |
| P4-02 | 4 | Settings (site name, domain, legal name, address, contact, theme, flags) propagate to site, invoices, admin, user pages, with tests | B |
| P4-03 | 4 | AI: model list cheapest -> costliest, default changeable; daily caps + timeout enforced; system prompt + knowledge index review | B |
| P5-01 | 5 | Service icon picker: 30-40 premium icons with preview palette | B |
| P5-02 | 5 | Service cards redesign | B |
| OPS-1 | all | Merge, full gate, apply migrations, deploy, live click test after each phase | A |
| OPS-2 | later | Domain -> Resend domain verify -> `RESEND_API_KEY`, `EMAIL_FROM` in Vercel Production | A |
| P6-01 | 6 | Client logos render once only (currently twice -> broken on mobile/tablet). One Dock-style strip below Proof, smooth animation, hover grows, no layout shift or overflow at 360/768/1280 px | B |
| P6-02 | 6 | Site logo setting in admin Settings (upload/replace/remove). Applies to header, footer, admin shell, invoices, emails, favicon fallback. Resellable: no hardcoded CodeKraft logo left | B |
| P6-03 | 6 | Invoices: check print/PDF/HTML output vs previous look (seller, GST, items, totals, logo, page breaks, A4 print CSS). Fix all defects, add tests | B |
| P6-04 | 6 | UI sweep with Playwright at mobile/tablet/desktop on site + admin + account; fix console errors, overflow, dead buttons | B |
| P6-05 | 6 | Super admin "Reset site data" (Settings): tick categories (leads, quotes, customers+orders, products/services, content, finance), type site name to confirm, second super admin approves via approval engine, backup JSON download first. Keeps super admin accounts, settings, migrations. Reuse table list/order from scripts/wipe-demo-data.mjs. Audit-logged. Tests incl. that super admins survive | B |

Order for B: P1 (all tasks in parallel via agents) -> P2 -> P3 -> P4 -> P5 -> P6. A tests each phase as B marks tasks `ready`; B continues to the next phase without waiting.
