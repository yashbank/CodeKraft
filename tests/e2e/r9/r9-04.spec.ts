/**
 * R9-04: product lifecycle + flags. Edit/republish/schedule a published product, the four flags on
 * the storefront, approved delete across all surfaces, editor + list at 3 widths.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { ADMIN, PASSWORD, SITE, atWidths, loginAs, q, trackIssues } from "./helpers";

test.describe.configure({ mode: "serial" });

type Prod = { id: string; slug: string; name: string };
let prod: Prod;
let doomed: Prod;
const SUPER = "yashbank2002@gmail.com";

const statusOf = async (id: string) =>
  (await q<{ status: string }>(`select status from products where id = $1`, [id]))[0]?.status;

async function loginEmail(page: Page, email: string) {
  // better-auth throttles sign-in (3 per 10 s per process); wait out the window and retry.
  for (let attempt = 0; ; attempt++) {
    await page.goto(`${ADMIN}/auth/login`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    try {
      await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 15_000 });
      return;
    } catch (e) {
      if (attempt >= 3) throw e;
      await page.waitForTimeout(11_000);
    }
  }
}

/** Every other admin-class user approves in their own context (approver set, BR-13). */
async function approveAll(browser: Browser, subject: RegExp) {
  const rows = await q<{ email: string }>(
    `select distinct u.email from users u join user_roles r on r.user_id = u.id
     where u.status = 'active' and r.role_key in ('super_admin','admin') and u.email <> $1`,
    [SUPER],
  );
  for (const { email } of rows) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginEmail(page, email);
    await page.goto(`${ADMIN}/admin/approvals`);
    await page.getByText(subject).first().click();
    await page.getByRole("button", { name: /^Approve:/ }).click();
    await expect(page.getByText(/Approved and applied|Approval recorded/).first()).toBeVisible();
    await ctx.close();
  }
}

async function openTab(page: Page, name: RegExp) {
  await page.getByRole("tab", { name }).click();
}

async function setFlag(page: Page, key: string, on: boolean) {
  await page.goto(`${ADMIN}/admin/products/${prod.id}`);
  const sw = page.locator(`#flag-${key}`);
  if (((await sw.getAttribute("aria-checked")) === "true") !== on) await sw.click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Basics saved")).toBeVisible();
}

test.beforeAll(async () => {
  const [p] = await q<Prod>(
    `select id, slug, name from products where status = 'published' and not is_unlisted
     and not is_coming_soon order by created_at limit 1`,
  );
  prod = p!;
  // Republish is blocked without media (BUG-061 readiness); seeded products have none.
  await q(
    `insert into product_media (product_id, kind, embed_url, title)
     select $1, 'video_embed', 'https://www.youtube.com/embed/r9-04', 'r9-04 media'
     where not exists (select 1 from product_media where product_id = $1)`,
    [prod.id],
  );
  const [u] = await q<{ id: string }>(`select id from users where email = $1`, [SUPER]);
  const slug = `r9-04-doomed-${Date.now()}`;
  const [d] = await q<Prod>(
    `insert into products (name, slug, short_description, status, published_at, created_by, updated_by)
     values ('R9 Doomed Widget', $1, 'to be deleted', 'published', now(), $2, $2)
     returning id, slug, name`,
    [slug, u!.id],
  );
  doomed = d!;
  // ownership is ON DELETE RESTRICT: a real published product always has it
  await q(
    `insert into product_ownerships (product_id, version, company_cut_bps, status, created_by)
     values ($1, 1, 10000, 'active', $2)`,
    [doomed.id, u!.id],
  );
});

test.afterAll(async () => {
  await q(`delete from product_media where product_id = $1 and title = 'r9-04 media'`, [prod.id]);
  await q(`update products set name = $2 where id = $1`, [prod.id, prod.name]);
  await q(
    `update products set is_featured = false, is_unlisted = false, is_coming_soon = false,
       status = 'published', publish_at = null where id = $1`,
    [prod.id],
  );
});

test("edit a published product and republish; change visible on the storefront", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const issues = trackIssues(page);
  await loginAs(page, "super_admin");
  const newName = `${prod.name} R9`;
  await page.goto(`${ADMIN}/admin/products/${prod.id}`);
  await page.locator("#p-name").fill(newName);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Basics saved")).toBeVisible();

  await openTab(page, /Publish \/ schedule/);
  await page.getByRole("button", { name: /Republish/ }).click();
  await expect(page.getByText(/Submitted for approval/)).toBeVisible();
  expect(await statusOf(prod.id)).toBe("published"); // stays live while pending
  await approveAll(browser, /publish/i);
  await expect
    .poll(async () => {
      await page.goto(`${SITE}/products/${prod.slug}`);
      return page.getByRole("heading", { name: newName }).count();
    })
    .toBeGreaterThan(0);
  issues.assertClean();
});

