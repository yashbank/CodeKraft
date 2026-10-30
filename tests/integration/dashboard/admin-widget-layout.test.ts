/**
 * R8-10 — the admin dashboard's widget selection/order is persisted per admin in
 * `dashboard_layouts` and two admins never share a layout. Root cause of the bug: the dashboard
 * kept the selection only in React state and the page never read a saved layout back.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { saveAdminWidgetLayoutAction } from "@/modules/dashboard-widgets/actions";
import { getAdminWidgetLayout } from "@/modules/dashboard-widgets/admin-layout";
import { createUser } from "../../factories/users";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

function ctxFor(id: string) {
  return buildContext({ user: { id }, session: { id: `s-${id}` }, roles: ["super_admin"] });
}

describe("admin dashboard widget layout (R8-10)", () => {
  const sql = getTestDb();
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("returns null before an admin saves, then the saved order after", async () => {
    await truncateAll(sql);
    const admin = await createUser({ role: "super_admin" });
    expect(await getAdminWidgetLayout(admin.id)).toBeNull();

    const res = await saveAdminWidgetLayoutAction(
      { widgets: ["chatbot_usage", "new_leads", "system_health"] },
      ctxFor(admin.id),
    );
    expect(res.ok).toBe(true);
    expect(await getAdminWidgetLayout(admin.id)).toEqual([
      "chatbot_usage",
      "new_leads",
      "system_health",
    ]);

    // Re-saving (reorder + removal) overwrites the same row.
    await saveAdminWidgetLayoutAction(
      { widgets: ["system_health", "chatbot_usage"] },
      ctxFor(admin.id),
    );
    expect(await getAdminWidgetLayout(admin.id)).toEqual(["system_health", "chatbot_usage"]);
  });

  it("keeps two admins' layouts separate", async () => {
    await truncateAll(sql);
    const a = await createUser({ role: "super_admin" });
    const b = await createUser({ role: "super_admin" });
    await saveAdminWidgetLayoutAction({ widgets: ["revenue_by_partner"] }, ctxFor(a.id));
    await saveAdminWidgetLayoutAction({ widgets: ["open_queries", "new_customers"] }, ctxFor(b.id));
    expect(await getAdminWidgetLayout(a.id)).toEqual(["revenue_by_partner"]);
    expect(await getAdminWidgetLayout(b.id)).toEqual(["open_queries", "new_customers"]);
  });

  it("an empty selection is saved (not treated as 'use defaults')", async () => {
    await truncateAll(sql);
    const admin = await createUser({ role: "super_admin" });
    await saveAdminWidgetLayoutAction({ widgets: [] }, ctxFor(admin.id));
    expect(await getAdminWidgetLayout(admin.id)).toEqual([]);
  });

  it("rejects widgets outside the caller's role allow-list (P14-01)", async () => {
    await truncateAll(sql);
    const admin = await createUser({ role: "admin" });
    const ctx = buildContext({
      user: { id: admin.id },
      session: { id: `s-${admin.id}` },
      roles: ["admin"],
    });
    const bad = await saveAdminWidgetLayoutAction({ widgets: ["new_leads", "system_health"] }, ctx);
    expect(bad.ok).toBe(false);
    expect(await getAdminWidgetLayout(admin.id)).toBeNull();
    const good = await saveAdminWidgetLayoutAction({ widgets: ["new_leads", "my_share"] }, ctx);
    expect(good.ok).toBe(true);
  });

  it("rejects unknown and duplicate widget keys", async () => {
    await truncateAll(sql);
    const admin = await createUser({ role: "super_admin" });
    const unknown = await saveAdminWidgetLayoutAction({ widgets: ["nope"] }, ctxFor(admin.id));
    expect(unknown.ok).toBe(false);
    const dup = await saveAdminWidgetLayoutAction(
      { widgets: ["new_leads", "new_leads"] },
      ctxFor(admin.id),
    );
    expect(dup.ok).toBe(false);
    expect(await getAdminWidgetLayout(admin.id)).toBeNull();
  });
});
