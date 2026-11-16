/**
 * G18: Danger Zone shows a per-category preview (payouts and partners included) as soon as data is
 * picked, and stays readable with no sideways scroll (Settings is a laptop-only screen: below 1024px it shows a notice). Nothing is requested: the request goes through a confirm dialog that Esc cancels.
 */
import { expect, test } from "@playwright/test";
import { ADMIN, expectNoOverflow, loginAs, trackIssues } from "./helpers";

test("Danger Zone preview lists payouts and partners per category and fits at 1024px and up", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "widths are driven by setViewportSize on the desktop project");
  const issues = trackIssues(page);
  await loginAs(page, "super_admin");
  for (const w of [1024, 1280]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(`${ADMIN}/admin/settings`);
    await page
      .getByRole("button", { name: /danger/i })
      .first()
      .click();
    await page.getByRole("checkbox", { name: /customers and orders/i }).click();
    const preview = page.getByRole("group", { name: /rows to delete/i });
    await expect(preview).toBeVisible({ timeout: 20_000 });
    await expect(preview).toContainText("Payouts");
    await expect(preview).toContainText("Partners (removed and demo accounts)");
    await expect(preview.getByTestId("reset-preview-finance")).toBeVisible();
    await expect(preview.getByTestId("reset-preview-customers_orders")).toBeVisible();
    await expectNoOverflow(page);
    // Backup is required before the request button enables; the confirm dialog opens and Esc cancels it.
    await page.getByRole("button", { name: /download backup/i }).click();
    const request = page.getByRole("button", { name: /^request site reset$/i });
    await expect(request).toBeEnabled();
    await request.click();
    const dialog = page.getByRole("dialog", { name: /permanently delete/i });
    await expect(dialog).toContainText(/customers and orders/i);
    await expect(dialog.getByRole("button", { name: /^cancel$/i })).toBeFocused();
    await expect(
      dialog.getByRole("button", { name: /confirm site reset request/i }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    if (w === 1024) {
      await page.screenshot({ path: "test-results/g18-danger-1024.png", fullPage: true });
    }
  }
  issues.assertClean();
});
