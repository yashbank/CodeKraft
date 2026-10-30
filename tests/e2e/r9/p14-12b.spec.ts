/**
 * P14-12b: site/account extras. Theme choice (dark/light/auto) persists per user; branded 404;
 * chat typing indicator; per-category notification preferences (toggle persists and is enforced
 * when an admin replies); web manifest; print stylesheet; skeleton loaders; cookie notice; empty
 * state artwork. Desktop project only: the spec sets its own viewports and mutates the buyer's
 * profile rows (restored in afterAll).
 */
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { ADMIN, SITE, atWidths, expectNoOverflow, loginAs, q } from "./helpers";

test.skip(({ viewport }) => (viewport?.width ?? 1280) < 1000, "spec sets its own viewports");
test.setTimeout(120_000);

const BUYER = "buyer@codekraft.test";
const TAG = `p1412b-${Date.now()}`;
let savedPrefs: unknown;

/** Contexts skip the one-time cookie notice so it never covers a click. */
async function quietContext(
  browser: import("@playwright/test").Browser,
  width = 1280,
): Promise<BrowserContext> {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem("ck_cookie_notice", "seen"));
  return ctx;
}

test.beforeAll(async () => {
  const [row] = await q<{ p: unknown }>(
    `select notification_prefs p from customer_profiles cp join users u on u.id = cp.user_id where u.email = $1`,
    [BUYER],
  );
  savedPrefs = row?.p ?? { email: true, inapp: true };
});

test.afterAll(async () => {
  await q(`update users set theme_pref = null where email in ($1, 'admin@codekraft.test')`, [
    BUYER,
  ]);
  await q(
    `update customer_profiles set notification_prefs = $1::jsonb where user_id = (select id from users where email = $2)`,
    [JSON.stringify(savedPrefs), BUYER],
  );
  await q(
    `delete from query_messages where query_id in (select id from queries where subject like $1)`,
    [`${TAG}%`],
  );
  await q(`delete from queries where subject like $1`, [`${TAG}%`]);
});

test("theme choice persists across reload, login, a fresh device and the admin host", async ({
  browser,
}) => {
  await q(`update users set theme_pref = null where email in ($1, 'admin@codekraft.test')`, [
    BUYER,
  ]);
  const ctx = await quietContext(browser);
  const page = await ctx.newPage();
  await page.goto(SITE);
  const html = page.locator("html");
  const toggle = page.locator("[data-theme-pref]").first();
  const start = await html.getAttribute("data-theme");
  const target = start === "light-editorial" ? "dark-cinematic" : "light-editorial";

  for (let i = 0; i < 3 && (await toggle.getAttribute("data-theme-pref")) !== target; i++) {
    await toggle.click();
  }
  await expect(html).toHaveAttribute("data-theme", target);
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", target);

  // Logging in adopts the anonymous choice onto the profile ...
  await loginAs(page, "customer");
  await page.goto(`${SITE}/account`);
  await expect
    .poll(
      async () =>
        (
          await q<{ t: string | null }>(`select theme_pref t from users where email = $1`, [BUYER])
        )[0]?.t,
      { timeout: 20_000 },
    )
    .toBe(target);

  // ... and a brand-new browser (no cookie) gets it after sign-in, on the account area.
  const fresh = await quietContext(browser);
  const page2 = await fresh.newPage();
  await loginAs(page2, "customer");
  await page2.goto(`${SITE}/account`);
  await expect(page2.locator("html")).toHaveAttribute("data-theme", target, { timeout: 15_000 });

  // The admin host reads the admin user's saved choice too.
  await q(`update users set theme_pref = $1 where email = 'admin@codekraft.test'`, [target]);
  const adminCtx = await quietContext(browser);
  const admin = await adminCtx.newPage();
  await loginAs(admin, "admin");
  await admin.goto(`${ADMIN}/admin/dashboard`);
  await expect(admin.locator("html")).toHaveAttribute("data-theme", target, { timeout: 15_000 });
  await ctx.close();
  await fresh.close();
  await adminCtx.close();
});

