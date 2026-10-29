/**
 * R9-00: role smoke matrix on a production build. Per role: login, landing + key pages load with no
 * 5xx / console errors / horizontal overflow, and access control redirects. Test titles are
 * `[role] route - what`; scripts/e2e/bugs-r9.ts turns failures into BUGS-R9.md from that shape.
 */
import fs from "node:fs";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import {
  ADMIN,
  SITE,
  ROLE_EMAILS,
  PASSWORD,
  baseFor,
  expectNoOverflow,
  authFile,
  trackIssues,
} from "./helpers";
import type { Role } from "./helpers";

// Reuse the cookies saved by r9-auth.setup.ts (single active session per user: never log in again).
async function login(page: Page, role: Role) {
  const st = JSON.parse(fs.readFileSync(authFile(role), "utf8")) as {
    cookies: Parameters<BrowserContext["addCookies"]>[0];
  };
  await page.context().addCookies(st.cookies);
}

/** Load `path` on the role's host; assert it stays there, renders a main region, and is clean. */
async function visit(page: Page, base: string, path: string, opts: { stay?: boolean } = {}) {
  const t = trackIssues(page);
  const pending = new Set<string>();
  page.on("request", (r) => pending.add(r.url()));
  page.on("requestfinished", (r) => pending.delete(r.url()));
  page.on("requestfailed", (r) => pending.delete(r.url()));
  const res = await page.goto(`${base}${path}`, { timeout: 20_000 }).catch((e: Error) => {
    throw new Error(`page load hung on ${path}; pending: ${[...pending].slice(0, 3).join(" ")}`, {
      cause: e,
    });
  });
  expect(res?.status() ?? 0, `HTTP status for ${path}`).toBeLessThan(500);
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {
    test
      .info()
      .annotations.push({ type: "never-idle", description: [...pending].slice(0, 3).join(" ") });
  });
  if (opts.stay !== false) {
    const want = new URL(path, base).pathname;
    expect(new URL(page.url()).pathname, `redirected away from ${path}`).toBe(want);
  }
  await expect(page.locator("main:visible, [role=main]:visible, h1:visible").first()).toBeVisible();
  await expectNoOverflow(page);
  t.assertClean();
}

const CUSTOMER_PAGES = [
  "/account",
  "/account/purchases",
  "/account/invoices",
  "/account/quotes",
  "/account/queries",
  "/account/wishlist",
  "/account/notifications",
  "/account/settings",
  "/account/chat",
];
const PUBLIC_PAGES = [
  "/",
  "/products",
  "/products/tradeflow",
  "/projects",
  "/blog",
  "/services",
  "/contact",
  "/auth/login",
  "/auth/register",
  "/auth/reset",
];
const ADMIN_PAGES = [
  "/admin/dashboard",
  "/admin/products",
  "/admin/categories",
  "/admin/orders",
  "/admin/customers",
  "/admin/quotes",
  "/admin/leads",
  "/admin/queries",
  "/admin/chatbot",
  "/admin/delivery-tasks",
  "/admin/coupons",
  "/admin/entitlements",
  "/admin/approvals",
  "/admin/notifications",
  "/admin/audit",
  "/admin/admin-users",
  "/admin/settings",
  "/admin/content/landing",
  "/admin/content/testimonials",
  "/admin/content/blog",
  "/admin/content/case-studies",
  "/admin/content/faqs",
  "/admin/content/legal",
  "/admin/content/services",
  "/admin/finance/ledger",
  "/admin/finance/reports",
  "/admin/finance/expenses",
  "/admin/finance/adjustments",
  "/admin/finance/partners",
  "/admin/finance/allocations",
];
// Staff permissions (src/lib/authz/permissions.ts STAFF): no finance ledger/expenses/adjustments, no admin users/audit.
const STAFF_ALLOWED = [
  "/admin/dashboard",
  "/admin/products",
  "/admin/orders",
  "/admin/customers",
  "/admin/leads",
  "/admin/queries",
  "/admin/delivery-tasks",
  "/admin/content/blog",
  "/admin/finance/reports",
  "/admin/settings",
];
const STAFF_DENIED = [
  "/admin/finance/ledger",
  "/admin/finance/expenses",
  "/admin/finance/adjustments",
  "/admin/finance/partners",
  "/admin/finance/allocations",
  "/admin/admin-users",
  "/admin/audit",
];

