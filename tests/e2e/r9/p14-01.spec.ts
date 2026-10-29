import { expect, test, type Page } from "@playwright/test";

import { ADMIN, loginAs, q, ROLE_EMAILS, type Role } from "./helpers";

// P14-01: per-role widget allow-list (see src/components/admin/dashboard/role-widgets.ts).
const ALLOWED: Record<"admin" | "staff", string[]> = {
  admin: [
    "my_share",
    "publish_approvals",
    "split_approvals",
    "new_leads",
    "overdue_follow_ups",
    "open_queries",
    "catalog_status",
  ],
  staff: ["new_leads", "overdue_follow_ups", "open_queries", "service_checklists"],
};
const TOTAL_WIDGETS = 22;

type Saved = { layout: unknown } | undefined;
const saved = new Map<string, Saved>();

async function userId(role: Role): Promise<string> {
  const [u] = await q<{ id: string }>(`select id from users where email = $1`, [ROLE_EMAILS[role]]);
  return u!.id;
}
/** Pin a saved layout (what a stale/hand-edited row looks like), remembering the old one. */
async function pin(role: Role, keys: string[]): Promise<string> {
  const id = await userId(role);
  if (!saved.has(id)) {
    const [row] = await q<{ layout: unknown }>(
      `select layout from dashboard_layouts where user_id = $1`,
      [id],
    );
    saved.set(id, row);
  }
  await q(
    `insert into dashboard_layouts (user_id, layout) values ($1, $2::text::jsonb)
     on conflict (user_id) do update set layout = excluded.layout`,
    [id, JSON.stringify(keys)],
  );
  return id;
}
const shown = (page: Page) =>
  page
    .locator("section[data-widget]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-widget")));

test.describe("P14-01 role dashboard", () => {
  test.afterAll(async () => {
    for (const [id, row] of saved) {
      if (row)
        await q(`update dashboard_layouts set layout = $2::text::jsonb where user_id = $1`, [
          id,
          JSON.stringify(row.layout),
        ]);
      else await q(`delete from dashboard_layouts where user_id = $1`, [id]);
    }
  });

  test("super_admin: whole library, saved system_health + my_share render", async ({ page }) => {
    await pin("super_admin", ["system_health", "my_share", "new_leads"]);
    await loginAs(page, "super_admin");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${ADMIN}/admin/dashboard`);
    await expect(page.locator('section[data-widget="system_health"]')).toBeVisible({
      timeout: 60_000,
    });
    expect(await shown(page)).toEqual(["system_health", "my_share", "new_leads"]);
    await page.getByRole("button", { name: "Customise" }).click();
    await expect(page.getByRole("dialog").getByRole("switch")).toHaveCount(TOTAL_WIDGETS);
  });

  for (const role of ["admin", "staff"] as const) {
    test(`${role}: only allowed widgets (dashboard + Customise), stale saved ids dropped, own numbers`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      const uid = await pin(role, [
        "system_health",
        "revenue_by_partner",
        "new_leads",
        "payments_awaiting",
        "open_queries",
      ]);
      await loginAs(page, role);
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`${ADMIN}/admin/dashboard`);
      await expect(page.locator('section[data-widget="new_leads"]')).toBeVisible({
        timeout: 60_000,
      });
      // stale ids (system_health, revenue_by_partner, payments_awaiting) are not rendered
      expect(await shown(page)).toEqual(["new_leads", "open_queries"]);

      // scoped number: admin = assigned to me or unassigned; staff = all (docs/06 D-512)
      const [{ n } = { n: "?" }] = await q<{ n: string }>(
        role === "admin"
          ? `select count(*)::text n from leads where status = 'new' and (assigned_to = $1 or assigned_to is null)`
          : `select count(*)::text n from leads where status = 'new' and $1::text is not null`,
        [uid],
      );
      await expect(page.locator('section[data-widget="new_leads"] .tnum').first()).toHaveText(n);

      await page.getByRole("button", { name: "Customise" }).click();
      const switches = page.getByRole("dialog").getByRole("switch");
      await expect(switches).toHaveCount(ALLOWED[role].length);
      await expect(page.getByRole("switch", { name: "System health" })).toHaveCount(0);
      await expect(page.getByRole("switch", { name: "Revenue by partner" })).toHaveCount(0);

      // with no saved row the default layout also stays inside the allow-list
      await page.keyboard.press("Escape");
      await q(`delete from dashboard_layouts where user_id = $1`, [uid]);
      await page.goto(`${ADMIN}/admin/dashboard`);
      const def = await shown(page);
      expect(def.length).toBeGreaterThan(0);
      for (const k of def) expect(ALLOWED[role]).toContain(k);
    });

    test(`${role}: laptop notice below 1024`, async ({ page }) => {
      await loginAs(page, role);
      for (const w of [375, 768]) {
        await page.setViewportSize({ width: w, height: 900 });
        await page.goto(`${ADMIN}/admin/dashboard`);
        await expect(page.getByText(/designed for laptops/i)).toBeVisible();
      }
    });
  }
});
