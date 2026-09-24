# CodeKraft — Engineering Blueprint

Premium software-studio website + company-owned digital-product marketplace, specified end to end for AI-assisted implementation.

**Start here:** [`MASTER_SPEC.md`](MASTER_SPEC.md) — the canonical entry point, terminology, design rules, document map and resolution table.

## Repository layout

| Path | What it is |
|------|------------|
| `CODECRAFT_INITIAL_SPEC.md`, `ClaudePrompt.md` | Original founder inputs (historical; the brand is **CodeKraft**) |
| `discovery/00-DECISION-LOG.md` | Every decision (D-), assumption (A-), risk (R-), rejection (X-) with sources |
| `discovery/01-REQUIREMENTS-BASELINE.md` | Approved requirements baseline (BR-01…BR-18, roles, models, scope) |
| `MASTER_SPEC.md` | Canonical spec: terminology, non-negotiable rules, doc map, resolutions |
| `docs/01–13` | BRD, PRD, SRS, Solution Architecture, Database, API, UX/UI, Design System, Security, QA, SEO/Performance, DevOps, Roadmap |
| `diagrams/` | 61 Mermaid diagrams: system, database, user/admin flows, payment, revenue, delivery |
| `ui/` | Sitemap, 61 screen specs (`screens/user`, `screens/admin`), Theme 1 and Theme 2 token sheets |
| `implementation/` | Dependency-aware master plan, phase files P1–P9 (release 1) and V1.1, progress board, issues |
| `prompts/` | Orchestrator prompts for Antigravity and Claude Code |
| `CHANGELOG.md` | Documentation and implementation change history |

## Reading order for implementers
1. `MASTER_SPEC.md`
2. `discovery/01-REQUIREMENTS-BASELINE.md`
3. `docs/04-SOLUTION-ARCHITECTURE.md` → `docs/05-DATABASE-DESIGN.md` → `docs/06-API-SPECIFICATION.md`
4. `docs/09-SECURITY-DESIGN.md`, `docs/10-QA-TEST-STRATEGY.md`
5. `implementation/IMPLEMENTATION-MASTER-PLAN.md`, then the current `PHASE-xx.md`
6. Everything else on demand from the document map.

## Founder actions before release 1 goes live
- Buy the domain and verify it with Resend (customer email cannot be sent otherwise).
- Create Anthropic, Resend, Cloudflare R2, Neon, Umami, Turnstile and Sentry accounts (all free tiers) and add keys per `docs/12`.
- Provide the CodeKraft UPI VPA and bank details for the manual payment provider.
- Provide legal page copy or approve the placeholder drafts.
