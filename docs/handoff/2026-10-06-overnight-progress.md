# Overnight progress tracker (2026-10-06)

Resume point for any session picking this up. Update this file after every
commit. User is asleep, testing in the morning — keep going autonomously,
commit+deploy+verify after each item, do not wait for confirmation between
items in this list.

## Context
- Live site: https://codekraft-dusky.vercel.app (customer/site), https://codekraft-admin.vercel.app (admin)
- Admin creds: yashbank2002@gmail.com / CodeKraft-Admin-12406c! (super_admin)
  sanketshrikant42@gmail.com / CodeKraft-Admin2-6804b4! (super_admin)
- No browser tool available this session — verify via tsc/eslint/`pnpm build`/curl/vercel logs only.
  User will do the real click-through test in the morning.
- Git safety: `git add -- <exact files>` only, never `-A`/`.`. Push to main directly (no PR flow established in this project).
- After each commit: push, poll `vercel ls codekraft --prod` until the new deploy is Ready, confirm via `mcp__claude_ai_Vercel__get_deployment` that the alias serves the new commit SHA, then curl-verify the specific fix.

## Done this session (pre-overnight-round), for reference
- Auth: Google OAuth, register bug, role bootstrap on any login, mailer wiring, admin host routing — all fixed & live.
- Admin nav badges (real approvals/notifications counts, real env badge) — live.
- Dashboard real data wiring (quick-pass: real where a query exists, honest zero elsewhere) — live.
- Offerings "Add offering" dialog (create only) — live, unverified by human click-through.
- Media upload (product Media tab attach/detach, landing hero image) — live, unverified by human click-through.
- Categories/Products panel stale-state fix — live.
- Real 404 page + /products?q= wired — live.
- `/admin-users` 404 — confirmed real, looks like a Vercel/Next edge routing quirk for paths starting with literal "admin" (direct `/admin/admin-users` works fine). Parked, not fixed — low priority.

## Overnight task list (this round)

- [ ] **1. Debug ProductEditor interactivity** — user reports dropdowns dead, can't add offering/product/image, despite tsc/eslint/build/server-logs all clean. Re-derive from scratch, don't trust prior session's conclusion that "no bug found". Check hook ordering, Radix Select/Dialog wiring, stale closures, anything a browser-only error would cause that curl can't surface. If a real bug is found: fix, verify, commit, deploy, re-verify via curl + logs.
- [ ] **2. Complete Offerings tab** — edit existing offering (reuse/extend the Add dialog, prefilled), delete offering (`deleteOffering` wrapper already exists in `catalog/admin-mutations.ts`), wire the "Delivery config" tab's per-offering edit (provisioning/updatePolicy/downloadCap/accessMonths/instructionsJson/repoUrl/appUrl — shape depends on deliveryType, see `src/modules/offerings/contracts.ts` `deliveryConfigSchema`).
- [ ] **3. Media reorder** — `reorderProductMedia` wrapper already exists (`src/modules/media/admin-mutations.ts`). Wire the existing drag-handle UI (there's an unused `GripVerticalIcon` import in ProductEditor.tsx — that's the clue it was meant to be used for this).
- [ ] **4. Entitlement detail page** (`/account/purchases/[id]`) — `EntitlementDetailScreen` component exists, fully built, never routed. Raw data is in `EntitlementView` (`src/modules/entitlements/types.ts` `entitlementViewSchema`) via `listMyEntitlementsQuery` (filter by id) — has `versions`, `downloads.files`, `licenseKeyMasked`, `provisioning`, `serviceProgress`, `custom.attachments`, `instructionsHtml`. `EntitlementDetail` type (`src/components/account/types.ts`) extends `EntitlementSummary` with optional `files`/`changelog`/`licenseKey`/`hosted`/`steps`/`attachments`/`instructions`. Check whether `licenseKey.full` needs a separate reveal action (don't expose full key from the list query if it's masked there for a security reason — check for a `revealLicenseKey`-style action before assuming the list query can give it).
- [ ] **5. Order detail page** (`/account/orders/[id]`) — same story, `OrderStatusScreen` component exists, never routed. Find the real per-order query (check `src/modules/orders/queries.ts` for a customer-scoped single-order getter; `listMyOrdersQuery` only lists).
- [ ] **6. Automated tests** — vitest unit/integration tests for everything touched in 1-5 plus the earlier offerings/media wiring. Follow existing test patterns under `tests/unit/` and `tests/integration/`. Do not fix pre-existing unrelated failing tests (the ~40 pre-existing type errors / 576 lint errors catalogued earlier this session) — out of scope, don't touch.
- [ ] **7. Final regression pass** — full `pnpm build`, `npx tsc --noEmit -p .`, targeted `eslint` on every file touched this round, `vercel logs` check on every route touched, then update this file's status to DONE with a summary.

## Notes / gotchas learned this session
- Radix `TabsContent` doesn't render inactive tab content into SSR HTML — can't verify tab content via plain curl, only via the tab that's actually active server-side.
- `pnpm build` catches real Next.js Server/Client boundary issues `tsc` alone misses — always run it, not just tsc, before declaring something safe.
- Vercel deploys sometimes trigger twice for one push, and the alias can lag behind the newest Ready deployment for a bit — always confirm via `get_deployment` on the alias itself that the commit SHA matches before declaring a fix live.
- node_modules on this machine previously had non-macOS native binaries (from an earlier `npm install`) — if `tsx`/`vitest` suddenly fail with native-binding errors, `pnpm install` fixes it (already done once this session).
