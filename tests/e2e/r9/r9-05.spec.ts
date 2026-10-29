/**
 * R9-05: no "for testing" / "tester" / "dev only" copy renders on any shipped page.
 * Same patterns as tests/unit/copy/no-tester-copy.test.ts (source-level guard).
 */
import { expect, test, type Page } from "@playwright/test";
import { ADMIN, SITE, loginAs, trackIssues } from "./helpers";

const PATTERNS: RegExp[] = [
  /testing only/i,
  /for testing/i,
  /\btester/i,
  /\btest only\b/i,
  /\btest-only\b/i,
  /testing purposes/i,
  /\breport (this )?to\b/i,
  /\bdev only\b/i,
  /\btest mode only\b/i,
];

async function expectNoTesterCopy(page: Page, label: string): Promise<void> {
  const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  const hits = PATTERNS.map((p) => body.match(p)?.[0]).filter(Boolean);
  expect(hits, `${label} renders tester copy`).toEqual([]);
}

test.describe("R9-05 no tester copy on shipped pages", () => {
  test("public home, products, product page, login", async ({ page }) => {
    const t = trackIssues(page);
    await page.goto(`${SITE}/`);
    await expectNoTesterCopy(page, "home");

    await page.goto(`${SITE}/products`);
    await expectNoTesterCopy(page, "products list");

    const firstProduct = page.locator('a[href^="/products/"]').first();
    await firstProduct.click();
    await page.waitForURL(/\/products\/[^/]+/);
    await expectNoTesterCopy(page, "product page");

    await page.goto(`${SITE}/auth/login`);
    await expectNoTesterCopy(page, "login");
    t.assertClean();
  });

  test("customer account pages", async ({ page }) => {
    await loginAs(page, "customer");
    for (const path of ["/account", "/account/orders", "/account/settings"]) {
      await page.goto(`${SITE}${path}`);
      await expectNoTesterCopy(page, `customer ${path}`);
    }
  });

  test("super_admin dashboard and settings", async ({ page }) => {
    await loginAs(page, "super_admin");
    for (const path of ["/admin", "/admin/settings"]) {
      await page.goto(`${ADMIN}${path}`);
      await expectNoTesterCopy(page, `admin ${path}`);
    }
  });
});
