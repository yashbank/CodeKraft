/**
 * P19-2: site phase (live | testing | maintenance), switched by a super admin in Settings.
 * Cookie-less visitors are served from ISR twins, so every check polls the public site (no cookies)
 * to prove a switch takes effect within seconds. Live is always restored in afterAll.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { ADMIN, SITE, loginAs, q } from "./helpers";

type Phase = "live" | "testing" | "maintenance";

test.describe.configure({ mode: "serial" });

async function setPhase(page: Page, phase: Phase): Promise<void> {
  await page.goto(`${ADMIN}/admin/settings`);
  await page.getByTestId(`site-phase-${phase}`).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Settings saved", { exact: true })).toBeVisible({ timeout: 30_000 });
}

/** A brand-new context: no cookies, so "/" is answered by the ISR twin. */
async function anonymous(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  return { ctx, page: await ctx.newPage() };
}

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  try {
    await loginAs(page, "super_admin");
    await setPhase(page, "live");
  } catch {
    // fall through to the direct reset
  } finally {
    await page.close();
  }
  await q(`delete from site_settings where key = 'site_phase'`);
});

test("live (default): no banner, no badge, indexable", async ({ browser }) => {
  const { ctx, page } = await anonymous(browser);
  const res = await page.goto(SITE);
  expect(res?.status()).toBe(200);
  expect(res?.headers()["x-robots-tag"] ?? "").not.toContain("noindex");
  await expect(page.getByTestId("site-test-banner")).toHaveCount(0);
  await page.waitForTimeout(1_000); // banner is fetched client-side after hydration
  await expect(page.getByTestId("site-test-banner")).toHaveCount(0);
  const robots = await (await page.request.get(`${SITE}/robots.txt`)).text();
  expect(robots).toContain("Sitemap:");
  await ctx.close();

  const su = await browser.newPage();
  await loginAs(su, "super_admin");
  await su.goto(`${ADMIN}/admin/dashboard`);
  await expect(su.getByRole("banner")).toBeVisible();
  await expect(su.getByTestId("site-phase-badge")).toHaveCount(0);
  await expect(su.getByText("production", { exact: true })).toHaveCount(0);
  await su.close();
});

test("testing: banner + noindex for visitors, badge for super admin only", async ({ browser }) => {
  const su = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await loginAs(su, "super_admin");
  await setPhase(su, "testing");

  const { ctx, page } = await anonymous(browser);
  await expect
    .poll(
      async () => {
        const res = await page.request.get(SITE);
        return `${res.status()} ${res.headers()["x-robots-tag"] ?? ""}`;
      },
      { timeout: 10_000, intervals: [500] },
    )
    .toBe("200 noindex, nofollow");
  await page.goto(SITE);
  await expect(page.getByTestId("site-test-banner")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("site-test-banner")).toContainText("Test site");
  const robots = await (await page.request.get(`${SITE}/robots.txt`)).text();
  expect(robots).toMatch(/Disallow:\s*\//);
  expect(robots).not.toContain("Sitemap:");
  await ctx.close();

  await su.goto(`${ADMIN}/admin/dashboard`);
  await expect(su.getByTestId("site-phase-badge")).toHaveText("Testing");

  const admin = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await loginAs(admin, "admin");
  await admin.goto(`${ADMIN}/admin/dashboard`);
  await expect(admin.getByRole("banner")).toBeVisible();
  await expect(admin.getByTestId("site-phase-badge")).toHaveCount(0);
  await admin.close();
  await su.close();
});

test("maintenance: visitors get 503, admin host + webhooks + admins keep working", async ({
  browser,
}) => {
  const su = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await loginAs(su, "super_admin");
  await setPhase(su, "maintenance");

  const { ctx, page } = await anonymous(browser);
  await expect
    .poll(async () => (await page.request.get(SITE)).status(), {
      timeout: 10_000,
      intervals: [500],
    })
    .toBe(503);
  const res = await page.goto(`${SITE}/products`);
  expect(res?.status()).toBe(503);
  expect(res?.headers()["retry-after"]).toBe("300");
  await expect(page.getByTestId("maintenance-page")).toBeVisible();
  // health and webhook routes are not gated
  expect((await page.request.get(`${SITE}/api/health`)).status()).toBe(200);
  expect(
    (await page.request.post(`${SITE}/api/webhooks/razorpay`, { data: "{}" })).status(),
  ).not.toBe(503);
  await ctx.close();

  // admin host still works, with the Maintenance badge for the super admin
  await su.goto(`${ADMIN}/admin/dashboard`);
  await expect(su.getByTestId("site-phase-badge")).toHaveText("Maintenance");
  // a normal admin keeps the admin app (session cookies are per host, so the storefront
  // staff bypass is covered by the middleware unit test)
  const adminPage = await browser.newPage();
  await loginAs(adminPage, "admin");
  await adminPage.goto(`${ADMIN}/admin/dashboard`);
  await expect(adminPage.getByRole("banner")).toBeVisible();
  await expect(adminPage.getByTestId("site-phase-badge")).toHaveCount(0);
  await adminPage.close();
  await su.close();
});

test("live again: storefront normal, no banner, no badge", async ({ browser }) => {
  const su = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await loginAs(su, "super_admin");
  await setPhase(su, "live");

  const { ctx, page } = await anonymous(browser);
  await expect
    .poll(async () => (await page.request.get(SITE)).status(), {
      timeout: 10_000,
      intervals: [500],
    })
    .toBe(200);
  const res = await page.goto(SITE);
  expect(res?.headers()["x-robots-tag"] ?? "").not.toContain("noindex");
  await page.waitForTimeout(1_000);
  await expect(page.getByTestId("site-test-banner")).toHaveCount(0);
  expect(await (await page.request.get(`${SITE}/robots.txt`)).text()).toContain("Sitemap:");
  await ctx.close();

  await su.goto(`${ADMIN}/admin/dashboard`);
  await expect(su.getByRole("banner")).toBeVisible();
  await expect(su.getByTestId("site-phase-badge")).toHaveCount(0);
  await su.close();
});
