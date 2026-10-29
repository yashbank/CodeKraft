/**
 * P14-10: mobile sweep. At 375/390/768 the landing header starts at y=0 with no empty band above
 * or below it, and every public site, auth and customer account route has no horizontal
 * overflow, no blank band in the content flow and no tiny tap target. Menus and sheets open/close.
 * Desktop project only: the spec sets each viewport itself.
 */
import fs from "node:fs";
import { expect, test, type Cookie, type Page } from "@playwright/test";
import { SITE, authFile, expectNoOverflow, q } from "./helpers";

test.skip(({ viewport }) => (viewport?.width ?? 1280) < 1000, "spec sets its own viewports");

const WIDTHS = [375, 390, 768] as const;
type Row = Record<string, string>;
const F: Record<string, string> = {};

test.beforeAll(async () => {
  const one = async (sql: string) => (await q<Row>(sql))[0]?.x ?? "";
  const buyer = "(select id from users where email='buyer@codekraft.test')";
  F.product = await one(`select slug x from products where slug='tradeflow'`);
  F.caseStudy = await one(`select slug x from case_studies limit 1`);
  F.blog = await one(`select slug x from product_blogs limit 1`);
  F.order = await one(`select order_no x from orders where user_id=${buyer} limit 1`);
  F.entitlement = await one(`select id x from entitlements where user_id=${buyer} limit 1`);
  F.query = await one(`select id x from queries where user_id=${buyer} limit 1`);
  F.invoice = await one(
    `select i.id x from invoices i join orders o on o.id=i.order_id where o.user_id=${buyer} limit 1`,
  );
});

const SITE_ROUTES = [
  "/",
  "/products",
  "/products/:product",
  "/services",
  "/projects",
  "/projects/:caseStudy",
  "/blog",
  "/blog/:blog",
  "/contact",
  "/legal/privacy",
  "/legal/terms",
  "/legal/refunds",
  "/legal/license",
  "/auth/login",
  "/auth/register",
  "/auth/reset",
  "/auth/verify",
];
const ACCOUNT_ROUTES = [
  "/account",
  "/account/purchases",
  "/account/purchases/:entitlement",
  "/account/invoices",
  "/account/invoices/:invoice",
  "/account/quotes",
  "/account/queries",
  "/account/queries/:query",
  "/account/wishlist",
  "/account/notifications",
  "/account/settings",
  "/account/chat",
  "/account/orders/:order",
];

/** Vertical gaps between content leaves (text, media, controls) and where the first one starts. */
async function layout(page: Page) {
  return page.evaluate(() => {
    const MEDIA = new Set([
      "IMG",
      "SVG",
      "CANVAS",
      "VIDEO",
      "INPUT",
      "TEXTAREA",
      "SELECT",
      "IFRAME",
    ]);
    const spans: [number, number][] = [];
    for (const el of document.body.querySelectorAll("*")) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      // Fixed bars (account tab bar, sticky CTA) sit at the viewport edge, not in the page flow.
      let fixed = false;
      for (let a: Element | null = el; a && !fixed; a = a.parentElement)
        fixed = getComputedStyle(a).position === "fixed";
      if (fixed) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim());
      if (!own && !MEDIA.has(el.tagName.toUpperCase()) && el.getAttribute("role") !== "img")
        continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.right < 0 || r.left > innerWidth) continue;
      spans.push([r.top + scrollY, r.bottom + scrollY]);
    }
    spans.sort((a, b) => a[0] - b[0]);
    let end = spans[0]?.[1] ?? 0;
    let gap = 0;
    let gapAt = 0;
    for (const [t, b] of spans) {
      if (t - end > gap) [gap, gapAt] = [t - end, end];
      end = Math.max(end, b);
    }
    const hr = document.querySelector("header")?.getBoundingClientRect();
    return {
      gap: Math.round(gap),
      gapAt: Math.round(gapAt),
      firstTop: spans[0]?.[0] ?? 0,
      headerTop: hr?.top ?? 0,
      headerBottom: hr?.bottom ?? 0,
      firstBelowHeader: Math.min(...spans.filter(([t]) => t >= (hr?.bottom ?? 0)).map(([t]) => t)),
    };
  });
}

