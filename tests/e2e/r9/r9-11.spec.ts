import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

import { ADMIN, atWidths, loginAs } from "./helpers";

/** Open the Export menu, pick a format, return the downloaded file. */
async function exportAs(page: Page, item: "Excel (.xlsx)" | "CSV") {
  await page.getByRole("button", { name: /^Export/ }).click();
  const [dl] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("menuitem", { name: item }).click(),
  ]);
  const body = readFileSync(await dl.path());
  return { name: dl.suggestedFilename(), body };
}

test.describe("R9-11 xlsx + csv exports", () => {
  test("ledger and customers offer styled Excel and plain CSV", async ({ page }) => {
    test.setTimeout(180_000);
    await loginAs(page, "super_admin");

    for (const url of [`${ADMIN}/admin/finance/ledger`, `${ADMIN}/admin/customers`]) {
      await atWidths(page, url, async () => {
        await page.getByRole("button", { name: /^Export/ }).click();
        await expect(page.getByRole("menuitem", { name: "Excel (.xlsx)" })).toBeVisible();
        await expect(page.getByRole("menuitem", { name: "CSV" })).toBeVisible();
        await page.keyboard.press("Escape");
      });

      const xlsx = await exportAs(page, "Excel (.xlsx)");
      expect(xlsx.name).toMatch(/\.xlsx$/);
      expect(xlsx.body.length).toBeGreaterThan(0);
      expect(xlsx.body.subarray(0, 2).toString()).toBe("PK"); // zip container

      const csv = await exportAs(page, "CSV");
      expect(csv.name).toMatch(/\.csv$/);
      expect(csv.body.length).toBeGreaterThan(0);
      expect(csv.body.toString("utf8")).toContain(",");
    }
  });
});
