import { test } from "@playwright/test";
import { ADMIN, loginAs, q } from "./helpers";
const KEYS = [
  "theme_palette",
  "ui_font",
  "ui_radius",
  "ui_border",
  "ui_pattern",
  "ui_layout",
  "ui_density",
];
test("dbg", async ({ page }) => {
  await loginAs(page, "super_admin");
  await page.setViewportSize({ width: 1280, height: 800 });
  const probe = (tag: string) =>
    page.evaluate((tag) => {
      const w = window.innerWidth;
      const out: string[] = [];
      document.querySelectorAll("*").forEach((e) => {
        const r = e.getBoundingClientRect();
        if (r.right > w + 1 && r.width > 0)
          out.push(
            `${e.tagName}.${String(e.className).slice(0, 100)} r=${Math.round(r.right)} w=${Math.round(r.width)}`,
          );
      });
      return (
        `${tag} sw=${document.documentElement.scrollWidth} iw=${w} ` + out.slice(0, 8).join(" | ")
      );
    }, tag);
  await page.goto(`${ADMIN}/admin/settings`);
  await page.getByRole("button", { name: "Theme", exact: true }).click();
  for (const [g, o] of [
    [/Show all font pairing/i, "Poppins"],
    [/Show all corner radius/i, "Pill"],
  ] as const) {
    await page.getByRole("button", { name: g }).click();
    await page.getByRole("dialog").getByRole("button", { name: o }).first().click();
  }
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByText(/saved/i).first().waitFor();
  await page.goto(`${ADMIN}/admin/settings`);
  await page.getByRole("button", { name: "Theme", exact: true }).click();
  await page.waitForTimeout(800);
  console.log("P", await probe("after"));
  await q(`delete from site_settings where key = any($1)`, [KEYS]);
});
