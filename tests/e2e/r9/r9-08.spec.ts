import { expect, test, type Page } from "@playwright/test";

import { ADMIN, SITE, WIDTHS, expectNoOverflow, loginAs, q, trackIssues } from "./helpers";

const KEYS = [
  "theme_palette",
  "ui_font",
  "ui_radius",
  "ui_border",
  "ui_pattern",
  "ui_layout",
  "ui_density",
];

// Admin settings is laptop-only (<1024 renders LaptopNotice), so always load it at 1280.
async function openTheme(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${ADMIN}/admin/settings`);
  await page.getByRole("button", { name: "Theme", exact: true }).click();
  await expect(page.getByRole("group", { name: "Accent palette" })).toBeVisible();
}

/** Open "Show all" for a group, optionally search, pick an option; the dialog/sheet closes. */
async function pick(page: Page, group: RegExp, option: string, search?: string) {
  await page.getByRole("button", { name: group }).click();
  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible();
  if (search) {
    await modal.getByRole("searchbox").fill(search);
    await expect(modal.getByRole("button", { name: option })).toBeVisible();
  }
  await modal.getByRole("button", { name: option }).first().click();
  await expect(modal).toBeHidden();
}

const rootVar = (page: Page, name: string) =>
  page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

test.describe("R9-08 theme options", () => {
  test.afterAll(async () => {
    await q(`delete from site_settings where key = any($1)`, [KEYS]);
  });

  test("palette, font and radius apply on the storefront", async ({ page }) => {
    const issues = trackIssues(page);
    await loginAs(page, "super_admin");
    await openTheme(page);

    await pick(page, /Show all accent palette/i, "Sunset", "sun");
    await pick(page, /Show all font pairing/i, "Poppins", "pop");
    await pick(page, /Show all corner radius/i, "Pill");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(/saved/i).first()).toBeVisible();

    await expect
      .poll(
        async () => {
          await page.goto(SITE);
          return page.evaluate(() => document.documentElement.dataset.palette);
        },
        { timeout: 30_000 },
      )
      .toBe("sunset");
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(await rootVar(page, "--ck-color-accent")).toBe(
      theme === "light-editorial" ? "#a8420a" : "#ff9a5c",
    );
    expect(await rootVar(page, "--ck-font-display")).toMatch(/poppins/i); // computed custom props are var()-resolved to the family name
    expect(await rootVar(page, "--ck-radius-md")).toBe("24px");
    issues.assertClean();
  });

  test("dialog / sheet fits at 375, 768, 1280 and Esc closes it", async ({ page }) => {
    await loginAs(page, "super_admin");
    await openTheme(page);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 800 });
      await expect(async () => expectNoOverflow(page)).toPass({ timeout: 5000 }); // layout settles after resize
      if (w < 1024) {
        // By design (docs/07 §3.4) the settings form is replaced by the laptop notice here.
        await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
        await expect(page.getByText(/designed for laptops/i)).toBeVisible();
        continue;
      }
      await page.getByRole("button", { name: /Show all accent palette/i }).click();
      const modal = page.getByRole("dialog");
      await expect(modal).toBeVisible();
      const box = await modal.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(w + 1);
      await expectNoOverflow(page);
      await page.keyboard.press("Escape");
      await expect(modal).toBeHidden();
      await expect(page.getByRole("button", { name: /Show all accent palette/i })).toBeFocused();
    }
  });

  test("card padding option changes the padding cards use", async ({ page }) => {
    await loginAs(page, "super_admin");
    await openTheme(page);
    await page
      .getByRole("radiogroup", { name: "Card padding" })
      .getByRole("radio", { name: /Comfortable/ })
      .click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(/saved/i).first()).toBeVisible();
    const pad = async () => {
      await page.goto(SITE);
      return page.evaluate(() => {
        const el = document.createElement("div"); // same rule Card uses: py-[var(--card-pad,1.5rem)]
        el.style.paddingTop = "var(--card-pad,1.5rem)";
        document.body.append(el);
        const v = getComputedStyle(el).paddingTop;
        el.remove();
        return [document.documentElement.dataset.density, v];
      });
    };
    await expect.poll(pad, { timeout: 30_000 }).toEqual(["comfortable", "32px"]);
  });

  test("inline lists show at most 3 options", async ({ page }) => {
    await loginAs(page, "super_admin");
    await openTheme(page);
    for (const g of ["Accent palette", "Font pairing", "Corner radius", "Borders"]) {
      const n = await page.getByRole("radiogroup", { name: g }).getByRole("radio").count();
      expect(n).toBeGreaterThan(0);
      expect(n).toBeLessThanOrEqual(3);
    }
  });
});
