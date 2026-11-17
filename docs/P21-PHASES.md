# P21 "Ask me anything" help assistant (resume file)
Rule: no push, no deploy, no prod DB or migration, no live LLM calls in tests. Local DB + stubs only. Owner says "go" once at the end.
Resume: read this file, continue the first phase not marked DONE.

## Contract (all agents follow)
- Knowledge: src/modules/help/knowledge/<locale>/<topic>.md, frontmatter: id, title, roles[] (customer|partner|staff|admin|super_admin), keywords[]. Loaded by src/modules/help/knowledge.ts.
- Search: src/modules/help/search.ts  searchHelp(query, role, locale) -> {hits:[{id,title,body,score}]}  (local BM25, zero cost)
- Config: src/modules/help/config.ts  getHelpConfig() -> {enabled, hindi, ai}  (from site settings; defaults enabled=true hindi=false ai=true)
- Answer: src/modules/help/answer.ts  answerQuestion({query, role, locale, userId}) -> {answer, sources[], mode: guide|ai|search|off}
- Route: POST /api/help/ask  (body {query, locale}); role from session, anonymous = customer-level public help
- UI: src/components/help/HelpLauncher.tsx (floating button + dialog + mic), mounted in site, account and admin layouts

| # | Phase | Branch | Status |
|---|---|---|---|
| 1 | Knowledge base EN + HI guides per role | qa/p21-1-knowledge | TODO |
| 2 | Search + answer API + caps/budget/cache + tests | qa/p21-2-backend | TODO |
| 3 | Premium pop-up UI + mic + mobile + dark mode | qa/p21-3-ui | TODO |
| 4 | Settings toggles (help, hindi, ai) + getHelpConfig | qa/p21-4-settings | TODO |
| 5 | Integration merge + security/abuse tests + full gate (3 parallel rounds) | qa/p21-integration | TODO |
