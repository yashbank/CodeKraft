# Property-based tests (`fast-check`)

Files here run inside the Vitest `unit` project (`pnpm test:unit`), 100 runs locally and 500 in CI
(`numRuns: process.env.CI ? 500 : 100`); the nightly workflow raises it to 5 000 (docs/10 §5).

`smoke.test.ts` only proves the harness. P3 adds `finance.test.ts` with the arbitraries of docs/10 §5:

| Arbitrary | Domain |
|-----------|--------|
| `arbMinor()` | prices 1–10 000 000 minor units (integers only, `codekraft/no-float-money`) |
| `arbCurrency()` | one of the five supported currencies |
| `arbOrder()` | 1–5 items, discount 0–100 %, tax 0 / 18 %, shortfall 0–5 % |
| `arbOwnership()` | 1–4 partners whose bps sum to 10 000, company cut 0–5 000 bps |

Invariants to encode: sum of splits equals the distributable amount, rounding never creates or
destroys a minor unit, and every allocation is reproducible from its inputs.
