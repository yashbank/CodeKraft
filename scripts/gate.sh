#!/usr/bin/env bash
# Push gate: run before every push to main (pnpm gate). Lint and tsc must not get worse than
# the recorded baselines; unit, integration and build must be fully green.
# shortcut: baselines instead of zero, drop them to 0 once the debt phase lands.
set -u
cd "$(dirname "$0")/.."
ROOT=$(pwd)
BASE_TSC=$(cat scripts/gate-baseline-tsc.txt)
BASE_LINT=$(cat scripts/gate-baseline-eslint.txt)
fail=0

step() { printf '\n== %s ==\n' "$1"; }

step "typecheck (baseline $BASE_TSC)"
TSC=$(pnpm exec tsc --noEmit 2>&1 | grep -c "error TS" || true)
echo "tsc errors: $TSC"
[ "$TSC" -le "$BASE_TSC" ] || { echo "FAIL: tsc errors rose above baseline"; fail=1; }

step "eslint (baseline $BASE_LINT)"
LINT=$(pnpm exec eslint . 2>&1 | grep -cE "^\s+[0-9]+:[0-9]+\s+error" || true)
echo "eslint errors: $LINT"
[ "$LINT" -le "$BASE_LINT" ] || { echo "FAIL: eslint errors rose above baseline"; fail=1; }

step "prettier (changed files only)"
CHANGED=$(git diff --name-only HEAD -- '*.ts' '*.tsx' '*.css' '*.md' '*.json' | grep -v '^docs/handoff/' || true)
if [ -n "$CHANGED" ]; then
  # shellcheck disable=SC2086
  pnpm exec prettier --check $CHANGED || { echo "FAIL: prettier"; fail=1; }
else
  echo "no changed files"
fi

step "unit"
pnpm exec vitest run --project unit > /tmp/gate-unit.log 2>&1 || true
grep -E "Test Files|Tests  " /tmp/gate-unit.log
# vitest can exit 0 with failures here, so trust the summary line, not the exit code.
grep -qE "Tests .*(failed|[^0-9]0 passed)" /tmp/gate-unit.log && { echo "FAIL: unit"; grep -E "^ *(×|FAIL)" /tmp/gate-unit.log | head -20; fail=1; }

step "integration"
CODEKRAFT_TEST_DB=embedded pnpm exec vitest run --project integration > /tmp/gate-integration.log 2>&1 || true
grep -E "Test Files|Tests  " /tmp/gate-integration.log
grep -qE "Tests .*(failed|[^0-9]0 passed)" /tmp/gate-integration.log && { echo "FAIL: integration"; grep -E "^ *(×|FAIL)" /tmp/gate-integration.log | head -20; fail=1; }

step "build"
pnpm build > /tmp/gate-build.log 2>&1 || { echo "FAIL: build"; tail -40 /tmp/gate-build.log; fail=1; }
echo "build ok"

echo
if [ "$fail" -eq 0 ]; then echo "GATE PASSED"; else echo "GATE FAILED"; fi
exit $fail
