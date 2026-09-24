# CodeKraft Diagrams

Mermaid diagrams embedded in Markdown. Every file opens with the spine sections and decision IDs it implements, and every diagram has a short legend. Sources of truth: `MASTER_SPEC.md`, `discovery/01-REQUIREMENTS-BASELINE.md`, `docs/04-SOLUTION-ARCHITECTURE.md`, `docs/05-DATABASE-DESIGN.md`. Status values, table names and column names are copied verbatim from `docs/05`.

## Index

| File | Diagrams | Contents |
|------|----------|----------|
| `system-architecture.md` | 5 | C4-style context (actors, system, nine externals), container view (route groups, API handlers, modules, jobs, PDF, emails, tokens), Vercel deployment, Docker/VPS deployment, cross-cutting request patterns |
| `database.md` | 9 | ER diagrams by group: identity and access; catalog, offerings, ownership; commerce; entitlements, delivery, subscriptions; finance ledger; approvals and audit; leads, queries, chat; content; notifications, dashboard, analytics, ops; plus an integrity-rule cheat-sheet |
| `user-flows.md` | 8 | Discover → inquire; register and verify; buy now → checkout → manual UPI/bank → reference → confirm → delivery per `delivery_type`; subscription state machine and renewal/grace/suspend sequence; refund via query → admin → credit note → revoke; chatbot menus/AI/caps/escalation; account deletion with retention |
| `admin-flows.md` | 13 | Product creation → offerings → ownership proposal → dual approval → schedule/publish (flow + product status machine); payment confirmation with shortfall; manual project order and invoice; lead pipeline state machine and pool/assignment; query state machine and thread sequence; generic approval request sequence; payout recording; expense entry; content publish and revalidation; widget dashboard layout save |
| `payment-flow.md` | 7 | `payments.status` and `orders.status` state machines; detailed `ManualProvider` sequence (order, UPI intent QR, reference, admin confirm, shortfall, ledger, invoice, entitlements, notifications); shortfall arithmetic; expiry and retry; future gateway webhook path and provider abstraction showing unchanged core |
| `revenue-flow.md` | 9 | Money flow customer → company account → partners; per-item ledger posting with BR-06 formula and worked example; refund reversal; payout; expense; partner balance computation; ownership versioning timeline (gantt) and snapshot immutability |
| `product-delivery-flow.md` | 10 | Entitlement state machine; handler dispatch; SaaS manual/automated; hosted; download with signed URL and cap; license key entry and reveal; service checklist; custom; revocation automatic vs `delivery_tasks`; update policy branches |

Total: 61 Mermaid diagrams, all parsed with Mermaid 11 (`mermaid.parse`) before commit. Diagram types used: `flowchart`, `sequenceDiagram`, `stateDiagram-v2`, `erDiagram`, `gantt`. C4 views are drawn as flowcharts with subgraphs for renderer portability.

## Conventions

- Node labels are quoted; parentheses and slashes appear only inside quoted labels.
- Enum values (`pending_payment`, `past_due`, `revoke_external`, …) are written exactly as in `docs/05`.
- Sequence participants are modules or route handlers from `docs/04` §5, not people, unless drawn as `actor`.
- Money in examples is in paise (INR minor units) per MASTER_SPEC §4.8.

## Open inconsistencies

All items previously listed here are resolved by `MASTER_SPEC.md` §7 or the spine documents; the diagrams now follow these readings:

1. Resolved: `partner_balances` is a plain SQL view (`docs/04` §7.2, `docs/05` §7; `revenue-flow.md` §6).
2. Resolved: refunds reverse sale, discount, tax, company cut and partner allocations proportionally (`refund_discount` added to the enum in `docs/05`); gateway fees and bank charges are never reversed (`revenue-flow.md` §3).
3. Resolved: project lines carry `order_items.split_snapshot`, dual-approved as `project_order.split` before invoice or payment; posting uses the snapshot like an ownership version (`admin-flows.md` §3, `database.md` §3, §6).
4. Resolved: an order is `fulfilled` when every entitlement is `active` and every service checklist is complete; download, license and manual-SaaS entitlements are `active` on grant (`product-delivery-flow.md` §1, `user-flows.md` §3).
5. Resolved: the 7-day grace is `subscriptions.status = past_due` with `entitlements.status = active`; after grace both become `suspended` (`user-flows.md` §4).
6. Resolved: access period, update policy and download cap live on `offerings.delivery_config` and are copied onto the entitlement at grant (MASTER_SPEC §4.2; `product-delivery-flow.md` §2, §10).
7. Resolved: `payments.amount_refunded_minor` and `customer_credit_minor` are declared in `docs/05` T-payments (`database.md` §3).
8. Resolved: uploads record `media` and `files_upload_intents` rows only (`docs/04` §6, `docs/05` §11).
9. Resolved: `queries.source` includes `email` and `manual` so emailed refund requests can be logged (`docs/05` T-queries; `admin-flows.md` §5, `user-flows.md` §5).
10. Resolved: the widget library is 20 widgets (`docs/04` §7.6).
