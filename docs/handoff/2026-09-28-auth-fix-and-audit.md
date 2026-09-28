# Handoff: Auth fix + full audit (2026-09-28)

## Context
Cloud session was production-hardening auth. Hit reliability limits (Vercel MCP
redeploys hang 3/3 times with no log access from that environment). Handing off
to local Claude Code, which has direct `vercel`/`git`/DB CLI access.

## What's already done
- Phases 1-7 (admin + customer backend wiring) complete, committed, pushed.
- Vercel prod env vars added: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `RESEND_API_KEY`, `EMAIL_TRANSPORT=resend`.
- Fixed: `GoogleButton` had **zero onClick handler** in both
  `src/components/account/LoginForm.tsx` and `RegisterScreen.tsx` — wired to
  `authClient.signIn.social({ provider: "google" })`. Commit `a720c5c`, pushed.
- DB: both bootstrap accounts (`yashbank2002@gmail.com`,
  `sanketshrikant42@gmail.com`) were deleted from `users` (cascade cleared
  accounts/sessions/roles). `users` table currently has 0 rows — clean slate.
- `BOOTSTRAP_ADMINS` in `src/modules/auth/hooks.ts` (~line 170) grants
  super_admin **only on sign-up**, not login.

## Known unresolved issues (found just now, NOT yet fixed)
1. **Google OAuth: `Error 400: redirect_uri_mismatch`** — the redirect URI
   Better Auth generates doesn't match what's registered in Google Cloud
   Console. Check: `BETTER_AUTH_URL` env value vs the actual domain being
   tested (`https://codekraft-dusky.vercel.app`), and the exact registered
   URI in Google Console (should be
   `<BETTER_AUTH_URL>/api/auth/callback/google`). Fix whichever is wrong.
2. **Register screen shows "account already exists" for a brand-new email**
   (`yash.bankar@iauro.com`, never used before). Strongly suspect a stale
   React state bug — `state` in `src/app/(auth)/auth/register/page.tsx` /
   `RegisterScreen.tsx` isn't resetting between attempts, or the error persists
   across edits. Needs real diagnosis, not just a guess — check network
   tab / actual API response for that email.
3. **Vercel deploys via MCP/API hung 3/3 times** at 15-25 min, BUILDING,
   never erroring, never completing (I canceled after waiting). Never
   confirmed via dashboard logs what's actually happening. Run `vercel --prod`
   directly from terminal here and watch real build output — if it also
   hangs, that's a real infra issue to investigate (build queue/concurrency
   limits, a slow/network-bound build step); if it completes fine, the MCP
   path itself was the problem.

## Phase-wise plan for this session

**Phase A — Auth: verify, diagnose, fix, deploy, verify again**
1. Confirm env vars are actually set: `vercel env ls production`.
2. Diagnose + fix `redirect_uri_mismatch` (Google Console redirect URI vs
   `BETTER_AUTH_URL`).
3. Diagnose + fix the register "already exists" stale-state bug with real
   evidence (don't guess — check the actual API response).
4. Commit, push, `vercel --prod` (or let git-triggered deploy run), **watch
   real build logs to completion**, confirm READY.
5. Live-test on the deployed URL: sign up fresh with both bootstrap emails,
   confirm super_admin role granted; sign in with email; sign in with Google;
   forgot-password → confirm email actually arrives (Resend).
6. Report back to Yash in short form. Stop and wait for his OK before Phase B.

**Phase B — Full role-based UI audit**
Re-read the original project docs/spec. Walk every route for both roles
(super_admin, customer) — no broken screens, real data loads (not fixtures),
matches spec. Report gaps found/fixed. Stop for OK.

**Phase C — Local dev verification**
`pnpm install && pnpm dev` — confirm no errors (watch for the
`@rollup/rollup-darwin-arm64` issue if `npm` was ever run here instead of
`pnpm`), confirm auth works locally too. Report. Stop for OK.

**Phase D — Content workflow test**
As super_admin, add/edit a project, a demo, a listing, a blog post — confirm
each round-trips to the DB and renders correctly. Report. Stop for OK.

**Phase E — Final polish + report**
Fix anything found in B-D, final deploy, final short status report covering
everything: what's done, what's left, how to use it.

## Working rules to follow (established this whole project)
- Complete one phase → STOP → wait for Yash to check the actual UI → then
  continue. Never batch multiple phases without checking in.
- Before every commit: `git add -- <exact files>` (never `-A` or `.`),
  `git diff --cached --stat` to verify only intended files/sane diff size,
  then commit, then `git push origin main` yourself (you have git access
  here — just do it, don't ask Yash to run commands).
- Keep replies to Yash short and concrete — no long explanations unless asked.
- "Flag, don't fake" — never fabricate data/UI that isn't really backed by a
  service; disable with a note instead.
- Give a short time estimate before starting each phase.
