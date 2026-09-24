# Changelog

All notable changes to the CodeKraft blueprint and implementation.

## [Docs 1.0] — 2026-09-24
### Added
- Requirements discovery (16 batches) → `discovery/00-DECISION-LOG.md`, `discovery/01-REQUIREMENTS-BASELINE.md` (approved).
- `MASTER_SPEC.md` canonical specification with terminology, non-negotiable rules and resolution table.
- Engineering documents `docs/01`–`docs/13`.
- 61 Mermaid diagrams under `diagrams/`.
- Sitemap, 61 screen specifications and two theme token sheets under `ui/`.
- Implementation master plan, phase files and progress/issue templates under `implementation/`.
- Orchestrator prompts under `prompts/`.

### Documentation corrections (during generation)
- Refund requests routed via order-page query instead of email (site publishes no email).
- License keys revealed in dashboard; email carries a link only.
- Tax inert until a GSTIN is configured.
- Project orders carry a dual-approved `split_snapshot`.
- Payments allow only `confirmed → refunded`; `entitlements.order_item_id` nullable for manual grants.
- Domain purchase moved to a release-1 entry criterion (Resend verified-domain requirement).
- Auth URLs standardised under `/auth/*`; checkout at `/checkout/[offeringId]`.

## [Docs 1.0.1] — 2026-09-25
### Documentation corrections (consistency review)
- Baseline §21 post-approval amendments added (domain before launch, order `failed` at expiry, manual-grant exemption, admin-removal rule, per-offering delivery config, R-801 rewording, Turnstile fail-closed).
- Added tables: `slug_redirects`, `credit_note_sequences`, `legal_page_versions`, `rate_limit_buckets`, `webhook_events`; columns `orders.split_approval_request_id`, `order_items.split_snapshot`, `payments.amount_refunded_minor/customer_credit_minor`, `product_media.alt`, `media.blur_hash`, `customer_profiles.notification_prefs`, `email_outbox.priority`; view `customer_credits`.
- Cron consolidated to `/api/cron/frequent` and `/api/cron/daily`; added `finance.reconcile` and `queries.auto_close` jobs.
- Rate limits, retention, CWV budgets, env var names and permission strings unified across docs/03, 06, 09, 10, 11, 12 and ui/sitemap.
- Entitlement initial status: `hosted` pending, all others active on grant.
- Implementation phase files (127 tasks) aligned to the final docs; ISSUES.md reduced to 8 open founder decisions.