/** Visible controls under 40px tall or wide that a thumb has to hit. */
async function smallTargets(page: Page) {
  return page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        "button, input:not([type=hidden]), select, [role=button], [role=tab], nav a, header a, footer a",
      ),
    ]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden" || r.width < 2) return false;
        if (el.closest(".sr-only, [aria-hidden=true]")) return false;
        // Inline links in prose and whole-card stretched links are not thumb targets.
        if (
          el.closest("p, h1, h2, h3, h4") ||
          getComputedStyle(el, "::after").position === "absolute"
        )
          return false;
        const type = (el as HTMLInputElement).type;
        if (type === "checkbox" || type === "radio") return false;
        return r.height < 40 || r.width < 40;
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        const name = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 24);
        return `${el.tagName.toLowerCase()}[${name}] ${String(Math.round(r.width))}x${String(Math.round(r.height))}`;
      }),
  );
}

const fill = (p: string) => p.replace(/:(\w+)/g, (_, k: string) => F[k] ?? "");

async function visit(page: Page, path: string, w: number) {
  await page.setViewportSize({ width: w, height: 800 });
  const res = await page.goto(`${SITE}${path}`);
  expect(res?.status() ?? 0, `${path} status`).toBeLessThan(400);
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
}

test("landing: header at y=0, no empty band above or below it", async ({ page }) => {
  for (const w of WIDTHS) {
    await visit(page, "/", w);
    const l = await layout(page);
    expect(l.headerTop, `@${w} header top`).toBe(0);
    expect(l.firstTop, `@${w} first content (wordmark) near the top`).toBeLessThan(24);
    // Header is 56px; the hero eyebrow must follow soon after, not an empty bar of ~100px.
    expect(l.firstBelowHeader - l.headerBottom, `@${w} band under header`).toBeLessThanOrEqual(48);
    expect(l.gap, `@${w} blank band ${String(l.gap)}px at y=${String(l.gapAt)}`).toBeLessThan(200);
  }
});

test.describe("customer", () => {
  test.beforeEach(async ({ page }) => {
    const state = JSON.parse(fs.readFileSync(authFile("customer"), "utf8")) as {
      cookies: Cookie[];
    };
    await page.context().addCookies(state.cookies);
  });

  for (const route of [...SITE_ROUTES, ...ACCOUNT_ROUTES])
    test(`${route} - no overflow, blank band or tiny tap target`, async ({ page }) => {
      const path = fill(route);
      test.skip(route.includes(":") && path.includes("//"), `no fixture for ${route}`);
      test.skip(/\/$/.test(path) && path !== "/", `no fixture for ${route}`);
      await q(`delete from rate_limit_buckets`);
      const problems: string[] = [];
      for (const w of WIDTHS) {
        await visit(page, path, w);
        // A signed-in customer is bounced away from the auth pages: nothing to measure there.
        if (route.startsWith("/auth/") && !page.url().includes(route)) continue;
        await expectNoOverflow(page);
        const l = await layout(page);
        if (l.headerTop > 0 || l.gap >= 280)
          problems.push(`@${w} blank band ${String(l.gap)}px at y=${String(l.gapAt)}`);
        const small = await smallTargets(page);
        if (small.length) problems.push(`@${w} small targets: ${small.join(" | ")}`);
      }
      expect(problems, problems.join("\n")).toEqual([]);
    });

  test("menus and sheets open and close at 375", async ({ page }) => {
    await visit(page, "/", 375);
    await page.getByRole("button", { name: "Open menu" }).click();
    const dlg = page.getByRole("dialog");
    await expect(dlg).toBeVisible();
    await expectNoOverflow(page);
    const small = await dlg.evaluate((el) =>
      [...el.querySelectorAll<HTMLElement>("button, a")]
        .filter((b) => b.getBoundingClientRect().height < 40 && b.getBoundingClientRect().width > 2)
        .map(
          (b) =>
            `${b.textContent?.trim() ?? ""} ${String(Math.round(b.getBoundingClientRect().height))}px`,
        ),
    );
    expect(small, "menu sheet tap targets under 40px").toEqual([]);
    await page.keyboard.press("Escape");
    await expect(dlg).toBeHidden();
    await visit(page, "/account", 375);
    await page.getByRole("button", { name: "Open account menu" }).click();
    await expect(dlg).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dlg).toBeHidden();
  });
});
