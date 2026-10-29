/**
 * P8-01: entitlement status chips/lines must not overflow at 375 / 768 / 1280.
 * Uses the dev screen previews (fixtures), LOCAL ONLY (dev server).
 */
import { expect, test } from "@playwright/test";

const SITE = process.env.E2E_SITE_URL ?? "http://localhost:3000";
const ROUTES = [
  "/dev/screens/account/purchases",
  "/dev/screens/account/entitlement",
  "/dev/screens/admin/entitlements",
];

for (const width of [375, 768, 1280]) {
  test.describe(`status chips ${width}`, () => {
    test.use({ viewport: { width, height: 900 } });
    for (const route of ROUTES) {
      test(`${route} has no horizontal overflow`, async ({ page }) => {
        await page.goto(`${SITE}${route}`);
        await page.waitForLoadState("load");
        const w = await page.evaluate(() => ({
          sw: document.documentElement.scrollWidth,
          iw: window.innerWidth,
        }));
        expect(w.sw, `${route} scrollWidth`).toBeLessThanOrEqual(w.iw + 1);
      });
    }
  });
}
