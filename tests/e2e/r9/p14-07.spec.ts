import { expect, test, type Page } from "@playwright/test";

import {
  ADMIN,
  SITE,
  WIDTHS,
  expectNoOverflow,
  loginAs,
  q,
  resetThemeViaUi,
  trackIssues,
} from "./helpers";

const KEYS = [
  "theme_palette",
  "ui_font",
  "ui_radius",
  "ui_border",
  "ui_pattern",
  "ui_layout",
  "ui_density",
  "theme_studio",
  "theme_presets",
];

// Admin settings is laptop-only (<1024 renders LaptopNotice), so load it at 1280.
async function openTheme(page: Page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${ADMIN}/admin/settings`);
  // A parallel spec's fresh login revokes this session (one session per user): the page is then
  // the login form and an un-timed click waited out the whole 240 s test (Mac A). Re-login once.
  if (/\/auth\/login/.test(page.url())) {
    await loginAs(page, "super_admin");
    await page.goto(`${ADMIN}/admin/settings`);
  }
  await page.getByRole("button", { name: "Theme", exact: true }).click({ timeout: 30_000 });
  await expect(page.getByTestId("theme-preview")).toBeVisible();
}

async function pick(page: Page, group: string, option: string, search?: string) {
  // G18: palette, radius, borders and button style are swatch tiles (radio), the rest dropdowns.
  if (["Corner radius", "Accent palette", "Button style", "Borders"].includes(group)) {
    await page.getByRole("radio", { name: option, exact: true }).click();
    return;
  }
  await page.getByRole("combobox", { name: group, exact: true }).click();
  if (search) await page.getByPlaceholder(/Search \d+ options/).fill(search);
  await page.getByRole("option", { name: option, exact: true }).first().click();
  await expect(page.getByRole("listbox")).toBeHidden();
}

const previewStyle = (page: Page, sel: string, prop: string) =>
  page
    .getByTestId("theme-preview")
    .locator(sel)
    .first()
    .evaluate((el, p) => getComputedStyle(el)[p as never] as string, prop);
const rootVar = (page: Page, name: string) =>
  page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

async function save(page: Page) {
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Settings saved")).toBeVisible({ timeout: 30_000 });
}

test.describe("P14-07 theme studio", () => {
  // The site theme is one global row: desktop and mobile projects would race on it when run in
  // parallel. Settings is laptop-only and every test drives its own viewport, so run it once.
  test.skip(({ isMobile }) => isMobile, "global theme; viewport is driven explicitly from desktop");

  test.afterEach(async ({ page }) => {
    await resetThemeViaUi(page);
    await q(`delete from site_settings where key = any($1)`, [KEYS]);
  });

  test("preview changes before save; save reaches the site at 375/768/1280", async ({ page }) => {
    test.setTimeout(240_000);
    const issues = trackIssues(page);
    await loginAs(page, "super_admin");
    await openTheme(page);

    const card = '[data-sample="product"]';
    const title = `${card} [data-slot="card-title"]`;
    const cta = '[data-sample="hero"] [data-slot="button"]';
    const before = {
      radius: await previewStyle(page, card, "borderTopLeftRadius"),
      font: await previewStyle(page, title, "fontFamily"),
      bg: await previewStyle(page, cta, "backgroundColor"),
      siteRadius: await rootVar(page, "--ck-radius-lg"),
    };

    await pick(page, "Corner radius", "Round");
    await pick(page, "Heading font", "Playfair Display (serif)", "playf");
    await pick(page, "Accent palette", "Amber");
    await pick(page, "Button style", "Pill");

    // Instant, scoped preview: the sample changed ...
    expect(await previewStyle(page, card, "borderTopLeftRadius")).toBe("22px");
    expect(await previewStyle(page, title, "fontFamily")).toMatch(/Playfair Display/);
    // the button fades its colour (transition), so poll instead of reading mid-fade
    await expect.poll(() => previewStyle(page, cta, "backgroundColor")).not.toBe(before.bg);
    // ... but nothing outside it, and nothing is saved yet.
    expect(await rootVar(page, "--ck-radius-lg")).toBe(before.siteRadius);
    expect(before.radius).not.toBe("22px");
    expect(await page.evaluate(() => document.documentElement.dataset.palette)).not.toBe("amber");

    await save(page);
    await expect
      .poll(
        async () => {
          await page.goto(SITE);
          const palette = await page.evaluate(() => document.documentElement.dataset.palette);
          return `${String(palette)}|${await rootVar(page, "--ck-radius-lg")}`;
        },
        { timeout: 30_000 },
      )
      .toBe("amber|22px");
    expect(await rootVar(page, "--ck-font-display")).toMatch(/Playfair Display/);
    expect(
      await page
        .locator('link[rel="stylesheet"][href*="fonts.googleapis.com"]')
        .first()
        .getAttribute("href"),
    ).toContain("Playfair+Display");
    expect(await page.evaluate(() => document.documentElement.hasAttribute("data-ck-btn"))).toBe(
      true,
    );

    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto(SITE);
      await expectNoOverflow(page);
    }
    // Admin is laptop-only by design below 1024.
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(`${ADMIN}/admin/settings`);
    await expect(page.getByText(/designed for laptops/i)).toBeVisible();
    issues.assertClean();
  });

  test("presets: save, reload, apply, delete; reset to defaults", async ({ page }) => {
    test.setTimeout(180_000);
    await loginAs(page, "super_admin");
    await openTheme(page);
    const card = '[data-sample="product"]';
    const radius = () => previewStyle(page, card, "borderTopLeftRadius");
    const base = await radius();

    await pick(page, "Corner radius", "Sharp");
    await pick(page, "Accent palette", "Rose");
    const sharp = await radius();
    expect(sharp).not.toBe(base);

    await page.getByLabel("Preset name").fill("P14 warm");
    await page.getByRole("button", { name: "Save current as preset" }).click();
    await expect(page.locator('[data-preset="P14 warm"]')).toBeVisible({ timeout: 30_000 });

    // Reset puts the draft (not the saved site) back to defaults.
    await page.getByRole("button", { name: "Reset to defaults" }).click();
    expect(await radius()).toBe(base);
    await expect(page.getByRole("radio", { name: "Violet", exact: true })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    // The preset survives a reload and applies every value again.
    await openTheme(page);
    await expect(page.locator('[data-preset="P14 warm"]')).toBeVisible();
    await page.getByRole("button", { name: "Apply preset P14 warm" }).click();
    expect(await radius()).toBe(sharp);
    await expect(page.getByRole("radio", { name: "Rose", exact: true })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(page.getByRole("radio", { name: "Sharp", exact: true })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await page.getByRole("button", { name: "Delete preset P14 warm" }).click();
    await expect(page.locator('[data-preset="P14 warm"]')).toHaveCount(0, { timeout: 30_000 });
  });

  test("reset + save returns the site to its defaults", async ({ page }) => {
    test.setTimeout(180_000);
    await loginAs(page, "super_admin");
    await openTheme(page);
    await pick(page, "Accent palette", "Amber");
    await save(page);
    const palette = async () => {
      await page.goto(SITE);
      return page.evaluate(() => document.documentElement.dataset.palette);
    };
    await expect.poll(palette, { timeout: 30_000 }).toBe("amber");

    await openTheme(page);
    await page.getByRole("button", { name: "Reset to defaults" }).click();
    await save(page);
    await expect.poll(palette, { timeout: 30_000 }).toBe("violet");
    expect(await page.evaluate(() => document.documentElement.hasAttribute("data-ck-btn"))).toBe(
      false,
    );
  });
});
