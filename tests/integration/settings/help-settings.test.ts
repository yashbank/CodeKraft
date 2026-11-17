import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { getHelpConfigFresh } from "@/modules/help/config";
import { settingsService } from "@/modules/settings/service";
import { createUser } from "../../factories/users";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

const events = vi.hoisted(() => [] as string[]);
vi.mock("next/cache", () => ({
  revalidateTag: (tag: string) => events.push(`revalidate:${tag}`),
  revalidatePath: () => {},
  unstable_cache: (fn: () => unknown) => fn,
}));
vi.mock("@/lib/db", async (orig) => {
  const real = await orig<typeof import("@/lib/db")>();
  return {
    ...real,
    withTx: async (...args: Parameters<typeof real.withTx>) => {
      const out = await real.withTx(...args);
      events.push("commit");
      return out;
    },
  };
});

describe("help assistant settings", () => {
  const sql = getTestDb();
  beforeAll(async () => {
    await migrateTestDb();
  });
  beforeEach(async () => {
    await truncateAll(sql);
    events.length = 0;
  });

  const ctxFor = async (role: "super_admin" | "admin" | "staff") => {
    const u = await createUser({ role });
    return buildContext({ user: { id: u.id }, session: { id: "s" }, roles: [role] });
  };

  it("defaults with no stored rows", async () => {
    const s = await settingsService.load();
    expect([s.helpEnabled, s.helpHindiEnabled, s.helpAiEnabled]).toEqual([true, false, true]);
    expect(await getHelpConfigFresh()).toEqual({ enabled: true, hindi: false, ai: true });
  });

  it("super admin saves: persisted, audited, caches revalidated after COMMIT", async () => {
    const ctx = await ctxFor("super_admin");
    await settingsService.updateSettings(ctx, {
      patch: { helpEnabled: false, helpHindiEnabled: true, helpAiEnabled: false },
    });
    expect(await getHelpConfigFresh()).toEqual({ enabled: false, hindi: true, ai: false });
    const commit = events.indexOf("commit");
    expect(commit).toBeGreaterThanOrEqual(0);
    expect(events.indexOf("revalidate:settings")).toBeGreaterThan(commit);
    expect(events.slice(0, commit)).toEqual([]);
    const audit = await sql`select 1 from audit_logs where action = 'API-ADM-10 settings.update'`;
    expect(audit.length).toBe(1);
  });

  it("admin and staff are denied and nothing changes", async () => {
    for (const role of ["admin", "staff"] as const) {
      const ctx = await ctxFor(role);
      await expect(
        settingsService.updateSettings(ctx, { patch: { helpAiEnabled: false } }),
      ).rejects.toThrow();
    }
    expect(await getHelpConfigFresh()).toEqual({ enabled: true, hindi: false, ai: true });
  });

  it("rejects non-boolean values", async () => {
    const ctx = await ctxFor("super_admin");
    await expect(
      settingsService.updateSettings(ctx, { patch: { helpEnabled: "no" as never } }),
    ).rejects.toThrow();
  });
});
