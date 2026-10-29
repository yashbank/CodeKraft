import { expect, test } from "@playwright/test";

import { ADMIN, atWidths, loginAs, q, trackIssues } from "./helpers";

const BAD = /\bNaN\b|\bundefined\b|\bnull\b|lorem|placeholder|TODO/i;

test.describe("R9-07 admin dashboard", () => {
  test.afterEach(async () => {
    await q(`delete from site_settings where key = 'ui_radius'`);
  });

  test("health is real, widgets clean, radius token reaches cards, 3 widths", async ({ page }) => {
    test.setTimeout(240_000);
    const issues = trackIssues(page);
    await loginAs(page, "super_admin");
    await page.setViewportSize({ width: 1280, height: 900 }); // settings is laptop-only
    await page.goto(`${ADMIN}/admin/dashboard`);
    // system_health is not in the default layout: add it from the widget library.
    await page.getByRole("button", { name: "Customise" }).click();
    await page.getByRole("switch", { name: "System health" }).check();
    await page.keyboard.press("Escape");

    const health = page.locator('section[data-widget="system_health"]');
    await expect(health).toBeVisible({ timeout: 60_000 });
    await expect(health.getByText("Database")).toBeVisible();
    await expect(health.getByText(/ok · \d+ ms/).first()).toBeVisible();
    await expect(health.getByText("Payments")).toBeVisible();
    await expect(health.getByText("Migrations")).toBeVisible();
    expect(await health.innerText()).not.toMatch(/key_?secret|rzp_/i);

    const widgets = page.locator("section[data-widget]");
    expect(await widgets.count()).toBeGreaterThan(0);
    for (const t of await widgets.allInnerTexts()) expect(t).not.toMatch(BAD);

    const before = await widgets.first().evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
    await page.goto(`${ADMIN}/admin/settings`);
    await page.getByRole("button", { name: "Theme", exact: true }).click();
    await page.getByRole("radio", { name: "Round" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Settings saved")).toBeVisible({ timeout: 30_000 });
    await page.goto(`${ADMIN}/admin/dashboard`);
    const after = await page
      .locator("section[data-widget]")
      .first()
      .evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
    expect(after).not.toBe(before);

    await atWidths(page, `${ADMIN}/admin/dashboard`, async () => {
      await expect(page.locator('section[data-widget="system_health"]')).toBeVisible();
      expect(await page.locator("main").innerText()).not.toMatch(BAD);
    });
    issues.assertClean();
  });
});
