# P22 help assistant staff-only, rich answers, responsive audit (resume file)
Rule: no push, no deploy, no prod DB or migration, no live LLM calls in tests. Local DB + stubs only. Owner says "go" once at the end. Each agent: own worktree /tmp/claude-501/p22-<n>, own branch, own port/DB/stub. Commit on own branch, report max 10 lines.
Owner decisions: customers get NO help button/API (they have queries + chatbot). Staff, partner, admin, super_admin get it; Settings toggle controls them. Partner help = own portal only. Hindi guides: keep if cheap, English first.

| # | Phase | Branch | Status |
|---|---|---|---|
| 1 | Role gating: unmount for customer/anonymous (site + account layouts), /api/help/ask returns {mode:"off"} 404 for customer/anon, settings copy, tests | qa/p22-1-gating | TODO |
| 2 | Guides per dashboard widget/screen (overdue follow-ups, leads, orders, etc.) for staff/partner/admin, EN (+HI), each guide has `links:` frontmatter (label+path) | qa/p22-2-guides | TODO |
| 3 | Rich answers: summary + steps + role-checked "Open screen" link buttons + Related chips; no extra tokens | qa/p22-3-rich | DONE d31965e |
| 4 | Responsive audit all roles 320/375/768/1024/1280/1920: spec + docs/P22-RESPONSIVE.md findings (no source fixes) | qa/p22-4-audit | TODO |
| 5 | Fix audit findings + UI polish | qa/p22-5-polish | TODO |
| 6 | Integration merge + full gate | qa/p22-integration | TODO |
