# CODEKRAFT — IMPLEMENTATION MASTER PLAN

**Implements:** `MASTER_SPEC.md` §5 scope, `docs/13-ROADMAP.md`, all design docs.
**Executed by:** `prompts/ANTIGRAVITY-ORCHESTRATOR.md` or `prompts/CLAUDE-CODE-ORCHESTRATOR.md`.
**Detail per phase:** `implementation/PHASE-01.md` … `PHASE-09.md` (release 1), `PHASE-10.md` … (V1.1).

---

## 1. Planning principles

1. **Schema first, then parallel modules.** The whole database (`docs/05`) and every module's typed service contract are built in Phase 2 by a small team, so Phases 3–6 can run concurrently without hidden coupling.
2. **Modules before screens.** Domain modules ship with integration tests against Postgres before any UI consumes them. UI phases then only wire screens to tested actions.
3. **Finance and delivery are never parallelised with themselves.** One agent owns the ledger; one agent owns entitlements. Everything else may fan out.
4. **Earliest usable increment.** After Phase 4 the founders can already take a manual order end-to-end from the admin app (even before public UI), which de-risks R-401 and R-103.
5. **Every phase ends green.** CI (lint, typecheck, unit, integration, e2e for the phase's scenarios) must pass; `PROGRESS.md` updated; `CHANGELOG.md` entry.

## 2. Phase overview and dependency graph

| Phase | Name | Depends on | Parallel wave | Primary agents | Output |
|-------|------|-----------|---------------|----------------|--------|
| P1 | Foundation & tooling | — | W1 (solo) | 1 senior + 1 support | Runnable app skeleton, tokens/Theme 1, auth, RBAC, admin host, CI, test harness |
| P2 | Schema, contracts, seeds | P1 | W2 (2–3 agents, single integrator) | 1 integrator + 2 schema authors | Full Drizzle schema + migrations + triggers + views, module skeletons with service interfaces and Zod schemas, permission list, factories, seeds |
| P3 | Catalog, content, media, ownership, approvals, audit, settings, FX, search | P2 | W3 | 2–3 agents | Working admin-side domain for products/offerings/content; approval engine; audit; settings |
| P4 | Commerce & finance | P2 | W3 | 2 agents (orders/payments/quotes/coupons/invoices; ledger/allocations/payouts/expenses/reports) | Manual order → payment → ledger → invoice end to end (server-side) |
| P5 | Delivery & subscriptions | P2, P4 contracts | W3 | 1 agent | Entitlements, handlers, downloads, license keys, subscriptions + cron, service checklist, delivery tasks |
| P6 | Leads, queries, notifications, chat, analytics | P2 | W3 | 2 agents (leads/queries/notifications; chat/analytics) | Pipeline, threads, in-app + email channels, hybrid bot with caps, events |
| P7 | Public site & customer app UI + SEO | P1, P3 (site/catalog screens), P4+P5 (checkout/account screens) | W4 (site part may start when P3 done) | 3 agents (landing+motion+3D; catalog/content pages+SEO; auth+checkout+account) | All `ui/screens/user/*` screens |
| P8 | Admin app UI | P3, P4, P5, P6 | W4 | 3 agents (shell+dashboard widgets+catalog editors; orders/customers/finance; leads/queries/chat/content/settings/audit) | All `ui/screens/admin/*` screens |
| P9 | Hardening, performance, launch | P7, P8 | W5 (solo + reviewers) | 1 lead + 2 reviewers | CSP/headers, rate limits, Turnstile, retention jobs, Lighthouse/axe gates, full e2e, production deploy, founder checklist |
| P10 | Razorpay provider (V1.1) | P9 | — | 1 | Gateway adapter + webhooks + UPI AutoPay groundwork |
| P11 | Theme 2 light-editorial (V1.1) | P9 | — | 1 | Token sheet, QA across all screens |
| P12 | Phone OTP + WhatsApp channel (V1.1, flags) | P9 | — | 1 | SMS provider, WhatsApp channel adapter |
| P13 | Purchased hosting & domain migration (V1.1) | P9 | — | 1 | Docker deploy, DNS, admin subdomain, smoke tests |
| P14 | Stripe/PayPal, bundles (V1.1) | P10 | — | 1–2 | Additional providers; bundle offerings |
| V2 | Vendors, MIS/SSO, automated payouts/export, automated provisioning/license API | P14 | — | — | Outline only in `docs/13` |

```
W1: P1
W2: P2
W3: P3 ‖ P4 ‖ P5 ‖ P6          (P5 waits for P4's order/payment contracts, which are fixed in P2)
W4: P7 ‖ P8                    (P7 site pages may begin as soon as P3 is done)
W5: P9
```

## 3. Ownership map (who may write where)

| Path | Owner phase/task |
|------|------------------|
| `package.json`, `next.config.ts`, `middleware.ts`, `src/lib/*`, `src/styles/*`, `src/components/ui/*`, `.github/workflows/*`, `docker/*`, `src/modules/{auth,authz}/**`, `src/app/api/{auth,health}/**` | P1 (later changes via orchestrator only) |
| `drizzle/**`, `src/modules/*/schema.ts`, `src/modules/*/types.ts`, `src/modules/*/contracts.ts`, `tests/factories/*`, `scripts/seed.ts` | P2 |
| `src/modules/{catalog,offerings,media,content,blog,ownership,approvals,audit,settings,fx,search,users}/**`, `src/app/api/files/**`, `src/jobs/{fx,publish,knowledge}.ts` | P3 |
| `src/modules/{orders,payments,coupons,quotes,invoices,finance}/**`, `src/pdf/**`, `src/jobs/{order-expiry,quote-expiry}.ts` | P4 |
| `src/modules/{entitlements,delivery,subscriptions}/**`, `src/jobs/{subscriptions,retention}.ts` | P5 |
| `src/modules/{leads,queries,notifications,chat,analytics}/**`, `src/emails/**`, `src/app/api/{chat,notifications,analytics}/**`, `src/jobs/{email-outbox,lead-digest,chat-purge}.ts` | P6 |
| `src/app/(site)/**`, `src/app/(auth)/**`, `src/app/(account)/**`, `src/components/{site,account,motion,three}/**`, `src/modules/seo/**`, `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/api/og/**` | P7 |
| `src/app/(admin)/**`, `src/components/admin/**`, `src/modules/dashboard-widgets/**` | P8 |
| Security headers, rate-limit middleware, Turnstile wiring, `src/app/api/{cron,webhooks,csp-report}/**`, Lighthouse/axe configs, `tests/e2e/**` (full suite), deployment configs | P9 |

## 4. Agent responsibility profiles

| Profile | Use for | Model guidance |
|---------|---------|----------------|
| Domain-critical | P2 integrator, P4 finance, P5 delivery, auth/RBAC in P1, approvals in P3 | Highest-capability model, high effort |
| Domain-standard | Catalog, content, leads, queries, notifications, chat | Capable model, medium effort |
| UI builder | P7/P8 screens from `ui/screens/**` specs | Fast model, follow specs literally, all states |
| Reviewer | End of each phase: acceptance criteria audit, security checklist, doc sync | Capable model, read-only + report |

## 5. Cross-phase contracts fixed in P2 (must not change without an ADR)

- `finance.postOrderPaid(orderId, tx)`, `finance.postRefund(refundId, tx)`, `finance.postPayout`, `finance.postExpense`, `finance.postAdjustment`
- `entitlements.grantForOrder(orderId, tx)`, `entitlements.revoke(entitlementId, reason, tx)`
- `approvals.request(type, subject, payload, requesterId)`, `approvals.decide(requestId, adminId, decision)`, module `apply<Type>` handlers
- `notifications.emit(userId | 'admins', type, payload, channels)`
- `audit.log(actor, action, subject, before, after, tx)`
- `PaymentProvider` interface (`docs/04` §7.1)
- `LLMProvider` interface (`docs/04` §9)
- `DeliveryHandler` interface (`docs/04` §7.3)
- Permission string list (`docs/06` §1)

## 6. Testing gates per phase

| Phase | Must pass |
|-------|-----------|
| P1 | lint, typecheck, unit smoke, e2e: login/logout, admin host isolation, theme attribute present |
| P2 | migrations apply on clean DB; trigger tests (append-only, ownership sum, approver≠requester, category depth); seed runs; factories compile |
| P3 | integration: product lifecycle incl. approval; ownership versioning; content publish revalidation; media intents |
| P4 | integration + property tests: order totals; manual confirm with shortfall; ledger invariants; invoice numbering gapless under concurrency; refund reversal; payout/expense posting; reports match ledger |
| P5 | integration: entitlement per delivery type; download cap; license reveal; subscription reminder/grace/suspend via cron; revocation paths |
| P6 | integration: lead creation with Turnstile stub; assignment; follow-ups; query thread; notification fan-out; chat menu, AI (mocked provider), caps, escalation; analytics ingest |
| P7 | e2e: all customer journeys in `docs/10`; Lighthouse CI on /, /products, /products/[slug], /projects/[slug], /blog/[slug]; axe clean |
| P8 | e2e: all admin journeys in `docs/10`; widget layout persistence; approvals inbox; payment confirm; finance screens |
| P9 | full suite + security checklist + founder checklist generated + production smoke |

## 7. Risks and mitigations specific to the plan

| Risk | Mitigation |
|------|------------|
| P2 becomes a bottleneck | Split schema authoring by domain (identity+catalog+content / commerce+finance / delivery+leads+chat) with one integrator merging into a single migration set; contracts written from `docs/06` verbatim |
| Hidden coupling between P4 and P5 | Contracts in §5 are stubbed and unit-tested in P2; P5 tests use P4 factories, not P4 implementation |
| UI agents drift from design tokens | P1 ships a Storybook-free "kitchen sink" page at `/dev/ui` (non-prod) that renders every shadcn component in Theme 1; P7/P8 reuse only those |
| Cinematic landing blows CWV | P7 landing task has a Lighthouse budget gate; 3D hero is a separate sub-task with poster fallback shipped first |
| Timeline (R-103) | Phases 3–6 and 7–8 are genuinely parallel; earliest usable increment after P4; founder can cut P7's 3D hero or P8's widget customisation to a fixed layout if the window closes (documented fallback, requires founder decision) |
| Doc errors discovered in code | Fix-doc-in-same-PR rule + `CHANGELOG.md` "Documentation corrections" |

## 8. Progress tracking

`implementation/PROGRESS.md` (created in P1) is the single status board: phase, task, owner, status (todo/in-progress/blocked/done), branch, commit, tests, acceptance criteria ticked. `implementation/ISSUES.md` holds questions for the founder. `CHANGELOG.md` at repo root records every merged task and doc correction.
