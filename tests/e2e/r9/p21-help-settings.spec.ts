/**
 * P21-4: Help assistant card in Admin Settings. Super admin toggles each switch, saves, reloads and
 * sees it persisted; an admin sees the card read-only. Rows are removed in afterAll.
 */
import { expect, test, type Page } from "@playwright/test";
import { ADMIN, loginAs, q } from "./helpers";

test.describe.configure({ mode: "serial" });

const KEYS = ["help_enabled", "help_hindi_enabled", "help_ai_enabled"] as const;
type Toggle = "enabled" | "hindi" | "ai";
const DB_KEY: Record<Toggle, string> = {
  enabled: "help_enabled",
  hindi: "help_hindi_enabled",
  ai: "help_ai_enabled",
};

async function openHelp(page: Page): Promise<void> {
  await page.goto(`${ADMIN}/admin/settings`);
  await page.getByRole("button", { name: "Help assistant" }).click();
  await expect(page.getByTestId("help-settings-card")).toBeVisible();
  await page.waitForLoadState("networkidle");
}

test.afterAll(async () => {
  await q(`delete from site_settings where key = any($1)`, [[...KEYS]]);
});

test("defaults, usage line, each toggle persists across reload", async ({ page }) => {
  await q(`delete from site_settings where key = any($1)`, [[...KEYS]]);
  await loginAs(page, "super_admin");
  await openHelp(page);
  await expect(page.getByText("Ask me anything pop-up")).toBeVisible();
  await expect(page.getByText("Hindi language")).toBeVisible();
  await expect(page.getByText("Off = free guide-only mode.")).toBeVisible();
  await expect(page.getByTestId("help-usage")).toContainText("this month");
  await expect(page.getByTestId("help-toggle-enabled")).toBeChecked();
  await expect(page.getByTestId("help-toggle-hindi")).not.toBeChecked();
  await expect(page.getByTestId("help-toggle-ai")).toBeChecked();

  for (const [t, expected] of [
    ["enabled", false],
    ["hindi", true],
    ["ai", false],
  ] as const) {
    await openHelp(page);
    await page.getByTestId(`help-toggle-${t}`).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Settings saved", { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    const rows = await q<{ value: unknown }>(`select value from site_settings where key = $1`, [
      DB_KEY[t],
    ]);
    expect(rows[0]?.value).toBe(expected);
    await page.reload();
    await openHelp(page);
    const el = page.getByTestId(`help-toggle-${t}`);
    if (expected) await expect(el).toBeChecked();
    else await expect(el).not.toBeChecked();
  }
});

test("admin (not super admin) sees the card read-only", async ({ page }) => {
  await loginAs(page, "admin");
  await openHelp(page);
  for (const t of ["enabled", "hindi", "ai"]) {
    await expect(page.getByTestId(`help-toggle-${t}`)).toBeDisabled();
  }
  await expect(page.getByText("Read-only", { exact: false }).first()).toBeVisible();
});