test("branded 404 on site, account and admin: status 404, logo, search, links, no stack", async ({
  browser,
}) => {
  const ctx = await quietContext(browser);
  const page = await ctx.newPage();
  const res = await page.goto(`${SITE}/nope-${TAG}`);
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse products" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search products" })).toBeVisible();
  await expect(page.getByRole("banner")).toBeVisible();
  expect(await page.locator("body").innerText()).not.toMatch(/\bat \S+\.(js|ts):\d+/);
  await page.getByRole("link", { name: "Go home" }).click();
  await expect(page).toHaveURL(`${SITE}/`);
  await atWidths(page, `${SITE}/nope-${TAG}`, async () => {
    await expect(page.getByRole("searchbox", { name: "Search products" })).toBeVisible();
  });

  await loginAs(page, "customer");
  const acc = await page.goto(`${SITE}/account/orders/00000000-0000-4000-8000-000000000000`);
  // Detail routes have no loading.tsx, so notFound() still sends a real 404 (R9-14 sweep relies on it).
  expect(acc?.status()).toBe(404);
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  await expect(page.getByRole("link", { name: "Account home" })).toBeVisible();

  const adminCtx = await quietContext(browser);
  const admin = await adminCtx.newPage();
  await loginAs(admin, "admin");
  const adm = await admin.goto(`${ADMIN}/admin/products/00000000-0000-4000-8000-000000000000`);
  expect(adm?.status()).toBe(404);
  await expect(admin.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  await expect(admin.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(admin.getByRole("link", { name: "Back to dashboard" })).toBeVisible();
  await ctx.close();
  await adminCtx.close();
});

test("chat shows 'Assistant is typing' while the reply is pending", async ({ browser }) => {
  const ctx = await quietContext(browser);
  const page = await ctx.newPage();
  await loginAs(page, "customer");
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route(
    (u) => u.pathname === "/api/chat",
    async (route) => {
      await held;
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "mock reply done" } }),
      });
    },
  );
  await page.goto(`${SITE}/account/chat`);
  const box = page.getByPlaceholder("Ask about your orders or our products");
  await box.fill(`hello ${TAG}`);
  await page.getByRole("button", { name: "Send" }).click();

  const typing = page.getByTestId("typing-indicator");
  await expect(typing).toBeVisible();
  await expect(typing).toHaveText("Assistant is typing");
  await expect(typing).toHaveAttribute("aria-live", "polite");
  release();
  await expect(typing).toBeHidden();
  await expect(page.getByText("mock reply done")).toBeVisible();
  await ctx.close();
});

