/**
 * P12-02: dead-button + layout guard. Key public and account routes must not scroll horizontally or
 * log console errors at 375 / 768 / 1280, and a sample of admin screens (1280) must have no enabled
 * button that does nothing when clicked. LOCAL ONLY (localhost DB + dev server).
 * "Failed to load resource" is ignored: local storage has no seed images/logos (env, not app).
 */
import { expect, test, type Page } from "@playwright/test";

const SITE = process.env.E2E_SITE_URL ?? "http://localhost:3000";
const ADMIN = process.env.E2E_ADMIN_URL ?? "http://admin.localhost:3000";
const PW = "local-super-admin-passphrase-2026";
const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
];
const PUBLIC = ["/", "/products", "/blog", "/contact", "/auth/login", "/auth/register"];
const ACCOUNT = ["/account", "/account/orders", "/account/settings", "/account/wishlist"];
const ADMIN_SAMPLE = [
  "/admin/dashboard",
  "/admin/customers",
  "/admin/finance/ledger",
  "/admin/settings",
];
/** Never click these (destructive / money-moving / session-ending). */
const DENY =
  /discard|delete|remove|revoke|reset|refund|approve|confirm|pay|sign out|log ?out|request|reject|archive|void|danger|suspend|disable|payout/i;

function watch(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().startsWith("Failed to load resource"))
      errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

async function login(page: Page, base: string, email: string): Promise<void> {
  await page.goto(`${base}/auth/login`);
  await page.waitForLoadState("networkidle"); // let the form hydrate before submitting
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PW);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 120_000 });
}

async function check(page: Page, errors: string[], route: string): Promise<void> {
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
  test.describe(`dead-buttons layout ${vp.width}`, () => {
    test.use({ viewport: vp });

    test("public routes: no overflow, no console errors", async ({ page }) => {
      test.setTimeout(480_000);
      const errors = watch(page);
      for (const route of PUBLIC) await check(page, errors, route);
    });

    test("account routes: no overflow, no console errors", async ({ page }) => {
      test.setTimeout(480_000);
      const errors = watch(page);
      await login(page, SITE, "buyer@codekraft.test");
      for (const route of ACCOUNT) await check(page, errors, route);
    });
  });
}

test.describe("dead buttons: admin sample @1280", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("no enabled button does nothing when clicked", async ({ page }) => {
    test.setTimeout(480_000);
    await login(page, ADMIN, "yashbank2002@gmail.com");
    let requests = 0;
    page.on("request", (r) => {
      if (["fetch", "xhr", "document"].includes(r.resourceType())) requests++;
    });
    page.on("download", () => requests++); // client-side CSV export
    const dead: string[] = [];
    for (const route of ADMIN_SAMPLE) {
      await page.goto(`${ADMIN}${route}`);
      await page.waitForLoadState("load");
      const labels = await page.evaluate(() => {
        const seen = new Set<string>();
        for (const e of document.querySelectorAll<HTMLElement>("main button:not(:disabled)")) {
          const t = (e.innerText || e.getAttribute("aria-label") || "").trim();
          if (t && e.getClientRects().length) seen.add(t);
        }
        return [...seen].slice(0, 15);
      });
      for (const label of labels) {
        if (DENY.test(label)) continue;
        const btn = page.locator("main button:not(:disabled)").filter({ hasText: label }).first();
        if (!(await btn.isVisible())) continue;
        const snap = () =>
          page.evaluate(() => `${location.href}|${document.body.innerHTML.length}`);
        const before = await snap();
        const r0 = requests;
        await btn.click({ timeout: 5000 }).catch(() => undefined);
        await page.waitForTimeout(600);
        const url = page.url();
        if (url !== before.split("|")[0]) {
          await page.goto(`${ADMIN}${route}`);
          continue;
        }
        if ((await snap()) === before && requests === r0) dead.push(`${route}: "${label}"`);
        await page.keyboard.press("Escape");
      }
    }
    expect(dead, "dead admin buttons").toEqual([]);
  });
});
