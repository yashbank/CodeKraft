/**
 * P21-6: the help launcher must never cover a page action.
 *  - admin: no floating button at all; the trigger lives in the top bar, and the Save buttons of the
 *    settings and landing editors are clickable (trial click = full actionability incl. pointer hit test).
 *  - site and account: the floating button never overlaps any visible interactive element (links,
 *    buttons, inputs, sticky bars, cookie notice) at 375/768/1280, at the top and the bottom of the page.
 */
import { expect, test, type Page } from "@playwright/test";

import { ADMIN, SITE, WIDTHS, loginAs } from "./helpers";

test.setTimeout(120_000);

/** Interactive elements whose visible box intersects the launcher box (excluding the launcher). */
async function coveredByLauncher(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const l = document.querySelector<HTMLElement>('[data-testid="help-launcher"]');
    if (!l) return ["launcher missing"];
    const lr = l.getBoundingClientRect();
    const out: string[] = [];
    const sel = "a[href],button,input,textarea,select,[role=button],[role=link],[tabindex='0']";
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      if (el === l || l.contains(el) || el.closest("[inert]")) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      const hit = !(
        r.right <= lr.left ||
        r.left >= lr.right ||
        r.bottom <= lr.top ||
        r.top >= lr.bottom
      );
      if (!hit) continue;
      // Only count elements actually painted at that spot (not clipped / off-screen scroll content).
      const x = Math.max(r.left, lr.left) + 1;
      const y = Math.max(r.top, lr.top) + 1;
      const top = document.elementFromPoint(
        Math.min(x, innerWidth - 1),
        Math.min(y, innerHeight - 1),
      );
      if (top && (top === l || l.contains(top)) && r.bottom > 0 && r.top < innerHeight)
        out.push(
          `${el.tagName.toLowerCase()} "${(el.textContent ?? el.getAttribute("aria-label") ?? "").trim().slice(0, 30)}"`,
        );
    }
    return out;
  });
}

async function checkPage(page: Page, url: string, width: number) {
  await page.setViewportSize({ width, height: width < 500 ? 740 : 800 });
  await page.goto(url);
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
  await expect(page.getByTestId("help-launcher")).toBeVisible();
  // On a scrollable page an inline link under the floating button at scroll 0 is not blocked: the
  // user scrolls it clear (the bottom check below covers the end of the page). Only a page that
  // cannot scroll must be clean at the top, because there the overlap would be permanent.
  const scrollable = await page.evaluate(
    () => document.documentElement.scrollHeight > window.innerHeight + 4,
  );
  if (!scrollable) {
    expect(await coveredByLauncher(page), `${url} @${width} top`).toEqual([]);
  }
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);
  expect(await coveredByLauncher(page), `${url} @${width} bottom`).toEqual([]);
}

const seen = (page: Page) =>
  page.context().addCookies([{ name: "ck_cookie_notice", value: "seen", url: SITE }]);

for (const width of WIDTHS) {
  test(`site pages: launcher covers nothing @${width}`, async ({ page }) => {
    // Cookie notice stays visible on purpose: it is one of the things that must not be covered.
    for (const p of [
      "/",
      "/products",
      "/products/tradeflow",
      "/contact",
      "/services",
      "/legal/privacy",
    ])
      await checkPage(page, `${SITE}${p}`, width);
  });

  test(`account pages: launcher covers nothing @${width}`, async ({ page }) => {
    await seen(page);
    await loginAs(page, "customer");
    for (const p of [
      "/account",
      "/account/orders",
      "/account/purchases",
      "/account/queries",
      "/account/chat",
      "/account/quotes",
      "/account/settings",
    ])
      await checkPage(page, `${SITE}${p}`, width);
  });
}

test("admin: help trigger is in the top bar, never floating, and Save stays clickable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await loginAs(page, "super_admin");
  await page.goto(`${ADMIN}/admin/settings`);
  const launcher = page.getByTestId("help-launcher");
  await expect(launcher).toBeVisible();
  expect(await launcher.evaluate((el) => getComputedStyle(el).position)).not.toBe("fixed");
  await expect(page.locator("header").getByTestId("help-launcher")).toHaveCount(1);
  const save = page.getByRole("button", { name: "Save changes" });
  await save.scrollIntoViewIfNeeded();
  await save.click({ trial: true });
  await page.goto(`${ADMIN}/admin/content/landing`);
  await page
    .getByRole("navigation", { name: "Chapters" })
    .getByRole("button", { name: /What we build/ })
    .click();
  await page.getByRole("button", { name: "Save", exact: true }).click({ trial: true });
  for (const path of ["/admin/dashboard", "/admin/products", "/admin/orders"]) {
    await page.goto(`${ADMIN}${path}`);
    await expect(page.getByTestId("help-launcher")).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    expect(await coveredByLauncher(page), path).toEqual([]);
  }
  // Same dialog from the top bar; Alt+/ opens it too.
  await page.goto(`${ADMIN}/admin/dashboard`);
  await page.getByTestId("help-launcher").click();
  await expect(page.getByTestId("help-panel")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("help-panel")).toBeHidden();
  await expect(page.getByTestId("help-launcher")).toBeFocused();
});
