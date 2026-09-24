/**
 * Foundation smoke (P1 gate): the app answers on the site and admin hosts, sets the theme
 * attribute (docs/08, D-901) and has no serious/critical axe violations (docs/10 §8).
 * Runs under every project, so both hosts and both device presets are covered.
 */
import { test, expect, expectNoA11yViolations, withReducedMotion } from "../fixtures";

test.describe("home @smoke", () => {
  test("responds 200 with a theme attribute on <html>", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("data-theme", /.+/);
    await expect(page.locator("main")).toBeVisible();
  });

  test("has no serious or critical accessibility violations", async ({ page }) => {
    await page.goto("/");
    await expectNoA11yViolations(page, { impact: ["serious", "critical"] });
  });

  test("renders with reduced motion", async ({ page }) => {
    await withReducedMotion(page);
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
  });
});
