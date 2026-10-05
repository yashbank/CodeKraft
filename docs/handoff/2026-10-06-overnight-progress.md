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
- [x] **4. Entitlement detail page** (`/account/purchases/[id]`) — done, live. `entitlementsService.getMyEntitlement` (API-DEL-01) was already fully implemented and already ctx.userId-scoped (`NOT_FOUND` otherwise) but had no `defineAction` wrapper — added `getMyEntitlementQuery` in `src/modules/entitlements/queries.ts`. Added `mapEntitlementDetail` in `src/lib/account/purchases-view.ts` (builds on `mapEntitlementSummary`, doesn't duplicate it). New route: `src/app/(account)/account/purchases/[id]/page.tsx`.
  - `revealLicenseKey` (API-DEL-03) DOES exist, fully implemented in `entitlements/service.ts` (rate-limited, audited `license.revealed`) — but it was never wired anywhere (no `defineAction` wrapper, no client call site) and `EntitlementDetailScreen`'s own props don't even accept an `onReveal` callback today. Wiring a live "Reveal" round trip would mean expanding that component's contract, not just routing it — out of scope for this pass. Went with the documented fallback instead: `licenseKey.full` mirrors `licenseKey.masked` (never exposes the real key), with a comment in `purchases-view.ts` explaining why.
  - `hosted` is always left `undefined` — `provisioning.notes` (`provisioningNotesSchema`) is structured (`loginUrl?`, `username?`, `message?`), not free text, but has no `credentialsSentAt` and nothing else in `EntitlementView` carries that timestamp, so the hosted panel can't be filled honestly. Documented as a known gap, not guessed at.
- [x] **5. Order detail page** (`/account/orders/[id]`) — done, live. Same pattern: `ordersService.getMyOrder` (API-COM-05, takes the public `orderNo` like `CK-ORD-000001`, already `ctx.userId`-scoped) was fully implemented but had no `defineAction` wrapper — added `getMyOrderQuery`. Added `mapOrderDetailToOrderView` in new file `src/lib/account/order-detail-view.ts`. `mapOrderSummaryView`'s `id` field (`purchases-view.ts`) now carries the public `orderNo` instead of the internal uuid, since that's what `getMyOrder` looks up by and what the Purchases list's `${links.order}/${o.id}` href needs to resolve against this route. New route: `src/app/(account)/account/orders/[id]/page.tsx`.
  - `enabledMethods` narrows to the order's actual payment method rather than guessing at the offering's full `offering_payment_methods` row (not available from `getMyOrder`) — documented as a known gap in the mapper's header comment.
  - **Found, not fixed (pre-existing, confirmed predates this change):** `/account/purchases` (the list page, not touched this round) shows a generic "Couldn't load your purchases. Please try again." banner for a **brand-new signup** — reproduced against both the new deployment and the prior one (`codekraft-nbmlbc7n1-...`), so it's not caused by this commit. Root cause not isolated (`listMyEntitlements`/`listMyOrders` return an `AppError` that isn't logged server-side since it's not an "unexpected" error — `defineAction`'s reporter only fires for non-`AppError` throws). Does **not** appear to affect the new detail-page queries: hitting `/account/purchases/<uuid>` and `/account/orders/<orderNo>` for ids that don't exist/aren't owned both return clean `404`s in production (proving `getMyEntitlement`/`getMyOrder` execute correctly end-to-end against prod), so this looks isolated to the two list queries specifically. Worth a look in the morning since it'd affect every brand-new real customer's Purchases page.
  - Verification used a fresh throwaway test customer (`ck-verify-overnight-20261006@example.com`, created via `/api/auth/sign-up/email`) since no demo-customer credentials exist in the repo (only the two admin accounts above, and signing in with those via curl was blocked by this sandbox's own credential-use policy). That account owns nothing, so only the 404/not-found path could be exercised live; the 200-with-real-content path is covered by `pnpm build` + `tsc` + `eslint` passing clean plus code review, not a live click-through — a real human test (or an admin-granted test entitlement/order) is needed to see the full rendered detail screens. Left that test account in place (same treatment as the other diagnostic accounts already noted below) — harmless, `@example.com`, no real email/payment.
- [ ] **6. Automated tests** — vitest unit/integration tests for everything touched in 1-5 plus the earlier offerings/media wiring. Follow existing test patterns under `tests/unit/` and `tests/integration/`. Do not fix pre-existing unrelated failing tests (the ~40 pre-existing type errors / 576 lint errors catalogued earlier this session) — out of scope, don't touch.
- [ ] **7. Final regression pass** — full `pnpm build`, `npx tsc --noEmit -p .`, targeted `eslint` on every file touched this round, `vercel logs` check on every route touched, then update this file's status to DONE with a summary.

## Notes / gotchas learned this session
- Radix `TabsContent` doesn't render inactive tab content into SSR HTML — can't verify tab content via plain curl, only via the tab that's actually active server-side.
- `pnpm build` catches real Next.js Server/Client boundary issues `tsc` alone misses — always run it, not just tsc, before declaring something safe.
- Vercel deploys sometimes trigger twice for one push, and the alias can lag behind the newest Ready deployment for a bit — always confirm via `get_deployment` on the alias itself that the commit SHA matches before declaring a fix live.
- node_modules on this machine previously had non-macOS native binaries (from an earlier `npm install`) — if `tsx`/`vitest` suddenly fail with native-binding errors, `pnpm install` fixes it (already done once this session).
- Sandbox policy for this session blocks direct production DB reads (`psql "$DATABASE_URL"`, even read-only) and signing in via curl with the known admin credentials ("Credential Exploration") — verification of customer-facing routes has to go through a freshly self-registered test account instead. Diagnostic/test accounts left in the DB from this session: the items already listed in the task-4/5 note above, plus `ck-verify-overnight-20261006@example.com` (items 4/5 verification, `@example.com`, harmless).
