import { expect, test } from "@playwright/test";

import { ADMIN, loginAs } from "./helpers";

for (const width of [375, 768, 1280]) {
  test(`[staff] @${width}: 403 screen on finance ledger, no finance/audit nav`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await loginAs(page, "staff");
    await page.goto(`${ADMIN}/admin/finance/ledger`);
    await expect(page.getByTestId("admin-no-access")).toBeVisible();
    await expect(page.getByText("Open on a laptop")).toHaveCount(0);

    await page.goto(`${ADMIN}/admin/dashboard`);
    const nav = page.locator('aside[aria-label="Admin navigation"]');
    if (width >= 1024) {
      await expect(nav.getByRole("link", { name: "Audit log" })).toHaveCount(0);
      await expect(nav.getByRole("link", { name: "Admin users" })).toHaveCount(0);
      await expect(nav.getByText("Ledger")).toHaveCount(0);
    }
  });
}
