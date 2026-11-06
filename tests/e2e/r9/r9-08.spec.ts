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
];

// Admin settings is laptop-only (<1024 renders LaptopNotice), so always load it at 1280.
async function openTheme(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${ADMIN}/admin/settings`);
  await page.getByRole("button", { name: "Theme", exact: true }).click();
  // G18: palette, radius, borders and button style are swatch tiles; the rest are dropdowns.
  await expect(page.getByRole("radiogroup", { name: "Accent palette", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Font pairing", exact: true })).toBeVisible();
}

/** P14-07: every group is a searchable dropdown; open it, optionally search, pick an option. */
async function pick(page: Page, group: string, option: string, search?: string) {
  if (["Corner radius", "Accent palette", "Button style", "Borders"].includes(group)) {
    await page.getByRole("radio", { name: option, exact: true }).click();
    return;
  }
  await page.getByRole("combobox", { name: group, exact: true }).click();
  if (search) await page.getByPlaceholder(/Search \d+ options/).fill(search);
  await page.getByRole("option", { name: option, exact: true }).first().click();
  await expect(page.getByRole("listbox")).toBeHidden();
}

const rootVar = (page: Page, name: string) =>
  page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

test.describe("R9-08 theme options", () => {
  // Site theme is one global row: the desktop and mobile projects would race on it when run in
  // parallel. Settings is laptop-only and every test drives its own 1280px viewport, so run it once.
  test.skip(({ isMobile }) => isMobile, "global theme; viewport is driven explicitly from desktop");

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await loginAs(page, "super_admin");
    await resetThemeViaUi(page);
    await page.close();
    await q(`delete from site_settings where key = any($1)`, [KEYS]);
  });

  test("palette, font and radius apply on the storefront", async ({ page }) => {
    const issues = trackIssues(page);
    await loginAs(page, "super_admin");
    await openTheme(page);

    await pick(page, "Accent palette", "Amber");
    await pick(page, "Font pairing", "Poppins", "pop");
    await pick(page, "Corner radius", "Round");
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
      .toBe("amber");
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(await rootVar(page, "--ck-color-accent")).toBe(
      theme === "light-editorial" ? "#8a5300" : "#f5b53d",
    );
    expect(await rootVar(page, "--ck-font-display")).toMatch(/poppins/i); // computed custom props are var()-resolved to the family name
    expect(await rootVar(page, "--ck-radius-md")).toBe("16px");
    issues.assertClean();
  });

  test("dropdown fits at 375, 768, 1280 and Esc closes it", async ({ page }) => {
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
      const trigger = page.getByRole("combobox", { name: "Font pairing", exact: true });
      await trigger.click();
      const list = page.getByRole("listbox");
      await expect(list).toBeVisible();
      const box = await list.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(w + 1);
      await expectNoOverflow(page);
      await page.keyboard.press("Escape");
      await expect(list).toBeHidden();
      await expect(trigger).toBeFocused();
    }
  });

  test("card padding option changes the padding cards use", async ({ page }) => {
    await loginAs(page, "super_admin");
    await openTheme(page);
    await pick(page, "Card padding", "Comfortable");
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

  test("curated groups are tiles, the long lists are searchable dropdowns", async ({ page }) => {
    await loginAs(page, "super_admin");
    await openTheme(page);
    // curated groups: a handful of swatch tiles (G18-3b); the long lists stay searchable dropdowns
    const tiles: Record<string, number> = {
      "Accent palette": 8,
      "Corner radius": 3,
      Borders: 3,
      "Button style": 3,
    };
    for (const [g, n] of Object.entries(tiles))
      await expect(
        page.getByRole("radiogroup", { name: g, exact: true }).getByRole("radio"),
        g,
      ).toHaveCount(n);
    for (const g of ["Font pairing", "Heading font", "Body font"]) {
      await page.getByRole("combobox", { name: g, exact: true }).click();
      expect(await page.getByRole("option").count()).toBeGreaterThanOrEqual(20);
      await page.keyboard.press("Escape");
    }
  });
});
