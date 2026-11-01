/**
 * C16-06 round 3: the admin-chosen design loads by default for everyone (anonymous, customer,
 * super_admin, admin, staff) at 375/768/1280, and dark/light is the one per-user choice:
 * the toggle flips it and the choice survives a reload. Only settings.write may save the design.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  ADMIN,
  SITE,
  WIDTHS,
  loginAs,
  q,
  resetThemeViaUi,
  trackIssues,
  type Role,
} from "./helpers";

type Viewer = "anonymous" | Role;
const VIEWERS: Viewer[] = ["anonymous", "customer", "super_admin", "admin", "staff"];
const homeFor = (v: Viewer) => (v === "anonymous" || v === "customer" ? SITE : `${ADMIN}/admin`);
const palette = (page: Page) => page.evaluate(() => document.documentElement.dataset.palette);
const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  // super admin picks a non-default palette once, through the real studio
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await loginAs(page, "super_admin");
  await page.goto(`${ADMIN}/admin/settings`);
  await page.getByRole("button", { name: "Theme", exact: true }).click();
  await page.getByRole("combobox", { name: "Accent palette", exact: true }).click();
  await page.getByPlaceholder(/Search \d+ options/).fill("sun");
  await page.getByRole("option", { name: "Sunset", exact: true }).first().click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Settings saved")).toBeVisible({ timeout: 30_000 });
  await page.close();
});

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  await loginAs(page, "super_admin");
  await resetThemeViaUi(page);
  await page.close();
  await q(`update users set theme_pref = null where theme_pref is not null`).catch(() => {});
});

for (const viewer of VIEWERS) {
  test(`${viewer}: admin design by default, dark/light toggle remembered`, async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "widths are driven explicitly from desktop");
    test.setTimeout(150_000);
    const issues = trackIssues(page, [/429/]);
    if (viewer !== "anonymous") await loginAs(page, viewer);

    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await expect
        .poll(
          async () => {
            await page.goto(homeFor(viewer));
            return palette(page);
          },
          { timeout: 30_000, message: `${viewer} @${w} palette` },
        )
        .toBe("sunset");
    }

    // toggle: admin shell keeps it in the header at every width; the site header collapses it
    // into the menu on small screens, so flip it at 1280 and check it sticks at every width
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(homeFor(viewer));
    const before = await theme(page);
    const toggle = page.getByRole("button", { name: /^Switch to .* theme$/ }).first();
    await expect(toggle).toBeVisible();
    // dark -> light -> auto: "auto" may resolve to the same look, so allow a second click
    await toggle.click();
    await page.waitForTimeout(300);
    if ((await theme(page)) === before) await toggle.click();
    await expect.poll(() => theme(page)).not.toBe(before);
    // the choice lands in the ck_theme cookie (and the profile for signed-in users)
    await expect
      .poll(async () => (await page.context().cookies()).some((c) => c.name === "ck_theme"))
      .toBe(true);
    await page.waitForTimeout(1_000); // setThemePreference is fire-and-forget
    const chosen = await theme(page);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.reload();
      expect(await theme(page), `${viewer} @${w} theme remembered`).toBe(chosen);
      expect(await palette(page), `${viewer} @${w} palette unchanged by toggle`).toBe("sunset");
    }
    issues.assertClean();
  });
}

test("staff (no settings.write) cannot save the design", async ({ page, isMobile }) => {
  test.skip(isMobile, "admin settings is laptop-only");
  await loginAs(page, "staff");
  await page.setViewportSize({ width: 1280, height: 900 });
  const res = await page.goto(`${ADMIN}/admin/settings`);
  const body = await page.locator("body").innerText();
  const save = page.getByRole("button", { name: "Save changes" });
  // either no access at all, or read-only with Save disabled (the action also checks settings.write)
  const denied = (res?.status() ?? 200) >= 400 || /not allowed|no access|permission/i.test(body);
  if (denied) return;
  await expect(page.getByText(/Read-only/).first()).toBeVisible();
  await page.getByRole("button", { name: "Theme", exact: true }).click();
  if ((await save.count()) > 0) await expect(save).toBeDisabled();
});