test("schedule a change; the cron publishes it when due", async ({ page, browser, request }) => {
  test.setTimeout(120_000);
  await loginAs(page, "super_admin");
  await page.goto(`${ADMIN}/admin/products/${prod.id}`);
  await openTab(page, /Publish \/ schedule/);
  const future = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 16);
  await page.locator("#pub-at").fill(future);
  await page.getByRole("button", { name: /Republish/ }).click();
  await expect(page.getByText(/Submitted for approval/)).toBeVisible();
  await approveAll(browser, /publish/i);
  await expect.poll(() => statusOf(prod.id)).toBe("scheduled");

  await q(`update products set publish_at = now() - interval '1 minute' where id = $1`, [prod.id]);
  const secret = process.env.CRON_SECRET;
  const res = await request.get(`${SITE}/api/cron/frequent`, {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
  expect(res.status()).toBeLessThan(500);
  await expect.poll(() => statusOf(prod.id)).toBe("published");
});

test("flags: featured, unlisted, coming-soon, tax-enabled", async ({ page }) => {
  await loginAs(page, "super_admin");

  await setFlag(page, "is_featured", true);
  await expect
    .poll(async () => {
      await page.goto(`${SITE}/`);
      return page.getByText(prod.name.slice(0, 12), { exact: false }).count();
    })
    .toBeGreaterThan(0);
  await page.goto(`${SITE}/products`);
  await expect(page.locator("a[href^='/products/']").first()).toHaveAttribute(
    "href",
    `/products/${prod.slug}`,
  );
  await setFlag(page, "is_featured", false);

  await setFlag(page, "is_coming_soon", true);
  await expect
    .poll(async () => {
      await page.goto(`${SITE}/products/${prod.slug}`);
      return page.getByText("Coming soon").count();
    })
    .toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: /buy|add to cart|checkout/i })).toHaveCount(0);
  await setFlag(page, "is_coming_soon", false);

  await setFlag(page, "is_unlisted", true);
  await expect
    .poll(async () => {
      await page.goto(`${SITE}/products`);
      return page.locator(`a[href='/products/${prod.slug}']`).count();
    })
    .toBe(0);
  const sitemap = await page.request.get(`${SITE}/sitemap.xml`);
  expect(await sitemap.text()).not.toContain(`/products/${prod.slug}`);
  const direct = await page.goto(`${SITE}/products/${prod.slug}`);
  expect(direct?.status()).toBe(200);
  await expect(page.locator("meta[name='robots']")).toHaveAttribute("content", /noindex/);
  await setFlag(page, "is_unlisted", false);

  const taxFlag = async () =>
    (await q<{ t: boolean }>(`select tax_enabled t from products where id = $1`, [prod.id]))[0]?.t;
  await setFlag(page, "tax_enabled", true);
  expect(await taxFlag()).toBe(true);
  await setFlag(page, "tax_enabled", false);
  expect(await taxFlag()).toBe(false);
});

test("request delete, approve with the other admins, product disappears everywhere", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  await loginAs(page, "super_admin");
  await page.goto(`${ADMIN}/admin/products`);
  await page.getByRole("button", { name: `Actions for ${doomed.name}` }).click();
  await page.getByRole("menuitem", { name: "Request delete" }).click();
  await page.getByLabel("Reason").fill("R9 delete check");
  await page.getByRole("button", { name: "Request approval" }).click();
  await expect(page.getByText(/Approval requested/)).toBeVisible();
  await approveAll(browser, /delete/i);

  await expect
    .poll(async () => (await q(`select 1 from products where id = $1`, [doomed.id])).length)
    .toBe(0);
  await page.goto(`${ADMIN}/admin/products`);
  await expect(page.getByText(doomed.name)).toHaveCount(0);
  await page.goto(`${SITE}/products`);
  await expect(page.locator(`a[href='/products/${doomed.slug}']`)).toHaveCount(0);
  const sitemap = await page.request.get(`${SITE}/sitemap.xml`);
  expect(await sitemap.text()).not.toContain(doomed.slug);
  expect((await page.request.get(`${SITE}/products/${doomed.slug}`)).status()).toBe(404);
});

test("editor and list render at 375/768/1280 without overflow", async ({ page }) => {
  await loginAs(page, "super_admin");
  await atWidths(page, `${ADMIN}/admin/products`, async () => {
    await expect(page.getByRole("heading", { name: /products/i }).first()).toBeVisible();
  });
  await atWidths(page, `${ADMIN}/admin/products/${prod.id}`, async () => {
    await expect(page.locator("#p-name")).toBeVisible();
  });
});