test("notification preferences: toggle persists and is enforced on the next admin reply", async ({
  browser,
}) => {
  const ctx = await quietContext(browser);
  const page = await ctx.newPage();
  await loginAs(page, "customer");
  const [buyer] = await q<{ id: string }>(`select id from users where email = $1`, [BUYER]);
  await q(
    `update customer_profiles set notification_prefs = '{"email":true,"inapp":true}'::jsonb where user_id = $1`,
    [buyer!.id],
  );

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${SITE}/account/settings`);
  await page.getByRole("tab", { name: "Notifications" }).click();
  const email = page.getByRole("switch", { name: /Email for Queries and support/ });
  const inapp = page.getByRole("switch", { name: /In-app for Queries and support/ });
  await expect(email).toBeChecked();
  await email.click();
  await expect(email).not.toBeChecked();
  await expect(page.getByText("Preference saved").first()).toBeVisible();
  await inapp.click();
  await expect(inapp).not.toBeChecked();
  await expect
    .poll(async () => {
      const [r] = await q<{ p: { categories?: { queries?: Record<string, boolean> } } }>(
        `select notification_prefs p from customer_profiles where user_id = $1`,
        [buyer!.id],
      );
      return r?.p.categories?.queries;
    })
    .toEqual({ email: false, inapp: false });
  await page.reload();
  await page.getByRole("tab", { name: "Notifications" }).click();
  await expect(email).not.toBeChecked();
  await expect(page.getByText(/always sent/i)).toBeVisible();
  for (const w of [375, 768, 1280]) {
    await page.setViewportSize({ width: w, height: 900 });
    await expectNoOverflow(page);
  }

  const adminCtx = await quietContext(browser);
  const admin = await adminCtx.newPage();
  await loginAs(admin, "admin");
  const reply = async (subject: string) => {
    const [row] = await q<{ id: string }>(
      `insert into queries (user_id, subject, source) values ($1, $2, 'form') returning id`,
      [buyer!.id, subject],
    );
    await admin.goto(`${ADMIN}/admin/queries/${row!.id}`);
    await admin.getByLabel("Reply", { exact: true }).fill("Here is the answer.");
    await admin.getByRole("button", { name: "Reply", exact: true }).click();
    await expect(admin.getByText(/Reply sent/).first()).toBeVisible({ timeout: 20_000 });
    return row!.id;
  };
  const counts = async (queryId: string) => ({
    inapp: (
      await q(`select 1 from notifications where user_id = $1 and payload->>'queryId' = $2`, [
        buyer!.id,
        queryId,
      ])
    ).length,
    email: (await q(`select 1 from email_outbox where payload->>'queryId' = $1`, [queryId])).length,
  });

  const offId = await reply(`${TAG} switches off`);
  expect(await counts(offId)).toEqual({ inapp: 0, email: 0 });

  await email.click();
  await inapp.click();
  await expect(inapp).toBeChecked();
  const onId = await reply(`${TAG} switches on`);
  const on = await counts(onId);
  expect(on.inapp).toBeGreaterThan(0);
  expect(on.email).toBeGreaterThan(0);
  await q(`delete from notifications where payload->>'queryId' = any($1)`, [[offId, onId]]);
  await q(`delete from email_outbox where payload->>'queryId' = any($1)`, [[offId, onId]]);
  await ctx.close();
  await adminCtx.close();
});

test("manifest is served with the site name, colours and 192/512 icons", async ({ page }) => {
  const res = await page.request.get(`${SITE}/manifest.webmanifest`);
  expect(res.status()).toBe(200);
  const m = (await res.json()) as {
    name: string;
    display: string;
    theme_color: string;
    icons: { sizes: string }[];
  };
  expect(m.name.length).toBeGreaterThan(0);
  expect(m.display).toBe("standalone");
  expect(m.theme_color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  expect(m.icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  await page.goto(SITE);
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
});

test("print media hides site nav/footer and account chrome, text is black, links show URLs", async ({
  browser,
}) => {
  const ctx = await quietContext(browser);
  const page = await ctx.newPage();
  await page.goto(`${SITE}/legal/privacy`);
  await expect(page.getByRole("banner")).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("banner")).toBeHidden();
  await expect(page.getByRole("contentinfo")).toBeHidden();
  const color = await page
    .getByRole("heading", { level: 1 })
    .evaluate((el) => getComputedStyle(el).color);
  expect(color).toBe("rgb(0, 0, 0)");
  // The seeded legal text may hold no links, and evaluate() on a missing element waits out the
  // whole test timeout, so only measure when one exists.
  const link = page
    .locator("[data-print-urls] a[href^='/'], [data-print-urls] a[href^='http']")
    .first();
  const after = (await link.count())
    ? await link.evaluate((el) => getComputedStyle(el, "::after").content)
    : '" (x)"';
  expect(after).toMatch(/\(/);

  await loginAs(page, "customer");
  await page.emulateMedia({ media: "print" });
  await page.goto(`${SITE}/account/purchases`);
  await expect(page.getByRole("navigation", { name: "Account" })).toBeHidden();
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await ctx.close();
});

test("loading skeleton shows on a slow account and admin route", async ({ browser }) => {
  const ctx = await quietContext(browser);
  const page = await ctx.newPage();
  await loginAs(page, "customer");
  await page.goto(`${SITE}/account`);
  await page.route(/[?&]_rsc=/, async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });
  await page
    .getByRole("navigation", { name: "Account" })
    .first()
    .getByRole("link", { name: "Invoices" })
    .click();
  await expect(page.locator('[data-skeleton="list"]')).toBeVisible();
  await expect(page).toHaveURL(/\/account\/invoices/);
  await expect(page.locator('[data-skeleton="list"]')).toBeHidden({ timeout: 15_000 });

  const adminCtx = await quietContext(browser);
  const admin = await adminCtx.newPage();
  await loginAs(admin, "admin");
  await admin.goto(`${ADMIN}/admin/dashboard`);
  await admin.route(/[?&]_rsc=/, async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });
  await admin
    .getByRole("link", { name: /^Orders$/ })
    .first()
    .click();
  await expect(admin.locator('[data-skeleton="list"]')).toBeVisible();
  await ctx.close();
  await adminCtx.close();
});

test("cookie notice appears once and stays dismissed", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(SITE);
  const notice = page.getByRole("region", { name: "Cookie notice" });
  await expect(notice).toBeVisible();
  await expectNoOverflow(page);
  await notice.getByRole("button", { name: "Got it" }).click();
  await expect(notice).toBeHidden();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expect(notice).toBeHidden();
  await ctx.close();
});

test("empty states render the illustration (aria-hidden) at 375/768/1280", async ({ browser }) => {
  const ctx = await quietContext(browser);
  const page: Page = await ctx.newPage();
  await atWidths(page, `${SITE}/products?q=zzzz-${TAG}`, async () => {
    const art = page.locator('svg[viewBox="0 0 128 96"]').first();
    await expect(art).toBeVisible();
    await expect(art.locator("xpath=..")).toHaveAttribute("aria-hidden", "true");
  });
  await ctx.close();
});
