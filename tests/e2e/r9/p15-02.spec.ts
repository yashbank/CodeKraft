/** P15-02 Vercel load: ISR public pages + cache headers, admin edits still propagate, idle admin polling. */
import { expect, request as pwRequest, test, type Page } from "@playwright/test";

import { ADMIN, SITE, loginAs, q } from "./helpers";

const TAG = String(Date.now() % 100000);
const SITE_NAME = `P15 Load ${TAG}`;

test.describe("P15-02 public pages are cacheable", () => {
  test.setTimeout(120_000);

  test("anonymous GETs carry ISR cache headers; a currency cookie or search stays dynamic", async () => {
    const anon = await pwRequest.newContext();
    const slugs = [
      ...(await (await anon.get(`${SITE}/products`)).text()).matchAll(
        /href="\/products\/([a-z0-9-]+)"/g,
      ),
    ];
    const firstSlug = slugs[0]?.[1];
    expect(firstSlug, "seed has at least one product").toBeTruthy();
    const paths = [
      "/",
      "/products",
      `/products/${firstSlug}`,
      "/services",
      "/projects",
      "/blog",
      "/legal/privacy",
      "/contact",
    ];
    for (const path of paths) {
      await anon.get(`${SITE}${path}`); // warm
      const res = await anon.get(`${SITE}${path}`);
      expect(res.status(), path).toBe(200);
      const cc = res.headers()["cache-control"] ?? "";
      expect(cc, `${path} cache-control`).toMatch(/s-maxage=\d+/);
      expect(cc, `${path} cache-control`).not.toMatch(/no-store|private/);
      expect(["HIT", "STALE", "MISS", "REVALIDATED"], path).toContain(
        res.headers()["x-nextjs-cache"],
      );
    }

    // Per-user variants keep the per-request render.
    const usd = await pwRequest.newContext({
      extraHTTPHeaders: { cookie: "ck_currency=USD" },
    });
    for (const path of ["/", "/products", `/products/${firstSlug}`]) {
      const cc = (await usd.get(`${SITE}${path}`)).headers()["cache-control"] ?? "";
      expect(cc, `${path} with currency cookie`).toMatch(/no-store|private/);
    }
    const search = await anon.get(`${SITE}/products?q=crm`);
    expect(search.headers()["cache-control"] ?? "").toMatch(/no-store|private/);

    // The ISR twin is an implementation detail: not reachable directly.
    expect((await anon.get(`${SITE}/ssg/products`)).status()).toBe(404);
    await anon.dispose();
    await usd.dispose();
  });

  test("static assets are cacheable, per-user API responses are private", async () => {
    const anon = await pwRequest.newContext();
    const asset = await anon.get(`${SITE}/brand/mark.svg`);
    expect(asset.headers()["cache-control"]).toMatch(/max-age=\d{5,}/);
    const api = await anon.get(`${SITE}/api/notifications`);
    expect(api.headers()["cache-control"]).toBe("private, no-store");
    await anon.dispose();
  });
});

test.describe("P15-02 admin edits still reach the cached public pages", () => {
  test.setTimeout(240_000);

  test("site name saved in Settings shows on the cached home page", async ({ page }) => {
    const [name0] = await q<{ v: string }>(
      `select value #>> '{}' as v from site_settings where key = 'site_name'`,
    );
    const original = name0?.v ?? "CodeKraft";
    const anon = await pwRequest.newContext();
    const save = async (name: string) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`${ADMIN}/admin/settings`);
      await expect(page.getByRole("button", { name: "Save changes" })).toBeEnabled({
        timeout: 60_000,
      });
      await page.locator("#st-site").fill(name);
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Settings saved")).toBeVisible({ timeout: 30_000 });
    };
    try {
      await anon.get(`${SITE}/`); // make sure the old render is cached
      await loginAs(page, "super_admin");
      await save(SITE_NAME);
      await expect
        .poll(async () => (await (await anon.get(`${SITE}/`)).text()).includes(SITE_NAME), {
          timeout: 20_000,
        })
        .toBe(true);
    } finally {
      await save(original);
      await anon.dispose();
    }
  });
});

const POLLED = /\/api\/notifications|\/api\/admin\/orders\/alerts|[?&]_rsc=/;

async function countPolls(page: Page, ms: number): Promise<number> {
  let n = 0;
  const on = (r: { url(): string }) => {
    if (POLLED.test(r.url())) n++;
  };
  page.on("request", on);
  await page.waitForTimeout(ms);
  page.off("request", on);
  return n;
}

test.describe("P15-02 idle admin tab", () => {
  test.setTimeout(300_000);

  test("hidden tab makes no polling requests; a visible idle tab stays under 3/min", async ({
    page,
  }) => {
    await loginAs(page, "super_admin");
    await page.setViewportSize({ width: 1280, height: 900 });
    // Start hidden: the page never believes it is in the foreground.
    await page.addInitScript(() => {
      (window as unknown as { __hidden: boolean }).__hidden = true;
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => (window as unknown as { __hidden: boolean }).__hidden,
      });
    });
    await page.goto(`${ADMIN}/admin/dashboard`);
    await expect(page.getByRole("heading", { name: "Dashboard" }).first()).toBeVisible({
      timeout: 60_000,
    });
    await page.waitForTimeout(2_000);

    expect(await countPolls(page, 75_000), "polling requests while hidden").toBe(0);

    // Back to the foreground: one catch-up poll each, then the slow cadence.
    await page.evaluate(() => {
      (window as unknown as { __hidden: boolean }).__hidden = false;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(3_000);
    const perWindow = await countPolls(page, 150_000);
    // 150 s idle = 2.5 minutes: at most 3 requests/minute => 7 with boundary slack.
    expect(perWindow, "polling requests in 150 s of idle foreground").toBeLessThanOrEqual(7);
  });
});
