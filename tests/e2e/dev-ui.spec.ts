import { expect, test } from "@playwright/test";

import { expectNoA11yViolations } from "./fixtures";

const THEMES = ["dark-cinematic", "light-editorial"] as const;

for (const theme of THEMES) {
  test(`@axe /dev/ui renders every section in ${theme}`, async ({ page }) => {
    await page.goto("/dev/ui");
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, theme);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("kitchen sink");
    for (const id of ["buttons", "forms", "overlays", "data", "status", "formatting"]) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }
    await expectNoA11yViolations(page);
  });
}
