/**
 * P14-08: per-section style controls in the Landing editor. As super_admin set padding + border +
 * font on the "What we build" chapter, see the live preview change before save, save, and check the
 * public landing (computed style) at 375/768/1280 with no overflow and the other sections unchanged.
 */
import { expect, test, type Page } from "@playwright/test";

import { ADMIN, SITE, WIDTHS, expectNoOverflow, loginAs, q, trackIssues } from "./helpers";

test.setTimeout(240_000);

const metrics = (page: Page, id: string) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const c = getComputedStyle(el);
    return {
      pt: c.paddingTop,
      bt: c.borderTopWidth,
      ff: c.fontFamily,
      styleAttr: el.getAttribute("style"),
    };
  }, id);

async function pick(page: Page, id: string, option: string) {
  await page.locator(`#${id}`).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test("P14-08 landing section style: preview, save, public render", async ({ page }) => {
  const issues = trackIssues(page, [/\/api\/chat/]);
  await q(`update landing_chapters set media = coalesce(media,'{}'::jsonb) - 'style'`);

  // Baseline of the untouched sections on the public site, per width.
  const base: Record<number, Awaited<ReturnType<typeof metrics>>[]> = {};
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(SITE);
    base[w] = [
      await metrics(page, "#build"),
      await metrics(page, "#sell"),
      await metrics(page, "#proof"),
    ];
    expect(base[w]?.[0]?.styleAttr).toBeNull();
  }

  await loginAs(page, "super_admin");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${ADMIN}/admin/content/landing`);
  await page
    .getByRole("navigation", { name: "Chapters" })
    .getByRole("button", { name: /What we build/ })
    .click();

  const preview = page.locator('[data-testid="section-style-preview"] section');
  const before = await preview.evaluate((el) => getComputedStyle(el).paddingTop);
  await pick(page, "style-padY", "Large");
  await pick(page, "style-border", "Strong");
  await pick(page, "style-font", "Playfair Display + Work Sans");

  // Live preview changed before saving.
  await expect(preview).toHaveCSS("padding-top", "112px");
  expect(before).not.toBe("112px");
  await expect(preview).toHaveCSS("border-top-width", "2px");
  expect(await preview.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Work_Sans/i);

  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/Chapter saved/)).toBeVisible({ timeout: 20_000 });

  try {
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await expect
        .poll(
          async () => {
            await page.goto(SITE);
            return (await metrics(page, "#build"))?.pt;
          },
          { timeout: 30_000 },
        )
        .toBe("112px");
      await expectNoOverflow(page);
      const build = await metrics(page, "#build");
      expect(build?.bt).toBe("2px");
      expect(build?.ff).toMatch(/Work_Sans/i);
      // Other sections are unchanged.
      expect([await metrics(page, "#sell"), await metrics(page, "#proof")]).toEqual(
        base[w]?.slice(1),
      );
    }
  } finally {
    // Back to defaults through the UI so the public cache is revalidated too.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${ADMIN}/admin/content/landing`);
    await page
      .getByRole("navigation", { name: "Chapters" })
      .getByRole("button", { name: /What we build/ })
      .click();
    for (const id of ["style-padY", "style-border", "style-font"]) await pick(page, id, "Default");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/Chapter saved/).first()).toBeVisible({ timeout: 20_000 });
    await q(`update landing_chapters set media = coalesce(media,'{}'::jsonb) - 'style'`);
  }
  issues.assertClean();
});
