/**
 * P6-04: UI sweep guard. Key public routes + the account chat screen must not scroll
 * horizontally and must not log console errors at 390 / 768 / 1440. LOCAL ONLY (localhost DB + dev server).
 * "Failed to load resource" is ignored: local storage has no seed images/logos (env, not app).
 */
import { expect, test, type Page } from "@playwright/test";

const SITE = process.env.E2E_SITE_URL ?? "http://localhost:3000";
const PW = "local-super-admin-passphrase-2026";
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];
const PUBLIC = [
  "/",
  "/products",
  "/blog",
  "/services",
  "/projects",
  "/contact",
  "/legal/privacy",
  "/auth/login",
  "/auth/register",
];

async function check(page: Page, route: string): Promise<void> {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().startsWith("Failed to load resource"))
      errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${SITE}${route}`);
  await page.waitForLoadState("load");
  const w = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    iw: window.innerWidth,
  }));
  expect(w.sw, `${route} scrollWidth`).toBeLessThanOrEqual(w.iw + 1);
  expect(errors, `${route} console errors`).toEqual([]);
}

for (const vp of VIEWPORTS) {
  test.describe(`ui sweep ${vp.width}`, () => {
    test.use({ viewport: vp });

    test("public routes: no overflow, no console errors", async ({ page }) => {
      test.setTimeout(240_000);
      for (const route of PUBLIC) await check(page, route);
    });

    test("account chat: no overflow", async ({ page }) => {
      test.setTimeout(120_000);
      await page.goto(`${SITE}/auth/login`);
      await page.getByLabel("Email").fill("buyer@codekraft.test");
      await page.getByLabel("Password", { exact: true }).fill(PW);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 60_000 });
      await check(page, "/account/chat");
    });
  });
}
