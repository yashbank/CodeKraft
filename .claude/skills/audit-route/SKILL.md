---
name: audit-route
description: Audit one route of CodeKraft with Playwright (desktop + mobile), record findings to BUGS.md. Use during the audit phase, one invocation per route.
---

Args: a route path (e.g. /account/orders) and whether it's site or admin (admin.localhost:3000).

1. Navigate to the route at desktop width, then mobile width (375px).
2. Capture: console errors, failed network requests (4xx/5xx), empty states where data should render, dead buttons/links, forms that don't submit or don't show success/error state.
3. Prefer accessibility snapshot + console/network logs over screenshots.
4. Append each distinct finding to BUGS.md as a row: id (BUG-NNN, next free number), severity (blocker/major/minor), route, evidence (one line: error text or what's missing), status=open.
5. Return at most 10 lines to the caller: route, count of findings by severity, done.