test.describe("anonymous", () => {
  for (const p of PUBLIC_PAGES)
    test(`[anonymous] ${p} - loads`, ({ page }) => visit(page, SITE, p));

  test("[anonymous] /search - hands the query to /products", async ({ page }) => {
    await page.goto(`${SITE}/search?q=trade`);
    await expect(page).toHaveURL(/\/products\?q=trade/);
  });

  for (const p of ["/account", "/account/orders"])
    test(`[anonymous] ${p} - redirects to login`, async ({ page }) => {
      await page.goto(`${SITE}${p}`);
      await expect(page).toHaveURL(/\/auth\/login/);
    });

  test("[anonymous] /admin/settings - admin host redirects to login", async ({ page }) => {
    await page.goto(`${ADMIN}/admin/settings`);
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("[anonymous] /auth/login - wrong password shows an error", async ({ page }) => {
    await page.goto(`${SITE}/auth/login`);
    await page.getByLabel("Email").fill(ROLE_EMAILS.customer);
    await page.getByLabel("Password", { exact: true }).fill("definitely-wrong-password-1");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page
        .getByRole("alert")
        .or(page.getByText(/invalid|incorrect|wrong/i))
        .first(),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("[anonymous] /auth/reset - request step accepts an email", async ({ page }) => {
    const t = trackIssues(page);
    await page.goto(`${SITE}/auth/reset`);
    await page.getByLabel("Email").fill(ROLE_EMAILS.customer);
    await page
      .getByRole("button", { name: /send|reset|continue/i })
      .first()
      .click();
    await expect(
      page.getByText(/check your (email|inbox)|sent|if an account/i).first(),
    ).toBeVisible();
    t.assertClean();
  });

  test("[anonymous] /auth/reset - bad token shows the invalid state", async ({ page }) => {
    await page.goto(`${SITE}/auth/reset?error=INVALID_TOKEN`);
    await expect(page.getByText(/no longer valid/i).first()).toBeVisible();
  });
});

test.describe("seo", () => {
  test("[anonymous] /robots.txt - served with sitemap", async ({ request }) => {
    const r = await request.get(`${SITE}/robots.txt`);
    expect(r.status()).toBe(200);
    expect(await r.text()).toMatch(/sitemap/i);
  });

  test("[anonymous] /sitemap.xml - every URL resolves below 400", async ({ request }) => {
    const r = await request.get(`${SITE}/sitemap.xml`);
    expect(r.status()).toBe(200);
    const urls = [...(await r.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (m) => new URL(m[1]!).pathname,
    );
    expect(urls.length).toBeGreaterThan(3);
    const bad: string[] = [];
    for (const u of urls.slice(0, 40)) {
      const s = (await request.get(`${SITE}${u}`)).status();
      if (s >= 400) bad.push(`${s} ${u}`);
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });

  test("[anonymous] / - title, description, og tags and JSON-LD", async ({ page }) => {
    await page.goto(`${SITE}/`);
    await expect(page).toHaveTitle(/.{5,}/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.{20,}/);
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
    await expect(page.locator('script[type="application/ld+json"]').first()).toBeAttached();
    await expect(page.locator("html")).toHaveAttribute("data-theme", /.+/);
  });
});

test.describe("catalog and checkout", () => {
  test("[anonymous] /products - list links to a product detail", async ({ page }) => {
    const t = trackIssues(page);
    await page.goto(`${SITE}/products`);
    await page.locator('a[href^="/products/"]').first().click();
    await expect(page).toHaveURL(/\/products\/[^/]+$/);
    await expect(page.locator("h1").first()).toBeVisible();
    t.assertClean();
  });

  test("[customer] /checkout - buy link from a product opens checkout", async ({ page }) => {
    await login(page, "customer");
    const t = trackIssues(page);
    await page.goto(`${SITE}/products/tradeflow`);
    const buy = page.locator('a[href*="/checkout/"]').first();
    await expect(buy, "no checkout link on /products/tradeflow").toBeVisible();
    await buy.click();
    await expect(page).toHaveURL(/\/checkout\//);
    await expect(page.locator("h1").first()).toBeVisible();
    await expectNoOverflow(page);
    t.assertClean();
  });
});

for (const role of ["customer", "super_admin", "admin", "staff"] as const satisfies Role[]) {
  test.describe(role, () => {
    if (role === "customer") {
      for (const p of CUSTOMER_PAGES)
        test(`[customer] ${p} - loads`, async ({ page }) => {
          await login(page, role);
          await visit(page, SITE, p);
        });

      test("[customer] /admin/dashboard - blocked on the admin host", async ({ page }) => {
        await page.goto(`${ADMIN}/auth/login`);
        await page.getByLabel("Email").fill(ROLE_EMAILS.customer);
        await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
        await page.getByRole("button", { name: "Sign in", exact: true }).click();
        await page.waitForTimeout(2000);
        await page.goto(`${ADMIN}/admin/dashboard`);
        await expect(page).toHaveURL(/\/auth\/login/);
      });

      test("[customer] /account/chat - sends a message and gets a clean response", async ({
        page,
      }) => {
        await login(page, role);
        const t = trackIssues(page);
        await page.goto(`${SITE}/account/chat`);
        const box = page
          .getByPlaceholder("What should we look at?")
          .or(page.getByRole("textbox"))
          .first();
        await box.fill("Hello, what do you sell?");
        await page.getByRole("button", { name: "Send" }).click();
        await expect(page.getByText("Hello, what do you sell?").first()).toBeVisible();
        await page.waitForTimeout(3000);
        t.assertClean();
      });

      test("[customer] /account/invoices - lists or shows empty state", async ({ page }) => {
        await login(page, role);
        await page.goto(`${SITE}/account/invoices`);
        await expect(page.locator("table, [role=table], [data-empty], h1").first()).toBeVisible();
      });
    } else {
      const pages = role === "staff" ? STAFF_ALLOWED : ADMIN_PAGES;
      for (const p of pages)
        test(`[${role}] ${p} - loads`, async ({ page }) => {
          await login(page, role);
          await visit(page, baseFor(role), p);
        });

      if (role === "staff")
        for (const p of STAFF_DENIED)
          test(`[staff] ${p} - denied`, async ({ page }) => {
            await login(page, role);
            await page.goto(`${ADMIN}${p}`);
            await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
            const stayed = new URL(page.url()).pathname === p;
            const body = (await page.locator("body").innerText()).toLowerCase();
            expect(
              !stayed || /forbidden|not allowed|permission|not found|403|404/.test(body),
              `staff sees ${p}: ${body.slice(0, 120).replace(/\s+/g, " ")}`,
            ).toBe(true);
          });

      test(`[${role}] /admin/dashboard - Cmd/Ctrl+K opens the palette`, async ({ page }) => {
        await login(page, role);
        const t = trackIssues(page);
        await page.goto(`${ADMIN}/admin/dashboard`);
        await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
        await page.keyboard.press("Control+k");
        const dlg = page.getByRole("dialog").first();
        await expect(dlg).toBeVisible();
        await page.keyboard.type("prod");
        await page.keyboard.press("Escape");
        await expect(dlg).toBeHidden();
        t.assertClean();
      });

      if (role !== "staff") {
        test(`[${role}] /admin/finance/ledger - table or empty state renders`, async ({ page }) => {
          await login(page, role);
          await page.goto(`${ADMIN}/admin/finance/ledger`);
          await expect(
            page.locator("table:visible, [role=table]:visible, h1:visible").first(),
          ).toBeVisible();
        });
        test(`[${role}] /admin/settings - theme attribute present and settings tabs render`, async ({
          page,
        }) => {
          await login(page, role);
          await page.goto(`${ADMIN}/admin/settings`);
          await expect(page.locator("html")).toHaveAttribute("data-theme", /.+/);
          await expect(
            page.getByRole("tab").first().or(page.locator("h1:visible").first()),
          ).toBeVisible();
        });
      }
    }
  });
}
