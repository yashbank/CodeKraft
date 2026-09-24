/**
 * Shared Playwright fixtures and helpers (docs/10 §3 "tests/e2e/fixtures.ts", §8 axe).
 * Import `test`/`expect` from here rather than from @playwright/test so future fixtures
 * (seeded users, outbox, clock) attach in one place.
 */
import { test as base, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// axe-core is a transitive dependency of @axe-core/playwright; derive its types from the builder.
type AxeResults = Awaited<ReturnType<AxeBuilder["analyze"]>>;
type Result = AxeResults["violations"][number];
type ImpactValue = NonNullable<Result["impact"]>;

export const test = base;
export { expect };

export type A11yOptions = {
  /** Only violations at these impacts fail the test. Default: serious + critical. */
  impact?: ImpactValue[];
  /** axe rule ids to skip (document why at the call site). */
  disableRules?: string[];
  /** CSS selector to restrict the scan (default: whole document). */
  include?: string;
};

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];

function formatViolations(violations: Result[]): string {
  return violations
    .map((v) => {
      const nodes = v.nodes
        .slice(0, 5)
        .map((n) => `    - ${n.target.join(" ")}`)
        .join("\n");
      return `[${v.impact}] ${v.id}: ${v.help} (${v.helpUrl})\n${nodes}`;
    })
    .join("\n");
}

/**
 * Run axe-core on the current page and fail on serious/critical WCAG 2.1 AA violations.
 * Runs after the page settles; pass `impact: ["minor","moderate","serious","critical"]` for strict.
 */
export async function expectNoA11yViolations(page: Page, options: A11yOptions = {}): Promise<void> {
  const impact = options.impact ?? ["serious", "critical"];
  let builder = new AxeBuilder({ page }).withTags(WCAG_TAGS);
  if (options.disableRules?.length) builder = builder.disableRules(options.disableRules);
  if (options.include) builder = builder.include(options.include);
  const results = await builder.analyze();
  const violations = results.violations.filter((v) => v.impact && impact.includes(v.impact));
  expect(violations, `axe violations on ${page.url()}:\n${formatViolations(violations)}`).toEqual(
    [],
  );
}

/** Alias matching the PHASE-01 name. */
export const expectAxeClean = expectNoA11yViolations;

/** Emulate prefers-reduced-motion for the reduced-motion pass (docs/10 §8, D-907). */
export async function withReducedMotion(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
}
