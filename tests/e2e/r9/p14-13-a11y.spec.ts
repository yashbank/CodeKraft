/**
 * P14-13: axe-core accessibility gate (WCAG 2.0/2.1/2.2 A + AA) over site, account (customer) and
 * admin (super_admin, 1280) routes. serious/critical violations fail; moderate/minor are printed.
 * Admin is skipped on the mobile project (LaptopNotice below 1024px).
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ADMIN, SITE, loginAs, q } from "./helpers";

test.setTimeout(60_000);
const TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const F = { blog: "how-fitdesk-pro-collects-fees-on-upi", project: "northwind-checkout" };

test.beforeAll(async () => {
  const one = async (sql: string) => (await q<{ slug: string }>(sql))[0]?.slug;
  F.blog = (await one(`select slug from product_blogs where status='published' limit 1`)) ?? F.blog;
  F.project = (await one(`select slug from case_studies limit 1`)) ?? F.project;
});

/** Run axe on the current page; print a compact list, fail on serious/critical. */
async function scan(page: Page, label: string): Promise<void> {
  // Some pages hold connections open (polling/chat): do not let networkidle eat the test budget.
  await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => {});
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const line = (v: (typeof violations)[number]) =>
    `${v.impact} ${v.id} x${v.nodes.length} ${String(v.nodes[0]?.target[0]).slice(0, 90)}`;
  const bad = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const rest = violations.filter((v) => !bad.includes(v));
  if (rest.length) console.log(`[a11y minor] ${label}: ${rest.map(line).join(" | ")}`);
  expect(bad.map(line), `${label}: serious/critical a11y violations`).toEqual([]);
}

const SITE_ROUTES: [string, () => string][] = [
  ["home", () => "/"],
  ["products", () => "/products"],
  ["product", () => "/products/tradeflow"],
  ["services", () => "/services"],
  ["projects", () => "/projects"],
  ["project", () => `/projects/${F.project}`],
  ["blog", () => "/blog"],
  ["blog post", () => `/blog/${F.blog}`],
  ["contact", () => "/contact"],
  ["privacy", () => "/legal/privacy"],
  ["login", () => "/auth/login"],
  ["404", () => "/definitely-not-a-page"],
];

test.describe("a11y: site", () => {
  for (const [name, path] of SITE_ROUTES)
    test(`site ${name}`, async ({ page }) => {
      await page.goto(`${SITE}${path()}`);
      await scan(page, `site ${name}`);
    });
});

const ACCOUNT_ROUTES = [
  "",
  "/purchases",
  "/invoices",
  "/queries",
  "/chat",
  "/notifications",
  "/settings",
];

test.describe("a11y: account (customer)", () => {
  for (const r of ACCOUNT_ROUTES)
    test(`account${r || " dashboard"}`, async ({ page }) => {
      await loginAs(page, "customer");
      await page.goto(`${SITE}/account${r}`);
      await scan(page, `account${r}`);
    });
});

const ADMIN_ROUTES = [
  "/admin/dashboard",
  "/admin/products",
  "/admin/orders",
  "/admin/customers",
  "/admin/settings",
  "/admin/finance/ledger",
  "/admin/queries",
];

test.describe("a11y: admin (super_admin)", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 1280) < 1000, "LaptopNotice below 1024px");
  for (const r of ADMIN_ROUTES)
    test(`admin ${r}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await loginAs(page, "super_admin");
      await page.goto(`${ADMIN}${r}`);
      // Settings: audit the Theme tab (the other tabs share the same chrome).
      if (r === "/admin/settings")
        await page.getByRole("button", { name: "Theme", exact: true }).click();
      await scan(page, `admin ${r}`);
    });
});
