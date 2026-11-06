# Admin dashboard widgets: data sources

Every widget reads the database; there are no sample or static numbers on the live dashboard
(the `src/app/dev/screens` fixtures are for the dev showcase only). Loaders live in
`src/lib/admin/dashboard-data.ts` (entry point), `dashboard-widgets-data.ts` and
`dashboard-finance.ts`. `WIDGET_DATA_KEYS` (`src/components/admin/dashboard/widget-data-keys.ts`)
names the `DashboardData` slice each widget renders.

## Refresh rules (all widgets)

| Trigger | What happens |
| --- | --- |
| Page load / range change | Server render calls `loadDashboardData` for the widgets in the saved layout only. |
| Timer, every 60 s | `refreshDashboardWidgets` (one batched server action) re-reads every widget on screen. Paused while the tab is hidden; on return it refreshes at once if a full minute has passed. Silent: old numbers stay until the new ones arrive. |
| Refresh icon / menu | `refreshDashboardWidget` re-reads that one widget (spinner, error toast on failure). |
| After a mutation | Every `src/modules/*/admin-mutations.ts` wrapper calls `revalidatePath("/", "layout")` on success, which clears the client router cache, so the next visit to the dashboard renders fresh data. |
| Caption | Each widget shows "Updated just now / N min ago", set from the server read time and reset by each refresh. |

Empty state: a widget with no rows shows an explicit text ("No data yet", "No new leads", ...) or a
zero value with a "No data yet" delta; a card is never blank.

Currency: money figures are INR minor units from the ledger and go through
`useAdminMoney().inr(...)`, which converts to the viewing admin's currency with the rate table from
`src/modules/fx/convert.ts` (guarded by `tests/static/money-path-guard.test.ts`). Counts have no
currency.

## Widget table

| Widget key | Query (source) | Scope | Currency |
| --- | --- | --- | --- |
| `revenue_by_period` | `getReportQuery("revenue_by_period")` over `ledger_entries` for the selected range | `finance.reports` | viewer (INR minor to viewer) |
| `revenue_by_product` | `revenueByProduct` in `dashboard-finance.ts`: sales minus discounts per product from `ledger_entries` | `finance.ledger.read_all` | viewer |
| `revenue_by_partner` | `loadDashboardFinance`: net allocation per partner from `ledger_entries` | `finance.ledger.read_all` | viewer |
| `my_share` | `loadDashboardFinance`: the caller's partner allocations net of refunds, weekly sparkline | caller's partner | viewer |
| `outstanding_payouts` | `loadDashboardFinance`: owed balance minus approved payouts per partner | `finance.ledger.read_all` | viewer |
| `expenses_vs_profit` | `loadDashboardFinance`: monthly expenses vs profit from `expenses` and `ledger_entries` | `finance.ledger.read_all` | viewer |
| `payments_awaiting` | `loadDashboardFinance`: orders with a manual payment awaiting confirmation | `payments.confirm` | viewer |
| `publish_approvals` | `listApprovalsAction` type `product.publish`, status pending, `mine` | approver set | none |
| `split_approvals` | `listApprovalsAction` type `project_order.split`, status pending, `mine` | approver set | none |
| `service_checklists` | `loadServiceChecklists`: open `service_progress` steps per active entitlement | entitlements | none |
| `revocation_tasks` | `loadRevocationTasks`: open `delivery_tasks` of kind `revoke_external` | delivery | none |
| `new_leads` | `listLeadsQuery` status `new`; the count is the query's exact `total` (not the 5 listed rows) | role-scoped (admin: own + unassigned) | none |
| `pipeline_funnel` | `loadFunnel`: `leads` grouped by status | all leads | none |
| `overdue_follow_ups` | `listLeadsQuery` with `overdue: true` (follow-up in the past, not won/lost) | role-scoped | none |
| `conversion_rate` | `loadConversionRate`: won / (won + lost) of leads closed in range | all leads | none |
| `open_queries` | `listQueriesAdminQuery` status open | queries | none |
| `visits_top_products` | `loadVisits`: `analytics_events` page and product views, previous-period delta, top 5 products | analytics | none |
| `chatbot_usage` | `loadChatbotUsage`: today's `chat_usage_daily` rows against the configured caps | chat | none |
| `catalog_status` | `loadCatalogStatus`: `products` grouped by status, counted in SQL | super admin: all; others: own products | none |
| `new_customers` | `loadNewCustomers`: customer users created in range, daily sparkline | customers | none |
| `system_health` | `loadSystemHealth`: live health checks (DB, storage, migrations, ...) | super admin | none |
| `orders_heatmap` | `loadOrdersHeatmap`: `orders` of the last 90 days bucketed by weekday and hour (IST) | orders | none |

## Changing a widget

1. Add or change the loader and its `DashboardData` slice (`src/components/admin/types.ts`).
2. Register the slice in `WIDGET_DATA_KEYS`; `tests/unit/admin/dashboard-widgets-data-sources.test.tsx` fails if a widget has no source.
3. Money goes through `useAdminMoney`; never import `format` from `@/lib/money` in a widget.
4. Add a case to `tests/integration/dashboard/widget-g18-counts.test.ts` so the number is compared with a direct count.
